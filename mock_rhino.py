#!/usr/bin/env python3
"""Mock Rhino listener for developing Pantograph without Rhino open.

Speaks the same newline-delimited JSON protocol as pantograph_listener.py
on port 9878 (run the backend with PANTOGRAPH_RHINO_PORT=9878). It logs
every command it receives and returns canned results.
"""

import json
import os
import socket
import threading

HOST = "127.0.0.1"
PORT = int(os.environ.get("PANTOGRAPH_MOCK_PORT", "9878"))


def handle(conn):
    buf = b""
    while True:
        chunk = conn.recv(65536)
        if not chunk:
            break
        buf += chunk
        while b"\n" in buf:
            line, buf = buf.split(b"\n", 1)
            if not line.strip():
                continue
            msg = json.loads(line)
            print("<< received:", json.dumps(msg)[:400], flush=True)
            t = msg.get("type")
            if t == "execute_code":
                result = "(mock) code executed:\n" + msg["params"]["code"][:200]
            elif t == "get_scene_info":
                result = {"document": "(mock)", "unit_system": "Millimeters",
                          "layers": ["Default"], "object_count": 0, "objects": []}
            elif t == "capture_viewport":
                result = {"path": "/nonexistent-mock.png"}
            else:
                result = "pong"
            conn.sendall((json.dumps({"status": "success", "result": result}) + "\n").encode())
    conn.close()


srv = socket.socket()
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind((HOST, PORT))
srv.listen(4)
print(f"mock rhino listening on {HOST}:{PORT}", flush=True)
while True:
    c, _ = srv.accept()
    threading.Thread(target=handle, args=(c,), daemon=True).start()
