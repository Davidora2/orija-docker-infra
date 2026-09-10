from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import aiosqlite

from .config import get_settings


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


class Database:
    def __init__(self, path: str | None = None) -> None:
        self.path = path or get_settings().database_path

    async def _connect(self) -> aiosqlite.Connection:
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        db = await aiosqlite.connect(self.path)
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON")
        return db

    async def init(self) -> None:
        db = await self._connect()
        try:
            await db.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                  id TEXT PRIMARY KEY,
                  immich_user_id TEXT NOT NULL UNIQUE,
                  email TEXT NOT NULL,
                  name TEXT NOT NULL,
                  folder_slug TEXT NOT NULL UNIQUE,
                  api_key_hint TEXT NOT NULL,
                  immich_library_id TEXT NOT NULL DEFAULT '',
                  created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS requests (
                  id TEXT PRIMARY KEY,
                  token TEXT NOT NULL UNIQUE,
                  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  title TEXT NOT NULL,
                  message TEXT NOT NULL DEFAULT '',
                  created_at TEXT NOT NULL,
                  expires_at TEXT,
                  max_files INTEGER NOT NULL,
                  upload_count INTEGER NOT NULL DEFAULT 0,
                  active INTEGER NOT NULL DEFAULT 1
                );

                CREATE TABLE IF NOT EXISTS uploads (
                  id TEXT PRIMARY KEY,
                  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
                  original_name TEXT NOT NULL,
                  stored_name TEXT NOT NULL,
                  size_bytes INTEGER NOT NULL,
                  content_type TEXT NOT NULL,
                  uploader_note TEXT NOT NULL DEFAULT '',
                  created_at TEXT NOT NULL
                );
                """
            )
            await db.commit()
        finally:
            await db.close()

    async def upsert_user(
        self,
        *,
        immich_user_id: str,
        email: str,
        name: str,
        folder_slug: str,
        api_key_hint: str,
        immich_library_id: str | None = None,
    ) -> dict[str, Any]:
        db = await self._connect()
        try:
            existing = await (
                await db.execute(
                    "SELECT * FROM users WHERE immich_user_id = ?",
                    (immich_user_id,),
                )
            ).fetchone()
            now = to_iso(utc_now())
            if existing:
                library_id = (
                    existing["immich_library_id"]
                    if immich_library_id is None
                    else immich_library_id
                )
                await db.execute(
                    """
                    UPDATE users
                    SET email = ?, name = ?, folder_slug = ?, api_key_hint = ?,
                        immich_library_id = ?
                    WHERE immich_user_id = ?
                    """,
                    (email, name, folder_slug, api_key_hint, library_id or "", immich_user_id),
                )
                await db.commit()
                row = await (
                    await db.execute(
                        "SELECT * FROM users WHERE immich_user_id = ?",
                        (immich_user_id,),
                    )
                ).fetchone()
                return dict(row)

            user_id = secrets.token_urlsafe(12)
            await db.execute(
                """
                INSERT INTO users (
                  id, immich_user_id, email, name, folder_slug, api_key_hint,
                  immich_library_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    immich_user_id,
                    email,
                    name,
                    folder_slug,
                    api_key_hint,
                    immich_library_id or "",
                    now,
                ),
            )
            await db.commit()
            row = await (
                await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            ).fetchone()
            return dict(row)
        finally:
            await db.close()

    async def get_user(self, user_id: str) -> dict[str, Any] | None:
        db = await self._connect()
        try:
            row = await (
                await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            ).fetchone()
            return dict(row) if row else None
        finally:
            await db.close()

    async def create_request(
        self,
        *,
        user_id: str,
        title: str,
        message: str,
        expiry_days: int | None,
        max_files: int,
    ) -> dict[str, Any]:
        settings = get_settings()
        request_id = secrets.token_urlsafe(10)
        token = secrets.token_urlsafe(18)
        now = utc_now()
        days = settings.default_expiry_days if expiry_days is None else expiry_days
        expires_at = now + timedelta(days=days) if days > 0 else None
        db = await self._connect()
        try:
            await db.execute(
                """
                INSERT INTO requests (
                  id, token, user_id, title, message, created_at, expires_at,
                  max_files, upload_count, active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
                """,
                (
                    request_id,
                    token,
                    user_id,
                    title,
                    message,
                    to_iso(now),
                    to_iso(expires_at),
                    max_files,
                ),
            )
            await db.commit()
            row = await (
                await db.execute("SELECT * FROM requests WHERE id = ?", (request_id,))
            ).fetchone()
            return dict(row)
        finally:
            await db.close()

    async def list_requests(self, user_id: str) -> list[dict[str, Any]]:
        db = await self._connect()
        try:
            cur = await db.execute(
                """
                SELECT * FROM requests
                WHERE user_id = ?
                ORDER BY created_at DESC
                """,
                (user_id,),
            )
            return [dict(r) for r in await cur.fetchall()]
        finally:
            await db.close()

    async def get_request_by_token(self, token: str) -> dict[str, Any] | None:
        db = await self._connect()
        try:
            row = await (
                await db.execute("SELECT * FROM requests WHERE token = ?", (token,))
            ).fetchone()
            return dict(row) if row else None
        finally:
            await db.close()

    async def get_request(self, request_id: str) -> dict[str, Any] | None:
        db = await self._connect()
        try:
            row = await (
                await db.execute("SELECT * FROM requests WHERE id = ?", (request_id,))
            ).fetchone()
            return dict(row) if row else None
        finally:
            await db.close()

    async def set_request_active(self, request_id: str, active: bool) -> None:
        db = await self._connect()
        try:
            await db.execute(
                "UPDATE requests SET active = ? WHERE id = ?",
                (1 if active else 0, request_id),
            )
            await db.commit()
        finally:
            await db.close()

    async def add_upload(
        self,
        *,
        request_id: str,
        original_name: str,
        stored_name: str,
        size_bytes: int,
        content_type: str,
        uploader_note: str = "",
    ) -> dict[str, Any]:
        upload_id = secrets.token_urlsafe(10)
        db = await self._connect()
        try:
            await db.execute(
                """
                INSERT INTO uploads (
                  id, request_id, original_name, stored_name, size_bytes,
                  content_type, uploader_note, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    upload_id,
                    request_id,
                    original_name,
                    stored_name,
                    size_bytes,
                    content_type,
                    uploader_note,
                    to_iso(utc_now()),
                ),
            )
            await db.execute(
                "UPDATE requests SET upload_count = upload_count + 1 WHERE id = ?",
                (request_id,),
            )
            await db.commit()
            row = await (
                await db.execute("SELECT * FROM uploads WHERE id = ?", (upload_id,))
            ).fetchone()
            return dict(row)
        finally:
            await db.close()

    async def list_uploads(self, request_id: str) -> list[dict[str, Any]]:
        db = await self._connect()
        try:
            cur = await db.execute(
                """
                SELECT * FROM uploads
                WHERE request_id = ?
                ORDER BY created_at DESC
                """,
                (request_id,),
            )
            return [dict(r) for r in await cur.fetchall()]
        finally:
            await db.close()


db = Database()
