# Orija Insider Scout

Scan **public SEC Form 4** insider filings, rank open-market buying clusters, and suggest research-only **buy / review / sell windows**.

## Important

**Not investment advice.** This tool only analyzes already-public EDGAR filings. It does not guarantee profits, does not place trades, and must not be used to trade on material non-public information. Past insider patterns do not predict future returns.

## What it does

1. Pulls recent Form 4 filings from SEC EDGAR (insider ownership documents)
2. Keeps **open-market purchases/sales** (transaction codes `P` / `S`) — ignores awards, gifts, and most option noise
3. Groups activity by issuer and scores:
   - Cluster buying (multiple insiders)
   - Role quality (CEO / CFO / officer / director)
   - Dollar size vs a conviction threshold
   - Recency and multi-day accumulation
   - Penalty for overlapping sells
4. Ranks ideas (`A`–`F`) and proposes:
   - **Buy window** after the filing becomes public
   - **Review date**
   - **Sell / exit window** (typically ~1–3 months for stronger signals)
   - **Stop-review horizon** if the thesis fails early

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env
# Edit INSIDER_SEC_USER_AGENT with your name/email (SEC requirement)

# CLI ranked table
insider-scout scan --lookback-days 14 --max-filings 60

# JSON
insider-scout scan --json

# Web dashboard + API
insider-scout serve --port 8080
# open http://127.0.0.1:8080
```

### API

- `GET /api/health`
- `GET /api/scan?lookback_days=14&max_filings=60&refresh=true`

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `INSIDER_SEC_USER_AGENT` | sample string | Required descriptive UA for SEC |
| `INSIDER_LOOKBACK_DAYS` | `14` | Filing age window |
| `INSIDER_MAX_FILINGS` | `80` | Cap on Form 4s parsed per scan |
| `INSIDER_MIN_BUY_VALUE` | `25000` | Soft notional threshold for conviction |
| `INSIDER_CACHE_TTL_SECONDS` | `900` | In-memory scan cache |

## How timing suggestions are built

| Score band | Entry after filing | Review | Exit band |
|---|---|---|---|
| High (`~70+`) | ~1 week | ~3 weeks | ~30–90 days |
| Medium (`~50–69`) | ~1 week | ~1 month | ~45–120 days |
| Low / avoid | stand down | ~2 weeks | n/a |

These are **heuristic research templates**, not signals from a broker or backtested strategy engine.

## Tests

```bash
pytest -q
```

## Safety model

- Reads **public** EDGAR data only
- No brokerage order routing in this package
- Always shows a disclaimer on CLI, API, and UI
