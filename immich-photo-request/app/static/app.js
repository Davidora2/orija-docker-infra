(() => {
  const keyStorage = "immichPhotoRequestApiKey";
  const apiKeyInput = document.getElementById("api-key");
  const connectBtn = document.getElementById("connect-btn");
  const disconnectBtn = document.getElementById("disconnect-btn");
  const authStatus = document.getElementById("auth-status");
  const authPanel = document.getElementById("auth-panel");
  const dashboard = document.getElementById("dashboard");
  const userName = document.getElementById("user-name");
  const userMeta = document.getElementById("user-meta");
  const externalPath = document.getElementById("external-path");
  const createForm = document.getElementById("create-form");
  const librarySelect = document.getElementById("library-select");
  const createdLink = document.getElementById("created-link");
  const linkOutput = document.getElementById("link-output");
  const copyBtn = document.getElementById("copy-btn");
  const requestList = document.getElementById("request-list");

  let apiKey = localStorage.getItem(keyStorage) || "";

  function setStatus(el, message, ok) {
    if (!el) return;
    el.hidden = !message;
    el.textContent = message || "";
    el.classList.toggle("ok", !!ok);
    el.classList.toggle("err", !!message && !ok);
  }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (apiKey) headers["X-API-Key"] = apiKey;
    if (options.json) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.json);
      delete options.json;
    }
    const res = await fetch(path, { ...options, headers });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
    if (!res.ok) {
      throw new Error((data && data.detail) || res.statusText || "Request failed");
    }
    return data;
  }

  async function refreshLibraries() {
    librarySelect.innerHTML = '<option value="">Skip auto-scan</option>';
    try {
      const libs = await api("/api/libraries");
      for (const lib of libs) {
        const opt = document.createElement("option");
        opt.value = lib.id;
        opt.textContent = `${lib.name || lib.id} (${lib.type || "library"})`;
        librarySelect.appendChild(opt);
      }
    } catch {
      // Libraries endpoint may require permissions; ignore.
    }
  }

  async function refreshRequests() {
    const rows = await api("/api/requests");
    requestList.innerHTML = "";
    if (!rows.length) {
      requestList.innerHTML = '<p class="hint">No requests yet.</p>';
      return;
    }
    for (const row of rows) {
      const card = document.createElement("article");
      card.className = "request-card";
      const openLabel = row.is_open ? "Open" : "Closed";
      card.innerHTML = `
        <div>
          <strong>${escapeHtml(row.title)}</strong>
          <div class="meta">${openLabel} · ${row.upload_count}/${row.max_files} uploads</div>
        </div>
        <div class="actions">
          <button type="button" data-copy="${escapeAttr(row.link)}">Copy link</button>
          ${row.is_open ? `<button type="button" class="ghost" data-close="${escapeAttr(row.id)}">Close</button>` : ""}
        </div>
      `;
      requestList.appendChild(card);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("'", "&#39;");
  }

  async function connect() {
    apiKey = (apiKeyInput.value || apiKey || "").trim();
    if (!apiKey) {
      setStatus(authStatus, "Paste an Immich API key first.", false);
      return;
    }
    try {
      const me = await api("/api/me");
      localStorage.setItem(keyStorage, apiKey);
      apiKeyInput.value = apiKey;
      authPanel.hidden = true;
      dashboard.hidden = false;
      userName.textContent = me.name || me.email || "Signed in";
      userMeta.textContent = me.email || me.id;
      externalPath.textContent = me.external_path;
      setStatus(authStatus, "", true);
      await refreshLibraries();
      if (me.immich_library_id) librarySelect.value = me.immich_library_id;
      await refreshRequests();
    } catch (err) {
      setStatus(authStatus, err.message || "Could not connect", false);
      dashboard.hidden = true;
      authPanel.hidden = false;
    }
  }

  connectBtn?.addEventListener("click", connect);
  disconnectBtn?.addEventListener("click", () => {
    localStorage.removeItem(keyStorage);
    apiKey = "";
    apiKeyInput.value = "";
    dashboard.hidden = true;
    authPanel.hidden = false;
  });

  createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(createForm);
    const payload = {
      title: String(form.get("title") || "").trim(),
      message: String(form.get("message") || "").trim(),
      expiry_days: Number(form.get("expiry_days") || 14),
      max_files: Number(form.get("max_files") || 100),
      immich_library_id: String(form.get("immich_library_id") || ""),
    };
    try {
      const created = await api("/api/requests", { method: "POST", json: payload });
      createdLink.hidden = false;
      linkOutput.value = created.link;
      await refreshRequests();
    } catch (err) {
      alert(err.message || "Could not create request");
    }
  });

  copyBtn?.addEventListener("click", async () => {
    if (!linkOutput.value) return;
    await navigator.clipboard.writeText(linkOutput.value);
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
  });

  requestList?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.copy) {
      await navigator.clipboard.writeText(target.dataset.copy);
      target.textContent = "Copied";
      setTimeout(() => { target.textContent = "Copy link"; }, 1200);
    }
    if (target.dataset.close) {
      try {
        await api(`/api/requests/${target.dataset.close}/close`, { method: "POST" });
        await refreshRequests();
      } catch (err) {
        alert(err.message || "Could not close request");
      }
    }
  });

  if (apiKey) {
    apiKeyInput.value = apiKey;
    connect();
  }
})();
