(() => {
  const TOKEN_KEY = "homepulse_member_session";
  const $ = (id) => document.getElementById(id);

  function storageGet() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }
  function storageSet(v) {
    try {
      localStorage.setItem(TOKEN_KEY, v);
    } catch {
      /* ignore */
    }
  }
  function storageDel() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }

  const params = new URLSearchParams(location.search);
  let token = params.get("token") || storageGet();
  if (params.get("token")) storageSet(token);

  const state = { me: null, cameras: [], devices: [], events: [], haCameras: [], haEntities: [], haConfigured: false };

  function note(msg, isErr = false) {
    const el = $("note");
    el.hidden = !msg;
    el.textContent = msg || "";
    el.style.borderColor = isErr ? "var(--danger)" : "var(--amber)";
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const res = await fetch(path, { ...options, headers });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      let msg = data?.detail || data?.message || text || res.statusText;
      if (Array.isArray(msg)) msg = msg.map((m) => m.msg || JSON.stringify(m)).join("; ");
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function showGate(err) {
    $("gate").hidden = false;
    $("workspace").hidden = true;
    $("gate-err").hidden = !err;
    $("gate-err").textContent = err || "";
  }

  function showApp() {
    $("gate").hidden = true;
    $("workspace").hidden = false;
  }

  function renderHa() {
    const status = $("ha-status");
    const camsWrap = $("ha-camera-grid");
    const entsWrap = $("ha-entity-list");
    if (!status || !camsWrap || !entsWrap) return;
    if (!state.haConfigured) {
      status.textContent =
        "Home Assistant is starting or not linked yet. Open HA, add Blink, create a long-lived token, set HA_TOKEN in Portainer.";
      camsWrap.innerHTML = "";
      entsWrap.innerHTML = "";
      return;
    }
    status.textContent = state.haCameras.length
      ? `${state.haCameras.length} HA camera(s) · ${state.haEntities.length} controllable entit${state.haEntities.length === 1 ? "y" : "ies"}`
      : "HA connected — add Blink (or other cameras) in Home Assistant, then Refresh.";
    if (!state.haCameras.length) {
      camsWrap.innerHTML = `<p class="muted">No HA cameras yet. In HA: Settings → Devices & services → Add Blink.</p>`;
    } else {
      camsWrap.innerHTML = state.haCameras
        .map((c) => {
          const badge = c.is_blink ? "Blink" : "HA";
          return `<article class="cam-card">
            <img src="${escapeHtml(c.live_url)}" alt="${escapeHtml(c.name)}" loading="lazy"
              onerror="this.style.opacity=.4" />
            <div class="cam-meta">
              <strong>${escapeHtml(c.name)}</strong>
              <span class="muted small">${escapeHtml(badge)} · ${escapeHtml(c.entity_id)}</span>
              <button type="button" class="btn small" data-ha-cam="${escapeHtml(c.entity_id)}">Refresh</button>
            </div>
          </article>`;
        })
        .join("");
      camsWrap.querySelectorAll("button[data-ha-cam]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const img = btn.closest(".cam-card").querySelector("img");
          const cam = state.haCameras.find((c) => c.entity_id === btn.dataset.haCam);
          if (img && cam) img.src = `${cam.live_url}&_=${Date.now()}`;
        });
      });
    }
    if (!state.haEntities.length) {
      entsWrap.innerHTML = `<p class="muted">No controllable HA entities yet.</p>`;
      return;
    }
    entsWrap.innerHTML = state.haEntities
      .slice(0, 40)
      .map((e) => {
        const actions = [];
        if (["light", "switch", "input_boolean", "fan"].includes(e.domain)) {
          actions.push(`<button type="button" class="btn small" data-eid="${escapeHtml(e.entity_id)}" data-act="on">On</button>`);
          actions.push(`<button type="button" class="btn small" data-eid="${escapeHtml(e.entity_id)}" data-act="off">Off</button>`);
        } else if (e.domain === "lock") {
          actions.push(`<button type="button" class="btn small" data-eid="${escapeHtml(e.entity_id)}" data-act="lock">Lock</button>`);
          actions.push(`<button type="button" class="btn small" data-eid="${escapeHtml(e.entity_id)}" data-act="unlock">Unlock</button>`);
        } else if (e.domain === "cover") {
          actions.push(`<button type="button" class="btn small" data-eid="${escapeHtml(e.entity_id)}" data-act="open">Open</button>`);
          actions.push(`<button type="button" class="btn small" data-eid="${escapeHtml(e.entity_id)}" data-act="close">Close</button>`);
        } else if (["script", "scene", "button"].includes(e.domain)) {
          actions.push(`<button type="button" class="btn small" data-eid="${escapeHtml(e.entity_id)}" data-act="on">Run</button>`);
        } else {
          actions.push(`<button type="button" class="btn small" data-eid="${escapeHtml(e.entity_id)}" data-act="toggle">Toggle</button>`);
        }
        return `<div class="device-row">
          <div>
            <strong>${escapeHtml(e.name)}</strong>
            <div class="muted small">${escapeHtml(e.domain)} · ${escapeHtml(e.state || "—")}</div>
          </div>
          <div class="device-actions">${actions.join("")}</div>
        </div>`;
      })
      .join("");
    entsWrap.querySelectorAll("button[data-eid]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api(
            `/v1/member/homes/${state.me.home.home_id}/ha/entities/${encodeURIComponent(btn.dataset.eid)}/command`,
            { method: "POST", body: JSON.stringify({ action: btn.dataset.act }) }
          );
          note(`HA ${btn.dataset.act} → ${btn.dataset.eid}`);
          await loadAll();
        } catch (err) {
          note(err.message, true);
        }
      });
    });
  }

  function renderCameras() {
    const grid = $("camera-grid");
    if (!state.cameras.length) {
      grid.innerHTML = `<p class="muted">No cameras yet. Ask your admin to add a Frigate camera in HomePulse Admin.</p>`;
      return;
    }
    grid.innerHTML = state.cameras
      .map((c) => {
        const live = c.live_url;
        return `<article class="cam-card">
          <img src="${escapeHtml(live)}" alt="${escapeHtml(c.name)}" loading="lazy"
            onerror="this.alt='Camera offline'; this.style.opacity=.4" />
          <div class="cam-meta">
            <strong>${escapeHtml(c.name)}</strong>
            <span class="muted small">${escapeHtml(c.location_label || c.camera_name)}</span>
            <button type="button" class="btn small" data-cam="${escapeHtml(c.camera_name)}">Refresh feed</button>
          </div>
        </article>`;
      })
      .join("");
    grid.querySelectorAll("button[data-cam]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const img = btn.closest(".cam-card").querySelector("img");
        const cam = state.cameras.find((c) => c.camera_name === btn.dataset.cam);
        if (img && cam) img.src = `${cam.live_url}&_=${Date.now()}`;
      });
    });
  }

  function renderDevices() {
    const wrap = $("device-list");
    const devices = state.devices.filter((d) => !d.is_camera);
    if (!devices.length) {
      wrap.innerHTML = `<p class="muted">No controllable devices yet.</p>`;
      return;
    }
    wrap.innerHTML = devices
      .map((d) => {
        const actions = [];
        if (d.role === "porch_light" || d.device_type === "light" || d.controllable) {
          actions.push(`<button type="button" class="btn small" data-id="${d.device_id}" data-act="on">On</button>`);
          actions.push(`<button type="button" class="btn small" data-id="${d.device_id}" data-act="off">Off</button>`);
        }
        if (d.role === "entry_lock" || d.device_type === "lock") {
          actions.push(`<button type="button" class="btn small" data-id="${d.device_id}" data-act="lock">Lock</button>`);
          actions.push(`<button type="button" class="btn small" data-id="${d.device_id}" data-act="unlock">Unlock</button>`);
        }
        if (d.role === "siren" || d.device_type === "siren") {
          actions.push(`<button type="button" class="btn small" data-id="${d.device_id}" data-act="siren">Siren</button>`);
        }
        if (!actions.length && d.controllable) {
          actions.push(`<button type="button" class="btn small" data-id="${d.device_id}" data-act="on">On</button>`);
          actions.push(`<button type="button" class="btn small" data-id="${d.device_id}" data-act="off">Off</button>`);
        }
        return `<div class="device-row">
          <div>
            <strong>${escapeHtml(d.name)}</strong>
            <div class="muted small">${escapeHtml(d.role || d.device_type)} · ${escapeHtml(d.state || "—")}</div>
          </div>
          <div class="device-actions">${actions.join("") || '<span class="muted small">View only</span>'}</div>
        </div>`;
      })
      .join("");
    wrap.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await api(`/v1/member/homes/${state.me.home.home_id}/devices/${btn.dataset.id}/command`, {
            method: "POST",
            body: JSON.stringify({ action: btn.dataset.act }),
          });
          note(`Sent ${btn.dataset.act} to device`);
          await loadAll();
        } catch (e) {
          note(e.message, true);
        }
      });
    });
  }

  function renderEvents() {
    const wrap = $("events");
    if (!state.events.length) {
      wrap.innerHTML = `<p class="muted">No recent clips yet. Motion/person activity is kept for 14 days.</p>`;
      return;
    }
    wrap.innerHTML = state.events
      .map((ev) => {
        const when = ev.start_time
          ? new Date((ev.start_time > 1e12 ? ev.start_time : ev.start_time * 1000)).toLocaleString()
          : "";
        return `<article class="event">
          <img src="${escapeHtml(ev.thumbnail_url || "")}" alt="" />
          <div>
            <strong>${escapeHtml(ev.label || "Activity")}</strong>
            <div class="muted small">${escapeHtml(ev.camera || "")} · ${escapeHtml(when)}</div>
            ${ev.clip_url ? `<a class="btn small" href="${escapeHtml(ev.clip_url)}" target="_blank" rel="noopener">Play clip</a>` : ""}
          </div>
        </article>`;
      })
      .join("");
  }

  async function loadEvents(homeId, cameras) {
    const all = [];
    for (const cam of cameras.slice(0, 4)) {
      try {
        const data = await api(
          `/v1/member/homes/${homeId}/cameras/${encodeURIComponent(cam.camera_name)}/events?limit=12`
        );
        all.push(...(data.events || []));
      } catch {
        /* ignore per-camera */
      }
    }
    all.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));
    state.events = all.slice(0, 24);
  }

  async function loadAll() {
    const me = await api("/v1/member/me");
    state.me = me;
    $("home-title").textContent = me.home.name;
    $("home-sub").textContent = `${me.display_name} · cameras & devices · 14-day recordings`;
    $("mode-away").checked = me.home.mode === "away";
    $("armed").checked = Boolean(me.home.armed);
    const homeId = me.home.home_id;
    const [cams, devices, haStatus, haCams, haEnts] = await Promise.all([
      api(`/v1/member/homes/${homeId}/cameras`),
      api(`/v1/member/homes/${homeId}/devices`),
      api(`/v1/member/homeassistant/status`).catch(() => ({ configured: false })),
      api(`/v1/member/homes/${homeId}/ha/cameras`).catch(() => ({ cameras: [], configured: false })),
      api(`/v1/member/homes/${homeId}/ha/entities`).catch(() => ({ entities: [], configured: false })),
    ]);
    state.cameras = cams.cameras || [];
    state.devices = devices.devices || [];
    state.haConfigured = Boolean(haStatus.configured || haCams.configured);
    state.haCameras = haCams.cameras || [];
    state.haEntities = haEnts.entities || [];
    await loadEvents(homeId, state.cameras);
    renderCameras();
    renderHa();
    renderDevices();
    renderEvents();
    showApp();
  }

  async function patchSecurity() {
    if (!state.me) return;
    try {
      const updated = await api(`/v1/member/homes/${state.me.home.home_id}/security`, {
        method: "PATCH",
        body: JSON.stringify({
          mode: $("mode-away").checked ? "away" : "home",
          armed: $("armed").checked,
        }),
      });
      state.me.home.mode = updated.mode;
      state.me.home.armed = updated.armed;
      note(`Security → ${updated.mode}${updated.armed ? " · armed" : ""}`);
    } catch (e) {
      note(e.message, true);
    }
  }

  $("btn-enter").addEventListener("click", async () => {
    token = $("token-input").value.trim();
    if (!token) return;
    storageSet(token);
    try {
      await loadAll();
    } catch (e) {
      showGate(e.message);
    }
  });
  $("btn-refresh").addEventListener("click", () => loadAll().catch((e) => note(e.message, true)));
  $("btn-signout").addEventListener("click", () => {
    storageDel();
    token = "";
    showGate("");
  });
  $("mode-away").addEventListener("change", patchSecurity);
  $("armed").addEventListener("change", patchSecurity);

  if (!token) {
    showGate("");
  } else {
    loadAll().catch((e) => showGate(e.message || String(e)));
  }
})();
