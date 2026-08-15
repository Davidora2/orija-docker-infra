"""Home Registry — homes, devices, users, FCM tokens, API keys, security mode."""

from __future__ import annotations

import json
import os
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    String,
    Text,
    create_engine,
    func,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "shared"))
from homepulse.passwords import (  # noqa: E402
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from homepulse.security import generate_api_key, hash_api_key, verify_api_key  # noqa: E402

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://homepulse:homepulse@postgres:5432/homepulse"
)
API_KEY_PEPPER = os.getenv("API_KEY_PEPPER", "change-me-in-production")
BOOTSTRAP_ADMIN_TOKEN = os.getenv("BOOTSTRAP_ADMIN_TOKEN", "bootstrap-dev-token")
ADMIN_SESSION_DAYS = int(os.getenv("ADMIN_SESSION_DAYS", "14"))


class Base(DeclarativeBase):
    pass


class Home(Base):
    __tablename__ = "homes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    # Presence / security
    mode: Mapped[str] = mapped_column(String(16), default="home")  # home | away
    armed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    devices: Mapped[list["Device"]] = relationship(back_populates="home")
    members: Mapped[list["HomeMember"]] = relationship(back_populates="home")
    api_keys: Mapped[list["ApiKey"]] = relationship(back_populates="home")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    memberships: Mapped[list["HomeMember"]] = relationship(back_populates="user")
    push_tokens: Mapped[list["PushToken"]] = relationship(back_populates="user")


class HomeMember(Base):
    __tablename__ = "home_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    home_id: Mapped[str] = mapped_column(ForeignKey("homes.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(32), default="owner")

    home: Mapped[Home] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    home_id: Mapped[str] = mapped_column(ForeignKey("homes.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    device_type: Mapped[str] = mapped_column(String(64), default="doorbell")
    # Semantic role used by automations
    role: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # porch_light | siren | entry_lock | contact_sensor | frigate_camera | doorbell
    vendor: Mapped[str] = mapped_column(String(64), default="ring")
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    location_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    mqtt_command_topic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mqtt_state_topic: Mapped[str | None] = mapped_column(String(255), nullable=True)
    state: Mapped[str | None] = mapped_column(String(64), nullable=True)  # on/off/locked/unlocked/open/closed
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    meta_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    home: Mapped[Home] = relationship(back_populates="devices")


class PushToken(Base):
    __tablename__ = "push_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    platform: Mapped[str] = mapped_column(String(32), default="android")
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


class AdminAccount(Base):
    __tablename__ = "admin_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120), default="Admin")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    sessions: Mapped[list["AdminSession"]] = relationship(back_populates="admin")


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    admin_id: Mapped[str] = mapped_column(ForeignKey("admin_accounts.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    admin: Mapped[AdminAccount] = relationship(back_populates="sessions")


engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def device_dict(d: Device) -> dict[str, Any]:
    meta = {}
    if d.meta_json:
        try:
            meta = json.loads(d.meta_json)
        except json.JSONDecodeError:
            meta = {"raw": d.meta_json}
    return {
        "device_id": d.id,
        "home_id": d.home_id,
        "name": d.name,
        "device_type": d.device_type,
        "role": d.role,
        "vendor": d.vendor,
        "external_id": d.external_id,
        "location_label": d.location_label,
        "mqtt_command_topic": d.mqtt_command_topic,
        "mqtt_state_topic": d.mqtt_state_topic,
        "state": d.state,
        "enabled": d.enabled,
        "meta": meta,
    }


class CreateHomeRequest(BaseModel):
    name: str
    timezone: str = "UTC"
    owner_email: EmailStr
    owner_name: str = "Home Owner"
    mode: str = "home"
    armed: bool = False


class RegisterDeviceRequest(BaseModel):
    name: str
    device_type: str = "doorbell"
    role: str | None = None
    vendor: str = "ring"
    external_id: str | None = None
    location_label: str | None = None
    mqtt_command_topic: str | None = None
    mqtt_state_topic: str | None = None
    state: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class RegisterPushTokenRequest(BaseModel):
    user_email: EmailStr
    token: str
    platform: str = "android"
    label: str | None = None


class CreateApiKeyRequest(BaseModel):
    name: str = "ingest"
    scopes: str = "ingest:write"


class UpdateHomeSecurityRequest(BaseModel):
    mode: str | None = None  # home | away
    armed: bool | None = None


class UpdateDeviceStateRequest(BaseModel):
    state: str


class AddMemberRequest(BaseModel):
    email: EmailStr
    display_name: str = "Home Member"
    role: str = "member"


class AdminSetupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = "Admin"
    bootstrap_token: str | None = None

    @field_validator("username")
    @classmethod
    def username_clean(cls, v: str) -> str:
        v = v.strip().lower()
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("username must be alphanumeric (with - _)")
        return v


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminRecoverRequest(BaseModel):
    username: str
    recovery_token: str
    new_password: str = Field(min_length=8, max_length=128)


class AdminChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="HomePulse Home Registry",
    version="0.3.0",
    description="Homes, security mode, devices, FCM tokens, admin auth, and scoped API keys.",
    lifespan=lifespan,
)


def _extract_bearer(authorization: str | None) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()
    return None


def _is_bootstrap(token: str | None) -> bool:
    return bool(token) and token == BOOTSTRAP_ADMIN_TOKEN


def require_admin(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_bootstrap_token: str | None = Header(default=None, alias="X-Bootstrap-Token"),
) -> dict[str, Any]:
    """Accept admin session Bearer token, or break-glass bootstrap token."""
    bearer = _extract_bearer(authorization)
    if _is_bootstrap(bearer) or _is_bootstrap(x_bootstrap_token):
        return {"auth": "bootstrap", "admin_id": None, "username": "bootstrap"}

    if not bearer:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Missing admin session or bootstrap token"
        )

    token_hash = hash_session_token(bearer, API_KEY_PEPPER)
    row = db.scalar(
        select(AdminSession).where(
            AdminSession.token_hash == token_hash,
            AdminSession.revoked.is_(False),
        )
    )
    if row is None or row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired admin session")
    admin = db.get(AdminAccount, row.admin_id)
    if admin is None or not admin.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin account disabled")
    return {
        "auth": "session",
        "admin_id": admin.id,
        "username": admin.username,
        "session_id": row.id,
    }


def _issue_session(db: Session, admin: AdminAccount) -> dict[str, Any]:
    raw = generate_session_token()
    session = AdminSession(
        admin_id=admin.id,
        token_hash=hash_session_token(raw, API_KEY_PEPPER),
        expires_at=datetime.now(timezone.utc) + timedelta(days=ADMIN_SESSION_DAYS),
    )
    db.add(session)
    db.commit()
    return {
        "session_token": raw,
        "token_type": "Bearer",
        "expires_in_days": ADMIN_SESSION_DAYS,
        "admin": {
            "admin_id": admin.id,
            "username": admin.username,
            "email": admin.email,
            "display_name": admin.display_name,
        },
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "home-registry"}


@app.get("/v1/admin/auth/status")
def admin_auth_status(db: Session = Depends(get_db)) -> dict[str, Any]:
    count = db.scalar(select(func.count()).select_from(AdminAccount)) or 0
    return {
        "has_admin": count > 0,
        "setup_required": count == 0,
        "recovery": "Use BOOTSTRAP_ADMIN_TOKEN on the recover form to reset a password.",
    }


@app.post("/v1/admin/auth/setup", status_code=201)
def admin_setup(body: AdminSetupRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    count = db.scalar(select(func.count()).select_from(AdminAccount)) or 0
    if count > 0:
        raise HTTPException(400, "Admin already exists — use login or password recovery")
    if body.bootstrap_token is not None and not _is_bootstrap(body.bootstrap_token):
        raise HTTPException(403, "Invalid bootstrap token")
    admin = AdminAccount(
        username=body.username,
        email=str(body.email).lower(),
        password_hash=hash_password(body.password, API_KEY_PEPPER),
        display_name=body.display_name,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return _issue_session(db, admin)


@app.post("/v1/admin/auth/login")
def admin_login(body: AdminLoginRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    username = body.username.strip().lower()
    admin = db.scalar(select(AdminAccount).where(AdminAccount.username == username))
    if admin is None or not admin.active:
        raise HTTPException(401, "Invalid username or password")
    if not verify_password(body.password, admin.password_hash, API_KEY_PEPPER):
        raise HTTPException(401, "Invalid username or password")
    return _issue_session(db, admin)


@app.post("/v1/admin/auth/recover")
def admin_recover(body: AdminRecoverRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    if not _is_bootstrap(body.recovery_token.strip()):
        raise HTTPException(403, "Invalid recovery token")
    username = body.username.strip().lower()
    admin = db.scalar(select(AdminAccount).where(AdminAccount.username == username))
    if admin is None:
        raise HTTPException(404, "Admin user not found")
    admin.password_hash = hash_password(body.new_password, API_KEY_PEPPER)
    for s in db.scalars(select(AdminSession).where(AdminSession.admin_id == admin.id)).all():
        s.revoked = True
    db.commit()
    return {"status": "ok", "message": "Password updated. Sign in with the new password."}


@app.post("/v1/admin/auth/change-password")
def admin_change_password(
    body: AdminChangePasswordRequest,
    db: Session = Depends(get_db),
    auth: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    if auth.get("auth") != "session" or not auth.get("admin_id"):
        raise HTTPException(400, "Sign in with username/password to change password")
    admin = db.get(AdminAccount, auth["admin_id"])
    if admin is None:
        raise HTTPException(404, "Admin not found")
    if not verify_password(body.current_password, admin.password_hash, API_KEY_PEPPER):
        raise HTTPException(401, "Current password is incorrect")
    admin.password_hash = hash_password(body.new_password, API_KEY_PEPPER)
    db.commit()
    return {"status": "ok"}


@app.post("/v1/admin/auth/logout")
def admin_logout(
    db: Session = Depends(get_db),
    auth: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    if auth.get("session_id"):
        row = db.get(AdminSession, auth["session_id"])
        if row:
            row.revoked = True
            db.commit()
    return {"status": "ok"}


@app.get("/v1/homes")
def list_homes(
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    homes = db.scalars(select(Home).order_by(Home.created_at.desc())).all()
    return {
        "homes": [
            {
                "home_id": h.id,
                "name": h.name,
                "timezone": h.timezone,
                "mode": h.mode,
                "armed": h.armed,
                "device_count": len(h.devices),
                "member_count": len(h.members),
            }
            for h in homes
        ]
    }


@app.post("/v1/homes", status_code=201)
def create_home(
    body: CreateHomeRequest,
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    if body.mode not in {"home", "away"}:
        raise HTTPException(400, "mode must be home or away")
    user = db.scalar(select(User).where(User.email == body.owner_email.lower()))
    if user is None:
        user = User(email=body.owner_email.lower(), display_name=body.owner_name)
        db.add(user)
        db.flush()

    home = Home(
        name=body.name,
        timezone=body.timezone,
        mode=body.mode,
        armed=body.armed,
    )
    db.add(home)
    db.flush()
    db.add(HomeMember(home_id=home.id, user_id=user.id, role="owner"))

    raw_key = generate_api_key()
    api_key = ApiKey(
        home_id=home.id,
        name="default-ingest",
        key_prefix=raw_key[:10],
        key_hash=hash_api_key(raw_key, API_KEY_PEPPER),
        scopes="ingest:write,notify:read,devices:read,security:write",
    )
    db.add(api_key)
    db.commit()

    return {
        "home_id": home.id,
        "owner_user_id": user.id,
        "mode": home.mode,
        "armed": home.armed,
        "api_key": raw_key,
        "api_key_warning": "Store this API key now; it cannot be retrieved again.",
    }


@app.patch("/v1/homes/{home_id}/security")
def update_security(
    home_id: str,
    body: UpdateHomeSecurityRequest,
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    home = db.get(Home, home_id)
    if home is None:
        raise HTTPException(404, "Home not found")
    if body.mode is not None:
        if body.mode not in {"home", "away"}:
            raise HTTPException(400, "mode must be home or away")
        home.mode = body.mode
        # Away implies armed by default for the demo security model
        if body.mode == "away" and body.armed is None:
            home.armed = True
        if body.mode == "home" and body.armed is None:
            home.armed = False
    if body.armed is not None:
        home.armed = body.armed
    db.commit()
    return {"home_id": home.id, "mode": home.mode, "armed": home.armed}


@app.post("/v1/homes/{home_id}/devices", status_code=201)
def register_device(
    home_id: str,
    body: RegisterDeviceRequest,
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    home = db.get(Home, home_id)
    if home is None:
        raise HTTPException(404, "Home not found")
    device = Device(
        home_id=home_id,
        name=body.name,
        device_type=body.device_type,
        role=body.role,
        vendor=body.vendor,
        external_id=body.external_id,
        location_label=body.location_label,
        mqtt_command_topic=body.mqtt_command_topic,
        mqtt_state_topic=body.mqtt_state_topic,
        state=body.state,
        meta_json=json.dumps(body.meta) if body.meta else None,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device_dict(device)


@app.patch("/v1/devices/{device_id}/state")
def update_device_state(
    device_id: str,
    body: UpdateDeviceStateRequest,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(404, "Device not found")
    device.state = body.state
    db.commit()
    return device_dict(device)


@app.post("/v1/push-tokens", status_code=201)
def register_push_token(
    body: RegisterPushTokenRequest,
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
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


@app.get("/v1/homes/{home_id}/push-tokens")
def list_push_tokens(
    home_id: str,
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    home = db.get(Home, home_id)
    if home is None:
        raise HTTPException(404, "Home not found")
    members = db.scalars(select(HomeMember).where(HomeMember.home_id == home_id)).all()
    user_ids = [m.user_id for m in members]
    users = {
        u.id: u
        for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()
    } if user_ids else {}
    tokens = (
        db.scalars(
            select(PushToken).where(PushToken.user_id.in_(user_ids), PushToken.active.is_(True))
        ).all()
        if user_ids
        else []
    )
    return {
        "home_id": home_id,
        "tokens": [
            {
                "push_token_id": t.id,
                "user_id": t.user_id,
                "email": users[t.user_id].email if t.user_id in users else None,
                "platform": t.platform,
                "label": t.label,
                "token_preview": f"{t.token[:8]}…{t.token[-4:]}" if len(t.token) > 12 else "••••",
                "active": t.active,
            }
            for t in tokens
        ],
    }


@app.post("/v1/homes/{home_id}/api-keys", status_code=201)
def create_api_key(
    home_id: str,
    body: CreateApiKeyRequest,
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
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
    return device_dict(device)


@app.get("/v1/internal/homes/{home_id}/context")
def home_context(home_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Security + device roles used by the rules engine."""
    home = db.get(Home, home_id)
    if home is None:
        raise HTTPException(404, "Home not found")
    devices = [device_dict(d) for d in home.devices if d.enabled]
    by_role: dict[str, list[dict[str, Any]]] = {}
    for d in devices:
        if d.get("role"):
            by_role.setdefault(d["role"], []).append(d)
    return {
        "home_id": home.id,
        "name": home.name,
        "timezone": home.timezone,
        "mode": home.mode,
        "armed": home.armed,
        "devices": devices,
        "devices_by_role": by_role,
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


@app.get("/v1/internal/homes")
def list_homes_internal(db: Session = Depends(get_db)) -> dict[str, Any]:
    homes = db.scalars(select(Home)).all()
    return {
        "homes": [
            {
                "home_id": h.id,
                "name": h.name,
                "timezone": h.timezone,
                "mode": h.mode,
                "armed": h.armed,
            }
            for h in homes
        ]
    }


@app.get("/v1/homes/{home_id}")
def get_home(
    home_id: str,
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    home = db.get(Home, home_id)
    if home is None:
        raise HTTPException(404, "Home not found")
    members_out = []
    for m in home.members:
        user = db.get(User, m.user_id)
        token_count = 0
        if user is not None:
            token_count = len([t for t in user.push_tokens if t.active])
        members_out.append(
            {
                "member_id": m.id,
                "user_id": m.user_id,
                "role": m.role,
                "email": user.email if user else None,
                "display_name": user.display_name if user else None,
                "push_token_count": token_count,
            }
        )
    return {
        "home_id": home.id,
        "name": home.name,
        "timezone": home.timezone,
        "mode": home.mode,
        "armed": home.armed,
        "devices": [device_dict(d) for d in home.devices],
        "members": members_out,
        "member_count": len(members_out),
    }


@app.get("/v1/homes/{home_id}/members")
def list_members(
    home_id: str,
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    home = db.get(Home, home_id)
    if home is None:
        raise HTTPException(404, "Home not found")
    rows = []
    for m in home.members:
        user = db.get(User, m.user_id)
        tokens = [t for t in (user.push_tokens if user else []) if t.active]
        rows.append(
            {
                "member_id": m.id,
                "user_id": m.user_id,
                "role": m.role,
                "email": user.email if user else None,
                "display_name": user.display_name if user else None,
                "push_tokens": [
                    {
                        "push_token_id": t.id,
                        "platform": t.platform,
                        "label": t.label,
                        "token_preview": f"{t.token[:8]}…{t.token[-4:]}" if len(t.token) > 12 else "••••",
                    }
                    for t in tokens
                ],
            }
        )
    return {"home_id": home_id, "members": rows}


@app.post("/v1/homes/{home_id}/members", status_code=201)
def add_member(
    home_id: str,
    body: AddMemberRequest,
    db: Session = Depends(get_db),
    _: dict[str, Any] = Depends(require_admin),
) -> dict[str, Any]:
    home = db.get(Home, home_id)
    if home is None:
        raise HTTPException(404, "Home not found")
    email = str(body.email).lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, display_name=body.display_name)
        db.add(user)
        db.flush()
    existing = db.scalar(
        select(HomeMember).where(HomeMember.home_id == home_id, HomeMember.user_id == user.id)
    )
    if existing is not None:
        return {
            "member_id": existing.id,
            "user_id": user.id,
            "email": user.email,
            "role": existing.role,
            "already_member": True,
        }
    member = HomeMember(home_id=home_id, user_id=user.id, role=body.role or "member")
    db.add(member)
    db.commit()
    db.refresh(member)
    return {
        "member_id": member.id,
        "user_id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "role": member.role,
        "already_member": False,
    }
