#! python 3
"""Pantograph — Rhino-side listener.

Run this inside Rhino 8's Script Editor (type `ScriptEditor` in the Rhino
command line, open this file, press the green Run button).

It starts a small TCP server on 127.0.0.1:9877. The Pantograph MCP server
connects to it and sends JSON commands; code is executed on Rhino's UI
thread with `rhinoscriptsyntax` available as `rs`.

Protocol: one JSON object per line in, one JSON object per line out.
  in:  {"type": "execute_code", "params": {"code": "..."}}
  out: {"status": "success", "result": "..."} or {"status": "error", "message": "..."}
"""

import json
import socket
import threading
import traceback
import io
import os
import sys
import contextlib

import rhinoscriptsyntax as rs
import scriptcontext as sc
import Rhino
import System

HOST = "127.0.0.1"
PORT = 9877


def _run_on_ui_thread(fn):
    """Execute fn on Rhino's UI thread and return its result (or raise)."""
    done = threading.Event()
    box = {}

    def wrapper():
        try:
            box["result"] = fn()
        except Exception as e:
            box["error"] = e
            box["tb"] = traceback.format_exc()
        finally:
            done.set()

    Rhino.RhinoApp.InvokeOnUiThread(System.Action(wrapper))
    if not done.wait(60):
        raise RuntimeError("Timed out waiting for Rhino UI thread (60s)")
    if "error" in box:
        raise RuntimeError(box.get("tb") or str(box["error"]))
    return box.get("result")


def _execute_code(code):
    def job():
        stdout = io.StringIO()
        namespace = {
            "rs": rs,
            "rhinoscriptsyntax": rs,
            "sc": sc,
            "scriptcontext": sc,
            "Rhino": Rhino,
            "System": System,
        }
        with contextlib.redirect_stdout(stdout):
            exec(code, namespace)
        sc.doc.Views.Redraw()
        out = stdout.getvalue()
        return out if out.strip() else "(code ran successfully, no output printed)"

    return _run_on_ui_thread(job)


def _get_scene_info():
    def job():
        doc = sc.doc
        layers = [layer.Name for layer in doc.Layers]
        objects = []
        for obj in doc.Objects:
            objects.append({
                "id": str(obj.Id),
                "type": obj.ObjectType.ToString(),
                "layer": doc.Layers[obj.Attributes.LayerIndex].Name,
                "name": obj.Attributes.Name or "",
            })
        return {
            "document": doc.Name or "(unsaved)",
            "unit_system": doc.ModelUnitSystem.ToString(),
            "layers": layers,
            "object_count": len(objects),
            "objects": objects[:200],
        }

    return _run_on_ui_thread(job)


def _capture_viewport():
    def job():
        view = sc.doc.Views.ActiveView
        bitmap = view.CaptureToBitmap()
        path = os.path.join(
            os.path.expanduser("~"), ".pantograph_viewport.png")
        bitmap.Save(path, System.Drawing.Imaging.ImageFormat.Png)
        return {"path": path}

    return _run_on_ui_thread(job)


HANDLERS = {
    "execute_code": lambda p: _execute_code(p["code"]),
    "get_scene_info": lambda p: _get_scene_info(),
    "capture_viewport": lambda p: _capture_viewport(),
    "ping": lambda p: "pong",
}


def _handle_client(conn):
    buf = b""
    try:
        while True:
            chunk = conn.recv(65536)
            if not chunk:
                break
            buf += chunk
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                if not line.strip():
                    continue
                try:
                    msg = json.loads(line.decode("utf-8"))
                    handler = HANDLERS.get(msg.get("type"))
                    if handler is None:
                        reply = {"status": "error",
                                 "message": "unknown command: %s" % msg.get("type")}
                    else:
                        result = handler(msg.get("params") or {})
                        reply = {"status": "success", "result": result}
                except Exception:
                    reply = {"status": "error", "message": traceback.format_exc()}
                conn.sendall((json.dumps(reply) + "\n").encode("utf-8"))
    except (ConnectionResetError, OSError):
        pass
    finally:
        conn.close()


def _serve(server_sock):
    while True:
        try:
            conn, _ = server_sock.accept()
        except OSError:
            break  # socket closed — stop the loop
        threading.Thread(target=_handle_client, args=(conn,), daemon=True).start()


# Allow re-running the script without a port conflict: close the old server.
if isinstance(sc.sticky.get("pantograph_server"), socket.socket):
    try:
        sc.sticky["pantograph_server"].close()
    except OSError:
        pass

_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
_server.bind((HOST, PORT))
_server.listen(4)
sc.sticky["pantograph_server"] = _server

threading.Thread(target=_serve, args=(_server,), daemon=True).start()
print("Pantograph listener running on %s:%d — leave Rhino open." % (HOST, PORT))
