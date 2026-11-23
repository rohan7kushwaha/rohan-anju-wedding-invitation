import base64
import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server import (
    WeddingHTTPServer,
    WeddingRequestHandler,
    initialize_database,
    make_admin_handler,
)


class WeddingServerTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        database_path = Path(self.temporary_directory.name) / "wishes.sqlite3"
        initialize_database(database_path)

        self.public_server = WeddingHTTPServer(
            ("127.0.0.1", 0),
            WeddingRequestHandler,
            database_path,
        )
        self.admin_server = WeddingHTTPServer(
            ("127.0.0.1", 0),
            make_admin_handler(),
            database_path,
            "a-test-admin-password-that-is-long",
        )
        for server in (self.public_server, self.admin_server):
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            self.addCleanup(self.stop_server, server)

    @staticmethod
    def stop_server(server):
        server.shutdown()
        server.server_close()

    def request(self, server, path, data=None, headers=None, method=None):
        url = f"http://127.0.0.1:{server.server_port}{path}"
        body = None if data is None else json.dumps(data).encode("utf-8")
        request = Request(url, data=body, headers=headers or {}, method=method)
        return urlopen(request, timeout=3)

    def test_public_port_serves_site_but_not_admin_or_server_files(self):
        with self.request(self.public_server, "/") as response:
            self.assertEqual(response.status, 200)
            response_body = response.read()
            self.assertIn(b'id="brandNames"', response_body)
            self.assertIn(b'id="heroGroomName"', response_body)

        for path in ("/admin", "/admin.html", "/server.py", "/.env.example", "/api/admin/wishes"):
            with self.subTest(path=path):
                with self.assertRaises(HTTPError) as error:
                    self.request(self.public_server, path)
                self.assertEqual(error.exception.code, 404)
                error.exception.close()

    def test_guest_wish_is_stored_and_visible_only_on_admin_port(self):
        submission = {
            "name": "Guest",
            "city": "Ghazipur",
            "message": "<b>Best wishes!</b>",
        }
        with self.request(
            self.public_server,
            "/api/wishes",
            data=submission,
            headers={"Content-Type": "application/json"},
            method="POST",
        ) as response:
            self.assertEqual(response.status, 201)
            self.assertTrue(json.loads(response.read())["ok"])

        authorization = "Basic " + base64.b64encode(
            b"admin:a-test-admin-password-that-is-long"
        ).decode("ascii")
        admin_headers = {
            "Authorization": authorization,
            "X-Admin-Request": "1",
        }
        with self.request(
            self.admin_server,
            "/api/admin/wishes",
            headers=admin_headers,
        ) as response:
            wishes = json.loads(response.read())["wishes"]
        self.assertEqual(len(wishes), 1)
        self.assertEqual(wishes[0]["message"], "<b>Best wishes!</b>")

        with self.assertRaises(HTTPError) as error:
            self.request(self.public_server, "/api/wishes")
        self.assertEqual(error.exception.code, 404)
        error.exception.close()

    def test_admin_requires_password_and_request_header(self):
        with self.assertRaises(HTTPError) as page_unauthenticated:
            self.request(self.admin_server, "/admin")
        self.assertEqual(page_unauthenticated.exception.code, 401)
        page_unauthenticated.exception.close()

        with self.assertRaises(HTTPError) as unauthenticated:
            self.request(self.admin_server, "/api/admin/wishes", headers={"X-Admin-Request": "1"})
        self.assertEqual(unauthenticated.exception.code, 401)
        unauthenticated.exception.close()

        authorization = "Basic " + base64.b64encode(
            b"admin:a-test-admin-password-that-is-long"
        ).decode("ascii")
        with self.assertRaises(HTTPError) as missing_header:
            self.request(self.admin_server, "/api/admin/wishes", headers={"Authorization": authorization})
        self.assertEqual(missing_header.exception.code, 403)
        missing_header.exception.close()

        with self.request(self.admin_server, "/admin", headers={"Authorization": authorization}) as response:
            self.assertEqual(response.status, 200)
            self.assertIn(b"Saved wedding wishes", response.read())

    def test_invalid_wish_is_rejected(self):
        submission = {"name": "x" * 81, "city": "", "message": "Hello"}
        with self.assertRaises(HTTPError) as error:
            self.request(
                self.public_server,
                "/api/wishes",
                data=submission,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
        self.assertEqual(error.exception.code, 400)
        error.exception.close()


if __name__ == "__main__":
    unittest.main()
