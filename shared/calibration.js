// 실제 화면 물리 길이(1cm = 몇 CSS px) 초정밀 계산 및 4종 실측 보정 모달
// 지원 모드:
//   1) 화면 대각선 인치 원탭 계산 (OS 해상도 스케일링과 무관하게 피타고라스 공식으로 정밀 산출)
//   2) 신용카드 / 교통카드 실물 대보기 (ISO/IEC 7810 ID-1: 8.56cm × 5.398cm)
//   3) 실제 자 5cm 눈금 대보기 (0~5cm, 1mm 단위)
//   4) 100원(2.40cm) / 500원(2.65cm) 동전 대보기

const STORAGE_KEY = 'fgs.realcm.v2';

// 현재 화면의 논리 대각선 CSS 픽셀 (OS 디스플레이 배율이 이미 반영된 screen.width × screen.height)
export function getScreenDiagPx() {
  const sw = Math.max(320, window.screen.width || window.innerWidth);
  const sh = Math.max(320, window.screen.height || window.innerHeight);
  return { sw, sh, diagPx: Math.hypot(sw, sh) };
}

// 대각선 인치(inch) → 실제 물리 1cm당 CSS px (어떤 OS 배율 설정이든 수학적으로 정확!)
export function pxPerCmFromInches(diagInches) {
  const { diagPx } = getScreenDiagPx();
  const cmDiag = Number(diagInches) * 2.54;
  return diagPx / cmDiag;
}

// 현재 pxPerCm 에 해당하는 추정 대각선 인치 역산
export function inchesFromPxPerCm(pxPerCm) {
  const { diagPx } = getScreenDiagPx();
  return diagPx / (pxPerCm * 2.54);
}

// 대표 기기 논리 해상도 테이블로 초기 추정 오차 최소화
export function detectDeviceAndPxPerCm() {
  const ua = navigator.userAgent || '';
  const dpr = window.devicePixelRatio || 1;
  const coarse = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const { sw, sh } = getScreenDiagPx();
  const W = Math.max(sw, sh);
  const H = Math.min(sw, sh);

  // 1) 아이폰 (논리 해상도 → 실제 대각선 인치)
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

  // 2) 아이패드 (거의 전 모델 264 PPI = 51.97 CSS px/cm, mini 는 326 PPI = 64.17)
  if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    if (W <= 1133 && H <= 744) {
      return { pxPerCm: 64.17, inch: 8.3, label: 'iPad mini (8.3")', calibrated: false };
    }
    return { pxPerCm: 51.97, inch: 11.0, label: 'iPad (264 PPI)', calibrated: false };
  }

  // 3) 안드로이드 / 모바일
  if (coarse && H <= 500) {
    // 가로폭 기준 대략적 인치 추정 (6.1~6.8")
    const inch = H >= 410 ? 6.7 : H >= 385 ? 6.3 : 6.1;
    return { pxPerCm: pxPerCmFromInches(inch), inch, label: `스마트폰 (${inch}" 추정)`, calibrated: false };
  }

  // 4) 맥북 / 아이맥 / 외장 모니터 (논리 해상도 매칭 — 개발자도구 모바일 시뮬레이션 W < 1000 제외)
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

  // 5) 모바일 에뮬레이션 / 윈도우 / 기타 데스크톱 모니터
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
      // 사용자가 같은 화면 해상도에서 보정한 값이면 그대로 사용!
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
      // 만약 인치로 저장돼 있었고 해상도만 바뀐 경우 → 저장된 인치로 새 해상도에 맞춰 자동 재계산!
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

// 4종 정밀 보정 모달 (인치 원탭 / 신용카드 8.56cm / 실제 자 5cm / 동전)
export function openCalibrationModal(onSave, onLiveChange = null) {
  const old = document.getElementById('fgs-cal-modal');
  if (old) old.remove();

  const cur = getPxPerCm();
  const isMobile = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches && Math.min(window.innerWidth, window.innerHeight) <= 520);
  let mode = 'card'; // 'card' | 'ruler' | 'inch' | 'coin'
  let coinType = '100'; // '100' (2.40cm) | '500' (2.65cm)
  let pxPerCm = cur.pxPerCm;
  let chosenLabel = cur.label || '실측 보정';

  const wrap = document.createElement('div');
  wrap.id = 'fgs-cal-modal';
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal-card" style="gap:11px;width:min(95vw,470px)">
      <div class="modal-title" style="font-size:20px">📏 실제 1cm 정밀 보정</div>
      <p class="modal-sub" style="font-size:12.5px">
        기기·모니터마다 픽셀 크기가 달라요. 아래 중 편한 방법으로 <b>딱 한 번</b> 맞추면, 진짜 자로 재도 1.00cm가 정확히 일치합니다!
      </p>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
        <button type="button" class="btn btn-primary cal-tab" data-mode="card" style="padding:9px 4px;font-size:12px">💳 카드</button>
        <button type="button" class="btn btn-ghost cal-tab" data-mode="ruler" style="padding:9px 4px;font-size:12px">📏 자(5cm)</button>
        <button type="button" class="btn btn-ghost cal-tab" data-mode="inch" style="padding:9px 4px;font-size:12px">🖥️ 인치</button>
        <button type="button" class="btn btn-ghost cal-tab" data-mode="coin" style="padding:9px 4px;font-size:12px">🪙 동전</button>
      </div>

      <div id="cal-stage" style="min-height:205px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,0.04);border:1.5px dashed rgba(255,255,255,0.2);border-radius:16px;padding:14px 10px;overflow:hidden"></div>

      <div id="cal-slider-wrap" style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <button type="button" class="pill-btn" id="cal-minus" style="padding:8px 13px;font-size:15px">−</button>
          <input type="range" id="cal-slider" min="22" max="92" step="0.1" value="${pxPerCm.toFixed(1)}" style="flex:1;accent-color:#ffd84a">
          <button type="button" class="pill-btn" id="cal-plus" style="padding:8px 13px;font-size:15px">+</button>
        </div>
        <div id="cal-readout" style="text-align:center;font-size:12px;color:#b8b0cc;font-variant-numeric:tabular-nums"></div>
      </div>

      <div class="btn-row">
        <button type="button" class="btn btn-ghost" id="cal-cancel" style="padding:12px">닫기</button>
        <button type="button" class="btn btn-primary" id="cal-save" style="padding:12px">✓ 이 1cm로 저장</button>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const stage = wrap.querySelector('#cal-stage');
  const slider = wrap.querySelector('#cal-slider');
  const readout = wrap.querySelector('#cal-readout');
  const tabs = wrap.querySelectorAll('.cal-tab');

  function notifyLive() {
    if (onLiveChange) onLiveChange(pxPerCm);
  }

  function renderStage() {
    tabs.forEach(t => {
      t.className = t.dataset.mode === mode ? 'btn btn-primary cal-tab' : 'btn btn-ghost cal-tab';
    });

    const estInch = inchesFromPxPerCm(pxPerCm);
    readout.textContent = `1cm = ${pxPerCm.toFixed(1)}px · 환산 화면 크기 약 ${estInch.toFixed(1)}"`;
    slider.value = pxPerCm.toFixed(1);

    if (mode === 'card') {
      const availW = Math.min(window.innerWidth - 64, 420);
      const fullCardW = 8.56 * pxPerCm;
      const usePortrait = fullCardW > availW;
      const wPx = usePortrait ? 5.398 * pxPerCm : fullCardW;
      const hPx = usePortrait ? Math.min(148, 8.56 * pxPerCm * 0.45) : 5.398 * pxPerCm;
      const dimLabel = usePortrait ? '카드 짧은 변을 가로로 대세요 (5.40cm)' : '신용카드·교통카드를 그대로 포개세요 (8.56 × 5.40cm)';

      stage.innerHTML = `
        <div style="font-size:12px;color:#ffd84a;font-weight:800;text-align:center">${dimLabel}</div>
        <div style="position:relative;width:${wPx.toFixed(1)}px;height:${hPx.toFixed(1)}px;border-radius:12px;background:linear-gradient(135deg,rgba(255,216,74,0.24),rgba(124,92,255,0.26));border:2.5px solid #ffd84a;box-shadow:0 8px 24px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
          <div style="position:absolute;left:12%;top:28%;width:15%;height:22%;border-radius:4px;border:1.5px solid rgba(255,216,74,0.75);background:rgba(255,216,74,0.22)"></div>
          <span style="font-size:12px;font-weight:900;color:#fff;text-shadow:0 1px 4px #000">${usePortrait ? '5.40 cm' : '8.56 cm'}</span>
        </div>
      `;
    } else if (mode === 'ruler') {
      // 실제 자(0~5cm)를 대고 맞추는 눈금자
      const availW = Math.min(window.innerWidth - 70, 415);
      const maxCm = 5 * pxPerCm <= availW ? 5 : 4;
      const rW = maxCm * pxPerCm;
      let ticks = '';
      for (let mm = 0; mm <= maxCm * 10; mm++) {
        const x = (mm / 10) * pxPerCm;
        const isCm = mm % 10 === 0;
        const isHalf = mm % 5 === 0;
        const h = isCm ? 34 : isHalf ? 22 : 13;
        ticks += `<div style="position:absolute;left:${x.toFixed(1)}px;top:0;width:${isCm ? 2 : 1}px;height:${h}px;background:${isCm ? '#1e1629' : '#6c6478'}"></div>`;
        if (isCm) {
          ticks += `<div style="position:absolute;left:${x.toFixed(1)}px;top:37px;transform:translateX(-50%);font-size:12px;font-weight:900;color:#1e1629">${mm / 10}</div>`;
        }
      }
      stage.innerHTML = `
        <div style="font-size:12px;color:#ffd84a;font-weight:800;text-align:center">실제 자를 화면에 대고 0 ~ ${maxCm}cm 눈금을 딱 맞추세요!</div>
        <div style="padding:14px 14px 10px;background:#fffbf0;border-radius:10px;border:2px solid #2a2038;box-shadow:0 8px 20px rgba(0,0,0,0.35)">
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
        <div style="font-size:12px;color:#ffd84a;font-weight:800;text-align:center">지금 보고 계신 화면 크기를 고르면 1cm를 정확히 계산해요!</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">
          ${presets.map(p => `<button type="button" class="pill-btn inch-preset" data-inch="${p.inch}" data-label="${p.t}" style="font-size:12px;padding:7px 11px">${p.t}</button>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
          <span style="font-size:11px;color:#b8b0cc">미리보기 3cm:</span>
          <div style="width:${previewW.toFixed(1)}px;height:14px;border-radius:4px;background:#ffd84a;border:1px solid #fff"></div>
        </div>
      `;
      stage.querySelectorAll('.inch-preset').forEach(btn => {
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
          <button type="button" class="pill-btn ${coinType === '100' ? 'highlight' : ''}" id="coin-100">100원 (2.40cm)</button>
          <button type="button" class="pill-btn ${coinType === '500' ? 'highlight' : ''}" id="coin-500">500원 (2.65cm)</button>
        </div>
        <div style="width:${dPx.toFixed(1)}px;height:${dPx.toFixed(1)}px;border-radius:50%;background:radial-gradient(circle at 35% 35%,rgba(255,216,74,0.4),rgba(180,180,200,0.22));border:2.5px solid #ffd84a;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#ffd84a">
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
  wrap.querySelector('#cal-cancel').onclick = () => {
    wrap.remove();
    if (onLiveChange) onLiveChange(getPxPerCm().pxPerCm);
  };
  wrap.querySelector('#cal-save').onclick = () => {
    const saved = savePxPerCm(pxPerCm, {
      method: mode,
      label: chosenLabel,
    });
    wrap.remove();
    if (onSave) onSave(saved);
  };

  renderStage();
}
