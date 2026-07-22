from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    is_admin: bool
    avatar_color: str
    max_streams: int

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=4, max_length=128)
    display_name: str = Field(min_length=1, max_length=128)
    avatar_color: str = "#e50914"
    max_streams: int = 4
    is_admin: bool = False


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    password: Optional[str] = None
    avatar_color: Optional[str] = None
    max_streams: Optional[int] = None
    is_admin: Optional[bool] = None


class XtreamConfigIn(BaseModel):
    base_url: str
    username: str
    password: str
    label: str = "Primary"
    enabled: bool = True


class XtreamConfigOut(BaseModel):
    id: int
    base_url: str
    username: str
    label: str
    enabled: bool
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class FavoriteIn(BaseModel):
    media_type: str
    source: str
    external_id: str
    title: str
    poster: Optional[str] = None
    year: Optional[str] = None
    category: Optional[str] = None
    stream_url: Optional[str] = None
    save_to_library: bool = True


class FavoriteOut(BaseModel):
    id: int
    media_type: str
    source: str
    external_id: str
    title: str
    poster: Optional[str] = None
    year: Optional[str] = None
    category: Optional[str] = None
    local_path: Optional[str] = None
    download_status: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ProgressIn(BaseModel):
    media_type: str
    source: str
    external_id: str
    title: str
    poster: Optional[str] = None
    position_seconds: int = 0
    duration_seconds: int = 0


class ProgressOut(BaseModel):
    id: int
    media_type: str
    source: str
    external_id: str
    title: str
    poster: Optional[str] = None
    position_seconds: int
    duration_seconds: int
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class StreamOpenIn(BaseModel):
    media_type: str
    source: str
    external_id: str
    title: str
    container: str = "mp4"
    episode_id: Optional[str] = None


class StreamOpenOut(BaseModel):
    session_key: str
    play_url: str
    title: str
    source: str
    media_type: str


class StreamSessionOut(BaseModel):
    id: int
    session_key: str
    media_type: str
    source: str
    external_id: str
    title: str
    started_at: Optional[datetime] = None
    last_heartbeat: Optional[datetime] = None
    active: bool
    user_id: int

    model_config = {"from_attributes": True}


class LocalMediaOut(BaseModel):
    id: int
    media_type: str
    title: str
    path: str
    show_name: Optional[str] = None
    season: Optional[int] = None
    episode: Optional[int] = None
    size_bytes: int

    model_config = {"from_attributes": True}
