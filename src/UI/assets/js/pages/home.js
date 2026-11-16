import { api } from "../api.js";
import { snapshotFromCollection } from "../buckets-from-file.js";
import { escapeHtml, showToast } from "../common.js";

const FILES_STORAGE_KEY = "cachelab.files";
const DEFAULT_FILES = ["cache.json", "init.json"];

// --- DOM ELEMENTS : Fichiers & Vues ---
const bucketsGrid = document.getElementById("buckets-grid");
const bucketsMeta = document.getElementById("buckets-meta");
const healthBadge = document.getElementById("health-badge");
const viewBadge = document.getElementById("view-badge");
const modeHint = document.getElementById("mode-hint");
const refreshBtn = document.getElementById("refresh-btn");
const liveBtn = document.getElementById("live-btn");
const clearMemoryBtn = document.getElementById("clear-memory-btn");
const filesList = document.getElementById("files-list");
const filesCount = document.getElementById("files-count");
const createFileForm = document.getElementById("create-file-form");
const createFileSubmit = document.getElementById("create-file-submit");
const newFilename = document.getElementById("new-filename");
const statLength = document.getElementById("stat-length");
const statLoad = document.getElementById("stat-load");
const statOccupied = document.getElementById("stat-occupied");
const statCollisions = document.getElementById("stat-collisions");
const loadFill = document.getElementById("load-fill");
const loadRatio = document.getElementById("load-ratio");

// --- DOM ELEMENTS : Agrégateur & Collections ---
const collectionSelect = document.getElementById("collection-select");
const activeCollectionBadge = document.getElementById("active-collection-badge");
const modalNewCollection = document.getElementById("modal-new-collection");
const newCollectionForm = document.getElementById("new-collection-form");
const collectionNameInput = document.getElementById("collection-name");
const collectionPersistInput = document.getElementById("collection-persist");
const collectionSubmit = document.getElementById("collection-submit");

// --- DOM ELEMENTS : Modales & Formulaires ---
const modalCreate = document.getElementById("modal-create");
const modalEdit = document.getElementById("modal-edit");
const modalLookup = document.getElementById("modal-lookup");
const modalSeed = document.getElementById("modal-seed");
const modalLoadTest = document.getElementById("modal-loadtest");
const modalPreview = document.getElementById("modal-preview");
const createForm = document.getElementById("create-form");
const createSubtitle = document.getElementById("create-subtitle");
const editForm = document.getElementById("edit-form");
const lookupForm = document.getElementById("lookup-form");
const seedForm = document.getElementById("seed-form");
const loadTestForm = document.getElementById("loadtest-form");
const createKey = document.getElementById("create-key");
const createValue = document.getElementById("create-value");
const createSubmit = document.getElementById("create-submit");
const editKey = document.getElementById("edit-key");
const editValue = document.getElementById("edit-value");
const editSubmit = document.getElementById("edit-submit");
const lookupKey = document.getElementById("lookup-key");
const lookupSubmit = document.getElementById("lookup-submit");
const lookupResult = document.getElementById("lookup-result");
const seedCount = document.getElementById("seed-count");
const seedGenerate = document.getElementById("seed-generate");
const seedRun = document.getElementById("seed-run");
const ltEntries = document.getElementById("lt-entries");
const ltConnections = document.getElementById("lt-connections");
const ltDuration = document.getElementById("lt-duration");
const loadTestSubmit = document.getElementById("loadtest-submit");
const loadTestResult = document.getElementById("loadtest-result");
const loadTestMetrics = document.getElementById("loadtest-metrics");
const ltRps = document.getElementById("lt-rps");
const ltP50 = document.getElementById("lt-p50");
const ltP99 = document.getElementById("lt-p99");
const ltErrors = document.getElementById("lt-errors");
const ltTimeouts = document.getElementById("lt-timeouts");
const ltSeeded = document.getElementById("lt-seeded");
const ltCpu = document.getElementById("lt-cpu");
const ltRam = document.getElementById("lt-ram");
const previewSubtitle = document.getElementById("preview-subtitle");
const previewContent = document.getElementById("preview-content");

// --- ETAT GLOBAL ---
let previousSnapshot = null;
let scrollLockY = 0;
let activeModal = null;
let activeCollection = "cache";
/** @type {'live' | 'file'} */
let viewMode = "live";
let selectedFile = null;

// ============================================================================
// UTILITAIRES & GESTION DES FICHIERS
// ============================================================================

function getKnownFiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FILES_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

function rememberFile(name) {
  const next = new Set([...DEFAULT_FILES, ...getKnownFiles(), name].filter(Boolean));
  localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify([...next]));
}

function forgetFile(name) {
  const next = getKnownFiles().filter((item) => item !== name);
  localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(next));
}

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
  const restore = () => window.scrollTo(0, y);
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

function formatMs(value) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10} ms`;
}

// ============================================================================
// GESTION DES MODALES
// ============================================================================

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

  requestAnimationFrame(() => focusEl?.focus());
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

// ============================================================================
// RENDU VISUEL & STATISTIQUES
// ============================================================================

function updateViewChrome() {
  if (viewMode === "file" && selectedFile) {
    if (viewBadge) viewBadge.textContent = `vue : ${selectedFile}`;
    if (modeHint) modeHint.textContent = `Mode fichier « ${selectedFile} ».`;
    if (createSubtitle) createSubtitle.textContent = `Insertion dans « ${selectedFile} » via POST /api/insert.`;
  } else {
    if (viewBadge) viewBadge.textContent = `vue : mémoire (${activeCollection})`;
    if (modeHint) modeHint.textContent = `Mode mémoire serveur — visualisation \`/buckets\`, CRUD \`/keys\`.`;
    if (createSubtitle) createSubtitle.textContent = `Ajoute une paire clé / valeur dans ${activeCollection}.`;
  }
}

function renderEntry(entry) {
  const safeKey = escapeHtml(entry.key);
  const safeValue = escapeHtml(entry.value ?? "");
  const encoded = encodeURIComponent(entry.key);
  const liveActions =
    viewMode === "live"
      ? `
        <button class="btn btn--ghost btn--sm" type="button" data-view="${encoded}">Voir</button>
        <button class="btn btn--ghost btn--sm" type="button" data-edit="${encoded}">Éditer</button>
        <button class="btn btn--danger btn--sm" type="button" data-delete="${encoded}">Suppr.</button>
      `
      : `<span class="field__hint">Lecture fichier</span>`;

  return `
    <article class="entry-card">
      <div class="entry-card__key">${safeKey}</div>
      <div class="entry-card__value">${safeValue}</div>
      <div class="entry-card__actions">${liveActions}</div>
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
  const label =
    viewMode === "file" && selectedFile
      ? `${snapshot.length} buckets · ${selectedFile}`
      : `${snapshot.length} buckets · ${activeCollection}`;

  statLength.textContent = String(snapshot.length);
  statLoad.textContent = String(snapshot.load);
  statOccupied.textContent = String(snapshot.occupied);
  statCollisions.textContent = String(snapshot.collisions);
  bucketsMeta.textContent = label;

  loadFill.style.width = `${percent}%`;
  loadFill.classList.toggle("is-hot", percent >= 85);
  loadRatio.textContent = `${snapshot.load} / ${snapshot.loadLimit} (${percent}%)`;
}

function paintSnapshot(snapshot, { resetAnim = false } = {}) {
  updateStats(snapshot);

  if (!Array.isArray(snapshot.buckets) || snapshot.buckets.length === 0) {
    bucketsGrid.innerHTML = `<p class="empty-state">Aucun bucket disponible.</p>`;
    previousSnapshot = snapshot;
    return;
  }

  const prevMap = new Map(
    (!resetAnim && previousSnapshot?.buckets ? previousSnapshot.buckets : []).map(
      (bucket) => [bucket.index, bucketSignature(bucket)]
    )
  );
  
  const sizeChanged = !resetAnim && previousSnapshot && previousSnapshot.length !== snapshot.length;
  const isFirst = resetAnim || !previousSnapshot;

  bucketsGrid.innerHTML = snapshot.buckets
    .map((bucket, index) => {
      const signature = bucketSignature(bucket);
      const previous = prevMap.get(bucket.index);
      let animClass = "";

      if (isFirst) animClass = "is-enter";
      else if (sizeChanged) animClass = "is-rehash";
      else if (previous !== signature) {
        animClass = bucket.type === "empty" ? "is-enter" : "is-changed";
      }

      return renderBucket(bucket, animClass, index);
    })
    .join("");

  previousSnapshot = snapshot;
}

function renderLoadTestReport(report) {
  const rps = Math.round(report.requests?.average ?? 0);
  const cpu = report.system?.cpuPercent;
  const ramAfter = report.system?.memory?.after?.rssMb;
  const ramDelta = report.system?.memory?.delta?.rssMb;
  const cpuEl = document.getElementById("lt-cpu") || ltCpu;
  const ramEl = document.getElementById("lt-ram") || ltRam;

  if (ltRps) ltRps.textContent = String(rps);
  if (ltP50) ltP50.textContent = formatMs(report.latency?.p50);
  if (ltP99) ltP99.textContent = formatMs(report.latency?.p99);
  if (ltErrors) ltErrors.textContent = String(report.errors ?? 0);
  if (ltTimeouts) ltTimeouts.textContent = String(report.timeouts ?? 0);
  if (ltSeeded) ltSeeded.textContent = String(report.seeded ?? 0);
  if (cpuEl) {
    cpuEl.textContent = Number.isFinite(cpu) ? `${cpu} %` : "—";
  }
  if (ramEl) {
    ramEl.textContent = Number.isFinite(ramAfter)
      ? `${ramAfter} Mo${Number.isFinite(ramDelta) ? ` (${ramDelta >= 0 ? "+" : ""}${ramDelta})` : ""}`
      : "—";
  }
  if (loadTestMetrics) loadTestMetrics.hidden = false;

  loadTestResult.hidden = false;
  loadTestResult.innerHTML = `
    <div>
      <div class="result-block__label">Requêtes totales</div>
      <div class="result-block__value">${escapeHtml(String(report.requests?.total ?? 0))}</div>
    </div>
    <div>
      <div class="result-block__label">Latence moyenne</div>
      <div class="result-block__value">${escapeHtml(formatMs(report.latency?.average))}</div>
    </div>
    <div>
      <div class="result-block__label">CPU (process Node)</div>
      <div class="result-block__value">${escapeHtml(Number.isFinite(cpu) ? `${cpu} %` : "—")} · user ${escapeHtml(String(report.system?.cpuUserMs ?? "—"))} ms · system ${escapeHtml(String(report.system?.cpuSystemMs ?? "—"))} ms</div>
    </div>
    <div>
      <div class="result-block__label">RAM (RSS / heap)</div>
      <div class="result-block__value">RSS ${escapeHtml(String(report.system?.memory?.after?.rssMb ?? "—"))} Mo · heap ${escapeHtml(String(report.system?.memory?.after?.heapUsedMb ?? "—"))}/${escapeHtml(String(report.system?.memory?.after?.heapTotalMb ?? "—"))} Mo · / RSS ${escapeHtml(String(report.system?.memory?.delta?.rssMb ?? "—"))} Mo</div>
    </div>
    <div>
      <div class="result-block__label">Hashmap après test</div>
      <div class="result-block__value">load ${escapeHtml(String(report.hashmap?.load ?? "—"))} · collisions ${escapeHtml(String(report.hashmap?.collisions ?? "—"))} · taille ${escapeHtml(String(report.hashmap?.length ?? "—"))}</div>
    </div>
  `;
}

// ============================================================================
// FETCH DATA
// ============================================================================

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
      const snapshot = await api.getBuckets(activeCollection);
      paintSnapshot(snapshot);
    } catch (error) {
      if (!quiet) {
        bucketsGrid.innerHTML = `<p class="empty-state">Impossible de charger les buckets de ${activeCollection}.</p>`;
        showToast(error.message, "error");
      }
    }
  });
}

async function loadLiveBuckets({ quiet = false, resetAnim = false } = {}) {
  return keepScroll(async () => {
    try {
      const snapshot = await api.getBuckets(activeCollection);
      paintSnapshot(snapshot, { resetAnim });
    } catch (error) {
      if (!quiet) {
        bucketsGrid.innerHTML = `<p class="empty-state">Impossible de charger les buckets de ${activeCollection}.</p>`;
        showToast(error.message, "error");
      }
    }
  });
}

async function loadFileBuckets(filename, { quiet = false, resetAnim = true } = {}) {
  return keepScroll(async () => {
    try {
      const collection = await api.getFile(filename);
      const snapshot = snapshotFromCollection(collection);
      viewMode = "file";
      selectedFile = filename;
      paintSnapshot(snapshot, { resetAnim });
      if (filesList) await loadFiles();
    } catch (error) {
      if (!quiet) showToast(error.message, "error");
    }
  });
}

async function discoverFiles() {
  let fromApi = [];
  try {
    const data = await api.listFiles();
    if (Array.isArray(data)) {
      fromApi = data.filter((name) => typeof name === "string" && name.endsWith(".json"));
    }
  } catch {}

  const candidates = [...new Set([...fromApi, ...DEFAULT_FILES, ...getKnownFiles()])].filter(
    (name) => typeof name === "string" && name.endsWith(".json")
  );

  const existing = [];
  await Promise.all(
    candidates.map(async (name) => {
      try {
        await api.getFile(name);
        existing.push(name);
        rememberFile(name);
      } catch {
        forgetFile(name);
      }
    })
  );

  return existing.sort((a, b) => a.localeCompare(b));
}

function renderFiles(files) {
  if (!filesCount || !filesList) return;
  filesCount.textContent = `${files.length} fichier${files.length > 1 ? "s" : ""}`;

  if (!files.length) {
    filesList.innerHTML = `<p class="empty-state">Aucun fichier JSON détecté.</p>`;
    return;
  }

  filesList.innerHTML = files
    .map((name) => {
      const safe = escapeHtml(name);
      const encoded = encodeURIComponent(name);
      const isActive = viewMode === "file" && selectedFile === name;
      return `
        <div class="file-item ${isActive ? "is-active" : ""}">
          <button class="file-item__main" type="button" data-select-file="${encoded}">
            <span class="file-item__name">${safe}</span>
            <span class="file-item__meta">${isActive ? "affiché" : "ouvrir"}</span>
          </button>
          <div class="file-item__actions">
            <button class="btn btn--ghost btn--sm" type="button" data-preview-file="${encoded}">JSON</button>
            <button class="btn btn--danger btn--sm" type="button" data-delete-file="${encoded}">Suppr.</button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function loadFiles() {
  if (!filesList) return;
  try {
    const files = await discoverFiles();
    renderFiles(files);
  } catch (error) {
    filesList.innerHTML = `<p class="empty-state">Impossible de lister les fichiers.</p>`;
    showToast(error.message, "error");
  }
}

// ============================================================================
// ACTIONS UTILISATEUR & MODALES (CRUD)
// ============================================================================

async function switchToLive() {
  viewMode = "live";
  selectedFile = null;
  updateViewChrome();
  await Promise.all([loadFiles(), loadLiveBuckets({ resetAnim: true })]);
  showToast("Vue mémoire serveur", "info");
}

async function deleteFile(filename) {
  const confirmed = window.confirm(`Supprimer le fichier « ${filename} » ?`);
  if (!confirmed) return;

  try {
    await api.deleteFile(filename);
    forgetFile(filename);
    showToast(`Fichier « ${filename} » supprimé`, "success");

    if (viewMode === "file" && selectedFile === filename) {
      await switchToLive();
    } else {
      await loadFiles();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function previewFile(filename) {
  try {
    const content = await api.getFile(filename);
    previewSubtitle.textContent = filename;
    previewContent.textContent = JSON.stringify(content, null, 2);
    openModal(modalPreview);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openCreateModal() {
  createForm.reset();
  updateViewChrome();
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

function openSeedModal() {
  if (modalSeed) openModal(modalSeed, seedCount);
}

function openLoadTestModal() {
  if (loadTestResult) {
    loadTestResult.hidden = true;
    loadTestResult.innerHTML = "";
  }
  if (modalLoadTest) openModal(modalLoadTest, ltEntries);
}

async function openEditForKey(key) {
  try {
    const entry = await api.getOne(activeCollection, key);
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

// ============================================================================
// ECOUTEURS D'EVENEMENTS GLOBAUX
// ============================================================================

if (collectionSelect) {
  collectionSelect.addEventListener("change", async (e) => {
    activeCollection = e.target.value;
    if (activeCollectionBadge) activeCollectionBadge.textContent = activeCollection;
    previousSnapshot = null; 
    showToast(`Changement vers la collection : ${activeCollection}`, "info");
    updateViewChrome();
    if (viewMode === "live") {
      await loadBuckets();
    }
  });
}

document.querySelectorAll("[data-open-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.getAttribute("data-open-modal");
    if (name === "create") openCreateModal();
    if (name === "lookup") openLookupModal();
    if (name === "new-collection") {
       newCollectionForm.reset();
       openModal(modalNewCollection, collectionNameInput);
    }
    if (name === "seed") openSeedModal();
    if (name === "loadtest") openLoadTestModal();
  });
});

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-modal]")) closeModal(modal);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeModal) closeModal(activeModal);
});

// ============================================================================
// SOUMISSION DES FORMULAIRES
// ============================================================================

if (createFileForm) {
  createFileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    let filename = newFilename.value.trim();
    if (!filename) {
      showToast("Nom de fichier requis", "error");
      return;
    }
    if (!filename.endsWith(".json")) filename = `${filename}.json`;

    createFileSubmit.disabled = true;
    try {
      await api.createFile(filename);
      rememberFile(filename);
      newFilename.value = "";
      showToast(`Fichier « ${filename} » créé`, "success");
      await loadFiles();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      createFileSubmit.disabled = false;
    }
  });
}

if (newCollectionForm) {
  newCollectionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = collectionNameInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const isPersistent = collectionPersistInput.checked;

    if (!name) {
      showToast("Le nom est obligatoire et doit être valide", "error");
      return;
    }

    collectionSubmit.disabled = true;
    try {
      await api.createCollection(name, isPersistent);
      
      let optionExists = Array.from(collectionSelect.options).some(opt => opt.value === name);
      if (!optionExists) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = `Collection: ${name}`;
        collectionSelect.appendChild(option);
      }
      
      collectionSelect.value = name;
      collectionSelect.dispatchEvent(new Event("change"));

      closeModal(modalNewCollection);
      showToast(`Collection « ${name} » créée`, "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      collectionSubmit.disabled = false;
    }
  });
}

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
    await api.create(activeCollection, key, value);
    closeModal(modalCreate);
    showToast(`Clé « ${key} » créée`, "success");
    if (viewMode === "live") await loadLiveBuckets();
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
    await api.update(activeCollection, key, value);
    closeModal(modalEdit);
    showToast(`Clé « ${key} » mise à jour`, "success");
    if (viewMode === "live") await loadLiveBuckets();
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
    const entry = await api.getOne(activeCollection, key);
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

if (seedForm) {
  seedForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const count = Number(seedCount.value);
    seedGenerate.disabled = true;
    try {
      const result = await api.generateSeed(count);
      if (result?.success === false) throw new Error("Génération du seed échouée");
      showToast(`Seed généré (${count} entrées)`, "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      seedGenerate.disabled = false;
    }
  });
}

if (seedRun) {
  seedRun.addEventListener("click", async () => {
    seedRun.disabled = true;
    try {
      const result = await api.runSeed();
      showToast(result.message || "Seed terminé", result.success ? "success" : "error");
      rememberFile("cache.json");
      if (viewMode === "live") await loadLiveBuckets({ resetAnim: true });
      else if (selectedFile === "cache.json") {
        await loadFileBuckets("cache.json", { resetAnim: true });
      }
      await loadFiles();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      seedRun.disabled = false;
    }
  });
}

if (loadTestForm) {
  loadTestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const entries = Number(ltEntries.value);
    const connections = Number(ltConnections.value);
    const duration = Number(ltDuration.value);

    if (!Number.isFinite(entries) || entries < 0 || entries > 50000) {
      showToast("Entrées : 0 à 50000", "error");
      return;
    }
    if (!Number.isFinite(connections) || connections < 1 || connections > 500) {
      showToast("Clients : 1 à 500", "error");
      return;
    }
    if (!Number.isFinite(duration) || duration < 1 || duration > 60) {
      showToast("Durée : 1 à 60 s", "error");
      return;
    }

    loadTestSubmit.disabled = true;
    loadTestResult.hidden = false;
    loadTestResult.innerHTML = `
      <div class="result-block__label">Statut</div>
      <div class="result-block__value">Test en cours… (volume puis barrage HTTP)</div>
    `;
    showToast("Stress test démarré côté serveur", "info");

    try {
      const report = await api.runLoadTest({
        entries: Math.floor(entries),
        connections: Math.floor(connections),
        duration: Math.floor(duration),
      });
      renderLoadTestReport(report);
      showToast(
        `Test terminé — ~${Math.round(report.requests?.average ?? 0)} req/s`,
        "success"
      );
      if (viewMode === "live") await loadLiveBuckets({ resetAnim: true });
      else await switchToLive();
    } catch (error) {
      loadTestResult.hidden = false;
      loadTestResult.innerHTML = `
        <div class="result-block__label">Erreur</div>
        <div class="result-block__value">${escapeHtml(error.message)}</div>
      `;
      showToast(error.message, "error");
    } finally {
      loadTestSubmit.disabled = false;
    }
  });
}

// ============================================================================
// DELEGATION D'EVENEMENTS (Clics dynamiques)
// ============================================================================

async function handleDelete(key) {
  const confirmed = window.confirm(`Supprimer la clé « ${key} » de la collection ${activeCollection} ?`);
  if (!confirmed) return;

  try {
    await api.remove(activeCollection, key);
    if (activeModal === modalLookup) closeModal(modalLookup);
    showToast(`Clé « ${key} » supprimée`, "success");
    if (viewMode === "live") await loadLiveBuckets();
  } catch (error) {
    showToast(error.message, "error");
  }
}

document.body.addEventListener("click", async (event) => {
  const selectBtn = event.target.closest("[data-select-file]");
  if (selectBtn) {
    const filename = decodeURIComponent(selectBtn.getAttribute("data-select-file"));
    await loadFileBuckets(filename);
    showToast(`Fichier affiché : ${filename}`, "info");
    return;
  }

  const previewBtn = event.target.closest("[data-preview-file]");
  if (previewBtn) {
    await previewFile(decodeURIComponent(previewBtn.getAttribute("data-preview-file")));
    return;
  }

  const deleteFileBtn = event.target.closest("[data-delete-file]");
  if (deleteFileBtn) {
    await deleteFile(decodeURIComponent(deleteFileBtn.getAttribute("data-delete-file")));
    return;
  }

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
      const entry = await api.getOne(activeCollection, key);
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
    await handleDelete(decodeURIComponent(deleteBtn.getAttribute("data-delete")));
  }
});

if (liveBtn) {
  liveBtn.addEventListener("click", async () => {
    await switchToLive();
  });
}

if (clearMemoryBtn) {
  clearMemoryBtn.addEventListener("click", async () => {
    const confirmed = window.confirm(
      "Vider toute la hashmap en mémoire (et réécrire cache.json vide) ?"
    );
    if (!confirmed) return;

    clearMemoryBtn.disabled = true;
    try {
      await api.clearMemory();
      showToast("Mémoire vidée", "success");
      if (viewMode === "live") await loadLiveBuckets({ resetAnim: true });
      else await switchToLive();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      clearMemoryBtn.disabled = false;
    }
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    await checkHealth();
    if (filesList) await loadFiles();
    
    if (viewMode === "file" && selectedFile) {
      await loadFileBuckets(selectedFile, { resetAnim: false });
    } else {
      await loadLiveBuckets();
    }
    
    refreshBtn.disabled = false;
    showToast("Vue actualisée", "info");
  });
}

// Initialisation
updateViewChrome();
checkHealth();
if (filesList) loadFiles();
loadBuckets();