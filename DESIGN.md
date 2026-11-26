---
name: "이게뭔겜? 404 아케이드"
description: "1990년대 용산 다중 합본팩 성형 트레이와 인쇄 라벨 물성을 바탕으로 실물 손일 미니게임을 즉시 가동하는 웹 아케이드 포털 디자인 시스템"
colors:
  stamp-red: "#C92A1D"
  serial-blue: "#163ECA"
  plate-yellow: "#F2BE18"
  plate-yellow-hover: "#F6C930"
  tray-stone: "#D8DDE4"
  tray-well: "#C6CDD6"
  tray-mid: "#AEB7C3"
  label-paper: "#F5F7FA"
  label-tint: "#E9EDF2"
  ink: "#15171A"
  ink-panel: "#23272E"
  ink-secondary: "#373D45"
  muted-on-dark: "#CBD2DC"
  pure-white: "#FFFFFF"
typography:
  display:
    fontFamily: "'Do Hyeon', 'Apple SD Gothic Neo', sans-serif"
    fontSize: "clamp(30px, 3.6vw, 46px)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Do Hyeon', 'Apple SD Gothic Neo', sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Do Hyeon', 'Apple SD Gothic Neo', sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.14
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.56
  body-compact:
    fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.45
  label:
    fontFamily: "'Chakra Petch', 'Pretendard', sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "'tnum' 1"
  serial-micro:
    fontFamily: "'Chakra Petch', 'Pretendard', sans-serif"
    fontSize: "9.5px"
    fontWeight: 700
    letterSpacing: "0.06em"
    fontFeature: "'tnum' 1"
rounded:
  xs: "1px"
  sm: "2px"
  md: "3px"
  lg: "4px"
spacing:
  2xs: "6px"
  xs: "9px"
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.stamp-red}"
    textColor: "{colors.pure-white}"
    rounded: "{rounded.md}"
    padding: "11px 22px"
  button-primary-hover:
    backgroundColor: "{colors.plate-yellow}"
    textColor: "{colors.ink}"
  button-keycap:
    backgroundColor: "{colors.label-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "7px 11px"
  button-keycap-hover:
    backgroundColor: "{colors.label-paper}"
  button-yellow:
    backgroundColor: "{colors.plate-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "7px 11px"
  button-yellow-hover:
    backgroundColor: "{colors.plate-yellow-hover}"
  chip-sort:
    backgroundColor: "{colors.label-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "7px 12px"
  chip-sort-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plate-yellow}"
  card-cartridge:
    backgroundColor: "{colors.label-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  card-master:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.label-paper}"
    rounded: "{rounded.md}"
    padding: "16px 20px 16px 16px"
  counter-mechanical:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plate-yellow}"
    rounded: "{rounded.sm}"
  nav-nameplate:
    backgroundColor: "{colors.label-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Design System: 이게뭔겜? 404 아케이드

## Overview

**Creative North Star: "1990년대 용산 다중 합본팩 성형 트레이 (The 404 Multi-Cartridge Molded Tray)"**

「이게뭔겜? 404 아케이드」의 시각 시스템은 어두운 보라색 그라데이션, 네온 번짐 그림자, 둥근 알약 배지로 대표되는 흔한 웹 게임 포털·서비스형 소프트웨어 카드 격자를 정면으로 거부한다. 대신 밝은 주광 아래 놓인 차가운 회백색 사출 성형 플라스틱 트레이(`tray-stone`)와 오목하게 파인 슬롯 홈(`tray-well`), 선명하게 인쇄된 코팅 라벨지(`label-paper`), 그리고 묵직한 먹색 실선 테두리(`ink`)로 실물 미니게임 합본팩의 촉각적 밀도를 구현한다.

방문자가 쇼츠·릴스 프로필 링크를 타고 들어온 첫 순간, 기계식 5자리 드럼 적산 계수기와 대표 마스터 카트리지, 4구 성형 트레이에 꽂힌 인쇄 팩이 한눈에 들어오며 모든 게임이 설치 없이 즉시 돌아가는 실제 게임임을 증명한다. 초기 방향 계약에서 구상했던 측면 그립 홈(molded grip notches)은 실제 출고 빌드에서 카트리지 상단 평면 인쇄 커넥터 인덱스 띠(`SLOT-01` 및 5핀 패드)로 정제되어 정보 밀도와 인쇄 라벨의 일관성을 높였다.

이 디자인 시스템의 적용 경계는 아케이드 바깥쪽 메인 포털(`index.html`)과 공용 오버레이 3종(`shared/calibration.js` 실제 1cm 영점 게이지 보정 모달, `shared/donate.js` 응원·후원 모달, `shared/catalog.js` 공개 예정·점검 잠금 화면 및 미리보기 배지)이다. 8개 개별 미니게임 내부 플레이 화면과 인게임 전용 스타일(`shared/styles.css`)은 각 게임 고유의 손일 물리 세계를 담는 별도 런타임 영역으로 분리 보존한다.

**Key Characteristics:**
- 사출 성형 도트 질감이 깔린 밝은 스톤 그레이 트레이(`tray-stone`)와 오목한 장착 웰(`tray-well`)의 물리적 층위
- 네온 발광 대신 먹색 실선(`1.5px`~`2px`)과 원색 인쇄 스탬프(주홍·코발트 블루·크롬 옐로)로 잡는 명확한 위계
- 호버·클릭 시 위로 떠오르지 않고 슬롯 홈 안쪽으로 딸깍 눌려 박히는 역방향 장착 물리 모션
- 한글 복고 간판체(`Do Hyeon`), 기계식 시리얼 고정폭 서체(`Chakra Petch`), 본문 고딕(`Pretendard` 스택)의 3단 역할 분리
- 알약형 둥근 모서리(`999px`)를 배제한 `1px`~`4px` 칼각 다이컷 모서리 규율

## Colors

차가운 무광 플라스틱 트레이와 미색 인쇄 라벨지 위에 먹색 테두리와 세 가지 고채도 인쇄 잉크(주홍, 코발트 블루, 크롬 옐로)를 찍어내는 산업 인쇄 팔레트다.

### Primary
- **버밀리온 실행 스탬프 (`stamp-red`)**: 대표 마스터 카트리지의 주 실행 단추(`카트리지 실행`), 신작 카트리지 상단 캡(`is-new`), 도감 신작 딱지, 일반 카트리지·도감 행 호버 시 점등되는 실행 단추, 1cm 보정 저장 단추, 잠금 화면 복귀 단추, 누적 계수기 작동 점에 쓰이는 핵심 행동 유도 색이다.

### Secondary
- **코발트 시리얼 블루 (`serial-blue`)**: 일반 수록 카트리지의 기본 상단 시리얼 캡, 전체 도감 행의 일련번호(`#01`~`#08`)와 최고 기록 수치, 1cm 보정 인치 프리셋의 활성 상태, 그리고 모든 키보드 `:focus-visible` 외곽선(`2.5px solid`)을 담당한다.

### Tertiary
- **크롬 옐로 명판 (`plate-yellow` / 호버 `plate-yellow-hover`)**: 상단 `404 ARCADE PACK` 명판 각인 글자, 기계식 드럼 계수기 숫자, 마스터 카트리지 화면 테두리 및 호버 반전 실행 단추, 인기 순위 카트리지 캡 글자, 활성 정렬·보정 탭 글자, 후원 키캡 단추와 하단 응원 티켓 배너, 텍스트 드래그 선택 영역(`::selection`)에 쓰인다.

### Neutral
- **몰디드 스톤 트레이 (`tray-stone`)**: 페이지 전체 바탕과 모달 외곽 성형 케이스, 보정 측정 스테이지·QR 웰 내부 바닥을 이루는 기준 플라스틱 색이다.
- **리세스드 슬롯 웰 (`tray-well`)**: 마스터 덱과 4구 카트리지 팩을 감싸는 오목한 장착 홈, 음소거된 배경음 단추, 스크롤바 트랙에 쓰인다.
- **커넥터 미드 스톤 (`tray-mid`)**: 카트리지 상단 5핀 커넥터 마크의 기본 채움색과 푸터 상단 경계선, 도감 기본 태그 테두리에 쓰인다.
- **코티드 라벨 페이퍼 (`label-paper`)**: 상단 명판 바, 개별 카트리지 팩 본체, 전체 도감 장부, 모달 내부 인쇄 카드의 주 표면 색이며 어두운 마스터 케이스 위 반전 제목 글자색으로도 겸용된다.
- **틴티드 유틸리티 스톡 (`label-tint`)**: 키캡 단추, 정렬 칩, 카트리지 커넥터 띠, 계수기 라벨 칸, 도감 행 호버 배경, 모달 보조 단추의 기본 바탕색이다.
- **프린트 블랙 잉크 (`ink`)**: 모든 주요 윤곽선(`1.5px`~`2px`), 기본 본문·제목 글자, 반전된 대표 마스터 카트리지 케이스, 활성 탭·정렬 칩 바탕, 하단 토스트 바탕을 책임지는 핵심 구조 색이다.
- **다크 카트리지 패널 (`ink-panel`)**: 기계식 드럼 숫자 셀 바탕, 16:9 썸네일 프레임의 빈 배경, 마스터 스펙 스탬프 바탕에 쓰이는 어두운 보조 패널 색이다.
- **세컨더리 스탬프 잉크 (`ink-secondary`)**: 카드 2줄 요약문, 도감 부제와 한 줄 설명, 모달 안내문, 어두운 패널 내부 구분선에 쓰인다.
- **뮤티드 다크 카피 (`muted-on-dark`)**: 먹색 반전 마스터 카트리지 내부의 설명 문단 가독성을 확보하는 밝은 회백색이다.
- **퓨어 화이트 스탬프 텍스트 (`pure-white`)**: 주홍·코발트 스탬프 위 반전 흰색 글자와 카카오페이 QR 코드의 스캔 인식률을 보장하는 정사각 배경 박스에 한정해 쓴다.

### Named Rules
**The Inverted Master Pack Rule.** 화면 전체에서 어두운 먹색(`ink`)을 넓은 카드 본체 배경으로 뒤집어 쓰는 곳은 최상단 대표 마스터 카트리지 단 하나뿐이다. 나머지 카트리지와 장부, 모달 내부 카드는 모두 밝은 인쇄 라벨지(`label-paper`)를 유지해 시선 중심이 흔들리지 않게 한다.

**The Functional Stamp Triad Rule.** 주홍(`stamp-red`)은 즉시 실행·신작·저장, 코발트 블루(`serial-blue`)는 일련번호·기록·키보드 포커스, 크롬 옐로(`plate-yellow`)는 합본팩 명판·기계 계기·후원 유틸리티에만 배정하며 장식용 그라데이션으로 섞지 않는다.

## Typography

**Display Font:** `Do Hyeon` (폴백 `Apple SD Gothic Neo`, `sans-serif`) — 자체 호스팅 서브셋 WOFF2
**Body Font:** `Pretendard` (폴백 `-apple-system`, `BlinkMacSystemFont`, `Apple SD Gothic Neo`, `Noto Sans KR`, `sans-serif`)
**Label/Mono Font:** `Chakra Petch` (폴백 `Pretendard`, `sans-serif`) — 자체 호스팅 WOFF2 (`600`, `700`)

**Character:** 1990년대 오락실·용산 패키지 인쇄물의 굵직하고 직선적인 한글 간판 인상을 주는 `Do Hyeon`이 게임 제목을 단단하게 찍어 누르고, 모서리가 깎인 기하학적 기술 서체 `Chakra Petch`가 슬롯 번호와 실측 수치에 계측기 같은 정밀함을 더하며, `Pretendard` 기반 본문 고딕이 좁은 폭에서도 한국어 설명과 조작 단추를 또렷하게 읽히게 한다.

### Hierarchy
- **Display** (`400`, `clamp(30px, 3.6vw, 46px)`, 행간 `1.06`, 자간 `-0.02em`): 대표 마스터 카트리지의 주 게임 제목(`h1`) 전용이다. `word-break: keep-all`로 한국어 어절 끊김을 지킨다.
- **Headline** (`400`, `28px`, 행간 `1.1`, 자간 `-0.02em`): 전체 수록 카트리지 도감 구역 제목(`28px`)을 기준으로 하며, 잠금 오버레이 제목(`26px`)과 1cm 영점 게이지 보정 모달 제목(`24px`)에 단계적으로 대응한다.
- **Title** (`400`, `22px`, 행간 `1.14`~`1.24`, 자간 `-0.02em`): 4구 트레이 개별 카트리지 제목, 하단 응원 티켓 제목, 후원 모달 제목에 쓰이며, 도감 행 제목은 밀도에 맞춰 `21px`로 조인다.
- **Body** (`400`, `15.5px`, 행간 `1.56`): 대표 마스터 카트리지의 게임 소개 문단에 쓰이며 최대 글줄 길이를 `64ch`로 제한한다.
- **Compact Body & Action UI** (`600`~`900`, `12.5px`~`17px`, 행간 `1.44`~`1.52`): 카트리지 2줄 요약·도감 1줄 설명·모달 안내문(`13px`), 키캡 단추·정렬 칩·도감 실행 단추(`12.5px`~`13px`, 굵기 `800`~`900`), 마스터 주 실행 단추(`17px`, 굵기 `900`)에 쓴다.
- **Label / Serial** (`700`, `11.5px`~`19px`, 행간 `1.1`, `font-variant-numeric: tabular-nums`): 상단 `404 ARCADE PACK` 스탬프(`19px`), 도감 순번(`18px`), 드럼 계수기 숫자(`14px`), 마스터 스펙 스탬프(`13.5px`), 보정 판독줄(`13px`), 카트리지 상단 시리얼 캡(`12.5px`), 카드 하단 소형 실행 딱지(`11.5px`)에 쓴다.
- **Micro Connector Label** (`700`, `9.5px`~`11px`, 자간 `0.06em`): 카트리지 최상단 핀 커넥터 인덱스(`SLOT-01`)와 후원 QR 하단 시리얼 코드(`SUPPORT PASS · KAKAOPAY QR`) 전용이다.

### Named Rules
**The Tabular Counter Rule.** 실행 횟수, 쇼츠·릴스 조회수, 플레이 시간, 1위 기록, `1cm = px` 보정 눈금, 도감 번호를 표기하는 모든 요소에는 반드시 `font-variant-numeric: tabular-nums`를 선언해 실시간 동기화나 슬라이더 조작 중 숫자가 좌우로 떨리지 않게 한다.

**The Natural Weight Display Rule.** `Do Hyeon`은 단일 굵기(`400`)로 설계된 디스플레이 서체이므로 모든 제목에서 `font-weight: 400`을 유지해 브라우저의 인위적인 합성 볼드(faux-bold) 번짐을 막는다.

## Layout

바깥 컨테이너(`.tray-shell`)는 최대 폭 `1360px`로 가운데 정렬되며, 상단 안전 영역을 반영한 `padding: max(16px, env(safe-area-inset-top) + 10px) 24px 56px`와 수직 섹션 간격 `16px`로 짜인다. 페이지 바탕에는 `16px × 16px` 간격의 미세 먹색 원형 도트(`rgba(21, 23, 26, 0.05) 1px`)를 깔아 사출 성형 트레이 표면을 표현한다.

수직 흐름은 5단계로 고정된다:
1. **상단 명판 및 유틸리티 바**: 좌측 브랜드 스탬프·부제·5자리 드럼 계수기, 우측 5개 키캡 도구 단추(`flex-wrap: wrap`, 간격 `12px`).
2. **대표 마스터 카트리지 웰**: `9px` 성형 웰 패딩 안쪽에 좌측 16:9 장면 프레임과 우측 정보·실행 영역을 `minmax(340px, 1.12fr) 1fr` 2단 격자(`gap: 24px`)로 배치한다.
3. **4구 성형 트레이 격자**: `repeat(4, minmax(0, 1fr))` 4열 격자(`gap: 14px`)로 신작과 상위 인기 카트리지를 첫 화면 접힘선 안팎에 나란히 꽂는다. 각 웰은 `7px` 내부 홈 패딩을 가진다.
4. **전체 수록 카트리지 도감(색인 장부)**: 상단 제목·5종 정렬 칩 헤더 아래 `44px 148px minmax(200px, 1.3fr) minmax(210px, 1fr) auto` 5열 행(`gap: 16px`, 상하 패딩 `13px`)으로 전체 게임을 비교·정렬한다.
5. **응원 티켓 배너 및 푸터**: 크롬 옐로 배너(`padding: 18px 22px`)와 하단 채널·관리자 링크 줄로 마무리한다.

반응형 전환은 세 지점에서 일어난다:
- **`1120px` 이하**: 4구 트레이 격자가 `2열`로 줄고, 도감 행이 `38px 128px 1fr auto` 4열로 압축되며 지표 열이 제목 아래 3번째 열로 접힌다.
- **`820px` 이하**: 외곽 좌우 패딩이 `14px`, 섹션 간격이 `14px`로 줄고, 대표 마스터 카트리지가 `1열` 세로 적층으로 바뀌며 주 실행 단추가 가로 전체 폭(`100%`)으로 늘어난다.
- **`640px` 이하**: 카트리지 트레이가 `1열`로 전환되고, 도감 행은 일련번호 열을 숨긴 채 `104px 1fr` 구도로 썸네일·본문·전체 폭 실행 단추를 쌓는다.

## Elevation & Depth

이 시스템은 허공에 둥둥 뜨는 부유형 카드 대신 **오목한 성형 웰 중첩(Recessed Tonal Layering)과 먹색 밀착 그림자(Contact Ink Shadow)의 결합**으로 깊이를 만든다. 카트리지는 먼저 밝은 스톤 바탕보다 한 톤 어두운 `tray-well` 홈 안에 안착하고, 정지 상태에서만 아래쪽으로 짧은 먹색 그림자를 드리운다. 호버하거나 누르면 그림자가 커지는 것이 아니라 오히려 카트리지가 아래로 내려앉으며 그림자가 얕아지거나 사라진다.

### Shadow Vocabulary
- **패널 기본 안착 그림자** (`box-shadow: 0 8px 20px -10px rgba(21, 23, 26, 0.18)` ~ `0 12px 26px -12px rgba(21, 23, 26, 0.18)`): 상단 명판 바, 전체 도감 장부, 하단 응원 티켓의 정지 상태에 쓴다.
- **카트리지 팩 대기 그림자** (`box-shadow: 0 10px 18px -8px rgba(21, 23, 26, 0.24)`): 4구 트레이 안 개별 카트리지 팩이 반쯤 꽂혀 대기 중인 높이를 나타낸다.
- **카트리지 호버·클릭 압축 그림자** (`box-shadow: 0 2px 5px -2px rgba(21, 23, 26, 0.3)` → `:active` 시 `none`): 카트리지가 웰 바닥에 밀착될 때 그림자를 급격히 줄여 물리적 스토퍼 감각을 만든다.
- **마스터 카트리지 대기·압축 그림자** (`box-shadow: 0 12px 24px -10px rgba(21, 23, 26, 0.34)` → 호버 시 `0 5px 10px -4px rgba(21, 23, 26, 0.38)`): 반전 먹색 마스터 팩의 묵직한 부피감을 받친다.
- **모달 트레이 부양 그림자** (`box-shadow: 0 24px 52px -14px rgba(21, 23, 26, 0.44)`): `rgba(21, 23, 26, 0.7)` 반투명 먹색 배경(`backdrop-filter: blur(8px)`) 위에 뜨는 1cm 보정·후원 모달 트레이 외곽에만 허용한다.

### Named Rules
**The Seated-Detent Press Rule.** 모든 카트리지와 키캡 단추는 호버·클릭 시 위(`-Y`)로 떠오르지 않고 반드시 아래쪽(`+Y`)으로 내려앉는다(`keycap-btn` `1px`→`2px`, `master-cartridge` `3px`→`5px`, `cart-pack` `4px`→`6px`). 상태 전환에는 기계식 걸쇠 곡선인 `cubic-bezier(0.16, 1, 0.3, 1)`을 쓰며 `prefers-reduced-motion: reduce` 환경에서는 즉시(`0.01ms`) 전환한다.

## Shapes

모서리 반경은 산업용 금형과 재단 인쇄물의 직각 비례를 따르며 `1px`~`4px` 네 단계 안으로 엄격히 묶는다:
- **마이크로 램프 (`1px`)**: 계수기 작동 점(`6px × 6px`), 카트리지 슬롯 램프(`7px × 7px`), 5핀 커넥터 패드.
- **스탬프·미디어 컷 (`2px`)**: `404 ARCADE PACK` 스탬프, 드럼 계수기 창, 16:9 게임 장면 프레임, 도감 태그, 보정 프리셋 칩, QR 코드 박스.
- **카트리지·키캡 본체 (`3px`)**: 대표 마스터 카트리지, 개별 카트리지 팩, 모든 키캡·실행 단추, 정렬·보정 탭, 모달 내부 인쇄 카드, 토스트 알림.
- **외곽 성형 웰·트레이 (`4px`)**: `.master-well`, `.cart-well`, `.ledger-section`, `.support-ticket`, 모달 바깥 트레이 셸(`.cal-tray-shell`, `.don-tray-frame`).

원형(`50%`)은 실제 동전(100원·500원) 지름을 화면에 대어 보는 1cm 보정 모달의 실물 동전 가이드에만 예외로 허용한다. 테두리는 외곽 트레이·카트리지·주 실행 단추에 `2px solid`, 키캡·탭·썸네일·내부 구획선에 `1.5px solid`, 장부 행 구분선에 `1px solid` 실선을 쓰며, 빈 상태 상자(`.empty-state-box`)만 `2px dashed` 점선을 쓴다.

## Components

모든 구성 요소는 매끄러운 유리 패널이 아니라 손끝으로 눌러 조작하는 플라스틱 스위치와 인쇄 카트리지처럼 단단하고 즉각적으로 반응한다.

### Buttons
- **Shape:** 칼각에 가까운 다이컷 모서리(`3px` 반경, 카드 내부 보조 실행 딱지는 `2px`).
- **Primary (`master-cta` / `cal-btn-save`):** 버밀리온 스탬프 배경(`stamp-red`)에 흰색 굵은 글자(`14.5px`~`17px`, 굵기 `900`), 외곽 `2px` 실선 테두리(어두운 마스터 케이스 안에서는 `label-paper`, 밝은 모달 안에서는 `ink`), 패딩 `11px 22px`(모달 저장 단추는 `12px`).
- **Hover / Focus:** 마스터 카트리지 호버·포커스 시 주 실행 단추가 크롬 옐로(`plate-yellow`) 배경과 먹색(`ink`) 글자로 즉시 반전되어 장착 준비 상태를 알린다. 키보드 포커스는 모든 대화형 요소에 `2.5px solid` 코발트 블루(`serial-blue`, `outline-offset: 2px`) 링을 두른다.
- **Secondary / Utility Keycaps (`keycap-btn` / `ledger-play-btn` / `support-cta`):** 상단 도구 단추는 `label-tint` 배경에 `1.5px solid` 먹색 테두리와 `15px` 선형 SVG 아이콘(`padding: 7px 11px`, 글자 `13px`, 굵기 `800`)을 쓰며 호버 시 `label-paper`로 밝아지며 `1px` 눌린다. 후원 키캡(`is-yellow`)과 도감 행 실행 단추는 `plate-yellow` 배경을 쓰고, 음소거 상태(`is-muted`)는 `tray-well` 배경과 `ink-secondary` 글자로 낮춘다. 하단 응원 단추(`support-cta`)는 노란 배너 위에서 대비를 세우기 위해 반전 먹색(`ink`) 배경에 밝은 글자(`label-paper`)를 쓴다.

### Chips
- **Style:** 도감 정렬 칩(`sort-chip`, 패딩 `7px 12px`, 반경 `3px`)과 보정 측정 탭(`cal-tab-btn`, 4열 균등 격자)은 `label-tint` 배경과 `1.5px solid` 먹색 테두리, `12.5px` 굵기 `800` 글자를 기본으로 쓴다. 보정 인치·동전 프리셋 칩(`cal-preset-chip`)은 `label-paper` 배경에 `Chakra Petch` `12px` 고정폭 숫자와 `2px` 반경을 쓴다.
- **State:** 정렬·보정 탭이 선택(`active` / `is-active`, `aria-pressed="true"`)되면 배경이 먹색(`ink`), 글자가 크롬 옐로(`plate-yellow`)로 반전된다. 인치·동전 프리셋 칩이 선택(`is-on`)되면 코발트 블루(`serial-blue`) 배경에 흰색 글자로 켜진다.

### Cards / Containers
- **Corner Style:** 바깥 성형 웰(`cart-well`, `master-well`)은 `4px`, 안쪽 카트리지 본체(`cart-pack`, `master-cartridge`)는 `3px`, 내부 16:9 장면 창은 `2px`.
- **Background:** 바깥 웰은 `tray-well`, 일반 카트리지 본체와 도감 장부는 `label-paper`, 대표 마스터 카트리지는 `ink`, 모달 외곽 셸은 `tray-stone` 위에 내부 `label-paper` 카드를 이중으로 포갠다.
- **Shadow Strategy:** Elevation & Depth 섹션의 대기 그림자에서 호버·클릭 압축 그림자로 전이하며 웰 안쪽으로 내려앉는다.
- **Border:** 웰과 카트리지 외곽 모두 `2px solid` 먹색 테두리를 두르고, 카트리지 내부 구획(핀 띠·시리얼 캡·16:9 아트 프레임)은 `1.5px solid` 먹색 가로선으로 나눈다. 마스터 카트리지는 호버·포커스 시 외곽 테두리가 `plate-yellow`로 점등된다.
- **Internal Padding:** 마스터 웰 `9px`(내부 카드 `16px 20px 16px 16px`), 일반 카트리지 웰 `7px`(본문 영역 `11px 12px 10px`), 도감 장부 `22px 22px 18px`(모바일 `16px 14px`), 모달 트레이 셸 `9px`(내부 카드 `20px 18px 18px`).

### Inputs / Fields
- **Style:** 1cm 보정 모달의 미세 조절 컨트롤은 좌우 스테퍼 단추(`cal-step-btn`, `38px × 36px`, `label-tint` 배경, `1.5px solid` 먹색 테두리, `Chakra Petch` `18px`)와 가운데 `input[type="range"]`(`accent-color: #15171A`) 및 하단 고정폭 수치 판독줄(`cal-readout-bar`, `label-tint` 배경, `1px solid` `tray-well` 테두리)을 한 묶음으로 구성한다.
- **Focus:** 슬라이더와 스테퍼 단추 모두 키보드 이동 시 `2.5px solid` 코발트 블루(`serial-blue`) 외곽선이 명확히 표시된다.

### Navigation
- **상단 명판 바 (`tray-nameplate`):** 고정(sticky)으로 화면을 가리지 않고 최상단에 자리하는 전체 폭 인쇄 명판이다. 좌측에는 `404 ARCADE PACK` 스탬프·한글 컬렉션 명칭·기계식 누적 실행 계수기를 묶고, 우측 `nav.tool-cluster`에는 실제 1cm 보정·배경음 토글·응원과 후원·유튜브·인스타그램 이동 키캡을 일렬 배치해 좁은 화면에서 자연스럽게 줄바꿈(`flex-wrap: wrap`)한다.
- **하단 명판 푸터 (`tray-footer`):** `1.5px solid` `tray-mid` 상단 구분선 아래 안내 문구와 밑줄 친 공식 채널·관리자 모드 텍스트 링크(`text-underline-offset: 4px`, 호버 시 `serial-blue`)를 양끝 정렬한다.

### Mechanical Drum Counter & Molded Cartridge Well
- **기계식 5자리 드럼 적산 계수기 (`mech-counter`):** 아케이드 전체 누적 실행 수를 실시간으로 증명하는 시그니처 계기다. 좌측 `label-tint` 라벨 칸(주홍 작동 점 포함)과 우측 5개 개별 숫자 셀(`drum-cell`, 각 폭 `19px`, `ink-panel` 배경에 `plate-yellow` `Chakra Petch` `14px` 숫자, `1px` `ink-secondary` 칸막이), 그리고 끝단 단위 칸(`회`)을 `1.5px solid` 먹색 테두리 안에 결합한다.
- **4구 인쇄 카트리지 팩 (`cart-pack`):** 상단부터 ① `14px` 높이의 핀 커넥터 띠(`SLOT-01` + 5개 핀 마크, 호버 시 핀이 노란색으로 점등), ② 상태별 색이 나뉘는 시리얼 캡(신작 `stamp-red`, 인기 순위 `ink` 바탕에 노란 글자, 기본 `serial-blue` + 좌측 정사각 슬롯 램프), ③ 16:9 인게임 장면 창(공개 예정 `is-locked` 상태일 때 `blur(3px) brightness(0.65)` 베일과 노란 `공개 예정` 딱지 표시), ④ 제목·2줄 설명·1위 기록 및 우측 하단 `실행` 스탬프(`cart-go`, 호버 시 `stamp-red` 점등)의 4단 적층 구조를 지킨다.

## Do's and Don'ts

### Do:
- **Do** 새로운 포털 모달이나 공용 오버레이를 만들 때 바깥 `tray-stone` 트레이 프레임(`4px` 반경, `9px`~`10px` 패딩, `2px` 먹색 테두리) 안에 `label-paper` 인쇄 카드(`3px` 반경, `2px` 먹색 테두리)를 끼우는 이중 트레이 구조를 사용하라.
- **Do** 카트리지와 키캡 단추의 호버·활성 상태에 아래쪽으로 눌려 들어가는 양수 `translateY` 변위와 줄어드는 먹색 그림자를 함께 적용해 물리적 장착감을 유지하라.
- **Do** 실행 수, 조회수, 시간, 1위 점수, 길이 보정치 등 모든 동적 숫자 영역에 `Chakra Petch` 또는 `font-variant-numeric: tabular-nums`를 선언하라.
- **Do** 모든 아이콘을 `15px`~`20px` 크기의 깔끔한 인라인 SVG로만 그리고, 런타임 데이터에서 넘어올 수 있는 이모지·특수 그림 문자는 렌더링 전에 제거하라.

### Don't:
- **Don't** 포털과 공용 모달 안에서 어두운 보라색 배경, 네온 색 번짐 그림자(glow shadow), 그라데이션 단추, 또는 `999px` 알약형 모서리를 사용하지 마라.
- **Don't** 제목 위에 작은 영문·한글 장식 문구를 얹는 아이브로(eyebrow)나 키커(kicker) 줄을 렌더링하지 마라. 카트리지의 상태와 번호는 상단 시리얼 캡(`cart-cap`)과 스탬프로만 전달한다.
- **Don't** `Do Hyeon` 디스플레이 제목에 `700`이나 `900` 굵기를 지정해 합성 볼드 번짐을 유발하지 마라.
- **Don't** 포털 디자인 토큰을 8개 개별 미니게임 내부 플레이 화면이나 인게임 전용 `shared/styles.css`에 강제로 덮어씌워 각 게임 고유의 조작 계기판을 훼손하지 마라.
