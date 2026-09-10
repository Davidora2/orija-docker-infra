const id = location.pathname.split("/").filter(Boolean).pop();
const toastEl = document.getElementById("toast");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const selectedEl = document.getElementById("selected");
const uploadBtn = document.getElementById("uploadBtn");
const progressEl = document.getElementById("progress");

let files = [];

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  window.clearTimeout(toastEl._t);
  toastEl._t = window.setTimeout(() => toastEl.classList.remove("show"), 2800);
}

function setFiles(list) {
  files = [...list];
  selectedEl.textContent = files.length
    ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
    : "";
  uploadBtn.disabled = files.length === 0;
}

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => setFiles(fileInput.files));
["dragenter", "dragover"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  });
});
["dragleave", "drop"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  });
});
dropzone.addEventListener("drop", (e) => {
  setFiles(e.dataTransfer.files);
});

uploadBtn.addEventListener("click", async () => {
  if (!files.length) return;
  const body = new FormData();
  body.append("uploaderName", document.getElementById("uploaderName").value);
  body.append("note", document.getElementById("note").value);
  for (const file of files) body.append("files", file);

  uploadBtn.disabled = true;
  progressEl.textContent = "Uploading…";
  try {
    const res = await fetch(`/api/requests/${id}/upload`, { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Upload failed");
    progressEl.textContent = `Uploaded ${data.count} file${data.count === 1 ? "" : "s"}. Thank you.`;
    setFiles([]);
    fileInput.value = "";
    toast("Upload complete");
  } catch (error) {
    progressEl.textContent = error.message;
    uploadBtn.disabled = false;
    toast(error.message);
  }
});

async function boot() {
  const statusPill = document.getElementById("statusPill");
  const title = document.getElementById("title");
  const description = document.getElementById("description");
  const uploadPanel = document.getElementById("uploadPanel");
  const closedPanel = document.getElementById("closedPanel");
  const missingPanel = document.getElementById("missingPanel");

  const res = await fetch(`/api/requests/${id}`);
  if (res.status === 404) {
    statusPill.textContent = "Unavailable";
    missingPanel.hidden = false;
    return;
  }
  const request = await res.json();
  title.textContent = request.title;
  description.textContent = request.description || "Drop photos or videos for this request.";
  document.title = request.title;
  if (request.closed) {
    statusPill.textContent = "Closed";
    statusPill.classList.add("closed");
    closedPanel.hidden = false;
  } else {
    statusPill.textContent = "Open";
    statusPill.classList.add("open");
    uploadPanel.hidden = false;
  }
}

boot();
