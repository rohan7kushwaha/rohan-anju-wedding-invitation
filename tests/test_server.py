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
    make_admin_handler,
)
from wedding.database import initialize_database


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

    def admin_session(self, password="a-test-admin-password-that-is-long"):
        with self.request(
            self.admin_server,
            "/api/admin/login",
            data={"password": password},
            headers={
                "Content-Type": "application/json",
                "X-Admin-Request": "1",
            },
            method="POST",
        ) as response:
            return response.headers["Set-Cookie"].split(";", 1)[0]

    def test_public_port_serves_site_but_not_admin_or_server_files(self):
        with self.request(self.public_server, "/") as response:
            self.assertEqual(response.status, 200)
            response_body = response.read()
            self.assertIn(b'assets/images/logo.jpeg', response_body)
            self.assertIn(b'id="heroGroomName"', response_body)
            self.assertNotIn(b'id="weddingHeroDate"', response_body)
            self.assertIn(b"assets/images/Our Story/image1.jpeg", response_body)

        with self.request(self.public_server, "/assets/images/logo.jpeg") as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers.get_content_type(), "image/jpeg")

        for image_number in range(1, 4):
            image_path = f"/assets/images/Our%20Story/image{image_number}.jpeg"
            with self.subTest(path=image_path):
                with self.request(self.public_server, image_path) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.headers.get_content_type(), "image/jpeg")

        for path in ("/admin", "/admin.html", "/server.py", "/.env.example", "/api/admin/wishes"):
            with self.subTest(path=path):
                with self.assertRaises(HTTPError) as error:
                    self.request(self.public_server, path)
                self.assertEqual(error.exception.code, 404)
                error.exception.close()

    def test_reception_event_and_video_are_available_on_public_port(self):
        with self.request(self.public_server, "/assets/event-details/EventDate.json") as response:
            event_data = json.loads(response.read())

        reception = next(event for event in event_data["events"] if event["id"] == "reception")
        self.assertEqual(reception["name"], "Reception")
        self.assertEqual(reception["date"], "2026-12-27")
        self.assertEqual(reception["time"], "17:00")
        self.assertEqual(reception["timeLabel"], "5 PM onwards")
        self.assertEqual(reception["locationId"], "groomsHome")
        self.assertEqual(reception["video"], "assets/Video/Reception.mp4")

        with self.request(self.public_server, "/assets/Video/Reception.mp4") as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers.get_content_type(), "video/mp4")
            self.assertGreater(len(response.read()), 0)

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

        session_cookie = self.admin_session()
        admin_headers = {
            "Cookie": session_cookie,
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

    def test_admin_requires_session_and_request_header(self):
        with self.request(self.admin_server, "/admin") as page:
            self.assertEqual(page.status, 200)
            self.assertIn(b"Admin sign in", page.read())

        with self.assertRaises(HTTPError) as wishes_unauthenticated:
            self.request(
                self.admin_server,
                "/api/admin/wishes",
                headers={"X-Admin-Request": "1"},
            )
        self.assertEqual(wishes_unauthenticated.exception.code, 401)
        wishes_unauthenticated.exception.close()

        session_cookie = self.admin_session()
        with self.assertRaises(HTTPError) as missing_request_header:
            self.request(
                self.admin_server,
                "/api/admin/wishes",
                headers={"Cookie": session_cookie},
            )
        self.assertEqual(missing_request_header.exception.code, 403)
        missing_request_header.exception.close()

        with self.request(
            self.admin_server,
            "/api/admin/wishes",
            headers={"Cookie": session_cookie, "X-Admin-Request": "1"},
        ) as response:
            self.assertEqual(response.status, 200)

    def test_admin_logout_invalidates_session_and_clears_cookie(self):
        session_cookie = self.admin_session()
        with self.request(
            self.admin_server,
            "/api/admin/logout",
            headers={"Cookie": session_cookie, "X-Admin-Request": "1"},
            method="POST",
        ) as response:
            self.assertEqual(response.status, 200)
            self.assertIn("Max-Age=0", response.headers["Set-Cookie"])

        with self.assertRaises(HTTPError) as unauthorized:
            self.request(
                self.admin_server,
                "/api/admin/wishes",
                headers={"Cookie": session_cookie, "X-Admin-Request": "1"},
            )
        self.assertEqual(unauthorized.exception.code, 401)
        unauthorized.exception.close()

    def test_admin_login_rejects_incorrect_password(self):
        with self.assertRaises(HTTPError) as error:
            self.request(
                self.admin_server,
                "/api/admin/login",
                data={"password": "incorrect"},
                headers={
                    "Content-Type": "application/json",
                    "X-Admin-Request": "1",
                },
                method="POST",
            )
        self.assertEqual(error.exception.code, 401)
        error.exception.close()

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
