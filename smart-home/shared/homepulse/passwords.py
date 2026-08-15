"""Password hashing and opaque session tokens for HomePulse admin."""

from __future__ import annotations

import hashlib
import hmac
import secrets


def hash_password(password: str, pepper: str, *, iterations: int = 200_000) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        f"{pepper}:{password}".encode(),
        bytes.fromhex(salt),
        iterations,
    ).hex()
    return f"pbkdf2_sha256${iterations}${salt}${digest}"


def verify_password(password: str, stored: str, pepper: str) -> bool:
    try:
        algo, iters_s, salt, digest = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iters_s)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256",
        f"{pepper}:{password}".encode(),
        bytes.fromhex(salt),
        iterations,
    ).hex()
    return hmac.compare_digest(candidate, digest)


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str, pepper: str) -> str:
    return hashlib.sha256(f"{pepper}:session:{token}".encode()).hexdigest()
