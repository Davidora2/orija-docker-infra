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
};

function selectedRequest() {
  return state.requests.find((r) => r.id === state.selectedId) || null;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
    filesEl.textContent = "Create a request, share the link, then move uploaded images here.";
    return;
  }

  title.textContent = request.title;
  sub.innerHTML = `${escapeHtml(request.description || "No message")} · <span class="mono">${location.origin}/r/${request.id}</span>`;
  actions.hidden = false;
  toggleBtn.textContent = request.closed ? "Reopen" : "Close request";
  moveBar.hidden = request.files.length === 0;

  const folderSelect = document.getElementById("folderSelect");
  folderSelect.innerHTML = state.folders
    .map((f) => `<option value="${f.id}">${escapeHtml(f.name)}</option>`)
    .join("");

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
          ${moved ? `<div class="pill open">In ${escapeHtml(file.destination?.folderName || "Immich")}</div>` : ""}
        </div>
      </label>`;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  renderRequests();
  renderDetail();
}

async function refresh() {
  const [cfg, requests] = await Promise.all([
    api("/api/admin/config"),
    api("/api/admin/requests"),
  ]);
  state.folders = cfg.immichFolders;
  state.requests = requests;
  if (!state.selectedId && requests[0]) state.selectedId = requests[0].id;
  if (state.selectedId && !requests.find((r) => r.id === state.selectedId)) {
    state.selectedId = requests[0]?.id || null;
  }
  render();
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

document.getElementById("moveBtn").addEventListener("click", async () => {
  const request = selectedRequest();
  if (!request) return;
  const fileIds = [...document.querySelectorAll("#fileList input[type=checkbox]:checked")].map((el) => el.dataset.fileId);
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
    else toast("Sent to Immich folder");
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
