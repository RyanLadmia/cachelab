import { API_BASE } from "./config.js";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...options,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) ||
      `Erreur HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  health() {
    return request("/health");
  },

  // --- ROUTES D'AGRÉGATEUR ---
  createCollection(name, isPersistent) {
    return request("/api/collections", {
      method: "POST",
      body: JSON.stringify({ name, isPersistent }),
    });
  },

  // --- ROUTES SPÉCIFIQUES AUX COLLECTIONS ---
  // Nous passons maintenant le paramètre 'collection' (qui vaut 'cache' par défaut)

  getAllKeys(collection = "cache") {
    return request(`/api/${encodeURIComponent(collection)}/keys`);
  },

  getBuckets(collection = "cache") {
    return request(`/api/${encodeURIComponent(collection)}/buckets`);
  },

  getOne(collection = "cache", key) {
    return request(`/api/${encodeURIComponent(collection)}/keys/${encodeURIComponent(key)}`);
  },

  create(collection = "cache", key, value) {
    return request(`/api/${encodeURIComponent(collection)}/keys`, {
      method: "POST",
      body: JSON.stringify({ key, value }),
    });
  },

  update(collection = "cache", key, value) {
    return request(`/api/${encodeURIComponent(collection)}/keys/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  },

  remove(collection = "cache", key) {
    return request(`/api/${encodeURIComponent(collection)}/keys/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  },

  listFiles() {
    return request("/api/files");
  },

  getFile(name) {
    return request(`/api/files/${encodeURIComponent(name)}`);
  },

  createFile(filename) {
    return request("/api/files", {
      method: "POST",
      body: JSON.stringify({ filename }),
    });
  },

  deleteFile(name) {
    return request(`/api/files/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  },

  insertIntoFile(filename, key, value) {
    return request("/api/insert", {
      method: "POST",
      body: JSON.stringify({ filename, key, value }),
    });
  },

  generateSeed(numberOfInsertion) {
    return request(
      `/data-seeder?numberOfInsertion=${encodeURIComponent(numberOfInsertion)}`
    );
  },

  runSeed() {
    return request("/seed");
  },
};
