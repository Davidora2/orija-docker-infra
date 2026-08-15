# Firebase / Google phone push (HomePulse)

Client app package: `home.pulse`  
Firebase project: `home-pulse-99808`

## What each file is for

| File | Used by | Purpose |
|------|---------|---------|
| `google-services.json` | Android app only | App talks to Firebase |
| Firebase **service account** JSON | HomePulse `notifier` (server) | Server sends FCM pushes |

`google-services.json` alone cannot enable server pushes.

## 1) Android app

1. Put `google-services.json` in the Android app.
2. On launch, log/copy the FCM registration token.
3. In HomePulse admin → **Phone push tokens** → Add token:
   - Owner email = home owner email
   - Token = FCM device token
   - Platform = `android`

## 2) Server (Portainer)

1. Firebase Console → Project settings → **Service accounts** → **Generate new private key**.
2. Save as `firebase-service-account.json` (keep private).
3. Copy it into the `homepulse_homepulse-secrets` Docker volume as:
   `/secrets/firebase-service-account.json`
4. Stack env:

```text
FCM_MODE=firebase
FCM_PROJECT_ID=home-pulse-99808
GOOGLE_APPLICATION_CREDENTIALS=/secrets/firebase-service-account.json
```

5. Redeploy/restart `homepulse-notifier-1`.

## 3) Test

Admin → Mint API key (if needed) → **Simulate ding** → phone should receive a push.

If `FCM_MODE=dry_run`, notifier only logs the payload.
