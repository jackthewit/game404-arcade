// 케이크 글씨 쓰기 — 이게뭔겜? 404 아케이드
// 1. 4컷 하드컷(Cut-by-Cut) 베이커리 오프닝: 문종 딸랑 입장 → 케이크 고르기 → 빵모자 아저씨 환영(얼굴 눈·코·입 없음!) → 멘트 고민
// 2. 원본 쇼츠(cakeletter)의 3D 생크림 케이크 + 투명 비닐 짤주머니(압력 변형) + 5손가락·손톱·팔뚝·흰 소매
// 3. 리얼 초콜릿 물리: 누르고 머무는 시간에 따라 두께가 통통하게 고이고(혹 형성), 빠르게 그으면 가늘어지며, 뗄 때 쫀득한 초코 실이 늘어나다 '톡!' 끊김
// 4. 5단계 난이도 진화: STAGE 1(하트 1개 ♥) → STAGE 2(축하 ♥) → STAGE 3(생일 축하해) → STAGE 4(우리 행복하자 ♥) → STAGE 5(사랑해 / 오래오래 함께해)

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SFX, BGM, unlockAudio } from '../shared/audio.js';
import { enforceGameAccess } from '../shared/catalog.js';
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

enforceGameAccess('cake');

// ── DOM 참조 ──
const gl = document.getElementById('gl');
const ov = document.getElementById('ov');
const ovCtx = ov.getContext('2d');

const btnBgm = document.getElementById('btn-bgm');
const bestPill = document.getElementById('best-pill');
const rivalBanner = document.getElementById('rival-banner');
const rivalBannerText = document.getElementById('rival-banner-text');

const cakeHud = document.getElementById('cake-hud');
const stageStepsEl = document.getElementById('stage-steps');
const orderKickerEl = document.getElementById('order-kicker');
const orderPhraseEl = document.getElementById('order-phrase');
const spacePillEl = document.getElementById('space-pill');
const thickFillEl = document.getElementById('thick-fill');

const bottomDock = document.getElementById('bottom-dock');
const guideChipEl = document.getElementById('guide-chip');
const btnFinish = document.getElementById('btn-finish');
const btnSkipIntro = document.getElementById('btn-skip-intro');

const startModal = document.getElementById('start-modal');
const startBestEl = document.getElementById('start-best');
const startRivalBox = document.getElementById('start-rival-box');
const btnStart = document.getElementById('btn-start');

const resultModal = document.getElementById('result-modal');
const resRankEl = document.getElementById('res-rank');
const resHeadlineEl = document.getElementById('res-headline');
const resCommentEl = document.getElementById('res-comment');
const resStageEl = document.getElementById('res-stage');
const resAccEl = document.getElementById('res-acc');
const resScoreEl = document.getElementById('res-score');
const resVsWrap = document.getElementById('res-vs-wrap');
const resLbWrap = document.getElementById('res-lb-wrap');
const resNickInput = document.getElementById('res-nick');
const btnShare = document.getElementById('btn-share');
const btnSaveImg = document.getElementById('btn-save-img');
const btnRetry = document.getElementById('btn-retry');

// ── 수학 도우미 ──
const TAU = Math.PI * 2;
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = k => { const c = clamp(k, 0, 1); return c * c * (3 - 2 * c); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ── 5단계 난이도 스테이지 설정 ──
const STAGES = [
  {
    no: 1,
    chip: '1. ♥',
    kicker: 'STAGE 1 · 첫 손님 서비스 (매우 쉬움)',
    phrase: '♥',
    lines: ['♥'],
    cakeScale: 1.0,
    guideAlpha: 0.24,
    fontScale: 0.56,
    charSlots: 1,
    tip: '가운데 예쁜 하트 1개! 누르고 머물면 초코가 통통해지고, 떼면 실이 늘어나요!',
  },
  {
    no: 2,
    chip: '2. 축하♥',
    kicker: 'STAGE 2 · 단골 손님 주문 (쉬움)',
    phrase: '축하 ♥',
    lines: ['축하 ♥'],
    cakeScale: 1.0,
    guideAlpha: 0.19,
    fontScale: 0.34,
    charSlots: 3,
    tip: '두 글자와 하트! 획 끝에서 살짝 떼어 깔끔하게 마무리해 보세요.',
  },
  {
    no: 3,
    chip: '3. 생일축하해',
    kicker: 'STAGE 3 · 쇼츠 레전드 구간 (보통)',
    phrase: '생일 축하해',
    lines: ['생일 축하해'],
    cakeScale: 1.0,
    guideAlpha: 0.14,
    fontScale: 0.245,
    charSlots: 5,
    tip: '앞의 「생일」을 너무 크게 쓰면 오른쪽 자리가 모자라요! 남은 자리를 꼭 보세요!',
  },
  {
    no: 4,
    chip: '4. 행복하자',
    kicker: 'STAGE 4 · 미니 홀케이크 (어려움)',
    phrase: '우리 행복하자 ♥',
    lines: ['우리 행복하자 ♥'],
    cakeScale: 0.88,
    guideAlpha: 0.11,
    fontScale: 0.195,
    charSlots: 7,
    tip: '케이크가 작아졌어요! 빠르게 스윽 그어야 초코 줄이 얇고 날렵하게 나와요!',
  },
  {
    no: 5,
    chip: '5. 도시락보스',
    kicker: 'STAGE 5 · 초소형 도시락 케이크 (최종 보스)',
    phrase: '사랑해 / 오래오래 함께해',
    lines: ['사랑해 ♥', '오래오래 함께해'],
    cakeScale: 0.78,
    guideAlpha: 0.09,
    fontScale: 0.18,
    charSlots: 8,
    tip: '전설의 파티시에 시험! 작은 도시락 케이크에 두 줄로 삐져나가지 않게 써 보세요!',
  },
];

// ── Three.js 렌더러 & 씬 초기화 ──
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.03;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const DESK_COLOR = '#b9d9d4';
const INTRO_BG_COLOR = '#f7efe4';
scene.background = new THREE.Color(DESK_COLOR);

{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
}

const camera = new THREE.PerspectiveCamera(28, 1, 2, 400);

// 조명
const keyLight = new THREE.DirectionalLight('#fff9f0', 2.35);
keyLight.position.set(-20, 44, 18);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0005;
keyLight.shadow.normalBias = 0.03;
{
  const c = keyLight.shadow.camera;
  c.left = -26; c.right = 28; c.top = 28; c.bottom = -26; c.near = 5; c.far = 110;
  c.updateProjectionMatrix();
}
scene.add(keyLight, keyLight.target);
scene.add(new THREE.HemisphereLight('#ffffff', '#d8e5e2', 0.65));
const fillLight = new THREE.DirectionalLight('#eef6ff', 0.52);
fillLight.position.set(22, 20, 28);
scene.add(fillLight);

// ── 캔버스 텍스처 유틸 ──
function makeCanvasTex(w, h, drawFn, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawFn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ── 3D 튜브 생성기 (원본 cakeletter의 도톰하고 매끈한 관 지오메트리) ──
const UP_Y = V(0, 1, 0);
function buildTubeGeo(P, rad, M = 12, ref = UP_Y, sq = 0.86, lift = 0.45) {
  const n = P.length;
  const pos = new Float32Array(n * M * 3);
  const nor = new Float32Array(n * M * 3);
  const T = V(), N = V(), B = V();

  for (let i = 0; i < n; i++) {
    T.copy(P[Math.min(n - 1, i + 1)]).sub(P[Math.max(0, i - 1)]);
    if (T.lengthSq() < 1e-8) T.set(1, 0, 0);
    else T.normalize();

    N.crossVectors(T, ref);
    if (N.lengthSq() < 1e-6) N.set(0, 0, 1);
    else N.normalize();
    B.crossVectors(N, T).normalize();

    const r = rad[i];
    for (let j = 0; j < M; j++) {
      const a = (j / M) * TAU;
      const c = Math.cos(a), s = Math.sin(a);
      const o = (i * M + j) * 3;
      pos[o] = P[i].x + N.x * c * r + B.x * (s * sq + lift) * r;
      pos[o + 1] = P[i].y + N.y * c * r + B.y * (s * sq + lift) * r;
      pos[o + 2] = P[i].z + N.z * c * r + B.z * (s * sq + lift) * r;
      nor[o] = N.x * c + B.x * s;
      nor[o + 1] = N.y * c + B.y * s;
      nor[o + 2] = N.z * c + B.z * s;
    }
  }

  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      const c = a + M;
      const d = b + M;
      idx.push(a, c, b, b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

function linkCyl(mesh, a, b, r) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  const d = b.clone().sub(a);
  const L = Math.max(0.001, d.length());
  mesh.scale.set(r, L, r);
  mesh.quaternion.setFromUnitVectors(UP_Y, d.normalize());
}

// ── 본 게임 작업대 & 3D 생크림 케이크 (원본 cakeletter 모델링 계승) ──
const RC = 12.8;   // 케이크 전체 반지름 (cm)
const RIN = 11.0;  // 로제트 안쪽 유효 반지름 (cm, 지름 22.0cm)
const HC = 8.4;    // 케이크 높이
const DESK_Y = -13.6;

const mainWorld = new THREE.Group();
scene.add(mainWorld);

const deskMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(360, 360),
  new THREE.MeshStandardMaterial({ color: DESK_COLOR, roughness: 0.92, metalness: 0 })
);
deskMesh.rotation.x = -Math.PI / 2;
deskMesh.position.y = DESK_Y;
deskMesh.receiveShadow = true;
mainWorld.add(deskMesh);

const cakeRoot = new THREE.Group();
mainWorld.add(cakeRoot);

// 생크림 결 범프 텍스처
const creamBump = makeCanvasTex(512, 512, (g, w, h) => {
  const im = g.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const side = v > 0.52 ? 1 : 0;
      const f = side ? 140 : 220, amp = side ? 30 : 15;
      let val = 128 + amp * Math.sin(v * f + 1.3 * Math.sin(u * TAU * 3)) + 4 * (rnd(x * 0.37 + y * 91.7) - 0.5);
      const o = (y * w + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = val;
      d[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
}, false);
creamBump.wrapS = THREE.RepeatWrapping;

const creamMat = new THREE.MeshPhysicalMaterial({
  color: '#fffcf6',
  roughness: 0.48,
  metalness: 0,
  bumpMap: creamBump,
  bumpScale: 0.95,
  sheen: 0.45,
  sheenColor: new THREE.Color('#fff3dd'),
  sheenRoughness: 0.6,
});
const creamPipingMat = new THREE.MeshPhysicalMaterial({
  color: '#fffaf0',
  roughness: 0.4,
  metalness: 0,
  sheen: 0.4,
  sheenColor: new THREE.Color('#fff4e0'),
});
const chocoMat = new THREE.MeshPhysicalMaterial({
  color: '#3f1c0b',
  roughness: 0.18,
  metalness: 0.02,
  clearcoat: 1.0,
  clearcoatRoughness: 0.06,
  envMapIntensity: 1.35,
});

// 케이크 몸통 (Lathe 곡면)
{
  const pts = [];
  const rr = 0.88;
  for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector2(((RC - rr) * i) / 12, 0));
  for (let i = 1; i <= 7; i++) {
    const a = (Math.PI / 2) * (1 - i / 7);
    pts.push(new THREE.Vector2(RC - rr + rr * Math.cos(a), -rr + rr * Math.sin(a)));
  }
  for (let i = 1; i <= 18; i++) pts.push(new THREE.Vector2(RC, -rr - ((HC - rr) * i) / 18));
  pts.reverse();
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), creamMat);
  body.castShadow = true;
  body.receiveShadow = true;
  cakeRoot.add(body);
}

// 별깍지 생크림 로제트 38개
function makeRosetteGeo() {
  const rings = 14, segs = 24, pos = [], idx = [];
  const rr0 = 0.96;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const y = -0.14 + 1.68 * t;
    const base = rr0 * Math.pow(1 - t, 0.62) * (1 + 0.12 * Math.sin(t * Math.PI));
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * TAU;
      const r = base * (1 - 0.11 * (1 - t) * (0.5 + 0.5 * Math.cos(6 * (a + 1.5 * t))));
      pos.push(Math.cos(a) * r + 0.2 * t * t, y, Math.sin(a) * r);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * segs + j, b = i * segs + ((j + 1) % segs);
      const c = a + segs, d = b + segs;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
{
  const NR = 38;
  const roseR = RIN + 0.96;
  const im = new THREE.InstancedMesh(makeRosetteGeo(), creamPipingMat, NR);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < NR; i++) {
    const a = (i / NR) * TAU;
    dummy.position.set(Math.cos(a) * roseR, 0, Math.sin(a) * roseR);
    dummy.rotation.set(0, -a + rnd(i) * 0.45, 0);
    dummy.scale.set(1, 0.94 + 0.12 * rnd(i + 9), 1);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }
  im.castShadow = true;
  im.receiveShadow = true;
  cakeRoot.add(im);
}

// 하단 생크림 구슬 테두리 56개
{
  const n = 56;
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.68, 14, 10), creamPipingMat, n);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    dummy.position.set(Math.cos(a) * (RC + 0.22), -HC + 0.52, Math.sin(a) * (RC + 0.22));
    dummy.scale.set(1, 0.9, 1);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }
  im.castShadow = true;
  cakeRoot.add(im);
}

// 금빛 케이크 받침판 & 흰 돌림판
{
  const goldMat = new THREE.MeshStandardMaterial({ color: '#e9d3a2', roughness: 0.36, metalness: 0.58 });
  const board = new THREE.Mesh(new THREE.CylinderGeometry(14.0, 14.0, 0.35, 80), goldMat);
  board.position.y = -HC - 0.175;
  board.castShadow = true;
  board.receiveShadow = true;
  cakeRoot.add(board);

  const standMat = new THREE.MeshPhysicalMaterial({ color: '#f7f7f5', roughness: 0.34, clearcoat: 0.5 });
  const pts = [
    [0, 0], [14.9, 0], [15.2, -0.25], [15.2, -0.88], [14.6, -1.22],
    [6.0, -1.48], [4.2, -2.1], [3.8, -3.5], [7.5, -4.2], [9.6, -4.55], [9.8, -5.0], [0, -5.0],
  ].map(p => new THREE.Vector2(p[0], p[1])).reverse();
  const stand = new THREE.Mesh(new THREE.LatheGeometry(pts, 80), standMat);
  stand.position.y = -HC - 0.35;
  stand.castShadow = true;
  stand.receiveShadow = true;
  cakeRoot.add(stand);
}

// 케이크 윗면 은은한 크림 밑그림 가이드 메쉬 + 오른쪽 공간 부족 점선 경고 칸
const guideCanvas = document.createElement('canvas');
guideCanvas.width = 1024;
guideCanvas.height = 1024;
const guideCtx = guideCanvas.getContext('2d');
const guideTex = new THREE.CanvasTexture(guideCanvas);
guideTex.colorSpace = THREE.SRGBColorSpace;

const guidePlane = new THREE.Mesh(
  new THREE.PlaneGeometry(RIN * 2, RIN * 2),
  new THREE.MeshBasicMaterial({ map: guideTex, transparent: true, opacity: 1, depthWrite: false })
);
guidePlane.rotation.x = -Math.PI / 2;
guidePlane.position.y = 0.025;
guidePlane.renderOrder = 1;
cakeRoot.add(guidePlane);

// 오른쪽 여백 부족 시 뜨는 주황 점선 경고 상자 (원본 쇼츠 오마주!)
const warnBoxTex = makeCanvasTex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = '#ff8a1e';
  g.lineWidth = 14;
  g.setLineDash([26, 20]);
  g.lineCap = 'round';
  g.strokeRect(14, 14, w - 28, h - 28);
});
const warnBoxes = [0, 1, 2].map(() => {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 3.2),
    new THREE.MeshBasicMaterial({ map: warnBoxTex, transparent: true, opacity: 0, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.035;
  m.renderOrder = 2;
  m.visible = false;
  cakeRoot.add(m);
  return m;
});

// 3D 초콜릿 획들이 담기는 그룹 (케이크와 함께 돎)
const strokesGroup = new THREE.Group();
cakeRoot.add(strokesGroup);

// 짜는 중인 초코 머리 방울 + 노즐→케이크 연결 쫀득 액체 기둥 + 뗄 때 늘어나는 초코 실들
const activeHeadMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), chocoMat);
activeHeadMesh.visible = false;
activeHeadMesh.castShadow = true;
cakeRoot.add(activeHeadMesh);

const liveStreamMesh = new THREE.Mesh(new THREE.BufferGeometry(), chocoMat);
liveStreamMesh.visible = false;
liveStreamMesh.castShadow = true;
mainWorld.add(liveStreamMesh);

const stretchyThreadsGroup = new THREE.Group();
mainWorld.add(stretchyThreadsGroup);
const stretchyThreads = [];

// ── 원본 쇼츠의 3D 초코 짤주머니 펜 + 5손가락·손톱·팔뚝·흰 소매 (실시간 압력 변형!) ──
const penGroup = new THREE.Group();
mainWorld.add(penGroup);

const PROF = [
  [0, 0.18], [0.6, 0.28], [2, 0.54], [4, 0.88], [6, 1.24],
  [8, 1.54], [10, 1.7], [11.5, 1.68], [12.6, 1.28], [13.3, 0.78], [14, 0.48], [15, 0.4], [16, 0.5],
];
const GY = 9.2, BAG_LEN = 16;

function bagRadiusAt(y, g) {
  let r = PROF[PROF.length - 1][1];
  for (let i = 1; i < PROF.length; i++) {
    if (y <= PROF[i][0]) {
      const a = PROF[i - 1], b = PROF[i];
      r = lerp(a[1], b[1], (y - a[0]) / (b[0] - a[0]));
      break;
    }
  }
  // 쥐는 힘(g)이 세질수록 손아귀 부분(GY)은 오목하게 눌리고 위아래로 초코가 밀려 볼록해짐!
  return r * (
    1
    - 0.36 * g * Math.exp(-Math.pow((y - GY) / 2.2, 2))
    + 0.17 * g * Math.exp(-Math.pow(y - 5.0, 2) / 2.2)
    + 0.2 * g * Math.exp(-Math.pow(y - 12.7, 2) / 0.9)
  );
}

const bagMat = new THREE.MeshPhysicalMaterial({
  color: '#ffffff',
  roughness: 0.1,
  transparent: true,
  opacity: 0.22,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  depthWrite: false,
  envMapIntensity: 2.1,
});
const bagMesh = new THREE.Mesh(new THREE.BufferGeometry(), bagMat);
const fillMesh = new THREE.Mesh(new THREE.BufferGeometry(), chocoMat);
bagMesh.renderOrder = 3;
fillMesh.castShadow = true;
penGroup.add(fillMesh, bagMesh);

const bagTailMat = new THREE.MeshPhysicalMaterial({
  color: '#fbfbfb',
  roughness: 0.22,
  transparent: true,
  opacity: 0.86,
  clearcoat: 0.8,
});
const bagTailMesh = new THREE.Mesh(new THREE.BufferGeometry(), bagTailMat);
bagTailMesh.castShadow = true;
penGroup.add(bagTailMesh);

// 비닐 매듭 고무줄 포인트
const tieRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.46, 0.1, 10, 24),
  new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.45 })
);
tieRing.rotation.x = Math.PI / 2;
tieRing.position.y = 13.45;
penGroup.add(tieRing);

const skinMat = new THREE.MeshPhysicalMaterial({
  color: '#f2c6a5',
  roughness: 0.56,
  sheen: 0.35,
  sheenColor: new THREE.Color('#ff9f86'),
  sheenRoughness: 0.5,
});
const nailMat = new THREE.MeshPhysicalMaterial({ color: '#fae0d3', roughness: 0.25, clearcoat: 0.6 });

const DEG = Math.PI / 180;
const FINGERS = [
  { y: 11.3, rf: 0.76, a0: -18, a1: -212, dy: -0.6 },
  { y: 9.85, rf: 0.79, a0: -20, a1: -220, dy: -0.5 },
  { y: 8.4, rf: 0.74, a0: -20, a1: -214, dy: -0.4 },
  { y: 7.1, rf: 0.63, a0: -16, a1: -200, dy: -0.25 },
  { y: 12.5, rf: 0.9, a0: 46, a1: 150, dy: 0.35, thumb: 1 },
];
for (const f of FINGERS) {
  f.mesh = new THREE.Mesh(new THREE.BufferGeometry(), skinMat);
  f.mesh.castShadow = true;
  penGroup.add(f.mesh);
  f.nail = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), nailMat);
  penGroup.add(f.nail);
  f.knuck = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinMat);
  f.knuck.castShadow = true;
  penGroup.add(f.knuck);
}
const palmMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), skinMat);
const thenarMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), skinMat);
const heelMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), skinMat);
palmMesh.castShadow = thenarMesh.castShadow = heelMesh.castShadow = true;
penGroup.add(palmMesh, thenarMesh, heelMesh);

const nozzleDropMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), chocoMat);
penGroup.add(nozzleDropMesh);

const foreArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 0.86, 1, 20), skinMat);
const sleeveMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 1, 20),
  new THREE.MeshStandardMaterial({ color: '#fbfbf8', roughness: 0.84 })
);
const cuffMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 1, 20),
  new THREE.MeshStandardMaterial({ color: '#ebeeec', roughness: 0.78 })
);
[foreArmMesh, sleeveMesh, cuffMesh].forEach(m => {
  m.castShadow = true;
  mainWorld.add(m);
});

{
  // 비닐 꼬리 초기화
  const P = [], rad = [];
  for (let i = 0; i <= 14; i++) {
    const k = i / 14, y = 13.15 + 2.5 * k;
    P.push(V(0.25 * k * k, y, -0.4 * k * k));
    rad.push(k < 0.14 ? lerp(0.66, 0.36, k / 0.14) : lerp(0.34, 0.85, Math.pow((k - 0.14) / 0.86, 1.3)));
  }
  bagTailMesh.geometry = buildTubeGeo(P, rad, 12, V(1, 0, 0), 0.44, 0);
}

let lastBuiltGrip = -999;
const _basisX = V(), _basisY = V(), _basisZ = V(), _mat4 = new THREE.Matrix4();
const _wristW = V(), _elbowW = V(), _tmpA = V(), _tmpB = V();
const ELB_DIR = V(0.52, 0.24, 0.82).normalize();
const polVec = (rho, th, y) => V(rho * Math.cos(th), y, rho * Math.sin(th));

function buildLathe(fn, y0, y1, segs) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const y = lerp(y0, y1, i / segs);
    pts.push(new THREE.Vector2(Math.max(0.002, fn(y)), y));
  }
  pts.push(new THREE.Vector2(0.001, y1));
  return new THREE.LatheGeometry(pts, 26);
}

function updatePenAndHand(tipWorld, axisDir, grip, dropRadius = 0.14) {
  _basisY.copy(axisDir).normalize();
  _basisX.set(0.72, 0.7, 0).addScaledVector(_basisY, -0.72 * _basisY.x - 0.7 * _basisY.y).normalize();
  _basisZ.crossVectors(_basisX, _basisY);
  _mat4.makeBasis(_basisX, _basisY, _basisZ);
  penGroup.quaternion.setFromRotationMatrix(_mat4);
  penGroup.position.copy(tipWorld);

  // 압력이 의미 있게 변했을 때만 지오메트리 재계산 (60fps 쾌적 유지)
  if (Math.abs(grip - lastBuiltGrip) > 0.018) {
    lastBuiltGrip = grip;
    bagMesh.geometry.dispose();
    bagMesh.geometry = buildLathe(y => bagRadiusAt(y, grip), 0, BAG_LEN, 44);
    fillMesh.geometry.dispose();
    fillMesh.geometry = buildLathe(y => bagRadiusAt(y, grip) - 0.045, 0.02, 13.25, 34);

    const NP = 20;
    for (const f of FINGERS) {
      const P = [], rad = [];
      const a1 = f.a1 + (f.thumb ? 14 : -17) * grip;
      for (let i = 0; i < NP; i++) {
        const k = i / (NP - 1);
        const y = f.y - 0.3 * grip + f.dy * k;
        const th = lerp(f.a0, a1, k) * DEG;
        const rho = bagRadiusAt(y, grip) + f.rf * 0.9 + 0.55 * Math.pow(1 - k, 2);
        P.push(polVec(rho, th, y));
        let q = f.rf * (1 - 0.16 * k);
        if (k > 0.88) q *= Math.sqrt(Math.max(0.03, 1 - Math.pow((k - 0.88) / 0.12, 2)));
        rad.push(q);
      }
      f.mesh.geometry.dispose();
      f.mesh.geometry = buildTubeGeo(P, rad, 10, UP_Y, 1, 0);

      const kn = 0.86;
      const y = f.y - 0.3 * grip + f.dy * kn;
      const th = lerp(f.a0, a1, kn) * DEG;
      const rho = bagRadiusAt(y, grip) + f.rf * 0.9 + 0.55 * Math.pow(1 - kn, 2);
      f.nail.position.copy(polVec(rho + f.rf * 0.62, th, y));
      f.nail.rotation.set(0, -th, 0);
      f.nail.scale.set(0.16, f.rf * 0.6, f.rf * 0.66);
      f.knuck.position.copy(P[0]);
      f.knuck.scale.setScalar(f.rf * 1.12);
    }

    const pr = bagRadiusAt(GY, grip) + 1.4, pt = 12 * DEG;
    palmMesh.position.copy(polVec(pr, pt, GY + 0.1));
    palmMesh.rotation.set(0, -pt, 0);
    palmMesh.scale.set(1.55, 3.2, 2.7);

    const tt = 36 * DEG;
    thenarMesh.position.copy(polVec(bagRadiusAt(11.6, grip) + 1.25, tt, 11.2));
    thenarMesh.rotation.set(0, -tt, 0);
    thenarMesh.scale.set(1.35, 1.8, 1.6);

    const ht = 24 * DEG;
    heelMesh.position.copy(polVec(pr + 1.5, ht, GY + 0.2));
    heelMesh.rotation.set(0, -ht, 0);
    heelMesh.scale.set(1.75, 2.3, 2.0);
  }

  nozzleDropMesh.scale.setScalar(dropRadius);
  nozzleDropMesh.position.set(0, 0.03, 0);

  // 손목 → 팔뚝 → 흰 소매 연결
  const pr = bagRadiusAt(GY, grip) + 1.4;
  penGroup.updateMatrixWorld(true);
  _wristW.copy(polVec(pr + 2.4, 26 * DEG, GY + 0.3));
  penGroup.localToWorld(_wristW);
  _elbowW.copy(_wristW).addScaledVector(ELB_DIR, 56);
  _tmpA.copy(_wristW).lerp(_elbowW, 0.17);
  linkCyl(foreArmMesh, _wristW, _tmpA, 1.88);
  foreArmMesh.scale.z = 1.52;

  _tmpB.copy(_wristW).lerp(_elbowW, 0.12);
  linkCyl(sleeveMesh, _tmpB, _elbowW, 2.72);
  sleeveMesh.scale.z = 2.38;
  _tmpA.copy(_wristW).lerp(_elbowW, 0.155);
  linkCyl(cuffMesh, _tmpB, _tmpA, 2.92);
  cuffMesh.scale.z = 2.58;
}

// ── 4컷 하드컷(Cut-by-Cut) 베이커리 오프닝 세트 (눈·코·입 없는 빵모자 아저씨 + 유리문 + 쇼케이스) ──
const introWorld = new THREE.Group();
introWorld.visible = false;
scene.add(introWorld);

const introRefs = {};
{
  // 따뜻한 베이커리 바닥 & 크림색 벽
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: '#e6cfb3', roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -8;
  floor.receiveShadow = true;
  introWorld.add(floor);

  // CUT 1: 가게 문 + 문종 그룹
  const doorScene = new THREE.Group();
  introWorld.add(doorScene);
  introRefs.doorScene = doorScene;

  const shopWall = new THREE.Mesh(
    new THREE.BoxGeometry(36, 26, 1.2),
    new THREE.MeshStandardMaterial({ color: '#fff8ec', roughness: 0.85 })
  );
  shopWall.position.set(0, 4, -6);
  doorScene.add(shopWall);

  // 민트·크림 줄무늬 어닝(차양) + 나무 간판 + 양옆 화분
  for (let i = -5; i <= 5; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.55, 4.4),
      new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? '#6ec4b5' : '#fffdf7', roughness: 0.65 })
    );
    stripe.position.set(i * 2.2, 11.4, -3.5);
    stripe.rotation.x = 0.38;
    doorScene.add(stripe);
  }
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 2.5, 0.5),
    new THREE.MeshStandardMaterial({ color: '#5c3419', roughness: 0.6 })
  );
  signBoard.position.set(0, 14.4, -5.2);
  doorScene.add(signBoard);
  for (const sx of [-8.2, 8.2]) {
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 0.95, 2.2, 16),
      new THREE.MeshStandardMaterial({ color: '#c86d44', roughness: 0.75 })
    );
    pot.position.set(sx, -6.9, -3.6);
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(1.75, 16, 12),
      new THREE.MeshStandardMaterial({ color: '#4d9b62', roughness: 0.7 })
    );
    bush.position.set(sx, -4.8, -3.6);
    doorScene.add(pot, bush);
  }

  // 회전하는 원목 유리문 피벗
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-4.2, -8, -5.2);
  doorScene.add(doorPivot);
  introRefs.doorPivot = doorPivot;

  const doorFrame = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 17.5, 0.55),
    new THREE.MeshStandardMaterial({ color: '#b07946', roughness: 0.62 })
  );
  doorFrame.position.set(4.2, 8.75, 0);
  doorPivot.add(doorFrame);

  const doorGlass = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 11.2, 0.62),
    new THREE.MeshPhysicalMaterial({ color: '#dff5f2', roughness: 0.12, transmission: 0.55, transparent: true, opacity: 0.72 })
  );
  doorGlass.position.set(4.2, 10.2, 0);
  doorPivot.add(doorGlass);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 2.2, 14),
    new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.25, metalness: 0.8 })
  );
  handle.position.set(7.3, 8.2, 0.5);
  doorPivot.add(handle);

  // 금빛 문종 ("딸랑~!")
  const bellPivot = new THREE.Group();
  bellPivot.position.set(6.4, 15.2, 0.65);
  doorPivot.add(bellPivot);
  introRefs.bellPivot = bellPivot;
  const bellCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.75, 1.25, 20),
    new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.22, metalness: 0.85 })
  );
  bellCone.position.y = -0.6;
  bellPivot.add(bellCone);

  // CUT 2 & CUT 3 공용: 베이커리 카운터 & 진열장 & 빵모자 아저씨
  const shopInterior = new THREE.Group();
  introWorld.add(shopInterior);
  introRefs.shopInterior = shopInterior;

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 46),
    new THREE.MeshStandardMaterial({ color: '#f9efe2', roughness: 0.9 })
  );
  backWall.position.set(0, 10, -14);
  shopInterior.add(backWall);

  // 원목 쇼케이스 카운터
  const counter = new THREE.Mesh(
    new THREE.BoxGeometry(28, 7.2, 7.5),
    new THREE.MeshStandardMaterial({ color: '#c69260', roughness: 0.68 })
  );
  counter.position.set(0, -4.4, -2.5);
  counter.receiveShadow = true;
  shopInterior.add(counter);

  const glassCase = new THREE.Mesh(
    new THREE.BoxGeometry(24, 5.6, 6.4),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, transparent: true, opacity: 0.24, clearcoat: 1 })
  );
  glassCase.position.set(0, 2.0, -2.5);
  shopInterior.add(glassCase);

  // 진열장 속 케이크 3종 (왼쪽 초코, 가운데 순백 생크림, 오른쪽 핑크 베리 — 한 화면에 나란히!)
  const cakeColors = ['#5c2c16', '#fffcf5', '#f9a8d4'];
  introRefs.displayCakes = cakeColors.map((col, idx) => {
    const cg = new THREE.Group();
    cg.position.set((idx - 1) * 4.9, -0.3, -2.5);
    const pl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.15, 0.18, 32),
      new THREE.MeshStandardMaterial({ color: '#e9d3a2', metalness: 0.6, roughness: 0.3 })
    );
    const ck = new THREE.Mesh(
      new THREE.CylinderGeometry(1.85, 1.85, 1.65, 36),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 })
    );
    ck.position.y = 0.9;
    ck.castShadow = true;
    cg.add(pl, ck);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      const d = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        new THREE.MeshStandardMaterial({ color: idx === 0 ? '#8c4f27' : '#ffffff', roughness: 0.4 })
      );
      d.position.set(Math.cos(a) * 1.52, 1.8, Math.sin(a) * 1.52);
      cg.add(d);
    }
    shopInterior.add(cg);
    return cg;
  });

  // 케이크를 가리키는 플레이어 오른손 (CUT 2 — 손가락과 소매가 한눈에 보이게)
  const pointHand = new THREE.Group();
  shopInterior.add(pointHand);
  introRefs.pointHand = pointHand;
  const pPalm = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 14), skinMat);
  pPalm.scale.set(1.0, 0.68, 1.12);
  const pIndex = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.25, 8, 14), skinMat);
  pIndex.rotation.x = Math.PI / 2.2;
  pIndex.position.set(-0.18, 0.15, -1.05);
  for (let fi = 0; fi < 3; fi++) {
    const curlF = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skinMat);
    curlF.position.set(0.12 + fi * 0.28, -0.02, -0.58 + fi * 0.06);
    pointHand.add(curlF);
  }
  const pSleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.08, 5.2, 18),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 })
  );
  pSleeve.rotation.x = Math.PI / 2.35;
  pSleeve.rotation.z = -0.22;
  pSleeve.position.set(0.8, -0.85, 2.7);
  pointHand.add(pPalm, pIndex, pSleeve);

  // 빵모자 쓴 케이크집 아저씨 (CUT 3 — 눈·코·입 절대 없음! 머리에 착 붙은 빵모자 + 스카프 + 앞치마 + 양팔 환영)
  const baker = new THREE.Group();
  baker.position.set(0, -1.5, -6.8);
  shopInterior.add(baker);
  introRefs.baker = baker;

  // 흰 파티시에 조리복 몸통
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(2.45, 3.4, 14, 24),
    new THREE.MeshStandardMaterial({ color: '#fffdf9', roughness: 0.78 })
  );
  torso.position.y = 3.5;
  torso.castShadow = true;
  baker.add(torso);

  // 귀여운 버건디 스카프 타이
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.28, 10, 24),
    new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.6 })
  );
  scarf.rotation.x = Math.PI / 2 + 0.15;
  scarf.position.set(0, 5.85, 0.15);
  baker.add(scarf);

  // 따뜻한 브라운 앞치마 + 가슴받이
  const apron = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.65, 4.6, 24, 1, false, -Math.PI * 0.44, Math.PI * 0.88),
    new THREE.MeshStandardMaterial({ color: '#8c5832', roughness: 0.75 })
  );
  apron.position.y = 3.05;
  baker.add(apron);

  // 목 & 둥근 머리 + 양쪽 귀 (눈·코·입 없음!)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 1.0, 16), skinMat);
  neck.position.y = 6.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.75, 26, 20), skinMat);
  head.position.y = 7.55;
  head.scale.set(0.96, 1.03, 0.95);
  head.castShadow = true;
  for (const ex of [-1.68, 1.68]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), skinMat);
    ear.scale.set(0.55, 0.9, 0.7);
    ear.position.set(ex, 7.42, 0);
    baker.add(ear);
  }
  baker.add(neck, head);

  // 폭신한 갈색 빵모자(파티시에 베레모) — 이마에 빈틈없이 착 감기도록 밀착!
  const beretGroup = new THREE.Group();
  beretGroup.position.set(0, 8.22, 0.05);
  beretGroup.rotation.set(0.16, 0, -0.1);
  baker.add(beretGroup);

  const beretBand = new THREE.Mesh(
    new THREE.CylinderGeometry(1.74, 1.7, 0.52, 28),
    new THREE.MeshStandardMaterial({ color: '#5c3419', roughness: 0.7 })
  );
  beretBand.position.y = -0.12;
  const beretPuff = new THREE.Mesh(
    new THREE.SphereGeometry(2.35, 28, 20),
    new THREE.MeshStandardMaterial({ color: '#a1663a', roughness: 0.72 })
  );
  beretPuff.scale.set(1.08, 0.55, 1.08);
  beretPuff.position.set(0.16, 0.52, -0.06);
  const beretStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: '#5c3419', roughness: 0.7 })
  );
  beretStem.position.set(0.16, 1.82, -0.06);
  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(1.78, 1.92, 0.22, 24, 1, false, -Math.PI * 0.36, Math.PI * 0.72),
    new THREE.MeshStandardMaterial({ color: '#4a2811', roughness: 0.65 })
  );
  visor.position.set(0, -0.32, 0.22);
  visor.rotation.x = 0.32;
  beretGroup.add(beretBand, beretPuff, beretStem, visor);

  // 아저씨 오른팔(환영 손짓) & 왼팔(초코 짤주머니 들기)
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(2.7, 5.4, 0.2);
  baker.add(rightArmPivot);
  introRefs.bakerRightArm = rightArmPivot;

  const rArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.62, 2.6, 10, 16),
    new THREE.MeshStandardMaterial({ color: '#fffdf9', roughness: 0.8 })
  );
  rArm.position.set(0.9, 1.2, 0.4);
  rArm.rotation.z = -0.45;
  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.68, 16, 12), skinMat);
  rHand.position.set(1.65, 2.65, 0.6);
  rightArmPivot.add(rArm, rHand);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-2.7, 5.2, 0.4);
  baker.add(leftArmPivot);
  introRefs.bakerLeftArm = leftArmPivot;

  const lArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.62, 2.4, 10, 16),
    new THREE.MeshStandardMaterial({ color: '#fffdf9', roughness: 0.8 })
  );
  lArm.position.set(-0.6, -0.6, 1.1);
  lArm.rotation.x = -0.85;
  const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.66, 16, 12), skinMat);
  lHand.position.set(-0.9, -1.2, 2.2);
  const miniBag = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.1, 16), chocoMat);
  miniBag.rotation.x = Math.PI * 0.78;
  miniBag.position.set(-0.9, -1.5, 2.8);
  leftArmPivot.add(lArm, lHand, miniBag);
}

// ── 오프스크린 채점용 256×256 캔버스 ──
const EVAL_N = 256;
const targetEvalCanvas = document.createElement('canvas');
targetEvalCanvas.width = EVAL_N;
targetEvalCanvas.height = EVAL_N;
const targetEvalCtx = targetEvalCanvas.getContext('2d', { willReadFrequently: true });

const userEvalCanvas = document.createElement('canvas');
userEvalCanvas.width = EVAL_N;
userEvalCanvas.height = EVAL_N;
const userEvalCtx = userEvalCanvas.getContext('2d', { willReadFrequently: true });

// ── 게임 상태 ──
let state = 'title'; // 'title' | 'intro' | 'playing' | 'stage_clear' | 'gameover'
let introTime = 0;
let introCutPlayed = -1;
const INTRO_TOTAL = 3.85;

let stageIdx = 0;
let stageScores = [];
let totalScore = 0;
let currentStrokes = []; // [{ pts: [{x, z, r, y}], mesh }]
let activeStroke = null;

// 포인터 & 초코 압력/굵기 상태
let isPressing = false;
let pointerCakeXZ = V(2.5, 0, 2.5); // 케이크 로컬 좌표
let pressHoldSec = 0;
let dwellCharge = 0;
let currentGrip = 0.08;
let currentRadius = 0.14;
let lastSqueezeSfxAt = 0;
let lastBlobWarnAt = 0;
let maxWrittenX = -RIN;
let outOfBoundsLen = 0;
let blobCount = 0;

let stageClearTimer = 0;
let lastStageEval = null;
let incomingRef = null;
let lastShareInfo = null;

// 카메라 구도 (A: 케이크 전체, B: 오른쪽 여백 부족 시 살짝 다가감, SHOW: 회전 감상)
const CAM_EL = 60 * DEG;
const CAM_A = { tg: V(0.8, 0, 2.2), d: 72 };
const CAM_B = { tg: V(5.4, 0, 1.2), d: 46 };
let camZoom = 0;
let cakeSpinAngle = 0;

// ── BGM 버튼 동기화 ──
function syncBgmBtn() {
  if (!btnBgm) return;
  const muted = BGM.isMuted();
  btnBgm.textContent = muted ? '🔇 BGM' : '🔊 BGM';
  btnBgm.classList.toggle('bgm-off', muted);
}
syncBgmBtn();
if (btnBgm) {
  btnBgm.addEventListener('click', () => {
    unlockAudio();
    const muted = BGM.toggleMute();
    syncBgmBtn();
    showToast(muted ? '🔇 BGM이 꺼졌어요' : '🔊 BGM이 켜졌어요');
  });
}

// 최고 기록 초기 표시
function refreshBestUI() {
  const best = getBestRecord('cake');
  if (best && best.score != null) {
    const sc = Math.round(Number(best.score));
    bestPill.textContent = `🏆 최고 ${sc}점`;
    startBestEl.textContent = `${sc}점`;
  }
}
refreshBestUI();

loadIncomingChallenge('cake').then(ref => {
  if (!ref) return;
  incomingRef = ref;
  cakeHud.classList.add('with-rival');
  const sc = Math.round(ref.score || 0);
  rivalBanner.style.display = 'flex';
  rivalBannerText.innerHTML = `🔥 내가 아는 <strong>${ref.nickname}</strong>님의 기록: <strong>${sc}점</strong>`;
  startRivalBox.style.display = 'block';
  startRivalBox.innerHTML = `<strong>${ref.nickname}</strong>님이 케이크 레터링 <strong>${sc}점</strong>(${ref.rankTitle || '파티시에'})을 기록했어요!`;
});

// ── 스테이지 밑그림 & 채점 마스크 생성 ──
function drawPhraseToCanvas(ctx, size, stg, color, strokeWidthPx = 0) {
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const fontPx = Math.round(size * stg.fontScale);
  ctx.font = `900 ${fontPx}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;

  if (stg.lines.length === 1) {
    if (strokeWidthPx > 0) {
      ctx.lineWidth = strokeWidthPx;
      ctx.strokeText(stg.lines[0], size / 2, size / 2);
    }
    ctx.fillText(stg.lines[0], size / 2, size / 2);
  } else {
    const gap = fontPx * 1.28;
    const startY = size / 2 - ((stg.lines.length - 1) * gap) / 2;
    stg.lines.forEach((ln, idx) => {
      const y = startY + idx * gap;
      if (strokeWidthPx > 0) {
        ctx.lineWidth = strokeWidthPx;
        ctx.strokeText(ln, size / 2, y);
      }
      ctx.fillText(ln, size / 2, y);
    });
  }
  ctx.restore();
}

function setupStage(idx) {
  stageIdx = idx;
  const stg = STAGES[stageIdx];

  // 기존 초코 획 및 실 정리
  for (const s of currentStrokes) {
    strokesGroup.remove(s.mesh);
    s.mesh.geometry.dispose();
  }
  currentStrokes = [];
  activeStroke = null;
  activeHeadMesh.visible = false;
  liveStreamMesh.visible = false;

  isPressing = false;
  pressHoldSec = 0;
  dwellCharge = 0;
  currentGrip = 0.08;
  currentRadius = 0.14;
  maxWrittenX = -RIN;
  outOfBoundsLen = 0;
  blobCount = 0;
  cakeSpinAngle = 0;
  cakeRoot.rotation.y = 0;
  cakeRoot.scale.setScalar(stg.cakeScale);

  // 케이크 윗면 은은한 크림 점선 가이드 갱신 (시커먼 면 채움 대신 크림 위에 살살 그어 둔 듯한 은은한 점선 윤곽!)
  guideCtx.clearRect(0, 0, 1024, 1024);
  guideCtx.save();
  guideCtx.strokeStyle = 'rgba(195, 168, 132, 0.28)';
  guideCtx.lineWidth = 4;
  guideCtx.setLineDash([16, 14]);
  guideCtx.beginPath();
  guideCtx.arc(512, 512, 492, 0, TAU);
  guideCtx.stroke();

  if (stg.no <= 2) {
    // STAGE 1~2: 입문자용 친절하고 세련된 크림 점선 밑그림
    const fontPx = Math.round(1024 * (stg.no === 1 ? 0.5 : 0.27));
    guideCtx.font = `900 ${fontPx}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
    guideCtx.textAlign = 'center';
    guideCtx.textBaseline = 'middle';
    guideCtx.strokeStyle = `rgba(138, 96, 62, ${stg.no === 1 ? 0.34 : 0.26})`;
    guideCtx.lineWidth = 6;
    guideCtx.setLineDash([14, 12]);
    guideCtx.strokeText(stg.lines[0], 512, 512);
  } else {
    // STAGE 3~5: 진짜 파티시에처럼 은은한 가로 기준선 + 아주 옅은 위치 힌트만 제공!
    guideCtx.strokeStyle = 'rgba(165, 124, 88, 0.22)';
    guideCtx.lineWidth = 3;
    guideCtx.setLineDash([12, 16]);
    if (stg.lines.length === 1) {
      guideCtx.beginPath();
      guideCtx.moveTo(96, 610);
      guideCtx.lineTo(928, 610);
      guideCtx.stroke();
    } else {
      guideCtx.beginPath();
      guideCtx.moveTo(120, 445); guideCtx.lineTo(904, 445);
      guideCtx.moveTo(96, 665); guideCtx.lineTo(928, 665);
      guideCtx.stroke();
    }
    const fontPx = Math.round(1024 * stg.fontScale * 0.86);
    guideCtx.font = `800 ${fontPx}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
    guideCtx.textAlign = 'center';
    guideCtx.textBaseline = 'middle';
    guideCtx.fillStyle = `rgba(138, 96, 62, ${stg.guideAlpha * 0.55})`;
    if (stg.lines.length === 1) {
      guideCtx.fillText(stg.lines[0], 512, 512);
    } else {
      guideCtx.fillText(stg.lines[0], 512, 375);
      guideCtx.fillText(stg.lines[1], 512, 595);
    }
  }
  guideCtx.restore();
  guideTex.needsUpdate = true;

  // 채점용 타겟 마스크 준비 (살짝 여유 반경을 주어 자연스러운 손글씨도 인정!)
  drawPhraseToCanvas(targetEvalCtx, EVAL_N, stg, '#ffffff', Math.max(6, Math.round(EVAL_N * 0.032)));

  // HUD 동기화
  stageStepsEl.innerHTML = STAGES.map((s, i) => {
    const cls = i < stageIdx ? 'stage-dot done' : i === stageIdx ? 'stage-dot active' : 'stage-dot';
    return `<div class="${cls}">${s.chip}</div>`;
  }).join('');

  orderKickerEl.textContent = stg.kicker;
  orderPhraseEl.textContent = stg.phrase;
  guideChipEl.textContent = stg.tip;
  guideChipEl.classList.remove('warn');
  btnFinish.disabled = true;

  updateSpaceHUD();
  BGM.setUrgent(false);
}

function getRemainingCm() {
  const stg = STAGES[stageIdx];
  const rawLeft = clamp((RIN - maxWrittenX) * stg.cakeScale, 0, RIN * 2 * stg.cakeScale);
  return rawLeft;
}

function updateSpaceHUD() {
  const stg = STAGES[stageIdx];
  const fullCm = RIN * 2 * stg.cakeScale;
  const remCm = currentStrokes.length === 0 && !activeStroke ? fullCm : getRemainingCm();
  spacePillEl.textContent = `남은 자리 ${remCm.toFixed(1)}cm`;

  const warnThreshold = stg.charSlots >= 5 ? 7.2 * stg.cakeScale : 4.2 * stg.cakeScale;
  const isTight = (currentStrokes.length > 0 || activeStroke) && remCm < warnThreshold && remCm > 0.6;

  if (remCm <= 1.2) {
    spacePillEl.style.color = '#fca5a5';
  } else if (isTight) {
    spacePillEl.style.color = '#fdba74';
  } else {
    spacePillEl.style.color = '#ffffff';
  }
}

// ── 포인터 → 케이크 윗면(y=0) 레이캐스트 ──
const raycaster = new THREE.Raycaster();
const ndcVec = new THREE.Vector2();
const cakeTopPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitWorld = V();

function screenToCakeLocal(clientX, clientY, outVec) {
  const rect = gl.getBoundingClientRect();
  ndcVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndcVec.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(ndcVec, camera);
  if (raycaster.ray.intersectPlane(cakeTopPlane, hitWorld)) {
    const s = cakeRoot.scale.x || 1;
    outVec.set(
      clamp(hitWorld.x / s, -RC * 1.12, RC * 1.12),
      0,
      clamp(hitWorld.z / s, -RC * 1.12, RC * 1.12)
    );
    return true;
  }
  return false;
}

// ── 초코 획 3D 메쉬 재빌드 (둥근 머리 캡 + 누른 두께 그대로 반영 + 끝 꼬리) ──
function rebuildStrokeMesh(stroke, closedTail = false) {
  const pts = stroke.pts;
  if (pts.length === 0) return;

  if (pts.length === 1) {
    const p0 = pts[0];
    const P = [
      V(p0.x - 0.04, p0.y, p0.z),
      V(p0.x, p0.y + 0.04, p0.z),
      V(p0.x + 0.04, p0.y, p0.z),
    ];
    const R = [p0.r * 0.55, p0.r, p0.r * 0.55];
    if (stroke.mesh.geometry) stroke.mesh.geometry.dispose();
    stroke.mesh.geometry = buildTubeGeo(P, R, 12, UP_Y, 0.88, 0.45);
    return;
  }

  const P = [];
  const R = [];
  const pFirst = pts[0];
  const dir0 = V(pts[1].x - pFirst.x, 0, pts[1].z - pFirst.z);
  if (dir0.lengthSq() < 1e-6) dir0.set(1, 0, 0);
  else dir0.normalize();

  // 시작 부분 도톰한 둥근 캡
  for (let c = 0; c < 2; c++) {
    const a = (74 - c * 34) * DEG;
    P.push(V(pFirst.x - dir0.x * pFirst.r * Math.sin(a), pFirst.y, pFirst.z - dir0.z * pFirst.r * Math.sin(a)));
    R.push(pFirst.r * Math.cos(a));
  }

  for (let i = 0; i < pts.length; i++) {
    P.push(V(pts[i].x, pts[i].y, pts[i].z));
    R.push(pts[i].r);
  }

  // 마우스를 뗐을 때 위로 살짝 들렸다가 가늘게 끊기는 뾰족 꼬리!
  const pLast = pts[pts.length - 1];
  const pPrev = pts[pts.length - 2];
  const dirEnd = V(pLast.x - pPrev.x, 0, pLast.z - pPrev.z);
  if (dirEnd.lengthSq() < 1e-6) dirEnd.set(1, 0, 0);
  else dirEnd.normalize();

  if (closedTail) {
    P.push(V(pLast.x + dirEnd.x * pLast.r * 0.45, pLast.y + pLast.r * 0.65, pLast.z + dirEnd.z * pLast.r * 0.45));
    R.push(pLast.r * 0.42);
    P.push(V(pLast.x + dirEnd.x * pLast.r * 0.85, pLast.y + pLast.r * 0.95, pLast.z + dirEnd.z * pLast.r * 0.85));
    R.push(0.012);
  } else {
    P.push(V(pLast.x + dirEnd.x * pLast.r * 0.35, pLast.y, pLast.z + dirEnd.z * pLast.r * 0.35));
    R.push(pLast.r * 0.35);
  }

  if (stroke.mesh.geometry) stroke.mesh.geometry.dispose();
  stroke.mesh.geometry = buildTubeGeo(P, R, 12, UP_Y, 0.86, 0.46);
}

// ── 떼는 순간 쫀득하게 늘어나다 '톡!' 끊기는 초콜릿 실 생성 ──
function spawnStretchyChocoThread(localEndPt, baseRadius) {
  const s = cakeRoot.scale.x || 1;
  const anchorWorld = V(localEndPt.x * s, (localEndPt.y + baseRadius * 0.55) * s, localEndPt.z * s);
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), chocoMat);
  mesh.castShadow = true;
  stretchyThreadsGroup.add(mesh);
  stretchyThreads.push({
    mesh,
    anchor: anchorWorld,
    r0: Math.max(0.08, baseRadius * s * 0.55),
    age: 0,
    dur: 0.4,
    snapped: false,
  });
}

// ── 포인터 입력 핸들러 ──
function onPointerDown(e) {
  if (state === 'intro') {
    finishIntroToPlay();
    return;
  }
  if (state !== 'playing') return;
  if (e.button != null && e.button !== 0) return;

  unlockAudio();
  if (!screenToCakeLocal(e.clientX, e.clientY, pointerCakeXZ)) return;

  // 케이크 판 바깥을 클릭한 경우 무시
  const dist = Math.hypot(pointerCakeXZ.x, pointerCakeXZ.z);
  if (dist > RC * 1.05) return;

  isPressing = true;
  pressHoldSec = 0;
  dwellCharge = 0.16; // 첫 터치 시 초코 방울이 맺히며 시작
  currentRadius = 0.18;

  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), chocoMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  strokesGroup.add(mesh);

  activeStroke = {
    mesh,
    pts: [{ x: pointerCakeXZ.x, y: 0.02, z: pointerCakeXZ.z, r: currentRadius }],
  };
  currentStrokes.push(activeStroke);
  maxWrittenX = Math.max(maxWrittenX, pointerCakeXZ.x + currentRadius);

  rebuildStrokeMesh(activeStroke, false);
  SFX.chocoSqueeze(0.4);
  btnFinish.disabled = false;
  updateSpaceHUD();
}

function onPointerMove(e) {
  if (state !== 'playing') return;
  screenToCakeLocal(e.clientX, e.clientY, pointerCakeXZ);
}

function finishActiveStroke() {
  if (!isPressing || !activeStroke) return;
  isPressing = false;
  const lastPt = activeStroke.pts[activeStroke.pts.length - 1];
  rebuildStrokeMesh(activeStroke, true);
  spawnStretchyChocoThread(lastPt, lastPt.r);

  activeStroke = null;
  activeHeadMesh.visible = false;
  liveStreamMesh.visible = false;
  dwellCharge = 0;
  pressHoldSec = 0;
  updateSpaceHUD();
}

gl.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', finishActiveStroke);
window.addEventListener('pointercancel', finishActiveStroke);

// ── 스테이지 채점 엔진 ──
function evaluateCurrentStage() {
  const stg = STAGES[stageIdx];
  userEvalCtx.clearRect(0, 0, EVAL_N, EVAL_N);
  userEvalCtx.save();
  userEvalCtx.strokeStyle = '#ffffff';
  userEvalCtx.fillStyle = '#ffffff';
  userEvalCtx.lineCap = 'round';
  userEvalCtx.lineJoin = 'round';

  const toPx = v => ((v + RIN) / (RIN * 2)) * EVAL_N;

  let totalPts = 0;
  for (const st of currentStrokes) {
    totalPts += st.pts.length;
    for (let i = 0; i < st.pts.length; i++) {
      const p = st.pts[i];
      const px = toPx(p.x);
      const py = toPx(p.z);
      const pr = Math.max(2.5, (p.r / (RIN * 2)) * EVAL_N * 1.45);
      userEvalCtx.beginPath();
      userEvalCtx.arc(px, py, pr, 0, TAU);
      userEvalCtx.fill();

      if (i > 0) {
        const q = st.pts[i - 1];
        userEvalCtx.lineWidth = pr * 2;
        userEvalCtx.beginPath();
        userEvalCtx.moveTo(toPx(q.x), toPx(q.z));
        userEvalCtx.lineTo(px, py);
        userEvalCtx.stroke();
      }
    }
  }
  userEvalCtx.restore();

  const tData = targetEvalCtx.getImageData(0, 0, EVAL_N, EVAL_N).data;
  const uData = userEvalCtx.getImageData(0, 0, EVAL_N, EVAL_N).data;

  let targetCount = 0;
  let hitCount = 0;
  let userCount = 0;
  let spillCount = 0;

  for (let i = 3; i < tData.length; i += 4) {
    const tOn = tData[i] > 40;
    const uOn = uData[i] > 40;
    if (tOn) {
      targetCount++;
      if (uOn) hitCount++;
    }
    if (uOn) {
      userCount++;
      if (!tOn) spillCount++;
    }
  }

  // 밑그림에서 조금 비켜 써도 글자 구성과 길이가 충분하면 점수를 보정해 주는 하이브리드 판정
  const coverage = targetCount > 0 ? hitCount / targetCount : 0;
  const precision = userCount > 0 ? hitCount / userCount : 0;

  // 가로 공간 활용도 (글자 수에 걸맞게 고르게 썼는가)
  let minX = 99, maxX = -99;
  let strokeLenSum = 0;
  for (const st of currentStrokes) {
    for (let i = 0; i < st.pts.length; i++) {
      minX = Math.min(minX, st.pts[i].x);
      maxX = Math.max(maxX, st.pts[i].x);
      if (i > 0) {
        strokeLenSum += Math.hypot(st.pts[i].x - st.pts[i - 1].x, st.pts[i].z - st.pts[i - 1].z);
      }
    }
  }
  const expectedLen = stg.no === 1 ? 14 : stg.charSlots * 9.5;
  const lenRatio = clamp(strokeLenSum / expectedLen, 0, 1.35);
  const lengthAdequacy = lenRatio < 0.35
    ? lenRatio / 0.35 * 0.45
    : lenRatio <= 1.25
      ? 1.0
      : Math.max(0.55, 1.25 / lenRatio);

  // 1) 형태·완성도 점수 (60점 만점)
  const shapeRatio = clamp(coverage * 1.32 * 0.65 + precision * 0.35, 0, 1);
  const formScore = Math.round(clamp(shapeRatio * 0.68 + lengthAdequacy * 0.32, 0, 1) * 60);

  // 2) 생크림 테두리 보호 & 중앙 균형 (25점 만점)
  const centerOffset = currentStrokes.length > 0 ? Math.abs((minX + maxX) * 0.5) : 10;
  const edgePenalty = clamp(outOfBoundsLen * 4.5, 0, 20);
  const balancePenalty = clamp((centerOffset - 2.6) * 1.8, 0, 8);
  const spaceScore = Math.round(clamp(25 - edgePenalty - balancePenalty, 0, 25));

  // 3) 초코 두께 깔끔함 (15점 만점 — 과도한 혹 떡짐 감점)
  const blobPenalty = clamp(blobCount * 2.5, 0, 11);
  const cleanScore = totalPts < 4 ? 0 : Math.round(clamp(15 - blobPenalty, 4, 15));

  const stageTotal = clamp(formScore + spaceScore + cleanScore, 0, 100);
  const passed = stageTotal >= 56 && strokeLenSum >= (stg.no === 1 ? 5.0 : stg.charSlots * 3.2);

  return {
    stageNo: stg.no,
    phrase: stg.phrase,
    score: stageTotal,
    formScore,
    spaceScore,
    cleanScore,
    passed,
    outOfBounds: outOfBoundsLen > 1.2,
  };
}

// ── 다 썼어요! 버튼 클릭 ──
btnFinish.addEventListener('click', () => {
  if (state !== 'playing') return;
  finishActiveStroke();

  const ev = evaluateCurrentStage();
  lastStageEval = ev;

  if (ev.passed) {
    stageScores.push(ev.score);
    totalScore = stageScores.reduce((a, b) => a + b, 0);

    if (stageIdx < STAGES.length - 1) {
      state = 'stage_clear';
      stageClearTimer = 0;
      cakeHud.classList.add('hidden');
      bottomDock.classList.add('hidden');
      SFX.win();
    } else {
      // 5단계 올클리어!
      SFX.win();
      enterGameOver(true);
    }
  } else {
    // 이번 스테이지 부분 점수 절반 반영 후 종료
    stageScores.push(Math.round(ev.score * 0.6));
    totalScore = stageScores.reduce((a, b) => a + b, 0);
    SFX.fail();
    enterGameOver(false);
  }
});

function getRankInfo(score, clearedAll, reachedStage) {
  if (clearedAll && score >= 430) return { title: '👑 전설의 쇼콜라티에', comment: '도시락 케이크 장문까지 완벽하게 짰어요! 손끝이 기계 그 자체!' };
  if (clearedAll) return { title: '🎂 수제 케이크 마스터', comment: '5단계 모든 손님 주문을 막힘없이 완성했어요!' };
  if (reachedStage >= 4) return { title: '🍫 청담동 수석 파티시에', comment: '좁은 케이크 위에서도 초코 굵기 조절이 예술이에요!' };
  if (reachedStage >= 3) return { title: '✨ 동네 인기 케이크집 사장님', comment: '「생일 축하해」 여백 배분 고비까지 멋지게 도전했어요!' };
  if (reachedStage >= 2) return { title: '🧁 초코펜 수습 파티시에', comment: '초코가 늘어나는 감각을 잡기 시작했어요! 조금만 더 빠르게 그어 보세요!' };
  return { title: '😅 초코 짤주머니 적응 중', comment: '한 자리에 너무 오래 머물면 초코가 통통하게 불어나요!' };
}

async function enterGameOver(clearedAll) {
  state = 'gameover';
  BGM.setUrgent(false);
  cakeHud.classList.add('hidden');
  bottomDock.classList.add('hidden');

  const reachedStage = clearedAll ? STAGES.length : stageIdx + 1;
  const avgAcc = stageScores.length > 0
    ? Math.round(stageScores.reduce((a, b) => a + b, 0) / stageScores.length)
    : 0;
  const rk = getRankInfo(totalScore, clearedAll, reachedStage);

  resRankEl.textContent = rk.title;
  resHeadlineEl.textContent = `${totalScore}점`;
  resCommentEl.textContent = !clearedAll && lastStageEval && lastStageEval.outOfBounds
    ? '아차! 초콜릿이 생크림 테두리 밖으로 삐져나갔어요!'
    : rk.comment;
  resStageEl.textContent = clearedAll ? 'ALL CLEAR' : `STAGE ${reachedStage}`;
  resAccEl.textContent = `${avgAcc}%`;
  resScoreEl.textContent = String(totalScore);
  resNickInput.value = getSavedNickname() || '';

  updateBestRecord('cake', {
    score: totalScore,
    actualValue: reachedStage,
    targetValue: STAGES.length,
    rankTitle: rk.title,
  }, false);
  refreshBestUI();

  resultModal.classList.remove('hidden');

  // 서버 저장 & 글로벌 랭킹 표시
  resLbWrap.style.display = 'block';
  resLbWrap.innerHTML = '<div style="text-align:center;font-size:12px;color:#b8b0cc;padding:8px">글로벌 랭킹 불러오는 중...</div>';

  lastShareInfo = await saveResultAndBuildShare({
    gameId: 'cake',
    nickname: resNickInput.value || getSavedNickname() || '익명 파티시에',
    targetValue: STAGES.length,
    actualValue: reachedStage,
    score: totalScore,
    errorMm: null,
    rankTitle: rk.title,
    seed: 1,
    meta: { clearedAll, reachedStage, avgAcc },
  }, incomingRef);

  resLbWrap.innerHTML = renderGlobalLadderHTML(lastShareInfo, row => `${Math.round(row.score)}점`);
}

// ── 시작 / 스킵 / 재도전 / 공유 / 이미지 저장 ──
function startIntro() {
  unlockAudio();
  BGM.start('cake');
  syncBgmBtn();

  startModal.classList.add('hidden');
  resultModal.classList.add('hidden');
  cakeHud.classList.add('hidden');
  bottomDock.classList.add('hidden');
  btnSkipIntro.classList.remove('hidden');

  stageScores = [];
  totalScore = 0;
  introTime = 0;
  introCutPlayed = -1;
  state = 'intro';

  mainWorld.visible = false;
  introWorld.visible = true;
  scene.background.set(INTRO_BG_COLOR);
}

function finishIntroToPlay() {
  btnSkipIntro.classList.add('hidden');
  introWorld.visible = false;
  mainWorld.visible = true;
  scene.background.set(DESK_COLOR);

  setupStage(0);
  cakeHud.classList.remove('hidden');
  bottomDock.classList.remove('hidden');
  state = 'playing';
}

btnStart.addEventListener('click', startIntro);
btnSkipIntro.addEventListener('click', finishIntroToPlay);

btnRetry.addEventListener('click', () => {
  resultModal.classList.add('hidden');
  stageScores = [];
  totalScore = 0;
  // 재도전은 바로 STAGE 1부터 쾌속 시작!
  finishIntroToPlay();
});

btnShare.addEventListener('click', async () => {
  const nick = saveNickname(resNickInput.value);
  if (!lastShareInfo || nick !== lastShareInfo.nickname) {
    lastShareInfo = await saveResultAndBuildShare({
      gameId: 'cake',
      nickname: nick,
      targetValue: STAGES.length,
      actualValue: stageIdx + 1,
      score: totalScore,
      errorMm: null,
      rankTitle: resRankEl.textContent,
      seed: 1,
    }, incomingRef);
    resLbWrap.innerHTML = renderGlobalLadderHTML(lastShareInfo, row => `${Math.round(row.score)}점`);
  }
  await shareChallengeLink({
    title: `🎂 ${nick}님의 [케이크 글씨 쓰기] 기록: ${totalScore}점!`,
    text: `한 번 짜면 못 지우는 3D 초코펜 레터링! ${nick}님의 ${totalScore}점 기록에 도전해 보세요!`,
    url: lastShareInfo.shareUrl,
  });
});

btnSaveImg.addEventListener('click', () => {
  const nick = saveNickname(resNickInput.value);
  downloadResultCard({
    gameTitle: '케이크 글씨 쓰기',
    rankTitle: resRankEl.textContent,
    headline: `${totalScore}점`,
    subline: `${resStageEl.textContent} · 평균 완성도 ${resAccEl.textContent}`,
    nickname: nick,
    glCanvas: gl,
    shareUrl: lastShareInfo ? lastShareInfo.shareUrl : location.origin + '/cake/',
  });
});

// ── 화면 리사이즈 ──
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.65 ? 38 : camera.aspect < 1.0 ? 33 : 27;
  camera.updateProjectionMatrix();

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ov.width = Math.round(w * dpr);
  ov.height = Math.round(h * dpr);
  ovCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// 세로 모바일 화면에서도 가로 피사체가 절대 잘리지 않도록 거리 배율 자동 계산
function getAspectDistFactor() {
  return camera.aspect < 0.85 ? clamp(0.82 / Math.max(0.42, camera.aspect), 1.0, 1.85) : 1.0;
}
window.addEventListener('resize', onResize);
onResize();

// ── 2D 오버레이 렌더링 (4컷 하드컷 자막·말풍선 & 스테이지 클리어 연출) ──
function drawIntroOverlay(cutIdx, localK) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ovCtx.clearRect(0, 0, w, h);

  // 시네마틱 상·하단 소프트 레터박스 & 컷 번호 태그
  const captions = [
    { badge: 'CUT 1 · 동네 케이크 공방', main: '딸랑~! 문을 열고 들어갔다!', sub: '달콤한 생크림 냄새가 솔솔~' },
    { badge: 'CUT 2 · 케이크 고르기', main: '“이 새하얀 생크림 케이크로 주세요!”', sub: '글씨 쓰기 딱 좋은 순백의 홀케이크 픽!' },
    { badge: 'CUT 3 · 빵모자 사장님 환영', main: '“어서 오세요~! 문구는 직접 써 보실래요?”', sub: '갓 녹인 쫀득한 초코 짤주머니 증정!' },
    { badge: 'CUT 4 · 멘트 고민 중…', main: '“음… 한 번 짜면 못 지우는데… 하트부터?!”', sub: '누르는 시간에 따라 굵기가 달라진다!!' },
  ];
  const c = captions[cutIdx] || captions[0];
  const pop = 1 + 0.06 * Math.exp(-localK * 9);

  ovCtx.save();
  ovCtx.translate(w / 2, h * 0.78);
  ovCtx.scale(pop, pop);

  // 말풍선 카드 배경
  const bw = Math.min(w * 0.88, 380);
  const bh = 86;
  ovCtx.fillStyle = 'rgba(28, 18, 12, 0.88)';
  ovCtx.strokeStyle = '#ffd84a';
  ovCtx.lineWidth = 2.5;
  ovCtx.beginPath();
  ovCtx.roundRect(-bw / 2, -bh / 2, bw, bh, 20);
  ovCtx.fill();
  ovCtx.stroke();

  // 컷 배지
  ovCtx.fillStyle = '#ffd84a';
  ovCtx.font = '900 11.5px "Pretendard",sans-serif';
  ovCtx.textAlign = 'center';
  ovCtx.fillText(c.badge, 0, -20);

  // 메인 대사
  ovCtx.fillStyle = '#ffffff';
  ovCtx.font = '900 16px "Pretendard",sans-serif';
  ovCtx.fillText(c.main, 0, 4);

  // 보조 설명
  ovCtx.fillStyle = '#fde68a';
  ovCtx.font = '700 12px "Pretendard",sans-serif';
  ovCtx.fillText(c.sub, 0, 25);
  ovCtx.restore();
}

function drawStageClearOverlay(t) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ovCtx.clearRect(0, 0, w, h);
  if (!lastStageEval) return;

  const pop = 1 + 0.1 * Math.exp(-t * 8);
  ovCtx.save();
  ovCtx.translate(w / 2, h * 0.22);
  ovCtx.scale(pop, pop);

  const bw = Math.min(w * 0.84, 320);
  const bh = 78;
  ovCtx.fillStyle = 'rgba(22, 16, 32, 0.9)';
  ovCtx.strokeStyle = '#4ade80';
  ovCtx.lineWidth = 2.5;
  ovCtx.beginPath();
  ovCtx.roundRect(-bw / 2, -bh / 2, bw, bh, 20);
  ovCtx.fill();
  ovCtx.stroke();

  ovCtx.textAlign = 'center';
  ovCtx.fillStyle = '#4ade80';
  ovCtx.font = '900 13px "Pretendard",sans-serif';
  ovCtx.fillText(`🎉 STAGE ${lastStageEval.stageNo} 통과! (+${lastStageEval.score}점)`, 0, -10);

  ovCtx.fillStyle = '#ffffff';
  ovCtx.font = '800 14px "Pretendard",sans-serif';
  ovCtx.fillText(`다음 손님 케이크 준비 중...`, 0, 16);
  ovCtx.restore();
}

// ── 메인 루프 (60fps 실시간 초코 물리 & 카메라 & 3D 손 애니메이션) ──
let prevNow = performance.now();
const _penTipW = V();
const _penAxis = V();
const _camTarget = V();

function updateIntro(dt) {
  introTime += dt;
  if (introTime >= INTRO_TOTAL) {
    finishIntroToPlay();
    return;
  }

  let cut = 0;
  let localK = 0;
  if (introTime < 0.92) {
    cut = 0;
    localK = introTime / 0.92;
  } else if (introTime < 1.88) {
    cut = 1;
    localK = (introTime - 0.92) / 0.96;
  } else if (introTime < 2.88) {
    cut = 2;
    localK = (introTime - 1.88) / 1.0;
  } else {
    cut = 3;
    localK = (introTime - 2.88) / 0.97;
  }

  if (cut !== introCutPlayed) {
    introCutPlayed = cut;
    if (cut === 0) SFX.bell();
    else if (cut === 1) SFX.pop();
    else if (cut === 2) SFX.tick();
    else if (cut === 3) SFX.rustle();
  }

  const af = getAspectDistFactor();

  if (cut === 0) {
    // CUT 1: 가게 어닝·간판·화분·유리문 전체가 보이면서 활짝 열리고 금빛 문종 딸랑딸랑!
    introWorld.visible = true;
    mainWorld.visible = false;
    introRefs.doorScene.visible = true;
    introRefs.shopInterior.visible = false;

    const openAng = ease(clamp(localK * 1.25, 0, 1)) * 1.12;
    introRefs.doorPivot.rotation.y = -openAng;
    introRefs.bellPivot.rotation.z = Math.sin(introTime * 34) * 0.42 * (1 - localK * 0.4);

    const zStart = 31 * af;
    const zEnd = 21 * af;
    camera.position.set(0.3, 4.2, lerp(zStart, zEnd, ease(localK)));
    camera.lookAt(0, 3.2, -5.2);
  } else if (cut === 1) {
    // CUT 2: 진열장 속 3종 케이크 전체가 한눈에 보이고 가운데 순백 생크림 케이크를 손가락으로 콕!
    introWorld.visible = true;
    mainWorld.visible = false;
    introRefs.doorScene.visible = false;
    introRefs.shopInterior.visible = true;
    introRefs.baker.visible = false;
    introRefs.pointHand.visible = true;

    const poke = Math.sin(clamp((localK - 0.14) / 0.62, 0, 1) * Math.PI);
    introRefs.pointHand.position.set(0.35, 1.35 - poke * 0.2, 2.2 - poke * 1.35);
    introRefs.displayCakes.forEach((cg, idx) => {
      cg.position.y = idx === 1 ? -0.3 + Math.max(0, Math.sin((localK - 0.3) * 9)) * 0.45 : -0.3;
      const sc = idx === 1 ? 1.04 + 0.1 * poke : 0.92;
      cg.scale.setScalar(sc);
    });

    camera.position.set(0.4, 5.2, 16.5 * af);
    camera.lookAt(0, 0.5, -2.5);
  } else if (cut === 2) {
    // CUT 3: 빵모자 쓴 아저씨 상반신 + 카운터 풀샷으로 양팔 흔들며 반갑게 환영!
    introWorld.visible = true;
    mainWorld.visible = false;
    introRefs.doorScene.visible = false;
    introRefs.shopInterior.visible = true;
    introRefs.baker.visible = true;
    introRefs.pointHand.visible = false;

    introRefs.baker.position.y = -1.5 + Math.abs(Math.sin(localK * Math.PI * 3)) * 0.26;
    introRefs.bakerRightArm.rotation.z = Math.sin(localK * Math.PI * 5) * 0.38;
    introRefs.bakerLeftArm.position.z = 0.4 + ease(localK) * 0.65;

    camera.position.set(0, 5.8, 17.5 * af);
    camera.lookAt(0, 3.6, -6.5);
  } else {
    // CUT 4: 민트 작업대 위 새하얀 케이크 전체와 초코펜 멘트 고민!
    introWorld.visible = false;
    mainWorld.visible = true;
    scene.background.set(DESK_COLOR);
    cakeRoot.scale.setScalar(1.0);

    const hoverX = Math.sin(localK * TAU * 1.5) * 2.4;
    const hoverZ = -1.0 + Math.cos(localK * TAU * 1.5) * 1.2;
    _penTipW.set(hoverX, 2.2 + Math.sin(localK * 18) * 0.25, hoverZ);
    _penAxis.set(0.28, 0.42, 0.86).normalize();
    updatePenAndHand(_penTipW, _penAxis, 0.15 + 0.2 * Math.sin(localK * 12), 0.16);

    const d4 = 74 * lerp(1, af, 0.55);
    camera.position.set(0, d4 * Math.sin(CAM_EL), d4 * Math.cos(CAM_EL));
    camera.lookAt(0.4, 0, 1.4);
  }

  drawIntroOverlay(cut, localK);
}

function updatePlaying(dt, nowSec) {
  ovCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  const stg = STAGES[stageIdx];
  const s = cakeRoot.scale.x || 1;

  if (isPressing && activeStroke) {
    pressHoldSec += dt;

    const pts = activeStroke.pts;
    const last = pts[pts.length - 1];
    const dx = pointerCakeXZ.x - last.x;
    const dz = pointerCakeXZ.z - last.z;
    const dist = Math.hypot(dx, dz);
    const speed = dist / Math.max(0.004, dt); // cm/s

    // 핵심 물리 1: 누르고 머무는 시간에 따라 초코 두께가 통통하게 차오르고, 빠르게 그으면 얇아진다!
    const speedThinFactor = clamp(1.0 - speed / 26.0, 0.0, 1.0);
    if (speed < 4.5) {
      // 한 자리에 머물거나 아주 천천히 움직이면 초코가 계속 고임(혹 형성)!
      dwellCharge = clamp(dwellCharge + dt * 1.35, 0, 1.35);
    } else {
      // 빠르게 움직이면 고임이 풀리며 날렵한 선으로 뽑힘
      dwellCharge = Math.max(0, dwellCharge - dt * (1.8 + speed * 0.08));
    }

    // 길게 누르고 있는 시간 자체도 짤주머니 압력을 높임
    const holdBoost = clamp(pressHoldSec / 2.2, 0, 0.35);
    const targetRadius = clamp(
      0.105 + 0.12 * speedThinFactor + 0.32 * dwellCharge + 0.12 * holdBoost,
      0.09,
      0.66
    );
    currentRadius = lerp(currentRadius, targetRadius, clamp(dt * 16, 0, 1));
    currentGrip = lerp(currentGrip, clamp(0.32 + dwellCharge * 0.45 + holdBoost * 0.5, 0.28, 0.98), clamp(dt * 14, 0, 1));

    // 제자리에 멈춰 있을 때는 마지막 점의 반지름 자체가 실시간으로 부풀어 오름!
    if (dist < 0.11) {
      if (currentRadius > last.r) {
        last.r = currentRadius;
        last.y = 0.02 + currentRadius * 0.16;
        maxWrittenX = Math.max(maxWrittenX, last.x + last.r);
        rebuildStrokeMesh(activeStroke, false);
      }
      if (dwellCharge > 0.92 && nowSec - lastBlobWarnAt > 0.75) {
        lastBlobWarnAt = nowSec;
        blobCount++;
        SFX.blobWarn();
        guideChipEl.textContent = '🍫 꾸르륵! 한곳에 오래 눌러 초코가 통통하게 고이고 있어요!';
        guideChipEl.classList.add('warn');
      }
    } else {
      // 일정 간격(0.14cm)으로 보간 샘플링해 도톰하고 매끄러운 연속 관 생성
      const steps = Math.max(1, Math.ceil(dist / 0.16));
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const nx = lerp(last.x, pointerCakeXZ.x, k);
        const nz = lerp(last.z, pointerCakeXZ.z, k);
        const rHere = lerp(last.r, currentRadius, k);
        pts.push({ x: nx, y: 0.02 + rHere * 0.12, z: nz, r: rHere });
        maxWrittenX = Math.max(maxWrittenX, nx + rHere);

        // 크림 로제트 안쪽 반지름(RIN) 침범 체크
        if (Math.hypot(nx, nz) + rHere * 0.7 > RIN + 0.35) {
          outOfBoundsLen += dist / steps;
        }
      }
      rebuildStrokeMesh(activeStroke, false);

      if (dwellCharge < 0.65 && guideChipEl.classList.contains('warn')) {
        guideChipEl.textContent = stg.tip;
        guideChipEl.classList.remove('warn');
      }
    }

    if (nowSec - lastSqueezeSfxAt > 0.085) {
      lastSqueezeSfxAt = nowSec;
      SFX.chocoSqueeze(clamp((currentRadius - 0.1) / 0.5, 0, 1));
    }

    // 짜는 중 초코 머리 방울 + 노즐→케이크 표면 쫀득 액체 기둥 업데이트
    const curEnd = pts[pts.length - 1];
    activeHeadMesh.visible = true;
    activeHeadMesh.position.set(curEnd.x, curEnd.y + curEnd.r * 0.48, curEnd.z);
    activeHeadMesh.scale.set(curEnd.r * 1.04, curEnd.r * 0.88, curEnd.r * 1.04);

    const tipHoverH = (0.48 + currentRadius * 1.25) * s;
    _penTipW.set(pointerCakeXZ.x * s, tipHoverH, pointerCakeXZ.z * s);

    // 노즐에서 케이크 위 초코 머리까지 휘어지며 내려오는 액체 줄기
    const headWorld = V(curEnd.x * s, (curEnd.y + curEnd.r * 0.52) * s, curEnd.z * s);
    const midWorld = _penTipW.clone().lerp(headWorld, 0.52);
    midWorld.y -= 0.06;
    liveStreamMesh.visible = true;
    if (liveStreamMesh.geometry) liveStreamMesh.geometry.dispose();
    liveStreamMesh.geometry = buildTubeGeo(
      [_penTipW.clone(), midWorld, headWorld],
      [Math.max(0.06, currentRadius * s * 0.52), Math.max(0.07, currentRadius * s * 0.68), Math.max(0.09, currentRadius * s * 0.92)],
      10,
      V(0, 0, 1),
      1,
      0
    );

    updateSpaceHUD();
  } else {
    currentGrip = lerp(currentGrip, 0.08, clamp(dt * 12, 0, 1));
    currentRadius = lerp(currentRadius, 0.13, clamp(dt * 10, 0, 1));
    _penTipW.set(pointerCakeXZ.x * s, 1.65, pointerCakeXZ.z * s);
    liveStreamMesh.visible = false;
    activeHeadMesh.visible = false;
  }

  // HUD 초코 두께 게이지 업데이트
  const thickPct = clamp(((currentRadius - 0.09) / 0.55) * 100, 12, 100);
  thickFillEl.style.width = `${thickPct.toFixed(0)}%`;

  // 펜 기울기 (오른쪽 끝으로 갈수록 가리지 않게 자연스럽게 각도 조절)
  const rightBias = clamp((pointerCakeXZ.x - 2.0) / 8.0, 0, 1);
  _penAxis.set(lerp(0.32, 0.06, rightBias), 0.34, lerp(0.88, 0.94, rightBias)).normalize();
  updatePenAndHand(_penTipW, _penAxis, currentGrip, currentRadius * s * 0.85);

  // 핵심 물리 2: 손을 떼었을 때 쫀득하게 늘어나다 '톡!' 끊기는 초콜릿 실 애니메이션
  for (let i = stretchyThreads.length - 1; i >= 0; i--) {
    const th = stretchyThreads[i];
    th.age += dt;
    const k = th.age / th.dur;
    if (k >= 1) {
      stretchyThreadsGroup.remove(th.mesh);
      if (th.mesh.geometry) th.mesh.geometry.dispose();
      stretchyThreads.splice(i, 1);
      continue;
    }

    if (k < 0.62) {
      // 늘어나는 구간: 케이크 끝점 ↔ 들려 올라가는 노즐 끝 사이에 가운데가 잘록한 곡선 초코 실!
      const u = k / 0.62;
      const topPt = _penTipW.clone();
      const p1 = th.anchor.clone().lerp(topPt, 0.33);
      const p2 = th.anchor.clone().lerp(topPt, 0.67);
      const sag = 0.22 * Math.sin(u * Math.PI);
      p1.y -= sag;
      p2.y -= sag * 0.7;

      const neck = Math.max(0.012, th.r0 * (1 - u * 0.88));
      if (th.mesh.geometry) th.mesh.geometry.dispose();
      th.mesh.geometry = buildTubeGeo(
        [th.anchor, p1, p2, topPt],
        [th.r0 * 0.9, neck, neck * 0.85, th.r0 * 0.65],
        8,
        V(0, 0, 1),
        1,
        0
      );
    } else {
      // '톡!' 끊긴 직후 탄성 있게 케이크 쪽으로 스르륵 내려앉는 꼬리 잔상
      if (!th.snapped) {
        th.snapped = true;
        SFX.chocoSnap();
      }
      const u = (k - 0.62) / 0.38;
      const recoilTop = th.anchor.clone().add(V(0, (1 - u) * 0.75, 0));
      const mid = th.anchor.clone().lerp(recoilTop, 0.5);
      if (th.mesh.geometry) th.mesh.geometry.dispose();
      th.mesh.geometry = buildTubeGeo(
        [th.anchor, mid, recoilTop],
        [th.r0 * 0.8, th.r0 * 0.35 * (1 - u), 0.008],
        8,
        V(0, 0, 1),
        1,
        0
      );
    }
  }

  // 오른쪽 남은 자리 경고 점선 상자 & 카메라 살짝 줌인 (원본 쇼츠 9.4초 깨달음 구간 연출!)
  const remCm = getRemainingCm();
  const needTightZoom = stg.charSlots >= 5 && (currentStrokes.length > 0 || activeStroke) && remCm < 7.2 * s && remCm > 0.8;
  BGM.setUrgent(needTightZoom);

  const targetZoom = needTightZoom ? 0.58 : 0;
  camZoom = lerp(camZoom, targetZoom, clamp(dt * 3.2, 0, 1));

  warnBoxes.forEach((box, idx) => {
    if (needTightZoom && maxWrittenX < RIN - 1.2) {
      const spanStart = clamp(maxWrittenX + 0.45, -2, RIN - 1.0);
      const avail = Math.max(1.2, RIN - 0.3 - spanStart);
      const wEach = avail / 3;
      box.visible = true;
      box.scale.set(wEach / 2.2, 1, 1);
      box.position.set(spanStart + wEach * (idx + 0.5), 0.035, 0);
      box.material.opacity = 0.42 + 0.2 * Math.sin(nowSec * 9 + idx);
    } else {
      box.visible = false;
    }
  });

  const afPlay = lerp(1, getAspectDistFactor(), 0.42);
  _camTarget.copy(CAM_A.tg).lerp(CAM_B.tg, camZoom);
  const camDist = lerp(CAM_A.d * afPlay, CAM_B.d * afPlay, camZoom);
  camera.position.set(
    _camTarget.x,
    _camTarget.y + camDist * Math.sin(CAM_EL),
    _camTarget.z + camDist * Math.cos(CAM_EL)
  );
  camera.lookAt(_camTarget);
}

function animate(nowMs) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (nowMs - prevNow) / 1000));
  prevNow = nowMs;
  const nowSec = nowMs / 1000;

  if (state === 'title') {
    // 타이틀 배경에서 케이크가 은은하게 회전
    ovCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    introWorld.visible = false;
    mainWorld.visible = true;
    cakeRoot.rotation.y += dt * 0.28;
    _penTipW.set(6.8, 3.2 + Math.sin(nowSec * 2.2) * 0.35, 4.2);
    _penAxis.set(0.35, 0.42, 0.84).normalize();
    updatePenAndHand(_penTipW, _penAxis, 0.18, 0.15);
    camera.position.set(0, 56, 44);
    camera.lookAt(0, -1.0, 0);
  } else if (state === 'intro') {
    updateIntro(dt);
  } else if (state === 'playing') {
    updatePlaying(dt, nowSec);
  } else if (state === 'stage_clear') {
    stageClearTimer += dt;
    // 손을 오른쪽 바깥으로 스르륵 물리고 케이크를 살짝 돌려 완성작 감상!
    _penTipW.lerp(V(22, 9, 14), clamp(dt * 5, 0, 1));
    updatePenAndHand(_penTipW, V(0.4, 0.5, 0.76).normalize(), 0.05, 0.12);
    cakeRoot.rotation.y = Math.sin(clamp(stageClearTimer / 1.55, 0, 1) * Math.PI) * 0.28;
    warnBoxes.forEach(b => { b.visible = false; });

    camera.position.lerp(V(0, 56, 38), clamp(dt * 4, 0, 1));
    camera.lookAt(0, -0.5, 0.5);
    drawStageClearOverlay(stageClearTimer);

    if (stageClearTimer >= 1.55) {
      ovCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      setupStage(stageIdx + 1);
      cakeHud.classList.remove('hidden');
      bottomDock.classList.remove('hidden');
      state = 'playing';
    }
  } else if (state === 'gameover') {
    // 결과 화면 및 바깥 클릭 캡처 모드에서 내가 직접 쓴 3D 케이크가 부드럽게 턴테이블 회전!
    ovCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    _penTipW.lerp(V(26, 11, 18), clamp(dt * 4, 0, 1));
    updatePenAndHand(_penTipW, V(0.4, 0.5, 0.76).normalize(), 0.05, 0.11);
    warnBoxes.forEach(b => { b.visible = false; });
    guidePlane.visible = false; // 캡처할 때 밑그림 없이 순수 내 초코 작품만 깔끔하게 보이게!
    cakeSpinAngle += dt * 0.42;
    cakeRoot.rotation.y = Math.sin(cakeSpinAngle) * 0.38;

    camera.position.lerp(V(0, 54, 40), clamp(dt * 3.5, 0, 1));
    camera.lookAt(0, -0.8, 0);
  }

  if (state === 'playing') {
    guidePlane.visible = true;
  }

  renderer.render(scene, camera);
}

// 초기 상태 세팅
setupStage(0);
requestAnimationFrame(animate);
