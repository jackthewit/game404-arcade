// 이게뭔겜? 404 아케이드 — 동적 게임 카탈로그 & 공개 상태(공개/공개예정/숨김) 접근 제어
import { getSupabaseConfig, getBestRecord, getDefaultSeedsForGame } from './challenge.js';
import { startGameEngagementTracker } from './popularity.js';

const FONTS_HREF = new URL('../assets/fonts/arcade-fonts.css', import.meta.url).href;

function ensureArcadeFonts() {
  if (document.getElementById('g404-arcade-fonts')) return;
  const link = document.createElement('link');
  link.id = 'g404-arcade-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

export const DEFAULT_GAMES = [
  {
    id: 'snap',
    title: '웨딩·여행 스냅 알바',
    kicker: '12종 입체 구도 · 10대 명소 스냅!',
    badge: '12종 구도 · 10대 명소 · 랜덤 기행',
    description: '호숫가 가든·유럽 노천카페·대관람차·벚꽃 고궁·불꽃 루프탑 등 10대 명소에서 로우앵글·측면·하이앵글·사선 구도를 맞춰 찰칵! 매번 달라지는 랜덤 난입 소동을 뚫고 인생샷을 건지세요.',
    metric_label: '누적 알바비 랭킹',
    thumb_url: './assets/thumb-snap.jpg',
    href: './snap/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: true,
    sort_order: 2,
  },
  {
    id: 'jjamppong',
    title: '짬뽕 탄막',
    kicker: '흰 티 입은 날 · 사악한 국물 회피!',
    badge: '3D 중국집 인트로 · 생존 랭킹',
    description: '하필 새하얀 흰 티 입은 날 시킨 사악한 해물짬뽕! 젓가락질할 때마다 커지고 많아지는 국물 탄막을 피해 최장 생존 기록에 도전하세요.',
    metric_label: '생존 시간(초) 랭킹',
    thumb_url: './assets/thumb-jjamppong.jpg',
    href: './jjamppong/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: true,
    sort_order: 5,
  },
  {
    id: 'boxcut',
    title: '열려라 택배!',
    kicker: '밀려드는 택배 · 칼각 직선 슬라이스!',
    badge: '타임어택 · 깜짝 선물 보너스',
    description: '쌓이기 전에 테이프 선을 따라 빠르고 반듯하게 쫙 그어 뜯으세요! 칼각 정확도로 자르면 상자 속에서 희귀 선물이 튀어오릅니다.',
    metric_label: '언박싱 점수 랭킹',
    thumb_url: './assets/thumb-boxcut.jpg',
    href: './boxcut/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: true,
    sort_order: 10,
  },
  {
    id: 'cake',
    title: '케이크 글씨 쓰기',
    kicker: '한 번 짜면 못 지워요!',
    badge: '쫀득 초코펜 · 360° 캡처',
    description: '누르는 시간에 따라 두께가 달라지는 리얼 초코펜! 완성한 케이크에 촛불을 켜고 이리저리 돌려 사진으로 공유해 보세요.',
    metric_label: '수제 케이크 짤 생성',
    thumb_url: './assets/thumb-cake.jpg',
    href: './cake/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: true,
    sort_order: 20,
  },
  {
    id: 'haircut',
    title: '어떻게 잘라드릴까요?',
    kicker: '왼쪽 · 가운데 · 오른쪽',
    badge: '실제 cm · 3구간 컷',
    description: '눈금 없이 오직 눈대중으로! 세 구간을 고르게 다듬어 목표 길이 오차와 좌우 단차로 실력을 겨뤄 보세요.',
    metric_label: '오차 mm 랭킹',
    thumb_url: './assets/thumb-haircut.jpg',
    href: './haircut/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: true,
    sort_order: 30,
  },
  {
    id: 'film',
    title: '강화필름 한번에',
    kicker: '기포 0 · 먼지 0 도전',
    badge: '3D 멀티앵글 · 정밀 부착',
    description: '탑·프론트·레프트 구도로 미세한 미끄러짐을 잡아 딱 맞춰 붙이고, 굳기 전에 기포를 깔끔하게 밀어내 보세요.',
    metric_label: '100점 정밀 랭킹',
    thumb_url: './assets/thumb-film.jpg',
    href: './film/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: false,
    sort_order: 40,
  },
  {
    id: 'nail',
    title: '손톱 색칠하기',
    kicker: '삐져나가면 끝! 타임어택 네일아트',
    badge: '상·중·하 네일아트 · 타임어택',
    description: '원컬러부터 세필 붓으로 그리는 하트·데이지꽃·리본 네일아트까지! 숨을 참아 떨림을 멈추고 빠르게 완성해 시간 가산점을 챙겨 보세요.',
    metric_label: '타임어택 정밀 랭킹',
    thumb_url: './assets/thumb-nail.jpg',
    href: './nail/',
    status: 'public',
    lock_message: '곧 공개 예정입니다! 조금만 기다려 주세요.',
    featured: false,
    sort_order: 50,
  },
  {
    id: 'toilet',
    title: '무한 두루마리',
    kicker: '휴… 휴지가 있다!!',
    badge: '100km 도전 · 미라 진화',
    description: '중간 심을 피해서 한 방향으로 돌돌돌돌! 안 끊기고 길게 말수록 10m마다 응원 폭죽과 3D 미라 변신이 펼쳐집니다.',
    metric_label: '길이 m/km 랭킹',
    thumb_url: './assets/thumb-toilet.jpg',
    href: './toilet/',
    status: 'public',
    lock_message: '조회수 10만, 댓글 100개 넘으면 진짜 게임 공개!!',
    featured: false,
    sort_order: 60,
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
      const existingIds = new Set(rows.map(r => r.id));
      const missingDefaults = DEFAULT_GAMES.filter(d => !existingIds.has(d.id));
      if (missingDefaults.length > 0) {
        const checks = await Promise.all(
          missingDefaults.map(d => rpcCall('g404_get_game', { p_id: d.id }, 1).catch(() => null))
        );
        const trulyNew = missingDefaults.filter((_, idx) => !checks[idx] || !checks[idx].found);
        if (trulyNew.length > 0) {
          const merged = [...trulyNew, ...rows].sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100));
          return { games: merged, live: true };
        }
      }
      return { games: rows, live: true };
    }
  } catch {
    // 오프라인 또는 스키마 미적용 시 기본 목록 폴백
  }
  return { games: DEFAULT_GAMES, live: false };
}

function formatRunMetric(gameId, score, errorMm, actualValue) {
  if (gameId === 'cake') {
    const st = actualValue ? Math.round(Number(actualValue)) : 5;
    return `${st}단계 완성`;
  }
  if (gameId === 'snap' && score != null) {
    const st = actualValue ? ` (${Math.round(Number(actualValue))}단계)` : '';
    return `${Math.round(Number(score)).toLocaleString()}원${st}`;
  }
  if (gameId === 'jjamppong' && score != null) {
    const wv = actualValue ? ` (${Math.round(Number(actualValue))}젓가락)` : '';
    return `${Number(score).toFixed(1)}초${wv}`;
  }
  if (gameId === 'boxcut' && score != null) {
    const bx = actualValue ? ` (${Math.round(Number(actualValue))}상자)` : '';
    return `${Math.round(Number(score)).toLocaleString()}점${bx}`;
  }
  if (gameId === 'haircut' && errorMm != null) {
    return `오차 ${Number(errorMm).toFixed(1)}mm`;
  }
  if (gameId === 'toilet' && score != null) {
    const m = Number(score);
    return m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${m.toFixed(1)}m`;
  }
  if (gameId === 'nail' && score != null) {
    return `${Number(score).toFixed(1)}점`;
  }
  if (score != null) {
    return `${Math.round(Number(score)).toLocaleString()}점`;
  }
  return '';
}

export function formatBestText(gameId, topRun = null) {
  const b = getBestRecord(gameId);
  if (b) {
    const myMetric = formatRunMetric(gameId, b.score, b.errorMm, b.actualValue);
    if (myMetric) return `내 최고 ${myMetric}`;
  }
  const top = topRun || getDefaultSeedsForGame(gameId)[0];
  if (top) {
    const topMetric = formatRunMetric(
      gameId,
      top.score,
      top.error_mm ?? top.errorMm,
      top.actual_value ?? top.actualValue
    );
    const rawNick = String(top.nickname || '').trim();
    const isAnon = !rawNick || /^익명/.test(rawNick);
    if (topMetric) {
      return isAnon ? `1위 기록 · ${topMetric}` : `1위 ${rawNick} · ${topMetric}`;
    }
  }
  if (gameId === 'cake') return '360° 돌려보고 공유';
  return '도전 가능';
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function enforceGameAccess(gameId) {
  const qs = new URLSearchParams(location.search);
  if (qs.get('preview') === '1') {
    ensureArcadeFonts();
    const badge = document.createElement('div');
    badge.style.cssText = [
      'position:fixed;bottom:12px;left:12px;z-index:9999;',
      'padding:6px 12px;border-radius:3px;font-family:"Chakra Petch","Pretendard",sans-serif;font-size:12px;font-weight:700;',
      'background:#15171A;color:#F2BE18;border:2px solid #F2BE18;',
      'box-shadow:0 8px 20px rgba(21,23,26,0.32);pointer-events:none;'
    ].join('');
    badge.textContent = 'PREVIEW · 관리자 미리보기';
    document.body.appendChild(badge);
    return { allowed: true, preview: true };
  }

  try {
    const info = await rpcCall('g404_get_game', { p_id: gameId }, 1);
    if (!info || !info.found || info.status === 'public') {
      startGameEngagementTracker(gameId);
      return { allowed: true, info };
    }

    ensureArcadeFonts();
    const isHidden = info.status === 'hidden';
    const title = info.title || '게임 공개 준비 중';
    const msg = info.lock_message || (isHidden
      ? '지금은 잠시 점검 중이거나 비공개 상태입니다.'
      : '곧 공개 예정입니다! 조금만 기다려 주세요.');

    const iconSvg = isHidden
      ? `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#15171A" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`
      : `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#15171A" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

    const overlay = document.createElement('div');
    overlay.id = 'g404-lock-overlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;',
      'padding:20px;background:rgba(216,221,228,0.92);backdrop-filter:blur(10px);',
      'font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif;color:#15171A;'
    ].join('');

    overlay.innerHTML = `
      <div style="width:min(420px,100%);background:#D8DDE4;border:2px solid #15171A;border-radius:4px;padding:10px;box-shadow:0 22px 48px -14px rgba(21,23,26,0.34);">
        <div style="background:#F5F7FA;border:2px solid #15171A;border-radius:3px;padding:24px 20px;text-align:center;display:flex;flex-direction:column;gap:14px;align-items:center;">
          <div style="width:52px;height:52px;border-radius:3px;background:#F2BE18;border:2px solid #15171A;display:flex;align-items:center;justify-content:center;">
            ${iconSvg}
          </div>
          <h2 style="margin:0;font-family:'Do Hyeon','Apple SD Gothic Neo',sans-serif;font-size:26px;font-weight:400;letter-spacing:-0.02em;word-break:keep-all;color:#15171A;">${escHtml(title)}</h2>
          <div style="padding:4px 12px;border-radius:2px;font-family:'Chakra Petch','Pretendard',sans-serif;font-size:12px;font-weight:700;background:#15171A;color:#F2BE18;">
            ${isHidden ? 'MAINTENANCE · 카트리지 점검 중' : 'SEALED PACK · 공개 예정'}
          </div>
          <p style="margin:0;font-size:14.5px;line-height:1.58;color:#373D45;font-weight:700;word-break:keep-all;background:#E9EDF2;border:1.5px solid #C6CDD6;padding:12px 14px;border-radius:3px;width:100%;">
            ${escHtml(msg)}
          </p>
          <div style="display:flex;flex-direction:column;gap:8px;width:100%;margin-top:2px;">
            <a href="/" style="display:block;width:100%;padding:13px 16px;border-radius:3px;background:#C92A1D;color:#FFFFFF;border:2px solid #15171A;font-size:15px;font-weight:900;text-decoration:none;">
              404 아케이드 트레이로 돌아가기
            </a>
            <div style="display:flex;gap:8px;width:100%;">
              <a href="https://www.youtube.com/@이게뭔게임404game" target="_blank" rel="noopener noreferrer" style="flex:1;padding:10px 12px;border-radius:3px;background:#F5F7FA;color:#15171A;border:1.5px solid #15171A;font-size:13px;font-weight:800;text-decoration:none;">
                유튜브 공식 채널
              </a>
              <a href="https://www.instagram.com/game404notfound/" target="_blank" rel="noopener noreferrer" style="flex:1;padding:10px 12px;border-radius:3px;background:#F5F7FA;color:#15171A;border:1.5px solid #15171A;font-size:13px;font-weight:800;text-decoration:none;">
                인스타그램 채널
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return { allowed: false, info };
  } catch {
    startGameEngagementTracker(gameId);
    return { allowed: true };
  }
}

const LAYOUT_CFG_ID = 'cfg_layout';
let cachedLayout = null;

export async function loadLayoutConfig(forceRefresh = false) {
  if (cachedLayout && !forceRefresh) return cachedLayout;
  const sb = await getSupabaseConfig();
  if (sb) {
    try {
      const res = await fetch(`${sb.url}/rest/v1/rpc/g404_get_run`, {
        method: 'POST',
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_id: LAYOUT_CFG_ID }),
      });
      if (res.ok) {
        const row = await res.json();
        if (row && row.id && row.meta && Array.isArray(row.meta.newIds)) {
          const savedIds = row.meta.newIds.map(String);
          for (const nid of ['jjamppong', 'snap']) {
            if (!savedIds.includes(nid)) savedIds.unshift(nid);
          }
          cachedLayout = { newIds: savedIds };
          return cachedLayout;
        }
      }
    } catch {
      // fallback below
    }
  }
  cachedLayout = { newIds: ['snap', 'jjamppong', 'boxcut'] };
  return cachedLayout;
}

export async function saveLayoutConfig(adminRpcFn, { newIds }) {
  const sb = await getSupabaseConfig();
  if (!sb) throw new Error('Supabase 설정이 없습니다.');
  const cleanIds = Array.from(new Set((newIds || []).map(x => String(x || '').trim()).filter(Boolean)));
  try {
    await adminRpcFn('delete_run', { id: LAYOUT_CFG_ID });
  } catch {
    // ignore
  }
  const res = await fetch(`${sb.url}/rest/v1/rpc/g404_submit_run`, {
    method: 'POST',
    headers: {
      apikey: sb.key,
      Authorization: `Bearer ${sb.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_id: LAYOUT_CFG_ID,
      p_room_id: 'LAYCFG',
      p_game_id: '__config__',
      p_nickname: 'layout_cfg',
      p_target_value: cleanIds.length,
      p_actual_value: 0,
      p_score: 0,
      p_error_mm: null,
      p_rank_title: 'layout',
      p_seed: 1,
      p_meta: { newIds: cleanIds, updatedAt: new Date().toISOString() },
    }),
  });
  if (!res.ok) throw new Error('NEW 배지 설정 저장에 실패했습니다.');
  cachedLayout = { newIds: cleanIds };
  return cachedLayout;
}
