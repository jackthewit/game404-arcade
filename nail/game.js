// 손톱 색칠하기 (삐져나가면 끝! 3D 숨 참기 네일살롱)
// 원본 쇼츠(games/ag_nailline)의 Three.js 입체 손가락·탄성 붓털·젖은 매니큐어 클리어코트 물리를 계승하여
// 다섯 손톱(엄지~소지)을 직접 드래그해 칠하고 전체 글로벌 랭킹과 3D 쇼케이스로 감상하는 웹게임.
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
  showToast,
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

// ─── 매니큐어 6종 컬러 팔레트 ───
const PALETTE = [
  { id: 'cherry', name: '체리 레드', hex: '#c20e28', dark: '#7c0416', bottle: '#b30f24' },
  { id: 'rose',   name: '로즈 핑크', hex: '#e63e76', dark: '#9c1946', bottle: '#d43168' },
  { id: 'coral',  name: '코랄 피치', hex: '#f05d43', dark: '#a62e19', bottle: '#df4f36' },
  { id: 'butter', name: '버터 옐로우', hex: '#eab308', dark: '#a16207', bottle: '#d9a306' },
  { id: 'mint',   name: '민트 소다', hex: '#14b8a6', dark: '#0f766e', bottle: '#0fa695' },
  { id: 'navy',   name: '미드나잇 네이비', hex: '#23429e', dark: '#101f54', bottle: '#1b3582' },
];

const FINGER_SPECS = [
  { name: '엄지', label: '① 엄지', x: -33.5, y: -1.0, z: -10.5, ry: -0.14, rz: 0.08, sx: 1.08, sy: 1.02, sz: 0.94, jitterMul: 0.85 },
  { name: '검지', label: '② 검지', x: -16.8, y: 0.0,  z: -2.2,  ry: -0.05, rz: 0.02, sx: 0.99, sy: 0.99, sz: 0.99, jitterMul: 0.95 },
  { name: '중지', label: '③ 중지', x: 0.0,   y: 0.3,  z: 0.0,   ry: 0.00,  rz: 0.00, sx: 1.02, sy: 1.01, sz: 1.03, jitterMul: 1.00 },
  { name: '약지', label: '④ 약지', x: 16.6,  y: 0.0,  z: -2.6,  ry: 0.04,  rz: -0.02,sx: 0.96, sy: 0.97, sz: 0.98, jitterMul: 1.08 },
  { name: '소지', label: '⑤ 소지', x: 31.8,  y: -0.5, z: -9.0,  ry: 0.09,  rz: -0.05,sx: 0.87, sy: 0.90, sz: 0.91, jitterMul: 1.18 },
];

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
S.background = new THREE.Color(DESK_HEX);

const CAM = new THREE.PerspectiveCamera(16.5, window.innerWidth / window.innerHeight, 25, 1300);

// 젖은 매니큐어 위로 선명한 빛줄기가 반사되도록 스트립 라이트 환경맵 구성
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

// 조명 배치
const keyLight = new THREE.DirectionalLight('#fff5e8', 1.75);
keyLight.position.set(-48, 150, -20);
keyLight.target.position.set(0, 6, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.05;
{
  const c = keyLight.shadow.camera;
  c.left = -85; c.right = 85; c.top = 85; c.bottom = -85; c.near = 25; c.far = 340;
  c.updateProjectionMatrix();
}
S.add(keyLight, keyLight.target);
S.add(new THREE.HemisphereLight('#fff8f2', '#e9a898', 0.54));
const fillLight = new THREE.DirectionalLight('#dfeaff', 0.46);
fillLight.position.set(65, 55, 75);
S.add(fillLight);

// 네일 테이블 바닥
{
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: DESK_HEX, roughness: 0.82, metalness: 0, envMapIntensity: 0.25 })
  );
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  S.add(desk);
}

// ─── 손가락 & 손톱 수학 모델 (SDF + 물리 곡면) ───
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

// ─── 피부 & 맨손톱 텍스처 (초고속 512 / 384 생성) ───
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
      // 손톱 둘레 안쪽 흰 점선 목표선
      if (d > -0.38 && d < -0.10) {
        const ang = Math.atan2(s - 6.8, x);
        if (Math.sin(ang * 28) > 0.12) k = mix3(k, wht, 0.86);
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
function buildFingerGeo({ L = 46, bD = 0.1, bP = 0.34, n1 = 68, n2c = 128, nt = 156 } = {}) {
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
    for (let j = 0; j <= nt; j++) {
      const t = th(j), c = Math.cos(t), sn = Math.sin(t), o = i * (nt + 1) + j;
      const x = p.af * Math.sign(c) * Math.pow(Math.abs(c), 2 / NE) * 0.9995;
      let y = sn >= 0 ? (p.af > 1e-4 ? fleshTop(x, s, p) : p.ycf) : p.ycf - p.hBf * Math.pow(-sn, 2 / NEB);
      if (y < 0) y = 0;
      bend(y, s, _bendOut);
      pos[o * 3] = x; pos[o * 3 + 1] = _bendOut.y; pos[o * 3 + 2] = _bendOut.z;
      uv[o * 2] = (t + Math.PI / 2) / TAU;
      uv[o * 2 + 1] = (s - VS0) / VSL;
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

// ─── 공용 페인트 존 테이블 & 각 손가락별 NailCoat ───
const N_TEX = PA.N;
const PX = PA.W / N_TEX;
const ZONE = new Uint8Array(N_TEX * N_TEX); // 0: 바를 손톱 면, 1: 경계 완충 홈, 2: 옆 살, 3: 손끝 밖 허공
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
    this.data = new Uint8Array(N_TEX * N_TEX * 4);
    this.cdat = new Uint8Array(N_TEX * N_TEX * 4);
    this.tex = dataTex(N_TEX, N_TEX, this.data, false, false);
    this.ctex = dataTex(N_TEX, N_TEX, this.ctatBufferInit(paletteItem), true, false);

    this.mat = new THREE.MeshPhysicalMaterial({
      map: this.ctex,
      roughness: 0.085,
      metalness: 0,
      bumpMap: this.tex,
      bumpScale: 1.5,
      alphaMap: this.tex,
      transparent: true,
      depthWrite: false,
      clearcoat: 0.88,
      clearcoatRoughness: 0.028,
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

  ctatBufferInit(pal) {
    this.CR = hexRgb(pal.hex);
    this.CD = hexRgb(pal.dark);
    for (let o = 0; o < N_TEX * N_TEX * 4; o += 4) {
      this.cdat[o] = this.CR[0];
      this.cdat[o + 1] = this.CR[1];
      this.cdat[o + 2] = this.CR[2];
      this.cdat[o + 3] = 255;
    }
    return this.cdat;
  }

  setColor(pal) {
    this.CR = hexRgb(pal.hex);
    this.CD = hexRgb(pal.dark);
    this.ux0 = 0; this.ux1 = N_TEX - 1;
    this.uy0 = 0; this.uy1 = N_TEX - 1;
    this.dirty = true;
    this.upload();
  }

  reset() {
    this.cov.fill(0);
    this.HT.fill(0);
    this.RG.fill(0);
    this.painted = 0;
    this.smearPx = 0;
    this.overMm = 0;
    this.smearCount = 0;
    this.ux0 = 0; this.ux1 = N_TEX - 1;
    this.uy0 = 0; this.uy1 = N_TEX - 1;
    this.dirty = true;
    this.upload();
  }

  coverPct() {
    return (this.painted / TOTAL_NAIL_PX) * 100;
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
    const CR = this.CR, CD = this.CD;
    for (let iy = this.uy0; iy <= this.uy1; iy++) {
      const rowOff = iy * N_TEX;
      for (let ix = this.ux0; ix <= this.ux1; ix++) {
        const i = rowOff + ix, o = i * 4;
        const g = this.RG[i];
        const h = this.HT[i] + g;
        this.data[o] = h > 255 ? 255 : h;
        this.data[o + 1] = this.cov[i]; // alphaMap reads green channel
        this.data[o + 2] = h > 255 ? 255 : h;
        this.data[o + 3] = 255;
        const k = Math.min(1, g / 60) * 0.78;
        this.cdat[o] = CR[0] + (CD[0] - CR[0]) * k;
        this.cdat[o + 1] = CR[1] + (CD[1] - CR[1]) * k;
        this.cdat[o + 2] = CR[2] + (CD[2] - CR[2]) * k;
      }
    }
    this.tex.needsUpdate = true;
    this.ctex.needsUpdate = true;
    this.dirty = false;
  }
}

// ─── 다섯 손가락 + 손등 + 네일 벨벳 쿠션 + 매니큐어 유리병 구성 ───
const HAND_RIG = new THREE.Group();
S.add(HAND_RIG);

// 폭신한 파스텔 벨벳 네일 암레스트 쿠션
const ARMREST = new THREE.Group();
{
  const velvetM = new THREE.MeshStandardMaterial({ color: '#f3d9e2', roughness: 0.85, metalness: 0 });
  const goldLegM = new THREE.MeshStandardMaterial({ color: '#e5c17b', roughness: 0.28, metalness: 0.72 });
  const padGeo = new THREE.CylinderGeometry(16, 17, 118, 32);
  padGeo.rotateZ(Math.PI / 2);
  const pad = new THREE.Mesh(padGeo, velvetM);
  pad.scale.set(1, 0.58, 1.35);
  pad.position.set(0, -5.2, -52);
  pad.castShadow = pad.receiveShadow = true;
  ARMREST.add(pad);

  for (const lx of [-48, 48]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 12, 16), goldLegM);
    leg.position.set(lx, -6, -52);
    leg.castShadow = true;
    ARMREST.add(leg);
  }
  S.add(ARMREST);
}

// 다섯 손가락 뒤쪽으로 자연스럽게 이어지는 입체 손등(얼굴 없음, 손등·손목만)
{
  const palmGeo = new THREE.SphereGeometry(1, 36, 28);
  const palm = new THREE.Mesh(palmGeo, skinM);
  palm.scale.set(42, 11.5, 34);
  palm.position.set(-1.5, -4.5, -56);
  palm.rotation.x = 0.22;
  palm.castShadow = palm.receiveShadow = true;
  HAND_RIG.add(palm);

  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(29, 31, 60, 28), skinM);
  wrist.rotation.x = Math.PI / 2 + 0.18;
  wrist.scale.set(1.08, 1, 0.42);
  wrist.position.set(-2, -12, -96);
  wrist.castShadow = true;
  HAND_RIG.add(wrist);
}

let currentPalette = PALETTE[0];
const FINGERS = FINGER_SPECS.map((spec, idx) => {
  const group = makeFingerMesh();
  group.position.set(spec.x, spec.y, spec.z);
  group.rotation.set(0, spec.ry, spec.rz);
  group.scale.set(spec.sx, spec.sy, spec.sz);
  const coat = new NailCoat(currentPalette);
  group.add(coat.mesh);
  HAND_RIG.add(group);
  return { idx, spec, group, coat };
});

// 매니큐어 유리병 진열 (메인 병 + 배경 파스텔 살롱 소품 병들)
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
MAIN_BOTTLE.position.set(-56, 0, 18);
MAIN_BOTTLE.scale.setScalar(0.82);
S.add(MAIN_BOTTLE);

const DECO_BOTTLES = new THREE.Group();
PALETTE.forEach((pal, i) => {
  const b = createPolishBottle(pal.bottle, true);
  b.position.set(-54 + i * 21.5, 0, -96 + Math.abs(i - 2.5) * 4);
  b.scale.setScalar(0.76);
  DECO_BOTTLES.add(b);
});
S.add(DECO_BOTTLES);

// ─── 매니큐어 탄성 붓 & 뚜껑을 쥔 오른손가락 (BRUSH_ROOT가 현재 손가락 로컬 공간 추종) ───
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

// 탄성 붓털 메쉬
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

function updateBristleColors(hexStr) {
  const colr = bristleGeo.attributes.color.array;
  const c0 = new THREE.Color('#1c1214');
  const c1 = new THREE.Color(hexStr);
  for (let i = 0; i <= NK; i++) {
    const k = i / NK;
    const c = c0.clone().lerp(c1, sm((k - 0.04) / 0.22));
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
updateBristleColors(currentPalette.hex);

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

// 뚜껑을 쥔 오른손 엄지·검지
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
  const press = c * clamp(st.a / 2.5, 0, 1);
  const A = st.A || BRUSH_AXIS;
  const av = Math.max(0.55, st.a - 0.25);

  _P0.set(st.x, surfTop(st.x, st.s), st.s);
  _bk.set(Math.sin(st.psi), 0, -Math.cos(st.psi));
  _Wv.set(Math.cos(st.psi), 0, Math.sin(st.psi));

  _E.copy(_P0).addScaledVector(_bk, Math.max(0.1, st.b - 0.35) * c);
  _E.y = surfTop(_E.x, _E.z) + st.lift + 0.11;

  _F.copy(_E).addScaledVector(A, LB);
  _F2.copy(_P0).addScaledVector(_bk, -st.b * 0.5).addScaledVector(A, LB - 1.5 - 1.45 * press);
  _F2.y += 0.3;
  _F.lerp(_F2, c);

  _Cc.copy(_F).addScaledVector(A, -LB * 0.5);
  _C2.copy(_P0).addScaledVector(_bk, -st.b * 0.75).addScaledVector(A, 1.1 - 0.5 * press);
  _C2.y += 0.25;
  _Cc.lerp(_C2, c);

  orientGroup(TOOL, _F, A);

  const pos = bristleGeo.attributes.position.array;
  const onSurface = st.onSurface !== false;
  for (let i = 0; i <= NK; i++) {
    const k = i / NK, k1 = 1 - k;
    _q.copy(_F).multiplyScalar(k1 * k1).addScaledVector(_Cc, 2 * k * k1).addScaledVector(_E, k * k);
    _T.copy(_Cc).sub(_F).multiplyScalar(2 * k1).addScaledVector(_q2.copy(_E).sub(_Cc), 2 * k).normalize();
    _Wd.copy(_Wv).addScaledVector(_T, -_Wv.dot(_T)).normalize();
    _Nn.crossVectors(_T, _Wd);

    let w = lerp(0.66, lerp(0.5, av, c), Math.pow(k, lerp(1.4, 0.7, c)));
    let th = lerp(0.5, lerp(0.2, 0.13, c), Math.pow(k, 0.8));
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

  const br = lerp(0.76, 0.18, c) * (st.drop == null ? 0.85 : st.drop);
  blobMesh.position.copy(_E).addScaledVector(A, 0.08);
  blobMesh.position.y -= 0.08 * (1 - c);
  blobMesh.scale.set(br, br * 1.15, br);
  blobMesh.visible = c < 0.45 && st.visible !== false;
  return _E;
}

// ─── 팔레트 색상 일괄 적용 ───
function selectPalette(pal) {
  currentPalette = pal;
  MAIN_BOTTLE.userData.liqM.color.set(pal.bottle);
  blobM.color.set(pal.hex);
  updateBristleColors(pal.hex);
  FINGERS.forEach(f => f.coat.setColor(pal));

  const nameEl = $('selected-color-name');
  if (nameEl) {
    nameEl.textContent = pal.name;
    nameEl.style.color = pal.hex === '#eab308' ? '#fde047' : pal.hex === '#14b8a6' ? '#5eead4' : '#fda4af';
  }
  document.querySelectorAll('.swatch-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.id === pal.id);
  });
}

// ─── 게임 상태 관리 ───
const STATE = {
  phase: 'menu', // 'menu' | 'intro' | 'play' | 'showcase'
  introTime: 0,
  fingerIdx: 0,
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

// 카메라 부드러운 전환용 상태
const camCurPos = V(0, 165, 86);
const camCurLook = V(0, 8, 5);
const camGoalPos = V(0, 165, 86);
const camGoalLook = V(0, 8, 5);

function updateCameraGoalForFinger(idx, instant = false) {
  const f = FINGERS[idx];
  const worldCenter = V(0, 8.5, 6.6);
  HAND_RIG.updateMatrixWorld(true);
  f.group.localToWorld(worldCenter);

  // 모바일 세로 화면에서도 손톱이 가로 절반 이상 큼직하게 들어오도록 거리 조정
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const dist = aspect < 0.72 ? 156 : 142;
  const el = 65 * DEG;

  camGoalLook.set(worldCenter.x, worldCenter.y + 0.6, worldCenter.z + 1.0);
  camGoalPos.set(
    worldCenter.x - f.spec.ry * 18,
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

// ─── 레이캐스트: 화면 포인터 → 현재 손가락 로컬 (x, s) 변환 ───
const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _invMat = new THREE.Matrix4();
const _localRay = new THREE.Ray();

function screenToFingerLocal(clientX, clientY, pointerType) {
  const rect = glCanvas.getBoundingClientRect();
  // 모바일 터치 시 손가락 끝에 붓끝이 가리지 않게 살짝 위쪽으로 오프셋
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

// ─── UI 동기화 ───
function syncBgmBtn() {
  const b = $('btn-bgm');
  if (!b) return;
  const muted = BGM.isMuted();
  b.textContent = muted ? '🔇 음소거' : '🔊 BGM';
  b.classList.toggle('bgm-off', muted);
}

function updatePlayHUD() {
  const cur = FINGERS[STATE.fingerIdx];
  const cov = Math.min(100, cur.coat.coverPct());
  const covDisp = cov >= 99.4 ? 100 : Math.floor(cov);

  $('hud-cover').textContent = `${covDisp}%`;
  $('hud-cover').style.color = covDisp >= 96 ? '#4ade80' : '#ffffff';

  let cleanCnt = 0;
  FINGERS.forEach((f, i) => {
    const chip = $(`fchip-${i}`);
    if (!chip) return;
    chip.className = 'finger-chip';
    if (i < STATE.fingerIdx) {
      if (f.coat.smearPx === 0 && f.coat.coverPct() >= 85) {
        chip.classList.add('clean');
        cleanCnt++;
      } else {
        chip.classList.add('smudged');
      }
    } else if (i === STATE.fingerIdx) {
      chip.classList.add('active');
      if (f.coat.smearPx === 0 && covDisp >= 90) cleanCnt++;
    }
  });
  $('hud-clean').textContent = `${cleanCnt}/5`;

  // 위험도 막대 & 상태 태그
  const riskFill = $('risk-fill');
  const riskTag = $('risk-tag');
  riskFill.style.width = `${clamp(Math.round(STATE.risk), 8, 100)}%`;

  if (STATE.smearFlash > 0) {
    riskFill.style.background = '#ef4444';
    riskTag.textContent = '삐끗! 옆 살에 매니큐어가 묻었어요!';
    riskTag.style.background = 'rgba(239,68,68,0.28)';
    riskTag.style.color = '#fca5a5';
  } else if (STATE.exhaustTimer > 0) {
    riskFill.style.background = '#ef4444';
    riskTag.textContent = '푸하헉! 숨이 다 닳아 손이 떨려요!';
    riskTag.style.background = 'rgba(239,68,68,0.25)';
    riskTag.style.color = '#fecaca';
  } else if (isBreathActive()) {
    riskFill.style.background = '#38bdf8';
    riskTag.textContent = '😤 숨 참는 중 · 수전증 0mm 정밀 모드!';
    riskTag.style.background = 'rgba(56,189,248,0.24)';
    riskTag.style.color = '#bae6fd';
  } else if (STATE.risk >= 76) {
    riskFill.style.background = '#ef4444';
    riskTag.textContent = '위험! 옆 살 코앞 · [숨 참기]를 켜세요!';
    riskTag.style.background = 'rgba(239,68,68,0.24)';
    riskTag.style.color = '#fca5a5';
  } else if (STATE.risk >= 45) {
    riskFill.style.background = '#f59e0b';
    riskTag.textContent = '흰 점선 근처 · 살살 문질러 주세요';
    riskTag.style.background = 'rgba(245,158,11,0.22)';
    riskTag.style.color = '#fde68a';
  } else {
    riskFill.style.background = '#4ade80';
    riskTag.textContent = covDisp >= 96 ? '영롱하게 다 채웠어요! ✨' : '점선 안쪽을 문질러 채워 주세요';
    riskTag.style.background = 'rgba(74,222,128,0.18)';
    riskTag.style.color = '#86efac';
  }

  // 숨 게이지 & 숨 참기 버튼
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

  // 다음 손톱 / 완성 버튼
  const nextBtn = $('btn-next-nail');
  const isLast = STATE.fingerIdx === FINGERS.length - 1;
  const actionWord = isLast ? '✨ 네일 완성하기!' : '💅 다음 손톱으로 →';

  nextBtn.className = 'ctrl-btn btn-next-nail';
  if (cov < 55) {
    nextBtn.disabled = true;
    $('btn-next-label').textContent = isLast ? `✨ 완성 (${covDisp}%)` : `💅 다음 손톱 (${covDisp}%)`;
    $('btn-next-sub').textContent = '조금만 더 넓게 칠해 주세요!';
  } else if (cov < 85) {
    nextBtn.disabled = false;
    nextBtn.classList.add('can-skip');
    $('btn-next-label').textContent = actionWord;
    $('btn-next-sub').textContent = `현재 ${covDisp}% · 더 채우면 고득점!`;
  } else if (cov < 97.5) {
    nextBtn.disabled = false;
    nextBtn.classList.add('ready');
    $('btn-next-label').textContent = actionWord;
    $('btn-next-sub').textContent = `바른 면 ${covDisp}% · 깔끔해요!`;
  } else {
    nextBtn.disabled = false;
    nextBtn.classList.add('perfect');
    $('btn-next-label').textContent = actionWord;
    $('btn-next-sub').textContent = cur.coat.smearPx === 0 ? '🌟 100% 무결점 풀컬러!' : `바른 면 ${covDisp}% 완료!`;
  }
}

// ─── 인트로 시작 & 게임 시작 & 손톱 전환 ───
function resetAllNails() {
  FINGERS.forEach(f => f.coat.reset());
  STATE.fingerIdx = 0;
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
  STATE.showcaseTiltX = 0;
  STATE.showcaseTiltZ = 0;
  STATE.targetTiltX = 0;
  STATE.targetTiltZ = 0;
  HAND_RIG.rotation.set(0, 0, 0);
  HAND_RIG.position.set(0, 0, 0);
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
  $('btn-restart-quick').style.display = 'none';
  document.body.classList.remove('in-showcase');

  STATE.phase = 'intro';
  STATE.introTime = 0;
  $('btn-skip-intro').classList.remove('hidden');
  SFX.bell();
}

function beginPlayPhase() {
  STATE.phase = 'play';
  HAND_RIG.visible = true;
  ARMREST.visible = true;
  DECO_BOTTLES.visible = true;
  bristleMesh.position.set(0, 0, 0);
  $('btn-skip-intro').classList.add('hidden');
  $('nail-hud').classList.remove('hidden');
  $('nail-dock').classList.remove('hidden');
  $('btn-restart-quick').style.display = 'inline-flex';
  MAIN_BOTTLE.position.set(-56, 0, 18);
  HAND_RIG.rotation.set(0, 0, 0);
  HAND_RIG.position.set(0, 0, 0);
  updateCameraGoalForFinger(0, false);
  updatePlayHUD();
}

function advanceToNextNail() {
  if (STATE.phase !== 'play') return;
  STATE.painting = false;
  STATE.paintPointerId = null;
  STATE.targetLift = 2.6;
  STATE.breathToggleOn = false;
  STATE.breathHoldBtn = false;

  if (STATE.fingerIdx < FINGERS.length - 1) {
    STATE.fingerIdx++;
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

// ─── 5손톱 종합 채점 & 쇼케이스 & 글로벌 랭킹 저장 ───
function evaluateFiveNails() {
  let sumScore = 0;
  let sumCov = 0;
  let cleanNails = 0;
  let totalOverMm = 0;
  const details = [];

  FINGERS.forEach(f => {
    const covRaw = Math.min(100, f.coat.coverPct());
    const covDisp = covRaw >= 99.4 ? 100 : Number(covRaw.toFixed(1));
    const fillPart = Math.min(100, (covRaw / 98.2) * 100);
    const smeared = f.coat.smearPx > 0;
    const smearAreaPct = (f.coat.smearPx / TOTAL_NAIL_PX) * 100;
    const penalty = smeared ? (8.5 + f.coat.overMm * 13.5 + smearAreaPct * 1.8) : 0;
    const cleanBonus = (!smeared && covRaw >= 95.5) ? 2.5 : 0;
    const nailScore = clamp(fillPart - penalty + cleanBonus, 0, 100);

    if (!smeared && covRaw >= 90) cleanNails++;
    sumScore += nailScore;
    sumCov += covDisp;
    totalOverMm += f.coat.overMm;

    details.push({
      name: f.spec.name,
      cov: covDisp,
      smeared,
      overMm: f.coat.overMm,
      score: nailScore,
    });
  });

  const finalScore = Number((sumScore / FINGERS.length).toFixed(1));
  const avgCov = Number((sumCov / FINGERS.length).toFixed(1));
  const overRounded = Number(totalOverMm.toFixed(2));

  let rankTitle = '🎨 아슬아슬 수습 네일리스트';
  let comment = '조금 삐져나갔지만 색감만큼은 화사해요! 테두리에선 숨 참기를 꼭 써 보세요.';
  if (cleanNails === 5 && avgCov >= 97.5) {
    rankTitle = '👑 청담동 전설의 네일 원장님';
    comment = '다섯 손톱 모두 살에 한 방울도 안 묻히고 100% 영롱한 빛줄기를 완성했어요!';
  } else if (finalScore >= 92 && cleanNails >= 4) {
    rankTitle = '💅 무결점 풀컬러 마스터';
    comment = '숨소리조차 멈춘 초정밀 붓터치! 손님이 손을 보며 감탄하고 있어요!';
  } else if (finalScore >= 82) {
    rankTitle = '✨ 꼼꼼한 살롱 수석 실장님';
    comment = '광택과 채움률이 아주 훌륭해요! 아슬아슬한 소지 테두리만 잡으면 원장님 급!';
  } else if (finalScore < 60 && overRounded >= 1.2) {
    rankTitle = '🩸 큐티클 추상화 예술가';
    comment = '손톱보다 옆 살에 더 많이 발랐어요! 지울 수 없는 원테이크의 매운맛!';
  }

  return {
    score: finalScore,
    avgCov,
    cleanNails,
    totalOverMm: overRounded,
    rankTitle,
    comment,
    details,
  };
}

function formatLadderMetric(row) {
  const sc = Number(row.score || 0).toFixed(1);
  const clean = row.actual_value != null ? `${Math.round(Number(row.actual_value))}무결점` : '';
  return clean ? `${sc}점 · ${clean}` : `${sc}점`;
}

async function finishAllNails() {
  STATE.phase = 'showcase';
  STATE.painting = false;
  BGM.setUrgent(false);

  $('nail-hud').classList.add('hidden');
  $('nail-dock').classList.add('hidden');
  $('showcase-tip').classList.remove('hidden');
  document.body.classList.add('in-showcase');

  // 다섯 손가락 전체(가로 폭 ~96mm)가 모바일 세로 화면에서도 잘리지 않고 한눈에 다 들어오도록 자동 거리 계산
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const halfTan = Math.tan((CAM.fov * 0.5) * DEG);
  const fitWidthDist = 52 / Math.max(0.04, halfTan * aspect);
  const dist = clamp(Math.max(255, fitWidthDist), 255, 780);
  const el = 60 * DEG;
  camGoalLook.set(-1, 2.0, -14);
  camGoalPos.set(-1, 2.0 + dist * Math.sin(el), -14 + dist * Math.cos(el));

  SFX.nailShine();
  setTimeout(() => SFX.win(), 240);

  const ev = evaluateFiveNails();
  const isBest = updateBestRecord(GAME_ID, {
    score: ev.score,
    errorMm: ev.totalOverMm,
    actualValue: ev.cleanNails,
    targetValue: 5,
    rankTitle: ev.rankTitle,
  }, false);

  $('res-rank').textContent = isBest ? `${ev.rankTitle} · 신기록!` : ev.rankTitle;
  $('res-headline').textContent = `정밀도 ${ev.score.toFixed(1)}점`;
  $('res-comment').textContent = ev.comment;
  $('res-avg-cov').textContent = `${ev.avgCov.toFixed(1)}%`;
  $('res-clean-cnt').textContent = `${ev.cleanNails} / 5`;
  $('res-over-mm').textContent = `${ev.totalOverMm.toFixed(2)}mm`;
  $('res-over-mm').style.color = ev.totalOverMm === 0 ? '#4ade80' : '#fb7185';

  $('res-nails-grid').innerHTML = ev.details.map(d => `
    <div class="nail-res-box">
      <span class="nail-res-name">${d.name}</span>
      <span class="nail-res-pct">${Math.round(d.cov)}%</span>
      <span class="nail-res-tag" style="color:${d.smeared ? '#fb7185' : '#4ade80'}">${d.smeared ? '💧묻음' : '✨깔끔'}</span>
    </div>
  `).join('');

  $('res-nick').value = getSavedNickname();

  STATE.lastFinalRun = {
    gameId: GAME_ID,
    nickname: $('res-nick').value || '익명 네일리스트',
    targetValue: 5,
    actualValue: ev.cleanNails,
    score: ev.score,
    errorMm: ev.totalOverMm,
    rankTitle: ev.rankTitle,
    seed: 1,
    meta: { color: currentPalette.id, avgCov: ev.avgCov },
    evalData: ev,
  };

  // 0.85초 동안 다섯 손톱 빛줄기 줌아웃 장면을 먼저 보여준 뒤 결과 모달 표시
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

// ─── 드래그 스탬프 처리 (빈틈없는 선형 보간 + 수전증 + 옆살 번짐 판정) ───
function applyBrushStrokeAt(rawX, rawS, dt) {
  const curFinger = FINGERS[STATE.fingerIdx];
  const coat = curFinger.coat;
  const dRaw = sdf(rawX, rawS);

  // 옆 살 경계로 다가갈수록 위험도 상승 (0 ~ 100)
  const edgeProx = clamp((dRaw + 2.35) / 2.55, 0, 1);
  STATE.risk = lerp(12, 98, Math.pow(edgeProx, 1.25));
  BGM.setUrgent(STATE.risk >= 75 && !isBreathActive());

  // 수전증(손떨림) 계산
  const tNow = performance.now() * 0.001;
  const breathOn = isBreathActive();
  let shakeAmp = 0.022;
  if (STATE.exhaustTimer > 0) {
    shakeAmp = 0.46;
  } else if (breathOn) {
    shakeAmp = 0.005;
  } else {
    shakeAmp = lerp(0.024, 0.36 * curFinger.spec.jitterMul, Math.pow(edgeProx, 1.55));
  }

  const waveX = shakeAmp * (Math.sin(tNow * 23.0) * 0.65 + Math.cos(tNow * 37.0) * 0.35);
  const waveS = shakeAmp * 0.55 * (Math.cos(tNow * 19.0) * 0.6 + Math.sin(tNow * 29.0) * 0.4);

  const bx = clamp(rawX + waveX, -8.0, 8.0);
  const bs = clamp(rawS + waveS, -0.8, 13.9);
  STATE.curX = bx;
  STATE.curS = bs;

  // 실제 네일샵 3터치 풀컬러 손맛: 부채꼴로 넉넉히 퍼지는 붓폭(2.18~2.35mm) 유지!
  // 숨을 참으면 수전증(손떨림)이 0mm로 딱 멈춰 흰 점선 코앞까지 안 묻히고 한 번에 매끈하게 채울 수 있다.
  const brushA = breathOn ? 2.18 : lerp(2.36, 2.05, sm((dRaw + 1.8) / 1.6));
  const brushB = 0.86;

  // 실제 매니큐어 표면장력 반영:
  // 붓 중심이 흰 점선 바깥(dActual > -0.12mm)으로 밀려나가거나 손떨림으로 크게 흔들릴 때 옆 살(zone 2)로 넘쳐 묻음!
  const dActual = sdf(bx, bs);
  const spill = dActual > -0.12 || (!breathOn && dActual + Math.abs(waveX) * 0.9 > -0.02);

  if (STATE.prevStampX == null) {
    STATE.prevStampX = bx;
    STATE.prevStampS = bs;
    const hitFlesh = coat.stamp(bx, bs, brushA, brushB, STATE.psi, spill);
    coat.ridge(bx, bs, brushA, brushB, STATE.psi, 0.7);
    if (hitFlesh) triggerSmearFeedback(coat);
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

    if (anySmear) triggerSmearFeedback(coat);

    STATE.strokeSfxCooldown -= dt;
    if (dist > 0.08 && STATE.strokeSfxCooldown <= 0) {
      SFX.brushStroke(clamp(dist * 1.4, 0.2, 1.0));
      STATE.strokeSfxCooldown = 0.085;
    }
  }

  coat.upload();

  // 무결점 99.4% 달성 축하 팝업 (손톱당 1회)
  if (!STATE.perfectShown[STATE.fingerIdx] && coat.coverPct() >= 99.4 && coat.smearPx === 0) {
    STATE.perfectShown[STATE.fingerIdx] = true;
    SFX.nailShine();
    addPopText('✨ 100% 무결점 풀컬러!', '#fde047');
  }

  updatePlayHUD();
}

function triggerSmearFeedback(coat) {
  coat.smearCount++;
  if (STATE.smearFlash <= 0.15) {
    SFX.smearOops();
    addPopText('💧 삐끗! 옆 살에 묻음!', '#fb7185');
  }
  STATE.smearFlash = 1.1;
}

// ─── 입력 이벤트 바인딩 (멀티터치 드래그 + 숨 참기 홀드/토글 + Space) ───
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
    // 마우스 우클릭은 숨 참기 보조 단축키로 지원
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
      STATE.targetTiltZ = clamp(-nx * 0.34, -0.38, 0.38);
      STATE.targetTiltX = clamp(ny * 0.18, -0.22, 0.22);
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
    if (STATE.prevStampX != null) {
      coat.ridge(STATE.prevStampX, STATE.prevStampS, isBreathActive() ? 1.42 : 1.9, 0.75, STATE.psi, 0.65);
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

// 숨 참기 버튼 (길게 누르면 홀드, 240ms 이내 짧게 탭하면 한 손 조작을 위한 토글 ON/OFF!)
const btnBreath = $('btn-breath');
btnBreath.addEventListener('pointerdown', e => {
  e.preventDefault();
  unlockAudio();
  if (STATE.phase !== 'play' || STATE.exhaustTimer > 0) return;
  STATE.breathDownAt = performance.now();
  if (STATE.breathToggleOn) {
    // 이미 토글로 켜진 상태에서 다시 누르면 즉시 끔
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

// 키보드 Space 단축키 지원 (닉네임 입력창 포커스 시 제외)
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
    if (nextBtn && !nextBtn.disabled) advanceToNextNail();
  }
});

window.addEventListener('keyup', e => {
  if (e.code === 'Space') {
    STATE.breathKeyDown = false;
    updatePlayHUD();
  }
});

// UI 버튼 연결
$('btn-next-nail').addEventListener('click', () => advanceToNextNail());
$('btn-skip-intro').addEventListener('click', () => beginPlayPhase());
$('btn-start').addEventListener('click', () => startIntro());
$('btn-retry').addEventListener('click', () => startIntro());
$('btn-restart-quick').addEventListener('click', () => startIntro());

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
    text: `💅 [${saved.nickname}]님의 손톱 색칠하기 정밀도 ${ev.score.toFixed(1)}점 (무결점 ${ev.cleanNails}/5)! 살에 안 묻히고 이 기록 깰 수 있나요?`,
    url: saved.shareUrl,
  });
});

$('btn-save-img').addEventListener('click', () => {
  if (!STATE.lastFinalRun) return;
  const ev = STATE.lastFinalRun.evalData;
  downloadResultCard({
    gameTitle: '손톱 색칠하기',
    emoji: '💅',
    rankTitle: ev.rankTitle,
    headline: `정밀도 ${ev.score.toFixed(1)}점`,
    subline: `${currentPalette.name} 풀컬러 · ${ev.comment}`,
    stats: [
      { label: '평균 채움률', value: `${ev.avgCov.toFixed(1)}%`, color: '#fde047' },
      { label: '무결점 손톱', value: `${ev.cleanNails} / 5`, color: '#4ade80' },
      { label: '살 삐져나감', value: `${ev.totalOverMm.toFixed(2)}mm`, color: ev.totalOverMm === 0 ? '#4ade80' : '#fb7185' },
    ],
    extraCanvas: glCanvas,
  });
});

// ─── 2D 오버레이 렌더링 (인트로 캡션 · 붓 정밀 링 · 팝업 텍스트) ───
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

  // 1) 인트로 3컷 하드컷 자막
  if (STATE.phase === 'intro') {
    const t = STATE.introTime;
    let line1 = '', line2 = '';
    if (t < 0.95) {
      line1 = '어서 오세요, 404 네일살롱입니다 💅';
      line2 = `오늘의 선택 컬러: ${currentPalette.name}`;
    } else if (t < 1.95) {
      line1 = '살에 한 방울만 묻어도 절대 못 지워요!';
      line2 = '붓이 지나간 자국이 다섯 손가락에 그대로 남습니다';
    } else {
      line1 = '테두리에선 [😤 숨 참기]로 수전증을 멈추세요!';
      line2 = '흰 점선 안쪽까지 영롱하게 채우면 성공!';
    }

    const boxW = Math.min(w - 32, 380);
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
    ovCtx.font = '900 16px "Pretendard","Apple SD Gothic Neo",sans-serif';
    ovCtx.fillText(line1, w / 2, boxY + 27);
    ovCtx.fillStyle = '#fda4af';
    ovCtx.font = '700 12.5px "Pretendard","Apple SD Gothic Neo",sans-serif';
    ovCtx.fillText(line2, w / 2, boxY + 49);
  }

  // 2) 플레이 중 붓끝 위치 정밀 가이드 링 (숨 참기 시 파란 집중 링, 위험 시 주황/빨강 링)
  if (STATE.phase === 'play' && STATE.painting) {
    const fg = FINGERS[STATE.fingerIdx].group;
    _projV.set(STATE.curX, surfTop(STATE.curX, STATE.curS) + 0.12, STATE.curS);
    fg.localToWorld(_projV);
    _projV.project(CAM);
    const sx = (_projV.x + 1) * 0.5 * w;
    const sy = (1 - _projV.y) * 0.5 * h;

    const breathOn = isBreathActive();
    const ringR = breathOn ? 16 : 22;
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
          : 'rgba(255, 255, 255, 0.45)';
    if (!breathOn) ovCtx.setLineDash([4, 4]);
    ovCtx.stroke();
    ovCtx.restore();
  }

  // 3) 피드백 플로팅 텍스트
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
    // 시작 모달 배경: 다섯 손가락과 매니큐어 병이 부드럽게 회전하는 살롱 뷰
    const t = now * 0.001;
    CAM.position.set(Math.sin(t * 0.35) * 26, 175, 165);
    CAM.lookAt(0, 6, -18);
    BRUSH_ROOT.visible = false;
  } else if (STATE.phase === 'intro') {
    STATE.introTime += dt;
    const t = STATE.introTime;

    if (t < 0.95) {
      // CUT 1: 네일살롱 진열된 병들과 벨벳 쿠션 위의 손 전체 샷 (하드컷!)
      HAND_RIG.visible = true;
      DECO_BOTTLES.visible = true;
      CAM.position.set(-18 + t * 14, 115, 148);
      CAM.lookAt(-4, 8, -36);
      BRUSH_ROOT.visible = false;
      MAIN_BOTTLE.position.set(-48, 0, 14);
    } else if (t < 1.95) {
      // CUT 2: 선택한 매니큐어 병에서 촉촉한 붓이 스르륵 들려 나오는 단독 클로즈업 (하드컷!)
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
      setBrushLocal({
        x: 0, s: 0, lift: 4.0, a: 1.6, b: 0.75, psi: 0,
        A: axisUp, onSurface: false, drop: 1.08,
      });
      orientGroup(TOOL, V(0, liftY + LB, 0), axisUp);
      bristleMesh.position.set(0, liftY - surfTop(0, 0) - 4.0, 0);
      blobMesh.position.y += liftY - surfTop(0, 0) - 4.0;

      CAM.position.set(14, 42, 122);
      CAM.lookAt(0, 24, 0);
    } else if (t < 2.85) {
      // CUT 3: 다섯 손가락 위로 카메라가 내려오며 ①번 엄지로 줌인!
      HAND_RIG.visible = true;
      ARMREST.visible = true;
      DECO_BOTTLES.visible = true;
      bristleMesh.position.set(0, 0, 0);
      MAIN_BOTTLE.position.set(-56, 0, 18);
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
      MAIN_BOTTLE.position.set(-56, 0, 18);
      camCurPos.copy(camGoalPos);
      camCurLook.copy(camGoalLook);
      beginPlayPhase();
    }
  } else if (STATE.phase === 'play') {
    // 숨 게이지 업데이트
    if (STATE.exhaustTimer > 0) {
      STATE.exhaustTimer = Math.max(0, STATE.exhaustTimer - dt);
      STATE.breath = Math.min(100, STATE.breath + dt * 36);
      updatePlayHUD();
    } else if (isBreathActive()) {
      STATE.breath = Math.max(0, STATE.breath - dt * 22.5);
      if (STATE.breath <= 0) {
        // 숨 바닥! "푸하헉!" 손 흔들림 발동
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

    // 드래그 중 한 자리에 머물러 있어도 수전증이 반영되도록 지속 갱신
    if (STATE.painting) {
      applyBrushStrokeAt(STATE.rawX, STATE.rawS, dt);
    }

    // 카메라 스무딩
    const camFollow = 1 - Math.exp(-dt * 8.5);
    camCurPos.lerp(camGoalPos, camFollow);
    camCurLook.lerp(camGoalLook, camFollow);
    CAM.position.copy(camCurPos);
    CAM.lookAt(camCurLook);

    // 브러시 루트를 현재 칠하는 손가락 로컬 공간과 동기화
    const activeFinger = FINGERS[STATE.fingerIdx];
    activeFinger.group.updateMatrixWorld(true);
    BRUSH_ROOT.visible = true;
    bristleMesh.position.set(0, 0, 0);
    BRUSH_ROOT.position.copy(activeFinger.group.position);
    BRUSH_ROOT.quaternion.copy(activeFinger.group.quaternion);
    BRUSH_ROOT.scale.copy(activeFinger.group.scale);

    STATE.lift = lerp(STATE.lift, STATE.targetLift, 1 - Math.exp(-dt * 16));
    const breathOn = isBreathActive();
    setBrushLocal({
      x: STATE.curX,
      s: STATE.curS,
      lift: STATE.lift,
      a: breathOn ? 2.18 : 2.32,
      b: 0.86,
      psi: STATE.psi,
      A: BRUSH_AXIS,
      drop: 0.65,
    });
  } else if (STATE.phase === 'showcase') {
    BRUSH_ROOT.visible = false;
    const t = now * 0.001;
    // 사용자가 드래그하지 않을 때도 은은하게 좌우로 기울어 다섯 손톱 위로 빛줄기가 스윕함!
    const autoZ = STATE.showcaseDragging ? 0 : Math.sin(t * 1.35) * 0.14;
    const autoX = STATE.showcaseDragging ? 0 : Math.cos(t * 0.95) * 0.05;
    STATE.showcaseTiltZ = lerp(STATE.showcaseTiltZ, STATE.targetTiltZ + autoZ, 1 - Math.exp(-dt * 6));
    STATE.showcaseTiltX = lerp(STATE.showcaseTiltX, STATE.targetTiltX + autoX, 1 - Math.exp(-dt * 6));

    HAND_RIG.rotation.z = STATE.showcaseTiltZ;
    HAND_RIG.rotation.x = STATE.showcaseTiltX - 0.04;
    HAND_RIG.position.y = 3.2;

    const camFollow = 1 - Math.exp(-dt * 5.5);
    camCurPos.lerp(camGoalPos, camFollow);
    camCurLook.lerp(camGoalLook, camFollow);
    CAM.position.copy(camCurPos);
    CAM.lookAt(camCurLook);
  }

  R.render(S, CAM);
  drawOverlay(dt);
}

// ─── 리사이즈 대응 ───
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  R.setSize(w, h, false);
  CAM.aspect = w / Math.max(1, h);
  CAM.updateProjectionMatrix();
  if (STATE.phase === 'play') updateCameraGoalForFinger(STATE.fingerIdx, false);
});

// ─── 초기 부팅 (팔레트 UI · 최고 기록 · 지인 도전장 로드 · 접근 제어) ───
async function boot() {
  const access = await enforceGameAccess(GAME_ID);
  if (!access.allowed) return;

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
    const banner = $('rival-banner');
    banner.style.display = 'flex';
    $('rival-banner-text').innerHTML = `🔥 <b>${incoming.nickname}</b>님의 기록: <b>정밀도 ${Number(incoming.score).toFixed(1)}점</b> (무결점 ${Math.round(incoming.actualValue || 0)}/5)`;
    $('nail-hud').classList.add('with-rival');

    const rBox = $('start-rival-box');
    rBox.style.display = 'flex';
    rBox.innerHTML = `
      <div style="font-size:12px;color:#fde68a;font-weight:800">💌 지인이 보낸 네일 정밀도 기록</div>
      <div class="vs-row">
        <span><b>${incoming.nickname}</b>님</span>
        <span style="color:#4ade80;font-weight:900">${Number(incoming.score).toFixed(1)}점 (${incoming.rankTitle || '네일리스트'})</span>
      </div>
    `;
  }

  // 점검용 읽기 상태 노출
  window.__nailState = () => ({
    phase: STATE.phase,
    fingerIdx: STATE.fingerIdx,
    coverPct: Number(FINGERS[STATE.fingerIdx].coat.coverPct().toFixed(1)),
    smearPx: FINGERS[STATE.fingerIdx].coat.smearPx,
    breath: Math.round(STATE.breath),
  });

  requestAnimationFrame(animate);
}

boot();
