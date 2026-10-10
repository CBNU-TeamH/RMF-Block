# RMF-Block

**English** · [한국어](README.ko.md)

A real-time block editor for a team on one local network — no cloud service, no accounts.

One person, the **host**, runs RMF-Block as a Docker container. Everyone else on the **same
subnet** opens a link in their browser, joins with a nickname and the workspace password, and edits
the same documents together. CBNU Team H capstone project.

## Features

| Feature | What it does | Screenshot |
| :--- | :--- | :--- |
| **Document editing** | Text, headings, lists, checklists, quotes, code, images, PDFs, files and links to other documents, from a `/` menu or Markdown shortcuts. Edits reach everyone as they type, Hangul composition included, and the block someone is in is outlined in their colour. Documents nest in a tree, open as tabs, and keep a version history you can name and restore. | <img src="docs/images/editing.png" width="360" alt="Host's view of a meeting-notes document open in a tab; a guest's block is outlined in red"> |
| **Floating views and chat** | Chat with attachments, and a file list grouped into images, PDFs and other files. Pin a text, image or PDF block, or a file from chat, in a window that stays put while you move between documents. | <img src="docs/images/floating.png" width="360" alt="A shared image in a floating view above a document, beside the chat's file list"> |
| **Screen sharing** | Share your position in a document; others join with one click and follow it as you scroll and move between documents, until either side ends it. | <img src="docs/images/screen-share.png" width="360" alt="A guest following the host's shared view, with the follow indicator in the header"> |
| **Admin** | Host only: open the workspace with a name and password, change the password, remove a guest, and restore deleted documents from the trash. | <img src="docs/images/admin.png" width="360" alt="The admin page with the password form, connected guests and the trash"> |

## How it works

The host machine runs three containers: the app — a Next.js custom server for pages, REST and
WebSockets — and a self-hosted [Yorkie](https://yorkie.dev) server with MongoDB behind it. Yorkie
syncs every document as a CRDT and keeps its content and history; the app keeps its own state as
JSON under `.data/`. Documents, chat and uploaded files are stored on the host and shared over
the LAN.

[`ARCHITECTURE.md`](ARCHITECTURE.md) has the diagram; [`docs/design/architecture.md`](docs/design/architecture.md)
the contracts.

## Getting started

You need Docker with Compose 2.20 or newer — nothing else: no clone, no Node.js. Each
[release](https://github.com/CBNU-TeamH/RMF-Block/releases) runs a published image built for both
x86-64 and Apple Silicon.

On Linux or macOS:

```bash
mkdir rmf-block && cd rmf-block
curl -LO https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/docker-compose.yml
curl -L -o .env https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/env.sample
```

On Windows PowerShell 5.1:

```powershell
mkdir rmf-block
Set-Location rmf-block
curl.exe -LO https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/docker-compose.yml
curl.exe -L -o .env https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/env.sample
```

### Set the host's LAN address

Set `HOST_LAN_IP` in `.env` to this machine's IPv4 address on the guests' LAN. Each command
below prints the address of the connection your machine uses to reach the internet, which is
usually that one. Run it on the **host machine**, outside the containers:

Windows (PowerShell, in Windows rather than WSL):

```powershell
(Get-NetIPConfiguration | Where-Object IPv4DefaultGateway).IPv4Address.IPAddress
```

Linux — the address after `src`:

```bash
ip -4 route get 1.1.1.1
```

macOS:

```bash
ipconfig getifaddr "$(route -n get default | awk '/interface:/{print $2}')"
```

Nothing is sent to `1.1.1.1`; the command only asks which route would be used. If it prints
nothing, or a VPN address because a VPN is on, list every address instead — `ipconfig` on
Windows, `ip -4 addr show scope global` on Linux, `networksetup -listallhardwareports` and then
`ipconfig getifaddr <device>` on macOS — and take the Wi-Fi or Ethernet adapter's IPv4 address.
Docker, WSL, VPN and loopback interfaces may be listed too; they are not the one.

For example, if the LAN address is `192.168.0.14`, save this in `.env` (use your own address,
not this example):

```dotenv
HOST_LAN_IP=192.168.0.14
```

For this Docker setup, set only `HOST_LAN_IP` and leave the other sample settings
as supplied. Choose the workspace name and password in the browser after startup.
The commented Yorkie addresses are for native development; Compose supplies its
own internal addresses and does not use those values from `.env`.

From a clone, `pnpm docker:up` detects it and writes `.env`
([`scripts/detect-host-ip.sh`](scripts/detect-host-ip.sh), not part of a release). If the
address changes, update `.env` and run `docker compose up -d` again; a DHCP reservation for the
host on the router keeps it from changing.

### Open the ports

Guests connect to **TCP 3000** (the app) and **TCP 8080** (Yorkie, which carries the live edits).
A page that opens but never shows edits usually means 8080 is blocked.

- **Windows**: set the Wi-Fi or Ethernet network's profile to **Private**, and allow Docker
  Desktop when Windows Defender Firewall asks. If it did not ask, add a rule in PowerShell run as
  administrator:
  `New-NetFirewallRule -DisplayName "RMF-Block" -Direction Inbound -Protocol TCP -LocalPort 3000,8080 -Action Allow -Profile Private`
- **macOS**: if the firewall is on (System Settings → Network → Firewall), allow incoming
  connections for Docker.
- **Linux**: if `ufw` is active, `sudo ufw allow 3000,8080/tcp`.

### Start it

```bash
docker compose up
```

Among the startup output are these two lines:

```
rmf-app  |   Host:  http://localhost:3000/api/auth/host?secret=…
rmf-app  |   Guest: http://192.168.0.14:3000
```

- **Open the `Host:` link yourself.** It makes you the host and drops the secret from the address
  bar. Treat the line as a credential: it stays valid until the container restarts.
- **The first time, it opens the setup screen.** Choose the workspace name and the access password
  there, then tell guests the password. Until then the startup output says
  `host user의 workspace setting이 완료되지 않았습니다.` and guests cannot join. The **관리자** link (with
  a shield) at the foot of the sidebar, shown only to the host, is where you change the password later
  or remove a guest. The settings persist on the volume — emptying `.env` does not reset them; startup prints
  `Workspace "<name>" — saved settings …` when they exist. To see the setup screen again, stop the
  stack and delete `workspace.json` from the `app-data` volume.
- **Give everyone else the `Guest:` address.**
- **Restarting the container signs everyone out**; removing one guest is the admin page's 퇴장
  ([`docs/design/api.md`](docs/design/api.md)).
- **Documents and app state survive** restarts and upgrades on named volumes — members keep their
  colours — and `docker compose down -v` wipes them.

### Upgrading

Download the new release's `docker-compose.yml` over the old one, keep `.env`, and run:

```bash
docker compose pull && docker compose up -d
```

On Windows PowerShell 5.1, run `up` only if `pull` succeeds:

```powershell
docker compose pull
if ($LASTEXITCODE -eq 0) { docker compose up -d }
```

The documents and settings stay when the Compose project name stays the same. The release file
defaults to `rmf-block`; an older installation may have used its folder name instead.

**Switching an existing clone to a release:** before changing folders or removing containers,
find the current project name. On Linux or macOS:

```bash
docker inspect rmf-app --format '{{ index .Config.Labels "com.docker.compose.project" }}'
```

On Windows PowerShell 5.1:

```powershell
docker inspect rmf-app | ConvertFrom-Json | ForEach-Object { $_.Config.Labels.'com.docker.compose.project' }
```

Download the new release's `docker-compose.yml` into a separate folder and copy your existing
`.env` there, keeping `HOST_LAN_IP` and the other settings. Do not download `env.sample` over it.
Set `COMPOSE_PROJECT_NAME` in the copied `.env` to the name printed above, for example:

```dotenv
COMPOSE_PROJECT_NAME=rmf-block
```

Run the upgrade commands from that folder. It must contain no `docker-compose.override.yml`,
because a clone's override selects a source build. Keeping the project name reuses the existing
containers and the `app-data` and `mongo-data` volumes. `docker compose down` alone does not
move data between project names; changing the name selects different volumes. Do not use
`down -v`, which deletes them.

**Rolling back:** put the previous release's `docker-compose.yml` back in the folder and run the
same upgrade commands; the volumes stay. A newer version may have changed what it stores, which an
older one cannot always read, so back up the `app-data` and `mongo-data` volumes before upgrading.

Each release's file names its own version. To pin the exact image, append the digest from the
release notes (`…:0.0.1@sha256:…`). Use that one and not a digest from the package page, which pins
a single architecture.

### If a guest cannot connect

Test from another device on the LAN — a phone works — by opening the `Guest:` address. Opening it
on the host proves nothing about the network. If it fails, check in this order:

1. **Client/AP isolation.** Campus and guest Wi-Fi often block devices from reaching each other even
   on one network. It is a router setting no script here can detect; try a phone hotspot or
   another network to rule it out.
2. **Ports and firewall.** Both 3000 and 8080 must be open ([Open the ports](#open-the-ports)).
3. **Windows hosts.** Docker Desktop's WSL2 backend may forward the port only to `127.0.0.1`. From a
   clone, `pnpm docker:up` checks whether WSL mirrored networking is enabled and prints configuration
   guidance. Mirrored networking needs Windows 11 22H2+; on older Windows, forward the port to
   the host's LAN address yourself (`netsh interface portproxy`).
4. **Wrong address in the `Guest:` line**: see [Set the host's LAN address](#set-the-hosts-lan-address).

## Documentation

| Read | For |
| :--- | :--- |
| [`AGENTS.md`](AGENTS.md) | The working rules — workflow, coding principles, which doc answers what |
| [`docs/SRS-ko.md`](docs/SRS-ko.md) · [`docs/SRS-en.md`](docs/SRS-en.md) | Requirements: the agreed Korean text and its English translation |
| [`docs/design/`](docs/design/) · [`docs/adr/`](docs/adr/) | Module design and architecture decisions |
| [`ROADMAP.md`](ROADMAP.md) | What is built and what comes next |

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development setup, the checks, and how a change
becomes a pull request.

## License

[MIT](LICENSE). The bundled Pretendard font is under the SIL Open Font License 1.1
([`app/fonts/PretendardVariable.LICENSE.txt`](app/fonts/PretendardVariable.LICENSE.txt)).
