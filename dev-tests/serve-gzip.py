"""
Development helper (not shipped to customers).

A tiny static server that behaves like typical production hosting: it gzips text files and sends
long-lived cache headers for assets. Useful for realistic Lighthouse measurements, because
`python -m http.server` sends everything uncompressed.

Usage (from the template folder):
    python dev-tests/serve-gzip.py 8126
"""
import gzip
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8126
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEXT_TYPES = (".html", ".css", ".js", ".svg", ".txt", ".json")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        path = self.path.split("?")[0]
        if path.endswith(".html") or path.endswith("/"):
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()

    def do_GET(self):
        path = self.translate_path(self.path.split("?")[0])
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "")
        if accepts_gzip and path.endswith(TEXT_TYPES) and os.path.isfile(path):
            with open(path, "rb") as handle:
                body = gzip.compress(handle.read(), 6)
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"Serving {ROOT} with gzip on http://127.0.0.1:{PORT}")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
