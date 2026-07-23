"""Xtream Codes IPTV API client."""

from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

import httpx


class XtreamClient:
    def __init__(self, base_url: str, username: str, password: str, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.timeout = timeout

    def _api(self, action: str | None = None, **params: Any) -> str:
        q = {"username": self.username, "password": self.password}
        if action:
            q["action"] = action
        q.update({k: v for k, v in params.items() if v is not None})
        query = "&".join(f"{k}={v}" for k, v in q.items())
        return f"{self.base_url}/player_api.php?{query}"

    async def _get(self, action: str | None = None, **params: Any) -> Any:
        url = self._api(action, **params)
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    async def authenticate(self) -> dict[str, Any]:
        data = await self._get()
        return data

    async def get_live_categories(self) -> list[dict]:
        return await self._get("get_live_categories") or []

    async def get_vod_categories(self) -> list[dict]:
        return await self._get("get_vod_categories") or []

    async def get_series_categories(self) -> list[dict]:
        return await self._get("get_series_categories") or []

    async def get_live_streams(self, category_id: str | None = None) -> list[dict]:
        return await self._get("get_live_streams", category_id=category_id) or []

    async def get_vod_streams(self, category_id: str | None = None) -> list[dict]:
        return await self._get("get_vod_streams", category_id=category_id) or []

    async def get_series(self, category_id: str | None = None) -> list[dict]:
        return await self._get("get_series", category_id=category_id) or []

    async def get_vod_info(self, vod_id: str | int) -> dict:
        return await self._get("get_vod_info", vod_id=vod_id) or {}

    async def get_series_info(self, series_id: str | int) -> dict:
        return await self._get("get_series_info", series_id=series_id) or {}

    def live_stream_url(self, stream_id: str | int, ext: str = "ts") -> str:
        return f"{self.base_url}/live/{self.username}/{self.password}/{stream_id}.{ext}"

    def vod_stream_url(self, stream_id: str | int, ext: str = "mp4") -> str:
        return f"{self.base_url}/movie/{self.username}/{self.password}/{stream_id}.{ext}"

    def series_stream_url(self, stream_id: str | int, ext: str = "mp4") -> str:
        return f"{self.base_url}/series/{self.username}/{self.password}/{stream_id}.{ext}"

    @staticmethod
    def normalize_movie(item: dict) -> dict:
        return {
            "id": str(item.get("stream_id") or item.get("num") or ""),
            "title": item.get("name") or item.get("title") or "Untitled",
            "poster": item.get("stream_icon") or item.get("cover") or "",
            "category_id": str(item.get("category_id") or ""),
            "rating": item.get("rating") or item.get("rating_5based") or "",
            "year": _extract_year(item),
            "container": item.get("container_extension") or "mp4",
            "media_type": "movie",
            "source": "xtream",
            "added": item.get("added"),
        }

    @staticmethod
    def normalize_series(item: dict) -> dict:
        return {
            "id": str(item.get("series_id") or item.get("num") or ""),
            "title": item.get("name") or item.get("title") or "Untitled",
            "poster": item.get("cover") or item.get("stream_icon") or "",
            "category_id": str(item.get("category_id") or ""),
            "rating": item.get("rating") or "",
            "year": str(item.get("releaseDate") or item.get("release_date") or "")[:4] or "",
            "plot": item.get("plot") or "",
            "media_type": "show",
            "source": "xtream",
        }

    @staticmethod
    def normalize_live(item: dict) -> dict:
        return {
            "id": str(item.get("stream_id") or item.get("num") or ""),
            "title": item.get("name") or "Untitled",
            "poster": item.get("stream_icon") or "",
            "category_id": str(item.get("category_id") or ""),
            "epg_channel_id": item.get("epg_channel_id"),
            "media_type": "live",
            "source": "xtream",
            "container": "ts",
        }


def _extract_year(item: dict) -> str:
    for key in ("year", "releaseDate", "releasedate", "release_date"):
        val = item.get(key)
        if val:
            s = str(val)
            return s[:4] if len(s) >= 4 else s
    name = item.get("name") or ""
    if "(" in name and ")" in name:
        inside = name[name.rfind("(") + 1 : name.rfind(")")]
        if inside.isdigit() and len(inside) == 4:
            return inside
    return ""
