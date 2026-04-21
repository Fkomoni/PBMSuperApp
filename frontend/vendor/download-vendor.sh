#!/usr/bin/env bash
# Run this once to download all vendor scripts into frontend/vendor/.
# After running, commit the downloaded files to the repo so they are
# served locally (no CDN dependency at runtime).
set -euo pipefail
cd "$(dirname "$0")"

DL() { curl -fsSL "$1" -o "$2" && echo "OK  $2"; }

DL "https://unpkg.com/react@18.3.1/umd/react.production.min.js"      react.production.min.js
DL "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" react-dom.production.min.js
DL "https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"          babel.min.js
DL "https://unpkg.com/lucide@0.475.0/dist/umd/lucide.min.js"          lucide.min.js

echo ""
echo "Done. Commit vendor/*.js to the repo — index.html will serve them locally."
