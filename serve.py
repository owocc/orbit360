#!/usr/bin/env python3
"""静态服务器：多线程，允许局域网手机访问。用法: python3 serve.py [port]"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787


class Handler(http.server.SimpleHTTPRequestHandler):
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
