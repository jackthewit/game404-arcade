// 실제 화면 물리 길이(1cm = 몇 CSS px) 초정밀 계산 및 4종 실측 보정 모달

const STORAGE_KEY = 'fgs.realcm.v2';
const FONTS_HREF = new URL('../assets/fonts/arcade-fonts.css', import.meta.url).href;
let calStyleInjected = false;

function ensureArcadeFonts() {
  if (document.getElementById('g404-arcade-fonts')) return;
  const link = document.createElement('link');
  link.id = 'g404-arcade-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

function injectCalStyles() {
  ensureArcadeFonts();
  if (calStyleInjected) return;
  calStyleInjected = true;
  const st = document.createElement('style');
  st.textContent = `
    #fgs-cal-modal {
      position: fixed;
      inset: 0;
      z-index: 9400;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(21, 23, 26, 0.7);
      backdrop-filter: blur(8px);
      overflow-y: auto;
      touch-action: pan-y;
      font-family: "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    }
    #fgs-cal-modal :focus-visible {
      outline: 2.5px solid #163ECA;
      outline-offset: 2px;
    }
    #fgs-cal-modal .cal-tray-shell {
      width: min(95vw, 476px);
      background: #D8DDE4;
      border: 2px solid #15171A;
      border-radius: 4px;
      padding: 9px;
      box-shadow: 0 24px 52px -14px rgba(21, 23, 26, 0.44);
      color: #15171A;
    }
    #fgs-cal-modal .cal-paper {
      background: #F5F7FA;
      border: 2px solid #15171A;
      border-radius: 3px;
      padding: 20px 18px 18px;
      display: flex;
      flex-direction: column;
      gap: 13px;
    }
    #fgs-cal-modal .cal-head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    #fgs-cal-modal .cal-heading {
      margin: 0;
      font-family: "Do Hyeon", "Apple SD Gothic Neo", sans-serif;
      font-size: 24px;
      font-weight: 400;
      letter-spacing: -0.02em;
      color: #15171A;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #fgs-cal-modal .cal-close-icon {
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
    #fgs-cal-modal .cal-desc {
      margin: 0;
      font-size: 13px;
      line-height: 1.52;
      color: #373D45;
      font-weight: 600;
    }
    #fgs-cal-modal .cal-tabs {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }
    #fgs-cal-modal .cal-tab-btn {
      padding: 9px 4px;
      border-radius: 3px;
      border: 1.5px solid #15171A;
      background: #E9EDF2;
      color: #15171A;
      font-size: 12.5px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background 0.14s ease, color 0.14s ease;
    }
    #fgs-cal-modal .cal-tab-btn.is-active {
      background: #15171A;
      color: #F2BE18;
    }
    #fgs-cal-modal .cal-stage-well {
      min-height: 206px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: #D8DDE4;
      border: 1.5px solid #15171A;
      border-radius: 3px;
      padding: 14px 10px;
      overflow: hidden;
    }
    #fgs-cal-modal .cal-step-btn {
      width: 38px;
      height: 36px;
      border-radius: 3px;
      border: 1.5px solid #15171A;
      background: #E9EDF2;
      color: #15171A;
      font-family: "Chakra Petch", "Pretendard", sans-serif;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    #fgs-cal-modal .cal-preset-chip {
      padding: 7px 11px;
      border-radius: 2px;
      border: 1.5px solid #15171A;
      background: #F5F7FA;
      color: #15171A;
      font-family: "Chakra Petch", "Pretendard", sans-serif;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-variant-numeric: tabular-nums;
    }
    #fgs-cal-modal .cal-preset-chip.is-on {
      background: #163ECA;
      color: #FFFFFF;
    }
    #fgs-cal-modal .cal-readout-bar {
      text-align: center;
      font-family: "Chakra Petch", "Pretendard", sans-serif;
      font-size: 13px;
      color: #15171A;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      background: #E9EDF2;
      border: 1px solid #C6CDD6;
      border-radius: 2px;
      padding: 5px 10px;
    }
    #fgs-cal-modal .cal-actions {
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: 8px;
      margin-top: 2px;
    }
    #fgs-cal-modal .cal-btn-cancel {
      padding: 12px;
      border-radius: 3px;
      border: 1.5px solid #15171A;
      background: #E9EDF2;
      color: #15171A;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
    }
    #fgs-cal-modal .cal-btn-save {
      padding: 12px;
      border-radius: 3px;
      border: 2px solid #15171A;
      background: #C92A1D;
      color: #FFFFFF;
      font-size: 14.5px;
      font-weight: 900;
      cursor: pointer;
    }
  `;
  document.head.appendChild(st);
}

export function getScreenDiagPx() {
  const sw = Math.max(320, window.screen.width || window.innerWidth);
  const sh = Math.max(320, window.screen.height || window.innerHeight);
  return { sw, sh, diagPx: Math.hypot(sw, sh) };
}

export function pxPerCmFromInches(diagInches) {
  const { diagPx } = getScreenDiagPx();
  const cmDiag = Number(diagInches) * 2.54;
  return diagPx / cmDiag;
}

export function inchesFromPxPerCm(pxPerCm) {
  const { diagPx } = getScreenDiagPx();
  return diagPx / (pxPerCm * 2.54);
}

export function detectDeviceAndPxPerCm() {
  const ua = navigator.userAgent || '';
  const dpr = window.devicePixelRatio || 1;
  const coarse = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const { sw, sh } = getScreenDiagPx();
  const W = Math.max(sw, sh);
  const H = Math.min(sw, sh);

  if (/iPhone/i.test(ua)) {
    const iphoneMap = [
      [956, 440, 6.9, 'iPhone 16 Pro Max (6.9")'],
      [932, 430, 6.7, 'iPhone Plus / Pro Max (6.7")'],
      [926, 428, 6.7, 'iPhone Pro Max (6.7")'],
      [874, 402, 6.3, 'iPhone 16 Pro (6.3")'],
      [852, 393, 6.12, 'iPhone 14~16 (6.1")'],
      [844, 390, 6.06, 'iPhone 12~14 (6.1")'],
      [812, 375, 5.8, 'iPhone X / mini (5.8")'],
      [896, 414, 6.1, 'iPhone XR / 11 (6.1")'],
      [736, 414, 5.5, 'iPhone Plus (5.5")'],
      [667, 375, 4.7, 'iPhone SE (4.7")'],
    ];
    for (const [mw, mh, inch, label] of iphoneMap) {
      if (Math.abs(W - mw) <= 4 && Math.abs(H - mh) <= 4) {
        return { pxPerCm: pxPerCmFromInches(inch), inch, label, calibrated: false };
      }
    }
    return { pxPerCm: pxPerCmFromInches(6.1), inch: 6.1, label: 'iPhone (6.1" 추정)', calibrated: false };
  }

  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    if (W <= 1133 && H <= 744) {
      return { pxPerCm: 64.17, inch: 8.3, label: 'iPad mini (8.3")', calibrated: false };
    }
    return { pxPerCm: 51.97, inch: 11.0, label: 'iPad (264 PPI)', calibrated: false };
  }

  if (coarse && H <= 500) {
    const inch = H >= 410 ? 6.7 : H >= 385 ? 6.3 : 6.1;
    return { pxPerCm: pxPerCmFromInches(inch), inch, label: `스마트폰 (${inch}" 추정)`, calibrated: false };
  }

  if (/Macintosh/i.test(ua) && W >= 1000) {
    const macMap = [
      [1512, 982, 14.2, 'MacBook Pro 14"'],
      [1800, 1169, 14.2, 'MacBook Pro 14" (넓게)'],
      [1352, 878, 14.2, 'MacBook Pro 14" (크게)'],
      [1728, 1117, 16.2, 'MacBook Pro 16"'],
      [2056, 1329, 16.2, 'MacBook Pro 16" (넓게)'],
      [1496, 967, 16.2, 'MacBook Pro 16" (크게)'],
      [1470, 956, 13.6, 'MacBook Air 13"'],
      [1710, 1107, 15.3, 'MacBook Air 15"'],
      [1440, 900, 13.3, 'MacBook 13.3"'],
      [1680, 1050, 13.3, 'MacBook 13.3" (넓게)'],
      [2240, 1260, 23.5, 'iMac 24"'],
      [2560, 1440, 27.0, '27" 5K/QHD 모니터'],
      [3008, 1692, 27.0, '27" 4K/5K (넓게)'],
      [3200, 1800, 32.0, '32" 6K/4K 모니터'],
      [1920, 1080, 27.0, '27" 모니터 (FHD 스케일)'],
    ];
    for (const [mw, mh, inch, label] of macMap) {
      if (Math.abs(W - mw) <= 12 && Math.abs(H - mh) <= 12) {
        return { pxPerCm: pxPerCmFromInches(inch), inch, label, calibrated: false };
      }
    }
    const fallbackInch = W >= 2400 ? 27.0 : W >= 1650 ? 16.0 : 14.2;
    return { pxPerCm: pxPerCmFromInches(fallbackInch), inch: fallbackInch, label: `Mac (${fallbackInch}" 추정)`, calibrated: false };
  }

  if (H <= 500 && W <= 980) {
    const inch = H >= 410 ? 6.7 : 6.1;
    return { pxPerCm: pxPerCmFromInches(inch), inch, label: `모바일 화면 (${inch}" 추정)`, calibrated: false };
  }
  const winInch = W >= 2500 ? 27.0 : (W >= 1900 && dpr <= 1.25) ? 24.0 : 15.6;
  return { pxPerCm: pxPerCmFromInches(winInch), inch: winInch, label: `모니터 (${winInch}" 추정)`, calibrated: false };
}

export function getPxPerCm() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const { sw, sh } = getScreenDiagPx();
      if (
        Number.isFinite(parsed.pxPerCm) &&
        parsed.pxPerCm >= 20 &&
        parsed.pxPerCm <= 120 &&
        (!parsed.sw || (Math.abs(parsed.sw - sw) <= 20 && Math.abs(parsed.sh - sh) <= 20))
      ) {
        return {
          pxPerCm: parsed.pxPerCm,
          calibrated: true,
          method: parsed.method || '실측 보정',
          label: parsed.label || '실측 보정됨',
        };
      }
      if (Number.isFinite(parsed.inch) && parsed.inch >= 4 && parsed.inch <= 65) {
        return {
          pxPerCm: pxPerCmFromInches(parsed.inch),
          calibrated: true,
          method: '인치 자동 환산',
          label: `${parsed.inch}" 화면 보정`,
        };
      }
    }
  } catch {
    // ignore
  }
  return detectDeviceAndPxPerCm();
}

export function savePxPerCm(pxPerCm, meta = {}) {
  const clamped = Math.max(20, Math.min(120, Number(pxPerCm)));
  const { sw, sh } = getScreenDiagPx();
  const payload = {
    pxPerCm: Number(clamped.toFixed(3)),
    inch: meta.inch ? Number(meta.inch) : Number(inchesFromPxPerCm(clamped).toFixed(2)),
    method: meta.method || '실측 보정',
    label: meta.label || '실측 보정됨',
    sw,
    sh,
    at: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  return { ...payload, calibrated: true };
}

export function saveByScreenInches(diagInches, label) {
  const pxPerCm = pxPerCmFromInches(diagInches);
  return savePxPerCm(pxPerCm, {
    inch: diagInches,
    method: '화면 인치 보정',
    label: label || `${diagInches}" 화면`,
  });
}

export function openCalibrationModal(onSave, onLiveChange = null) {
  injectCalStyles();
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const old = document.getElementById('fgs-cal-modal');
  if (old) old.remove();

  const cur = getPxPerCm();
  const isMobile = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) <= 520);
  let mode = 'card';
  let coinType = '100';
  let pxPerCm = cur.pxPerCm;
  let chosenLabel = cur.label || '실측 보정';

  const rulerSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>`;

  const wrap = document.createElement('div');
  wrap.id = 'fgs-cal-modal';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', '실제 1cm 정밀 보정');
  wrap.innerHTML = `
    <div class="cal-tray-shell">
      <div class="cal-paper">
        <div class="cal-head-row">
          <h2 class="cal-heading">${rulerSvg}<span>실제 1cm 영점 게이지 보정</span></h2>
          <button type="button" class="cal-close-icon" id="cal-top-close" aria-label="닫기">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="cal-desc">
          화면·모니터마다 픽셀 밀도가 다릅니다. 아래 도구 중 편한 방법으로 <b>한 번만</b> 맞추면 실제 자로 잰 1.00cm와 똑같이 맞춰집니다.
        </p>

        <div class="cal-tabs" role="group" aria-label="보정 측정 방식">
          <button type="button" class="cal-tab-btn is-active" data-mode="card" aria-pressed="true">신용카드</button>
          <button type="button" class="cal-tab-btn" data-mode="ruler" aria-pressed="false">자 (5cm)</button>
          <button type="button" class="cal-tab-btn" data-mode="inch" aria-pressed="false">화면 인치</button>
          <button type="button" class="cal-tab-btn" data-mode="coin" aria-pressed="false">동전 대보기</button>
        </div>

        <div id="cal-stage" class="cal-stage-well"></div>

        <div id="cal-slider-wrap" style="display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <button type="button" class="cal-step-btn" id="cal-minus" aria-label="1cm 픽셀 줄이기">−</button>
            <input type="range" id="cal-slider" aria-label="1cm 픽셀 미세 조절" min="22" max="92" step="0.1" value="${pxPerCm.toFixed(1)}" style="flex:1;accent-color:#15171A;cursor:pointer">
            <button type="button" class="cal-step-btn" id="cal-plus" aria-label="1cm 픽셀 늘리기">+</button>
          </div>
          <div id="cal-readout" class="cal-readout-bar"></div>
        </div>

        <div class="cal-actions">
          <button type="button" class="cal-btn-cancel" id="cal-cancel">닫기</button>
          <button type="button" class="cal-btn-save" id="cal-save">이 1cm 눈금 저장</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const stage = wrap.querySelector('#cal-stage');
  const slider = wrap.querySelector('#cal-slider');
  const readout = wrap.querySelector('#cal-readout');
  const tabs = wrap.querySelectorAll('.cal-tab-btn');

  function notifyLive() {
    if (onLiveChange) onLiveChange(pxPerCm);
  }

  function renderStage() {
    tabs.forEach(t => {
      const active = t.dataset.mode === mode;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const estInch = inchesFromPxPerCm(pxPerCm);
    readout.textContent = `1cm = ${pxPerCm.toFixed(1)}px · 환산 화면 대각선 약 ${estInch.toFixed(1)}"`;
    slider.value = pxPerCm.toFixed(1);

    if (mode === 'card') {
      const availW = Math.min(window.innerWidth - 76, 420);
      const fullCardW = 8.56 * pxPerCm;
      const usePortrait = fullCardW > availW;
      const wPx = usePortrait ? 5.398 * pxPerCm : fullCardW;
      const hPx = usePortrait ? Math.min(148, 8.56 * pxPerCm * 0.45) : 5.398 * pxPerCm;
      const dimLabel = usePortrait ? '카드 짧은 변을 가로로 포개세요 (5.40cm)' : '실물 신용카드·교통카드를 사각형에 포개세요 (8.56 × 5.40cm)';

      stage.innerHTML = `
        <div style="font-size:12.5px;color:#15171A;font-weight:900;text-align:center">${dimLabel}</div>
        <div style="position:relative;width:${wPx.toFixed(1)}px;height:${hPx.toFixed(1)}px;border-radius:4px;background:#F2BE18;border:2.5px solid #15171A;box-shadow:0 8px 18px -8px rgba(21,23,26,0.28);display:flex;align-items:center;justify-content:center">
          <div style="position:absolute;left:12%;top:28%;width:15%;height:22%;border-radius:2px;border:1.5px solid #15171A;background:#F5F7FA"></div>
          <span style="font-family:'Chakra Petch','Pretendard',sans-serif;font-size:14px;font-weight:700;color:#15171A;font-variant-numeric:tabular-nums">${usePortrait ? '5.40 cm' : '8.56 cm'}</span>
        </div>
      `;
    } else if (mode === 'ruler') {
      const availW = Math.min(window.innerWidth - 82, 415);
      const maxCm = 5 * pxPerCm <= availW ? 5 : 4;
      const rW = maxCm * pxPerCm;
      let ticks = '';
      for (let mm = 0; mm <= maxCm * 10; mm++) {
        const x = (mm / 10) * pxPerCm;
        const isCm = mm % 10 === 0;
        const isHalf = mm % 5 === 0;
        const h = isCm ? 34 : isHalf ? 22 : 13;
        ticks += `<div style="position:absolute;left:${x.toFixed(1)}px;top:0;width:${isCm ? 2 : 1}px;height:${h}px;background:${isCm ? '#15171A' : '#373D45'}"></div>`;
        if (isCm) {
          ticks += `<div style="position:absolute;left:${x.toFixed(1)}px;top:37px;transform:translateX(-50%);font-family:'Chakra Petch','Pretendard',sans-serif;font-size:12.5px;font-weight:700;color:#15171A;font-variant-numeric:tabular-nums">${mm / 10}</div>`;
        }
      }
      stage.innerHTML = `
        <div style="font-size:12.5px;color:#15171A;font-weight:900;text-align:center">실제 자를 화면에 대고 0 ~ ${maxCm}cm 눈금을 일치시키세요</div>
        <div style="padding:14px 16px 10px;background:#F5F7FA;border-radius:3px;border:2px solid #15171A;box-shadow:0 8px 18px -8px rgba(21,23,26,0.22)">
          <div style="position:relative;width:${rW.toFixed(1)}px;height:54px">${ticks}</div>
        </div>
      `;
    } else if (mode === 'inch') {
      const presets = isMobile
        ? [
            { inch: 5.4, t: '5.4" 미니' },
            { inch: 6.1, t: '6.1" 일반' },
            { inch: 6.3, t: '6.3" 프로' },
            { inch: 6.7, t: '6.7" 플러스/맥스' },
            { inch: 6.8, t: '6.8" 울트라' },
            { inch: 6.9, t: '6.9" 맥스' },
          ]
        : [
            { inch: 13.3, t: '13.3" 노트북' },
            { inch: 13.6, t: '13.6" 맥북에어' },
            { inch: 14.2, t: '14.2" 맥북프로' },
            { inch: 15.3, t: '15.3" 맥북에어' },
            { inch: 16.2, t: '16.2" 맥북프로' },
            { inch: 24.0, t: '24" 모니터' },
            { inch: 27.0, t: '27" 모니터' },
            { inch: 32.0, t: '32" 모니터' },
          ];
      const previewW = pxPerCm * 3;
      stage.innerHTML = `
        <div style="font-size:12.5px;color:#15171A;font-weight:900;text-align:center">현재 기기의 화면 규격을 선택하면 1cm를 즉시 산출합니다</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">
          ${presets.map(p => `<button type="button" class="cal-preset-chip ${chosenLabel === p.t ? 'is-on' : ''}" data-inch="${p.inch}" data-label="${p.t}" aria-pressed="${chosenLabel === p.t ? 'true' : 'false'}">${p.t}</button>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <span style="font-size:12px;color:#373D45;font-weight:800">실제 3cm 막대:</span>
          <div style="width:${previewW.toFixed(1)}px;height:14px;border-radius:2px;background:#F2BE18;border:1.5px solid #15171A"></div>
        </div>
      `;
      stage.querySelectorAll('.cal-preset-chip').forEach(btn => {
        btn.onclick = () => {
          const inch = parseFloat(btn.dataset.inch);
          pxPerCm = pxPerCmFromInches(inch);
          chosenLabel = btn.dataset.label;
          renderStage();
          notifyLive();
        };
      });
    } else if (mode === 'coin') {
      const diamCm = coinType === '500' ? 2.65 : 2.40;
      const dPx = diamCm * pxPerCm;
      stage.innerHTML = `
        <div style="display:flex;gap:6px">
          <button type="button" class="cal-preset-chip ${coinType === '100' ? 'is-on' : ''}" id="coin-100" aria-pressed="${coinType === '100' ? 'true' : 'false'}">100원 (2.40cm)</button>
          <button type="button" class="cal-preset-chip ${coinType === '500' ? 'is-on' : ''}" id="coin-500" aria-pressed="${coinType === '500' ? 'true' : 'false'}">500원 (2.65cm)</button>
        </div>
        <div style="width:${dPx.toFixed(1)}px;height:${dPx.toFixed(1)}px;border-radius:50%;background:#F5F7FA;border:2.5px solid #15171A;box-shadow:0 6px 14px -6px rgba(21,23,26,0.25);display:flex;align-items:center;justify-content:center;font-family:'Chakra Petch','Pretendard',sans-serif;font-weight:700;font-size:13.5px;color:#15171A;font-variant-numeric:tabular-nums">
          ${coinType}원
        </div>
      `;
      stage.querySelector('#coin-100').onclick = () => { coinType = '100'; renderStage(); };
      stage.querySelector('#coin-500').onclick = () => { coinType = '500'; renderStage(); };
    }
  }

  tabs.forEach(t => {
    t.onclick = () => {
      mode = t.dataset.mode;
      renderStage();
    };
  });

  slider.oninput = () => {
    pxPerCm = parseFloat(slider.value);
    chosenLabel = mode === 'card' ? '카드 실측' : mode === 'ruler' ? '자 실측' : mode === 'coin' ? '동전 실측' : '인치 보정';
    renderStage();
    notifyLive();
  };
  wrap.querySelector('#cal-minus').onclick = () => {
    pxPerCm = Math.max(22, Number((pxPerCm - 0.3).toFixed(1)));
    renderStage();
    notifyLive();
  };
  wrap.querySelector('#cal-plus').onclick = () => {
    pxPerCm = Math.min(92, Number((pxPerCm + 0.3).toFixed(1)));
    renderStage();
    notifyLive();
  };

  function cleanupAndRestoreFocus() {
    document.removeEventListener('keydown', onKeyDown);
    wrap.remove();
    if (opener && document.contains(opener)) opener.focus();
  }

  function closeModal() {
    cleanupAndRestoreFocus();
    if (onLiveChange) onLiveChange(getPxPerCm().pxPerCm);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = [...wrap.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled);
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

  wrap.querySelector('#cal-cancel').onclick = closeModal;
  wrap.querySelector('#cal-top-close').onclick = closeModal;
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) closeModal();
  });

  wrap.querySelector('#cal-save').onclick = () => {
    const saved = savePxPerCm(pxPerCm, {
      method: mode,
      label: chosenLabel,
    });
    cleanupAndRestoreFocus();
    if (onSave) onSave(saved);
  };

  renderStage();
  const initialFocus = wrap.querySelector('.cal-tab-btn.is-active') || slider;
  if (initialFocus) initialFocus.focus();
}
