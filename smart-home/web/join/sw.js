/* HomePulse join service worker — web push receiver */
self.addEventListener("push", (event) => {
  let data = { title: "HomePulse", body: "Someone is at the door" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    try {
      data.body = event.data.text();
    } catch (_) {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "HomePulse", {
      body: data.body || "Doorbell alert",
      icon: "/join/icons/icon-192.png",
      badge: "/join/icons/icon-192.png",
      data: data.data || {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/join/"));
});
