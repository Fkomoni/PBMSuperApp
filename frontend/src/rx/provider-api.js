// Provider API client — wraps the existing Leadway Rx Routing Hub endpoints.
// Keeps one concern: HTTP + token. No UI. All fetchers return JSON or throw Error.

// API base must be set by config.js for every deployment. We refuse to fall
// back to a hardcoded hostname because:
//   * A lapsed "leadway-rx-api.onrender.com" sub-domain could be re-claimed
//     by an attacker and silently receive every provider's JWTs + PHI.
//   * Mis-configured deploys should fail loudly, not cross-contaminate.
const API_BASE = window.__API_BASE__;
if (!API_BASE) {
  throw new Error("frontend/config.js did not set window.__API_BASE__");
}

const TOKEN_KEY = "rx.provider.token";
const SESSION_KEY = "rx.provider.session";

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function setSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

async function request(path, { method = "GET", body, query } = {}) {
  let url = API_BASE + path;
  if (query) {
    const usp = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    const s = usp.toString();
    if (s) url += (url.includes("?") ? "&" : "?") + s;
  }
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  const tok = getToken();
  if (tok) headers.Authorization = "Bearer " + tok;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : null;
  if (!res.ok) {
    const msg = (data && (data.detail || data.message || data.error)) || `Request failed (${res.status})`;
    const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

const api = {
  getSession,
  getToken,
  login: async ({ email, password }) => {
    const data = await request("/login", { method: "POST", body: { email, password } });
    if (data && data.token) setToken(data.token);
    if (data && data.provider) setSession({ role: "provider", ...data.provider });
    return data;
  },
  logout: () => { setToken(null); setSession(null); },

  // Parent-app handoff: pass either a Prognosis bearer (prognosis_token) or
  // { email, parent_shared_secret } that matches the backend's EMBED_SHARED_SECRET.
  // Returns the same payload shape as /login and stores the token + session.
  exchange: async (body) => {
    const data = await request("/auth/session-exchange", { method: "POST", body });
    if (data && data.token) setToken(data.token);
    if (data && data.provider) setSession({ role: "provider", ...data.provider });
    return data;
  },

  lookupEnrollee: (enrolleeId) => request("/lookup/enrollee", { query: { enrollee_id: enrolleeId } }),
  lookupDiagnoses: (q) => request("/lookup/diagnoses", { query: { q } }),
  searchMedications: (q) => request("/medications/search", { query: { q } }),
  addressAutocomplete: (input) => request("/lookup/address-autocomplete", { query: { input } }),
  addressDetails: (placeId) => request("/lookup/address-details", { query: { place_id: placeId } }),

  submitRequest: (payload) => request("/medication-requests", { method: "POST", body: payload }),
  listRequests: (params = {}) => request("/medication-requests", { query: params }),
  getTracking: (id) => request(`/medication-requests/${id}/tracking`),

  summary: (days = 30) => request("/reports/summary", { query: { days } }),

  // Admin-only
  admin: {
    listRequests: (params = {}) => request("/admin/requests", { query: params }),
    requestDetail: (id) => request(`/admin/requests/${id}`),
    summary: (days = 30) => request("/admin/summary", { query: { days } }),
    listProviders: () => request("/admin/providers"),
  },
};

window.providerApi = api;
window.providerAuth = { getToken, setToken, getSession, setSession };
