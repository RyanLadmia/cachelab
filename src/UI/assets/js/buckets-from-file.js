/**
 * Transforme le JSON brut d'un fichier hashmap (tableau de buckets)
 * en snapshot compatible avec la visualisation front.
 */
export function snapshotFromCollection(collection) {
  if (!Array.isArray(collection)) {
    throw new Error("Format de fichier invalide (tableau attendu)");
  }

  let collisions = 0;
  let occupied = 0;
  let load = 0;

  const buckets = collection.map((bucket, index) => {
    if (bucket === null || bucket === undefined) {
      return { index, type: "empty", entries: [] };
    }

    occupied += 1;

    if (Array.isArray(bucket)) {
      collisions += 1;
      load += bucket.length;
      return {
        index,
        type: "collision",
        entries: bucket.map((entry) => ({
          key: entry.key,
          value: entry.value,
        })),
      };
    }

    load += 1;
    return {
      index,
      type: "single",
      entries: [{ key: bucket.key, value: bucket.value }],
    };
  });

  const length = collection.length;
  const loadFactor = 0.75;

  return {
    length,
    load,
    loadFactor,
    loadLimit: length * loadFactor,
    occupied,
    collisions,
    buckets,
  };
}
