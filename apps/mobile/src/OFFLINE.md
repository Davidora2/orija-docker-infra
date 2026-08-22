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
 * Sync runs quietly in the background (outbox flush + phase tracking stay
 * intact). There is no offline toast, modal, banner, or top-bar Offline label —
 * connectivity and queued mutations stay invisible to the user while still
 * flushing on reconnect. No Syncing / Synced flashes either.
 */
export {};
