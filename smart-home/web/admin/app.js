(() => {
  const TOKEN_KEY = "homepulse_admin_token";
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
      /* private mode / blocked storage — ignore */
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
    if (msg) {
      loginError.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  async function api(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = { ...(options.headers || {}) };
    if (method !== "GET" && method !== "HEAD" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (state.token && !headers.Authorization && !headers["X-API-Key"]) {
      headers.Authorization = `Bearer ${state.token}`;
      headers["X-Bootstrap-Token"] = state.token;
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
      if (Array.isArray(msg)) {
        msg = msg.map((m) => m.msg || JSON.stringify(m)).join("; ");
      }
      if (!msg) msg = text || `${res.status} ${res.statusText}`;
      if (res.status === 401 || res.status === 403) {
        msg = `Login rejected (${res.status}): ${msg}`;
      }
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  function showApp() {
    setVisible(gate, false);
    setVisible(app, true);
    document.body.classList.add("in-app");
  }

  function showGate(err) {
    setVisible(app, false);
    setVisible(gate, true);
    document.body.classList.remove("in-app");
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
      wrap.innerHTML = `<p class="muted">No devices yet. Add a doorbell to start.</p>`;
      return;
    }
    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th><th>Role</th><th>Vendor</th><th>External ID</th><th>State</th>
          </tr>
        </thead>
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

  function renderTokens() {
    const wrap = $("token-table");
    const tokens = state.tokens || [];
    if (!tokens.length) {
      wrap.innerHTML = `<p class="muted">No FCM tokens registered for this home.</p>`;
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
    const [home, tokens] = await Promise.all([
      api(`/v1/homes/${homeId}`),
      api(`/v1/homes/${homeId}/push-tokens`),
    ]);
    state.home = home;
    state.tokens = tokens.tokens || [];
    renderHomeDetail();
  }

  async function doLogin(rawToken) {
    const token = String(rawToken || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim();
    if (!token) {
      showLoginError("Enter the bootstrap admin token first.");
      return;
    }
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.textContent = "Signing in…";
    }
    showLoginError("Checking token…");
    state.token = token;
    storageSet(TOKEN_KEY, token);
    try {
      await loadHomes();
      showApp();
      showLoginError("");
      if (!state.selectedId && state.homes[0]) {
        await selectHome(state.homes[0].home_id);
      }
    } catch (err) {
      storageDel(TOKEN_KEY);
      state.token = "";
      showGate(err.message || "Login failed");
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = "Enter console";
      }
    }
  }

  async function boot() {
    showLoginError("");
    if (!state.token) {
      showGate();
      return;
    }
    try {
      showLoginError("Restoring session…");
      await loadHomes();
      showApp();
      showLoginError("");
      if (!state.selectedId && state.homes[0]) {
        await selectHome(state.homes[0].home_id);
      }
    } catch (err) {
      storageDel(TOKEN_KEY);
      state.token = "";
      showGate(err.message || "Invalid token");
    }
  }

  const form = $("login-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
      doLogin($("admin-token").value);
    });
  }
  if (loginBtn) {
    loginBtn.addEventListener("click", (e) => {
      // Extra path for mobile browsers that swallow submit oddly
      if (form && form.contains(loginBtn)) {
        /* submit handler will also fire; only use click if type=button */
      }
    });
  }

  $("btn-logout").addEventListener("click", () => {
    storageDel(TOKEN_KEY);
    state = { token: "", homes: [], selectedId: null, home: null, tokens: [] };
    showGate();
  });

  $("btn-refresh").addEventListener("click", () =>
    loadHomes().catch((e) => note($("workspace-note"), e.message))
  );

  $("btn-new-home").addEventListener("click", () => {
    setVisible($("create-home-form"), true);
  });
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

  $("device-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.home) return;
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    for (const k of ["mqtt_command_topic", "mqtt_state_topic", "state", "location_label", "external_id"]) {
      if (!body[k]) delete body[k];
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
      const result = await api("/v1/simulate/ring", {
        method: "POST",
        headers: { "X-API-Key": key },
        body: JSON.stringify({
          external_device_id: doorbell.external_id,
          event: "ding",
        }),
      });
      note($("workspace-note"), `Simulated ding for ${doorbell.name}: ${JSON.stringify(result)}`, true);
    } catch (err) {
      note($("workspace-note"), err.message, true);
    }
  });

  window.homepulseLogin = doLogin;
  boot().catch((err) => showGate(err.message || String(err)));
})();
