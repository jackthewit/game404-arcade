// 필살! 강화필름!! — Three.js 3D 멀티앵글 초정밀 보호필름 부착 열혈 액션
// 1. 기종 선택: 아이폰 최신형(둥근 모서리 · 알약 구멍) / 갤럭시 최신형(각진 모서리 · 원형 펀치홀)
// 2. 화려한 사전 오프닝(초저각 시네마틱 스윕 → 강화필름 360° 공중제비 → 이형지 비닐 '찌이이익!!' 뜯어내기 → 탑뷰 급상승!)
// 3. 3가지 구도(탑 · 프론트 · 레프트) + 구도 전환 펀치 + 강한 복합 손떨림 + 정빵 포착 십자 섬광!
// 4. 필름 투하 일섬(히트스톱 · 임팩트 플래시 · 3D 충격파 · '착—!!') → 접착선 대각선 추적 카메라 무빙 → 8.5초 경화 기포 격파 → 360° 영광의 오빗 감상 + 거대 판정 도장!

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SFX, BGM, unlockAudio } from '../shared/audio.js';
import { enforceGameAccess } from '../shared/catalog.js';
enforceGameAccess('film');
import {
  loadIncomingChallenge,
  saveResultAndBuildShare,
  renderGlobalLadderHTML,
  shareChallengeLink,
  downloadResultCard,
  getSavedNickname,
  saveNickname,
  getBestRecord,
  updateBestRecord,
  showToast,
} from '../shared/challenge.js';

const gl = document.getElementById('gl');
const ov = document.getElementById('ov');
const ovCtx = ov.getContext('2d');

const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c7a47e');
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();
}

const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 180);

// ── 열혈 필름 액션 전용 Web Audio 신스 ──
let _filmAC = null;
function getFilmAC() {
  try {
    if (!_filmAC) _filmAC = new (window.AudioContext || window.webkitAudioContext)();
    if (_filmAC.state === 'suspended') _filmAC.resume();
    return _filmAC;
  } catch { return null; }
}
const FILM_SFX = {
  camWhoosh(pitch = 1) {
    const ac = getFilmAC(); if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(220 * pitch, now);
    o.frequency.exponentialRampToValueAtTime(640 * pitch, now + 0.14);
    o.frequency.exponentialRampToValueAtTime(180 * pitch, now + 0.30);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.10, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    o.connect(g).connect(ac.destination);
    o.start(now); o.stop(now + 0.34);
  },
  peelRip() {
    // 이형지 비닐 찌이이익!! 뜯는 시원한 사운드
    const ac = getFilmAC(); if (!ac) return;
    const now = ac.currentTime;
    const bufLen = Math.floor(ac.sampleRate * 0.42);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen * 0.4);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(1400, now);
    flt.frequency.exponentialRampToValueAtTime(5200, now + 0.36);
    flt.Q.value = 3.2;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(flt).connect(g).connect(ac.destination);
    src.start(now);
  },
  gustBlow() {
    const ac = getFilmAC(); if (!ac) return;
    const now = ac.currentTime;
    const bufLen = Math.floor(ac.sampleRate * 0.28);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(900, now);
    flt.frequency.exponentialRampToValueAtTime(2400, now + 0.12);
    flt.frequency.exponentialRampToValueAtTime(500, now + 0.28);
    flt.Q.value = 1.6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.26, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    src.connect(flt).connect(g).connect(ac.destination);
    src.start(now);
  },
  glint() {
    const ac = getFilmAC(); if (!ac) return;
    const now = ac.currentTime;
    [1568, 2349, 3136].forEach((f, idx) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now + idx * 0.02);
      g.gain.setValueAtTime(0.001, now + idx * 0.02);
      g.gain.linearRampToValueAtTime(0.075, now + idx * 0.02 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.02 + 0.26);
      o.connect(g).connect(ac.destination);
      o.start(now + idx * 0.02); o.stop(now + idx * 0.02 + 0.28);
    });
  },
  dropImpact() {
    const ac = getFilmAC(); if (!ac) return;
    const now = ac.currentTime;
    // 1) 유리 착지 고음
    const hi = ac.createOscillator();
    const hg = ac.createGain();
    hi.type = 'triangle';
    hi.frequency.setValueAtTime(2200, now);
    hi.frequency.exponentialRampToValueAtTime(620, now + 0.18);
    hg.gain.setValueAtTime(0.18, now);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    hi.connect(hg).connect(ac.destination);
    hi.start(now); hi.stop(now + 0.22);
    // 2) 타이코 베이스 쾅!!
    const lo = ac.createOscillator();
    const lg = ac.createGain();
    lo.type = 'sine';
    lo.frequency.setValueAtTime(175, now);
    lo.frequency.exponentialRampToValueAtTime(42, now + 0.30);
    lg.gain.setValueAtTime(0.32, now);
    lg.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    lo.connect(lg).connect(ac.destination);
    lo.start(now); lo.stop(now + 0.36);
  },
  stampBoom(isDisaster = false) {
    const ac = getFilmAC(); if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = isDisaster ? 'sawtooth' : 'sine';
    o.frequency.setValueAtTime(isDisaster ? 125 : 210, now);
    o.frequency.exponentialRampToValueAtTime(isDisaster ? 38 : 60, now + 0.26);
    g.gain.setValueAtTime(isDisaster ? 0.22 : 0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    o.connect(g).connect(ac.destination);
    o.start(now); o.stop(now + 0.32);
  },
};

// ── 기종 스펙 (아이폰 최신형 / 갤럭시 최신형) ──
const PHONE_MODELS = {
  iphone: {
    id: 'iphone',
    name: '아이폰 최신형',
    pw: 7.15,
    ph: 14.6,
    pr: 0.96,
    holeType: 'pill',
    holeZRatio: -0.425,
    bezels: ['#c8c2b8', '#2a2c30', '#d8c7b0'],
  },
  galaxy: {
    id: 'galaxy',
    name: '갤럭시 최신형',
    pw: 7.65,
    ph: 15.6,
    pr: 0.34,
    holeType: 'circle',
    holeZRatio: -0.455,
    bezels: ['#9aa1ad', '#24272d', '#7ea1c4'],
  },
};

let curSpec = PHONE_MODELS.iphone;

// 3가지 3D 시점 프리셋 (탑 · 프론트 · 레프트)
function getCamPreset(key) {
  const presets = {
    top:      { pos: new THREE.Vector3(0, 38.5, 0.001), look: new THREE.Vector3(0, 0, 0),    sens: 0.0115 },
    front:    { pos: new THREE.Vector3(0, 2.5, 19.5),   look: new THREE.Vector3(0, 0.4, 0),  sens: 0.0065 },
    sideLeft: { pos: new THREE.Vector3(-16.5, 2.5, 0),  look: new THREE.Vector3(0, 0.4, 0),  sens: 0.0065 },
    glory:    { pos: new THREE.Vector3(10.0, 21.5, 17.5), look: new THREE.Vector3(0, 0.2, 0), sens: 0.0080 },
  };
  return presets[key] || presets.top;
}

const camCurPos = getCamPreset('top').pos.clone();
const camCurLook = getCamPreset('top').look.clone();

// 조명
scene.add(new THREE.HemisphereLight('#ffffff', '#b5926b', 1.05));
const lamp = new THREE.DirectionalLight('#fffaf2', 1.85);
lamp.position.set(-10, 28, 12);
lamp.castShadow = true;
lamp.shadow.mapSize.set(1024, 1024);
scene.add(lamp);

// ── 3D 밝은 원목 책상 + 키치 작업 매트 포인트 ──
{
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#cda87f';
  g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 6) {
    g.fillStyle = x % 12 === 0 ? 'rgba(110,70,30,0.08)' : 'rgba(255,240,220,0.06)';
    g.fillRect(x, 0, 3, 512);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.68, metalness: 0.03 })
  );
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.95;
  desk.receiveShadow = true;
  scene.add(desk);

  // 책상 위 검은 프로 작업 매트 (격자 눈금 + 강렬한 포인트!)
  const mc = document.createElement('canvas');
  mc.width = 512; mc.height = 768;
  const mg = mc.getContext('2d');
  mg.fillStyle = '#1b1d28';
  mg.fillRect(0, 0, 512, 768);
  mg.strokeStyle = 'rgba(255, 226, 74, 0.14)';
  mg.lineWidth = 2;
  for (let x = 0; x <= 512; x += 32) { mg.beginPath(); mg.moveTo(x, 0); mg.lineTo(x, 768); mg.stroke(); }
  for (let y = 0; y <= 768; y += 32) { mg.beginPath(); mg.moveTo(0, y); mg.lineTo(512, y); mg.stroke(); }
  mg.strokeStyle = '#ffd84a';
  mg.lineWidth = 8;
  mg.strokeRect(12, 12, 488, 744);
  mg.fillStyle = 'rgba(255, 226, 74, 0.45)';
  mg.font = 'italic 900 26px Pretendard, sans-serif';
  mg.textAlign = 'center';
  mg.fillText('필살! 강화필름 부착대 · 0.1mm 정조준', 256, 728);
  const mTex = new THREE.CanvasTexture(mc);
  mTex.colorSpace = THREE.SRGBColorSpace;
  const matMesh = new THREE.Mesh(
    new THREE.BoxGeometry(15.5, 0.10, 23.0),
    new THREE.MeshStandardMaterial({ map: mTex, roughness: 0.78 })
  );
  matMesh.position.set(0, -0.89, 0);
  matMesh.receiveShadow = true;
  scene.add(matMesh);
}

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}

// ── 동적 기종 3D 폰 & 3D 강화필름 + 파란 이형지 비닐 + 3D 충격파 링 ──
const phoneGroup = new THREE.Group();
scene.add(phoneGroup);

const filmGroup = new THREE.Group();
scene.add(filmGroup);

const peelGroup = new THREE.Group();
peelGroup.visible = false;
scene.add(peelGroup);

const shockRingMat = new THREE.MeshBasicMaterial({ color: '#ffe24a', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
const shockRing = new THREE.Mesh(new THREE.RingGeometry(4.2, 5.2, 40), shockRingMat);
shockRing.rotation.x = -Math.PI / 2;
shockRing.position.y = 0.08;
scene.add(shockRing);

const bezelMat = new THREE.MeshStandardMaterial({ color: '#c8c2b8', roughness: 0.25, metalness: 0.72 });
const screenMat = new THREE.MeshPhysicalMaterial({
  color: '#0c0f16', roughness: 0.12, metalness: 0.06, clearcoat: 1.0, clearcoatRoughness: 0.06
});
const unbondedMat = new THREE.MeshBasicMaterial({ color: '#d8e9fa', transparent: true, opacity: 0, depthWrite: false });
const frontLineMat = new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0, depthWrite: false });
const sheenMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
const filmGlassMat = new THREE.MeshPhysicalMaterial({
  color: '#d9efff', transparent: true, opacity: 0.22,
  roughness: 0.08, metalness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.05, depthWrite: false
});
const filmBorderMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.94 });
const holeRingMat = new THREE.LineBasicMaterial({ color: '#f87171' });

let unbondedMesh = null;
let frontLineMesh = null;
let sheenMesh = null;
let holeRing = null;

function rebuildPhoneAndFilm(modelKey, seed = 1) {
  curSpec = PHONE_MODELS[modelKey] || PHONE_MODELS.iphone;
  const { pw, ph, pr, holeType, holeZRatio, bezels } = curSpec;
  const holeZ = ph * holeZRatio;

  while (phoneGroup.children.length) phoneGroup.remove(phoneGroup.children[0]);
  while (filmGroup.children.length) filmGroup.remove(filmGroup.children[0]);
  while (peelGroup.children.length) peelGroup.remove(peelGroup.children[0]);

  bezelMat.color.set(bezels[Math.abs(seed) % bezels.length]);
  screenMat.color.set('#0c0f16');

  // 1) 폰 금속 본체
  const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(pw + 0.36, ph + 0.36, pr + 0.12), {
    depth: 0.78, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4
  });
  bodyGeo.rotateX(Math.PI / 2);
  const phoneBody = new THREE.Mesh(bodyGeo, bezelMat);
  phoneBody.position.y = -0.10;
  phoneBody.castShadow = true;
  phoneBody.receiveShadow = true;
  phoneGroup.add(phoneBody);

  // 측면 버튼 디테일
  const sideBtnMat = new THREE.MeshStandardMaterial({ color: '#8f96a3', roughness: 0.22, metalness: 0.85 });
  const rBtn = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.20, 1.45), sideBtnMat);
  rBtn.position.set(pw / 2 + 0.24, -0.44, -1.6);
  phoneGroup.add(rBtn);
  const lBtn1 = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.20, 1.1), sideBtnMat);
  lBtn1.position.set(-pw / 2 - 0.24, -0.44, -2.8);
  phoneGroup.add(lBtn1);
  const lBtn2 = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.20, 1.1), sideBtnMat);
  lBtn2.position.set(-pw / 2 - 0.24, -0.44, -1.2);
  phoneGroup.add(lBtn2);

  // 2) 검은 강화유리 화면 (y = 0.02)
  const screenGeo = new THREE.ShapeGeometry(roundedRectShape(pw, ph, pr), 16);
  screenGeo.rotateX(-Math.PI / 2);
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.position.y = 0.02;
  screenMesh.receiveShadow = true;
  phoneGroup.add(screenMesh);

  // 베젤 정렬 기준선
  const phoneEdgePts = roundedRectShape(pw - 0.06, ph - 0.06, Math.max(0.08, pr - 0.03))
    .getPoints(48).map(p => new THREE.Vector3(p.x, 0.036, -p.y));
  phoneGroup.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(phoneEdgePts),
    new THREE.LineBasicMaterial({ color: '#526075', transparent: true, opacity: 0.72 })
  ));

  // 형광등 두 줄 반사
  const reflMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.08, depthWrite: false });
  for (const rx of [-pw * 0.24, pw * 0.23]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.62, ph - 1.2), reflMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(rx, 0.032, 0);
    phoneGroup.add(strip);
  }

  // 3) 기종별 카메라 구멍
  if (holeType === 'pill') {
    const pillGeo = new THREE.ShapeGeometry(roundedRectShape(1.55, 0.44, 0.22), 12);
    pillGeo.rotateX(-Math.PI / 2);
    const hole = new THREE.Mesh(pillGeo, new THREE.MeshBasicMaterial({ color: '#020305' }));
    hole.position.set(0, 0.038, holeZ);
    phoneGroup.add(hole);
  } else {
    const punch = new THREE.Mesh(new THREE.CircleGeometry(0.24, 24), new THREE.MeshBasicMaterial({ color: '#020305' }));
    punch.rotation.x = -Math.PI / 2;
    punch.position.set(0, 0.038, holeZ);
    phoneGroup.add(punch);
    const lensRing = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.29, 24), new THREE.MeshBasicMaterial({ color: '#273040' }));
    lensRing.rotation.x = -Math.PI / 2;
    lensRing.position.set(0, 0.039, holeZ);
    phoneGroup.add(lensRing);
  }

  const spkSlot = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.07), new THREE.MeshBasicMaterial({ color: '#1e2430' }));
  spkSlot.rotation.x = -Math.PI / 2;
  spkSlot.position.set(0, 0.039, -ph * 0.486);
  phoneGroup.add(spkSlot);

  // 접착 효과 메시
  unbondedMesh = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.25, ph - 0.25), unbondedMat);
  unbondedMesh.rotation.x = -Math.PI / 2;
  unbondedMesh.position.y = 0.055;
  phoneGroup.add(unbondedMesh);

  frontLineMesh = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.16, 0.42), frontLineMat);
  frontLineMesh.rotation.x = -Math.PI / 2;
  frontLineMesh.position.y = 0.065;
  phoneGroup.add(frontLineMesh);

  sheenMesh = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.1, 2.4), sheenMat);
  sheenMesh.rotation.x = -Math.PI / 2;
  sheenMesh.position.y = 0.09;
  phoneGroup.add(sheenMesh);

  // 4) 기종에 딱 맞는 3D 강화유리 보호필름
  const filmExtrude = new THREE.ExtrudeGeometry(roundedRectShape(pw - 0.06, ph - 0.06, Math.max(0.08, pr - 0.03)), {
    depth: 0.08, bevelEnabled: false
  });
  filmExtrude.rotateX(Math.PI / 2);
  const filmMesh = new THREE.Mesh(filmExtrude, filmGlassMat);
  filmMesh.position.y = 0.04;
  filmGroup.add(filmMesh);

  const fBorderPts = roundedRectShape(pw - 0.06, ph - 0.06, Math.max(0.08, pr - 0.03))
    .getPoints(48).map(p => new THREE.Vector3(p.x, 0.05, -p.y));
  filmGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(fBorderPts), filmBorderMat));

  let hPts;
  if (holeType === 'pill') {
    hPts = roundedRectShape(1.62, 0.50, 0.25).getPoints(32).map(p => new THREE.Vector3(p.x, 0.055, -p.y + holeZ));
  } else {
    hPts = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      hPts.push(new THREE.Vector3(Math.cos(a) * 0.31, 0.055, Math.sin(a) * 0.31 + holeZ));
    }
  }
  holeRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(hPts), holeRingMat);
  filmGroup.add(holeRing);

  // 5) 인트로 박리 액션용 파란 이형지 비닐 + 노란 뜯기 탭!
  const peelSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(pw - 0.12, ph - 0.12),
    new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  peelSheet.rotation.x = -Math.PI / 2;
  peelGroup.add(peelSheet);
  const peelTab = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.06, 1.0),
    new THREE.MeshBasicMaterial({ color: '#ffe24a' })
  );
  peelTab.position.set(pw * 0.25, 0.02, ph * 0.52);
  peelGroup.add(peelTab);

  const mp = document.getElementById('model-pill');
  if (mp) mp.textContent = `📱 ${curSpec.name}`;
}

// ── 3D 먼지 / 기포 / 뽁 이펙트 / 3D 스퀴지 카드 ──
const dustGroup = new THREE.Group();
scene.add(dustGroup);
const dustGeo = new THREE.SphereGeometry(0.105, 10, 8);
const dustMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

const bubbleGroup = new THREE.Group();
scene.add(bubbleGroup);
const bubbleGeo = new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55);

const popGroup = new THREE.Group();
scene.add(popGroup);

const cardGroup = new THREE.Group();
cardGroup.visible = false;
scene.add(cardGroup);
{
  const cardBody = new THREE.Mesh(
    new THREE.BoxGeometry(3.3, 0.12, 1.9),
    new THREE.MeshStandardMaterial({ color: '#0d9488', roughness: 0.32, metalness: 0.12 })
  );
  cardBody.position.set(0, 0.55, 0.85);
  cardBody.rotation.x = 0.48;
  cardBody.castShadow = true;
  cardGroup.add(cardBody);

  const felt = new THREE.Mesh(
    new THREE.BoxGeometry(3.32, 0.16, 0.22),
    new THREE.MeshStandardMaterial({ color: '#f0fdfa', roughness: 0.8 })
  );
  felt.position.set(0, 0.14, 0);
  cardGroup.add(felt);

  const edgeGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 0.28),
    new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.72, depthWrite: false })
  );
  edgeGlow.rotation.x = -Math.PI / 2;
  edgeGlow.position.set(0, 0.06, -0.15);
  edgeGlow.name = 'edgeGlow';
  cardGroup.add(edgeGlow);
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const glassPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPt = new THREE.Vector3();

function pointerToWorld(e) {
  const r = gl.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.intersectPlane(glassPlane, hitPt) ? hitPt.clone() : null;
}

function makeRng(seed) {
  let s = (seed | 0) || 123;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 열혈 2D VFX 상태 ──
let viewW = window.innerWidth;
let viewH = window.innerHeight;
let baseFov = 30;

const vfx = {
  sparks: [],
  pops: [],
  gustLines: [],
  impactFlash: 0,
  shakeMag: 0,
  fovPunch: 0,
  shockProg: 0,
  cutInText: '',
  cutInSub: '',
  cutInColor: '#e11d48',
  cutInAlpha: 0,
  cutInSlide: 0,
  introPeelFired: false,
  bullseyeGlintCool: 0,
  stampAnim: 0,
  stampInfo: null,
  orbitAngle: 0,
};

function worldToScreen(wx, wy, wz) {
  const v = new THREE.Vector3(wx, wy, wz).project(camera);
  return { x: (v.x + 1) * 0.5 * viewW, y: (1 - v.y) * 0.5 * viewH };
}

function spawnSparks(sx, sy, count = 24, palette = ['#ffe24a', '#38bdf8', '#ffffff', '#ff3b5c']) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 150 + Math.random() * 520;
    vfx.sparks.push({
      x: sx, y: sy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 60,
      size: 3 + Math.random() * 6,
      len: 10 + Math.random() * 22,
      col: palette[i % palette.length],
      life: 0.30 + Math.random() * 0.40,
      maxLife: 0.70,
      confetti: false,
      rot: ang,
      vrot: (Math.random() - 0.5) * 12,
    });
  }
}

function spawnConfetti(count = 55) {
  const cols = ['#ffe24a', '#ff3b5c', '#4ade80', '#38bdf8', '#f472b6', '#ffffff'];
  for (let i = 0; i < count; i++) {
    vfx.sparks.push({
      x: viewW * (0.12 + Math.random() * 0.76),
      y: viewH * (0.14 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 440,
      vy: -220 - Math.random() * 340,
      size: 6 + Math.random() * 7,
      len: 12 + Math.random() * 8,
      col: cols[i % cols.length],
      life: 1.5 + Math.random() * 1.2,
      maxLife: 2.7,
      confetti: true,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 14,
    });
  }
}

function spawnGustLines() {
  for (let i = 0; i < 16; i++) {
    vfx.gustLines.push({
      x: -viewW * 0.25 - Math.random() * 180,
      y: viewH * (0.2 + Math.random() * 0.6),
      w: 120 + Math.random() * 220,
      vx: 1600 + Math.random() * 900,
      life: 0.38,
      maxLife: 0.38,
    });
  }
}

function spawnPopText(text, sub, sx, sy, opts = {}) {
  vfx.pops.push({
    text,
    sub: sub || '',
    x: sx,
    y: sy,
    size: opts.size || 46,
    color: opts.color || '#ffe24a',
    stroke: opts.stroke || '#16111f',
    shadow: opts.shadow || '#e11d48',
    rot: opts.rot != null ? opts.rot : (-0.12 + Math.random() * 0.20),
    life: opts.life || 0.75,
    maxLife: opts.life || 0.75,
    vy: opts.vy != null ? opts.vy : -32,
  });
}

function triggerCutIn(title, sub, color = '#e11d48') {
  vfx.cutInText = title;
  vfx.cutInSub = sub;
  vfx.cutInColor = color;
  vfx.cutInAlpha = 1.0;
  vfx.cutInSlide = 0;
}

const STREAK_KEY = 'fgs.film.streak';
const HARDEN_SEC = 8.5;

const state = {
  phase: 'start',
  modelKey: 'iphone',
  camKey: 'top',
  seed: Math.floor(Math.random() * 9999) + 1,
  rng: null,
  t: 0,
  introAnim: 0,
  hitStopTimer: 0,
  holdSec: 0,
  streak: Number(localStorage.getItem(STREAK_KEY) || 0),
  filmX: 0.55,
  filmZ: -0.45,
  filmAngleDeg: 2.2,
  liveFilmX: 0.55,
  liveFilmZ: -0.45,
  liveAngleDeg: 2.2,
  slipVelX: 0,
  slipVelZ: 0,
  slipAngVel: 0,
  shakeBoost: 0,
  filmTiltX: 0,
  filmTiltZ: 0,
  dragging: false,
  lastPx: { x: 0, y: 0 },
  lastW: null,
  adhereP: 0,
  dusts: [],
  nextDustAt: 2.6,
  bubbles: [],
  pops: [],
  cardX: 0,
  cardZ: 5.5,
  cardDown: false,
  cardSpeed: 0,
  squeegeeSec: 0,
  alignErrMm: 0,
  angleErrDeg: 0,
  sheen: 0,
  screenOn: 0,
  rival: null,
  lastRun: null,
};

function resize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  renderer.setSize(viewW, viewH, false);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ov.width = Math.round(viewW * dpr);
  ov.height = Math.round(viewH * dpr);
  ovCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  camera.aspect = viewW / viewH;
  baseFov = viewW < viewH ? Math.min(46, Math.max(30, 31 * (0.58 / (viewW / viewH)))) : 30;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

const stDust = document.getElementById('st-dust');
const stBubbles = document.getElementById('st-bubbles');
const stExtra = document.getElementById('st-extra');
const guidePill = document.getElementById('guide-pill');
const alignTools = document.getElementById('align-tools');
const btnDrop = document.getElementById('btn-drop');
const btnGiveup = document.getElementById('btn-giveup');
const camDock = document.getElementById('cam-dock');

const CAM_LABELS = {
  top: { main: '수직 정조준!!', col: '#ffe24a' },
  front: { main: '초밀착 정면!!', col: '#38bdf8' },
  sideLeft: { main: '측면 0.1mm 감시!!', col: '#4ade80' },
};

function setCamKey(key, withPunch = false) {
  const changed = state.camKey !== key;
  state.camKey = key;
  camDock.querySelectorAll('.cam-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cam === key);
  });
  if (withPunch && changed && CAM_LABELS[key]) {
    FILM_SFX.camWhoosh(key === 'top' ? 1.15 : 0.9);
    vfx.fovPunch = 5.5;
    spawnPopText(CAM_LABELS[key].main, '', viewW * 0.5, viewH * 0.30, {
      size: viewW < 500 ? 30 : 40,
      color: CAM_LABELS[key].col,
      shadow: '#16111f',
      rot: -0.07,
      life: 0.55,
      vy: -28,
    });
  }
}

camDock.querySelectorAll('.cam-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.phase === 'align' || state.phase === 'start') {
      SFX.tick();
      setCamKey(btn.dataset.cam, state.phase === 'align');
    }
  });
});

// 시작 모달에서 핸드폰 기종 선택
document.querySelectorAll('.model-card').forEach(card => {
  card.addEventListener('click', () => {
    SFX.tick();
    state.modelKey = card.dataset.model;
    document.querySelectorAll('.model-card').forEach(c => c.classList.toggle('active', c === card));
    rebuildPhoneAndFilm(state.modelKey, state.seed);
  });
});

function spawnDust(x, z, vx, vz) {
  const m = new THREE.Mesh(dustGeo, dustMat);
  m.position.set(x, 0.12, z);
  dustGroup.add(m);
  state.dusts.push({ x, z, vx, vz, age: 0, mesh: m });
  stDust.textContent = String(state.dusts.length);
  stDust.style.color = state.dusts.length >= 6 ? '#f87171' : state.dusts.length >= 4 ? '#fb923c' : '#ffd84a';
}

function spawnBubble(x, z, r = 0.42) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#d7eeff', transparent: true, opacity: 0.52,
    roughness: 0.12, metalness: 0.1, clearcoat: 1.0,
  });
  const m = new THREE.Mesh(bubbleGeo, mat);
  m.scale.set(r, r * 0.36, r);
  m.position.set(x, 0.045, z);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), dustMat);
  dot.position.set(0, 0.12, 0);
  m.add(dot);
  bubbleGroup.add(m);
  state.bubbles.push({ x, z, ox: x, oz: z, r, harden: 0, locked: false, mesh: m, mat });
}

function spawnPop(x, z) {
  const mat = new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.30, 24), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.12, z);
  popGroup.add(ring);
  state.pops.push({ ring, mat, life: 0.35 });
}

function initRound(seed) {
  state.seed = seed;
  state.rng = makeRng(seed);
  state.t = 0;
  state.introAnim = 0;
  state.hitStopTimer = 0;
  state.holdSec = 0;
  state.squeegeeSec = 0;

  rebuildPhoneAndFilm(state.modelKey, seed);
  const { pw, ph } = curSpec;

  const ang = state.rng() * Math.PI * 2;
  const dist = 0.45 + state.rng() * 0.35;
  state.filmX = Math.cos(ang) * dist;
  state.filmZ = Math.sin(ang) * dist;
  state.filmAngleDeg = (state.rng() > 0.5 ? 1 : -1) * (1.4 + state.rng() * 2.2);
  state.liveFilmX = state.filmX;
  state.liveFilmZ = state.filmZ;
  state.liveAngleDeg = state.filmAngleDeg;
  state.slipVelX = 0;
  state.slipVelZ = 0;
  state.slipAngVel = 0;
  state.shakeBoost = 0;
  BGM.setUrgent(false);
  state.filmTiltX = 0;
  state.filmTiltZ = 0;
  state.dragging = false;
  state.lastW = null;
  state.adhereP = 0;
  state.sheen = 0;
  state.screenOn = 0;
  state.nextDustAt = 2.6;
  state.cardDown = false;
  state.cardX = 0;
  state.cardZ = ph * 0.45;
  cardGroup.visible = false;
  peelGroup.visible = false;
  shockRingMat.opacity = 0;

  // VFX 리셋
  vfx.sparks.length = 0;
  vfx.pops.length = 0;
  vfx.gustLines.length = 0;
  vfx.impactFlash = 0;
  vfx.shakeMag = 0;
  vfx.fovPunch = 0;
  vfx.shockProg = 0;
  vfx.cutInAlpha = 0;
  vfx.introPeelFired = false;
  vfx.bullseyeGlintCool = 0;
  vfx.stampAnim = 0;
  vfx.stampInfo = null;
  vfx.orbitAngle = 0;

  unbondedMat.opacity = 0;
  frontLineMat.opacity = 0;
  sheenMat.opacity = 0;
  setCamKey('top', false);

  while (dustGroup.children.length) dustGroup.remove(dustGroup.children[0]);
  while (bubbleGroup.children.length) bubbleGroup.remove(bubbleGroup.children[0]);
  while (popGroup.children.length) popGroup.remove(popGroup.children[0]);
  state.dusts = [];
  state.bubbles = [];
  state.pops = [];

  for (let i = 0; i < 2; i++) {
    spawnDust(
      (state.rng() - 0.5) * pw * 0.65,
      (state.rng() - 0.5) * ph * 0.62,
      (state.rng() - 0.5) * 0.45,
      (state.rng() - 0.5) * 0.45
    );
  }

  const sp = document.getElementById('streak-pill');
  if (sp) {
    sp.style.display = state.streak > 0 ? 'inline-flex' : 'none';
    sp.textContent = `🔥 ${state.streak}대째`;
  }

  alignTools.style.display = 'grid';
  btnDrop.style.display = 'block';
  btnDrop.disabled = false;
  btnDrop.classList.remove('bullseye-glow');
  btnDrop.textContent = '⚡ 영혼의 필름 투하!! (되돌리기 불가)';
  btnGiveup.style.display = 'none';
  camDock.style.display = 'grid';
  document.getElementById('result-modal').classList.add('hidden');
  guidePill.classList.remove('bullseye', 'danger');
  guidePill.textContent = '미세한 손끝 미끄러짐을 잡고 정빵에 꽂아 넣으세요!';
  stBubbles.textContent = '0';
  stBubbles.style.color = '#4ade80';
  stExtra.textContent = '⚡ 먼지 유입 대기';
  stExtra.style.color = '#38bdf8';
}

// ── 화려한 사전 오프닝(초저각 시네마틱 스윕 → 필름 360° 플립 → 이형지 박리 → 탑뷰 급상승!) ──
function startIntroShow() {
  unlockAudio();
  BGM.start('film');
  BGM.setUrgent(false);
  document.getElementById('start-modal').classList.add('hidden');
  state.phase = 'intro';
  state.introAnim = 0;
  vfx.introPeelFired = false;
  peelGroup.visible = true;
  camCurPos.set(-14.5, 4.2, 18.5);
  camCurLook.set(0, 0.5, 0);
  btnDrop.disabled = true;
  btnDrop.textContent = '🔥 강화필름 장전 중!! 🔥';
  guidePill.textContent = '⚡ 오의 · 이형지 박리 준비!! (터치 시 스킵)';

  FILM_SFX.camWhoosh(0.85);
  triggerCutIn('필살! 강화필름!!', `${curSpec.name} · 무결점 액정 강림!!`, '#e11d48');
  spawnSparks(viewW * 0.5, viewH * 0.45, 24, ['#38bdf8', '#ffe24a', '#ffffff']);
}

function finishIntroToAlign() {
  state.phase = 'align';
  peelGroup.visible = false;
  setCamKey('top', false);
  btnDrop.disabled = false;
  btnDrop.textContent = '⚡ 영혼의 필름 투하!! (되돌리기 불가)';
  guidePill.textContent = '미세한 손끝 미끄러짐을 잡고 정빵에 꽂아 넣으세요!';
  FILM_SFX.glint();
  triggerCutIn('승부 개시!! 정빵에 꽂아라!!', '탑 · 프론트 · 레프트로 0.1mm 사수!', '#0284c7');
}

function blowDust() {
  if (state.phase !== 'align') return;
  unlockAudio();
  SFX.rustle();
  FILM_SFX.gustBlow();
  state.filmTiltZ = (Math.random() > 0.5 ? 1 : -1) * 0.28;
  state.filmTiltX = (Math.random() - 0.5) * 0.22;
  state.shakeBoost = 1.0;
  vfx.shakeMag = 0.26;
  spawnGustLines();
  spawnSparks(viewW * 0.5, viewH * 0.5, 18, ['#38bdf8', '#e0f2fe', '#ffffff']);
  spawnPopText('후우우욱!!', '💨 먼지 퇴치 강풍!!', viewW * 0.5, viewH * 0.42, {
    size: viewW < 500 ? 44 : 58,
    color: '#38bdf8',
    stroke: '#16111f',
    shadow: '#0284c7',
    rot: -0.09,
    life: 0.65,
    vy: -24,
  });

  state.filmX = Math.max(-2.2, Math.min(2.2, state.filmX + (Math.random() - 0.5) * 0.14));
  state.filmZ = Math.max(-2.2, Math.min(2.2, state.filmZ + (Math.random() - 0.5) * 0.14));
  state.filmAngleDeg = Math.max(-4.5, Math.min(4.5, state.filmAngleDeg + (Math.random() - 0.5) * 0.28));

  for (const d of state.dusts) {
    const stickFactor = Math.max(0.28, 1 - d.age * 0.08);
    const dirX = d.x >= 0 ? 1 : -1;
    d.x += dirX * (1.8 + Math.random() * 1.9) * stickFactor;
    d.z += (Math.random() - 0.5) * 1.4 * stickFactor;
  }
  showToast('💨 강풍으로 먼지를 날렸어요!');
}

function dropFilm() {
  if (state.phase !== 'align') return;
  unlockAudio();
  state.phase = 'adhering';
  state.dragging = false;
  state.adhereP = 0;
  state.hitStopTimer = 0.14; // 0.14초 극강 낙하 히트스톱!

  // 내려놓는 바로 그 순간의 손떨림 위치 그대로 확정!
  state.filmX = state.liveFilmX;
  state.filmZ = state.liveFilmZ;
  state.filmAngleDeg = state.liveAngleDeg;

  const centerErrMm = Math.hypot(state.filmX, state.filmZ) * 10;
  const angleRad = Math.abs(state.filmAngleDeg) * (Math.PI / 180);
  const cornerShiftMm = Math.sin(angleRad) * (curSpec.ph * 0.5) * 10;
  state.alignErrMm = Number((centerErrMm + cornerShiftMm * 0.35).toFixed(2));
  state.angleErrDeg = Number(Math.abs(state.filmAngleDeg).toFixed(2));

  camDock.style.display = 'none';
  alignTools.style.display = 'none';
  btnDrop.style.display = 'none';
  guidePill.classList.remove('bullseye', 'danger');

  // 일본풍 과격 낙하 일섬 폭발!
  vfx.cutInAlpha = 0;
  SFX.filmDrop();
  FILM_SFX.dropImpact();
  vfx.impactFlash = 1.0;
  vfx.shakeMag = 0.78;
  vfx.fovPunch = 6.5;
  vfx.shockProg = 0.001;
  shockRing.position.set(state.filmX, 0.08, state.filmZ);

  const isNice = state.alignErrMm <= 0.55 && state.angleErrDeg <= 0.55;
  spawnSparks(viewW * 0.5, viewH * 0.5, 46, isNice ? ['#ffe24a', '#4ade80', '#ffffff', '#38bdf8'] : ['#ffe24a', '#ff3b5c', '#ffffff']);
  spawnPopText('착—!!', isNice ? '⚡ 칼·정·렬 투·하!! ⚡' : '⚡ 영·혼·의 투·하!! ⚡', viewW * 0.5, viewH * 0.44, {
    size: viewW < 500 ? 64 : 84,
    color: isNice ? '#4ade80' : '#ffe24a',
    stroke: '#16111f',
    shadow: '#e11d48',
    rot: -0.10,
    life: 0.92,
    vy: -20,
  });

  guidePill.textContent = '⚡ 접착선 추적 중!! 먼지를 피하길 기도하세요!!';
  stExtra.textContent = `오차 ${state.alignErrMm.toFixed(2)}mm · ${state.angleErrDeg.toFixed(1)}°`;
  stExtra.style.color = state.alignErrMm <= 0.45 && state.angleErrDeg <= 0.4 ? '#4ade80' : '#fb923c';
}

function enterSqueegee() {
  unbondedMat.opacity = 0;
  frontLineMat.opacity = 0;
  if (state.bubbles.length === 0) {
    finishGame();
    return;
  }
  state.phase = 'squeegee';
  state.squeegeeSec = 0;
  BGM.setUrgent(true);

  // 기포 제거 중에는 화면이 절대 돌아가거나 흔들리지 않도록 정면 수직 탑뷰에 즉시 100% 고정!
  setCamKey('top', false);
  const topP = getCamPreset('top');
  camCurPos.copy(topP.pos);
  camCurLook.copy(topP.look);
  camera.position.copy(topP.pos);
  camera.lookAt(topP.look);
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  vfx.shakeMag = 0;
  vfx.fovPunch = 0;

  cardGroup.visible = true;
  state.cardX = 0;
  state.cardZ = curSpec.ph * 0.42;
  guidePill.classList.add('danger');
  guidePill.textContent = '🔥 기포가 굳고 있다!! 카드로 힘차게 밀어 격파하세요!! 🔥';
  btnGiveup.style.display = 'block';
  triggerCutIn('기포 비상!!', '8.5초 안에 카드로 전부 밀어내라!!', '#f97316');
}

function getFilmStamp(rem, alignErrMm, angleErrDeg) {
  if (rem === 0 && alignErrMm <= 0.35 && angleErrDeg <= 0.35) {
    return { main: '필·름·의 신!!', sub: `${alignErrMm.toFixed(2)}mm · 기포 0개! 인간 지그 강림!`, bg: '#facc15', fg: '#16111f', border: '#e11d48', mode: 'god' };
  }
  if (rem === 0 && alignErrMm <= 0.9 && angleErrDeg <= 0.9) {
    return { main: '대·리·점 1타!!', sub: '기포 0개 완벽 부착! 사장이 스카웃 제의!', bg: '#22c55e', fg: '#ffffff', border: '#16111f', mode: 'great' };
  }
  if (rem === 0) {
    return { main: '살·짝 삐·뚤!!', sub: '기포는 0개인데… 앗 각도가 아쉽다!', bg: '#38bdf8', fg: '#16111f', border: '#16111f', mode: 'good' };
  }
  if (rem === 1) {
    return { main: '한 톨 타·협!!', sub: '“쓰다 보면 익숙해지겠지…” 기포 1개 고정!', bg: '#fb923c', fg: '#16111f', border: '#16111f', mode: 'miss' };
  }
  return { main: '기·포 농·장!!', sub: `대참사!! 기포 ${rem}개 영구 경화!!`, bg: '#e11d48', fg: '#ffe24a', border: '#16111f', mode: 'disaster' };
}

async function finishGame() {
  if (state.phase === 'done') return;
  state.phase = 'done';
  BGM.setUrgent(false);
  cardGroup.visible = false;
  btnGiveup.style.display = 'none';
  guidePill.classList.remove('danger', 'bullseye');

  const rem = state.bubbles.length;
  const posPenalty = Math.max(0, (state.alignErrMm - 0.15) * 14);
  const angPenalty = Math.max(0, (state.angleErrDeg - 0.15) * 12);
  const bubblePenalty = rem * 18;
  const total = Math.max(5, Math.min(100, Math.round(100 - posPenalty - angPenalty - bubblePenalty)));

  const isLegend = rem === 0 && state.alignErrMm <= 0.35 && state.angleErrDeg <= 0.35;
  if (rem === 0 && state.alignErrMm <= 0.9 && state.angleErrDeg <= 0.8) state.streak += 1;
  else state.streak = 0;
  localStorage.setItem(STREAK_KEY, String(state.streak));

  let rankTitle, comment;
  if (isLegend) {
    rankTitle = '👑 필름의 신 · 강화필름의 전설';
    comment = `${curSpec.name} 0.35mm 이내 + 각도 완벽 + 기포 0개! 기계보다 정밀한 인간 지그!`;
    SFX.win();
  } else if (rem === 0 && state.alignErrMm <= 0.9 && state.angleErrDeg <= 0.9) {
    rankTitle = '✨ 대리점 1타 장인';
    comment = '기포 0개 깔끔 성공! 조금만 더 0.1mm에 공들이면 전설 등급!';
    SFX.win();
  } else if (rem === 0) {
    rankTitle = '📐 살짝 삐뚤 장인';
    comment = '기포는 다 잡았지만 옆 구도로 돌려 보면 살짝 삐뚤어져 있어요!';
    SFX.tick();
  } else if (rem === 1) {
    rankTitle = '🫧 한 톨 타협가';
    comment = '기포가 굳어 버렸어요… “쓰다 보면 익숙해지겠지”';
    SFX.fail();
  } else {
    rankTitle = '💥 굳어버린 기포 농장';
    comment = '너무 늦게 밀어서 기포가 완전히 굳어 버렸어요!';
    SFX.fail();
  }

  // 거대 판정 도장 + 컨페티/스파크 + 360° 영광 오빗 카메라 시작!
  vfx.stampInfo = getFilmStamp(rem, state.alignErrMm, state.angleErrDeg);
  vfx.stampAnim = 0.001;
  vfx.orbitAngle = 0.55;
  const isDisaster = vfx.stampInfo.mode === 'disaster';
  FILM_SFX.stampBoom(isDisaster);
  vfx.shakeMag = isDisaster ? 0.55 : 0.30;
  if (rem === 0) spawnConfetti(58);
  else spawnSparks(viewW * 0.5, viewH * 0.4, 34, ['#e11d48', '#ffe24a', '#16111f']);

  const run = {
    gameId: 'film',
    score: total,
    targetValue: 0,
    actualValue: rem,
    errorMm: state.alignErrMm,
    rankTitle,
    seed: state.seed,
    meta: { model: state.modelKey, bubbles: rem, alignErrMm: state.alignErrMm, angleErrDeg: state.angleErrDeg, streak: state.streak },
  };
  state.lastRun = run;
  const isBest = updateBestRecord('film', run, false);

  guidePill.textContent = rem === 0
    ? `✨ ${curSpec.name} 기포 0개 완성!! 360° 감상 (3초 뒤 결과)`
    : '📱 부착 완료! 360° 결과 감상 중 (3초 뒤 결과)';

  setTimeout(async () => {
    document.getElementById('res-rank').textContent = isBest ? `${rankTitle} · 신기록!` : rankTitle;
    document.getElementById('res-headline').textContent = `${total}점`;
    document.getElementById('res-comment').textContent = comment;
    document.getElementById('res-align').textContent = `${state.alignErrMm.toFixed(2)}mm`;
    document.getElementById('res-align').style.color = state.alignErrMm <= 0.4 ? '#4ade80' : '#fb923c';
    document.getElementById('res-angle').textContent = `${state.angleErrDeg.toFixed(1)}°`;
    document.getElementById('res-angle').style.color = state.angleErrDeg <= 0.4 ? '#4ade80' : '#fb923c';
    document.getElementById('res-bubbles').textContent = `${rem}개`;
    document.getElementById('res-bubbles').style.color = rem === 0 ? '#4ade80' : '#f87171';

    document.getElementById('res-vs-wrap').style.display = 'none';
    document.getElementById('res-nick').value = getSavedNickname();
    document.getElementById('res-lb-wrap').style.display = 'none';
    document.getElementById('result-modal').classList.remove('hidden');

    const saved = await saveResultAndBuildShare({ ...run, nickname: getSavedNickname() || '익명 도전자' }, state.rival);
    renderLb(saved);
  }, 3000);
}

function renderLb(saved) {
  const lb = document.getElementById('res-lb-wrap');
  if (!saved || !saved.ladder || saved.ladder.length === 0) return;
  lb.style.display = 'block';
  lb.innerHTML = renderGlobalLadderHTML(saved, r =>
    `${Math.round(r.score)}점 (${Number(r.error_mm || 0).toFixed(2)}mm)`
  );
}

// ── 2D 열혈 액션 VFX 렌더링 (집중선 · 십자 섬광 · 강풍 · 사선 컷인 · 만화 타이포 · 거대 도장) ──
function drawSpeedLines(ctx, cx, cy, intensity, color = 'rgba(225, 29, 72, 0.25)', count = 44, nowSec = 0) {
  if (intensity <= 0.01) return;
  ctx.save();
  ctx.translate(cx, cy);
  const maxR = Math.hypot(viewW, viewH) * 0.72;
  const innerBase = Math.min(viewW, viewH) * (0.35 - intensity * 0.06);
  ctx.fillStyle = color;
  ctx.globalAlpha = Math.min(1, intensity);
  const jitter = Math.floor(nowSec * 24) * 0.37;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.sin(i * 13.7 + jitter) * 0.035;
    const innerR = innerBase + ((i * 29 + Math.floor(nowSec * 18)) % 17) * 6;
    const halfW = 0.012 + ((i * 7) % 5) * 0.005;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
    ctx.lineTo(Math.cos(a - halfW) * maxR, Math.sin(a - halfW) * maxR);
    ctx.lineTo(Math.cos(a + halfW) * maxR, Math.sin(a + halfW) * maxR);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawLensStar(ctx, x, y, r, alpha, rot = 0) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  const gr = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.85);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.35, 'rgba(74,222,128,0.65)');
  gr.addColorStop(1, 'rgba(74,222,128,0)');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 2; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.11, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.11, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawMangaText(ctx, text, x, y, size, color, stroke, shadow, rot = -0.08) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `italic 900 ${size}px Pretendard, "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.fillStyle = shadow;
  ctx.fillText(text, Math.max(4, size * 0.09), Math.max(4, size * 0.09));
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(6, size * 0.18);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawOverlay(nowSec, isBullseye) {
  ovCtx.clearRect(0, 0, viewW, viewH);

  // 1) 인트로 집중선
  if (state.phase === 'intro') {
    const p = state.introAnim;
    drawSpeedLines(ovCtx, viewW * 0.5, viewH * 0.48, p < 1.85 ? 0.78 : Math.max(0, (2.25 - p) * 2), 'rgba(225, 29, 72, 0.22)', 48, nowSec);
  }

  // 2) 경화 위기 경보 집중선 (정렬 중 "지금 붙여라" 자동 신호 없음 — 오직 눈으로 직접 정렬!)
  if (state.phase === 'squeegee' && state.squeegeeSec > HARDEN_SEC * 0.55) {
    const u = Math.min(1, (state.squeegeeSec - HARDEN_SEC * 0.55) / (HARDEN_SEC * 0.45));
    drawSpeedLines(ovCtx, viewW * 0.5, viewH * 0.5, (0.35 + u * 0.45) * (0.7 + Math.sin(nowSec * 14) * 0.3), 'rgba(225, 29, 72, 0.32)', 44, nowSec);
  }

  // 4) 완료 시 영광 / 대참사 집중선
  if (state.phase === 'done' && vfx.stampInfo) {
    if (vfx.stampInfo.mode === 'god' || vfx.stampInfo.mode === 'great') {
      drawSpeedLines(ovCtx, viewW * 0.5, viewH * 0.48, 0.55, 'rgba(250, 204, 21, 0.24)', 44, nowSec);
    } else if (vfx.stampInfo.mode === 'disaster') {
      drawSpeedLines(ovCtx, viewW * 0.5, viewH * 0.48, 0.65, 'rgba(225, 29, 72, 0.26)', 48, nowSec);
    }
  }

  // 5) 임팩트 프레임 플래시
  if (vfx.impactFlash > 0.01) {
    ovCtx.save();
    if (vfx.impactFlash > 0.55) {
      ovCtx.fillStyle = `rgba(22, 17, 31, ${(vfx.impactFlash - 0.55) * 1.45})`;
      ovCtx.fillRect(0, 0, viewW, viewH);
      drawSpeedLines(ovCtx, viewW * 0.5, viewH * 0.48, 0.95, 'rgba(255, 226, 74, 0.55)', 54, nowSec);
    } else {
      ovCtx.fillStyle = `rgba(255, 250, 225, ${vfx.impactFlash * 0.68})`;
      ovCtx.fillRect(0, 0, viewW, viewH);
    }
    ovCtx.restore();
  }

  // 6) 강풍 바람 줄기 (먼지 털기!)
  for (const g of vfx.gustLines) {
    const a = Math.max(0, g.life / g.maxLife);
    ovCtx.save();
    ovCtx.globalAlpha = a * 0.85;
    ovCtx.strokeStyle = '#e0f2fe';
    ovCtx.lineWidth = 4;
    ovCtx.lineCap = 'round';
    ovCtx.beginPath();
    ovCtx.moveTo(g.x, g.y);
    ovCtx.lineTo(g.x + g.w, g.y - 14);
    ovCtx.stroke();
    ovCtx.restore();
  }

  // 7) 스파크 & 컨페티 파티클
  for (const p of vfx.sparks) {
    const a = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.45)));
    ovCtx.save();
    ovCtx.globalAlpha = a;
    ovCtx.translate(p.x, p.y);
    ovCtx.rotate(p.confetti ? p.rot : Math.atan2(p.vy, p.vx));
    ovCtx.fillStyle = p.col;
    if (p.confetti) {
      ovCtx.fillRect(-p.size * 0.5, -p.len * 0.5, p.size, p.len);
    } else {
      ovCtx.beginPath();
      ovCtx.moveTo(p.len, 0);
      ovCtx.lineTo(-p.len * 0.4, p.size * 0.55);
      ovCtx.lineTo(-p.len * 0.4, -p.size * 0.55);
      ovCtx.closePath();
      ovCtx.fill();
    }
    ovCtx.restore();
  }

  // 8) 사선 아케이드 컷인 배너
  if (vfx.cutInAlpha > 0.01) {
    const a = Math.min(1, vfx.cutInAlpha * 1.6);
    const slide = vfx.cutInSlide;
    const offsetX = slide < 0.22 ? (1 - slide / 0.22) * -viewW * 0.65 : slide > 0.78 ? ((slide - 0.78) / 0.22) * viewW * 0.65 : 0;
    const bandY = viewH * 0.46;
    const bandH = viewW < 500 ? 84 : 106;

    ovCtx.save();
    ovCtx.globalAlpha = a;
    ovCtx.translate(viewW * 0.5 + offsetX, bandY);
    ovCtx.rotate(-0.08);
    ovCtx.fillStyle = '#16111f';
    ovCtx.fillRect(-viewW, -bandH * 0.5 - 8, viewW * 2, bandH + 16);
    ovCtx.fillStyle = vfx.cutInColor;
    ovCtx.fillRect(-viewW, -bandH * 0.5, viewW * 2, bandH);
    ovCtx.fillStyle = '#ffe24a';
    ovCtx.fillRect(-viewW, -bandH * 0.5, viewW * 2, 6);
    ovCtx.fillRect(-viewW, bandH * 0.5 - 6, viewW * 2, 6);
    drawMangaText(ovCtx, vfx.cutInText, 0, -10, viewW < 500 ? 34 : 46, '#ffe24a', '#16111f', '#000000', 0);
    ovCtx.fillStyle = '#ffffff';
    ovCtx.font = `italic 900 ${viewW < 500 ? 13 : 16}px Pretendard, sans-serif`;
    ovCtx.textAlign = 'center'; ovCtx.textBaseline = 'middle';
    ovCtx.fillText(vfx.cutInSub, 0, bandH * 0.28);
    ovCtx.restore();
  }

  // 9) 완료 판정 거대 열혈 도장 스탬프 컷인!!
  if (state.phase === 'done' && vfx.stampInfo && vfx.stampAnim > 0) {
    const sp = Math.min(1, vfx.stampAnim);
    const scale = sp < 0.35 ? 2.35 - (sp / 0.35) * 1.43 : 0.92 + Math.sin((sp - 0.35) * 9) * 0.08 * (1 - sp);
    const st = vfx.stampInfo;
    const sx = viewW < 600 ? viewW * 0.5 : viewW * 0.25;
    const sy = viewW < 600 ? Math.max(195, viewH * 0.27) : viewH * 0.36;

    ovCtx.save();
    ovCtx.translate(sx, sy);
    ovCtx.rotate(-0.12);
    ovCtx.scale(scale, scale);

    const bw = viewW < 600 ? 250 : 300;
    const bh = viewW < 600 ? 86 : 104;
    ovCtx.fillStyle = '#16111f';
    ovCtx.beginPath(); ovCtx.roundRect(-bw / 2 + 7, -bh / 2 + 7, bw, bh, 14); ovCtx.fill();
    ovCtx.fillStyle = st.bg;
    ovCtx.strokeStyle = st.border;
    ovCtx.lineWidth = 5;
    ovCtx.beginPath(); ovCtx.roundRect(-bw / 2, -bh / 2, bw, bh, 14); ovCtx.fill(); ovCtx.stroke();
    ovCtx.strokeStyle = 'rgba(255,255,255,0.65)';
    ovCtx.lineWidth = 2;
    ovCtx.beginPath(); ovCtx.roundRect(-bw / 2 + 6, -bh / 2 + 6, bw - 12, bh - 12, 9); ovCtx.stroke();

    ovCtx.fillStyle = st.fg;
    ovCtx.font = `italic 900 ${viewW < 600 ? 32 : 40}px Pretendard, sans-serif`;
    ovCtx.textAlign = 'center'; ovCtx.textBaseline = 'middle';
    ovCtx.fillText(st.main, 0, -10);

    ovCtx.fillStyle = st.fg;
    ovCtx.globalAlpha = 0.92;
    ovCtx.font = `800 ${viewW < 600 ? 12 : 14}px Pretendard, sans-serif`;
    ovCtx.fillText(st.sub, 0, bh * 0.27);
    ovCtx.restore();
  }

  // 10) 만화 의성어 팝업 (찌이이익!! · 후우우욱!! · 착—!! · 뽁!! · 격파!!)
  for (const pop of vfx.pops) {
    const p = 1 - pop.life / pop.maxLife;
    const scale = p < 0.18 ? 0.35 + (p / 0.18) * 0.92 : p < 0.32 ? 1.27 - ((p - 0.18) / 0.14) * 0.27 : 1.0 + (p - 0.32) * 0.08;
    const alpha = p > 0.72 ? Math.max(0, 1 - (p - 0.72) / 0.28) : 1;
    ovCtx.save();
    ovCtx.globalAlpha = alpha;
    ovCtx.translate(pop.x, pop.y);
    ovCtx.scale(scale, scale);
    drawMangaText(ovCtx, pop.text, 0, 0, pop.size, pop.color, pop.stroke, pop.shadow, pop.rot);
    if (pop.sub) {
      drawMangaText(ovCtx, pop.sub, 0, pop.size * 0.72, Math.round(pop.size * 0.34), '#ffffff', '#16111f', '#e11d48', pop.rot * 0.6);
    }
    ovCtx.restore();
  }
}

// ── 입력 처리 ──
const _camRight = new THREE.Vector3();
const _camFwd = new THREE.Vector3();

gl.addEventListener('pointerdown', e => {
  if (state.phase === 'intro') {
    finishIntroToAlign();
    return;
  }
  if (state.phase === 'align') {
    unlockAudio();
    state.dragging = true;
    state.lastPx = { x: e.clientX, y: e.clientY };
    gl.setPointerCapture(e.pointerId);
  } else if (state.phase === 'squeegee') {
    const wp = pointerToWorld(e);
    if (!wp) return;
    unlockAudio();
    state.cardDown = true;
    state.lastW = wp;
    state.cardX = wp.x;
    state.cardZ = wp.z - 1.05;
    gl.setPointerCapture(e.pointerId);
  }
});

gl.addEventListener('pointermove', e => {
  if (state.phase === 'align' && state.dragging) {
    const dxPx = e.clientX - state.lastPx.x;
    const dyPx = e.clientY - state.lastPx.y;
    state.lastPx = { x: e.clientX, y: e.clientY };

    camera.getWorldDirection(_camFwd);
    _camRight.crossVectors(_camFwd, new THREE.Vector3(0, 1, 0)).normalize();
    _camFwd.y = 0;
    if (_camFwd.lengthSq() < 0.001) _camFwd.set(0, 0, -1);
    else _camFwd.normalize();

    const sens = getCamPreset(state.camKey).sens;
    const rawMoveX = (_camRight.x * dxPx - _camFwd.x * dyPx) * sens;
    const rawMoveZ = (_camRight.z * dxPx - _camFwd.z * dyPx) * sens;

    // 옮길 때만 살짝 생각 같지 않은 아주 미세한 직교 편차 & 관성 미끄러짐 추가!
    const wobblePhase = state.t * 7.5 + state.seed;
    const driftX = -rawMoveZ * Math.sin(wobblePhase) * 0.045;
    const driftZ = rawMoveX * Math.cos(wobblePhase * 1.13) * 0.045;
    const moveX = rawMoveX + driftX;
    const moveZ = rawMoveZ + driftZ;

    state.filmX = Math.max(-2.2, Math.min(2.2, state.filmX + moveX));
    state.filmZ = Math.max(-2.2, Math.min(2.2, state.filmZ + moveZ));
    // 아주 미세한 손끝 관성(손 뗄 때 0.03~0.08mm 정도 살짝 더 따라가는 리얼 필름 손맛!)
    state.slipVelX = Math.max(-0.45, Math.min(0.45, state.slipVelX * 0.55 + moveX * 1.8));
    state.slipVelZ = Math.max(-0.45, Math.min(0.45, state.slipVelZ * 0.55 + moveZ * 1.8));
    state.slipAngVel = Math.max(-0.35, Math.min(0.35, state.slipAngVel * 0.5 + (rawMoveX * 0.55 - rawMoveZ * 0.35)));
    state.filmTiltZ = Math.max(-0.10, Math.min(0.10, -moveX * 0.36));
    state.filmTiltX = Math.max(-0.09, Math.min(0.09, moveZ * 0.34));
  } else if (state.phase === 'squeegee' && state.cardDown) {
    const wp = pointerToWorld(e);
    if (!wp || !state.lastW) return;
    const dx = wp.x - state.lastW.x;
    const dz = wp.z - state.lastW.z;
    state.lastW = wp;
    state.cardX = wp.x;
    state.cardZ = wp.z - 1.05;
    state.cardSpeed = Math.hypot(dx, dz);
  }
});

const onUp = () => {
  state.dragging = false;
  if (state.phase === 'squeegee') { state.cardDown = false; state.cardSpeed = 0; }
};
gl.addEventListener('pointerup', onUp);
gl.addEventListener('pointercancel', onUp);

let rotHoldDir = 0;
const bindRot = (id, dir) => {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    unlockAudio();
    rotHoldDir = dir;
    state.filmAngleDeg = Math.max(-4.5, Math.min(4.5, state.filmAngleDeg + dir * 0.15));
    SFX.tick();
  });
  const stop = () => { rotHoldDir = 0; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointerleave', stop);
  el.addEventListener('pointercancel', stop);
};
bindRot('btn-rot-l', 1);
bindRot('btn-rot-r', -1);

window.addEventListener('keydown', e => {
  if (state.phase === 'intro' && (e.key === ' ' || e.key === 'Enter')) {
    finishIntroToAlign();
    e.preventDefault();
    return;
  }
  if (state.phase !== 'align') return;
  if (e.key === 'q' || e.key === 'Q') state.filmAngleDeg = Math.min(4.5, state.filmAngleDeg + 0.15);
  else if (e.key === 'e' || e.key === 'E') state.filmAngleDeg = Math.max(-4.5, state.filmAngleDeg - 0.15);
  else if (e.key === ' ') { dropFilm(); e.preventDefault(); }
  else if (e.key === '1') setCamKey('top', true);
  else if (e.key === '2') setCamKey('front', true);
  else if (e.key === '3') setCamKey('sideLeft', true);
});

document.getElementById('btn-blow').onclick = blowDust;
btnDrop.onclick = dropFilm;
btnGiveup.onclick = () => finishGame();
document.getElementById('btn-start').onclick = startIntroShow;

const btnBgm = document.getElementById('btn-bgm');
function syncBgmBtn() {
  if (!btnBgm) return;
  const muted = BGM.isMuted();
  btnBgm.textContent = muted ? '🔇 BGM 꺼짐' : '🔊 BGM 켜짐';
  btnBgm.classList.toggle('bgm-off', muted);
}
syncBgmBtn();
if (btnBgm) {
  btnBgm.onclick = () => {
    unlockAudio();
    const muted = BGM.toggleMute();
    if (!muted) BGM.start('film');
    syncBgmBtn();
  };
}
document.getElementById('btn-retry').onclick = () => {
  initRound(state.rival ? state.seed : Math.floor(Math.random() * 9999) + 1);
  startIntroShow();
};

document.getElementById('btn-share').onclick = async () => {
  if (!state.lastRun) return;
  const nick = saveNickname(document.getElementById('res-nick').value || getSavedNickname() || '익명 도전자');
  const data = await saveResultAndBuildShare({ ...state.lastRun, nickname: nick }, state.rival);
  renderLb(data);
  await shareChallengeLink({
    title: `📱 ${nick}님의 [필살! 강화필름!!] 랭킹 기록`,
    text: `📱 [필살! 강화필름!! · ${curSpec.name}] ${state.lastRun.score}점 (오차 ${state.lastRun.errorMm.toFixed(2)}mm · 각도 ${state.lastRun.meta.angleErrDeg.toFixed(1)}° · 기포 ${state.lastRun.actualValue}개)!\n전체 랭킹에서 내 위치 보고 기록 깨봐 👇`,
    url: data.shareUrl,
  });
};

document.getElementById('btn-save-img').onclick = () => {
  if (!state.lastRun) return;
  const r = state.lastRun;
  downloadResultCard({
    gameTitle: `필살! 강화필름!! (${curSpec.name})`,
    emoji: '📱',
    rankTitle: r.rankTitle,
    headline: `${r.score}점`,
    subline: `오차 ${r.errorMm.toFixed(2)}mm · 각도 ${r.meta.angleErrDeg.toFixed(1)}° · 기포 ${r.actualValue}개`,
    stats: [
      { label: '위치 오차', value: `${r.errorMm.toFixed(2)}mm`, color: r.errorMm <= 0.4 ? '#4ade80' : '#fb923c' },
      { label: '기울기', value: `${r.meta.angleErrDeg.toFixed(1)}°` },
      { label: '남은 기포', value: `${r.actualValue}개`, color: r.actualValue === 0 ? '#4ade80' : '#f87171' },
    ],
    extraCanvas: gl,
  });
};

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── 3D 메인 루프 ──
const _dynCamPos = new THREE.Vector3();
const _dynCamLook = new THREE.Vector3();
let prevT = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = Math.min(0.05, (now - prevT) / 1000);
  prevT = now;
  const nowSec = now / 1000;

  // VFX 타이머 갱신
  vfx.impactFlash = Math.max(0, vfx.impactFlash - rawDt * 4.5);
  vfx.shakeMag = Math.max(0, vfx.shakeMag - rawDt * 2.5);
  vfx.fovPunch = Math.max(0, vfx.fovPunch - rawDt * 22);
  vfx.bullseyeGlintCool = Math.max(0, vfx.bullseyeGlintCool - rawDt);
  if (vfx.cutInAlpha > 0) {
    vfx.cutInSlide += rawDt * 1.15;
    if (vfx.cutInSlide >= 1.0) vfx.cutInAlpha = 0;
  }
  if (vfx.shockProg > 0) {
    vfx.shockProg += rawDt * 3.2;
    const sp = Math.min(1, vfx.shockProg);
    shockRing.scale.setScalar(0.4 + sp * 2.8);
    shockRingMat.opacity = (1 - sp) * 0.92;
    if (vfx.shockProg >= 1) { vfx.shockProg = 0; shockRingMat.opacity = 0; }
  }
  for (let i = vfx.sparks.length - 1; i >= 0; i--) {
    const p = vfx.sparks[i];
    p.life -= rawDt;
    if (p.life <= 0) { vfx.sparks.splice(i, 1); continue; }
    p.vy += (p.confetti ? 520 : 840) * rawDt;
    p.x += p.vx * rawDt;
    p.y += p.vy * rawDt;
    p.rot += p.vrot * rawDt;
  }
  for (let i = vfx.pops.length - 1; i >= 0; i--) {
    const pop = vfx.pops[i];
    pop.life -= rawDt;
    if (pop.life <= 0) { vfx.pops.splice(i, 1); continue; }
    pop.y += pop.vy * rawDt;
  }
  for (let i = vfx.gustLines.length - 1; i >= 0; i--) {
    const g = vfx.gustLines[i];
    g.life -= rawDt;
    if (g.life <= 0) { vfx.gustLines.splice(i, 1); continue; }
    g.x += g.vx * rawDt;
  }

  // 히트스톱 처리
  let dt = rawDt;
  if (state.hitStopTimer > 0) {
    state.hitStopTimer = Math.max(0, state.hitStopTimer - rawDt);
    dt = rawDt * 0.06;
  }
  state.t += dt;

  const { pw, ph } = curSpec;
  state.filmTiltX *= Math.max(0, 1 - dt * 8);
  state.filmTiltZ *= Math.max(0, 1 - dt * 8);

  if (state.phase === 'align' && rotHoldDir !== 0) {
    state.filmAngleDeg = Math.max(-4.5, Math.min(4.5, state.filmAngleDeg + rotHoldDir * dt * 1.45));
  }

  let isBullseye = false;

  if (state.phase === 'intro') {
    state.introAnim += rawDt;
    const p = state.introAnim;
    if (holeRing) holeRing.visible = true;
    filmGlassMat.opacity = 0.28;

    if (p < 0.85) {
      // 1단계: 초저각 시네마틱 스윕 + 필름 360° 공중제비 강하!
      const u = p / 0.85;
      const easeU = 1 - Math.pow(1 - u, 3);
      _dynCamPos.set(THREE.MathUtils.lerp(-14.5, 11.5, easeU), THREE.MathUtils.lerp(4.2, 8.2, easeU), THREE.MathUtils.lerp(18.5, 14.0, easeU));
      _dynCamLook.set(0, 1.2, 0);
      camCurPos.copy(_dynCamPos);
      camCurLook.copy(_dynCamLook);

      const fy = THREE.MathUtils.lerp(9.5, 3.2, easeU);
      filmGroup.position.set(0, fy, 0);
      filmGroup.rotation.set(easeU * Math.PI * 2, easeU * Math.PI * 2, 0);

      peelGroup.visible = true;
      peelGroup.position.set(0, fy - 0.14, 0);
      peelGroup.rotation.copy(filmGroup.rotation);
    } else if (p < 1.55) {
      // 2단계: 파란 이형지 비닐 '찌이이익!!' 뜯어내기 + 카메라 로우 → 탑뷰 급상승!
      const u = (p - 0.85) / 0.70;
      const easeU = 1 - Math.pow(1 - u, 3);
      if (!vfx.introPeelFired) {
        vfx.introPeelFired = true;
        FILM_SFX.peelRip();
        vfx.shakeMag = 0.25;
        vfx.fovPunch = 5.0;
        spawnSparks(viewW * 0.5, viewH * 0.5, 28, ['#38bdf8', '#ffe24a', '#ffffff']);
        spawnPopText('찌이이익!!', '✨ 이형지 박리 완료!!', viewW * 0.5, viewH * 0.42, {
          size: viewW < 500 ? 48 : 66,
          color: '#38bdf8',
          stroke: '#16111f',
          shadow: '#0284c7',
          rot: -0.10,
          life: 0.65,
          vy: -30,
        });
      }

      // 이형지 비닐이 앞쪽으로 촥 말려 날아감!
      peelGroup.visible = u < 0.85;
      peelGroup.position.set(u * 12, 3.0 + u * 5.5, u * 14);
      peelGroup.rotation.set(-u * 2.4, u * 1.2, u * 1.8);

      filmGroup.position.set(THREE.MathUtils.lerp(0, state.filmX, easeU), THREE.MathUtils.lerp(3.2, 0.8, easeU), THREE.MathUtils.lerp(0, state.filmZ, easeU));
      filmGroup.rotation.set(0, THREE.MathUtils.lerp(0, (state.filmAngleDeg * Math.PI) / 180, easeU), 0);

      // 카메라 로우앵글 → 탑뷰로 극적인 수직 급상승!
      const topP = getCamPreset('top');
      _dynCamPos.set(THREE.MathUtils.lerp(11.5, topP.pos.x, easeU), THREE.MathUtils.lerp(8.2, topP.pos.y, easeU), THREE.MathUtils.lerp(14.0, topP.pos.z, easeU));
      _dynCamLook.set(0, THREE.MathUtils.lerp(1.2, 0, easeU), 0);
      camCurPos.copy(_dynCamPos);
      camCurLook.copy(_dynCamLook);
    } else if (p < 2.25) {
      // 3단계: 필름 최종 착지 자세(y = 0.14) 정착!
      const u = (p - 1.55) / 0.70;
      const easeU = 1 - Math.pow(1 - u, 3);
      peelGroup.visible = false;
      filmGroup.position.set(state.filmX, THREE.MathUtils.lerp(0.8, 0.14, easeU), state.filmZ);
      filmGroup.rotation.set(0, (state.filmAngleDeg * Math.PI) / 180, 0);
      const topP = getCamPreset('top');
      camCurPos.lerp(topP.pos, Math.min(1, rawDt * 10));
      camCurLook.lerp(topP.look, Math.min(1, rawDt * 10));
    } else {
      finishIntroToAlign();
    }
  } else if (state.phase === 'align' || state.phase === 'start') {
    if (state.phase === 'align') {
      state.holdSec += dt;
      for (let i = state.dusts.length - 1; i >= 0; i--) {
        const d = state.dusts[i];
        d.age += dt;
        const slow = Math.max(0.15, 1 - d.age * 0.12);
        d.x += (d.vx * slow + Math.sin(state.t * 1.5 + i) * 0.14 * slow) * dt;
        d.z += (d.vz * slow + Math.cos(state.t * 1.3 + i) * 0.14 * slow) * dt;
        d.mesh.position.set(d.x, 0.09 + slow * 0.08, d.z);
        if (Math.abs(d.x) > pw * 0.53 || Math.abs(d.z) > ph * 0.53) {
          dustGroup.remove(d.mesh);
          state.dusts.splice(i, 1);
          stDust.textContent = String(state.dusts.length);
          SFX.tick();
        }
      }
      if (state.holdSec >= state.nextDustAt && state.dusts.length < 12) {
        const interval = Math.max(1.35, 2.7 - state.holdSec * 0.08);
        state.nextDustAt = state.holdSec + interval;
        const side = Math.floor(state.rng() * 4);
        let dx = (state.rng() - 0.5) * pw * 0.78;
        let dz = (state.rng() - 0.5) * ph * 0.78;
        if (side === 0) dx = -pw * 0.46;
        else if (side === 1) dx = pw * 0.46;
        else if (side === 2) dz = -ph * 0.45;
        else dz = ph * 0.45;
        spawnDust(dx, dz, -dx * 0.18, -dz * 0.12);
      }

      const staticPct = Math.min(100, Math.round((state.holdSec / 16) * 100));
      stExtra.textContent = `⚡ 먼지 쌓임 ${staticPct}%`;
      stExtra.style.color = staticPct > 65 ? '#f87171' : staticPct > 35 ? '#fb923c' : '#38bdf8';
    }

    // 극미세 손맛: 가만히 있으면 거의 정지(±0.08mm 숨결 수준), 옮길 때만 아주 살짝 미끄러지는 느낌!
    state.shakeBoost = Math.max(0, state.shakeBoost - dt * 1.4);
    if (!state.dragging && state.phase === 'align') {
      // 손 뗀 직후 0.03~0.08mm 아주 살짝 미끄러지며 정지
      state.filmX = Math.max(-2.2, Math.min(2.2, state.filmX + state.slipVelX * dt * 0.35));
      state.filmZ = Math.max(-2.2, Math.min(2.2, state.filmZ + state.slipVelZ * dt * 0.35));
      state.filmAngleDeg = Math.max(-4.5, Math.min(4.5, state.filmAngleDeg + state.slipAngVel * dt * 0.45));
    }
    state.slipVelX *= Math.max(0, 1 - dt * 14);
    state.slipVelZ *= Math.max(0, 1 - dt * 14);
    state.slipAngVel *= Math.max(0, 1 - dt * 14);

    const t = state.t;
    const micro = state.phase === 'align' ? (1 + state.shakeBoost * 1.2) : 0.3;
    const tremorX = (Math.sin(t * 2.8) * 0.0055 + Math.cos(t * 6.1) * 0.0025) * micro;
    const tremorZ = (Math.cos(t * 2.5 + 0.6) * 0.0055 + Math.sin(t * 5.7) * 0.0025) * micro;
    const tremorAng = (Math.sin(t * 2.2) * 0.022) * micro;

    state.liveFilmX = state.filmX + tremorX;
    state.liveFilmZ = state.filmZ + tremorZ;
    state.liveAngleDeg = state.filmAngleDeg + tremorAng;

    // 정렬 완료 신호(초록불·섬광·지금 붙여라 알림) 없이 실제 유리 필름 그대로 유지 — 탑·프론트·레프트 구도를 눈으로 보고 직접 판단!
    isBullseye = false;
    holeRingMat.color.set('#cbd5e1');
    filmBorderMat.color.set('#ffffff');

    if (state.phase === 'align') {
      guidePill.classList.remove('bullseye');
      guidePill.textContent = '탑 · 프론트 · 레프트 구도로 모서리와 카메라 구멍을 직접 맞춰 보세요';
      btnDrop.classList.remove('bullseye-glow');
      btnDrop.textContent = '📱 지금 붙이기 (되돌리기 불가)';
    }

    const targetHoverY = state.camKey === 'top' ? 0.14 : 0.55;
    const curHoverY = THREE.MathUtils.lerp(filmGroup.position.y || targetHoverY, targetHoverY, Math.min(1, dt * 8));
    filmGroup.position.set(state.liveFilmX, curHoverY, state.liveFilmZ);
    filmGroup.rotation.set(state.filmTiltX, (state.liveAngleDeg * Math.PI) / 180, state.filmTiltZ);
    filmGlassMat.opacity = 0.22;
    if (holeRing) holeRing.visible = true;

    const targetPreset = getCamPreset(state.camKey);
    camCurPos.lerp(targetPreset.pos, Math.min(1, dt * 7.5));
    camCurLook.lerp(targetPreset.look, Math.min(1, dt * 7.5));
  } else if (state.phase === 'adhering') {
    state.adhereP = Math.min(1, state.adhereP + dt / 2.2);
    filmGroup.position.set(state.filmX, Math.max(0.032, (1 - Math.min(1, state.adhereP * 6)) * 0.85), state.filmZ);
    filmGroup.rotation.set(0, (state.filmAngleDeg * Math.PI) / 180, 0);
    filmGlassMat.opacity = 0.08;

    const lineZ = -ph * 0.5 + ph * state.adhereP;
    const remH = Math.max(0.01, ph * (1 - state.adhereP));
    if (unbondedMesh) {
      unbondedMesh.scale.set(1, remH / (ph - 0.25), 1);
      unbondedMesh.position.z = lineZ + remH / 2;
      unbondedMat.opacity = 0.16;
    }
    if (frontLineMesh) {
      frontLineMesh.position.z = lineZ;
      frontLineMat.opacity = 0.92;
    }

    // 🎬 접착선 실시간 대각선 추적 카메라 무빙!
    _dynCamPos.set(9.2 - state.adhereP * 5.0, 14.5 + state.adhereP * 4.5, lineZ + 11.5);
    _dynCamLook.set(0, 0.1, lineZ + 0.6);
    camCurPos.lerp(_dynCamPos, Math.min(1, dt * 5.5));
    camCurLook.lerp(_dynCamLook, Math.min(1, dt * 6.5));

    for (let i = state.dusts.length - 1; i >= 0; i--) {
      const d = state.dusts[i];
      const ahead = d.z - lineZ;
      if (ahead > 0 && ahead < 0.9) {
        d.x += (d.x < 0 ? -1 : 1) * 0.75 * dt;
      }
      d.mesh.position.set(d.x, 0.1, d.z);
      if (Math.abs(d.x) > pw * 0.52) {
        dustGroup.remove(d.mesh);
        state.dusts.splice(i, 1);
        continue;
      }
      if (d.z <= lineZ) {
        dustGroup.remove(d.mesh);
        state.dusts.splice(i, 1);
        spawnBubble(d.x, d.z, 0.42);
        SFX.hit();
        vfx.shakeMag = Math.max(vfx.shakeMag, 0.34);
        const bp = worldToScreen(d.x, 0.1, d.z);
        spawnSparks(bp.x, bp.y, 16, ['#ff3b5c', '#ffe24a', '#ffffff']);
        spawnPopText('으악! 기포!!', '', bp.x, bp.y - 26, {
          size: viewW < 500 ? 30 : 38,
          color: '#ff3b5c',
          shadow: '#16111f',
          life: 0.65,
          vy: -42,
        });
        stBubbles.textContent = String(state.bubbles.length);
        stBubbles.style.color = '#fb923c';
      }
    }
    stDust.textContent = String(state.dusts.length);
    if (state.adhereP >= 1) enterSqueegee();
  } else if (state.phase === 'squeegee') {
    if (holeRing) holeRing.visible = false;
    state.squeegeeSec += dt;
    const remainSec = Math.max(0, HARDEN_SEC - state.squeegeeSec);
    const hardenPct = Math.min(100, Math.round((state.squeegeeSec / HARDEN_SEC) * 100));
    stExtra.textContent = `⏳ 경화 ${hardenPct}% (${remainSec.toFixed(1)}초)`;
    stExtra.style.color = hardenPct > 65 ? '#f87171' : hardenPct > 35 ? '#fb923c' : '#4ade80';

    // 기포 제거 중에는 화면이 절대 돌아가거나 흔들리지 않도록 정면 수직 탑뷰 100% 고정!
    const sqTarget = getCamPreset('top');
    camCurPos.copy(sqTarget.pos);
    camCurLook.copy(sqTarget.look);
    vfx.shakeMag = 0;

    cardGroup.position.set(state.cardX, state.cardDown ? 0.04 : 0.75, state.cardZ);
    const glow = cardGroup.getObjectByName('edgeGlow');
    if (glow) glow.material.color.set(state.cardSpeed > 0.22 ? '#4ade80' : '#fb923c');

    for (let i = state.bubbles.length - 1; i >= 0; i--) {
      const b = state.bubbles[i];
      if (b.locked) continue;

      b.harden = Math.min(1, state.squeegeeSec / HARDEN_SEC);
      if (b.harden >= 1) {
        b.locked = true;
        b.mat.color.set('#64748b');
        b.mat.opacity = 0.75;
        SFX.split();
        const bp = worldToScreen(b.x, 0.1, b.z);
        spawnPopText('굳었다!!', '', bp.x, bp.y - 24, { size: 32, color: '#94a3b8', shadow: '#16111f', life: 0.65 });
        continue;
      } else if (b.harden > 0.65) b.mat.color.set('#f87171');
      else if (b.harden > 0.35) b.mat.color.set('#fb923c');
      else b.mat.color.set('#d7eeff');

      if (state.cardDown) {
        const dx = b.x - state.cardX;
        const dz = b.z - state.cardZ;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.7 + b.r) {
          const minSpeedNeeded = 0.04 + b.harden * 0.26;
          if (state.cardSpeed >= minSpeedNeeded) {
            const fluidity = Math.pow(1 - b.harden, 1.55);
            const nx = dist > 0.02 ? dx / dist : 1;
            const nz = dist > 0.02 ? dz / dist : 0;
            const push = Math.min(0.45, (state.cardSpeed - minSpeedNeeded * 0.4) * (1.25 * fluidity + 0.14));
            b.x += nx * push;
            b.z += nz * push;
          }
        }
      } else {
        const spring = (1 - b.harden) * 0.9;
        b.x += (b.ox - b.x) * Math.min(1, dt * spring);
        b.z += (b.oz - b.z) * Math.min(1, dt * spring);
      }

      b.mesh.position.set(b.x, 0.045, b.z);
      if (Math.abs(b.x) > pw * 0.49 || Math.abs(b.z) > ph * 0.49) {
        SFX.pop();
        spawnPop(b.x, b.z);
        const bp = worldToScreen(b.x, 0.1, b.z);
        spawnSparks(bp.x, bp.y, 22, ['#4ade80', '#ffe24a', '#ffffff']);
        spawnPopText('뽁!! 격파!!', '', bp.x, bp.y - 28, { size: 36, color: '#4ade80', shadow: '#16111f', life: 0.65, vy: -48 });
        bubbleGroup.remove(b.mesh);
        state.bubbles.splice(i, 1);
        stBubbles.textContent = String(state.bubbles.length);
        stBubbles.style.color = state.bubbles.length === 0 ? '#4ade80' : '#fb923c';
      }
    }

    const movable = state.bubbles.filter(b => !b.locked).length;
    if (state.bubbles.length === 0 || movable === 0) finishGame();
  } else if (state.phase === 'done') {
    if (holeRing) holeRing.visible = false;
    state.sheen = Math.min(1, state.sheen + dt * 1.15);
    if (vfx.stampAnim > 0) vfx.stampAnim = Math.min(1, vfx.stampAnim + rawDt * 2.8);

    // 🎬 완료 3초간 영광의 360° 오빗 카메라 무빙!
    vfx.orbitAngle += rawDt * 0.72;
    const rad = state.bubbles.length === 0 ? 19.5 : 22.5;
    _dynCamPos.set(Math.sin(vfx.orbitAngle) * rad, 19.5 + Math.sin(vfx.orbitAngle * 1.5) * 3.0, Math.cos(vfx.orbitAngle) * rad);
    _dynCamLook.set(0, 0.2, 0);
    camCurPos.lerp(_dynCamPos, Math.min(1, rawDt * 3.8));
    camCurLook.lerp(_dynCamLook, Math.min(1, rawDt * 4.5));

    if (state.bubbles.length === 0) {
      state.screenOn = Math.min(1, state.screenOn + dt * 1.4);
      const c = new THREE.Color('#0c0f16').lerp(new THREE.Color('#9ad8f8'), state.screenOn);
      screenMat.color.copy(c);
      sheenMat.opacity = Math.sin(state.sheen * Math.PI) * 0.58;
      if (sheenMesh) sheenMesh.position.z = -ph * 0.46 + ph * 0.92 * state.sheen;
    }
  }

  for (let i = state.pops.length - 1; i >= 0; i--) {
    const p = state.pops[i];
    p.life -= dt;
    p.ring.scale.addScalar(dt * 5.2);
    p.mat.opacity = Math.max(0, p.life / 0.35);
    if (p.life <= 0) { popGroup.remove(p.ring); state.pops.splice(i, 1); }
  }

  // FOV 펀치 & 카메라 흔들림 적용 (기포 제거 중에는 화면 절대 고정!)
  const targetFov = state.phase === 'squeegee' ? baseFov : (baseFov - vfx.fovPunch);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }
  if (vfx.shakeMag > 0.005 && state.phase !== 'squeegee') {
    const sx = (Math.random() - 0.5) * vfx.shakeMag * 1.2;
    const sy = (Math.random() - 0.5) * vfx.shakeMag * 1.2;
    camera.position.set(camCurPos.x + sx, camCurPos.y + sy, camCurPos.z);
    camera.lookAt(camCurLook.x + sx * 0.25, camCurLook.y + sy * 0.25, camCurLook.z);
  } else {
    camera.position.copy(camCurPos);
    camera.lookAt(camCurLook);
  }

  renderer.render(scene, camera);
  drawOverlay(nowSec, isBullseye);
}

(async () => {
  const best = getBestRecord('film');
  if (best) document.getElementById('start-best').textContent = `${Math.round(best.score)}점`;
  const inc = await loadIncomingChallenge('film');
  if (inc) {
    state.rival = inc;
    if (inc.meta && inc.meta.model && PHONE_MODELS[inc.meta.model]) {
      state.modelKey = inc.meta.model;
      document.querySelectorAll('.model-card').forEach(c => c.classList.toggle('active', c.dataset.model === state.modelKey));
    }
    initRound(inc.seed || 99);
    document.getElementById('rival-banner').style.display = 'flex';
    document.getElementById('status-bar').classList.add('with-rival');
    camDock.classList.add('with-rival');
    document.getElementById('rival-banner-text').innerHTML = `<strong>${esc(inc.nickname)}</strong>님의 기록: <strong>${Math.round(inc.score)}점</strong> (오차 ${Number(inc.errorMm || 0).toFixed(2)}mm)`;
    const sb = document.getElementById('start-rival-box');
    sb.style.display = 'flex';
    sb.innerHTML = `<div class="vs-verdict" style="color:var(--accent);font-size:15px">🏆 내가 아는 ${esc(inc.nickname)}님: ${Math.round(inc.score)}점 (${esc(inc.rankTitle)})</div>`;
  } else {
    initRound(state.seed);
  }
  requestAnimationFrame(animate);
})();
