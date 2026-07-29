#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$ROOT/android-sdk}"
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$(readlink -f "$(which java)")")")}"
cd "$ROOT"
./gradlew :app:assembleDebug :app:testDebugUnitTest
mkdir -p releases
cp -f app/build/outputs/apk/debug/app-debug.apk releases/InsiderScout-debug.apk
ls -lh releases/InsiderScout-debug.apk
echo "APK ready: releases/InsiderScout-debug.apk"
