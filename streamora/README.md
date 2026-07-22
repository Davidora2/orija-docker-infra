# Streamora

Android IPTV client for **Xtream Codes** with a Netflix-style experience: profiles, My List (likes), browse, search, and ExoPlayer streaming.

## Features

- Sign in with Xtream server URL, username, and password
- Multiple user profiles (including kids profiles)
- Home hero + rows for Movies, Series, Live TV, Continue Watching, My List
- Category browse for Live / VOD / Series
- Like titles to My List (per profile)
- Search across live, movies, and series
- Fullscreen player (Media3 ExoPlayer + HLS)
- Subtitles: embedded tracks + Xtream external subtitle files, with in-player picker
- Cast to TV: Chromecast / Cast-enabled TVs via the cast button in the player

## Build the APK

Requirements: JDK 17+, Android SDK 34.

```bash
cd streamora
# optional: set sdk.dir in local.properties
./gradlew assembleRelease
```

Debug APK:

```bash
./gradlew assembleDebug
```

Outputs:

- **Prebuilt (in this repo):** [`dist/streamora-debug.apk`](dist/streamora-debug.apk) — download from GitHub and install
- `app/build/outputs/apk/debug/app-debug.apk` (after local build)
- `app/build/outputs/apk/release/app-release-unsigned.apk`

## Install

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Login fields

| Field | Example |
|-------|---------|
| Stream server URL | `http://myprovider.com:8080` |
| Username | your Xtream username |
| Password | your Xtream password |

Use the same panel URL your provider gave you (host + port). Do not paste a single `.m3u8` channel link into the server field — Streamora talks to the Xtream `player_api.php` API.

## Legal note

Only use Streamora with IPTV services you are authorized to access.
