/**
 * Base API URL. Same origin when UI is served by Fastify.
 * Override with ?api=http://127.0.0.1:3001 if needed.
 */
const params = new URLSearchParams(window.location.search);

export const API_BASE = (
  params.get("api") ||
  window.localStorage.getItem("cachelab.api") ||
  window.location.origin
).replace(/\/$/, "");

if (params.get("api")) {
  window.localStorage.setItem("cachelab.api", API_BASE);
}
