# Handoff: rmf-block Notion-style redesign (B · Soft / paper)

Claude Code에서 이 파일 하나만 읽고 작업할 수 있도록 작성했습니다.

## 0. Claude Code에 붙여넣을 프롬프트

```
이 폴더(design_handoff/notion-redesign)의 HANDOFF.md를 읽고 순서대로 진행해줘.
1) §1 토큰 분류 문제를 /design-sync 쪽에서 해결
2) §2 디자인 토큰을 앱 테마(@theme)에 반영
3) §3 컴포넌트별 스타일 변경을 기존 Tailwind 클래스 패턴으로 구현
4) 끝나면 /design-sync 재실행
HTML 파일은 디자인 레퍼런스일 뿐 그대로 복사하지 말 것.
```

## 1. 분류 안 된 토큰 10개

전부 Tailwind v4가 생성한 값이라 앱이 직접 정의한 토큰이 아닙니다.

- Tailwind 기본 테마 값: `--ease-out`, `--ease-in-out`, `--default-transition-duration`, `--default-transition-timing-function`
- 유틸리티 내부 변수: `--tw-translate-x`, `--tw-translate-y`, `--tw-translate-z`, `--tw-border-style`, `--tw-blur`, `--tw-outline-style`

권장 해결 (둘 중 하나):
1. **(권장)** `/design-sync`가 토큰을 추출할 때 `--tw-*`는 제외하고, Tailwind 기본 테마 변수는 `@kind other`로 분류하도록 수정.
2. 컴파일된 `_ds_bundle.css`에 주석을 추가하는 후처리 단계를 둠. 예: `--ease-out: cubic-bezier(0,0,.2,1); /* @kind other */`. 소스 CSS에 단 주석은 Tailwind 빌드에서 사라질 수 있으니, 반드시 빌드 이후에 적용해야 함.

모션 토큰으로 쓰려면 앱 `@theme`에 `--ease-out`, `--ease-in-out`, `--default-transition-duration`을 직접 정의하고 `/* @kind other */`를 붙여도 됨.

`JetBrains Mono`는 이번 리디자인에서 모노 라벨을 쓰지 않으므로, `--font-mono`는 코드/숫자에만 남기거나 제거해도 됩니다.

## 2. 디자인 토큰

폰트: Pretendard Variable (`https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`), fallback `system-ui, sans-serif`.

기존 `--color-paper`, `--color-shell`, `--color-sky*`, `--color-ink*` 값은 그대로 유지합니다. 추가되는 값은 아래와 같습니다.

| 역할 | Light | Dark |
|---|---|---|
| shell (앱 바깥/캔버스) | #efebe2 | #121110 |
| bg (본문 paper) | #fbfaf6 | #1a1918 |
| side (사이드바, 파일/PDF 카드) | #f3f0e8 | #201f1d |
| elev (메뉴, 다이얼로그, 떠 있는 창) | #fffefb | #232220 |
| line | #e8e3d8 | #2d2b28 |
| line-strong | #d8d1c3 | #3b3935 |
| text / ink | #1c1b1a | #ece9e3 |
| text-2 / ink-soft | #4a4744 | #aaa59d |
| text-3 / ink-faint | #8a847e | #77726b |
| hover | rgba(28,27,26,.05) | rgba(255,250,240,.055) |
| active (선택 행) | #e0f2fe | rgba(56,189,248,.16) |
| accent (sky-deep) | #0ea5e9 | #38bdf8 |
| accent-soft (sky-soft) | #e0f2fe | rgba(56,189,248,.15) |
| accent-text (링크) | #0284c7 | #7dd3fc |
| accent-ring (포커스) | rgba(14,165,233,.25) | rgba(56,189,248,.3) |
| primary 버튼 | bg #1c1b1a / fg #fbfaf6 | bg #ece9e3 / fg #1a1918 |
| danger | #dc2626 | #f87171 |
| danger-soft | #fdecec | rgba(248,113,113,.12) |

- 반경: 컨트롤 9px, 카드/메뉴/다이얼로그 14px, 아바타 50%
- 그림자(elev): `0 1px 2px rgba(28,27,26,.05), 0 12px 32px rgba(28,27,26,.10)`
- 다크 elev: `0 0 0 1px rgba(255,250,240,.06), 0 14px 36px rgba(0,0,0,.5)`
- 밀도: 사이드바 행 높이 32px, 사이드바 너비 260px, 본문 최대 폭 760px, 블록 간격 6px
- 타입: UI 14.5px, 본문 16.5px / line-height 1.7, 문서 제목 42px/700/-0.025em, H2 1.5em/700, 메타 12–13px (text-3)
- 모션: 전환 120ms, 핸들 opacity 전환 120ms

원칙:
1. 테두리 대신 면(side/hover)과 그림자로 구분.
2. sky는 선택, 링크, 포커스, 활성 창, "내가 공유 중"에만 사용.
3. 행 액션(···, +)과 블록 핸들은 호버할 때만 보임.
4. 모노 폰트 라벨은 없음.

## 3. 컴포넌트별 변경

레퍼런스: `ComponentSheet.dc.html` (상태별로 나열), `NotionRedesign.dc.html` (동작하는 워크스페이스). 두 파일 모두 `rmf-theme.css`의 `data-dir="P"` 토큰을 사용합니다.

- **Avatar / PresenceStack**: 크기 20/24/28/36, 원형, 흰 이니셜 600. 겹침 -6px, 테두리 `0 0 0 2px bg`. 초과 인원은 side 배경의 `+N` 필(pill). 호버한 사람은 sky 링을 두르고 위에 primary 툴팁(12px)을 띄움. 온라인 점은 9px #22c55e.
- **FocusShare** (높이 30px 버튼, radius 9px):
  - 대기: 투명 배경, text-2, 공유 아이콘 + "공유하기"
  - 다른 사람 공유 중: accent-soft 배경, accent-text, 공유자 아바타 20px + "○○ 화면 따라보기"
  - 따라보는 중: hover 배경, sky 점 + "따라보기 중지"
  - 내가 공유 중: accent 배경, 흰 글자, "공유 종료 · N명"
  - 공유 중에는 헤더 아래에 accent-soft 배너를 띄움.
- **DocumentList**:
  - 배경 side, 섹션 라벨 "문서" 12px/600 text-3.
  - 행 높이 32px, 들여쓰기 14px 단위(4 + depth × 14). 폴더는 chevron(90° 회전 120ms), 문서는 파일 아이콘.
  - 호버하면 hover 배경을 깔고 ···와 +(22px)를 노출. 현재 문서는 active(sky-soft) 배경에 600, 아이콘 accent-text. 키보드 포커스는 inset 2px sky 링.
  - 빈 상태: "아직 문서가 없어요" + 새 문서 버튼.
- **DocumentRowMenu**:
  - elev 배경, 너비 220px, padding 4px, 항목 높이 30px, 아이콘 15px text-2.
  - 항목: 하위 문서 추가 / 이름 변경(F2) / 이동 / 링크 복사 / 구분선 / 삭제(danger, 호버 시 danger-soft).
- **DocumentActionDialog**:
  - 스크림은 `rgba(10,14,20,.36)`, 모달은 상단 18vh 위치에 최대 400px, padding 20px.
  - 제목 17px/700. 입력창 38px, 포커스 시 `border accent + 3px accent-ring`, 오류 시 `border danger + 3px danger-soft`와 13px danger 문구.
  - 이동: side 배경 목록에서 선택한 항목은 active + 체크 표시. 이동할 수 없는 대상은 목록에서 제외.
  - 삭제: danger 버튼. 처리 중에는 opacity .7 + 스피너 + "삭제 중…", 취소는 비활성.
  - 버튼: 취소는 hover 배경(테두리 없음), 확인은 primary.
- **JoinForm**:
  - 최대 380px, 로고 36px, 제목 24px/700, 온라인 인원 칩(side).
  - 닉네임 입력(위와 동일한 상태 규칙), 색상 스와치 26–28px 8개, 선택한 스와치에는 sky 이중 링.
  - 버튼: primary 40px. 비활성은 hover 배경 + text-3.
- **블록 뷰**:
  - 핸들 위치는 블록 왼쪽 -50px, `+`(24px)와 `⋮⋮`(20×24px)를 호버할 때 opacity 1로 표시. 세로 위치는 H 22px, 미디어/구분선 9px, 텍스트 6px.
  - 선택한 블록은 accent-soft. 빈 블록 플레이스홀더는 "내용을 입력하거나 '/'로 블록을 추가하세요"(text-3).
  - 구분선: 1px line, 위아래 12px.
  - 파일: side 카드, 테두리 없음. 아이콘 박스 34px(bg). 업로드 중에는 3px sky 진행바.
  - PDF: side 카드 radius 14px, 헤더에 PDF 뱃지(danger 글자), 미리보기 영역은 bg.
  - 이미지: radius 9px, 캡션 13px text-3.
  - 문서 링크: 아이콘 + 500 밑줄(line-strong 1px), 호버 시 hover 배경. 대상이 삭제됐으면 text-3 + 취소선.
- **슬래시 메뉴**: elev 배경, 너비 300px, 항목마다 36px 글리프 박스 + 라벨/설명. 첫 항목은 기본으로 하이라이트.
- **ChatMessageRow / ChatPanel**:
  - 패널은 bg 카드로, margin 10px + radius 14px + panel shadow를 줘서 떠 있게 함.
  - 메시지 행: 아바타 26px, 이름 13.5px/600 + 시간 12px text-3, 본문 14px/1.55.
  - 같은 사람이 연속으로 보낸 메시지는 머리(아바타·이름)를 생략하고 padding을 1px로. 호버하면 시간을 표시.
  - 내 메시지에는 "나" 뱃지(accent-soft). 전송 중이면 "전송 중…".
  - 입력창: radius 14px, 1px line 링. 전송 버튼은 입력이 있을 때 accent, 없을 때 hover/text-3.
- **VersionHistory**:
  - 항목 padding 10px, 점 8px.
  - 선택한 항목은 accent-soft 배경, sky 점, accent-text 제목.
  - 하단에 안내 문구 + "이 버전으로 복원"(primary, 현재 버전이면 비활성).
- **FloatingFrame / ChatWindow**:
  - elev 배경, radius 14px, elev shadow. 제목 표시줄은 34–38px, 여기를 잡고 창을 이동(cursor grab). 닫기 버튼 24–26px.
  - 활성 창에는 `0 0 0 2px accent-ring` 링을 두르고, 비활성 창은 opacity .92.
  - 리사이즈: 경계에 호버하면 sky 3px 바를 표시. 모서리 그립은 2px line-strong L자.

## 4. 파일
- `ComponentSheet.dc.html`: 모든 컴포넌트의 상태별 시트 (theme prop: light/dark)
- `NotionRedesign.dc.html`: 동작하는 워크스페이스 프로토타입 (방향 A/B/C, 라이트/다크)
- `rmf-theme.css`: 토큰(`[data-dir="P"]`가 최종안)과 상태 스타일
