(() => {
  const TOKEN_KEY = "homepulse_admin_session";
  const API_KEYS = "homepulse_home_api_keys";

  function $(id) {
    return document.getElementById(id);
  }

  function storageGet(key) {
    try {
      return sessionStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function storageSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  function storageDel(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }

  function localGet(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || fallback);
    } catch {
      return JSON.parse(fallback);
    }
  }

  function localSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  const gate = $("gate");
  const app = $("app");
  const loginBtn = $("login-btn");
  const loginError = $("login-error");

  let state = {
    token: storageGet(TOKEN_KEY),
    homes: [],
    selectedId: null,
    home: null,
    tokens: [],
    invites: [],
    setupRequired: false,
  };

  function apiKeysMap() {
    return localGet(API_KEYS, "{}");
  }

  function saveApiKey(homeId, key) {
    const map = apiKeysMap();
    map[homeId] = key;
    localSet(API_KEYS, map);
  }

  function setVisible(el, visible) {
    if (!el) return;
    el.hidden = !visible;
    el.style.display = visible ? "" : "none";
  }

  function note(el, text, show = true) {
    if (!el) return;
    el.textContent = text || "";
    setVisible(el, show && Boolean(text));
  }

  function showLoginError(msg) {
    note(loginError, msg, Boolean(msg));
    if (msg) loginError.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function showAuthPanel(name) {
    setVisible($("panel-setup"), name === "setup");
    setVisible($("panel-login"), name === "login");
    setVisible($("panel-recover"), name === "recover");
  }

  async function api(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = { ...(options.headers || {}) };
    if (method !== "GET" && method !== "HEAD" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (state.token && !headers.Authorization && !headers["X-API-Key"]) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res;
    try {
      res = await fetch(path, { ...options, headers, signal: controller.signal });
    } catch (err) {
      const why = err.name === "AbortError" ? "timed out after 20s" : err.message;
      throw new Error(`Network error (${why}). Use http://192.168.2.200:18091/admin/`);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      let msg = data && data.detail != null ? data.detail : data && data.message;
      if (Array.isArray(msg)) msg = msg.map((m) => m.msg || JSON.stringify(m)).join("; ");
      if (!msg) msg = text || `${res.status} ${res.statusText}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  function showApp() {
    setVisible(gate, false);
    setVisible(app, true);
  }

  function showGate(err) {
    setVisible(app, false);
    setVisible(gate, true);
    showLoginError(err || "");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderHomes() {
    const list = $("home-list");
    list.innerHTML = "";
    if (!state.homes.length) {
      list.innerHTML = `<li class="muted" style="padding:0.5rem">No homes yet</li>`;
      return;
    }
    for (const h of state.homes) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = h.home_id === state.selectedId ? "active" : "";
      btn.innerHTML = `<strong>${escapeHtml(h.name)}</strong><span class="sub">${escapeHtml(h.mode)}${h.armed ? " · armed" : ""} · ${h.device_count || 0} devices</span>`;
      btn.addEventListener("click", () => selectHome(h.home_id));
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  function renderDevices() {
    const wrap = $("device-table");
    const devices = state.home?.devices || [];
    if (!devices.length) {
      wrap.innerHTML = `<p class="muted">No devices yet. Add a Blink/Ring doorbell to start.</p>`;
      return;
    }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Vendor</th><th>External ID</th><th>State</th></tr></thead>
        <tbody>
          ${devices
            .map(
              (d) => `<tr>
              <td>${escapeHtml(d.name)}<div class="muted">${escapeHtml(d.device_type)}</div></td>
              <td><span class="pill">${escapeHtml(d.role || "—")}</span></td>
              <td>${escapeHtml(d.vendor)}</td>
              <td>${escapeHtml(d.external_id || "—")}</td>
              <td>${escapeHtml(d.state || "—")}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function renderInvites() {
    const wrap = $("invite-list");
    if (!wrap) return;
    const invites = state.invites || [];
    if (!invites.length) {
      wrap.innerHTML = `<p class="muted">No active invites yet. Create a link and text it to family.</p>`;
      return;
    }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Code</th><th>Label</th><th>Expires</th><th>Link</th></tr></thead>
        <tbody>
          ${invites
            .map((i) => {
              const path = i.join_path || `/join/?code=${encodeURIComponent(i.code)}`;
              const url = `${location.origin}${path}`;
              return `<tr>
              <td><code>${escapeHtml(i.code)}</code></td>
              <td>${escapeHtml(i.label || "—")}</td>
              <td>${escapeHtml((i.expires_at || "").slice(0, 10) || "—")}</td>
              <td><a href="${escapeHtml(url)}" target="_blank" rel="noopener">Open</a></td>
            </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  }

  function renderMembers() {
    const wrap = $("member-table");
    const members = state.home?.members || [];
    const datalist = $("member-emails");
    if (datalist) {
      datalist.innerHTML = members
        .map((m) => `<option value="${escapeHtml(m.email || "")}"></option>`)
        .join("");
    }
    if (!members.length) {
      wrap.innerHTML = `<p class="muted">No members yet — send an invite link.</p>`;
      return;
    }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Phones</th></tr></thead>
        <tbody>
          ${members
            .map(
              (m) => `<tr>
              <td>${escapeHtml(m.display_name || "—")}</td>
              <td>${escapeHtml(m.email || "—")}</td>
              <td><span class="pill">${escapeHtml(m.role || "member")}</span></td>
              <td>${escapeHtml(String(m.push_token_count ?? 0))}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function renderTokens() {
    const wrap = $("token-table");
    const tokens = state.tokens || [];
    if (!tokens.length) {
      wrap.innerHTML = `<p class="muted">No phones registered yet. Add each Android/iPhone FCM token for members above.</p>`;
      return;
    }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Label</th><th>Email</th><th>Platform</th><th>Token</th></tr></thead>
        <tbody>
          ${tokens
            .map(
              (t) => `<tr>
              <td>${escapeHtml(t.label || "—")}</td>
              <td>${escapeHtml(t.email || "—")}</td>
              <td><span class="pill warn">${escapeHtml(t.platform)}</span></td>
              <td>${escapeHtml(t.token_preview)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;
  }

  function renderHomeDetail() {
    const empty = $("empty-home");
    const detail = $("home-detail");
    if (!state.home) {
      setVisible(empty, true);
      setVisible(detail, false);
      return;
    }
    setVisible(empty, false);
    setVisible(detail, true);
    $("home-title").textContent = state.home.name;
    $("home-meta").textContent = `${state.home.timezone} · ${state.home.home_id}`;
    $("mode-away").checked = state.home.mode === "away";
    $("armed").checked = Boolean(state.home.armed);
    $("home-api-key").value = apiKeysMap()[state.home.home_id] || "";
    renderDevices();
    renderInvites();
    renderMembers();
    renderTokens();
  }

  async function loadHomes() {
    const data = await api("/v1/homes");
    state.homes = data.homes || [];
    renderHomes();
    if (state.selectedId) {
      const still = state.homes.find((h) => h.home_id === state.selectedId);
      if (still) await selectHome(state.selectedId);
      else {
        state.selectedId = null;
        state.home = null;
        renderHomeDetail();
      }
    }
  }

  async function selectHome(homeId) {
    state.selectedId = homeId;
    renderHomes();
    const [home, tokens, invites] = await Promise.all([
      api(`/v1/homes/${homeId}`),
      api(`/v1/homes/${homeId}/push-tokens`),
      api(`/v1/homes/${homeId}/invites`).catch(() => ({ invites: [] })),
    ]);
    state.home = home;
    state.tokens = tokens.tokens || [];
    state.invites = invites.invites || [];
    renderHomeDetail();
  }

  function acceptSession(data) {
    state.token = data.session_token;
    storageSet(TOKEN_KEY, data.session_token);
  }

  async function enterConsole() {
    await loadHomes();
    showApp();
    showLoginError("");
    if (!state.selectedId && state.homes[0]) {
      await selectHome(state.homes[0].home_id);
    }
  }

  async function boot() {
    const status = await api("/v1/admin/auth/status");
    state.setupRequired = Boolean(status.setup_required);
    if (state.setupRequired) {
      storageDel(TOKEN_KEY);
      state.token = "";
      showGate();
      showAuthPanel("setup");
      return;
    }
    showAuthPanel("login");
    if (!state.token) {
      showGate();
      return;
    }
    try {
      showLoginError("Restoring session…");
      await enterConsole();
    } catch (err) {
      storageDel(TOKEN_KEY);
      state.token = "";
      showGate(err.message || "Session expired — sign in again");
      showAuthPanel("login");
    }
  }

  $("setup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (body.password !== body.password2) {
      showLoginError("Passwords do not match");
      return;
    }
    delete body.password2;
    const btn = $("setup-btn");
    btn.disabled = true;
    btn.textContent = "Creating…";
    showLoginError("Creating admin…");
    try {
      const data = await api("/v1/admin/auth/setup", { method: "POST", body: JSON.stringify(body) });
      acceptSession(data);
      await enterConsole();
    } catch (err) {
      showLoginError(err.message || "Setup failed");
    } finally {
      btn.disabled = false;
      btn.textContent = "Create admin";
    }
  });

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("login-username").value.trim();
    const password = $("login-password").value;
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = "Signing in…";
    }
    showLoginError("Signing in…");
    try {
      const data = await api("/v1/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      acceptSession(data);
      await enterConsole();
    } catch (err) {
      storageDel(TOKEN_KEY);
      state.token = "";
      showLoginError(err.message || "Login failed");
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign in";
      }
    }
  });

  $("recover-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (body.new_password !== body.new_password2) {
      showLoginError("New passwords do not match");
      return;
    }
    delete body.new_password2;
    const btn = $("recover-btn");
    btn.disabled = true;
    btn.textContent = "Resetting…";
    showLoginError("Resetting password…");
    try {
      const data = await api("/v1/admin/auth/recover", { method: "POST", body: JSON.stringify(body) });
      showAuthPanel("login");
      showLoginError(data.message || "Password updated — sign in");
      $("login-username").value = body.username;
    } catch (err) {
      const msg = err.message || "Recovery failed";
      showLoginError(
        /invalid recovery|403/i.test(msg)
          ? "Recovery token is wrong. Copy BOOTSTRAP_ADMIN_TOKEN exactly from Portainer → homepulse → Environment."
          : msg
      );
    } finally {
      btn.disabled = false;
      btn.textContent = "Reset password";
    }
  });

  $("btn-show-recover").addEventListener("click", () => {
    showAuthPanel("recover");
    showLoginError("");
  });
  $("btn-show-login").addEventListener("click", () => {
    showAuthPanel("login");
    showLoginError("");
  });

  $("btn-change-password").addEventListener("click", () => {
    setVisible($("password-panel"), true);
    note($("password-note"), "", false);
  });
  $("btn-cancel-password").addEventListener("click", () => {
    setVisible($("password-panel"), false);
    $("change-password-form").reset();
  });
  $("change-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (body.new_password !== body.new_password2) {
      note($("password-note"), "New passwords do not match", true);
      return;
    }
    if ((body.new_password || "").length < 8) {
      note($("password-note"), "New password must be at least 8 characters", true);
      return;
    }
    const btn = $("change-password-btn");
    btn.disabled = true;
    btn.textContent = "Updating…";
    try {
      await api("/v1/admin/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: body.current_password,
          new_password: body.new_password,
        }),
      });
      note($("password-note"), "Password updated.", true);
      e.target.reset();
      setTimeout(() => setVisible($("password-panel"), false), 1200);
    } catch (err) {
      note($("password-note"), err.message || "Could not change password", true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Update password";
    }
  });

  $("btn-logout").addEventListener("click", async () => {
    try {
      await api("/v1/admin/auth/logout", { method: "POST", body: "{}" });
    } catch {
      /* ignore */
    }
    storageDel(TOKEN_KEY);
    state = {
      token: "",
      homes: [],
      selectedId: null,
      home: null,
      tokens: [],
      invites: [],
      setupRequired: false,
    };
    showGate();
    showAuthPanel("login");
  });

  $("btn-refresh").addEventListener("click", () =>
    loadHomes().catch((e) => note($("workspace-note"), e.message))
  );

  $("btn-new-home").addEventListener("click", () => setVisible($("create-home-form"), true));
  $("btn-cancel-home").addEventListener("click", () => {
    setVisible($("create-home-form"), false);
    note($("create-home-note"), "", false);
  });

  $("create-home-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    body.armed = body.mode === "away";
    try {
      const created = await api("/v1/homes", { method: "POST", body: JSON.stringify(body) });
      if (created.api_key) {
        saveApiKey(created.home_id, created.api_key);
        note($("create-home-note"), `Created. API key (save now): ${created.api_key}`, true);
      }
      e.target.reset();
      e.target.owner_email.value = body.owner_email;
      await loadHomes();
      await selectHome(created.home_id);
    } catch (err) {
      note($("create-home-note"), err.message, true);
    }
  });

  async function patchSecurity() {
    if (!state.home) return;
    try {
      const updated = await api(`/v1/homes/${state.home.home_id}/security`, {
        method: "PATCH",
        body: JSON.stringify({
          mode: $("mode-away").checked ? "away" : "home",
          armed: $("armed").checked,
        }),
      });
      state.home.mode = updated.mode;
      state.home.armed = updated.armed;
      await loadHomes();
      note($("workspace-note"), `Security → mode=${updated.mode}, armed=${updated.armed}`, true);
    } catch (err) {
      note($("workspace-note"), err.message, true);
    }
  }
  $("mode-away").addEventListener("change", patchSecurity);
  $("armed").addEventListener("change", patchSecurity);

  $("btn-add-device").addEventListener("click", () => setVisible($("device-form"), true));
  $("btn-cancel-device").addEventListener("click", () => setVisible($("device-form"), false));

  function fillDevicePreset(preset) {
    const form = $("device-form");
    if (preset === "blink") {
      form.name.value = "Front Door Blink";
      form.device_type.value = "doorbell";
      form.role.value = "doorbell";
      form.vendor.value = "blink";
      form.external_id.value = "G8T1-TW02-3422-0BEA";
      form.location_label.value = "Front Door";
    } else if (preset === "ring") {
      form.name.value = "Front Door Ring";
      form.device_type.value = "doorbell";
      form.role.value = "doorbell";
      form.vendor.value = "ring";
      form.external_id.value = "";
      form.location_label.value = "Front Door";
    } else if (preset === "google-home") {
      form.name.value = "Google Home";
      form.device_type.value = "speaker";
      form.role.value = "google_home";
      form.vendor.value = "google_cast";
      form.external_id.value = "192.168.2.";
      form.location_label.value = "Living Room";
    } else if (preset === "camera") {
      form.name.value = "Front Camera";
      form.device_type.value = "camera";
      form.role.value = "frigate_camera";
      form.vendor.value = "frigate";
      form.external_id.value = "front";
      form.location_label.value = "Front Door";
      if (form.rtsp_url) form.rtsp_url.value = "rtsp://";
    }
    setVisible(form, true);
  }
  $("preset-blink").addEventListener("click", () => fillDevicePreset("blink"));
  $("preset-ring").addEventListener("click", () => fillDevicePreset("ring"));
  $("preset-google-home").addEventListener("click", () => fillDevicePreset("google-home"));
  $("preset-camera").addEventListener("click", () => fillDevicePreset("camera"));

  $("device-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.home) return;
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    const rtspUrl = body.rtsp_url;
    delete body.rtsp_url;
    for (const k of ["mqtt_command_topic", "mqtt_state_topic", "state", "location_label", "external_id"]) {
      if (!body[k]) delete body[k];
    }
    if (body.vendor === "blink" && body.external_id) {
      body.meta = {
        dsn: body.external_id,
        model: "BDM00200U",
        note: "Blink Video Doorbell — live ding events need a bridge (HA/MQTT/Alexa).",
      };
    }
    if (body.vendor === "google_cast" || body.role === "google_home") {
      body.meta = {
        ...(body.meta || {}),
        cast_ip: body.external_id,
        note: "Cast announcements on doorbell ring",
      };
    }
    if (body.vendor === "frigate" || body.role === "frigate_camera" || body.device_type === "camera") {
      body.meta = {
        ...(body.meta || {}),
        frigate_camera: body.external_id || "front",
        frigate_base_url: "http://frigate:5000",
        retain_days: 14,
      };
      if (rtspUrl && rtspUrl.trim() && rtspUrl.trim() !== "rtsp://") {
        body.meta.rtsp_url = rtspUrl.trim();
      }
    }
    try {
      await api(`/v1/homes/${state.home.home_id}/devices`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      e.target.reset();
      setVisible($("device-form"), false);
      await selectHome(state.home.home_id);
      note($("workspace-note"), `Device “${body.name}” added`, true);
    } catch (err) {
      note($("workspace-note"), err.message, true);
    }
  });

  $("btn-invite").addEventListener("click", async () => {
    if (!state.home) return;
    try {
      const inv = await api(`/v1/homes/${state.home.home_id}/invites`, {
        method: "POST",
        body: JSON.stringify({ label: "Family invite" }),
      });
      const path = inv.join_path || `/join/?code=${encodeURIComponent(inv.code)}`;
      const link = `${location.origin}${path}`;
      const box = $("invite-box");
      setVisible(box, true);
      box.innerHTML = `
        <h4>Share this link</h4>
        <p class="muted" style="margin:0 0 0.5rem">Works on iPhone &amp; Android — no App Store.</p>
        <p style="word-break:break-all;margin:0 0 0.75rem"><a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a></p>
        <p class="muted" style="margin:0 0 0.75rem">Code: <code>${escapeHtml(inv.code)}</code>${
          inv.expires_at ? ` · expires ${(inv.expires_at || "").slice(0, 10)}` : ""
        }</p>
        <div class="row">
          <button type="button" class="btn primary" id="btn-copy-invite">Copy link</button>
        </div>`;
      $("btn-copy-invite").onclick = async () => {
        try {
          await navigator.clipboard.writeText(link);
          note($("workspace-note"), "Invite link copied — send it to family.", true);
        } catch {
          prompt("Copy this invite link:", link);
        }
      };
      await selectHome(state.home.home_id);
      note($("workspace-note"), "Invite ready — copy and send the link.", true);
    } catch (err) {
      note($("workspace-note"), err.message, true);
    }
  });

  $("btn-add-member").addEventListener("click", () => setVisible($("member-form"), true));
  $("btn-cancel-member").addEventListener("click", () => setVisible($("member-form"), false));

  $("member-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.home) return;
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      const created = await api(`/v1/homes/${state.home.home_id}/members`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      e.target.reset();
      setVisible($("member-form"), false);
      await selectHome(state.home.home_id);
      note(
        $("workspace-note"),
        created.already_member
          ? `${created.email} was already a member`
          : `Member ${created.email} added — register their phone token next`,
        true
      );
    } catch (err) {
      note($("workspace-note"), err.message, true);
    }
  });

  $("btn-add-token").addEventListener("click", () => setVisible($("token-form"), true));
  $("btn-cancel-token").addEventListener("click", () => setVisible($("token-form"), false));

  $("token-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (!body.label) delete body.label;
    try {
      await api("/v1/push-tokens", { method: "POST", body: JSON.stringify(body) });
      e.target.reset();
      setVisible($("token-form"), false);
      if (state.home) await selectHome(state.home.home_id);
      note($("workspace-note"), "Push token registered", true);
    } catch (err) {
      note($("workspace-note"), err.message, true);
    }
  });

  $("home-api-key").addEventListener("change", () => {
    if (state.home && $("home-api-key").value.trim()) {
      saveApiKey(state.home.home_id, $("home-api-key").value.trim());
    }
  });

  $("btn-mint-key").addEventListener("click", async () => {
    if (!state.home) return;
    try {
      const created = await api(`/v1/homes/${state.home.home_id}/api-keys`, {
        method: "POST",
        body: JSON.stringify({
          name: "admin-console",
          scopes: "ingest:write,notify:read,devices:read,security:write",
        }),
      });
      $("home-api-key").value = created.api_key;
      $("home-api-key").type = "text";
      saveApiKey(state.home.home_id, created.api_key);
      note($("workspace-note"), `New API key minted. Copy it now: ${created.api_key}`, true);
    } catch (err) {
      note($("workspace-note"), err.message, true);
    }
  });

  $("btn-simulate").addEventListener("click", async () => {
    if (!state.home) return;
    const key = $("home-api-key").value.trim() || apiKeysMap()[state.home.home_id];
    if (!key) {
      note($("workspace-note"), "Paste or mint an API key first", true);
      return;
    }
    const doorbell = (state.home.devices || []).find(
      (d) => d.role === "doorbell" || d.device_type === "doorbell"
    );
    if (!doorbell?.external_id) {
      note($("workspace-note"), "Add a doorbell device with an external ID first", true);
      return;
    }
    try {
      // ring-ingest simulate currently expects ring vendor resolution; for blink use vendor-aware simulate via same API with external id
      const result = await api("/v1/simulate/ring", {
        method: "POST",
        headers: { "X-API-Key": key },
        body: JSON.stringify({
          external_device_id: doorbell.external_id,
          event: "ding",
          vendor: doorbell.vendor || "ring",
        }),
      });
      note($("workspace-note"), `Simulated ding for ${doorbell.name}: ${JSON.stringify(result)}`, true);
    } catch (err) {
      note($("workspace-note"), err.message, true);
    }
  });

  $("btn-ha-status").addEventListener("click", async () => {
    const box = $("ha-admin-box");
    setVisible(box, true);
    box.innerHTML = `<p class="muted">Checking Home Assistant…</p>`;
    try {
      const st = await api("/v1/admin/homeassistant/status");
      let entitiesHtml = "";
      if (st.token_present) {
        try {
          const ents = await api("/v1/admin/homeassistant/entities?domain=camera");
          const cams = (ents.entities || []).slice(0, 12);
          entitiesHtml = cams.length
            ? `<ul>${cams
                .map(
                  (e) =>
                    `<li><code>${escapeHtml(e.entity_id)}</code> — ${escapeHtml(e.name)}${
                      e.is_blink ? " (Blink)" : ""
                    }</li>`
                )
                .join("")}</ul>`
            : `<p class="muted">No camera entities yet. In HA add the Blink integration.</p>`;
        } catch (e) {
          entitiesHtml = `<p class="muted">${escapeHtml(e.message)}</p>`;
        }
      }
      box.innerHTML = `
        <h4>Home Assistant</h4>
        <p>UI: <a href="/hass/" target="_blank" rel="noopener">/hass/</a> · LAN port <code>18123</code></p>
        <p class="muted">Configured: <strong>${st.configured ? "yes" : "no"}</strong> · Token: <strong>${
          st.token_present ? "present" : "missing"
        }</strong></p>
        <p class="muted">Health: ${escapeHtml(JSON.stringify(st.health || {}))}</p>
        <p class="muted">1) Open HA → create account → add Blink<br>
        2) Create a Long-Lived Access Token<br>
        3) Set Portainer env <code>HA_TOKEN</code> (or file <code>/secrets/ha-token.txt</code>) and restart home-registry</p>
        <h4>Camera entities</h4>
        ${entitiesHtml}`;
    } catch (err) {
      box.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    }
  });

  boot().catch((err) => {
    showGate(err.message || String(err));
    showAuthPanel("login");
  });
})();
