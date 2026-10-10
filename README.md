# RMF-Block

A real-time block editor for a team on one local network — no cloud service, no accounts.

![Two people editing one document; the block the other person is in is outlined in their colour](docs/images/editor.png)

One person, the **host**, runs RMF-Block as a Docker container. Everyone else on the **same
subnet** opens a link in their browser, joins with a nickname and the workspace password, and edits
the same documents together. CBNU Team H capstone project.

## Features

- **Block editor** — text, headings, lists, checklists, quotes, code, dividers, images, PDFs,
  files and links to other documents. A `/` menu and Markdown shortcuts (`# `, `- `, `[] `,
  `` ``` ``) create them.
- **Real-time co-editing** — edits reach everyone as they type, Hangul composition included, and
  the block someone is in is outlined in their colour.
- **Presence and focus following** — see who is connected, and share your screen position so
  others can follow it.
- **Document tree and version history** — nested documents; browse, name and restore past versions.
- **Chat with files** — messages and attachments, and a file list grouped into images, PDFs and
  other files.
- **Floating views** — pin a text, image or PDF block, or an image or PDF from chat, in a window
  that stays put while you move between documents.

![The chat file list beside a floating view of a shared image](docs/images/chat-floating.png)

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

Set `HOST_LAN_IP` in `.env` to this machine's IPv4 address on the same LAN as the guests.
Run the following commands on the **host machine**, outside the containers:

| Host OS | Command | Which address to use |
| :--- | :--- | :--- |
| Windows (PowerShell or Command Prompt) | `ipconfig` | The IPv4 address of the connected Wi-Fi or Ethernet adapter. Run it in Windows, not WSL. |
| Linux (Terminal) | `ip -4 addr show scope global` | The `inet` address of the Wi-Fi or Ethernet interface connected to the guests' LAN, without the `/…` suffix. |
| macOS (Terminal) | `networksetup -listallhardwareports` | Find the `Device` name for the Wi-Fi or Ethernet connection you are using, then query it as below. |

On macOS, if the device is `en0`, run:

```bash
ipconfig getifaddr en0
```

Replace `en0` with the device name you found; it is not always `en0`. If the command prints
no address, check that the selected connection is active and has an IPv4 address.
The command references are [Windows ipconfig](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ipconfig)
and [Apple's interface lookup guide](https://developer.apple.com/documentation/network/recording-a-packet-trace).

Choose the adapter connected to the guests' LAN if several addresses appear; Docker, WSL,
VPN and loopback interfaces may also be listed. For example, if the LAN address is
`192.168.0.14`, save this in `.env` (use your own address, not this example):

```dotenv
HOST_LAN_IP=192.168.0.14
```

For this Docker setup, set only `HOST_LAN_IP` and leave the other sample settings
as supplied. Choose the workspace name and password in the browser after startup.
The commented Yorkie addresses are for native development; Compose supplies its
own internal addresses and does not use those values from `.env`.

The release files do not automatically detect the host's LAN IP. In a clone,
`pnpm docker:up` runs [`scripts/detect-host-ip.sh`](scripts/detect-host-ip.sh) on the host
to attempt detection and write `.env`; that script is not included in a release.
If the LAN address changes, update `.env` and run `docker compose up -d` again.
Then start the stack:

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

- **Client/AP isolation.** Campus and guest Wi-Fi often block devices from reaching each other even
  on one network. Rule this out first — it is a router setting no script here can detect.
- **Windows hosts.** Docker Desktop's WSL2 backend may forward the port only to `127.0.0.1`. From a
  clone, `pnpm docker:up` checks whether WSL mirrored networking is enabled and prints configuration
  guidance. Mirrored networking needs Windows 11 22H2+; on older Windows, forward the port to
  the host's LAN address yourself (`netsh interface portproxy`).
- **Wrong address in the `Guest:` line**: correct `HOST_LAN_IP` in `.env` and run
  `docker compose up -d` again.

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
