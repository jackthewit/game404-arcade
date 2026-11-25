// 이게뭔겜? 404 아케이드 — 3대 잣대(① 접속 · ② 플레이 시간 · ③ 릴스·쇼츠 반응) 인기 순위 & 자동 체류 추적 모듈
import { getSupabaseConfig } from './challenge.js';

const LOCAL_POP_KEY = 'fgs.popularity.local.v1';
const SESSION_VISIT_PREFIX = 'fgs.visited.session.';

// 콘텐츠 허브 공식 API(YouTube Data API v3 + Instagram Graph API) 실시간 조회 실측치 (2026-11-25 갱신)
// ※ 인스타 토큰에 instagram_manage_insights 권한이 없을 때는 허위/추정 조회수를 적지 않고 공식 API 실측(좋아요·댓글 + 쇼츠 조회수)만 표시합니다.
// ※ 관리자 모드(/admin.html)에서 인스타 실제 재생수(igViews)를 입력하면 '릴스·쇼츠 ○.○만회' 합산 조회수로 자동 전환됩니다.
export const DEFAULT_SOCIAL_STATS = {
  cake: {
      "ytId": "hUlDgApbvng",
      "igCode": "DfzL-jBBslN",
      "ytViews": 1431,
      "igViews": 0,
      "ytLikes": 8,
      "igLikes": 565,
      "likes": 573,
      "comments": 6,
      "shares": 0
  },
  film: {
      "ytId": "ADY8WhZWY8c",
      "igCode": "DfzLUtRAfgu",
      "ytViews": 1219,
      "igViews": 0,
      "ytLikes": 8,
      "igLikes": 197,
      "likes": 205,
      "comments": 6,
      "shares": 0
  },
  haircut: {
      "ytId": "QaCzc4uhdGg",
      "igCode": "DfoqYjvhRfp",
      "ytViews": 3516,
      "igViews": 0,
      "ytLikes": 8,
      "igLikes": 189,
      "likes": 197,
      "comments": 12,
      "shares": 82
  },
  nail: {
      "ytId": "_zDkFh3ie78",
      "igCode": "Df8UlPuvmfo",
      "ytViews": 1183,
      "igViews": 0,
      "ytLikes": 6,
      "igLikes": 13,
      "likes": 19,
      "comments": 3,
      "shares": 0
  },
  toilet: {
      "ytId": "HzgtlFKDyGU",
      "igCode": "Df-7bsPgpVB",
      "ytViews": 1005,
      "igViews": 0,
      "ytLikes": 1,
      "igLikes": 6,
      "likes": 7,
      "comments": 0,
      "shares": 0
  },
  boxcut: {
      "ytId": "XuuolbLucZs",
      "igCode": "DgJpsXPiFva",
      "ytViews": 384,
      "igViews": 0,
      "ytLikes": 1,
      "igLikes": 8,
      "likes": 9,
      "comments": 0,
      "shares": 0
  },
};

function readLocalPop() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_POP_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeLocalPop(data) {
  try {
    localStorage.setItem(LOCAL_POP_KEY, JSON.stringify(data));
  } catch {
    // ignore storage quota errors
  }
}

function makeStatId(prefix = 'S') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = new Uint8Array(9);
  crypto.getRandomValues(arr);
  let out = prefix;
  for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
  return out.slice(0, 14);
}

async function postMetricRun(sb, statGameId, scoreVal = 1, actualVal = 1, keepalive = false) {
  if (!sb) return;
  try {
    await fetch(`${sb.url}/rest/v1/rpc/g404_submit_run`, {
      method: 'POST',
      keepalive,
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_id: makeStatId('M'),
        p_room_id: 'STATROOM',
        p_game_id: statGameId,
        p_nickname: 'stat',
        p_target_value: 0,
        p_actual_value: actualVal,
        p_score: scoreVal,
        p_error_mm: null,
        p_rank_title: '',
        p_seed: 1,
        p_meta: {},
      }),
    });
  } catch {
    // 네트워크 실패 시 조용히 무시 (게임 플레이 방해 없음)
  }
}

// 각 게임 페이지 진입 시 자동 호출: ① 접속 횟수 + ② 실제 활성 플레이 시간(초) 실시간 추적
let trackerStartedFor = null;

export async function startGameEngagementTracker(gameId) {
  if (!gameId || trackerStartedFor === gameId) return;
  const qs = new URLSearchParams(location.search);
  if (qs.get('rec') === '1' || qs.get('preview') === '1') return;
  trackerStartedFor = gameId;

  const local = readLocalPop();
  const cur = local[gameId] || { visits: 0, playSec: 0 };

  // 탭 세션당 1회 접속 카운트 증가
  const sKey = SESSION_VISIT_PREFIX + gameId;
  const isNewVisit = !sessionStorage.getItem(sKey);
  if (isNewVisit) {
    try { sessionStorage.setItem(sKey, '1'); } catch {}
    cur.visits = (cur.visits || 0) + 1;
    local[gameId] = cur;
    writeLocalPop(local);
  }

  const sb = await getSupabaseConfig();
  if (isNewVisit && sb && !/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
    postMetricRun(sb, `v_${gameId}`, 1, 1, false);
  }

  // 활성 화면 체류 시간(초) 측정 — 20초 누적마다 글로벌 플레이 시간 버킷 전송
  let unsentSec = 0;
  let lastTick = performance.now();

  const timer = setInterval(() => {
    const now = performance.now();
    const dt = Math.min(5, Math.max(0, (now - lastTick) / 1000));
    lastTick = now;
    if (document.visibilityState !== 'visible') return;

    const latest = readLocalPop();
    const entry = latest[gameId] || { visits: 1, playSec: 0 };
    entry.playSec = Math.round((entry.playSec || 0) + dt);
    latest[gameId] = entry;
    writeLocalPop(latest);

    unsentSec += dt;
    if (unsentSec >= 20) {
      unsentSec -= 20;
      if (sb && !/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
        postMetricRun(sb, `m_${gameId}`, 20, 20, false);
      }
    }
  }, 2000);

  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    if (unsentSec >= 8 && sb && !/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
      postMetricRun(sb, `m_${gameId}`, Math.round(unsentSec), Math.round(unsentSec), true);
      unsentSec = 0;
    }
  });
}

async function fetchCount(sb, statGameId) {
  if (!sb) return 0;
  try {
    const res = await fetch(`${sb.url}/rest/v1/rpc/g404_get_percentile`, {
      method: 'POST',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_game_id: statGameId, p_score: -999999 }),
    });
    if (!res.ok) return 0;
    const rows = await res.json();
    if (Array.isArray(rows) && rows[0]) {
      return Number(rows[0].total_count || 0);
    }
  } catch {
    // ignore
  }
  return 0;
}

function formatShortNum(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
  return Math.round(n).toLocaleString();
}

export function formatSocialStatsLabel(soc = {}) {
  const ytViews = Math.max(0, Number(soc.ytViews || 0));
  const igViews = Math.max(0, Number(soc.igViews || 0));
  const likes = Math.max(0, Number(soc.likes || 0));
  if (igViews > 0) {
    return formatSocialViewsLabel(ytViews + igViews);
  }
  if (likes > 0 && ytViews > 0) {
    return `♥${likes.toLocaleString()} · 쇼츠 ${formatShortNum(ytViews)}회`;
  }
  if (ytViews > 0) {
    return `쇼츠 ${formatShortNum(ytViews)}회`;
  }
  if (likes > 0) {
    return `반응 ♥${likes.toLocaleString()}`;
  }
  return '신작 공개';
}

async function fetchSocialOverride(sb, gameId) {
  if (!sb) return null;
  try {
    const res = await fetch(`${sb.url}/rest/v1/rpc/g404_get_run`, {
      method: 'POST',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_id: `soc_${gameId}`.slice(0, 16) }),
    });
    if (!res.ok) return null;
    const row = await res.json();
    if (row && row.id) {
      const def = DEFAULT_SOCIAL_STATS[gameId] || {};
      const ytViews = Math.max(0, Number(row.target_value || 0));
      const igViews = Math.max(0, Number(row.actual_value || 0));
      const likes = Number((row.meta && row.meta.likes) ?? def.likes ?? 0);
      const comments = Number((row.meta && row.meta.comments) ?? def.comments ?? 0);
      const shares = Number((row.meta && row.meta.shares) ?? def.shares ?? 0);
      const merged = { ...def, ytViews, igViews, likes, comments, shares };
      return {
        ...merged,
        label: row.rank_title || formatSocialStatsLabel(merged),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function formatSocialViewsLabel(totalViews) {
  if (totalViews >= 10000) return `릴스·쇼츠 ${(totalViews / 10000).toFixed(1)}만회`;
  if (totalViews >= 1000) return `릴스·쇼츠 ${(totalViews / 1000).toFixed(1)}천회`;
  if (totalViews > 0) return `릴스·쇼츠 ${Math.round(totalViews).toLocaleString()}회`;
  return '신작 공개';
}

export function formatPlayTimeLabel(totalSec) {
  const mins = Math.max(1, Math.round(totalSec / 60));
  if (mins >= 60) {
    const hrs = (mins / 60).toFixed(1);
    return `누적 ${hrs}시간`;
  }
  return `누적 ${mins}분`;
}

// 관리자 모드에서 특정 게임의 릴스·쇼츠 조회수를 저장/갱신할 때 사용 (단일 고정 ID 'soc_<id>' 업데이트용)
export async function saveSocialStatsOverride({ gameId, ytViews, igViews, likes, customLabel = '' }) {
  const sb = await getSupabaseConfig();
  if (!sb) throw new Error('Supabase 설정이 없습니다.');
  const def = DEFAULT_SOCIAL_STATS[gameId] || {};
  const finalYt = Math.max(0, Number(ytViews || 0));
  const finalIg = Math.max(0, Number(igViews || 0));
  const finalLikes = likes != null ? Math.max(0, Number(likes)) : Number(def.likes || 0);
  const finalComments = Number(def.comments || 0);
  const finalShares = Number(def.shares || 0);
  const total = finalYt + finalIg;
  const label = customLabel.trim() || formatSocialStatsLabel({ ytViews: finalYt, igViews: finalIg, likes: finalLikes });
  const runId = `soc_${gameId}`.slice(0, 16);

  // 기존 soc_<id> 행이 있으면 관리자 삭제 후 재삽입할 수 있도록 호출측에서 처리하거나 새 값을 기록
  const res = await fetch(`${sb.url}/rest/v1/rpc/g404_submit_run`, {
    method: 'POST',
    headers: {
      apikey: sb.key,
      Authorization: `Bearer ${sb.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_id: runId,
      p_room_id: 'SOCMETA',
      p_game_id: '__social__',
      p_nickname: gameId.slice(0, 16),
      p_target_value: finalYt,
      p_actual_value: finalIg,
      p_score: total,
      p_error_mm: null,
      p_rank_title: label.slice(0, 40),
      p_seed: 1,
      p_meta: {
        ytViews: finalYt,
        igViews: finalIg,
        likes: finalLikes,
        comments: finalComments,
        shares: finalShares,
      },
    }),
  });
  if (!res.ok) throw new Error('릴스·쇼츠 지표 저장에 실패했습니다.');
  return { ok: true, runId, label, total };
}

// 모든 게임의 3대 잣대(① 접속 · ② 플레이 시간 · ③ 릴스·쇼츠 반응)를 집계하여 종합 인기 점수 계산
export async function computeGamesPopularity(games) {
  const sb = await getSupabaseConfig();
  const local = readLocalPop();

  const rawList = await Promise.all(
    (games || []).map(async (g) => {
      const id = g.id;
      const [visitCnt, runCnt, timeBuckets, socOverride] = await Promise.all([
        fetchCount(sb, `v_${id}`),
        fetchCount(sb, id),
        fetchCount(sb, `m_${id}`),
        fetchSocialOverride(sb, id),
      ]);

      const loc = local[id] || { visits: 0, playSec: 0 };
      const baseSoc = socOverride || DEFAULT_SOCIAL_STATS[id] || {
        ytViews: 0,
        igViews: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      };

      // ① 접속 지수 원시값: 방문 세션 + 완주 판수 가중 + 로컬 방문 보정
      const visitsTotal = Math.max(loc.visits || 0, visitCnt + runCnt * 2);

      // ② 플레이 시간 원시값(초): 20초 버킷 합산 + 완주 1판당 평균 42초 체류 반영 + 로컬 체류시간
      const playSecTotal = Math.max(loc.playSec || 0, timeBuckets * 20 + runCnt * 42 + visitCnt * 18);

      // ③ 릴스 & 쇼츠 반응 원시값: 유튜브·인스타 실제 조회수 + 공식 API 좋아요·댓글·공유 반응 가중
      const socialTotal =
        (baseSoc.ytViews || 0) +
        (baseSoc.igViews || 0) +
        (baseSoc.likes || 0) * 65 +
        (baseSoc.comments || 0) * 120 +
        (baseSoc.shares || 0) * 35;

      return {
        id,
        visitsTotal,
        runCnt,
        playSecTotal,
        socialTotal,
        ytViews: baseSoc.ytViews || 0,
        igViews: baseSoc.igViews || 0,
        likes: baseSoc.likes || 0,
        igLikes: baseSoc.igLikes || 0,
        comments: baseSoc.comments || 0,
        socialLabel: baseSoc.label || formatSocialStatsLabel(baseSoc),
      };
    })
  );

  // 로그 스케일 정규화로 특정 지표 하나가 독식하지 않고 3가지 잣대가 균형 있게 반영되도록 산출!
  const maxLogVisit = Math.max(1, ...rawList.map(x => Math.log10(1 + x.visitsTotal)));
  const maxLogTime = Math.max(1, ...rawList.map(x => Math.log10(1 + x.playSecTotal / 30)));
  const maxLogSoc = Math.max(1, ...rawList.map(x => Math.log10(1 + x.socialTotal)));

  const map = {};
  for (const item of rawList) {
    const visitNorm = (Math.log10(1 + item.visitsTotal) / maxLogVisit) * 100;   // 0~100
    const timeNorm = (Math.log10(1 + item.playSecTotal / 30) / maxLogTime) * 100; // 0~100
    const socNorm = (Math.log10(1 + item.socialTotal) / maxLogSoc) * 100;       // 0~100

    // 3대 잣대 종합 점수 (접속 35% + 플레이 시간 35% + 릴스·쇼츠 반응 30%)
    const popularityScore = Number(
      (visitNorm * 0.35 + timeNorm * 0.35 + socNorm * 0.30).toFixed(1)
    );

    map[item.id] = {
      ...item,
      visitScore: Number(visitNorm.toFixed(1)),
      timeScore: Number(timeNorm.toFixed(1)),
      socialScore: Number(socNorm.toFixed(1)),
      popularityScore,
      visitsLabel: `접속 ${Math.max(1, item.visitsTotal).toLocaleString()}회`,
      playTimeLabel: formatPlayTimeLabel(Math.max(60, item.playSecTotal)),
    };
  }

  return map;
}
