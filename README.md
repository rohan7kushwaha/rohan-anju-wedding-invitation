# Rohan & Anju — Wedding Journey

A self-hosted wedding invitation site with local wedding media and a private, server-side guest-wishes inbox.

## Features

- Responsive invitation, event details, story carousel, countdown, and guest wishes form.
- Guest wishes are stored together in a SQLite database on the server.
- A separate admin dashboard shows and exports wishes. It requires an admin password and is restricted to the server's private network.
- The public site is served by a small Python server using only the Python standard library.

## Local development

Requirements: Python 3.10 or newer. No packages need to be installed.

1. Copy `.env.example` to `.env`.
2. Replace `WEDDING_ADMIN_PASSWORD` with a unique password of at least 16 characters.
3. Run `py server.py` from this folder.
4. Open `http://127.0.0.1:18000`.
5. On the server PC, open `http://127.0.0.1:18001/admin`. The browser will ask for the username `admin` and the password from `.env`.

## Editing invitation details

Update names and family blessings in `assets/Event Details/Member.json`, event names/dates/times in `assets/Event Details/EventDate.json`, and locations/routes in `assets/Event Details/Location.json`. The public HTML and JavaScript render these JSON values instead of maintaining duplicate hardcoded names or dates.

To open the admin dashboard from another device on the trusted home network, use the server PC's private IPv4 address, for example `http://192.168.1.25:18001/admin`. Do not port-forward port 18001 or route it through Cloudflare. Keep the `.env` file and `data/wishes.sqlite3` private.

The admin listener uses HTTP on the LAN. Use it only on a trusted, password-protected home network; do not use it over public Wi-Fi. If admin access is ever needed from an untrusted network, add a VPN or an HTTPS-protected access layer rather than exposing port 18001.

Run the focused server tests with:

```powershell
py -m unittest discover -s tests -v
```

## Wishes and privacy

- `POST /api/wishes` accepts validated guest submissions. Wishes are not stored in a visitor's browser.
- The public server does not expose a wishes-list endpoint or the admin page.
- `admin.html` and `GET /api/admin/wishes` are served only by the LAN admin listener on port 18001. That listener checks for a private-network client and HTTP Basic Authentication.
- The database is stored at `data/wishes.sqlite3` by default. It is ignored by Git. Back it up securely and keep exports private because wishes contain personal information.
- The form tells guests their wish will be saved for the couple to read. The Python server does not log guest IP addresses or wish contents.
- A Cloudflare Tunnel should point only to `http://127.0.0.1:18000`. Do not add port 18001 to its ingress configuration. Allow port 18001 through Windows Firewall only on the Private profile and LocalSubnet if LAN devices need admin access.

## Deploying behind Cloudflare

1. Confirm the domain is managed by Cloudflare and install `cloudflared` on the Windows server PC.
2. Create a named Cloudflare Tunnel and route the chosen public hostname to it.
3. Configure the tunnel's public ingress to forward the hostname to `http://127.0.0.1:18000`, followed by a catch-all `http_status:404` rule. Keep the tunnel credentials and config outside this repository.
4. Run `py server.py` on the server PC, then run the named tunnel with `cloudflared tunnel run <TUNNEL-NAME>`.
5. If devices on the home network need admin access, run this in an elevated PowerShell window to allow the admin port only from the Private profile and local subnet:

   ```powershell
   New-NetFirewallRule -DisplayName "Wedding Wishes Admin LAN" -Direction Inbound -Protocol TCP -LocalPort 18001 -Action Allow -Profile Private -RemoteAddress LocalSubnet
   ```

6. Configure Cloudflare rate limiting for `POST /api/wishes` to reduce spam. The public form is intentionally writable; the wishes list and admin port are not public.
7. Configure Windows Task Scheduler or a service manager to start both processes after reboot. Verify the public domain and the LAN-only admin URL separately.

GitHub Pages or another static-only host is not suitable for this setup because the wishes API and SQLite database must run on the Windows server.

## Keeping data and credentials out of Git

`.env`, SQLite databases, CSV exports, and Python cache files are ignored. Do not commit Cloudflare tunnel credentials, admin passwords, guest wishes, or database backups. The `.env.example` file contains configuration names and a placeholder only.

Create the private GitHub repository empty as `rohan-anju-wedding-invitation`; then add it as `origin` and push the `main` branch. Do not add another README on GitHub because this repository already contains one:

```powershell
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/rohan-anju-wedding-invitation.git
git push -u origin main
```

## Local assets and external links

The site's images, SVG story illustrations, videos, music, JavaScript, and CSS are stored in this repository. It does not load external web fonts or third-party CSS/image assets. Font-family choices use local system fonts with fallbacks. Venue map URLs are optional outbound links and are not required to render the site.

The project owner has confirmed that the bundled wedding media may be redistributed with this project. The repository does not grant separate rights to those media files.
