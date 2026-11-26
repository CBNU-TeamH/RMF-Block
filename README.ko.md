# RMF-Block

[English](README.md) · **한국어**

같은 네트워크에 있는 팀원들이 실시간으로 함께 쓰는 블록 에디터입니다. 문서를 동시에 편집하고, 채팅으로
파일을 주고받고, 필요한 블록을 플로팅 창에 띄워 두고, 다른 사람의 화면을 따라갈 수 있습니다.

호스트 한 명이 Docker로 RMF-Block을 실행하면, **같은 서브넷**에 있는 팀원은 브라우저에서 링크를 열고
닉네임과 워크스페이스 비밀번호를 입력해 참여합니다. 충북대학교 H팀 캡스톤 프로젝트입니다.

> 영문 [`README.md`](README.md)를 바탕으로 한 한국어 안내입니다. 내용이 다르면 영문을 기준으로 합니다.

## 기능

| 기능 | 설명 | 스크린샷 |
| :--- | :--- | :--- |
| **문서 편집** | `/` 메뉴나 Markdown 단축키로 텍스트, 제목, 목록, 체크리스트, 인용, 코드, 표, 이미지, PDF, 파일, 문서 링크를 넣습니다. 입력하는 즉시 모두에게 반영되고(한글 조합 중인 글자 포함), 다른 사람이 작업 중인 블록은 그 사람의 색으로 표시됩니다. 여러 블록을 한꺼번에 골라 복사·잘라내기·삭제할 수 있고, Markdown 파일을 새 문서로 가져올 수도 있습니다. 문서는 트리로 정리되고 제목으로 검색할 수 있으며 탭으로 열립니다. 버전 기록에 이름을 붙여 저장하고 언제든 되돌릴 수 있습니다. | <img src="docs/images/editing.png" width="360" alt="탭으로 열린 회의록 문서를 보는 호스트 화면. 게스트가 있는 블록이 빨간색으로 표시됨"> |
| **플로팅 뷰와 채팅** | 채팅에 파일을 첨부할 수 있고, 주고받은 파일은 이미지·PDF·기타로 나뉘어 모입니다. 텍스트·이미지·PDF 블록이나 여러 블록, 채팅의 파일을 플로팅 창에 띄우면 다른 문서로 옮겨 가도 계속 떠 있습니다. | <img src="docs/images/floating.png" width="360" alt="문서 위 플로팅 뷰에 띄운 공유 이미지와 채팅의 파일 목록"> |
| **화면 공유** | 내가 보는 위치를 공유하면 다른 사람이 클릭 한 번으로 따라와 스크롤과 문서 이동을 함께 봅니다. 어느 쪽이든 언제든 끝낼 수 있습니다. 문서 트리에는 누가 어느 문서에 있는지 점으로 표시되고, 점을 누르면 그 사람이 있는 곳으로 이동합니다. | <img src="docs/images/screen-share.png" width="360" alt="호스트의 공유 화면을 따라가는 게스트 화면. 헤더에 따라가는 중 표시"> |
| **관리자** | 호스트 전용입니다. 워크스페이스 이름과 비밀번호를 정하고, 비밀번호를 바꾸고, 게스트를 내보내고, 휴지통에서 지운 문서를 되살립니다. | <img src="docs/images/admin.png" width="360" alt="비밀번호 변경, 접속 중인 게스트, 휴지통이 있는 관리자 페이지"> |

## 동작 방식

호스트 PC에서 컨테이너 세 개가 돌아갑니다. 페이지·REST·WebSocket을 처리하는 앱(Next.js 커스텀
서버), 자체 호스팅한 [Yorkie](https://yorkie.dev) 서버, 그리고 Yorkie가 데이터를 저장하는
MongoDB입니다. 문서는 Yorkie가 CRDT로 동기화하면서 내용과 기록을 보관하고, 앱은 자기 상태를 `.data/`
아래 JSON 파일로 둡니다. 문서·채팅·업로드한 파일은 모두 호스트 PC에 저장됩니다.

전체 구조도는 [`ARCHITECTURE.md`](ARCHITECTURE.md), 설계 세부 사항은
[`docs/design/architecture.md`](docs/design/architecture.md)를 보세요.

## 시작하기

Compose 2.20 이상이 포함된 Docker를 설치한 뒤, 최신 [릴리즈](https://github.com/CBNU-TeamH/RMF-Block/releases)에서
파일 두 개를 내려받습니다. x86-64와 Apple Silicon 모두에서 실행됩니다.

Linux·macOS:

```bash
mkdir rmf-block && cd rmf-block
curl -LO https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/docker-compose.yml
curl -L -o .env https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/env.sample
```

Windows PowerShell 5.1:

```powershell
mkdir rmf-block
Set-Location rmf-block
curl.exe -LO https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/docker-compose.yml
curl.exe -L -o .env https://github.com/CBNU-TeamH/RMF-Block/releases/latest/download/env.sample
```

`.env`에서는 아래 세 값만 채우면 됩니다. 워크스페이스 이름과 비밀번호는 실행한 뒤 브라우저에서 정합니다.

### 호스트 LAN 주소 설정

`HOST_LAN_IP`에 호스트 PC의 LAN IPv4 주소를 넣습니다(예: `HOST_LAN_IP=192.168.0.14`). 주소는
컨테이너나 WSL이 아닌 호스트 PC에서 아래 명령으로 확인합니다.

Windows (PowerShell):

```powershell
(Get-NetIPConfiguration | Where-Object IPv4DefaultGateway).IPv4Address.IPAddress
```

Linux (`src` 뒤의 주소):

```bash
ip -4 route get 1.1.1.1
```

macOS:

```bash
ipconfig getifaddr "$(route -n get default | awk '/interface:/{print $2}')"
```

주소가 바뀌면 `.env`를 고친 뒤 `docker compose up -d`를 다시 실행하세요.

### Yorkie 관리자 비밀값 설정

아래 두 값을 `.env`에 직접 정해 넣어야 Compose가 실행됩니다. Yorkie 기본값을 그대로 쓰면 같은 LAN의
누구나 문서를 읽거나 지울 수 있기 때문입니다.

- `YORKIE_ADMIN_PASSWORD`: 영문·숫자·기호(`-` 등)를 섞은 8~30자. 나중에 바꾸면 앱이 켜지지 않으니
  처음 정한 값을 계속 쓰세요.
- `YORKIE_ADMIN_TOKEN_SECRET`: 32자 이상의 임의 문자열.

### 포트 열기

게스트는 **TCP 3000**(앱)과 **TCP 8080**(Yorkie)으로 접속합니다. 페이지는 열리는데 편집 내용이 안
보인다면 대개 8080이 막혀 있는 경우입니다.

- **Windows**: 네트워크 프로필을 **개인**으로 바꾸고, 방화벽 알림이 뜨면 Docker Desktop을 허용하세요.
  알림이 없었다면 관리자 권한 PowerShell에서 다음을 실행합니다.
  `New-NetFirewallRule -DisplayName "RMF-Block" -Direction Inbound -Protocol TCP -LocalPort 3000,8080 -Action Allow -Profile Private`
- **macOS**: 방화벽을 켜 두었다면 Docker의 수신 연결을 허용하세요.
- **Linux**: `ufw`를 쓴다면 `sudo ufw allow 3000,8080/tcp`를 실행하세요.

### 실행

```bash
docker compose up
```

실행 로그에 링크 두 개가 나옵니다.

```
rmf-app  |   Host:  http://localhost:3000/api/auth/host?secret=…
rmf-app  |   Guest: http://192.168.0.14:3000
```

- **`Host:` 링크는 호스트가 직접 엽니다.** 이 링크로 들어가면 호스트가 됩니다. 컨테이너를 다시 시작할
  때까지 유효하니 다른 사람에게 노출되지 않게 하세요.
- **처음 열면 설정 화면이 나옵니다.** 워크스페이스 이름과 비밀번호를 정하고 팀원에게 비밀번호를
  알려 주세요. 나중에 비밀번호를 바꾸거나 게스트를 내보낼 때는 사이드바 아래쪽, 호스트에게만 보이는
  **관리자** 메뉴를 씁니다.
- **팀원에게는 `Guest:` 주소를 공유하세요.**
- **컨테이너를 다시 시작하면 모두 로그아웃됩니다.** 문서와 설정은 재시작이나 업그레이드 후에도 그대로이고,
  `docker compose down -v`를 실행해야만 지워집니다.

### 업그레이드

먼저 `app-data`와 `mongo-data` 볼륨을 백업하고, `.env`의 Yorkie 값 두 개가
[규칙](#yorkie-관리자-비밀값-설정)에 맞는지 확인합니다. 그다음 새 릴리즈의 `docker-compose.yml`로 기존
파일을 덮어쓰고(`.env`는 그대로 둡니다) 다음을 실행합니다.

```bash
docker compose pull && docker compose up -d
```

PowerShell 5.1에서는 `&&`를 쓸 수 없으니 `docker compose pull`이 성공하면 `docker compose up -d`를
따로 실행하세요. clone한 저장소로 운영하던 경우에는
[릴리즈로 옮기는 절차](CONTRIBUTING.md#switching-a-clone-to-a-release)(영문)를 먼저 따르세요.

**되돌리기:** 이전 `docker-compose.yml`을 다시 넣고 같은 명령을 실행합니다. 단, Yorkie 0.7.26 이상으로
한 번이라도 실행했다면 더 오래된 Yorkie는 `mongo-data`를 읽지 못합니다. 이때는 `docker compose down`으로
멈추고(`-v`는 절대 붙이지 마세요) `mongo-data` 백업을 복원한 다음 이전 파일을 넣으세요. 백업 이후에
저장한 내용은 사라집니다.

### 게스트가 접속하지 못할 때

호스트 PC가 아닌 다른 기기(휴대폰도 됩니다)에서 `Guest:` 주소를 열어 보세요. 열리지 않으면 아래
순서로 확인합니다.

1. **AP 격리.** 학교나 공용 Wi-Fi는 같은 네트워크 안에서도 기기끼리 통신하지 못하게 막아 두는 경우가
   많습니다. 휴대폰 핫스팟으로 바꿔 시험해 보세요.
2. **포트.** 3000과 8080이 모두 열려 있어야 합니다([포트 열기](#포트-열기)).
3. **Windows 호스트.** WSL2 기반 Docker Desktop은 포트를 `127.0.0.1`에만 열어 둘 수 있습니다.
   [mirrored networking](https://learn.microsoft.com/windows/wsl/networking#mirrored-mode-networking)을
   켜거나(Windows 11 22H2 이상) `netsh interface portproxy`로 포트를 넘겨 주세요.
4. **`Guest:` 주소 오류.** `ipconfig`(Windows), `ip -4 addr`(Linux), `ifconfig`(macOS)로 Wi-Fi나
   이더넷 어댑터의 IPv4 주소를 찾아 `HOST_LAN_IP`를 다시 설정하세요. Docker·WSL·VPN 주소는 해당하지
   않습니다.

## 문서

| 문서 | 내용 |
| :--- | :--- |
| [`AGENTS.md`](AGENTS.md) | 작업 규칙: 진행 방식, 코딩 원칙, 문서별 역할 |
| [`docs/SRS-ko.md`](docs/SRS-ko.md) · [`docs/SRS-en.md`](docs/SRS-en.md) | 요구사항 명세(팀이 합의한 한국어 원문과 영문 번역) |
| [`docs/design/`](docs/design/) · [`docs/adr/`](docs/adr/) | 모듈 설계와 아키텍처 결정 기록 |
| [`ROADMAP.md`](ROADMAP.md) | 지금까지 만든 것과 앞으로 만들 것 |

## 기여

개발 환경 설정, 검사 방법, PR을 올리는 과정은 [`CONTRIBUTING.md`](CONTRIBUTING.md)에 있습니다.

## 라이선스

[MIT](LICENSE). 함께 들어 있는 Pretendard 글꼴은 SIL Open Font License 1.1을 따릅니다
([`app/fonts/PretendardVariable.LICENSE.txt`](app/fonts/PretendardVariable.LICENSE.txt)).
