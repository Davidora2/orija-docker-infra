# Orija native apps (Android · Android TV · iOS)

Expo React Native client for the Orija media server. One codebase targets:

| Target | How |
|--------|-----|
| **Android phones/tablets** | `eas build -p android` / Play Store |
| **Android TV** | Same Android build with leanback launcher (D-pad focus UI) |
| **iOS** | `eas build -p ios` / TestFlight / App Store |

## Features

- Connect to your Orija Docker server URL
- Personalized login (JWT)
- Home / Movies / Shows / Live TV / Local library / Favorites
- ★ Favorite & Save (server downloads into Movies/Shows)
- Full-screen player with stream session heartbeats
- TV-friendly focus rings for remote control

## Dev

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (phone), or press `a` / `i` with emulators.

> Android TV: use an Android TV emulator / device with a **dev client** or release APK (Expo Go has limited TV support).

## Point at your server

On a phone/TV use your LAN IP, not `localhost`:

```
http://192.168.x.x:8096
```

## Production builds (EAS)

```bash
npm i -g eas-cli
eas login
cd mobile
eas build -p android --profile preview      # APK for phones + Android TV
eas build -p ios --profile production      # requires Apple developer account
```

Android TV leanback entries are injected by `plugins/withAndroidTV.js` (LEANBACK_LAUNCHER + optional touchscreen/leanback features).

## Project layout

```
mobile/
  App.js                 # navigation shell
  app.json               # iOS + Android + TV config
  plugins/withAndroidTV.js
  src/
    api/client.js
    context/AuthContext.js
    screens/…            # Server, Login, Home, Catalog, Detail, Player, …
    components/Focusable.js   # D-pad focus styling
```
