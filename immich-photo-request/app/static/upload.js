(() => {
  const cfg = window.PHOTO_REQUEST || {};
  if (!cfg.isOpen) return;

  const form = document.getElementById("upload-form");
  const input = document.getElementById("file-input");
  const dropzone = document.getElementById("dropzone");
  const list = document.getElementById("file-list");
  const button = document.getElementById("upload-btn");
  const status = document.getElementById("upload-status");
  const note = document.getElementById("note");

  let files = [];

  function setStatus(message, ok) {
    status.hidden = !message;
    status.textContent = message || "";
    status.classList.toggle("ok", !!ok);
    status.classList.toggle("err", !!message && !ok);
  }

  function render() {
    list.innerHTML = "";
    files.forEach((file, index) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB</span>
        <button type="button" class="ghost" data-remove="${index}">Remove</button>`;
      list.appendChild(li);
    });
    button.disabled = files.length === 0;
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const maxBytes = (cfg.maxUploadMb || 95) * 1024 * 1024;
    for (const file of incoming) {
      if (file.size > maxBytes) {
        setStatus(`${file.name} is over ${cfg.maxUploadMb}MB`, false);
        continue;
      }
      if (files.length >= (cfg.remaining || 0)) {
        setStatus(`Only ${cfg.remaining} file(s) can still be uploaded`, false);
        break;
      }
      files.push(file);
    }
    render();
  }

  dropzone?.addEventListener("click", () => input?.click());
  input?.addEventListener("change", () => addFiles(input.files));

  ["dragenter", "dragover"].forEach((type) => {
    dropzone?.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add("drag");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    dropzone?.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove("drag");
    });
  });
  dropzone?.addEventListener("drop", (event) => {
    addFiles(event.dataTransfer?.files);
  });

  list?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.dataset.remove) return;
    files.splice(Number(target.dataset.remove), 1);
    render();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!files.length) return;
    button.disabled = true;
    setStatus("Uploading…", true);
    const body = new FormData();
    for (const file of files) body.append("files", file);
    if (note?.value) body.append("note", note.value);
    try {
      const res = await fetch(`/api/r/${cfg.token}/upload`, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setStatus(`Uploaded ${data.count} file(s). ${data.hint || ""}`, true);
      files = [];
      render();
      cfg.remaining = Math.max(0, (cfg.remaining || 0) - (data.count || 0));
    } catch (err) {
      setStatus(err.message || "Upload failed", false);
      button.disabled = files.length === 0;
    }
  });
})();
