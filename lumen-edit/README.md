# Lumen

Mobile photo editor inspired by Adobe Lightroom — adjust light & color, import Lightroom `.xmp` / `.lrtemplate` presets, and export JPEGs.

## Download the Android APK

**[`releases/Lumen-release.apk`](../releases/Lumen-release.apk)** (~46MB)

Package: `app.lumen.edit` · minSdk 24 · targetSdk 36

On your phone: enable **Install unknown apps**, then open the APK.

On GitHub: open this branch → `releases` → `Lumen-release.apk` → Download.

## Features

- **Library / capture** — open photos from your camera roll or take a new shot
- **Lightroom-style adjustments** — Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Temp, Tint, Vibrance, Saturation, Clarity, Dehaze, Texture, Grain
- **Presets** — curated built-ins plus **import Adobe Lightroom / Camera Raw XMP** (and `.lrtemplate`) files, or **DNG files with embedded develop settings**
- **Before / after** — hold **Before** to compare
- **Export** — bake adjustments to JPEG (full fidelity on web; share / save on Android)

## Run (dev)

```bash
cd lumen-edit
npm install
npm run web          # browser — full export + preset import
npm start            # Expo Go on a phone
npm run android      # native Android (requires SDK)
```

## Rebuild the APK

Requires JDK 17+, Android SDK platform 36, build-tools 36, NDK 27.1.12297006.

```bash
cd lumen-edit
npm install
npx expo prebuild --platform android
export ANDROID_HOME=/path/to/android-sdk
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
cp app/build/outputs/apk/release/app-release.apk ../../releases/Lumen-release.apk
```

## Lightroom presets

1. In Lightroom, export a Develop preset as **`.xmp`**, **or** use a **`.dng`** that has develop settings written into the file (Metadata → Save Metadata to File / export DNG)
2. In Lumen → **Presets** → **Import** (or from the home screen)
3. Adjustments map from Camera Raw settings (`crs:Exposure2012`, `crs:Contrast2012`, temperature, vibrance, etc.)

Samples:
- `assets/presets/sample-golden-film.xmp`
- `assets/presets/sample-settings.dng` (embedded XMP / TIFF tag 700)

## Smoke-test the XMP parser

```bash
cd lumen-edit
npm run test:xmp
```

## Stack

Expo (React Native) + TypeScript, canvas-based image processing (web export), AsyncStorage for imported presets.
