#!/usr/bin/env bash
set -euo pipefail
API="${API_URL:-http://127.0.0.1:3100}"
KEY="${DEMO_API_KEY:-sh_demo_key_change_me}"

echo "Health…"
curl -sf "$API/health" >/dev/null

echo "Ring doorbell…"
RING_JSON=$(curl -sf -X POST "$API/v1/doorbell/ring" \
  -H "x-api-key: $KEY" \
  -H "content-type: application/json" \
  -d '{"actor":"smoke-test"}')
EVENT_ID=$(printf '%s' "$RING_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
echo "  event=$EVENT_ID"

sleep 1

NOTIFS=$(curl -sf "$API/v1/notifications?limit=20" -H "x-api-key: $KEY")
echo "$NOTIFS" | grep -q "$EVENT_ID"
echo "$NOTIFS" | grep -q '"channel":"console"'
echo "$NOTIFS" | grep -q '"status":"sent"'
echo "OK — doorbell event produced console notification"
