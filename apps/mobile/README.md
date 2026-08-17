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
