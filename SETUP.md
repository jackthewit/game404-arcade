# 이게뭔겜? 404 아케이드 — 배포·운영 가이드

클로드의 `attend-stamp`와 동일한 방식(Supabase `onlinegym` 공용 + GitHub + Vercel)으로 추가 요금 0원에 운영합니다.

- 메인 아케이드: `/`
- 관리자 콘솔: `/admin.html` (초기 비밀번호는 로컬 `.admin-pw-initial` 파일 참고 → 로그인 후 설정 탭에서 변경)
- 개별 게임: `/haircut/`, `/toilet/`, `/film/` (관리자 미리보기: 뒤에 `?preview=1`)

## 1. Supabase (추가 요금 0원 — `onlinegym` 공용)
- 프로젝트: **`onlinegym`** (`zaxwhkbeuriuxbtvlwsi`)
- 다른 앱(`arte_`, `att_`)과 충돌하지 않도록 모든 테이블·함수를 **`g404_`** 접두사로 분리했습니다.
- 브라우저는 테이블을 직접 읽거나 쓸 수 없고(RLS 활성화), `g404_public_games` · `g404_get_game` · `g404_submit_run` · `g404_get_run` · `g404_get_ladder` · `g404_admin` RPC 함수만 호출합니다.
- 스키마 반영·수정: `supabase/schema.sql` 전체를 Supabase SQL 편집기에서 실행합니다(여러 번 실행해도 안전).

## 2. 관리자 모드 (`/admin.html`)
- **게임 목록 관리**:
  - `🟢 공개`: 메인 카드 노출 + 플레이 가능
  - `🔒 공개예정`: 썸네일 블러 + 잠금 안내 문구(예: `조회수 10만, 댓글 100개 넘으면 진짜 게임 공개!!`) 노출, 직접 URL 접속도 잠금 화면 표시
  - `🙈 숨김`: 메인 목록에서 숨김 + 직접 URL 접속 차단
  - `▲ / ▼`: 메인 표시 순서 즉시 변경
  - `✏️ 편집` / `➕ 새 게임 추가` / `👀 미리보기(?preview=1)` / `🗑 삭제`
- **랭킹 기록 관리**: 게임별 최근 기록 조회 및 테스트 기록 삭제
- **설정**: 관리자 비밀번호 변경 (8회 실패 시 2분 잠금)

## 3. 개발 및 배포
- 로컬 미리보기: `npm run dev` → http://localhost:8444
- Vercel 배포: `npm run deploy` (`npx vercel deploy --prod --yes`)
- `.admin-pw-initial`은 `.gitignore`와 `.vercelignore`에 모두 제외되어 GitHub·Vercel에 올라가지 않습니다.
