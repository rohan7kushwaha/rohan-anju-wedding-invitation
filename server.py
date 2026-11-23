import argparse
import base64
import hmac
import ipaddress
import json
import logging
import os
import sqlite3
import threading
from contextlib import closing
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parent
ASSETS_ROOT = (PROJECT_ROOT / "assets").resolve()
MAX_REQUEST_BYTES = 8192
NOT_PUBLIC_FILE = PROJECT_ROOT / "__not_public__"


def load_local_environment():
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return

    for line_number, raw_line in enumerate(env_file.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        key, separator, value = line.partition("=")
        key = key.strip()
        if not separator or not key:
            raise RuntimeError(f"Invalid .env entry on line {line_number}.")

        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        os.environ.setdefault(key, value)


def database_path_from_environment():
    configured_path = Path(os.environ.get("WEDDING_DB_PATH", "data/wishes.sqlite3"))
    if not configured_path.is_absolute():
        configured_path = PROJECT_ROOT / configured_path
    return configured_path.resolve()


def initialize_database(database_path):
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(database_path, timeout=10)) as connection:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS wishes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                city TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


def clean_text(value, field_name, maximum_length, required):
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be text.")

    cleaned = value.strip()
    if required and not cleaned:
        raise ValueError(f"{field_name} is required.")
    if len(cleaned) > maximum_length:
        raise ValueError(f"{field_name} is too long.")
    return cleaned


def public_asset_path(url_path):
    if url_path in ("/", "/index.html"):
        candidate = PROJECT_ROOT / "index.html"
    elif url_path in ("/style.css", "/script.js"):
        candidate = PROJECT_ROOT / url_path.lstrip("/")
    elif url_path.startswith("/assets/"):
        candidate = (PROJECT_ROOT / unquote(url_path).lstrip("/")).resolve()
        try:
            candidate.relative_to(ASSETS_ROOT)
        except ValueError:
            return None
    else:
        return None

    return candidate if candidate.is_file() else None


class WeddingRequestHandler(SimpleHTTPRequestHandler):
    admin_server = False

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def log_message(self, format_string, *args):
        logging.info("%s %s", self.command, format_string % args)

    def translate_path(self, path):
        if self.admin_server:
            return str(NOT_PUBLIC_FILE)
        candidate = public_asset_path(urlsplit(path).path)
        return str(candidate or NOT_PUBLIC_FILE)

    def list_directory(self, path):
        self.send_error(404)
        return None

    def do_GET(self):
        url_path = urlsplit(self.path).path
        if self.admin_server:
            self.handle_admin_get(url_path)
            return

        if url_path.startswith("/api/") or url_path.startswith("/admin"):
            self.send_error(404)
            return
        if public_asset_path(url_path) is None:
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        url_path = urlsplit(self.path).path
        if self.admin_server or url_path.startswith("/api/") or url_path.startswith("/admin"):
            self.send_error(404)
            return
        if public_asset_path(url_path) is None:
            self.send_error(404)
            return
        super().do_HEAD()

    def do_POST(self):
        if self.admin_server or urlsplit(self.path).path != "/api/wishes":
            self.send_error(404)
            return
        self.handle_wish_submission()

    def handle_admin_get(self, url_path):
        if not self.is_authorized_admin():
            return

        if url_path in ("/", "/admin", "/admin.html"):
            if url_path == "/":
                self.send_response(302)
                self.send_header("Location", "/admin")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return

            admin_page = (PROJECT_ROOT / "admin.html").read_bytes()
            self.send_bytes(admin_page, "text/html; charset=utf-8")
            return

        if url_path == "/api/admin/wishes":
            if self.headers.get("X-Admin-Request") != "1":
                self.send_error(403)
                return
            try:
                wishes = self.load_wishes()
            except sqlite3.Error:
                logging.exception("Unable to load saved wedding wishes.")
                self.send_json({"error": "Wishes could not be loaded."}, status=500)
                return
            self.send_json({"wishes": wishes})
            return

        self.send_error(404)

    def handle_wish_submission(self):
        if self.headers.get_content_type() != "application/json":
            self.send_json({"error": "Submit the wish as JSON."}, status=415)
            return

        try:
            content_length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self.send_json({"error": "A valid Content-Length header is required."}, status=400)
            return

        if content_length < 1:
            self.send_json({"error": "The request body is empty."}, status=400)
            return
        if content_length > MAX_REQUEST_BYTES:
            self.send_json({"error": "The wish is too large."}, status=413)
            return

        try:
            submission = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(submission, dict):
                raise ValueError("The request body must be an object.")

            name = clean_text(submission.get("name"), "Name", 80, required=True)
            city = clean_text(submission.get("city", ""), "City", 80, required=False) or "Well-wisher"
            message = clean_text(submission.get("message"), "Wish", 500, required=True)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            self.send_json({"error": str(error)}, status=400)
            return

        created_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        try:
            with closing(sqlite3.connect(self.server.database_path, timeout=10)) as connection:
                with connection:
                    connection.execute(
                        "INSERT INTO wishes (name, city, message, created_at) VALUES (?, ?, ?, ?)",
                        (name, city, message, created_at),
                    )
        except sqlite3.Error:
            logging.exception("Unable to save a wedding wish.")
            self.send_json({"error": "The wish could not be saved."}, status=500)
            return

        self.send_json({"ok": True}, status=201)

    def is_lan_client(self):
        try:
            address = ipaddress.ip_address(self.client_address[0].split("%", 1)[0])
        except ValueError:
            return False

        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        return address.is_loopback or address.is_private

    def is_authorized_admin(self):
        if not self.is_lan_client():
            self.send_error(403)
            return False

        password = self.server.admin_password.encode("utf-8")
        expected = "Basic " + base64.b64encode(b"admin:" + password).decode("ascii")
        supplied = self.headers.get("Authorization", "")
        if not hmac.compare_digest(supplied, expected):
            self.send_response(401)
            self.send_header("WWW-Authenticate", 'Basic realm="Wedding wishes admin"')
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return False
        return True

    def load_wishes(self):
        with closing(sqlite3.connect(self.server.database_path, timeout=10)) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                "SELECT id, name, city, message, created_at FROM wishes ORDER BY id DESC"
            ).fetchall()
        return [dict(row) for row in rows]

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_bytes(body, "application/json; charset=utf-8", status)

    def send_bytes(self, body, content_type, status=200):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)


def make_admin_handler():
    return type("AdminRequestHandler", (WeddingRequestHandler,), {"admin_server": True})


class WeddingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, address, handler, database_path, admin_password=""):
        self.database_path = database_path
        self.admin_password = admin_password
        super().__init__(address, handler)


def parse_arguments():
    parser = argparse.ArgumentParser(description="Run the wedding site and LAN-only wishes admin.")
    parser.add_argument("--public-host", default=os.environ.get("WEDDING_PUBLIC_HOST", "127.0.0.1"))
    parser.add_argument("--public-port", type=int, default=int(os.environ.get("WEDDING_PUBLIC_PORT", "8000")))
    parser.add_argument("--admin-host", default=os.environ.get("WEDDING_ADMIN_HOST", "0.0.0.0"))
    parser.add_argument("--admin-port", type=int, default=int(os.environ.get("WEDDING_ADMIN_PORT", "8001")))
    return parser.parse_args()


def main():
    load_local_environment()
    arguments = parse_arguments()
    admin_password = os.environ.get("WEDDING_ADMIN_PASSWORD", "")
    if len(admin_password) < 16 or admin_password == "replace-with-a-long-random-password":
        raise SystemExit("Set WEDDING_ADMIN_PASSWORD to a unique password of at least 16 characters.")

    database_path = database_path_from_environment()
    initialize_database(database_path)

    public_server = WeddingHTTPServer(
        (arguments.public_host, arguments.public_port),
        WeddingRequestHandler,
        database_path,
    )
    try:
        admin_server = WeddingHTTPServer(
            (arguments.admin_host, arguments.admin_port),
            make_admin_handler(),
            database_path,
            admin_password,
        )
    except OSError:
        public_server.server_close()
        raise

    admin_thread = threading.Thread(target=admin_server.serve_forever, name="wedding-admin", daemon=True)
    admin_thread.start()
    print(f"Public site: http://{arguments.public_host}:{arguments.public_port}")
    print(f"LAN admin:   http://<server-lan-ip>:{arguments.admin_port}/admin")
    print(f"Wishes DB:   {database_path}")

    try:
        public_server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping wedding servers.")
    finally:
        public_server.server_close()
        admin_server.shutdown()
        admin_server.server_close()
        admin_thread.join(timeout=5)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    main()
