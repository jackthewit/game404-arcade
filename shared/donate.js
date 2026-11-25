// 이게뭔겜? 404 아케이드 — 카카오페이 송금 QR & 링크 심플 후원 모듈
import { getSupabaseConfig } from './challenge.js';

const DONATE_CFG_ID = 'cfg_donate';
const DEFAULT_KAKAO_LINK = 'https://qr.kakaopay.com/FSGGbIYYt';
const DEFAULT_QR_ASSET = new URL('../assets/kakaopay-qr.png', import.meta.url).href;

export const DEFAULT_DONATE_CONFIG = {
  kakaoLink: DEFAULT_KAKAO_LINK,
  qrImageUrl: '',
  headline: '재밌게 즐기셨나요? 제작자에게 커피 한 잔 응원하기 ☕',
  subtext: '카메라로 QR 코드를 찍거나 아래 버튼을 누르면 카카오페이로 연결됩니다.',
};

let cachedConfig = null;
let styleInjected = false;

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function injectDonateStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const st = document.createElement('style');
  st.textContent = `
    .kakao-donate-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 999px;
      background: #FEE500;
      color: #191919;
      border: 1.5px solid #facc15;
      font-size: 13.5px;
      font-weight: 900;
      cursor: pointer;
      text-decoration: none;
      box-shadow: 0 6px 18px rgba(254, 229, 0, 0.26);
      transition: transform 0.14s ease, filter 0.14s ease, box-shadow 0.14s ease;
    }
    .kakao-donate-btn:hover {
      transform: translateY(-2px);
      filter: brightness(1.04);
      box-shadow: 0 10px 24px rgba(254, 229, 0, 0.36);
    }
    .kakao-donate-btn:active {
      transform: scale(0.97);
    }

    .don-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9500;
      background: rgba(10, 8, 18, 0.82);
      backdrop-filter: blur(9px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
    }

    .don-card {
      width: min(92vw, 380px);
      background: #1b1629;
      border: 1.5px solid rgba(254, 229, 0, 0.45);
      border-radius: 26px;
      padding: 26px 22px 22px;
      color: #f8f5ff;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      position: relative;
      text-align: center;
    }
    .don-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 32px;
      height: 32px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.08);
      color: #e2dcf5;
      font-size: 16px;
      font-weight: 900;
      cursor: pointer;
    }
    .don-kicker {
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(254, 229, 0, 0.16);
      border: 1px solid rgba(254, 229, 0, 0.48);
      color: #FEE500;
      font-size: 11.5px;
      font-weight: 900;
    }
    .don-title {
      font-size: 18.5px;
      font-weight: 900;
      line-height: 1.38;
      word-break: keep-all;
      padding: 0 12px;
    }
    .don-sub {
      font-size: 12.5px;
      color: #bdb5d6;
      line-height: 1.5;
      word-break: keep-all;
      margin: -4px 0 2px;
    }

    .don-qr-box {
      width: 212px;
      height: 212px;
      border-radius: 22px;
      background: #ffffff;
      padding: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
      overflow: hidden;
    }
    .don-qr-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .don-pay-link-btn {
      width: 100%;
      margin-top: 4px;
      padding: 14px 18px;
      border-radius: 15px;
      border: none;
      background: #FEE500;
      color: #191919;
      font-size: 15px;
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 8px 22px rgba(254, 229, 0, 0.28);
      transition: filter 0.12s ease, transform 0.1s ease;
    }
    .don-pay-link-btn:hover {
      filter: brightness(1.04);
      transform: translateY(-1px);
    }
    .don-pay-link-btn:active {
      transform: scale(0.98);
    }
  `;
  document.head.appendChild(st);
}

export async function loadDonateConfig(forceRefresh = false) {
  if (cachedConfig && !forceRefresh) return cachedConfig;
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
        body: JSON.stringify({ p_id: DONATE_CFG_ID }),
      });
      if (res.ok) {
        const row = await res.json();
        if (row && row.id && row.meta) {
          cachedConfig = {
            kakaoLink: String(row.meta.kakaoLink || DEFAULT_DONATE_CONFIG.kakaoLink).trim(),
            qrImageUrl: String(row.meta.qrImageUrl || '').trim(),
            headline: String(row.meta.headline || DEFAULT_DONATE_CONFIG.headline).trim(),
            subtext: String(row.meta.subtext || DEFAULT_DONATE_CONFIG.subtext).trim(),
          };
          return cachedConfig;
        }
      }
    } catch {
      // ignore and return default
    }
  }
  cachedConfig = { ...DEFAULT_DONATE_CONFIG };
  return cachedConfig;
}

export async function saveDonateConfig(adminRpcFn, { kakaoLink, qrImageUrl, headline, subtext }) {
  const sb = await getSupabaseConfig();
  if (!sb) throw new Error('Supabase 설정이 없습니다.');

  try {
    await adminRpcFn('delete_run', { id: DONATE_CFG_ID });
  } catch {
    // 없어도 무방
  }

  const meta = {
    kakaoLink: String(kakaoLink || DEFAULT_DONATE_CONFIG.kakaoLink).trim(),
    qrImageUrl: String(qrImageUrl || '').trim(),
    headline: String(headline || DEFAULT_DONATE_CONFIG.headline).trim(),
    subtext: String(subtext || DEFAULT_DONATE_CONFIG.subtext).trim(),
  };

  const res = await fetch(`${sb.url}/rest/v1/rpc/g404_submit_run`, {
    method: 'POST',
    headers: {
      apikey: sb.key,
      Authorization: `Bearer ${sb.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_id: DONATE_CFG_ID,
      p_room_id: 'DONCFG',
      p_game_id: '__config__',
      p_nickname: 'donate_cfg',
      p_target_value: 0,
      p_actual_value: 0,
      p_score: 0,
      p_error_mm: null,
      p_rank_title: 'donate',
      p_seed: 1,
      p_meta: meta,
    }),
  });
  if (!res.ok) throw new Error('후원 설정 저장에 실패했습니다.');
  cachedConfig = meta;
  return meta;
}

export function resolveQrImageSrc(cfg) {
  if (cfg.qrImageUrl) return cfg.qrImageUrl;
  const link = (cfg.kakaoLink || DEFAULT_KAKAO_LINK).trim();
  if (link === DEFAULT_KAKAO_LINK) return DEFAULT_QR_ASSET;
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=6&data=${encodeURIComponent(link)}`;
}

export async function openDonateModal() {
  injectDonateStyles();
  const cfg = await loadDonateConfig(true);
  const targetLink = (cfg.kakaoLink || DEFAULT_KAKAO_LINK).trim();
  const qrSrc = resolveQrImageSrc(cfg);

  let backdrop = document.getElementById('g404-donate-modal');
  if (backdrop) backdrop.remove();

  backdrop = document.createElement('div');
  backdrop.id = 'g404-donate-modal';
  backdrop.className = 'don-backdrop';
  backdrop.innerHTML = `
    <div class="don-card" role="dialog" aria-modal="true" aria-label="응원과 후원">
      <button type="button" class="don-close" id="don-close-btn" aria-label="닫기">✕</button>
      <span class="don-kicker">💛 응원과 후원</span>
      <div class="don-title">${esc(cfg.headline)}</div>
      <p class="don-sub">${esc(cfg.subtext)}</p>

      <div class="don-qr-box">
        <img src="${esc(qrSrc)}" alt="카카오페이 후원 QR 코드">
      </div>

      <a href="${esc(targetLink)}" target="_blank" rel="noopener noreferrer" class="don-pay-link-btn">
        💛 카카오페이로 후원하기
      </a>
    </div>
  `;

  document.body.appendChild(backdrop);

  backdrop.querySelector('#don-close-btn').onclick = () => backdrop.remove();
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.remove();
  });
}

// 하위 호환용 빈 함수 유지
export function handleDonateReturnQuery() {}
