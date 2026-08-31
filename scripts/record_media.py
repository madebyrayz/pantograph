#!/usr/bin/env python3
"""Record landing-page media from a live Rhino session.

Requires Rhino 8 open with rhino_side/pantograph_listener.py running.
Works on a dedicated layer far from the origin, saves the camera, and
cleans everything up afterwards — your document's own geometry and
layers are untouched.

Usage:
    python3 scripts/record_media.py --studies   # capture parametric study stills
    python3 scripts/record_media.py --gif       # record the tower-build GIF
    python3 scripts/record_media.py --all

GIF assembly needs pillow:
    python3 -m venv .venv && .venv/bin/pip install pillow
    .venv/bin/python scripts/record_media.py --all
"""

import argparse
import json
import os
import shutil
import socket
import sys
import time

HOST, PORT = "127.0.0.1", 9877
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAPTURE_SRC = os.path.expanduser("~/.pantograph_viewport.png")
STUDY_DIR = os.path.join(ROOT, "public", "landing", "studies")
GIF_PATH = os.path.join(ROOT, "public", "landing", "demo-session.gif")

LAYER = "PANTOGRAPH_CAPTURE"
OX, OY = 100000, 100000  # build far from the user's model

SETUP = f"""
if not rs.IsLayer("{LAYER}"):
    rs.AddLayer("{LAYER}")
rs.CurrentLayer("{LAYER}")
"""

ZOOM = f"""
objs = rs.ObjectsByLayer("{LAYER}")
if objs:
    bb = rs.BoundingBox(objs)
    if bb:
        rs.ZoomBoundingBox(bb)
"""

CLEAR = f"""
objs = rs.ObjectsByLayer("{LAYER}")
if objs:
    rs.DeleteObjects(objs)
"""

TEARDOWN = f"""
objs = rs.ObjectsByLayer("{LAYER}")
if objs:
    rs.DeleteObjects(objs)
rs.CurrentLayer("Default")
rs.PurgeLayer("{LAYER}")
"""

STUDIES = {
    "sphere-grid": f"""
import random
random.seed(7)
for i in range(10):
    for j in range(10):
        rs.AddSphere([{OX} + i*10, {OY} + j*10, 0], random.uniform(1.5, 4.5))
""",
    "twist-tower": f"""
for i in range(40):
    plane = rs.MovePlane(rs.WorldXYPlane(), [{OX}, {OY}, i*3.5])
    crv = rs.AddRectangle(plane, 12, 12)
    rs.RotateObject(crv, [{OX}+6, {OY}+6, i*3.5], i*2.5)
    rs.AddPlanarSrf(crv)
""",
    "sine-field": f"""
import math
for i in range(15):
    for j in range(15):
        h = 6 + 5 * math.sin(i*0.5) * math.cos(j*0.5)
        rs.AddCylinder(rs.MovePlane(rs.WorldXYPlane(), [{OX}+i*8, {OY}+j*8, 0]), h, 2.4)
""",
    "lofted-vase": f"""
radii = [10, 14, 8, 5, 9, 7]
crvs = []
for k, r in enumerate(radii):
    crvs.append(rs.AddCircle(rs.MovePlane(rs.WorldXYPlane(), [{OX}, {OY}, k*8]), r))
srf = rs.AddLoftSrf(crvs)
rs.DeleteObjects(crvs)
""",
    "attractor-grid": f"""
import math
for i in range(12):
    for j in range(12):
        d = math.hypot(i*10 - 30, j*10 - 30)
        r = max(0.8, 4.5 - d * 0.035)
        rs.AddSphere([{OX}+i*10, {OY}+j*10, 0], r)
""",
    "radial-array": f"""
import math
for k in range(24):
    a = k * 15.0
    s = 3 + k * 0.28
    x = {OX} + 60 * math.cos(math.radians(a))
    y = {OY} + 60 * math.sin(math.radians(a))
    box = rs.AddBox([[x-s/2,y-s/2,0],[x+s/2,y-s/2,0],[x+s/2,y+s/2,0],[x-s/2,y+s/2,0],
                     [x-s/2,y-s/2,s*2],[x+s/2,y-s/2,s*2],[x+s/2,y+s/2,s*2],[x-s/2,y+s/2,s*2]])
    rs.RotateObject(box, [x, y, 0], a)
""",
}


def call(msg_type, params=None, timeout=90):
    with socket.create_connection((HOST, PORT), timeout=timeout) as s:
        s.sendall((json.dumps({"type": msg_type, "params": params or {}}) + "\n").encode())
        buf = b""
        while b"\n" not in buf:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
    reply = json.loads(buf.split(b"\n", 1)[0])
    if reply.get("status") != "success":
        raise RuntimeError(reply.get("message", "rhino error"))
    return reply.get("result")


def execute(code):
    return call("execute_code", {"code": code})


def capture(dest):
    call("capture_viewport")
    time.sleep(0.3)
    shutil.copyfile(CAPTURE_SRC, dest)
    print(f"  captured → {os.path.relpath(dest, ROOT)}")


def save_camera():
    return execute("""
view = sc.doc.Views.ActiveView
vp = view.ActiveViewport
print("%r|%r" % ((vp.CameraLocation.X, vp.CameraLocation.Y, vp.CameraLocation.Z),
                 (vp.CameraTarget.X, vp.CameraTarget.Y, vp.CameraTarget.Z)))
""").strip()


def restore_camera(saved):
    cam, target = saved.split("|")
    execute(f"rs.ViewCameraTarget(None, {cam}, {target})")


def record_studies():
    os.makedirs(STUDY_DIR, exist_ok=True)
    execute(SETUP)
    for key, code in STUDIES.items():
        print(f"study: {key}")
        execute(CLEAR)
        execute(code)
        execute(ZOOM)
        time.sleep(0.4)
        capture(os.path.join(STUDY_DIR, f"{key}.png"))


def record_gif(frames_per_step=2):
    from PIL import Image  # pillow required for assembly

    tmp = os.path.join(ROOT, "scripts", ".gif_frames")
    os.makedirs(tmp, exist_ok=True)
    execute(SETUP)
    execute(CLEAR)

    # frame the finished tower first so the camera doesn't jump
    execute(STUDIES["twist-tower"])
    execute(ZOOM)
    execute(CLEAR)

    frames = []
    step = 2  # floors added per frame
    for f in range(0, 40, step):
        execute(f"""
for i in range({f}, {f + step}):
    plane = rs.MovePlane(rs.WorldXYPlane(), [{OX}, {OY}, i*3.5])
    crv = rs.AddRectangle(plane, 12, 12)
    rs.RotateObject(crv, [{OX}+6, {OY}+6, i*3.5], i*2.5)
    rs.AddPlanarSrf(crv)
""")
        path = os.path.join(tmp, f"frame_{f:03d}.png")
        capture(path)
        frames.append(path)

    print("assembling gif…")
    imgs = []
    for p in frames:
        im = Image.open(p).convert("RGB")
        im.thumbnail((960, 960))
        imgs.append(im)
    durations = [120] * len(imgs)
    durations[-1] = 1800  # hold the finished tower
    imgs[0].save(
        GIF_PATH, save_all=True, append_images=imgs[1:],
        duration=durations, loop=0, optimize=True,
    )
    shutil.rmtree(tmp)
    print(f"  gif → {os.path.relpath(GIF_PATH, ROOT)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--studies", action="store_true")
    ap.add_argument("--gif", action="store_true")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    if not (args.studies or args.gif or args.all):
        ap.error("pass --studies, --gif, or --all")

    try:
        call("ping", timeout=5)
    except OSError:
        sys.exit("Rhino unreachable — open Rhino 8 and run "
                 "rhino_side/pantograph_listener.py in the Script Editor first.")

    saved = save_camera()
    try:
        if args.studies or args.all:
            record_studies()
        if args.gif or args.all:
            record_gif()
    finally:
        execute(TEARDOWN)
        restore_camera(saved)
        print("cleaned up — document restored.")


if __name__ == "__main__":
    main()
