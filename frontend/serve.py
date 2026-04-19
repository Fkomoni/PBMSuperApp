"""Tiny dev server so the Babel-in-browser JSX can load via file URLs cleanly.

Usage:
    cd frontend && python serve.py 5173
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".jsx": "text/babel", ".js": "application/javascript"}

    # Bind to loopback only so this dev server isn't reachable from the LAN.
    # No wildcard CORS — the portal and API share an origin in production, and
    # for local dev the backend's CORS_ORIGINS env var is the single source
    # of truth for cross-origin access.
    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    with ThreadingHTTPServer(("127.0.0.1", port), Handler) as s:
        print(f"Provider portal serving on http://127.0.0.1:{port}")
        s.serve_forever()
