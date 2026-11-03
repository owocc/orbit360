#!/usr/bin/env python3
"""HTTPS 静态服务器（陀螺仪在手机上必须走安全上下文）。

用法: python3 scripts/serve_tls.py [port]
首次运行会用 openssl 生成自签证书 ./certs/dev.{crt,key}，SAN 覆盖本机局域网 IP。
手机首次访问会提示"不安全"，选择继续访问即可。
"""
import http.server
import os
import socket
import socketserver
import ssl
import subprocess
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8443
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CERT_DIR = os.path.join(ROOT, "certs")
CRT = os.path.join(CERT_DIR, "dev.crt")
KEY = os.path.join(CERT_DIR, "dev.key")


def lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


IP = lan_ip()


def ensure_cert() -> None:
    if os.path.exists(CRT) and os.path.exists(KEY):
        return
    os.makedirs(CERT_DIR, exist_ok=True)
    subprocess.run(
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", KEY, "-out", CRT, "-days", "825",
            "-subj", "/CN=orbit360.local",
            "-addext", f"subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{IP}",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"已生成自签证书: {CRT}")


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128


ensure_cert()
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(CRT, KEY)

with Server(("0.0.0.0", PORT), Handler) as httpd:
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"桌面: https://localhost:{PORT}/")
    print(f"手机: https://{IP}:{PORT}/   (同一 Wi-Fi，证书警告点继续)")
    httpd.serve_forever()
