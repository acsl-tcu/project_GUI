#!/usr/bin/env python3
"""ACSL GUI management agent.

実験機 PC のホスト上で常駐し、Web GUI からの管理系リクエストを受ける REST API。
ROS / Docker SDK に依存しない Python 標準ライブラリのみの単一ファイル。

- POST /api/console                     : TCP コンソール (:7720) への 1 コマンド中継
- GET  /api/health                      : ホスト状態 (hostname, uptime, project_launch)
- GET  /api/containers                  : docker ps -a
- POST /api/containers/<name>/restart   : drestart <name> (.acsl/bashrc を source)
- POST /api/containers/<name>/stop      : docker stop <name>
- GET  /api/containers/<name>/logs      : docker logs --tail N <name>
- POST /api/project                     : {"action":"up","mode":"EXP","config":...} / {"action":"down"}
- GET  /api/configs                     : $ACSL_WORK_DIR/config 配下の YAML 一覧
- GET  /api/configs/<path>              : YAML 取得
- PUT  /api/configs/<path>              : YAML 保存 (.bak 退避)

環境変数:
  ACSL_WORK_DIR : 対象プロジェクトのデプロイ先 (必須。例 /home/user/rover)
  AGENT_PORT    : listen ポート (default 7780)
  AGENT_TOKEN   : 設定すると X-Agent-Token ヘッダ必須
  CONSOLE_HOST / CONSOLE_PORT : TCP コンソール接続先 (default 127.0.0.1 / 自動検出)
  AGENT_START_BRIDGE : "1" で起動時に rosbridge コンテナを dup rosbridge で上げる
  GUI_WORK_DIR  : rosbridge を上げる project_GUI デプロイ先
                  (default: この agent.py が置かれた checkout 自身)
"""

import json
import os
import re
import socket
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

AGENT_PORT = int(os.environ.get("AGENT_PORT", "7780"))
WORK_DIR = os.environ.get("ACSL_WORK_DIR", "")
TOKEN = os.environ.get("AGENT_TOKEN", "")
CONSOLE_HOST = os.environ.get("CONSOLE_HOST", "127.0.0.1")
CONSOLE_PORT_ENV = int(os.environ.get("CONSOLE_PORT", "0"))
CONSOLE_CONTAINER = os.environ.get("CONSOLE_CONTAINER", "rover")

NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]*$")
MODE_RE = re.compile(r"^[A-Za-z0-9_]+$")
CONF_RE = re.compile(r"^[A-Za-z0-9_\-./]+\.ya?ml$")


def config_dir() -> Path | None:
    if not WORK_DIR:
        return None
    d = Path(WORK_DIR) / "config"
    return d if d.is_dir() else None


def detect_console_port() -> int:
    """./console と同じ探索順: env → docker logs → rover.yaml → 7720。"""
    if CONSOLE_PORT_ENV:
        return CONSOLE_PORT_ENV
    try:
        out = subprocess.run(
            ["docker", "logs", "--tail", "2000", CONSOLE_CONTAINER],
            capture_output=True, text=True, timeout=5,
        )
        m = None
        for m in re.finditer(r"Console server on port (\d+)", out.stdout + out.stderr):
            pass
        if m:
            return int(m.group(1))
    except Exception:
        pass
    cd = config_dir()
    if cd:
        try:
            m = re.search(r"^console_port:\s*(\d+)", (cd / "rover.yaml").read_text(),
                          re.MULTILINE)
            if m:
                return int(m.group(1))
        except Exception:
            pass
    return 7720


def console_send(cmd: str) -> str:
    """1 コマンド/接続・1 行応答の TCP コンソールプロトコル。"""
    port = detect_console_port()
    with socket.create_connection((CONSOLE_HOST, port), timeout=3) as s:
        s.sendall((cmd.strip() + "\n").encode())
        s.settimeout(2.0)
        buf = b""
        try:
            while b"\n" not in buf and len(buf) < 65536:
                chunk = s.recv(4096)
                if not chunk:
                    break
                buf += chunk
        except socket.timeout:
            pass
    return buf.decode(errors="replace").strip()


def run_shell(cmd: str, timeout: int = 60, with_acsl_env: bool = False) -> tuple[bool, str]:
    """コマンド実行。with_acsl_env なら .acsl/bashrc を source して dup 系を使えるようにする。"""
    if with_acsl_env:
        if not WORK_DIR:
            return False, "ACSL_WORK_DIR is not set"
        cmd = f"source '{WORK_DIR}/.acsl/bashrc' >/dev/null 2>&1; {cmd}"
    env = dict(os.environ, DUP_SKIP_RID_CHECK="1")
    try:
        p = subprocess.run(
            ["bash", "-c", cmd],
            capture_output=True, text=True, timeout=timeout,
            cwd=WORK_DIR or None, env=env, stdin=subprocess.DEVNULL,
        )
        out = (p.stdout + p.stderr).strip()
        return p.returncode == 0, out[-20000:]
    except subprocess.TimeoutExpired:
        return False, f"timeout ({timeout}s): {cmd}"
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def list_containers() -> list[dict]:
    ok, out = run_shell("docker ps -a --format '{{json .}}'", timeout=10)
    containers = []
    if ok:
        for line in out.splitlines():
            try:
                c = json.loads(line)
            except json.JSONDecodeError:
                continue
            containers.append({
                "name": c.get("Names", ""),
                "image": c.get("Image", ""),
                "state": c.get("State", ""),
                "status": c.get("Status", ""),
            })
    return containers


def health() -> dict:
    try:
        up = float(Path("/proc/uptime").read_text().split()[0])
        d, rem = divmod(int(up), 86400)
        h, rem = divmod(rem, 3600)
        uptime = f"{d}d {h}h {rem // 60}m"
    except Exception:
        uptime = "?"
    ok, state = run_shell("systemctl is-active project_launch 2>/dev/null", timeout=5)
    return {
        "ok": True,
        "hostname": socket.gethostname(),
        "uptime": uptime,
        "project_launch": (state.splitlines() or ["unknown"])[0] if state else "unknown",
        "time": subprocess.run(["date", "-Is"], capture_output=True,
                               text=True).stdout.strip(),
    }


def safe_config_path(rel: str) -> Path | None:
    cd = config_dir()
    if not cd or not CONF_RE.match(rel):
        return None
    p = (cd / rel).resolve()
    try:
        p.relative_to(cd.resolve())
    except ValueError:
        return None
    return p


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # ---- helpers -------------------------------------------------------
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers",
                         "Content-Type, X-Agent-Token")

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _auth(self) -> bool:
        if not TOKEN:
            return True
        if self.headers.get("X-Agent-Token") == TOKEN:
            return True
        self._json(401, {"ok": False, "output": "invalid token"})
        return False

    def _body(self) -> dict:
        try:
            n = int(self.headers.get("Content-Length") or 0)
            if n <= 0 or n > 1_000_000:
                return {}
            return json.loads(self.rfile.read(n).decode())
        except Exception:
            return {}

    def log_message(self, fmt, *args):  # noqa: A003
        sys.stderr.write("[agent] %s - %s\n" % (self.address_string(), fmt % args))

    # ---- methods -------------------------------------------------------
    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):  # noqa: N802
        if not self._auth():
            return
        url = urlparse(self.path)
        parts = [p for p in url.path.split("/") if p]

        if url.path == "/api/health":
            return self._json(200, health())

        if url.path == "/api/containers":
            return self._json(200, {"containers": list_containers()})

        # /api/containers/<name>/logs
        if len(parts) == 4 and parts[:2] == ["api", "containers"] and parts[3] == "logs":
            name = parts[2]
            if not NAME_RE.match(name):
                return self._json(400, {"ok": False, "output": "bad name"})
            tail = int((parse_qs(url.query).get("tail") or ["200"])[0])
            tail = max(1, min(tail, 2000))
            ok, out = run_shell(f"docker logs --tail {tail} {name}", timeout=15)
            return self._json(200 if ok else 500, {"name": name, "logs": out})

        if url.path == "/api/configs":
            cd = config_dir()
            if not cd:
                return self._json(500, {"ok": False,
                                        "output": "ACSL_WORK_DIR/config not found"})
            files = sorted(
                str(p.relative_to(cd))
                for pat in ("*.yaml", "*.yml")
                for p in cd.rglob(pat)
                if p.is_file() and not p.name.endswith(".bak")
            )
            return self._json(200, {"files": files})

        if len(parts) >= 3 and parts[:2] == ["api", "configs"]:
            rel = "/".join(parts[2:])
            p = safe_config_path(rel)
            if not p or not p.is_file():
                return self._json(404, {"ok": False, "output": f"not found: {rel}"})
            return self._json(200, {"path": rel, "content": p.read_text()})

        self._json(404, {"ok": False, "output": "unknown endpoint"})

    def do_POST(self):  # noqa: N802
        if not self._auth():
            return
        url = urlparse(self.path)
        parts = [p for p in url.path.split("/") if p]
        body = self._body()

        if url.path == "/api/console":
            cmd = str(body.get("cmd", "")).strip()
            if not cmd or len(cmd) > 500 or "\n" in cmd:
                return self._json(400, {"ok": False, "reply": "bad cmd"})
            try:
                reply = console_send(cmd)
                return self._json(200, {"ok": True, "reply": reply})
            except OSError as e:
                return self._json(502, {"ok": False, "reply": f"console unreachable: {e}"})

        # /api/containers/<name>/(restart|stop)
        if len(parts) == 4 and parts[:2] == ["api", "containers"]:
            name, action = parts[2], parts[3]
            if not NAME_RE.match(name):
                return self._json(400, {"ok": False, "output": "bad name"})
            if action == "restart":
                ok, out = run_shell(f"drestart {name}", timeout=300, with_acsl_env=True)
            elif action == "stop":
                ok, out = run_shell(f"docker stop {name}", timeout=60)
            else:
                return self._json(404, {"ok": False, "output": "unknown action"})
            return self._json(200 if ok else 500, {"ok": ok, "output": out})

        if url.path == "/api/project":
            action = body.get("action")
            if action == "down":
                ok, out = run_shell("drm all", timeout=180, with_acsl_env=True)
            elif action == "up":
                mode = str(body.get("mode", ""))
                config = str(body.get("config") or "")
                if not MODE_RE.match(mode):
                    return self._json(400, {"ok": False, "output": "bad mode"})
                if config and not CONF_RE.match(config):
                    return self._json(400, {"ok": False, "output": "bad config"})
                cmd = f"dup all {mode}" + (f" {config}" if config else "")
                ok, out = run_shell(cmd, timeout=570, with_acsl_env=True)
            else:
                return self._json(400, {"ok": False, "output": "action must be up|down"})
            return self._json(200 if ok else 500, {"ok": ok, "output": out})

        self._json(404, {"ok": False, "output": "unknown endpoint"})

    def do_PUT(self):  # noqa: N802
        if not self._auth():
            return
        parts = [p for p in urlparse(self.path).path.split("/") if p]
        if len(parts) >= 3 and parts[:2] == ["api", "configs"]:
            rel = "/".join(parts[2:])
            p = safe_config_path(rel)
            if not p or not p.is_file():
                return self._json(404, {"ok": False, "output": f"not found: {rel}"})
            content = self._body().get("content")
            if not isinstance(content, str) or len(content) > 1_000_000:
                return self._json(400, {"ok": False, "output": "bad content"})
            backup = p.with_suffix(p.suffix + ".bak")
            backup.write_text(p.read_text())
            p.write_text(content)
            return self._json(200, {"ok": True,
                                    "output": f"saved, backup: {backup.name}"})
        self._json(404, {"ok": False, "output": "unknown endpoint"})


def start_bridge_async():
    """AGENT_START_BRIDGE=1 のとき、GUI プロジェクト側の rosbridge コンテナを上げる。
    実験機 PC で agent の systemd unit 1 本から bridge も起動するための仕組み
    (実験機プロジェクトの project_launch.service には手を入れない)。"""
    gui_dir = os.environ.get("GUI_WORK_DIR") or str(Path(__file__).resolve().parent.parent)
    if not (Path(gui_dir) / ".acsl" / "bashrc").is_file():
        print(f"[agent] rosbridge 起動スキップ: {gui_dir}/.acsl/bashrc がありません",
              file=sys.stderr)
        return

    def _run():
        cmd = f"source '{gui_dir}/.acsl/bashrc' >/dev/null 2>&1; cd '{gui_dir}'; dup rosbridge"
        env = dict(os.environ, DUP_SKIP_RID_CHECK="1")
        try:
            p = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True,
                               timeout=600, env=env, stdin=subprocess.DEVNULL)
            tail = (p.stdout + p.stderr).strip()[-1000:]
            print(f"[agent] dup rosbridge rc={p.returncode}\n{tail}", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"[agent] dup rosbridge failed: {e}", file=sys.stderr)

    threading.Thread(target=_run, daemon=True).start()


def main():
    if os.environ.get("AGENT_START_BRIDGE") == "1":
        start_bridge_async()
    if not WORK_DIR:
        print("[agent] WARNING: ACSL_WORK_DIR 未設定 — config/dup 系 API は使えません",
              file=sys.stderr)
    srv = ThreadingHTTPServer(("0.0.0.0", AGENT_PORT), Handler)
    print(f"[agent] listening on :{AGENT_PORT} (work_dir={WORK_DIR or 'unset'})",
          file=sys.stderr)
    srv.serve_forever()


if __name__ == "__main__":
    main()
