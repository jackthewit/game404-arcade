// 외부 오디오 파일 없이 즉시 반응하는 Web Audio API 효과음 합성기
let ctx = null;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() {
  ensureCtx();
}

function noiseBurst(duration, filterFreq, gainVal, type = 'bandpass', q = 1.5, delay = 0) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * duration));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4);

  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(filterFreq, t0);
  filt.Q.setValueAtTime(q, t0);

  const g = c.createGain();
  g.gain.setValueAtTime(gainVal, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

  src.connect(filt);
  filt.connect(g);
  g.connect(c.destination);
  src.start(t0);
}

function tone(freq, freqEnd, duration, gainVal, wave = 'sine', delay = 0) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + duration);
  g.gain.setValueAtTime(gainVal, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const SFX = {
  // 가위질 "사각— 싹둑!"
  snip() {
    noiseBurst(0.11, 3400, 0.36, 'bandpass', 2.2, 0);
    noiseBurst(0.07, 6200, 0.25, 'highpass', 1.2, 0.045);
    tone(1850, 720, 0.06, 0.09, 'triangle', 0.04);
  },
  // 머리카락 스치는 미세한 사각임
  rustle() {
    noiseBurst(0.04, 4200, 0.05, 'bandpass', 3.0, 0);
  },
  // 실측 자 눈금 틱
  tick() {
    tone(1100, 900, 0.03, 0.06, 'sine', 0);
  },
  // 성공 / 전설 팡파레
  win() {
    tone(523.25, 523.25, 0.14, 0.14, 'triangle', 0);
    tone(659.25, 659.25, 0.14, 0.14, 'triangle', 0.1);
    tone(783.99, 783.99, 0.18, 0.15, 'triangle', 0.2);
    tone(1046.5, 1046.5, 0.38, 0.17, 'triangle', 0.3);
  },
  // 아차 / 실패
  fail() {
    tone(300, 175, 0.22, 0.14, 'sawtooth', 0);
    tone(190, 120, 0.28, 0.12, 'triangle', 0.14);
  },
  // 뽁 (기포 빠짐 / 여드름 팝)
  pop() {
    tone(280, 960, 0.09, 0.22, 'sine', 0);
    noiseBurst(0.04, 2400, 0.12, 'bandpass', 2.0, 0.02);
  },
  // 레이저 / 슈팅 발사
  shoot() {
    tone(980, 320, 0.075, 0.11, 'square', 0);
  },
  // 적 명중 / 콤보
  hit() {
    tone(420, 140, 0.09, 0.14, 'square', 0);
    noiseBurst(0.06, 1200, 0.16, 'lowpass', 1.0, 0);
  },
  // 필름 착 내려앉음
  filmDrop() {
    noiseBurst(0.32, 1600, 0.18, 'bandpass', 1.2, 0);
    tone(220, 140, 0.18, 0.09, 'sine', 0);
  },
  // 기포 쪼개짐
  split() {
    noiseBurst(0.09, 3200, 0.22, 'highpass', 1.5, 0);
    tone(380, 160, 0.15, 0.14, 'sawtooth', 0.02);
  },
  // 초코 짜기
  choco() {
    noiseBurst(0.05, 950, 0.05, 'lowpass', 1.2, 0);
  },
  // 케이크 가게 문 열릴 때 맑은 문종 "딸랑~!"
  bell() {
    tone(1318.5, 1318.5, 0.42, 0.14, 'sine', 0);
    tone(2637.0, 2637.0, 0.28, 0.06, 'triangle', 0);
    tone(1760.0, 1760.0, 0.52, 0.15, 'sine', 0.14);
    tone(3520.0, 3520.0, 0.32, 0.05, 'triangle', 0.14);
  },
  // 초코 짤주머니 쫀득 분출 (굵기·압력 반영)
  chocoSqueeze(intensity = 0.5) {
    const f = 780 - Math.min(1, intensity) * 320;
    noiseBurst(0.055, f, 0.045 + intensity * 0.04, 'lowpass', 1.6, 0);
  },
  // 초코 실이 늘어나다 "톡!" 끊기는 소리
  chocoSnap() {
    tone(520, 980, 0.055, 0.11, 'sine', 0);
    noiseBurst(0.025, 2200, 0.06, 'bandpass', 2.4, 0.01);
  },
  // 한 자리에 오래 눌러 초코가 혹처럼 고일 때
  blobWarn() {
    tone(240, 165, 0.11, 0.09, 'triangle', 0);
  },
  // 매니큐어 촉촉한 붓질 소리
  brushStroke(speed = 0.5) {
    const f = 1450 + Math.min(1, speed) * 650;
    noiseBurst(0.048, f, 0.036 + Math.min(1, speed) * 0.025, 'bandpass', 2.6, 0);
  },
  // 옆 살에 매니큐어가 삐끗 묻었을 때 "아차!"
  smearOops() {
    tone(370, 185, 0.19, 0.14, 'sawtooth', 0);
    tone(250, 145, 0.22, 0.11, 'triangle', 0.08);
  },
  // 숨 참기 시작 "흡!"
  breathHold() {
    noiseBurst(0.12, 920, 0.07, 'bandpass', 1.8, 0);
    tone(420, 620, 0.10, 0.06, 'sine', 0);
  },
  // 숨 게이지 소진 "푸하헉!"
  gasp() {
    noiseBurst(0.20, 1300, 0.18, 'bandpass', 1.1, 0);
    tone(520, 210, 0.18, 0.13, 'sawtooth', 0);
  },
  // 젖은 매니큐어 위로 빛줄기가 영롱하게 흐를 때 "차르륵~✨"
  nailShine() {
    tone(1046.5, 1046.5, 0.16, 0.09, 'sine', 0);
    tone(1318.5, 1318.5, 0.18, 0.09, 'sine', 0.06);
    tone(1568.0, 1568.0, 0.22, 0.10, 'sine', 0.12);
    tone(2093.0, 2093.0, 0.36, 0.11, 'triangle', 0.18);
  },
  // 커터칼로 박스테이프를 가를 때 바삭한 마찰음 "드르륵—"
  tapeSlice(speed = 0.6) {
    const f = 2600 + Math.min(1, speed) * 1800;
    noiseBurst(0.045, f, 0.075 + Math.min(1, speed) * 0.05, 'bandpass', 2.4, 0);
  },
  // 택배 테이프가 끝까지 잘리며 상자 날개가 활짝 젖혀질 때 "촤악— 팍!"
  boxOpen(isPerfect = false) {
    noiseBurst(0.11, 3800, 0.26, 'bandpass', 1.8, 0);
    tone(210, 125, 0.12, 0.15, 'triangle', 0.03);
    if (isPerfect) {
      noiseBurst(0.08, 6800, 0.22, 'highpass', 1.3, 0.01);
      tone(880, 1760, 0.14, 0.14, 'triangle', 0.02);
    } else {
      tone(520, 780, 0.09, 0.10, 'sine', 0.02);
    }
  },
  // 칼각 슬라이스로 상자 안에서 선물이 튀어오를 때 "띠용~ 차르륵✨"
  giftPop() {
    tone(392.0, 784.0, 0.13, 0.16, 'sine', 0);
    tone(987.77, 987.77, 0.14, 0.12, 'triangle', 0.07);
    tone(1174.66, 1174.66, 0.16, 0.12, 'triangle', 0.13);
    tone(1567.98, 1567.98, 0.30, 0.15, 'sine', 0.19);
  },
  // 뒤쪽 대기열에 새 택배가 쿵! 떨어져 쌓일 때
  boxDrop(stackRatio = 0.3) {
    const baseF = 135 + stackRatio * 75;
    tone(baseF, 62, 0.11, 0.14, 'triangle', 0);
    noiseBurst(0.05, 850, 0.08, 'lowpass', 1.2, 0);
  },
  // 테이프 밖이나 너무 짧게 그어 골판지만 긁혔을 때 "틱!"
  boxScratch() {
    noiseBurst(0.07, 1650, 0.14, 'bandpass', 2.0, 0);
    tone(280, 180, 0.11, 0.10, 'sawtooth', 0.01);
  },
  // 중국집 문 열림 / 짬뽕 대접 등장 징·종 소리 "쩌어엉~!"
  gong() {
    tone(196.0, 192.0, 0.75, 0.20, 'triangle', 0);
    tone(293.66, 289.0, 0.62, 0.12, 'sawtooth', 0.01);
    noiseBurst(0.38, 1350, 0.14, 'bandpass', 1.4, 0);
  },
  // 사악한 짬뽕이 씨익 웃을 때 마성적인 보스 웃음 "크하하하핫!"
  evilLaugh() {
    const notes = [246.94, 233.08, 220.0, 207.65, 185.0];
    notes.forEach((f, i) => {
      tone(f * 1.12, f * 0.86, 0.11, 0.15, 'sawtooth', i * 0.115);
      tone(f * 0.5, f * 0.45, 0.12, 0.12, 'square', i * 0.115);
    });
  },
  // 나무 젓가락으로 면을 착! 집어 올리며 국물이 촤르륵 튈 때
  chopstickSnap(intensity = 0.6) {
    tone(1420, 920, 0.038, 0.11, 'triangle', 0);
    noiseBurst(0.085, 1950 + intensity * 900, 0.11 + intensity * 0.06, 'bandpass', 1.9, 0.03);
  },
  // 후루룩 특급 경보 & 대왕 방울 발사 "후루루룩—!!"
  slurpWarn() {
    noiseBurst(0.24, 1600, 0.16, 'bandpass', 2.2, 0);
    tone(330, 740, 0.22, 0.13, 'sawtooth', 0.02);
    tone(784, 523, 0.14, 0.12, 'square', 0.22);
  },
  // 국물 방울을 아슬아슬하게 스쳐 피했을 때 "슈슉! 팅✨"
  graze() {
    noiseBurst(0.045, 4800, 0.08, 'highpass', 1.6, 0);
    tone(1318.5, 1760.0, 0.07, 0.08, 'sine', 0.01);
  },
  // 새하얀 흰 티에 국물이 톡/철썩 튀었을 때 "첨벙— 으악!"
  stainHit(isFatal = false) {
    noiseBurst(isFatal ? 0.24 : 0.14, 1100, isFatal ? 0.26 : 0.18, 'lowpass', 1.2, 0);
    tone(380, isFatal ? 95 : 155, isFatal ? 0.34 : 0.20, 0.18, 'sawtooth', 0.01);
  },
  // 카메라 초점 일치 "삐빅!" 오토포커스 락온
  focusBeep() {
    tone(1567.98, 1567.98, 0.045, 0.08, 'sine', 0);
    tone(2093.0, 2093.0, 0.065, 0.09, 'sine', 0.055);
  },
  // 스마트폰 스냅 셔터 "찰칵!"
  shutterClick() {
    noiseBurst(0.032, 4200, 0.26, 'bandpass', 1.8, 0);
    tone(1200, 320, 0.035, 0.11, 'triangle', 0);
    noiseBurst(0.028, 2800, 0.20, 'highpass', 1.4, 0.048);
  },
  // 엉뚱한 방해물 돌발 난입 "꽥 / 띠용?!"
  quackChaos(pitchScale = 1.0) {
    tone(360 * pitchScale, 540 * pitchScale, 0.09, 0.13, 'sawtooth', 0);
    tone(520 * pitchScale, 290 * pitchScale, 0.12, 0.12, 'square', 0.08);
  },
  // 미션 사진 합격 도장 "딱! 반짝✨"
  photoPass() {
    tone(659.25, 987.77, 0.09, 0.13, 'triangle', 0);
    tone(1318.5, 1567.98, 0.18, 0.14, 'sine', 0.08);
  },
  // 방해물이 찍혔거나 타이밍이 빗나간 망친 사진 "어라?!"
  photoFail() {
    tone(330, 220, 0.14, 0.14, 'sawtooth', 0);
    tone(215, 145, 0.20, 0.12, 'triangle', 0.11);
  },
};

// ── 웅장한 4채널 8비트 칩튠 BGM 엔진 (Lead Square + Harmony/Arp Square + Triangle Bass + 8-bit Drums) ──
const BGM_MUTE_KEY = 'fgs.bgm.muted';
const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

// 64스텝(4마디 × 16분음표) 웅장한 8비트 곡 2종
// 0 = 쉼표, 양수 = MIDI 음번호
const TRACKS = {
  // 1) 「필살! 미용사!!」 테마 — D 단조(Dm - Bb - C - A7) 웅장한 일본 열혈 보스전 행진곡!
  haircut: {
    bpm: 142,
    lead: [
      // 마디 1 (Dm): 장엄한 영웅 도약 멜로디
      74, 0, 74, 77, 81, 0, 77, 74, 79, 0, 77, 76, 74, 0, 69, 0,
      // 마디 2 (Bb → C): 웅장하게 치고 올라감!
      70, 0, 74, 77, 82, 0, 81, 79, 79, 0, 76, 79, 84, 0, 81, 0,
      // 마디 3 (Dm → Gm): 격렬한 16분음표 연타 + 고음 절정!
      86, 0, 86, 84, 81, 0, 77, 81, 79, 0, 82, 81, 79, 77, 76, 74,
      // 마디 4 (A7 → Dm): 비장한 클라이맥스 마무리 + 도미넌트 해결!
      73, 0, 76, 79, 81, 0, 85, 81, 86, 0, 81, 77, 74, 0, 0, 0,
    ],
    // 화음 & 고속 8비트 아르페지오
    arp: [
      62, 65, 69, 74, 62, 65, 69, 74, 62, 65, 69, 74, 62, 65, 69, 65,
      58, 62, 65, 70, 58, 62, 65, 70, 60, 64, 67, 72, 60, 64, 67, 72,
      62, 65, 69, 74, 62, 65, 69, 74, 55, 58, 62, 67, 55, 58, 62, 67,
      57, 61, 64, 69, 57, 61, 64, 69, 62, 65, 69, 74, 69, 65, 62, 0,
    ],
    // 묵직하고 질주하는 트라이앵글 베이스
    bass: [
      50, 0, 50, 50, 57, 0, 50, 0, 50, 0, 53, 0, 57, 0, 53, 50,
      46, 0, 46, 46, 53, 0, 46, 0, 48, 0, 48, 48, 55, 0, 52, 48,
      50, 0, 50, 50, 57, 0, 53, 50, 43, 0, 43, 43, 50, 0, 46, 43,
      45, 0, 45, 45, 52, 0, 49, 45, 50, 0, 57, 0, 50, 50, 0, 0,
    ],
    // K=킥, S=스네어, H=하이햇
    drums: [
      'K','H','H','K','S','H','K','H','K','H','K','H','S','H','K','S',
      'K','H','H','K','S','H','K','H','K','H','K','H','S','H','S','H',
      'K','H','K','K','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','H','K','S','H','K','K','K','S','K','S','K','K','S','S',
    ],
  },

  // 2) 「필살! 강화필름!!」 테마 — C 단조(Cm - Ab - Bb - G7) 웅장한 파이널 보스전 초정밀 질주 테마!
  film: {
    bpm: 148,
    lead: [
      // 마디 1 (Cm): 긴장감 폭발하는 스타카토 웅장 리드
      72, 0, 75, 0, 79, 0, 75, 72, 80, 0, 79, 75, 74, 0, 79, 0,
      // 마디 2 (Ab → Bb): 대서사적 상승 화성!
      80, 0, 80, 79, 75, 0, 72, 75, 77, 0, 77, 79, 82, 0, 79, 0,
      // 마디 3 (Cm → Fm): 최고조 고음 질주!
      84, 0, 84, 82, 79, 0, 75, 79, 80, 0, 84, 82, 80, 79, 77, 75,
      // 마디 4 (G7 → Cm): 압도적 보스전 결정타!
      74, 0, 79, 0, 83, 0, 86, 83, 84, 0, 79, 75, 72, 0, 0, 0,
    ],
    arp: [
      60, 63, 67, 72, 60, 63, 67, 72, 60, 63, 67, 72, 60, 63, 67, 63,
      56, 60, 63, 68, 56, 60, 63, 68, 58, 62, 65, 70, 58, 62, 65, 70,
      60, 63, 67, 72, 60, 63, 67, 72, 53, 56, 60, 65, 53, 56, 60, 65,
      55, 59, 62, 67, 55, 59, 62, 67, 60, 63, 67, 72, 67, 63, 60, 0,
    ],
    bass: [
      48, 0, 48, 48, 55, 0, 48, 0, 48, 0, 51, 0, 55, 0, 51, 48,
      44, 0, 44, 44, 51, 0, 44, 0, 46, 0, 46, 46, 53, 0, 50, 46,
      48, 0, 48, 48, 55, 0, 51, 48, 41, 0, 41, 41, 48, 0, 44, 41,
      43, 0, 43, 43, 50, 0, 47, 43, 48, 0, 55, 0, 48, 48, 0, 0,
    ],
    drums: [
      'K','H','K','H','S','H','K','H','K','H','K','H','S','H','K','S',
      'K','H','H','K','S','H','K','H','K','H','K','K','S','H','S','H',
      'K','H','K','K','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','K','H','S','H','K','K','K','S','K','S','K','K','S','S',
    ],
  },

  // 3) 「무한 두루마리」 테마 — A 단조(Am - F - G - E7) 150 BPM, 웅장하고 중독적인 8비트 무한 질주곡!
  toilet: {
    bpm: 150,
    lead: [
      // 마디 1 (Am): 쾌속 회전 감각의 웅장한 리드
      69, 0, 72, 76, 81, 0, 79, 76, 72, 0, 74, 76, 79, 0, 76, 0,
      // 마디 2 (F → G): 두루마리 폭발 상승 구간!
      77, 0, 77, 76, 72, 0, 69, 72, 79, 0, 79, 81, 83, 0, 79, 0,
      // 마디 3 (Am → Dm): 100km를 향해 미라로 진화하는 클라이맥스!
      81, 0, 84, 83, 81, 0, 79, 76, 74, 0, 77, 81, 86, 0, 81, 77,
      // 마디 4 (E7 → Am): 비장한 턴어라운드 & 다시 돌돌돌돌!
      76, 0, 80, 83, 88, 0, 83, 80, 81, 0, 76, 72, 69, 0, 0, 0,
    ],
    arp: [
      57, 60, 64, 69, 57, 60, 64, 69, 57, 60, 64, 69, 57, 60, 64, 60,
      53, 57, 60, 65, 53, 57, 60, 65, 55, 59, 62, 67, 55, 59, 62, 67,
      57, 60, 64, 69, 57, 60, 64, 69, 50, 53, 57, 62, 50, 53, 57, 62,
      52, 56, 59, 64, 52, 56, 59, 64, 57, 60, 64, 69, 64, 60, 57, 0,
    ],
    bass: [
      45, 0, 45, 45, 52, 0, 45, 0, 45, 0, 48, 0, 52, 0, 48, 45,
      41, 0, 41, 41, 48, 0, 41, 0, 43, 0, 43, 43, 50, 0, 47, 43,
      45, 0, 45, 45, 52, 0, 48, 45, 50, 0, 50, 50, 57, 0, 53, 50,
      40, 0, 40, 40, 47, 0, 44, 40, 45, 0, 52, 0, 45, 45, 0, 0,
    ],
    drums: [
      'K','H','K','H','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','H','K','S','H','K','H','K','H','K','K','S','H','S','H',
      'K','H','K','K','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','K','H','S','H','K','K','K','S','K','S','K','K','S','S',
    ],
  },

  // 4) 「케이크 글씨 쓰기」 테마 — F 장조(F - Dm - Gm - C7) 132 BPM, 통통 튀고 달콤한 프랑스 베이커리 아케이드 곡!
  cake: {
    bpm: 132,
    lead: [
      77, 0, 81, 0, 84, 0, 81, 77, 74, 0, 77, 0, 81, 0, 0, 0,
      79, 0, 82, 0, 86, 0, 84, 82, 81, 0, 79, 0, 76, 0, 79, 0,
      77, 0, 81, 84, 89, 0, 88, 86, 84, 0, 81, 77, 74, 0, 77, 81,
      79, 0, 76, 79, 84, 0, 82, 79, 77, 0, 81, 79, 77, 0, 0, 0,
    ],
    arp: [
      65, 69, 72, 77, 65, 69, 72, 77, 62, 65, 69, 74, 62, 65, 69, 74,
      55, 58, 62, 67, 55, 58, 62, 67, 60, 64, 67, 70, 60, 64, 67, 72,
      65, 69, 72, 77, 65, 69, 72, 77, 62, 65, 69, 74, 62, 65, 69, 74,
      58, 62, 65, 70, 60, 64, 67, 72, 65, 69, 72, 77, 72, 69, 65, 0,
    ],
    bass: [
      53, 0, 60, 0, 53, 0, 60, 0, 50, 0, 57, 0, 50, 0, 57, 0,
      43, 0, 50, 0, 43, 0, 50, 0, 48, 0, 55, 0, 48, 0, 52, 55,
      53, 0, 60, 0, 53, 0, 57, 60, 50, 0, 57, 0, 50, 0, 53, 57,
      46, 0, 53, 0, 48, 0, 55, 0, 53, 0, 60, 57, 53, 0, 0, 0,
    ],
    drums: [
      'K','H','H','H','S','H','H','K','K','H','H','H','S','H','K','H',
      'K','H','H','H','S','H','H','K','K','H','K','H','S','H','S','H',
      'K','H','H','K','S','H','H','K','K','H','H','K','S','H','K','H',
      'K','H','K','H','S','H','K','H','K','S','K','H','K','0','0','0',
    ],
  },

  // 5) 「손톱 색칠하기」 테마 — Eb 장조/C 단조 시티팝 살롱 비트 (128 BPM, 세련되고 쫄깃한 네일샵 아케이드 곡!)
  nail: {
    bpm: 128,
    lead: [
      // 마디 1 (Abmaj7 → G7): 반짝이고 세련된 살롱 오프닝
      75, 0, 79, 0, 82, 0, 79, 75, 74, 0, 79, 0, 83, 0, 79, 0,
      // 마디 2 (Cm7 → Bbm7 - Eb7): 촉촉한 붓질 그루브
      72, 0, 75, 79, 84, 0, 82, 79, 77, 0, 82, 0, 87, 0, 82, 0,
      // 마디 3 (Abmaj7 → G7): 가장자리 아슬아슬 숨 참는 클라이맥스!
      84, 0, 84, 82, 79, 0, 75, 79, 83, 0, 86, 83, 79, 0, 74, 79,
      // 마디 4 (Cm7 → Fm7 - Bb7): 영롱한 풀컬러 마무리!
      84, 0, 79, 75, 72, 0, 75, 79, 82, 0, 79, 77, 75, 0, 0, 0,
    ],
    arp: [
      68, 72, 75, 79, 68, 72, 75, 79, 67, 71, 74, 79, 67, 71, 74, 79,
      60, 63, 67, 72, 60, 63, 67, 72, 58, 61, 65, 70, 63, 67, 70, 75,
      68, 72, 75, 79, 68, 72, 75, 79, 67, 71, 74, 79, 67, 71, 74, 79,
      60, 63, 67, 72, 65, 68, 72, 77, 67, 70, 74, 79, 75, 70, 67, 0,
    ],
    bass: [
      44, 0, 44, 51, 56, 0, 51, 44, 43, 0, 43, 50, 55, 0, 50, 43,
      48, 0, 48, 55, 60, 0, 55, 48, 46, 0, 46, 53, 51, 0, 58, 51,
      44, 0, 44, 51, 56, 0, 51, 44, 43, 0, 43, 50, 55, 0, 50, 43,
      48, 0, 55, 48, 41, 0, 48, 41, 46, 0, 53, 46, 51, 0, 0, 0,
    ],
    drums: [
      'K','H','H','K','S','H','H','K','K','H','K','H','S','H','K','H',
      'K','H','H','K','S','H','H','K','K','H','K','K','S','H','S','H',
      'K','H','K','H','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','H','K','S','H','K','H','K','S','K','H','S','0','0','0',
    ],
  },

  // 6) 「열려라 택배!」 테마 — G 장조(G - Em - C - D7) 146 BPM, 상쾌하고 질주감 넘치는 특급 언박싱 러시 아케이드 곡!
  boxcut: {
    bpm: 146,
    lead: [
      // 마디 1 (G → Em): 상쾌하게 테이프를 가르는 오프닝 멜로디
      79, 0, 83, 86, 91, 0, 86, 83, 88, 0, 86, 83, 79, 0, 76, 0,
      // 마디 2 (C → D7): 선물이 통통 튀어오르는 리드미컬 도약!
      84, 0, 84, 83, 79, 0, 84, 88, 86, 0, 81, 84, 90, 0, 86, 0,
      // 마디 3 (G → Bm - Em): 컨베이어 벨트 폭주 클라이맥스!
      91, 0, 91, 88, 86, 0, 83, 86, 88, 0, 91, 88, 86, 83, 81, 79,
      // 마디 4 (C - D7 → G): 칼각 피니시 & 다음 상자로 돌입!
      84, 0, 86, 88, 90, 0, 93, 90, 91, 0, 86, 83, 79, 0, 0, 0,
    ],
    arp: [
      67, 71, 74, 79, 67, 71, 74, 79, 64, 67, 71, 76, 64, 67, 71, 76,
      60, 64, 67, 72, 60, 64, 67, 72, 62, 66, 69, 74, 62, 66, 69, 74,
      67, 71, 74, 79, 66, 71, 74, 78, 64, 67, 71, 76, 64, 67, 71, 76,
      60, 64, 67, 72, 62, 66, 69, 74, 67, 71, 74, 79, 74, 71, 67, 0,
    ],
    bass: [
      43, 0, 43, 50, 55, 0, 50, 43, 40, 0, 40, 47, 52, 0, 47, 40,
      48, 0, 48, 55, 60, 0, 55, 48, 50, 0, 50, 57, 62, 0, 57, 50,
      43, 0, 43, 50, 47, 0, 47, 54, 40, 0, 40, 47, 52, 0, 47, 40,
      48, 0, 55, 48, 50, 0, 57, 50, 43, 0, 50, 55, 43, 0, 0, 0,
    ],
    drums: [
      'K','H','K','H','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','H','K','S','H','K','H','K','H','K','K','S','H','S','H',
      'K','H','K','K','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','K','H','S','H','K','K','K','S','K','S','K','K','S','S',
    ],
  },

  // 7) 「짬뽕 탄막」 테마 — D 단조 동양풍 오음음계 + 열혈 탄막 보스전 질주곡 (152 BPM)!
  jjamppong: {
    bpm: 152,
    lead: [
      // 마디 1 (Dm 동양풍 오음 도약): 사악한 짬뽕 등장 & 젓가락 개전!
      74, 0, 77, 79, 81, 0, 86, 81, 79, 0, 77, 74, 72, 0, 74, 0,
      // 마디 2 (Gm → Bb - A7): 사방으로 튀는 고추기름 탄막 세례!
      79, 0, 81, 82, 86, 0, 84, 81, 82, 0, 81, 79, 81, 0, 73, 0,
      // 마디 3 (Dm → C - Bb): 후루룩 폭풍 연사 & 아슬아슬 회피 질주!
      86, 0, 89, 86, 84, 0, 81, 79, 84, 0, 86, 84, 81, 79, 77, 74,
      // 마디 4 (Gm - A7 → Dm): 대왕 국물 방울 피날레 & 루프 돌입!
      79, 0, 82, 79, 81, 0, 85, 88, 86, 0, 81, 77, 74, 0, 0, 0,
    ],
    arp: [
      62, 65, 69, 74, 62, 65, 69, 74, 60, 65, 69, 72, 62, 65, 69, 74,
      55, 58, 62, 67, 55, 58, 62, 67, 58, 62, 65, 70, 57, 61, 64, 69,
      62, 65, 69, 74, 62, 65, 69, 74, 60, 64, 67, 72, 58, 62, 65, 70,
      55, 58, 62, 67, 57, 61, 64, 69, 62, 65, 69, 74, 69, 65, 62, 0,
    ],
    bass: [
      50, 0, 50, 50, 57, 0, 50, 0, 48, 0, 48, 50, 50, 0, 57, 50,
      43, 0, 43, 43, 50, 0, 43, 0, 46, 0, 46, 46, 45, 0, 52, 45,
      50, 0, 50, 50, 57, 0, 53, 50, 48, 0, 48, 48, 46, 0, 53, 46,
      43, 0, 50, 43, 45, 0, 52, 45, 50, 0, 57, 50, 50, 0, 0, 0,
    ],
    drums: [
      'K','H','K','H','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','H','K','S','H','K','H','K','H','K','K','S','H','S','H',
      'K','H','K','K','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','K','H','S','H','K','K','K','S','K','S','K','K','S','S',
    ],
  },

  // 8) 「웨딩·여행 스냅 알바」 테마 — C 장조 업템포 스윙 팝 아케이드 곡 (136 BPM, 설레는 야외 결혼식 & 여행지 소동 테마!)
  snap: {
    bpm: 136,
    lead: [
      // 마디 1 (Cmaj7 → A7): 산뜻한 햇살 아래 셔터를 누르는 경쾌한 오프닝
      76, 0, 79, 84, 88, 0, 84, 79, 81, 0, 85, 88, 85, 0, 81, 0,
      // 마디 2 (Dm7 → G7): 오리와 외계인이 뛰어들어도 꿋꿋이 찍는 통통 튀는 리듬!
      77, 0, 81, 84, 86, 0, 84, 81, 79, 0, 83, 86, 89, 0, 86, 0,
      // 마디 3 (Em7 → Am7): 골든 타이밍 클라이맥스 연사!
      88, 0, 91, 88, 86, 0, 84, 79, 84, 0, 88, 84, 81, 79, 76, 79,
      // 마디 4 (Dm7 - G7 → C): 100% 일치 퍼펙트 컷 마무리!
      77, 0, 81, 84, 86, 0, 91, 89, 88, 0, 84, 79, 76, 0, 0, 0,
    ],
    arp: [
      60, 64, 67, 72, 60, 64, 67, 72, 57, 61, 64, 69, 57, 61, 64, 69,
      62, 65, 69, 74, 62, 65, 69, 74, 55, 59, 62, 67, 55, 59, 62, 67,
      64, 67, 71, 76, 64, 67, 71, 76, 57, 60, 64, 69, 57, 60, 64, 69,
      62, 65, 69, 74, 55, 59, 62, 67, 60, 64, 67, 72, 67, 64, 60, 0,
    ],
    bass: [
      48, 0, 55, 0, 48, 0, 52, 55, 45, 0, 52, 0, 45, 0, 49, 52,
      50, 0, 57, 0, 50, 0, 53, 57, 43, 0, 50, 0, 43, 0, 47, 50,
      52, 0, 59, 0, 52, 0, 55, 59, 45, 0, 52, 0, 45, 0, 48, 52,
      50, 0, 57, 50, 43, 0, 50, 47, 48, 0, 55, 52, 48, 0, 0, 0,
    ],
    drums: [
      'K','H','H','K','S','H','H','K','K','H','K','H','S','H','K','H',
      'K','H','H','K','S','H','H','K','K','H','K','K','S','H','S','H',
      'K','H','K','H','S','H','K','H','K','H','K','K','S','H','K','S',
      'K','H','H','K','S','H','K','K','K','S','K','H','K','0','0','0',
    ],
  },
};

let bgmTimer = null;
let bgmMaster = null;
let bgmNoiseBuf = null;
let bgmTrackKey = null;
let bgmStep = 0;
let bgmNextTime = 0;
let bgmUrgent = false;
let bgmMuted = localStorage.getItem(BGM_MUTE_KEY) === '1';

function ensureBgmNodes(c) {
  if (!bgmMaster) {
    bgmMaster = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5400; // 8비트 특유의 날카로운 귀 따가움만 부드럽게 정돈
    bgmMaster.gain.value = bgmMuted ? 0 : 0.24;
    bgmMaster.connect(lp);
    lp.connect(c.destination);
  }
  if (!bgmNoiseBuf) {
    const len = Math.floor(c.sampleRate * 0.14);
    bgmNoiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = bgmNoiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
}

function playChipNote(c, midi, t0, dur, wave, vol, detune = 0) {
  if (!midi || midi <= 0) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = wave;
  o.frequency.setValueAtTime(midiToHz(midi), t0);
  if (detune) o.detune.setValueAtTime(detune, t0);
  g.gain.setValueAtTime(0.0008, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.setValueAtTime(vol * 0.82, t0 + Math.max(0.015, dur * 0.65));
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g).connect(bgmMaster);
  o.start(t0);
  o.stop(t0 + dur + 0.015);
}

function playChipDrum(c, kind, t0) {
  if (kind === 'K') {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(155, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.09);
    g.gain.setValueAtTime(0.32, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.10);
    o.connect(g).connect(bgmMaster);
    o.start(t0); o.stop(t0 + 0.11);
  } else if (kind === 'S') {
    const src = c.createBufferSource();
    src.buffer = bgmNoiseBuf;
    const flt = c.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 1800; flt.Q.value = 0.9;
    const g = c.createGain();
    g.gain.setValueAtTime(0.18, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
    src.connect(flt).connect(g).connect(bgmMaster);
    src.start(t0); src.stop(t0 + 0.12);
  } else if (kind === 'H') {
    const src = c.createBufferSource();
    src.buffer = bgmNoiseBuf;
    const flt = c.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 5800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.055, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.032);
    src.connect(flt).connect(g).connect(bgmMaster);
    src.start(t0); src.stop(t0 + 0.04);
  }
}

function scheduleBgm() {
  const c = ensureCtx();
  if (!c || !bgmTrackKey) return;
  if (bgmMuted) {
    bgmNextTime = c.currentTime + 0.06;
    return;
  }
  const tr = TRACKS[bgmTrackKey] || TRACKS.haircut;
  const bpm = tr.bpm * (bgmUrgent ? 1.12 : 1.0);
  const stepSec = 60 / bpm / 4; // 16분음표 단위

  while (bgmNextTime < c.currentTime + 0.14) {
    const idx = bgmStep % 64;
    const leadNote = tr.lead[idx];
    const arpNote = tr.arp[idx];
    const bassNote = tr.bass[idx];
    const drum = tr.drums[idx];

    // 리드 (두꺼운 8비트 웅장 사운드: 메인 + 미세 디튠 옥타브 하모니)
    if (leadNote) {
      playChipNote(c, leadNote, bgmNextTime, stepSec * 1.65, 'square', 0.16, 0);
      playChipNote(c, leadNote - 12, bgmNextTime, stepSec * 1.4, 'square', 0.055, 6);
    }
    // 고속 아르페지오 반주
    if (arpNote) {
      playChipNote(c, arpNote, bgmNextTime, stepSec * 0.85, 'square', 0.068, -4);
    }
    // 묵직한 8비트 베이스
    if (bassNote) {
      playChipNote(c, bassNote, bgmNextTime, stepSec * 1.5, 'triangle', 0.28, 0);
    }
    // 8비트 드럼
    if (drum) playChipDrum(c, drum, bgmNextTime);

    bgmNextTime += stepSec;
    bgmStep = (bgmStep + 1) % 64;
  }
}

export const BGM = {
  start(trackKey = 'haircut') {
    const c = ensureCtx();
    if (!c) return;
    ensureBgmNodes(c);
    if (bgmTrackKey === trackKey && bgmTimer) return;
    this.stop();
    bgmTrackKey = TRACKS[trackKey] ? trackKey : 'haircut';
    bgmStep = 0;
    bgmUrgent = false;
    bgmNextTime = c.currentTime + 0.04;
    bgmMaster.gain.setTargetAtTime(bgmMuted ? 0 : 0.24, c.currentTime, 0.03);
    bgmTimer = setInterval(scheduleBgm, 35);
  },
  stop() {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    bgmTrackKey = null;
  },
  setUrgent(flag) {
    bgmUrgent = !!flag;
  },
  setMuted(flag) {
    bgmMuted = !!flag;
    localStorage.setItem(BGM_MUTE_KEY, bgmMuted ? '1' : '0');
    const c = ensureCtx();
    if (c && bgmMaster) {
      bgmMaster.gain.cancelScheduledValues(c.currentTime);
      if (bgmMuted) {
        bgmMaster.gain.setValueAtTime(0, c.currentTime);
      } else {
        bgmNextTime = c.currentTime + 0.04;
        bgmMaster.gain.setTargetAtTime(0.24, c.currentTime, 0.03);
      }
    }
    return bgmMuted;
  },
  toggleMute() {
    return this.setMuted(!bgmMuted);
  },
  isMuted() {
    return bgmMuted;
  },
};
