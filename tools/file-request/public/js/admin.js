const toastEl = document.getElementById("toast");
const authGate = document.getElementById("authGate");
const appEl = document.getElementById("app");
const PASS_KEY = "immich-file-request-admin";

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(toastEl._t);
  toastEl._t = window.setTimeout(() => toastEl.classList.remove("show"), 2800);
}

function password() {
  return sessionStorage.getItem(PASS_KEY) || "";
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (password()) headers["x-admin-password"] = password();
  if (options.body && !(options.body instanceof FormData) && typeof options.body !== "string") {
    headers["content-type"] = "application/json";
    options = { ...options, body: JSON.stringify(options.body) };
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

let state = {
  requests: [],
  selectedId: null,
  folders: [],
  immichUsers: [],
  albums: [],
  selectedUserId: "",
};

function selectedRequest() {
  return state.requests.find((r) => r.id === state.selectedId) || null;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderUsers() {
  const list = document.getElementById("userList");
  if (!state.immichUsers.length) {
    list.className = "empty";
    list.textContent = "No Immich users yet.";
    return;
  }
  list.className = "stack";
  list.innerHTML = state.immichUsers
    .map(
      (u) => `<div class="user-row">
        <div>
          <strong>${escapeHtml(u.label)}</strong>
          <div class="muted">${escapeHtml(u.email || u.name || u.apiKeyMasked)}</div>
        </div>
        <button class="btn secondary" data-remove-user="${u.id}" type="button">Remove</button>
      </div>`,
    )
    .join("");
  list.querySelectorAll("[data-remove-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const updated = await api(`/api/admin/immich/users/${btn.dataset.removeUser}`, { method: "DELETE" });
        state.immichUsers = updated.users;
        if (state.selectedUserId === btn.dataset.removeUser) state.selectedUserId = state.immichUsers[0]?.id || "";
        render();
        await loadAlbums();
        toast("User removed");
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

function renderRequests() {
  const list = document.getElementById("requestList");
  if (!state.requests.length) {
    list.innerHTML = `<p class="empty">No requests yet.</p>`;
    return;
  }
  list.innerHTML = state.requests
    .map((r) => {
      const pending = r.files.filter((f) => !f.movedAt).length;
      return `<button class="request-card ${r.id === state.selectedId ? "active" : ""}" data-id="${r.id}" type="button">
        <h3>${escapeHtml(r.title)}</h3>
        <p>${r.files.length} file${r.files.length === 1 ? "" : "s"} · ${pending} waiting</p>
        <p style="margin-top:0.4rem"><span class="pill ${r.closed ? "closed" : "open"}">${r.closed ? "Closed" : "Open"}</span></p>
      </button>`;
    })
    .join("");
  list.querySelectorAll(".request-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedId = btn.dataset.id;
      render();
    });
  });
}

function previewUrl(requestId, fileId) {
  const q = password() ? `?password=${encodeURIComponent(password())}` : "";
  return `/api/admin/files/${requestId}/${fileId}/preview${q}`;
}

function destLabel(file) {
  const dest = file.destination;
  if (!dest) return "";
  if (dest.kind === "immich") {
    const who = dest.userName || "Immich";
    const where = dest.albumName || "Library";
    return `In ${who} · ${where}`;
  }
  return `In ${dest.folderName || "folder"}`;
}

function renderDestControls() {
  const userSelect = document.getElementById("immichUserSelect");
  const albumSelect = document.getElementById("immichAlbumSelect");
  const newAlbumRow = document.getElementById("newAlbumRow");
  userSelect.innerHTML = state.immichUsers.length
    ? state.immichUsers.map((u) => `<option value="${u.id}">${escapeHtml(u.label)}</option>`).join("")
    : `<option value="">Add an Immich user first</option>`;
  if (state.selectedUserId) userSelect.value = state.selectedUserId;

  const albumOptions = [
    `<option value="">Library (no album)</option>`,
    ...state.albums.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`),
    `<option value="__new__">New album…</option>`,
  ];
  const previous = albumSelect.value;
  albumSelect.innerHTML = albumOptions.join("");
  if ([...albumSelect.options].some((o) => o.value === previous)) albumSelect.value = previous;
  newAlbumRow.hidden = albumSelect.value !== "__new__";

  const folderSelect = document.getElementById("folderSelect");
  folderSelect.innerHTML = state.folders
    .map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`)
    .join("");
}

function renderDetail() {
  const request = selectedRequest();
  const title = document.getElementById("detailTitle");
  const sub = document.getElementById("detailSub");
  const actions = document.getElementById("detailActions");
  const moveBar = document.getElementById("moveBar");
  const filesEl = document.getElementById("fileList");
  const toggleBtn = document.getElementById("toggleCloseBtn");

  if (!request) {
    title.textContent = "Select a request";
    sub.textContent = "";
    actions.hidden = true;
    moveBar.hidden = true;
    filesEl.className = "empty";
    filesEl.textContent = "Create a request, share the link, then send uploaded images into Immich.";
    return;
  }

  title.textContent = request.title;
  sub.innerHTML = `${escapeHtml(request.description || "No message")} · <span class="mono">${location.origin}/r/${request.id}</span>`;
  actions.hidden = false;
  toggleBtn.textContent = request.closed ? "Reopen" : "Close request";
  moveBar.hidden = request.files.length === 0;
  renderDestControls();

  if (!request.files.length) {
    filesEl.className = "empty";
    filesEl.textContent = "Waiting for uploads…";
    return;
  }

  filesEl.className = "file-grid";
  filesEl.innerHTML = request.files
    .map((file) => {
      const moved = Boolean(file.movedAt);
      const isVideo = (file.mime || "").startsWith("video/");
      const media = isVideo
        ? `<video src="${previewUrl(request.id, file.id)}" muted></video>`
        : `<img src="${previewUrl(request.id, file.id)}" alt="${escapeHtml(file.originalName)}" />`;
      return `<label class="file-card">
        ${media}
        <div class="meta">
          <label class="row" style="gap:0.4rem">
            <input type="checkbox" data-file-id="${file.id}" ${moved ? "disabled" : "checked"} />
            <span class="name">${escapeHtml(file.originalName)}</span>
          </label>
          <div>${escapeHtml(file.uploaderName)} · ${formatBytes(file.size)}</div>
          ${file.note ? `<div>${escapeHtml(file.note)}</div>` : ""}
          ${moved ? `<div class="pill open">${escapeHtml(destLabel(file))}</div>` : ""}
        </div>
      </label>`;
    })
    .join("");
}

function render() {
  renderUsers();
  renderRequests();
  renderDetail();
}

async function loadAlbums() {
  const userId = document.getElementById("immichUserSelect")?.value || state.selectedUserId;
  state.selectedUserId = userId;
  if (!userId) {
    state.albums = [];
    renderDestControls();
    return;
  }
  try {
    state.albums = await api(`/api/admin/immich/users/${userId}/albums`);
  } catch (error) {
    state.albums = [];
    toast(error.message);
  }
  renderDestControls();
}

async function refresh() {
  const [cfg, requests] = await Promise.all([
    api("/api/admin/config"),
    api("/api/admin/requests"),
  ]);
  state.folders = cfg.immichFolders;
  state.immichUsers = cfg.immich?.users || [];
  document.getElementById("immichUrl").value = cfg.immich?.immichUrl || "";
  if (!state.selectedUserId && state.immichUsers[0]) state.selectedUserId = state.immichUsers[0].id;
  state.requests = requests;
  if (!state.selectedId && requests[0]) state.selectedId = requests[0].id;
  if (state.selectedId && !requests.find((r) => r.id === state.selectedId)) {
    state.selectedId = requests[0]?.id || null;
  }
  render();
  await loadAlbums();
}

async function unlock() {
  const value = document.getElementById("password").value;
  sessionStorage.setItem(PASS_KEY, value);
  document.getElementById("authError").textContent = "";
  try {
    await refresh();
    authGate.hidden = true;
    appEl.hidden = false;
  } catch (error) {
    sessionStorage.removeItem(PASS_KEY);
    document.getElementById("authError").textContent = error.message;
  }
}

document.getElementById("unlockBtn").addEventListener("click", unlock);
document.getElementById("password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlock();
});

document.getElementById("saveUrlBtn").addEventListener("click", async () => {
  try {
    const updated = await api("/api/admin/immich/url", {
      method: "PUT",
      body: { url: document.getElementById("immichUrl").value },
    });
    state.immichUsers = updated.users;
    toast("Immich URL saved");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("addUserBtn").addEventListener("click", async () => {
  try {
    const user = await api("/api/admin/immich/users", {
      method: "POST",
      body: {
        label: document.getElementById("userLabel").value,
        apiKey: document.getElementById("userApiKey").value,
      },
    });
    document.getElementById("userApiKey").value = "";
    state.selectedUserId = user.id;
    await refresh();
    toast(`Added ${user.label}`);
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("createBtn").addEventListener("click", async () => {
  try {
    const created = await api("/api/admin/requests", {
      method: "POST",
      body: {
        title: document.getElementById("title").value,
        description: document.getElementById("description").value,
      },
    });
    document.getElementById("createdBox").hidden = false;
    document.getElementById("createdLink").value = created.uploadUrl;
    state.selectedId = created.id;
    await refresh();
    toast("Request link created");
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("copyLinkBtn").addEventListener("click", async () => {
  const value = document.getElementById("createdLink").value;
  await navigator.clipboard.writeText(value);
  toast("Link copied");
});

document.getElementById("refreshBtn").addEventListener("click", () => refresh().catch((e) => toast(e.message)));

document.getElementById("toggleCloseBtn").addEventListener("click", async () => {
  const request = selectedRequest();
  if (!request) return;
  const action = request.closed ? "reopen" : "close";
  try {
    await api(`/api/admin/requests/${request.id}/${action}`, { method: "POST" });
    await refresh();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("immichUserSelect").addEventListener("change", (e) => {
  state.selectedUserId = e.target.value;
  loadAlbums();
});

document.getElementById("immichAlbumSelect").addEventListener("change", () => {
  document.getElementById("newAlbumRow").hidden =
    document.getElementById("immichAlbumSelect").value !== "__new__";
  if (document.getElementById("immichAlbumSelect").value === "__new__") {
    const request = selectedRequest();
    if (request && !document.getElementById("newAlbumName").value) {
      document.getElementById("newAlbumName").value = request.title;
    }
  }
});

function selectedFileIds() {
  return [...document.querySelectorAll("#fileList input[type=checkbox]:checked")].map((el) => el.dataset.fileId);
}

document.getElementById("sendImmichBtn").addEventListener("click", async () => {
  const request = selectedRequest();
  if (!request) return;
  const fileIds = selectedFileIds();
  if (!fileIds.length) {
    toast("Select at least one file");
    return;
  }
  const userId = document.getElementById("immichUserSelect").value;
  if (!userId) {
    toast("Add an Immich user API key first");
    return;
  }
  const albumSelect = document.getElementById("immichAlbumSelect");
  const albumId = albumSelect.value;
  const body = { requestId: request.id, fileIds, userId };
  if (albumId === "__new__") {
    body.newAlbumName = document.getElementById("newAlbumName").value.trim() || request.title;
  } else if (albumId) {
    body.albumId = albumId;
    body.albumName = albumSelect.selectedOptions[0]?.textContent;
  }
  try {
    const result = await api("/api/admin/send-to-immich", { method: "POST", body });
    const failed = result.results.filter((r) => !r.ok);
    if (result.albumError) toast(`Uploaded, but album add failed: ${result.albumError}`);
    else if (failed.length) toast(`Sent with ${failed.length} error(s)`);
    else toast("Sent to Immich");
    await refresh();
  } catch (error) {
    toast(error.message);
  }
});

document.getElementById("moveBtn").addEventListener("click", async () => {
  const request = selectedRequest();
  if (!request) return;
  const fileIds = selectedFileIds();
  if (!fileIds.length) {
    toast("Select at least one file");
    return;
  }
  try {
    const result = await api("/api/admin/move", {
      method: "POST",
      body: {
        requestId: request.id,
        fileIds,
        folderId: document.getElementById("folderSelect").value,
        mode: document.getElementById("modeSelect").value,
      },
    });
    const failed = result.results.filter((r) => !r.ok);
    if (failed.length) toast(`Moved with ${failed.length} error(s)`);
    else toast("Sent to folder");
    await refresh();
  } catch (error) {
    toast(error.message);
  }
});

async function boot() {
  try {
    await refresh();
    authGate.hidden = true;
    appEl.hidden = false;
  } catch (error) {
    if (String(error.message).includes("401") || String(error.message).toLowerCase().includes("password")) {
      authGate.hidden = false;
      appEl.hidden = true;
    } else {
      authGate.hidden = false;
      document.getElementById("authError").textContent = error.message;
    }
  }
}

boot();
