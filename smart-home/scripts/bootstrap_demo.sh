#!/usr/bin/env bash
# Bootstrap a demo home, Ring doorbell, and FCM token, then optionally simulate a ding.
set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:8080}"
ADMIN_TOKEN="${BOOTSTRAP_ADMIN_TOKEN:-bootstrap-dev-token}"
OWNER_EMAIL="${OWNER_EMAIL:-you@example.com}"
RING_EXTERNAL_ID="${RING_EXTERNAL_ID:-ring-front-door-001}"
FCM_TOKEN="${FCM_TOKEN:-demo-fcm-token-android-phone}"

echo "==> Creating home"
CREATE=$(curl -fsS -X POST "$GATEWAY/v1/homes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Demo Home\",\"timezone\":\"America/Los_Angeles\",\"owner_email\":\"$OWNER_EMAIL\",\"owner_name\":\"Demo Owner\"}")

echo "$CREATE" | tee /tmp/homepulse-bootstrap.json
HOME_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["home_id"])' <<<"$CREATE")
API_KEY=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["api_key"])' <<<"$CREATE")

echo "==> Registering Ring doorbell ($RING_EXTERNAL_ID)"
DEVICE=$(curl -fsS -X POST "$GATEWAY/v1/homes/$HOME_ID/devices" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Front Door\",\"device_type\":\"doorbell\",\"vendor\":\"ring\",\"external_id\":\"$RING_EXTERNAL_ID\",\"location_label\":\"Front Door\"}")
echo "$DEVICE"

echo "==> Registering Google phone FCM token"
curl -fsS -X POST "$GATEWAY/v1/push-tokens" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"user_email\":\"$OWNER_EMAIL\",\"token\":\"$FCM_TOKEN\",\"platform\":\"android\",\"label\":\"Pixel\"}"
echo

if [[ "${SIMULATE:-1}" == "1" ]]; then
  echo "==> Simulating Ring ding"
  RESULT=$(curl -fsS -X POST "$GATEWAY/v1/simulate/ring" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"external_device_id\":\"$RING_EXTERNAL_ID\",\"event\":\"ding\"}")
  echo "$RESULT"
fi

echo
echo "HOME_ID=$HOME_ID"
echo "API_KEY=$API_KEY"
echo "Saved API key material under /tmp/homepulse-bootstrap.json"
echo "Watch notifier logs: docker compose logs -f notifier"
