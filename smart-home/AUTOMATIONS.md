# Automations implemented in HomePulse

All rules live in `services/rules-engine` and act on normalized `DeviceEvent`s.
Device commands are executed by `mqtt-commander` over Mosquitto.

## Doorbell

| Automation | Trigger | Actions |
|------------|---------|---------|
| Ring / ESP → Google phone | `doorbell.ring` | FCM push (`notify.push`) |
| Ring / ESP → Google Home speakers | `doorbell.ring` | Cast TTS announce on all `google_home` devices (`notify.google_home`) |
| Porch light for N minutes | `doorbell.ring` | `device.light_on` → MQTT → auto `device.light_off` after `PORCH_LIGHT_MINUTES` |
| Frigate snapshot on ding | `doorbell.ring` | Attach `FRIGATE_BASE_URL/api/<camera>/latest.jpg` (or event snapshot) to the push |
| Away louder alert + siren | `doorbell.ring` while `mode=away` | Critical FCM channel + `device.siren_on` for `SIREN_SECONDS` |

**Sources**
- Ring webhook / simulate API (`ring-ingest`)
- ESPHome MQTT: `homepulse/<home>/doorbell/<external_id>/state` = `ring` (`mqtt-ingest`)

## Security

| Automation | Trigger | Actions |
|------------|---------|---------|
| Armed contact open | `sensor.open` while `armed=true` | Critical push + siren |
| Lock left unlocked after sunset | Scheduler finds `entry_lock` state `unlocked` after local sunset hour | Reminder push + optional `device.lock` |
| Frigate person detection | MQTT `frigate/<camera>/events` with label `person` | Push with thumbnail + `clip_url` |

**Sources**
- Zigbee2MQTT contact: `zigbee2mqtt/<friendly_name>` with `contact` field
- Frigate MQTT events
- Scheduler (`services/scheduler`) using home timezone + `SUNSET_HOUR_LOCAL`

## Home security controls

```bash
# Away (also arms by default)
curl -X PATCH http://localhost:8080/v1/homes/$HOME_ID/security \
  -H "Authorization: Bearer $BOOTSTRAP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"away"}'

# Home / disarm
curl -X PATCH http://localhost:8080/v1/homes/$HOME_ID/security \
  -H "Authorization: Bearer $BOOTSTRAP_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"home","armed":false}'
```

## Device roles

Register devices with a `role` so rules can find them:

| Role | Used for |
|------|----------|
| `google_home` | Ding → speak on Nest / Google Home (Cast IP in external id) |
| `doorbell` | Identity only (events come from ingest) |
| `porch_light` | Ding → light on |
| `siren` | Away ding / armed sensor |
| `entry_lock` | Sunset auto-lock |
| `contact_sensor` | Armed open alerts |
| `frigate_camera` | Snapshot / clip URLs |

Each controllable device needs `mqtt_command_topic` (Zigbee2MQTT `/set`, Matter bridge, etc.).

## External OSS wiring

1. **Mosquitto** — included in Compose (`:1883`)
2. **Zigbee2MQTT / Matter MQTT bridge** — point at Mosquitto; match `external_id` / topics to registered devices
3. **ESPHome doorbell** — publish `ring` to `homepulse/demo/doorbell/<id>/state`
4. **Frigate** — enable MQTT events; set `FRIGATE_BASE_URL` and register camera `external_id`
5. **Firebase** — set `FCM_MODE=firebase` for real Google phone pushes
