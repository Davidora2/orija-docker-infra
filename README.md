# Orija Insider Scout (Android)

Scan **public SEC Form 4** insider filings on your phone, rank open-market buying clusters, and get research-only **buy / review / sell windows**.

## Download the APK

**[`releases/InsiderScout-debug.apk`](releases/InsiderScout-debug.apk)**

On GitHub: open this branch → **`releases`** → **`InsiderScout-debug.apk`** → Download.

> Path: `orija-docker-infra / releases / InsiderScout-debug.apk`  
> Do not look under `app/` — that folder is Kotlin source only.

## Install

1. On your phone, allow **Install unknown apps** for your browser/Files
2. Open the APK and install
3. Launch **Orija Insider Scout** and tap **Rescan EDGAR** (needs internet)

## What it does

1. Pulls recent Form 4 filings from SEC EDGAR
2. Keeps **open-market purchases/sales** (codes `P` / `S`)
3. Scores cluster buying, role (CEO/CFO/officer/director), size, recency, and sell pressure
4. Ranks ideas (`A`–`F`) with:
   - **Buy window** after the filing is public
   - **Review date**
   - **Sell / exit window** (often ~1–3 months for stronger signals)

## Important

**Not investment advice.** Public EDGAR research only. Past insider patterns do not predict future results.

## Build from source

```bash
export ANDROID_HOME=/path/to/android-sdk
./scripts/build-apk.sh
# → releases/InsiderScout-debug.apk
```

Requirements: JDK 17+, Android SDK platform 34, build-tools 34.

## Optional Python CLI

A Python research CLI/API remains under `sec_insider_scout/` for desktop use:

```bash
pip install -e ".[dev]"
insider-scout scan
```
