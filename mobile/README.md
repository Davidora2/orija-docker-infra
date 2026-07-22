# OrijaFlix native apps (Android · Android TV · iOS)

Expo React Native client for the OrijaFlix media server. One codebase targets:

| Target | How |
|--------|-----|
| **Android phones/tablets** | `eas build -p android` / Play Store |
| **Android TV** | Same Android build with leanback launcher (D-pad focus UI) |
| **iOS** | `eas build -p ios` / TestFlight / App Store |

## Features

- Connect to your OrijaFlix server URL
- Personalized login (JWT)
- Home / Movies / Shows / Live TV / Local library / Favorites
- ★ Favorite & Save (server downloads into movies/TVshows)
- Full-screen player with stream session heartbeats
- TV-friendly focus rings for remote control

## Dev

```bash
cd mobile
npm install
npx expo start
```

On devices use your LAN IP, not `localhost`:

```
http://192.168.x.x:8096
```

## Production builds (EAS)

```bash
npm i -g eas-cli
eas login
cd mobile
eas build -p android --profile preview
eas build -p ios --profile production
```
