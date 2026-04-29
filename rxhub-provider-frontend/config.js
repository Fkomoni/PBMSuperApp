// ═════════════════════════════════════════════════════════════════════
//  EDIT THIS FILE BEFORE DEPLOYMENT
// ═════════════════════════════════════════════════════════════════════

// 1. Backend API URL — with "/api/v1" at the end. Example:
//      "https://rxhub-api-prod.azurewebsites.net/api/v1"
window.__API_BASE__ = "https://rxhub-provider-api.onrender.com/api/v1";

// 2. Embed-only mode. MUST stay true in production — the portal is
//    reachable only from the Leadway provider dashboard (via a one-time
//    ticket). Direct visitors land on a branded "open from your
//    dashboard" block. Admins can still sign in directly by appending
//    ?admin=1 to the URL.
//    Set to false ONLY for local development or staging where direct
//    provider login is acceptable.
window.__REQUIRE_EMBED__ = true;
