(() => {
  const TOKEN_KEY = "homepulse_admin_token";
  const API_KEYS = "homepulse_home_api_keys";

  const $ = (id) => document.getElementById(id);
  const gate = $("gate");
  const app = $("app");

  let state = {
    token: sessionStorage.getItem(TOKEN_KEY) || "",
    homes: [],
    selectedId: null,
    home: null,
    tokens: [],
  };

  function apiKeysMap() {
    try {
      return JSON.parse(localStorage.getItem(API_KEYS) || "{}");
    } catch {
      return {};
    }
  }

  function saveApiKey(homeId, key) {
    const map = apiKeysMap();
    map[homeId] = key;
    localStorage.setItem(API_KEYS, JSON.stringify(map));
  }

  function note(el, text, show = true) {
    el.hidden = !show;
    el.textContent = text || "";
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (state.token && !headers.Authorization && !headers["X-API-Key"]) {
      headers.Authorization = `Bearer ${state.token}`;
    }
    const res = await fetch(path, { ...options, headers });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg =
        (data && (data.detail || data.message)) ||
        text ||
        `${res.status} ${res.statusText}`;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  function showApp() {
    gate.hidden = true;
    app.hidden = false;
  }

  function showGate(err) {
    app.hidden = true;
    gate.hidden = false;
    note($("login-error"), err || "", Boolean(err));
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

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
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
      empty.hidden = false;
      detail.hidden = true;
      return;
    }
    empty.hidden = true;
    detail.hidden = false;
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

  async function boot() {
    if (!state.token) {
      showGate();
      return;
    }
    try {
      await loadHomes();
      showApp();
    } catch (err) {
      sessionStorage.removeItem(TOKEN_KEY);
      state.token = "";
      showGate(err.message || "Invalid token");
    }
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    state.token = $("admin-token").value.trim();
    sessionStorage.setItem(TOKEN_KEY, state.token);
    try {
      await loadHomes();
      showApp();
      note($("login-error"), "", false);
    } catch (err) {
      sessionStorage.removeItem(TOKEN_KEY);
      state.token = "";
      showGate(err.message || "Login failed");
    }
  });

  $("btn-logout").addEventListener("click", () => {
    sessionStorage.removeItem(TOKEN_KEY);
    state = { token: "", homes: [], selectedId: null, home: null, tokens: [] };
    showGate();
  });

  $("btn-refresh").addEventListener("click", () => loadHomes().catch((e) => note($("workspace-note"), e.message)));

  $("btn-new-home").addEventListener("click", () => {
    $("create-home-form").hidden = false;
  });
  $("btn-cancel-home").addEventListener("click", () => {
    $("create-home-form").hidden = true;
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
        note(
          $("create-home-note"),
          `Created. API key (save now): ${created.api_key}`,
          true
        );
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

  $("btn-add-device").addEventListener("click", () => {
    $("device-form").hidden = false;
  });
  $("btn-cancel-device").addEventListener("click", () => {
    $("device-form").hidden = true;
  });

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
      $("device-form").hidden = true;
      await selectHome(state.home.home_id);
      note($("workspace-note"), `Device “${body.name}” added`, true);
    } catch (err) {
      note($("workspace-note"), err.message, true);
    }
  });

  $("btn-add-token").addEventListener("click", () => {
    $("token-form").hidden = false;
  });
  $("btn-cancel-token").addEventListener("click", () => {
    $("token-form").hidden = true;
  });

  $("token-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    if (!body.label) delete body.label;
    try {
      await api("/v1/push-tokens", { method: "POST", body: JSON.stringify(body) });
      e.target.reset();
      $("token-form").hidden = true;
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
        body: JSON.stringify({ name: "admin-console", scopes: "ingest:write,notify:read,devices:read,security:write" }),
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

  boot();
})();
