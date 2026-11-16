import { api } from "../api.js";
import { snapshotFromCollection } from "../buckets-from-file.js";
import { escapeHtml, showToast } from "../common.js";

const FILES_STORAGE_KEY = "cachelab.knownFiles";
const DEFAULT_FILES = ["cache.json", "toto.json"];

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

let previousSnapshot = null;
let scrollLockY = 0;
let activeModal = null;
/** @type {'live' | 'file'} */
let viewMode = "live";
let selectedFile = null;

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

function updateViewChrome() {
  if (viewMode === "file" && selectedFile) {
    viewBadge.textContent = `vue : ${selectedFile}`;
    modeHint.textContent = `Mode fichier « ${selectedFile} » — lecture via GET /api/files/:name, création via POST /api/insert. Édition/suppression de clés : mode Mémoire uniquement.`;
    createSubtitle.textContent = `Insertion dans « ${selectedFile} » via POST /api/insert.`;
  } else {
    viewBadge.textContent = "vue : mémoire";
    modeHint.textContent =
      "Mode mémoire serveur — visualisation `/buckets`, CRUD `/keys`.";
    createSubtitle.textContent = "Ajoute une paire clé / valeur via POST /keys.";
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
      : `${snapshot.length} buckets · mémoire`;

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
  if (resetAnim) previousSnapshot = null;
  updateStats(snapshot);
  updateViewChrome();

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

async function loadLiveBuckets({ quiet = false, resetAnim = false } = {}) {
  return keepScroll(async () => {
    try {
      const snapshot = await api.getBuckets();
      paintSnapshot(snapshot, { resetAnim });
    } catch (error) {
      if (!quiet) {
        bucketsGrid.innerHTML = `<p class="empty-state">Impossible de charger les buckets.</p>`;
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
      await loadFiles();
    } catch (error) {
      if (!quiet) {
        showToast(error.message, "error");
      }
    }
  });
}

async function discoverFiles() {
  let fromApi = [];

  try {
    const data = await api.listFiles();
    if (Array.isArray(data)) {
      fromApi = data.filter(
        (name) => typeof name === "string" && name.endsWith(".json")
      );
    }
  } catch {
    // listStore backend peut renvoyer vide : on continue avec le probe
  }

  const candidates = [
    ...new Set([...fromApi, ...DEFAULT_FILES, ...getKnownFiles()]),
  ].filter((name) => typeof name === "string" && name.endsWith(".json"));

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
  try {
    const files = await discoverFiles();
    renderFiles(files);
  } catch (error) {
    filesList.innerHTML = `<p class="empty-state">Impossible de lister les fichiers.</p>`;
    showToast(error.message, "error");
  }
}

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
  openModal(modalSeed, seedCount);
}

function openLoadTestModal() {
  loadTestResult.hidden = true;
  loadTestResult.innerHTML = "";
  openModal(modalLoadTest, ltEntries);
}

function formatMs(value) {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10} ms`;
}

function renderLoadTestReport(report) {
  const rps = Math.round(report.requests?.average ?? 0);
  const cpu = report.system?.cpuPercent;
  const ramAfter = report.system?.memory?.after?.rssMb;
  const ramDelta = report.system?.memory?.delta?.rssMb;
  const cpuEl = document.getElementById("lt-cpu") || ltCpu;
  const ramEl = document.getElementById("lt-ram") || ltRam;

  ltRps.textContent = String(rps);
  ltP50.textContent = formatMs(report.latency?.p50);
  ltP99.textContent = formatMs(report.latency?.p99);
  ltErrors.textContent = String(report.errors ?? 0);
  ltTimeouts.textContent = String(report.timeouts ?? 0);
  ltSeeded.textContent = String(report.seeded ?? 0);
  if (cpuEl) {
    cpuEl.textContent = Number.isFinite(cpu) ? `${cpu} %` : "—";
  }
  if (ramEl) {
    ramEl.textContent = Number.isFinite(ramAfter)
      ? `${ramAfter} Mo${Number.isFinite(ramDelta) ? ` (${ramDelta >= 0 ? "+" : ""}${ramDelta})` : ""}`
      : "—";
  }
  loadTestMetrics.hidden = false;

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
      <div class="result-block__value">RSS ${escapeHtml(String(report.system?.memory?.after?.rssMb ?? "—"))} Mo · heap ${escapeHtml(String(report.system?.memory?.after?.heapUsedMb ?? "—"))}/${escapeHtml(String(report.system?.memory?.after?.heapTotalMb ?? "—"))} Mo · Δ RSS ${escapeHtml(String(report.system?.memory?.delta?.rssMb ?? "—"))} Mo</div>
    </div>
    <div>
      <div class="result-block__label">Hashmap après test</div>
      <div class="result-block__value">load ${escapeHtml(String(report.hashmap?.load ?? "—"))} · collisions ${escapeHtml(String(report.hashmap?.collisions ?? "—"))} · taille ${escapeHtml(String(report.hashmap?.length ?? "—"))}</div>
    </div>
  `;
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
    if (viewMode === "file" && selectedFile) {
      await api.insertIntoFile(selectedFile, key, value);
      closeModal(modalCreate);
      showToast(`Clé « ${key} » insérée dans ${selectedFile}`, "success");
      await loadFileBuckets(selectedFile, { resetAnim: false });
    } else {
      await api.create(key, value);
      closeModal(modalCreate);
      showToast(`Clé « ${key} » créée`, "success");
      await loadLiveBuckets();
    }
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

seedForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const count = Number(seedCount.value);
  if (!Number.isFinite(count) || count < 1) {
    showToast("Nombre d’insertions invalide", "error");
    return;
  }

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

async function handleDeleteKey(key) {
  const confirmed = window.confirm(`Supprimer la clé « ${key} » ?`);
  if (!confirmed) return;

  try {
    await api.remove(key);
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
    await handleDeleteKey(decodeURIComponent(deleteBtn.getAttribute("data-delete")));
  }
});

liveBtn.addEventListener("click", async () => {
  await switchToLive();
});

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

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  await checkHealth();
  await loadFiles();
  if (viewMode === "file" && selectedFile) {
    await loadFileBuckets(selectedFile, { resetAnim: false });
  } else {
    await loadLiveBuckets();
  }
  refreshBtn.disabled = false;
  showToast("Vue actualisée", "info");
});

updateViewChrome();
checkHealth();
loadFiles();
loadLiveBuckets();
