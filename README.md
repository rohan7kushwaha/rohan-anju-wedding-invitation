# Rohan & Anju — Wedding Journey

A self-hosted wedding invitation site with local wedding media and a private, server-side guest-wishes inbox.

Live site: [https://wedding.familyserver.store](https://wedding.familyserver.store)

## Features

- Responsive invitation, event details, story carousel, countdown, and guest wishes form.
- Guest wishes are stored together in a SQLite database on the server.
- A separate admin dashboard shows and exports wishes. It requires an admin password and is restricted to the server's private network.
- The public site is served by a small Python server using only the Python standard library.

## Project structure

```text
Wedding_Program/
  assets/
    event-details/
    images/
    music/
    Video/
  src/wedding/
    config.py
    database.py
  tests/
  admin.html
  index.html
  style.css
  script.js
  server.py
  pyproject.toml
  .env.example
  README.md
```

- `server.py` is the local/server entry point.
- `src/wedding/config.py` contains environment and database-path configuration.
- `src/wedding/database.py` owns SQLite initialization.
- `assets/event-details/*.json` is the source for names, family blessings, events, dates, times, locations, and route text.
- `data/wishes.sqlite3` is runtime-only data and is never committed.
- `tests/` contains HTTP integration tests for public routes, wishes, and the LAN admin boundary.

## Local development

Requirements: Python 3.10 or newer. No packages need to be installed.

1. Copy `.env.example` to `.env`.
2. Replace `WEDDING_ADMIN_PASSWORD` with a unique password of at least 16 characters.
3. Run `python3 server.py` from this folder.
4. Open `http://127.0.0.1:18000`.
5. On the server, open `http://127.0.0.1:18001/admin` and sign in with the password from `.env`. Use **Log out** to end the admin session.

## Editing invitation details

Update names and family blessings in `assets/event-details/Member.json`, event names/dates/times in `assets/event-details/EventDate.json`, and locations/routes in `assets/event-details/Location.json`. The public HTML and JavaScript render these JSON values instead of maintaining duplicate hardcoded names or dates.

To open the admin dashboard from another device on the trusted home network, use the TrueNAS system's private IP address, for example `http://192.168.1.25:18001/admin`. Do not port-forward port 18001 or route it through Cloudflare. Keep the `.env` file and `data/wishes.sqlite3` private.

The admin listener uses HTTP on the LAN. Use it only on a trusted, password-protected home network; do not use it over public Wi-Fi. If admin access is ever needed from an untrusted network, add a VPN or an HTTPS-protected access layer rather than exposing port 18001.

Run the focused server tests with:

```sh
python3 -m unittest discover -s tests -v
```

## Wishes and privacy

- `POST /api/wishes` accepts validated guest submissions. Wishes are not stored in a visitor's browser.
- The public server does not expose a wishes-list endpoint or the admin page.
- `admin.html` and the admin API are served only by the LAN admin listener on port 18001. That listener checks for a private-network client, and admin API requests require an eight-hour, server-side session established with the configured admin password.
- The database is stored at `data/wishes.sqlite3` by default. It is ignored by Git. Back it up securely and keep exports private because wishes contain personal information.
- The form tells guests their wish will be saved for the couple to read. The Python server does not log guest IP addresses or wish contents.
- The existing Cloudflare Tunnel should expose only the public listener on port 18000. Never route port 18001 through Cloudflare or expose it to the internet.

## Deploying on TrueNAS SCALE

The live site runs on TrueNAS SCALE and is published at [https://wedding.familyserver.store](https://wedding.familyserver.store) through the existing Cloudflare Tunnel. Keep the guest-wishes database on persistent TrueNAS storage. Do not install packages into or modify the TrueNAS host OS; run the Python server as a Custom App/container.

### 1. Prepare persistent storage

Create two datasets or directories on the pool, for example:

- `/mnt/<POOL>/apps/wedding-invitation` for the project files, including `.env`
- `/mnt/<POOL>/apps/wedding-data` for `wishes.sqlite3`

Copy or clone the project into the first directory. Create `.env` there with a unique admin password of at least 16 characters. Keep `.env` private and do not commit it. The database directory must be writable by the app container; the project directory can be mounted read-only.

### 2. Create or update the Custom App

In TrueNAS SCALE's Apps interface, create a Custom App using the Docker image `python:3.13-slim`. Configure it to run the project from the mounted directory with these settings (the Custom App fields may differ slightly by SCALE release):

```yaml
services:
  wedding-invitation:
    image: python:3.13-slim
    restart: unless-stopped
    working_dir: /app
    command:
      - python
      - server.py
      - --public-host
      - 0.0.0.0
      - --admin-host
      - 0.0.0.0
    environment:
      WEDDING_DB_PATH: /data/wishes.sqlite3
      WEDDING_PUBLIC_HOST: 0.0.0.0
      WEDDING_ADMIN_HOST: 0.0.0.0
    volumes:
      - /mnt/<POOL>/apps/wedding-invitation:/app:ro
      - /mnt/<POOL>/apps/wedding-data:/data
    ports:
      - "<TRUENAS_LAN_IP>:18000:18000"
      - "<TRUENAS_LAN_IP>:18001:18001"
```

Replace `<POOL>` and `<TRUENAS_LAN_IP>` with the actual dataset pool name and LAN address. Set `WEDDING_ADMIN_PASSWORD` in the Custom App's environment configuration or the private `.env` file. Do not put a real password in a committed Compose file. Publish both ports on the TrueNAS LAN address so the admin page is reachable locally, but do not configure a router port-forward for either port.

The app must start automatically with a restart policy. The Custom App UI should provide access to logs and restart controls. Verify after starting:

- Public origin on the LAN: `http://<TRUENAS_LAN_IP>:18000`
- Admin page on the LAN: `http://<TRUENAS_LAN_IP>:18001/admin`
- Live public site: [https://wedding.familyserver.store](https://wedding.familyserver.store)

Sign in to the admin page with the configured password. Use **Log out** when finished. Port `18001` is for trusted LAN access only.

### 3. Keep the existing Cloudflare Tunnel restricted

The existing Cloudflare hostname is `wedding.familyserver.store`. Its tunnel origin should reach the TrueNAS app on port `18000` (for example, `http://<TRUENAS_LAN_IP>:18000`). Keep the existing hostname and tunnel; update only the origin if it still points to a previous server.

Do not add port `18001` to the tunnel, expose it through a public hostname, or create a router port-forward for it. Cloudflare should route public traffic to port `18000` only. If the public tunnel already works, no tunnel or DNS changes are needed.

### 4. Update, test, and back up

To deploy code changes, update the project files in the host directory mounted at `/app`, then restart the Custom App from the TrueNAS Apps interface. The Cloudflare Tunnel normally does not need a restart for application changes.

Run tests from a development machine with Python 3.10 or newer before deploying:

```sh
python3 -m unittest discover -s tests -v
```

Use TrueNAS dataset snapshots or another private backup target for both the project configuration (`.env`) and `/mnt/<POOL>/apps/wedding-data/wishes.sqlite3`. Stop the app before manually copying the SQLite database. Protect backups because they contain admin credentials and guest wishes.

### 5. Troubleshooting

**The live site does not open**

1. Check the Custom App state and logs in TrueNAS SCALE.
2. Verify `http://<TRUENAS_LAN_IP>:18000` works from the local network.
3. Check that the existing Cloudflare Tunnel is connected and its origin targets port `18000`.
4. Do not route the admin port `18001` through Cloudflare.

**The wish form cannot save**

1. Check the Custom App logs for SQLite or request errors.
2. Confirm `/data` is mounted to persistent writable storage and `WEDDING_DB_PATH` is `/data/wishes.sqlite3`.
3. Confirm the app was restarted after changing its environment or storage configuration.

**The admin page is unavailable**

1. Confirm the Custom App publishes port `18001` on the TrueNAS LAN address.
2. Open `http://<TRUENAS_LAN_IP>:18001/admin` from a trusted LAN device.
3. Confirm LAN firewall or network rules allow access to `18001`.
4. Do not try to open the admin page through the public domain.

## Keeping data and credentials out of Git

`.env`, SQLite databases, CSV exports, and Python cache files are ignored. Do not commit Cloudflare tunnel credentials, admin passwords, guest wishes, or database backups. The `.env.example` file contains configuration names and a placeholder only.

Create the private GitHub repository empty as `rohan-anju-wedding-invitation`; then add it as `origin` and push the `main` branch. Do not add another README on GitHub because this repository already contains one:

```sh
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/rohan-anju-wedding-invitation.git
git push -u origin main
```

## Local assets and external links

The site's images, story photos, videos, music, JavaScript, and CSS are stored in this repository. It does not load external web fonts or third-party CSS/image assets. Font-family choices use local system fonts with fallbacks. Venue map URLs are optional outbound links and are not required to render the site.

The project owner has confirmed that the bundled wedding media may be redistributed with this project. The repository does not grant separate rights to those media files.
