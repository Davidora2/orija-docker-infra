from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text

from app.api import auth, favorites, library, progress, search, sorter, streams, xtream
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.models import User, XtreamConfig
from app.services.downloads import start_download_worker


def ensure_dirs() -> None:
    dirs = [
        settings.media_root,
        settings.movies_dir,
        settings.shows_dir,
        settings.live_dir,
        settings.downloads_dir,
        settings.incoming_dir,
    ]
    if settings.database_url.startswith("sqlite"):
        raw = settings.database_url.split(":///", 1)[-1]
        db_path = Path(raw if raw.startswith("/") else Path.cwd() / raw)
        dirs.append(db_path.parent)
    docker_data = Path("/data")
    if Path("/.dockerenv").exists():
        dirs.append(docker_data)
    for d in dirs:
        try:
            d.mkdir(parents=True, exist_ok=True)
        except PermissionError:
            continue


async def migrate_sqlite() -> None:
    """Add columns introduced after first release."""
    async with engine.begin() as conn:
        if conn.dialect.name != "sqlite":
            return
        rows = await conn.execute(text("PRAGMA table_info(local_media)"))
        cols = {r[1] for r in rows.fetchall()}
        if "poster" not in cols:
            await conn.execute(text("ALTER TABLE local_media ADD COLUMN poster VARCHAR(1024)"))


async def seed() -> None:
    async with SessionLocal() as db:
        admin = await db.scalar(select(User).where(User.username == settings.admin_username))
        if not admin:
            db.add(
                User(
                    username=settings.admin_username,
                    display_name="Admin",
                    password_hash=hash_password(settings.admin_password),
                    is_admin=True,
                    avatar_color="#e50914",
                    max_streams=settings.max_streams_per_user,
                )
            )
            await db.commit()

        if settings.xtream_base_url and settings.xtream_username and settings.xtream_password:
            existing = await db.scalar(select(XtreamConfig).limit(1))
            if not existing:
                db.add(
                    XtreamConfig(
                        base_url=settings.xtream_base_url.rstrip("/"),
                        username=settings.xtream_username,
                        password=settings.xtream_password,
                        enabled=True,
                        label="Primary",
                    )
                )
                await db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    ensure_dirs()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await migrate_sqlite()
    await seed()
    start_download_worker()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(xtream.router, prefix="/api")
app.include_router(favorites.router, prefix="/api")
app.include_router(streams.router, prefix="/api")
app.include_router(library.router, prefix="/api")
app.include_router(sorter.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(progress.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "app": settings.app_name,
        "media_root": str(settings.media_root),
        "movies_dir": str(settings.movies_dir),
        "shows_dir": str(settings.shows_dir),
    }


static_dir = Path("/app/static")
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")
