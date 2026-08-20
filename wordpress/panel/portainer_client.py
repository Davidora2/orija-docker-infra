"""Portainer API helpers for the hosting control panel."""
from __future__ import annotations

import os
from typing import Any

import httpx

PORTAINER_URL = os.environ.get("PORTAINER_URL", "https://portainer.orija.store").rstrip("/")
PORTAINER_API_TOKEN = os.environ.get("PORTAINER_API_TOKEN", "")
ENDPOINT_ID = os.environ.get("PORTAINER_ENDPOINT_ID", "")


class PortainerError(RuntimeError):
    pass


def _headers() -> dict[str, str]:
    if not PORTAINER_API_TOKEN:
        raise PortainerError("PORTAINER_API_TOKEN is not configured on the panel")
    return {"X-API-Key": PORTAINER_API_TOKEN}


def client() -> httpx.Client:
    return httpx.Client(base_url=f"{PORTAINER_URL}/api", headers=_headers(), timeout=180.0)


def resolve_endpoint_id() -> int:
    global ENDPOINT_ID
    if ENDPOINT_ID:
        return int(ENDPOINT_ID)
    with client() as c:
        r = c.get("/endpoints")
        r.raise_for_status()
        eps = r.json()
    for e in eps:
        if str(e.get("Name", "")).lower() == "local":
            ENDPOINT_ID = str(e["Id"])
            return int(ENDPOINT_ID)
    if not eps:
        raise PortainerError("No Portainer endpoints found")
    ENDPOINT_ID = str(eps[0]["Id"])
    return int(ENDPOINT_ID)


def list_stacks() -> list[dict[str, Any]]:
    with client() as c:
        r = c.get("/stacks")
        r.raise_for_status()
        return r.json()


def find_stack(name: str) -> dict[str, Any] | None:
    for s in list_stacks():
        if s.get("Name") == name:
            return s
    return None


def create_stack_from_string(name: str, compose: str, env: list[dict[str, str]]) -> dict[str, Any]:
    ep = resolve_endpoint_id()
    existing = find_stack(name)
    with client() as c:
        if existing:
            body = {
                "stackFileContent": compose,
                "env": env,
                "prune": False,
                "pullImage": True,
            }
            r = c.put(f"/stacks/{existing['Id']}", params={"endpointId": ep}, json=body)
        else:
            body = {"Name": name, "StackFileContent": compose, "Env": env}
            r = c.post(
                "/stacks/create/standalone/string",
                params={"endpointId": ep},
                json=body,
            )
        if r.status_code >= 400:
            raise PortainerError(f"Portainer error {r.status_code}: {r.text[:500]}")
        return r.json()


def delete_stack(name: str) -> None:
    existing = find_stack(name)
    if not existing:
        return
    ep = resolve_endpoint_id()
    with client() as c:
        r = c.delete(f"/stacks/{existing['Id']}", params={"endpointId": ep, "external": "false"})
        if r.status_code >= 400:
            raise PortainerError(f"Delete failed {r.status_code}: {r.text[:500]}")


def container_states_for_site(slug: str) -> dict[str, str]:
    """Return {role: state} for wp-<slug>-app / wp-<slug>-db if visible."""
    ep = resolve_endpoint_id()
    with client() as c:
        r = c.get(f"/endpoints/{ep}/docker/containers/json", params={"all": "true"})
        if r.status_code >= 400:
            return {}
        containers = r.json()
    out: dict[str, str] = {}
    for ctn in containers:
        names = ",".join(ctn.get("Names") or [])
        if f"wp-{slug}-app" in names:
            out["wordpress"] = ctn.get("State", "unknown")
        elif f"wp-{slug}-db" in names:
            out["database"] = ctn.get("State", "unknown")
    return out
