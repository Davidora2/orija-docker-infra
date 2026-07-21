from __future__ import annotations

import logging
from typing import Any

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class PinterestClient:
    def __init__(
        self,
        access_token: str,
        api_base: str = "https://api.pinterest.com/v5",
        app_id: str = "",
        app_secret: str = "",
        refresh_token: str = "",
        on_token_refresh: Any | None = None,
        timeout: float = 60.0,
    ) -> None:
        self.access_token = access_token
        self.api_base = api_base.rstrip("/")
        self.app_id = app_id
        self.app_secret = app_secret
        self.refresh_token = refresh_token
        self.on_token_refresh = on_token_refresh
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
    def _request(self, method: str, path: str, json_body: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.api_base}{path}"
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.request(method, url, headers=self._headers(), json=json_body)
            if resp.status_code == 401 and self.refresh_token and self.app_id and self.app_secret:
                self._refresh_access_token()
                resp = client.request(method, url, headers=self._headers(), json=json_body)
            if resp.status_code >= 400:
                logger.error("Pinterest API error %s: %s", resp.status_code, resp.text)
                resp.raise_for_status()
            if not resp.content:
                return {}
            return resp.json()

    def _refresh_access_token(self) -> None:
        """Refresh using continuous refresh token (apps created after Sep 2025)."""
        logger.info("Refreshing Pinterest access token")
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.api_base}/oauth/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self.refresh_token,
                    "continuous_refresh": "true",
                },
                auth=(self.app_id, self.app_secret),
            )
            resp.raise_for_status()
            payload = resp.json()
            self.access_token = payload["access_token"]
            if payload.get("refresh_token"):
                self.refresh_token = payload["refresh_token"]
            if self.on_token_refresh:
                self.on_token_refresh(self.access_token, self.refresh_token)

    def get_user_account(self) -> dict[str, Any]:
        return self._request("GET", "/user_account")

    def list_boards(self, page_size: int = 25) -> list[dict[str, Any]]:
        data = self._request("GET", f"/boards?page_size={page_size}")
        return data.get("items", [])

    def create_pin(
        self,
        *,
        board_id: str,
        title: str,
        description: str,
        link: str | None,
        image_url: str | None = None,
        image_base64: str | None = None,
        content_type: str = "image/jpeg",
        alt_text: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a pin. Prefer image_url when Shopify CDN URLs are publicly reachable.
        Fall back to image_base64 for processed canvases.
        """
        media_source: dict[str, Any]
        if image_base64:
            media_source = {
                "source_type": "image_base64",
                "content_type": content_type,
                "data": image_base64,
            }
        elif image_url:
            media_source = {
                "source_type": "image_url",
                "url": image_url,
            }
        else:
            raise ValueError("Either image_url or image_base64 is required")

        body: dict[str, Any] = {
            "board_id": board_id,
            "title": title[:100],
            "description": description[:500],
            "media_source": media_source,
        }
        if link:
            body["link"] = link
        if alt_text:
            body["alt_text"] = alt_text[:500]

        return self._request("POST", "/pins", json_body=body)
