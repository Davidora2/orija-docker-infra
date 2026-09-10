import { uploadFileInChunks } from "./chunked-upload.js";

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
  const uploaderName = document.getElementById("uploaderName").value;
  const note = document.getElementById("note").value;
  uploadBtn.disabled = true;
  let ok = 0;
  try {
    for (const [index, file] of files.entries()) {
      progressEl.textContent = `Uploading ${index + 1}/${files.length}: ${file.name}`;
      await uploadFileInChunks({
        startUrl: `/api/requests/${id}/uploads`,
        chunkPath: (uploadId, chunkIndex) => `/api/requests/${id}/uploads/${uploadId}/chunks/${chunkIndex}`,
        completeUrl: (uploadId) => `/api/requests/${id}/uploads/${uploadId}/complete`,
        file,
        extraComplete: { uploaderName, note },
        onProgress(done, total, name) {
          progressEl.textContent = `${name} · chunk ${done}/${total}`;
        },
      });
      ok += 1;
    }
    progressEl.textContent = `Uploaded ${ok} file${ok === 1 ? "" : "s"}. Thank you.`;
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
  description.textContent = request.description || "Drop photos or videos for this request. No size limit.";
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
