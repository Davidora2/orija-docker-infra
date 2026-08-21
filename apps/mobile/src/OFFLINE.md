/**
 * Offline sync for Life OS mobile — conflict policy and behavior.
 *
 * ## Conflict policy: last-write-wins (client outbox)
 *
 * While offline, mutating life-item writes (`create` / `update` / `delete`) are
 * queued FIFO in AsyncStorage (`life-os-outbox`). When connectivity returns,
 * the outbox flushes in order. Each successful server write is authoritative —
 * there is no server-side merge or CRDT. If two clients edit the same item
 * offline, the last flush to reach the server wins.
 *
 * ## Session
 *
 * Access + refresh tokens stay in AsyncStorage across app restarts. If token
 * refresh fails because the network is down (timeout / failed fetch), the app
 * keeps the local session and serves cached account + items. Session is only
 * cleared on a true `401` auth rejection from the server.
 *
 * ## Cache
 *
 * Successful reads persist:
 * - account (`life-os-cache-account`)
 * - life items (`life-os-cache-items`)
 * - last calendar payload (`life-os-cache-calendar`)
 * - budget list (`life-os-cache-budgets`)
 *
 * ## UI feedback
 *
 * Top bar shows Online / Offline / Syncing… / Synced. Pending outbox count is
 * available via sync meta for future badges.
 */
export {};
