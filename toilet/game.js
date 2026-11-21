// 무한 두루마리 — Three.js 3D 화장실 + 풀 모델링 양손(실제 돌돌돌돌 감기!) + 곡선 휴지 리본 + 진짜 미라 변신
// 1. 따뜻한 타일 화장실 인테리어(우드 선반·디퓨저·화분·여분 휴지·크롬 휴지 걸이·나선 단면 3D 두루마리 롤)
// 2. 풀 3D 인체(얼굴 없음!): 5손가락·손톱·소매까지 구현한 왼손(감는 축) & 오른손(마우스/터치 각도를 따라 실제로 빙글빙글 돌며 휴지를 감음!) + 청바지·스니커즈 양다리
// 3. 3D 곡선 휴지 리본(두루마리 롤 → 오른손으로 부드럽게 휘어 흘러내리며 절취선 텍스처가 실시간 스크롤!)
// 4. 10m마다 화이팅 응원 메시지 + 물리법칙 무시 100km 가능 + 3D 미라 붕대 슬리브 & 나부끼는 붕대 꼬리 진화!
// 5. 길이(m / km) 기준 전체 플레이어 글로벌 랭킹 + 8비트 웅장 BGM!

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SFX, BGM, unlockAudio } from '../shared/audio.js';
import { enforceGameAccess } from '../shared/catalog.js';
enforceGameAccess('toilet');
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
} from '../shared/challenge.js';

const gl = document.getElementById('gl');
const ov = document.getElementById('ov');
const ovCtx = ov.getContext('2d');

const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c5d8d5');
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.56;
  pmrem.dispose();
}

const camera = new THREE.PerspectiveCamera(42, 1, 0.2, 120);

// ── 전용 열혈 화장실 효과음 신스 ──
let _tpAC = null;
function getTpAC() {
  try {
    if (!_tpAC) _tpAC = new (window.AudioContext || window.webkitAudioContext)();
    if (_tpAC.state === 'suspended') _tpAC.resume();
    return _tpAC;
  } catch { return null; }
}
const TP_SFX = {
  knock() {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    // 나무 화장실 문 노크 공명음 ("똑!")
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(240, now);
    o.frequency.exponentialRampToValueAtTime(105, now + 0.065);
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    o.connect(g).connect(ac.destination);
    o.start(now); o.stop(now + 0.095);

    const hi = ac.createOscillator();
    const hg = ac.createGain();
    hi.type = 'sine';
    hi.frequency.setValueAtTime(620, now);
    hi.frequency.exponentialRampToValueAtTime(280, now + 0.03);
    hg.gain.setValueAtTime(0.16, now);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    hi.connect(hg).connect(ac.destination);
    hi.start(now); hi.stop(now + 0.05);
  },
  doorSlam() {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    const d = ac.createOscillator();
    const dg = ac.createGain();
    d.type = 'sine';
    d.frequency.setValueAtTime(165, now);
    d.frequency.exponentialRampToValueAtTime(38, now + 0.24);
    dg.gain.setValueAtTime(0.32, now);
    dg.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    d.connect(dg).connect(ac.destination);
    d.start(now); d.stop(now + 0.28);
  },
  sitThud() {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(135, now);
    o.frequency.exponentialRampToValueAtTime(46, now + 0.14);
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o.connect(g).connect(ac.destination);
    o.start(now); o.stop(now + 0.18);
  },
  sigh() {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    const len = Math.floor(ac.sampleRate * 0.42);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.sin((i / len) * Math.PI);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(980, now);
    flt.frequency.exponentialRampToValueAtTime(420, now + 0.40);
    flt.Q.value = 2.4;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(flt).connect(g).connect(ac.destination);
    src.start(now);
  },
  strain() {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const lfo = ac.createOscillator();
    const lfoG = ac.createGain();
    const g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(84, now);
    o.frequency.linearRampToValueAtTime(138, now + 0.68);
    lfo.frequency.setValueAtTime(22, now);
    lfoG.gain.setValueAtTime(14, now);
    lfo.connect(lfoG).connect(o.frequency);
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(340, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.08);
    g.gain.setValueAtTime(0.18, now + 0.56);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    o.connect(flt).connect(g).connect(ac.destination);
    o.start(now); lfo.start(now);
    o.stop(now + 0.75); lfo.stop(now + 0.75);
  },
  reliefDing() {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    [1046.5, 1567.98].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now + i * 0.05);
      g.gain.setValueAtTime(0.16, now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.34);
      o.connect(g).connect(ac.destination);
      o.start(now + i * 0.05); o.stop(now + i * 0.05 + 0.36);
    });
  },
  holyGlint() {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    [880, 1108.7, 1318.5, 1760].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, now + i * 0.04);
      g.gain.setValueAtTime(0.001, now + i * 0.04);
      g.gain.linearRampToValueAtTime(0.11, now + i * 0.04 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.32);
      o.connect(g).connect(ac.destination);
      o.start(now + i * 0.04); o.stop(now + i * 0.04 + 0.34);
    });
  },
  rollTick(speedMul = 1) {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    const baseF = Math.min(1800, 420 + speedMul * 140);
    o.frequency.setValueAtTime(baseF, now);
    o.frequency.exponentialRampToValueAtTime(baseF * 1.25, now + 0.035);
    g.gain.setValueAtTime(0.045, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
    o.connect(g).connect(ac.destination);
    o.start(now); o.stop(now + 0.046);
  },
  cheerFanfare(level = 1) {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    const shift = Math.min(6, level) * 28;
    [523.25 + shift, 659.25 + shift, 783.99 + shift, 1046.5 + shift].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(f, now + i * 0.055);
      g.gain.setValueAtTime(0.001, now + i * 0.055);
      g.gain.linearRampToValueAtTime(0.085, now + i * 0.055 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.24);
      o.connect(g).connect(ac.destination);
      o.start(now + i * 0.055); o.stop(now + i * 0.055 + 0.26);
    });
  },
  ripSnap() {
    const ac = getTpAC(); if (!ac) return;
    const now = ac.currentTime;
    const len = Math.floor(ac.sampleRate * 0.26);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len * 0.5);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(1600, now);
    flt.frequency.exponentialRampToValueAtTime(4200, now + 0.16);
    flt.Q.value = 2.0;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    src.connect(flt).connect(g).connect(ac.destination);
    src.start(now);

    const lo = ac.createOscillator();
    const lg = ac.createGain();
    lo.type = 'sawtooth';
    lo.frequency.setValueAtTime(190, now);
    lo.frequency.exponentialRampToValueAtTime(48, now + 0.28);
    lg.gain.setValueAtTime(0.22, now);
    lg.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
    lo.connect(lg).connect(ac.destination);
    lo.start(now); lo.stop(now + 0.32);
  },
};

// ── 조명 (따뜻한 실내등 + 입체 음영이 또렷해 하얀 휴지가 확 살아남!) ──
scene.add(new THREE.HemisphereLight('#fffdf8', '#7b9496', 1.15));
const keyLight = new THREE.DirectionalLight('#fff6e5', 1.38);
keyLight.position.set(-4, 15, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

const holyLight = new THREE.PointLight('#ffe07a', 0, 16, 1.4);
holyLight.position.set(2.1, 4.0, -1.8);
scene.add(holyLight);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── 공용 재질 (따뜻한 세이지/민트 타일 대비로 하얀 두루마리·붕대가 선명하게 보임!) ──
const skinMat = new THREE.MeshStandardMaterial({ color: '#f2c6a6', roughness: 0.48, metalness: 0.02 });
const nailMat = new THREE.MeshStandardMaterial({ color: '#fde4d8', roughness: 0.25, metalness: 0.05 });
const sleeveMat = new THREE.MeshStandardMaterial({ color: '#2b3648', roughness: 0.72 });
const cuffMat = new THREE.MeshStandardMaterial({ color: '#3b4a62', roughness: 0.68 });
const jeansMat = new THREE.MeshStandardMaterial({ color: '#334e73', roughness: 0.78 });
const jeanCuffMat = new THREE.MeshStandardMaterial({ color: '#53739c', roughness: 0.80 });
const sockMat = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.85 });
const shoeMat = new THREE.MeshStandardMaterial({ color: '#e85d56', roughness: 0.48 });
const soleMat = new THREE.MeshStandardMaterial({ color: '#fafaf7', roughness: 0.52 });
const woodMat = new THREE.MeshStandardMaterial({ color: '#c48f5a', roughness: 0.62 });
const chromeMat = new THREE.MeshStandardMaterial({ color: '#d5dee6', roughness: 0.16, metalness: 0.90 });

// 두루마리 엠보싱 + 점선 절취선 텍스처
const paperTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e2e9ef';
  for (let y = 14; y < h; y += 26) {
    for (let x = 14; x < w; x += 26) {
      g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
    }
  }
  g.strokeStyle = '#9db0c0';
  g.lineWidth = 3;
  g.setLineDash([9, 7]);
  g.beginPath(); g.moveTo(0, h * 0.5); g.lineTo(w, h * 0.5); g.stroke();
  g.setLineDash([]);
  // 양옆 테두리 살짝 음영
  g.fillStyle = 'rgba(130, 150, 170, 0.16)';
  g.fillRect(0, 0, 8, h);
  g.fillRect(w - 8, 0, 8, h);
});
paperTex.wrapS = paperTex.wrapT = THREE.RepeatWrapping;

// 두루마리 옆면(겹겹이 나선 + 갈색 휴지심 단면 텍스처!)
const rollEndTex = canvasTex(256, 256, (g, w, h) => {
  const cx = w / 2, cy = h / 2;
  g.fillStyle = '#f8f8f5';
  g.fillRect(0, 0, w, h);
  // 겹겹이 감긴 종이 층 동심원
  for (let r = 122; r >= 46; r -= 5.5) {
    g.strokeStyle = r % 11 < 5 ? '#d4dce2' : '#e6ecef';
    g.lineWidth = 1.6;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  }
  // 갈색 골판지 심 테두리
  g.fillStyle = '#a4754a';
  g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI * 2); g.fill();
  // 안쪽 어두운 구멍
  g.fillStyle = '#4a301d';
  g.beginPath(); g.arc(cx, cy, 34, 0, Math.PI * 2); g.fill();
});

// 진짜 미라 붕대 교차 감김 텍스처 (팔·다리 슬리브에 감겨 완벽한 미라 비주얼!)
const mummyTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#f4efe2';
  g.fillRect(0, 0, w, h);
  // 엇갈린 사선 붕대 줄무늬 + 음영!
  for (let i = -4; i < 12; i++) {
    const y0 = i * 32;
    g.save();
    g.translate(0, y0);
    g.rotate(i % 2 === 0 ? 0.14 : -0.14);
    g.fillStyle = i % 2 === 0 ? '#faf6eb' : '#ede6d5';
    g.fillRect(-40, 0, w + 80, 28);
    g.fillStyle = 'rgba(110, 96, 76, 0.28)';
    g.fillRect(-40, 26, w + 80, 4);
    g.fillStyle = 'rgba(255, 255, 255, 0.55)';
    g.fillRect(-40, 0, w + 80, 2);
    g.restore();
  }
});
mummyTex.wrapS = mummyTex.wrapT = THREE.RepeatWrapping;
mummyTex.repeat.set(2, 2);

const paperMat = new THREE.MeshStandardMaterial({ map: paperTex, color: '#ffffff', roughness: 0.72, side: THREE.DoubleSide });
const rollEndMat = new THREE.MeshStandardMaterial({ map: rollEndTex, roughness: 0.80 });
const mummyMat = new THREE.MeshStandardMaterial({ map: mummyTex, color: '#ffffff', roughness: 0.82 });
const goldPaperMat = new THREE.MeshStandardMaterial({ map: paperTex, color: '#ffe88a', emissive: '#d97706', emissiveIntensity: 0.24, roughness: 0.42, side: THREE.DoubleSide });
const goldMummyMat = new THREE.MeshStandardMaterial({ map: mummyTex, color: '#ffe994', emissive: '#d97706', emissiveIntensity: 0.25, roughness: 0.45 });

// ── 1) 세련된 파스텔 세이지 타일 3D 화장실 인테리어 (하얀 휴지가 완벽하게 돋보이는 대비!) ──
const stallGroup = new THREE.Group();
scene.add(stallGroup);
{
  // 세이지 민트 + 크림 상하 투톤 타일 벽
  const tileTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#bfd6d2';
    g.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 === 0 ? '#c8deda' : '#b7d0cc';
        g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      }
    }
    g.strokeStyle = '#95b2ad';
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
    }
  });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.repeat.set(4, 3.5);
  const wallMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.48 });

  // 바닥 체커 타일 (따뜻한 슬레이트 + 베이지)
  const floorTex = canvasTex(256, 256, (g, w, h) => {
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 === 0 ? '#a8bbb8' : '#8da3a0';
        g.fillRect(x * s, y * s, s, s);
      }
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(4, 4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.62 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  stallGroup.add(floor);

  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 15), wallMat);
  frontWall.position.set(0, 7.5, -6.4);
  stallGroup.add(frontWall);

  // 정면 벽 허리 몰딩 + 우드 선반 + 방향제 디퓨저 + 여분 휴지 2롤 + 미니 화분!
  const wallTrim = new THREE.Mesh(new THREE.BoxGeometry(14, 0.25, 0.2), woodMat);
  wallTrim.position.set(0, 4.4, -6.3);
  stallGroup.add(wallTrim);

  const wallShelf = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 1.1), woodMat);
  wallShelf.position.set(-1.1, 6.2, -5.85);
  wallShelf.castShadow = true;
  stallGroup.add(wallShelf);

  // 선반 위 여분 두루마리 2개 쌓기
  for (let i = 0; i < 2; i++) {
    const spare = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.78, 20),
      [paperMat, rollEndMat, rollEndMat]
    );
    spare.position.set(-2.6 + i * 0.96, 6.72, -5.8);
    stallGroup.add(spare);
  }
  // 선반 위 유리 디퓨저 + 스틱 3개
  const diffBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.30, 0.62, 14),
    new THREE.MeshStandardMaterial({ color: '#e6b88a', roughness: 0.22 })
  );
  diffBottle.position.set(-0.2, 6.62, -5.8);
  stallGroup.add(diffBottle);
  [-0.18, 0, 0.18].forEach(a => {
    const stk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 6), woodMat);
    stk.position.set(-0.2 + a * 0.6, 7.1, -5.8);
    stk.rotation.z = a;
    stallGroup.add(stk);
  });
  // 선반 위 미니 테라코타 화분
  const miniPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.24, 0.55, 14),
    new THREE.MeshStandardMaterial({ color: '#d88a59', roughness: 0.78 })
  );
  miniPot.position.set(0.9, 6.58, -5.8);
  stallGroup.add(miniPot);
  const miniLeafMat = new THREE.MeshStandardMaterial({ color: '#55a264', roughness: 0.5 });
  for (let i = 0; i < 5; i++) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), miniLeafMat);
    lf.scale.set(0.7, 1.8, 0.4);
    const a = (i / 5) * Math.PI * 2;
    lf.position.set(0.9 + Math.cos(a) * 0.18, 7.05, -5.8 + Math.sin(a) * 0.16);
    lf.rotation.set(Math.sin(a) * 0.4, a, -Math.cos(a) * 0.4);
    stallGroup.add(lf);
  }

  // 키치한 화장실 포스터 ("무한 두루마리 챌린지 · 100km 가능!")
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 1.3),
    new THREE.MeshBasicMaterial({
      map: canvasTex(360, 130, (g, w, h) => {
        g.fillStyle = '#fff9e6'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#16111f'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
        g.fillStyle = '#e11d48';
        g.font = 'italic 900 30px Pretendard, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('🧻 무한 두루마리!', w / 2, h * 0.38);
        g.fillStyle = '#16111f';
        g.font = '800 18px Pretendard, sans-serif';
        g.fillText('물리법칙 무시 · 100km 도전!', w / 2, h * 0.74);
      })
    })
  );
  signMesh.position.set(-1.1, 8.2, -6.32);
  stallGroup.add(signMesh);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(18, 15), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-4.35, 7.5, 0);
  stallGroup.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(18, 15), wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(4.35, 7.5, 0);
  stallGroup.add(rightWall);
}

// ── 2) 인트로용 벌컥!! 열리는 3D 화장실 문 ──
const doorPivot = new THREE.Group();
doorPivot.position.set(-4.35, 0, 5.2);
scene.add(doorPivot);
{
  const doorMat = new THREE.MeshStandardMaterial({ color: '#5c8296', roughness: 0.45 });
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(8.7, 13.5, 0.35), doorMat);
  doorPanel.position.set(4.35, 6.9, 0);
  doorPivot.add(doorPanel);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), chromeMat);
  knob.position.set(7.55, 6.2, 0.35);
  doorPivot.add(knob);

  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.5),
    new THREE.MeshBasicMaterial({
      map: canvasTex(256, 114, (g, w, h) => {
        g.fillStyle = '#16111f'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#ffe24a'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
        g.fillStyle = '#ffe24a';
        g.font = 'italic 900 36px Pretendard, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('🚪 화장실', w / 2, h / 2);
      })
    })
  );
  badge.position.set(4.35, 8.6, 0.22);
  doorPivot.add(badge);
}

// ── 2-B) CUT 1 노크 전용 둥글고 자연스러운 3D 주먹 (손등·접힌 네 손가락 마디·엄지·맨투맨 소매!) ──
const knockFistGroup = new THREE.Group();
knockFistGroup.visible = false;
scene.add(knockFistGroup);
{
  const kPalm = new THREE.Mesh(new THREE.SphereGeometry(0.56, 20, 16), skinMat);
  kPalm.scale.set(1.08, 0.96, 1.02);
  kPalm.castShadow = true;
  knockFistGroup.add(kPalm);
  for (let i = 0; i < 4; i++) {
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skinMat);
    kn.position.set(-0.34 + i * 0.22, 0.30 - Math.abs(i - 1.5) * 0.04, -0.44);
    knockFistGroup.add(kn);
    const curl = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.34, 8, 10), skinMat);
    curl.position.set(-0.34 + i * 0.22, -0.02, -0.50);
    knockFistGroup.add(curl);
  }
  const kThumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.42, 8, 10), skinMat);
  kThumb.rotation.set(0.18, 0.32, Math.PI / 2 - 0.22);
  kThumb.position.set(-0.48, -0.14, -0.34);
  knockFistGroup.add(kThumb);
  const kWrist = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), skinMat);
  kWrist.position.set(0, -0.04, 0.56);
  knockFistGroup.add(kWrist);
  const kArm = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 1.9, 16), skinMat);
  kArm.rotation.x = Math.PI / 2;
  kArm.position.set(0, -0.04, 1.50);
  knockFistGroup.add(kArm);
  const kCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.50, 0.38, 16), cuffMat);
  kCuff.rotation.x = Math.PI / 2;
  kCuff.position.set(0, -0.04, 2.55);
  knockFistGroup.add(kCuff);
  const kSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.60, 3.4, 16), sleeveMat);
  kSleeve.rotation.x = Math.PI / 2;
  kSleeve.position.set(0, -0.04, 4.35);
  knockFistGroup.add(kSleeve);
}

// ── 2-C) 화이트 세라믹 3D 변기 (다리 뒤·아래에 자연스럽게 배치! 절대로 다리 앞으로 튀어나오지 않음) ──
const toiletGroup = new THREE.Group();
scene.add(toiletGroup);
{
  const ceramicMat = new THREE.MeshStandardMaterial({ color: '#fafbfd', roughness: 0.14, metalness: 0.04 });
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 1.38, 20), ceramicMat);
  ped.position.set(0, 0.69, 1.85);
  ped.castShadow = true; ped.receiveShadow = true;
  toiletGroup.add(ped);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.12, 0.72, 24), ceramicMat);
  bowl.scale.set(1.06, 1, 1.24);
  bowl.position.set(0, 1.42, 1.55);
  bowl.castShadow = true;
  toiletGroup.add(bowl);

  const seat = new THREE.Mesh(new THREE.TorusGeometry(1.26, 0.24, 14, 28), ceramicMat);
  seat.rotation.x = Math.PI / 2;
  seat.scale.set(1.04, 1.22, 0.68);
  seat.position.set(0, 1.82, 1.52);
  toiletGroup.add(seat);

  // 변기 뒤 물탱크 + 크롬 물내림 레버
  const tank = new THREE.Mesh(new THREE.BoxGeometry(2.65, 2.35, 1.12), ceramicMat);
  tank.position.set(0, 2.95, 2.92);
  tank.castShadow = true;
  toiletGroup.add(tank);

  const tankLid = new THREE.Mesh(new THREE.BoxGeometry(2.80, 0.20, 1.26), ceramicMat);
  tankLid.position.set(0, 4.18, 2.92);
  toiletGroup.add(tankLid);

  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.58, 10), chromeMat);
  lever.rotation.z = Math.PI / 2;
  lever.position.set(-1.55, 3.72, 2.55);
  toiletGroup.add(lever);
}

// ── 3) 오른쪽 옆벽 크롬 휴지 걸이 + 겹겹이 나선 단면 3D 두루마리 휴지 롤 (변기 뒤가 아니라 오른쪽 옆벽!!) ──
const HOLDER_POS = new THREE.Vector3(3.26, 3.65, -2.25);
const holderGroup = new THREE.Group();
holderGroup.position.copy(HOLDER_POS);
holderGroup.rotation.y = -Math.PI / 2; // 오른쪽 벽(x=4.35)에 딱 밀착! 앞(+z)에서 나선 단면이 선명하고 안쪽(-x)으로 풀려나옴!
scene.add(holderGroup);

const holderBack = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.55, 0.16), chromeMat);
holderBack.position.set(0, 0.65, -1.05);
holderGroup.add(holderBack);

const holderCover = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 1.9), chromeMat);
holderCover.position.set(0, 1.15, -0.08);
holderCover.rotation.x = 0.14;
holderGroup.add(holderCover);

[-1.18, 1.18].forEach(sx => {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 1.05), chromeMat);
  arm.position.set(sx, 0.32, -0.52);
  holderGroup.add(arm);
});

const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.55, 12), chromeMat);
rod.rotation.z = Math.PI / 2;
holderGroup.add(rod);

// 회전하는 3D 두루마리 휴지 본체 (옆면 = 겹겹이 나선 + 갈색 휴지심, 둘레 = 엠보싱+절취선!)
const rollGroup = new THREE.Group();
holderGroup.add(rollGroup);
const rollBody = new THREE.Mesh(
  new THREE.CylinderGeometry(0.95, 0.95, 2.05, 32),
  [paperMat, rollEndMat, rollEndMat]
);
rollBody.rotation.z = Math.PI / 2;
rollBody.castShadow = true;
rollGroup.add(rollBody);

// ── 4) 3D 곡선 휴지 리본 (오른쪽 옆벽 두루마리 롤 → 감는 오른손으로 부드럽게 휘어 흘러내리는 실제 3D 메시!) ──
const RIBBON_SEGS = 22;
const ribbonGeo = new THREE.BufferGeometry();
const ribbonPos = new Float32Array((RIBBON_SEGS + 1) * 2 * 3);
const ribbonUV = new Float32Array((RIBBON_SEGS + 1) * 2 * 2);
const ribbonIdx = [];
for (let i = 0; i <= RIBBON_SEGS; i++) {
  const v = i / RIBBON_SEGS;
  ribbonUV[i * 4 + 0] = 0; ribbonUV[i * 4 + 1] = v * 3.5;
  ribbonUV[i * 4 + 2] = 1; ribbonUV[i * 4 + 3] = v * 3.5;
  if (i < RIBBON_SEGS) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    ribbonIdx.push(a, c, b, b, c, d);
  }
}
ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPos, 3));
ribbonGeo.setAttribute('uv', new THREE.BufferAttribute(ribbonUV, 2));
ribbonGeo.setIndex(ribbonIdx);
const ribbonMesh = new THREE.Mesh(ribbonGeo, paperMat);
scene.add(ribbonMesh);

// ── 5) 풀 3D 인체 모델링 (얼굴 없음!): 손가락 5개·손톱·소매 양손 + 청바지·스니커즈 양다리 + 진짜 미라 변신! ──
const bodyGroup = new THREE.Group();
scene.add(bodyGroup);

// 손가락 5개 + 손톱 + 걷어 올린 소매가 있는 예쁜 3D 손 빌더! (fingersGroup으로 펴기/주먹 쥐기 전환!)
function buildDetailedHand(isRight) {
  const s = isRight ? 1 : -1;
  const g = new THREE.Group();

  // 손바닥
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 14), skinMat);
  palm.scale.set(1.08, 0.56, 1.24);
  palm.castShadow = true;
  g.add(palm);

  // 네 손가락 + 손톱 (fingersGroup 피벗을 손등 앞쪽 z=-0.42에 두어 주먹 쥘 때 자연스럽게 굽힘!)
  const fingersGroup = new THREE.Group();
  fingersGroup.position.set(0, 0, -0.42);
  g.add(fingersGroup);

  const fLens = [0.62, 0.72, 0.66, 0.52];
  for (let i = 0; i < 4; i++) {
    const fx = s * (-0.30 + i * 0.20);
    const fl = fLens[i];
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, fl, 8, 10), skinMat);
    f.rotation.x = Math.PI / 2;
    f.position.set(fx, -0.02, -fl * 0.44);
    f.castShadow = true;
    fingersGroup.add(f);

    const nail = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), nailMat);
    nail.scale.set(0.95, 0.35, 1.15);
    nail.position.set(fx, 0.06, -fl * 0.84);
    fingersGroup.add(nail);
  }

  // 엄지손가락
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.44, 8, 10), skinMat);
  thumb.rotation.set(Math.PI / 2 - 0.15, 0, s * 0.55);
  thumb.position.set(s * -0.46, -0.04, -0.18);
  g.add(thumb);

  // 손목 관절 + 팔뚝 살 + 맨투맨 커프스 + 소매
  const wJoint = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), skinMat);
  wJoint.position.set(0, 0, 0.48);
  g.add(wJoint);

  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.38, 1.7, 16), skinMat);
  forearm.rotation.x = Math.PI / 2;
  forearm.position.set(0, 0, 1.32);
  g.add(forearm);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.47, 0.36, 16), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0, 2.25);
  g.add(cuff);

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.56, 3.2, 16), sleeveMat);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.set(0, 0, 3.95);
  g.add(sleeve);

  // 팔뚝 미라 붕대 슬리브 (길이가 늘수록 스르륵 켜지며 팔 전체를 감쌈!)
  const armMummy = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.60, 4.4, 20), mummyMat);
  armMummy.rotation.x = Math.PI / 2;
  armMummy.position.set(0, 0, 2.65);
  armMummy.visible = false;
  g.add(armMummy);

  g.userData = { armMummy, fingersGroup };
  return g;
}

// 5-A. 왼손 (화면 중앙에서 손바닥을 쫙 펴고 휴지가 돌돌 감길 중심 축 역할!)
const leftHandGroup = buildDetailedHand(false);
leftHandGroup.scale.setScalar(0.76);
leftHandGroup.position.set(-0.20, 2.45, -1.35);
leftHandGroup.rotation.set(0.18, -0.35, -0.15);
bodyGroup.add(leftHandGroup);

// 왼손 주위에 실제로 겹겹이 감겨 점점 거대해지는 3D 휴지 패드 뭉치!
const wrappedPadGroup = new THREE.Group();
wrappedPadGroup.position.set(0, 0, -0.38);
leftHandGroup.add(wrappedPadGroup);

const wrappedPad = new THREE.Mesh(
  new THREE.CylinderGeometry(0.62, 0.64, 1.32, 24),
  [mummyMat, paperMat, paperMat]
);
wrappedPad.scale.set(1.15, 1.0, 0.72); // 손바닥 모양에 맞게 살짝 납작하게 감긴 리얼 휴지 뭉치!
wrappedPad.rotation.z = Math.PI / 2;
wrappedPad.visible = false;
wrappedPadGroup.add(wrappedPad);

// 나부끼는 붕대 꼬리 리본 2개 (미라 진화 시 펄럭임!)
const looseTails = [];
for (let i = 0; i < 2; i++) {
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 1.65), mummyMat);
  tail.position.set(i === 0 ? -0.65 : 0.65, -0.55, 0.1);
  tail.visible = false;
  wrappedPadGroup.add(tail);
  looseTails.push(tail);
}

// 5-B. 오른손 (내가 마우스/터치로 돌리는 각도를 따라 왼손 주위를 3D로 빙글빙글 돌며 휴지를 감아주는 손!)
const rightHandGroup = buildDetailedHand(true);
rightHandGroup.scale.setScalar(0.76);
rightHandGroup.position.set(0.95, 2.55, -1.30);
rightHandGroup.rotation.set(0.22, 0.45, 0.15);
bodyGroup.add(rightHandGroup);

// 5-C. 변기에 앉은 깔끔한 하체 + 맨투맨 허리(CUT 3·4 전용, 얼굴 절대 없음!)
const legsGroup = new THREE.Group();
bodyGroup.add(legsGroup);

// CUT 3·4에서 다리와 팔 사이가 어색하게 비지 않게 이어주는 맨투맨 허리·배(얼굴 없음, 플레이 시점에서는 숨김)
const torsoLower = new THREE.Group();
{
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 1.65, 20), sleeveMat);
  waist.scale.set(1.18, 1, 0.85);
  waist.position.set(0, 3.10, 1.55);
  waist.castShadow = true;
  torsoLower.add(waist);

  const hem = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.36, 0.34, 20), cuffMat);
  hem.scale.set(1.18, 1, 0.86);
  hem.position.set(0, 2.32, 1.55);
  torsoLower.add(hem);

  const hip = new THREE.Mesh(new THREE.SphereGeometry(1.38, 18, 14), jeansMat);
  hip.scale.set(1.18, 0.62, 0.85);
  hip.position.set(0, 2.02, 1.55);
  torsoLower.add(hip);
}
legsGroup.add(torsoLower);

const legMummySleeves = [];
const shoeGroups = [];
[-1, 1].forEach(side => {
  const legG = new THREE.Group();
  legG.position.set(side * 1.48, 0, 0.45);
  legsGroup.add(legG);

  // 허벅지
  const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 2.05, 12, 16), jeansMat);
  thigh.rotation.x = Math.PI / 2 - 0.12;
  thigh.position.set(0, 2.15, 1.05);
  thigh.castShadow = true;
  legG.add(thigh);

  // 정강이
  const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.49, 1.72, 12, 16), jeansMat);
  shin.position.set(0, 1.25, -0.36);
  shin.rotation.x = -0.14;
  legG.add(shin);

  // 청바지 접힌 밑단 커프스 + 흰 양말
  const jCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.55, 0.28, 16), jeanCuffMat);
  jCuff.position.set(0, 0.62, -0.48);
  legG.add(jCuff);

  const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.40, 0.36, 14), sockMat);
  sock.position.set(0, 0.42, -0.50);
  legG.add(sock);

  // 귀여운 둥근 3D 컨버스 스니커즈 (하얀 고무 앞코 토캡 + 붉은 캔버스 + 하얀 신발끈 3줄 + 둥근 밑창!)
  const shoePivot = new THREE.Group();
  shoePivot.position.set(0, 0.08, -1.62);
  legG.add(shoePivot);
  shoeGroups.push(shoePivot);

  // 둥근 캔버스 본체
  const shoeMain = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.92, 10, 14), shoeMat);
  shoeMain.rotation.x = Math.PI / 2;
  shoeMain.scale.set(1.06, 1.0, 0.68);
  shoeMain.position.set(0, 0.25, 0.80);
  shoeMain.castShadow = true;
  shoePivot.add(shoeMain);

  // 하얀 고무 앞코 토캡!
  const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.41, 14, 10), soleMat);
  toeCap.scale.set(1.04, 0.62, 0.96);
  toeCap.position.set(0, 0.20, 0.24);
  shoePivot.add(toeCap);

  // 둥근 흰 밑창 (앞·뒤 캡슐형)
  const soleMid = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.98, 8, 14), soleMat);
  soleMid.rotation.x = Math.PI / 2;
  soleMid.scale.set(1.06, 1.0, 0.34);
  soleMid.position.set(0, 0.08, 0.76);
  shoePivot.add(soleMid);

  // 하얀 신발끈 3줄!
  for (let l = 0; l < 3; l++) {
    const lace = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.42, 6, 8), soleMat);
    lace.rotation.z = Math.PI / 2;
    lace.position.set(0, 0.46 - l * 0.045, 0.76 - l * 0.16);
    shoePivot.add(lace);
  }

  // 진짜 미라 다리 붕대 슬리브 (정강이 → 허벅지 순으로 매끄럽게 청바지를 덮으며 미라로 변신!)
  const shinMummy = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.55, 2.12, 20), mummyMat);
  shinMummy.position.set(0, 1.25, -0.36);
  shinMummy.rotation.x = -0.14;
  shinMummy.visible = false;
  legG.add(shinMummy);
  legMummySleeves.push({ mesh: shinMummy, thresholdM: 18 + (side > 0 ? 3 : 0) });

  const thighMummy = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.74, 2.65, 20), mummyMat);
  thighMummy.rotation.x = Math.PI / 2 - 0.12;
  thighMummy.position.set(0, 2.15, 1.05);
  thighMummy.visible = false;
  legG.add(thighMummy);
  legMummySleeves.push({ mesh: thighMummy, thresholdM: 34 + (side > 0 ? 4 : 0) });

  // 무릎 교차 붕대 감김 포인트 링 2개
  for (let k = 0; k < 2; k++) {
    const kneeWrap = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.14, 10, 20), mummyMat);
    kneeWrap.position.set(0, 2.02 - k * 0.16, -0.15 + k * 0.22);
    kneeWrap.rotation.set(0.45, side * 0.2, k === 0 ? 0.35 : -0.35);
    kneeWrap.visible = false;
    legG.add(kneeWrap);
    legMummySleeves.push({ mesh: kneeWrap, thresholdM: 26 + k * 5 + (side > 0 ? 2 : 0) });
  }
});

// 바닥 양옆에 쌓이는 폭신한 휴지 리본 더미 (40m+부터 솟아오름!)
const pileGroupL = new THREE.Group();
const pileGroupR = new THREE.Group();
[pileGroupL, pileGroupR].forEach((pg, idx) => {
  for (let i = 0; i < 4; i++) {
    const lump = new THREE.Mesh(new THREE.TorusGeometry(0.75 - i * 0.12, 0.28, 10, 18), mummyMat);
    lump.rotation.set(Math.PI / 2 + (i % 2 ? 0.25 : -0.2), i * 0.9, 0.18);
    lump.position.set((i - 1.5) * 0.22, 0.28 + i * 0.32, (i % 2) * 0.25);
    pg.add(lump);
  }
  pg.position.set(idx === 0 ? -3.3 : 3.3, 0, -2.6);
  pg.scale.setScalar(0.01);
  pg.visible = false;
  bodyGroup.add(pg);
});

// 잘린 뒤 팔랑팔랑 날리는 3D 휴지 조각들
const flyingScraps = [];
for (let i = 0; i < 16; i++) {
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.48), paperMat);
  sc.visible = false;
  scene.add(sc);
  flyingScraps.push({ mesh: sc, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0 });
}

// ── UI 요소 ──
const hudLength = document.getElementById('hud-length');
const hudMummy = document.getElementById('hud-mummy');
const hudBoost = document.getElementById('hud-boost');
const guidePill = document.getElementById('guide-pill');
const startModal = document.getElementById('start-modal');
const resultModal = document.getElementById('result-modal');
const meterHud = document.getElementById('meter-hud');

function formatLength(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${m.toFixed(1)} m`;
}

const CHEER_LINES = [
  '화이팅!! 벌써 아파트 3층 높이!!',
  '미쳤다!! 팔뚝이 붕대로 감기기 시작했다!!',
  '미라 진화 돌입!! 절대 멈추지 마!!',
  '손목에 엔진 달았어?! 기세 미쳤다!!',
  '50m 돌파!! 양다리까지 완벽 미라 변신!!',
  '물리법칙 파괴!! 두루마리가 안 줄어든다!!',
  '황금 미라 각성 임박!! 조금만 더!!',
  '화장실의 신이 강림했다!! 가즈아!!',
  '100m 코앞!! 숨 참아!! 돌돌돌돌!!',
  '전설 탄생!! 이제 1km · 100km를 향해!!',
];
const EXTRA_CHEERS = [
  '미라 파워 폭주 중!! 끝까지 돌려라!!',
  '손목이 안 보인다!! 초광속 두루마리!!',
  '지구를 한 바퀴 감을 기세!! 화이팅!!',
  '인류 최강의 휴지 장인!! 절대 끊지 마!!',
  '화장실이 하얀 눈밭이 됐다!! 가즈아!!',
];

function getMummyStage(m) {
  if (m >= 100000) return { label: '🚀 100km 우주 미라', rank: '🚀 100km 우주 미라 신', short: '우주 미라', col: '#ffe24a' };
  if (m >= 1000)   return { label: '⚡ 킬로미터 미라황', rank: '⚡ 킬로미터 미라황', short: '미라황', col: '#ffe24a' };
  if (m >= 70)     return { label: '👑 황금 미라 킹', rank: '👑 황금 미라 킹', short: '황금 미라', col: '#facc15' };
  if (m >= 40)     return { label: '🧻 전설의 두루마리', rank: '🧻 전설의 두루마리', short: '전신 미라', col: '#4ade80' };
  if (m >= 20)     return { label: '🩹 붕대 미라 장인', rank: '🩹 붕대 미라 장인', short: '붕대 미라', col: '#38bdf8' };
  if (m >= 8)      return { label: '🌀 팔뚝 두꺼워짐', rank: '🌀 팔뚝 두꺼워짐', short: '팔뚝 미라', col: '#fb923c' };
  return { label: '🧻 인간 상태', rank: '😅 알뜰 휴지러', short: '인간 상태', col: '#e2e8f0' };
}

// ── 2D 열혈 VFX 상태 ──
let viewW = window.innerWidth;
let viewH = window.innerHeight;

const vfx = {
  sparks: [],
  pops: [],
  trail: [],
  impactFlash: 0,
  cutFlash: 0,
  shakeMag: 0,
  cutInText: '',
  cutInSub: '',
  cutInColor: '#e11d48',
  cutInAlpha: 0,
  cutInSlide: 0,
  stampAnim: 0,
  stampInfo: null,
  introCut: 0,
  knockHits: 0,
  introBubbleProg: 0,
  introSitFired: false,
  introGoFired: false,
};

function spawnSparks(sx, sy, count = 24, palette = ['#ffe24a', '#ffffff', '#38bdf8', '#ff3b5c']) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 140 + Math.random() * 480;
    vfx.sparks.push({
      x: sx, y: sy,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 60,
      size: 3 + Math.random() * 5.5,
      len: 10 + Math.random() * 20,
      col: palette[i % palette.length],
      life: 0.32 + Math.random() * 0.40,
      maxLife: 0.72,
      confetti: false,
      rot: a,
      vrot: (Math.random() - 0.5) * 12,
    });
  }
}

function spawnConfetti(count = 46) {
  const cols = ['#ffe24a', '#ff3b5c', '#4ade80', '#38bdf8', '#f472b6', '#ffffff'];
  for (let i = 0; i < count; i++) {
    vfx.sparks.push({
      x: viewW * (0.12 + Math.random() * 0.76),
      y: viewH * (0.14 + Math.random() * 0.22),
      vx: (Math.random() - 0.5) * 420,
      vy: -200 - Math.random() * 320,
      size: 6 + Math.random() * 7,
      len: 12 + Math.random() * 8,
      col: cols[i % cols.length],
      life: 1.4 + Math.random() * 1.1,
      maxLife: 2.5,
      confetti: true,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 14,
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
    rot: opts.rot != null ? opts.rot : (-0.10 + Math.random() * 0.18),
    life: opts.life || 0.78,
    maxLife: opts.life || 0.78,
    vy: opts.vy != null ? opts.vy : -30,
  });
}

function triggerCutIn(title, sub, color = '#e11d48') {
  vfx.cutInText = title;
  vfx.cutInSub = sub;
  vfx.cutInColor = color;
  vfx.cutInAlpha = 1.0;
  vfx.cutInSlide = 0;
}

// ── 게임 상태 ──
const state = {
  phase: 'start',
  t: 0,
  introAnim: 0,
  hitStopTimer: 0,
  lengthM: 0,
  turns: 0,
  boost: 1.0,
  nextCheerM: 10,
  cheerCount: 0,
  rollAngle: 0,
  handOrbitAngle: 0.4, // 3D 오른손이 왼손 주위를 실제로 빙글빙글 도는 각도!
  orbitCx: 0,
  orbitCy: 0,
  baseOrbitR: 112,
  curOrbitR: 112,
  innerR: 46,
  outerR: 176,
  dragging: false,
  startedWinding: false,
  windDir: 0,
  prevAngle: 0,
  reverseAccum: 0,
  ptrX: 0,
  ptrY: 0,
  angVel: 0,
  dangerRatio: 0,
  tickAccum: 0,
  failReason: '',
  snapTimer: 0,
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
  camera.fov = viewW < viewH ? 58 : 42;
  camera.updateProjectionMatrix();

  state.orbitCx = viewW * 0.5;
  const isRecMode = new URLSearchParams(location.search).has('rec');
  state.orbitCy = viewH * (isRecMode ? 0.475 : 0.56);
  state.baseOrbitR = Math.min(viewW, viewH) * (viewW < viewH ? (isRecMode ? 0.25 : 0.27) : 0.24);
}
resize();
window.addEventListener('resize', resize);

// 1인칭 사람 눈 위치 (변기 물탱크 z=2.92보다 훨씬 앞쪽이라 시야가 100% 트이고 오른쪽 옆벽 두루마리 + 중앙 양손 + 하단 다리가 한눈에!)
const PLAY_CAM_POS = new THREE.Vector3(-0.35, 5.15, 1.95);
const PLAY_CAM_LOOK = new THREE.Vector3(0.55, 2.35, -1.95);

const camPos = new THREE.Vector3(3.6, 7.5, 13.8);
const camLook = new THREE.Vector3(0.4, 6.8, 5.2);
const _tPos = new THREE.Vector3();
const _tLook = new THREE.Vector3();

function resetRound() {
  state.t = 0;
  state.introAnim = 0;
  state.hitStopTimer = 0;
  state.lengthM = 0;
  state.turns = 0;
  state.boost = 1.0;
  state.nextCheerM = 10;
  state.cheerCount = 0;
  state.rollAngle = 0;
  state.handOrbitAngle = 0.25;
  state.dragging = false;
  state.startedWinding = false;
  state.windDir = 0;
  state.reverseAccum = 0;
  state.angVel = 0;
  state.dangerRatio = 0;
  state.tickAccum = 0;
  state.failReason = '';
  state.snapTimer = 0;

  vfx.sparks.length = 0;
  vfx.pops.length = 0;
  vfx.trail.length = 0;
  vfx.impactFlash = 0;
  vfx.cutFlash = 0;
  vfx.shakeMag = 0;
  vfx.cutInAlpha = 0;
  vfx.stampAnim = 0;
  vfx.stampInfo = null;
  vfx.introCut = 0;
  vfx.knockHits = 0;
  vfx.introBubbleProg = 0;
  vfx.introSitFired = false;
  vfx.introGoFired = false;

  doorPivot.visible = true;
  doorPivot.rotation.y = 0;
  knockFistGroup.visible = false;
  bodyGroup.visible = false;
  torsoLower.visible = false;
  legsGroup.position.set(0, 0, 0);
  shoeGroups.forEach(sg => { sg.rotation.x = 0; });
  leftHandGroup.userData.fingersGroup.rotation.x = 0;
  rightHandGroup.userData.fingersGroup.rotation.x = 0;
  holyLight.intensity = 0;
  rollBody.material = [paperMat, rollEndMat, rollEndMat];
  ribbonMesh.visible = false;
  ribbonMesh.material = paperMat;

  wrappedPad.visible = false;
  wrappedPad.scale.set(0.01, 0.01, 0.01);
  wrappedPad.material = [mummyMat, paperMat, paperMat];
  looseTails.forEach(t => { t.visible = false; t.material = mummyMat; });
  leftHandGroup.userData.armMummy.visible = false;
  rightHandGroup.userData.armMummy.visible = false;
  legMummySleeves.forEach(b => { b.mesh.visible = false; b.mesh.material = mummyMat; });
  pileGroupL.visible = false; pileGroupL.scale.setScalar(0.01);
  pileGroupR.visible = false; pileGroupR.scale.setScalar(0.01);
  flyingScraps.forEach(s => { s.mesh.visible = false; });

  BGM.setUrgent(false);
  updateHud();
  guidePill.classList.remove('danger');
  guidePill.textContent = '도넛 궤도 위를 누른 채 한 방향으로 돌돌돌돌 감으세요!!';
  resultModal.classList.add('hidden');
  meterHud.style.opacity = '0';
}

function updateHud() {
  hudLength.textContent = formatLength(state.lengthM);
  const st = getMummyStage(state.lengthM);
  hudMummy.textContent = st.label;
  hudBoost.textContent = state.boost >= 10 ? `⚡ ×${Math.round(state.boost)}` : `×${state.boost.toFixed(1)}`;
}

// ── 4컷 하드컷(Cut-by-Cut) 몽타주 인트로 시작!! ──
function startIntro() {
  unlockAudio();
  BGM.start('toilet');
  BGM.setUrgent(false);
  startModal.classList.add('hidden');
  resetRound();
  state.phase = 'intro';
  vfx.introCut = 1;
  vfx.cutFlash = 0.75;
  // CUT 1: 화장실 닫힌 문 노크 3/4 측면 앵글 즉시 스냅!
  doorPivot.visible = true;
  doorPivot.rotation.y = 0;
  knockFistGroup.visible = true;
  toiletGroup.visible = true;
  bodyGroup.visible = false;
  ribbonMesh.visible = false;
  camPos.set(3.6, 7.5, 13.8);
  camLook.set(0.4, 6.8, 5.2);
  guidePill.textContent = '✊ 똑! 똑! 똑! “계세요?!” (터치 시 바로 시작)';
}

function finishIntroToPlay() {
  state.phase = 'play';
  vfx.introCut = 0;
  vfx.cutFlash = 0.85;
  doorPivot.visible = false;
  knockFistGroup.visible = false;
  toiletGroup.visible = false; // 플레이 시점에서는 변기 물탱크가 시야를 가리지 않도록 숨김!
  bodyGroup.visible = true;
  torsoLower.visible = false;
  legsGroup.position.set(0, 0, 0);
  shoeGroups.forEach(sg => { sg.rotation.x = 0; });
  leftHandGroup.userData.fingersGroup.rotation.x = 0;
  rightHandGroup.userData.fingersGroup.rotation.x = 0;
  ribbonMesh.visible = true;
  holyLight.intensity = 0;
  vfx.introBubbleProg = 0;
  vfx.shakeMag = 0;
  vfx.pops.length = 0;
  meterHud.style.opacity = '1';
  camPos.copy(PLAY_CAM_POS);
  camLook.copy(PLAY_CAM_LOOK);
  TP_SFX.reliefDing();
  guidePill.textContent = '도넛 궤도 위를 누른 채 한 방향으로 돌돌돌돌 감으세요!!';
  triggerCutIn('이제 휴지를 써볼까!!', '중간 심을 피해서 돌돌돌돌!! 100km 도전!!', '#e11d48');
  spawnSparks(state.orbitCx, state.orbitCy, 24, ['#ffe24a', '#ffffff', '#38bdf8']);
}

// ── 10m 돌파 응원 메시지 폭발! ──
function checkCheerMilestone() {
  if (state.lengthM < state.nextCheerM) return;

  const hitM = state.nextCheerM;
  state.cheerCount += 1;

  if (state.nextCheerM < 100) state.nextCheerM += 10;
  else if (state.nextCheerM < 1000) state.nextCheerM += 100;
  else if (state.nextCheerM < 10000) state.nextCheerM += 1000;
  else state.nextCheerM += 10000;

  let msg;
  if (hitM >= 100000) msg = '우주 정복!! 물리법칙을 깨고 100km 달성!!';
  else if (state.cheerCount <= CHEER_LINES.length) msg = CHEER_LINES[state.cheerCount - 1];
  else msg = EXTRA_CHEERS[(state.cheerCount - CHEER_LINES.length) % EXTRA_CHEERS.length];

  const label = hitM >= 1000 ? `${(hitM / 1000).toFixed(hitM % 1000 === 0 ? 0 : 1)}km 돌파!!` : `${hitM}m 돌파!!`;
  TP_SFX.cheerFanfare(state.cheerCount);
  triggerCutIn(label, `🔥 ${msg}`, hitM >= 70 ? '#d97706' : '#e11d48');
  spawnConfetti(hitM >= 100 ? 60 : 34);
  if (hitM >= 30) BGM.setUrgent(true);
}

// ── 휴지 끊어짐 / 도전 종료 ──
function triggerSnap(reasonMain, reasonSub, isCleanStop = false) {
  if (state.phase !== 'play') return;
  state.phase = 'snapped';
  state.dragging = false;
  state.snapTimer = 0;
  state.failReason = reasonSub;
  state.hitStopTimer = 0.14;
  BGM.setUrgent(false);
  vfx.cutInAlpha = 0;
  guidePill.classList.remove('danger');

  if (isCleanStop) SFX.win();
  else TP_SFX.ripSnap();
  vfx.impactFlash = 0.90;
  vfx.shakeMag = isCleanStop ? 0.25 : 0.70;

  spawnPopText(reasonMain, reasonSub, viewW * 0.5, viewH * 0.44, {
    size: viewW < 500 ? 54 : 74,
    color: isCleanStop ? '#4ade80' : '#ff3b5c',
    stroke: '#16111f',
    shadow: '#16111f',
    rot: -0.09,
    life: 0.95,
    vy: -20,
  });
  spawnSparks(state.ptrX || viewW * 0.5, state.ptrY || viewH * 0.55, 38, isCleanStop ? ['#4ade80', '#ffe24a', '#ffffff'] : ['#ff3b5c', '#ffffff', '#ffe24a']);

  ribbonMesh.visible = false;
  for (const sc of flyingScraps) {
    sc.mesh.visible = true;
    sc.mesh.position.set((Math.random() - 0.5) * 2.5, 3.2 + Math.random() * 1.5, -1.0 + (Math.random() - 0.5) * 1.2);
    sc.vx = (Math.random() - 0.5) * 4.5;
    sc.vy = 2.0 + Math.random() * 3.2;
    sc.vz = (Math.random() - 0.5) * 3.5;
    sc.rx = (Math.random() - 0.5) * 8;
    sc.ry = (Math.random() - 0.5) * 8;
    sc.rz = (Math.random() - 0.5) * 8;
  }

  const st = getMummyStage(state.lengthM);
  vfx.stampInfo = {
    main: `${formatLength(state.lengthM)} 달성!!`,
    sub: `${st.rank} · ${reasonSub}`,
    bg: state.lengthM >= 40 ? '#facc15' : state.lengthM >= 10 ? '#22c55e' : '#38bdf8',
    fg: '#16111f',
    border: '#16111f',
  };
  vfx.stampAnim = 0.001;
  if (state.lengthM >= 20) spawnConfetti(55);

  guidePill.textContent = `🧻 ${st.label} 변신 감상 중… (3초 뒤 길이 랭킹)`;
}

async function openResultModal() {
  state.phase = 'result';
  const m = Number(state.lengthM.toFixed(1));
  const st = getMummyStage(m);
  const run = {
    gameId: 'toilet',
    score: m,
    targetValue: 100000,
    actualValue: m,
    errorMm: null,
    rankTitle: st.rank,
    seed: 1,
    meta: { turns: Math.round(state.turns), mummy: st.short, reason: state.failReason },
  };
  state.lastRun = run;
  const isNewBest = updateBestRecord('toilet', run, false);
  refreshBestUi();

  if (m >= 20) SFX.win();
  else SFX.tick();

  document.getElementById('res-rank').textContent = isNewBest ? `${st.rank} · 신기록!` : st.rank;
  document.getElementById('res-headline').textContent = formatLength(m);
  document.getElementById('res-comment').textContent = state.failReason
    ? `${state.failReason} — 총 ${Math.round(state.turns)}바퀴를 안 끊기고 돌렸습니다!`
    : `총 ${Math.round(state.turns)}바퀴를 안 끊기고 돌렸습니다!`;
  document.getElementById('res-len').textContent = formatLength(m);
  document.getElementById('res-turns').textContent = `${Math.round(state.turns)}바퀴`;
  document.getElementById('res-mummy').textContent = st.short;
  document.getElementById('res-mummy').style.color = st.col;

  document.getElementById('res-vs-wrap').style.display = 'none';
  document.getElementById('res-nick').value = getSavedNickname();
  document.getElementById('res-lb-wrap').style.display = 'none';
  resultModal.classList.remove('hidden');

  const saved = await saveResultAndBuildShare({ ...run, nickname: getSavedNickname() || '익명 도전자' }, state.rival);
  renderLb(saved);
}

function renderLb(saved) {
  const lb = document.getElementById('res-lb-wrap');
  if (!saved || !saved.ladder || saved.ladder.length === 0) return;
  lb.style.display = 'block';
  lb.innerHTML = renderGlobalLadderHTML(saved, r => formatLength(Number(r.score || 0)));
}

function refreshBestUi() {
  const best = getBestRecord('toilet');
  const txt = best && best.score != null ? formatLength(Number(best.score)) : '도전 전';
  const sb = document.getElementById('start-best');
  if (sb) sb.textContent = txt;
  const bp = document.getElementById('best-pill');
  if (bp) bp.textContent = best && best.score != null ? `🏆 최고 ${txt}` : '🏆 최고 0.0m';
}

// ── 2D 열혈 오버레이 (3D 양손과 휴지가 투명하게 잘 보이도록 시야 확보 원형 궤도 디자인!) ──
function drawSpeedLines(ctx, cx, cy, intensity, color = 'rgba(225, 29, 72, 0.22)', count = 42, nowSec = 0) {
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
  gr.addColorStop(0.38, 'rgba(255,226,74,0.72)');
  gr.addColorStop(1, 'rgba(255,226,74,0)');
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

function drawSpeechBubble(ctx, mainText, subText, cx, cy, prog, accentCol = '#0ea5e9') {
  if (prog <= 0.01) return;
  const p = Math.min(1, prog);
  const scale = p < 0.25 ? 0.35 + (p / 0.25) * 0.78 : p < 0.42 ? 1.13 - ((p - 0.25) / 0.17) * 0.13 : 1.0;
  const isMob = viewW < 600;
  const bw = isMob ? Math.min(viewW * 0.84, 316) : 390;
  const bh = subText ? (isMob ? 94 : 106) : (isMob ? 66 : 74);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.025);
  ctx.scale(scale, scale);

  // 만화 말풍선 그림자 + 본체 + 꼬리
  ctx.fillStyle = '#16111f';
  ctx.beginPath(); ctx.roundRect(-bw / 2 + 6, -bh / 2 + 6, bw, bh, 22); ctx.fill();
  ctx.fillStyle = '#fffef5';
  ctx.strokeStyle = '#16111f';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 22); ctx.fill(); ctx.stroke();

  // 아래쪽 말풍선 꼬리
  ctx.beginPath();
  ctx.moveTo(-14, bh / 2 - 2);
  ctx.lineTo(14, bh / 2 - 2);
  ctx.lineTo(-2, bh / 2 + 20);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-14, bh / 2);
  ctx.lineTo(-2, bh / 2 + 20);
  ctx.lineTo(14, bh / 2);
  ctx.stroke();

  ctx.fillStyle = '#16111f';
  ctx.font = `italic 900 ${isMob ? 23 : 28}px Pretendard, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(mainText, 0, subText ? -14 : 0);
  if (subText) {
    ctx.fillStyle = accentCol;
    ctx.font = `italic 900 ${isMob ? 17 : 20}px Pretendard, sans-serif`;
    ctx.fillText(subText, 0, 20);
  }
  ctx.restore();
}

function drawSweatDrop(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#38bdf8';
  ctx.strokeStyle = '#16111f';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.45);
  ctx.quadraticCurveTo(r * 1.05, 0, 0, r);
  ctx.quadraticCurveTo(-r * 1.05, 0, 0, -r * 1.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(-r * 0.28, r * 0.1, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 3D 두 손과 휴지가 감기는 장면이 가려지지 않는 반투명·세련된 도넛 궤도!
function drawWindingTrack(ctx, nowSec) {
  const cx = state.orbitCx;
  const cy = state.orbitCy;
  const inR = state.innerR;
  const outR = state.outerR;
  const midR = state.curOrbitR;

  ctx.save();
  const danger = state.dangerRatio;
  const ringCol = danger > 0.72 ? 'rgba(239, 68, 68, 0.20)' : danger > 0.45 ? 'rgba(251, 146, 60, 0.14)' : 'rgba(255, 255, 255, 0.12)';
  const strokeCol = danger > 0.72 ? '#ef4444' : danger > 0.45 ? '#fb923c' : '#22c55e';

  // 안전 도넛 띠 (은은한 반투명으로 뒤쪽 3D 손이 100% 비쳐 보임!)
  ctx.beginPath();
  ctx.arc(cx, cy, outR, 0, Math.PI * 2);
  ctx.arc(cx, cy, inR, 0, Math.PI * 2, true);
  ctx.fillStyle = ringCol;
  ctx.fill();

  // 바깥 찢어짐 한계 점선
  ctx.strokeStyle = danger > 0.65 ? '#ef4444' : 'rgba(22, 17, 31, 0.52)';
  ctx.lineWidth = danger > 0.65 ? 4 : 2.5;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.arc(cx, cy, outR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 이상적인 중심 궤도선 (크기가 계속 호흡하듯 변하는 가이드!)
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, midR, 0, Math.PI * 2);
  ctx.stroke();

  // 회전 방향 화살표 4개
  const dir = state.windDir || 1;
  const arrowBase = nowSec * (1.8 + Math.min(5, Math.abs(state.angVel))) * dir;
  ctx.fillStyle = state.dragging ? '#ffe24a' : '#ffffff';
  ctx.strokeStyle = '#16111f';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = arrowBase + (i * Math.PI) / 2;
    const ax = cx + Math.cos(a) * midR;
    const ay = cy + Math.sin(a) * midR;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2));
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 가운데 위험 코어 = 반투명 휴지심 경계 링! (안쪽에 3D 왼손과 감기는 휴지 뭉치가 투명하게 그대로 보임!!)
  const corePulse = danger > 0.6 ? 1 + Math.sin(nowSec * 22) * 0.06 : 1;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(corePulse, corePulse);

  ctx.fillStyle = danger > 0.65 ? 'rgba(220, 38, 38, 0.34)' : 'rgba(139, 94, 60, 0.22)';
  ctx.strokeStyle = danger > 0.65 ? '#ef4444' : '#8b5e3c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, inR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 작은 하단 위험 태그 (손을 가리지 않게 심 링 아래쪽 테두리에 살짝 배치!)
  const tagW = 64, tagH = 20;
  ctx.fillStyle = danger > 0.65 ? '#dc2626' : '#5c3c24';
  ctx.strokeStyle = '#16111f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(-tagW / 2, inR - 11, tagW, tagH, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fffef0';
  ctx.font = 'italic 900 10.5px Pretendard, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('심 금지!', 0, inR - 1);
  ctx.restore();

  // 손끝 잔상 궤적 (하얀/황금 두루마리 띠!)
  if (vfx.trail.length > 1) {
    ctx.lineCap = 'round';
    for (let i = 1; i < vfx.trail.length; i++) {
      const a = i / vfx.trail.length;
      ctx.strokeStyle = state.lengthM >= 70
        ? `rgba(255, 226, 74, ${a * 0.85})`
        : `rgba(255, 255, 255, ${a * 0.85})`;
      ctx.lineWidth = 5 + a * 10;
      ctx.beginPath();
      ctx.moveTo(vfx.trail[i - 1].x, vfx.trail[i - 1].y);
      ctx.lineTo(vfx.trail[i].x, vfx.trail[i].y);
      ctx.stroke();
    }
  }

  if (state.dragging) {
    ctx.fillStyle = '#ffe24a';
    ctx.strokeStyle = '#16111f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.ptrX, state.ptrY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawOverlay(nowSec) {
  ovCtx.clearRect(0, 0, viewW, viewH);

  if (state.phase === 'intro') {
    const cut = vfx.introCut;
    if (cut === 1) {
      // CUT 1: 문 노크 — 상단 말풍선 "계세요?!" (문 명패 위쪽에 깔끔히 배치!)
      const prog = Math.min(1, state.introAnim / 0.22);
      drawSpeechBubble(ovCtx, '“계세요?!”', '🚪 긴급 화장실 확인 중…', viewW * 0.5, viewH * 0.165, prog, '#e11d48');
    } else if (cut === 2) {
      // CUT 2: 문 열리니 옆벽에 휴지가 있다!! — 황금 후광 + 십자 섬광 + 집중선!
      const rp = HOLDER_POS.clone().project(camera);
      const sx = (rp.x + 1) * 0.5 * viewW;
      const sy = (1 - rp.y) * 0.5 * viewH;
      drawSpeedLines(ovCtx, sx, sy, 0.72, 'rgba(250, 204, 21, 0.28)', 44, nowSec);
      drawLensStar(ovCtx, sx, sy, 68 + Math.sin(nowSec * 22) * 14, 0.98, nowSec * 2.5);
      drawMangaText(ovCtx, '휴지가 있다!!', viewW * 0.5, viewH * 0.22, viewW < 500 ? 48 : 66, '#ffe24a', '#16111f', '#d97706', -0.06);
      drawMangaText(ovCtx, '✨ 옆벽에 기적의 두루마리 발견!! ✨', viewW * 0.5, viewH * 0.22 + (viewW < 500 ? 46 : 58), viewW < 500 ? 18 : 24, '#ffffff', '#16111f', '#e11d48', -0.04);
    } else if (cut === 3) {
      // CUT 3: 자리에 털썩 앉는 모습 — 안도의 말풍선 "휴~ 다행이다…"
      const prog = Math.min(1, (state.introAnim - 1.65) / 0.25);
      drawSpeechBubble(ovCtx, '“휴~ 다행이다…”', '😮‍💨 천국에 착석 완료', viewW * 0.5, viewH * 0.22, prog, '#0284c7');
    } else if (cut === 4) {
      // CUT 4: 힘주는 모습!! — 강렬한 붉은 집중선 + 만화 땀방울 4개 + 부들부들 초대형 "으으으으—!!"
      const cutT = Math.max(0, state.introAnim - 2.45);
      const vibX = Math.sin(nowSec * 92) * 5;
      const vibY = Math.cos(nowSec * 78) * 4;
      drawSpeedLines(ovCtx, viewW * 0.5, viewH * 0.54, 0.92, 'rgba(225, 29, 72, 0.34)', 56, nowSec);

      // 퐉퐉 튀는 만화 땀방울 4개!
      const dropSpecs = [
        { ox: -0.26, oy: -0.10, rot: -0.65, ph: 0.0 },
        { ox:  0.27, oy: -0.08, rot:  0.65, ph: 0.25 },
        { ox: -0.32, oy:  0.04, rot: -0.95, ph: 0.50 },
        { ox:  0.33, oy:  0.05, rot:  0.95, ph: 0.75 },
      ];
      dropSpecs.forEach(d => {
        const cyc = (cutT * 2.2 + d.ph) % 1;
        const dx = viewW * (0.5 + d.ox * (0.75 + cyc * 0.45));
        const dy = viewH * (0.50 + d.oy) - cyc * 42 + cyc * cyc * 58;
        drawSweatDrop(ovCtx, dx, dy, (viewW < 500 ? 11 : 14) * (1 - cyc * 0.25), d.rot);
      });

      drawMangaText(ovCtx, '으으으으—!!', viewW * 0.5 + vibX, viewH * 0.22 + vibY, viewW < 500 ? 52 : 72, '#ff3b5c', '#16111f', '#ffe24a', -0.05);
      drawMangaText(ovCtx, '💢 전신 초집중!! 💢', viewW * 0.5 - vibX * 0.5, viewH * 0.22 + (viewW < 500 ? 48 : 62), viewW < 500 ? 20 : 26, '#ffe24a', '#16111f', '#e11d48', -0.03);
    }
  }

  if (state.phase === 'play') {
    const spdRatio = Math.min(1, Math.abs(state.angVel) / 10);
    if (spdRatio > 0.22) {
      const col = state.lengthM >= 70 ? 'rgba(250, 204, 21, 0.24)' : 'rgba(56, 189, 248, 0.15)';
      drawSpeedLines(ovCtx, state.orbitCx, state.orbitCy, spdRatio * 0.52, col, 36, nowSec);
    }
    if (state.dangerRatio > 0.68) {
      drawSpeedLines(ovCtx, state.orbitCx, state.orbitCy, (state.dangerRatio - 0.68) * 2.2, 'rgba(225, 29, 72, 0.34)', 48, nowSec);
    }
    drawWindingTrack(ovCtx, nowSec);
  }

  // 컷바이컷(Cut-by-Cut) 하드컷 전환 순간 플래시!
  if (vfx.cutFlash > 0.01) {
    ovCtx.save();
    ovCtx.fillStyle = `rgba(255, 253, 240, ${Math.min(0.85, vfx.cutFlash * 0.9)})`;
    ovCtx.fillRect(0, 0, viewW, viewH);
    ovCtx.restore();
  }

  if (vfx.impactFlash > 0.01) {
    ovCtx.save();
    ovCtx.fillStyle = vfx.impactFlash > 0.55
      ? `rgba(22, 17, 31, ${(vfx.impactFlash - 0.55) * 1.4})`
      : `rgba(255, 250, 230, ${vfx.impactFlash * 0.65})`;
    ovCtx.fillRect(0, 0, viewW, viewH);
    ovCtx.restore();
  }

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

  if (vfx.cutInAlpha > 0.01) {
    const a = Math.min(1, vfx.cutInAlpha * 1.6);
    const slide = vfx.cutInSlide;
    const offsetX = slide < 0.20 ? (1 - slide / 0.20) * -viewW * 0.65 : slide > 0.80 ? ((slide - 0.80) / 0.20) * viewW * 0.65 : 0;
    const bandY = viewH * 0.27;
    const bandH = viewW < 500 ? 78 : 96;

    ovCtx.save();
    ovCtx.globalAlpha = a;
    ovCtx.translate(viewW * 0.5 + offsetX, bandY);
    ovCtx.rotate(-0.065);
    ovCtx.fillStyle = '#16111f';
    ovCtx.fillRect(-viewW, -bandH * 0.5 - 7, viewW * 2, bandH + 14);
    ovCtx.fillStyle = vfx.cutInColor;
    ovCtx.fillRect(-viewW, -bandH * 0.5, viewW * 2, bandH);
    ovCtx.fillStyle = '#ffe24a';
    ovCtx.fillRect(-viewW, -bandH * 0.5, viewW * 2, 5);
    ovCtx.fillRect(-viewW, bandH * 0.5 - 5, viewW * 2, 5);
    drawMangaText(ovCtx, vfx.cutInText, 0, -10, viewW < 500 ? 32 : 44, '#ffe24a', '#16111f', '#000000', 0);
    ovCtx.fillStyle = '#ffffff';
    ovCtx.font = `italic 900 ${viewW < 500 ? 13 : 16}px Pretendard, sans-serif`;
    ovCtx.textAlign = 'center'; ovCtx.textBaseline = 'middle';
    ovCtx.fillText(vfx.cutInSub, 0, bandH * 0.28);
    ovCtx.restore();
  }

  if (state.phase === 'snapped' && vfx.stampInfo && vfx.stampAnim > 0) {
    const sp = Math.min(1, vfx.stampAnim);
    const scale = sp < 0.35 ? 2.3 - (sp / 0.35) * 1.38 : 0.92 + Math.sin((sp - 0.35) * 9) * 0.08 * (1 - sp);
    const st = vfx.stampInfo;
    ovCtx.save();
    ovCtx.translate(viewW * 0.5, viewH * 0.28);
    ovCtx.rotate(-0.08);
    ovCtx.scale(scale, scale);

    const bw = viewW < 600 ? 270 : 340;
    const bh = viewW < 600 ? 86 : 104;
    ovCtx.fillStyle = '#16111f';
    ovCtx.beginPath(); ovCtx.roundRect(-bw / 2 + 7, -bh / 2 + 7, bw, bh, 14); ovCtx.fill();
    ovCtx.fillStyle = st.bg;
    ovCtx.strokeStyle = st.border;
    ovCtx.lineWidth = 5;
    ovCtx.beginPath(); ovCtx.roundRect(-bw / 2, -bh / 2, bw, bh, 14); ovCtx.fill(); ovCtx.stroke();
    ovCtx.fillStyle = st.fg;
    ovCtx.font = `italic 900 ${viewW < 600 ? 30 : 38}px Pretendard, sans-serif`;
    ovCtx.textAlign = 'center'; ovCtx.textBaseline = 'middle';
    ovCtx.fillText(st.main, 0, -10);
    ovCtx.font = `800 ${viewW < 600 ? 12 : 14}px Pretendard, sans-serif`;
    ovCtx.fillText(st.sub, 0, bh * 0.28);
    ovCtx.restore();
  }

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
gl.addEventListener('pointerdown', e => {
  if (state.phase === 'intro') {
    finishIntroToPlay();
    return;
  }
  if (state.phase !== 'play') return;
  unlockAudio();

  const dx = e.clientX - state.orbitCx;
  const dy = e.clientY - state.orbitCy;
  const dist = Math.hypot(dx, dy);

  if (dist < state.innerR) {
    guidePill.classList.add('danger');
    guidePill.textContent = '⚠ 중간 심 바깥쪽 도넛 궤도를 잡아 돌려주세요!';
    return;
  }

  state.dragging = true;
  state.ptrX = e.clientX;
  state.ptrY = e.clientY;
  state.prevAngle = Math.atan2(dy, dx);
  state.handOrbitAngle = state.prevAngle;
  state.reverseAccum = 0;
  vfx.trail = [{ x: e.clientX, y: e.clientY }];
  gl.setPointerCapture(e.pointerId);
});

gl.addEventListener('pointermove', e => {
  if (state.phase !== 'play' || !state.dragging) return;
  state.ptrX = e.clientX;
  state.ptrY = e.clientY;

  const dx = e.clientX - state.orbitCx;
  const dy = e.clientY - state.orbitCy;
  const dist = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);

  let da = ang - state.prevAngle;
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  state.prevAngle = ang;
  state.handOrbitAngle = ang; // 3D 오른손이 내 마우스/손가락 각도를 실시간으로 따라 왼손 주위를 돌돌 감음!!

  vfx.trail.push({ x: e.clientX, y: e.clientY });
  if (vfx.trail.length > 26) vfx.trail.shift();

  if (dist < state.innerR) {
    triggerSnap('뚝!!', '💥 중간 심에 걸려 휴지가 끊어졌다!!');
    return;
  }
  if (dist > state.outerR) {
    triggerSnap('찌익!!', '💥 너무 크게 벗어나 휴지가 찢어졌다!!');
    return;
  }

  const halfBand = Math.max(12, (state.outerR - state.innerR) * 0.5);
  const off = Math.abs(dist - state.curOrbitR);
  state.dangerRatio = Math.min(1, off / halfBand);
  if (state.dangerRatio > 0.72) {
    guidePill.classList.add('danger');
    guidePill.textContent = dist < state.curOrbitR ? '⚠ 위험!! 중간 심에 닿는다!! 바깥으로!' : '⚠ 위험!! 휴지가 찢어진다!! 안쪽으로!';
  } else {
    guidePill.classList.remove('danger');
    guidePill.textContent = state.windDir > 0 ? '🌀 시계 방향으로 돌돌돌돌!! 멈추지 마세요!' : state.windDir < 0 ? '🌀 반시계 방향으로 돌돌돌돌!! 멈추지 마세요!' : '도넛 궤도 위를 한 방향으로 돌돌돌돌 감으세요!!';
  }

  if (Math.abs(da) > 0.008) {
    if (state.windDir === 0) {
      state.windDir = da > 0 ? 1 : -1;
      state.startedWinding = true;
    }
    const signedDa = da * state.windDir;
    if (signedDa > 0) {
      state.reverseAccum = Math.max(0, state.reverseAccum - signedDa * 1.5);
      const turnDelta = signedDa / (Math.PI * 2);
      state.turns += turnDelta;
      state.rollAngle += signedDa * 2.4;
      state.angVel = Math.min(28, state.angVel * 0.75 + (signedDa / 0.016) * 0.25);

      const speedFactor = 0.85 + Math.min(1.6, state.angVel * 0.10);
      const scaleBoost = 1 + Math.pow(Math.max(0, state.turns / 10), 2.15) * 1.4;
      state.boost = Math.min(2500, scaleBoost * speedFactor);
      state.lengthM = Math.min(100000, state.lengthM + turnDelta * 1.0 * state.boost);

      state.tickAccum += signedDa;
      if (state.tickAccum >= 0.75) {
        state.tickAccum = 0;
        TP_SFX.rollTick(Math.min(10, state.angVel * 0.4));
      }

      updateHud();
      checkCheerMilestone();

      if (state.lengthM >= 100000) {
        triggerSnap('100km!!', '🚀 물리법칙 초월!! 인류 최강의 우주 미라!!', true);
      }
    } else {
      state.reverseAccum += -signedDa;
      if (state.reverseAccum > 0.62) {
        triggerSnap('어억!! 뚝!!', '💥 거꾸로 돌려서 휴지가 끊어졌다!!');
      }
    }
  }
});

const onPointerUp = () => {
  if (state.phase === 'play' && state.dragging) {
    state.dragging = false;
    if (state.startedWinding && state.lengthM >= 0.5) {
      triggerSnap('촥!! 컷!!', '🧻 손을 떼서 깔끔하게 마무리!', true);
    }
  }
};
gl.addEventListener('pointerup', onPointerUp);
gl.addEventListener('pointercancel', onPointerUp);

window.addEventListener('keydown', e => {
  if (state.phase === 'intro' && (e.key === ' ' || e.key === 'Enter')) {
    finishIntroToPlay();
    e.preventDefault();
  }
});

document.getElementById('btn-start').onclick = startIntro;
document.getElementById('btn-retry').onclick = startIntro;

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
    if (!muted) BGM.start('toilet');
    syncBgmBtn();
  };
}

document.getElementById('btn-share').onclick = async () => {
  if (!state.lastRun) return;
  const nick = saveNickname(document.getElementById('res-nick').value || getSavedNickname() || '익명 도전자');
  const data = await saveResultAndBuildShare({ ...state.lastRun, nickname: nick }, state.rival);
  renderLb(data);
  const lenStr = formatLength(state.lastRun.score);
  const rankStr = data.myRank ? `전체 ${data.myRank}위 · ` : '';
  await shareChallengeLink({
    title: `🧻 ${nick}님의 [무한 두루마리] 기록: ${lenStr}!`,
    text: `🧻 [무한 두루마리] ${rankStr}안 끊기고 ${lenStr} 감아서 ${state.lastRun.rankTitle} 등극!!\n전체 랭킹에서 내 위치 보고 100km 기록 깨봐 👇`,
    url: data.shareUrl,
  });
};

document.getElementById('btn-save-img').onclick = () => {
  if (!state.lastRun) return;
  const r = state.lastRun;
  downloadResultCard({
    gameTitle: '무한 두루마리',
    emoji: '🧻',
    rankTitle: r.rankTitle,
    headline: formatLength(r.score),
    subline: `${r.meta.turns}바퀴 안 끊기고 감기 · ${r.meta.mummy}`,
    stats: [
      { label: '최종 길이', value: formatLength(r.score), color: '#ffd84a' },
      { label: '회전 수', value: `${r.meta.turns}바퀴` },
      { label: '미라 등급', value: r.meta.mummy, color: '#4ade80' },
    ],
    extraCanvas: gl,
  });
};

// ── 3D 곡선 휴지 리본 실시간 업데이트 (두루마리 롤 아래 → 감는 오른손 끝까지 부드러운 S자 커브!) ──
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _p3 = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _side = new THREE.Vector3();
const _camDir = new THREE.Vector3();

function updateCurvedRibbon(nowSec) {
  if (!ribbonMesh.visible) return;

  // 시작점: 오른쪽 옆벽 두루마리 롤 안쪽(-x) 아래 접선!
  _p0.set(HOLDER_POS.x - 0.88, HOLDER_POS.y - 0.52, HOLDER_POS.z);

  const isCut2Idle = state.phase === 'intro' && vfx.introCut === 2;
  if (isCut2Idle) {
    // CUT 2 클로즈업: 옆벽 두루마리 아래로 한 가닥이 자연스럽게 늘어져 살랑거림!
    const sway = Math.sin(nowSec * 4.5) * 0.12;
    _p1.set(_p0.x - 0.08, _p0.y - 0.65, _p0.z + sway * 0.4);
    _p2.set(_p0.x - 0.14 + sway * 0.5, _p0.y - 1.35, _p0.z + sway);
    _p3.set(_p0.x - 0.08 + sway, _p0.y - 1.95, _p0.z + sway * 1.2);
  } else {
    // 플레이 중: 오른쪽 옆벽 두루마리 → 중앙 감는 오른손 끝까지 부드러운 S자 곡선!
    _p3.set(rightHandGroup.position.x + 0.05, rightHandGroup.position.y + 0.05, rightHandGroup.position.z - 0.42);
    const flutter = Math.sin(nowSec * 14 + state.rollAngle) * Math.min(0.18, 0.04 + Math.abs(state.angVel) * 0.015);
    _p1.set(HOLDER_POS.x - 1.45, HOLDER_POS.y - 1.05, HOLDER_POS.z + 0.45);
    _p2.set((_p3.x + HOLDER_POS.x - 1.2) * 0.5 + flutter, (_p3.y + 2.65) * 0.5, (_p3.z + HOLDER_POS.z) * 0.5 + 0.25);
  }

  const posAttr = ribbonGeo.attributes.position;
  const halfW = isCut2Idle ? 0.44 : 0.24;
  for (let i = 0; i <= RIBBON_SEGS; i++) {
    const u = i / RIBBON_SEGS;
    const inv = 1 - u;
    _pt.set(
      inv*inv*inv*_p0.x + 3*inv*inv*u*_p1.x + 3*inv*u*u*_p2.x + u*u*u*_p3.x,
      inv*inv*inv*_p0.y + 3*inv*inv*u*_p1.y + 3*inv*u*u*_p2.y + u*u*u*_p3.y,
      inv*inv*inv*_p0.z + 3*inv*inv*u*_p1.z + 3*inv*u*u*_p2.z + u*u*u*_p3.z
    );
    _tan.set(
      3*inv*inv*(_p1.x-_p0.x) + 6*inv*u*(_p2.x-_p1.x) + 3*u*u*(_p3.x-_p2.x),
      3*inv*inv*(_p1.y-_p0.y) + 6*inv*u*(_p2.y-_p1.y) + 3*u*u*(_p3.y-_p2.y),
      3*inv*inv*(_p1.z-_p0.z) + 6*inv*u*(_p2.z-_p1.z) + 3*u*u*(_p3.z-_p2.z)
    ).normalize();

    _camDir.subVectors(camera.position, _pt).normalize();
    _side.crossVectors(_tan, _camDir).normalize().multiplyScalar(halfW);

    posAttr.setXYZ(i * 2, _pt.x - _side.x, _pt.y - _side.y, _pt.z - _side.z);
    posAttr.setXYZ(i * 2 + 1, _pt.x + _side.x, _pt.y + _side.y, _pt.z + _side.z);
  }
  posAttr.needsUpdate = true;
  ribbonGeo.computeVertexNormals();

  paperTex.offset.y = -(state.rollAngle * 0.28) % 1;
}

// ── 3D 미라 변신 업데이트 ──
function updateMummyVisuals(nowSec) {
  const m = state.lengthM;
  const isGold = m >= 70;
  const pMat = isGold ? goldPaperMat : paperMat;
  const mMat = isGold ? goldMummyMat : mummyMat;

  // 1) 왼손 주위에 감긴 3D 휴지 패드가 1바퀴마다 점점 두꺼워짐!
  if (m > 0.25) {
    wrappedPad.visible = true;
    wrappedPad.material = [mMat, pMat, pMat];
    const thick = Math.min(2.35, 0.45 + Math.log10(1 + m * 1.6) * 0.92);
    wrappedPad.scale.set(thick * 1.15, 0.92 + thick * 0.18, thick * 0.72);
    wrappedPad.rotation.x = state.rollAngle * 0.25;
  }

  // 2) 팔뚝 미라 붕대 슬리브 (왼팔 8m+, 오른팔 14m+)
  leftHandGroup.userData.armMummy.visible = m >= 8;
  leftHandGroup.userData.armMummy.material = mMat;
  rightHandGroup.userData.armMummy.visible = m >= 14;
  rightHandGroup.userData.armMummy.material = mMat;

  // 3) 나부끼는 붕대 꼬리 리본 (15m+)
  looseTails.forEach((tail, idx) => {
    tail.visible = m >= 15;
    tail.material = mMat;
    tail.rotation.z = (idx === 0 ? -0.35 : 0.35) + Math.sin(nowSec * 6.5 + idx * 2) * 0.28;
    tail.rotation.x = Math.cos(nowSec * 5.2 + idx) * 0.22;
  });

  // 4) 양다리 진짜 미라 슬리브 & 무릎 교차 붕대 (18m ~ 40m 순차 변신!)
  for (const b of legMummySleeves) {
    b.mesh.visible = m >= b.thresholdM;
    b.mesh.material = mMat;
  }

  // 5) 바닥 양옆 휴지 리본 더미 산 (35m+)
  if (m >= 35) {
    pileGroupL.visible = true; pileGroupR.visible = true;
    const ps = Math.min(1.65, 0.45 + ((m - 35) / 70) * 1.15);
    pileGroupL.scale.setScalar(ps);
    pileGroupR.scale.setScalar(ps * 1.08);
    pileGroupL.children.forEach(c => { c.material = mMat; });
    pileGroupR.children.forEach(c => { c.material = mMat; });
  }

  // 6) 황금 미라 킹 각성!
  rollBody.material = [pMat, rollEndMat, rollEndMat];
  ribbonMesh.material = pMat;
  if (isGold) holyLight.intensity = 1.6 + Math.sin(nowSec * 6) * 0.4;
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── 메인 루프 ──
let prevT = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = Math.min(0.05, (now - prevT) / 1000);
  prevT = now;
  const nowSec = now / 1000;

  vfx.impactFlash = Math.max(0, vfx.impactFlash - rawDt * 4.5);
  vfx.cutFlash = Math.max(0, vfx.cutFlash - rawDt * 12.0);
  vfx.shakeMag = Math.max(0, vfx.shakeMag - rawDt * 2.6);
  if (vfx.cutInAlpha > 0) {
    vfx.cutInSlide += rawDt * 0.92;
    if (vfx.cutInSlide >= 1.0) vfx.cutInAlpha = 0;
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

  let dt = rawDt;
  if (state.hitStopTimer > 0) {
    state.hitStopTimer = Math.max(0, state.hitStopTimer - rawDt);
    dt = rawDt * 0.06;
  }
  state.t += dt;

  if (state.phase === 'start') {
    doorPivot.visible = true;
    doorPivot.rotation.y = 0;
    knockFistGroup.visible = false;
    toiletGroup.visible = true;
    bodyGroup.visible = false;
    ribbonMesh.visible = false;
    camPos.set(3.6, 7.5, 13.8);
    camLook.set(0.4, 6.8, 5.2);
  } else if (state.phase === 'intro') {
    state.introAnim += rawDt;
    const p = state.introAnim;

    // ── CUT 1 (0.00 ~ 0.85초): 닫힌 화장실 문 노크 3연타! ("똑! 똑! 똑!" + "계세요?!") ──
    if (p < 0.85) {
      if (vfx.introCut !== 1) vfx.introCut = 1;
      doorPivot.visible = true;
      knockFistGroup.visible = true;
      bodyGroup.visible = false;
      ribbonMesh.visible = false;

      // 3연타 노크 타이밍: 0.10s, 0.34s, 0.58s
      const knockTimes = [0.10, 0.34, 0.58];
      let knockPush = 0;
      for (let i = 0; i < knockTimes.length; i++) {
        const dtK = p - knockTimes[i];
        if (dtK >= 0 && vfx.knockHits <= i) {
          vfx.knockHits = i + 1;
          TP_SFX.knock();
          vfx.shakeMag = 0.22;
          spawnPopText('똑!', '', viewW * (0.36 + i * 0.13), viewH * (0.50 - i * 0.05), {
            size: viewW < 500 ? 44 : 58,
            color: '#ffe24a',
            stroke: '#16111f',
            shadow: '#e11d48',
            rot: (i - 1) * 0.12,
            life: 0.34,
            vy: -28,
          });
        }
        if (dtK >= -0.08 && dtK < 0.12) {
          knockPush = Math.max(knockPush, Math.max(0, 1 - Math.abs(dtK) / 0.09));
        }
      }
      // 3/4 측면 구도에서 둥근 주먹이 오른쪽 아래에서 뻗어 문짝(z=5.65)을 딱! 딱! 딱! 타격!
      knockFistGroup.position.set(0.75, 6.15, 6.75 - knockPush * 1.02);
      knockFistGroup.rotation.set(-0.26 + knockPush * 0.28, -0.45, 0.18);
      doorPivot.rotation.y = -knockPush * 0.015;
      camPos.set(3.6, 7.5, 13.8 - p * 0.35);
      camLook.set(0.4, 6.8, 5.2);

    // ── CUT 2 (0.85 ~ 1.65초): 하드컷!! 문 열리니 오른쪽 옆벽에 휴지가 있다!! ──
    } else if (p < 1.65) {
      if (vfx.introCut !== 2) {
        vfx.introCut = 2;
        vfx.cutFlash = 0.90;
        vfx.pops.length = 0;
        doorPivot.visible = true;
        doorPivot.rotation.y = -2.05; // 문 활짝 열림!
        knockFistGroup.visible = false;
        toiletGroup.visible = true;
        bodyGroup.visible = false;
        ribbonMesh.visible = true;
        holyLight.intensity = 3.6;
        TP_SFX.doorSlam();
        TP_SFX.holyGlint();
        vfx.shakeMag = 0.24;
        guidePill.textContent = '✨ 문 열리니 옆벽에 휴지가 있다!! (터치 시 바로 시작)';
      }
      const cutT = p - 0.85;
      const punch = Math.min(1, cutT / 0.65);
      // 오른쪽 옆벽 두루마리 롤을 대각선 초근접 클로즈업으로 즉시 스냅 + 미세 펀치 줌인!
      camPos.set(-1.05 + punch * 0.68, 4.15 - punch * 0.15, 0.85 - punch * 0.45);
      camLook.copy(HOLDER_POS);

    // ── CUT 3 (1.65 ~ 2.45초): 하드컷!! 자리에 털썩 앉는 모습 ("휴~ 다행이다…") ──
    } else if (p < 2.45) {
      if (vfx.introCut !== 3) {
        vfx.introCut = 3;
        vfx.cutFlash = 0.90;
        vfx.pops.length = 0;
        doorPivot.visible = false;
        knockFistGroup.visible = false;
        toiletGroup.visible = true;
        bodyGroup.visible = true;
        torsoLower.visible = true;
        ribbonMesh.visible = false;
        holyLight.intensity = 0;
        TP_SFX.sitThud();
        TP_SFX.sigh();
        vfx.shakeMag = 0.16;
        guidePill.textContent = '😮‍💨 자리에 털썩… “휴~ 다행이다…” (터치 시 바로 시작)';
      }
      const cutT = p - 1.65;
      const u = Math.min(1, cutT / 0.28);
      const sitY = u < 1
        ? (1 - u * u) * 1.05
        : Math.sin((cutT - 0.28) * 18) * Math.exp(-(cutT - 0.28) * 8) * 0.10;
      legsGroup.position.set(0, Math.max(-0.04, sitY), 0);
      shoeGroups.forEach(sg => { sg.rotation.x = 0; });

      // 양손이 무릎 위에 자연스럽게 얹힘 (팔 소매가 몸통 옆으로 안 삐져나오게 어깨 쪽으로 자연스럽게 수렴!)
      leftHandGroup.position.set(-1.38, 2.48 + Math.max(0, sitY), 0.05);
      leftHandGroup.rotation.set(0.30, 0.22, -0.08);
      leftHandGroup.userData.fingersGroup.rotation.x = -0.62;

      rightHandGroup.position.set(1.38, 2.48 + Math.max(0, sitY), 0.05);
      rightHandGroup.rotation.set(0.30, -0.22, 0.08);
      rightHandGroup.userData.fingersGroup.rotation.x = -0.62;

      // 변기 앞 왼쪽 대각선 로우 풀샷 (변기+물탱크+착석 하체+컨버스 스니커즈+무릎 위 두 손!)
      const isMobCut3 = viewW < viewH;
      camPos.set(isMobCut3 ? -3.8 : -3.9, 3.55, isMobCut3 ? -5.8 : -5.2);
      camLook.set(0.25, 1.90, 0.7);

    // ── CUT 4 (2.45 ~ 3.30초): 하드컷!! 힘주는 모습 ("으으으으—!!") ──
    } else if (p < 3.30) {
      if (vfx.introCut !== 4) {
        vfx.introCut = 4;
        vfx.cutFlash = 0.92;
        vfx.pops.length = 0;
        doorPivot.visible = false;
        toiletGroup.visible = true;
        bodyGroup.visible = true;
        torsoLower.visible = true;
        ribbonMesh.visible = false;
        TP_SFX.strain();
        guidePill.textContent = '💢 으으으으—!! 전신 초집중!! (터치 시 바로 시작)';
      }
      const cutT = p - 2.45;
      const strainPow = Math.min(1, 0.45 + cutT * 1.1);
      const jitterX = Math.sin(nowSec * 96) * 0.075 * strainPow;
      const jitterY = Math.cos(nowSec * 84) * 0.055 * strainPow;

      // 하체 힘주며 부들부들 + 빨간 컨버스 스니커즈 뒤꿈치 들림(까치발!)
      legsGroup.position.set(jitterX * 0.5, -0.03 + jitterY * 0.4, 0);
      shoeGroups.forEach((sg, idx) => {
        sg.rotation.x = -0.28 * strainPow + Math.sin(nowSec * 72 + idx) * 0.04;
      });

      // 무릎 위 두 주먹 꽉 쥐고 고속 진동!!
      leftHandGroup.position.set(-1.34 + jitterX, 2.44 + jitterY, 0.02);
      leftHandGroup.rotation.set(0.38, 0.20, -0.10);
      leftHandGroup.userData.fingersGroup.rotation.x = -1.35;

      rightHandGroup.position.set(1.34 - jitterX, 2.44 - jitterY, 0.02);
      rightHandGroup.rotation.set(0.38, -0.20, 0.10);
      rightHandGroup.userData.fingersGroup.rotation.x = -1.35;

      // 앞쪽 정면 줌인 리버스 샷 (모바일 세로에서도 양 주먹+컨버스 까치발이 100% 들어오게 거리 자동 보정!)
      const isMobCut4 = viewW < viewH;
      camPos.set(0.0, isMobCut4 ? 2.95 : 2.85, (isMobCut4 ? -5.55 : -4.35) + cutT * 0.35);
      camLook.set(0.0, 1.78, 0.35);
      vfx.shakeMag = Math.max(vfx.shakeMag, 0.20 * strainPow);
    } else {
      finishIntroToPlay();
    }
  } else if (state.phase === 'play') {
    state.angVel *= Math.max(0, 1 - dt * 5.0);

    // 원형 크기가 호흡하듯 계속 조금씩 바뀜!
    const diffLevel = Math.min(1, state.lengthM / 120);
    const waveSpd = 1.45 + diffLevel * 1.15;
    const waveAmp = state.baseOrbitR * (0.20 + diffLevel * 0.08);
    state.curOrbitR = state.baseOrbitR + Math.sin(state.t * waveSpd) * waveAmp + Math.sin(state.t * waveSpd * 1.73) * (waveAmp * 0.28);

    const bandHalf = Math.max(38, state.baseOrbitR * (0.50 - diffLevel * 0.14));
    state.innerR = Math.max(28, state.curOrbitR - bandHalf);
    state.outerR = state.curOrbitR + bandHalf;

    // 3D 두루마리 롤 고속 회전! (오른쪽 옆벽 축 기준 회전)
    rollGroup.rotation.x = state.rollAngle;

    // 3D 왼손(감기는 중심 축)은 화면 중앙에 안정적으로 자리 잡고, 감는 리듬에 맞춰 살짝 까딱임
    const leftBob = Math.sin(state.rollAngle * 0.5) * 0.06;
    leftHandGroup.position.set(-0.05, 2.38 + leftBob, -1.45);
    leftHandGroup.rotation.set(0.20, -0.42, -0.08 + Math.cos(state.rollAngle * 0.5) * 0.05);
    leftHandGroup.userData.fingersGroup.rotation.x = 0;

    // 3D 오른손은 실제로 마우스/손가락 각도(handOrbitAngle)를 따라 왼손 주위를 빙글빙글 돌며 휴지를 감음!!
    const orbit3DR = 0.88 + Math.min(0.42, Math.log10(1 + state.lengthM) * 0.18);
    const ox = Math.cos(state.handOrbitAngle) * orbit3DR;
    const oy = -Math.sin(state.handOrbitAngle) * orbit3DR * 0.82;
    const oz = Math.sin(state.handOrbitAngle) * 0.42;
    rightHandGroup.position.set(-0.05 + ox, 2.38 + oy, -1.45 + oz);
    rightHandGroup.rotation.set(0.22 + oy * 0.14, 0.48 - ox * 0.16, -state.handOrbitAngle * 0.12);
    rightHandGroup.userData.fingersGroup.rotation.x = -0.32;

    updateMummyVisuals(nowSec);

    camPos.lerp(PLAY_CAM_POS, Math.min(1, dt * 6));
    camLook.lerp(PLAY_CAM_LOOK, Math.min(1, dt * 6));
  } else if (state.phase === 'snapped' || state.phase === 'result') {
    state.snapTimer += rawDt;
    if (vfx.stampAnim > 0) vfx.stampAnim = Math.min(1, vfx.stampAnim + rawDt * 2.8);

    // 3초 동안 내가 변신한 3D 미라 양팔·양다리 & 휴지 산을 풀샷으로 멋지게 조망!
    toiletGroup.visible = true;
    torsoLower.visible = true;
    leftHandGroup.position.lerp(new THREE.Vector3(-1.35, 2.55, -0.10), Math.min(1, rawDt * 5));
    leftHandGroup.rotation.set(0.24, 0.22, -0.08);
    rightHandGroup.position.lerp(new THREE.Vector3(1.35, 2.55, -0.10), Math.min(1, rawDt * 5));
    rightHandGroup.rotation.set(0.24, -0.22, 0.08);
    const isMobSnap = viewW < viewH;
    _tPos.set(Math.sin(state.snapTimer * 0.85) * 2.4, 4.4, isMobSnap ? -7.2 : -6.2);
    _tLook.set(0.0, 2.0, 0.4);
    camPos.lerp(_tPos, Math.min(1, rawDt * 3.5));
    camLook.lerp(_tLook, Math.min(1, rawDt * 3.5));

    for (const sc of flyingScraps) {
      if (!sc.mesh.visible) continue;
      sc.vy -= 7.5 * dt;
      sc.mesh.position.x += sc.vx * dt;
      sc.mesh.position.y += sc.vy * dt;
      sc.mesh.position.z += sc.vz * dt;
      sc.mesh.rotation.x += sc.rx * dt;
      sc.mesh.rotation.y += sc.ry * dt;
      sc.mesh.rotation.z += sc.rz * dt;
      if (sc.mesh.position.y < 0.05) {
        sc.mesh.position.y = 0.05;
        sc.vy = 0; sc.vx *= 0.8; sc.vz *= 0.8;
      }
    }

    if (state.phase === 'snapped' && state.snapTimer >= 3.0) {
      openResultModal();
    }
  }

  // 카메라 최종 반영 후 3D 곡선 휴지 리본 업데이트
  if (vfx.shakeMag > 0.005) {
    const sx = (Math.random() - 0.5) * vfx.shakeMag * 0.9;
    const sy = (Math.random() - 0.5) * vfx.shakeMag * 0.9;
    camera.position.set(camPos.x + sx, camPos.y + sy, camPos.z);
    camera.lookAt(camLook.x + sx * 0.25, camLook.y + sy * 0.25, camLook.z);
  } else {
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }
  updateCurvedRibbon(nowSec);

  renderer.render(scene, camera);
  drawOverlay(nowSec);
  window.__toiletDebug = {
    phase: state.phase,
    introCut: vfx.introCut,
    introAnim: state.introAnim,
    lengthM: state.lengthM,
    cheerCount: state.cheerCount,
    curOrbitR: state.curOrbitR,
    innerR: state.innerR,
    outerR: state.outerR,
    orbitCx: state.orbitCx,
    orbitCy: state.orbitCy,
    dangerRatio: state.dangerRatio,
  };
}

(async () => {
  refreshBestUi();
  const inc = await loadIncomingChallenge('toilet');
  if (inc) {
    state.rival = inc;
    const rLen = formatLength(Number(inc.score || 0));
    document.getElementById('rival-banner').style.display = 'flex';
    meterHud.classList.add('with-rival');
    document.getElementById('rival-banner-text').innerHTML = `<strong>${esc(inc.nickname)}</strong>님의 기록: <strong>${rLen}</strong> (${esc(inc.rankTitle)})`;
    const sb = document.getElementById('start-rival-box');
    sb.style.display = 'flex';
    sb.innerHTML = `<div class="vs-verdict" style="color:var(--accent);font-size:15px">🏆 내가 아는 ${esc(inc.nickname)}님: ${rLen} (${esc(inc.rankTitle)})</div>`;
  }
  resetRound();
  requestAnimationFrame(animate);
})();
