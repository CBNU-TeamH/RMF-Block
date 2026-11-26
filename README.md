# RMF-Block

**English** · [한국어](README.ko.md)

A real-time block editor for a team on one local network. One person, the host, runs it with
Docker; teammates on the same subnet join from a browser and edit documents together.

| Document editing | Floating views and chat |
| :---: | :---: |
| <img src="docs/images/editing.png" width="420" alt="A meeting-notes document open in a tab; a guest's block is outlined in red"> | <img src="docs/images/floating.png" width="420" alt="A shared image in a floating view above a document, beside the chat's file list"> |
| **Screen sharing** | **Admin** |
| <img src="docs/images/screen-share.png" width="420" alt="A guest following the host's shared view, with the follow indicator in the header"> | <img src="docs/images/admin.png" width="420" alt="The admin page with the password form, connected guests and the trash"> |

## Features

- **Real-time editing** — text, headings, lists, checklists, quotes, code, tables, images, PDFs,
  files and document links from a `/` menu or Markdown shortcuts. Edits appear as they are typed,
  Hangul included, and each person's block is outlined in their colour.
- **Documents** — a nested tree with title search, tabs, multi-block copy, cut and delete,
  Markdown import, and a version history you can name and restore.
- **Chat and floating views** — chat with attachments and a file list; pin blocks or files in a
  window that stays open as you move between documents.
- **Following** — share your view for others to follow, see who is in which document, and jump to
  them.
- **Admin** — the host sets the workspace password, removes guests and restores deleted documents.

## Quick start

The host needs Docker with Compose 2.20 or newer (x86-64 or Apple Silicon).

1. [Download](#1-download) `docker-compose.yml` and `.env` from the latest release.
2. [Set the host's LAN address](#2-set-the-host-lan-address) in `.env`.
3. [Set the two Yorkie secrets](#3-set-the-yorkie-secrets) in `.env`.
4. [Open ports 3000 and 8080](#4-open-the-ports).
5. [Run `docker compose up`](#5-start-it), open the `Host:` link, and share the `Guest:` link.

## Setup

### 1. Download

```bash
mkdir rmf-block && cd rmf-block
curl -LO https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/docker-compose.yml
curl -L -o .env https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/env.sample
```

Windows PowerShell 5.1:

```powershell
mkdir rmf-block; Set-Location rmf-block
curl.exe -LO https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/docker-compose.yml
curl.exe -L -o .env https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/env.sample
```

In `.env`, fill in the three values from steps 2 and 3 and leave the rest as it is.

### 2. Set the host LAN address

Set `HOST_LAN_IP` to the host's IPv4 address on the guests' LAN, e.g. `HOST_LAN_IP=192.168.0.14`.
Find it on the host itself, not in a container or WSL:

| OS | Command |
| :--- | :--- |
| Windows (PowerShell) | `(Get-NetIPConfiguration \| Where-Object IPv4DefaultGateway).IPv4Address.IPAddress` |
| Linux | `ip -4 route get 1.1.1.1` (the address after `src`) |
| macOS | `ipconfig getifaddr "$(route -n get default \| awk '/interface:/{print $2}')"` |

If the address changes later, update `.env` and run `docker compose up -d`.

### 3. Set the Yorkie secrets

Compose will not start without them, since Yorkie's defaults would let anyone on the LAN read or
delete every document.

- `YORKIE_ADMIN_PASSWORD` — 8 to 30 characters with letters, digits and a symbol such as `-`. Keep
  it once set; a different value later stops the app from starting.
- `YORKIE_ADMIN_TOKEN_SECRET` — any random string of 32 characters or more.

### 4. Open the ports

Guests use TCP **3000** (the app) and **8080** (live edits). A page that loads but never shows edits
usually means 8080 is blocked.

- **Windows** — set the network profile to Private and allow Docker Desktop when asked. If it did
  not ask, run in PowerShell as administrator:
  `New-NetFirewallRule -DisplayName "RMF-Block" -Direction Inbound -Protocol TCP -LocalPort 3000,8080 -Action Allow -Profile Private`
- **macOS** — if the firewall is on, allow incoming connections for Docker.
- **Linux** — if `ufw` is active, `sudo ufw allow 3000,8080/tcp`.

### 5. Start it

```bash
docker compose up
```

```
rmf-app  |   Host:  http://localhost:3000/api/auth/host?secret=…
rmf-app  |   Guest: http://192.168.0.14:3000
```

- Open the **`Host:`** link yourself; it makes you the host. Keep it private: it works until the
  container restarts.
- The first visit opens the setup screen. Choose the workspace name and password and tell guests
  the password; change it later under **관리자** at the foot of the sidebar.
- Share the **`Guest:`** link with everyone else.
- Restarting the container signs everyone out but keeps documents and settings;
  `docker compose down -v` deletes them.

## If a guest cannot connect

Test the `Guest:` link from another device, such as a phone — the host itself proves nothing. Then
check:

1. **Wi-Fi isolation** — campus and guest Wi-Fi often block devices from reaching each other; try a
   phone hotspot.
2. **Ports** — 3000 and 8080 must both be open ([step 4](#4-open-the-ports)).
3. **Windows hosts** — Docker Desktop on WSL2 may forward ports only to `127.0.0.1`. Turn on
   [mirrored networking](https://learn.microsoft.com/windows/wsl/networking#mirrored-mode-networking)
   (Windows 11 22H2+) or forward them with `netsh interface portproxy`.
4. **Wrong address** — set `HOST_LAN_IP` to the Wi-Fi or Ethernet adapter's IPv4 from `ipconfig`,
   `ip -4 addr` or `ifconfig`, not a Docker, WSL or VPN one.

## Upgrading

Back up, download the new release's `docker-compose.yml` over the old one, then run
`docker compose pull` and `docker compose up -d`. Backups, rollback and moving from a clone:
[`docs/upgrading.md`](docs/upgrading.md).

## Documentation

| Read | For |
| :--- | :--- |
| [`docs/SRS-ko.md`](docs/SRS-ko.md) · [`docs/SRS-en.md`](docs/SRS-en.md) | Requirements (the agreed Korean text and its English translation) |
| [`docs/design/`](docs/design/) · [`docs/adr/`](docs/adr/) | Module design and architecture decisions |
| [`ROADMAP.md`](ROADMAP.md) | What is built and what comes next |
| [`AGENTS.md`](AGENTS.md) | Working rules and which doc answers what |

## Contributing

Development setup, checks and the path to a pull request: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Team

CBNU (Chungbuk National University) capstone design, Team H. Maintained by
[TaeTaeJin](https://github.com/TaeTaeJin) and [ujin999](https://github.com/ujin999).

## License

[MIT](LICENSE). The bundled Pretendard font is under the SIL Open Font License 1.1
([`app/fonts/PretendardVariable.LICENSE.txt`](app/fonts/PretendardVariable.LICENSE.txt)).
