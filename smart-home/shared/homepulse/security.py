"""API key helpers — secrets never stored in plaintext."""

from __future__ import annotations

import hashlib
import hmac
import secrets


def generate_api_key(prefix: str = "hp") -> str:
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def hash_api_key(api_key: str, pepper: str) -> str:
    return hashlib.sha256(f"{pepper}:{api_key}".encode()).hexdigest()


def verify_api_key(api_key: str, stored_hash: str, pepper: str) -> bool:
    candidate = hash_api_key(api_key, pepper)
    return hmac.compare_digest(candidate, stored_hash)
