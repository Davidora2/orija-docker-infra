(() => {
  const STORE_KEY = "homepulse_join";
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
  // Instagram/FB/Messenger/Gmail in-app browsers often lack PushManager
  const isInAppBrowser =
    /\bwv\b/i.test(ua) ||
    /FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp|GSA\//i.test(ua) ||
    (/\bAndroid\b/i.test(ua) && /\bVersion\/\d+\.\d+\b/.test(ua) && /; wv\)/.test(ua));

  let inviteMeta = null;

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

  function pushBlockedMessage(cap) {
    const httpsBase = publicHttpsOrigin();
    const code = ($("invite-code").value || codeFromUrl || "").trim().toUpperCase();
    const httpsJoin = `${httpsBase}/join/${code ? `?code=${encodeURIComponent(code)}` : ""}`;

    if (!cap.secure) {
      return (
        `Alerts need a secure link (https). On Android open Chrome and go to:\n${httpsJoin}\n` +
        `Do not use the local IP (http://192.168...).`
      );
    }
    if (isInAppBrowser || (!cap.sw || !cap.push)) {
      if (isAndroid) {
        return (
          "This app browser cannot receive alerts. On Android: open the invite in Chrome " +
          "(⋯ menu → Open in Chrome), then tap Enable alerts. " +
          `Direct link: ${httpsJoin}`
        );
      }
      if (isIos) {
        return "On iPhone use Safari, then Add to Home Screen, open the HomePulse icon, and Enable alerts.";
      }
      return `This browser cannot receive alerts. Open ${httpsJoin} in Chrome or Edge.`;
    }
    if (!cap.notif) {
      return "Notifications are blocked or unavailable in this browser. Check Android Settings → Apps → Chrome → Notifications.";
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
    if (id === "step-android") updateAndroidHints();
  }

  function updateAndroidHints() {
    const hint = $("android-hint");
    if (!hint) return;
    const cap = pushCapability();
    const httpsBase = publicHttpsOrigin();
    if (!cap.secure) {
      hint.textContent =
        `Open this page in Chrome using ${httpsBase} (not a local http:// address), then tap Enable alerts.`;
      return;
    }
    if (isInAppBrowser || !cap.ok) {
      hint.textContent =
        "If Enable alerts fails: tap ⋯ → Open in Chrome (not Instagram, Messages, or Facebook).";
      return;
    }
    hint.textContent = "Chrome on Android works here — tap Enable alerts and choose Allow.";
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
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

    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      throw new Error(
        isAndroid
          ? "Please tap Allow. If you don’t see a prompt: Android Settings → Apps → Chrome → Notifications → On."
          : "Please tap Allow so this phone can get doorbell alerts."
      );
    }

    const reg = await navigator.serviceWorker.register("/join/sw.js", { scope: "/join/" });
    await navigator.serviceWorker.ready;

    let vapid = inviteMeta?.vapid_public_key;
    if (!vapid) {
      const vk = await fetch("/v1/public/vapid-key").then((r) => r.json());
      vapid = vk.publicKey;
    }
    if (!vapid) throw new Error("Alerts are not configured on the server yet.");

    let sub;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
    } catch (e) {
      const msg = (e && e.message) || String(e);
      throw new Error(
        isAndroid
          ? `Could not enable Chrome push (${msg}). Use Chrome on https://homepulse.orija.store — not a local IP or in-app browser.`
          : `Could not enable alerts: ${msg}`
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
    saveStore({ joined: true, home_name: data.home_name });
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
    try {
      await enableAlerts();
    } catch (e) {
      showErr(e.message || String(e));
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
      })
      .catch((e) => showErr(e.message || String(e)));
  }
})();
