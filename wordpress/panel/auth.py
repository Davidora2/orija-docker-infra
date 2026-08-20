"""Panel authentication: password hash + recovery code stored on the data volume."""
from __future__ import annotations

import json
import os
import secrets
import string
from datetime import datetime, timezone
from pathlib import Path

import bcrypt

DATA_DIR = Path(os.environ.get("PANEL_DATA_DIR", "/data"))
AUTH_PATH = DATA_DIR / "auth.json"
REVEAL_PATH = DATA_DIR / "RECOVERY_CODE.txt"


def _ensure() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_auth() -> dict:
    _ensure()
    if AUTH_PATH.exists():
        return json.loads(AUTH_PATH.read_text())
    return {}


def save_auth(data: dict) -> None:
    _ensure()
    AUTH_PATH.write_text(json.dumps(data, indent=2))
    AUTH_PATH.chmod(0o600)


def hash_secret(value: str) -> str:
    return bcrypt.hashpw(value.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_secret(value: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(value.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:  # noqa: BLE001
        return False


def gen_recovery_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    for ch in "O0I1":
        alphabet = alphabet.replace(ch, "")
    parts = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)]
    return "-".join(parts)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _write_reveal(recovery: str, note: str) -> None:
    REVEAL_PATH.write_text(f"{note}\nRecovery code: {recovery}\n")
    REVEAL_PATH.chmod(0o600)


def bootstrap_from_env() -> dict:
    """Create auth.json from PANEL_PASSWORD on first boot; honor one-shot resets."""
    data = load_auth()

    reset = os.environ.get("PANEL_PASSWORD_RESET", "").strip()
    if reset and data.get("password_hash"):
        data["password_hash"] = hash_secret(reset)
        data["updated_at"] = _now()
        save_auth(data)

    if data.get("password_hash"):
        return data

    initial = os.environ.get("PANEL_PASSWORD", "").strip()
    if not initial:
        raise RuntimeError("PANEL_PASSWORD is required on first boot")

    recovery = gen_recovery_code()
    data = {
        "password_hash": hash_secret(initial),
        "recovery_hash": hash_secret(recovery),
        "recovery_hint": recovery[:4] + "-****-****",
        "created_at": _now(),
    }
    save_auth(data)
    _write_reveal(recovery, "Save this recovery code somewhere safe, then delete it from the panel.")
    return data


def verify_password(password: str) -> bool:
    data = load_auth()
    hashed = data.get("password_hash") or ""
    if hashed:
        return verify_secret(password, hashed)
    env = os.environ.get("PANEL_PASSWORD", "")
    return bool(env) and secrets.compare_digest(password, env)


def change_password(current: str, new_password: str) -> None:
    if len(new_password) < 8:
        raise ValueError("New password must be at least 8 characters")
    if new_password != new_password.strip() or " " in new_password.strip() and False:
        pass
    if not verify_password(current):
        raise ValueError("Current password is incorrect")
    data = load_auth()
    if not data.get("password_hash"):
        bootstrap_from_env()
        data = load_auth()
    data["password_hash"] = hash_secret(new_password)
    data["updated_at"] = _now()
    save_auth(data)


def reset_with_recovery(recovery_code: str, new_password: str) -> str:
    """Reset password with recovery code; returns the new recovery code."""
    if len(new_password) < 8:
        raise ValueError("New password must be at least 8 characters")
    data = load_auth()
    if not data.get("recovery_hash"):
        bootstrap_from_env()
        data = load_auth()
    code = recovery_code.strip().upper().replace(" ", "")
    if not verify_secret(code, data.get("recovery_hash") or ""):
        raise ValueError("Recovery code is incorrect")
    new_recovery = gen_recovery_code()
    data["password_hash"] = hash_secret(new_password)
    data["recovery_hash"] = hash_secret(new_recovery)
    data["recovery_hint"] = new_recovery[:4] + "-****-****"
    data["updated_at"] = _now()
    save_auth(data)
    _write_reveal(new_recovery, "Password reset successful. Save this NEW recovery code.")
    return new_recovery


def rotate_recovery(current_password: str) -> str:
    if not verify_password(current_password):
        raise ValueError("Current password is incorrect")
    data = load_auth()
    new_recovery = gen_recovery_code()
    data["recovery_hash"] = hash_secret(new_recovery)
    data["recovery_hint"] = new_recovery[:4] + "-****-****"
    data["updated_at"] = _now()
    save_auth(data)
    _write_reveal(new_recovery, "New recovery code generated. Save it, then dismiss in the panel.")
    return new_recovery


def peek_pending_recovery() -> str | None:
    if not REVEAL_PATH.exists():
        return None
    for line in REVEAL_PATH.read_text().splitlines():
        if line.lower().startswith("recovery code:"):
            return line.split(":", 1)[1].strip()
    return None


def dismiss_recovery_reveal() -> None:
    if REVEAL_PATH.exists():
        REVEAL_PATH.unlink()


def recovery_hint() -> str:
    return (load_auth().get("recovery_hint") or "****-****-****")
