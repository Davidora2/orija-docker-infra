# Orija Insider Scout (Android)

Track **serving politicians** in the **US, UK, and Canada** (public trades + private-company filings) and **SEC Form 4** corporate insiders — with ranked ideas and buy/sell windows.

## Download the APK

**[`releases/InsiderScout-debug.apk`](releases/InsiderScout-debug.apk)** — **v1.3.0**

On GitHub: open this branch → **`releases`** → **`InsiderScout-debug.apk`** → Download.

> Path: `orija-docker-infra / releases / InsiderScout-debug.apk`  
> Do not look under `app/` — that folder is Kotlin source only.

## Install

1. Allow **Install unknown apps**
2. Open the APK
3. Open the **Politicians** tab (needs internet)

## Politicians (US / UK / Canada)

| Country | What you get |
|---|---|
| **United States** | Live House & Senate STOCK Act Periodic Transaction Reports (public securities). Open a trade for a Quiver-style price chart + % since trade/disclosure. |
| **United Kingdom** | Register of Members’ Financial Interests — **directorships, shareholdings, partnerships, paid roles in private companies**. |
| **Canada** | Serving MPs via OpenParliament, with deep links to the **Conflict of Interest & Ethics Commissioner** public registry (private-company assets). Canada has no STOCK Act-style trade API. |

Tap a disclosure → politician header, filing facts, chart when a public ticker exists, and **Open official filing / registry**.

## Corporate Insiders (SEC Form 4)

Second tab: rank recent open-market Form 4 buys/sells with buy/review/sell windows and an in-app Form 4 viewer.

## Important

**Not investment advice.** Public disclosures only. Filings can be delayed or incomplete. Private-company interests usually have **no public price chart**.

## Build from source

```bash
export ANDROID_HOME=/path/to/android-sdk
./scripts/build-apk.sh
# → releases/InsiderScout-debug.apk
```

Requirements: JDK 17+, Android SDK platform 34, build-tools 34.
