// 케이크 글씨 쓰기 — 이게뭔겜? 404 아케이드 (360° 캡처 쇼케이스 & 바이럴 이미지 공유 에디션)
// 1. 순위·점수 경쟁 없음! 내가 직접 짠 3D 레터링 케이크 비주얼을 360° 이리저리 돌려보고 사진으로 공유하는 데 100% 집중!
// 2. 투트랙 플레이: [5단계 주문 도전(♥ → 축하♥ → 생일 축하해 → 우리 행복하자♥ → 도시락 케이크)] + [내 맘대로 문구 쓰기(친구 선물용)]
// 3. 4컷 하드컷 베이커리 인트로: 문종 딸랑 입장 → 케이크 고르기 → 빵모자 사장님 환영(눈·코·입 없음!) → 멘트 고민
// 4. 리얼 초콜릿 물리: 누르고 머무는 시간에 따라 두께가 통통하게 고이고(혹 생성), 빠르게 그으면 날렵해지며, 뗄 때 쫀득한 초코 실이 늘어나다 '톡!' 끊김
// 5. 바이럴 360° 쇼케이스: 드래그로 상하좌우 자유 회전 + 3D 흔들리는 생일 촛불 + 4종 포토존 테마 + 빵모자 사장님의 팩폭 감정평 + 고화질 폴라로이드 이미지 즉시 공유/저장!

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SFX, BGM, unlockAudio } from '../shared/audio.js';
import { enforceGameAccess } from '../shared/catalog.js';
import { showToast } from '../shared/challenge.js';

enforceGameAccess('cake');

// ── DOM 참조 ──
const gl = document.getElementById('gl');
const ov = document.getElementById('ov');
const ovCtx = ov.getContext('2d');

const btnBgm = document.getElementById('btn-bgm');
const cleanHint = document.getElementById('clean-hint');

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

// 쇼케이스 & 이미지 공유 UI
const showcaseTop = document.getElementById('showcase-top');
const verdictTagEl = document.getElementById('verdict-tag');
const verdictTextEl = document.getElementById('verdict-text');
const showcaseDock = document.getElementById('showcase-dock');
const chipCandle = document.getElementById('chip-candle');
const chipSpin = document.getElementById('chip-spin');
const chipAngleHero = document.getElementById('chip-angle-hero');
const chipAngleTop = document.getElementById('chip-angle-top');
const cardMemoInput = document.getElementById('card-memo');
const btnCleanView = document.getElementById('btn-clean-view');
const btnShareImg = document.getElementById('btn-share-img');
const btnSaveCard = document.getElementById('btn-save-card');
const btnNextStage = document.getElementById('btn-next-stage');
const btnRewrite = document.getElementById('btn-rewrite');

// 시작 모달 & 자유 문구 UI
const startModal = document.getElementById('start-modal');
const tabModeStage = document.getElementById('tab-mode-stage');
const tabModeCustom = document.getElementById('tab-mode-custom');
const stageModeDesc = document.getElementById('stage-mode-desc');
const customModeBox = document.getElementById('custom-mode-box');
const customPhraseInput = document.getElementById('custom-phrase-input');
const btnStart = document.getElementById('btn-start');

// 폴라로이드 미리보기 모달
const previewModal = document.getElementById('preview-modal');
const previewImg = document.getElementById('preview-img');
const btnPreviewClose = document.getElementById('btn-preview-close');
const btnPreviewNative = document.getElementById('btn-preview-native');
const btnPreviewDownload = document.getElementById('btn-preview-download');

// ── 수학 도우미 ──
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
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
    kicker: 'STAGE 1 · 첫 손님 서비스 (쉬움)',
    phrase: '♥',
    lines: ['♥'],
    cakeScale: 1.0,
    guideAlpha: 0.32,
    fontScale: 0.48,
    charSlots: 1,
    dottedGuide: true,
    tip: '가운데 예쁜 하트 1개! 누르고 머물면 초코가 통통해지고, 떼면 실이 늘어나요!',
  },
  {
    no: 2,
    chip: '2. 축하♥',
    kicker: 'STAGE 2 · 단골 손님 주문',
    phrase: '축하 ♥',
    lines: ['축하 ♥'],
    cakeScale: 1.0,
    guideAlpha: 0.25,
    fontScale: 0.27,
    charSlots: 3,
    dottedGuide: true,
    tip: '두 글자와 하트! 획 끝에서 살짝 떼어 깔끔하게 마무리해 보세요.',
  },
  {
    no: 3,
    chip: '3. 생일축하해',
    kicker: 'STAGE 3 · 쇼츠 레전드 구간!',
    phrase: '생일 축하해',
    lines: ['생일 축하해'],
    cakeScale: 1.0,
    guideAlpha: 0.12,
    fontScale: 0.22,
    charSlots: 5,
    dottedGuide: false,
    tip: '앞의 「생일」을 너무 크게 쓰면 오른쪽 자리가 모자라요! 여백 배분 주의!',
  },
  {
    no: 4,
    chip: '4. 행복하자',
    kicker: 'STAGE 4 · 미니 홀케이크',
    phrase: '우리 행복하자 ♥',
    lines: ['우리 행복하자 ♥'],
    cakeScale: 0.88,
    guideAlpha: 0.1,
    fontScale: 0.185,
    charSlots: 7,
    dottedGuide: false,
    tip: '케이크가 작아졌어요! 빠르게 스윽 그어야 초코 줄이 얇고 날렵하게 나와요!',
  },
  {
    no: 5,
    chip: '5. 도시락보스',
    kicker: 'STAGE 5 · 초소형 도시락 케이크',
    phrase: '사랑해 ♥ / 오래오래 함께해',
    lines: ['사랑해 ♥', '오래오래 함께해'],
    cakeScale: 0.78,
    guideAlpha: 0.09,
    fontScale: 0.175,
    charSlots: 8,
    dottedGuide: false,
    tip: '작은 도시락 케이크에 두 줄로 삐져나가지 않게 정성껏 써 보세요!',
  },
];

// 포토존 테마 4종
const PHOTO_THEMES = {
  mint: {
    name: '민트 케이크 공방',
    bg: '#b9d9d4',
    desk: '#b9d9d4',
    keyInt: 2.35,
    hemiInt: 0.65,
    cardBgTop: '#f4fbf9',
    cardBgBot: '#e3f2ee',
    cardInk: '#2a1c14',
  },
  night: {
    name: '로맨틱 홈파티 무드',
    bg: '#1c1526',
    desk: '#251c33',
    keyInt: 0.82,
    hemiInt: 0.32,
    cardBgTop: '#241b35',
    cardBgBot: '#171124',
    cardInk: '#fdf8ff',
  },
  pink: {
    name: '키치 딸기 카페',
    bg: '#f8d7e3',
    desk: '#f5cddc',
    keyInt: 2.25,
    hemiInt: 0.7,
    cardBgTop: '#fff5f8',
    cardBgBot: '#fde4ee',
    cardInk: '#381a26',
  },
  wood: {
    name: '따뜻한 우드 테이블',
    bg: '#e5ccb0',
    desk: '#dcbf9e',
    keyInt: 2.3,
    hemiInt: 0.65,
    cardBgTop: '#fffaf2',
    cardBgBot: '#f5e9d6',
    cardInk: '#362112',
  },
};

// ── Three.js 렌더러 & 씬 초기화 ──
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.03;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const INTRO_BG_COLOR = '#f7efe4';
scene.background = new THREE.Color(PHOTO_THEMES.mint.bg);

{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
}

const camera = new THREE.PerspectiveCamera(30, 1, 2, 400);

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

const hemiLight = new THREE.HemisphereLight('#ffffff', '#d8e5e2', 0.65);
scene.add(hemiLight);
const fillLight = new THREE.DirectionalLight('#eef6ff', 0.52);
fillLight.position.set(22, 20, 28);
scene.add(fillLight);

// ── 캔버스 텍스처 & 3D 튜브 도우미 ──
function makeCanvasTex(w, h, drawFn, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawFn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

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
      const a = i * M + j, b = i * M + ((j + 1) % M);
      const c = a + M, d = b + M;
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

// ── 본 게임 작업대 & 3D 생크림 케이크 ──
const RC = 12.8;
const RIN = 11.0;
const HC = 8.4;
const DESK_Y = -13.6;

const mainWorld = new THREE.Group();
scene.add(mainWorld);

const deskMat = new THREE.MeshStandardMaterial({ color: PHOTO_THEMES.mint.desk, roughness: 0.9, metalness: 0 });
const deskMesh = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), deskMat);
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

// 케이크 몸통
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
  im.receiveShadow = true;
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

// ── 쇼케이스용 3D 생일 양초 + 흔들리는 불꽃 + 따뜻한 촛불 조명! ──
const candleGroup = new THREE.Group();
candleGroup.position.set(0, 0, -RIN + 1.8);
candleGroup.visible = false;
cakeRoot.add(candleGroup);

let flameOuterMesh, flameInnerMesh, candleLight;
{
  // 파스텔 스트라이프 양초 기둥
  const candleTex = makeCanvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#fffdf7';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fb7185';
    for (let y = -h; y < h * 2; y += 36) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + 48);
      g.lineTo(w, y + 66);
      g.lineTo(0, y + 18);
      g.closePath();
      g.fill();
    }
  });
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.46, 4.4, 24),
    new THREE.MeshPhysicalMaterial({ map: candleTex, roughness: 0.35, clearcoat: 0.4 })
  );
  wax.position.y = 2.15;
  wax.castShadow = true;
  candleGroup.add(wax);

  // 초 받침 크림 방울 & 심지
  const holder = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.22, 10, 20), creamPipingMat);
  holder.rotation.x = Math.PI / 2;
  holder.position.y = 0.14;
  const wick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8),
    new THREE.MeshBasicMaterial({ color: '#292524' })
  );
  wick.position.y = 4.5;
  candleGroup.add(holder, wick);

  // 바깥 주황 불꽃 + 안쪽 밝은 노란 코어
  flameOuterMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 16, 14),
    new THREE.MeshBasicMaterial({ color: '#ff922b', transparent: true, opacity: 0.9 })
  );
  flameOuterMesh.position.y = 5.15;
  flameOuterMesh.scale.set(0.75, 1.65, 0.75);

  flameInnerMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 10),
    new THREE.MeshBasicMaterial({ color: '#fff9db' })
  );
  flameInnerMesh.position.y = 5.02;
  flameInnerMesh.scale.set(0.7, 1.4, 0.7);
  candleGroup.add(flameOuterMesh, flameInnerMesh);

  candleLight = new THREE.PointLight('#ff9f43', 28, 36, 1.6);
  candleLight.position.set(0, 5.6, 0);
  candleGroup.add(candleLight);
}

// 케이크 윗면 은은한 크림 점선 밑그림 메쉬 + 오른쪽 공간 부족 점선 경고 칸
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

// 실제로 펜 끝이 생크림 로제트 코앞에 다가갔을 때만 은은하게 알려주는 원형 테두리 링
const edgeWarnRingMat = new THREE.MeshBasicMaterial({
  color: '#fb923c',
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
const edgeWarnRing = new THREE.Mesh(
  new THREE.RingGeometry(RIN - 0.14, RIN + 0.06, 80),
  edgeWarnRingMat
);
edgeWarnRing.rotation.x = -Math.PI / 2;
edgeWarnRing.position.y = 0.032;
edgeWarnRing.renderOrder = 2;
edgeWarnRing.visible = false;
cakeRoot.add(edgeWarnRing);

const strokesGroup = new THREE.Group();
cakeRoot.add(strokesGroup);

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

// ── 3D 초코 짤주머니 펜 + 5손가락·손톱·팔뚝·흰 소매 ──
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

function setHandVisible(vis) {
  penGroup.visible = vis;
  foreArmMesh.visible = vis;
  sleeveMesh.visible = vis;
  cuffMesh.visible = vis;
}

function updatePenAndHand(tipWorld, axisDir, grip, dropRadius = 0.14) {
  _basisY.copy(axisDir).normalize();
  _basisX.set(0.72, 0.7, 0).addScaledVector(_basisY, -0.72 * _basisY.x - 0.7 * _basisY.y).normalize();
  _basisZ.crossVectors(_basisX, _basisY);
  _mat4.makeBasis(_basisX, _basisY, _basisZ);
  penGroup.quaternion.setFromRotationMatrix(_mat4);
  penGroup.position.copy(tipWorld);

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

// ── 4컷 하드컷 베이커리 오프닝 세트 ──
const introWorld = new THREE.Group();
introWorld.visible = false;
scene.add(introWorld);

const introRefs = {};
{
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: '#e6cfb3', roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -8;
  floor.receiveShadow = true;
  introWorld.add(floor);

  const doorScene = new THREE.Group();
  introWorld.add(doorScene);
  introRefs.doorScene = doorScene;

  const shopWall = new THREE.Mesh(
    new THREE.BoxGeometry(36, 26, 1.2),
    new THREE.MeshStandardMaterial({ color: '#fff8ec', roughness: 0.85 })
  );
  shopWall.position.set(0, 4, -6);
  doorScene.add(shopWall);

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

  const shopInterior = new THREE.Group();
  introWorld.add(shopInterior);
  introRefs.shopInterior = shopInterior;

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 46),
    new THREE.MeshStandardMaterial({ color: '#f9efe2', roughness: 0.9 })
  );
  backWall.position.set(0, 10, -14);
  shopInterior.add(backWall);

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

  // 빵모자 쓴 케이크집 사장님 (눈·코·입 없음!)
  const baker = new THREE.Group();
  baker.position.set(0, -1.5, -6.8);
  shopInterior.add(baker);
  introRefs.baker = baker;

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(2.45, 3.4, 14, 24),
    new THREE.MeshStandardMaterial({ color: '#fffdf9', roughness: 0.78 })
  );
  torso.position.y = 3.5;
  torso.castShadow = true;
  baker.add(torso);

  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(1.38, 0.28, 10, 24),
    new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.6 })
  );
  scarf.rotation.x = Math.PI / 2 + 0.15;
  scarf.position.set(0, 5.85, 0.15);
  baker.add(scarf);

  const apron = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.65, 4.6, 24, 1, false, -Math.PI * 0.44, Math.PI * 0.88),
    new THREE.MeshStandardMaterial({ color: '#8c5832', roughness: 0.75 })
  );
  apron.position.y = 3.05;
  baker.add(apron);

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

// ── 게임 & 쇼케이스 상태 ──
let state = 'title'; // 'title' | 'intro' | 'playing' | 'showcase'
let playMode = 'stage'; // 'stage' | 'custom'
let customPhrase = '생일 축하해 ♥';
let introTime = 0;
let introCutPlayed = -1;
const INTRO_TOTAL = 3.85;

let stageIdx = 0;
let activeStageObj = STAGES[0];
let currentStrokes = [];
let activeStroke = null;

// 초코 물리 상태
let isPressing = false;
let pointerCakeXZ = V(2.5, 0, 2.5);
let pressHoldSec = 0;
let dwellCharge = 0;
let currentGrip = 0.08;
let currentRadius = 0.14;
let lastSqueezeSfxAt = 0;
let lastBlobWarnAt = 0;
let maxWrittenX = -RIN;
let maxWrittenRadial = 0;
let outOfBoundsLen = 0;
let blobCount = 0;

// 360° 쇼케이스 오빗 카메라 & 커스텀 상태
let orbitAzimuth = 0;            // 좌우 회전각 (라디안)
let orbitElevation = 42 * DEG;   // 상하 각도 (22° ~ 84°)
let orbitDist = 66;              // 거리 (줌)
let targetAzimuth = 0;
let targetElevation = 42 * DEG;
let targetDist = 66;
let autoSpin = false;
let candleOn = true;
let photoThemeKey = 'mint';
let isOrbitDragging = false;
let orbitStartX = 0;
let orbitStartY = 0;
let orbitPrevX = 0;
let orbitPrevY = 0;
let cleanHintTimer = null;
let currentVerdict = { tag: '', text: '' };
let latestCardDataUrl = '';
let latestCardFile = null;

const CAM_EL = 60 * DEG;
const CAM_A = { tg: V(0.8, 0, 2.2), d: 72 };
const CAM_B = { tg: V(5.4, 0, 1.2), d: 46 };
let camZoom = 0;

// ── BGM 버튼 ──
function syncBgmBtn() {
  if (!btnBgm) return;
  const muted = BGM.isMuted();
  btnBgm.textContent = muted ? '🔇 BGM' : '🔊 BGM';
  btnBgm.classList.toggle('bgm-off', muted);
}
syncBgmBtn();
btnBgm.addEventListener('click', () => {
  unlockAudio();
  const muted = BGM.toggleMute();
  syncBgmBtn();
  showToast(muted ? '🔇 BGM이 꺼졌어요' : '🔊 BGM이 켜졌어요');
});

// ── 시작 모달: 모드 전환 & 추천 문구 칩 ──
tabModeStage.addEventListener('click', () => {
  playMode = 'stage';
  tabModeStage.classList.add('active');
  tabModeCustom.classList.remove('active');
  stageModeDesc.classList.remove('hidden');
  customModeBox.classList.add('hidden');
});

tabModeCustom.addEventListener('click', () => {
  playMode = 'custom';
  tabModeCustom.classList.add('active');
  tabModeStage.classList.remove('active');
  stageModeDesc.classList.add('hidden');
  customModeBox.classList.remove('hidden');
});

document.querySelectorAll('.preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    customPhraseInput.value = chip.dataset.phrase || '';
  });
});

// URL 쿼리(?msg=...)로 문구가 전달된 경우 자동으로 자유 문구 세팅 (바이럴 링크 유입!)
{
  const qs = new URLSearchParams(location.search);
  const sharedMsg = (qs.get('msg') || '').trim().slice(0, 18);
  if (sharedMsg) {
    playMode = 'custom';
    customPhraseInput.value = sharedMsg;
    tabModeCustom.click();
  }
}

// ── 포토존 테마 적용 ──
function applyPhotoTheme(key) {
  photoThemeKey = PHOTO_THEMES[key] ? key : 'mint';
  const th = PHOTO_THEMES[photoThemeKey];
  scene.background.set(th.bg);
  deskMat.color.set(th.desk);
  keyLight.intensity = th.keyInt;
  hemiLight.intensity = th.hemiInt;

  document.querySelectorAll('[data-theme]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === photoThemeKey);
  });
}

document.querySelectorAll('[data-theme]').forEach(btn => {
  btn.addEventListener('click', () => {
    applyPhotoTheme(btn.dataset.theme);
    if (btn.dataset.theme === 'night' && !candleOn) {
      candleOn = true;
      candleGroup.visible = true;
      chipCandle.classList.add('active');
      chipCandle.textContent = '🕯️ 촛불 켜짐';
    }
  });
});

// ── 문구 자동 줄바꿈 & 케이크 원형 안쪽 100% 실측 맞춤(Auto-Fit) 도우미 ──
function splitCakeLines(rawText) {
  const clean = (rawText || '생일 축하해 ♥').trim().replace(/\s+/g, ' ') || '생일 축하해 ♥';
  const noSpaceLen = clean.replace(/\s+/g, '').length;
  if (noSpaceLen <= 7) return [clean];

  // 띄어쓰기가 있으면 전체 길이의 정중앙에 가장 가까운 공백에서 2줄 분리
  if (clean.includes(' ')) {
    const words = clean.split(' ');
    let bestIdx = 1;
    let bestDiff = 999;
    for (let i = 1; i < words.length; i++) {
      const l1 = words.slice(0, i).join(' ');
      const l2 = words.slice(i).join(' ');
      const diff = Math.abs(l1.length - l2.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }
    return [words.slice(0, bestIdx).join(' '), words.slice(bestIdx).join(' ')];
  }

  // 띄어쓰기가 없는 긴 문구는 가운데에서 2줄 분리
  const mid = Math.ceil(clean.length / 2);
  return [clean.slice(0, mid), clean.slice(mid)];
}

function fitCakeFontPx(ctx, lines, desiredPx, fontWeight, maxWidthPx) {
  const family = '"Pretendard","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  let px = Math.min(desiredPx, lines.length > 1 ? 168 : 420);
  ctx.font = `${fontWeight} ${px}px ${family}`;

  let maxW = 0;
  for (const ln of lines) {
    maxW = Math.max(maxW, ctx.measureText(ln).width);
  }
  if (maxW > maxWidthPx && maxW > 0) {
    px = Math.max(44, Math.floor(px * (maxWidthPx / maxW) * 0.96));
    ctx.font = `${fontWeight} ${px}px ${family}`;
  }
  return { px, fontStr: `${fontWeight} ${px}px ${family}` };
}

// ── 스테이지 / 자유문구 초기화 ──
function buildCustomStageObj(phraseText) {
  const clean = (phraseText || '생일 축하해 ♥').trim().replace(/\s+/g, ' ') || '생일 축하해 ♥';
  const len = clean.replace(/\s+/g, '').length;
  const lines = splitCakeLines(clean);
  return {
    no: 1,
    chip: '💌 자유 문구',
    kicker: '💌 세상에 하나뿐인 수제 케이크',
    phrase: clean,
    lines,
    cakeScale: 1.0,
    guideAlpha: 0.2,
    fontScale: len <= 2 ? 0.36 : 0.24,
    charSlots: Math.max(2, len),
    dottedGuide: len <= 3,
    tip: '누르고 머물면 굵게, 빠르게 그으면 얇게! 완성 후 360°로 돌려 캡처할 수 있어요!',
  };
}

function setupStage(idx) {
  stageIdx = idx;
  activeStageObj = playMode === 'custom'
    ? buildCustomStageObj(customPhrase)
    : STAGES[stageIdx];
  const stg = activeStageObj;

  for (const s of currentStrokes) {
    strokesGroup.remove(s.mesh);
    s.mesh.geometry.dispose();
  }
  currentStrokes = [];
  activeStroke = null;
  activeHeadMesh.visible = false;
  liveStreamMesh.visible = false;
  candleGroup.visible = false;

  isPressing = false;
  pressHoldSec = 0;
  dwellCharge = 0;
  currentGrip = 0.08;
  currentRadius = 0.14;
  maxWrittenX = -RIN;
  maxWrittenRadial = 0;
  outOfBoundsLen = 0;
  blobCount = 0;
  edgeWarnRing.visible = false;
  cakeRoot.rotation.set(0, 0, 0);
  cakeRoot.scale.setScalar(stg.cakeScale);
  applyPhotoTheme('mint');
  setHandVisible(true);
  document.body.classList.remove('in-showcase', 'clean-capture');
  cleanHint.classList.add('hidden');

  // 케이크 윗면 은은한 가이드 렌더링 (실측 너비 자동 맞춤으로 어떤 문구든 원 안쪽에 100% 쏙 담김!)
  guideCtx.clearRect(0, 0, 1024, 1024);
  guideCtx.save();
  guideCtx.strokeStyle = 'rgba(195, 168, 132, 0.28)';
  guideCtx.lineWidth = 4;
  guideCtx.setLineDash([16, 14]);
  guideCtx.beginPath();
  guideCtx.arc(512, 512, 492, 0, TAU);
  guideCtx.stroke();

  // 크림 장식 안쪽 안전 원으로 클리핑해 절대 바깥으로 삐져나가지 않게 보호
  guideCtx.beginPath();
  guideCtx.arc(512, 512, 470, 0, TAU);
  guideCtx.clip();

  const isTwoLines = stg.lines.length > 1;
  const safeMaxWidth = isTwoLines ? 690 : 760;

  if (stg.dottedGuide) {
    const desiredPx = Math.round(1024 * stg.fontScale);
    const { fontStr } = fitCakeFontPx(guideCtx, stg.lines, desiredPx, 900, safeMaxWidth);
    guideCtx.font = fontStr;
    guideCtx.textAlign = 'center';
    guideCtx.textBaseline = 'middle';
    guideCtx.strokeStyle = `rgba(138, 96, 62, ${stg.guideAlpha})`;
    guideCtx.lineWidth = 6;
    guideCtx.setLineDash([14, 12]);
    guideCtx.strokeText(stg.lines[0], 512, 512);
  } else {
    const desiredPx = Math.round(1024 * stg.fontScale * 0.88);
    const { px, fontStr } = fitCakeFontPx(guideCtx, stg.lines, desiredPx, 800, safeMaxWidth);
    guideCtx.font = fontStr;
    guideCtx.textAlign = 'center';
    guideCtx.textBaseline = 'middle';

    if (!isTwoLines) {
      const textW = Math.min(safeMaxWidth, guideCtx.measureText(stg.lines[0]).width + 44);
      const lineY = 512 + Math.round(px * 0.62);
      guideCtx.strokeStyle = 'rgba(165, 124, 88, 0.24)';
      guideCtx.lineWidth = 3;
      guideCtx.setLineDash([12, 14]);
      guideCtx.beginPath();
      guideCtx.moveTo(512 - textW / 2, lineY);
      guideCtx.lineTo(512 + textW / 2, lineY);
      guideCtx.stroke();

      guideCtx.setLineDash([]);
      guideCtx.fillStyle = `rgba(138, 96, 62, ${clamp(stg.guideAlpha * 0.72, 0.09, 0.2)})`;
      guideCtx.fillText(stg.lines[0], 512, 512);
    } else {
      const gap = Math.max(px * 1.38, 128);
      const y0 = 512 - gap * 0.5;
      const y1 = 512 + gap * 0.5;

      guideCtx.strokeStyle = 'rgba(165, 124, 88, 0.22)';
      guideCtx.lineWidth = 3;
      guideCtx.setLineDash([12, 14]);
      [ [stg.lines[0], y0], [stg.lines[1], y1] ].forEach(([ln, cy]) => {
        const tw = Math.min(safeMaxWidth, guideCtx.measureText(ln).width + 40);
        const ly = cy + Math.round(px * 0.6);
        guideCtx.beginPath();
        guideCtx.moveTo(512 - tw / 2, ly);
        guideCtx.lineTo(512 + tw / 2, ly);
        guideCtx.stroke();
      });

      guideCtx.setLineDash([]);
      guideCtx.fillStyle = `rgba(138, 96, 62, ${clamp(stg.guideAlpha * 0.72, 0.09, 0.2)})`;
      guideCtx.fillText(stg.lines[0], 512, y0);
      guideCtx.fillText(stg.lines[1], 512, y1);
    }
  }
  guideCtx.restore();
  guideTex.needsUpdate = true;
  guidePlane.visible = true;

  if (playMode === 'custom') {
    stageStepsEl.innerHTML = `<div class="stage-dot active" style="max-width:180px">💌 내 맘대로 레터링 모드</div>`;
  } else {
    stageStepsEl.innerHTML = STAGES.map((s, i) => {
      const cls = i < stageIdx ? 'stage-dot done' : i === stageIdx ? 'stage-dot active' : 'stage-dot';
      return `<div class="${cls}">${s.chip}</div>`;
    }).join('');
  }

  orderKickerEl.textContent = stg.kicker;
  orderPhraseEl.textContent = stg.phrase;
  guideChipEl.textContent = stg.tip;
  guideChipEl.classList.remove('warn');
  btnFinish.disabled = true;

  updateSpaceHUD();
  BGM.setUrgent(false);
}

function getRemainingCm() {
  const s = activeStageObj.cakeScale || 1;
  return clamp((RIN - maxWrittenRadial) * s, 0, RIN * s);
}

function updateSpaceHUD() {
  const stg = activeStageObj;
  const fullMarginCm = RIN * stg.cakeScale;
  const remCm = currentStrokes.length === 0 && !activeStroke ? fullMarginCm : getRemainingCm();
  spacePillEl.textContent = `테두리 여유 ${remCm.toFixed(1)}cm`;

  const isTight = (currentStrokes.length > 0 || activeStroke) && remCm < 2.2 * stg.cakeScale;
  spacePillEl.style.color = remCm <= 0.7 ? '#fca5a5' : isTight ? '#fdba74' : '#ffffff';
}

// ── 레이캐스트 & 획 3D 빌드 ──
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

  const P = [], R = [];
  const pFirst = pts[0];
  const dir0 = V(pts[1].x - pFirst.x, 0, pts[1].z - pFirst.z);
  if (dir0.lengthSq() < 1e-6) dir0.set(1, 0, 0);
  else dir0.normalize();

  for (let c = 0; c < 2; c++) {
    const a = (74 - c * 34) * DEG;
    P.push(V(pFirst.x - dir0.x * pFirst.r * Math.sin(a), pFirst.y, pFirst.z - dir0.z * pFirst.r * Math.sin(a)));
    R.push(pFirst.r * 0.98 * Math.cos(a));
  }

  for (let i = 0; i < pts.length; i++) {
    P.push(V(pts[i].x, pts[i].y, pts[i].z));
    R.push(pts[i].r);
  }

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

// ── 포인터 입력 (글씨 쓰기 + 쇼케이스 360° 드래그 회전 + 깔끔 캡처 복귀) ──
function onPointerDown(e) {
  if (state === 'intro') {
    finishIntroToPlay();
    return;
  }

  if (state === 'showcase') {
    isOrbitDragging = true;
    autoSpin = false;
    chipSpin.classList.remove('active');
    orbitStartX = orbitPrevX = e.clientX;
    orbitStartY = orbitPrevY = e.clientY;
    return;
  }

  if (state !== 'playing') return;
  if (e.button != null && e.button !== 0) return;

  unlockAudio();
  if (!screenToCakeLocal(e.clientX, e.clientY, pointerCakeXZ)) return;
  if (Math.hypot(pointerCakeXZ.x, pointerCakeXZ.z) > RC * 1.05) return;

  isPressing = true;
  pressHoldSec = 0;
  dwellCharge = 0.16;
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
  maxWrittenRadial = Math.max(maxWrittenRadial, Math.hypot(pointerCakeXZ.x, pointerCakeXZ.z) + currentRadius);

  rebuildStrokeMesh(activeStroke, false);
  SFX.chocoSqueeze(0.4);
  btnFinish.disabled = false;
  updateSpaceHUD();
}

function onPointerMove(e) {
  if (state === 'showcase') {
    if (!isOrbitDragging) return;
    const dx = e.clientX - orbitPrevX;
    const dy = e.clientY - orbitPrevY;
    orbitPrevX = e.clientX;
    orbitPrevY = e.clientY;

    // 좌우 드래그: 360° 자유 회전, 상하 드래그: 측면 얼짱각도(22°) ~ 완전 탑뷰(84°) 자유 조절!
    targetAzimuth -= dx * 0.0085;
    targetElevation = clamp(targetElevation + dy * 0.0065, 22 * DEG, 84 * DEG);
    chipAngleHero.classList.remove('active');
    chipAngleTop.classList.remove('active');
    return;
  }

  if (state !== 'playing') return;
  screenToCakeLocal(e.clientX, e.clientY, pointerCakeXZ);
}

function finishActiveStroke(e) {
  if (state === 'showcase') {
    if (isOrbitDragging && document.body.classList.contains('clean-capture') && e && e.clientX != null) {
      const moved = Math.hypot(e.clientX - orbitStartX, e.clientY - orbitStartY);
      if (moved < 8) {
        document.body.classList.remove('clean-capture');
        cleanHint.classList.add('hidden');
      }
    }
    isOrbitDragging = false;
    return;
  }
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

// 마우스 휠 줌 지원 (쇼케이스에서 확대/축소)
gl.addEventListener('wheel', e => {
  if (state !== 'showcase') return;
  e.preventDefault();
  targetDist = clamp(targetDist + e.deltaY * 0.04, 42, 92);
}, { passive: false });

// ── 바이럴 포인트: 초코 획 물리 분석 → 빵모자 사장님의 팩폭 감정평 생성! ──
function analyzeViralVerdict() {
  let leftSpanSum = 0, leftCnt = 0;
  let rightSpanSum = 0, rightCnt = 0;
  let maxR = 0, minR = 99;
  let minX = 99, maxX = -99;
  let totalLen = 0;

  for (const st of currentStrokes) {
    let sMinZ = 99, sMaxZ = -99, sAvgX = 0;
    for (let i = 0; i < st.pts.length; i++) {
      const p = st.pts[i];
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      sMinZ = Math.min(sMinZ, p.z);
      sMaxZ = Math.max(sMaxZ, p.z);
      sAvgX += p.x;
      maxR = Math.max(maxR, p.r);
      minR = Math.min(minR, p.r);
      if (i > 0) {
        totalLen += Math.hypot(p.x - st.pts[i - 1].x, p.z - st.pts[i - 1].z);
      }
    }
    sAvgX /= Math.max(1, st.pts.length);
    const h = sMaxZ - sMinZ;
    if (sAvgX < 0) { leftSpanSum += h; leftCnt++; }
    else { rightSpanSum += h; rightCnt++; }
  }

  const leftH = leftCnt > 0 ? leftSpanSum / leftCnt : 0;
  const rightH = rightCnt > 0 ? rightSpanSum / rightCnt : 0;
  const remCm = getRemainingCm();

  if (outOfBoundsLen > 1.8) {
    return {
      tag: '👨‍🍳 감정 결과: 자유로운 영혼파',
      text: '“생크림 꽃밭까지 초코로 점령하셨네요! 식탁보까지 쓰실 기세ㅋㅋ”',
    };
  }
  if (leftCnt >= 1 && rightCnt >= 1 && leftH > rightH * 1.65 && maxX > RIN * 0.65) {
    return {
      tag: '👨‍🍳 감정 결과: 전형적인 앞글자 과투자형',
      text: '“앞은 대문짝만하고 뒤로 갈수록 개미 목소리! 쇼츠 명장면 그 자체ㅋㅋ”',
    };
  }
  if (blobCount >= 2 || maxR > 0.48) {
    return {
      tag: '👨‍🍳 감정 결과: 당황한 초코 혹 제조기',
      text: '“중간에 멈칫해서 생긴 통통한 초코 혹이 진심이 담긴 증거예요!”',
    };
  }
  if (totalLen < 9) {
    return {
      tag: '👨‍🍳 감정 결과: 극단적 미니멀리스트',
      text: '“초코 아껴 주셔서 감사합니다(?!) 여백의 미가 예술이네요!”',
    };
  }
  if (remCm < 1.3 && outOfBoundsLen <= 0.4) {
    return {
      tag: '👨‍🍳 감정 결과: 숨 참는 0.3cm의 기적',
      text: '“크림 바로 코앞에서 딱 멈췄어요!! 심장 쫄깃한 명품 배치 인정!”',
    };
  }
  if (maxR - minR > 0.22) {
    return {
      tag: '👨‍🍳 감정 결과: 붓글씨 서예가형 파티시에',
      text: '“굵고 가는 필력 강약 조절이 예사롭지 않아요! 당장 진열장 직행!”',
    };
  }
  return {
    tag: '👨‍🍳 감정 결과: 금손 수제 쇼콜라티에',
    text: '“비율도 깔끔함도 완벽해요! 이대로 박스에 담아 선물해도 되겠어요!”',
  };
}

// ── 완성! → 360° 케이크 쇼케이스 진입 ──
function enterShowcase() {
  finishActiveStroke();
  state = 'showcase';
  BGM.setUrgent(false);

  // 밑그림·경고링·손을 모두 비켜 오직 내가 만든 3D 케이크 작품만 돋보이게!
  guidePlane.visible = false;
  edgeWarnRing.visible = false;
  setHandVisible(false);
  liveStreamMesh.visible = false;
  activeHeadMesh.visible = false;

  candleOn = true;
  candleGroup.visible = true;
  chipCandle.classList.add('active');
  chipCandle.textContent = '🕯️ 촛불 켜짐';

  // 입체감이 가장 예쁘게 살아나는 얼짱 각도로 스무스하게 세팅!
  orbitAzimuth = 0;
  targetAzimuth = 0.22;
  orbitElevation = 60 * DEG;
  targetElevation = 44 * DEG;
  orbitDist = 70;
  targetDist = 64;
  autoSpin = true;
  chipSpin.classList.add('active');
  chipAngleHero.classList.add('active');
  chipAngleTop.classList.remove('active');

  currentVerdict = analyzeViralVerdict();
  verdictTagEl.textContent = currentVerdict.tag;
  verdictTextEl.textContent = currentVerdict.text;

  // 기본 메모 자동 추천 (비어 있을 때만)
  if (!cardMemoInput.value.trim()) {
    cardMemoInput.placeholder = `메모 추가 (예: "${activeStageObj.phrase}" 직접 짰어ㅋㅋ)`;
  }

  if (playMode === 'stage' && stageIdx < STAGES.length - 1) {
    btnNextStage.classList.remove('hidden');
    btnNextStage.textContent = `➡️ 다음 (${stageIdx + 2}단계)`;
  } else if (playMode === 'stage') {
    btnNextStage.classList.remove('hidden');
    btnNextStage.textContent = '💌 문구 직접 쓰기';
  } else {
    btnNextStage.classList.remove('hidden');
    btnNextStage.textContent = '✏️ 문구 바꾸기';
  }

  cakeHud.classList.add('hidden');
  bottomDock.classList.add('hidden');
  showcaseTop.classList.remove('hidden');
  showcaseDock.classList.remove('hidden');
  document.body.classList.add('in-showcase');

  SFX.win();
}

btnFinish.addEventListener('click', () => {
  if (state !== 'playing') return;
  enterShowcase();
});

// ── 쇼케이스 조작 버튼들 ──
chipCandle.addEventListener('click', () => {
  candleOn = !candleOn;
  candleGroup.visible = candleOn;
  chipCandle.classList.toggle('active', candleOn);
  chipCandle.textContent = candleOn ? '🕯️ 촛불 켜짐' : '🕯️ 촛불 꺼짐';
  SFX.pop();
});

chipSpin.addEventListener('click', () => {
  autoSpin = !autoSpin;
  chipSpin.classList.toggle('active', autoSpin);
});

chipAngleHero.addEventListener('click', () => {
  targetElevation = 42 * DEG;
  targetDist = 63;
  chipAngleHero.classList.add('active');
  chipAngleTop.classList.remove('active');
});

chipAngleTop.addEventListener('click', () => {
  targetAzimuth = 0;
  targetElevation = 82 * DEG;
  targetDist = 66;
  autoSpin = false;
  chipSpin.classList.remove('active');
  chipAngleTop.classList.add('active');
  chipAngleHero.classList.remove('active');
});

btnCleanView.addEventListener('click', () => {
  document.body.classList.add('clean-capture');
  cleanHint.style.opacity = '1';
  cleanHint.classList.remove('hidden');
  if (cleanHintTimer) clearTimeout(cleanHintTimer);
  cleanHintTimer = setTimeout(() => {
    cleanHint.style.opacity = '0';
  }, 1700);
});

btnRewrite.addEventListener('click', () => {
  showcaseTop.classList.add('hidden');
  showcaseDock.classList.add('hidden');
  setupStage(stageIdx);
  cakeHud.classList.remove('hidden');
  bottomDock.classList.remove('hidden');
  state = 'playing';
});

btnNextStage.addEventListener('click', () => {
  showcaseTop.classList.add('hidden');
  showcaseDock.classList.add('hidden');

  if (playMode === 'stage' && stageIdx < STAGES.length - 1) {
    setupStage(stageIdx + 1);
    cakeHud.classList.remove('hidden');
    bottomDock.classList.remove('hidden');
    state = 'playing';
  } else {
    // 5단계 다 깼거나 자유 문구 모드에서 다른 문구 쓰기를 누른 경우 -> 시작 모달 자유 문구 탭 오픈!
    state = 'title';
    playMode = 'custom';
    tabModeCustom.click();
    startModal.classList.remove('hidden');
  }
});

// ── 바이럴 핵심: 현재 돌려 놓은 각도 그대로 고화질 『404 수제 케이크 폴라로이드 카드』 (1080×1350) 합성! ──
function renderPolaroidCanvas() {
  // 현재 3D 장면을 한 프레임 즉시 렌더해서 최신 각도 보장
  renderer.render(scene, camera);

  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const th = PHOTO_THEMES[photoThemeKey] || PHOTO_THEMES.mint;
  const isDark = photoThemeKey === 'night';

  // 폴라로이드 바탕 그라데이션
  const bgGrad = g.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, th.cardBgTop);
  bgGrad.addColorStop(1, th.cardBgBot);
  g.fillStyle = bgGrad;
  g.fillRect(0, 0, W, H);

  // 상단 공방 스탬프 헤더
  g.fillStyle = isDark ? 'rgba(255,216,74,0.16)' : 'rgba(61,35,20,0.07)';
  g.beginPath();
  g.roundRect(54, 42, 340, 48, 24);
  g.fill();

  g.fillStyle = isDark ? '#ffd84a' : '#6b4226';
  g.font = '900 22px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText('🎂 404 수제 케이크 공방', 78, 66);

  g.textAlign = 'right';
  g.fillStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(61,35,20,0.5)';
  g.font = '700 20px "Pretendard",sans-serif';
  const today = new Date();
  g.fillText(`${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`, W - 58, 66);

  // 중앙 정사각형 고화질 3D 케이크 스냅샷 액자 (972 × 900)
  const fx = 54, fy = 108, fw = W - 108, fh = 880;
  g.save();
  g.shadowColor = 'rgba(0, 0, 0, 0.22)';
  g.shadowBlur = 28;
  g.shadowOffsetY = 12;
  g.fillStyle = th.bg;
  g.beginPath();
  g.roundRect(fx, fy, fw, fh, 34);
  g.fill();
  g.restore();

  g.save();
  g.beginPath();
  g.roundRect(fx, fy, fw, fh, 34);
  g.clip();

  // WebGL 캔버스 중앙 크롭 복사 (찌그러짐 0%!)
  const srcW = gl.width;
  const srcH = gl.height;
  const targetAspect = fw / fh;
  const srcAspect = srcW / srcH;
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
  if (srcAspect > targetAspect) {
    sw = Math.round(srcH * targetAspect);
    sx = Math.round((srcW - sw) / 2);
  } else {
    sh = Math.round(srcW / targetAspect);
    sy = Math.round((srcH - sh) / 2);
  }
  g.drawImage(gl, sx, sy, sw, sh, fx, fy, fw, fh);
  g.restore();

  // 액자 테두리
  g.strokeStyle = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(61,35,20,0.12)';
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(fx, fy, fw, fh, 34);
  g.stroke();

  // 하단 주문 문구 & 메모 & 빵모자 사장님 감정 한줄평
  const memo = cardMemoInput.value.trim();
  const mainTitle = memo || `“${activeStageObj.phrase}”`;

  g.textAlign = 'center';
  g.fillStyle = th.cardInk;
  g.font = '900 44px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.fillText(mainTitle, W / 2, 1054);

  // 감정 한줄평 박스
  g.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(61,35,20,0.06)';
  g.beginPath();
  g.roundRect(72, 1112, W - 144, 126, 24);
  g.fill();

  g.fillStyle = isDark ? '#ffd84a' : '#9c5a25';
  g.font = '900 22px "Pretendard",sans-serif';
  g.fillText(currentVerdict.tag || '👨‍🍳 빵모자 사장님의 감정평', W / 2, 1148);

  g.fillStyle = isDark ? '#f3eeff' : '#4a2e1b';
  g.font = '800 24px "Pretendard",sans-serif';
  const vText = (currentVerdict.text || '').slice(0, 38);
  g.fillText(vText, W / 2, 1196);

  // 맨 아래 은은한 바이럴 출처 안내
  g.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(61,35,20,0.48)';
  g.font = '700 21px "Pretendard",sans-serif';
  g.fillText('나도 직접 초코펜으로 케이크 쓰러 가기 👉 game404-arcade.vercel.app/cake', W / 2, 1292);

  return c;
}

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
}

function triggerDownload(dataUrl) {
  const a = document.createElement('a');
  const safePhrase = (activeStageObj.phrase || 'cake').replace(/[^\w가-힣]/g, '').slice(0, 10) || 'cake';
  a.download = `수제케이크_${safePhrase}.png`;
  a.href = dataUrl;
  a.click();
}

// 1) 케이크 이미지 공유하기 (완성된 폴라로이드 미리보기 + 모바일 네이티브 공유 & 클립보드 이미지 복사!)
btnShareImg.addEventListener('click', async () => {
  const cardCanvas = renderPolaroidCanvas();
  latestCardDataUrl = cardCanvas.toDataURL('image/png');
  const blob = await canvasToBlob(cardCanvas);
  latestCardFile = blob ? new File([blob], 'cake404.png', { type: 'image/png' }) : null;

  const canNativeFileShare = Boolean(
    latestCardFile && navigator.canShare && navigator.canShare({ files: [latestCardFile] })
  );
  btnPreviewNative.style.display = canNativeFileShare ? 'inline-flex' : 'none';

  const isTouchMobile = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const shareUrl = `${location.origin}/cake?msg=${encodeURIComponent(activeStageObj.phrase)}`;

  // 실제 모바일 터치 기기에서는 네이티브 이미지 공유 시트 즉시 호출!
  if (isTouchMobile && canNativeFileShare) {
    try {
      await navigator.share({
        files: [latestCardFile],
        title: '내가 직접 짠 수제 레터링 케이크 🎂',
        text: `한 번 짜면 못 지우는 초코펜으로 직접 썼어ㅋㅋ 너도 해봐!\n${shareUrl}`,
      });
      showToast('📤 케이크 이미지를 공유했어요!');
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }

  // PC 및 인앱 폴백: 클립보드에 이미지 복사 + 고화질 미리보기 카드 즉시 오픈!
  let copiedImage = false;
  if (blob && navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      copiedImage = true;
    } catch {
      copiedImage = false;
    }
  }

  previewImg.src = latestCardDataUrl;
  previewModal.classList.remove('hidden');
  if (copiedImage) {
    showToast('📋 케이크 사진이 복사되었어요! 카톡·메신저에 바로 붙여넣기(⌘V) 하세요!');
  } else {
    showToast('📸 케이크 폴라로이드 완성! 저장하거나 공유해 보세요!');
  }
});

btnPreviewNative.addEventListener('click', async () => {
  if (!latestCardFile || !navigator.share) return;
  const shareUrl = `${location.origin}/cake?msg=${encodeURIComponent(activeStageObj.phrase)}`;
  try {
    await navigator.share({
      files: [latestCardFile],
      title: '내가 직접 짠 수제 레터링 케이크 🎂',
      text: `한 번 짜면 못 지우는 초코펜으로 직접 썼어ㅋㅋ 너도 해봐!\n${shareUrl}`,
    });
  } catch {
    // 사용자 취소 무시
  }
});

// 2) 폴라로이드 카드 바로 저장
btnSaveCard.addEventListener('click', () => {
  const cardCanvas = renderPolaroidCanvas();
  latestCardDataUrl = cardCanvas.toDataURL('image/png');
  triggerDownload(latestCardDataUrl);
  showToast('💾 고화질 폴라로이드 이미지가 저장되었어요!');
});

btnPreviewClose.addEventListener('click', () => previewModal.classList.add('hidden'));
previewModal.addEventListener('click', e => {
  if (e.target === previewModal) previewModal.classList.add('hidden');
});
btnPreviewDownload.addEventListener('click', () => {
  if (latestCardDataUrl) triggerDownload(latestCardDataUrl);
  showToast('💾 파일로 저장되었어요!');
});

// ── 인트로 시작 & 스킵 ──
function startIntro() {
  unlockAudio();
  BGM.start('cake');
  syncBgmBtn();

  if (playMode === 'custom') {
    customPhrase = (customPhraseInput.value || '').trim() || '생일 축하해 ♥';
  }

  startModal.classList.add('hidden');
  previewModal.classList.add('hidden');
  showcaseTop.classList.add('hidden');
  showcaseDock.classList.add('hidden');
  cakeHud.classList.add('hidden');
  bottomDock.classList.add('hidden');
  btnSkipIntro.classList.remove('hidden');

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

  setupStage(0);
  cakeHud.classList.remove('hidden');
  bottomDock.classList.remove('hidden');
  state = 'playing';
}

btnStart.addEventListener('click', startIntro);
btnSkipIntro.addEventListener('click', finishIntroToPlay);

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
window.addEventListener('resize', onResize);
onResize();

function getAspectDistFactor() {
  return camera.aspect < 0.85 ? clamp(0.82 / Math.max(0.42, camera.aspect), 1.0, 1.85) : 1.0;
}

// ── 4컷 하드컷 인트로 오버레이 ──
function drawIntroOverlay(cutIdx, localK) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ovCtx.clearRect(0, 0, w, h);

  const phrasePreview = playMode === 'custom' ? customPhrase : '하트(♥)';
  const captions = [
    { badge: 'CUT 1 · 동네 케이크 공방', main: '딸랑~! 문을 열고 들어갔다!', sub: '달콤한 생크림 냄새가 솔솔~' },
    { badge: 'CUT 2 · 케이크 고르기', main: '“이 새하얀 생크림 케이크로 주세요!”', sub: '글씨 쓰기 딱 좋은 순백의 홀케이크 픽!' },
    { badge: 'CUT 3 · 빵모자 사장님 환영', main: '“어서 오세요~! 문구는 직접 써 보실래요?”', sub: '갓 녹인 쫀득한 초코 짤주머니 증정!' },
    { badge: 'CUT 4 · 멘트 고민 중…', main: `“음… 못 지우는데… ${phrasePreview} 도전?!”`, sub: '누르는 시간에 따라 초코 두께가 달라진다!!' },
  ];
  const c = captions[cutIdx] || captions[0];
  const pop = 1 + 0.06 * Math.exp(-localK * 9);

  ovCtx.save();
  ovCtx.translate(w / 2, h * 0.78);
  ovCtx.scale(pop, pop);

  const bw = Math.min(w * 0.88, 386);
  const bh = 86;
  ovCtx.fillStyle = 'rgba(28, 18, 12, 0.88)';
  ovCtx.strokeStyle = '#ffd84a';
  ovCtx.lineWidth = 2.5;
  ovCtx.beginPath();
  ovCtx.roundRect(-bw / 2, -bh / 2, bw, bh, 20);
  ovCtx.fill();
  ovCtx.stroke();

  ovCtx.fillStyle = '#ffd84a';
  ovCtx.font = '900 11.5px "Pretendard",sans-serif';
  ovCtx.textAlign = 'center';
  ovCtx.fillText(c.badge, 0, -20);

  ovCtx.fillStyle = '#ffffff';
  ovCtx.font = '900 15.5px "Pretendard",sans-serif';
  ovCtx.fillText(c.main, 0, 4);

  ovCtx.fillStyle = '#fde68a';
  ovCtx.font = '700 12px "Pretendard",sans-serif';
  ovCtx.fillText(c.sub, 0, 25);
  ovCtx.restore();
}

// ── 메인 루프 ──
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

  let cut = 0, localK = 0;
  if (introTime < 0.92) { cut = 0; localK = introTime / 0.92; }
  else if (introTime < 1.88) { cut = 1; localK = (introTime - 0.92) / 0.96; }
  else if (introTime < 2.88) { cut = 2; localK = (introTime - 1.88) / 1.0; }
  else { cut = 3; localK = (introTime - 2.88) / 0.97; }

  if (cut !== introCutPlayed) {
    introCutPlayed = cut;
    if (cut === 0) SFX.bell();
    else if (cut === 1) SFX.pop();
    else if (cut === 2) SFX.tick();
    else if (cut === 3) SFX.rustle();
  }

  const af = getAspectDistFactor();

  if (cut === 0) {
    introWorld.visible = true;
    mainWorld.visible = false;
    introRefs.doorScene.visible = true;
    introRefs.shopInterior.visible = false;

    const openAng = ease(clamp(localK * 1.25, 0, 1)) * 1.12;
    introRefs.doorPivot.rotation.y = -openAng;
    introRefs.bellPivot.rotation.z = Math.sin(introTime * 34) * 0.42 * (1 - localK * 0.4);

    camera.position.set(0.3, 4.2, lerp(31 * af, 21 * af, ease(localK)));
    camera.lookAt(0, 3.2, -5.2);
  } else if (cut === 1) {
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
      cg.scale.setScalar(idx === 1 ? 1.04 + 0.1 * poke : 0.92);
    });

    camera.position.set(0.4, 5.2, 16.5 * af);
    camera.lookAt(0, 0.5, -2.5);
  } else if (cut === 2) {
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
    introWorld.visible = false;
    mainWorld.visible = true;
    setHandVisible(true);
    scene.background.set(PHOTO_THEMES.mint.bg);
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

  const stg = activeStageObj;
  const s = cakeRoot.scale.x || 1;

  if (isPressing && activeStroke) {
    pressHoldSec += dt;

    const pts = activeStroke.pts;
    const last = pts[pts.length - 1];
    const dx = pointerCakeXZ.x - last.x;
    const dz = pointerCakeXZ.z - last.z;
    const dist = Math.hypot(dx, dz);
    const speed = dist / Math.max(0.004, dt);

    const speedThinFactor = clamp(1.0 - speed / 26.0, 0.0, 1.0);
    if (speed < 4.5) {
      dwellCharge = clamp(dwellCharge + dt * 1.35, 0, 1.35);
    } else {
      dwellCharge = Math.max(0, dwellCharge - dt * (1.8 + speed * 0.08));
    }

    const holdBoost = clamp(pressHoldSec / 2.2, 0, 0.35);
    const targetRadius = clamp(
      0.105 + 0.12 * speedThinFactor + 0.32 * dwellCharge + 0.12 * holdBoost,
      0.09,
      0.66
    );
    currentRadius = lerp(currentRadius, targetRadius, clamp(dt * 16, 0, 1));
    currentGrip = lerp(currentGrip, clamp(0.32 + dwellCharge * 0.45 + holdBoost * 0.5, 0.28, 0.98), clamp(dt * 14, 0, 1));

    if (dist < 0.11) {
      if (currentRadius > last.r) {
        last.r = currentRadius;
        last.y = 0.02 + currentRadius * 0.16;
        maxWrittenX = Math.max(maxWrittenX, last.x + last.r);
        maxWrittenRadial = Math.max(maxWrittenRadial, Math.hypot(last.x, last.z) + last.r);
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
      const steps = Math.max(1, Math.ceil(dist / 0.16));
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const nx = lerp(last.x, pointerCakeXZ.x, k);
        const nz = lerp(last.z, pointerCakeXZ.z, k);
        const rHere = lerp(last.r, currentRadius, k);
        pts.push({ x: nx, y: 0.02 + rHere * 0.12, z: nz, r: rHere });
        maxWrittenX = Math.max(maxWrittenX, nx + rHere);
        maxWrittenRadial = Math.max(maxWrittenRadial, Math.hypot(nx, nz) + rHere);

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

    const curEnd = pts[pts.length - 1];
    activeHeadMesh.visible = true;
    activeHeadMesh.position.set(curEnd.x, curEnd.y + curEnd.r * 0.48, curEnd.z);
    activeHeadMesh.scale.set(curEnd.r * 1.04, curEnd.r * 0.88, curEnd.r * 1.04);

    const tipHoverH = (0.48 + currentRadius * 1.25) * s;
    _penTipW.set(pointerCakeXZ.x * s, tipHoverH, pointerCakeXZ.z * s);

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

  const thickPct = clamp(((currentRadius - 0.09) / 0.55) * 100, 12, 100);
  thickFillEl.style.width = `${thickPct.toFixed(0)}%`;

  const rightBias = clamp((pointerCakeXZ.x - 2.0) / 8.0, 0, 1);
  _penAxis.set(lerp(0.32, 0.06, rightBias), 0.34, lerp(0.88, 0.94, rightBias)).normalize();
  updatePenAndHand(_penTipW, _penAxis, currentGrip, currentRadius * s * 0.85);

  updateStretchyThreads(dt);

  // 기계적인 3칸 상자·강제 줌인 없이, 실제로 펜 끝이 생크림 테두리 코앞에 다가갔을 때만 원형 테두리 링으로 자연스럽게 알림!
  const pointerEdgeMargin = (RIN - (Math.hypot(pointerCakeXZ.x, pointerCakeXZ.z) + currentRadius)) * s;
  const nearCreamEdge = isPressing && pointerEdgeMargin < 1.6;
  BGM.setUrgent(nearCreamEdge);

  if (nearCreamEdge) {
    edgeWarnRing.visible = true;
    edgeWarnRingMat.opacity = clamp((1.6 - pointerEdgeMargin) / 1.6, 0.15, 0.65) * (0.75 + 0.25 * Math.sin(nowSec * 14));
  } else {
    edgeWarnRing.visible = false;
  }

  const afPlay = lerp(1, getAspectDistFactor(), 0.42);
  _camTarget.copy(CAM_A.tg);
  const camDist = CAM_A.d * afPlay;
  camera.position.set(
    _camTarget.x,
    _camTarget.y + camDist * Math.sin(CAM_EL),
    _camTarget.z + camDist * Math.cos(CAM_EL)
  );
  camera.lookAt(_camTarget);
}

function updateStretchyThreads(dt) {
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
}

function updateShowcase(dt, nowSec) {
  ovCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  updateStretchyThreads(dt);

  if (autoSpin && !isOrbitDragging) {
    targetAzimuth += dt * 0.42;
  }

  orbitAzimuth = lerp(orbitAzimuth, targetAzimuth, clamp(dt * 9, 0, 1));
  orbitElevation = lerp(orbitElevation, targetElevation, clamp(dt * 9, 0, 1));
  orbitDist = lerp(orbitDist, targetDist, clamp(dt * 9, 0, 1));

  // 촛불 흔들림 애니메이션
  if (candleOn && candleGroup.visible) {
    const flick = Math.sin(nowSec * 19) * 0.06 + Math.cos(nowSec * 31) * 0.04;
    flameOuterMesh.scale.set(0.75 + flick * 0.5, 1.65 + flick * 1.4, 0.75 - flick * 0.4);
    flameOuterMesh.position.x = Math.sin(nowSec * 13) * 0.05;
    flameInnerMesh.position.x = flameOuterMesh.position.x * 0.6;
    candleLight.intensity = (photoThemeKey === 'night' ? 42 : 24) + flick * 40;
  }

  const afShow = lerp(1, getAspectDistFactor(), 0.38);
  const d = orbitDist * afShow;
  const lookY = document.body.classList.contains('clean-capture') ? -1.4 : -2.2;

  camera.position.set(
    Math.sin(orbitAzimuth) * Math.cos(orbitElevation) * d,
    lookY + Math.sin(orbitElevation) * d,
    Math.cos(orbitAzimuth) * Math.cos(orbitElevation) * d
  );
  camera.lookAt(0, lookY, 0);
}

function animate(nowMs) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (nowMs - prevNow) / 1000));
  prevNow = nowMs;
  const nowSec = nowMs / 1000;

  if (state === 'title') {
    ovCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    introWorld.visible = false;
    mainWorld.visible = true;
    setHandVisible(true);
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
  } else if (state === 'showcase') {
    updateShowcase(dt, nowSec);
  }

  renderer.render(scene, camera);
}

setupStage(0);
requestAnimationFrame(animate);
