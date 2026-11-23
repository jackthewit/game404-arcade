// 손톱 색칠하기 — 타임어택 & 상·중·하 네일아트 3D 웹게임
// - 하(초급): 5손톱 원컬러 풀코트
// - 중(중급): 5손톱 베이스 풀코트 + 심플 네일아트(하트·프렌치·도트·사선·스파클)
// - 상(고급): 5손톱 베이스 풀코트 + 마스터 네일아트(리본·타탄체크·데이지꽃·트윈하트·초승달)
// - 제한시간 탈락 없이 스톱워치로 걸린 시간을 측정하여 빠르고 정교할수록 스피드·난이도 가산점 부여!
import * as THREE from 'three';
import { unlockAudio, SFX, BGM } from '/shared/audio.js';
import {
  getSavedNickname,
  saveNickname,
  getBestRecord,
  updateBestRecord,
  loadIncomingChallenge,
  saveResultAndBuildShare,
  renderGlobalLadderHTML,
  shareChallengeLink,
  downloadResultCard,
} from '/shared/challenge.js';
import { enforceGameAccess } from '/shared/catalog.js';

const GAME_ID = 'nail';
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = k => k * k * (3 - 2 * k);
const sm = x => ease(clamp(x, 0, 1));
const gs = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));

const rnd = i => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const h2 = (i, j) => {
  const x = Math.sin(i * 127.1 + j * 311.7 + 74.7) * 43758.5453;
  return x - Math.floor(x);
};
const n2 = (x, y) => {
  const i = Math.floor(x), j = Math.floor(y);
  const fx = ease(x - i), fy = ease(y - j);
  return lerp(lerp(h2(i, j), h2(i + 1, j), fx), lerp(h2(i, j + 1), h2(i + 1, j + 1), fx), fy) * 2 - 1;
};

const $ = id => document.getElementById(id);

// ─── 매니큐어 6종 컬러 팔레트 (아트 물감 고대비 색상 자동 매칭 포함) ───
const PALETTE = [
  { id: 'cherry', name: '체리 레드', hex: '#c20e28', dark: '#7c0416', bottle: '#b30f24', artHex: '#fff9f0', artDark: '#dfd3c3' },
  { id: 'rose',   name: '로즈 핑크', hex: '#e63e76', dark: '#9c1946', bottle: '#d43168', artHex: '#fffaf2', artDark: '#e2d4c8' },
  { id: 'coral',  name: '코랄 피치', hex: '#f05d43', dark: '#a62e19', bottle: '#df4f36', artHex: '#fffaf0', artDark: '#e0d2c0' },
  { id: 'butter', name: '버터 옐로우', hex: '#eab308', dark: '#a16207', bottle: '#d9a306', artHex: '#6b1630', artDark: '#3f0819' },
  { id: 'mint',   name: '민트 소다', hex: '#14b8a6', dark: '#0f766e', bottle: '#0fa695', artHex: '#fffaf2', artDark: '#d8e4e2' },
  { id: 'navy',   name: '미드나잇 네이비', hex: '#23429e', dark: '#101f54', bottle: '#1b3582', artHex: '#fef08a', artDark: '#eab308' },
];

// ─── 상·중·하 난이도 설정 ───
const DIFFICULTIES = {
  low: {
    id: 'low', code: 1, short: '하', badge: '하 · 원컬러 풀코트',
    desc: '⏱ 다섯 손톱을 점선 안쪽까지 빠르고 깔끔하게 풀컬러로 채우세요! (+시간 가산점 최대 20점)',
    hasArt: false, fastSec: 18, slowSec: 60, maxSpeedBonus: 20, diffBonusMax: 0, jitterScale: 0.92,
  },
  mid: {
    id: 'mid', code: 2, short: '중', badge: '중 · 심플 네일아트',
    desc: '🎨 베이스 컬러 위에 귀여운 하트·프렌치·도트·별 도안을 세필 붓으로 그려요! (+난이도 15점 · 시간 25점)',
    hasArt: true, fastSec: 36, slowSec: 115, maxSpeedBonus: 25, diffBonusMax: 15, jitterScale: 1.0,
  },
  high: {
    id: 'high', code: 3, short: '상', badge: '상 · 마스터 네일아트',
    desc: '👑 베이스 컬러 위에 고난도 리본·체크·데이지꽃·초승달 아트를 완성하세요! (+난이도 30점 · 시간 30점)',
    hasArt: true, fastSec: 45, slowSec: 140, maxSpeedBonus: 30, diffBonusMax: 30, jitterScale: 1.15,
  },
};

const FINGER_SPECS = [
  { name: '엄지', label: '① 엄지', x: -33.2, y: -1.6, z: -13.5, ry: -0.24, rz: 0.09, sx: 1.08, sy: 1.02, sz: 0.96, jitterMul: 0.85 },
  { name: '검지', label: '② 검지', x: -16.8, y: 0.0,  z: -2.2,  ry: -0.05, rz: 0.02, sx: 0.99, sy: 0.99, sz: 0.99, jitterMul: 0.95 },
  { name: '중지', label: '③ 중지', x: 0.0,   y: 0.3,  z: 0.0,   ry: 0.00,  rz: 0.00, sx: 1.02, sy: 1.01, sz: 1.03, jitterMul: 1.00 },
  { name: '약지', label: '④ 약지', x: 16.6,  y: 0.0,  z: -2.6,  ry: 0.05,  rz: -0.02,sx: 0.96, sy: 0.97, sz: 0.98, jitterMul: 1.08 },
  { name: '소지', label: '⑤ 소지', x: 31.4,  y: -0.5, z: -9.2,  ry: 0.11,  rz: -0.05,sx: 0.87, sy: 0.90, sz: 0.92, jitterMul: 1.18 },
];

// ─── 네일아트 도안 생성 도우미 (중급 5종 + 고급 5종) ───
function makeHeartStroke(cx, cs, scale) {
  const pts = [];
  const steps = 44;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * TAU;
    const x = cx + scale * 0.19 * 16 * Math.pow(Math.sin(t), 3);
    const s = cs - scale * 0.18 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([x, s]);
  }
  return pts;
}

function makeArcStroke(cx, cs, rx, rs, a0, a1, steps = 28) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = lerp(a0, a1, i / steps);
    pts.push([cx + Math.cos(a) * rx, cs + Math.sin(a) * rs]);
  }
  return pts;
}

const ART_PATTERNS = {
  mid: [
    // ① 엄지: 러블리 하트
    {
      name: '♥ 하트',
      halfW: 0.72,
      brushR: 0.70,
      strokes: [makeHeartStroke(0, 6.7, 1.02)],
      dots: [],
    },
    // ② 검지: 프렌치 스마일 라인
    {
      name: '🌙 프렌치 라인',
      halfW: 0.78,
      brushR: 0.74,
      strokes: [
        (() => {
          const pts = [];
          for (let i = 0; i <= 28; i++) {
            const u = (i / 28) * 2 - 1;
            const x = u * 4.25;
            const s = 10.7 - 1.65 * u * u;
            pts.push([x, s]);
          }
          return pts;
        })(),
      ],
      dots: [],
    },
    // ③ 중지: 트윙클 3도트
    {
      name: '🫧 트윙클 도트',
      halfW: 0.72,
      brushR: 0.80,
      strokes: [],
      dots: [[0, 4.0, 1.02], [0, 6.8, 1.12], [0, 9.6, 1.02]],
    },
    // ④ 약지: 사선 트윈 라인
    {
      name: '✨ 트윈 사선',
      halfW: 0.68,
      brushR: 0.68,
      strokes: [
        [[-3.5, 4.2], [3.5, 7.5]],
        [[-3.3, 6.6], [3.3, 9.9]],
      ],
      dots: [],
    },
    // ⑤ 소지: 반짝 다이아 스파클
    {
      name: '✦ 스파클 별',
      halfW: 0.66,
      brushR: 0.66,
      strokes: [
        [[0, 3.8], [0, 9.8]],
        [[-2.5, 6.8], [2.5, 6.8]],
      ],
      dots: [],
    },
  ],
  high: [
    // ① 엄지: 발레코어 리본 보우
    {
      name: '🎀 리본 보우',
      halfW: 0.60,
      brushR: 0.60,
      strokes: [
        // 왼쪽 리본 고리
        (() => {
          const pts = [];
          for (let i = 0; i <= 26; i++) {
            const t = (i / 26) * Math.PI;
            const r = Math.sin(t);
            pts.push([-3.6 * r, 6.1 + 1.55 * Math.sin(2 * t) * 0.65]);
          }
          return pts;
        })(),
        // 오른쪽 리본 고리
        (() => {
          const pts = [];
          for (let i = 0; i <= 26; i++) {
            const t = (i / 26) * Math.PI;
            const r = Math.sin(t);
            pts.push([3.6 * r, 6.1 + 1.55 * Math.sin(2 * t) * 0.65]);
          }
          return pts;
        })(),
        // 아래 두 가닥 리본 꼬리
        [[-0.25, 6.3], [-2.35, 10.3]],
        [[0.25, 6.3], [2.35, 10.3]],
      ],
      dots: [[0, 6.15, 0.72]],
    },
    // ② 검지: 타탄 체크 그리드
    {
      name: '🏁 타탄 체크',
      halfW: 0.58,
      brushR: 0.58,
      strokes: [
        [[-1.75, 2.9], [-1.75, 10.8]],
        [[1.75, 2.9], [1.75, 10.8]],
        [[-3.9, 5.1], [3.9, 5.1]],
        [[-4.0, 8.5], [4.0, 8.5]],
      ],
      dots: [],
    },
    // ③ 중지: 데이지 5잎 플라워
    {
      name: '✿ 데이지 꽃',
      halfW: 0.60,
      brushR: 0.68,
      strokes: [],
      dots: (() => {
        const arr = [[0, 6.8, 0.85]];
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k * TAU) / 5;
          arr.push([Math.cos(a) * 2.15, 6.8 + Math.sin(a) * 2.15, 0.92]);
        }
        return arr;
      })(),
    },
    // ④ 약지: 트윈 미니하트
    {
      name: '💕 트윈 하트',
      halfW: 0.58,
      brushR: 0.58,
      strokes: [
        makeHeartStroke(-1.35, 4.9, 0.56),
        makeHeartStroke(1.35, 8.7, 0.56),
      ],
      dots: [[1.6, 4.6, 0.58], [-1.6, 8.8, 0.58]],
    },
    // ⑤ 소지: 초승달 & 별빛
    {
      name: '🌙 초승달 별',
      halfW: 0.58,
      brushR: 0.58,
      strokes: [
        makeArcStroke(0.55, 6.8, 2.5, 2.75, 0.36 * Math.PI, 1.64 * Math.PI, 28),
      ],
      dots: [[1.35, 6.8, 0.72]],
    },
  ],
};

function distToSegment(px, ps, ax, as, bx, bs) {
  const vx = bx - ax, vs = bs - as;
  const wx = px - ax, ws = ps - as;
  const len2 = vx * vx + vs * vs;
  const t = len2 > 1e-6 ? clamp((wx * vx + ws * vs) / len2, 0, 1) : 0;
  const dx = px - (ax + vx * t), ds = ps - (as + vs * t);
  return Math.hypot(dx, ds);
}

function signedDistToPattern(px, ps, pat) {
  let minD = 1e9;
  for (const st of pat.strokes) {
    for (let i = 0; i < st.length - 1; i++) {
      const d = distToSegment(px, ps, st[i][0], st[i][1], st[i + 1][0], st[i + 1][1]) - pat.halfW;
      if (d < minD) minD = d;
    }
  }
  for (const [cx, cs, r] of pat.dots) {
    const d = Math.hypot(px - cx, ps - cs) - r;
    if (d < minD) minD = d;
  }
  return minD;
}

function hexRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

function dataTex(w, h, data, srgb, mipmaps = true) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mipmaps;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// ─── WebGL 렌더러 & 카메라 & 스트립 조명 환경맵 ───
const glCanvas = $('gl');
const ovCanvas = $('ov');
const ovCtx = ovCanvas.getContext('2d');

const R = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
R.setSize(window.innerWidth, window.innerHeight, false);
R.outputColorSpace = THREE.SRGBColorSpace;
R.toneMapping = THREE.NeutralToneMapping;
R.toneMappingExposure = 1.02;
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;

const S = new THREE.Scene();
const DESK_HEX = '#cfd8e2';
const DESK_Y = -36;
S.background = new THREE.Color(DESK_HEX);

const CAM = new THREE.PerspectiveCamera(16.5, window.innerWidth / window.innerHeight, 8, 1300);

{
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(
    new THREE.BoxGeometry(600, 600, 600),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.21, 0.22), side: THREE.BackSide })
  ));
  const strip = (dir, w, l, k, up) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, l),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.98, k * 0.95), side: THREE.DoubleSide })
    );
    m.position.copy(dir).normalize().multiplyScalar(220);
    m.up.copy(up || V(0, 0, 1));
    m.lookAt(0, 0, 0);
    es.add(m);
  };
  strip(V(-0.20, 0.84, -0.50), 24, 420, 13.5);
  strip(V(0.46, 0.70, -0.40), 60, 300, 6.2);
  strip(V(-0.75, 0.35, 0.55), 120, 120, 2.4);
  strip(V(0.10, 0.50, 0.86), 150, 90, 1.6, V(0, 1, 0));
  const fl = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.33, 0.35), side: THREE.DoubleSide })
  );
  fl.rotation.x = -Math.PI / 2;
  fl.position.y = -60;
  es.add(fl);
  const pm = new THREE.PMREMGenerator(R);
  S.environment = pm.fromScene(es, 0.008, 1, 2000).texture;
  S.environmentIntensity = 0.52;
  pm.dispose();
}

const keyLight = new THREE.DirectionalLight('#fff5e8', 1.75);
keyLight.position.set(-48, 150, -20);
keyLight.target.position.set(0, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.05;
{
  const c = keyLight.shadow.camera;
  c.left = -115; c.right = 115; c.top = 115; c.bottom = -115; c.near = 20; c.far = 420;
  c.updateProjectionMatrix();
}
S.add(keyLight, keyLight.target);
S.add(new THREE.HemisphereLight('#fff8f2', '#e9a898', 0.54));
const fillLight = new THREE.DirectionalLight('#dfeaff', 0.46);
fillLight.position.set(65, 55, 75);
S.add(fillLight);

{
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshStandardMaterial({ color: DESK_HEX, roughness: 0.82, metalness: 0, envMapIntensity: 0.25 })
  );
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = DESK_Y;
  desk.receiveShadow = true;
  S.add(desk);
}

// ─── 손가락 & 손톱 수학 모델 ───
const NL = { hw0: 5.45, hw1: 5.75, rootD: 3.0, sideS: 11.4, tipD: 2.2, GAP: 0.13 };
const NLEN = NL.sideS + NL.tipD;
const hwAt = s => lerp(NL.hw0, NL.hw1, clamp((s - NL.rootD) / (NL.sideS - NL.rootD), 0, 1));

function halfW(s) {
  if (s <= 0 || s >= NLEN) return -1;
  if (s < NL.rootD) return NL.hw0 * Math.sqrt(1 - Math.pow((NL.rootD - s) / NL.rootD, 2));
  if (s <= NL.sideS) return hwAt(s);
  return NL.hw1 * Math.sqrt(1 - Math.pow((s - NL.sideS) / NL.tipD, 2));
}
const inNail = (x, s) => Math.abs(x) < halfW(s);

const PA = { x0: -9, s0: -2.5, W: 18, N: 384 };
const SN = 256;
const SD = new Float32Array(SN * SN);
{
  const P = [];
  for (let i = 0; i <= 140; i++) {
    const a = Math.PI * i / 140;
    P.push([NL.hw0 * Math.cos(a), NL.rootD - NL.rootD * Math.sin(a)]);
  }
  for (let i = 1; i < 80; i++) {
    const k = i / 80;
    P.push([-lerp(NL.hw0, NL.hw1, k), lerp(NL.rootD, NL.sideS, k)]);
  }
  for (let i = 0; i <= 140; i++) {
    const a = Math.PI * (i / 140);
    P.push([-NL.hw1 * Math.cos(a), NL.sideS + NL.tipD * Math.sin(a)]);
  }
  for (let i = 1; i < 80; i++) {
    const k = i / 80;
    P.push([lerp(NL.hw1, NL.hw0, k), lerp(NL.sideS, NL.rootD, k)]);
  }
  const n = P.length;
  const px = new Float32Array(n), ps = new Float32Array(n);
  for (let i = 0; i < n; i++) { px[i] = P[i][0]; ps[i] = P[i][1]; }

  for (let iy = 0; iy < SN; iy++) {
    const s = PA.s0 + (iy + 0.5) / SN * PA.W;
    for (let ix = 0; ix < SN; ix++) {
      const x = PA.x0 + (ix + 0.5) / SN * PA.W;
      let m = 1e9;
      for (let k = 0; k < n; k++) {
        const dx = px[k] - x, ds = ps[k] - s;
        const d = dx * dx + ds * ds;
        if (d < m) m = d;
      }
      SD[iy * SN + ix] = Math.sqrt(m) * (inNail(x, s) ? -1 : 1);
    }
  }
}

function sdf(x, s) {
  const fx = (x - PA.x0) / PA.W * SN - 0.5;
  const fy = (s - PA.s0) / PA.W * SN - 0.5;
  if (fx < 0 || fy < 0 || fx > SN - 1.001 || fy > SN - 1.001) return 9;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const u = fx - ix, v = fy - iy, o = iy * SN + ix;
  return lerp(lerp(SD[o], SD[o + 1], u), lerp(SD[o + SN], SD[o + SN + 1], u), v);
}

const S_END = 15.0, CAPL = 4.5, DIP = -9.5, PIP = -34, SB0 = -4, NE = 2.5, NEB = 2.2, YC = 6, VS0 = -50, VSL = 63;

function prof(s) {
  const a = 7.9 + 0.4 * gs(s, DIP, 3.2) + 0.55 * gs(s, PIP, 5.5) + 0.25 * sm((DIP - s) / 14);
  const hT = 5.0 + 0.3 * gs(s, DIP, 3) + 0.5 * gs(s, PIP, 5) + 0.25 * sm((DIP - s) / 14) - (s > 0 ? 0.0058 * s * s : 0);
  const hB = 6.3 + 0.35 * gs(s, 3, 5) - 0.35 * gs(s, DIP, 2.2) - 0.45 * gs(s, PIP, 3);
  const e = S_END - s;
  const cap = e >= CAPL ? 1 : e <= 0 ? 0 : Math.pow(1 - Math.pow((CAPL - e) / CAPL, 3), 1 / 3);
  const cw = e >= 7.5 ? 1 : e <= 0 ? 0 : Math.pow(1 - Math.pow((7.5 - e) / 7.5, 3), 1 / 3);
  return { a, hT, hB, cap, cw, af: a * cw, hTf: hT * cap, hBf: hB * cap, ycf: lerp(6.2, YC, Math.pow(cap, 1.2)) };
}

function nailTop(x, s) {
  const p = prof(s);
  const q = Math.min(Math.abs(x) / p.a, 0.985);
  const d = Math.min(0, sdf(x, s));
  return YC + p.hT * Math.pow(1 - Math.pow(q, NE), 1 / NE) - 0.42 * Math.exp(d / 0.8) - 0.05;
}

function fleshTop(x, s, p) {
  p = p || prof(s);
  const ax = Math.abs(x);
  if (ax >= p.af) return -1e9;
  let y = p.ycf + p.hTf * Math.pow(1 - Math.pow(ax / p.af, NE), 1 / NE);
  if (s > -3.4 && s < NLEN + 1) {
    const d = sdf(x, s);
    if (d < 2.8) {
      const nt = nailTop(x, s);
      if (d < 0) {
        y = Math.min(y, nt - 0.26 - 0.2 * sm(-d / 0.3));
      } else {
        const root = clamp((NL.rootD + 0.6 - s) / 2.2, 0, 1);
        const h = lerp(0.36, 0.44, root), w = lerp(0.85, 1.25, root);
        const ft = 1 - sm((s - (NL.sideS - 2.2)) / 2.2);
        y += (-0.75 * Math.exp(-d / 0.15) + (0.02 + h * 0.7) * (1 - Math.exp(-d / 0.2))) * ft * Math.exp(-0.9 * Math.pow(d / w, 2));
        if (ft < 1) y = lerp(Math.min(y, nt - 0.14 + 2 * d), y, ft);
      }
    }
  }
  return y;
}

function surfTop(x, s) {
  if (inNail(x, s) || s > NL.sideS) return nailTop(x, s);
  const f = fleshTop(x, s);
  return f > -1e8 ? f : nailTop(x, s) - 0.15;
}

const sg = x => 1 / (1 + Math.exp(-x));
function bender(L, bD, bP) {
  const ds = 0.12, n = Math.ceil((SB0 + L) / ds) + 3;
  const T = new Float32Array(n * 3);
  const ph = s => bD * sg((DIP - s) / 1.5) + bP * sg((PIP - s) / 2.6);
  const ph0 = ph(SB0);
  let y = YC, z = SB0;
  for (let i = 0; i < n; i++) {
    const p = ph(SB0 - i * ds) - ph0;
    T[i * 3] = y; T[i * 3 + 1] = z; T[i * 3 + 2] = p;
    y += Math.sin(p) * ds;
    z -= Math.cos(p) * ds;
  }
  return (yl, s, out) => {
    if (s >= SB0) { out.y = yl; out.z = s; return out; }
    const f = (SB0 - s) / ds;
    const i = Math.min(n - 2, Math.floor(f)), u = f - i;
    const cy = lerp(T[i * 3], T[i * 3 + 3], u);
    const cz = lerp(T[i * 3 + 1], T[i * 3 + 4], u);
    const p = lerp(T[i * 3 + 2], T[i * 3 + 5], u);
    out.y = cy + Math.cos(p) * (yl - YC);
    out.z = cz + Math.sin(p) * (yl - YC);
    return out;
  };
}

// ─── 피부 & 맨손톱 재질 ───
const C_SKIN = {
  top: hexRgb('#ecbe9f'), side: hexRgb('#e3a188'), pad: hexRgb('#f3c3b2'),
  knu: hexRgb('#d98f7c'), blush: hexRgb('#ee9f93'), cut: hexRgb('#f8e2d2'),
  ao: hexRgb('#9a4f43'), crease: hexRgb('#a9614f'),
};
const CREASE = [[DIP, [-2.1, -1.2, -0.35, 0.5, 1.3, 2.2]], [PIP, [-3.3, -2.2, -1.1, 0, 1.1, 2.3, 3.4]]];

function buildSkinMaterial() {
  const W = 512, H = 512;
  const col = new Uint8Array(W * H * 4), bmp = new Uint8Array(W * H * 4);
  for (let iy = 0; iy < H; iy++) {
    const s = VS0 + (iy + 0.5) / H * VSL, p = prof(s);
    for (let ix = 0; ix < W; ix++) {
      const th = (ix + 0.5) / W * TAU - Math.PI / 2;
      const c = Math.cos(th), sn = Math.sin(th), o = (iy * W + ix) * 4;
      const x = p.af * Math.sign(c) * Math.pow(Math.abs(c), 2 / NE);
      const wt = sm((sn + 0.15) / 0.6), mm = (ix / W) * 48;
      let k = mix3(C_SKIN.side, C_SKIN.top, wt);
      if (sn < -0.25) k = mix3(k, C_SKIN.pad, sm((-sn - 0.25) / 0.5));
      let b = 128;
      const m1 = n2(mm * 0.16 + 3, s * 0.13) * p.cw;
      k = mix3(k, C_SKIN.blush, clamp(0.11 + 0.11 * m1, 0, 1));

      for (const [c0, offs] of CREASE) {
        const g = gs(s, c0, c0 === DIP ? 2.9 : 4.2) * wt;
        if (g < 0.015) continue;
        k = mix3(k, C_SKIN.knu, 0.48 * g);
        for (let j = 0; j < offs.length; j++) {
          const wob = 0.28 * Math.sin(x * 0.62 + j * 1.7);
          const dd = Math.abs(s - (c0 + offs[j] + wob));
          const wd = 0.14 + 0.05 * rnd(j + c0);
          const dep = (0.55 + 0.45 * rnd(j * 3 + 1)) * clamp(1.25 - Math.abs(x) / Math.max(0.1, p.af), 0, 1);
          if (dd < wd * 3) {
            const q = Math.exp(-Math.pow(dd / wd, 2)) * dep * wt;
            b -= 90 * q;
            k = mix3(k, C_SKIN.crease, 0.48 * q);
          }
        }
      }
      k = mix3(k, C_SKIN.blush, 0.24 * sm((s - 4) / 8));
      if (sn > 0 && s > -3.4 && s < NLEN + 1) {
        const d = sdf(x, s);
        if (d < 2.8) {
          const dp = Math.max(d, 0);
          const root = clamp((NL.rootD + 0.6 - s) / 2.2, 0, 1);
          const ft = 1 - 0.85 * sm((s - (NL.sideS - 1.5)) / 1.5);
          k = mix3(k, C_SKIN.blush, 0.42 * Math.exp(-dp / 0.9) * ft);
          k = mix3(k, C_SKIN.cut, 0.62 * root * Math.exp(-Math.pow((dp - 0.1) / 0.16, 2)));
          k = mix3(k, C_SKIN.ao, (0.6 * (1 - root) + 0.3) * Math.exp(-dp / 0.13) * (d > -0.3 ? 1 : 0) * ft);
          b += 24 * root * Math.exp(-Math.pow((dp - 0.12) / 0.14, 2));
        }
      }
      col[o] = clamp(k[0], 0, 255);
      col[o + 1] = clamp(k[1], 0, 255);
      col[o + 2] = clamp(k[2], 0, 255);
      col[o + 3] = 255;
      bmp[o] = bmp[o + 1] = bmp[o + 2] = clamp(b, 0, 255);
      bmp[o + 3] = 255;
    }
  }
  const ct = dataTex(W, H, col, true);
  const bt = dataTex(W, H, bmp, false);
  ct.wrapS = bt.wrapS = THREE.RepeatWrapping;
  return new THREE.MeshPhysicalMaterial({
    map: ct, bumpMap: bt, bumpScale: 1.9,
    roughness: 0.5, metalness: 0,
    sheen: 0.55, sheenColor: new THREE.Color('#ff8468'), sheenRoughness: 0.5,
    envMapIntensity: 0.42, specularIntensity: 0.5,
  });
}

function buildNailMaterial() {
  const W = 384;
  const col = new Uint8Array(W * W * 4), bmp = new Uint8Array(W * W * 4);
  const bed = hexRgb('#efb3a6'), lun = hexRgb('#f8e6dc'), fre = hexRgb('#f6efe6'), dk = hexRgb('#e39a90'), wht = [255, 255, 255];
  for (let iy = 0; iy < W; iy++) {
    const s = PA.s0 + (iy + 0.5) / W * PA.W, p = prof(s);
    for (let ix = 0; ix < W; ix++) {
      const x = PA.x0 + (ix + 0.5) / W * PA.W, o = (iy * W + ix) * 4, d = sdf(x, s);
      let k = mix3(bed, dk, 0.75 * sm((d + 0.8) / 0.8) + 0.12 * sm((s - 6) / 6));
      k = mix3(k, hexRgb('#b9685f'), 0.5 * sm((d + 0.22) / 0.22) * (s < NL.sideS + 0.6 ? 1 : 0));
      const e = Math.sqrt(Math.pow(x / 3.5, 2) + Math.pow((s - 0.1) / 2.9, 2));
      k = mix3(k, lun, 0.85 * (1 - sm((e - 0.86) / 0.2)));
      const fr = sm((Math.abs(x) - p.af + 0.3) / 0.3);
      k = mix3(k, fre, 0.88 * Math.max(fr, sm((s - (NLEN - 0.75)) / 0.3)));
      if (d > -0.34 && d < -0.14) {
        const ang = Math.atan2(s - 6.8, x);
        if (Math.sin(ang * 28) > 0.2) k = mix3(k, wht, 0.45);
      }
      col[o] = clamp(k[0], 0, 255);
      col[o + 1] = clamp(k[1], 0, 255);
      col[o + 2] = clamp(k[2], 0, 255);
      col[o + 3] = 255;
      bmp[o] = bmp[o + 1] = bmp[o + 2] = 128 + 8 * Math.sin(x * 14);
      bmp[o + 3] = 255;
    }
  }
  return new THREE.MeshPhysicalMaterial({
    map: dataTex(W, W, col, true),
    bumpMap: dataTex(W, W, bmp, false),
    bumpScale: 0.45,
    roughness: 0.3, metalness: 0,
    clearcoat: 0.45, clearcoatRoughness: 0.28,
    envMapIntensity: 0.8, side: THREE.DoubleSide,
  });
}

const skinM = buildSkinMaterial();
const nailM = buildNailMaterial();

const _bendOut = { y: 0, z: 0 };
function buildFingerGeo({ L = 54, bD = 0.04, bP = 0.08, n1 = 74, n2c = 128, nt = 156 } = {}) {
  const bend = bender(L, bD, bP), ss = [];
  for (let i = 0; i < n1; i++) ss.push(lerp(-L, SB0, i / n1));
  for (let i = 0; i <= n2c; i++) ss.push(lerp(SB0, S_END, Math.pow(i / n2c, 0.92)));
  const th = j => {
    const k = j / nt;
    return k < 0.14 ? lerp(-Math.PI / 2, 0, k / 0.14)
      : k < 0.86 ? lerp(0, Math.PI, (k - 0.14) / 0.72)
      : lerp(Math.PI, 1.5 * Math.PI, (k - 0.86) / 0.14);
  };
  const ns = ss.length;
  const pos = new Float32Array(ns * (nt + 1) * 3);
  const uv = new Float32Array(ns * (nt + 1) * 2);
  const idx = [];
  for (let i = 0; i < ns; i++) {
    const s = ss[i], p = prof(s);
    const rootDist = s - (-L);
    const rootCap = rootDist >= 6.0 ? 1 : rootDist <= 0 ? 0 : Math.pow(1 - Math.pow((6.0 - rootDist) / 6.0, 2.2), 0.45);
    const af = p.af * rootCap;
    const hTf = p.hTf * rootCap;
    const hBf = p.hBf * rootCap;

    for (let j = 0; j <= nt; j++) {
      const t = th(j), c = Math.cos(t), sn = Math.sin(t), o = i * (nt + 1) + j;
      const x = af * Math.sign(c) * Math.pow(Math.abs(c), 2 / NE) * 0.9995;
      let y;
      if (sn >= 0) {
        if (rootCap > 0.999) {
          y = p.af > 1e-4 ? fleshTop(x, s, p) : p.ycf;
        } else {
          y = p.ycf + hTf * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / Math.max(1e-4, af), NE)), 1 / NE);
        }
      } else {
        y = p.ycf - hBf * Math.pow(-sn, 2 / NEB);
      }
      bend(y, s, _bendOut);
      pos[o * 3] = x; pos[o * 3 + 1] = _bendOut.y; pos[o * 3 + 2] = _bendOut.z;
      uv[o * 2] = (t + Math.PI / 2) / TAU;
      uv[o * 2 + 1] = clamp((s - VS0) / VSL, 0.01, 0.99);
    }
  }
  for (let i = 0; i < ns - 1; i++) {
    for (let j = 0; j < nt; j++) {
      const a = i * (nt + 1) + j, b = a + 1, c = a + nt + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal.array;
  for (let j = 0; j <= nt; j++) {
    const oTip = ((ns - 1) * (nt + 1) + j) * 3;
    nr[oTip] = 0; nr[oTip + 1] = 0.15; nr[oTip + 2] = 0.988;
    const oRoot = j * 3;
    nr[oRoot] = 0; nr[oRoot + 1] = 0.1; nr[oRoot + 2] = -0.995;
  }
  g.attributes.normal.needsUpdate = true;
  return g;
}

function buildNailGeo(nu = 48, nv = 84) {
  const pos = [], uv = [], idx = [];
  const wE = s => {
    if (s < NL.rootD) return NL.hw0 * Math.sqrt(Math.max(0, 1 - Math.pow((NL.rootD - s) / NL.rootD, 2)));
    if (s <= NL.sideS) return hwAt(s);
    return NL.hw1 * Math.sqrt(Math.max(0, 1 - Math.pow((s - NL.sideS) / NL.tipD, 2)));
  };
  for (let i = 0; i <= nv; i++) {
    const k = i / nv;
    const s = lerp(1e-4, NLEN - 1e-4, 0.5 - 0.5 * Math.cos(Math.PI * k)), w = wE(s);
    for (let j = 0; j <= nu; j++) {
      const x = (j / nu * 2 - 1) * w;
      pos.push(x, nailTop(x, s), s);
      uv.push((x - PA.x0) / PA.W, (s - PA.s0) / PA.W);
    }
  }
  for (let i = 0; i < nv; i++) {
    for (let j = 0; j < nu; j++) {
      const a = i * (nu + 1) + j, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildCoatGeo(NG = 148) {
  const X0 = -8.3, X1 = 8.3, S0 = -1.4, S1 = NLEN + 0.3;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NG; i++) {
    const s = lerp(S0, S1, i / NG);
    for (let j = 0; j <= NG; j++) {
      const x = lerp(X0, X1, j / NG);
      pos.push(x, surfTop(x, s) + 0.036, s);
      uv.push((x - PA.x0) / PA.W, (s - PA.s0) / PA.W);
    }
  }
  for (let i = 0; i < NG; i++) {
    for (let j = 0; j < NG; j++) {
      const a = i * (NG + 1) + j, b = a + 1, c = a + NG + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const FG_MAIN = buildFingerGeo();
const NG_MAIN = buildNailGeo();
const COAT_GEO = buildCoatGeo();

function makeFingerMesh(fg = FG_MAIN, ng = NG_MAIN) {
  const G = new THREE.Group();
  const f = new THREE.Mesh(fg, skinM);
  const n = new THREE.Mesh(ng, nailM);
  f.castShadow = f.receiveShadow = true;
  n.castShadow = n.receiveShadow = true;
  G.add(f, n);
  return G;
}

// ─── 공용 페인트 존 테이블 & 2층(베이스 + 네일아트) NailCoat ───
const N_TEX = PA.N;
const PX = PA.W / N_TEX;
const ZONE = new Uint8Array(N_TEX * N_TEX);
const EK = new Uint8Array(N_TEX * N_TEX);
const SDV = new Float32Array(N_TEX * N_TEX);
let TOTAL_NAIL_PX = 0;

for (let iy = 0; iy < N_TEX; iy++) {
  const s = PA.s0 + (iy + 0.5) * PX;
  const gap = NL.GAP * (1 - sm((s - (NL.sideS - 1.2)) / 1.2));
  for (let ix = 0; ix < N_TEX; ix++) {
    const x = PA.x0 + (ix + 0.5) * PX;
    const i = iy * N_TEX + ix;
    const d = sdf(x, s);
    SDV[i] = d;
    if (d < 0) {
      if (d < -gap) {
        ZONE[i] = 0;
        TOTAL_NAIL_PX++;
        EK[i] = 255 * Math.sqrt(clamp((-d - gap) / 0.32, 0, 1));
      } else {
        ZONE[i] = 1;
      }
    } else {
      ZONE[i] = s > NL.sideS ? 3 : 2;
    }
  }
}

class NailCoat {
  constructor(paletteItem) {
    this.cov = new Uint8Array(N_TEX * N_TEX);
    this.HT = new Uint8Array(N_TEX * N_TEX);
    this.RG = new Uint8Array(N_TEX * N_TEX);
    // 2층 네일아트 물감 레이어 및 도안 마스크
    this.artCov = new Uint8Array(N_TEX * N_TEX);
    this.artHT = new Uint8Array(N_TEX * N_TEX);
    this.artMask = new Uint8Array(N_TEX * N_TEX); // 0: 도안 밖, 1: 완충 띠, 2: 목표 도안 내부
    this.artTargetTotal = 0;
    this.artPainted = 0;
    this.artOutsidePx = 0;

    this.data = new Uint8Array(N_TEX * N_TEX * 4);
    this.cdat = new Uint8Array(N_TEX * N_TEX * 4);
    this.CR = hexRgb(paletteItem.hex);
    this.CD = hexRgb(paletteItem.dark);
    this.CA = hexRgb(paletteItem.artHex);
    this.CAD = hexRgb(paletteItem.artDark);

    this.tex = dataTex(N_TEX, N_TEX, this.data, false, false);
    this.ctex = dataTex(N_TEX, N_TEX, this.cdat, true, false);

    this.mat = new THREE.MeshPhysicalMaterial({
      map: this.ctex,
      roughness: 0.085,
      metalness: 0,
      bumpMap: this.tex,
      bumpScale: 1.55,
      alphaMap: this.tex,
      transparent: true,
      depthWrite: false,
      clearcoat: 0.90,
      clearcoatRoughness: 0.025,
      envMapIntensity: 1.35,
      specularIntensity: 1.0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(COAT_GEO, this.mat);
    this.mesh.renderOrder = 4;
    this.mesh.receiveShadow = true;

    this.painted = 0;
    this.smearPx = 0;
    this.overMm = 0;
    this.smearCount = 0;
    this.ux0 = 0; this.ux1 = N_TEX - 1;
    this.uy0 = 0; this.uy1 = N_TEX - 1;
    this.dirty = true;
    this.upload();
  }

  setColor(pal) {
    this.CR = hexRgb(pal.hex);
    this.CD = hexRgb(pal.dark);
    this.CA = hexRgb(pal.artHex);
    this.CAD = hexRgb(pal.artDark);
    this.ux0 = 0; this.ux1 = N_TEX - 1;
    this.uy0 = 0; this.uy1 = N_TEX - 1;
    this.dirty = true;
    this.upload();
  }

  setArtPattern(pat) {
    this.artMask.fill(0);
    this.artTargetTotal = 0;
    this.artPainted = 0;
    this.artOutsidePx = 0;
    if (!pat) return;

    for (let iy = 0; iy < N_TEX; iy++) {
      const s = PA.s0 + (iy + 0.5) * PX;
      const rowOff = iy * N_TEX;
      for (let ix = 0; ix < N_TEX; ix++) {
        const i = rowOff + ix;
        if (ZONE[i] !== 0) continue;
        const x = PA.x0 + (ix + 0.5) * PX;
        const d = signedDistToPattern(x, s, pat);
        if (d <= 0) {
          this.artMask[i] = 2;
          this.artTargetTotal++;
        } else if (d <= 0.62) {
          this.artMask[i] = 1;
        }
      }
    }
  }

  reset() {
    this.cov.fill(0);
    this.HT.fill(0);
    this.RG.fill(0);
    this.artCov.fill(0);
    this.artHT.fill(0);
    this.painted = 0;
    this.smearPx = 0;
    this.overMm = 0;
    this.smearCount = 0;
    this.artPainted = 0;
    this.artOutsidePx = 0;
    this.ux0 = 0; this.ux1 = N_TEX - 1;
    this.uy0 = 0; this.uy1 = N_TEX - 1;
    this.dirty = true;
    this.upload();
  }

  coverPct() {
    return (this.painted / TOTAL_NAIL_PX) * 100;
  }

  artCoverPct() {
    if (this.artTargetTotal <= 0) return 100;
    return (this.artPainted / this.artTargetTotal) * 100;
  }

  markDirty(ix0, ix1, iy0, iy1) {
    if (!this.dirty) {
      this.ux0 = ix0; this.ux1 = ix1;
      this.uy0 = iy0; this.uy1 = iy1;
      this.dirty = true;
    } else {
      if (ix0 < this.ux0) this.ux0 = ix0;
      if (ix1 > this.ux1) this.ux1 = ix1;
      if (iy0 < this.uy0) this.uy0 = iy0;
      if (iy1 > this.uy1) this.uy1 = iy1;
    }
  }

  stamp(x, s, a, b, psi, spill) {
    const c = Math.cos(psi), sn = Math.sin(psi);
    const r = Math.max(a, b) + PX;
    const ix0 = Math.max(0, Math.floor((x - r - PA.x0) / PX));
    const ix1 = Math.min(N_TEX - 1, Math.ceil((x + r - PA.x0) / PX));
    const iy0 = Math.max(0, Math.floor((s - r - PA.s0) / PX));
    const iy1 = Math.min(N_TEX - 1, Math.ceil((s + r - PA.s0) / PX));
    if (ix0 > ix1 || iy0 > iy1) return false;

    let newlySmeared = false;
    for (let iy = iy0; iy <= iy1; iy++) {
      const ds = PA.s0 + (iy + 0.5) * PX - s;
      const rowOff = iy * N_TEX;
      for (let ix = ix0; ix <= ix1; ix++) {
        const dx = PA.x0 + (ix + 0.5) * PX - x;
        const u = (dx * c + ds * sn) / a;
        const v = (-dx * sn + ds * c) / b;
        const q = Math.abs(u * u * u) + Math.abs(v * v * v);
        if (q >= 1) continue;

        const i = rowOff + ix;
        const z = ZONE[i];
        if (z === 3 || (z && !spill)) continue;

        const e = 1 - q;
        const cv = e >= 0.12 ? 255 : (e / 0.12 * 255) | 0;
        if (cv > this.cov[i]) {
          if (this.cov[i] < 128 && cv >= 128) {
            if (z === 0) {
              this.painted++;
            } else if (z === 2) {
              this.smearPx++;
              newlySmeared = true;
              if (SDV[i] > this.overMm) this.overMm = SDV[i];
            }
          }
          this.cov[i] = cv;
        }
        const h = Math.sqrt(Math.min(1, e * 3.2)) * (z === 0 ? EK[i] : z === 1 ? 60 : 140) * 0.75;
        if (h > this.HT[i]) this.HT[i] = h;
      }
    }
    this.markDirty(ix0, ix1, iy0, iy1);
    return newlySmeared;
  }

  // 세필 네일아트 물감 스탬프 (매끄러운 원형 도톰한 젤 터치)
  stampArt(x, s, radius, spill) {
    const r = radius + PX;
    const ix0 = Math.max(0, Math.floor((x - r - PA.x0) / PX));
    const ix1 = Math.min(N_TEX - 1, Math.ceil((x + r - PA.x0) / PX));
    const iy0 = Math.max(0, Math.floor((s - r - PA.s0) / PX));
    const iy1 = Math.min(N_TEX - 1, Math.ceil((s + r - PA.s0) / PX));
    if (ix0 > ix1 || iy0 > iy1) return false;

    let newlySmeared = false;
    const r2 = radius * radius;
    for (let iy = iy0; iy <= iy1; iy++) {
      const ds = PA.s0 + (iy + 0.5) * PX - s;
      const rowOff = iy * N_TEX;
      for (let ix = ix0; ix <= ix1; ix++) {
        const dx = PA.x0 + (ix + 0.5) * PX - x;
        const d2 = dx * dx + ds * ds;
        if (d2 >= r2) continue;

        const i = rowOff + ix;
        const z = ZONE[i];
        if (z === 3 || (z === 2 && !spill)) continue;

        const q = Math.sqrt(d2) / radius;
        const e = 1 - q;
        const cv = e >= 0.16 ? 255 : (e / 0.16 * 255) | 0;

        if (cv > this.artCov[i]) {
          if (this.artCov[i] < 128 && cv >= 128) {
            if (z === 2) {
              this.smearPx++;
              newlySmeared = true;
              if (SDV[i] > this.overMm) this.overMm = SDV[i];
            } else if (this.artMask[i] === 2) {
              this.artPainted++;
            } else if (this.artMask[i] === 0 && z === 0) {
              this.artOutsidePx++;
            }
          }
          this.artCov[i] = cv;
        }
        // 도톰한 3D 엠보싱 젤 높이
        const ah = Math.sqrt(Math.max(0, 1 - q * q)) * 88;
        if (ah > this.artHT[i]) this.artHT[i] = ah;
      }
    }
    this.markDirty(ix0, ix1, iy0, iy1);
    return newlySmeared;
  }

  ridge(x, s, a, b, psi, k = 0.85) {
    const c = Math.cos(psi), sn = Math.sin(psi);
    const r = Math.max(a, b) + PX;
    const ix0 = Math.max(0, Math.floor((x - r - PA.x0) / PX));
    const ix1 = Math.min(N_TEX - 1, Math.ceil((x + r - PA.x0) / PX));
    const iy0 = Math.max(0, Math.floor((s - r - PA.s0) / PX));
    const iy1 = Math.min(N_TEX - 1, Math.ceil((s + r - PA.s0) / PX));
    if (ix0 > ix1 || iy0 > iy1) return;

    for (let iy = iy0; iy <= iy1; iy++) {
      const ds = PA.s0 + (iy + 0.5) * PX - s;
      const rowOff = iy * N_TEX;
      for (let ix = ix0; ix <= ix1; ix++) {
        const dx = PA.x0 + (ix + 0.5) * PX - x;
        const u = (dx * c + ds * sn) / a;
        const v = (-dx * sn + ds * c) / b;
        const q = Math.sqrt(u * u + v * v);
        if (q >= 1 || v < 0) continue;
        const i = rowOff + ix;
        if (ZONE[i] > 1 || this.cov[i] < 128) continue;
        const w = Math.max(0, 1 - Math.abs(q - 0.86) / 0.14) * (0.85 + 0.15 * Math.sin(u * 19 + 1.3));
        const h = 62 * k * w * sm((1 - Math.abs(u)) / 0.12) * (EK[i] / 255);
        if (h > this.RG[i]) this.RG[i] = h;
      }
    }
    this.markDirty(ix0, ix1, iy0, iy1);
  }

  upload() {
    if (!this.dirty) return;
    const CR = this.CR, CD = this.CD, CA = this.CA, CAD = this.CAD;
    for (let iy = this.uy0; iy <= this.uy1; iy++) {
      const rowOff = iy * N_TEX;
      for (let ix = this.ux0; ix <= this.ux1; ix++) {
        const i = rowOff + ix, o = i * 4;
        const g = this.RG[i];
        const ac = this.artCov[i];
        const totalAlpha = ac > this.cov[i] ? ac : this.cov[i];
        const h = this.HT[i] + g + this.artHT[i];

        this.data[o] = h > 255 ? 255 : h;
        this.data[o + 1] = totalAlpha;
        this.data[o + 2] = h > 255 ? 255 : h;
        this.data[o + 3] = 255;

        const kBase = Math.min(1, g / 60) * 0.78;
        let r = CR[0] + (CD[0] - CR[0]) * kBase;
        let gg = CR[1] + (CD[1] - CR[1]) * kBase;
        let b = CR[2] + (CD[2] - CR[2]) * kBase;

        if (ac > 0) {
          const ka = ac / 255;
          const edgeShade = 1 - Math.min(1, this.artHT[i] / 75);
          const ar = CA[0] + (CAD[0] - CA[0]) * edgeShade * 0.45;
          const ag = CA[1] + (CAD[1] - CA[1]) * edgeShade * 0.45;
          const ab = CA[2] + (CAD[2] - CA[2]) * edgeShade * 0.45;
          r = r + (ar - r) * ka;
          gg = gg + (ag - gg) * ka;
          b = b + (ab - b) * ka;
        }

        this.cdat[o] = r;
        this.cdat[o + 1] = gg;
        this.cdat[o + 2] = b;
        this.cdat[o + 3] = 255;
      }
    }
    this.tex.needsUpdate = true;
    this.ctex.needsUpdate = true;
    this.dirty = false;
  }
}

// ─── 다섯 손가락 + 일체형 손등·손목 + 벨벳 쿠션 + 가이드 메쉬 ───
const HAND_RIG = new THREE.Group();
S.add(HAND_RIG);

const ARMREST = new THREE.Group();
{
  const velvetM = new THREE.MeshStandardMaterial({ color: '#f3d9e2', roughness: 0.85, metalness: 0 });
  const goldLegM = new THREE.MeshStandardMaterial({ color: '#e5c17b', roughness: 0.28, metalness: 0.72 });
  const padGeo = new THREE.CylinderGeometry(17, 18, 128, 36);
  padGeo.rotateZ(Math.PI / 2);
  const pad = new THREE.Mesh(padGeo, velvetM);
  pad.scale.set(1, 0.52, 1.38);
  pad.position.set(-1, -10.5, -72);
  pad.castShadow = pad.receiveShadow = true;
  ARMREST.add(pad);

  const legH = -10.5 - DESK_Y;
  for (const lx of [-52, 50]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 3.0, legH, 16), goldLegM);
    leg.position.set(lx, DESK_Y + legH * 0.5, -72);
    leg.castShadow = true;
    ARMREST.add(leg);
  }
  S.add(ARMREST);
}

function buildHandBodyGeo() {
  const NZ = 76, NT = 96;
  const zFront = -33.0, zBack = -235.0;
  const pos = new Float32Array((NZ + 1) * (NT + 1) * 3);
  const uv = new Float32Array((NZ + 1) * (NT + 1) * 2);
  const idx = [];

  for (let iz = 0; iz <= NZ; iz++) {
    const kz = iz / NZ;
    const z = lerp(zFront, zBack, Math.pow(kz, 1.15));
    const dFront = zFront - z;
    const cap = dFront >= 12.0 ? 1 : dFront <= 0 ? 0 : Math.pow(1 - Math.pow((12.0 - dFront) / 12.0, 2.0), 0.52);

    const wristNarrow = sm((-z - 76) / 44);
    const forearmWide = sm((-z - 130) / 70);
    const thumbJoin = sm((-z - 38) / 16) * (1 - 0.55 * wristNarrow);

    const xLeft = -24.6 - 7.8 * thumbJoin - 2.6 * forearmWide;
    const xRight = lerp(34.6, 26.8, wristNarrow) + 2.8 * forearmWide;

    const cx = (xLeft + xRight) * 0.5;
    const rx = Math.max(0.05, (xRight - xLeft) * 0.5 * cap);

    const cy = lerp(7.3, 6.8, sm((-z - 48) / 90));
    const dorsalArch = 1.35 * sm((-z - 46) / 22) * (1 - 0.35 * wristNarrow);
    const hTop = (5.25 + dorsalArch + 0.7 * forearmWide) * cap;
    const hBot = (6.2 + 0.9 * gs(z, -65, 25) + 1.0 * forearmWide) * cap;

    for (let it = 0; it <= NT; it++) {
      const th = (it / NT) * TAU - Math.PI / 2;
      const c = Math.cos(th), sn = Math.sin(th);
      const o = iz * (NT + 1) + it;
      const lx = rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.35);
      const ly = sn >= 0
        ? cy + hTop * Math.pow(sn, 2 / 2.35)
        : cy - hBot * Math.pow(-sn, 2 / 2.15);

      pos[o * 3] = cx + lx;
      pos[o * 3 + 1] = ly;
      pos[o * 3 + 2] = z;
      uv[o * 2] = it / NT;
      uv[o * 2 + 1] = clamp(0.05 + kz * 0.35, 0.02, 0.98);
    }
  }

  for (let iz = 0; iz < NZ; iz++) {
    for (let it = 0; it < NT; it++) {
      const a = iz * (NT + 1) + it, b = a + 1, c = a + NT + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();

  const nr = g.attributes.normal.array;
  for (let it = 0; it <= NT; it++) {
    const o0 = it * 3;
    nr[o0] = 0; nr[o0 + 1] = 0.12; nr[o0 + 2] = 0.992;
  }
  for (let iz = 1; iz <= NZ; iz++) {
    const a = (iz * (NT + 1)) * 3;
    const b = (iz * (NT + 1) + NT) * 3;
    for (let k = 0; k < 3; k++) {
      const avg = (nr[a + k] + nr[b + k]) * 0.5;
      nr[a + k] = nr[b + k] = avg;
    }
  }
  g.attributes.normal.needsUpdate = true;
  return g;
}

{
  const handBody = new THREE.Mesh(buildHandBodyGeo(), skinM);
  handBody.castShadow = handBody.receiveShadow = true;
  HAND_RIG.add(handBody);
}

// 손톱 둘레 고대비 3D 가이드 링 생성
function buildGuideRingGroup() {
  const G = new THREE.Group();
  const INSET = 0.20;
  const hw0 = NL.hw0 - INSET, hw1 = NL.hw1 - INSET;
  const rootD = NL.rootD - INSET, tipD = NL.tipD - INSET;

  const rawPts = [];
  for (let i = 0; i < 64; i++) {
    const a = Math.PI * (i / 64);
    rawPts.push([hw0 * Math.cos(a), NL.rootD - rootD * Math.sin(a)]);
  }
  for (let i = 0; i < 48; i++) {
    const k = i / 48;
    rawPts.push([-lerp(hw0, hw1, k), lerp(NL.rootD, NL.sideS, k)]);
  }
  for (let i = 0; i < 64; i++) {
    const a = Math.PI * (i / 64);
    rawPts.push([-hw1 * Math.cos(a), NL.sideS + tipD * Math.sin(a)]);
  }
  for (let i = 0; i < 48; i++) {
    const k = i / 48;
    rawPts.push([lerp(hw1, hw0, k), lerp(NL.sideS, NL.rootD, k)]);
  }

  const cum = [0];
  for (let i = 1; i <= rawPts.length; i++) {
    const p0 = rawPts[i - 1], p1 = rawPts[i % rawPts.length];
    cum.push(cum[i - 1] + Math.hypot(p1[0] - p0[0], p1[1] - p0[1]));
  }
  const totalLen = cum[cum.length - 1];
  const M = 288;
  const pts = [];
  let seg = 0;
  for (let i = 0; i < M; i++) {
    const target = (i / M) * totalLen;
    while (seg < rawPts.length - 1 && cum[seg + 1] < target) seg++;
    const p0 = rawPts[seg], p1 = rawPts[(seg + 1) % rawPts.length];
    const span = Math.max(1e-5, cum[seg + 1] - cum[seg]);
    const u = (target - cum[seg]) / span;
    pts.push([lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)]);
  }

  function makeRibbonGeo(halfWidth, yLift, dashed) {
    const rPos = [], rIdx = [];
    let vCount = 0;
    const DASHES = 36;
    const perDash = M / DASHES;

    for (let i = 0; i < M; i++) {
      if (dashed && (i % perDash) >= perDash * 0.56) continue;
      const iNext = (i + 1) % M;
      const p0 = pts[i], p1 = pts[iNext];
      const pPrev = pts[(i - 1 + M) % M], pAfter = pts[(i + 2) % M];

      const t0x = p1[0] - pPrev[0], t0s = p1[1] - pPrev[1];
      const l0 = Math.max(1e-5, Math.hypot(t0x, t0s));
      const n0x = -t0s / l0, n0s = t0x / l0;

      const t1x = pAfter[0] - p0[0], t1s = pAfter[1] - p0[1];
      const l1 = Math.max(1e-5, Math.hypot(t1x, t1s));
      const n1x = -t1s / l1, n1s = t1x / l1;

      const ax0 = p0[0] - n0x * halfWidth, as0 = p0[1] - n0s * halfWidth;
      const bx0 = p0[0] + n0x * halfWidth, bs0 = p0[1] + n0s * halfWidth;
      const ax1 = p1[0] - n1x * halfWidth, as1 = p1[1] - n1s * halfWidth;
      const bx1 = p1[0] + n1x * halfWidth, bs1 = p1[1] + n1s * halfWidth;

      rPos.push(
        ax0, nailTop(ax0, as0) + yLift, as0,
        bx0, nailTop(bx0, bs0) + yLift, bs0,
        ax1, nailTop(ax1, as1) + yLift, as1,
        bx1, nailTop(bx1, bs1) + yLift, bs1
      );
      rIdx.push(vCount, vCount + 2, vCount + 1, vCount + 1, vCount + 2, vCount + 3);
      vCount += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
    g.setIndex(rIdx);
    return g;
  }

  const bgMat = new THREE.MeshBasicMaterial({
    color: '#1b1326', transparent: true, opacity: 0.72,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const bgMesh = new THREE.Mesh(makeRibbonGeo(0.20, 0.076, false), bgMat);
  bgMesh.renderOrder = 7;

  const fgMat = new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0.96,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const fgMesh = new THREE.Mesh(makeRibbonGeo(0.125, 0.088, true), fgMat);
  fgMesh.renderOrder = 8;

  G.add(bgMesh, fgMesh);
  G.userData = { bgMat, fgMat };
  return G;
}

// ─── 네일아트 도안 3D 밑그림 가이드 메쉬 생성 (베이스 매니큐어 위에 선명히 표시) ───
function buildArtGuideGroup(pat) {
  const G = new THREE.Group();
  if (!pat) return G;

  const bgPos = [], bgIdx = [];
  const fgPos = [], fgIdx = [];
  let bgV = 0, fgV = 0;

  function addPolylineRibbon(poly, halfWBg, halfWFg) {
    // 0.22mm 단위로 촘촘히 세분화하여 곡면을 정확히 따라가며 일정한 점선 생성
    const resampled = [poly[0]];
    let accum = 0;
    for (let i = 0; i < poly.length - 1; i++) {
      const [x0, s0] = poly[i], [x1, s1] = poly[i + 1];
      const d = Math.hypot(x1 - x0, s1 - s0);
      const steps = Math.max(1, Math.ceil(d / 0.22));
      for (let k = 1; k <= steps; k++) {
        resampled.push([lerp(x0, x1, k / steps), lerp(s0, s1, k / steps)]);
      }
    }
    for (let i = 0; i < resampled.length - 1; i++) {
      const p0 = resampled[i], p1 = resampled[i + 1];
      const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (segLen < 1e-5) continue;
      const nx = -(p1[1] - p0[1]) / segLen, ns = (p1[0] - p0[0]) / segLen;

      // 바탕 다크 가이드 띠
      {
        const ax0 = p0[0] - nx * halfWBg, as0 = p0[1] - ns * halfWBg;
        const bx0 = p0[0] + nx * halfWBg, bs0 = p0[1] + ns * halfWBg;
        const ax1 = p1[0] - nx * halfWBg, as1 = p1[1] - ns * halfWBg;
        const bx1 = p1[0] + nx * halfWBg, bs1 = p1[1] + ns * halfWBg;
        bgPos.push(
          ax0, nailTop(ax0, as0) + 0.095, as0,
          bx0, nailTop(bx0, bs0) + 0.095, bs0,
          ax1, nailTop(ax1, as1) + 0.095, as1,
          bx1, nailTop(bx1, bs1) + 0.095, bs1
        );
        bgIdx.push(bgV, bgV + 2, bgV + 1, bgV + 1, bgV + 2, bgV + 3);
        bgV += 4;
      }

      // 고대비 밝은 점선 띠
      if (Math.floor(accum / 0.42) % 2 === 0) {
        const ax0 = p0[0] - nx * halfWFg, as0 = p0[1] - ns * halfWFg;
        const bx0 = p0[0] + nx * halfWFg, bs0 = p0[1] + ns * halfWFg;
        const ax1 = p1[0] - nx * halfWFg, as1 = p1[1] - ns * halfWFg;
        const bx1 = p1[0] + nx * halfWFg, bs1 = p1[1] + ns * halfWFg;
        fgPos.push(
          ax0, nailTop(ax0, as0) + 0.108, as0,
          bx0, nailTop(bx0, bs0) + 0.108, bs0,
          ax1, nailTop(ax1, as1) + 0.108, as1,
          bx1, nailTop(bx1, bs1) + 0.108, bs1
        );
        fgIdx.push(fgV, fgV + 2, fgV + 1, fgV + 1, fgV + 2, fgV + 3);
        fgV += 4;
      }
      accum += segLen;
    }
  }

  for (const st of pat.strokes) {
    addPolylineRibbon(st, 0.24, 0.13);
  }
  for (const [cx, cs, r] of pat.dots) {
    addPolylineRibbon(makeArcStroke(cx, cs, r * 0.78, r * 0.78, 0, TAU, 24), 0.22, 0.12);
  }

  if (bgPos.length > 0) {
    const bgG = new THREE.BufferGeometry();
    bgG.setAttribute('position', new THREE.Float32BufferAttribute(bgPos, 3));
    bgG.setIndex(bgIdx);
    const bgM = new THREE.MeshBasicMaterial({
      color: '#140c24', transparent: true, opacity: 0.76,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const m1 = new THREE.Mesh(bgG, bgM);
    m1.renderOrder = 9;
    G.add(m1);
  }
  if (fgPos.length > 0) {
    const fgG = new THREE.BufferGeometry();
    fgG.setAttribute('position', new THREE.Float32BufferAttribute(fgPos, 3));
    fgG.setIndex(fgIdx);
    const fgM = new THREE.MeshBasicMaterial({
      color: '#fde047', transparent: true, opacity: 0.96,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const m2 = new THREE.Mesh(fgG, fgM);
    m2.renderOrder = 10;
    G.add(m2);
    G.userData.fgMat = fgM;
  }
  return G;
}

let currentPalette = PALETTE[0];
let currentDiff = DIFFICULTIES.mid;

const FINGERS = FINGER_SPECS.map((spec, idx) => {
  const group = makeFingerMesh();
  group.position.set(spec.x, spec.y, spec.z);
  group.rotation.set(0, spec.ry, spec.rz);
  group.scale.set(spec.sx, spec.sy, spec.sz);
  const coat = new NailCoat(currentPalette);
  const guide = buildGuideRingGroup();
  guide.visible = false;
  const artGuideHolder = new THREE.Group();
  artGuideHolder.visible = false;
  group.add(coat.mesh, guide, artGuideHolder);
  HAND_RIG.add(group);
  return { idx, spec, group, coat, guide, artGuideHolder, pattern: null };
});

function rebuildFingerArtPatterns(diffObj) {
  FINGERS.forEach((f, idx) => {
    while (f.artGuideHolder.children.length > 0) {
      f.artGuideHolder.remove(f.artGuideHolder.children[0]);
    }
    if (!diffObj.hasArt) {
      f.pattern = null;
      f.coat.setArtPattern(null);
      f.artGuideHolder.visible = false;
    } else {
      const list = ART_PATTERNS[diffObj.id] || ART_PATTERNS.mid;
      const pat = list[idx];
      f.pattern = pat;
      f.coat.setArtPattern(pat);
      f.artGuideHolder.add(buildArtGuideGroup(pat));
      f.artGuideHolder.visible = false;
    }
  });
}
rebuildFingerArtPatterns(currentDiff);

// 매니큐어 유리병 진열
function createPolishBottle(liquidHex, withCapClosed = false) {
  const G = new THREE.Group();
  const L2 = pts => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 48);
  const glassM = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.05, metalness: 0,
    transparent: true, opacity: 0.28,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.8, depthWrite: false,
  });
  const liqM = new THREE.MeshPhysicalMaterial({
    color: liquidHex, roughness: 0.22, clearcoat: 0.85, clearcoatRoughness: 0.08, envMapIntensity: 1.15,
  });
  const body = [[0, 0], [8.2, 0], [9.2, 0.8], [9.6, 3], [9.6, 13], [9.0, 16], [6.6, 18.6], [4.4, 19.6], [4.0, 20.4], [4.0, 25.6], [3.3, 25.8], [3.3, 20.4]];
  const inner = [[0, 1.4], [7.6, 1.4], [8.5, 2.6], [8.6, 12.8], [8.0, 15.4], [5.6, 17.4], [0, 17.4]];
  const b = new THREE.Mesh(L2(body), glassM);
  const l = new THREE.Mesh(L2(inner), liqM);
  b.renderOrder = 2;
  b.castShadow = l.castShadow = true;
  G.add(l, b);

  if (withCapClosed) {
    const capClosedM = new THREE.MeshPhysicalMaterial({ color: '#18181f', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
    const capPts = [[0.001, 20.2], [4.3, 20.2], [4.4, 42], [3.8, 44], [0.001, 44.2]];
    const cap = new THREE.Mesh(L2(capPts), capClosedM);
    cap.castShadow = true;
    G.add(cap);
  } else {
    const thM = new THREE.MeshStandardMaterial({ color: '#e9eef2', roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.55 });
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.22, 8, 36), thM);
      r.rotation.x = Math.PI / 2;
      r.position.y = 21.6 + i * 1.3;
      G.add(r);
    }
  }
  G.userData = { liqM };
  return G;
}

const MAIN_BOTTLE = createPolishBottle(currentPalette.bottle, false);
MAIN_BOTTLE.position.set(-56, DESK_Y, 18);
MAIN_BOTTLE.scale.setScalar(0.82);
S.add(MAIN_BOTTLE);

const DECO_BOTTLES = new THREE.Group();
PALETTE.forEach((pal, i) => {
  const b = createPolishBottle(pal.bottle, true);
  b.position.set(-54 + i * 21.5, DESK_Y, -112 + Math.abs(i - 2.5) * 4);
  b.scale.setScalar(0.76);
  DECO_BOTTLES.add(b);
});
S.add(DECO_BOTTLES);

// ─── 매니큐어 부채꼴 붓 & 네일아트 세필 라이너 붓 ───
const BRUSH_ROOT = new THREE.Group();
S.add(BRUSH_ROOT);

const LB = 8.6;
const TOOL = new THREE.Group();
BRUSH_ROOT.add(TOOL);

const capM = new THREE.MeshPhysicalMaterial({ color: '#16161b', roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 });
const stemM = new THREE.MeshPhysicalMaterial({ color: '#202026', roughness: 0.35, clearcoat: 0.5 });
{
  const L2 = pts => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 40);
  const stem = new THREE.Mesh(L2([[0.001, -0.3], [0.62, -0.3], [0.66, 0.4], [0.56, 1.2], [0.6, 14.6], [1.9, 16.2], [0.001, 16.2]]), stemM);
  const cap = new THREE.Mesh(L2([[0.001, 16], [2.3, 16], [3.3, 16.5], [3.6, 18], [3.65, 21], [3.4, 50], [3.1, 52.4], [2.2, 53.4], [0.001, 53.6]]), capM);
  stem.castShadow = cap.castShadow = true;
  TOOL.add(stem, cap);
}

const NK = 26, MB = 16;
const bristleGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array((NK + 1) * MB * 3);
  const colr = new Float32Array((NK + 1) * MB * 3);
  const idx = [];
  for (let i = 0; i < NK; i++) {
    for (let j = 0; j < MB; j++) {
      const a = i * MB + j, b = i * MB + (j + 1) % MB, c = a + MB, d = b + MB;
      idx.push(a, b, c, b, d, c);
    }
  }
  bristleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  bristleGeo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  bristleGeo.setIndex(idx);
}

function updateBristleColors(tipHex, isArtBrush = false) {
  const colr = bristleGeo.attributes.color.array;
  const c0 = new THREE.Color(isArtBrush ? '#7c6248' : '#1c1214');
  const c1 = new THREE.Color(tipHex);
  for (let i = 0; i <= NK; i++) {
    const k = i / NK;
    const c = c0.clone().lerp(c1, sm((k - (isArtBrush ? 0.35 : 0.04)) / 0.25));
    for (let j = 0; j < MB; j++) {
      const o = (i * MB + j) * 3;
      const st = 0.86 + 0.14 * Math.sin(j * 2.9 + 1);
      colr[o] = c.r * st;
      colr[o + 1] = c.g * st;
      colr[o + 2] = c.b * st;
    }
  }
  bristleGeo.attributes.color.needsUpdate = true;
}
updateBristleColors(currentPalette.hex, false);

const bristleM = new THREE.MeshPhysicalMaterial({
  vertexColors: true, roughness: 0.22, metalness: 0,
  clearcoat: 0.78, clearcoatRoughness: 0.10, envMapIntensity: 1.15, side: THREE.DoubleSide,
});
const bristleMesh = new THREE.Mesh(bristleGeo, bristleM);
bristleMesh.castShadow = true;
bristleMesh.frustumCulled = false;
BRUSH_ROOT.add(bristleMesh);

const blobM = new THREE.MeshPhysicalMaterial({ color: currentPalette.hex, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.35 });
const blobMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), blobM);
blobMesh.castShadow = true;
BRUSH_ROOT.add(blobMesh);

{
  const GF = buildFingerGeo({ L: 46, bD: 0.22, bP: 0.35, n1: 42, n2c: 90, nt: 110 });
  const GN = buildNailGeo(32, 54);
  for (const [ang, sc, tilt, tw] of [[215, 1.0, 0.32, 0.55], [-40, 0.95, 0.34, -0.1]]) {
    const f = makeFingerMesh(GF, GN);
    const a = ang * DEG;
    const n = V(Math.cos(a), 0, Math.sin(a));
    const d = V(0, -1, 0).multiplyScalar(Math.cos(tilt)).addScaledVector(n, -Math.sin(tilt)).normalize();
    const Yf = n.clone().addScaledVector(d, -n.dot(d)).normalize();
    const Xf = Yf.clone().cross(d);
    if (tw) { Xf.applyAxisAngle(d, tw); Yf.applyAxisAngle(d, tw); }
    f.matrixAutoUpdate = false;
    const o = n.clone().multiplyScalar(3.5).add(V(0, 44, 0)).addScaledVector(Yf, -0.25 * sc).addScaledVector(d, -10 * sc);
    f.matrix.makeBasis(Xf, Yf, d).scale(V(sc, sc, sc)).setPosition(o);
    TOOL.add(f);
  }
}

function setBrushAppearance(isArtMode) {
  if (isArtMode) {
    // 은장 메탈 페룰 + 파스텔 화이트 핸들 세필 라이너 브러시 외형!
    stemM.color.set('#d8dde6');
    stemM.metalness = 0.78;
    stemM.roughness = 0.18;
    capM.color.set('#f5d0fe');
    blobM.color.set(currentPalette.artHex);
    updateBristleColors(currentPalette.artHex, true);
  } else {
    // 클래식 유광 블랙 매니큐어 브러시 외형!
    stemM.color.set('#202026');
    stemM.metalness = 0.0;
    stemM.roughness = 0.35;
    capM.color.set('#16161b');
    blobM.color.set(currentPalette.hex);
    updateBristleColors(currentPalette.hex, false);
  }
}

const _EX = V(1, 0, 0), _X = V(), _Y = V(), _Z = V(), _M4 = new THREE.Matrix4();
function orientGroup(G, org, axis) {
  _Y.copy(axis).normalize();
  _X.copy(_EX).addScaledVector(_Y, -_EX.dot(_Y)).normalize();
  _Z.crossVectors(_X, _Y);
  _M4.makeBasis(_X, _Y, _Z);
  G.quaternion.setFromRotationMatrix(_M4);
  G.position.copy(org);
}

const _P0 = V(), _E = V(), _F = V(), _F2 = V(), _Cc = V(), _C2 = V();
const _bk = V(), _Wv = V(), _T = V(), _Wd = V(), _Nn = V(), _q = V(), _q2 = V();
const BRUSH_AXIS = V(0.14, 0.48, 0.865).normalize();

function setBrushLocal(st) {
  const c = 1 - sm(st.lift / 1.4);
  const isArt = !!st.isArt;
  const press = c * clamp(st.a / 2.5, 0, 1);
  const A = st.A || BRUSH_AXIS;
  const av = isArt ? 0.38 : Math.max(0.55, st.a - 0.25);

  _P0.set(st.x, surfTop(st.x, st.s), st.s);
  _bk.set(Math.sin(st.psi), 0, -Math.cos(st.psi));
  _Wv.set(Math.cos(st.psi), 0, Math.sin(st.psi));

  _E.copy(_P0).addScaledVector(_bk, Math.max(0.06, st.b - 0.35) * c);
  _E.y = surfTop(_E.x, _E.z) + st.lift + 0.11;

  _F.copy(_E).addScaledVector(A, LB);
  _F2.copy(_P0).addScaledVector(_bk, -st.b * 0.45).addScaledVector(A, LB - (isArt ? 0.8 : 1.5 + 1.45 * press));
  _F2.y += 0.3;
  _F.lerp(_F2, c);

  _Cc.copy(_F).addScaledVector(A, -LB * 0.5);
  _C2.copy(_P0).addScaledVector(_bk, -st.b * 0.65).addScaledVector(A, 1.1 - 0.4 * press);
  _C2.y += 0.25;
  _Cc.lerp(_C2, c);

  orientGroup(TOOL, _F, A);

  const pos = bristleGeo.attributes.position.array;
  const onSurface = st.onSurface !== false;
  const rootW = isArt ? 0.38 : 0.66;
  const rootTh = isArt ? 0.36 : 0.50;

  for (let i = 0; i <= NK; i++) {
    const k = i / NK, k1 = 1 - k;
    _q.copy(_F).multiplyScalar(k1 * k1).addScaledVector(_Cc, 2 * k * k1).addScaledVector(_E, k * k);
    _T.copy(_Cc).sub(_F).multiplyScalar(2 * k1).addScaledVector(_q2.copy(_E).sub(_Cc), 2 * k).normalize();
    _Wd.copy(_Wv).addScaledVector(_T, -_Wv.dot(_T)).normalize();
    _Nn.crossVectors(_T, _Wd);

    let w = isArt
      ? lerp(rootW, 0.16, Math.pow(k, 0.9))
      : lerp(rootW, lerp(0.5, av, c), Math.pow(k, lerp(1.4, 0.7, c)));
    let th = isArt
      ? lerp(rootTh, 0.15, Math.pow(k, 0.9))
      : lerp(rootTh, lerp(0.2, 0.13, c), Math.pow(k, 0.8));

    if (k > 0.9) {
      const e = Math.sqrt(Math.max(0.02, 1 - Math.pow((k - 0.9) / 0.1, 2) * (c > 0.5 ? 0.55 : 0.95)));
      w *= e;
      th *= e;
    }
    for (let j = 0; j < MB; j++) {
      const a = j / MB * TAU, o = (i * MB + j) * 3;
      const cx = Math.cos(a), sy = Math.sin(a);
      let px = _q.x + _Wd.x * cx * w + _Nn.x * sy * th;
      let py = _q.y + _Wd.y * cx * w + _Nn.y * sy * th;
      let pz = _q.z + _Wd.z * cx * w + _Nn.z * sy * th;
      if (onSurface && k > 0.25) {
        const ys = surfTop(px, pz) + 0.03;
        if (py < ys) py = ys + (_Nn.y * sy > 0 ? th * 0.9 : 0);
      }
      pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz;
    }
  }
  bristleGeo.attributes.position.needsUpdate = true;
  bristleGeo.computeVertexNormals();

  const br = (isArt ? 0.42 : lerp(0.76, 0.18, c)) * (st.drop == null ? 0.85 : st.drop);
  blobMesh.position.copy(_E).addScaledVector(A, 0.08);
  blobMesh.position.y -= 0.08 * (1 - c);
  blobMesh.scale.set(br, br * 1.15, br);
  blobMesh.visible = c < 0.45 && st.visible !== false;
  return _E;
}

// ─── 팔레트 & 난이도 선택 동기화 ───
function selectPalette(pal) {
  currentPalette = pal;
  MAIN_BOTTLE.userData.liqM.color.set(pal.bottle);
  FINGERS.forEach(f => f.coat.setColor(pal));
  setBrushAppearance(STATE.subStep === 'art');

  const nameEl = $('selected-color-name');
  if (nameEl) {
    nameEl.textContent = pal.name;
    nameEl.style.color = pal.hex === '#eab308' ? '#fde047' : pal.hex === '#14b8a6' ? '#5eead4' : '#fda4af';
  }
  document.querySelectorAll('.swatch-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.id === pal.id);
  });
}

function selectDifficulty(diffId) {
  const d = DIFFICULTIES[diffId] || DIFFICULTIES.mid;
  currentDiff = d;
  rebuildFingerArtPatterns(d);
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.diff === d.id);
  });
  $('selected-diff-badge').textContent = d.badge;
  $('diff-desc').textContent = d.desc;
}

// ─── 게임 상태 관리 ───
const STATE = {
  phase: 'menu', // 'menu' | 'intro' | 'play' | 'showcase'
  introTime: 0,
  elapsedSec: 0,
  fingerIdx: 0,
  subStep: 'base', // 'base' (베이스 풀코트) | 'art' (네일아트 도안 그리기)
  painting: false,
  paintPointerId: null,
  rawX: 0,
  rawS: 6.5,
  curX: 0,
  curS: 6.5,
  prevStampX: null,
  prevStampS: null,
  psi: 0,
  lift: 2.2,
  targetLift: 2.2,
  risk: 12,
  breath: 100,
  breathHoldBtn: false,
  breathToggleOn: false,
  breathKeyDown: false,
  breathDownAt: 0,
  exhaustTimer: 0,
  strokeSfxCooldown: 0,
  smearFlash: 0,
  perfectShown: [false, false, false, false, false],
  artPerfectShown: [false, false, false, false, false],
  showcaseTiltX: 0,
  showcaseTiltZ: 0,
  targetTiltX: 0,
  targetTiltZ: 0,
  showcaseDragging: false,
  lastClientX: 0,
  lastClientY: 0,
  incomingRef: null,
  lastShareData: null,
  lastFinalRun: null,
  popTexts: [],
};

const camCurPos = V(0, 165, 86);
const camCurLook = V(0, 8, 5);
const camGoalPos = V(0, 165, 86);
const camGoalLook = V(0, 8, 5);

function updateCameraGoalForFinger(idx, instant = false) {
  const f = FINGERS[idx];
  const worldCenter = V(0, 8.5, 6.6);
  HAND_RIG.updateMatrixWorld(true);
  f.group.localToWorld(worldCenter);

  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const dist = aspect < 0.72 ? 154 : 140;
  const el = 66 * DEG;

  camGoalLook.set(worldCenter.x, worldCenter.y + 0.5, worldCenter.z + 0.8);
  camGoalPos.set(
    worldCenter.x - f.spec.ry * 16,
    worldCenter.y + dist * Math.sin(el),
    worldCenter.z + dist * Math.cos(el)
  );
  if (instant) {
    camCurLook.copy(camGoalLook);
    camCurPos.copy(camGoalPos);
  }
}

function isBreathActive() {
  if (STATE.exhaustTimer > 0 || STATE.breath <= 0) return false;
  return STATE.breathHoldBtn || STATE.breathToggleOn || STATE.breathKeyDown;
}

function addPopText(text, color = '#ffd84a') {
  STATE.popTexts.push({ text, color, age: 0, dur: 1.25 });
}

// ─── 레이캐스트 ───
const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _invMat = new THREE.Matrix4();
const _localRay = new THREE.Ray();

function screenToFingerLocal(clientX, clientY, pointerType) {
  const rect = glCanvas.getBoundingClientRect();
  const yOff = pointerType === 'touch' ? -18 : 0;
  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -(((clientY + yOff) - rect.top) / rect.height) * 2 + 1;

  _raycaster.setFromCamera(_ndc, CAM);
  const fg = FINGERS[STATE.fingerIdx].group;
  fg.updateMatrixWorld(true);
  _invMat.copy(fg.matrixWorld).invert();
  _localRay.copy(_raycaster.ray).applyMatrix4(_invMat);

  const dy = _localRay.direction.y;
  if (Math.abs(dy) < 1e-4) return null;

  const t1 = (10.5 - _localRay.origin.y) / dy;
  const x1 = _localRay.origin.x + _localRay.direction.x * t1;
  const s1 = _localRay.origin.z + _localRay.direction.z * t1;

  const ySurf = surfTop(clamp(x1, -8.5, 8.5), clamp(s1, -2.0, 14.5));
  const t2 = (ySurf - _localRay.origin.y) / dy;
  const x2 = clamp(_localRay.origin.x + _localRay.direction.x * t2, -8.0, 8.0);
  const s2 = clamp(_localRay.origin.z + _localRay.direction.z * t2, -1.0, 14.0);
  return { x: x2, s: s2 };
}

function syncBgmBtn() {
  const b = $('btn-bgm');
  if (!b) return;
  const muted = BGM.isMuted();
  b.textContent = muted ? '🔇 음소거' : '🔊 BGM';
  b.classList.toggle('bgm-off', muted);
}

function isFingerClean(f) {
  if (f.coat.smearPx > 0 || f.coat.coverPct() < 85) return false;
  if (currentDiff.hasArt) {
    const outRatio = f.coat.artOutsidePx / Math.max(1, f.coat.artTargetTotal);
    if (f.coat.artCoverPct() < 75 || outRatio > 0.35) return false;
  }
  return true;
}

function updatePlayHUD() {
  const cur = FINGERS[STATE.fingerIdx];
  const isArtStep = STATE.subStep === 'art' && currentDiff.hasArt;
  const pctRaw = isArtStep ? Math.min(100, cur.coat.artCoverPct()) : Math.min(100, cur.coat.coverPct());
  const pctDisp = pctRaw >= (isArtStep ? 96.5 : 99.4) ? 100 : Math.floor(pctRaw);

  $('hud-cover-label').textContent = isArtStep ? '🎨 아트' : '베이스';
  $('hud-cover').textContent = `${pctDisp}%`;
  $('hud-cover').style.color = pctDisp >= 92 ? '#4ade80' : isArtStep ? '#fde047' : '#ffffff';

  if (!currentDiff.hasArt) {
    $('hud-step-title').textContent = '옆 살 위험도';
  } else if (isArtStep) {
    $('hud-step-title').textContent = `🎨 ${cur.pattern ? cur.pattern.name : '아트'}`;
  } else {
    $('hud-step-title').textContent = '① 베이스 컬러';
  }

  let cleanCnt = 0;
  FINGERS.forEach((f, i) => {
    const chip = $(`fchip-${i}`);
    if (!chip) return;
    chip.className = 'finger-chip';
    if (i < STATE.fingerIdx) {
      if (isFingerClean(f)) {
        chip.classList.add('clean');
        cleanCnt++;
      } else {
        chip.classList.add('smudged');
      }
    } else if (i === STATE.fingerIdx) {
      chip.classList.add('active');
      if ((!currentDiff.hasArt || isArtStep) && isFingerClean(f)) cleanCnt++;
    }
  });
  $('hud-clean').textContent = `${cleanCnt}/5`;

  // 위험도 막대 & 상태 태그
  const riskFill = $('risk-fill');
  const riskTag = $('risk-tag');
  riskFill.style.width = `${clamp(Math.round(STATE.risk), 8, 100)}%`;

  if (STATE.smearFlash > 0) {
    riskFill.style.background = '#ef4444';
    riskTag.textContent = isArtStep ? '삐끗! 도안 밖으로 번졌어요!' : '삐끗! 옆 살에 묻었어요!';
    riskTag.style.background = 'rgba(239,68,68,0.28)';
    riskTag.style.color = '#fca5a5';
  } else if (STATE.exhaustTimer > 0) {
    riskFill.style.background = '#ef4444';
    riskTag.textContent = '푸하헉! 숨이 차서 손이 떨려요!';
    riskTag.style.background = 'rgba(239,68,68,0.25)';
    riskTag.style.color = '#fecaca';
  } else if (isBreathActive()) {
    riskFill.style.background = '#38bdf8';
    riskTag.textContent = '😤 숨 참는 중 · 수전증 0mm 정밀!';
    riskTag.style.background = 'rgba(56,189,248,0.24)';
    riskTag.style.color = '#bae6fd';
  } else if (STATE.risk >= 74) {
    riskFill.style.background = '#ef4444';
    riskTag.textContent = isArtStep ? '도안 밖 주의 · [숨 참기] 추천!' : '위험! 옆 살 코앞 · [숨 참기]!';
    riskTag.style.background = 'rgba(239,68,68,0.24)';
    riskTag.style.color = '#fca5a5';
  } else if (isArtStep) {
    riskFill.style.background = '#c084fc';
    riskTag.textContent = pctDisp >= 92 ? '아트 완성! 다음으로 이동 ✨' : '노란 점선 도안을 따라 그려요';
    riskTag.style.background = 'rgba(192,132,252,0.22)';
    riskTag.style.color = '#e9d5ff';
  } else {
    riskFill.style.background = '#4ade80';
    riskTag.textContent = pctDisp >= 95 ? '베이스 완료! ✨' : '점선 안쪽을 문질러 채워요';
    riskTag.style.background = 'rgba(74,222,128,0.18)';
    riskTag.style.color = '#86efac';
  }

  // 숨 게이지 & 버튼
  const bPct = Math.round(STATE.breath);
  $('breath-pct').textContent = `${bPct}%`;
  const bFill = $('breath-fill');
  bFill.style.width = `${bPct}%`;
  bFill.style.background = STATE.exhaustTimer > 0 || bPct < 25
    ? 'linear-gradient(90deg, #ef4444, #f97316)'
    : 'linear-gradient(90deg, #38bdf8, #818cf8)';

  const bBtn = $('btn-breath');
  const bAct = isBreathActive();
  bBtn.classList.toggle('active', bAct);
  bBtn.classList.toggle('exhausted', STATE.exhaustTimer > 0);
  $('btn-breath-label').textContent = STATE.exhaustTimer > 0
    ? '😮‍💨 숨 고르는 중...'
    : bAct ? '😤 숨 참는 중! (정밀)' : '😤 숨 참기';

  // 다음 단계 / 다음 손톱 버튼
  const nextBtn = $('btn-next-nail');
  const isLast = STATE.fingerIdx === FINGERS.length - 1;
  const toArtNext = currentDiff.hasArt && STATE.subStep === 'base';
  const actionWord = toArtNext
    ? `🎨 아트 그리기 →`
    : isLast ? '✨ 네일 완성하기!' : '💅 다음 손톱으로 →';

  const minAllow = toArtNext ? 55 : isArtStep ? 45 : 55;
  const goodThreshold = isArtStep ? 80 : 85;
  const perfThreshold = isArtStep ? 94 : 97.5;

  nextBtn.className = 'ctrl-btn btn-next-nail';
  if (pctRaw < minAllow) {
    nextBtn.disabled = true;
    $('btn-next-label').textContent = toArtNext
      ? `🎨 아트 단계 (${pctDisp}%)`
      : isLast ? `✨ 완성 (${pctDisp}%)` : `💅 다음 손톱 (${pctDisp}%)`;
    $('btn-next-sub').textContent = isArtStep ? '점선 도안을 따라 그려 주세요!' : '베이스를 조금 더 칠해 주세요!';
  } else if (pctRaw < goodThreshold) {
    nextBtn.disabled = false;
    nextBtn.classList.add('can-skip');
    $('btn-next-label').textContent = actionWord;
    $('btn-next-sub').textContent = `현재 ${pctDisp}% · 더 채우면 고득점!`;
  } else if (pctRaw < perfThreshold) {
    nextBtn.disabled = false;
    nextBtn.classList.add('ready');
    $('btn-next-label').textContent = actionWord;
    $('btn-next-sub').textContent = `${isArtStep ? '아트' : '베이스'} ${pctDisp}% · 훌륭해요!`;
  } else {
    nextBtn.disabled = false;
    nextBtn.classList.add('perfect');
    $('btn-next-label').textContent = actionWord;
    $('btn-next-sub').textContent = isArtStep ? '🌟 완벽한 네일아트!' : '🌟 100% 풀컬러 완료!';
  }
}

// ─── 인트로 · 플레이 · 아트 단계 전환 ───
function resetAllNails() {
  rebuildFingerArtPatterns(currentDiff);
  FINGERS.forEach(f => f.coat.reset());
  STATE.elapsedSec = 0;
  STATE.fingerIdx = 0;
  STATE.subStep = 'base';
  setBrushAppearance(false);
  STATE.painting = false;
  STATE.paintPointerId = null;
  STATE.breath = 100;
  STATE.breathHoldBtn = false;
  STATE.breathToggleOn = false;
  STATE.breathKeyDown = false;
  STATE.exhaustTimer = 0;
  STATE.smearFlash = 0;
  STATE.risk = 12;
  STATE.lift = 2.4;
  STATE.targetLift = 2.4;
  STATE.rawX = 0;
  STATE.rawS = 6.5;
  STATE.curX = 0;
  STATE.curS = 6.5;
  STATE.perfectShown = [false, false, false, false, false];
  STATE.artPerfectShown = [false, false, false, false, false];
  STATE.showcaseTiltX = 0;
  STATE.showcaseTiltZ = 0;
  STATE.targetTiltX = 0;
  STATE.targetTiltZ = 0;
  HAND_RIG.rotation.set(0, 0, 0);
  HAND_RIG.position.set(0, 0, 0);
  $('hud-timer').textContent = '⏱ 0.0초';
}

function startIntro() {
  unlockAudio();
  BGM.start('nail');
  syncBgmBtn();

  resetAllNails();
  $('start-modal').classList.add('hidden');
  $('result-modal').classList.add('hidden');
  $('nail-hud').classList.add('hidden');
  $('nail-dock').classList.add('hidden');
  $('showcase-tip').classList.add('hidden');
  $('hud-timer').style.display = 'none';
  $('btn-restart-quick').style.display = 'none';
  document.body.classList.remove('in-showcase');

  STATE.phase = 'intro';
  STATE.introTime = 0;
  $('btn-skip-intro').classList.remove('hidden');
  SFX.bell();
}

function beginPlayPhase() {
  STATE.phase = 'play';
  STATE.elapsedSec = 0;
  STATE.subStep = 'base';
  setBrushAppearance(false);
  HAND_RIG.visible = true;
  ARMREST.visible = true;
  DECO_BOTTLES.visible = true;
  FINGERS.forEach(f => {
    f.guide.visible = true;
    f.artGuideHolder.visible = false;
  });
  bristleMesh.position.set(0, 0, 0);
  $('btn-skip-intro').classList.add('hidden');
  $('nail-hud').classList.remove('hidden');
  $('nail-dock').classList.remove('hidden');
  $('hud-timer').style.display = 'inline-flex';
  $('btn-restart-quick').style.display = 'inline-flex';
  MAIN_BOTTLE.position.set(-56, DESK_Y, 18);
  HAND_RIG.rotation.set(0, 0, 0);
  HAND_RIG.position.set(0, 0, 0);
  updateCameraGoalForFinger(0, false);
  updatePlayHUD();
}

function advanceStepOrNail() {
  if (STATE.phase !== 'play') return;
  STATE.painting = false;
  STATE.paintPointerId = null;
  STATE.prevStampX = null;
  STATE.prevStampS = null;
  STATE.targetLift = 2.5;
  STATE.breathToggleOn = false;
  STATE.breathHoldBtn = false;

  // 중·상 난이도에서 베이스 완료 시 -> 같은 손톱 위에 세필 네일아트 단계 시작!
  if (currentDiff.hasArt && STATE.subStep === 'base') {
    STATE.subStep = 'art';
    STATE.breath = Math.min(100, STATE.breath + 35);
    STATE.exhaustTimer = 0;
    STATE.smearFlash = 0;
    STATE.psi = 0;
    setBrushAppearance(true);
    SFX.pop();
    const cur = FINGERS[STATE.fingerIdx];
    addPopText(`🎨 ${cur.pattern ? cur.pattern.name : '네일아트'} 그리기!`, '#fde047');
    updatePlayHUD();
    return;
  }

  if (STATE.fingerIdx < FINGERS.length - 1) {
    STATE.fingerIdx++;
    STATE.subStep = 'base';
    setBrushAppearance(false);
    STATE.breath = Math.min(100, STATE.breath + 45);
    STATE.exhaustTimer = 0;
    STATE.smearFlash = 0;
    STATE.rawX = 0;
    STATE.rawS = 6.5;
    STATE.curX = 0;
    STATE.curS = 6.5;
    SFX.pop();
    updateCameraGoalForFinger(STATE.fingerIdx, false);
    addPopText(`${FINGERS[STATE.fingerIdx].spec.label} 시술 시작!`, '#fda4af');
    updatePlayHUD();
  } else {
    finishAllNails();
  }
}

// ─── 5손톱 정밀도 + 타임어택 스피드 가산점 + 난이도 보너스 종합 채점 ───
function evaluateFiveNails() {
  let sumPrecision = 0;
  let cleanNails = 0;
  let totalOverMm = 0;
  const details = [];

  FINGERS.forEach(f => {
    const covRaw = Math.min(100, f.coat.coverPct());
    const covDisp = covRaw >= 99.4 ? 100 : Number(covRaw.toFixed(1));
    const fillScore = Math.min(100, (covRaw / 98.0) * 100);
    const smeared = f.coat.smearPx > 0;
    const smearAreaPct = (f.coat.smearPx / TOTAL_NAIL_PX) * 100;
    const fleshPenalty = smeared ? (8.0 + f.coat.overMm * 13.0 + smearAreaPct * 1.6) : 0;
    const basePart = clamp(fillScore - fleshPenalty, 0, 100);

    let nailScore = basePart;
    let artDisp = 100;
    let artClean = true;

    if (currentDiff.hasArt) {
      const artRaw = Math.min(100, f.coat.artCoverPct());
      artDisp = artRaw >= 96.5 ? 100 : Number(artRaw.toFixed(1));
      const artFill = Math.min(100, (artRaw / 91.5) * 100);
      const outRatio = f.coat.artOutsidePx / Math.max(1, f.coat.artTargetTotal);
      const artPen = Math.max(0, outRatio - 0.14) * 42;
      if (outRatio > 0.35 || artRaw < 75) artClean = false;
      const artPart = clamp(artFill - artPen, 0, 100);
      nailScore = basePart * 0.45 + artPart * 0.55;
    }

    const clean = !smeared && covRaw >= 88 && artClean;
    if (clean) {
      cleanNails++;
      nailScore = Math.min(100, nailScore + 2.0);
    }

    sumPrecision += nailScore;
    totalOverMm += f.coat.overMm;

    details.push({
      name: f.spec.name,
      cov: currentDiff.hasArt ? artDisp : covDisp,
      clean,
      smeared: smeared || !artClean,
      score: nailScore,
    });
  });

  const precisionScore = Number((sumPrecision / FINGERS.length).toFixed(1));
  const elapsed = Number(Math.max(1.0, STATE.elapsedSec).toFixed(1));

  // 품질 가중 타임어택 스피드 가산점 (꼼꼼하게 잘 칠하면서 빨라야 보너스 획득!)
  const qWeight = Math.pow(clamp(precisionScore / 88, 0, 1), 1.7);
  const speedRatio = 1 - clamp((elapsed - currentDiff.fastSec) / (currentDiff.slowSec - currentDiff.fastSec), 0, 1);
  const speedBonus = Number((currentDiff.maxSpeedBonus * speedRatio * qWeight).toFixed(1));

  // 상·중 난이도 아티스트 보너스
  const diffBonus = Number((currentDiff.diffBonusMax * clamp(precisionScore / 90, 0, 1)).toFixed(1));
  const totalScore = Number((precisionScore + speedBonus + diffBonus).toFixed(1));
  const overRounded = Number(totalOverMm.toFixed(2));

  let rankTitle = '🎨 아슬아슬 수습 네일리스트';
  let comment = '조금 번졌지만 발색이 예뻐요! 숨 참기로 떨림을 잡고 속도를 높여 보세요.';

  if (currentDiff.id === 'high' && precisionScore >= 91 && cleanNails >= 4) {
    rankTitle = '👑 청담동 전설의 마스터 원장님';
    comment = `${elapsed}초 만에 고난도 세필 네일아트까지 완벽하게 피워냈어요!`;
  } else if (precisionScore >= 92 && cleanNails === 5) {
    rankTitle = '💅 무결점 스피드 네일 마스터';
    comment = `다섯 손톱 모두 깔끔하게 ${elapsed}초 컷! 손님이 감탄하고 있어요!`;
  } else if (precisionScore >= 82) {
    rankTitle = '✨ 꼼꼼한 살롱 수석 실장님';
    comment = '광택과 마무리가 아주 훌륭해요! 시간을 조금만 더 단축하면 1위권!';
  } else if (precisionScore < 58 && overRounded >= 1.0) {
    rankTitle = '🩸 큐티클 추상화 예술가';
    comment = '마음이 너무 급했어요! 가장자리와 세필 도안에서는 숨 참기를 꼭 써 보세요.';
  }

  return {
    totalScore,
    precisionScore,
    speedBonus,
    diffBonus,
    totalBonus: Number((speedBonus + diffBonus).toFixed(1)),
    elapsed,
    cleanNails,
    totalOverMm: overRounded,
    rankTitle,
    comment,
    details,
  };
}

function diffLabelFromCode(code) {
  const n = Math.round(Number(code || 0));
  if (n === 3) return '상';
  if (n === 2) return '중';
  if (n === 1) return '하';
  return '';
}

function formatLadderMetric(row) {
  const sc = Number(row.score || 0).toFixed(1);
  const dTag = diffLabelFromCode(row.target_value);
  const sec = Number(row.actual_value || 0);
  const secTxt = sec > 5 ? ` · ${sec.toFixed(1)}초` : '';
  return dTag ? `[${dTag}] ${sc}점${secTxt}` : `${sc}점${secTxt}`;
}

async function finishAllNails() {
  STATE.phase = 'showcase';
  STATE.painting = false;
  BGM.setUrgent(false);

  $('nail-hud').classList.add('hidden');
  $('nail-dock').classList.add('hidden');
  $('showcase-tip').classList.remove('hidden');
  document.body.classList.add('in-showcase');

  FINGERS.forEach(f => {
    f.guide.visible = false;
    f.artGuideHolder.visible = false;
  });

  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const halfTan = Math.tan((CAM.fov * 0.5) * DEG);
  const fitWidthDist = 55 / Math.max(0.04, halfTan * aspect);
  const dist = clamp(Math.max(275, fitWidthDist), 275, 820);
  const el = 60 * DEG;
  camGoalLook.set(-0.5, 6.0, -22);
  camGoalPos.set(-0.5, 6.0 + dist * Math.sin(el), -22 + dist * Math.cos(el));

  SFX.nailShine();
  setTimeout(() => SFX.win(), 240);

  const ev = evaluateFiveNails();
  const isBest = updateBestRecord(GAME_ID, {
    score: ev.totalScore,
    errorMm: ev.totalOverMm,
    actualValue: ev.elapsed,
    targetValue: currentDiff.code,
    rankTitle: ev.rankTitle,
  }, false);

  $('res-rank').textContent = isBest ? `${ev.rankTitle} · 신기록!` : ev.rankTitle;
  $('res-headline').textContent = `총점 ${ev.totalScore.toFixed(1)}점`;
  $('res-comment').textContent = `[난이도 ${currentDiff.short}] ${ev.comment}`;
  $('res-time').textContent = `${ev.elapsed.toFixed(1)}초`;
  $('res-avg-cov').textContent = `${ev.precisionScore.toFixed(1)}점`;
  $('res-over-mm').textContent = `+${ev.totalBonus.toFixed(1)}점`;

  $('res-nails-grid').innerHTML = ev.details.map(d => `
    <div class="nail-res-box">
      <span class="nail-res-name">${d.name}</span>
      <span class="nail-res-pct">${Math.round(d.cov)}%</span>
      <span class="nail-res-tag" style="color:${d.clean ? '#4ade80' : '#fb7185'}">${d.clean ? '✨깔끔' : '💧번짐'}</span>
    </div>
  `).join('');

  $('res-nick').value = getSavedNickname();

  STATE.lastFinalRun = {
    gameId: GAME_ID,
    nickname: $('res-nick').value || '익명 네일리스트',
    targetValue: currentDiff.code,
    actualValue: ev.elapsed,
    score: ev.totalScore,
    errorMm: ev.totalOverMm,
    rankTitle: ev.rankTitle,
    seed: currentDiff.code,
    meta: {
      diff: currentDiff.id,
      color: currentPalette.id,
      precision: ev.precisionScore,
      speedBonus: ev.speedBonus,
      diffBonus: ev.diffBonus,
      cleanNails: ev.cleanNails,
    },
    evalData: ev,
  };

  setTimeout(async () => {
    if (STATE.phase !== 'showcase') return;
    $('result-modal').classList.remove('hidden');
    const saved = await saveResultAndBuildShare(STATE.lastFinalRun, STATE.incomingRef);
    STATE.lastShareData = saved;
    const lbWrap = $('res-lb-wrap');
    lbWrap.innerHTML = renderGlobalLadderHTML(saved, formatLadderMetric);
    lbWrap.style.display = 'block';
  }, 850);
}

// ─── 드래그 스탬프 처리 (베이스 풀코트 & 세필 네일아트 겸용) ───
function applyBrushStrokeAt(rawX, rawS, dt) {
  const curFinger = FINGERS[STATE.fingerIdx];
  const coat = curFinger.coat;
  const isArt = STATE.subStep === 'art' && currentDiff.hasArt;
  const pat = curFinger.pattern;

  const dNail = sdf(rawX, rawS);
  let edgeProx = clamp((dNail + 2.35) / 2.55, 0, 1);
  if (isArt && pat) {
    const dPat = signedDistToPattern(rawX, rawS, pat);
    edgeProx = Math.max(edgeProx, clamp((dPat + 0.35) / 0.85, 0, 1));
  }
  STATE.risk = lerp(12, 98, Math.pow(edgeProx, 1.25));
  BGM.setUrgent(STATE.risk >= 76 && !isBreathActive());

  const tNow = performance.now() * 0.001;
  const breathOn = isBreathActive();
  let shakeAmp = 0.02;
  if (STATE.exhaustTimer > 0) {
    shakeAmp = 0.46;
  } else if (breathOn) {
    shakeAmp = 0.004;
  } else {
    const baseJit = isArt ? 0.28 : 0.35;
    shakeAmp = lerp(0.022, baseJit * curFinger.spec.jitterMul * currentDiff.jitterScale, Math.pow(edgeProx, 1.5));
  }

  const waveX = shakeAmp * (Math.sin(tNow * 23.0) * 0.65 + Math.cos(tNow * 37.0) * 0.35);
  const waveS = shakeAmp * 0.55 * (Math.cos(tNow * 19.0) * 0.6 + Math.sin(tNow * 29.0) * 0.4);

  const bx = clamp(rawX + waveX, -8.0, 8.0);
  const bs = clamp(rawS + waveS, -0.8, 13.9);
  STATE.curX = bx;
  STATE.curS = bs;

  if (isArt && pat) {
    // ── 세필 네일아트 브러시 드로잉 (한 번 따라 그으면 도톰하고 매끈하게 도안이 채워지도록 터치 반경 보정) ──
    const artR = (pat.brushR || 0.64) * 1.24;
    const prevOut = coat.artOutsidePx;

    if (STATE.prevStampX == null) {
      STATE.prevStampX = bx;
      STATE.prevStampS = bs;
      const dAct = sdf(bx, bs);
      const hitFlesh = coat.stampArt(bx, bs, artR, dAct > -0.05);
      if (hitFlesh) triggerSmearFeedback(coat, true);
    } else {
      const dx = bx - STATE.prevStampX;
      const ds = bs - STATE.prevStampS;
      const dist = Math.hypot(dx, ds);
      const steps = Math.max(1, Math.ceil(dist / 0.11));
      let anyFlesh = false;
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const sx = lerp(STATE.prevStampX, bx, k);
        const ss = lerp(STATE.prevStampS, bs, k);
        if (coat.stampArt(sx, ss, artR, sdf(sx, ss) > -0.05)) anyFlesh = true;
      }
      STATE.prevStampX = bx;
      STATE.prevStampS = bs;

      if (anyFlesh || (coat.artOutsidePx - prevOut > 95 && STATE.smearFlash <= 0)) {
        triggerSmearFeedback(coat, !anyFlesh);
      }
      STATE.strokeSfxCooldown -= dt;
      if (dist > 0.06 && STATE.strokeSfxCooldown <= 0) {
        SFX.brushStroke(clamp(dist * 1.3, 0.2, 0.8));
        STATE.strokeSfxCooldown = 0.085;
      }
    }

    coat.upload();
    const outRatio = coat.artOutsidePx / Math.max(1, coat.artTargetTotal);
    if (!STATE.artPerfectShown[STATE.fingerIdx] && coat.artCoverPct() >= 95 && outRatio < 0.25) {
      STATE.artPerfectShown[STATE.fingerIdx] = true;
      SFX.nailShine();
      addPopText(`✨ ${pat.name} 완성!`, '#fde047');
    }
    updatePlayHUD();
    return;
  }

  // ── 베이스 풀컬러 브러시 드로잉 ──
  const brushA = breathOn ? 2.18 : lerp(2.36, 2.05, sm((dNail + 1.8) / 1.6));
  const brushB = 0.86;
  const dActual = sdf(bx, bs);
  const spill = dActual > -0.12 || (!breathOn && dActual + Math.abs(waveX) * 0.9 > -0.02);

  if (STATE.prevStampX == null) {
    STATE.prevStampX = bx;
    STATE.prevStampS = bs;
    const hitFlesh = coat.stamp(bx, bs, brushA, brushB, STATE.psi, spill);
    coat.ridge(bx, bs, brushA, brushB, STATE.psi, 0.7);
    if (hitFlesh) triggerSmearFeedback(coat, false);
  } else {
    const dx = bx - STATE.prevStampX;
    const ds = bs - STATE.prevStampS;
    const dist = Math.hypot(dx, ds);
    if (dist > 0.03) {
      const targetPsi = clamp(Math.atan2(dx, Math.max(0.15, Math.abs(ds))) * 0.32, -0.42, 0.42);
      STATE.psi = lerp(STATE.psi, targetPsi, 0.35);
    }
    const steps = Math.max(1, Math.ceil(dist / 0.14));
    let anySmear = false;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      const sx = lerp(STATE.prevStampX, bx, k);
      const ss = lerp(STATE.prevStampS, bs, k);
      const dStep = sdf(sx, ss);
      const stepSpill = dStep > -0.12 || (!breathOn && dStep + Math.abs(waveX) * 0.9 > -0.02);
      if (coat.stamp(sx, ss, brushA, brushB, STATE.psi, stepSpill)) anySmear = true;
    }
    STATE.prevStampX = bx;
    STATE.prevStampS = bs;

    if (anySmear) triggerSmearFeedback(coat, false);

    STATE.strokeSfxCooldown -= dt;
    if (dist > 0.08 && STATE.strokeSfxCooldown <= 0) {
      SFX.brushStroke(clamp(dist * 1.4, 0.2, 1.0));
      STATE.strokeSfxCooldown = 0.085;
    }
  }

  coat.upload();

  if (!STATE.perfectShown[STATE.fingerIdx] && coat.coverPct() >= 99.4 && coat.smearPx === 0) {
    STATE.perfectShown[STATE.fingerIdx] = true;
    SFX.nailShine();
    addPopText(currentDiff.hasArt ? '✨ 베이스 완벽! 아트를 올려요!' : '✨ 100% 무결점 풀컬러!', '#fde047');
  }

  updatePlayHUD();
}

function triggerSmearFeedback(coat, isArtOut) {
  coat.smearCount++;
  if (STATE.smearFlash <= 0.15) {
    SFX.smearOops();
    addPopText(isArtOut ? '💧 도안 밖으로 삐끗!' : '💧 삐끗! 옆 살에 묻음!', '#fb7185');
  }
  STATE.smearFlash = 1.05;
}

// ─── 입력 이벤트 바인딩 ───
glCanvas.addEventListener('pointerdown', e => {
  unlockAudio();
  if (STATE.phase === 'showcase') {
    STATE.showcaseDragging = true;
    STATE.lastClientX = e.clientX;
    STATE.lastClientY = e.clientY;
    return;
  }
  if (STATE.phase !== 'play') return;

  if (e.button === 2) {
    STATE.breathKeyDown = true;
    if (STATE.breath > 5 && STATE.exhaustTimer <= 0) SFX.breathHold();
    updatePlayHUD();
    return;
  }
  if (STATE.painting) return;

  const loc = screenToFingerLocal(e.clientX, e.clientY, e.pointerType);
  if (!loc) return;

  STATE.painting = true;
  STATE.paintPointerId = e.pointerId;
  try { glCanvas.setPointerCapture(e.pointerId); } catch {}
  STATE.rawX = loc.x;
  STATE.rawS = loc.s;
  STATE.prevStampX = null;
  STATE.prevStampS = null;
  STATE.targetLift = 0;
  applyBrushStrokeAt(loc.x, loc.s, 0.016);
});

glCanvas.addEventListener('pointermove', e => {
  if (STATE.phase === 'showcase') {
    if (STATE.showcaseDragging || e.pointerType === 'mouse') {
      const rect = glCanvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      STATE.targetTiltZ = clamp(-nx * 0.32, -0.35, 0.35);
      STATE.targetTiltX = clamp(ny * 0.16, -0.20, 0.20);
    }
    return;
  }
  if (STATE.phase !== 'play') return;

  if (STATE.painting && e.pointerId === STATE.paintPointerId) {
    const loc = screenToFingerLocal(e.clientX, e.clientY, e.pointerType);
    if (loc) {
      STATE.rawX = loc.x;
      STATE.rawS = loc.s;
      applyBrushStrokeAt(loc.x, loc.s, 0.016);
    }
  } else if (!STATE.painting && e.pointerType === 'mouse') {
    const loc = screenToFingerLocal(e.clientX, e.clientY, 'mouse');
    if (loc) {
      STATE.rawX = loc.x;
      STATE.rawS = loc.s;
      STATE.curX = lerp(STATE.curX, loc.x, 0.35);
      STATE.curS = lerp(STATE.curS, loc.s, 0.35);
    }
  }
});

function endPaintPointer(e) {
  if (STATE.phase === 'showcase') {
    STATE.showcaseDragging = false;
  }
  if (e && e.button === 2) {
    STATE.breathKeyDown = false;
    updatePlayHUD();
    return;
  }
  if (STATE.painting && (!e || e.pointerId === STATE.paintPointerId)) {
    const coat = FINGERS[STATE.fingerIdx].coat;
    if (STATE.prevStampX != null && STATE.subStep === 'base') {
      coat.ridge(STATE.prevStampX, STATE.prevStampS, isBreathActive() ? 1.9 : 2.1, 0.78, STATE.psi, 0.65);
      coat.upload();
    }
    STATE.painting = false;
    STATE.paintPointerId = null;
    STATE.prevStampX = null;
    STATE.prevStampS = null;
    STATE.targetLift = 1.9;
    STATE.risk = 12;
    BGM.setUrgent(false);
    updatePlayHUD();
  }
}

glCanvas.addEventListener('pointerup', endPaintPointer);
glCanvas.addEventListener('pointercancel', endPaintPointer);
glCanvas.addEventListener('contextmenu', e => e.preventDefault());

const btnBreath = $('btn-breath');
btnBreath.addEventListener('pointerdown', e => {
  e.preventDefault();
  unlockAudio();
  if (STATE.phase !== 'play' || STATE.exhaustTimer > 0) return;
  STATE.breathDownAt = performance.now();
  if (STATE.breathToggleOn) {
    STATE.breathToggleOn = false;
    STATE.breathHoldBtn = false;
  } else {
    STATE.breathHoldBtn = true;
    SFX.breathHold();
  }
  updatePlayHUD();
});

function releaseBreathBtn(e) {
  if (!STATE.breathHoldBtn) return;
  e.preventDefault();
  const heldMs = performance.now() - STATE.breathDownAt;
  STATE.breathHoldBtn = false;
  if (heldMs < 240 && STATE.exhaustTimer <= 0 && STATE.breath > 10) {
    STATE.breathToggleOn = true;
  }
  updatePlayHUD();
}
btnBreath.addEventListener('pointerup', releaseBreathBtn);
btnBreath.addEventListener('pointercancel', releaseBreathBtn);
btnBreath.addEventListener('pointerleave', releaseBreathBtn);

window.addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'Space' && STATE.phase === 'play') {
    e.preventDefault();
    if (!STATE.breathKeyDown && STATE.exhaustTimer <= 0 && STATE.breath > 5) {
      STATE.breathKeyDown = true;
      STATE.breathToggleOn = false;
      SFX.breathHold();
      updatePlayHUD();
    }
  } else if (e.code === 'Enter' && STATE.phase === 'play') {
    const nextBtn = $('btn-next-nail');
    if (nextBtn && !nextBtn.disabled) advanceStepOrNail();
  }
});

window.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    STATE.breathKeyDown = false;
    updatePlayHUD();
  }
});

$('btn-next-nail').addEventListener('click', () => advanceStepOrNail());
$('btn-skip-intro').addEventListener('click', () => beginPlayPhase());
$('btn-start').addEventListener('click', () => startIntro());
$('btn-retry').addEventListener('click', () => {
  // 재도전 시 시작 모달을 열어 난이도/색상을 바꿀 수 있게 하거나 바로 시작 가능 — 시작 모달 오픈이 난이도 전환에 가장 편리!
  $('result-modal').classList.add('hidden');
  $('showcase-tip').classList.add('hidden');
  $('hud-timer').style.display = 'none';
  $('btn-restart-quick').style.display = 'none';
  document.body.classList.remove('in-showcase');
  STATE.phase = 'menu';
  $('start-modal').classList.remove('hidden');
});
$('btn-restart-quick').addEventListener('click', () => {
  $('nail-hud').classList.add('hidden');
  $('nail-dock').classList.add('hidden');
  $('result-modal').classList.add('hidden');
  $('showcase-tip').classList.add('hidden');
  $('hud-timer').style.display = 'none';
  $('btn-restart-quick').style.display = 'none';
  document.body.classList.remove('in-showcase');
  STATE.phase = 'menu';
  $('start-modal').classList.remove('hidden');
});

$('btn-bgm').addEventListener('click', () => {
  unlockAudio();
  const muted = BGM.toggleMute();
  if (!muted && STATE.phase !== 'menu') BGM.start('nail');
  syncBgmBtn();
});

$('res-nick').addEventListener('change', async () => {
  const nick = saveNickname($('res-nick').value);
  if (STATE.lastFinalRun) {
    STATE.lastFinalRun.nickname = nick;
    const saved = await saveResultAndBuildShare(STATE.lastFinalRun, STATE.incomingRef);
    STATE.lastShareData = saved;
    $('res-lb-wrap').innerHTML = renderGlobalLadderHTML(saved, formatLadderMetric);
  }
});

$('btn-share').addEventListener('click', async () => {
  if (!STATE.lastFinalRun) return;
  STATE.lastFinalRun.nickname = saveNickname($('res-nick').value || '익명 네일리스트');
  const saved = await saveResultAndBuildShare(STATE.lastFinalRun, STATE.incomingRef);
  STATE.lastShareData = saved;
  $('res-lb-wrap').innerHTML = renderGlobalLadderHTML(saved, formatLadderMetric);

  const ev = STATE.lastFinalRun.evalData;
  await shareChallengeLink({
    title: '💅 손톱 색칠하기 — 이게뭔겜? 404 아케이드',
    text: `💅 [${saved.nickname}]님의 손톱 색칠하기(${currentDiff.short}) 총점 ${ev.totalScore.toFixed(1)}점 (${ev.elapsed.toFixed(1)}초)! 이 기록 깰 수 있나요?`,
    url: saved.shareUrl,
  });
});

$('btn-save-img').addEventListener('click', () => {
  if (!STATE.lastFinalRun) return;
  const ev = STATE.lastFinalRun.evalData;
  downloadResultCard({
    gameTitle: `손톱 색칠하기 (${currentDiff.short})`,
    emoji: '💅',
    rankTitle: ev.rankTitle,
    headline: `총점 ${ev.totalScore.toFixed(1)}점`,
    subline: `${currentDiff.badge} · ${ev.elapsed.toFixed(1)}초 완주!`,
    stats: [
      { label: '걸린 시간', value: `${ev.elapsed.toFixed(1)}초`, color: '#fde047' },
      { label: '정밀도 점수', value: `${ev.precisionScore.toFixed(1)}점`, color: '#ffffff' },
      { label: '보너스 점수', value: `+${ev.totalBonus.toFixed(1)}점`, color: '#4ade80' },
    ],
    extraCanvas: glCanvas,
  });
});

// ─── 2D 오버레이 렌더링 ───
const _projV = V();
function drawOverlay(dt) {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (ovCanvas.width !== Math.floor(w * dpr) || ovCanvas.height !== Math.floor(h * dpr)) {
    ovCanvas.width = Math.floor(w * dpr);
    ovCanvas.height = Math.floor(h * dpr);
  }
  ovCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ovCtx.clearRect(0, 0, w, h);

  if (STATE.phase === 'intro') {
    const t = STATE.introTime;
    let line1 = '', line2 = '';
    if (t < 0.95) {
      line1 = '어서 오세요, 404 네일살롱입니다 💅';
      line2 = `${currentDiff.badge} · ${currentPalette.name}`;
    } else if (t < 1.95) {
      line1 = '살에 묻으면 못 지워요! 빠를수록 가산점!';
      line2 = currentDiff.hasArt ? '베이스를 칠한 뒤 세필 붓으로 아트를 올려요' : '다섯 손톱을 점선 안쪽까지 채워 주세요';
    } else {
      line1 = '테두리와 아트는 [😤 숨 참기]로 정밀하게!';
      line2 = '지금 타임어택 시술을 시작합니다!';
    }

    const boxW = Math.min(w - 32, 384);
    const boxX = (w - boxW) / 2;
    const boxY = h * 0.72;
    ovCtx.fillStyle = 'rgba(22, 17, 34, 0.86)';
    ovCtx.strokeStyle = 'rgba(255, 216, 74, 0.55)';
    ovCtx.lineWidth = 2;
    ovCtx.beginPath();
    ovCtx.roundRect(boxX, boxY, boxW, 68, 18);
    ovCtx.fill();
    ovCtx.stroke();

    ovCtx.textAlign = 'center';
    ovCtx.fillStyle = '#fff8eb';
    ovCtx.font = '900 15.5px "Pretendard","Apple SD Gothic Neo",sans-serif';
    ovCtx.fillText(line1, w / 2, boxY + 27);
    ovCtx.fillStyle = '#fda4af';
    ovCtx.font = '700 12.5px "Pretendard","Apple SD Gothic Neo",sans-serif';
    ovCtx.fillText(line2, w / 2, boxY + 49);
  }

  if (STATE.phase === 'play' && STATE.painting) {
    const fg = FINGERS[STATE.fingerIdx].group;
    _projV.set(STATE.curX, surfTop(STATE.curX, STATE.curS) + 0.12, STATE.curS);
    fg.localToWorld(_projV);
    _projV.project(CAM);
    const sx = (_projV.x + 1) * 0.5 * w;
    const sy = (1 - _projV.y) * 0.5 * h;

    const breathOn = isBreathActive();
    const isArt = STATE.subStep === 'art' && currentDiff.hasArt;
    const ringR = isArt ? (breathOn ? 11 : 15) : (breathOn ? 16 : 22);
    ovCtx.save();
    ovCtx.beginPath();
    ovCtx.arc(sx, sy, ringR, 0, TAU);
    ovCtx.lineWidth = breathOn ? 2.5 : 1.8;
    ovCtx.strokeStyle = STATE.smearFlash > 0.2
      ? 'rgba(239, 68, 68, 0.9)'
      : breathOn
        ? 'rgba(56, 189, 248, 0.92)'
        : STATE.risk >= 72
          ? 'rgba(251, 146, 60, 0.85)'
          : 'rgba(255, 255, 255, 0.5)';
    if (!breathOn) ovCtx.setLineDash([4, 4]);
    ovCtx.stroke();
    ovCtx.restore();
  }

  for (let i = STATE.popTexts.length - 1; i >= 0; i--) {
    const p = STATE.popTexts[i];
    p.age += dt;
    if (p.age >= p.dur) {
      STATE.popTexts.splice(i, 1);
      continue;
    }
    const k = p.age / p.dur;
    const alpha = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    const py = h * 0.28 - k * 28;
    ovCtx.save();
    ovCtx.globalAlpha = clamp(alpha, 0, 1);
    ovCtx.font = '900 18px "Pretendard","Apple SD Gothic Neo",sans-serif';
    ovCtx.textAlign = 'center';
    ovCtx.strokeStyle = 'rgba(18, 12, 28, 0.9)';
    ovCtx.lineWidth = 5;
    ovCtx.strokeText(p.text, w / 2, py);
    ovCtx.fillStyle = p.color;
    ovCtx.fillText(p.text, w / 2, py);
    ovCtx.restore();
  }
}

// ─── 메인 애니메이션 루프 ───
let lastT = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastT) * 0.001);
  lastT = now;

  if (STATE.smearFlash > 0) {
    STATE.smearFlash = Math.max(0, STATE.smearFlash - dt);
    if (STATE.smearFlash === 0 && STATE.phase === 'play') updatePlayHUD();
  }

  if (STATE.phase === 'menu') {
    const t = now * 0.001;
    CAM.position.set(Math.sin(t * 0.35) * 26, 175, 165);
    CAM.lookAt(0, 6, -18);
    BRUSH_ROOT.visible = false;
    FINGERS.forEach(f => {
      f.guide.visible = false;
      f.artGuideHolder.visible = false;
    });
  } else if (STATE.phase === 'intro') {
    STATE.introTime += dt;
    const t = STATE.introTime;
    FINGERS.forEach(f => {
      f.guide.visible = false;
      f.artGuideHolder.visible = false;
    });

    if (t < 0.95) {
      HAND_RIG.visible = true;
      DECO_BOTTLES.visible = true;
      CAM.position.set(-18 + t * 14, 115, 148);
      CAM.lookAt(-4, 6, -38);
      BRUSH_ROOT.visible = false;
      MAIN_BOTTLE.position.set(-48, DESK_Y, 14);
    } else if (t < 1.95) {
      const u = (t - 0.95) / 1.0;
      HAND_RIG.visible = false;
      ARMREST.visible = false;
      DECO_BOTTLES.visible = false;
      MAIN_BOTTLE.position.set(0, 0, 0);
      BRUSH_ROOT.visible = true;
      BRUSH_ROOT.position.set(0, 0, 0);
      BRUSH_ROOT.quaternion.identity();
      BRUSH_ROOT.scale.set(1, 1, 1);

      const liftY = lerp(19, 33, ease(clamp(u * 1.2, 0, 1)));
      const axisUp = V(0.06, 0.985, 0.14).normalize();
      setBrushAppearance(false);
      setBrushLocal({
        x: 0, s: 0, lift: 4.0, a: 1.6, b: 0.75, psi: 0,
        A: axisUp, onSurface: false, drop: 1.08, isArt: false,
      });
      orientGroup(TOOL, V(0, liftY + LB, 0), axisUp);
      bristleMesh.position.set(0, liftY - surfTop(0, 0) - 4.0, 0);
      blobMesh.position.y += liftY - surfTop(0, 0) - 4.0;

      CAM.position.set(14, 42, 122);
      CAM.lookAt(0, 24, 0);
    } else if (t < 2.85) {
      HAND_RIG.visible = true;
      ARMREST.visible = true;
      DECO_BOTTLES.visible = true;
      bristleMesh.position.set(0, 0, 0);
      MAIN_BOTTLE.position.set(-56, DESK_Y, 18);
      BRUSH_ROOT.visible = false;
      const u = ease(clamp((t - 1.95) / 0.9, 0, 1));
      updateCameraGoalForFinger(0, false);
      CAM.position.lerpVectors(V(0, 210, 130), camGoalPos, u);
      const lk = V().lerpVectors(V(-8, 6, -8), camGoalLook, u);
      CAM.lookAt(lk);
    } else {
      HAND_RIG.visible = true;
      ARMREST.visible = true;
      bristleMesh.position.set(0, 0, 0);
      MAIN_BOTTLE.position.set(-56, DESK_Y, 18);
      camCurPos.copy(camGoalPos);
      camCurLook.copy(camGoalLook);
      beginPlayPhase();
    }
  } else if (STATE.phase === 'play') {
    // 실시간 스톱워치 업데이트
    STATE.elapsedSec += dt;
    $('hud-timer').textContent = `⏱ ${STATE.elapsedSec.toFixed(1)}초`;

    if (STATE.exhaustTimer > 0) {
      STATE.exhaustTimer = Math.max(0, STATE.exhaustTimer - dt);
      STATE.breath = Math.min(100, STATE.breath + dt * 36);
      updatePlayHUD();
    } else if (isBreathActive()) {
      STATE.breath = Math.max(0, STATE.breath - dt * 22.5);
      if (STATE.breath <= 0) {
        STATE.breathHoldBtn = false;
        STATE.breathToggleOn = false;
        STATE.breathKeyDown = false;
        STATE.exhaustTimer = 1.15;
        SFX.gasp();
        addPopText('😮‍💨 푸하헉! 숨이 찼어요!', '#f87171');
      }
      updatePlayHUD();
    } else if (STATE.breath < 100) {
      STATE.breath = Math.min(100, STATE.breath + dt * 34);
      updatePlayHUD();
    }

    if (STATE.painting) {
      applyBrushStrokeAt(STATE.rawX, STATE.rawS, dt);
    }

    const camFollow = 1 - Math.exp(-dt * 9.5);
    camCurPos.lerp(camGoalPos, camFollow);
    camCurLook.lerp(camGoalLook, camFollow);
    CAM.position.copy(camCurPos);
    CAM.lookAt(camCurLook);

    const activeFinger = FINGERS[STATE.fingerIdx];
    activeFinger.group.updateMatrixWorld(true);
    BRUSH_ROOT.visible = true;
    bristleMesh.position.set(0, 0, 0);
    BRUSH_ROOT.position.copy(activeFinger.group.position);
    BRUSH_ROOT.quaternion.copy(activeFinger.group.quaternion);
    BRUSH_ROOT.scale.copy(activeFinger.group.scale);

    const breathOn = isBreathActive();
    const isArtStep = STATE.subStep === 'art' && currentDiff.hasArt;

    FINGERS.forEach((f, idx) => {
      if (idx === STATE.fingerIdx) {
        f.guide.visible = true;
        f.guide.userData.bgMat.opacity = isArtStep ? 0.32 : 0.78;
        f.guide.userData.fgMat.opacity = isArtStep ? 0.45 : 0.98;
        f.guide.userData.fgMat.color.set(
          STATE.smearFlash > 0.15 ? '#ff7b7b'
            : breathOn ? '#7dd3fc'
            : STATE.risk >= 65 ? '#fde047'
            : '#ffffff'
        );
        f.artGuideHolder.visible = isArtStep;
        if (isArtStep && f.artGuideHolder.children[0] && f.artGuideHolder.children[0].userData.fgMat) {
          f.artGuideHolder.children[0].userData.fgMat.color.set(breathOn ? '#7dd3fc' : '#fde047');
        }
      } else {
        f.guide.visible = true;
        f.guide.userData.bgMat.opacity = 0.35;
        f.guide.userData.fgMat.opacity = 0.62;
        f.guide.userData.fgMat.color.set('#ffffff');
        f.artGuideHolder.visible = false;
      }
    });

    STATE.lift = lerp(STATE.lift, STATE.targetLift, 1 - Math.exp(-dt * 16));
    setBrushLocal({
      x: STATE.curX,
      s: STATE.curS,
      lift: STATE.lift,
      a: isArtStep ? 0.55 : (breathOn ? 2.18 : 2.32),
      b: isArtStep ? 0.42 : 0.86,
      psi: isArtStep ? 0 : STATE.psi,
      A: BRUSH_AXIS,
      drop: isArtStep ? 0.55 : 0.65,
      isArt: isArtStep,
    });
  } else if (STATE.phase === 'showcase') {
    BRUSH_ROOT.visible = false;
    FINGERS.forEach(f => {
      f.guide.visible = false;
      f.artGuideHolder.visible = false;
    });
    const t = now * 0.001;
    const autoZ = STATE.showcaseDragging ? 0 : Math.sin(t * 1.35) * 0.14;
    const autoX = STATE.showcaseDragging ? 0 : Math.cos(t * 0.95) * 0.05;
    STATE.showcaseTiltZ = lerp(STATE.showcaseTiltZ, STATE.targetTiltZ + autoZ, 1 - Math.exp(-dt * 6));
    STATE.showcaseTiltX = lerp(STATE.showcaseTiltX, STATE.targetTiltX + autoX, 1 - Math.exp(-dt * 6));

    HAND_RIG.rotation.z = STATE.showcaseTiltZ;
    HAND_RIG.rotation.x = STATE.showcaseTiltX - 0.03;
    HAND_RIG.position.y = 8.5;

    const camFollow = 1 - Math.exp(-dt * 5.5);
    camCurPos.lerp(camGoalPos, camFollow);
    camCurLook.lerp(camGoalLook, camGoalLook.distanceTo(camCurLook) > 0.001 ? camFollow : 1);
    CAM.position.copy(camCurPos);
    CAM.lookAt(camCurLook);
  }

  R.render(S, CAM);
  drawOverlay(dt);
}

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  R.setSize(w, h, false);
  CAM.aspect = w / Math.max(1, h);
  CAM.updateProjectionMatrix();
  if (STATE.phase === 'play') updateCameraGoalForFinger(STATE.fingerIdx, false);
});

// ─── 초기 부팅 ───
async function boot() {
  const access = await enforceGameAccess(GAME_ID);
  if (!access.allowed) return;

  // 난이도 선택 버튼 바인딩
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      unlockAudio();
      SFX.tick();
      selectDifficulty(btn.dataset.diff);
    });
  });

  // 팔레트 스와치 버튼 생성
  const swatchWrap = $('color-swatches');
  swatchWrap.innerHTML = PALETTE.map((p, idx) => `
    <button type="button" class="swatch-btn ${idx === 0 ? 'selected' : ''}"
      data-id="${p.id}" title="${p.name}"
      style="background: radial-gradient(circle at 32% 28%, #ffffff 0%, ${p.hex} 38%, ${p.dark} 100%);">
    </button>
  `).join('');

  swatchWrap.querySelectorAll('.swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      unlockAudio();
      SFX.tick();
      const found = PALETTE.find(p => p.id === btn.dataset.id);
      if (found) selectPalette(found);
    });
  });

  syncBgmBtn();

  const best = getBestRecord(GAME_ID);
  if (best && best.score != null) {
    $('start-best').textContent = `${Number(best.score).toFixed(1)}점`;
  }

  const incoming = await loadIncomingChallenge(GAME_ID);
  if (incoming) {
    STATE.incomingRef = incoming;
    // 지인이 플레이한 난이도가 있으면 자동으로 같은 난이도 선택
    if (incoming.targetValue === 3) selectDifficulty('high');
    else if (incoming.targetValue === 2) selectDifficulty('mid');
    else if (incoming.targetValue === 1) selectDifficulty('low');

    const dTag = diffLabelFromCode(incoming.targetValue);
    const secTxt = incoming.actualValue > 5 ? ` · ${Number(incoming.actualValue).toFixed(1)}초` : '';
    const banner = $('rival-banner');
    banner.style.display = 'flex';
    $('rival-banner-text').innerHTML = `🔥 <b>${incoming.nickname}</b>님(${dTag || '도전'}): <b>${Number(incoming.score).toFixed(1)}점${secTxt}</b>`;
    $('nail-hud').classList.add('with-rival');

    const rBox = $('start-rival-box');
    rBox.style.display = 'flex';
    rBox.innerHTML = `
      <div style="font-size:12px;color:#fde68a;font-weight:800">💌 지인이 보낸 타임어택 네일 기록</div>
      <div class="vs-row">
        <span><b>${incoming.nickname}</b>님 ${dTag ? `[${dTag}]` : ''}</span>
        <span style="color:#4ade80;font-weight:900">${Number(incoming.score).toFixed(1)}점${secTxt}</span>
      </div>
    `;
  }

  window.__projectFingerLocal = (lx, ls) => {
    const fg = FINGERS[STATE.fingerIdx].group;
    fg.updateMatrixWorld(true);
    const v = V(lx, surfTop(lx, ls), ls);
    fg.localToWorld(v);
    v.project(CAM);
    const rect = glCanvas.getBoundingClientRect();
    return {
      x: rect.left + (v.x + 1) * 0.5 * rect.width,
      y: rect.top + (1 - v.y) * 0.5 * rect.height,
    };
  };

  window.__nailState = () => {
    const f = FINGERS[STATE.fingerIdx];
    return {
      phase: STATE.phase,
      diff: currentDiff.id,
      fingerIdx: STATE.fingerIdx,
      subStep: STATE.subStep,
      elapsedSec: Number(STATE.elapsedSec.toFixed(1)),
      coverPct: Number(f.coat.coverPct().toFixed(1)),
      artCoverPct: Number(f.coat.artCoverPct().toFixed(1)),
      smearPx: f.coat.smearPx,
      breath: Math.round(STATE.breath),
      pattern: f.pattern,
    };
  };

  requestAnimationFrame(animate);
}

boot();
