// Provider API client — wraps the existing Leadway Rx Routing Hub endpoints.
// Keeps one concern: HTTP + token. No UI. All fetchers return JSON or throw Error.

const API_BASE = window.__API_BASE__ || "https://leadway-rx-api.onrender.com/api/v1";

const TOKEN_KEY = "rx.provider.token";
const SESSION_KEY = "rx.provider.session";

// sessionStorage is tab-scoped and cleared when the tab closes — tokens are
// not accessible to scripts injected by XSS from other tabs and are not
// persisted to disk after the session ends. localStorage would expose the
// token to any XSS payload indefinitely.
function getToken() { return sessionStorage.getItem(TOKEN_KEY); }
function setToken(t) { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); }

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function setSession(s) {
  if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(SESSION_KEY);
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
  logout: async () => {
    // Tell the server to revoke the token (blocklist the jti).
    // Discard local state regardless of whether the server call succeeds.
    try { await request("/logout", { method: "POST" }); } catch (_) {}
    setToken(null);
    setSession(null);
  },

  // Parent-app handoff: pass either a Prognosis bearer (prognosis_token) or
  // { email, parent_shared_secret } that matches the backend's EMBED_SHARED_SECRET.
  // Returns the same payload shape as /login and stores the token + session.
  exchange: async (body) => {
    const data = await request("/auth/session-exchange", { method: "POST", body });
    if (data && data.token) setToken(data.token);
    if (data && data.provider) setSession({ role: "provider", ...data.provider });
    return data;
  },

  // Redeem a one-time embed-login ticket for the real JWT. The ticket
  // arrives as a ?ticket= URL param from the parent app's iframe src.
  // Single-use: a second redemption of the same ticket 401s.
  redeemTicket: async (ticket) => {
    const data = await request("/auth/redeem-ticket", { method: "POST", body: { ticket } });
    if (data && data.token) setToken(data.token);
    if (data && data.provider) setSession({ role: data.provider.role || "provider", ...data.provider });
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

  listAttachments: (id) => request(`/medication-requests/${id}/attachments`),
  // Upload a prescription file. Pass the original File object; we build the
  // multipart form and stamp the bearer token manually so it doesn't pass
  // through the json-defaulting `request()` helper.
  uploadAttachment: async (id, file) => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`${API_BASE}/medication-requests/${id}/attachments`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!r.ok) {
      let msg = `Upload failed (${r.status})`;
      try { const j = await r.json(); msg = j.detail || j.message || msg; } catch {}
      throw new Error(msg);
    }
    return r.json();
  },
  attachmentUrl: (reqId, attId) => `${API_BASE}/medication-requests/${reqId}/attachments/${attId}`,
  // Opens an attachment in a new tab using the bearer token. Falls back to
  // the raw URL if blob creation fails (e.g. cross-origin quirks).
  openAttachment: async (reqId, attId) => {
    const token = getToken();
    const r = await fetch(`${API_BASE}/medication-requests/${reqId}/attachments/${attId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) throw new Error(`Download failed (${r.status})`);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    // Revoke a few minutes later so the tab has time to render.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return w;
  },

  summary: (days = 30) => request("/admin/summary", { query: { days } }),

  listPharmacies: (state, lga) => request("/pharmacies", { query: { state, lga, limit: 500 } }),

  // Admin-only
  admin: {
    listRequests: (params = {}) => request("/admin/requests", { query: params }),
    requestDetail: (id) => request(`/admin/requests/${id}`),
    summary: (days = 30) => request("/admin/summary", { query: { days } }),
    listProviders: () => request("/admin/providers"),
    refreshStatus: (id) => request(`/admin/requests/${id}/refresh-status`, { method: "POST" }),
  },
};

window.providerApi = api;
window.providerAuth = { getToken, setToken, getSession, setSession };
