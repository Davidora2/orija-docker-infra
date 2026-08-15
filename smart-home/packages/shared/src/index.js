/**
 * Shared contracts for the smart-home event bus.
 * All device bridges and actuators speak these topics + payloads.
 */

export const TOPICS = {
  /** Device events: home/{homeId}/device/{deviceId}/event/{type} */
  deviceEvent: (homeId, deviceId, type) =>
    `home/${homeId}/device/${deviceId}/event/${type}`,
  /** Command channel for actuators */
  deviceCommand: (homeId, deviceId) =>
    `home/${homeId}/device/${deviceId}/command`,
  /** Notification requests from rules engine */
  notifyRequest: (homeId) => `home/${homeId}/notify/request`,
  /** Notification delivery results */
  notifyResult: (homeId) => `home/${homeId}/notify/result`,
  /** System / health */
  systemHealth: 'system/health',
  /** Wildcard subscriptions */
  allDeviceEvents: (homeId) => `home/${homeId}/device/+/event/+`,
  allHomesDeviceEvents: 'home/+/device/+/event/+',
};

export const EVENT_TYPES = {
  DOORBELL_RUNG: 'doorbell.rung',
  MOTION_DETECTED: 'motion.detected',
  DEVICE_ONLINE: 'device.online',
  DEVICE_OFFLINE: 'device.offline',
};

export const NOTIFY_CHANNELS = {
  FCM: 'fcm',
  GOOGLE_HOME_BROADCAST: 'google_home_broadcast',
  WEBHOOK: 'webhook',
  CONSOLE: 'console',
};

/**
 * @typedef {object} SmartHomeEvent
 * @property {string} id - UUID
 * @property {string} homeId
 * @property {string} deviceId
 * @property {string} deviceType - e.g. doorbell, camera, lock
 * @property {string} type - EVENT_TYPES.*
 * @property {string} source - ring, mock, nest, ...
 * @property {string} occurredAt - ISO8601
 * @property {Record<string, unknown>} [payload]
 * @property {Record<string, string>} [labels]
 */

/**
 * @typedef {object} NotifyRequest
 * @property {string} id
 * @property {string} homeId
 * @property {string} correlationId - originating event id
 * @property {string[]} channels
 * @property {string} title
 * @property {string} body
 * @property {Record<string, string>} [data]
 * @property {string} createdAt
 */

export function createEvent(partial) {
  return {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: {},
    labels: {},
    ...partial,
  };
}

export function createNotifyRequest(partial) {
  return {
    id: crypto.randomUUID(),
    channels: [NOTIFY_CHANNELS.FCM, NOTIFY_CHANNELS.CONSOLE],
    data: {},
    createdAt: new Date().toISOString(),
    ...partial,
  };
}
