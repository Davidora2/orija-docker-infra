# Lumen

Mobile photo editor inspired by Adobe Lightroom — adjust light & color, import Lightroom `.xmp` / `.lrtemplate` presets, and export JPEGs.

## Features

- **Library / capture** — open photos from your camera roll or take a new shot
- **Lightroom-style adjustments** — Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Temp, Tint, Vibrance, Saturation, Clarity, Dehaze, Texture, Grain
- **Presets** — curated built-ins plus **import Adobe Lightroom / Camera Raw XMP** (and `.lrtemplate`) files
- **Before / after** — hold **Before** to compare
- **Export** — bake adjustments to JPEG (full fidelity on web)

## Run

```bash
cd lumen-edit
npm install
npm run web          # best for full export + preset import in browser
npm start            # Expo Go on a phone
```

Then open the Expo URL, or use `npm run android` / `npm run ios` with a simulator.

## Lightroom presets

1. In Lightroom, export a Develop preset as **`.xmp`**
2. In Lumen → **Presets** → **Import** (or from the home screen)
3. Adjustments map from Camera Raw settings (`crs:Exposure2012`, `crs:Contrast2012`, temperature, vibrance, etc.)

A sample preset lives at `assets/presets/sample-golden-film.xmp`.

## Smoke-test the XMP parser

```bash
cd lumen-edit
npx tsx scripts/test-xmp.ts
```

## Stack

Expo (React Native) + TypeScript, canvas-based image processing, AsyncStorage for imported presets.
