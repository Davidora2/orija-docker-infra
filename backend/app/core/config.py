from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_DEFAULT_ROOT = Path(__file__).resolve().parents[3] / ".runtime"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Orija"
    secret_key: str = "change-me-in-production-orija-secret"
    access_token_expire_minutes: int = 60 * 24 * 7
    algorithm: str = "HS256"

    database_url: str = f"sqlite+aiosqlite:///{(_DEFAULT_ROOT / 'data' / 'orija.db').as_posix()}"

    media_root: Path = _DEFAULT_ROOT / "media"
    movies_dir: Path = _DEFAULT_ROOT / "media" / "movies"
    shows_dir: Path = _DEFAULT_ROOT / "media" / "shows"
    live_dir: Path = _DEFAULT_ROOT / "media" / "live"
    downloads_dir: Path = _DEFAULT_ROOT / "media" / "downloads"

    # Xtream Codes (optional at boot; configurable via admin UI)
    xtream_base_url: str = ""
    xtream_username: str = ""
    xtream_password: str = ""

    # Concurrent streams per user / globally
    max_streams_per_user: int = 4
    max_global_streams: int = 20

    admin_username: str = "admin"
    admin_password: str = "admin"
    cors_origins: str = "*"


settings = Settings()
