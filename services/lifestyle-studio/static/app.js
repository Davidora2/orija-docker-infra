(() => {
  const state = {
    project: null,
    health: null,
    drag: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const fileUrl = (path) =>
    `/api/projects/${state.project.id}/files/${path}?t=${Date.now()}`;

  async function api(path, opts = {}) {
    const res = await fetch(path, opts);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { detail: text };
    }
    if (!res.ok) {
      const msg = data?.detail || data?.message || res.statusText;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return data;
  }

  function toast(msg, isError = false) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    el.classList.toggle("error", isError);
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.hidden = true;
    }, 3200);
  }

  function busy(on, text) {
    $("#busy").hidden = !on;
    if (text) $("#busy-text").textContent = text;
  }

  function briefFromForm() {
    return {
      product_name: $("#product_name").value.trim(),
      product_notes: $("#product_notes").value.trim(),
      scene: $("#scene").value.trim(),
      lighting: $("#lighting").value.trim(),
      camera: $("#camera").value.trim(),
      include_model: $("#include_model").checked,
      model_description: $("#model_description").value.trim(),
      notes: $("#notes").value.trim(),
      aspect_ratio: $("#aspect_ratio").value,
    };
  }

  function layoutFromControls() {
    return {
      product: {
        x: Number($("#prod-x").value),
        y: Number($("#prod-y").value),
        scale: Number($("#prod-scale").value) / 100,
      },
      model: {
        enabled: $("#include_model").checked,
        x: Number($("#model-x").value),
        y: Number($("#model-y").value),
        scale: Number($("#model-scale").value) / 100,
        pose: $("#model_pose").value.trim(),
      },
    };
  }

  function fillForm(project) {
    const b = project.brief;
    $("#product_name").value = b.product_name || "";
    $("#product_notes").value = b.product_notes || "";
    $("#scene").value = b.scene || "";
    $("#lighting").value = b.lighting || "";
    $("#camera").value = b.camera || "";
    $("#include_model").checked = !!b.include_model;
    $("#model_description").value = b.model_description || "";
    $("#notes").value = b.notes || "";
    $("#aspect_ratio").value = b.aspect_ratio || "3:4";
    $("#model_pose").value = project.layout?.model?.pose || "";
    $("#model-fields").style.display = b.include_model ? "" : "none";
    $("#model-layout-card").style.display = b.include_model ? "" : "none";

    const p = project.layout.product;
    const m = project.layout.model;
    $("#prod-x").value = p.x;
    $("#prod-y").value = p.y;
    $("#prod-scale").value = Math.round((p.scale || 1) * 100);
    $("#model-x").value = m.x;
    $("#model-y").value = m.y;
    $("#model-scale").value = Math.round((m.scale || 1) * 100);
    syncOutputs();
    updateCanvasAspect(b.aspect_ratio || "3:4");
  }

  function syncOutputs() {
    $("#prod-x-out").textContent = `${$("#prod-x").value}%`;
    $("#prod-y-out").textContent = `${$("#prod-y").value}%`;
    $("#prod-scale-out").textContent = `${(Number($("#prod-scale").value) / 100).toFixed(2)}×`;
    $("#model-x-out").textContent = `${$("#model-x").value}%`;
    $("#model-y-out").textContent = `${$("#model-y").value}%`;
    $("#model-scale-out").textContent = `${(Number($("#model-scale").value) / 100).toFixed(2)}×`;
    placeAnchors();
  }

  function updateCanvasAspect(ratio) {
    const [w, h] = ratio.split(":").map(Number);
    $("#canvas").style.aspectRatio = `${w} / ${h}`;
  }

  function placeAnchors() {
    const ap = $("#anchor-product");
    const am = $("#anchor-model");
    ap.style.left = `${$("#prod-x").value}%`;
    ap.style.top = `${$("#prod-y").value}%`;
    const ps = Number($("#prod-scale").value) / 100;
    ap.style.transform = `scale(${ps})`;
    am.style.left = `${$("#model-x").value}%`;
    am.style.top = `${$("#model-y").value}%`;
    const ms = Number($("#model-scale").value) / 100;
    am.style.transform = `scale(${ms})`;
  }

  function renderRefs() {
    for (const kind of ["product", "model", "style"]) {
      const box = $(`#refs-${kind}`);
      box.innerHTML = "";
      for (const ref of state.project.refs[kind] || []) {
        const el = document.createElement("div");
        el.className = "thumb";
        el.innerHTML = `<img src="${fileUrl(ref.path)}" alt="" /><button type="button" title="Remove">×</button>`;
        el.querySelector("button").onclick = async () => {
          try {
            state.project = await api(
              `/api/projects/${state.project.id}/refs/${kind}/${ref.id}`,
              { method: "DELETE" }
            );
            renderRefs();
          } catch (e) {
            toast(e.message, true);
          }
        };
        box.appendChild(el);
      }
    }
  }

  function renderDraft() {
    const canvas = $("#canvas");
    const img = $("#draft-image");
    const activeId = state.project.active_draft_id;
    const draft = (state.project.drafts || []).find((d) => d.id === activeId);
    const hasDraft = !!draft;
    canvas.classList.toggle("empty", !hasDraft);
    $(".empty-msg").hidden = hasDraft;
    img.hidden = !hasDraft;
    $("#anchor-product").hidden = !hasDraft;
    $("#anchor-model").hidden = !hasDraft || !state.project.brief.include_model;
    $("#layout-controls").hidden = !hasDraft;
    $("#btn-apply-layout").disabled = !hasDraft;
    $("#btn-bake").disabled = !hasDraft;
    $("#btn-rate-up").disabled = !hasDraft;
    $("#btn-rate-down").disabled = !hasDraft;

    if (hasDraft) {
      img.src = fileUrl(draft.path);
      if (draft.layout?.product) {
        $("#prod-x").value = draft.layout.product.x;
        $("#prod-y").value = draft.layout.product.y;
        $("#prod-scale").value = Math.round((draft.layout.product.scale || 1) * 100);
      }
      if (draft.layout?.model) {
        $("#model-x").value = draft.layout.model.x;
        $("#model-y").value = draft.layout.model.y;
        $("#model-scale").value = Math.round((draft.layout.model.scale || 1) * 100);
        if (draft.layout.model.pose != null) {
          $("#model_pose").value = draft.layout.model.pose;
        }
      }
      syncOutputs();
    }

    const draftList = $("#draft-list");
    draftList.innerHTML = "";
    for (const d of [...(state.project.drafts || [])].reverse()) {
      const item = document.createElement("div");
      item.className = "item" + (d.id === activeId ? " active" : "");
      item.innerHTML = `<img src="${fileUrl(d.path)}" alt="${d.source}" title="${d.source} · ${d.size}" />`;
      item.onclick = async () => {
        state.project = await api(
          `/api/projects/${state.project.id}/select-draft/${d.id}`,
          { method: "POST" }
        );
        renderDraft();
        renderBaked();
      };
      draftList.appendChild(item);
    }
  }

  function renderBaked() {
    const bakeList = $("#bake-list");
    bakeList.innerHTML = "";
    for (const b of [...(state.project.baked || [])].reverse()) {
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <img src="${fileUrl(b.path)}" alt="baked" />
        <a href="${fileUrl(b.path)}" download="orija-${b.id}.png">${b.size}</a>`;
      bakeList.appendChild(item);
    }
  }

  async function persistBrief() {
    state.project = await api(`/api/projects/${state.project.id}/brief`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(briefFromForm()),
    });
    // also persist pose into layout
    const layout = layoutFromControls();
    state.project = await api(`/api/projects/${state.project.id}/layout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    });
  }

  async function refreshAssistant() {
    try {
      const data = await api("/api/assistant/memory");
      const totals = data.profile?.totals || {};
      $("#learn-stats").textContent =
        `${totals.bakes || 0} bakes · ${totals.thumbs_up || 0} ups · ${totals.thumbs_down || 0} downs · ${totals.repositions || 0} layout fixes · confidence ${Math.round((data.suggestion?.confidence || 0) * 100)}%`;
      const tips = $("#learn-tips");
      tips.innerHTML = "";
      for (const tip of data.suggestion?.tips || data.profile?.learned_rules || []) {
        const li = document.createElement("li");
        li.textContent = tip;
        tips.appendChild(li);
      }
    } catch {
      /* ignore until first project */
    }
  }

  async function ensureProject() {
    if (state.project) return;
    const projects = await api("/api/projects");
    if (projects.length) {
      state.project = projects[0];
    } else {
      state.project = await api("/api/projects", { method: "POST" });
    }
    fillForm(state.project);
    renderRefs();
    renderDraft();
    renderBaked();
    await refreshAssistant();
  }

  async function uploadFiles(kind, fileList) {
    for (const file of fileList) {
      const fd = new FormData();
      fd.append("file", file);
      state.project = await api(`/api/projects/${state.project.id}/refs/${kind}`, {
        method: "POST",
        body: fd,
      });
    }
    renderRefs();
    toast(`Added ${fileList.length} ${kind} reference(s)`);
  }

  function bindDrag(anchorEl, axisPrefix) {
    const onPointerDown = (e) => {
      e.preventDefault();
      state.drag = { el: anchorEl, prefix: axisPrefix, pointerId: e.pointerId };
      anchorEl.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!state.drag || state.drag.el !== anchorEl) return;
      const rect = $("#canvas").getBoundingClientRect();
      const x = Math.min(95, Math.max(5, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.min(95, Math.max(5, ((e.clientY - rect.top) / rect.height) * 100));
      if (axisPrefix === "prod") {
        $("#prod-x").value = Math.round(x);
        $("#prod-y").value = Math.round(y);
      } else {
        $("#model-x").value = Math.round(x);
        $("#model-y").value = Math.round(y);
      }
      syncOutputs();
    };
    const onPointerUp = () => {
      state.drag = null;
    };
    anchorEl.addEventListener("pointerdown", onPointerDown);
    anchorEl.addEventListener("pointermove", onPointerMove);
    anchorEl.addEventListener("pointerup", onPointerUp);
    anchorEl.addEventListener("pointercancel", onPointerUp);
  }

  async function init() {
    state.health = await api("/api/health");
    const pill = $("#mode-pill");
    if (state.health.mock_mode) {
      pill.textContent = "Mock · self-learning on";
      pill.className = "pill warn";
    } else if (state.health.has_api_key) {
      pill.textContent = `Nano Banana · learning`;
      pill.className = "pill ok";
    } else {
      pill.textContent = "API key missing";
      pill.className = "pill warn";
    }
    if (state.health.bake_size) {
      $("#bake-size").value = state.health.bake_size;
    }
    await ensureProject();

    $("#btn-new").onclick = async () => {
      state.project = await api("/api/projects", { method: "POST" });
      fillForm(state.project);
      renderRefs();
      renderDraft();
      renderBaked();
      await refreshAssistant();
      toast("New project with learned defaults");
    };

    $("#include_model").onchange = () => {
      const on = $("#include_model").checked;
      $("#model-fields").style.display = on ? "" : "none";
      $("#model-layout-card").style.display = on ? "" : "none";
      $("#anchor-model").hidden = !on || !$("#draft-image").src || $("#draft-image").hidden;
    };

    for (const id of [
      "prod-x",
      "prod-y",
      "prod-scale",
      "model-x",
      "model-y",
      "model-scale",
    ]) {
      $(`#${id}`).addEventListener("input", syncOutputs);
    }

    $("#aspect_ratio").addEventListener("change", (e) =>
      updateCanvasAspect(e.target.value)
    );

    $("#upload-product").onchange = (e) => uploadFiles("product", e.target.files);
    $("#upload-model").onchange = (e) => uploadFiles("model", e.target.files);
    $("#upload-style").onchange = (e) => uploadFiles("style", e.target.files);

    $("#btn-apply-learn").onclick = async () => {
      try {
        const result = await api(`/api/projects/${state.project.id}/apply-suggestion`, {
          method: "POST",
        });
        state.project = result.project;
        fillForm(state.project);
        await refreshAssistant();
        toast("Applied learned scene / layout defaults");
      } catch (e) {
        toast(e.message, true);
      }
    };

    $("#btn-ask").onclick = async () => {
      const question = $("#ask-input").value.trim();
      if (!question) return;
      try {
        const result = await api("/api/assistant/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            product_name: $("#product_name").value.trim(),
          }),
        });
        const el = $("#ask-answer");
        el.hidden = false;
        el.textContent = result.answer;
      } catch (e) {
        toast(e.message, true);
      }
    };

    $("#btn-lesson").onclick = async () => {
      const text = $("#lesson-input").value.trim();
      if (!text) return;
      try {
        await api("/api/assistant/lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            product_name: $("#product_name").value.trim(),
          }),
        });
        $("#lesson-input").value = "";
        await refreshAssistant();
        toast("Lesson saved to studio memory");
      } catch (e) {
        toast(e.message, true);
      }
    };

    async function rate(rating) {
      try {
        const reason =
          rating === "down"
            ? prompt("What should improve? (saved for learning)") || ""
            : "";
        await api(`/api/projects/${state.project.id}/rate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, reason }),
        });
        await refreshAssistant();
        toast(rating === "up" ? "Logged as a good draft" : "Logged — I'll avoid that next time");
      } catch (e) {
        toast(e.message, true);
      }
    }
    $("#btn-rate-up").onclick = () => rate("up");
    $("#btn-rate-down").onclick = () => rate("down");

    $("#btn-generate").onclick = async () => {
      try {
        busy(true, "Generating draft with Nano Banana…");
        await persistBrief();
        const result = await api(`/api/projects/${state.project.id}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ use_layout: true }),
        });
        state.project = result.project;
        renderDraft();
        renderBaked();
        await refreshAssistant();
        toast("Draft ready — adjust placement if needed");
      } catch (e) {
        toast(e.message, true);
      } finally {
        busy(false);
      }
    };

    $("#btn-apply-layout").onclick = async () => {
      try {
        busy(true, "Moving subjects in the scene…");
        await persistBrief();
        const result = await api(`/api/projects/${state.project.id}/reposition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            layout: layoutFromControls(),
            notes: $("#notes").value.trim(),
          }),
        });
        state.project = result.project;
        renderDraft();
        await refreshAssistant();
        toast("Layout applied — correction learned");
      } catch (e) {
        toast(e.message, true);
      } finally {
        busy(false);
      }
    };

    $("#btn-bake").onclick = async () => {
      try {
        busy(true, "Baking high-res final…");
        await persistBrief();
        const result = await api(`/api/projects/${state.project.id}/bake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            size: $("#bake-size").value,
            lesson: $("#bake-lesson").value.trim() || null,
          }),
        });
        state.project = result.project;
        renderDraft();
        renderBaked();
        await refreshAssistant();
        toast(`Baked ${result.baked.size} — approval saved to memory`);
      } catch (e) {
        toast(e.message, true);
      } finally {
        busy(false);
      }
    };

    bindDrag($("#anchor-product"), "prod");
    bindDrag($("#anchor-model"), "model");
  }

  init().catch((e) => toast(e.message, true));
})();
