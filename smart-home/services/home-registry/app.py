"""Home Registry — homes, devices, users, FCM tokens, API keys."""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    create_engine,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

# Shared package is installed in the image; keep import resilient for local runs.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from homepulse.security import generate_api_key, hash_api_key, verify_api_key  # noqa: E402

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://homepulse:homepulse@postgres:5432/homepulse"
)
API_KEY_PEPPER = os.getenv("API_KEY_PEPPER", "change-me-in-production")
BOOTSTRAP_ADMIN_TOKEN = os.getenv("BOOTSTRAP_ADMIN_TOKEN", "bootstrap-dev-token")


class Base(DeclarativeBase):
    pass


class Home(Base):
    __tablename__ = "homes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    devices: Mapped[list[Device]] = relationship(back_populates="home")
    members: Mapped[list[HomeMember]] = relationship(back_populates="home")
    api_keys: Mapped[list[ApiKey]] = relationship(back_populates="home")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    memberships: Mapped[list[HomeMember]] = relationship(back_populates="user")
    push_tokens: Mapped[list[PushToken]] = relationship(back_populates="user")


class HomeMember(Base):
    __tablename__ = "home_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    home_id: Mapped[str] = mapped_column(ForeignKey("homes.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(32), default="owner")  # owner | member | guest

    home: Mapped[Home] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    home_id: Mapped[str] = mapped_column(ForeignKey("homes.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    device_type: Mapped[str] = mapped_column(String(64), default="doorbell")
    vendor: Mapped[str] = mapped_column(String(64), default="ring")
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    location_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    home: Mapped[Home] = relationship(back_populates="devices")


class PushToken(Base):
    __tablename__ = "push_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String(32), default="android")  # android | ios | web
    token: Mapped[str] = mapped_column(Text)
    label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped[User] = relationship(back_populates="push_tokens")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    home_id: Mapped[str] = mapped_column(ForeignKey("homes.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    key_prefix: Mapped[str] = mapped_column(String(16))
    key_hash: Mapped[str] = mapped_column(String(64))
    scopes: Mapped[str] = mapped_column(String(255), default="ingest:write,notify:read")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    home: Mapped[Home] = relationship(back_populates="api_keys")


engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CreateHomeRequest(BaseModel):
    name: str
    timezone: str = "UTC"
    owner_email: EmailStr
    owner_name: str = "Home Owner"


class RegisterDeviceRequest(BaseModel):
    name: str
    device_type: str = "doorbell"
    vendor: str = "ring"
    external_id: str | None = None
    location_label: str | None = None


class RegisterPushTokenRequest(BaseModel):
    user_email: EmailStr
    token: str
    platform: str = "android"
    label: str | None = None


class CreateApiKeyRequest(BaseModel):
    name: str = "ingest"
    scopes: str = "ingest:write"


class ResolveDeviceQuery(BaseModel):
    vendor: str
    external_id: str


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="HomePulse Home Registry",
    version="0.1.0",
    description="Homes, devices, members, FCM tokens, and scoped API keys.",
    lifespan=lifespan,
)


def require_bootstrap(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != BOOTSTRAP_ADMIN_TOKEN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid bootstrap token")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "home-registry"}


@app.post("/v1/homes", status_code=201)
def create_home(
    body: CreateHomeRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_bootstrap),
) -> dict[str, Any]:
    user = db.scalar(select(User).where(User.email == body.owner_email.lower()))
    if user is None:
        user = User(email=body.owner_email.lower(), display_name=body.owner_name)
        db.add(user)
        db.flush()

    home = Home(name=body.name, timezone=body.timezone)
    db.add(home)
    db.flush()
    db.add(HomeMember(home_id=home.id, user_id=user.id, role="owner"))

    raw_key = generate_api_key()
    api_key = ApiKey(
        home_id=home.id,
        name="default-ingest",
        key_prefix=raw_key[:10],
        key_hash=hash_api_key(raw_key, API_KEY_PEPPER),
        scopes="ingest:write,notify:read,devices:read",
    )
    db.add(api_key)
    db.commit()

    return {
        "home_id": home.id,
        "owner_user_id": user.id,
        "api_key": raw_key,
        "api_key_warning": "Store this API key now; it cannot be retrieved again.",
    }


@app.post("/v1/homes/{home_id}/devices", status_code=201)
def register_device(
    home_id: str,
    body: RegisterDeviceRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_bootstrap),
) -> dict[str, Any]:
    home = db.get(Home, home_id)
    if home is None:
        raise HTTPException(404, "Home not found")
    device = Device(
        home_id=home_id,
        name=body.name,
        device_type=body.device_type,
        vendor=body.vendor,
        external_id=body.external_id,
        location_label=body.location_label,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return {
        "device_id": device.id,
        "home_id": home_id,
        "name": device.name,
        "vendor": device.vendor,
        "external_id": device.external_id,
    }


@app.post("/v1/push-tokens", status_code=201)
def register_push_token(
    body: RegisterPushTokenRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_bootstrap),
) -> dict[str, Any]:
    user = db.scalar(select(User).where(User.email == body.user_email.lower()))
    if user is None:
        raise HTTPException(404, "User not found")
    token = PushToken(
        user_id=user.id,
        token=body.token,
        platform=body.platform,
        label=body.label,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return {"push_token_id": token.id, "user_id": user.id, "platform": token.platform}


@app.post("/v1/homes/{home_id}/api-keys", status_code=201)
def create_api_key(
    home_id: str,
    body: CreateApiKeyRequest,
    db: Session = Depends(get_db),
    _: None = Depends(require_bootstrap),
) -> dict[str, Any]:
    if db.get(Home, home_id) is None:
        raise HTTPException(404, "Home not found")
    raw_key = generate_api_key()
    row = ApiKey(
        home_id=home_id,
        name=body.name,
        key_prefix=raw_key[:10],
        key_hash=hash_api_key(raw_key, API_KEY_PEPPER),
        scopes=body.scopes,
    )
    db.add(row)
    db.commit()
    return {"api_key_id": row.id, "api_key": raw_key, "scopes": row.scopes}


@app.get("/v1/internal/auth/api-key")
def resolve_api_key(
    x_api_key: str = Header(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Internal endpoint used by ingest/gateway to validate scoped keys."""
    prefix = x_api_key[:10]
    candidates = db.scalars(
        select(ApiKey).where(ApiKey.key_prefix == prefix, ApiKey.active.is_(True))
    ).all()
    for key in candidates:
        if verify_api_key(x_api_key, key.key_hash, API_KEY_PEPPER):
            return {
                "home_id": key.home_id,
                "api_key_id": key.id,
                "scopes": key.scopes.split(","),
            }
    raise HTTPException(401, "Invalid API key")


@app.get("/v1/internal/devices/resolve")
def resolve_device(
    vendor: str,
    external_id: str,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    device = db.scalar(
        select(Device).where(
            Device.vendor == vendor,
            Device.external_id == external_id,
            Device.enabled.is_(True),
        )
    )
    if device is None:
        raise HTTPException(404, "Device not found")
    return {
        "device_id": device.id,
        "home_id": device.home_id,
        "name": device.name,
        "device_type": device.device_type,
        "vendor": device.vendor,
        "location_label": device.location_label,
    }


@app.get("/v1/internal/homes/{home_id}/push-targets")
def push_targets(home_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    members = db.scalars(select(HomeMember).where(HomeMember.home_id == home_id)).all()
    if not members:
        raise HTTPException(404, "Home not found or has no members")
    user_ids = [m.user_id for m in members]
    tokens = db.scalars(
        select(PushToken).where(PushToken.user_id.in_(user_ids), PushToken.active.is_(True))
    ).all()
    return {
        "home_id": home_id,
        "targets": [
            {
                "user_id": t.user_id,
                "platform": t.platform,
                "token": t.token,
                "label": t.label,
            }
            for t in tokens
        ],
    }


@app.get("/v1/homes/{home_id}")
def get_home(
    home_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_bootstrap),
) -> dict[str, Any]:
    home = db.get(Home, home_id)
    if home is None:
        raise HTTPException(404, "Home not found")
    devices = [
        {
            "device_id": d.id,
            "name": d.name,
            "device_type": d.device_type,
            "vendor": d.vendor,
            "external_id": d.external_id,
            "location_label": d.location_label,
            "enabled": d.enabled,
        }
        for d in home.devices
    ]
    return {
        "home_id": home.id,
        "name": home.name,
        "timezone": home.timezone,
        "devices": devices,
        "member_count": len(home.members),
    }
