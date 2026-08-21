#!/usr/bin/env bash
# Build a release APK pointed at production Life OS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://lifeos.orija.store/api}"
# OAuth client IDs are public; bake production web client so Google sign-in works
# and AccountSheet never mounts the auth hook with an undefined id.
export EXPO_PUBLIC_GOOGLE_CLIENT_ID="${EXPO_PUBLIC_GOOGLE_CLIENT_ID:-717142192703-7sso9a6hiflohs85bbqldfk57l1kkpkb.apps.googleusercontent.com}"
export CI=1

cd "$ROOT"
echo "Building with API_URL=$EXPO_PUBLIC_API_URL GOOGLE_CLIENT_ID=${EXPO_PUBLIC_GOOGLE_CLIENT_ID:0:24}…"
pnpm exec expo prebuild --platform android --non-interactive || pnpm exec expo prebuild --platform android
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
chmod +x gradlew
./gradlew assembleRelease
echo "APK: $ROOT/android/app/build/outputs/apk/release/app-release.apk"
