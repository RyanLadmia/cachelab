// On utilise une URL relative pour s'adapter directement au port du serveur
const API_URL = '/api';
let currentFile = null;

// DOM Elements
const fileListEl = document.getElementById('file-list');
const jsonViewerEl = document.getElementById('json-viewer');
const currentFileDisplay = document.getElementById('current-file-display');
const insertForm = document.getElementById('insert-form');
const createFileForm = document.getElementById('create-file-form');
const insertBtn = document.getElementById('insert-btn');
const arrayLengthEl = document.getElementById('array-length');

// Chargement initial
document.addEventListener('DOMContentLoaded', fetchFiles);

// Bouton rafraîchir
document.getElementById('refresh-btn').addEventListener('click', () => {
    fetchFiles();
    if (currentFile) fetchFileContent(currentFile);
});

// --- LISTER LES FICHIERS ---
async function fetchFiles() {
    try {
        const res = await fetch(`${API_URL}/files`);
        if (!res.ok) throw new Error('Erreur HTTP ' + res.status);
        const files = await res.json();
        renderFileList(files);
    } catch (err) {
        console.error("Erreur chargement fichiers:", err);
        fileListEl.innerHTML = `<p class="text-red-400 text-xs p-2">Erreur chargement API (${err.message})</p>`;
    }
}

// --- LIRE ET AFFICHER LE CONTENU D'UN FICHIER ---
async function fetchFileContent(filename) {
    try {
        currentFile = filename;
        currentFileDisplay.textContent = filename;
        jsonViewerEl.textContent = "Chargement...";

        const res = await fetch(`${API_URL}/files/${filename}`);
        if (!res.ok) throw new Error('Fichier introuvable');
        const data = await res.json();
        
        insertBtn.disabled = false;
        jsonViewerEl.textContent = JSON.stringify(data, null, 2);
        arrayLengthEl.textContent = `Taille: ${Array.isArray(data) ? data.length : '0'}`;

        // Met à jour la surbrillance dans la sidebar sans rappeler l'API
        highlightActiveFile();
    } catch (err) {
        jsonViewerEl.textContent = `Erreur : ${err.message}`;
        console.error(err);
    }
}

// --- CRÉER UN FICHIER ---
createFileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const filenameInput = document.getElementById('new-filename');
    let filename = filenameInput.value.trim();
    if (!filename.endsWith('.json')) filename += '.json';

    try {
        await fetch(`${API_URL}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        
        filenameInput.value = "";
        await fetchFiles();
        await fetchFileContent(filename);
    } catch (err) {
        console.error("Erreur de création:", err);
    }
});

// --- SUPPRIMER UN FICHIER ---
async function deleteFile(filename, e) {
    if (e) e.stopPropagation(); // Évite d'ouvrir le fichier en même temps qu'on clique sur supprimer
    if (!confirm(`Supprimer définitivement ${filename} ?`)) return;
    
    try {
        await fetch(`${API_URL}/files/${filename}`, { method: 'DELETE' });
        
        if (currentFile === filename) {
            currentFile = null;
            currentFileDisplay.textContent = "Sélectionne un fichier";
            jsonViewerEl.textContent = '{"status": "Sélectionne un fichier pour voir son contenu"}';
            arrayLengthEl.textContent = "Taille: 0";
            insertBtn.disabled = true;
        }
        fetchFiles();
    } catch (err) {
        console.error("Erreur de suppression:", err);
    }
}

// --- INSÉRER UNE DONNÉE ---
insertForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentFile) return;

    const keyInput = document.getElementById('insert-key');
    const valueInput = document.getElementById('insert-value');

    insertBtn.textContent = "⏳...";
    insertBtn.disabled = true;
    
    try {
        const res = await fetch(`${API_URL}/insert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                filename: currentFile, 
                key: keyInput.value, 
                value: valueInput.value 
            })
        });

        if (!res.ok) throw new Error("Échec d'insertion");
        
        keyInput.value = "";
        valueInput.value = "";
        
        await fetchFileContent(currentFile);
    } catch (err) {
        console.error("Erreur d'insertion:", err);
        alert("Erreur lors de l'insertion.");
    } finally {
        insertBtn.textContent = "Insérer";
        insertBtn.disabled = false;
    }
});

// --- GESTION DU RENDU DE LA LISTE ---
function renderFileList(files) {
    fileListEl.innerHTML = '';
    
    if (!Array.isArray(files) || files.length === 0) {
        fileListEl.innerHTML = '<p class="text-gray-500 text-sm italic p-2">Aucun fichier trouvé.</p>';
        return;
    }

    files.forEach(file => {
        const isActive = file === currentFile;
        const div = document.createElement('div');
        div.dataset.filename = file;
        div.className = `file-item group flex justify-between items-center p-3 mb-2 rounded cursor-pointer transition ${isActive ? 'bg-blue-900 border border-blue-700' : 'bg-gray-800 hover:bg-gray-700 border border-transparent'}`;
        
        div.innerHTML = `
            <div class="flex items-center gap-2 overflow-hidden w-full">
                <span class="text-lg">📄</span>
                <span class="truncate text-sm ${isActive ? 'text-white font-bold' : 'text-gray-300 group-hover:text-white'}">${file}</span>
            </div>
            <button class="delete-btn text-gray-500 hover:text-red-500 px-2 py-1 opacity-0 group-hover:opacity-100 transition" title="Supprimer">
                ✕
            </button>
        `;

        div.addEventListener('click', () => fetchFileContent(file));
        div.querySelector('.delete-btn').addEventListener('click', (e) => deleteFile(file, e));

        fileListEl.appendChild(div);
    });
}

function highlightActiveFile() {
    document.querySelectorAll('.file-item').forEach(el => {
        const isMatch = el.dataset.filename === currentFile;
        el.className = `file-item group flex justify-between items-center p-3 mb-2 rounded cursor-pointer transition ${isMatch ? 'bg-blue-900 border border-blue-700' : 'bg-gray-800 hover:bg-gray-700 border border-transparent'}`;
    });
}