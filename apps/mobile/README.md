# Life OS Native

Shared React Native / Expo application for Android and iOS.

## Run

```bash
pnpm install
pnpm mobile:start
```

Scan the QR code with Expo Go, or run:

```bash
pnpm --dir apps/mobile android
pnpm --dir apps/mobile ios
```

The iOS simulator requires macOS/Xcode. Native store or TestFlight builds require
Apple and Google signing credentials.

## Validate platform bundles

```bash
pnpm mobile:typecheck
pnpm mobile:export
```

## Preview builds

`eas.json` includes an internal-distribution profile. After authenticating with
Expo:

```bash
eas build --profile preview --platform android
eas build --profile preview --platform ios
```

Android preview produces an APK. iOS preview requires a registered device and
Apple signing; TestFlight uses the production profile.

### Local Android APK (no EAS account)

Requires Android SDK (`ANDROID_HOME`) and JDK 17+.

```bash
export EXPO_PUBLIC_API_URL=https://lifeos.orija.store/api
export EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id
./scripts/build-android-apk.sh
```

Output: `android/app/build/outputs/apk/release/app-release.apk`
