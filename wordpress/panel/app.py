"""Orija Hosting Control Panel — Bluehost-style WordPress site manager."""
from __future__ import annotations

import os
import secrets
from pathlib import Path

from fastapi import FastAPI, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware

import sites as site_service

BASE = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE / "templates"))

PANEL_PASSWORD = os.environ.get("PANEL_PASSWORD", "")
SESSION_SECRET = os.environ.get("PANEL_SESSION_SECRET") or secrets.token_hex(32)
DOMAIN_SUFFIX = os.environ.get("DEFAULT_DOMAIN_SUFFIX", "orija.store")
PANEL_TITLE = os.environ.get("PANEL_TITLE", "Orija Hosting")


class StripHostingPrefixMiddleware(BaseHTTPMiddleware):
    """Allow both https://hosting.orija.store/ and …/hosting/ on other hosts."""

    async def dispatch(self, request, call_next):
        path = request.scope.get("path", "")
        if path == "/hosting" or path.startswith("/hosting/"):
            request.scope["path"] = path[len("/hosting") :] or "/"
            request.state.url_prefix = "/hosting"
        else:
            request.state.url_prefix = ""
        return await call_next(request)


def p(request: Request, path: str) -> str:
    prefix = getattr(request.state, "url_prefix", "") or ""
    if not path.startswith("/"):
        path = "/" + path
    return f"{prefix}{path}"


app = FastAPI(title=PANEL_TITLE, docs_url=None, redoc_url=None)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, session_cookie="orija_hosting")
app.add_middleware(StripHostingPrefixMiddleware)
app.mount("/static", StaticFiles(directory=str(BASE / "static")), name="static")


def logged_in(request: Request) -> bool:
    return bool(request.session.get("auth"))


def require_login(request: Request):
    if not logged_in(request):
        return RedirectResponse(p(request, "/login"), status_code=status.HTTP_303_SEE_OTHER)
    return None


def ctx(request: Request, **extra):
    data = {
        "request": request,
        "title": PANEL_TITLE,
        "root": getattr(request.state, "url_prefix", "") or "",
        "static": p(request, "/static"),
        "url": lambda path, _r=request: p(_r, path),
    }
    data.update(extra)
    return data


@app.on_event("startup")
def startup() -> None:
    site_service._ensure_data()
    if not (site_service.load_registry().get("sites")):
        site_service.import_existing_from_yaml(Path("/bootstrap/registry.yaml"))


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if logged_in(request):
        return RedirectResponse(p(request, "/"), status_code=303)
    return templates.TemplateResponse("login.html", ctx(request, error=None))


@app.post("/login")
def login_submit(request: Request, password: str = Form(...)):
    if not PANEL_PASSWORD:
        return templates.TemplateResponse(
            "login.html",
            ctx(request, error="Panel password is not configured."),
            status_code=500,
        )
    if password != PANEL_PASSWORD:
        return templates.TemplateResponse(
            "login.html",
            ctx(request, error="Incorrect password."),
            status_code=401,
        )
    request.session["auth"] = True
    return RedirectResponse(p(request, "/"), status_code=303)


@app.post("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(p(request, "/login"), status_code=303)


@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    redir = require_login(request)
    if redir:
        return redir
    return templates.TemplateResponse(
        "dashboard.html",
        ctx(
            request,
            sites=site_service.list_sites(),
            domain_suffix=DOMAIN_SUFFIX,
            flash=request.session.pop("flash", None),
        ),
    )


@app.get("/sites/new", response_class=HTMLResponse)
def create_page(request: Request):
    redir = require_login(request)
    if redir:
        return redir
    return templates.TemplateResponse(
        "create.html",
        ctx(
            request,
            domain_suffix=DOMAIN_SUFFIX,
            error=None,
            form={"title": "", "subdomain": "", "email": "", "admin_user": "admin"},
        ),
    )


@app.post("/sites/new", response_class=HTMLResponse)
def create_submit(
    request: Request,
    site_title: str = Form(...),
    subdomain: str = Form(...),
    email: str = Form(...),
    admin_user: str = Form("admin"),
):
    redir = require_login(request)
    if redir:
        return redir

    form = {
        "title": site_title,
        "subdomain": subdomain,
        "email": email,
        "admin_user": admin_user or "admin",
    }
    sub = subdomain.strip().lower().replace(" ", "")
    domain = sub if "." in sub else f"{sub}.{DOMAIN_SUFFIX}"
    slug = None if "." in sub else sub

    try:
        entry = site_service.create_site(
            title=site_title.strip(),
            domain=domain,
            admin_email=email.strip(),
            admin_user=(admin_user or "admin").strip(),
            slug=slug,
        )
    except Exception as exc:  # noqa: BLE001
        return templates.TemplateResponse(
            "create.html",
            ctx(request, domain_suffix=DOMAIN_SUFFIX, error=str(exc), form=form),
            status_code=400,
        )

    request.session["flash"] = f"Website “{entry['title']}” is being created."
    return RedirectResponse(p(request, f"/sites/{entry['slug']}"), status_code=303)


@app.get("/sites/{slug}", response_class=HTMLResponse)
def site_detail(request: Request, slug: str):
    redir = require_login(request)
    if redir:
        return redir
    site = site_service.get_site(slug)
    if not site:
        request.session["flash"] = "Site not found."
        return RedirectResponse(p(request, "/"), status_code=303)
    return templates.TemplateResponse(
        "site.html",
        ctx(request, site=site, flash=request.session.pop("flash", None)),
    )


@app.post("/sites/{slug}/delete")
def site_delete(request: Request, slug: str):
    redir = require_login(request)
    if redir:
        return redir
    try:
        site_service.remove_site(slug, delete_stack_flag=True)
        request.session["flash"] = f"Deleted website “{slug}”."
    except Exception as exc:  # noqa: BLE001
        request.session["flash"] = f"Could not delete: {exc}"
    return RedirectResponse(p(request, "/"), status_code=303)
