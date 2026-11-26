// 이게뭔겜? 404 아케이드 — 카카오페이 송금 QR & 링크 후원 모듈
import { getSupabaseConfig } from './challenge.js';

const DONATE_CFG_ID = 'cfg_donate';
const DEFAULT_KAKAO_LINK = 'https://qr.kakaopay.com/FSGGbIYYt';
const DEFAULT_QR_ASSET = new URL('../assets/kakaopay-qr.png', import.meta.url).href;
const FONTS_HREF = new URL('../assets/fonts/arcade-fonts.css', import.meta.url).href;

export const DEFAULT_DONATE_CONFIG = {
  kakaoLink: DEFAULT_KAKAO_LINK,
  qrImageUrl: '',
  headline: '재밌게 즐기셨나요? 제작자에게 커피 한 잔 응원하기',
  subtext: '휴대폰 카메라로 QR 코드를 비추거나 아래 단추를 누르면 카카오페이 송금으로 연결됩니다.',
};

let cachedConfig = null;
let styleInjected = false;

function ensureArcadeFonts() {
  if (document.getElementById('g404-arcade-fonts')) return;
  const link = document.createElement('link');
  link.id = 'g404-arcade-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanLeadingGlyphs(str) {
  return String(str || '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+$/gu, '').trim();
}

function injectDonateStyles() {
  ensureArcadeFonts();
  if (styleInjected) return;
  styleInjected = true;
  const st = document.createElement('style');
  st.textContent = `
    .kakao-donate-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 9px 15px;
      border-radius: 3px;
      background: #F2BE18;
      color: #15171A;
      border: 1.5px solid #15171A;
      font-size: 13.5px;
      font-weight: 900;
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.14s cubic-bezier(0.16, 1, 0.3, 1), background 0.14s ease;
    }
    .kakao-donate-btn:hover {
      background: #F6C930;
      transform: translateY(1px);
    }
    .kakao-donate-btn:active {
      transform: translateY(2px);
    }

    .don-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9500;
      background: rgba(21, 23, 26, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
      font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    }

    .don-backdrop :focus-visible {
      outline: 2.5px solid #163ECA;
      outline-offset: 2px;
    }

    .don-tray-frame {
      width: min(92vw, 392px);
      background: #D8DDE4;
      border: 2px solid #15171A;
      border-radius: 4px;
      padding: 9px;
      box-shadow: 0 24px 52px -14px rgba(21, 23, 26, 0.44);
    }

    .don-card {
      background: #F5F7FA;
      border: 2px solid #15171A;
      border-radius: 3px;
      padding: 20px 18px 18px;
      color: #15171A;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 13px;
      position: relative;
      text-align: center;
    }

    .don-top-bar {
      width: 100%;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      text-align: left;
    }

    .don-title {
      margin: 0;
      font-family: "Do Hyeon", "Apple SD Gothic Neo", sans-serif;
      font-size: 22px;
      font-weight: 400;
      line-height: 1.24;
      letter-spacing: -0.02em;
      word-break: keep-all;
      text-wrap: balance;
      color: #15171A;
    }

    .don-close {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 3px;
      border: 1.5px solid #15171A;
      background: #E9EDF2;
      color: #15171A;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .don-sub {
      margin: 0;
      font-size: 13px;
      color: #373D45;
      line-height: 1.52;
      word-break: keep-all;
      font-weight: 600;
      text-align: left;
      width: 100%;
    }

    .don-qr-well {
      padding: 10px;
      background: #D8DDE4;
      border: 1.5px solid #15171A;
      border-radius: 3px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .don-serial-code {
      font-family: "Chakra Petch", "Pretendard", sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #373D45;
    }

    .don-qr-box {
      width: 204px;
      height: 204px;
      border-radius: 2px;
      background: #FFFFFF;
      border: 1.5px solid #15171A;
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
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
      margin-top: 2px;
      padding: 14px 18px;
      border-radius: 3px;
      border: 2px solid #15171A;
      background: #FEE500;
      color: #15171A;
      font-size: 15px;
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.12s ease, transform 0.12s ease;
    }
    .don-pay-link-btn:hover {
      background: #F6DC00;
      transform: translateY(1px);
    }
    .don-pay-link-btn:active {
      transform: translateY(2px);
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
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const cfg = await loadDonateConfig(true);
  const targetLink = (cfg.kakaoLink || DEFAULT_KAKAO_LINK).trim();
  const qrSrc = resolveQrImageSrc(cfg);
  const cleanTitle = cleanLeadingGlyphs(cfg.headline) || DEFAULT_DONATE_CONFIG.headline;

  let backdrop = document.getElementById('g404-donate-modal');
  if (backdrop) backdrop.remove();

  const heartSvg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`;

  backdrop = document.createElement('div');
  backdrop.id = 'g404-donate-modal';
  backdrop.className = 'don-backdrop';
  backdrop.innerHTML = `
    <div class="don-tray-frame">
      <div class="don-card" role="dialog" aria-modal="true" aria-label="응원과 후원">
        <div class="don-top-bar">
          <h2 class="don-title">${esc(cleanTitle)}</h2>
          <button type="button" class="don-close" id="don-close-btn" aria-label="닫기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="don-sub">${esc(cleanLeadingGlyphs(cfg.subtext) || DEFAULT_DONATE_CONFIG.subtext)}</p>

        <div class="don-qr-well">
          <div class="don-qr-box">
            <img src="${esc(qrSrc)}" alt="카카오페이 후원 QR 코드">
          </div>
          <span class="don-serial-code">SUPPORT PASS · KAKAOPAY QR</span>
        </div>

        <a href="${esc(targetLink)}" target="_blank" rel="noopener noreferrer" class="don-pay-link-btn" id="don-pay-primary">
          ${heartSvg}
          <span>카카오페이로 응원 보내기</span>
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  function closeDonate() {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    if (opener && document.contains(opener)) opener.focus();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDonate();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = [...backdrop.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  document.addEventListener('keydown', onKeyDown);

  backdrop.querySelector('#don-close-btn').onclick = closeDonate;
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeDonate();
  });

  const primaryLink = backdrop.querySelector('#don-pay-primary');
  if (primaryLink) primaryLink.focus();
}

export function handleDonateReturnQuery() {}
