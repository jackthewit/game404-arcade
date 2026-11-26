// 전체 플레이어 글로벌 랭킹 경쟁 + 지인 위치 핀("내가 아는 ○○님의 위치는 여기예요!") + URL 공유 & 결과 카드 PNG 생성기
import { SUPABASE_FALLBACK } from './config.js';
import { pickRandomRetroNickname } from './nicknames.js';

const NICK_KEY = 'fgs.player.nickname';
const BEST_PREFIX = 'fgs.best.';
const LOCAL_BOARD_PREFIX = 'fgs.localboard.v1.';

function isAnonFallback(s) {
  const t = String(s || '').trim();
  return !t || /^익명(\s*(도전자|흰티족|언박서|네일리스트|스냅작가))?$/.test(t);
}

function attachNickRandomizerBtn() {
  if (typeof document === 'undefined') return;
  const input = document.getElementById('res-nick');
  if (!input || !input.parentElement || input.parentElement.querySelector('.nick-rand-btn')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nick-rand-btn';
  btn.title = '80~2000년대 추억의 만화 주인공 이름 랜덤 뽑기';
  btn.textContent = '🎲 랜덤';
  btn.style.cssText = [
    'flex-shrink:0;padding:0 13px;border-radius:12px;',
    'border:1px solid rgba(255,216,74,0.45);background:rgba(255,216,74,0.14);',
    'color:#ffd84a;font-size:13px;font-weight:900;font-family:inherit;',
    'cursor:pointer;white-space:nowrap;transition:transform 0.1s ease,background 0.14s ease;',
  ].join('');
  btn.addEventListener('click', () => {
    const next = rollRandomNickname(input.value);
    input.value = next;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    showToast(`🎲 새 이름: ${next}`);
  });
  input.parentElement.appendChild(btn);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachNickRandomizerBtn, { once: true });
  } else {
    setTimeout(attachNickRandomizerBtn, 0);
  }
}

let sbConfigPromise = null;

export function getSupabaseConfig() {
  if (!sbConfigPromise) {
    sbConfigPromise = (async () => {
      if (window.__FGS_SUPABASE__ && window.__FGS_SUPABASE__.url && window.__FGS_SUPABASE__.anonKey) {
        return {
          url: window.__FGS_SUPABASE__.url.replace(/\/$/, ''),
          key: window.__FGS_SUPABASE__.anonKey,
        };
      }
      if (!/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
        try {
          const res = await fetch('/api/config', { cache: 'no-store' });
          if (res.ok) {
            const j = await res.json();
            if (j.supabaseUrl && j.supabaseAnonKey) {
              return { url: j.supabaseUrl.replace(/\/$/, ''), key: j.supabaseAnonKey };
            }
          }
        } catch {
          // fallback below
        }
      }
      if (SUPABASE_FALLBACK && SUPABASE_FALLBACK.url && SUPABASE_FALLBACK.key) {
        return {
          url: SUPABASE_FALLBACK.url.replace(/\/$/, ''),
          key: SUPABASE_FALLBACK.key,
        };
      }
      return null;
    })();
  }
  return sbConfigPromise;
}

export function rollRandomNickname(currentName = '') {
  const picked = pickRandomRetroNickname(String(currentName || '').trim());
  try { localStorage.setItem(NICK_KEY, picked); } catch {}
  return picked;
}

export function getSavedNickname() {
  attachNickRandomizerBtn();
  let cur = '';
  try { cur = localStorage.getItem(NICK_KEY) || ''; } catch {}
  if (isAnonFallback(cur)) {
    cur = rollRandomNickname('');
  }
  return cur;
}

export function saveNickname(name) {
  const clean = String(name || '').trim().slice(0, 16);
  if (isAnonFallback(clean)) {
    const existing = (() => {
      try { return localStorage.getItem(NICK_KEY) || ''; } catch { return ''; }
    })();
    return isAnonFallback(existing) ? rollRandomNickname('') : existing;
  }
  try { localStorage.setItem(NICK_KEY, clean); } catch {}
  return clean;
}

export function getBestRecord(gameId) {
  try {
    return JSON.parse(localStorage.getItem(BEST_PREFIX + gameId) || 'null');
  } catch {
    return null;
  }
}

export function updateBestRecord(gameId, run, lowerErrorIsBetter = false) {
  const prev = getBestRecord(gameId);
  let better = !prev;
  if (prev) {
    if (lowerErrorIsBetter && run.errorMm != null && prev.errorMm != null) {
      better = run.errorMm < prev.errorMm;
    } else {
      better = (run.score || 0) > (prev.score || 0);
    }
  }
  if (better) {
    localStorage.setItem(BEST_PREFIX + gameId, JSON.stringify({
      score: run.score,
      errorMm: run.errorMm,
      actualValue: run.actualValue,
      targetValue: run.targetValue,
      rankTitle: run.rankTitle,
      at: Date.now(),
    }));
  }
  return better;
}

export function encodePayload(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePayload(str) {
  try {
    const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function makeShortId(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

// URL 쿼리(?ref=코드 또는 ?ref=인코딩, 구버전 ?c=, ?d= 모두 호환)에서 "내가 아는 지인(보낸 사람)" 읽기
export async function loadIncomingChallenge(expectedGameId) {
  const qs = new URLSearchParams(location.search);
  const ref = qs.get('ref') || '';
  const code = qs.get('c') || (ref && ref.length <= 16 ? ref : '');
  const rawD = qs.get('d') || (ref && ref.length > 16 ? ref : '');

  if (code) {
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
          body: JSON.stringify({ p_id: code }),
        });
        if (res.ok) {
          const r = await res.json();
          if (r && r.id && (!expectedGameId || r.game_id === expectedGameId)) {
            return {
              source: 'supabase',
              id: r.id,
              roomId: r.room_id,
              gameId: r.game_id,
              nickname: r.nickname,
              targetValue: Number(r.target_value),
              actualValue: Number(r.actual_value),
              score: Number(r.score),
              errorMm: r.error_mm != null ? Number(r.error_mm) : null,
              rankTitle: r.rank_title,
              seed: Number(r.seed) || 1,
              meta: r.meta || {},
            };
          }
        }
      } catch {
        // fallback below
      }
    }
  }

  if (rawD) {
    const p = decodePayload(rawD);
    if (p && (!expectedGameId || p.g === expectedGameId)) {
      return {
        source: 'url',
        id: p.id || 'REF_' + rawD.slice(0, 6),
        roomId: p.rm || p.id || null,
        gameId: p.g,
        nickname: p.n || '지인',
        targetValue: p.t != null ? Number(p.t) : 0,
        actualValue: p.v != null ? Number(p.v) : 0,
        score: p.sc != null ? Number(p.sc) : 0,
        errorMm: p.e != null ? Number(p.e) : null,
        rankTitle: p.r || '',
        seed: p.s != null ? Number(p.s) : 1,
        meta: p.m || {},
      };
    }
  }
  return null;
}

export function getDefaultSeedsForGame(gameId) {
  const table = {
    snap: [
      { id: 'SEED_SN1', nickname: '유체리', score: 920000, error_mm: null, actual_value: 7, target_value: 5, rank_title: '📸 구도 천재 월드투어 스냅 사진가' },
      { id: 'SEED_SN2', nickname: '코난', score: 685000, error_mm: null, actual_value: 6, target_value: 4, rank_title: '✨ 감성 충만 프로 스냅 알바생' },
      { id: 'SEED_SN3', nickname: '강백호', score: 460000, error_mm: null, actual_value: 4, target_value: 3, rank_title: '📷 열정 가득 수습 포토그래퍼' },
      { id: 'SEED_SN4', nickname: '신짱구', score: 245000, error_mm: null, actual_value: 3, target_value: 1, rank_title: '🦆 오리만 찍은 동네 사진사' },
      { id: 'SEED_SN5', nickname: '보노보노', score: 110000, error_mm: null, actual_value: 2, target_value: 0, rank_title: '😅 흔들린 손가락 알바생' },
    ],
    jjamppong: [
      { id: 'SEED_JP1', nickname: '손오공', score: 31.4, error_mm: null, actual_value: 28, target_value: 0, rank_title: '👕 세탁소 단골 아슬아슬 생존자' },
      { id: 'SEED_JP2', nickname: '비룡', score: 26.8, error_mm: null, actual_value: 24, target_value: 0, rank_title: '🍜 중화요리 회피 달인' },
      { id: 'SEED_JP3', nickname: '나루토', score: 21.2, error_mm: null, actual_value: 19, target_value: 0, rank_title: '🥢 국물 방어 중급 도전자' },
      { id: 'SEED_JP4', nickname: '도라에몽', score: 15.6, error_mm: null, actual_value: 14, target_value: 0, rank_title: '💦 앞치마 시급한 흰티족' },
      { id: 'SEED_JP5', nickname: '맹구', score: 9.4, error_mm: null, actual_value: 8, target_value: 0, rank_title: '🔴 빨간 땡땡이 티셔츠 당첨' },
    ],
    boxcut: [
      { id: 'SEED_BX1', nickname: '조로', score: 10840, error_mm: 7.2, actual_value: 24, target_value: 5, rank_title: '👑 전설의 칼각 언박싱 신(神)' },
      { id: 'SEED_BX2', nickname: '이누야샤', score: 8420, error_mm: 9.5, actual_value: 19, target_value: 4, rank_title: '📦 현관 택배 수호 마스터' },
      { id: 'SEED_BX3', nickname: '세라', score: 6150, error_mm: 12.1, actual_value: 15, target_value: 2, rank_title: '🔪 깔끔한 직선 커터 장인' },
      { id: 'SEED_BX4', nickname: '최자두', score: 3890, error_mm: 16.4, actual_value: 10, target_value: 1, rank_title: '🏃 바쁜 손놀림 언박서' },
      { id: 'SEED_BX5', nickname: '노진구', score: 1920, error_mm: 22.0, actual_value: 6, target_value: 0, rank_title: '😅 택배 산에 파묻힌 집주인' },
    ],
    cake: [
      { id: 'CKSEED01', nickname: '쇼콜라', score: 485, error_mm: null, actual_value: 5, target_value: 5, rank_title: '👑 전설의 쇼콜라티에' },
      { id: 'CKSEED02', nickname: '유체리', score: 452, error_mm: null, actual_value: 5, target_value: 5, rank_title: '🎂 수제 케이크 마스터' },
      { id: 'CKSEED03', nickname: '도레미', score: 398, error_mm: null, actual_value: 4, target_value: 5, rank_title: '🍫 청담동 수석 파티시에' },
      { id: 'CKSEED04', nickname: '바닐라', score: 345, error_mm: null, actual_value: 4, target_value: 5, rank_title: '🍫 청담동 수석 파티시에' },
      { id: 'CKSEED05', nickname: '감딸기', score: 276, error_mm: null, actual_value: 3, target_value: 5, rank_title: '✨ 동네 인기 케이크집 사장님' },
    ],
    haircut: [
      { id: 'SEED_HC1', nickname: '서태웅', score: 98.4, error_mm: 0.2, actual_value: 1.02, target_value: 1.0, rank_title: '🏆 전설의 미용사' },
      { id: 'SEED_HC2', nickname: '유미란', score: 96.5, error_mm: 0.5, actual_value: 0.95, target_value: 1.0, rank_title: '✨ 청담동 수석 원장님' },
      { id: 'SEED_HC3', nickname: '하인성', score: 93.2, error_mm: 0.9, actual_value: 1.09, target_value: 1.0, rank_title: '✂️ 청담동 수석 원장님' },
      { id: 'SEED_HC4', nickname: '오영심', score: 86.5, error_mm: 1.8, actual_value: 1.18, target_value: 1.0, rank_title: '💈 동네 단골 미용사' },
      { id: 'SEED_HC5', nickname: '고길동', score: 74.5, error_mm: 3.4, actual_value: 1.34, target_value: 1.0, rank_title: '😅 아차차 견습생' },
    ],
    toilet: [
      { id: 'SEED_TL1', nickname: '루피', score: 142.8, error_mm: null, actual_value: 142.8, target_value: 0, rank_title: '👑 황금 미라 킹' },
      { id: 'SEED_TL2', nickname: '케로로', score: 86.4, error_mm: null, actual_value: 86.4, target_value: 0, rank_title: '🧻 전설의 두루마리' },
      { id: 'SEED_TL3', nickname: '호빵맨', score: 45.2, error_mm: null, actual_value: 45.2, target_value: 0, rank_title: '🩹 붕대 미라 장인' },
      { id: 'SEED_TL4', nickname: '도우너', score: 22.5, error_mm: null, actual_value: 22.5, target_value: 0, rank_title: '🌀 팔뚝 두꺼워짐' },
      { id: 'SEED_TL5', nickname: '포로리', score: 8.6, error_mm: null, actual_value: 8.6, target_value: 0, rank_title: '😅 알뜰 휴지러' },
    ],
    nail: [
      { id: 'SEED_NL1', nickname: '네티', score: 134.6, error_mm: 0.0, actual_value: 44.2, target_value: 3, rank_title: '👑 청담동 전설의 마스터 원장님' },
      { id: 'SEED_NL2', nickname: '채아무', score: 121.4, error_mm: 0.08, actual_value: 39.5, target_value: 2, rank_title: '💅 무결점 스피드 네일 마스터' },
      { id: 'SEED_NL3', nickname: '진이슬', score: 108.2, error_mm: 0.15, actual_value: 22.8, target_value: 1, rank_title: '💅 무결점 스피드 네일 마스터' },
      { id: 'SEED_NL4', nickname: '한유리', score: 92.5, error_mm: 0.48, actual_value: 58.0, target_value: 2, rank_title: '✨ 꼼꼼한 살롱 수석 실장님' },
      { id: 'SEED_NL5', nickname: '또치', score: 62.0, error_mm: 1.45, actual_value: 74.5, target_value: 1, rank_title: '🩸 큐티클 추상화 예술가' },
    ],
    film: [
      { id: 'SEED_FL1', nickname: '장한솔', score: 98, error_mm: 0.14, actual_value: 0, target_value: 0, rank_title: '👑 강화필름의 전설' },
      { id: 'SEED_FL2', nickname: '괴도키드', score: 93, error_mm: 0.38, actual_value: 0, target_value: 0, rank_title: '✨ 대리점 1타 장인' },
      { id: 'SEED_FL3', nickname: '홍장미', score: 85, error_mm: 0.72, actual_value: 0, target_value: 0, rank_title: '✨ 대리점 1타 장인' },
      { id: 'SEED_FL4', nickname: '마이콜', score: 72, error_mm: 1.15, actual_value: 1, target_value: 0, rank_title: '🫧 한 톨 타협가' },
      { id: 'SEED_FL5', nickname: '둘리', score: 51, error_mm: 1.85, actual_value: 2, target_value: 0, rank_title: '💥 굳어버린 기포 농장' },
    ],
  };
  if (table[gameId]) return table[gameId];
  const tag = String(gameId || 'gm').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'GM';
  return [
    { id: `SD_${tag}_1`, nickname: '강백호', score: 950, error_mm: null, actual_value: 10, target_value: 0, rank_title: '👑 전설의 마스터' },
    { id: `SD_${tag}_2`, nickname: '유체리', score: 820, error_mm: null, actual_value: 8, target_value: 0, rank_title: '✨ 수석 장인' },
    { id: `SD_${tag}_3`, nickname: '코난', score: 690, error_mm: null, actual_value: 6, target_value: 0, rank_title: '🔥 숙련 도전자' },
    { id: `SD_${tag}_4`, nickname: '신짱구', score: 510, error_mm: null, actual_value: 4, target_value: 0, rank_title: '🎮 동네 유망주' },
    { id: `SD_${tag}_5`, nickname: '보노보노', score: 320, error_mm: null, actual_value: 2, target_value: 0, rank_title: '🌱 첫걸음 도전자' },
  ];
}

const seededGamesInSession = new Set();

export async function ensureGameSeededIfEmpty(sb, gameId) {
  if (!sb || !gameId || seededGamesInSession.has(gameId)) return;
  seededGamesInSession.add(gameId);
  const seeds = getDefaultSeedsForGame(gameId);
  await Promise.all(
    seeds.map((s) =>
      fetch(`${sb.url}/rest/v1/rpc/g404_submit_run`, {
        method: 'POST',
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_id: s.id.slice(0, 16),
          p_room_id: 'AUTOSEED',
          p_game_id: gameId,
          p_nickname: s.nickname,
          p_target_value: s.target_value ?? 0,
          p_actual_value: s.actual_value ?? 0,
          p_score: s.score,
          p_error_mm: s.error_mm,
          p_rank_title: s.rank_title || '',
          p_seed: 1,
          p_meta: { seeded: true },
        }),
      }).catch(() => {})
    )
  );
}

// Supabase 미연결(로컬 테스트) 시에도 전체 랭킹 사다리 + 지인 위치 핀 UX를 체험할 수 있는 기준 풀
function buildLocalGlobalLadder(gameId, myEntry, refEntry) {
  const key = LOCAL_BOARD_PREFIX + gameId;
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    stored = [];
  }

  const seeds = getDefaultSeedsForGame(gameId);

  // 내 기록 누적 저장(최근 30개)
  const nextStored = [...stored.filter(x => x.id !== myEntry.id), myEntry].slice(-30);
  localStorage.setItem(key, JSON.stringify(nextStored));

  const map = new Map();
  for (const s of seeds) map.set(s.id, s);
  for (const s of nextStored) map.set(s.id, s);
  if (refEntry) map.set(refEntry.id, refEntry);
  map.set(myEntry.id, myEntry);

  const all = [...map.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ea = a.error_mm != null ? a.error_mm : 9999;
    const eb = b.error_mm != null ? b.error_mm : 9999;
    return ea - eb;
  });

  const total = all.length;
  const ranked = all.map((item, idx) => ({
    ...item,
    rank_no: idx + 1,
    total_count: total,
    is_me: item.id === myEntry.id,
    is_ref: Boolean(refEntry && item.id === refEntry.id),
  }));

  const myRow = ranked.find(r => r.is_me);
  const refRow = ranked.find(r => r.is_ref);
  const filtered = ranked.filter(r =>
    r.rank_no <= 4 ||
    r.is_me ||
    r.is_ref ||
    (myRow && Math.abs(r.rank_no - myRow.rank_no) <= 1) ||
    (refRow && Math.abs(r.rank_no - refRow.rank_no) <= 1)
  );

  return {
    ladder: filtered,
    myRank: myRow ? myRow.rank_no : total,
    refRank: refRow ? refRow.rank_no : null,
    totalCount: total,
    topPercent: Number(Math.max(0.1, ((myRow ? myRow.rank_no : total) / Math.max(1, total)) * 100).toFixed(1)),
  };
}

// 같은 판에서 [URL 공유하기]를 여러 번 눌러도 순위가 복제되지 않도록 직전 저장 세션 캐시
let lastSavedSession = null;

// 스코어 서버 저장 + 전체 글로벌 랭킹 사다리 조회 + 내 위치 핀이 담긴 공유 URL(?ref=...) 생성
export async function saveResultAndBuildShare(run, incomingRef = null) {
  const nickname = saveNickname(run.nickname || getSavedNickname() || '익명 도전자');
  const tVal = run.targetValue != null ? Number(Number(run.targetValue).toFixed(2)) : 0;
  const vVal = run.actualValue != null ? Number(Number(run.actualValue).toFixed(2)) : 0;
  const scVal = Number(Number(run.score || 0).toFixed(1));
  const eVal = run.errorMm != null ? Number(Number(run.errorMm).toFixed(2)) : null;
  const seedVal = run.seed || 1;

  const roundSig = JSON.stringify([run.gameId, tVal, vVal, scVal, eVal, seedVal]);

  // 이미 방금 저장한 같은 라운드인 경우: 새 ID를 만들지 않고 기존 ID 재사용! (중복 등록 원천 차단)
  if (lastSavedSession && lastSavedSession.sig === roundSig) {
    if (lastSavedSession.result.nickname === nickname) {
      return lastSavedSession.result;
    }
    // 닉네임만 새로 바꾼 경우: 기존 ID 그대로 유지하여 중복 행 생성 방지
    const prev = lastSavedSession.result;
    const sb = await getSupabaseConfig();
    if (sb && prev.savedToSupabase) {
      try {
        await fetch(`${sb.url}/rest/v1/rpc/g404_submit_run`, {
          method: 'POST',
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_id: prev.id,
            p_room_id: prev.roomId,
            p_game_id: run.gameId,
            p_nickname: nickname,
            p_target_value: tVal,
            p_actual_value: vVal,
            p_score: scVal,
            p_error_mm: eVal,
            p_rank_title: run.rankTitle || '',
            p_seed: seedVal,
            p_meta: run.meta || {},
          }),
        });
      } catch {
        // ignore
      }
    }
    const updatedLadder = (prev.ladder || []).map(row => (
      row.is_me ? { ...row, nickname } : row
    ));
    const updatedResult = {
      ...prev,
      nickname,
      ladder: updatedLadder,
    };
    lastSavedSession = { sig: roundSig, result: updatedResult };
    return updatedResult;
  }

  const id = run.id || makeShortId(6);
  const roomId = (incomingRef && incomingRef.roomId) ? incomingRef.roomId : id;

  const compact = {
    id,
    g: run.gameId,
    n: nickname,
    t: tVal,
    v: vVal,
    sc: scVal,
    e: eVal,
    r: run.rankTitle || '',
    s: seedVal,
    m: run.meta || {},
  };

  const sb = await getSupabaseConfig();
  let savedToSupabase = false;
  let ladder = [];
  let myRank = null;
  let refRank = null;
  let totalCount = 0;
  let topPercent = null;

  if (sb) {
    try {
      const ins = await fetch(`${sb.url}/rest/v1/rpc/g404_submit_run`, {
        method: 'POST',
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_id: id,
          p_room_id: roomId,
          p_game_id: run.gameId,
          p_nickname: nickname,
          p_target_value: compact.t,
          p_actual_value: compact.v,
          p_score: compact.sc,
          p_error_mm: compact.e,
          p_rank_title: compact.r,
          p_seed: compact.s,
          p_meta: compact.m,
        }),
      });
      if (ins.ok) {
        const j = await ins.json().catch(() => null);
        if (j && j.ok) savedToSupabase = true;
      }

      // 전체 글로벌 랭킹 사다리 + 내가 아는 지인(p_ref_id) 위치 함께 조회!
      const fetchLadderRows = async () => {
        const ladRes = await fetch(`${sb.url}/rest/v1/rpc/g404_get_ladder`, {
          method: 'POST',
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_game_id: run.gameId,
            p_my_id: id,
            p_ref_id: incomingRef && incomingRef.source === 'supabase' ? incomingRef.id : null,
          }),
        });
        return ladRes.ok ? ladRes.json() : [];
      };

      let rows = await fetchLadderRows();
      if (Array.isArray(rows) && (rows.length === 0 || Number(rows[0].total_count || 0) < 5)) {
        await ensureGameSeededIfEmpty(sb, run.gameId);
        rows = await fetchLadderRows();
      }
      if (Array.isArray(rows) && rows.length > 0) {
        ladder = rows.map(r => ({ ...r, rank_no: Number(r.rank_no), total_count: Number(r.total_count), score: Number(r.score) }));
        totalCount = ladder[0].total_count;
        const me = ladder.find(r => r.is_me);
        const ref = ladder.find(r => r.is_ref);
        myRank = me ? me.rank_no : null;
        refRank = ref ? ref.rank_no : null;
        if (myRank && totalCount) {
          topPercent = Number(Math.max(0.1, (myRank / totalCount) * 100).toFixed(1));
        }
      }
    } catch {
      // fallback below
    }
  }

  // Supabase 미연결 시 로컬 글로벌 사다리 폴백 (지인 위치 핀 그대로 체험 가능!)
  if (ladder.length === 0) {
    const myEntry = {
      id,
      nickname,
      score: compact.sc,
      error_mm: compact.e,
      actual_value: compact.v,
      target_value: compact.t,
      rank_title: compact.r,
    };
    const refEntry = incomingRef ? {
      id: incomingRef.id || 'REF_USER',
      nickname: incomingRef.nickname || '지인',
      score: Number(incomingRef.score || 0),
      error_mm: incomingRef.errorMm != null ? Number(incomingRef.errorMm) : null,
      actual_value: Number(incomingRef.actualValue || 0),
      target_value: Number(incomingRef.targetValue || 0),
      rank_title: incomingRef.rankTitle || '',
    } : null;
    const local = buildLocalGlobalLadder(run.gameId, myEntry, refEntry);
    ladder = local.ladder;
    myRank = local.myRank;
    refRank = local.refRank;
    totalCount = local.totalCount;
    topPercent = local.topPercent;
  }

  const origin = location.origin;
  const isVercel = !/^(127\.0\.0\.1|localhost)/.test(location.hostname);
  let shareUrl;
  if (savedToSupabase) {
    shareUrl = isVercel
      ? `${origin}/s/${run.gameId}?ref=${encodeURIComponent(id)}`
      : `${origin}/${run.gameId}/?ref=${encodeURIComponent(id)}`;
  } else {
    const encoded = encodePayload(compact);
    shareUrl = isVercel
      ? `${origin}/s/${run.gameId}?ref=${encoded}`
      : `${origin}/${run.gameId}/?ref=${encoded}`;
  }

  const finalResult = {
    id,
    roomId,
    nickname,
    shareUrl,
    savedToSupabase,
    ladder,
    myRank,
    refRank,
    totalCount,
    topPercent,
  };
  lastSavedSession = { sig: roundSig, result: finalResult };
  return finalResult;
}

// 전체 글로벌 랭킹 + "내가 아는 ○○님의 위치는 여기예요!" HTML 렌더링
export function renderGlobalLadderHTML(saved, formatMetric) {
  if (!saved || !saved.ladder || saved.ladder.length === 0) return '';
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const modeLabel = saved.savedToSupabase
    ? `전체 ${saved.totalCount.toLocaleString()}명 · 상위 ${saved.topPercent}%`
    : `로컬 랭킹 · 상위 ${saved.topPercent}% (서버 연결 시 전체 통합)`;

  const me = saved.ladder.find(r => r.is_me);
  const ref = saved.ladder.find(r => r.is_ref);

  let gapNote = '';
  if (me && ref && !ref.is_me) {
    const rankDiff = me.rank_no - ref.rank_no;
    if (rankDiff < 0) {
      gapNote = `<div style="font-size:12.5px;font-weight:900;color:#4ade80;text-align:center;padding:6px 8px;border-radius:10px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.35)">🎉 내가 아는 <b>${esc(ref.nickname)}님(${ref.rank_no}위)</b>보다 <b>${Math.abs(rankDiff)}계단 위</b>에 있어요!</div>`;
    } else if (rankDiff > 0) {
      gapNote = `<div style="font-size:12.5px;font-weight:900;color:#ffd84a;text-align:center;padding:6px 8px;border-radius:10px;background:rgba(255,216,74,0.12);border:1px solid rgba(255,216,74,0.35)">🔥 내가 아는 <b>${esc(ref.nickname)}님(${ref.rank_no}위)</b>까지 <b>${rankDiff}계단</b> 남았어요!</div>`;
    } else {
      gapNote = `<div style="font-size:12.5px;font-weight:900;color:#60a5fa;text-align:center;padding:6px 8px;border-radius:10px;background:rgba(96,165,250,0.12)">🤝 내가 아는 <b>${esc(ref.nickname)}님</b>과 나란히 같은 순위권!</div>`;
    }
  }

  let rowsHtml = '';
  let prevRank = 0;
  for (const r of saved.ladder) {
    if (prevRank > 0 && r.rank_no - prevRank > 1) {
      rowsHtml += `<div style="text-align:center;font-size:11px;color:#7e7498;letter-spacing:3px;padding:1px 0">···</div>`;
    }
    prevRank = r.rank_no;

    let rowStyle = '';
    let badge = '';
    if (r.is_me) {
      rowStyle = 'background:rgba(255,216,74,0.18);border:1px solid rgba(255,216,74,0.65);';
      badge = '<span style="margin-left:5px;padding:2px 6px;border-radius:6px;background:#ffd84a;color:#1e1400;font-size:10px;font-weight:900">나</span>';
    } else if (r.is_ref) {
      rowStyle = 'background:rgba(96,165,250,0.20);border:1px solid rgba(96,165,250,0.75);';
      badge = '<span style="margin-left:5px;padding:2px 6px;border-radius:6px;background:#3b82f6;color:#fff;font-size:10px;font-weight:900">내가 아는 지인!</span>';
    }

    const medal = r.rank_no === 1 ? '🥇' : r.rank_no === 2 ? '🥈' : r.rank_no === 3 ? '🥉' : `#${r.rank_no}`;
    rowsHtml += `
      <div class="lb-item" style="${rowStyle}">
        <span style="display:flex;align-items:center;min-width:0;overflow:hidden">
          <b style="min-width:30px">${medal}</b>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.nickname)}</span>
          ${badge}
        </span>
        <span style="font-variant-numeric:tabular-nums;font-weight:800;flex-shrink:0;margin-left:8px">${formatMetric(r)}</span>
      </div>
    `;
  }

  return `
    <div class="lb-box" style="gap:7px">
      <div class="lb-head"><span>🏆 전체 플레이어 랭킹</span><span>${modeLabel}</span></div>
      ${gapNote}
      ${rowsHtml}
    </div>
  `;
}

export function showToast(msg) {
  let el = document.getElementById('fgs-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fgs-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2400);
}

export async function shareChallengeLink({ title, text, url }) {
  const fullText = `${text}\n${url}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') return false;
    }
  }
  try {
    await navigator.clipboard.writeText(fullText);
    showToast('🔗 내 랭킹 위치가 담긴 공유 링크가 복사되었어요!');
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = fullText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('🔗 공유 링크가 복사되었어요!');
    return true;
  }
}

export function downloadResultCard({
  gameTitle,
  emoji,
  rankTitle,
  headline,
  subline,
  stats = [],
  rivalCompare = null,
  extraCanvas = null,
}) {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d');

  const bg = g.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, '#1a142d');
  bg.addColorStop(0.55, '#120e21');
  bg.addColorStop(1, '#221538');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1080, 1350);

  g.fillStyle = 'rgba(255,216,74,0.16)';
  roundRect(g, 310, 62, 460, 56, 28);
  g.fill();
  g.strokeStyle = 'rgba(255,216,74,0.5)';
  g.lineWidth = 2;
  g.stroke();

  g.fillStyle = '#ffd84a';
  g.font = '800 28px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('이게뭔겜? 404 아케이드', 540, 90);

  g.fillStyle = '#ffffff';
  g.font = '900 56px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.fillText(`${emoji} ${gameTitle}`, 540, 190);

  g.fillStyle = '#ffd84a';
  roundRect(g, 240, 244, 600, 74, 37);
  g.fill();
  g.fillStyle = '#1d1400';
  g.font = '900 38px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.fillText(rankTitle, 540, 282);

  g.fillStyle = '#ffffff';
  g.font = '900 94px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.fillText(headline, 540, 415);

  g.fillStyle = '#c5bdd9';
  g.font = '700 34px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.fillText(subline, 540, 492);

  let nextY = 550;
  if (stats.length) {
    const bw = 290, gap = 24;
    const startX = (1080 - (bw * stats.length + gap * (stats.length - 1))) / 2;
    stats.forEach((st, i) => {
      const x = startX + i * (bw + gap);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(g, x, nextY, bw, 148, 24);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.12)';
      g.lineWidth = 2;
      g.stroke();

      g.fillStyle = '#b4abc9';
      g.font = '700 26px "Pretendard","Apple SD Gothic Neo",sans-serif';
      g.fillText(st.label, x + bw / 2, nextY + 46);

      g.fillStyle = st.color || '#ffffff';
      g.font = '900 44px "Pretendard","Apple SD Gothic Neo",sans-serif';
      g.fillText(st.value, x + bw / 2, nextY + 104);
    });
    nextY += 188;
  }

  if (extraCanvas) {
    const targetW = 760;
    const targetH = Math.min(310, (extraCanvas.height / extraCanvas.width) * targetW);
    g.save();
    roundRect(g, (1080 - targetW) / 2, nextY, targetW, targetH, 24);
    g.clip();
    g.drawImage(extraCanvas, (1080 - targetW) / 2, nextY, targetW, targetH);
    g.restore();
    nextY += targetH + 34;
  }

  if (rivalCompare) {
    g.fillStyle = 'rgba(124,92,255,0.18)';
    roundRect(g, 90, nextY, 900, 175, 28);
    g.fill();
    g.strokeStyle = 'rgba(255,216,74,0.45)';
    g.lineWidth = 3;
    g.stroke();

    g.fillStyle = '#ffd84a';
    g.font = '900 40px "Pretendard","Apple SD Gothic Neo",sans-serif';
    g.fillText(rivalCompare.verdict, 540, nextY + 56);

    g.fillStyle = '#ffffff';
    g.font = '800 32px "Pretendard","Apple SD Gothic Neo",sans-serif';
    g.fillText(`${rivalCompare.myText}  ·  ${rivalCompare.rivalText}`, 540, nextY + 124);
  }

  g.fillStyle = '#8e84a8';
  g.font = '700 28px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.fillText('전체 랭킹에서 내 위치를 확인하고 기록을 깨 보세요!', 540, 1278);

  const a = document.createElement('a');
  a.download = `game404_${gameTitle.replace(/\s+/g, '')}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
  showToast('📸 결과 카드 이미지가 저장되었어요!');
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

// ── 공용 결과 카드 UX: 바깥 클릭 시 게임 결과 화면 다시 보기(캡처용) + 하단 "결과 카드 보기" + 404 아케이드 메인 이동 ──
function initResultModalUX() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('result-modal');
  if (!modal || modal.dataset.uxBound) return;
  modal.dataset.uxBound = '1';

  const card = modal.querySelector('.modal-card');
  if (card && !card.querySelector('.result-backdrop-tip')) {
    const tip = document.createElement('div');
    tip.className = 'result-backdrop-tip';
    tip.textContent = '💡 바깥 화면을 누르면 결과 장면을 다시 보고 캡처할 수 있어요';
    card.appendChild(tip);
  }

  // 하단 "결과 카드 보기" 플로팅 바 생성
  const bar = document.createElement('div');
  bar.id = 'reopen-result-bar';
  bar.className = 'reopen-result-bar hidden';
  bar.innerHTML = `
    <button type="button" class="reopen-result-btn" id="btn-reopen-result">📊 결과 카드 보기</button>
    <a href="/" class="reopen-home-link">🏠 404 메인</a>
  `;
  document.body.appendChild(bar);

  const btnReopen = bar.querySelector('#btn-reopen-result');

  function setPeeking(on) {
    if (on) {
      modal.classList.add('hidden');
      document.body.classList.add('result-peeking');
      bar.classList.remove('hidden');
    } else {
      document.body.classList.remove('result-peeking');
      bar.classList.add('hidden');
    }
  }

  // 결과 카드 바깥(어두운 배경) 클릭 시 모달 접고 결과 화면 감상/캡처 모드 진입
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      setPeeking(true);
    }
  });

  // 하단 "결과 카드 보기" 클릭 시 결과 카드 다시 표시
  btnReopen.addEventListener('click', () => {
    setPeeking(false);
    modal.classList.remove('hidden');
  });

  // 재도전·시작 버튼 클릭 시 캡처 모드 자동 종료
  ['btn-retry', 'btn-retry-same', 'btn-retry-rand', 'btn-start'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', () => setPeeking(false));
  });

  // 결과 모달이 외부 코드로 다시 열릴 때 플로팅 바 자동 숨김
  const obs = new MutationObserver(() => {
    if (!modal.classList.contains('hidden')) {
      document.body.classList.remove('result-peeking');
      bar.classList.add('hidden');
    }
  });
  obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initResultModalUX);
  } else {
    initResultModalUX();
  }
}
