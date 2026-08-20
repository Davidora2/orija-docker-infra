#!/usr/bin/env python3
"""Minimal YAML registry helpers for WordPress hosting (no PyYAML required)."""
from __future__ import annotations

from pathlib import Path
import re
from typing import Any


HEADER = """# Central inventory of WordPress sites and owning Portainer accounts.
# Updated automatically by scripts/new-site.sh and scripts/remove-site.sh.
#
# owner_account: Portainer username or team name responsible for the stack
# stack_name: Portainer stack name (must be unique on the endpoint)
# domain: public hostname (Cloudflare Tunnel → platform origin)
# slug: short id used in container/volume names

"""


def _parse_simple(path: Path) -> dict[str, Any]:
    """Parse our registry subset (platform map + accounts/sites lists)."""
    text = path.read_text() if path.exists() else ""
    data: dict[str, Any] = {
        "version": 1,
        "platform": {
            "stack_name": "wp-platform",
            "http_port": 18100,
            "dashboard_port": 18101,
            "tunnel_origin": "http://localhost:18100",
            "network": "wp-public",
        },
        "accounts": [],
        "sites": [],
    }

    # Drop comments for parsing
    lines = []
    for line in text.splitlines():
        if line.strip().startswith("#"):
            continue
        lines.append(line)
    body = "\n".join(lines)

    m = re.search(r"^version:\s*(\d+)\s*$", body, re.M)
    if m:
        data["version"] = int(m.group(1))

    plat = re.search(r"^platform:\n((?:  .+\n)+)", body, re.M)
    if plat:
        for line in plat.group(1).splitlines():
            line = line.strip()
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            k, v = k.strip(), v.strip()
            if v.isdigit():
                data["platform"][k] = int(v)
            else:
                data["platform"][k] = v

    def parse_list(key: str) -> list[dict[str, str]]:
        items: list[dict[str, str]] = []
        # Match "key:" then either [] or indented block until next top-level key
        m = re.search(rf"^{key}:\s*(\[\])?\s*$", body, re.M)
        if not m:
            return items
        if m.group(1) == "[]":
            return items
        start = m.end()
        rest = body[start:]
        # stop at next top-level key (no indent)
        stop = re.search(r"^\S", rest, re.M)
        block = rest[: stop.start()] if stop else rest
        current: dict[str, str] | None = None
        for line in block.splitlines():
            if re.match(r"^  - ", line):
                if current:
                    items.append(current)
                current = {}
                # inline "  - slug: x" style first field
                inline = re.match(r"^  - ([^:]+):\s*(.*)$", line)
                if inline:
                    current[inline.group(1).strip()] = inline.group(2).strip()
            elif current is not None:
                fm = re.match(r"^    ([^:]+):\s*(.*)$", line)
                if fm:
                    current[fm.group(1).strip()] = fm.group(2).strip()
        if current:
            items.append(current)
        return items

    data["accounts"] = parse_list("accounts")
    data["sites"] = parse_list("sites")
    return data


def _dump(data: dict[str, Any]) -> str:
    out = [HEADER.rstrip(), "", f"version: {data.get('version', 1)}", "platform:"]
    for k, v in data["platform"].items():
        out.append(f"  {k}: {v}")
    out.append("")
    accounts = data.get("accounts") or []
    if not accounts:
        out.append("accounts: []")
    else:
        out.append("accounts:")
        for a in accounts:
            out.append(f"  - id: {a.get('id', '')}")
            for k in ("display_name", "portainer_user", "notes"):
                if k in a and a[k] != "":
                    out.append(f"    {k}: {a[k]}")
    out.append("")
    sites = data.get("sites") or []
    if not sites:
        out.append("sites: []")
    else:
        out.append("sites:")
        for s in sites:
            out.append(f"  - slug: {s.get('slug', '')}")
            for k in ("domain", "title", "owner_account", "stack_name", "status", "created"):
                if k in s and s[k] != "":
                    out.append(f"    {k}: {s[k]}")
    out.append("")
    return "\n".join(out)


def upsert_site(
    registry_path: Path,
    *,
    slug: str,
    domain: str,
    title: str,
    owner: str,
    stack_name: str,
    created: str,
    status: str = "provisioned",
) -> None:
    data = _parse_simple(registry_path)
    if not any(a.get("id") == owner for a in data["accounts"]):
        data["accounts"].append(
            {
                "id": owner,
                "display_name": owner,
                "portainer_user": owner,
                "notes": "auto-added by new-site.sh",
            }
        )
    data["sites"] = [s for s in data["sites"] if s.get("slug") != slug]
    data["sites"].insert(
        0,
        {
            "slug": slug,
            "domain": domain,
            "title": title,
            "owner_account": owner,
            "stack_name": stack_name,
            "status": status,
            "created": created,
        },
    )
    registry_path.write_text(_dump(data))


def remove_site(registry_path: Path, slug: str) -> bool:
    data = _parse_simple(registry_path)
    before = len(data["sites"])
    data["sites"] = [s for s in data["sites"] if s.get("slug") != slug]
    registry_path.write_text(_dump(data))
    return len(data["sites"]) < before


if __name__ == "__main__":
    import argparse
    import sys

    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)

    u = sub.add_parser("upsert-site")
    u.add_argument("--registry", required=True)
    u.add_argument("--slug", required=True)
    u.add_argument("--domain", required=True)
    u.add_argument("--title", required=True)
    u.add_argument("--owner", required=True)
    u.add_argument("--stack-name", required=True)
    u.add_argument("--created", required=True)
    u.add_argument("--status", default="provisioned")

    r = sub.add_parser("remove-site")
    r.add_argument("--registry", required=True)
    r.add_argument("--slug", required=True)

    args = p.parse_args()
    if args.cmd == "upsert-site":
        upsert_site(
            Path(args.registry),
            slug=args.slug,
            domain=args.domain,
            title=args.title,
            owner=args.owner,
            stack_name=args.stack_name,
            created=args.created,
            status=args.status,
        )
        print(f"Updated registry: {args.registry}")
    elif args.cmd == "remove-site":
        ok = remove_site(Path(args.registry), args.slug)
        if ok:
            print("Removed registry entry for", args.slug)
        else:
            print("Warning: no registry entry found for slug", args.slug, file=sys.stderr)
            sys.exit(0)
