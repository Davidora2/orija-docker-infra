#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$ROOT/android-sdk}"
cd "$ROOT"
./gradlew :app:assembleDebug
mkdir -p releases
cp -f app/build/outputs/apk/debug/app-debug.apk releases/LocalAide-debug.apk
ls -lh releases/LocalAide-debug.apk
echo "APK ready: releases/LocalAide-debug.apk"
