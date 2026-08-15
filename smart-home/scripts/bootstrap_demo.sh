#!/usr/bin/env bash
# Bootstrap a demo home with doorbell, porch light, siren, lock, sensor, Frigate camera.
set -euo pipefail

GATEWAY="${GATEWAY:-http://localhost:8080}"
ADMIN_TOKEN="${BOOTSTRAP_ADMIN_TOKEN:-bootstrap-dev-token}"
OWNER_EMAIL="${OWNER_EMAIL:-you@example.com}"
RING_EXTERNAL_ID="${RING_EXTERNAL_ID:-ring-front-door-001}"
ESP_EXTERNAL_ID="${ESP_EXTERNAL_ID:-esp-doorbell-1}"
FCM_TOKEN="${FCM_TOKEN:-demo-fcm-token-android-phone}"
MODE="${MODE:-home}"  # home | away
ARMED=false
if [[ "$MODE" == "away" ]]; then
  ARMED=true
fi

echo "==> Creating home (mode=$MODE armed=$ARMED)"
CREATE=$(curl -fsS -X POST "$GATEWAY/v1/homes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Demo Home\",\"timezone\":\"America/Los_Angeles\",\"owner_email\":\"$OWNER_EMAIL\",\"owner_name\":\"Demo Owner\",\"mode\":\"$MODE\",\"armed\":$ARMED}")

echo "$CREATE" | tee /tmp/homepulse-bootstrap.json
HOME_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["home_id"])' <<<"$CREATE")
API_KEY=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["api_key"])' <<<"$CREATE")

register_device() {
  local payload="$1"
  curl -fsS -X POST "$GATEWAY/v1/homes/$HOME_ID/devices" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload"
  echo
}

echo "==> Registering Ring doorbell"
register_device "{\"name\":\"Front Door Ring\",\"device_type\":\"doorbell\",\"role\":\"doorbell\",\"vendor\":\"ring\",\"external_id\":\"$RING_EXTERNAL_ID\",\"location_label\":\"Front Door\"}"

echo "==> Registering ESP doorbell"
register_device "{\"name\":\"ESP Doorbell\",\"device_type\":\"doorbell\",\"role\":\"doorbell\",\"vendor\":\"esphome\",\"external_id\":\"$ESP_EXTERNAL_ID\",\"location_label\":\"Side Door\",\"mqtt_state_topic\":\"homepulse/demo/doorbell/$ESP_EXTERNAL_ID/state\"}"

echo "==> Registering porch light (Zigbee/MQTT)"
register_device "{\"name\":\"Porch Light\",\"device_type\":\"light\",\"role\":\"porch_light\",\"vendor\":\"zigbee2mqtt\",\"external_id\":\"porch_light\",\"mqtt_command_topic\":\"zigbee2mqtt/porch_light/set\",\"mqtt_state_topic\":\"zigbee2mqtt/porch_light\",\"state\":\"off\"}"

echo "==> Registering siren/chime"
register_device "{\"name\":\"Entry Siren\",\"device_type\":\"siren\",\"role\":\"siren\",\"vendor\":\"mqtt\",\"external_id\":\"entry_siren\",\"mqtt_command_topic\":\"homepulse/demo/siren/entry_siren/set\",\"state\":\"off\"}"

echo "==> Registering entry lock"
register_device "{\"name\":\"Front Lock\",\"device_type\":\"lock\",\"role\":\"entry_lock\",\"vendor\":\"zigbee2mqtt\",\"external_id\":\"front_lock\",\"mqtt_command_topic\":\"zigbee2mqtt/front_lock/set\",\"mqtt_state_topic\":\"zigbee2mqtt/front_lock\",\"state\":\"unlocked\"}"

echo "==> Registering door contact sensor"
register_device "{\"name\":\"Front Door Sensor\",\"device_type\":\"contact_sensor\",\"role\":\"contact_sensor\",\"vendor\":\"zigbee2mqtt\",\"external_id\":\"front_door_sensor\",\"mqtt_state_topic\":\"zigbee2mqtt/front_door_sensor\",\"state\":\"closed\"}"

echo "==> Registering Frigate camera"
register_device "{\"name\":\"Front Camera\",\"device_type\":\"camera\",\"role\":\"frigate_camera\",\"vendor\":\"frigate\",\"external_id\":\"front\",\"location_label\":\"Front\",\"meta\":{\"frigate_camera\":\"front\",\"frigate_base_url\":\"${FRIGATE_BASE_URL:-http://frigate:5000}\"}}"

echo "==> Registering Google phone FCM token"
curl -fsS -X POST "$GATEWAY/v1/push-tokens" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"user_email\":\"$OWNER_EMAIL\",\"token\":\"$FCM_TOKEN\",\"platform\":\"android\",\"label\":\"Pixel\"}"
echo

if [[ "${SIMULATE:-1}" == "1" ]]; then
  echo "==> Simulating Ring ding"
  curl -fsS -X POST "$GATEWAY/v1/simulate/ring" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"external_device_id\":\"$RING_EXTERNAL_ID\",\"event\":\"ding\"}"
  echo
fi

echo
echo "HOME_ID=$HOME_ID"
echo "API_KEY=$API_KEY"
echo "MODE=$MODE"
echo "Saved bootstrap JSON at /tmp/homepulse-bootstrap.json"
echo
echo "Try:"
echo "  curl -X PATCH $GATEWAY/v1/homes/$HOME_ID/security -H 'Authorization: Bearer $ADMIN_TOKEN' -H 'Content-Type: application/json' -d '{\"mode\":\"away\"}'"
echo "  curl -X POST $GATEWAY/v1/simulate/ring -H 'X-API-Key: $API_KEY' -H 'Content-Type: application/json' -d '{\"external_device_id\":\"$RING_EXTERNAL_ID\",\"event\":\"ding\"}'"
echo "  docker compose logs -f notifier mqtt-commander rules-engine"
