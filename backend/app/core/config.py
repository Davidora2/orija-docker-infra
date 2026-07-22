from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_DEFAULT_ROOT = Path(__file__).resolve().parents[3] / ".runtime"
_PROD_MEDIA = Path("/srv/storage/data/media")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "OrijaFlix"
    secret_key: str = "change-me-in-production-orijaflix-secret"
    access_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = "HS256"

    database_url: str = f"sqlite+aiosqlite:///{(_DEFAULT_ROOT / 'data' / 'orijaflix.db').as_posix()}"

    # Host layout: /srv/storage/data/media/{movies,TVshows,incoming,...}
    media_root: Path = _PROD_MEDIA if _PROD_MEDIA.exists() else (_DEFAULT_ROOT / "media")
    movies_dir: Path | None = None
    shows_dir: Path | None = None
    live_dir: Path | None = None
    downloads_dir: Path | None = None
    incoming_dir: Path | None = None

    tmdb_api_key: str = ""
    tmdb_language: str = "en-US"

    xtream_base_url: str = ""
    xtream_username: str = ""
    xtream_password: str = ""

    max_streams_per_user: int = 4
    max_global_streams: int = 20

    admin_username: str = "admin"
    admin_password: str = "admin"
    cors_origins: str = "*"

    @model_validator(mode="after")
    def resolve_media_dirs(self):
        root = Path(self.media_root)
        self.media_root = root
        if self.movies_dir is None:
            self.movies_dir = root / "movies"
        if self.shows_dir is None:
            self.shows_dir = root / "TVshows"
        if self.live_dir is None:
            self.live_dir = root / "live"
        if self.downloads_dir is None:
            self.downloads_dir = root / "downloads"
        if self.incoming_dir is None:
            self.incoming_dir = root / "incoming"
        return self


settings = Settings()
