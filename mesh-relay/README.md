# MeshRelay

Offline-first **mesh messaging** for Android & iOS — phones relay chat packets through nearby devices when there’s no internet (Briar-style store-and-forward).

Built with **Expo + React Native + TypeScript**.

## What it does

- **Epidemic / gossip mesh**: messages flood with TTL, loop prevention, and a seen-cache
- **Store-and-forward**: intermediate phones accept, store, and rebroadcast packets
- **Presence**: peers announce themselves; stale peers drop off
- **Transports**
  - **Simulation** (works now): virtual relay phones on-device so you can demo multi-hop
  - **Bluetooth LE** adapter: ready to wire to `react-native-ble-plx` in a dev build
  - **LAN / Wi‑Fi** stub: Multipeer (iOS) / Wi‑Fi Direct (Android) hook points

## Quick start

```bash
cd mesh-relay
npm install
npx expo start
```

Then:

- Scan the QR with **Expo Go** on Android / iOS, or
- Press `a` / `i` for emulators, or
- Press `w` for web (simulation transport)

On first launch, pick a callsign. Two demo relays join automatically — open **PEERS** / **MESH** to inspect the network and adjust relay count.

## Project layout

```
src/
  mesh/          # identity, crypto, gossip protocol, MeshNode
  transport/     # Simulation / BLE / LAN adapters
  context/       # React mesh provider
  ui/            # screens + components
```

## Real Bluetooth / Wi‑Fi mesh (Android & iOS)

Expo Go cannot advertise/scan custom BLE GATT services. For radio mesh:

```bash
cd mesh-relay
npx expo install react-native-ble-plx
npx expo prebuild
npx expo run:android   # or run:ios on macOS
```

Then implement scan/advertise inside `src/transport/BleTransport.ts` using the documented service UUID, calling:

- `ingestNativePacket(packet, fromPeerId)`
- `setNativePeers(peers)`

iOS Multipeer / Android Wi‑Fi Direct belong in `LanTransport.ts` the same way. The **MeshNode protocol stays unchanged** — only the radio changes.

### Permissions

`app.json` already declares:

- iOS Bluetooth + local network usage strings
- Android BLE / nearby / location permissions required for scanning

## Protocol sketch

```
MeshPacket {
  id, type, from, to?, body, ttl, path[], signature
}
```

1. Sender stamps TTL (default 8) and floods neighbors  
2. Each hop: dedupe by `id` → append self to `path` → `ttl--` → rebroadcast  
3. Drop on duplicate, loop, or `ttl <= 0`  
4. Directed messages still flood (no global topology), Briar-like

## Scripts

```bash
npm start          # Expo dev server
npm run android
npm run ios
npm run web
npm run typecheck
npm run verify     # gossip protocol smoke check
```

## Notes

- Demo signing uses SHA-256 digests (Expo Go friendly). Swap in real asymmetric crypto (e.g. libsodium) for production.
- This is a foundation for a Briar-like app, not a drop-in Briar clone (no Tor, no full social identity model).
