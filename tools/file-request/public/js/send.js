import { uploadFileInChunks } from "./chunked-upload.js";

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
  uploadBtn.disabled = true;
  let ok = 0;
  try {
    for (const [index, file] of files.entries()) {
      progressEl.textContent = `Sending ${index + 1}/${files.length}: ${file.name}`;
      await uploadFileInChunks({
        startUrl: "api/open/uploads",
        chunkPath: (uploadId, chunkIndex) => `api/open/uploads/${uploadId}/chunks/${chunkIndex}`,
        completeUrl: (uploadId) => `api/open/uploads/${uploadId}/complete`,
        file,
        onProgress(done, total, name) {
          progressEl.textContent = `${name} · ${done}/${total}`;
        },
      });
      ok += 1;
    }
    progressEl.textContent = `Sent ${ok} file${ok === 1 ? "" : "s"}. Thank you.`;
    setFiles([]);
    fileInput.value = "";
    toast("Sent");
  } catch (error) {
    progressEl.textContent = error.message;
    uploadBtn.disabled = false;
    toast(error.message);
  }
});
