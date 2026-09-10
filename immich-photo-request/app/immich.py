from __future__ import annotations

import re
from typing import Any

import httpx

from .config import get_settings


class ImmichError(Exception):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _client(api_key: str) -> httpx.AsyncClient:
    settings = get_settings()
    return httpx.AsyncClient(
        base_url=settings.immich_base_url.rstrip("/"),
        headers={"x-api-key": api_key, "Accept": "application/json"},
        timeout=30.0,
    )


async def validate_api_key(api_key: str) -> dict[str, Any]:
    settings = get_settings()
    if settings.dev_mode:
        return {
            "id": "dev-user-0001",
            "email": "dev@example.com",
            "name": "Dev User",
        }
    async with _client(api_key) as client:
        resp = await client.get("/api/users/me")
        if resp.status_code == 401:
            raise ImmichError("Invalid Immich API key", 401)
        if resp.status_code >= 400:
            raise ImmichError(
                f"Immich returned {resp.status_code}: {resp.text[:200]}",
                resp.status_code,
            )
        return resp.json()


async def list_libraries(api_key: str) -> list[dict[str, Any]]:
    if get_settings().dev_mode:
        return [
            {
                "id": "dev-lib-1",
                "name": "External (dev)",
                "type": "EXTERNAL",
                "importPaths": ["/data/external"],
            }
        ]
    async with _client(api_key) as client:
        resp = await client.get("/api/libraries")
        if resp.status_code >= 400:
            raise ImmichError(
                f"Could not list libraries ({resp.status_code})",
                resp.status_code,
            )
        data = resp.json()
        return data if isinstance(data, list) else []


async def scan_library(api_key: str, library_id: str) -> None:
    if not library_id:
        return
    async with _client(api_key) as client:
        resp = await client.post(f"/api/libraries/{library_id}/scan")
        if resp.status_code >= 400:
            raise ImmichError(
                f"Library scan failed ({resp.status_code}): {resp.text[:200]}",
                resp.status_code,
            )


def folder_slug_from_user(user: dict[str, Any]) -> str:
    user_id = str(user.get("id") or "user")
    base = (user.get("email") or user.get("name") or user_id).strip()
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", base).strip("-").lower() or "user"
    # Keep folders stable/unique even if display name changes
    short = re.sub(r"[^a-zA-Z0-9]+", "", user_id)[:8] or "user"
    if short.lower() in slug:
        return slug
    return f"{slug}-{short}"
