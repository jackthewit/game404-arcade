// 이게뭔겜? 404 아케이드 — 카카오페이 온라인 결제 API + 카카오 송금 QR & 링크 통합 후원 모듈
import { getSupabaseConfig, showToast } from './challenge.js';

const PENDING_PAY_KEY = 'fgs.kakaopay.pending.v1';
const DONATE_CFG_ID = 'cfg_donate';

const DEFAULT_DONATE_CONFIG = {
  kakaoLink: '',
  qrImageUrl: '',
  headline: '재밌게 즐기셨나요? 제작자에게 커피 한 잔 응원하기 ☕',
  subtext: '보내주신 소중한 후원은 새로운 3D 미니게임 개발과 서버 운영에 큰 힘이 됩니다!',
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
    .don-backdrop.hidden { display: none; }

    .don-card {
      width: min(94vw, 440px);
      max-height: 92vh;
      overflow-y: auto;
      background: #1b1629;
      border: 1.5px solid rgba(254, 229, 0, 0.42);
      border-radius: 26px;
      padding: 22px 20px 20px;
      color: #f8f5ff;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
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
      align-self: center;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(254, 229, 0, 0.16);
      border: 1px solid rgba(254, 229, 0, 0.48);
      color: #FEE500;
      font-size: 11.5px;
      font-weight: 900;
    }
    .don-title {
      font-size: 19px;
      font-weight: 900;
      text-align: center;
      line-height: 1.35;
      word-break: keep-all;
      padding: 0 16px;
    }
    .don-sub {
      font-size: 12.5px;
      color: #bdb5d6;
      text-align: center;
      line-height: 1.5;
      word-break: keep-all;
    }

    .don-section {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.10);
      border-radius: 18px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .don-sec-label {
      font-size: 12px;
      font-weight: 900;
      color: #fde68a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .don-amounts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
    .don-amt-btn {
      padding: 9px 4px;
      border-radius: 11px;
      border: 1.5px solid rgba(255, 255, 255, 0.14);
      background: #130f1e;
      color: #dcd4f0;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .don-amt-btn.active {
      background: rgba(254, 229, 0, 0.18);
      border-color: #FEE500;
      color: #FEE500;
    }
    .don-input-row {
      display: grid;
      grid-template-columns: 1fr 1.25fr;
      gap: 8px;
    }
    .don-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 11px;
      border: 1.5px solid rgba(255, 255, 255, 0.15);
      background: #120e1d;
      color: #ffffff;
      font-size: 13px;
      font-family: inherit;
      font-weight: 700;
    }
    .don-input:focus {
      outline: none;
      border-color: #FEE500;
    }

    .don-pay-submit {
      width: 100%;
      padding: 13px 16px;
      border-radius: 14px;
      border: none;
      background: #FEE500;
      color: #191919;
      font-size: 15px;
      font-weight: 900;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 8px 20px rgba(254, 229, 0, 0.25);
      transition: filter 0.12s ease, transform 0.1s ease;
    }
    .don-pay-submit:hover { filter: brightness(1.04); }
    .don-pay-submit:active { transform: scale(0.98); }
    .don-pay-submit:disabled { opacity: 0.6; cursor: wait; }

    .don-qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .don-qr-box {
      width: 176px;
      height: 176px;
      border-radius: 18px;
      background: #ffffff;
      padding: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }
    .don-qr-box img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .don-qr-empty {
      color: #475569;
      font-size: 11.5px;
      font-weight: 800;
      text-align: center;
      line-height: 1.45;
      padding: 8px;
      word-break: keep-all;
    }
    .don-link-btns {
      display: flex;
      gap: 8px;
      width: 100%;
    }
    .don-link-btn {
      flex: 1;
      padding: 10px 12px;
      border-radius: 12px;
      border: 1.5px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.07);
      color: #f8f5ff;
      font-size: 12.5px;
      font-weight: 800;
      text-decoration: none;
      text-align: center;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .don-link-btn.yellow-outline {
      border-color: rgba(254, 229, 0, 0.55);
      color: #FEE500;
      background: rgba(254, 229, 0, 0.10);
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
            kakaoLink: String(row.meta.kakaoLink || '').trim(),
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

// 관리자 모드에서 카카오페이 QR 이미지 & 송금 링크 설정 저장 (기존 cfg_donate 삭제 후 재등록)
export async function saveDonateConfig(adminRpcFn, { kakaoLink, qrImageUrl, headline, subtext }) {
  const sb = await getSupabaseConfig();
  if (!sb) throw new Error('Supabase 설정이 없습니다.');

  try {
    await adminRpcFn('delete_run', { id: DONATE_CFG_ID });
  } catch {
    // 없어도 무방
  }

  const meta = {
    kakaoLink: String(kakaoLink || '').trim(),
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

function isMobileViewport() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || window.innerWidth < 680;
}

export async function openDonateModal() {
  injectDonateStyles();
  const cfg = await loadDonateConfig(true);

  let backdrop = document.getElementById('g404-donate-modal');
  if (backdrop) backdrop.remove();

  // 등록된 QR 이미지가 없더라도 카카오페이 송금 링크가 있으면 자동으로 QR 이미지 생성 지원
  let effectiveQrSrc = cfg.qrImageUrl;
  if (!effectiveQrSrc && cfg.kakaoLink) {
    effectiveQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=6&data=${encodeURIComponent(cfg.kakaoLink)}`;
  }

  backdrop = document.createElement('div');
  backdrop.id = 'g404-donate-modal';
  backdrop.className = 'don-backdrop';
  backdrop.innerHTML = `
    <div class="don-card" role="dialog" aria-modal="true" aria-label="카카오페이 후원하기">
      <button type="button" class="don-close" id="don-close-btn" aria-label="닫기">✕</button>
      <span class="don-kicker">💛 카카오페이 공식 응원 후원</span>
      <div class="don-title">${esc(cfg.headline)}</div>
      <p class="don-sub">${esc(cfg.subtext)}</p>

      <!-- 1. 카카오페이 온라인 단건 결제 API -->
      <div class="don-section">
        <div class="don-sec-label">
          <span>⚡ 금액 선택 후 바로 결제 (카카오페이 API)</span>
          <span id="don-api-badge" style="font-size:10.5px;color:#a9a0c2;">간편 결제</span>
        </div>
        <div class="don-amounts" id="don-amt-group">
          <button type="button" class="don-amt-btn" data-amt="1000">☕ 1천원</button>
          <button type="button" class="don-amt-btn active" data-amt="3000">🍰 3천원</button>
          <button type="button" class="don-amt-btn" data-amt="5000">🍔 5천원</button>
          <button type="button" class="don-amt-btn" data-amt="10000">🎁 1만원</button>
        </div>
        <div class="don-input-row">
          <input type="number" id="don-custom-amt" class="don-input" min="100" max="1000000" step="100" value="3000" placeholder="금액(원)">
          <input type="text" id="don-msg-input" class="don-input" maxlength="30" placeholder="응원 한마디 (선택)">
        </div>
        <button type="button" class="don-pay-submit" id="don-api-pay-btn">
          <span>💬 카카오페이로 <b id="don-btn-amt-txt">3,000원</b> 후원하기</span>
        </button>
      </div>

      <!-- 2. 카카오페이 송금 QR 스캔 & 직접 링크 -->
      <div class="don-section" id="don-qr-section">
        <div class="don-sec-label">
          <span>📱 카카오페이 QR 스캔 · 송금 링크</span>
          <span style="font-size:10.5px;color:#a9a0c2;">카메라 스캔 / 터치</span>
        </div>
        <div class="don-qr-wrap">
          <div class="don-qr-box" id="don-qr-box">
            ${effectiveQrSrc
              ? `<img src="${esc(effectiveQrSrc)}" alt="카카오페이 후원 QR 코드" id="don-qr-img">`
              : `<div class="don-qr-empty">카카오페이 결제 버튼을 누르거나<br>관리자 모드에서 송금 QR·링크를 등록할 수 있어요</div>`
            }
          </div>
          <div class="don-link-btns">
            ${cfg.kakaoLink
              ? `
                <a href="${esc(cfg.kakaoLink)}" target="_blank" rel="noopener noreferrer" class="don-link-btn yellow-outline">
                  🔗 카카오페이 송금 링크 열기
                </a>
                <button type="button" class="don-link-btn" id="don-copy-link-btn">
                  📋 링크 복사
                </button>
              `
              : `
                <button type="button" class="don-link-btn yellow-outline" id="don-gen-api-qr-btn">
                  🔄 선택한 금액으로 결제 링크·QR 열기
                </button>
              `
            }
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const amtInput = backdrop.querySelector('#don-custom-amt');
  const amtTxt = backdrop.querySelector('#don-btn-amt-txt');
  const amtBtns = Array.from(backdrop.querySelectorAll('.don-amt-btn'));
  const payBtn = backdrop.querySelector('#don-api-pay-btn');

  function syncAmtDisplay(val) {
    const clean = Math.max(100, Math.min(1000000, Math.round(Number(val) || 3000)));
    amtTxt.textContent = `${clean.toLocaleString()}원`;
    amtBtns.forEach(b => b.classList.toggle('active', Number(b.dataset.amt) === clean));
  }

  amtBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      amtInput.value = btn.dataset.amt;
      syncAmtDisplay(btn.dataset.amt);
    });
  });

  amtInput.addEventListener('input', () => syncAmtDisplay(amtInput.value));

  backdrop.querySelector('#don-close-btn').onclick = () => backdrop.remove();
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.remove();
  });

  const copyBtn = backdrop.querySelector('#don-copy-link-btn');
  if (copyBtn && cfg.kakaoLink) {
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(cfg.kakaoLink);
        showToast('📋 카카오페이 송금 링크가 복사되었어요!');
      } catch {
        showToast(cfg.kakaoLink);
      }
    };
  }

  async function requestKakaoPayReady() {
    const amount = Math.max(100, Math.min(1000000, Math.round(Number(amtInput.value) || 3000)));
    const message = backdrop.querySelector('#don-msg-input').value.trim();
    payBtn.disabled = true;
    const origHtml = payBtn.innerHTML;
    payBtn.textContent = '카카오페이 결제창 준비 중...';

    try {
      const res = await fetch('/api/kakaopay/ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, message }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data && data.ok && data.tid) {
        localStorage.setItem(PENDING_PAY_KEY, JSON.stringify({
          tid: data.tid,
          cid: data.cid,
          amount: data.amount,
          partner_order_id: data.partner_order_id,
          partner_user_id: data.partner_user_id,
          at: Date.now(),
        }));
        const redirectUrl = isMobileViewport()
          ? (data.next_redirect_mobile_url || data.next_redirect_pc_url)
          : (data.next_redirect_pc_url || data.next_redirect_mobile_url);

        if (redirectUrl) {
          location.href = redirectUrl;
          return;
        }
      }

      // API 키 미등록이거나 로컬 정적 서버일 때 송금 링크가 등록되어 있으면 자연스럽게 연결
      if (cfg.kakaoLink) {
        showToast('💛 카카오페이 송금 페이지로 이동합니다!');
        window.open(cfg.kakaoLink, '_blank', 'noopener,noreferrer');
      } else {
        const msg = (data && data.message) || '카카오페이 API 키 또는 송금 링크를 관리자 설정에 등록해 주세요.';
        showToast(`ℹ️ ${msg}`);
      }
    } catch {
      if (cfg.kakaoLink) {
        window.open(cfg.kakaoLink, '_blank', 'noopener,noreferrer');
      } else {
        showToast('ℹ️ 로컬 미리보기에서는 실서버 배포 및 KAKAOPAY_SECRET_KEY 설정 후 결제가 연결됩니다.');
      }
    } finally {
      payBtn.disabled = false;
      payBtn.innerHTML = origHtml;
    }
  }

  payBtn.onclick = requestKakaoPayReady;
  const genQrBtn = backdrop.querySelector('#don-gen-api-qr-btn');
  if (genQrBtn) genQrBtn.onclick = requestKakaoPayReady;

  // 실서버에서만 API 키 설정 상태 배지 프리체크 (로컬 정적 http.server 404 방지)
  if (!/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
    fetch('/api/kakaopay/ready')
      .then(r => (r.ok ? r.json() : null))
      .then(info => {
        const badge = backdrop.querySelector('#don-api-badge');
        if (!badge || !info) return;
        if (info.configured) {
          badge.textContent = info.isTestMode ? '🟢 테스트 결제 연동됨' : '🟢 카카오페이 연동됨';
          badge.style.color = '#4ade80';
        }
      })
      .catch(() => {});
  }
}

// 카카오페이 결제 인증 후 approval_url(?donate_status=approve&pg_token=...) 복귀 시 자동 최종 승인 처리
export async function handleDonateReturnQuery() {
  const qs = new URLSearchParams(location.search);
  const status = qs.get('donate_status');
  const pgToken = qs.get('pg_token');
  if (!status) return;

  const cleanUrl = location.pathname;
  history.replaceState({}, '', cleanUrl);

  if (status === 'cancel') {
    showToast('카카오페이 후원이 취소되었어요.');
    return;
  }
  if (status === 'fail') {
    showToast('⚠️ 카카오페이 결제 처리에 실패했어요. 다시 시도해 주세요.');
    return;
  }

  if (status === 'approve' && pgToken) {
    let pending = null;
    try {
      pending = JSON.parse(localStorage.getItem(PENDING_PAY_KEY) || 'null');
    } catch {}
    localStorage.removeItem(PENDING_PAY_KEY);

    if (!pending || !pending.tid) {
      showToast('⚠️ 결제 세션 정보를 찾지 못했어요.');
      return;
    }

    try {
      const res = await fetch('/api/kakaopay/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: pending.cid,
          tid: pending.tid,
          partner_order_id: pending.partner_order_id,
          partner_user_id: pending.partner_user_id,
          pg_token: pgToken,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.ok) {
        const amt = Number(data.total_amount || pending.amount || 0).toLocaleString();
        showThankYouModal(amt);
      } else {
        showToast(`⚠️ 승인 실패: ${(data && data.message) || '다시 시도해 주세요.'}`);
      }
    } catch {
      showToast('⚠️ 결제 승인 통신 중 오류가 발생했어요.');
    }
  }
}

function showThankYouModal(amountText) {
  injectDonateStyles();
  const modal = document.createElement('div');
  modal.className = 'don-backdrop';
  modal.innerHTML = `
    <div class="don-card" style="text-align:center;align-items:center;padding:28px 22px;">
      <div style="font-size:48px;line-height:1;">💛🎉</div>
      <span class="don-kicker">후원 완료</span>
      <div class="don-title">${esc(amountText)}원 응원 후원,<br>진심으로 감사합니다!</div>
      <p class="don-sub">
        보내주신 따뜻한 마음 덕분에<br>
        더 기발하고 재밌는 404 아케이드 게임을 계속 만들 수 있어요!
      </p>
      <button type="button" class="don-pay-submit" id="don-thanks-ok">🎮 즐겁게 게임하러 가기</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#don-thanks-ok').onclick = () => modal.remove();
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });
}
