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
cp -r "$REPO_ROOT/backend/." "$STAGE/backend-azure-deploy/"
cp "$REPO_ROOT/backend/.env.example" "$STAGE/backend-azure-deploy/.env"

echo "➜ Staging frontend…"
cp -r "$REPO_ROOT/frontend/." "$STAGE/frontend-azure-deploy/"
cat > "$STAGE/frontend-azure-deploy/config.js" <<'EOF'
// ═════════════════════════════════════════════════════════════════════
//  EDIT THIS FILE BEFORE DEPLOYMENT
// ═════════════════════════════════════════════════════════════════════
//  Replace the URL below with YOUR backend's Azure App Service URL,
//  with "/api/v1" appended at the end. Example:
//
//    window.__API_BASE__ = "https://rxhub-api-prod.azurewebsites.net/api/v1";
//
//  This is the ONLY file you need to edit in the frontend package.
// ═════════════════════════════════════════════════════════════════════

window.__API_BASE__ = "https://REPLACE-WITH-YOUR-BACKEND-URL.azurewebsites.net/api/v1";
EOF

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
