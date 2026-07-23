# OrijaFlix Android APKs

Built release APKs for phone and Android TV.

| Device | Package ID | File |
|--------|------------|------|
| Phone / tablet | `com.orijaflix.media.phone` | `orijaflix-phone-v1.0.0.apk` |
| Android TV | `com.orijaflix.media.tv` | `orijaflix-tv-v1.0.0.apk` |

## Install

**Phone**
```bash
adb install -r orijaflix-phone-v1.0.0.apk
```

**Android TV** (enable “Unknown sources” / ADB debugging)
```bash
adb connect <tv-ip>
adb install -r orijaflix-tv-v1.0.0.apk
```

## First launch

1. Enter your OrijaFlix server URL, e.g. `http://192.168.x.x:8096`
2. Sign in with your account (`admin` / your password)

## Rebuild locally

```bash
cd mobile
export ANDROID_HOME=~/android-sdk ANDROID_SDK_ROOT=$ANDROID_HOME
npx expo prebuild --platform android
cd android && ./gradlew assemblePhoneRelease assembleTvRelease
```

APKs land in `android/app/build/outputs/apk/{phone,tv}/release/`.
