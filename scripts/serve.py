#!/usr/bin/env python3
"""静态服务器：多线程，允许局域网手机访问。用法: python3 scripts/serve.py [port]"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "dist")
if not os.path.isfile(os.path.join(SITE, "index.html")):
    print("找不到 dist/index.html：先运行 npm run build", file=sys.stderr)
    sys.exit(1)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=SITE, **kw)

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128


with Server(("0.0.0.0", PORT), Handler) as httpd:
    print(f"http://127.0.0.1:{PORT}/  (LAN: http://<本机IP>:{PORT}/)")
    httpd.serve_forever()
