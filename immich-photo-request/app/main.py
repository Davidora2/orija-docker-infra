from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from .config import Settings, get_settings
from .db import db
from .immich import (
    ImmichError,
    folder_slug_from_user,
    list_libraries,
    scan_library,
    validate_api_key,
)

APP_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(APP_DIR / "templates"))

app = FastAPI(title="Immich Photo Request")
app.mount("/static", StaticFiles(directory=str(APP_DIR / "static")), name="static")


def settings_dep() -> Settings:
    return get_settings()


@app.on_event("startup")
async def startup() -> None:
    settings = get_settings()
    Path(settings.external_library_root).mkdir(parents=True, exist_ok=True)
    Path(settings.database_path).parent.mkdir(parents=True, exist_ok=True)
    db.path = settings.database_path
    await db.init()


def parse_expiry(expires_at: str | None) -> datetime | None:
    if not expires_at:
        return None
    return datetime.fromisoformat(expires_at)


def request_is_open(row: dict) -> tuple[bool, str]:
    if not row.get("active"):
        return False, "This request link has been closed."
    expires = parse_expiry(row.get("expires_at"))
    if expires and datetime.now(timezone.utc) > expires:
        return False, "This request link has expired."
    if int(row.get("upload_count") or 0) >= int(row.get("max_files") or 0):
        return False, "This request has reached its upload limit."
    return True, ""


def safe_filename(name: str) -> str:
    name = Path(name).name
    name = re.sub(r"[^\w.\- ()\[\]]+", "_", name).strip("._")
    return name or f"upload-{secrets.token_hex(4)}"


def request_dir(user_slug: str, request_id: str, settings: Settings) -> Path:
    path = Path(settings.external_library_root) / user_slug / "requests" / request_id
    path.mkdir(parents=True, exist_ok=True)
    return path


async def require_user(x_api_key: str = Header(alias="X-API-Key")) -> dict:
    if not x_api_key:
        raise HTTPException(401, "Immich API key required")
    try:
        me = await validate_api_key(x_api_key)
    except ImmichError as exc:
        raise HTTPException(exc.status_code or 401, str(exc)) from exc

    user = await db.upsert_user(
        immich_user_id=str(me["id"]),
        email=me.get("email") or "",
        name=me.get("name") or me.get("email") or "Immich user",
        folder_slug=folder_slug_from_user(me),
        api_key_hint=x_api_key[-4:],
    )
    user["_api_key"] = x_api_key
    return user


class CreateRequestBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(default="", max_length=2000)
    expiry_days: int | None = Field(default=None, ge=0, le=365)
    max_files: int | None = Field(default=None, ge=1, le=1000)
    immich_library_id: str | None = None


class UpdateLibraryBody(BaseModel):
    immich_library_id: str = ""


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
async def home(request: Request, settings: Settings = Depends(settings_dep)):
    return templates.TemplateResponse(
        "home.html",
        {
            "request": request,
            "app_name": settings.app_name,
            "immich_base_url": settings.immich_base_url,
            "public_base_url": settings.public_base_url.rstrip("/"),
        },
    )


@app.get("/r/{token}", response_class=HTMLResponse)
async def public_request_page(
    token: str,
    request: Request,
    settings: Settings = Depends(settings_dep),
):
    row = await db.get_request_by_token(token)
    if not row:
        raise HTTPException(404, "Request not found")
    owner = await db.get_user(row["user_id"])
    open_, reason = request_is_open(row)
    remaining = max(0, int(row["max_files"]) - int(row["upload_count"]))
    return templates.TemplateResponse(
        "upload.html",
        {
            "request": request,
            "app_name": settings.app_name,
            "token": token,
            "request_row": row,
            "owner_name": (owner or {}).get("name") or "someone",
            "is_open": open_,
            "closed_reason": reason,
            "max_upload_mb": settings.max_upload_bytes // (1024 * 1024),
            "remaining": remaining,
        },
    )


@app.get("/api/me")
async def api_me(user: dict = Depends(require_user)):
    settings = get_settings()
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "folder_slug": user["folder_slug"],
        "immich_library_id": user.get("immich_library_id") or "",
        "external_path": f"{settings.external_library_root}/{user['folder_slug']}/requests",
    }


@app.get("/api/libraries")
async def api_libraries(user: dict = Depends(require_user)):
    try:
        libs = await list_libraries(user["_api_key"])
    except ImmichError as exc:
        raise HTTPException(exc.status_code or 502, str(exc)) from exc
    return [
        {
            "id": lib.get("id"),
            "name": lib.get("name"),
            "type": lib.get("type"),
            "importPaths": lib.get("importPaths") or lib.get("import_paths") or [],
        }
        for lib in libs
    ]


@app.put("/api/me/library")
async def api_set_library(body: UpdateLibraryBody, user: dict = Depends(require_user)):
    updated = await db.upsert_user(
        immich_user_id=user["immich_user_id"],
        email=user["email"],
        name=user["name"],
        folder_slug=user["folder_slug"],
        api_key_hint=user["api_key_hint"],
        immich_library_id=body.immich_library_id,
    )
    return {"immich_library_id": updated.get("immich_library_id") or ""}


@app.post("/api/requests")
async def api_create_request(
    body: CreateRequestBody,
    user: dict = Depends(require_user),
    settings: Settings = Depends(settings_dep),
):
    if body.immich_library_id is not None:
        await db.upsert_user(
            immich_user_id=user["immich_user_id"],
            email=user["email"],
            name=user["name"],
            folder_slug=user["folder_slug"],
            api_key_hint=user["api_key_hint"],
            immich_library_id=body.immich_library_id,
        )
        user = await db.get_user(user["id"]) or user

    max_files = body.max_files or settings.max_files_per_request
    row = await db.create_request(
        user_id=user["id"],
        title=body.title.strip(),
        message=(body.message or "").strip(),
        expiry_days=body.expiry_days,
        max_files=max_files,
    )
    request_dir(user["folder_slug"], row["id"], settings)
    link = f"{settings.public_base_url.rstrip('/')}/r/{row['token']}"
    return {
        "id": row["id"],
        "token": row["token"],
        "title": row["title"],
        "message": row["message"],
        "expires_at": row["expires_at"],
        "max_files": row["max_files"],
        "link": link,
        "folder": str(
            Path(settings.external_library_root)
            / user["folder_slug"]
            / "requests"
            / row["id"]
        ),
    }


@app.get("/api/requests")
async def api_list_requests(user: dict = Depends(require_user)):
    rows = await db.list_requests(user["id"])
    base = get_settings().public_base_url.rstrip("/")
    return [
        {
            **dict(r),
            "link": f"{base}/r/{r['token']}",
            "is_open": request_is_open(r)[0],
        }
        for r in rows
    ]


@app.post("/api/requests/{request_id}/close")
async def api_close_request(request_id: str, user: dict = Depends(require_user)):
    row = await db.get_request(request_id)
    if not row or row["user_id"] != user["id"]:
        raise HTTPException(404, "Request not found")
    await db.set_request_active(request_id, False)
    return {"ok": True}


@app.get("/api/requests/{request_id}/uploads")
async def api_list_uploads(request_id: str, user: dict = Depends(require_user)):
    row = await db.get_request(request_id)
    if not row or row["user_id"] != user["id"]:
        raise HTTPException(404, "Request not found")
    return await db.list_uploads(request_id)


@app.post("/api/r/{token}/upload")
async def api_public_upload(
    token: str,
    files: list[UploadFile] = File(...),
    note: str = Form(""),
    settings: Settings = Depends(settings_dep),
):
    row = await db.get_request_by_token(token)
    if not row:
        raise HTTPException(404, "Request not found")
    open_, reason = request_is_open(row)
    if not open_:
        raise HTTPException(410, reason)

    owner = await db.get_user(row["user_id"])
    if not owner:
        raise HTTPException(500, "Request owner missing")

    remaining = int(row["max_files"]) - int(row["upload_count"])
    if len(files) > remaining:
        raise HTTPException(400, f"Only {remaining} more file(s) allowed on this request")

    saved: list[dict] = []
    dest_root = request_dir(owner["folder_slug"], row["id"], settings)

    for upload in files:
        raw_name = upload.filename or "upload.bin"
        safe = safe_filename(raw_name)
        target = dest_root / safe
        if target.exists():
            target = dest_root / f"{target.stem}-{secrets.token_hex(3)}{target.suffix}"

        size = 0
        with target.open("wb") as out:
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > settings.max_upload_bytes:
                    out.close()
                    target.unlink(missing_ok=True)
                    raise HTTPException(
                        413,
                        f"{raw_name} exceeds max size "
                        f"({settings.max_upload_bytes // (1024 * 1024)}MB)",
                    )
                out.write(chunk)

        if size == 0:
            target.unlink(missing_ok=True)
            continue

        rec = await db.add_upload(
            request_id=row["id"],
            original_name=raw_name,
            stored_name=target.name,
            size_bytes=size,
            content_type=upload.content_type or "application/octet-stream",
            uploader_note=(note or "").strip()[:500],
        )
        saved.append(
            {
                "id": rec["id"],
                "name": target.name,
                "size_bytes": size,
                "path": str(target),
            }
        )

    scan_error = None
    library_id = (owner.get("immich_library_id") or settings.immich_library_id or "").strip()
    scan_key = (settings.immich_scan_api_key or "").strip()
    if library_id and scan_key and saved:
        try:
            await scan_library(scan_key, library_id)
        except ImmichError as exc:
            scan_error = str(exc)

    return {
        "ok": True,
        "saved": saved,
        "count": len(saved),
        "scan_triggered": bool(library_id and scan_key and saved and not scan_error),
        "scan_error": scan_error,
        "hint": (
            "Files landed in the Immich external library folder. "
            "If they do not appear yet, run Scan on that external library in Immich."
        ),
    }


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    accept = request.headers.get("accept", "")
    if "text/html" in accept and not request.url.path.startswith("/api/"):
        return templates.TemplateResponse(
            "error.html",
            {
                "request": request,
                "app_name": get_settings().app_name,
                "detail": exc.detail,
                "status": exc.status_code,
            },
            status_code=exc.status_code,
        )
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
