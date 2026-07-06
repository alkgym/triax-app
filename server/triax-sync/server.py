#!/usr/bin/env python3
"""
triax-sync v3 — almacén de snapshots con protección contra pérdida de datos.

Idea clave: la versión "canónica" (la que sirve /snapshot y la que bajan los
dispositivos) NUNCA retrocede en cantidad de datos de usuario salvo que se
fuerce explícitamente. Así, un dispositivo que sube una copia más pequeña la
archiva como versión, pero NO pisa la buena.

- Conserva muchas versiones (KEEP, por defecto 500) → nada se "expulsa" pronto.
- Cada PUT registra una versión. La canónica avanza si la nueva tiene >= datos
  de usuario que la canónica actual, o si se manda force=1 (botón "Subir").
- "Bajar"/restaurar siguen siendo acciones manuales y explícitas.

Endpoints (Caddy elimina el prefijo /api):
  GET  /health
  GET  /snapshot?user=me            -> versión canónica {updatedAt, serverAt, payload, userRecords}
  GET  /snapshot?user=me&at=<ms>    -> versión concreta por serverAt
  PUT  /snapshot?user=me[&force=1]  -> guarda versión; avanza canónica si crece o force
  POST /snapshot                    -> alias de PUT
  GET  /history?user=me             -> {versions:[{serverAt,updatedAt,userRecords,sizeKb,canonical}]}
"""
import json
import os
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

DB_PATH = os.environ.get("SYNC_DB", "/data/sync.db")
PORT = int(os.environ.get("PORT", "8000"))
MAX_BODY = 50 * 1024 * 1024
KEEP = int(os.environ.get("KEEP_VERSIONS", "500"))
# Tablas que cuentan como "datos de usuario" (no sembrado por defecto).
USER_TABLES = ["sessions", "sets", "painLogs", "bodyMetrics", "prs", "nutrition", "bpLogs"]
_lock = threading.Lock()


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.execute(
        "CREATE TABLE IF NOT EXISTS history ("
        " id INTEGER PRIMARY KEY AUTOINCREMENT,"
        " user TEXT NOT NULL,"
        " updated_at INTEGER NOT NULL,"
        " server_at INTEGER NOT NULL,"
        " user_records INTEGER NOT NULL DEFAULT 0,"
        " payload TEXT NOT NULL)"
    )
    c.execute("CREATE INDEX IF NOT EXISTS ix_history_user ON history(user, server_at DESC)")
    c.execute("CREATE TABLE IF NOT EXISTS meta (user TEXT PRIMARY KEY, canonical_server_at INTEGER)")
    return c


def _count_user_records(payload):
    return sum(len(payload.get(t, []) or []) for t in USER_TABLES if isinstance(payload.get(t), list))


def _canonical_row(c, user):
    m = c.execute("SELECT canonical_server_at FROM meta WHERE user=?", (user,)).fetchone()
    if m and m[0] is not None:
        row = c.execute(
            "SELECT updated_at, server_at, user_records, payload FROM history WHERE user=? AND server_at=?",
            (user, m[0]),
        ).fetchone()
        if row:
            return row
    # sin canónica válida → la versión más reciente
    return c.execute(
        "SELECT updated_at, server_at, user_records, payload FROM history WHERE user=? ORDER BY server_at DESC LIMIT 1",
        (user,),
    ).fetchone()


def get_canonical(user):
    with _lock:
        c = _conn()
        try:
            row = _canonical_row(c, user)
        finally:
            c.close()
    if not row:
        return {"updatedAt": None, "serverAt": None, "userRecords": 0, "payload": None}
    return {"updatedAt": row[0], "serverAt": row[1], "userRecords": row[2], "payload": json.loads(row[3])}


def get_version(user, server_at):
    with _lock:
        c = _conn()
        try:
            row = c.execute(
                "SELECT updated_at, server_at, user_records, payload FROM history WHERE user=? AND server_at=?",
                (user, int(server_at)),
            ).fetchone()
        finally:
            c.close()
    if not row:
        return {"updatedAt": None, "serverAt": None, "userRecords": 0, "payload": None}
    return {"updatedAt": row[0], "serverAt": row[1], "userRecords": row[2], "payload": json.loads(row[3])}


def list_versions(user):
    with _lock:
        c = _conn()
        try:
            canon = _canonical_row(c, user)
            canon_sa = canon[1] if canon else None
            rows = c.execute(
                "SELECT server_at, updated_at, user_records, length(payload) FROM history"
                " WHERE user=? ORDER BY server_at DESC LIMIT ?",
                (user, KEEP),
            ).fetchall()
        finally:
            c.close()
    return {
        "versions": [
            {"serverAt": r[0], "updatedAt": r[1], "userRecords": r[2],
             "sizeKb": round(r[3] / 1024), "canonical": (r[0] == canon_sa)}
            for r in rows
        ]
    }


def put_snapshot(user, updated_at, payload, force):
    server_at = int(time.time() * 1000)
    ur = _count_user_records(payload)
    body = json.dumps(payload, ensure_ascii=False)
    with _lock:
        c = _conn()
        try:
            c.execute(
                "INSERT INTO history(user, updated_at, server_at, user_records, payload) VALUES(?,?,?,?,?)",
                (user, int(updated_at), server_at, ur, body),
            )
            # Retención generosa.
            c.execute(
                "DELETE FROM history WHERE user=? AND id NOT IN ("
                "  SELECT id FROM history WHERE user=? ORDER BY server_at DESC LIMIT ?)",
                (user, user, KEEP),
            )
            # ¿Avanza la canónica? Solo si crece (>=) o se fuerza.
            canon = _canonical_row(c, user)
            canon_ur = canon[2] if canon else -1
            moved = bool(force) or ur >= canon_ur
            if moved:
                c.execute(
                    "INSERT INTO meta(user, canonical_server_at) VALUES(?,?)"
                    " ON CONFLICT(user) DO UPDATE SET canonical_server_at=excluded.canonical_server_at",
                    (user, server_at),
                )
            c.commit()
        finally:
            c.close()
    return {"ok": True, "updatedAt": int(updated_at), "serverAt": server_at,
            "userRecords": ur, "canonical": moved}


class Handler(BaseHTTPRequestHandler):
    server_version = "triax-sync/3.0"

    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _q(self):
        return parse_qs(urlparse(self.path).query)

    def _user(self):
        return (self._q().get("user", ["me"])[0] or "me")[:64]

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self._send(200, {"ok": True})
        if path == "/history":
            return self._send(200, list_versions(self._user()))
        if path == "/snapshot":
            at = self._q().get("at", [None])[0]
            if at:
                try:
                    return self._send(200, get_version(self._user(), int(at)))
                except ValueError:
                    return self._send(400, {"error": "at inválido"})
            return self._send(200, get_canonical(self._user()))
        return self._send(404, {"error": "not found"})

    def do_PUT(self):
        path = urlparse(self.path).path
        if path != "/snapshot":
            return self._send(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            return self._send(413, {"error": "invalid content-length"})
        try:
            data = json.loads(self.rfile.read(length))
            updated_at = data.get("updatedAt")
            payload = data.get("payload")
            if not isinstance(updated_at, (int, float)) or not isinstance(payload, dict):
                return self._send(400, {"error": "updatedAt (number) and payload (object) required"})
            force = self._q().get("force", ["0"])[0] in ("1", "true", "yes")
            return self._send(200, put_snapshot(self._user(), updated_at, payload, force))
        except Exception as e:  # noqa: BLE001
            return self._send(400, {"error": str(e)})

    def do_POST(self):
        return self.do_PUT()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    _conn().close()
    print(f"triax-sync v3 escuchando en :{PORT} (db={DB_PATH}, keep={KEEP})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
