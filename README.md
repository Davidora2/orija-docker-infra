# VerseCast

Cross-platform church streaming companion for **Windows** and **macOS**. VerseCast listens to sermon audio, detects spoken Bible references, and shows them as OBS lower thirds — with live captions and fully customizable graphics.

## Features

- **Live verse detection** — hears references like “John 3:16” or “Psalm twenty-three verse one” and looks up the text
- **OBS lower thirds** — local Browser Source overlays with transparent backgrounds
- **Live captions** — accessibility captions on a separate OBS source
- **Manual verse control** — type a reference anytime as a backup
- **Graphics editor** — backgrounds (solid / gradient / image), fonts, colors, accent bars, position, animation
- **Windows & Mac** — packaged with Electron

## Quick start

```bash
npm install
npm run fetch-bible
npm run dev
```

- Control panel opens in Electron
- Overlay server starts on `http://127.0.0.1:47821`

### OBS setup

1. Sources → **Browser**
2. Add lower third URL: `http://127.0.0.1:47821/lower-third`
3. Add captions URL: `http://127.0.0.1:47821/captions`
4. Width **1920**, Height **1080**, transparent background

## Build installers

```bash
npm run dist:mac   # macOS .dmg / .zip
npm run dist:win   # Windows NSIS / portable
```

## Audio tips

| Platform | Tip |
|----------|-----|
| macOS | Grant mic permission; use BlackHole for program/loopback audio |
| Windows | Enable Stereo Mix or VB-Audio Cable, then select that input |

## Project layout

```
electron/     Main process + preload
server/       Overlay HTTP + WebSocket server, Bible lookup
overlay/      OBS Browser Source pages
src/          React control panel
data/bible/   Local Bible JSON (public-domain text)
```

## Bible text

`npm run fetch-bible` downloads a full public-domain English Bible (BBE by default; falls back to KJV). If downloads fail, a built-in sermon corpus is written so the app still runs.

## License

MIT — Bible text remains under its own public-domain terms.
