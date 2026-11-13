import { api } from "../api.js";
import { escapeHtml, showToast } from "../common.js";

const bucketsGrid = document.getElementById("buckets-grid");
const bucketsMeta = document.getElementById("buckets-meta");
const healthBadge = document.getElementById("health-badge");
const refreshBtn = document.getElementById("refresh-btn");
const statLength = document.getElementById("stat-length");
const statLoad = document.getElementById("stat-load");
const statOccupied = document.getElementById("stat-occupied");
const statCollisions = document.getElementById("stat-collisions");
const loadFill = document.getElementById("load-fill");
const loadRatio = document.getElementById("load-ratio");

const modalCreate = document.getElementById("modal-create");
const modalEdit = document.getElementById("modal-edit");
const modalLookup = document.getElementById("modal-lookup");
const createForm = document.getElementById("create-form");
const editForm = document.getElementById("edit-form");
const lookupForm = document.getElementById("lookup-form");
const createKey = document.getElementById("create-key");
const createValue = document.getElementById("create-value");
const createSubmit = document.getElementById("create-submit");
const editKey = document.getElementById("edit-key");
const editValue = document.getElementById("edit-value");
const editSubmit = document.getElementById("edit-submit");
const lookupKey = document.getElementById("lookup-key");
const lookupSubmit = document.getElementById("lookup-submit");
const lookupResult = document.getElementById("lookup-result");

let previousSnapshot = null;
let scrollLockY = 0;
let activeModal = null;

function stateLabel(type) {
  if (type === "collision") return "Collision";
  if (type === "single") return "Occupé";
  return "Vide";
}

function bucketSignature(bucket) {
  return JSON.stringify({
    type: bucket.type,
    entries: bucket.entries.map((entry) => [entry.key, entry.value]),
  });
}

function keepScroll(run) {
  const y = window.scrollY;
  const restore = () => {
    window.scrollTo(0, y);
  };
  const result = run();

  if (result && typeof result.then === "function") {
    return result.finally(() => {
      restore();
      requestAnimationFrame(restore);
      setTimeout(restore, 0);
    });
  }

  restore();
  requestAnimationFrame(restore);
  return result;
}

function openModal(modal, focusEl) {
  if (activeModal && activeModal !== modal) closeModal(activeModal);

  scrollLockY = window.scrollY;
  activeModal = modal;
  modal.hidden = false;
  modal.classList.add("is-open");
  document.body.classList.add("modal-open");
  document.body.style.top = `-${scrollLockY}px`;
  document.body.style.position = "fixed";
  document.body.style.width = "100%";

  requestAnimationFrame(() => {
    focusEl?.focus();
  });
}

function closeModal(modal = activeModal) {
  if (!modal) return;

  modal.classList.remove("is-open");
  modal.hidden = true;

  if (activeModal === modal) {
    activeModal = null;
    document.body.classList.remove("modal-open");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo({ top: scrollLockY, left: 0, behavior: "auto" });
  }
}

function renderEntry(entry) {
  const safeKey = escapeHtml(entry.key);
  const safeValue = escapeHtml(entry.value ?? "");
  const encoded = encodeURIComponent(entry.key);

  return `
    <article class="entry-card">
      <div class="entry-card__key">${safeKey}</div>
      <div class="entry-card__value">${safeValue}</div>
      <div class="entry-card__actions">
        <button class="btn btn--ghost btn--sm" type="button" data-view="${encoded}">Voir</button>
        <button class="btn btn--ghost btn--sm" type="button" data-edit="${encoded}">Éditer</button>
        <button class="btn btn--danger btn--sm" type="button" data-delete="${encoded}">Suppr.</button>
      </div>
    </article>
  `;
}

function renderBucket(bucket, animClass, delayIndex) {
  const entriesHtml =
    bucket.entries.length > 0
      ? bucket.entries.map(renderEntry).join("")
      : `<p class="bucket__empty-label">Aucune entrée</p>`;

  const chain =
    bucket.type === "collision"
      ? `<div class="collision-chain">
           <span class="collision-chain__dots" aria-hidden="true">
             <span></span><span></span><span></span>
           </span>
           ${bucket.entries.length} entrées chaînées
         </div>`
      : "";

  return `
    <article
      class="bucket bucket--${bucket.type} ${animClass}"
      data-bucket-index="${bucket.index}"
      style="animation-delay: ${Math.min(delayIndex, 16) * 28}ms"
      aria-label="Bucket ${bucket.index}, ${stateLabel(bucket.type)}"
    >
      <span class="bucket__shine" aria-hidden="true"></span>
      <header class="bucket__head">
        <span class="bucket__index">#${bucket.index}</span>
        <span class="bucket__state">${stateLabel(bucket.type)}</span>
      </header>
      <div class="bucket__body">${entriesHtml}</div>
      ${chain}
    </article>
  `;
}

function updateStats(snapshot) {
  const ratio = snapshot.loadLimit > 0 ? snapshot.load / snapshot.loadLimit : 0;
  const percent = Math.min(100, Math.round(ratio * 100));

  statLength.textContent = String(snapshot.length);
  statLoad.textContent = String(snapshot.load);
  statOccupied.textContent = String(snapshot.occupied);
  statCollisions.textContent = String(snapshot.collisions);
  bucketsMeta.textContent = `${snapshot.length} buckets`;

  loadFill.style.width = `${percent}%`;
  loadFill.classList.toggle("is-hot", percent >= 85);
  loadRatio.textContent = `${snapshot.load} / ${snapshot.loadLimit} (${percent}%)`;
}

async function checkHealth() {
  try {
    const data = await api.health();
    const status = typeof data?.status === "string" ? data.status.trim() : "OK";
    healthBadge.className = "badge is-ok";
    healthBadge.innerHTML = `<span class="badge__dot"></span> API ${escapeHtml(status)}`;
  } catch {
    healthBadge.className = "badge is-ko";
    healthBadge.innerHTML = `<span class="badge__dot"></span> API hors ligne`;
  }
}

async function loadBuckets({ quiet = false } = {}) {
  return keepScroll(async () => {
    try {
      const snapshot = await api.getBuckets();
      updateStats(snapshot);

      if (!Array.isArray(snapshot.buckets) || snapshot.buckets.length === 0) {
        bucketsGrid.innerHTML = `<p class="empty-state">Aucun bucket disponible.</p>`;
        previousSnapshot = snapshot;
        return;
      }

      const prevMap = new Map(
        (previousSnapshot?.buckets || []).map((bucket) => [
          bucket.index,
          bucketSignature(bucket),
        ])
      );
      const sizeChanged =
        previousSnapshot && previousSnapshot.length !== snapshot.length;
      const isFirst = !previousSnapshot;

      bucketsGrid.innerHTML = snapshot.buckets
        .map((bucket, index) => {
          const signature = bucketSignature(bucket);
          const previous = prevMap.get(bucket.index);
          let animClass = "";

          if (isFirst) {
            animClass = "is-enter";
          } else if (sizeChanged) {
            animClass = "is-rehash";
          } else if (previous !== signature) {
            animClass = bucket.type === "empty" ? "is-enter" : "is-changed";
          }

          return renderBucket(bucket, animClass, index);
        })
        .join("");

      previousSnapshot = snapshot;
    } catch (error) {
      if (!quiet) {
        bucketsGrid.innerHTML = `<p class="empty-state">Impossible de charger les buckets.</p>`;
        showToast(error.message, "error");
      }
    }
  });
}

function openCreateModal() {
  createForm.reset();
  openModal(modalCreate, createKey);
}

function openEditModal(key, value = "") {
  editKey.value = key;
  editValue.value = value;
  openModal(modalEdit, editValue);
}

function openLookupModal(prefill = "") {
  lookupForm.reset();
  lookupResult.hidden = true;
  lookupResult.innerHTML = "";
  if (prefill) lookupKey.value = prefill;
  openModal(modalLookup, lookupKey);
}

async function openEditForKey(key) {
  try {
    const entry = await api.getOne(key);
    openEditModal(entry.key, entry.value ?? "");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderLookupResult(entry) {
  const encoded = encodeURIComponent(entry.key);
  lookupResult.hidden = false;
  lookupResult.innerHTML = `
    <div>
      <div class="result-block__label">Clé</div>
      <div class="result-block__value">${escapeHtml(entry.key)}</div>
    </div>
    <div>
      <div class="result-block__label">Valeur</div>
      <div class="result-block__value">${escapeHtml(entry.value ?? "")}</div>
    </div>
    <div class="form-actions">
      <button class="btn btn--ghost" type="button" data-edit="${encoded}">Modifier</button>
      <button class="btn btn--danger" type="button" data-delete="${encoded}">Supprimer</button>
    </div>
  `;
}

document.querySelectorAll("[data-open-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.getAttribute("data-open-modal");
    if (name === "create") openCreateModal();
    if (name === "lookup") openLookupModal();
  });
});

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-modal]")) {
      closeModal(modal);
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeModal) {
    closeModal(activeModal);
  }
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = createKey.value.trim();
  const value = createValue.value;

  if (!key) {
    showToast("La clé est obligatoire", "error");
    return;
  }

  createSubmit.disabled = true;
  try {
    await api.create(key, value);
    closeModal(modalCreate);
    showToast(`Clé « ${key} » créée`, "success");
    await loadBuckets();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    createSubmit.disabled = false;
  }
});

editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = editKey.value.trim();
  const value = editValue.value;

  if (!key) {
    showToast("La clé est obligatoire", "error");
    return;
  }

  editSubmit.disabled = true;
  try {
    await api.update(key, value);
    closeModal(modalEdit);
    showToast(`Clé « ${key} » mise à jour`, "success");
    await loadBuckets();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    editSubmit.disabled = false;
  }
});

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = lookupKey.value.trim();
  if (!key) {
    showToast("Indiquez une clé à consulter", "error");
    return;
  }

  lookupSubmit.disabled = true;
  try {
    const entry = await api.getOne(key);
    renderLookupResult(entry);
  } catch (error) {
    lookupResult.hidden = false;
    lookupResult.innerHTML = `
      <div class="result-block__label">Résultat</div>
      <div class="result-block__value">${escapeHtml(error.message)}</div>
    `;
    showToast(error.message, "error");
  } finally {
    lookupSubmit.disabled = false;
  }
});

async function handleDelete(key) {
  const confirmed = window.confirm(`Supprimer la clé « ${key} » ?`);
  if (!confirmed) return;

  try {
    await api.remove(key);
    if (activeModal === modalLookup) closeModal(modalLookup);
    showToast(`Clé « ${key} » supprimée`, "success");
    await loadBuckets();
  } catch (error) {
    showToast(error.message, "error");
  }
}

document.body.addEventListener("click", async (event) => {
  const editBtn = event.target.closest("[data-edit]");
  if (editBtn) {
    const key = decodeURIComponent(editBtn.getAttribute("data-edit"));
    if (activeModal === modalLookup) closeModal(modalLookup);
    await openEditForKey(key);
    return;
  }

  const viewBtn = event.target.closest("[data-view]");
  if (viewBtn) {
    const key = decodeURIComponent(viewBtn.getAttribute("data-view"));
    openLookupModal(key);
    lookupSubmit.disabled = true;
    try {
      const entry = await api.getOne(key);
      renderLookupResult(entry);
    } catch (error) {
      lookupResult.hidden = false;
      lookupResult.innerHTML = `
        <div class="result-block__label">Résultat</div>
        <div class="result-block__value">${escapeHtml(error.message)}</div>
      `;
      showToast(error.message, "error");
    } finally {
      lookupSubmit.disabled = false;
    }
    return;
  }

  const deleteBtn = event.target.closest("[data-delete]");
  if (deleteBtn) {
    const key = decodeURIComponent(deleteBtn.getAttribute("data-delete"));
    await handleDelete(key);
  }
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  await Promise.all([checkHealth(), loadBuckets()]);
  refreshBtn.disabled = false;
  showToast("Vue actualisée", "info");
});

checkHealth();
loadBuckets();
