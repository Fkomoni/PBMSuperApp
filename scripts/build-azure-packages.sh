#!/usr/bin/env bash
# Rebuild the two Azure-ready zip packages from the current source.
# Run from the repo root:  bash scripts/build-azure-packages.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$(mktemp -d)"
OUT="$REPO_ROOT/releases"

mkdir -p "$OUT"
mkdir -p "$STAGE/backend-azure-deploy"
mkdir -p "$STAGE/frontend-azure-deploy"

echo "➜ Staging backend…"
cp -r "$REPO_ROOT/rxhub-provider-backend/." "$STAGE/backend-azure-deploy/"
# Rename .env.example → .env (the file the app actually loads) and
# make sure only one of them ends up in the final zip.
cp "$STAGE/backend-azure-deploy/.env.example" "$STAGE/backend-azure-deploy/.env"
rm -f "$STAGE/backend-azure-deploy/.env.example"

echo "➜ Staging frontend…"
cp -r "$REPO_ROOT/rxhub-provider-frontend/." "$STAGE/frontend-azure-deploy/"
cat > "$STAGE/frontend-azure-deploy/config.js" <<'EOF'
// ═════════════════════════════════════════════════════════════════════
//  EDIT THIS FILE BEFORE DEPLOYMENT
// ═════════════════════════════════════════════════════════════════════

// 1. Backend API URL — with "/api/v1" at the end.
//    Example: "https://rxhub-api-prod.azurewebsites.net/api/v1"
window.__API_BASE__ = "https://REPLACE-WITH-YOUR-BACKEND-URL.azurewebsites.net/api/v1";

// 2. Embed-only mode. MUST stay true in production — the portal is
//    reachable only from the Leadway provider dashboard (via a one-time
//    ticket). Direct visitors land on a branded "open from your
//    dashboard" block. Admins can still sign in directly by appending
//    ?admin=1 to the URL.
//    Set to false ONLY for local development or staging where direct
//    provider login is acceptable.
window.__REQUIRE_EMBED__ = true;
EOF

# Remove any existing zips so `zip` doesn't append to them — otherwise
# stale files (e.g. a .env.example we intentionally dropped) linger.
rm -f "$OUT/backend-azure-deploy.zip" "$OUT/frontend-azure-deploy.zip"

echo "➜ Zipping backend…"
( cd "$STAGE/backend-azure-deploy" && \
  zip -qr "$OUT/backend-azure-deploy.zip" . \
    -x "__pycache__/*" "*.pyc" "*/__pycache__/*" )

echo "➜ Zipping frontend…"
( cd "$STAGE/frontend-azure-deploy" && \
  zip -qr "$OUT/frontend-azure-deploy.zip" . )

rm -rf "$STAGE"
echo
echo "✓ Packages ready:"
ls -lh "$OUT"/*.zip
