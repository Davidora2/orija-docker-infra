(() => {
  const STORE_KEY = "homepulse_join";
  const params = new URLSearchParams(location.search);
  const codeFromUrl = (params.get("code") || "").toUpperCase();
  const $ = (id) => document.getElementById(id);

  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  let inviteMeta = null;

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

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error(
        "This browser cannot receive alerts. On iPhone use Safari, then Add to Home Screen."
      );
    }

    if (isIos && !isStandalone) {
      show("step-ios");
      $("ios-status").textContent =
        "Still in Safari — Add to Home Screen, then open the HomePulse icon.";
      throw new Error("On iPhone, add HomePulse to your Home Screen first, then tap Enable alerts.");
    }

    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      throw new Error("Please tap Allow so this phone can get doorbell alerts.");
    }

    const reg = await navigator.serviceWorker.register("/join/sw.js", { scope: "/join/" });
    await navigator.serviceWorker.ready;

    let vapid = inviteMeta?.vapid_public_key;
    if (!vapid) {
      const vk = await fetch("/v1/public/vapid-key").then((r) => r.json());
      vapid = vk.publicKey;
    }
    if (!vapid) throw new Error("Alerts are not configured on the server yet.");

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });

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
