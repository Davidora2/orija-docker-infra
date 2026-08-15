#!/bin/sh
set -eu
# Generate Mosquitto password file from env at broker start.
USER="${MQTT_USERNAME:-smarthome}"
PASS="${MQTT_PASSWORD:-smarthome}"
PASSWD_FILE=/mosquitto/data/passwd

mkdir -p /mosquitto/data
if [ ! -f "$PASSWD_FILE" ]; then
  mosquitto_passwd -b -c "$PASSWD_FILE" "$USER" "$PASS"
  echo "[mosquitto-init] created password for user $USER"
else
  mosquitto_passwd -b "$PASSWD_FILE" "$USER" "$PASS"
  echo "[mosquitto-init] updated password for user $USER"
fi

exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
