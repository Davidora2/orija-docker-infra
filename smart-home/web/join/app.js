(() => {
  const STORE_KEY = "homepulse_join";
  const ASSET_VER = "20260815c";
  const params = new URLSearchParams(location.search);
  const codeFromUrl = (params.get("code") || "").toUpperCase();
  const $ = (id) => document.getElementById(id);

  const ua = navigator.userAgent || "";
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isInAppBrowser =
    /; wv\)/i.test(ua) ||
    /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|GSA\//i.test(ua);

  let inviteMeta = null;
  let swRegPromise = null;

  function publicHttpsOrigin() {
    const fromMeta = (inviteMeta && inviteMeta.public_base_url) || "";
    if (fromMeta) return fromMeta.replace(/\/$/, "");
    if (location.protocol === "https:") return location.origin;
    return "https://homepulse.orija.store";
  }

  function pushCapability() {
    const secure = window.isSecureContext === true;
    const sw = "serviceWorker" in navigator;
    const push =
      "PushManager" in window ||
      (typeof ServiceWorkerRegistration !== "undefined" &&
        "pushManager" in ServiceWorkerRegistration.prototype);
    const notif = "Notification" in window;
    return { secure, sw, push, notif, ok: secure && sw && push && notif };
  }

  function notificationState() {
    try {
      return Notification.permission; // "granted" | "denied" | "default"
    } catch {
      return "unknown";
    }
  }

  function deniedPermissionMessage() {
    const host = location.hostname || "homepulse.orija.store";
    return (
      `Chrome blocked notifications for this site (permission=${notificationState()}).\n\n` +
      `Fix on Android:\n` +
      `1) Tap the lock / tune icon left of the address bar\n` +
      `2) Permissions → Notifications → Allow\n` +
      `3) Or Chrome ⋮ → Settings → Site settings → ${host} → Notifications → Allow\n` +
      `4) Reload this page, then tap Enable alerts again`
    );
  }

  function pushBlockedMessage(cap) {
    const httpsBase = publicHttpsOrigin();
    const code = ($("invite-code").value || codeFromUrl || "").trim().toUpperCase();
    const httpsJoin = `${httpsBase}/join/${code ? `?code=${encodeURIComponent(code)}` : ""}`;

    if (!cap.secure) {
      return (
        `Alerts need https. Open Chrome and go to:\n${httpsJoin}\n` +
        `Do not use a local http://192.168... address.`
      );
    }
    if (isInAppBrowser || !cap.sw || !cap.push) {
      if (isAndroid || !isIos) {
        return (
          "This browser cannot receive alerts. Open the invite in Chrome " +
          `(⋮ → Open in Chrome).\n${httpsJoin}`
        );
      }
      return "On iPhone use Safari, Add to Home Screen, open the HomePulse icon, then Enable alerts.";
    }
    if (!cap.notif) {
      return "Notifications are unavailable. Android Settings → Apps → Chrome → Notifications → On.";
    }
    return "This browser cannot receive alerts.";
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveStore(patch) {
    const next = { ...loadStore(), ...patch };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  }

  function showErr(msg) {
    const el = $("err");
    el.hidden = !msg;
    el.textContent = msg || "";
  }

  function show(id) {
    ["step-name", "step-ios", "step-android", "step-done"].forEach((s) => {
      $(s).hidden = s !== id;
    });
    if (id === "step-android") {
      updateAndroidHints();
      ensureServiceWorker();
    }
  }

  function updateAndroidHints() {
    const hint = $("android-hint");
    if (!hint) return;
    const cap = pushCapability();
    const perm = notificationState();
    if (!cap.secure) {
      hint.textContent = `Open ${publicHttpsOrigin()} in Chrome (https), not a local IP.`;
      return;
    }
    if (perm === "denied") {
      hint.textContent =
        "Notifications are blocked for this site. Tap the lock icon → Notifications → Allow, then reload.";
      return;
    }
    if (isInAppBrowser || !cap.ok) {
      hint.textContent = "Use Chrome (⋮ → Open in Chrome), not Messages / Instagram / Facebook.";
      return;
    }
    hint.textContent =
      perm === "granted"
        ? "Notifications already allowed — tap Enable alerts to finish."
        : "Tap Enable alerts, then tap Allow on the Chrome prompt.";
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    if (!swRegPromise) {
      swRegPromise = navigator.serviceWorker
        .register(`/join/sw.js?v=${ASSET_VER}`, { scope: "/join/" })
        .catch((err) => {
          swRegPromise = null;
          throw err;
        });
    }
    return swRegPromise;
  }

  async function loadInvite(code) {
    const res = await fetch(`/v1/public/invites/${encodeURIComponent(code)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Invite not found");
    inviteMeta = data;
    $("home-line").textContent = `Join “${data.home_name}” alerts on this phone — no App Store.`;
    return data;
  }

  async function enableAlerts() {
    showErr("");
    const name = $("display-name").value.trim();
    const code = $("invite-code").value.trim().toUpperCase();
    if (!name) throw new Error("Enter your first name");
    if (!code) throw new Error("Enter the invite code");
    saveStore({ name, code });

    const cap = pushCapability();
    if (!cap.ok) {
      throw new Error(pushBlockedMessage(cap));
    }

    if (isIos && !isStandalone) {
      show("step-ios");
      $("ios-status").textContent =
        "Still in Safari — Add to Home Screen, then open the HomePulse icon.";
      throw new Error("On iPhone, add HomePulse to your Home Screen first, then tap Enable alerts.");
    }

    // Already blocked from a previous Deny — Chrome will not show the prompt again.
    if (notificationState() === "denied") {
      updateAndroidHints();
      throw new Error(deniedPermissionMessage());
    }

    // Register SW before asking — more reliable on Android Chrome.
    let reg;
    try {
      reg = await ensureServiceWorker();
      await navigator.serviceWorker.ready;
      if (!reg) reg = await navigator.serviceWorker.ready;
    } catch (e) {
      throw new Error(`Could not start alerts service (${(e && e.message) || e}). Reload and retry in Chrome.`);
    }

    let perm = notificationState();
    if (perm !== "granted") {
      try {
        perm = await Notification.requestPermission();
      } catch (e) {
        throw new Error(`Could not ask for notification permission: ${(e && e.message) || e}`);
      }
    }
    if (perm !== "granted") {
      updateAndroidHints();
      if (perm === "denied") throw new Error(deniedPermissionMessage());
      throw new Error(
        "No Allow tap detected. When Chrome asks “homepulse.orija.store wants to show notifications”, tap Allow — not Block / X."
      );
    }

    let vapid = inviteMeta?.vapid_public_key;
    if (!vapid) {
      const vk = await fetch("/v1/public/vapid-key").then((r) => r.json());
      vapid = vk.publicKey;
    }
    if (!vapid) throw new Error("Alerts are not configured on the server yet.");

    // Drop a stale subscription if present, then create a fresh one.
    try {
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
    } catch (_) {
      /* ignore */
    }

    let sub;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    } catch (e) {
      const msg = (e && e.message) || String(e);
      throw new Error(
        `Could not subscribe for push (${msg}). Confirm Chrome notifications are Allowed for this site, then retry.`
      );
    }

    const res = await fetch("/v1/public/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        display_name: name,
        platform: "web",
        push_subscription: JSON.stringify(sub),
        label: `${name}'s phone`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not join home");
    saveStore({ joined: true, home_name: data.home_name, asset_ver: ASSET_VER });
    if (data.member_session_token) {
      try {
        localStorage.setItem("homepulse_member_session", data.member_session_token);
      } catch (_) {}
      const open = $("open-app");
      if (open) open.href = data.app_path || `/app/?token=${encodeURIComponent(data.member_session_token)}`;
    }
    $("done-msg").textContent = data.message || "This phone will get doorbell alerts.";
    show("step-done");
  }

  $("btn-continue").addEventListener("click", async () => {
    showErr("");
    try {
      const code = $("invite-code").value.trim().toUpperCase();
      const name = $("display-name").value.trim();
      if (!name) throw new Error("Enter your first name");
      if (!code) throw new Error("Enter the invite code");
      saveStore({ name, code });
      await loadInvite(code);
      if (isIos && !isStandalone) show("step-ios");
      else show("step-android");
    } catch (e) {
      showErr(e.message || String(e));
    }
  });

  $("btn-enable-ios").addEventListener("click", async () => {
    try {
      await enableAlerts();
    } catch (e) {
      showErr(e.message || String(e));
    }
  });
  $("btn-enable-android").addEventListener("click", async () => {
    const btn = $("btn-enable-android");
    btn.disabled = true;
    btn.textContent = "Working…";
    try {
      await enableAlerts();
    } catch (e) {
      showErr(e.message || String(e));
    } finally {
      btn.disabled = false;
      btn.textContent = "Enable alerts";
    }
  });

  const stored = loadStore();
  if (codeFromUrl) $("invite-code").value = codeFromUrl;
  else if (stored.code) $("invite-code").value = stored.code;
  if (stored.name) $("display-name").value = stored.name;

  const code = ($("invite-code").value || "").trim().toUpperCase();
  if (code) {
    loadInvite(code)
      .then(() => {
        if (stored.joined) {
          $("done-msg").textContent = stored.home_name
            ? `You will get alerts for ${stored.home_name} on this phone.`
            : "This phone will get doorbell alerts.";
          show("step-done");
          return;
        }
        if (isIos && !isStandalone && stored.name) show("step-ios");
        else if (isIos && isStandalone && stored.name) show("step-ios");
        else if (!isIos && stored.name) show("step-android");
      })
      .catch((e) => showErr(e.message || String(e)));
  }
})();
