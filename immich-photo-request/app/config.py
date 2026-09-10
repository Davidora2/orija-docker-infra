from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Immich Photo Request"
    public_base_url: str = "http://localhost:8090"
    # Bind-mount or SMB/CIFS mount shared with Immich's external library
    external_library_root: str = "/data/external"
    database_path: str = "/data/app.db"
    immich_base_url: str = "https://photos.orija.store"
    # Stay under Cloudflare's ~100MB proxy limit when exposed via CF
    max_upload_bytes: int = 95 * 1024 * 1024
    max_files_per_request: int = 200
    default_expiry_days: int = 14
    # Optional API key used only to trigger Immich library scans after uploads
    immich_scan_api_key: str = ""
    immich_library_id: str = ""
    # When true, any API key is accepted and a fake Immich user is used (local demos)
    dev_mode: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
