#!/usr/bin/env python3
"""
One-time helper to obtain a Pinterest OAuth access + refresh token.

Usage:
  1. Put PINTEREST_APP_ID / PINTEREST_APP_SECRET in .env
  2. Register redirect URI http://localhost:8765/callback in your Pinterest app
  3. python scripts/oauth_pinterest.py
  4. Paste the resulting tokens into .env (or data/state.json will store refreshes later)
"""

from __future__ import annotations

import http.server
import secrets
import sys
import urllib.parse
import webbrowser
from pathlib import Path

import httpx

# Allow running without installing the package
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pin_agent.config import get_settings  # noqa: E402

SCOPES = [
    "boards:read",
    "boards:write",
    "pins:read",
    "pins:write",
    "user_accounts:read",
]
REDIRECT_URI = "http://localhost:8765/callback"
AUTH_URL = "https://www.pinterest.com/oauth/"
TOKEN_URL = "https://api.pinterest.com/v5/oauth/token"


def main() -> int:
    settings = get_settings()
    if not settings.pinterest_app_id or not settings.pinterest_app_secret:
        print("Set PINTEREST_APP_ID and PINTEREST_APP_SECRET first.")
        return 1

    state = secrets.token_urlsafe(16)
    params = {
        "client_id": settings.pinterest_app_id,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": ",".join(SCOPES),
        "state": state,
    }
    url = AUTH_URL + "?" + urllib.parse.urlencode(params)
    print("Open this URL if the browser does not launch:\n", url)
    webbrowser.open(url)

    code_holder: dict[str, str] = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path != "/callback":
                self.send_response(404)
                self.end_headers()
                return
            qs = urllib.parse.parse_qs(parsed.query)
            if qs.get("state", [None])[0] != state:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"State mismatch")
                return
            code_holder["code"] = qs.get("code", [""])[0]
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Authorization complete. You can close this tab.")

        def log_message(self, format, *args):  # noqa: A003, ANN001
            return

    server = http.server.HTTPServer(("127.0.0.1", 8765), Handler)
    print("Waiting for OAuth callback on", REDIRECT_URI)
    while "code" not in code_holder:
        server.handle_request()

    auth = (settings.pinterest_app_id, settings.pinterest_app_secret)
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(
            TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": code_holder["code"],
                "redirect_uri": REDIRECT_URI,
                "continuous_refresh": "true",
            },
            auth=auth,
        )
        print("Token status:", resp.status_code)
        data = resp.json()
        print(data)
        if resp.is_success:
            print("\nAdd these to your .env:")
            print(f"PINTEREST_ACCESS_TOKEN={data.get('access_token')}")
            print(f"PINTEREST_REFRESH_TOKEN={data.get('refresh_token')}")
            return 0
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
