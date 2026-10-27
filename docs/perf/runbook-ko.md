# 2기기 성능 측정 운용 가이드

v0.1.0 성능 측정(#163, #174, #191)을 사람이 실기기로, H 쪽은 Claude와 함께 운용하는 절차입니다. 무엇을 왜 재는지는
[측정 기준 문서](../PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md), 하네스 코드는 `e2e/perf/`에 있습니다. 이 문서는
직접 기기를 다루는 팀원을 위해 한국어로 씁니다(`AGENTS.md` §5). 리허설에서 고칠 점이 나오면 이 파일을 고칩니다.

## 0. 역할과 용어

| 용어 | 뜻 |
|---|---|
| **H (호스트 기기)** | 서버 컨테이너(app·Yorkie·Mongo)를 띄우는 기기입니다. 측정 브라우저 1개, background 사용자 6명(headless), 하네스 orchestrator도 여기서 돌아갑니다. |
| **G (게스트 기기)** | 측정 브라우저 1개만 띄우는 기기입니다. 하네스가 H에서 원격으로 조종합니다. |
| **운영자** | 기기를 준비하고, G 쪽 작업(브라우저 서버, 열화 도구)을 하고, 화면을 지켜보고, 기록을 남기는 사람입니다(1~2명). |
| **Claude** | H에서 하네스를 실행하고 진행을 지켜보고, 요약을 만들어 통과 기준을 확인하는 Claude Code입니다(§7.1). G와 측정 창은 건드리지 않습니다. 쓰지 않으면 운영자가 같은 명령을 직접 칩니다. |
| **회차(round)** | 새 스택 → 8명 접속 → 10분 편집·채팅 → 발표 단계 → 수렴 확인 → 결과 저장 → 스택 삭제까지 한 바퀴입니다. 약 13분 걸립니다. |

- **편집, 채팅, 스크롤은 하네스가 자동으로 입력합니다.** 사람이 키보드로 치지 않습니다. 사람이 측정 창을 건드리면 그 회차는 무효입니다.
- 운영자가 하는 일은 이 순서입니다.
  1. 준비(§1~5)
  2. 스택과 브라우저 서버 기동, Claude 연결(§6~7)
  3. 리허설(§8)
  4. 회차 시작과 관찰(§9~14)
  5. 결과 회수(§15)

## 1. 준비물

- 측정 기기 2대(H, G). H는 RAM 16GB 이상을 권장합니다. 컨테이너 3개, Chrome 1개, headless 6개가 한 기기에서 함께 돌기 때문입니다.
- **측정 네트워크: 인터넷이 되고, 기기끼리 통신이 막혀 있지 않은 Wi-Fi 하나**(2026-10-16 변경, §3.0). H와 G를 같은 SSID에 붙이고, RMF-Block 트래픽은 그 안의 LAN으로만 오갑니다. 인터넷이 되므로 측정하는 동안 Claude를 쓸 수 있습니다.
  - 학교·도서관 공용 Wi-Fi는 기기끼리 통신을 막는 경우(client isolation)가 많아 쓸 수 없습니다. 개인 공유기나 isolation이 꺼진 네트워크를 고르고 §3.0에서 확인합니다.
  - 같은 네트워크를 다른 사람도 쓰므로 그 트래픽이 측정값을 흔들 수 있습니다. 시간대와 대략의 사용자 수를 조건 기록(§5)에 남깁니다.
  - 학교 Wi-Fi의 평소 조건과 혼잡한 조건은 값으로 재서 이 Wi-Fi 위에 G에서 겁니다(§11·§12).
- 두 기기 모두 전원 어댑터를 연결합니다. 배터리로 측정하지 않습니다.
- **판정 칸(§9)의 네트워크 조건**: H와 G 모두 측정 Wi-Fi에 무선으로 연결합니다(가능하면 같은 5GHz 대역). 게스트가 무선으로 붙는 실제 사용 형태입니다. 열화는 걸지 않습니다. 이와 다르게 측정했다면 조건 기록(§5)에 남깁니다.

기기 정보 기록표입니다. 측정 전에 채웁니다.

| 항목 | H | G |
|---|---|---|
| 모델 / CPU / RAM | | |
| OS 버전 | | |
| Chrome 버전 (`chrome://version`) | | |
| 무선 칩, 측정 Wi-Fi SSID·대역·채널·신호 세기 | | |
| Docker 버전, 할당 CPU·메모리 | | — |

## 2. 1회 설치

**§2는 측정일 전에 끝냅니다.** 측정 Wi-Fi에도 인터넷이 있지만, 회차 도중 이미지나 브라우저를 내려받으면 그 트래픽이 측정값을 흔듭니다.

### 2.1 H·G 공통

1. **Git**을 설치합니다.
2. **Node.js 24.x**를 설치합니다(https://nodejs.org, Linux는 nvm이나 배포판 패키지).
3. pnpm을 켭니다: `corepack enable`
4. 저장소를 받습니다. **두 기기가 같은 커밋이어야 합니다.** Playwright 버전이 같아야 원격 연결이 됩니다.
   ```
   git clone https://github.com/CBNU-TeamH/RMF-Block.git
   cd RMF-Block
   git checkout main && git pull
   pnpm install
   git rev-parse --short HEAD   # 두 기기에서 같은 값이어야 합니다
   ```
5. **Google Chrome**을 설치합니다(Linux는 https://www.google.com/chrome/ 의 .deb). 하네스는 Playwright에 내장된 Chromium이 아니라 설치된 Chrome을 씁니다. 측정 기간에는 두 기기의 Chrome 버전을 맞추고, 버전이 바뀌면 기록합니다(자동 업데이트 주의).

### 2.2 H만

- **Docker**를 설치합니다(Compose 2.20 이상). Windows·macOS는 Docker Desktop, Linux는 Docker Engine과 compose plugin(https://docs.docker.com/engine/install/)이고, Linux에서는 `sudo usermod -aG docker $USER` 후 다시 로그인합니다.
  - Windows: WSL2 backend를 씁니다. 하네스는 WSL이 아니라 PowerShell에서 돌립니다(측정 Chrome 창이 데스크톱에 떠야 합니다). WSL과 같은 폴더를 쓰면 `node_modules`가 리눅스용이라 PowerShell에서 깨지므로, 측정용 저장소는 Windows 쪽에 따로 받습니다(예: `C:\Users\<사용자>\rmf-perf`).
  - Windows에서 `C:\Users\<사용자>\.wslconfig`에 `networkingMode=mirrored`가 있으면, 아래 두 줄을 끝에 넣고 Docker Desktop 종료 → `wsl --shutdown` → Docker Desktop 다시 시작을 합니다. 없으면 H가 자기 Wi-Fi 주소로 컨테이너에 붙지 못해 하네스가 `never served /join`으로 멈춥니다(2026-10-16 확인).
    ```
    [experimental]
    hostAddressLoopback=true
    ```
    게스트 접속 문제 전반은 README [If a guest cannot connect](https://github.com/CBNU-TeamH/RMF-Block#if-a-guest-cannot-connect)의 3번 항목도 봅니다.
  - macOS: Settings → Resources에서 CPU와 메모리 할당량을 확인하고 기록합니다.
- 이미지를 미리 받아 둡니다. 앱 이미지는 하네스가 고정한 digest 그대로 받습니다.
  ```
  docker pull ghcr.io/cbnu-teamh/rmf-block:0.1.0@sha256:b14f53c05ca2e9e3e54a55725e59eceeed0f822458d4daca4611f2723c58a9b1
  docker pull yorkieteam/yorkie:0.7.23
  docker pull mongo:8
  docker pull prom/prometheus:v3.5.0
  docker pull gcr.io/cadvisor/cadvisor:v0.52.1
  docker pull grafana/grafana:12.1.1
  ```
  아래 세 개는 관측 스택(§14) 이미지입니다.
- background 사용자 6명이 쓰는 Playwright 내장 Chromium(headless)을 받습니다. 측정 Chrome과 별개입니다.
  ```
  pnpm exec playwright install chromium            # Linux는 --with-deps 추가
  ```
- 설치 확인으로 한 기기 회차를 한 번 돌립니다(약 4분, Chrome 창이 떴다가 닫힘). `1 passed`면 이미지와 브라우저가 다 있습니다. 결과 폴더는 지워도 됩니다.
  ```
  PERF_SINGLE_MACHINE=1 PERF_USERS=2 PERF_MINUTES=1 pnpm perf
  # PowerShell: $env:PERF_SINGLE_MACHINE="1"; $env:PERF_USERS="2"; $env:PERF_MINUTES="1"; pnpm perf
  #             끝나면 Remove-Item Env:PERF_SINGLE_MACHINE, Env:PERF_USERS, Env:PERF_MINUTES
  ```

### 2.3 네트워크 측정·열화 도구

| 도구 | 설치할 기기 | Windows | macOS | Linux |
|---|---|---|---|---|
| iperf3 | 학교 Wi-Fi를 잴 기기(§11) | https://iperf.fr 에서 Windows 빌드를 받아 압축 해제 | `brew install iperf3` | `sudo apt install iperf3` |
| 열화 도구 | G만 | **Clumsy**(https://jagt.github.io/clumsy/). 관리자 권한으로 실행 | 내장된 `dnctl`+`pfctl` | `tc`(iproute2)와 `ifb` 모듈, 보통 기본 설치 |

## 3. 네트워크 준비

### 3.0 측정 네트워크: 인터넷 되는 같은 Wi-Fi (2026-10-16 변경)

처음에는 리눅스 노트북의 오프라인 핫스팟을 쓰려 했지만, 인터넷이 없으면 측정 중에 Claude를 쓸 수 없고, 혼잡은 어차피 G에서 일부러 겁니다(§12). 그래서 인터넷이 되는 Wi-Fi 하나에 H와 G를 붙입니다(팀 합의).

**H와 G에서**
- **같은 SSID에 연결합니다.** 가능하면 같은 대역(5GHz)에 붙이고, VPN은 끕니다.
- **다른 Wi-Fi 자동 연결을 끕니다.** 측정 도중 다른 SSID로 옮겨 가면 주소가 바뀌어 회차가 깨집니다.
  - Windows: 다른 Wi-Fi 속성에서 "범위 내에 있으면 자동으로 연결" 해제
  - macOS: 시스템 설정 → Wi-Fi → 다른 네트워크의 "자동 연결" 끄기
  - Linux: `nmcli connection modify <다른 Wi-Fi 이름> connection.autoconnect no`
- **Windows는 새 네트워크를 공용(Public)으로 잡습니다.** 측정 Wi-Fi의 네트워크 프로필을 **개인(Private)**으로 바꿉니다. 관리자 PowerShell에서 `Set-NetConnectionProfile -InterfaceAlias Wi-Fi -NetworkCategory Private`, 확인은 `Get-NetConnectionProfile`. 아래 방화벽 규칙이 개인 프로필에만 걸려 있습니다.
- **인터넷이 연결돼 있으므로 업데이트와 동기화를 막습니다**(§4). Windows는 측정 Wi-Fi를 "데이터 통신 연결(종량제)"로 설정하면 업데이트 다운로드가 멈춥니다(설정 → 네트워크 및 인터넷 → Wi-Fi → 그 네트워크 속성).
- 기록할 값(H·G 각각): SSID, 대역·채널, 신호 세기. Windows는 `netsh wlan show interfaces` 하나로 다 나오고, macOS는 Option+Wi-Fi 아이콘, Linux는 `iw dev <wlan> link`.
- 기기끼리 통신이 되는지(client isolation이 없는지)는 §3.1의 4번에서 확인합니다.

### 3.1 연결과 확인

1. H와 G를 측정 Wi-Fi에 연결합니다.
2. 두 기기의 주소를 확인합니다. H 주소는 자동 감지에 맡기지 않고 하네스에 `HOST_LAN_IP`로 직접 넘깁니다. 어댑터가 여럿(유선, VPN, WSL, Docker)이면 자동 감지가 다른 주소를 잡을 수 있기 때문입니다.
   - Windows: `ipconfig` 출력에서 "무선 LAN 어댑터 Wi-Fi"의 IPv4 주소
   - macOS: `ipconfig getifaddr en0` (Wi-Fi가 `en0`이 아니면 `networksetup -listallhardwareports`로 장치 이름 확인)
   - Linux: `ip -4 addr show <wlan>`
   - 아래에서 H 주소는 `<H_IP>`, G 주소는 `<G_IP>`로 씁니다. 명령에 넣을 때는 `< >`까지 지우고 숫자만 넣습니다. 측정일마다(Wi-Fi에 다시 붙을 때마다) 바뀔 수 있으니 매번 확인합니다.
   - 두 주소의 앞 세 자리가 같은지 봅니다(예: 둘 다 `192.168.0.x`). 다르면 같은 네트워크가 아닙니다.
3. 방화벽을 엽니다. 같은 네트워크를 다른 사람도 쓰므로 **상대 기기 주소에서 오는 연결만** 허용합니다. 특히 G의 9333은 열려 있으면 그 네트워크의 누구나 G의 브라우저를 조종할 수 있습니다.
   - **H**: TCP 3000(app), 8080(Yorkie), G에서만
     - Windows(관리자 PowerShell):
       ```
       New-NetFirewallRule -DisplayName "RMF-perf H" -Direction Inbound -Protocol TCP -LocalPort 3000,8080 -RemoteAddress <G_IP> -Action Allow -Profile Private
       ```
       `.wslconfig`가 `networkingMode=mirrored`인 Windows H는 Docker(WSL)로 들어오는 연결을 Hyper-V 방화벽이 따로 막으므로 이 규칙도 만듭니다(2026-10-16 확인).
       ```
       New-NetFirewallHyperVRule -Name "RMF-perf-WSL" -DisplayName "RMF-perf WSL" -Direction Inbound -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts 3000,8080 -RemoteAddresses <G_IP> -Action Allow
       ```
     - macOS: 시스템 설정 → 네트워크 → 방화벽이 켜져 있으면 Docker의 수신 연결을 허용합니다.
     - Linux: Docker가 publish한 포트는 ufw 규칙을 거치지 않으므로 ufw로는 G만 허용할 수 없습니다. Docker의 `DOCKER-USER` 체인에서 측정 Wi-Fi로 들어오는 G 외의 연결을 버립니다(`<wlan>`은 측정 Wi-Fi 인터페이스. `-i <wlan>`이 있어 회차 컨테이너끼리의 통신은 걸리지 않습니다).
       ```
       sudo iptables -I DOCKER-USER -i <wlan> -p tcp -m multiport --dports 3000,8080 ! -s <G_IP> -j DROP
       ```
       적용한 뒤 G가 아닌 기기(휴대폰)로 `http://<H_IP>:3000/join`이 **열리지 않는지** 확인합니다. 열리면 IPv6로 들어온 것일 수 있으니 같은 규칙을 `ip6tables`(G의 IPv6 주소)로도 넣습니다. 같은 이유로 관측 스택(Grafana, metrics)은 반드시 `127.0.0.1`에만 바인드합니다(#192).
   - **G**: 브라우저 서버 포트 `9333`, H에서만
     - Windows:
       ```
       New-NetFirewallRule -DisplayName "RMF-perf G" -Direction Inbound -Protocol TCP -LocalPort 9333 -RemoteAddress <H_IP> -Action Allow -Profile Private
       ```
     - macOS: 방화벽이 켜져 있으면 node의 수신 연결을 허용하고, 내장 pf로 H 외의 주소를 막습니다. anchor 이름이 `com.apple`로 시작해서 기본 규칙(`/etc/pf.conf`)이 자동으로 읽습니다.
       ```
       echo "block in quick proto tcp from ! <H_IP> to any port 9333" | sudo pfctl -a com.apple/rmf-perf -f -
       sudo pfctl -e
       ```
       적용한 뒤 H가 아닌 기기에서 `<G_IP>:9333`에 연결되지 않는지 확인합니다. §12의 macOS 열화 명령은 pf 규칙 전체를 바꾸므로 그 명령에도 이 차단 줄이 들어 있습니다.
     - Linux: ufw가 켜져 있으면 `sudo ufw allow from <H_IP> to any port 9333 proto tcp`
   - 주소가 바뀌면 규칙을 지우고(§15) 새 주소로 다시 만듭니다.
4. **G에서 도달을 확인합니다.** 스택이 떠 있을 때(§6) 합니다.
   - 브라우저로 `http://<H_IP>:3000/join`이 열려야 합니다.
   - Yorkie 응답 코드가 `200`이어야 합니다.
     - Windows: `curl.exe -s -o NUL -w "%{http_code}" http://<H_IP>:8080/yorkie.v1.YorkieService/health`
     - macOS·Linux: `curl -s -o /dev/null -w "%{http_code}" http://<H_IP>:8080/yorkie.v1.YorkieService/health`
   - 페이지는 열리는데 편집 내용이 보이지 않으면 8080이 막힌 것입니다.
5. **연결이 안 될 때는 순서대로 원인을 좁힙니다.** ping과 HTTP가 실패한다고 바로 client isolation이라고 단정하지 않습니다.
   1. `<H_IP>`가 맞는지 다시 확인합니다(VPN, Docker, WSL 주소가 아닌지).
   2. H의 방화벽 규칙, 규칙의 `<G_IP>`가 지금 G 주소인지, 네트워크 프로필(개인)을 확인합니다. mirrored 모드 Windows H는 Hyper-V 규칙(§3.1의 3번)도 확인합니다.
   3. H에서 직접 `curl http://localhost:3000/join`이 되는지 봅니다. 여기서 안 되면 네트워크가 아니라 스택 문제입니다. localhost는 되는데 `http://<H_IP>:3000/join`이 H에서도 안 되면 `hostAddressLoopback`(§2.2)이 빠진 것입니다.
   4. H의 방화벽을 잠시 끄고 다시 시도해, 방화벽 문제인지 네트워크 문제인지 가릅니다.
   5. 방화벽을 꺼도 G에서 안 되면 그 Wi-Fi가 기기끼리 통신을 막는 것(client isolation)입니다. 공유기 설정에서 끌 수 없으면 다른 네트워크를 고릅니다.

## 4. 측정 전 기기 위생 (측정일마다, H·G 모두)

측정 Wi-Fi에 인터넷이 있으므로 업데이트·동기화·자동 다운로드가 회차 도중 시작될 수 있습니다. 아래 표의 "업데이트·동기화" 줄을 특히 챙깁니다.

| 항목 | Windows | macOS | Linux |
|---|---|---|---|
| 전원 어댑터 연결 | 필수 | 필수 | 필수 |
| 성능 모드 | 설정 → 시스템 → 전원 → 전원 모드 "최고 성능" (또는 `powercfg /setactive SCHEME_MIN`) | 저전력 모드 끄기: `sudo pmset -a lowpowermode 0` | `powerprofilesctl set performance` |
| 절전·화면 꺼짐·잠금 끄기 | `powercfg /change standby-timeout-ac 0`, `powercfg /change monitor-timeout-ac 0`, 화면 보호기 없음 | 측정하는 동안 터미널 하나에 `caffeinate -dimsu`를 띄워 둠 | 측정하는 동안 `systemd-inhibit --what=idle:sleep:handle-lid-switch sleep infinity`, GNOME은 `gsettings set org.gnome.desktop.session idle-delay 0`, `gsettings set org.gnome.desktop.screensaver lock-enabled false` |
| Wi-Fi 절전 끄기 | 장치 관리자 → 네트워크 어댑터 → 전원 관리 → "전원을 절약하기 위해 컴퓨터가 이 장치를 끌 수 있음" 해제 | 별도 설정 없음(전원 연결로 대신함) | `sudo iw dev <wlan> set power_save off` |
| 알림 | 방해 금지 켜기 | 집중 모드 켜기 | GNOME: `gsettings set org.gnome.desktop.notifications show-banners false` |
| 업데이트·동기화 | Windows 업데이트 일시 중지, 측정 Wi-Fi를 데이터 통신 연결(종량제)로, OneDrive 등 동기화 일시 중지, Chrome 자동 업데이트 주의 | 소프트웨어 업데이트 자동 설치 끄기, iCloud Drive 동기화 일시 중지 | Ubuntu: `sudo systemctl stop unattended-upgrades` |
| 다른 앱 | 브라우저, 메신저, IDE 등을 모두 종료 | 동일 | 동일 |
| VPN | 끄기 | 끄기 | 끄기 |

**측정 중에 하면 안 되는 것**
- **측정 Chrome 창을 최소화하거나 화면을 잠그지 않습니다.** 페인트가 멈춰 측정값이 틀어집니다. 다른 창으로 가리는 것은 괜찮지만 최소화는 안 됩니다.
- 측정 창의 크기를 바꾸지 않습니다. 발표 따라가기(NFR-PER-005) 측정이 뷰포트 크기에 영향을 받습니다.
- 측정 창 안을 클릭하거나 타이핑하지 않습니다.
- 노트북 덮개를 닫지 않습니다.

## 5. 측정 조건 기록

하네스가 자동으로 남기는 항목은 하네스 커밋, 이미지 digest, Chrome 버전, 뷰포트, 시계 offset, 회차별 결과입니다.

**사람이 남겨야 하는 항목**은 회차 묶음마다 기록합니다. 저장 위치는 `perf-results/<run-id>/operator-notes.md`입니다.

```
날짜/시간:
장소 (집 / 강의실 …):
네트워크: 측정 Wi-Fi SSID, 대역(2.4/5GHz)·채널, H_IP, G_IP, 인터넷 연결됨
같은 Wi-Fi의 다른 사용자: 대략의 수, 시간대, 눈에 띄는 대용량 트래픽
H·G의 신호 세기: Windows는 `netsh wlan show interfaces`의 "신호", macOS는 Option+Wi-Fi 아이콘의 RSSI, Linux는 `iw dev <wlan> link`
토폴로지: H = 서버 + 측정 클라이언트 + background 6
Claude: H에서 하네스 실행·감시 (예/아니오)
열화 조건 (없으면 baseline): 도구, 설정값, 방향
특이사항: (누가 무엇을 만졌는지, 경고창, 끊김 등)
```

## 6. 스택 기동·종료 (H)

> ⚠️ **`docker compose down -v`를 프로젝트 지정 없이 실행하지 마세요.** 실제로 쓰고 있는 `rmf-block` 프로젝트의 문서와 설정 볼륨이 지워집니다. 측정용 스택은 하네스가 회차마다 별도 프로젝트로 만들고 지웁니다.

1. 개발용 스택이 떠 있으면 저장소 폴더에서 `docker compose stop`으로 **정지만** 합니다. `down`이 아닙니다. 측정 스택과 컨테이너 이름(`rmf-app` 등)이 겹치지 않게 하기 위해서입니다.
2. 측정 스택은 하네스가 회차마다 자동으로 띄우고 지우므로, 운영자가 따로 띄우지 않습니다. 회차가 도는 동안 `docker compose ls`에 `rmf-perf-<run-id>-<회차>` 프로젝트가 하나 보입니다.
3. 측정이 모두 끝나면 `docker compose ls`를 실행해서 이름이 `rmf-perf-`로 시작하는 프로젝트가 남아 있지 않은지 확인합니다.

## 7. G 브라우저 서버 기동

```
cd RMF-Block
pnpm perf:browser
```

- 화면에 Chrome 창이 하나 뜹니다. **건드리지 않습니다.**
- 터미널에 연결 주소(`ws://<G_IP>:<포트>/…`)가 출력되면 H 운영자에게 전달합니다. 주소는 자동으로 찾지 않으므로, H 운영자가 `PERF_G_WS`로 넘깁니다(부록).
- 측정이 끝나면 이 터미널에서 `Ctrl+C`로 **반드시 종료합니다.** 켜 두는 동안에는 방화벽(§3.1)이 허용한 주소(H)에서 이 브라우저를 조종할 수 있습니다. 그 규칙 없이 켜면 같은 네트워크의 누구나 조종할 수 있으니, §3.1의 G 규칙을 먼저 만듭니다.

## 7.1 Claude와 함께 운용하기 (H)

H에 Claude Code가 있으면 H 쪽 명령 실행과 감시를 맡길 수 있습니다. 사람은 G 쪽 작업, 화면 관찰, 기록, 판단을 맡습니다. Claude를 쓰지 않으면 같은 명령을 운영자가 직접 칩니다.

| 단계 | Claude가 하는 일 | 사람이 하는 일 |
|---|---|---|
| 준비 | §2.2 설치 확인 회차, 이미지와 브라우저 확인 | §3 연결·방화벽, G 브라우저 서버를 띄우고 `ws://` 주소를 Claude에게 전달 |
| 리허설(§8) | 리허설 실행, `pnpm perf:report`로 통과 기준 확인. 하나라도 안 되면 §9로 넘어가지 않고 원인을 보고 | G에서 `curl`로 도달 확인, 리허설 중 메모리 대조(`Shift+Esc`) |
| 판정·램프(§9·§10) | 실행, 몇 분 간격으로 새 `round-NN` 폴더만 확인해 진행을 알림, 끝나면 요약과 판정 | 회차마다 화면 확인, 운영자 기록, 이상 상황의 분류 결정(§9 표) |
| 열화(§12) | 프리셋 적용을 요청하고, 1분 확인 회차의 `G RTT median`으로 적용을 확인한 뒤 칸을 시작. 칸이 끝나면 해제를 요청하고 같은 방법으로 확인 | G에서 도구로 프리셋 적용·해제 |
| 정리(§15) | `docker compose ls` 확인, 요약 재생성 | G 브라우저 서버 종료, 방화벽·열화 해제 |

- 회차가 도는 동안 Claude는 H에서 무거운 일(빌드, 테스트, 큰 파일 읽기, 다운로드)을 하지 않습니다. 진행 확인은 몇 분 간격의 폴더 확인으로 충분합니다.
- 회차 교체(§9)와 이상 상황의 분류는 Claude가 근거를 보여 주고 사람이 정합니다.
- Claude가 H에서 돌았다는 사실은 조건 기록(§5)에 남깁니다.
- Windows H에서 Claude Code는 WSL에서, 하네스는 PowerShell에서 돕니다(§2.2). 측정용 저장소가 `C:\Users\<사용자>\rmf-perf`이고 Node를 fnm으로 넣었다면 Claude는 이렇게 실행하고, 결과는 WSL에서 `/mnt/c/Users/<사용자>/rmf-perf/perf-results/<run-id>/`로 읽습니다.
  ```
  powershell.exe -NoProfile -Command 'cd $env:USERPROFILE\rmf-perf; fnm env | Out-String | Invoke-Expression; fnm use 24; $env:HOST_LAN_IP="<H_IP>"; $env:PERF_G_WS="<G가 알려준 주소>"; $env:PERF_RUN_ID="<run-id>"; pnpm perf'
  ```

**G를 SSH로 다루는 경우 (선택).** G에 SSH 서버가 있으면 H의 Claude가 `ssh <G 사용자>@<G_IP> "..."`로 G 쪽 일 두 가지를 직접 할 수 있습니다. Claude는 H에 하나만 두고, G에는 두지 않습니다.

- **브라우저 서버 주소 회수.** 브라우저 서버 자체는 **사람이 G의 데스크톱 터미널에서** 켭니다. SSH로 띄운 Chrome은 G의 데스크톱에 창이 뜨지 않습니다(Windows는 다른 세션, macOS·Linux는 로그인한 화면과 별개). 출력을 파일로 남겨 두면 Claude가 주소를 읽어 갑니다.
  - bash: `pnpm perf:browser 2>&1 | tee perf-browser.log`
  - PowerShell: `pnpm perf:browser 2>&1 | Tee-Object perf-browser.log`
  - Claude: `ssh <G 사용자>@<G_IP> "grep PERF_G_WS <G 저장소 경로>/perf-browser.log"`. Windows G는 `"powershell -c Select-String PERF_G_WS <G 저장소 경로>\perf-browser.log"`(PowerShell 5의 `Tee-Object`가 UTF-16으로 저장해 `findstr`로는 안 읽힘). 저장소 경로는 운영자가 Claude에게 알려 줍니다.
- **열화 적용·해제(Linux·macOS G).** §12의 `tc` 또는 `dnctl`·`pfctl` 명령을 칸 사이에 Claude가 실행하고, 1분 확인 회차로 적용을 확인합니다. 이 명령들만 비밀번호 없이 sudo로 돌도록 G에 설정합니다(`sudo visudo -f /etc/sudoers.d/rmf-perf`에 그 명령 경로만). Windows G의 Clumsy는 GUI라 사람이 겁니다.
- 준비: G에 SSH 서버(Windows는 OpenSSH Server, macOS는 원격 로그인, Linux는 `openssh-server`), H의 공개 키 등록, G 방화벽에서 22번은 H 주소에서만 허용.
- **회차가 도는 동안 G에서는 SSH 명령도 실행하지 않습니다.** G는 네트워크를 거쳐 재는 기기라 H보다 측정값에 민감합니다. 칸과 칸 사이에만 씁니다.

## 8. 리허설 (본 측정 전에 반드시)

H에서 실행합니다(2명, 1분). **먼저 H의 터미널에서 연결 변수 두 개를 한 번만 정합니다** — 이후 모든 `pnpm perf` 명령이 이 값을 씁니다(부록). 하네스는 `PERF_G_WS`가 없으면 바로 멈춥니다. Windows H는 WSL이 아니라 PowerShell에서 실행합니다(측정 Chrome 창이 데스크톱에 떠야 합니다).

```
export HOST_LAN_IP=<H_IP> PERF_G_WS=<G가 알려준 주소>   # PowerShell: $env:HOST_LAN_IP="<H_IP>"; $env:PERF_G_WS="<G가 알려준 주소>"
PERF_RUN_ID=rehearsal-a PERF_USERS=2 PERF_MINUTES=1 pnpm perf
# PowerShell: $env:PERF_RUN_ID="rehearsal-a"; $env:PERF_USERS="2"; $env:PERF_MINUTES="1"; pnpm perf
pnpm perf:report perf-results/rehearsal-a
```

`PERF_RUN_ID`를 정하면 결과가 `perf-results/<그 이름>/`에 쌓여 폴더를 찾을 필요가 없습니다(영문 소문자·숫자·`-`만). `<H_IP>`처럼 `< >`로 감싼 부분은 `< >`까지 지우고 실제 값을 넣습니다. 그대로 두면 하네스가 `never served /join`으로 멈춥니다.

아래가 모두 확인되면 통과입니다.
- [ ] G 화면의 Chrome이 자동으로 접속하고, 편집과 채팅이 보인다. `perf-results/<run-id>/round-01/conditions.json`에 `"gRemote": true`와 H의 Wi-Fi 주소(`host`)가 적혀 있다 — 아니면 G가 아니라 H 혼자 잰 것이다.
- [ ] `pnpm perf:report` 출력(`summary.md`)의 **U 칸이 한도(10ms, #189) 안에 있다.** U(시계 보정 불확실도)는 하네스 실행 화면에는 나오지 않고 이 요약에만 나옵니다. 하네스는 측정 중에도 `PERF_MINUTES`의 4분의 1마다(10분이면 2분 30초, 1분 리허설이면 15초) 시계를 읽어서, 일정하게 흐르는 시계는 U에 넣지 않습니다(#215). 옆의 `U (legacy)`는 시작·끝만 쓰는 옛 계산이라 참고용입니다. 한도를 넘으면 원인(절전, 시계 점프, 네트워크)을 먼저 해결합니다. 두 기기의 OS 시간 동기화(NTP)는 U에 영향이 없으니 따로 맞출 필요가 없습니다.
- [ ] 002/003/004/005 샘플이 각각 1건 이상이고, 시도·관측·타임아웃·불일치 건수가 함께 출력되며, 에러는 0건이다.
- [ ] **H와 G 양쪽에서** 메모리 샘플이 10초 간격으로 기록된다. 첫 리허설에서는 기기마다 한 번씩 측정 Chrome에서 `Shift+Esc`로 작업 관리자를 열고, 그 탭의 "메모리 사용 공간(Memory footprint)"을 하네스가 기록한 값과 비교해 적어 둡니다. 2명 1분 스모크는 localhost로도 통과할 수 있으므로, 이 항목은 **8명 1회차 리허설에서 두 기기 모두** 확인합니다.
- [ ] 회차가 끝나면 측정 스택이 지워진다(`docker compose ls`로 확인).

그다음 8명으로 1회차(약 13분)를 돌려 같은 항목을 확인합니다. 이것까지 통과해야 §9로 넘어갑니다.

## 9. 본 측정: 8명 × baseline × 20회차 (SRS 판정 칸)

- 예상 시간은 회차당 약 13분 × 20회, **약 4.5시간**입니다. 하네스가 회차를 연속으로 돌립니다.
- 시작 명령: `PERF_ROUNDS=20 pnpm perf` (8명, 10분이 기본값). 끝나면 `pnpm perf:report perf-results/<run-id>`로 요약을 만듭니다. 표는 `summary.md`, 그래프는 같은 폴더의 `summary.html`(브라우저로 열기, 인터넷 없이 열림)입니다.
- 이 칸에서는 **관측 스택(Prometheus/Grafana)을 켜지 않습니다.** H의 CPU를 나눠 써서 측정값을 흔들기 때문입니다.

15~30분마다 다음을 확인합니다.
- 두 기기 화면이 꺼지거나 잠기지 않았는가
- 하네스 터미널의 회차 번호가 올라가고 있고, 경고가 없는가
- 측정 Chrome 상단에 `⚠ 연결 끊김`이 떠 있지 않은가

### 이상 상황 대응: 원인을 셋으로 나눕니다

| 분류 | 뜻 | 판정에서 |
|---|---|---|
| **제품 실패** | RMF-Block 자체가 잘못 동작함 | NFR-PER-001 실패로 집계합니다. 다시 돌려서 지우지 않습니다. |
| **계측 실패** | 하네스나 측정 장치의 문제 | 그 회차를 교체합니다. 증거와 이유를 남깁니다. |
| **외부·운영자 요인** | 기기 절전, 사람의 조작, 네트워크 외부 요인 | 그 회차를 교체합니다. 증거와 이유를 남깁니다. |

| 상황 | 분류 | 할 일 |
|---|---|---|
| `⚠ 연결 끊김`이 뜸, 수렴 실패, 예상 밖 에러, 마커 중복 | **제품 실패** | **새로고침하지 않습니다.** 하네스가 실패로 기록하게 두고 다음 회차로 넘어갑니다. 시각과 화면을 기록합니다(#37 관련일 수 있음). |
| 시계 불확실도 U가 한도를 넘음, 하네스가 멈춤 | **계측 실패** | 그 회차를 교체합니다(아래). 측정 프로젝트가 남아 있으면 `docker compose -p <남은 프로젝트 이름> down --volumes`로 지웁니다. |
| 기기 절전이나 화면 잠김, 사람이 창을 건드림, 업데이트로 재시작, 공유기 재부팅, 같은 네트워크에서 대용량 다운로드 | **외부·운영자 요인** | 그 회차를 교체하고 원인을 기록합니다. |
| **G 브라우저 서버 연결이 끊김** | **먼저 조사** | 바로 무효 처리하지 않습니다. 그 시각의 H CPU와 `docker stats`를 확인합니다. 제품 컨테이너(app·Yorkie·Mongo) 때문에 H가 포화됐다면 **제품 실패 후보**로 기록합니다. headless 6개나 하네스 때문이면 **계측 실패**입니다. 판단 근거를 남긴 뒤 §7부터 다시 시작합니다. |

**회차를 교체하는 법**: 그 회차 폴더 이름 앞에 `void-`를 붙입니다(보고서가 읽지 않습니다). 모자란 만큼
`PERF_ROUNDS=<모자란 수> pnpm perf`로 새로 돌리고, 새 run의 `round-NN` 폴더를 원래 run 폴더로 옮겨 번호를 이어
붙입니다. 교체 이유는 운영자 기록(§5)에 남깁니다.

> 실패한 회차를 "다시 돌려서 통과시키는" 일은 없습니다. NFR-PER-001은 20회 중 실패가 0건이어야 통과이고, 실패도 결과입니다.

## 10. 램프: 2명, 4명 (각 5회차 이상)

- `PERF_USERS=2 PERF_ROUNDS=5 pnpm perf`, 4명은 `PERF_USERS=4 PERF_ROUNDS=5 pnpm perf`
- background 사용자 수만 다르고 나머지는 §9와 같습니다. 관찰 항목과 대응 방법도 같습니다.

## 11. 학교 Wi-Fi 실측: light·moderate 프리셋 값 정하기

학교 Wi-Fi에서 서비스를 직접 시험하지 않습니다. 대신 학교 Wi-Fi의 무선 구간 값을 재서, 측정 Wi-Fi(§3.0) 위에서 G에 똑같이 겁니다(§12). RMF-Block 트래픽은 인터넷(WAN)을 지나지 않으므로, 학교 Wi-Fi에서 느려지는 곳은 기기와 AP 사이 무선 구간이기 때문입니다. 값은 **두 번** 잽니다.
- **평시**(사람이 적은 시간대, 예: 평일 오전) → light
- **혼잡**(사람이 많은 시간대, 예: 시험기간 저녁) → moderate

기기 한 대(G로 쓸 기기)만 학교 Wi-Fi에 연결해서, 같은 장소에서 아래 1~4를 시간대마다 한 번씩 합니다.

1. 게이트웨이 주소를 확인합니다: Windows는 `ipconfig`의 "기본 게이트웨이", macOS는 `route -n get default`의 gateway, Linux는 `ip route show default`.
2. 게이트웨이까지의 RTT·jitter·손실(100회): Windows는 `ping -n 100 <게이트웨이>`, macOS·Linux는 `ping -c 100 <게이트웨이>`. 최소·평균·최대 RTT와 손실률을 적고, jitter는 마지막 줄의 표준편차(`stddev`/`mdev`)로 적습니다.
3. 대역폭: 공개 iperf3 서버(`iperf3 -c <공개 서버> -t 30`, 받는 방향은 `-R`)나 speed test 사이트로 잽니다. 인터넷 구간이 섞이므로 **상한값**으로 적습니다.
4. 측정 Wi-Fi의 기본 RTT는 열화 없는 회차의 하네스 HTTP probe 값(`summary.md`의 `G RTT median`)으로 적습니다.
5. 시간대마다 프리셋을 정합니다(평시 값 → light, 혼잡 값 → moderate).
   - RTT 추가 = 학교 게이트웨이 RTT(평균) − 측정 Wi-Fi 기본 RTT
   - 손실 = 학교 손실률
   - 대역폭 = 학교 대역폭
6. 장소, 시간, 체감 혼잡도를 함께 기록합니다.

- 학교 Wi-Fi가 기기끼리 통신을 막더라도(client isolation) 이 측정에는 영향이 없습니다. 그 사실은 "이 Wi-Fi에서는 RMF-Block을 직접 쓸 수 없다"는 결과로 함께 적습니다.
- 그 시간대에 잴 수 없으면 기준 문서의 대체값(light +40ms·1%, moderate +120ms·3%, 둘 다 대역폭 제한 없음)을 쓰고 "실측 아님"으로 표시합니다.
- 평시 값이 혼잡 값보다 나쁘게 나오면(재는 날 우연히 붐볐다면) 다른 날 다시 잽니다.

## 12. 열화 회차: 혼잡 프리셋 3종 (각 5회차 이상)

**원칙**
- 열화는 **G에만** 겁니다. H(서버)에는 걸지 않습니다.
- **H IP의 3000·8080 포트로 가는 트래픽만** 걸리도록 필터합니다. 그래야 G의 브라우저 서버(하네스 제어 채널)가 영향을 받지 않습니다. 제어 채널이 느려지면 측정 시각 자체는 브라우저 안에서 찍더라도 세 가지가 틀어집니다.
  - 워크로드 입력 간격이 밀립니다.
  - 시계 보정이 제어 채널로 이뤄지므로 불확실도 U가 커집니다.
  - 손실이 크면 하네스가 G와의 연결을 잃습니다.

  그래서 시스템 전체에 걸리는 도구(macOS Network Link Conditioner 등)는 이 캠페인에서 쓰지 않습니다.
- **양방향에 절반씩 겁니다.** 서버가 G로 보내는 방향(H→G)과 G가 보내는 방향(G→H)이 모두 무선을 지납니다. 한쪽에만 걸면 다른 방향은 열화 없이 재집니다.
  - 프리셋 값은 모두 **왕복 기준**입니다(ping이 왕복을 재기 때문).
  - 방향마다 넣는 값: 지연 = RTT 추가 ÷ 2, 손실 = 손실 ÷ 2, 대역폭 = 그대로.
- 적용 여부를 `ping`(ICMP)으로 확인하지 않습니다. ICMP는 포트 필터에 걸리지 않습니다. 하네스의 HTTP RTT probe 값으로 확인합니다.

### 프리셋 값

| 프리셋 | RTT 추가(왕복) | 손실(왕복) | 대역폭 |
|---|---|---|---|
| light | §11 평시 실측값. 없으면 +40ms | 실측값. 없으면 1% | 실측값(상한값). 없으면 제한 없음 |
| moderate | §11 혼잡 실측값. 없으면 +120ms | 실측값. 없으면 3% | 실측값(상한값). 없으면 제한 없음 |
| heavy | +300ms | 10% | 제한 없음 |

### Windows G: Clumsy (관리자 권한으로 실행, 리허설에서 확인)

- Filter(양방향, H의 3000·8080만):
  ```
  (outbound and ip.DstAddr == <H_IP> and (tcp.DstPort == 3000 or tcp.DstPort == 8080)) or (inbound and ip.SrcAddr == <H_IP> and (tcp.SrcPort == 3000 or tcp.SrcPort == 8080))
  ```
- 값을 넣습니다. 양방향 패킷 모두에 걸리므로 절반씩 넣습니다.
  - Lag(ms) = RTT 추가 ÷ 2
  - Drop(%) = 손실 ÷ 2
  - Bandwidth = 대역폭(KB/s 단위면 Mbps × 125)
- 체크한 뒤 Start를 누릅니다. 끝나면 **Stop을 누르고**, 하네스 RTT probe로 해제됐는지 확인합니다.

### macOS G: dnctl + pfctl (리허설에서 확인)

```
sudo dnctl pipe 1 config delay <RTT추가÷2>ms plr <손실÷2, 예: 0.005> bw <대역폭>Mbit/s
sudo dnctl pipe 2 config delay <RTT추가÷2>ms plr <손실÷2> bw <대역폭>Mbit/s
printf 'block in quick proto tcp from ! <H_IP> to any port 9333\ndummynet out proto tcp from any to <H_IP> port {3000, 8080} pipe 1\ndummynet in proto tcp from <H_IP> port {3000, 8080} to any pipe 2\n' | sudo pfctl -f -
sudo pfctl -e
# 해제
sudo pfctl -f /etc/pf.conf
sudo dnctl -q flush
```

- pipe 1은 보내는 쪽, pipe 2는 받는 쪽입니다. 대역폭 제한이 없으면 `bw …` 부분을 뺍니다.
- `pfctl -f -`는 기본 규칙을 잠시 대체해서 §3.1의 9333 차단 anchor도 그동안 읽히지 않습니다. 그래서 첫 줄에 같은 차단을 다시 넣었습니다.
- 칸이 끝나면 위의 해제 명령으로 `/etc/pf.conf`를 다시 읽습니다. 9333 차단(§3.1)이 다시 살아나도록 pf는 켜 둡니다. pf를 끄는 것은 브라우저 서버를 끈 뒤 정리(§15)에서 합니다.

### Linux G: tc netem (리허설에서 확인)

```
# 보내는 쪽(G→H)
sudo tc qdisc add dev <wlan> root handle 1: prio bands 4
sudo tc qdisc add dev <wlan> parent 1:4 handle 40: netem delay <RTT추가÷2>ms loss <손실÷2>% rate <대역폭>mbit
sudo tc filter add dev <wlan> parent 1: protocol ip prio 1 u32 match ip dst <H_IP>/32 match ip dport 3000 0xffff flowid 1:4
sudo tc filter add dev <wlan> parent 1: protocol ip prio 1 u32 match ip dst <H_IP>/32 match ip dport 8080 0xffff flowid 1:4
# 받는 쪽(H→G): ifb로 돌려서 같은 방식으로
sudo modprobe ifb numifbs=1
sudo ip link set ifb0 up
sudo tc qdisc add dev <wlan> handle ffff: ingress
sudo tc filter add dev <wlan> parent ffff: protocol ip u32 match u32 0 0 action mirred egress redirect dev ifb0
sudo tc qdisc add dev ifb0 root handle 1: prio bands 4
sudo tc qdisc add dev ifb0 parent 1:4 handle 40: netem delay <RTT추가÷2>ms loss <손실÷2>% rate <대역폭>mbit
sudo tc filter add dev ifb0 parent 1: protocol ip prio 1 u32 match ip src <H_IP>/32 match ip sport 3000 0xffff flowid 1:4
sudo tc filter add dev ifb0 parent 1: protocol ip prio 1 u32 match ip src <H_IP>/32 match ip sport 8080 0xffff flowid 1:4
# 해제
sudo tc qdisc del dev <wlan> root
sudo tc qdisc del dev <wlan> ingress
sudo tc qdisc del dev ifb0 root
```

- `prio bands 4`의 네 번째 칸(1:4)에는 필터에 걸린 트래픽만 들어갑니다. 나머지(제어 채널 포함)는 그대로 지나갑니다.
- 대역폭 제한이 없으면 `rate …` 부분을 뺍니다.

### 진행 순서

1. 프리셋을 적용합니다.
2. 하네스 probe로 RTT가 기대만큼 늘었는지 확인합니다.
3. 측정을 실행합니다: `PERF_PRESET=<light|moderate|heavy> PERF_ROUNDS=5 pnpm perf`. `PERF_PRESET`은 결과에 적히는 이름일 뿐이고, 열화는 위 도구로 사람이 직접 겁니다.
4. 프리셋을 해제하고, 해제됐는지 확인합니다.
5. 측정 조건 기록(§5)에 도구, 필터, 방향별 값을 그대로 적습니다.

H의 측정 브라우저는 loopback으로 서버에 붙기 때문에 열화가 걸리지 않습니다. 정상이며, 결과에는 "H는 baseline"으로 남깁니다.

## 13. 단절과 복구 (재연결): 짧은 전용 프로토콜

단절 회차는 baseline의 13분 워크로드가 아니라 **약 5분짜리 전용 프로토콜**로 돌립니다. 이 회차에서 재는 것은 resync 시간과 "정확히 한 번 전달"이며, baseline의 지연 p95와는 비교하지 않습니다.

| 단계 | 내용 |
|---|---|
| 1. 준비 | 새 스택, 8명 접속(baseline과 같음) |
| 2. 단절 전 | 2분간 편집·채팅 |
| 3. 단절(G만, 20초 또는 40초) | 양쪽 모두 계속 편집합니다. **H가 채팅을 보내고**(경우 ①), **G도 채팅 전송을 시도합니다**(경우 ②) |
| 4. 복구 | 문서 resync 시간을 잽니다. G가 단절 중 받지 못한 H의 채팅을 정확히 한 번 받는지 확인합니다(경우 ①) |
| 5. 재전송 | 하네스가 G의 실패한 채팅을 **명시적으로 재전송 버튼을 눌러** 보냅니다(경우 ③). 자동 복구 시간과는 따로 기록합니다 |
| 6. 단절 후 | 2분 편집 → 수렴 확인 |

채팅은 세 경우를 섞지 않고 따로 기록합니다. 현재 앱은 오프라인에서 보낸 채팅을 자동으로 다시 보내지 않고, 재전송 버튼이 있는 실패 항목으로 남깁니다(UC-060 E1-1).
- ① **H가 보냄, G는 오프라인**: G가 재연결한 뒤 서버에 저장된 메시지를 정확히 한 번 받아야 합니다(백필).
- ② **G가 오프라인에서 보냄**: 실패 또는 대기 상태로 표시되는지 기록합니다. Yorkie가 버퍼링하는 문서 편집과는 별개입니다.
- ③ **복구 후 G가 재전송**: 전달 여부와 중복 여부를 기록합니다. 사람이 아니라 하네스가 하는 명시적 동작이며, 자동 복구로 세지 않습니다.

복구 상태와 시간은 **문서, 채팅, 세션 알림 경로별로 따로** 남깁니다. 채팅 소켓이 복구됐다고 앱 전체가 복구된 것은 아닙니다(#37).

| 종류 | 방법 | 비고 |
|---|---|---|
| **주 실험: 하네스 단절** | 하네스가 G 브라우저의 Yorkie 스트림과 소켓을 정확히 20초(또는 40초) 끊었다가 복구합니다. | 20초 × 5회: `PERF_OUTAGE=20 PERF_MINUTES=2 PERF_ROUNDS=5 pnpm perf`, 40초 × 3회: `PERF_OUTAGE=40 PERF_MINUTES=2 PERF_ROUNDS=3 pnpm perf`. 연결이 실제로 끊겼다는 증거가 자동으로 남습니다. |
| **보조 실험: 포트 차단(blackhole)** | 운영자가 G에서 3000·8080 패킷을 20초 동안 100% 버립니다. | 일반 회차(`PERF_MINUTES=2 PERF_ROUNDS=1 pnpm perf`)를 돌리면서, 편집·채팅 단계 중간에 시계를 보고 20초 동안 차단합니다. Windows: Clumsy 양방향 필터 + Drop 100%, Start → 20초 → Stop. macOS: 위 dnctl 설정에서 `plr 1`. Linux: `sudo iptables -I OUTPUT -d <H_IP> -p tcp -m multiport --dports 3000,8080 -j DROP`와 `sudo iptables -I INPUT -s <H_IP> -p tcp -m multiport --sports 3000,8080 -j DROP`, 해제는 같은 명령의 `-I`를 `-D`로 |

- **Wi-Fi를 끄거나 랜선을 뽑지 않습니다.** G의 하네스 제어 채널까지 끊겨 그 회차가 통째로 무효가 됩니다.
- blackhole에서는 TCP 연결이 살아남을 수 있습니다. 그러면 "끊겼다가 재연결"이 아니라 "멈췄다가 이어짐"이 됩니다. 어느 쪽이었는지 하네스 기록에서 확인해 적습니다.
- 복구 뒤에도 `⚠ 연결 끊김`이 남아 있으면 **새로고침하지 말고** 기록합니다(#37의 알려진 실패).

## 14. 관측 스택 (Prometheus · Grafana)

서버 쪽에서 "왜 느려졌는지"를 보는 진단 도구입니다. **판정은 하네스의 raw 결과로만** 하고, Grafana 그래프는 설명용입니다.

**언제 켜는가.** 판정 칸(§9)과 램프(§10)에서는 관측 스택을 **아예 띄우지 않습니다**. 띄워 두기만 해도 H의 CPU를 나눠 쓰기 때문입니다. 램프가 끝난 뒤 다음 순서로 진행합니다.
1. 관측 스택을 켭니다.
2. **관측을 켠 8명 baseline 5회차**를 돌립니다. 이 칸이 혼잡·복구 회차(§12·§13)의 비교 기준입니다. §9(관측 끔)와의 차이는 오버헤드로 서술만 하고, 켤지 말지를 가르는 임계값은 두지 않습니다.
3. 혼잡·복구 회차를 관측을 켠 채로 돌립니다.

**순서**(H에서)
1. 켜기: `pnpm perf:observe`. 이미지는 §2.2에서 미리 받아 둡니다.
2. H의 브라우저에서 `http://127.0.0.1:3300`을 열고 대시보드 **RMF-Block perf run**을 엽니다. 로그인은 없습니다. G에서는 열지 않습니다(LAN에 열지 않음).
3. 측정 명령 앞에 `PERF_OBSERVE=1`을 붙입니다. 기준 칸은 `PERF_OBSERVE=1 PERF_ROUNDS=5 pnpm perf`(PowerShell: `$env:PERF_OBSERVE="1"; $env:PERF_ROUNDS="5"; pnpm perf`)이고, §12·§13의 명령에도 똑같이 붙입니다.
4. 첫 회차가 끝나면 대시보드를 새로고침해 그래프가 나오는지 확인합니다. 자동 새로고침은 꺼 두었습니다. 측정 중에는 Grafana 탭을 열어 두지 않습니다(H의 CPU를 씀). 회차마다 빨간 주석(측정 구간, 단절, 복구)이 생깁니다.
   - 컨테이너 CPU와 메모리: `…-app`, `…-yorkie`, `…-mongo` 이름으로 나옵니다.
   - Yorkie RPC: 초당 요청 수, 실패, 응답 시간 p95가 나옵니다.

   회차 폴더의 `conditions.json`에는 `"observe": true`가 남습니다.
5. 끄기: 측정이 모두 끝나면 `docker compose -f e2e/perf/observe/compose.yml down`. PowerShell이면 `Remove-Item Env:PERF_OBSERVE`도 해서 다음 판정 칸이 관측 없이 돌게 합니다. 수집한 데이터(볼륨)는 남습니다. 지우려면 `down --volumes`로 하되, 결과 요약 PR이 머지된 뒤에 합니다.

**중단 조건**: 관측을 켠 상태에서 H의 CPU가 계속 포화되거나 하네스 오류가 나면, 관측 스택을 끄고 그 사실을 기록합니다. 이후 혼잡·복구 회차는 관측 없이 진행하고 §9를 비교 기준으로 씁니다.

**대시보드에서 보는 것**

| 패널 | 보는 것 |
|---|---|
| Round containers — CPU, memory | 회차 컨테이너(app·yorkie·mongo)의 CPU 코어 수와 메모리 |
| Yorkie RPCs per second, not ok | 메서드별 요청 수와 실패(`rpc_code`가 ok가 아닌 것) |
| Yorkie PushPull / RPC response p95 | 서버가 요청을 처리하는 데 걸린 시간 |

- 관측 연결에 실패해도 회차는 그대로 돌고 실패로 세지 않습니다. 터미널에 `is not observed` 경고가 뜨고 `meta.json`에 이유가 남습니다. 다음 회차 전에 원인을 해결합니다(§16).
- Docker Desktop에서는 cAdvisor가 컨테이너 이름을 읽지 못해서 하네스가 회차마다 ID에 이름을 붙입니다. **컨테이너별 네트워크는 이 방식으로 나오지 않습니다.** 네트워크는 회차 폴더의 `docker-stats.jsonl`에 있습니다.

## 15. 결과 회수와 정리

1. 결과는 H의 `perf-results/<run-id>/`에 남고, 요약은 `pnpm perf:report`가 만든 `summary.md`(표)와 `summary.html`(그래프)입니다. git에는 올리지 않고(gitignore), 다른 곳에도 올리지 않습니다. **결과 요약 PR(docs/perf 폴더의 v0.1.0 요약 파일)이 머지될 때까지 이 폴더를 지우지 않습니다.** 사본이 이것 하나뿐입니다.
2. §5의 운영자 기록을 같은 폴더에 넣습니다.
3. `docker compose ls`로 측정 프로젝트가 남아 있지 않은지 확인합니다.
4. G의 브라우저 서버를 종료(`Ctrl+C`)하고, 방화벽 규칙을 지웁니다.
   - Windows: `Remove-NetFirewallRule -DisplayName "RMF-perf G"` (H에서는 `"RMF-perf H"`와 `Remove-NetFirewallHyperVRule -Name "RMF-perf-WSL"`)
   - Linux H: `sudo iptables -D DOCKER-USER -i <wlan> -p tcp -m multiport --dports 3000,8080 ! -s <G_IP> -j DROP`(`ip6tables`로도 넣었다면 그쪽도)
   - Linux G: `sudo ufw delete allow from <H_IP> to any port 9333 proto tcp`
   - macOS G: `sudo pfctl -a com.apple/rmf-perf -F rules` 후 `sudo pfctl -d`
5. 열화 도구가 해제됐는지 확인합니다(Clumsy Stop / macOS·Linux는 §12의 해제 명령).
6. H·G의 다른 Wi-Fi 자동 연결, 측정 Wi-Fi의 데이터 통신 연결(종량제) 설정을 원래대로 돌립니다.
7. 기기 설정을 원래대로 돌립니다(절전, 업데이트, 전원 모드). Windows H의 `hostAddressLoopback`(§2.2)은 남겨 둬도 됩니다.
8. 개발용 스택이 필요하면 저장소 폴더에서 `docker compose start`를 실행합니다.

## 16. 트러블슈팅

| 증상 | 의심할 원인 | 조치 |
|---|---|---|
| G에서 `http://<H_IP>:3000`이 안 열림 | 방화벽(규칙의 상대 주소가 바뀜), Hyper-V 규칙 누락, client isolation, 잘못된 IP | §3.1의 5번을 순서대로 확인 |
| H에서 하네스가 `never served /join`으로 멈춤 | `HOST_LAN_IP`에 `<H_IP>`를 그대로 넣음, 또는 mirrored 모드 Windows H에 `hostAddressLoopback`이 없음 | `conditions.json`의 `host` 확인, §2.2의 `.wslconfig` 설정 |
| 페이지는 열리는데 편집 내용이나 접속자 목록이 안 보임 | 8080 차단 | H 방화벽의 8080을 확인하고, G에서 health 응답이 `200`인지 확인 |
| 처음부터 `⚠ 연결 끊김`이 뜸 | Yorkie 최초 연결 실패(#37) | 새로고침하지 않고 회차 실패로 기록. 반복되면 8080과 Yorkie 컨테이너 상태 확인 |
| 회차가 `still tracing for an interrupted run`으로 바로 실패함 | 앞선 실행을 Ctrl+C로 끊어서 G 브라우저에 메모리 추적이 남음(멈춘 회차는 하네스가 스스로 추적을 끄므로 이 원인이 아님) | G에서 브라우저 서버를 `Ctrl+C`로 끄고 `pnpm perf:browser`로 다시 띄운 뒤, 새 주소로 `PERF_G_WS`를 다시 정함 |
| 회차의 `signals.jsonl`에 `stalled`와 `aborted`가 남고 다음 회차가 이어서 시작됨 | 회차가 기한(`2 × PERF_MINUTES + 단절 + 10`분, `PERF_STALL_MINUTES`로 바꿈) 안에 끝나지 않아, 하네스가 회차의 페이지와 H 브라우저를 닫고 정리함. 한 동작이 1분 넘게 걸려도 같은 식으로 `aborted`가 남음 | 하네스를 끄지 않음. `stalled`의 `phase`와 `aborted` 메시지로 멈춘 위치를 기록하고 §9의 분류로 판단함. 제품이 멈춘 것(예: 발표 버튼이 안 뜸)이면 실패로 두고, 하네스 쪽이면 교체 |
| 회차가 1분쯤 기다린 뒤 `Port 0.0.0.0:3000 is in use`로 실패함 | 앞 회차의 스택이 남아 포트를 잡고 있음(직전 회차의 포트 반납은 하네스가 1분까지 기다려 줌) | `docker compose ls`에서 남은 `rmf-perf-…` 프로젝트를 `docker compose -p <이름> down --volumes`로 지움 |
| H가 G 브라우저 서버에 연결하지 못함 | G 방화벽, 주소 오타, Playwright 버전 불일치 | §2.1의 커밋이 두 기기에서 같은지, §3의 G 방화벽 확인 |
| 시계 offset이 회차마다 크게 다름 | 한쪽 기기가 절전에 들어갔거나, 시간 동기화로 시계가 점프함 | §4 위생 항목을 다시 확인하고 그 회차는 무효 처리 |
| 회차 도중 기기가 잠기거나 꺼짐 | 절전 설정 | §4 확인, 그 회차는 무효 처리 |
| 터미널에 `Round N is not observed` 경고가 뜸 | 관측 스택이 꺼져 있거나 Prometheus가 응답하지 않음 | `docker compose ls`에 `rmf-observe`가 running인지 확인하고, 아니면 `pnpm perf:observe`로 켬. 그 회차는 판정에 영향이 없음(그래프만 빠짐) |
| 터미널에 `Round N: detach failed` 경고 뒤 그 회차가 `compose down` 오류로 끝남 | Prometheus가 회차 네트워크에서 끝내 빠지지 못해 `compose down`이 네트워크를 못 지움(이유는 `meta.json`의 `observeCleanup`) | `docker network disconnect --force rmf-perf-<run>-<회차>-default rmf-observe-prometheus` 후 `docker compose ls`에서 남은 `rmf-perf-…` 프로젝트를 `docker compose -p <이름> down --volumes`로 지움. 측정 파일은 정리 전에 이미 저장됨 |
| 디스크 부족, Docker 오류 | 이전 측정 프로젝트나 이미지가 남아 있음 | `docker compose ls`로 남은 측정 프로젝트를 확인하고 `docker compose -p <프로젝트 이름> down --volumes`. **`rmf-block` 프로젝트는 건드리지 않음** |
| 열화를 걸었는데 RTT가 늘지 않음 | 필터의 IP, 포트, 방향이 안 맞음 | 필터를 다시 확인. ping이 아니라 하네스 probe로 확인 |
| 측정 중 H나 G가 다른 Wi-Fi로 넘어감 | OS가 다른 저장된 네트워크로 자동 전환 | 다른 Wi-Fi 자동 연결 끄기(§3.0), 주소가 바뀌었으면 방화벽 규칙도 다시, 그 회차는 무효 처리 |
| 특정 시각에 여러 회차가 함께 느려짐 | 같은 Wi-Fi의 다른 사용자 트래픽, OS 업데이트 다운로드 | 시각을 운영자 기록에 남기고 `docker-stats.jsonl`과 대조, §4 업데이트 항목 확인 |

## 17. 출력용 체크리스트

**측정일 시작 전**
- [ ] 설치, 이미지·브라우저 다운로드, 설치 확인 회차를 측정일 전에 끝냄(§2)
- [ ] Windows H: mirrored 모드면 `hostAddressLoopback` 설정(§2.2)
- [ ] H·G의 다른 Wi-Fi 자동 연결 끔, Windows는 측정 Wi-Fi 프로필을 개인으로, 데이터 통신 연결(종량제)로
- [ ] H·G 모두 전원 연결, 고성능 모드, 절전·잠금 끔, Wi-Fi 절전 끔
- [ ] 알림·업데이트·동기화 중지, 다른 앱 종료, VPN 끔
- [ ] H·G 모두 같은 측정 Wi-Fi에 연결, `<H_IP>`·`<G_IP>` 확인, SSID·대역·채널·신호 기록
- [ ] 방화벽 규칙을 상대 주소로 만듦(§3.1, Windows H는 Hyper-V 규칙 포함)
- [ ] 두 기기의 저장소 커밋이 같음, Chrome 버전 기록
- [ ] 개발 스택 정지(`docker compose stop`)
- [ ] G 브라우저 서버 기동, H에서 연결 확인
- [ ] G에서 `:3000/join`이 열리고 `:8080` health가 `200`
- [ ] 측정 조건 기록(§5) 작성

**단계별 진행**
- [ ] 리허설: 2명 1분 → 8명 1회차 통과(메모리 지표 대조 포함)
- [ ] 본 측정: 8명 × baseline × 20회(관측 스택 끔)
- [ ] 램프: 2명 × 5회, 4명 × 5회
- [ ] 관측 스택을 켠 8명 baseline 5회(혼잡·복구의 비교 기준)
- [ ] 학교 Wi-Fi 평시·혼잡 실측(게이트웨이 ping, 대역폭) → light·moderate 값 확정
- [ ] 열화 3종 × 5회(G에만, 양방향 절반씩, 적용·해제 확인)
- [ ] 단절 20초 × 5회, 40초 × 3회(짧은 전용 프로토콜, 채팅 ①②③ 따로 기록, + 보조 blackhole)

**마무리**
- [ ] 결과 폴더와 운영자 기록이 H에 남아 있는지 확인(요약 PR 머지 전까지 삭제 금지)
- [ ] 측정 프로젝트가 남지 않음 확인, 브라우저 서버 종료, 방화벽 규칙 제거(Hyper-V 규칙 포함), 열화 해제
- [ ] 기기 설정 원복

## 부록: 환경 변수

| 변수 | 기본값 | 뜻 |
|---|---|---|
| `HOST_LAN_IP` | `127.0.0.1` | H의 측정 Wi-Fi 주소(§3.1). G가 이 주소로 서버에 붙습니다 |
| `PERF_RUN_ID` | 시각 기반 이름 | 결과 폴더 이름(`perf-results/<PERF_RUN_ID>/`). 영문 소문자·숫자·`-`만 |
| `PERF_G_WS` | 없음 | G 브라우저 서버 주소(§7). 없으면 하네스가 멈춥니다 |
| `PERF_SINGLE_MACHINE` | 없음 | `1`이면 `PERF_G_WS` 없이 H에서 G 브라우저도 띄웁니다(개발용 한 기기 확인) |
| `PERF_USERS` | `8` | 접속자 수(H·G 포함) |
| `PERF_MINUTES` | `10` | 편집·채팅 단계 길이(분). 단절 회차에서는 앞뒤 작업 단계 각각의 길이 |
| `PERF_ROUNDS` | `1` | 회차 수 |
| `PERF_OUTAGE` | `0` | `20`이나 `40`이면 단절 회차(§13) |
| `PERF_STALL_MINUTES` | `2 × PERF_MINUTES + 단절 + 10` | 회차가 이 시간(분) 안에 끝나지 않으면 하네스가 멈춘 것으로 보고 회차를 닫고 정리합니다(§16) |
| `PERF_PRESET` | `baseline` | 결과에 적을 열화 이름. 도구는 사람이 직접 겁니다 |
| `PERF_APP_PORT`, `PERF_YORKIE_PORT` | `3000`, `8080` | 측정 스택 포트 |
| `PERF_BIND` | `0.0.0.0` | 포트를 열 주소 |
| `PERF_CHANNEL` | `chrome` | 측정 브라우저. `bundled`면 Playwright 내장 Chromium |
| `PERF_OBSERVE` | 없음 | `1`이면 회차를 관측 스택(§14)에 연결합니다. 판정 칸과 램프에서는 쓰지 않습니다 |
| `PERF_HEADED` | 켜짐 | `0`이면 창 없이 실행(단일 머신 확인용) |
| `PERF_BROWSER_PORT`, `PERF_BROWSER_HOST` | `9333`, `0.0.0.0` | G 브라우저 서버(§7) |

넣는 법: 연결 변수(`HOST_LAN_IP`, `PERF_G_WS`)는 측정을 시작하는 터미널에서 **한 번** 정하고, 칸마다 바뀌는 값(`PERF_ROUNDS` 등)은 명령 앞에 붙입니다. 터미널을 새로 열면 연결 변수를 다시 정합니다.
- bash·zsh(macOS, Linux): `export HOST_LAN_IP=10.42.0.23 PERF_G_WS=ws://10.42.0.57:9333/…` 후 `PERF_ROUNDS=20 pnpm perf`
- PowerShell(Windows): `$env:HOST_LAN_IP="10.42.0.23"; $env:PERF_G_WS="ws://10.42.0.57:9333/…"` 후 `$env:PERF_ROUNDS="20"; pnpm perf`.
  PowerShell에서는 칸마다 바뀌는 값도 창을 닫을 때까지 남으므로, 칸을 바꿀 때 `Remove-Item Env:PERF_OUTAGE`처럼 지우거나 다시 넣습니다.
- `PERF_SINGLE_MACHINE=1`은 개발자가 한 기기에서 하네스를 확인할 때만 씁니다. 실측에서는 쓰지 않습니다.

---

Related: #163 · #174 · #189 · #190 · #191 · #192 · #193 · [측정 기준 문서](../PERFORMANCE-QUANTIFICATION-CRITERIA-ko.md) · [README](../../README.md)
