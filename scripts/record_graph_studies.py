#!/usr/bin/env python3
"""Record every parametric study THROUGH the real pipeline: build the
study's definition graph via the app API, perform it in live Rhino,
zoom to the result, capture, and save the still for the landing page.

Requires: app running (pnpm dev) and the Rhino listener live.

    python3 scripts/record_graph_studies.py [key ...]   # default: all
"""

import json
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

APP = "http://127.0.0.1:%s" % os.environ.get("PANTOGRAPH_APP_PORT", "3000")
RHINO = ("127.0.0.1", int(os.environ.get("PANTOGRAPH_RHINO_PORT", "9877")))
CAPTURE = os.path.expanduser("~/.pantograph_viewport.png")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "landing", "studies")


def api(method, path, body=None):
    req = urllib.request.Request(
        APP + path, data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(req, timeout=240) as r:
        return json.loads(r.read())


def rhino(t, p=None):
    s = socket.create_connection(RHINO, timeout=120)
    s.sendall((json.dumps({"type": t, "params": p or {}}) + "\n").encode())
    buf = b""
    while b"\n" not in buf:
        c = s.recv(65536)
        if not c:
            break
        buf += c
    s.close()
    reply = json.loads(buf.split(b"\n", 1)[0])
    if reply.get("status") != "success":
        raise RuntimeError(reply.get("message"))
    return reply.get("result")


def main():
    with open(os.path.join(ROOT, "lib", "graph", "studies.json")) as f:
        studies = json.load(f)["studies"]
    wanted = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)

    for study in studies:
        if wanted and study["key"] not in wanted:
            continue
        key = study["key"]
        print("study:", key)
        api("DELETE", "/api/graph")
        result = api("POST", "/api/graph", {"mutations": study["mutations"]})
        if not result["ok"]:
            sys.exit("  mutation rejected: %s" % result["results"][-1].get("rejected"))
        run = api("POST", "/api/graph/execute", {"capture": False})
        if not run.get("ok"):
            sys.exit("  execute failed: %s" % run)
        rhino("execute_code", {"code": 'rs.ZoomExtents()'})
        time.sleep(0.3)
        rhino("capture_viewport")
        time.sleep(0.3)
        dest = os.path.join(OUT, "%s.jpg" % key)
        tmp = dest + ".png"
        shutil.copyfile(CAPTURE, tmp)
        subprocess.run(
            ["sips", "-Z", "1200", "-s", "format", "jpeg",
             "-s", "formatOptions", "85", tmp, "--out", dest],
            check=True, capture_output=True)
        os.remove(tmp)
        print("  captured -> %s" % os.path.relpath(dest, ROOT))

    print("done — %d studies recorded" % (len(wanted) or len(studies)))


if __name__ == "__main__":
    main()
