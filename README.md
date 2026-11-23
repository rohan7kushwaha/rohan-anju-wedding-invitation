# Rohan & Anju — Wedding Journey

A self-hosted wedding invitation site with local wedding media and a private, server-side guest-wishes inbox.

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
3. Run `py server.py` from this folder.
4. Open `http://127.0.0.1:18000`.
5. On the server PC, open `http://127.0.0.1:18001/admin`. The browser will ask for the username `admin` and the password from `.env`.

## Editing invitation details

Update names and family blessings in `assets/event-details/Member.json`, event names/dates/times in `assets/event-details/EventDate.json`, and locations/routes in `assets/event-details/Location.json`. The public HTML and JavaScript render these JSON values instead of maintaining duplicate hardcoded names or dates.

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

This setup exposes only the public wedding site through Cloudflare. The SQLite API and wishes database run on the Windows PC. Port `18001` is kept off the public tunnel and is reachable only on the trusted local network.

### 1. Server prerequisites

1. Use Windows 10/11 or Windows Server.
2. Install Python 3.10 or newer and open a new PowerShell/Command Prompt window.
3. Clone or copy this project to a permanent location, for example `C:\Wedding_Program`.
4. Confirm the project contains a `.env` file and a strong admin password:

   ```text
   WEDDING_ADMIN_PASSWORD=<unique password of at least 16 characters>
   WEDDING_DB_PATH=data/wishes.sqlite3
   WEDDING_PUBLIC_HOST=127.0.0.1
   WEDDING_PUBLIC_PORT=18000
   WEDDING_ADMIN_HOST=0.0.0.0
   WEDDING_ADMIN_PORT=18001
   ```

5. Do not commit `.env`. It contains the admin credential and is ignored by Git.
6. From the project folder, run the tests:

   ```powershell
   py -m unittest discover -s tests -v
   ```

### 2. Confirm the local application

Start the application once from the project folder:

```powershell
py -u .\server.py
```

Verify in a browser:

- Public site: `http://127.0.0.1:18000`
- Public wish API: submit the form; the status should say the wish was received
- Admin from the server: `http://127.0.0.1:18001/admin`
- Admin from another trusted-LAN device: `http://<SERVER-LAN-IP>:18001/admin`

The admin browser prompts for username `admin` and the password in `.env`. In a private-network browser, open the admin address on the server PC or a LAN device first; do not add this address to Cloudflare.

Stop the temporary server with `Ctrl+C` before configuring startup tasks.

### 3. Install Cloudflare Tunnel

The domain must already be active in Cloudflare DNS.

```powershell
winget install --id Cloudflare.cloudflared
```

Close and reopen PowerShell, then confirm the executable:

```powershell
cloudflared --version
cloudflared tunnel login
```

The login command opens a browser. Choose the Cloudflare account and zone for the wedding domain, then authorize the browser window.

Create a named tunnel:

```powershell
cloudflared tunnel create wedding-invitation
```

Record the tunnel UUID printed by this command. Cloudflare creates credentials under the current user's `.cloudflared` folder, normally:

```text
C:\Users\<WINDOWS-USER>\.cloudflared\<TUNNEL-UUID>.json
```

Keep this credentials file outside the repository. Never commit it or share it.

### 4. Configure the public hostname

Create a configuration file at:

```text
C:\Users\<WINDOWS-USER>\.cloudflared\config.yml
```

Replace the placeholders:

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: C:\Users\<WINDOWS-USER>\.cloudflared\<TUNNEL-UUID>.json

ingress:
  - hostname: <WEDDING-SUBDOMAIN>.<YOUR-DOMAIN>
    service: http://127.0.0.1:18000
  - service: http_status:404
```

Example:

```text
Hostname: wedding.example.com
Public origin: http://127.0.0.1:18000
```

If the Cloudflare dashboard is preferred, create a Public Hostname and set it to `http://127.0.0.1:18000`. Do not create a public hostname for port `18001`.

Route the hostname to the tunnel:

```powershell
cloudflared tunnel route dns wedding-invitation <WEDDING-SUBDOMAIN>.<YOUR-DOMAIN>
```

This command creates or updates the Cloudflare DNS record. Cloudflare may take a few minutes to propagate the route.

### 5. Start and test the tunnel

Start the app server in one PowerShell window:

```powershell
cd C:\Wedding_Program
py -u .\server.py
```

Start the tunnel in a second window:

```powershell
cloudflared tunnel run wedding-invitation
```

Or, if using a UUID and explicit config:

```powershell
cloudflared tunnel --config C:\Users\<WINDOWS-USER>\.cloudflared\config.yml run <TUNNEL-UUID>
```

The tunnel and app must remain running. Verify:

1. `https://<WEDDING-SUBDOMAIN>.<YOUR-DOMAIN>` opens the invitation.
2. Submitting a wish succeeds.
3. `/admin` is not available on the public domain.
4. `http://<SERVER-LAN-IP>:18001/admin` works only from the trusted LAN.
5. The browser address bar shows HTTPS for the public domain.

Do not set DNS manually to a public or LAN IP address for the tunnel hostname. The Cloudflare tunnel route should be used instead.

### 6. Allow LAN admin access through Windows Firewall

Run elevated PowerShell only if a device besides the server PC must open the admin dashboard:

```powershell
New-NetFirewallRule -DisplayName "Wedding Wishes Admin LAN" -Direction Inbound -Protocol TCP -LocalPort 18001 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

Remove or disable this rule if LAN admin access is no longer needed:

```powershell
Remove-NetFirewallRule -DisplayName "Wedding Wishes Admin LAN"
```

If the LAN network profile is set to Public, change it to Private for a trusted home network before enabling the rule.

### 7. Start both processes after reboot

For reliability, configure two Windows Scheduled Tasks:

**Wedding public server**

- Trigger: At system startup
- Run whether the user is logged on or not
- Run with highest privileges only if required
- Program: `C:\Users\<WINDOWS-USER>\AppData\Local\Microsoft\WindowsApps\python.exe`
- Arguments: `-u C:\Wedding_Program\server.py`
- Start in: `C:\Wedding_Program`

Use `where.exe py` and `where.exe python` to determine the actual Python executable. The task should use an absolute executable path, not only `py`.

**Cloudflare tunnel**

- Trigger: Start after the Wedding public server task completes or shortly after system startup
- Program: absolute path returned by `Get-Command cloudflared`
- Arguments: `tunnel --config C:\Users\<WINDOWS-USER>\.cloudflared\config.yml run <TUNNEL-UUID>`
- Start in: `C:\Users\<WINDOWS-USER>\.cloudflared`

The Cloudflare tunnel credentials must remain accessible to the account that runs the scheduled task. Store the `.cloudflared` folder outside the project and outside Git.

Alternatively, use NSSM or Windows services, but document and secure the same absolute paths and credentials.

### 8. Protect the public wish form

The public form is intentionally writable. Add Cloudflare protection if needed:

1. Open `Security` / `WAF` in the Cloudflare dashboard.
2. Create a rate-limit rule for requests whose path equals `/api/wishes`.
3. Set a conservative limit appropriate for the expected guest count.
4. Optionally challenge or block repeated abusive requests.

Cloudflare does not protect port `18001` because that port is never included in the tunnel configuration.

### 9. Deploy changes

Pull the project from Git, or copy the updated files to the server:

```powershell
cd C:\Wedding_Program
git pull origin main
py -m unittest discover -s tests -v
```

Restart the server task or press `Ctrl+C` and start `py -u .\server.py` again if running manually. A tunnel restart is normally unnecessary for application-file changes because the tunnel forwards to port `18000`.

### 10. Backup and recovery

Back up both:

- `data/wishes.sqlite3`
- `.env`

Stop the server briefly before copying SQLite files so a write is not in progress. Store backups in a private location outside the repository and, ideally, outside the server PC.

When moving to another PC:

1. Install Python and `cloudflared`.
2. Copy the project and `.env`.
3. Copy the SQLite database.
4. Repeat the tunnel login or copy the private tunnel credentials securely.
5. Update the Cloudflare origin to `127.0.0.1:18000`.

GitHub Pages or another static-only host is not suitable for this setup because the wishes API and SQLite database must run on the Windows server.

### 11. Troubleshooting

**The public domain does not open**

1. Confirm `py -u .\server.py` is running and `http://127.0.0.1:18000` works locally.
2. Confirm `cloudflared tunnel run wedding-invitation` is running.
3. Check `cloudflared tunnel info wedding-invitation` if the tunnel does not appear healthy.
4. Confirm the public hostname and catch-all ingress rules in `config.yml`.
5. Confirm DNS for the public hostname points to the Cloudflare tunnel.

**The wish form says it could not be saved**

1. Confirm port `18000` belongs to `server.py`, not a static or stale server.
2. Check the server terminal for SQLite or JSON errors.
3. Verify `.env` has a valid admin password and database path.
4. Verify `POST /api/wishes` returns `201` from the browser/server.
5. Restart `server.py` after changing `.env`.

**The admin page is unavailable**

1. Confirm port `18001` is listening.
2. Use `http://127.0.0.1:18001/admin` on the server PC or `http://<SERVER-LAN-IP>:18001/admin` from the LAN.
3. Confirm Windows Firewall allows TCP `18001` from `LocalSubnet` on the Private profile.
4. Do not try to reach port `18001` through the public Cloudflare domain.

**The server restarts but Cloudflare is offline**

1. Check the Tunnel Scheduled Task's history and final result.
2. Confirm the `cloudflared` executable path exists.
3. Confirm the tunnel UUID and credentials JSON still exist in `.cloudflared`.
4. Confirm the scheduled task has permission to access the tunnel credentials.

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
