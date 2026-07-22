from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    nanobanana_draft_model: str = "gemini-3.1-flash-image"
    nanobanana_bake_model: str = "gemini-3-pro-image"
    nanobanana_draft_size: str = "1K"
    nanobanana_bake_size: str = "2K"
    allow_mock_without_key: bool = True
    host: str = "0.0.0.0"
    port: int = 8080
    data_dir: Path = Path("/data")
    brand_name: str = "Orija"

    @property
    def has_api_key(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def projects_dir(self) -> Path:
        return self.data_dir / "projects"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def outputs_dir(self) -> Path:
        return self.data_dir / "outputs"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.projects_dir.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    settings.outputs_dir.mkdir(parents=True, exist_ok=True)
    return settings
