// 이게뭔겜? 404 아케이드 — 동적 게임 카탈로그 & 공개 상태(공개/공개예정/숨김) 접근 제어
import { getSupabaseConfig, getBestRecord } from './challenge.js';

export const DEFAULT_GAMES = [
  {
    id: 'cake',
    title: '케이크 글씨 쓰기',
    kicker: '한 번 짜면 못 지워요!',
    badge: '🎂 쫀득 초코펜 · 5단계',
    description: '누르는 시간에 따라 두께가 통통해지고 뗄 때 실이 늘어나는 리얼 초코펜! 하트 1개부터 장문 레터링까지 도전하세요.',
    metric_label: '5단계 누적 점수 랭킹',
    thumb_url: './assets/thumb-cake.jpg',
    href: './cake/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: true,
    sort_order: 10,
  },
  {
    id: 'haircut',
    title: '어떻게 잘라드릴까요?',
    kicker: '왼쪽 · 가운데 · 오른쪽',
    badge: '✂️ 실제 cm · 3구간 컷',
    description: '눈금 없이 오직 눈대중으로! 세 구간을 고르게 다듬어 목표 길이 오차와 좌우 단차로 실력을 겨뤄 보세요.',
    metric_label: '오차 mm 랭킹',
    thumb_url: './assets/thumb-haircut.jpg',
    href: './haircut/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: false,
    sort_order: 20,
  },
  {
    id: 'toilet',
    title: '무한 두루마리',
    kicker: '휴… 휴지가 있다!!',
    badge: '🧻 100km 도전 · 미라 진화',
    description: '중간 심을 피해서 한 방향으로 돌돌돌돌! 안 끊기고 길게 말수록 10m마다 응원 폭죽과 3D 미라 변신이 펼쳐집니다.',
    metric_label: '길이 m/km 랭킹',
    thumb_url: './assets/thumb-toilet.jpg',
    href: './toilet/',
    status: 'public',
    lock_message: '조회수 10만, 댓글 100개 넘으면 진짜 게임 공개!!',
    featured: false,
    sort_order: 30,
  },
  {
    id: 'film',
    title: '강화필름 한번에',
    kicker: '기포 0 · 먼지 0 도전',
    badge: '📱 3D 멀티앵글 · 정밀 부착',
    description: '탑·프론트·레프트 구도로 미세한 미끄러짐을 잡아 딱 맞춰 붙이고, 굳기 전에 기포를 깔끔하게 밀어내 보세요.',
    metric_label: '100점 정밀 랭킹',
    thumb_url: './assets/thumb-film.jpg',
    href: './film/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: false,
    sort_order: 40,
  },
];

export async function rpcCall(fn, args = {}, tries = 2) {
  const sb = await getSupabaseConfig();
  if (!sb) throw new Error('Supabase 설정이 없습니다.');
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(`${sb.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((data && data.message) || `서버 응답 ${res.status}`);
      }
      return data;
    } catch (e) {
      if (i >= tries - 1) throw e;
      await new Promise(r => setTimeout(r, 450));
    }
  }
}

export async function fetchPublicCatalog() {
  try {
    const rows = await rpcCall('g404_public_games', {}, 2);
    if (Array.isArray(rows)) {
      return { games: rows, live: true };
    }
  } catch {
    // 오프라인 또는 스키마 미적용 시 기본 3종 폴백
  }
  return { games: DEFAULT_GAMES, live: false };
}

export function formatBestText(gameId) {
  const b = getBestRecord(gameId);
  if (!b) return '기록 없음';
  if (gameId === 'haircut' && b.errorMm != null) {
    return `최고 오차 ${Number(b.errorMm).toFixed(1)}mm`;
  }
  if (gameId === 'toilet' && b.score != null) {
    const m = Number(b.score);
    return m >= 1000 ? `최고 ${(m / 1000).toFixed(2)}km` : `최고 ${m.toFixed(1)}m`;
  }
  if (b.score != null) {
    return `최고 ${Math.round(Number(b.score))}점`;
  }
  return '기록 있음';
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 각 게임 페이지 로드 시 공개 상태 확인 (비공개/공개예정이면 잠금 오버레이 표시, ?preview=1은 관리자 미리보기 허용)
export async function enforceGameAccess(gameId) {
  const qs = new URLSearchParams(location.search);
  if (qs.get('preview') === '1') {
    const badge = document.createElement('div');
    badge.style.cssText = [
      'position:fixed;bottom:10px;left:10px;z-index:9999;',
      'padding:6px 12px;border-radius:999px;font-size:11.5px;font-weight:900;',
      'background:rgba(124,92,255,0.92);color:#fff;border:1px solid rgba(255,255,255,0.35);',
      'box-shadow:0 6px 18px rgba(0,0,0,0.4);pointer-events:none;'
    ].join('');
    badge.textContent = '👀 관리자 미리보기 모드';
    document.body.appendChild(badge);
    return { allowed: true, preview: true };
  }

  try {
    const info = await rpcCall('g404_get_game', { p_id: gameId }, 1);
    if (!info || !info.found || info.status === 'public') {
      return { allowed: true, info };
    }

    const isHidden = info.status === 'hidden';
    const title = info.title || '게임 공개 준비 중';
    const msg = info.lock_message || (isHidden
      ? '지금은 잠시 점검 중이거나 비공개 상태입니다.'
      : '곧 공개 예정입니다! 조금만 기다려 주세요.');

    const overlay = document.createElement('div');
    overlay.id = 'g404-lock-overlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;',
      'padding:20px;background:rgba(14,10,24,0.94);backdrop-filter:blur(12px);',
      'font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#f8f5ff;'
    ].join('');

    overlay.innerHTML = `
      <div style="width:min(420px,100%);background:#1c162b;border:1.5px solid rgba(255,216,74,0.38);border-radius:26px;padding:28px 22px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.65);display:flex;flex-direction:column;gap:14px;align-items:center;">
        <div style="font-size:44px;line-height:1;">${isHidden ? '🛠️' : '🔒'}</div>
        <div style="padding:4px 12px;border-radius:999px;font-size:12px;font-weight:900;background:rgba(255,216,74,0.16);color:#ffd84a;border:1px solid rgba(255,216,74,0.4);">
          ${isHidden ? '잠시 쉬어가는 중' : '공개 예정 게임'}
        </div>
        <h2 style="margin:0;font-size:22px;font-weight:900;letter-spacing:-0.02em;word-break:keep-all;">${escHtml(title)}</h2>
        <p style="margin:0;font-size:14.5px;line-height:1.6;color:#e4dcf7;font-weight:700;word-break:keep-all;background:rgba(255,255,255,0.05);padding:12px 14px;border-radius:14px;width:100%;">
          ${escHtml(msg)}
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;width:100%;margin-top:4px;">
          <a href="../" style="display:block;width:100%;padding:13px 16px;border-radius:14px;background:#ffd84a;color:#171122;font-size:15px;font-weight:900;text-decoration:none;">
            🏠 404 아케이드 메인으로
          </a>
          <div style="display:flex;gap:8px;width:100%;">
            <a href="https://www.youtube.com/@이게뭔게임404game" target="_blank" rel="noopener noreferrer" style="flex:1;padding:10px 12px;border-radius:12px;background:#d91e3a;color:#fff;font-size:12.5px;font-weight:800;text-decoration:none;">
              ▶ 유튜브 보기
            </a>
            <a href="https://www.instagram.com/game404notfound/" target="_blank" rel="noopener noreferrer" style="flex:1;padding:10px 12px;border-radius:12px;background:#c13584;color:#fff;font-size:12.5px;font-weight:800;text-decoration:none;">
              📸 인스타 보기
            </a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return { allowed: false, info };
  } catch {
    // 네트워크 오류 시 기본 플레이 허용
    return { allowed: true };
  }
}
