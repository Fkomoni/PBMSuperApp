"""Tiny dev server so the Babel-in-browser JSX can load via file URLs cleanly.

Usage:
    cd frontend && python serve.py 5173
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".jsx": "text/babel", ".js": "application/javascript"}

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    with ThreadingHTTPServer(("0.0.0.0", port), Handler) as s:
        print(f"Provider portal serving on http://localhost:{port}")
        s.serve_forever()
