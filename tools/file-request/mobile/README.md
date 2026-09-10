# Immich Send (Android)

Sideload this app on a phone. It sends photos and videos **from anywhere** to Immich through the file-request relay.

Uploads are split into **8MB chunks**, so Cloudflare Tunnel’s ~100MB request cap does not apply. There is **no total file size limit** — a 4K video of several gigabytes is sent the same way as a photo. The relay reassembles on your server, then uploads to Immich on the LAN.

## Pair a phone

1. Admin → add Immich user API key
2. Admin → **Phone inboxes** → create a token for that user/album
3. In the app, paste **Server URL** (public tunnel hostname) and **token**

## Run / build

```bash
cd tools/file-request/mobile
npm install
npx expo start
```

Release APK (needs Android SDK):

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`
