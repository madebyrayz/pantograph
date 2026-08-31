#!/usr/bin/env python3
"""Record the F0 moment: a parameter edit propagating through the
definition graph into live Rhino geometry, frame by frame, into a GIF.

Drives the REAL pipeline — each frame is: POST setParam -> POST execute
(compile -> Rhino -> viewport capture) -> collect frame. No fakery.

Requires: app running (pnpm dev), Rhino listener live, pillow
(.venv/bin/python scripts/record_param_sweep.py).

    record_param_sweep.py [node] [param] [start] [end] [steps] [out.gif]

Defaults sweep the tower's twist: twist.factor 0 -> 5 in 20 steps.
"""

import json
import os
import shutil
import sys
import time
import urllib.request

APP = "http://127.0.0.1:%s" % os.environ.get("PANTOGRAPH_APP_PORT", "3000")
CAPTURE = os.path.expanduser("~/.pantograph_viewport.png")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def post(path, body):
    req = urllib.request.Request(
        APP + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())


def main():
    node = sys.argv[1] if len(sys.argv) > 1 else "twist"
    param = sys.argv[2] if len(sys.argv) > 2 else "factor"
    start = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    end = float(sys.argv[4]) if len(sys.argv) > 4 else 5.0
    steps = int(sys.argv[5]) if len(sys.argv) > 5 else 20
    out = sys.argv[6] if len(sys.argv) > 6 else os.path.join(
        ROOT, "public", "landing", "demo-session.gif")

    frames_dir = os.path.join(ROOT, "scripts", ".gif_frames")
    os.makedirs(frames_dir, exist_ok=True)
    frames = []

    for i in range(steps + 1):
        value = start + (end - start) * i / steps
        post("/api/graph", {"mutation": {
            "type": "setParam", "node": node, "name": param, "value": round(value, 3)}})
        result = post("/api/graph/execute", {"capture": True})
        if not result.get("ok"):
            sys.exit("execute failed at %s=%s: %s" % (param, value, result))
        time.sleep(0.25)
        frame = os.path.join(frames_dir, "f%03d.png" % i)
        shutil.copyfile(CAPTURE, frame)
        frames.append(frame)
        print("frame %d/%d  %s.%s = %.2f" % (i + 1, steps + 1, node, param, value))

    from PIL import Image
    imgs = []
    for p in frames:
        im = Image.open(p).convert("RGB")
        im.thumbnail((960, 960))
        imgs.append(im)
    durations = [130] * len(imgs)
    durations[0] = 800
    durations[-1] = 1600
    imgs[0].save(out, save_all=True, append_images=imgs[1:],
                 duration=durations, loop=0, optimize=True)
    shutil.rmtree(frames_dir)
    size = os.path.getsize(out) // 1024
    print("gif -> %s (%d KB, %d frames)" % (os.path.relpath(out, ROOT), size, len(imgs)))


if __name__ == "__main__":
    main()
