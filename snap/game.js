// 웨딩·여행 스냅 알바 — 10대 월드 명소 멀티 포토존 × 12종 다이내믹 구도 × 100% 리얼 랜덤 기행 3D 웹게임
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SFX, BGM, unlockAudio } from '/shared/audio.js';
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

const GAME_ID = 'snap';
const BEST_STAGE_KEY = 'fgs.snap.bestStage';
const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const IS_REC = new URLSearchParams(location.search).get('rec') === '1';

if (!IS_REC) {
  enforceGameAccess(GAME_ID);
}

// ─── 100% 순수 암호학적 난수 도우미 (재시작마다 매번 완전히 새로운 미션·스팟·구도·돌발 기행!) ───
const _randBuf = new Uint32Array(1);
function trueRand() {
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(_randBuf);
    return _randBuf[0] / 4294967296;
  }
  return Math.random();
}
function randRange(min, max) {
  return min + trueRand() * (max - min);
}
function randPick(arr) {
  return arr[Math.floor(trueRand() * arr.length)];
}
function shuffleTrue(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(trueRand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ─── Three.js 렌더러 & 캔버스 초기화 ───
const glCanvas = $('gl');
const ovCanvas = $('ov');
const ovCtx = ovCanvas.getContext('2d');

const renderer = new THREE.WebGLRenderer({
  canvas: glCanvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#87ceeb');
scene.fog = new THREE.Fog('#87ceeb', 38, 98);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / Math.max(1, window.innerHeight), 0.3, 160);

const hemiLight = new THREE.HemisphereLight('#fffdf7', '#5a6e58', 1.08);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#fff6e0', 1.95);
sunLight.position.set(-14, 28, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 4;
sunLight.shadow.camera.far = 85;
sunLight.shadow.camera.left = -22;
sunLight.shadow.camera.right = 22;
sunLight.shadow.camera.top = 20;
sunLight.shadow.camera.bottom = -16;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

function makeCanvasTexture(w, h, drawFn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  drawFn(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSpeechSprite(text, bg = '#ffffff', fg = '#0f172a', border = '#ef4444') {
  const tex = makeCanvasTexture(512, 144, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = bg;
    g.strokeStyle = border;
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(14, 12, w - 28, h - 42, 28);
    g.fill();
    g.stroke();

    g.beginPath();
    g.moveTo(w / 2 - 18, h - 30);
    g.lineTo(w / 2, h - 6);
    g.lineTo(w / 2 + 18, h - 30);
    g.closePath();
    g.fill();

    g.fillStyle = fg;
    g.font = '900 34px "Pretendard","Apple SD Gothic Neo",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, (h - 30) / 2 + 6);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(3.2, 0.90, 1);
  sp.renderOrder = 20;
  return sp;
}

function create3DHeartGeometry(scale = 1, depth = 0.28) {
  const s = scale;
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.48 * s);
  shape.bezierCurveTo(-0.08 * s, -0.40 * s, -0.58 * s, -0.05 * s, -0.55 * s, 0.28 * s);
  shape.bezierCurveTo(-0.52 * s, 0.56 * s, -0.15 * s, 0.62 * s, 0, 0.36 * s);
  shape.bezierCurveTo(0.15 * s, 0.62 * s, 0.52 * s, 0.56 * s, 0.55 * s, 0.28 * s);
  shape.bezierCurveTo(0.58 * s, -0.05 * s, 0.08 * s, -0.40 * s, 0, -0.48 * s);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth * s,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.09 * s,
    bevelThickness: 0.09 * s,
  });
  geo.center();
  return geo;
}

const SHARED_HEART_GEO = create3DHeartGeometry(0.62, 0.26);

// ─── 12종 다이내믹 스냅 촬영 구도 카탈로그 (`COMPOSITION_PRESETS`) ───
// dragU (-1.4 ~ +1.4: 카메라 좌우 궤도 및 여백), dragV (-1.4 ~ +1.4: 로우앵글 ↔ 하이앵글 & 클로즈업 높이)
const COMPOSITION_PRESETS = [
  {
    id: 'low_hero',
    name: '📐 다리 2m 로우앵글',
    targetU: 0.0, targetV: -0.95, zoom: 1, tilt: 0,
    minStage: 1,
  },
  {
    id: 'side_left',
    name: '📐 왼쪽 40° 입체 측면',
    targetU: -0.92, targetV: 0.05, zoom: 1, tilt: 0,
    minStage: 1,
  },
  {
    id: 'side_right',
    name: '📐 오른쪽 40° 입체 측면',
    targetU: 0.92, targetV: 0.05, zoom: 1, tilt: 0,
    minStage: 1,
  },
  {
    id: 'high_mz',
    name: '📐 MZ 항공 하이앵글',
    targetU: 0.25, targetV: 1.02, zoom: 1, tilt: 0,
    minStage: 1,
  },
  {
    id: 'wide_thirds_l',
    name: '📐 삼분할 풍경 여백(좌)',
    targetU: 0.78, targetV: -0.25, zoom: 0.5, tilt: 0,
    minStage: 1,
  },
  {
    id: 'wide_thirds_r',
    name: '📐 삼분할 풍경 여백(우)',
    targetU: -0.78, targetV: -0.25, zoom: 0.5, tilt: 0,
    minStage: 1,
  },
  {
    id: 'upper_close',
    name: '📐 상반신·소품 클로즈업',
    targetU: -0.28, targetV: 0.42, zoom: 2, tilt: 0,
    minStage: 1,
  },
  {
    id: 'shoes_hem',
    name: '📐 발끝·드레스 감성컷',
    targetU: 0.35, targetV: -0.82, zoom: 2, tilt: 0,
    focusFeet: true,
    minStage: 2,
  },
  {
    id: 'dutch_left',
    name: '📐 힙한 왼쪽 사선(↖)',
    targetU: -0.55, targetV: -0.45, zoom: 1, tilt: -1,
    minStage: 2,
  },
  {
    id: 'dutch_right',
    name: '📐 힙한 오른쪽 사선(↗)',
    targetU: 0.55, targetV: -0.45, zoom: 1, tilt: 1,
    minStage: 2,
  },
  {
    id: 'sky_panorama',
    name: '📐 웅장한 하늘 파노라마',
    targetU: 0.0, targetV: -1.08, zoom: 0.5, tilt: 0,
    minStage: 1,
  },
  {
    id: 'diagonal_bird',
    name: '📐 대각선 하이 사선컷',
    targetU: -0.82, targetV: 0.88, zoom: 0.5, tilt: 1,
    minStage: 3,
  },
];

// ─── 10대 월드 웨딩·여행지 명소 & 10쌍의 커플 구성표 ───
// 스테이지마다 완전히 새로운 명소 씬이 열리고, 각 명소 안에서도 3개의 서로 다른 포토존 스팟을 오가며 촬영합니다!
const STAGE_CONFIGS = [
  {
    stage: 1, venue: 'lake_wedding', venueName: '💍 호숫가 화이트 가든 웨딩',
    coupleName: '순백 클래식 신랑·신부',
    quote: '“꽃 아치·웨딩 오픈카·백조 호수 선착장을 돌며 다양한 각도로 5장 찍어 주세요!”',
    shotsReq: 5, minMatch: 74, timeLimit: 65, basePay: 12000,
    chaosMaxTier: 1, chaosInterval: [2.9, 4.3], maxConcurrentChaos: 1,
    groomColor: '#1e293b', brideColor: '#ffffff', accentColor: '#f472b6', hatType: 'veil', propType: 'bouquet',
  },
  {
    stage: 2, venue: 'euro_cafe', venueName: '☕ 유럽풍 분수 광장 & 노천카페',
    coupleName: '파리지앵 로맨틱 커플',
    quote: '“분수대·빨간 차양 노천카페·시계탑 앞에서 로우앵글이랑 힙한 사선 컷으로 5장 부탁해요!”',
    shotsReq: 5, minMatch: 76, timeLimit: 62, basePay: 14000,
    chaosMaxTier: 1, chaosInterval: [2.4, 3.7], maxConcurrentChaos: 1,
    groomColor: '#334155', brideColor: '#fbcfe8', accentColor: '#e11d48', hatType: 'beret', propType: 'balloon',
  },
  {
    stage: 3, venue: 'emerald_beach', venueName: '🏖️ 제주 무지개 해안도로 & 해변',
    coupleName: '청량 시밀러룩 바캉스 커플',
    quote: '“무지개 방호벽·서핑보드 바·야자수 해변을 오가며 시원한 여백 구도로 6장 찍어 주세요!”',
    shotsReq: 6, minMatch: 78, timeLimit: 66, basePay: 16000,
    chaosMaxTier: 2, chaosInterval: [2.2, 3.4], maxConcurrentChaos: 1,
    groomColor: '#0284c7', brideColor: '#f0f9ff', accentColor: '#fde047', hatType: 'straw_hat', propType: 'bouquet',
  },
  {
    stage: 4, venue: 'amusement_park', venueName: '🎠 대관람차 & 회전목마 유원지',
    coupleName: '교복·머리띠 놀이공원 커플',
    quote: '“돌아가는 대관람차랑 회전목마가 한눈에 걸리게 각도를 잘 돌려서 6장 찍어 주세요!”',
    shotsReq: 6, minMatch: 80, timeLimit: 64, basePay: 19000,
    chaosMaxTier: 2, chaosInterval: [1.9, 3.0], maxConcurrentChaos: 2,
    groomColor: '#1d4ed8', brideColor: '#fef08a', accentColor: '#fb7185', hatType: 'ribbon', propType: 'balloon',
  },
  {
    stage: 5, venue: 'sunset_cliff', venueName: '🌅 노을빛 등대 & 빨간 전화부스 절벽',
    coupleName: '선셋 감성 트렌치 커플',
    quote: '“석양 등대·빨간 공중전화 부스·전망 난간에서 역광 감성 7장! 이상한 난입꾼들 피해서요!”',
    shotsReq: 7, minMatch: 81, timeLimit: 68, basePay: 22000,
    chaosMaxTier: 2, chaosInterval: [1.7, 2.8], maxConcurrentChaos: 2,
    groomColor: '#78350f', brideColor: '#fed7aa', accentColor: '#f97316', hatType: 'beret', propType: 'bouquet',
  },
  {
    stage: 6, venue: 'ginkgo_avenue', venueName: '🍂 열기구 뜨는 황금 은행나무길',
    coupleName: '가을 캠퍼밴 여행 커플',
    quote: '“빈티지 캠핑카랑 하늘의 열기구들이 다 나오게 로우 파노라마·측면 구도로 7장 부탁해요!”',
    shotsReq: 7, minMatch: 83, timeLimit: 66, basePay: 25000,
    chaosMaxTier: 3, chaosInterval: [1.55, 2.6], maxConcurrentChaos: 2,
    groomColor: '#92400e', brideColor: '#fef3c7', accentColor: '#dc2626', hatType: 'straw_hat', propType: 'bouquet',
  },
  {
    stage: 7, venue: 'blossom_palace', venueName: '🌸 벚꽃 만개 고궁 연못 & 홍예교',
    coupleName: '파스텔 고운 한복 커플',
    quote: '“붉은 아치 다리·기와 정자·벚꽃 돌담길에서 8장! 알파카랑 UFO가 와도 흔들리지 마세요!”',
    shotsReq: 8, minMatch: 84, timeLimit: 72, basePay: 29000,
    chaosMaxTier: 3, chaosInterval: [1.4, 2.35], maxConcurrentChaos: 2,
    groomColor: '#6366f1', brideColor: '#f9a8d4', accentColor: '#fde047', hatType: 'ribbon', propType: 'bouquet',
  },
  {
    stage: 8, venue: 'snow_chapel', venueName: '❄️ 순백 설원 통나무 채플 & 트리숲',
    coupleName: '윈터 화이트 코트 커플',
    quote: '“눈 내리는 통나무 채플·대형 크리스마스트리·자작나무 썰매 스팟에서 겨울 화보 8장이에요!”',
    shotsReq: 8, minMatch: 85, timeLimit: 70, basePay: 34000,
    chaosMaxTier: 3, chaosInterval: [1.25, 2.15], maxConcurrentChaos: 2,
    groomColor: '#0f172a', brideColor: '#f8fafc', accentColor: '#ef4444', hatType: 'tiara', propType: 'balloon',
  },
  {
    stage: 9, venue: 'lavender_windmill', venueName: '💜 보랏빛 라벤더 언덕 & 대형 풍차',
    coupleName: '프로방스 가든 웨딩 커플',
    quote: '“돌아가는 풍차·라벤더 밭 하얀 그랜드피아노 앞에서 역동적인 앵글로 9장 남겨 주세요!”',
    shotsReq: 9, minMatch: 86, timeLimit: 74, basePay: 40000,
    chaosMaxTier: 3, chaosInterval: [1.1, 1.95], maxConcurrentChaos: 3,
    groomColor: '#4c1d95', brideColor: '#f5f3ff', accentColor: '#c084fc', hatType: 'veil', propType: 'bouquet',
  },
  {
    stage: 10, venue: 'starlight_rooftop', venueName: '🌃 별빛 루프탑 인피니티풀 & 불꽃놀이',
    coupleName: '👑 전설의 VVIP 월드스타 커플',
    quote: '“불꽃놀이가 터지는 마천루 루프탑! 인피니티풀·샴페인 타워·네온 아치를 돌며 대망의 10장!!”',
    shotsReq: 10, minMatch: 87, timeLimit: 80, basePay: 55000,
    chaosMaxTier: 3, chaosInterval: [0.95, 1.75], maxConcurrentChaos: 3,
    groomColor: '#3b0764', brideColor: '#fde047', accentColor: '#38bdf8', hatType: 'tiara', propType: 'bouquet',
  },
];

// ─── 8종 커플 스냅 포즈 ───
const POSE_POOL = [
  { id: 'hand_hold', label: '손잡고 다정 뒷모습', cycleSpeed: 1.50 },
  { id: 'jump_high', label: '하나 둘 셋 점프샷!', cycleSpeed: 1.80 },
  { id: 'bouquet_up', label: '소품 번쩍 만세!', cycleSpeed: 1.60 },
  { id: 'big_heart', label: '머리 위 큰 하트!', cycleSpeed: 1.55 },
  { id: 'lean_in', label: '마주 보고 로맨틱 기울기', cycleSpeed: 1.48 },
  { id: 'kick_leg', label: '한쪽 발 톡! 발랄 포즈', cycleSpeed: 1.70 },
  { id: 'veil_wind', label: '바람에 날리는 실루엣', cycleSpeed: 1.62 },
  { id: 'wide_free', label: '양팔 활짝 자유 만끽!', cycleSpeed: 1.55 },
];

// ─── 10대 월드 명소 3D 디오라마 & 멀티 포토존 스팟 빌더 ───
const venueGroup = new THREE.Group();
scene.add(venueGroup);

// 움직이는 배경 오브젝트들 (대관람차, 풍차 날개, 열기구, 꽃잎·눈송이·불꽃놀이 파티클!)
const envAnimState = {
  ferrisWheel: null,
  carousel: null,
  windmillBlades: null,
  balloons: [],
  ambientParticles: [], // 벚꽃잎 / 눈송이 / 은행잎 / 불꽃
  particleKind: 'none',
};

function clearGroup(grp) {
  while (grp.children.length > 0) {
    grp.remove(grp.children[0]);
  }
}

function addSkyClouds(grp, tint = '#ffffff', baseY = 15, count = 5) {
  const cMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85 });
  for (let i = 0; i < count; i++) {
    const cg = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), cMat);
    p1.scale.set(1.35, 0.72, 0.85);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), cMat);
    p2.position.set(-1.35, -0.18, 0.1);
    const p3 = new THREE.Mesh(new THREE.SphereGeometry(1.25, 10, 8), cMat);
    p3.position.set(1.35, -0.15, -0.1);
    cg.add(p1, p2, p3);
    cg.position.set(-18 + i * 9.2, baseY + (i % 2) * 2.4, -26 - (i % 3) * 4);
    grp.add(cg);
  }
}

function buildVenueScene(venueKey) {
  clearGroup(venueGroup);
  envAnimState.ferrisWheel = null;
  envAnimState.carousel = null;
  envAnimState.windmillBlades = null;
  envAnimState.balloons = [];
  envAnimState.ambientParticles = [];
  envAnimState.particleKind = 'none';

  let spots = [
    { name: '중앙 메인 스팟', x: 0, z: 0, rotY: 0 },
    { name: '왼쪽 서브 스팟', x: -4.8, z: -1.0, rotY: 0.22 },
    { name: '오른쪽 서브 스팟', x: 4.8, z: -1.0, rotY: -0.22 },
  ];

  const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.32 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.42 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.16, metalness: 0.85 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.22, metalness: 0.72 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.68 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.55 });

  if (venueKey === 'lake_wedding') {
    scene.background = new THREE.Color('#7dd3fc');
    scene.fog = new THREE.Fog('#bae6fd', 44, 110);
    sunLight.color.set('#fffbeb');
    sunLight.intensity = 2.0;
    addSkyClouds(venueGroup, '#ffffff', 15.5, 5);

    const grass = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 32), new THREE.MeshStandardMaterial({ color: '#65a30d', roughness: 0.82 }));
    grass.position.set(0, -0.5, 3);
    grass.receiveShadow = true;
    const lake = new THREE.Mesh(new THREE.BoxGeometry(100, 0.8, 52), new THREE.MeshPhysicalMaterial({ color: '#0ea5e9', roughness: 0.10, clearcoat: 1.0 }));
    lake.position.set(0, -0.62, -33);
    const aisle = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.08, 22), new THREE.MeshStandardMaterial({ color: '#fffbeb', roughness: 0.45 }));
    aisle.position.set(0, 0.04, 2);
    const aisleTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 22), goldMat);
    aisleTrimL.position.set(-2.05, 0.05, 2);
    const aisleTrimR = aisleTrimL.clone();
    aisleTrimR.position.x = 2.05;
    venueGroup.add(grass, lake, aisle, aisleTrimL, aisleTrimR);

    // 원경 푸른 산 능선
    const hillMat = new THREE.MeshStandardMaterial({ color: '#34d399', roughness: 0.85 });
    for (const [hx, hz, r, h] of [[-18, -42, 12, 7.5], [0, -46, 15, 9.2], [19, -43, 13, 8.0]]) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), hillMat);
      hill.position.set(hx, h * 0.4, hz);
      venueGroup.add(hill);
    }

    // [스팟 1: 중앙 이중 골드·화이트 장미 웨딩 아치 & 플라워 필라]
    const archRing = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.16, 14, 36, Math.PI), whiteMat);
    archRing.position.set(0, 2.25, -2.0);
    const archGoldInner = new THREE.Mesh(new THREE.TorusGeometry(3.08, 0.06, 10, 36, Math.PI), goldMat);
    archGoldInner.position.set(0, 2.25, -1.96);
    for (const sx of [-3.35, 3.35]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 2.3, 14), whiteMat);
      post.position.set(sx, 1.15, -2.0);
      const basePed = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.62), whiteMat);
      basePed.position.set(sx, 0.12, -2.0);
      const drape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.46, 2.1, 12),
        new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.78 })
      );
      drape.position.set(sx * 0.96, 1.4, -1.88);
      venueGroup.add(post, basePed, drape);
    }
    venueGroup.add(archRing, archGoldInner);

    const flCols = ['#fb7185', '#f472b6', '#fde047', '#ffffff', '#fda4af'];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI;
      const cx = Math.cos(a) * 3.35;
      const cy = 2.25 + Math.sin(a) * 3.35;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), foliageMat);
      leaf.scale.set(1.2, 0.8, 0.7);
      leaf.position.set(cx, cy, -2.02);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.28 + (i % 2) * 0.08, 12, 10), new THREE.MeshStandardMaterial({ color: flCols[i % 5], roughness: 0.35 }));
      fl.position.set(cx, cy, -1.82);
      venueGroup.add(leaf, fl);
    }
    // 버진로드 양옆 플라워 스탠드 4기
    for (const [px, pz] of [[-2.4, 0.5], [2.4, 0.5], [-2.4, 3.8], [2.4, 3.8]]) {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.05, 12), whiteMat);
      ped.position.set(px, 0.52, pz);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.45 }));
      bush.position.set(px, 1.22, pz);
      venueGroup.add(ped, bush);
    }

    // [스팟 2: 왼쪽 민트 클래식 오픈 웨딩카 (펜더·범퍼·헤드라이트·가죽시트·핸들·휠캡 완비!)]
    const carGrp = new THREE.Group();
    carGrp.position.set(-6.3, 0, -2.7);
    carGrp.rotation.y = 0.38;
    const mintBodyMat = new THREE.MeshPhysicalMaterial({ color: '#5eead4', roughness: 0.20, metalness: 0.15, clearcoat: 0.9 });
    const creamSeatMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.5 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.78, 2.08), mintBodyMat);
    chassis.position.y = 0.72;
    chassis.castShadow = true;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.34, 1.88), mintBodyMat);
    hood.position.set(1.25, 1.18, 0);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 1.88), mintBodyMat);
    trunk.position.set(-1.45, 1.15, 0);
    const bumperF = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 2.18, 12), chromeMat);
    bumperF.rotation.x = Math.PI / 2;
    bumperF.position.set(2.26, 0.52, 0);
    const bumperR = bumperF.clone();
    bumperR.position.x = -2.26;
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 1.10), chromeMat);
    grille.position.set(2.22, 0.85, 0);

    for (const sz of [-0.68, 0.68]) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.14, 14), new THREE.MeshBasicMaterial({ color: '#fef9c3' }));
      lamp.rotation.z = Math.PI / 2;
      lamp.position.set(2.22, 1.05, sz);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.58, 0.74), creamSeatMat);
      seat.position.set(-0.28, 1.25, sz * 0.65);
      carGrp.add(lamp, seat);
    }
    const steering = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.035, 8, 16), darkMat);
    steering.rotation.y = Math.PI / 2 - 0.35;
    steering.position.set(0.32, 1.38, -0.44);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.68, 1.86),
      new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', transmission: 0.65, transparent: true, opacity: 0.82 })
    );
    windshield.position.set(0.56, 1.56, 0);
    windshield.rotation.z = -0.28;
    const wsFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 1.92), chromeMat);
    wsFrame.position.set(0.46, 1.88, 0);
    carGrp.add(chassis, hood, trunk, bumperF, bumperR, grille, steering, windshield, wsFrame);

    for (const [wx, wz] of [[-1.32, -1.06], [1.32, -1.06], [-1.32, 1.06], [1.32, 1.06]]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.28, 20), darkMat);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(wx, 0.46, wz);
      const hubcap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.30, 16), chromeMat);
      hubcap.rotation.x = Math.PI / 2;
      hubcap.position.set(wx, 0.46, wz);
      const fender = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.11, 8, 16, Math.PI), mintBodyMat);
      fender.position.set(wx, 0.48, wz > 0 ? 1.02 : -1.02);
      carGrp.add(tire, hubcap, fender);
    }
    // 웨딩카 뒷부분 하트 장식 풍선 3개
    for (let b = 0; b < 3; b++) {
      const hb = new THREE.Mesh(SHARED_HEART_GEO, new THREE.MeshPhysicalMaterial({ color: flCols[b], roughness: 0.15, clearcoat: 1 }));
      hb.scale.setScalar(0.65);
      hb.position.set(-2.2 - b * 0.25, 2.25 + b * 0.38, (b - 1) * 0.35);
      carGrp.add(hb);
    }
    venueGroup.add(carGrp);

    // [스팟 3: 오른쪽 호수 원목 선착장 & 우아한 곡선 목 백조 보트 + 3단 웨딩케이크 테이블!]
    const pierGroup = new THREE.Group();
    pierGroup.position.set(6.0, 0, -4.5);
    for (let p = 0; p < 12; p++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 0.72), woodMat);
      plank.position.set(0, 0.12, 4.0 - p * 0.82);
      pierGroup.add(plank);
    }
    for (const px of [-2.05, 2.05]) {
      for (const pz of [3.5, 0.2, -3.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.15, 10), woodMat);
        post.position.set(px, 0.58, pz);
        pierGroup.add(post);
      }
    }
    // 선착장 위 3단 장미 웨딩케이크 테이블
    const cakeTbl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.95, 18), whiteMat);
    cakeTbl.position.set(1.45, 0.62, 2.6);
    for (let lv = 0; lv < 3; lv++) {
      const cTier = new THREE.Mesh(new THREE.CylinderGeometry(0.46 - lv * 0.11, 0.46 - lv * 0.11, 0.24, 18), whiteMat);
      cTier.position.set(1.45, 1.22 + lv * 0.24, 2.6);
      pierGroup.add(cTier);
    }
    const cakeTopHeart = new THREE.Mesh(SHARED_HEART_GEO, new THREE.MeshStandardMaterial({ color: '#f43f5e' }));
    cakeTopHeart.scale.setScalar(0.32);
    cakeTopHeart.position.set(1.45, 1.96, 2.6);
    pierGroup.add(cakeTbl, cakeTopHeart);
    venueGroup.add(pierGroup);

    // 곡선 목(`TubeGeometry`)과 접힌 날개·왕관을 갖춘 우아한 백조 보트
    const swanGrp = new THREE.Group();
    swanGrp.position.set(7.2, 0.32, -11.5);
    swanGrp.rotation.y = 0.42;
    const swanHull = new THREE.Mesh(new THREE.SphereGeometry(1.45, 20, 16), whiteMat);
    swanHull.scale.set(1.38, 0.72, 0.92);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), whiteMat);
      wing.scale.set(1.35, 0.68, 0.28);
      wing.position.set(-0.15, 0.35, side * 0.88);
      wing.rotation.z = 0.18;
      swanGrp.add(wing);
    }
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.1, 0.35, 0),
      new THREE.Vector3(-1.65, 1.35, 0),
      new THREE.Vector3(-1.35, 2.25, 0),
      new THREE.Vector3(-1.62, 2.55, 0),
    ]);
    const swanNeck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 18, 0.19, 12, false), whiteMat);
    const swanHead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), whiteMat);
    swanHead.position.set(-1.68, 2.55, 0);
    const swanBeak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 10), new THREE.MeshStandardMaterial({ color: '#f97316' }));
    swanBeak.rotation.z = Math.PI / 2;
    swanBeak.position.set(-2.02, 2.50, 0);
    const swanCrown = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 8), goldMat);
    swanCrown.position.set(-1.66, 2.86, 0);
    swanGrp.add(swanHull, swanNeck, swanHead, swanBeak, swanCrown);
    venueGroup.add(swanGrp);

    spots = [
      { name: '장미 아치 꽃길', x: 0, z: 0, rotY: 0 },
      { name: '민트 웨딩 오픈카 옆', x: -4.6, z: -0.6, rotY: 0.25 },
      { name: '호수 백조 선착장', x: 5.2, z: -1.0, rotY: -0.22 },
    ];
  } else if (venueKey === 'euro_cafe') {
    scene.background = new THREE.Color('#93c5fd');
    scene.fog = new THREE.Fog('#dbeafe', 44, 110);
    sunLight.color.set('#fff7ed');
    sunLight.intensity = 1.95;
    addSkyClouds(venueGroup, '#ffffff', 16, 4);

    const cobble = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#d6d3d1', roughness: 0.78 }));
    cobble.position.set(0, -0.5, -4);
    cobble.receiveShadow = true;
    const plazaCircle = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.06, 32), new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.65 }));
    plazaCircle.position.set(0, 0.03, -4.2);
    venueGroup.add(cobble, plazaCircle);

    // [스팟 1: 중앙 물줄기가 솟구치는 3단 유럽 대리석 조각 분수대]
    const marbleMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.28 });
    const waterMat = new THREE.MeshPhysicalMaterial({ color: '#38bdf8', roughness: 0.08, clearcoat: 1.0, transparent: true, opacity: 0.88 });
    const poolRim = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.24, 12, 32), marbleMat);
    poolRim.rotation.x = Math.PI / 2;
    poolRim.position.set(0, 0.56, -4.2);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.4, 0.58, 28), marbleMat);
    pool.position.set(0, 0.29, -4.2);
    const poolW = new THREE.Mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.62, 28), waterMat);
    poolW.position.set(0, 0.30, -4.2);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.2, 0.48, 24), marbleMat);
    tier2.position.set(0, 1.75, -4.2);
    const tier3 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.65, 0.38, 20), marbleMat);
    tier3.position.set(0, 2.95, -4.2);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.58, 3.5, 16), marbleMat);
    pillar.position.set(0, 1.75, -4.2);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), goldMat);
    finial.position.set(0, 3.65, -4.2);
    venueGroup.add(poolRim, pool, poolW, tier2, tier3, pillar, finial);

    // 솟구치는 분수 물줄기 아치 6갈래
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      const jetCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 3.7, -4.2),
        new THREE.Vector3(Math.cos(a) * 1.1, 4.35, -4.2 + Math.sin(a) * 1.1),
        new THREE.Vector3(Math.cos(a) * 2.2, 0.65, -4.2 + Math.sin(a) * 2.2),
      ]);
      const jetMesh = new THREE.Mesh(new THREE.TubeGeometry(jetCurve, 14, 0.055, 8, false), waterMat);
      venueGroup.add(jetMesh);
    }

    // [스팟 2: 왼쪽 빨강·하양 스트라이프 차양 노천카페 & 크루아상·커피 테이블 + 비스트로 의자]
    const cafeWall = new THREE.Mesh(new THREE.BoxGeometry(7.6, 8.8, 4.0), new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.62 }));
    cafeWall.position.set(-6.8, 4.4, -5.6);
    venueGroup.add(cafeWall);
    // 2층 아치형 창문 & 꽃 화분 발코니
    for (const wx of [-8.4, -5.2]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.15), new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.2 }));
      win.position.set(wx, 6.2, -3.55);
      const flowerBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.4), woodMat);
      flowerBox.position.set(wx, 5.15, -3.45);
      const geranium = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: '#ef4444' }));
      geranium.position.set(wx, 5.42, -3.45);
      venueGroup.add(win, flowerBox, geranium);
    }
    // 빨강·하양 줄무늬 차양(어닝)
    for (let s = 0; s < 8; s++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.22, 2.5),
        new THREE.MeshStandardMaterial({ color: s % 2 === 0 ? '#dc2626' : '#ffffff', roughness: 0.45 })
      );
      stripe.rotation.x = 0.34;
      stripe.position.set(-10.12 + s * 0.95, 3.65, -2.75);
      venueGroup.add(stripe);
    }
    const cafeTbl = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.10, 20), whiteMat);
    cafeTbl.position.set(-5.9, 1.12, -1.85);
    const cafeLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.26, 1.12, 12), darkMat);
    cafeLeg.position.set(-5.9, 0.56, -1.85);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.18, 12), whiteMat);
    cup.position.set(-5.7, 1.25, -1.75);
    const croissant = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 8, 12, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color: '#d97706' }));
    croissant.rotation.x = Math.PI / 2;
    croissant.position.set(-6.12, 1.22, -1.92);
    for (const cx of [-6.95, -4.85]) {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 14), woodMat);
      seat.position.set(cx, 0.68, -1.85);
      const cBack = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 14, Math.PI), darkMat);
      cBack.position.set(cx, 0.95, -2.12);
      const cPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.18, 0.68, 10), darkMat);
      cPost.position.set(cx, 0.34, -1.85);
      venueGroup.add(seat, cBack, cPost);
    }
    venueGroup.add(cafeTbl, cafeLeg, cup, croissant);

    // [스팟 3: 오른쪽 황금 시침·분침 유럽 시계탑 & 클래식 주물 가로등]
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 11.2, 3.4), new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.58 }));
    tower.position.set(6.8, 5.6, -6.2);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.45, 3.8), whiteMat);
    cornice.position.set(6.8, 11.2, -6.2);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.65, 3.4, 4), new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.4 }));
    roof.rotation.y = Math.PI / 4;
    roof.position.set(6.8, 13.1, -6.2);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.5, 8), goldMat);
    spire.position.set(6.8, 15.2, -6.2);

    const clockRim = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.11, 10, 28), goldMat);
    clockRim.position.set(6.8, 8.8, -4.44);
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(1.05, 24), whiteMat);
    clockFace.position.set(6.8, 8.8, -4.46);
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.55, 0.05), darkMat);
    hourHand.position.set(6.95, 8.95, -4.40);
    hourHand.rotation.z = -0.65;
    const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.82, 0.05), darkMat);
    minHand.position.set(6.68, 9.10, -4.40);
    minHand.rotation.z = 0.35;

    const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.20, 4.8, 12), darkMat);
    lampPost.position.set(3.6, 2.4, -2.5);
    const lampCross = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), darkMat);
    lampCross.position.set(3.6, 4.65, -2.5);
    for (const lx of [3.05, 4.15]) {
      const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: '#fef08a' }));
      lampBulb.position.set(lx, 4.88, -2.5);
      venueGroup.add(lampBulb);
    }
    venueGroup.add(tower, cornice, roof, spire, clockRim, clockFace, hourHand, minHand, lampPost, lampCross);

    spots = [
      { name: '대리석 분수 광장', x: 0, z: 0, rotY: 0 },
      { name: '빨간 차양 노천카페 앞', x: -4.2, z: -0.2, rotY: 0.28 },
      { name: '유럽 시계탑 가로등 거리', x: 4.5, z: -0.5, rotY: -0.25 },
    ];
  } else if (venueKey === 'emerald_beach') {
    scene.background = new THREE.Color('#38bdf8');
    scene.fog = new THREE.Fog('#7dd3fc', 44, 110);
    sunLight.color.set('#fff9db');
    sunLight.intensity = 2.1;
    addSkyClouds(venueGroup, '#ffffff', 16, 5);

    const sand = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 28), new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.80 }));
    sand.position.set(0, -0.5, 4);
    sand.receiveShadow = true;
    const sea = new THREE.Mesh(new THREE.BoxGeometry(100, 0.9, 52), new THREE.MeshPhysicalMaterial({ color: '#06b6d4', roughness: 0.08, clearcoat: 1.0 }));
    sea.position.set(0, -0.58, -32);
    const foam1 = new THREE.Mesh(new THREE.BoxGeometry(96, 0.10, 1.3), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
    foam1.position.set(0, 0.02, -6.5);
    const foam2 = new THREE.Mesh(new THREE.BoxGeometry(96, 0.08, 0.7), new THREE.MeshBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.7 }));
    foam2.position.set(0, 0.01, -9.2);
    // 수평선 너머 제주 화산섬 실루엣
    const island = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 11.5, 4.2, 18), new THREE.MeshStandardMaterial({ color: '#0d9488', roughness: 0.8 }));
    island.position.set(-2.5, 1.2, -38);
    venueGroup.add(sand, sea, foam1, foam2, island);

    // [스팟 2: 왼쪽 제주 7색 무지개 해안도로 연석 & 방호벽!]
    const roadCurb = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 1.5), new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.75 }));
    roadCurb.position.set(-5.2, 0.11, -3.6);
    venueGroup.add(roadCurb);
    const rainbowCols = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'];
    for (let i = 0; i < 7; i++) {
      const blk = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.98, 0.82), new THREE.MeshStandardMaterial({ color: rainbowCols[i], roughness: 0.38 }));
      blk.position.set(-9.6 + i * 1.45, 0.65, -3.6);
      blk.castShadow = true;
      venueGroup.add(blk);
    }

    // [스팟 1 & 3: 코코넛 야자수 + 줄무늬 파라솔 & 선베드 + 센터 스트라이프 서핑보드 3개!]
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.42 });
    const cocoMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.7 });
    for (const px of [-2.8, 7.8]) {
      const dir = px < 0 ? -1 : 1;
      for (let seg = 0; seg < 6; seg++) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.36 - seg * 0.025, 0.42 - seg * 0.025, 1.05, 12), woodMat);
        ring.position.set(px + dir * seg * seg * 0.045, 0.5 + seg * 0.95, -3.6);
        ring.rotation.z = -dir * seg * 0.04;
        venueGroup.add(ring);
      }
      const topX = px + dir * 25 * 0.045;
      for (let c = 0; c < 3; c++) {
        const coco = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), cocoMat);
        coco.position.set(topX + Math.cos(c * 2.1) * 0.28, 5.65, -3.6 + Math.sin(c * 2.1) * 0.28);
        venueGroup.add(coco);
      }
      for (let k = 0; k < 7; k++) {
        const ang = (k / 7) * TAU;
        const lf = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), palmLeafMat);
        lf.scale.set(1.95, 0.16, 0.52);
        lf.rotation.y = ang;
        lf.rotation.z = 0.38;
        lf.position.set(topX + Math.cos(ang) * 1.35, 5.85, -3.6 + Math.sin(ang) * 1.35);
        venueGroup.add(lf);
      }
    }

    // 비치 파라솔 & 선베드
    const paraPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 10), whiteMat);
    paraPole.position.set(3.2, 1.8, -3.2);
    paraPole.rotation.z = 0.12;
    const paraTop = new THREE.Mesh(new THREE.ConeGeometry(1.85, 0.75, 12), new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.4 }));
    paraTop.position.set(2.98, 3.55, -3.2);
    paraTop.rotation.z = 0.12;
    const sunbed = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 2.1), whiteMat);
    sunbed.position.set(2.8, 0.22, -2.8);
    venueGroup.add(paraPole, paraTop, sunbed);

    const surfCols = ['#fb7185', '#38bdf8', '#facc15'];
    for (let i = 0; i < 3; i++) {
      const sGrp = new THREE.Group();
      sGrp.position.set(4.8 + i * 1.05, 1.72, -3.0);
      sGrp.rotation.z = -0.12 + i * 0.08;
      const sb = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 2.55, 10, 16),
        new THREE.MeshPhysicalMaterial({ color: surfCols[i], roughness: 0.15, clearcoat: 1.0 })
      );
      sb.scale.set(1, 1, 0.20);
      const centerStripe = new THREE.Mesh(new THREE.BoxGeometry(0.10, 3.1, 0.19), whiteMat);
      sGrp.add(sb, centerStripe);
      venueGroup.add(sGrp);
    }

    spots = [
      { name: '에메랄드 파도 해변 중앙', x: 0.4, z: 0, rotY: 0 },
      { name: '제주 무지개 방호벽 포토존', x: -5.0, z: -0.8, rotY: 0.20 },
      { name: '서핑보드 & 야자수 비치', x: 5.0, z: -0.6, rotY: -0.24 },
    ];
  } else if (venueKey === 'amusement_park') {
    scene.background = new THREE.Color('#a5b4fc');
    scene.fog = new THREE.Fog('#e0e7ff', 44, 110);
    sunLight.color.set('#fff1f2');
    sunLight.intensity = 1.95;
    addSkyClouds(venueGroup, '#ffffff', 16.5, 5);

    const plaza = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#fce7f3', roughness: 0.72 }));
    plaza.position.set(0, -0.5, -4);
    plaza.receiveShadow = true;
    venueGroup.add(plaza);

    // [스팟 1: 이중 림 & 지붕·창문 달린 곤돌라 대형 파스텔 대관람차!]
    const wheelCenterY = 8.5;
    const wheelZ = -9.5;
    for (const sx of [-2.4, 2.4]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 9.9, 12), whiteMat);
      leg.position.set(sx, 4.45, wheelZ);
      leg.rotation.z = sx < 0 ? -0.24 : 0.24;
      venueGroup.add(leg);
    }

    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, wheelCenterY, wheelZ);
    const rimOuter = new THREE.Mesh(new THREE.TorusGeometry(6.3, 0.18, 12, 42), new THREE.MeshStandardMaterial({ color: '#f472b6' }));
    const rimInner = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.10, 10, 36), new THREE.MeshStandardMaterial({ color: '#fde047' }));
    const centerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.45, 20), goldMat);
    centerHub.rotation.x = Math.PI / 2;
    wheelGroup.add(rimOuter, rimInner, centerHub);

    const cabinCols = ['#38bdf8', '#facc15', '#fb7185', '#4ade80', '#c084fc', '#fb923c'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 6.3, 8), whiteMat);
      spoke.rotation.z = a - Math.PI / 2;
      spoke.position.set(Math.cos(a) * 3.15, Math.sin(a) * 3.15, 0);

      const cabGrp = new THREE.Group();
      cabGrp.position.set(Math.cos(a) * 6.3, Math.sin(a) * 6.3, 0.35);
      const cabBody = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.92, 0.92), new THREE.MeshStandardMaterial({ color: cabinCols[i % 6], roughness: 0.3 }));
      const cabWin = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.38, 0.65), new THREE.MeshBasicMaterial({ color: '#e0f2fe' }));
      cabWin.position.y = 0.12;
      const cabRoof = new THREE.Mesh(new THREE.ConeGeometry(0.76, 0.38, 4), whiteMat);
      cabRoof.rotation.y = Math.PI / 4;
      cabRoof.position.y = 0.65;
      cabGrp.userData.isCabin = true;
      cabGrp.add(cabBody, cabWin, cabRoof);
      wheelGroup.add(spoke, cabGrp);
    }
    venueGroup.add(wheelGroup);
    envAnimState.ferrisWheel = wheelGroup;

    // [스팟 2: 왼쪽 황금 전구 지붕 & 백마 4마리가 달리는 회전목마!]
    const carouselGrp = new THREE.Group();
    carouselGrp.position.set(-6.4, 0, -4.2);
    const cBase = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 3.05, 0.42, 24), goldMat);
    cBase.position.y = 0.21;
    const cRoof = new THREE.Mesh(new THREE.ConeGeometry(3.15, 2.1, 20), new THREE.MeshStandardMaterial({ color: '#fb7185', roughness: 0.35 }));
    cRoof.position.y = 4.55;
    const cTrim = new THREE.Mesh(new THREE.CylinderGeometry(3.18, 3.18, 0.28, 24), goldMat);
    cTrim.position.y = 3.55;
    const cPole = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 3.5, 16), goldMat);
    cPole.position.y = 1.95;
    carouselGrp.add(cBase, cRoof, cTrim, cPole);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const hx = Math.cos(a) * 2.05;
      const hz = Math.sin(a) * 2.05;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 8), goldMat);
      pole.position.set(hx, 1.9, hz);

      // 머리·목·안장·다리를 갖춘 귀여운 회전목마 백마!
      const horseGrp = new THREE.Group();
      horseGrp.position.set(hx, 1.45 + (i % 2) * 0.22, hz);
      horseGrp.rotation.y = -a;
      const hBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.62, 8, 12), whiteMat);
      hBody.rotation.x = Math.PI / 2;
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.36), new THREE.MeshStandardMaterial({ color: cabinCols[i] }));
      saddle.position.y = 0.22;
      const hNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.52, 10), whiteMat);
      hNeck.position.set(0, 0.35, 0.36);
      hNeck.rotation.x = 0.35;
      const hHead = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.24, 8, 10), whiteMat);
      hHead.rotation.x = Math.PI / 2 + 0.35;
      hHead.position.set(0, 0.58, 0.52);
      horseGrp.add(hBody, saddle, hNeck, hHead);
      carouselGrp.add(pole, horseGrp);
    }
    venueGroup.add(carouselGrp);
    envAnimState.carousel = carouselGrp;

    // [스팟 3: 오른쪽 파스텔 풍선 아치 & 빈티지 솜사탕 왜건 부스]
    const boothGrp = new THREE.Group();
    boothGrp.position.set(6.4, 0, -3.8);
    const boothBot = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.35, 1.9), new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.35 }));
    boothBot.position.y = 0.85;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.14, 2.1), whiteMat);
    counter.position.y = 1.55;
    for (const px of [-1.4, 1.4]) {
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), goldMat);
      p1.position.set(px, 2.25, 0.8);
      const p2 = p1.clone();
      p2.position.z = -0.8;
      boothGrp.add(p1, p2);
    }
    const boothTop = new THREE.Mesh(new THREE.ConeGeometry(2.45, 1.25, 4), new THREE.MeshStandardMaterial({ color: '#fde047' }));
    boothTop.rotation.y = Math.PI / 4;
    boothTop.position.y = 3.55;
    for (const wx of [-1.05, 1.05]) {
      const wWheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 18), goldMat);
      wWheel.position.set(wx, 0.48, 1.02);
      boothGrp.add(wWheel);
    }
    venueGroup.add(boothGrp);

    spots = [
      { name: '대관람차 정면 광장', x: 0, z: 0, rotY: 0 },
      { name: '황금 회전목마 앞', x: -4.8, z: -0.6, rotY: 0.24 },
      { name: '유원지 퍼레이드 부스 옆', x: 4.8, z: -0.6, rotY: -0.24 },
    ];
  } else if (venueKey === 'sunset_cliff') {
    scene.background = new THREE.Color('#fb923c');
    scene.fog = new THREE.Fog('#f97316', 40, 105);
    sunLight.color.set('#fed7aa');
    sunLight.intensity = 1.95;
    addSkyClouds(venueGroup, '#fed7aa', 15, 4);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 26), woodMat);
    deck.position.set(0, -0.5, 4);
    deck.receiveShadow = true;
    const sunsetSea = new THREE.Mesh(new THREE.BoxGeometry(100, 0.9, 52), new THREE.MeshPhysicalMaterial({ color: '#c2410c', roughness: 0.14, clearcoat: 1.0 }));
    sunsetSea.position.set(0, -1.2, -32);
    const sunShimmer = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.05, 36), new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.48 }));
    sunShimmer.position.set(0, -0.72, -22);
    const bigSun = new THREE.Mesh(new THREE.CircleGeometry(7.2, 36), new THREE.MeshBasicMaterial({ color: '#fef08a' }));
    bigSun.position.set(0, 5.8, -36);
    venueGroup.add(deck, sunsetSea, sunShimmer, bigSun);

    // 클래식 석조 발루스터 전망 난간
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(26, 0.22, 0.30), whiteMat);
    topBar.position.set(0, 1.38, -3.4);
    const botBar = new THREE.Mesh(new THREE.BoxGeometry(26, 0.18, 0.32), whiteMat);
    botBar.position.set(0, 0.12, -3.4);
    venueGroup.add(topBar, botBar);
    for (let x = -12; x <= 12; x += 1.5) {
      const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.2, 10), whiteMat);
      baluster.position.set(x, 0.75, -3.4);
      venueGroup.add(baluster);
    }

    // [스팟 2: 왼쪽 영국풍 돔 지붕 & 격자 창문 빨간 공중전화 부스!]
    const redBoothMat = new THREE.MeshPhysicalMaterial({ color: '#dc2626', roughness: 0.25, clearcoat: 0.85 });
    const tbGrp = new THREE.Group();
    tbGrp.position.set(-6.2, 0, -2.2);
    tbGrp.rotation.y = 0.22;
    const tbBase = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.22, 1.88), darkMat);
    tbBase.position.y = 0.11;
    const tbBody = new THREE.Mesh(new THREE.BoxGeometry(1.72, 3.45, 1.72), redBoothMat);
    tbBody.position.y = 1.92;
    const tbGlow = new THREE.Mesh(new THREE.BoxGeometry(1.76, 2.35, 1.28), new THREE.MeshBasicMaterial({ color: '#fef08a' }));
    tbGlow.position.y = 2.05;
    const tbGlowSide = new THREE.Mesh(new THREE.BoxGeometry(1.28, 2.35, 1.76), new THREE.MeshBasicMaterial({ color: '#fef08a' }));
    tbGlowSide.position.y = 2.05;
    // 창문 빨간 가로 격자살
    for (const gy of [1.45, 2.05, 2.65]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.80, 0.08, 1.80), redBoothMat);
      bar.position.y = gy;
      tbGrp.add(bar);
    }
    const tbDome = new THREE.Mesh(new THREE.SphereGeometry(1.18, 16, 12), redBoothMat);
    tbDome.scale.set(0.85, 0.35, 0.85);
    tbDome.position.y = 3.72;
    tbGrp.add(tbBase, tbBody, tbGlow, tbGlowSide, tbDome);
    venueGroup.add(tbGrp);

    // [스팟 3: 오른쪽 빨강·하양 스트라이프 절벽 등대 & 유리 랜턴 룸!]
    const lhGrp = new THREE.Group();
    lhGrp.position.set(6.8, 0, -5.8);
    const lhRed = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.35 });
    for (let seg = 0; seg < 5; seg++) {
      const rBot = 1.48 - seg * 0.11;
      const rTop = 1.48 - (seg + 1) * 0.11;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1.45, 20), seg % 2 === 0 ? whiteMat : lhRed);
      cyl.position.y = 0.725 + seg * 1.45;
      lhGrp.add(cyl);
    }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.15, 0.24, 20), darkMat);
    gallery.position.y = 7.35;
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 1.1, 16), new THREE.MeshBasicMaterial({ color: '#fef9c3' }));
    lantern.position.y = 8.0;
    const lhRoof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.35, 20), lhRed);
    lhRoof.position.y = 9.15;
    lhGrp.add(gallery, lantern, lhRoof);
    venueGroup.add(lhGrp);

    spots = [
      { name: '황금 석양 전망 난간', x: 0, z: 0, rotY: 0 },
      { name: '빨간 감성 전화부스 옆', x: -4.4, z: -0.4, rotY: 0.26 },
      { name: '절벽 하얀 등대 아래', x: 4.8, z: -0.8, rotY: -0.26 },
    ];
  } else if (venueKey === 'ginkgo_avenue') {
    scene.background = new THREE.Color('#bae6fd');
    scene.fog = new THREE.Fog('#fed7aa', 42, 108);
    sunLight.color.set('#fef08a');
    sunLight.intensity = 2.0;
    addSkyClouds(venueGroup, '#fffbeb', 16, 4);

    const road = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.80 }));
    road.position.set(0, -0.5, -4);
    road.receiveShadow = true;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 28), new THREE.MeshStandardMaterial({ color: '#fef08a', roughness: 0.68 }));
    lane.position.set(0, 0.03, 1);
    venueGroup.add(road, lane);

    // 풍성한 다단 황금 은행나무 가로수 4그루 + 원목 벤치
    const ginkgoMat1 = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.48 });
    const ginkgoMat2 = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.52 });
    for (const [tx, tz] of [[-4.2, -3.6], [4.2, -3.6], [-8.2, -6.8], [8.2, -6.8]]) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.50, 4.4, 12), woodMat);
      tr.position.set(tx, 2.2, tz);
      const cr1 = new THREE.Mesh(new THREE.SphereGeometry(2.05, 16, 12), ginkgoMat1);
      cr1.position.set(tx, 5.0, tz);
      const cr2 = new THREE.Mesh(new THREE.SphereGeometry(1.55, 14, 10), ginkgoMat2);
      cr2.position.set(tx + (tx < 0 ? -0.9 : 0.9), 5.9, tz + 0.3);
      const cr3 = new THREE.Mesh(new THREE.SphereGeometry(1.40, 14, 10), ginkgoMat1);
      cr3.position.set(tx - (tx < 0 ? -0.7 : 0.7), 6.2, tz - 0.3);
      venueGroup.add(tr, cr1, cr2, cr3);
    }
    const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.68), woodMat);
    benchSeat.position.set(3.8, 0.58, -2.2);
    const benchBack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 0.12), woodMat);
    benchBack.position.set(3.8, 0.96, -2.50);
    venueGroup.add(benchSeat, benchBack);

    // [스팟 2: 왼쪽 투톤 빈티지 캠퍼밴(창문·원형 헤드라이트·엠블럼·바퀴·루프랙 여행가방 완비!)]
    const van = new THREE.Group();
    van.position.set(-6.5, 0, -2.6);
    van.rotation.y = 0.34;
    const amberVanMat = new THREE.MeshPhysicalMaterial({ color: '#f59e0b', roughness: 0.24, clearcoat: 0.85 });
    const vBot = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.25, 2.15), amberVanMat);
    vBot.position.y = 1.02;
    vBot.castShadow = true;
    const vTop = new THREE.Mesh(new THREE.BoxGeometry(4.35, 1.18, 2.08), whiteMat);
    vTop.position.y = 2.22;
    const roofRack = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 1.65), chromeMat);
    roofRack.position.y = 2.86;
    const luggage = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.95), new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.6 }));
    luggage.position.set(-0.2, 3.14, 0);
    // 유리 창문 띠 & 원형 헤드라이트 & 앞 엠블럼
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#bae6fd', roughness: 0.12, clearcoat: 1.0 });
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.68, 2.12), glassMat);
    sideWin.position.y = 2.24;
    const frontWin = new THREE.Mesh(new THREE.BoxGeometry(4.39, 0.68, 1.75), glassMat);
    frontWin.position.y = 2.24;
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 18), chromeMat);
    badge.rotation.z = Math.PI / 2;
    badge.position.set(2.28, 1.48, 0);
    for (const sz of [-0.68, 0.68]) {
      const hLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.10, 14), new THREE.MeshBasicMaterial({ color: '#fef9c3' }));
      hLamp.rotation.z = Math.PI / 2;
      hLamp.position.set(2.28, 1.02, sz);
      van.add(hLamp);
    }
    for (const [wx, wz] of [[-1.35, -1.06], [1.35, -1.06], [-1.35, 1.06], [1.35, 1.06]]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.28, 18), darkMat);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(wx, 0.46, wz);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.30, 14), whiteMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(wx, 0.46, wz);
      van.add(tire, hub);
    }
    van.add(vBot, vTop, roofRack, luggage, sideWin, frontWin, badge);
    venueGroup.add(van);

    // 하늘에 둥실둥실 떠 있는 줄무늬 대형 열기구 4개 + 로프 & 버너 불빛!
    const hbCols = ['#ef4444', '#38bdf8', '#a855f7', '#22c55e'];
    for (let i = 0; i < 4; i++) {
      const hb = new THREE.Group();
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(1.78, 20, 16), new THREE.MeshStandardMaterial({ color: hbCols[i], roughness: 0.4 }));
      balloon.scale.set(1, 1.24, 1);
      const band = new THREE.Mesh(new THREE.TorusGeometry(1.74, 0.12, 8, 24), whiteMat);
      band.rotation.x = Math.PI / 2;
      const burnerGlow = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial({ color: '#fde047' }));
      burnerGlow.position.y = -1.95;
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.62, 0.76), woodMat);
      basket.position.y = -2.55;
      for (const [rx, rz] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 6), darkMat);
        rope.position.set(rx, -1.95, rz);
        hb.add(rope);
      }
      hb.add(balloon, band, burnerGlow, basket);
      hb.position.set(-9 + i * 6.2, 8.4 + (i % 2) * 2.2, -16 - (i % 2) * 4);
      venueGroup.add(hb);
      envAnimState.balloons.push({ mesh: hb, baseY: hb.position.y, phase: i * 1.4 });
    }

    spots = [
      { name: '황금 은행나무 길 중앙', x: 0, z: 0, rotY: 0 },
      { name: '빈티지 캠퍼밴 감성존', x: -4.5, z: -0.6, rotY: 0.25 },
      { name: '열기구 언덕 전망 스팟', x: 4.8, z: -0.8, rotY: -0.22 },
    ];
  } else if (venueKey === 'blossom_palace') {
    scene.background = new THREE.Color('#fbcfe8');
    scene.fog = new THREE.Fog('#fce7f3', 42, 105);
    sunLight.color.set('#fff5f7');
    sunLight.intensity = 1.95;
    addSkyClouds(venueGroup, '#fff1f2', 16, 4);

    const garden = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#bbf7d0', roughness: 0.80 }));
    garden.position.set(0, -0.5, -4);
    garden.receiveShadow = true;
    const pond = new THREE.Mesh(new THREE.CircleGeometry(6.8, 32), new THREE.MeshPhysicalMaterial({ color: '#38bdf8', roughness: 0.08, clearcoat: 1.0 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-5.2, 0.03, -6.2);
    venueGroup.add(garden, pond);

    // 연못 위 연잎 & 연꽃 포인트
    for (const [lx, lz] of [[-7.2, -5.2], [-3.4, -7.4], [-6.5, -8.2]]) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16), foliageMat);
      pad.position.set(lx, 0.06, lz);
      const lotus = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 8), new THREE.MeshStandardMaterial({ color: '#f472b6' }));
      lotus.position.set(lx, 0.20, lz);
      venueGroup.add(pad, lotus);
    }

    // 전통 고궁 기와 돌담장
    const wallBody = new THREE.Mesh(new THREE.BoxGeometry(16, 1.85, 0.55), new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.7 }));
    wallBody.position.set(3.2, 0.92, -6.8);
    const wallTileRoof = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.35, 0.92), darkMat);
    wallTileRoof.position.set(3.2, 1.98, -6.8);
    venueGroup.add(wallBody, wallTileRoof);

    // 풍성한 왕벚꽃 나무들
    const pinkMat = new THREE.MeshStandardMaterial({ color: '#f9a8d4', roughness: 0.48 });
    const lightPinkMat = new THREE.MeshStandardMaterial({ color: '#fce7f3', roughness: 0.48 });
    for (const [tx, tz] of [[-2.4, -3.4], [2.6, -3.6], [8.0, -4.6]]) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 4.1, 12), woodMat);
      tr.position.set(tx, 2.05, tz);
      for (const [ox, oy, oz, r, m] of [
        [0, 4.5, 0, 1.85, pinkMat],
        [-1.25, 4.0, 0.3, 1.38, lightPinkMat],
        [1.25, 4.1, -0.2, 1.42, pinkMat],
        [0.2, 5.3, 0.2, 1.25, lightPinkMat],
      ]) {
        const cr = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), m);
        cr.position.set(tx + ox, oy, tz + oz);
        venueGroup.add(cr);
      }
      venueGroup.add(tr);
    }

    // [스팟 2: 왼쪽 난간 동자주까지 갖춘 전통 붉은 홍예교 아치 다리!]
    const redWood = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.42 });
    const bridgeGrp = new THREE.Group();
    bridgeGrp.position.set(-5.2, 0, -4.4);
    const bridgeArch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.36, 12, 28, Math.PI), redWood);
    bridgeArch.position.y = -0.95;
    const bridgeRail = new THREE.Mesh(new THREE.TorusGeometry(3.68, 0.08, 8, 28, Math.PI * 0.76), redWood);
    bridgeRail.rotation.z = Math.PI * 0.12;
    bridgeRail.position.set(0, -0.55, 0.65);
    for (let p = -3; p <= 3; p++) {
      const ang = Math.PI * 0.5 + p * 0.18;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.68, 8), redWood);
      post.position.set(Math.cos(ang) * 3.4, -0.75 + Math.sin(ang) * 3.4, 0.65);
      bridgeGrp.add(post);
    }
    bridgeGrp.add(bridgeArch, bridgeRail);
    venueGroup.add(bridgeGrp);

    // [스팟 3: 오른쪽 단청 테두리 & 마루를 갖춘 육각 기와 정자!]
    const pavGrp = new THREE.Group();
    pavGrp.position.set(5.8, 0, -4.5);
    const pavFloor = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.65, 0.42, 6), woodMat);
    pavFloor.position.y = 0.21;
    const pavDancheong = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.28, 6), new THREE.MeshStandardMaterial({ color: '#0d9488' }));
    pavDancheong.position.y = 3.72;
    const pavRoof = new THREE.Mesh(new THREE.ConeGeometry(3.55, 1.75, 6), darkMat);
    pavRoof.position.y = 4.65;
    const pavFinial = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), goldMat);
    pavFinial.position.y = 5.58;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 3.4, 10), redWood);
      col.position.set(Math.cos(a) * 2.15, 1.9, Math.sin(a) * 2.15);
      pavGrp.add(col);
    }
    pavGrp.add(pavFloor, pavDancheong, pavRoof, pavFinial);
    venueGroup.add(pavGrp);

    envAnimState.particleKind = 'petal';
    const petalGeo = new THREE.PlaneGeometry(0.22, 0.16);
    const petalMat = new THREE.MeshBasicMaterial({ color: '#fda4af', side: THREE.DoubleSide });
    for (let i = 0; i < 28; i++) {
      const p = new THREE.Mesh(petalGeo, petalMat);
      p.position.set(randRange(-11, 11), randRange(0.5, 8.5), randRange(-6, 4));
      venueGroup.add(p);
      envAnimState.ambientParticles.push(p);
    }

    spots = [
      { name: '벚꽃 만개 돌담길', x: 0, z: 0, rotY: 0 },
      { name: '연못 붉은 아치 다리 앞', x: -4.8, z: -0.6, rotY: 0.22 },
      { name: '고궁 기와 정자 마당', x: 4.8, z: -0.6, rotY: -0.24 },
    ];
  } else if (venueKey === 'snow_chapel') {
    scene.background = new THREE.Color('#cbd5e1');
    scene.fog = new THREE.Fog('#f1f5f9', 38, 98);
    sunLight.color.set('#ffffff');
    sunLight.intensity = 1.88;
    addSkyClouds(venueGroup, '#ffffff', 16, 4);

    const snowFloor = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.58 }));
    snowFloor.position.set(0, -0.5, -4);
    snowFloor.receiveShadow = true;
    venueGroup.add(snowFloor);

    // [스팟 1: 중앙 통나무 벽체 & 아치 스테인드글라스 & 종탑 스노우 채플]
    const chapelGrp = new THREE.Group();
    chapelGrp.position.set(0, 0, -6.6);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5.4, 4.2, 5.2), woodMat);
    cabin.position.y = 2.1;
    // 앞면 통나무 가로결 디테일
    for (let ly = 0.45; ly <= 3.9; ly += 0.52) {
      const logBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 5.55, 10), woodMat);
      logBeam.rotation.z = Math.PI / 2;
      logBeam.position.set(0, ly, 2.58);
      chapelGrp.add(logBeam);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.55, 3.85, 4), whiteMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 6.1;
    const bellTower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.4), woodMat);
    bellTower.position.y = 7.4;
    const steeple = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.8, 8), whiteMat);
    steeple.position.y = 9.8;
    const topStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), goldMat);
    topStar.position.y = 11.35;

    const warmWin = new THREE.Mesh(new THREE.CircleGeometry(1.05, 20), new THREE.MeshBasicMaterial({ color: '#fde047' }));
    warmWin.position.set(0, 2.95, 2.85);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.2), new THREE.MeshStandardMaterial({ color: '#451a03' }));
    door.position.set(0, 0.95, 2.82);
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.10, 8, 16), foliageMat);
    wreath.position.set(0, 1.35, 2.94);
    chapelGrp.add(cabin, roof, bellTower, steeple, topStar, warmWin, door, wreath);
    venueGroup.add(chapelGrp);

    // [스팟 2: 왼쪽 황금 별 & 오너먼트 볼이 반짝이는 대형 크리스마스트리 숲]
    const pineMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.60 });
    const ornCols = ['#ef4444', '#fbbf24', '#38bdf8'];
    for (const [tx, tz, sc] of [[-5.8, -3.6, 1.28], [-8.0, -5.6, 0.95], [7.8, -5.4, 1.0]]) {
      for (let lv = 0; lv < 3; lv++) {
        const r = (1.85 - lv * 0.42) * sc;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 2.2 * sc, 14), pineMat);
        cone.position.set(tx, (1.5 + lv * 1.38) * sc, tz);
        const snowRim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.92, 0.08 * sc, 6, 16), whiteMat);
        snowRim.rotation.x = Math.PI / 2;
        snowRim.position.set(tx, (0.55 + lv * 1.38) * sc, tz);
        venueGroup.add(cone, snowRim);
      }
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 * sc), goldMat);
      star.position.set(tx, 5.55 * sc, tz);
      venueGroup.add(star);
      for (let o = 0; o < 6; o++) {
        const oa = (o / 6) * TAU;
        const orn = new THREE.Mesh(
          new THREE.SphereGeometry(0.13 * sc, 10, 8),
          new THREE.MeshPhysicalMaterial({ color: ornCols[o % 3], roughness: 0.15, metalness: 0.5, clearcoat: 1 })
        );
        orn.position.set(tx + Math.cos(oa) * 1.15 * sc, (1.6 + (o % 3) * 1.1) * sc, tz + Math.sin(oa) * 1.15 * sc);
        venueGroup.add(orn);
      }
    }

    // [스팟 3: 오른쪽 하얀 자작나무 군락 & 나무 썰매 + 빨간 선물상자]
    for (const [bx, bz] of [[4.2, -3.8], [5.8, -4.4], [7.0, -3.5]]) {
      const birch = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 5.6, 10), whiteMat);
      birch.position.set(bx, 2.8, bz);
      venueGroup.add(birch);
      for (let m = 0; m < 4; m++) {
        const barkMark = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.14, 10), darkMat);
        barkMark.position.set(bx, 1.0 + m * 1.15, bz);
        venueGroup.add(barkMark);
      }
    }
    const sled = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.85), woodMat);
    sled.position.set(5.4, 0.28, -2.4);
    const giftBox = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), new THREE.MeshStandardMaterial({ color: '#ef4444' }));
    giftBox.position.set(5.4, 0.68, -2.4);
    const giftRib = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.14), goldMat);
    giftRib.position.set(5.4, 0.68, -2.4);
    venueGroup.add(sled, giftBox, giftRib);

    envAnimState.particleKind = 'snow';
    const snowGeo = new THREE.SphereGeometry(0.10, 6, 6);
    const snowMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    for (let i = 0; i < 34; i++) {
      const s = new THREE.Mesh(snowGeo, snowMat);
      s.position.set(randRange(-12, 12), randRange(0.5, 9), randRange(-7, 4));
      venueGroup.add(s);
      envAnimState.ambientParticles.push(s);
    }

    spots = [
      { name: '설원 통나무 채플 정면', x: 0, z: 0, rotY: 0 },
      { name: '크리스마스트리 숲길', x: -4.8, z: -0.6, rotY: 0.24 },
      { name: '자작나무 스노우 언덕', x: 4.8, z: -0.6, rotY: -0.24 },
    ];
  } else if (venueKey === 'lavender_windmill') {
    scene.background = new THREE.Color('#c4b5fd');
    scene.fog = new THREE.Fog('#ede9fe', 42, 108);
    sunLight.color.set('#fef9c3');
    sunLight.intensity = 2.0;
    addSkyClouds(venueGroup, '#ffffff', 16, 5);

    const field = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#7c3aed', roughness: 0.84 }));
    field.position.set(0, -0.5, -4);
    field.receiveShadow = true;
    venueGroup.add(field);

    // 풍성한 보랏빛 라벤더 꽃 이랑 줄무늬 & 사이프러스 나무
    const lavMat1 = new THREE.MeshStandardMaterial({ color: '#a855f7', roughness: 0.68 });
    const lavMat2 = new THREE.MeshStandardMaterial({ color: '#c084fc', roughness: 0.68 });
    for (let x = -13; x <= 13; x += 2.0) {
      if (Math.abs(x) < 1.6) continue;
      const row = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 16, 8, 12), x % 4 === 0 ? lavMat1 : lavMat2);
      row.rotation.x = Math.PI / 2;
      row.position.set(x, 0.24, -6.5);
      venueGroup.add(row);
    }
    for (const cx of [-9.5, 6.2, 8.8]) {
      const cyp = new THREE.Mesh(new THREE.ConeGeometry(0.85, 5.2, 12), foliageMat);
      cyp.position.set(cx, 2.6, -6.2);
      venueGroup.add(cyp);
    }

    // [스팟 1: 팔각 발코니 & 격자 창살 날개를 갖춘 정통 네덜란드 풍차!]
    const millBody = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 2.45, 7.2, 8), new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.55 }));
    millBody.position.set(0, 3.6, -7.2);
    const millBalcony = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.25, 8), woodMat);
    millBalcony.position.set(0, 3.2, -7.2);
    const millCap = new THREE.Mesh(new THREE.SphereGeometry(1.58, 16, 12, 0, TAU, 0, Math.PI * 0.55), woodMat);
    millCap.position.set(0, 7.15, -7.2);

    const bladesGrp = new THREE.Group();
    bladesGrp.position.set(0, 6.4, -5.5);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 12), woodMat);
    hub.rotation.x = Math.PI / 2;
    bladesGrp.add(hub);
    for (let i = 0; i < 4; i++) {
      const bladeArm = new THREE.Group();
      bladeArm.rotation.z = (i / 4) * TAU;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 4.6, 0.14), woodMat);
      spar.position.y = 2.3;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.72, 3.8, 0.06), whiteMat);
      sail.position.set(0.32, 2.55, 0.04);
      bladeArm.add(spar, sail);
      bladesGrp.add(bladeArm);
    }
    venueGroup.add(millBody, millBalcony, millCap, bladesGrp);
    envAnimState.windmillBlades = bladesGrp;

    // [스팟 2: 왼쪽 라벤더 꽃밭 위 곡선 뚜껑 열린 하얀 그랜드 피아노 & 건반 & 의자!]
    const pianoGrp = new THREE.Group();
    pianoGrp.position.set(-6.0, 0, -2.5);
    pianoGrp.rotation.y = 0.36;
    const glossyWhite = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.14, clearcoat: 1.0 });

    const pBody = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.42, 1.85), glossyWhite);
    pBody.position.set(0, 1.25, -0.15);
    const pTail = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.42, 20), glossyWhite);
    pTail.position.set(-0.65, 1.25, -0.95);
    // 비스듬히 열린 그랜드 피아노 덮개(리드) & 금빛 지지대
    const pLid = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.07, 1.80), glossyWhite);
    pLid.position.set(-0.22, 1.92, -0.20);
    pLid.rotation.z = -0.45;
    const lidProp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 8), goldMat);
    lidProp.position.set(0.55, 1.72, -0.15);
    lidProp.rotation.z = 0.22;
    // 건반(화이트 건반 + 블랙 샤프 건반)
    const keyBed = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.12, 0.36), whiteMat);
    keyBed.position.set(0.15, 1.18, 0.85);
    for (let k = -6; k <= 6; k++) {
      if (k % 3 === 0) continue;
      const bKey = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.20), darkMat);
      bKey.position.set(0.15 + k * 0.11, 1.25, 0.80);
      pianoGrp.add(bKey);
    }
    for (const [lx, lz] of [[-0.95, -0.95], [0.95, 0.55], [-0.95, 0.55]]) {
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 1.15, 12), glossyWhite);
      pl.position.set(lx, 0.58, lz);
      pianoGrp.add(pl);
    }
    const stool = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 0.45), glossyWhite);
    stool.position.set(0.15, 0.31, 1.45);
    pianoGrp.add(pBody, pTail, pLid, lidProp, keyBed, stool);
    venueGroup.add(pianoGrp);

    spots = [
      { name: '대형 네덜란드 풍차 언덕', x: 0, z: 0, rotY: 0 },
      { name: '라벤더 밭 하얀 피아노 옆', x: -4.4, z: -0.6, rotY: 0.25 },
      { name: '보랏빛 프로방스 꽃길', x: 4.6, z: -0.6, rotY: -0.25 },
    ];
  } else {
    // starlight_rooftop (별빛 마천루 루프탑 인피니티풀 & 불꽃놀이!)
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.Fog('#1e1b4b', 44, 110);
    sunLight.color.set('#fde68a');
    sunLight.intensity = 1.85;

    const roofFloor = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 28), new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.36, metalness: 0.22 }));
    roofFloor.position.set(0, -0.5, 4);
    roofFloor.receiveShadow = true;

    // [스팟 2: 왼쪽 시안 수중 조명이 빛나는 루프탑 인피니티 풀 & 유리 난간]
    const poolRim = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.36, 6.8), whiteMat);
    poolRim.position.set(-5.2, 0.12, -4.8);
    const infPool = new THREE.Mesh(
      new THREE.BoxGeometry(14.8, 0.40, 6.1),
      new THREE.MeshPhysicalMaterial({ color: '#06b6d4', emissive: '#0284c7', emissiveIntensity: 0.35, roughness: 0.05, clearcoat: 1.0 })
    );
    infPool.position.set(-5.2, 0.14, -4.8);
    const glassRail = new THREE.Mesh(
      new THREE.BoxGeometry(28, 1.15, 0.08),
      new THREE.MeshPhysicalMaterial({ color: '#bae6fd', transmission: 0.7, transparent: true, opacity: 0.45 })
    );
    glassRail.position.set(0, 0.58, -8.2);
    venueGroup.add(roofFloor, poolRim, infPool, glassRail);

    // 반짝이는 격자 창문 텍스처 도시 마천루 스카이라인
    const winTex = makeCanvasTexture(128, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);
      for (let r = 12; r < h - 12; r += 20) {
        for (let c = 12; c < w - 12; c += 22) {
          if ((r + c) % 7 === 0) continue;
          ctx.fillStyle = (r * c) % 5 === 0 ? '#38bdf8' : '#fde047';
          ctx.fillRect(c, r, 12, 11);
        }
      }
    });
    const bldgMat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.45 });
    for (let i = -7; i <= 7; i++) {
      const bh = 8 + ((Math.abs(i * 7) + 3) % 11);
      const bx = i * 3.8;
      const bz = -18 - (Math.abs(i) % 3) * 4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(3.0, bh, 3.0), bldgMat);
      b.position.set(bx, bh / 2 - 2, bz);
      venueGroup.add(b);
    }

    // [스팟 1: 중앙 듀얼 네온 골드·핑크 웨딩 아치]
    const neonArch1 = new THREE.Mesh(new THREE.TorusGeometry(3.55, 0.12, 12, 36, Math.PI), new THREE.MeshBasicMaterial({ color: '#fde047' }));
    neonArch1.position.set(0, 2.2, -2.0);
    const neonArch2 = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.08, 10, 36, Math.PI), new THREE.MeshBasicMaterial({ color: '#f472b6' }));
    neonArch2.position.set(0, 2.2, -1.95);
    venueGroup.add(neonArch1, neonArch2);

    // [스팟 3: 오른쪽 크리스탈 잔들이 층층이 쌓인 황금 샴페인 타워 테이블!]
    const champTbl = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 1.05, 24), whiteMat);
    champTbl.position.set(6.0, 0.52, -2.5);
    const champGoldTrim = new THREE.Mesh(new THREE.TorusGeometry(1.46, 0.06, 8, 24), goldMat);
    champGoldTrim.rotation.x = Math.PI / 2;
    champGoldTrim.position.set(6.0, 1.04, -2.5);
    venueGroup.add(champTbl, champGoldTrim);

    const glassCupMat = new THREE.MeshPhysicalMaterial({ color: '#fef08a', roughness: 0.08, transmission: 0.5, transparent: true, opacity: 0.88 });
    for (let lv = 0; lv < 4; lv++) {
      const cnt = 4 - lv;
      const rad = (cnt - 1) * 0.24;
      const y = 1.20 + lv * 0.32;
      if (cnt === 1) {
        const topGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.05, 0.28, 12), glassCupMat);
        topGlass.position.set(6.0, y, -2.5);
        venueGroup.add(topGlass);
      } else {
        for (let gIdx = 0; gIdx < cnt * 2; gIdx++) {
          const ga = (gIdx / (cnt * 2)) * TAU;
          const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.05, 0.28, 10), glassCupMat);
          gl.position.set(6.0 + Math.cos(ga) * rad, y, -2.5 + Math.sin(ga) * rad);
          venueGroup.add(gl);
        }
      }
    }

    // 밤하늘에 터지는 불꽃놀이 파티클!
    envAnimState.particleKind = 'firework';
    const fwCols = ['#fde047', '#fb7185', '#38bdf8', '#4ade80', '#c084fc'];
    const fwGeo = new THREE.SphereGeometry(0.18, 8, 8);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(fwGeo, new THREE.MeshBasicMaterial({ color: fwCols[i % 5] }));
      m.userData = { cx: (i % 3 - 1) * 7.5, cy: 7.5 + (i % 2) * 2.5, ang: (i / 12) * TAU, spd: 1.5 + (i % 4) * 0.7, phase: (i % 3) * 0.33 };
      venueGroup.add(m);
      envAnimState.ambientParticles.push(m);
    }

    spots = [
      { name: '마천루 네온 아치 정면', x: 0, z: 0, rotY: 0 },
      { name: '루프탑 인피니티 풀 데크', x: -4.8, z: -0.5, rotY: 0.24 },
      { name: '황금 샴페인 타워 테라스', x: 4.8, z: -0.5, rotY: -0.24 },
    ];
  }

  return spots;
}

// ─── 커플 3D 캐릭터 생성기 (사람 얼굴 눈·코·입 없음! 고급 피규어 디테일 의상·헤어·소품 실루엣!) ───
const coupleRoot = new THREE.Group();
scene.add(coupleRoot);

let groomRig = null;
let brideRig = null;

function buildLushBouquet(accentColor) {
  const grp = new THREE.Group();
  const wrapMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.55 });
  const ribbonMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.3, metalness: 0.05 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.45 });

  // 크래프트 포장지 콘 & 손잡이
  const wrapCone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.68, 16), wrapMat);
  wrapCone.rotation.x = Math.PI;
  wrapCone.position.y = -0.12;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.38, 10), leafMat);
  stem.position.y = -0.42;
  const bowBand = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 16), ribbonMat);
  bowBand.rotation.x = Math.PI / 2;
  bowBand.position.y = -0.26;
  grp.add(wrapCone, stem, bowBand);

  // 유칼립투스 초록 잎사귀 테두리
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), leafMat);
    lf.scale.set(1.25, 0.32, 0.85);
    lf.position.set(Math.cos(a) * 0.34, 0.18, Math.sin(a) * 0.34);
    lf.rotation.y = -a;
    lf.rotation.z = 0.32;
    grp.add(lf);
  }

  // 풍성한 장미·작약 꽃송이 다발
  const flowerPalette = [accentColor, '#ffffff', '#fda4af', '#fef08a', accentColor];
  const flowerOffsets = [
    [0, 0.34, 0, 0.20],
    [-0.22, 0.27, 0.14, 0.16],
    [0.22, 0.27, 0.14, 0.16],
    [-0.20, 0.26, -0.16, 0.16],
    [0.20, 0.26, -0.16, 0.16],
    [0, 0.28, 0.24, 0.15],
    [0, 0.28, -0.24, 0.15],
  ];
  flowerOffsets.forEach(([fx, fy, fz, r], idx) => {
    const fMat = new THREE.MeshStandardMaterial({ color: flowerPalette[idx % flowerPalette.length], roughness: 0.35 });
    const outer = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), fMat);
    outer.scale.set(1, 0.82, 1);
    outer.position.set(fx, fy, fz);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.52, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#fde047', roughness: 0.4 })
    );
    core.position.set(fx, fy + r * 0.45, fz);
    grp.add(outer, core);
  });

  return grp;
}

function buildHeartBalloonProp(accentColor) {
  const grp = new THREE.Group();
  const mat1 = new THREE.MeshPhysicalMaterial({ color: accentColor, roughness: 0.12, clearcoat: 1.0 });
  const mat2 = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, clearcoat: 0.9 });

  const h1 = new THREE.Mesh(SHARED_HEART_GEO, mat1);
  h1.position.set(0.08, 1.72, 0);
  h1.rotation.z = -0.10;
  const h2 = new THREE.Mesh(SHARED_HEART_GEO, mat2);
  h2.scale.setScalar(0.82);
  h2.position.set(-0.28, 1.48, -0.14);
  h2.rotation.z = 0.16;

  const strMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.55, 6), strMat);
  s1.position.set(0.04, 0.82, 0);
  const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.35, 6), strMat);
  s2.position.set(-0.12, 0.72, -0.06);
  s2.rotation.z = -0.15;

  grp.add(h1, h2, s1, s2);
  return grp;
}

function buildPersonBackRig({ bodyColor, isSkirt, accentColor, hatType, propType, isRightSide }) {
  const root = new THREE.Group();
  const clothMat = new THREE.MeshPhysicalMaterial({
    color: bodyColor,
    roughness: 0.36,
    clearcoat: isSkirt ? 0.35 : 0.18,
    side: THREE.DoubleSide,
  });
  const whiteClothMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.32 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f7d3ba', roughness: 0.52 });
  const hairMat = new THREE.MeshStandardMaterial({ color: isRightSide ? '#3b2216' : '#1b1411', roughness: 0.48 });
  const accentMat = new THREE.MeshPhysicalMaterial({ color: accentColor, roughness: 0.28, clearcoat: 0.5 });
  const goldAccentMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.22, metalness: 0.78 });

  // 1) 다리 & 고급 정장 구두 / 웨딩 새틴 힐 (발끝 클로즈업 샷에서 돋보이는 입체 구두!)
  const pantColor = isSkirt ? '#f7d3ba' : '#182232';
  const legMat = new THREE.MeshStandardMaterial({ color: pantColor, roughness: 0.48 });
  const legL = new THREE.Group();
  legL.position.set(-0.27, 1.05, 0);
  const hipJointL = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), legMat);
  const legShaftL = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.92, 14), legMat);
  legShaftL.position.y = -0.46;
  legShaftL.castShadow = true;
  legL.add(hipJointL, legShaftL);

  const legR = new THREE.Group();
  legR.position.set(0.27, 1.05, 0);
  const hipJointR = hipJointL.clone();
  const legShaftR = legShaftL.clone();
  legR.add(hipJointR, legShaftR);

  // 입체 구두 제작 도우미 (둥근 앞코 + 발등 + 굽 + 신부용 리본 장식)
  const shoeMat = new THREE.MeshPhysicalMaterial({
    color: isSkirt ? accentColor : '#0f172a',
    roughness: 0.20,
    clearcoat: 0.9,
  });
  function makeDetailedShoe() {
    const sg = new THREE.Group();
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.06, 0.52), new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 }));
    sole.position.set(0, -0.99, -0.06);
    const vamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.24, 8, 12), shoeMat);
    vamp.rotation.x = Math.PI / 2;
    vamp.scale.set(1.02, 1.0, 0.72);
    vamp.position.set(0, -0.92, -0.07);
    const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, isSkirt ? 0.16 : 0.10, 10), shoeMat);
    heel.position.set(0, -0.96, 0.13);
    sg.add(sole, vamp, heel);
    if (isSkirt) {
      const ankleStrap = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.024, 8, 16), shoeMat);
      ankleStrap.rotation.x = Math.PI / 2;
      ankleStrap.position.set(0, -0.82, 0.04);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), whiteClothMat);
      pearl.position.set(0, -0.86, -0.22);
      sg.add(ankleStrap, pearl);
    }
    return sg;
  }
  legL.add(makeDetailedShoe());
  legR.add(makeDetailedShoe());
  root.add(legL, legR);

  // 2) 상체 & 의상 (신부: 다층 벨라인 레이스 드레스 + 허리 리본 보우 / 신랑: 테일러드 턱시도 + 셔츠 카라 + 부토니에)
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 1.12;
  root.add(bodyGroup);

  if (isSkirt) {
    // LatheGeometry로 깎은 우아한 벨라인 웨딩/파티 드레스 스커트! (아래→위 순서로 바깥 법선 정렬)
    const skirtPts = [
      new THREE.Vector2(0.01, -0.66),
      new THREE.Vector2(1.22, -0.68),
      new THREE.Vector2(1.15, -0.45),
      new THREE.Vector2(0.84, 0.32),
      new THREE.Vector2(0.56, 0.72),
      new THREE.Vector2(0.38, 0.96),
      new THREE.Vector2(0.01, 0.98),
    ];
    const skirtGeo = new THREE.LatheGeometry(skirtPts, 28);
    const skirt = new THREE.Mesh(skirtGeo, clothMat);
    skirt.scale.set(1.0, 1.0, 0.88);
    skirt.castShadow = true;

    // 밑단 시폰 레이스 프릴 링
    const hemRuffle = new THREE.Mesh(
      new THREE.TorusGeometry(1.16, 0.085, 10, 32),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, transparent: true, opacity: 0.92 })
    );
    hemRuffle.rotation.x = Math.PI / 2;
    hemRuffle.scale.set(1.0, 0.88, 1.0);
    hemRuffle.position.y = -0.66;

    // 상체 보디스 & 오프숄더 퍼프 라인
    const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.37, 0.76, 20), clothMat);
    bodice.scale.set(1.06, 1, 0.80);
    bodice.position.y = 1.24;
    bodice.castShadow = true;

    const necklineLace = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.055, 8, 22), whiteClothMat);
    necklineLace.rotation.x = Math.PI / 2;
    necklineLace.scale.set(1.08, 0.82, 1);
    necklineLace.position.y = 1.56;

    // 허리 새틴 새시 벨트 & 등 뒤 입체 왕리본(보우 + 두 가닥 꼬리!)
    const waistBelt = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.41, 0.14, 20), accentMat);
    waistBelt.scale.set(1.06, 1, 0.82);
    waistBelt.position.y = 0.92;

    const backBow = new THREE.Group();
    backBow.position.set(0, 0.92, 0.35);
    const bowLoopL = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), accentMat);
    bowLoopL.scale.set(1.25, 0.78, 0.45);
    bowLoopL.position.set(-0.20, 0.03, 0);
    bowLoopL.rotation.z = 0.22;
    const bowLoopR = bowLoopL.clone();
    bowLoopR.position.x = 0.20;
    bowLoopR.rotation.z = -0.22;
    const bowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), accentMat);
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.04), accentMat);
    tailL.position.set(-0.14, -0.32, 0.02);
    tailL.rotation.z = 0.18;
    const tailR = tailL.clone();
    tailR.position.x = 0.14;
    tailR.rotation.z = -0.18;
    backBow.add(bowLoopL, bowLoopR, bowKnot, tailL, tailR);

    bodyGroup.add(skirt, hemRuffle, bodice, necklineLace, waistBelt, backBow);
  } else {
    // 테일러드 수트 재킷 (어깨에서 허리로 떨어지는 역삼각형 핏 + 등 벤트 트임 + 라펠 + 셔츠 + 보타이 + 부토니에!)
    const jacketUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.47, 1.15, 20), clothMat);
    jacketUpper.scale.set(1.16, 1, 0.74);
    jacketUpper.position.y = 1.05;
    jacketUpper.castShadow = true;

    const jacketPeplum = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.51, 0.48, 20), clothMat);
    jacketPeplum.scale.set(1.14, 1, 0.75);
    jacketPeplum.position.y = 0.28;
    jacketPeplum.castShadow = true;

    // 등 뒤 정장 센터 벤트 라인 & 허리 장식 벨트 탭
    const backSeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 1.38, 0.03),
      new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.7 })
    );
    backSeam.position.set(0, 0.82, 0.36);

    // 새하얀 와이셔츠 칼라 & 앞가슴 셔츠 V존 (측면 40° 샷에서도 고급스럽게 보임!)
    const shirtCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.24, 16), whiteClothMat);
    shirtCollar.position.set(0, 1.66, 0);
    const shirtFront = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.62, 0.12), whiteClothMat);
    shirtFront.position.set(0, 1.30, -0.34);

    // 나비넥타이 & 왼쪽 가슴 장미 부토니에
    const bowTie = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.10, 0.08), accentMat);
    bowTie.position.set(0, 1.56, -0.39);
    const boutonniere = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), accentMat);
    boutonniere.position.set(-0.28, 1.38, -0.39);
    const boutLeaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.14, 6),
      new THREE.MeshStandardMaterial({ color: '#16a34a' })
    );
    boutLeaf.position.set(-0.28, 1.29, -0.39);
    boutLeaf.rotation.z = Math.PI;

    bodyGroup.add(jacketUpper, jacketPeplum, backSeam, shirtCollar, shirtFront, bowTie, boutonniere, boutLeaf);
  }

  // 3) 목 & 입체 헤어스타일 두상 (사람 얼굴 눈·코·입은 절대 그리지 않음! 두상 + 귀 + 풍성한 헤어 볼륨!)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.28, 14), skinMat);
  neck.position.set(0, 1.70, 0);
  bodyGroup.add(neck);

  if (isSkirt) {
    const pearlNecklace = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.028, 8, 18), whiteClothMat);
    pearlNecklace.rotation.x = Math.PI / 2 + 0.12;
    pearlNecklace.position.set(0, 1.64, 0);
    bodyGroup.add(pearlNecklace);
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.08, 0);

  // 매끄러운 피부 두상(눈·코·입 없음!) + 양쪽 귀
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.43, 20, 18), skinMat);
  cranium.scale.set(0.96, 1.04, 0.96);
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), skinMat);
  earL.scale.set(0.55, 1.0, 0.75);
  earL.position.set(-0.42, -0.02, 0.02);
  const earR = earL.clone();
  earR.position.x = 0.42;
  headGroup.add(cranium, earL, earR);

  // 입체 헤어스타일 볼륨 조형
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.465, 20, 16, 0, TAU, 0, Math.PI * 0.62),
    hairMat
  );
  hairCap.position.y = 0.03;
  hairCap.rotation.x = -0.24; // 뒤통수를 감싸고 앞이마 위까지만 자연스럽게 덮음
  const hairBackCrown = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 14), hairMat);
  hairBackCrown.scale.set(0.98, 1.02, 0.88);
  hairBackCrown.position.set(0, -0.02, 0.10);
  headGroup.add(hairCap, hairBackCrown);

  if (isRightSide) {
    // 신부: 우아한 로우 시뇽(올림머리 번) + 진주 헤어핀 & 귀걸이 포인트
    const chignon = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 14), hairMat);
    chignon.scale.set(1.18, 0.92, 0.95);
    chignon.position.set(0, -0.14, 0.44);
    const hairPinBand = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.03, 8, 16), whiteClothMat);
    hairPinBand.position.set(0, -0.12, 0.38);
    const earringL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), whiteClothMat);
    earringL.position.set(-0.43, -0.13, 0.02);
    const earringR = earringL.clone();
    earringR.position.x = 0.43;
    headGroup.add(chignon, hairPinBand, earringL, earringR);
  } else {
    // 신랑: 볼륨 댄디 가르마 정수리 컬 & 깔끔한 투블럭 뒷목 라인
    const topWave = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.34, 8, 12), hairMat);
    topWave.rotation.z = Math.PI / 2 - 0.18;
    topWave.position.set(0.04, 0.35, -0.04);
    const napeHair = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.28, 14), hairMat);
    napeHair.position.set(0, -0.24, 0.16);
    headGroup.add(topWave, napeHair);
  }

  // 4) 신부 헤드피스 4종 정밀 조형
  let veilMesh = null;
  if (isRightSide) {
    if (hatType === 'veil') {
      const veilGrp = new THREE.Group();
      veilGrp.position.set(0, 0.14, 0.28);
      const comb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.08), whiteClothMat);
      // 2겹 풍성한 반투명 튤 레이스 베일
      const vOuter = new THREE.Mesh(
        new THREE.ConeGeometry(1.02, 2.35, 20, 1, true),
        new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          roughness: 0.3,
          transparent: true,
          opacity: 0.62,
          side: THREE.DoubleSide,
        })
      );
      vOuter.scale.set(1.0, 1.0, 0.62);
      vOuter.position.set(0, -1.05, 0.18);
      vOuter.rotation.x = 0.18;

      const vInner = new THREE.Mesh(
        new THREE.ConeGeometry(0.72, 1.35, 16, 1, true),
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        })
      );
      vInner.scale.set(1.0, 1.0, 0.55);
      vInner.position.set(0, -0.58, 0.22);
      vInner.rotation.x = 0.26;

      veilGrp.add(comb, vOuter, vInner);
      headGroup.add(veilGrp);
      veilMesh = veilGrp;
    } else if (hatType === 'straw_hat') {
      const hatGrp = new THREE.Group();
      hatGrp.position.set(0, 0.26, 0.04);
      hatGrp.rotation.x = 0.18;
      const strawMat = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.72 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.04, 0.06, 28), strawMat);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.49, 0.36, 20), strawMat);
      crown.position.y = 0.20;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.50, 0.09, 20), accentMat);
      band.position.y = 0.07;
      const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.55, 0.03), accentMat);
      tail1.position.set(-0.08, -0.22, 0.52);
      tail1.rotation.x = 0.25;
      tail1.rotation.z = 0.15;
      const tail2 = tail1.clone();
      tail2.position.x = 0.08;
      tail2.rotation.z = -0.15;
      hatGrp.add(brim, crown, band, tail1, tail2);
      headGroup.add(hatGrp);
    } else if (hatType === 'tiara') {
      const tiaraGrp = new THREE.Group();
      tiaraGrp.position.set(0, 0.38, -0.04);
      const baseBand = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 8, 24), goldAccentMat);
      baseBand.rotation.x = Math.PI / 2;
      tiaraGrp.add(baseBand);
      for (let i = -2; i <= 2; i++) {
        const h = 0.22 - Math.abs(i) * 0.045;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(0.055, h, 8), goldAccentMat);
        const ang = i * 0.42;
        spire.position.set(Math.sin(ang) * 0.37, h * 0.5, -Math.cos(ang) * 0.37);
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), accentMat);
        gem.position.set(Math.sin(ang) * 0.37, h + 0.02, -Math.cos(ang) * 0.37);
        tiaraGrp.add(spire, gem);
      }
      headGroup.add(tiaraGrp);
    } else if (hatType === 'beret') {
      const beretGrp = new THREE.Group();
      beretGrp.position.set(0.08, 0.36, 0.02);
      beretGrp.rotation.z = -0.18;
      const beretBody = new THREE.Mesh(new THREE.SphereGeometry(0.50, 20, 14), accentMat);
      beretBody.scale.set(1.12, 0.42, 1.12);
      const stemTip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), accentMat);
      stemTip.position.y = 0.22;
      beretGrp.add(beretBody, stemTip);
      headGroup.add(beretGrp);
    } else if (hatType === 'ribbon') {
      const ribGrp = new THREE.Group();
      ribGrp.position.set(0, 0.38, 0.22);
      const wingL = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), accentMat);
      wingL.scale.set(1.3, 0.72, 0.45);
      wingL.position.set(-0.26, 0.04, 0);
      wingL.rotation.z = 0.26;
      const wingR = wingL.clone();
      wingR.position.x = 0.26;
      wingR.rotation.z = -0.26;
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), accentMat);
      ribGrp.add(wingL, wingR, knot);
      headGroup.add(ribGrp);
    }
  }
  bodyGroup.add(headGroup);

  // 5) 양팔 + 소매 커프스/퍼프 + 둥근 손 & 소품
  function makeDetailedArm(isLeft) {
    const ag = new THREE.Group();
    ag.position.set(isLeft ? -0.64 : 0.64, 1.50, 0);

    if (isSkirt) {
      // 귀여운 시스루 퍼프 소매 + 매끄러운 팔 + 손
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), clothMat);
      puff.position.y = -0.06;
      const armLimb = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.095, 0.78, 12), skinMat);
      armLimb.position.y = -0.46;
      armLimb.castShadow = true;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), skinMat);
      hand.scale.set(0.95, 1.15, 0.85);
      hand.position.y = -0.90;
      ag.add(puff, armLimb, hand);
    } else {
      // 정장 소매 + 하얀 셔츠 커프스 + 손
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 10), clothMat);
      shoulder.position.y = -0.04;
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.13, 0.76, 14), clothMat);
      sleeve.position.y = -0.44;
      sleeve.castShadow = true;
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.09, 12), whiteClothMat);
      cuff.position.y = -0.83;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), skinMat);
      hand.scale.set(0.95, 1.15, 0.85);
      hand.position.y = -0.93;
      ag.add(shoulder, sleeve, cuff, hand);
    }
    return ag;
  }

  const armL = makeDetailedArm(true);
  const armR = makeDetailedArm(false);

  if (isRightSide) {
    const propHolder = new THREE.Group();
    propHolder.position.set(0, -0.94, -0.06);
    if (propType === 'balloon') {
      propHolder.add(buildHeartBalloonProp(accentColor));
    } else {
      propHolder.add(buildLushBouquet(accentColor));
    }
    armR.add(propHolder);
  }

  bodyGroup.add(armL, armR);
  return { root, bodyGroup, headGroup, armL, armR, legL, legR, veilMesh };
}

function buildCoupleForStage(cfg) {
  clearGroup(coupleRoot);
  groomRig = buildPersonBackRig({
    bodyColor: cfg.groomColor,
    isSkirt: false,
    accentColor: cfg.accentColor,
    hatType: 'none',
    propType: 'none',
    isRightSide: false,
  });
  brideRig = buildPersonBackRig({
    bodyColor: cfg.brideColor,
    isSkirt: true,
    accentColor: cfg.accentColor,
    hatType: cfg.hatType,
    propType: cfg.propType,
    isRightSide: true,
  });
  groomRig.root.position.set(-0.92, 0, 0);
  brideRig.root.position.set(0.92, 0, 0);
  coupleRoot.add(groomRig.root, brideRig.root);
}

function applyCouplePose(poseId, amount) {
  if (!groomRig || !brideRig) return;
  const a = clamp(amount, 0, 1);

  groomRig.root.position.set(-0.92, 0, 0);
  brideRig.root.position.set(0.92, 0, 0);
  groomRig.root.rotation.set(0, 0, 0);
  brideRig.root.rotation.set(0, 0, 0);
  groomRig.armL.rotation.set(0, 0, 0.15);
  groomRig.armR.rotation.set(0, 0, -0.18);
  brideRig.armL.rotation.set(0, 0, 0.18);
  brideRig.armR.rotation.set(0, 0, -0.25);
  groomRig.legL.rotation.set(0, 0, 0);
  groomRig.legR.rotation.set(0, 0, 0);
  brideRig.legL.rotation.set(0, 0, 0);
  brideRig.legR.rotation.set(0, 0, 0);
  if (brideRig.veilMesh) brideRig.veilMesh.rotation.set(0, 0, 0);

  if (poseId === 'hand_hold') {
    groomRig.root.position.x = lerp(-1.15, -0.78, a);
    brideRig.root.position.x = lerp(1.15, 0.78, a);
    groomRig.armR.rotation.z = lerp(-0.15, -0.72, a);
    brideRig.armL.rotation.z = lerp(0.15, 0.72, a);
    brideRig.armR.rotation.z = lerp(-0.25, -0.95, a);
  } else if (poseId === 'jump_high') {
    const jumpY = Math.pow(a, 1.2) * 1.55;
    groomRig.root.position.y = jumpY;
    brideRig.root.position.y = jumpY;
    groomRig.armL.rotation.z = lerp(0.15, 2.55, a);
    groomRig.armR.rotation.z = lerp(-0.18, -2.55, a);
    brideRig.armL.rotation.z = lerp(0.18, 2.55, a);
    brideRig.armR.rotation.z = lerp(-0.25, -2.55, a);
    groomRig.legL.rotation.x = a * 0.55;
    brideRig.legR.rotation.x = a * 0.55;
  } else if (poseId === 'bouquet_up') {
    brideRig.armR.rotation.z = lerp(-0.25, -2.85, a);
    groomRig.armL.rotation.z = lerp(0.15, 2.75, a);
    groomRig.root.rotation.z = lerp(0, -0.08, a);
    brideRig.root.rotation.z = lerp(0, 0.08, a);
  } else if (poseId === 'big_heart') {
    groomRig.armL.rotation.z = lerp(0.15, 2.35, a);
    groomRig.armR.rotation.z = lerp(-0.18, -2.15, a);
    brideRig.armL.rotation.z = lerp(0.18, 2.15, a);
    brideRig.armR.rotation.z = lerp(-0.25, -2.35, a);
  } else if (poseId === 'lean_in') {
    groomRig.root.position.x = lerp(-1.05, -0.74, a);
    brideRig.root.position.x = lerp(1.05, 0.74, a);
    groomRig.root.rotation.z = lerp(0, -0.19, a);
    brideRig.root.rotation.z = lerp(0, 0.19, a);
    groomRig.armR.rotation.z = -0.65 * a;
    brideRig.armL.rotation.z = 0.65 * a;
  } else if (poseId === 'kick_leg') {
    groomRig.legL.rotation.z = -0.65 * a;
    brideRig.legR.rotation.z = 0.68 * a;
    groomRig.armL.rotation.z = 1.75 * a;
    brideRig.armR.rotation.z = -1.95 * a;
  } else if (poseId === 'veil_wind') {
    if (brideRig.veilMesh) {
      brideRig.veilMesh.rotation.z = lerp(0, 0.88, a);
      brideRig.veilMesh.rotation.x = lerp(0, 0.52, a);
    }
    brideRig.armR.rotation.z = lerp(-0.25, -2.1, a);
    groomRig.armL.rotation.z = lerp(0.15, 1.45, a);
    groomRig.root.rotation.y = lerp(0, -0.28, a);
    brideRig.root.rotation.y = lerp(0, 0.28, a);
  } else {
    groomRig.root.position.x = lerp(-0.92, -1.25, a);
    brideRig.root.position.x = lerp(0.92, 1.25, a);
    groomRig.armL.rotation.z = lerp(0.15, 1.65, a);
    groomRig.armR.rotation.z = lerp(-0.18, -1.65, a);
    brideRig.armL.rotation.z = lerp(0.18, 1.65, a);
    brideRig.armR.rotation.z = lerp(-0.25, -1.65, a);
  }
}

// ─── 14종 엉뚱한 돌발 방해물 카탈로그 & 3D 메쉬 ───
const CHAOS_CATALOG = [
  { id: 'duck_walk', tier: 1, failLabel: '🦆 통통한 오리가 찍혔어요!!', speech: '꽥꽥?! 비켜!!' },
  { id: 'duck_closeup', tier: 1, failLabel: '🦆 오리 초근접 얼빡샷 찍힘!!', speech: '렌즈 맛있다 꽥!' },
  { id: 'ex_lover', tier: 1, failLabel: '💐 전 애인 난입 현장 찍힘!!', speech: '이 스냅 무효야!!!' },
  { id: 'heart_balloons', tier: 1, failLabel: '🎈 풍선 다발에 커플이 가려짐!', speech: '' },
  { id: 'sprinkler', tier: 1, failLabel: '💦 스프링클러 물벼락 찍힘!!', speech: '치이이익—💦' },
  { id: 'seagull_dive', tier: 1, failLabel: '🕊️ 새우깡 도둑 갈매기 찍힘!', speech: '끼룩!! 내 과자!' },
  { id: 'crab_parade', tier: 1, failLabel: '🦀 대왕 꽃게 댄스단 찍힘!!', speech: '집게집게 딱딱!' },
  { id: 'hiker_group', tier: 1, failLabel: '🧢 단체 등산객 길막 찍힘!!', speech: '여기가 명당이네~!' },
  { id: 'dino_suit', tier: 2, failLabel: '🦖 공룡 인형탈 알바생 찍힘!!', speech: '전단지 받아가세요 크앙!' },
  { id: 'serving_robot', tier: 2, failLabel: '🤖 길 잃은 짬뽕 서빙로봇 찍힘!', speech: '주문하신 짬뽕 왔습니다~' },
  { id: 'ufo_beam', tier: 3, failLabel: '🛸 외계 UFO 납치 광선 찍힘!!', speech: '삐빅! 지구인 커플 포착!' },
  { id: 'cool_alpaca', tier: 3, failLabel: '🦙 선글라스 알파카 얼빡 찍힘!!', speech: '음메~ 나 잘 나왔어?' },
  { id: 'golden_dolphin', tier: 3, failLabel: '🐬 하늘 나는 황금 돌고래 찍힘!', speech: '끼이이익~✨' },
  { id: 'disco_snowman', tier: 3, failLabel: '⛄ 계절 파괴 디스코 눈사람 찍힘!', speech: '한여름에도 안 녹지롱!' },
];

function buildChaosMesh(def) {
  const g = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.32 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.30 });
  const darkMat = new THREE.MeshPhysicalMaterial({ color: '#0f172a', roughness: 0.20, clearcoat: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f7d3ba', roughness: 0.52 });

  if (def.id === 'duck_walk' || def.id === 'duck_closeup') {
    const sc = def.id === 'duck_closeup' ? 1.48 : 1.12;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.74 * sc, 20, 16), whiteMat);
    body.scale.set(1.26, 0.88, 0.96);
    body.position.y = 0.82 * sc;

    // 뾰족 치켜든 오리 꼬리 & 양옆 통통한 날개
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.32 * sc, 0.65 * sc, 12), whiteMat);
    tail.rotation.z = Math.PI * 0.62;
    tail.position.set(-0.88 * sc, 1.05 * sc, 0);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.45 * sc, 14, 10), whiteMat);
      wing.scale.set(1.35, 0.62, 0.28);
      wing.position.set(-0.08 * sc, 0.88 * sc, side * 0.68 * sc);
      wing.rotation.z = 0.14;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.46 * sc, 0.10 * sc, 0.36 * sc), orangeMat);
      foot.position.set(0.10 * sc, 0.10 * sc, side * 0.32 * sc);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * sc, 0.06 * sc, 0.36 * sc, 8), orangeMat);
      leg.position.set(0.02 * sc, 0.28 * sc, side * 0.32 * sc);
      g.add(wing, foot, leg);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * sc, 0.34 * sc, 0.55 * sc, 14), whiteMat);
    neck.position.set(0.38 * sc, 1.28 * sc, 0.08 * sc);
    neck.rotation.z = -0.20;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.50 * sc, 20, 16), whiteMat);
    head.position.set(0.48 * sc, 1.66 * sc, 0.14 * sc);

    // 위·아래 입체 오리 부리 & 볼터치 & 반짝 눈망울
    const beakTop = new THREE.Mesh(new THREE.CapsuleGeometry(0.16 * sc, 0.32 * sc, 8, 12), orangeMat);
    beakTop.rotation.z = Math.PI / 2;
    beakTop.scale.set(0.65, 1.0, 1.35);
    beakTop.position.set(0.88 * sc, 1.62 * sc, 0.26 * sc);
    const beakBot = beakTop.clone();
    beakBot.scale.set(0.48, 0.88, 1.18);
    beakBot.position.set(0.84 * sc, 1.50 * sc, 0.24 * sc);
    beakBot.rotation.z = Math.PI / 2 + 0.18;

    const blushMat = new THREE.MeshBasicMaterial({ color: '#fda4af' });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085 * sc, 10, 10), darkMat);
      eye.position.set(0.64 * sc, 1.76 * sc, 0.14 * sc + side * 0.38 * sc);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.03 * sc, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      glint.position.set(0.71 * sc, 1.79 * sc, 0.16 * sc + side * 0.39 * sc);
      const blush = new THREE.Mesh(new THREE.SphereGeometry(0.09 * sc, 8, 8), blushMat);
      blush.scale.set(0.7, 0.5, 0.4);
      blush.position.set(0.60 * sc, 1.60 * sc, 0.14 * sc + side * 0.43 * sc);
      g.add(eye, glint, blush);
    }
    g.add(body, tail, neck, head, beakTop, beakBot);
  } else if (def.id === 'ex_lover') {
    // 사람 얼굴(눈·코·입) 없이 헝클어진 머리·턱시도·넥타이·초대형 붉은 장미 꽃다발로 코믹 연출!
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.95, 12), darkMat);
    legL.position.set(-0.22, 0.48, 0);
    legL.rotation.z = 0.18;
    const legR = legL.clone();
    legR.position.x = 0.22;
    legR.rotation.z = -0.22;

    const suit = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.44, 1.25, 16), darkMat);
    suit.scale.set(1.12, 1, 0.76);
    suit.position.y = 1.48;
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 0.10), whiteMat);
    shirt.position.set(0, 1.68, 0.38);
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.52, 4), new THREE.MeshStandardMaterial({ color: '#e11d48' }));
    tie.rotation.x = Math.PI;
    tie.position.set(0, 1.56, 0.44);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.41, 16, 14), skinMat);
    head.position.y = 2.40;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 14, 0, TAU, 0, Math.PI * 0.65), darkMat);
    hair.position.set(0, 2.44, -0.04);
    hair.rotation.x = 0.22;

    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.85, 10), darkMat);
    armR.position.set(0.58, 1.92, 0.22);
    armR.rotation.z = -0.85;
    const bigBouquet = buildLushBouquet('#e11d48');
    bigBouquet.scale.setScalar(1.45);
    bigBouquet.position.set(0.92, 2.28, 0.32);
    bigBouquet.rotation.z = -0.35;

    g.add(legL, legR, suit, shirt, tie, head, hair, armR, bigBouquet);
  } else if (def.id === 'heart_balloons') {
    const colors = ['#fb7185', '#f43f5e', '#fde047', '#c084fc', '#38bdf8', '#f472b6'];
    const offsets = [
      [-0.75, 1.95, 0.1], [-0.28, 2.45, -0.15], [0.28, 2.05, 0.2],
      [0.78, 2.38, -0.1], [-0.45, 1.55, 0.25], [0.42, 1.62, -0.2],
    ];
    const strMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    offsets.forEach(([bx, by, bz], i) => {
      const bMat = new THREE.MeshPhysicalMaterial({ color: colors[i], roughness: 0.12, clearcoat: 1.0 });
      const b = new THREE.Mesh(SHARED_HEART_GEO, bMat);
      b.scale.setScalar(1.12);
      b.position.set(bx, by, bz);
      b.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.16;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6), strMat);
      st.position.set(bx * 0.65, by - 0.95, bz * 0.65);
      st.rotation.z = bx * 0.22;
      g.add(b, st);
    });
  } else if (def.id === 'sprinkler') {
    const nozzleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.35, 16), darkMat);
    nozzleBase.position.y = 0.18;
    const brassHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.8, roughness: 0.2 })
    );
    brassHead.position.y = 0.42;
    g.add(nozzleBase, brassHead);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: '#7dd3fc',
      roughness: 0.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.72,
    });
    for (let i = -4; i <= 4; i++) {
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.24, 3.6, 12), waterMat);
      jet.position.set(i * 0.38, 1.85, (Math.abs(i) % 2) * 0.18 - 0.09);
      jet.rotation.z = -i * 0.16;
      g.add(jet);
    }
    const dropGeo = new THREE.SphereGeometry(0.11, 8, 8);
    for (let k = 0; k < 14; k++) {
      const dr = new THREE.Mesh(dropGeo, waterMat);
      dr.position.set((k - 6.5) * 0.30, 1.2 + (k % 4) * 0.65, ((k * 3) % 5 - 2) * 0.18);
      g.add(dr);
    }
  } else if (def.id === 'seagull_dive') {
    const grayTipMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.88, 10, 14), whiteMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 2.55;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), whiteMat);
    head.position.set(0.58, 2.70, 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.52, 8), grayTipMat);
    tail.rotation.z = Math.PI / 2 + 0.2;
    tail.position.set(-0.72, 2.58, 0);

    // 갈매기 특유의 꺾인 양날개 + 회색 날개 끝
    for (const side of [-1, 1]) {
      const wInner = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.07, 1.15), whiteMat);
      wInner.position.set(0.05, 2.76, side * 0.62);
      wInner.rotation.x = side * 0.28;
      const wOuter = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.95), grayTipMat);
      wOuter.position.set(-0.08, 2.86, side * 1.48);
      wOuter.rotation.x = -side * 0.22;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), darkMat);
      eye.position.set(0.68, 2.76, side * 0.22);
      g.add(wInner, wOuter, eye);
    }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.46, 10), orangeMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.92, 2.66, 0);
    // 부리에 앙 물고 가는 새우 스낵!
    const snack = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.065, 8, 14, Math.PI * 0.85),
      new THREE.MeshStandardMaterial({ color: '#fb923c', roughness: 0.6 })
    );
    snack.position.set(1.08, 2.52, 0.08);
    g.add(body, head, tail, beak, snack);
  } else if (def.id === 'crab_parade') {
    const redMat = new THREE.MeshPhysicalMaterial({ color: '#ef4444', roughness: 0.24, clearcoat: 0.85 });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.92, 20, 16), redMat);
    shell.scale.set(1.38, 0.62, 0.98);
    shell.position.y = 0.88;

    // 눈자루 2개 + 관절 다리 6개 + V자 입체 집게발 한 쌍!
    for (const side of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.36, 8), redMat);
      stalk.position.set(side * 0.34, 1.38, 0.52);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 10), darkMat);
      eye.position.set(side * 0.34, 1.58, 0.54);
      g.add(stalk, eye);

      for (let k = 0; k < 3; k++) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.62, 6, 8), redMat);
        leg.position.set(side * (1.05 + k * 0.12), 0.48, (k - 1) * 0.34);
        leg.rotation.z = side * 0.65;
        g.add(leg);
      }

      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 8, 10), redMat);
      arm.position.set(side * 0.96, 1.32, 0.25);
      arm.rotation.z = -side * 0.52;
      const pincerA = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.68, 12), redMat);
      pincerA.position.set(side * 1.18, 1.85, 0.30);
      pincerA.rotation.z = side * 0.25;
      const pincerB = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.56, 12), redMat);
      pincerB.position.set(side * 0.96, 1.82, 0.30);
      pincerB.rotation.z = -side * 0.32;
      g.add(arm, pincerA, pincerB);
    }
    g.add(shell);
  } else if (def.id === 'hiker_group') {
    // 눈·코·입 없이 아웃도어 조끼 + 챙모자 + 등산 배낭(매트 장착) + 등산 스틱 2명!
    const vestColors = ['#f97316', '#84cc16'];
    const hatColors = ['#fde047', '#ec4899'];
    const packColors = ['#0284c7', '#7c3aed'];
    for (let i = 0; i < 2; i++) {
      const ox = (i - 0.5) * 1.42;
      const hg = new THREE.Group();
      hg.position.x = ox;

      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.95, 12), darkMat);
      legs.position.y = 0.48;
      const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.42, 1.05, 16), new THREE.MeshStandardMaterial({ color: vestColors[i], roughness: 0.5 }));
      vest.position.y = 1.40;
      const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.88, 0.42), new THREE.MeshStandardMaterial({ color: packColors[i], roughness: 0.6 }));
      backpack.position.set(0, 1.46, -0.38);
      const rollMat = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.74, 12), new THREE.MeshStandardMaterial({ color: '#fef08a' }));
      rollMat.rotation.z = Math.PI / 2;
      rollMat.position.set(0, 1.98, -0.38);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), skinMat);
      head.position.y = 2.18;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.65, 0.06, 18), new THREE.MeshStandardMaterial({ color: hatColors[i] }));
      brim.position.y = 2.34;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.26, 16), new THREE.MeshStandardMaterial({ color: hatColors[i] }));
      crown.position.y = 2.48;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 1.85, 8), new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.7 }));
      pole.position.set(i === 0 ? -0.58 : 0.58, 0.95, 0.22);
      pole.rotation.z = i === 0 ? 0.12 : -0.12;

      hg.add(legs, vest, backpack, rollMat, head, brim, crown, pole);
      g.add(hg);
    }
  } else if (def.id === 'dino_suit') {
    const dinoMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.38 });
    const bellyPatchMat = new THREE.MeshStandardMaterial({ color: '#fde047', roughness: 0.45 });
    const spikeMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.4 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 1.05, 12, 16), dinoMat);
    body.position.y = 1.38;
    const bellyPatch = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), bellyPatchMat);
    bellyPatch.scale.set(0.65, 1.25, 0.82);
    bellyPatch.position.set(0.28, 1.32, 0);

    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.52, 8, 10), dinoMat);
      leg.position.set(0, 0.42, side * 0.34);
      const tinyArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 6, 8), dinoMat);
      tinyArm.rotation.z = -0.85;
      tinyArm.position.set(0.62, 1.62, side * 0.32);
      g.add(leg, tinyArm);
    }
    // 전단지 뭉치
    const flyer = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.08), new THREE.MeshBasicMaterial({ color: '#fef08a' }));
    flyer.position.set(0.86, 1.56, 0.32);
    flyer.rotation.z = -0.25;

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.66, 0.78), dinoMat);
    head.position.set(0.46, 2.38, 0);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.24, 0.68), dinoMat);
    jaw.position.set(0.46, 1.98, 0);
    jaw.rotation.z = -0.18;
    // 공룡 하얀 뾰족 이빨들!
    for (let t = 0; t < 4; t++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), whiteMat);
      tooth.rotation.z = Math.PI;
      tooth.position.set(0.22 + t * 0.22, 2.06, 0.32);
      const toothR = tooth.clone();
      toothR.position.z = -0.32;
      g.add(tooth, toothR);
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), darkMat);
      eye.position.set(0.55, 2.55, side * 0.40);
      g.add(eye);
    }
    // 등줄기 지느러미 4개 & 꼬리
    for (let s = 0; s < 4; s++) {
      const spk = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 8), spikeMat);
      spk.rotation.z = Math.PI / 2 - 0.25;
      spk.position.set(-0.62 - s * 0.12, 2.25 - s * 0.38, 0);
      g.add(spk);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.40, 1.45, 12), dinoMat);
    tail.rotation.z = Math.PI / 2 + 0.18;
    tail.position.set(-0.98, 0.82, 0);
    g.add(body, bellyPatch, flyer, head, jaw, tail);
  } else if (def.id === 'serving_robot') {
    const botBodyMat = new THREE.MeshPhysicalMaterial({ color: '#f8fafc', roughness: 0.18, metalness: 0.15, clearcoat: 0.9 });
    const trayMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.35, metalness: 0.4 });

    const chassis = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.76, 0.45, 24), trayMat);
    chassis.position.y = 0.24;
    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 1.65, 12), botBodyMat);
    pillarL.position.set(-0.46, 1.15, -0.18);
    const pillarR = pillarL.clone();
    pillarR.position.x = 0.46;
    const backSpine = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.65, 0.18), botBodyMat);
    backSpine.position.set(0, 1.15, -0.32);

    // 2단 서빙 트레이 & 빨간 해물짬뽕 그릇!
    for (const ty of [0.95, 1.52]) {
      const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 22), trayMat);
      tray.position.set(0, ty, 0.08);
      g.add(tray);
    }
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.28, 0.32, 18),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.25 })
    );
    bowl.position.set(0, 1.70, 0.12);
    const soup = new THREE.Mesh(new THREE.CircleGeometry(0.43, 18), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    soup.rotation.x = -Math.PI / 2;
    soup.position.set(0, 1.87, 0.12);
    g.add(chassis, pillarL, pillarR, backSpine, bowl, soup);

    // 상단 고양이 귀 모니터 헤드 (로봇 LCD 스크린 그래픽)
    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.62, 0.56), botBodyMat);
    headBox.position.set(0, 2.22, 0);
    const lcdTex = makeCanvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      for (const cx of [78, 178]) {
        ctx.beginPath();
        ctx.arc(cx, 68, 24, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    });
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.44), new THREE.MeshBasicMaterial({ map: lcdTex }));
    lcd.position.set(0, 2.22, 0.29);
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.28, 4), new THREE.MeshStandardMaterial({ color: '#38bdf8' }));
      ear.position.set(side * 0.32, 2.65, 0);
      g.add(ear);
    }
    g.add(headBox, lcd);
  } else if (def.id === 'ufo_beam') {
    const chromeMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.85, roughness: 0.15 });
    const saucerTop = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.95, 0.34, 28), chromeMat);
    saucerTop.position.y = 3.62;
    const saucerBot = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 0.95, 0.24, 28), chromeMat);
    saucerBot.position.y = 3.34;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 20, 14, 0, TAU, 0, Math.PI * 0.55),
      new THREE.MeshPhysicalMaterial({ color: '#67e8f9', roughness: 0.08, transmission: 0.55, transparent: true, opacity: 0.82 })
    );
    dome.position.y = 3.66;
    const alienSilhouette = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), new THREE.MeshStandardMaterial({ color: '#4ade80' }));
    alienSilhouette.position.y = 3.92;

    const lampCols = ['#fde047', '#f43f5e', '#38bdf8', '#a855f7'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), new THREE.MeshBasicMaterial({ color: lampCols[i % 4] }));
      bulb.position.set(Math.cos(a) * 1.78, 3.48, Math.sin(a) * 1.78);
      g.add(bulb);
    }

    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.75, 3.4, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.34, side: THREE.DoubleSide })
    );
    beam.position.y = 1.68;
    for (const ry of [0.9, 1.8, 2.6]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.75 * (1 - ry / 4.2), 0.045, 8, 24),
        new THREE.MeshBasicMaterial({ color: '#bef264' })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ry;
      g.add(ring);
    }
    g.add(saucerTop, saucerBot, dome, alienSilhouette, beam);
  } else if (def.id === 'cool_alpaca') {
    const woolMat = new THREE.MeshStandardMaterial({ color: '#fef9c3', roughness: 0.88 });
    const faceWoolMat = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.65 });
    const goldChainMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.85, roughness: 0.18 });

    // 복슬복슬 구름 같은 목·머리 양털 덩어리 조형!
    for (let k = 0; k < 4; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.62 - k * 0.03, 14, 12), woolMat);
      puff.position.set((k % 2 === 0 ? 0.06 : -0.06), 0.65 + k * 0.45, 0);
      g.add(puff);
    }
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 8, 20), goldChainMat);
    chain.rotation.x = Math.PI / 2 + 0.15;
    chain.position.y = 1.35;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.66, 16, 14), woolMat);
    head.position.y = 2.48;
    const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.22, 8, 12), faceWoolMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 2.34, 0.48);
    // 정수리 구름 앞머리 뽕 3덩이 & 쫑긋 귀 2개
    for (const ox of [-0.26, 0, 0.26]) {
      const topFluff = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), woolMat);
      topFluff.position.set(ox, 2.98 + (ox === 0 ? 0.08 : 0), 0.12);
      g.add(topFluff);
    }
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.52, 10), woolMat);
      ear.position.set(side * 0.42, 3.16, -0.05);
      ear.rotation.z = -side * 0.22;
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.30, 0.12), darkMat);
      lens.position.set(side * 0.28, 2.56, 0.60);
      g.add(ear, lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.10), goldChainMat);
    bridge.position.set(0, 2.62, 0.62);
    g.add(chain, head, snout, bridge);
  } else if (def.id === 'golden_dolphin') {
    const goldMat = new THREE.MeshPhysicalMaterial({ color: '#fbbf24', metalness: 0.85, roughness: 0.14, clearcoat: 1.0 });
    const bellyGold = new THREE.MeshStandardMaterial({ color: '#fef08a', metalness: 0.55, roughness: 0.25 });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 1.65, 14, 18), goldMat);
    body.rotation.z = Math.PI / 2 - 0.22;
    body.position.y = 2.35;
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.35, 10, 14), bellyGold);
    belly.rotation.z = Math.PI / 2 - 0.22;
    belly.position.set(0.06, 2.22, 0);

    const beak = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.42, 8, 12), goldMat);
    beak.rotation.z = Math.PI / 2 - 0.28;
    beak.position.set(1.12, 2.52, 0);

    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.72, 10), goldMat);
    dorsal.rotation.z = 0.35;
    dorsal.position.set(-0.08, 2.92, 0);

    for (const side of [-1, 1]) {
      const pectoral = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.62, 8), goldMat);
      pectoral.position.set(0.32, 2.02, side * 0.46);
      pectoral.rotation.x = side * 0.95;
      const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.68, 8), goldMat);
      fluke.position.set(-1.22, 2.02, side * 0.32);
      fluke.rotation.x = side * 1.15;
      fluke.rotation.z = 0.45;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), darkMat);
      eye.position.set(0.76, 2.56, side * 0.36);
      g.add(pectoral, fluke, eye);
    }
    g.add(body, belly, beak, dorsal);
  } else {
    // disco_snowman: 3단 눈사람 + 빨간 털목도리 + 나뭇가지 팔 + 당근 코 + 리본 실크해트 + 선글라스!
    const scarfMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.65 });
    const twigMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.8 });

    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.80, 20, 16), whiteMat);
    b1.scale.set(1.05, 0.92, 1.05);
    b1.position.y = 0.74;
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.60, 18, 14), whiteMat);
    b2.scale.set(1.04, 0.94, 1.04);
    b2.position.y = 1.72;
    const b3 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 14), whiteMat);
    b3.position.y = 2.52;

    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 10, 20), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 2.16;
    const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.08), scarfMat);
    scarfTail.position.set(0.26, 1.88, 0.44);
    scarfTail.rotation.z = -0.15;

    for (let k = 0; k < 3; k++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), darkMat);
      btn.position.set(0, 1.42 + k * 0.25, 0.58 - Math.abs(k - 1) * 0.05);
      g.add(btn);
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.88, 8), twigMat);
      arm.position.set(side * 0.86, 1.92, 0);
      arm.rotation.z = -side * 0.92;
      g.add(arm);
    }

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.52, 10), orangeMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 2.48, 0.56);
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.14), new THREE.MeshStandardMaterial({ color: '#ec4899', metalness: 0.7, roughness: 0.15 }));
    shades.position.set(0, 2.60, 0.43);

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.07, 20), darkMat);
    hatBrim.position.y = 2.90;
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.36, 0.52, 18), darkMat);
    hatTop.position.y = 3.18;
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.10, 18), scarfMat);
    hatBand.position.y = 2.98;

    g.add(b1, b2, b3, scarf, scarfTail, nose, shades, hatBrim, hatTop, hatBand);
  }

  if (def.speech) {
    const sp = createSpeechSprite(def.speech);
    sp.position.set(0, 3.65, 0.2);
    g.add(sp);
  }

  g.traverse(o => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

// ─── 전체 게임 상태 ───
const STATE = {
  phase: 'menu',
  stageIdx: 0,
  totalPay: 0,
  totalShotsSuccess: 0,
  totalAccSum: 0,
  highestStageReached: 1,

  venueSpots: [],
  missions: [],
  missionIdx: 0,
  capturedGallery: [],
  stagePayEarned: 0,
  stageAccSum: 0,
  hearts: 3,
  timeLeft: 65,

  // 3D 구도 조작 상태 (드래그 궤도 dragU, dragV + 배율 zoom + 사선 기울기 tilt)
  currentZoom: 1,      // 0.5 | 1 | 2
  currentTilt: 0,      // -1 | 0 | 1
  smoothRoll: 0,
  dragU: 0,            // 좌우 카메라 궤도·여백 축 (-1.35 ~ +1.35)
  dragV: 0,            // 상하 로우앵글↔하이앵글 축 (-1.35 ~ +1.35)
  dragging: false,
  pointerId: null,
  lastClientX: 0,
  lastClientY: 0,

  posePhase: 0,
  poseAmount: 0,
  currentMatchPct: 0,
  recentPeakMatch: 0,
  recentPeakTimer: 0,
  isBlockedByChaos: false,
  blockingChaosLabel: '',
  prevReadyLock: false,

  activeChaos: [],
  chaosTimer: 1.5,
  recentChaosIds: [],
  devPopupTimer: 0,
  incomingRef: null,
  lastFinalRun: null,
  lastShareData: null,
};

function getResponsiveCamBaseDist() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const portraitScale = aspect < 0.85 ? clamp(0.85 / Math.max(0.42, aspect), 1.0, 1.65) : 1.0;
  return 11.2 * portraitScale;
}

// ─── 다이내믹 3D 카메라 구도 계산 & 적용 (궤도 측면 회전 + 로우/하이앵글 + 삼분할 여백 + 발끝 포커스 + 사선 틸트!) ───
function applyDynamicCamera({
  spot, comp, uVal, vVal, zoomVal, tiltVal, swaySec = 0, stageLv = 1, instant = false,
}) {
  const fov = zoomVal === 0.5 ? 58 : zoomVal === 2 ? 25 : 40;
  if (instant || Math.abs(camera.fov - fov) > 0.05) {
    camera.fov = instant ? fov : lerp(camera.fov, fov, 0.35);
    camera.updateProjectionMatrix();
  }

  const baseDist = getResponsiveCamBaseDist();
  // 하이앵글·로우앵글일 때 거리를 살짝 당겨 구도 입체감을 드라마틱하게 강조!
  const dist = baseDist * (1 - Math.abs(vVal) * 0.18);

  // uVal: 좌우 궤도 방위각(±50°) + 삼분할 여백 시선 이동을 결합!
  const isThirds = comp && (comp.id === 'wide_thirds_l' || comp.id === 'wide_thirds_r');
  const orbitYaw = spot.rotY + (isThirds ? uVal * 0.22 : uVal * 0.88);
  const lookSideShift = isThirds ? uVal * 2.85 : uVal * 0.45;

  // vVal: 음수면 바닥 위 0.38m에서 하늘을 올려다보는 극적 로우앵글, 양수면 9.2m 위에서 내려다보는 MZ 항공 하이앵글!
  const camHeight = vVal >= 0
    ? lerp(2.35, 9.2, clamp(vVal / 1.15, 0, 1.15))
    : lerp(2.35, 0.38, clamp(-vVal / 1.10, 0, 1.0));
  const baseLookY = (comp && comp.focusFeet) ? 0.72 : 1.95;
  const lookHeight = vVal >= 0
    ? baseLookY - vVal * 0.45
    : baseLookY + (-vVal) * 0.95;

  const swayAmp = (swaySec > 0 && stageLv > 2) ? Math.min(0.15, 0.025 + stageLv * 0.012) : 0;
  const sx = swaySec > 0 ? Math.sin(swaySec * 1.9) * swayAmp : 0;
  const sy = swaySec > 0 ? Math.cos(swaySec * 2.4) * (swayAmp * 0.6) : 0;

  const cx = spot.x + Math.sin(orbitYaw) * dist + sx;
  const cz = spot.z + Math.cos(orbitYaw) * dist;

  camera.up.set(0, 1, 0);
  camera.position.set(cx, camHeight + sy, cz);
  camera.lookAt(
    spot.x + Math.cos(orbitYaw) * lookSideShift + sx * 0.5,
    lookHeight + sy * 0.5,
    spot.z - Math.sin(orbitYaw) * lookSideShift
  );

  // 사선(더치 앵글) 카메라 롤 회전 적용!
  const targetRoll = tiltVal * (15.5 * DEG);
  if (instant) {
    STATE.smoothRoll = targetRoll;
  } else {
    STATE.smoothRoll = lerp(STATE.smoothRoll, targetRoll, 0.28);
  }
  camera.rotateZ(STATE.smoothRoll);
}

// ─── 이번 스테이지 미션(서로 다른 스팟 + 서로 다른 구도 + 서로 다른 포즈!) 즉석 촬영 생성기 ───
const snapThumbCanvas = document.createElement('canvas');
snapThumbCanvas.width = 360;
snapThumbCanvas.height = 270;
const snapThumbCtx = snapThumbCanvas.getContext('2d');

function captureCurrentCanvasAsDataURL(quality = 0.85) {
  renderer.render(scene, camera);
  const sw = glCanvas.width;
  const sh = glCanvas.height;
  const targetAspect = 4 / 3;
  let cw = sw;
  let ch = Math.round(sw / targetAspect);
  if (ch > sh) {
    ch = sh;
    cw = Math.round(sh * targetAspect);
  }
  const sx = Math.floor((sw - cw) * 0.5);
  const sy = Math.floor((sh - ch) * 0.48);
  snapThumbCtx.drawImage(glCanvas, sx, sy, cw, ch, 0, 0, snapThumbCanvas.width, snapThumbCanvas.height);
  return snapThumbCanvas.toDataURL('image/jpeg', quality);
}

function moveCoupleToSpot(spot) {
  coupleRoot.position.set(spot.x, 0, spot.z);
  coupleRoot.rotation.y = spot.rotY;
}

function generateRandomMissionsForStage(cfg, spots) {
  const availComps = shuffleTrue(COMPOSITION_PRESETS.filter(c => c.minStage <= cfg.stage));
  const shuffledPoses = shuffleTrue(POSE_POOL);
  const shuffledSpotOrder = shuffleTrue([0, 1, 2, 0, 1, 2, 0, 1, 2, 0]);
  const missions = [];

  for (let i = 0; i < cfg.shotsReq; i++) {
    const comp = availComps[i % availComps.length];
    const pose = shuffledPoses[i % shuffledPoses.length];
    const spot = spots[shuffledSpotOrder[i % shuffledSpotOrder.length] % spots.length];

    missions.push({
      idx: i + 1,
      spot,
      comp,
      poseId: pose.id,
      poseLabel: pose.label,
      cycleSpeed: pose.cycleSpeed * (1 + (cfg.stage - 1) * 0.055),
      zoom: comp.zoom,
      tilt: comp.tilt,
      targetU: comp.targetU,
      targetV: comp.targetV,
      refDataUrl: '',
    });
  }

  // 각 미션의 실제 포토존 스팟과 목표 3D 구도에서 방해물 없이 진짜 예시 사진 캡처!
  for (const m of missions) {
    moveCoupleToSpot(m.spot);
    applyCouplePose(m.poseId, 1.0);
    applyDynamicCamera({
      spot: m.spot,
      comp: m.comp,
      uVal: m.targetU,
      vVal: m.targetV,
      zoomVal: m.zoom,
      tiltVal: m.tilt,
      instant: true,
    });
    m.refDataUrl = captureCurrentCanvasAsDataURL(0.84);
  }

  // 첫 미션 스팟으로 복귀
  moveCoupleToSpot(missions[0].spot);
  applyCouplePose(missions[0].poseId, 0);
  STATE.smoothRoll = 0;

  return missions;
}

// ─── 100% 리얼 랜덤 돌발 상황 스포너 (현재 커플이 서 있는 스팟 앞으로 정확히 난입!) ───
const RECENT_CHAOS_STORAGE = 'fgs.snap.recentChaosIds';

function loadSessionRecentChaos() {
  try {
    const arr = JSON.parse(sessionStorage.getItem(RECENT_CHAOS_STORAGE) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveSessionRecentChaos(arr) {
  try {
    sessionStorage.setItem(RECENT_CHAOS_STORAGE, JSON.stringify(arr.slice(-5)));
  } catch {}
}

function clearActiveChaos() {
  for (const c of STATE.activeChaos) scene.remove(c.mesh);
  STATE.activeChaos = [];
}

function spawnRandomChaosEvent(cfg) {
  const m = STATE.missions[STATE.missionIdx];
  if (!m) return;

  const eligible = CHAOS_CATALOG.filter(c => c.tier <= cfg.chaosMaxTier);
  const history = [...loadSessionRecentChaos(), ...STATE.recentChaosIds];
  const recentTail = history.slice(-4);
  const freshPool = eligible.filter(c => !recentTail.includes(c.id));
  const pickedDef = randPick(freshPool.length > 0 ? freshPool : eligible);

  STATE.recentChaosIds.push(pickedDef.id);
  if (STATE.recentChaosIds.length > 5) STATE.recentChaosIds.shift();
  saveSessionRecentChaos([...history, pickedDef.id]);

  const mesh = buildChaosMesh(pickedDef);

  let pattern = 'cross';
  if (pickedDef.id === 'duck_closeup' || pickedDef.id === 'cool_alpaca' || pickedDef.id === 'sprinkler') {
    pattern = randPick(['pop_bottom', 'cross']);
  } else if (pickedDef.id === 'ufo_beam' || pickedDef.id === 'heart_balloons' || pickedDef.id === 'seagull_dive' || pickedDef.id === 'golden_dolphin') {
    pattern = randPick(['fly_arc', 'hover_top', 'cross']);
  } else {
    pattern = randPick(['cross', 'hesitate_cross']);
  }

  const dir = trueRand() < 0.5 ? 1 : -1;
  const frontDist = pattern === 'pop_bottom' ? randRange(3.2, 4.4) : randRange(1.5, 2.8);
  const dur = clamp(randRange(2.3, 3.5) - cfg.stage * 0.05, 1.55, 3.5);

  scene.add(mesh);
  SFX.quackChaos(randRange(0.85, 1.25));

  STATE.activeChaos.push({
    def: pickedDef,
    mesh,
    spot: m.spot,
    pattern,
    dir,
    frontDist,
    age: 0,
    dur,
    bobSeed: randRange(0, 10),
  });
}

function updateActiveChaos(dt, nowSec) {
  STATE.isBlockedByChaos = false;
  STATE.blockingChaosLabel = '';

  const curM = STATE.missions[STATE.missionIdx];
  const isThirds = curM && curM.comp && (curM.comp.id === 'wide_thirds_l' || curM.comp.id === 'wide_thirds_r');
  const camYaw = curM ? (curM.spot.rotY + STATE.dragU * (isThirds ? 0.22 : 0.88)) : 0;
  const rightX = Math.cos(camYaw);
  const rightZ = -Math.sin(camYaw);
  const fwdX = Math.sin(camYaw);
  const fwdZ = Math.cos(camYaw);

  for (let i = STATE.activeChaos.length - 1; i >= 0; i--) {
    const c = STATE.activeChaos[i];
    c.age += dt;
    if (c.age >= c.dur) {
      scene.remove(c.mesh);
      STATE.activeChaos.splice(i, 1);
      continue;
    }

    const u = c.age / c.dur;
    let sideOffset = 0;
    let y = 0;

    if (c.pattern === 'pop_bottom') {
      const pop = Math.sin(u * Math.PI);
      sideOffset = Math.sin(u * TAU + c.bobSeed) * 0.85;
      y = lerp(-3.2, 0.25, Math.min(1, pop * 1.35));
    } else if (c.pattern === 'fly_arc') {
      sideOffset = lerp(-6.6 * c.dir, 6.6 * c.dir, u);
      y = 0.5 + Math.sin(u * Math.PI) * 2.2;
    } else if (c.pattern === 'hover_top') {
      sideOffset = lerp(-5.4 * c.dir, 5.4 * c.dir, u);
      y = 0.2 + Math.sin(nowSec * 6 + c.bobSeed) * 0.35;
    } else if (c.pattern === 'hesitate_cross') {
      let prog = u;
      if (u > 0.36 && u < 0.64) prog = 0.36 + (u - 0.36) * 0.22;
      else if (u >= 0.64) prog = 0.4216 + ((u - 0.64) / 0.36) * 0.5784;
      sideOffset = lerp(-6.6 * c.dir, 6.6 * c.dir, prog);
      y = Math.abs(Math.sin(nowSec * 12 + c.bobSeed)) * 0.22;
    } else {
      sideOffset = lerp(-6.6 * c.dir, 6.6 * c.dir, u);
      y = Math.abs(Math.sin(nowSec * 11 + c.bobSeed)) * 0.20;
    }

    const wx = c.spot.x + fwdX * c.frontDist + rightX * sideOffset;
    const wz = c.spot.z + fwdZ * c.frontDist + rightZ * sideOffset;
    c.mesh.position.set(wx, y, wz);
    c.mesh.rotation.y = camYaw + (c.dir < 0 ? 0.2 : -0.2);

    if (Math.abs(sideOffset) < 1.38 && y > -1.15) {
      STATE.isBlockedByChaos = true;
      STATE.blockingChaosLabel = c.def.failLabel;
    }
  }
}

// ─── 스테이지 준비 & 미션 전환 ───
function setupMissionStartCamera(m) {
  moveCoupleToSpot(m.spot);
  // 플레이어가 직접 드래그해서 구도를 맞추는 재미를 위해 초기 카메라를 정면 아이레벨(0, 0) 근처로 세팅!
  // (만약 목표 자체가 (0, 0) 근처라면 살짝 옆에서 시작해 구도를 맞추게 함)
  STATE.dragU = Math.abs(m.targetU) < 0.25 ? (trueRand() < 0.5 ? -0.65 : 0.65) : 0;
  STATE.dragV = Math.abs(m.targetV) < 0.25 ? 0.45 : 0;
  syncOptionButtons();
}

function prepareStage(stageIndex) {
  STATE.stageIdx = stageIndex;
  STATE.highestStageReached = Math.max(STATE.highestStageReached, stageIndex + 1);
  const cfg = STAGE_CONFIGS[stageIndex];

  clearActiveChaos();
  STATE.venueSpots = buildVenueScene(cfg.venue);
  buildCoupleForStage(cfg);

  STATE.missions = generateRandomMissionsForStage(cfg, STATE.venueSpots);
  STATE.missionIdx = 0;
  STATE.capturedGallery = [];
  STATE.stagePayEarned = 0;
  STATE.stageAccSum = 0;
  STATE.hearts = 3;
  STATE.timeLeft = cfg.timeLimit;
  STATE.currentZoom = 1;
  STATE.currentTilt = 0;
  STATE.posePhase = 0;
  STATE.chaosTimer = randRange(1.4, 2.4);

  $('brief-badge').textContent = `STAGE ${cfg.stage} / 10 · ${cfg.venueName}`;
  $('brief-couple').textContent = `💑 ${cfg.coupleName}`;
  $('brief-quote').textContent = cfg.quote;

  const grid = $('brief-grid');
  grid.innerHTML = STATE.missions.map(m => {
    const tiltTxt = m.tilt < 0 ? ' · ↖사선' : m.tilt > 0 ? ' · ↗사선' : '';
    return `
      <div class="brief-item">
        <img src="${m.refDataUrl}" alt="${m.poseLabel}">
        <div class="brief-item-txt">
          #${m.idx} ${m.comp.name.replace('📐 ', '')}<br>
          <span style="color:#0369a1">${m.spot.name}</span><br>
          <span style="color:#d97706">(${m.zoom}x${tiltTxt})</span>
        </div>
      </div>
    `;
  }).join('');

  STATE.phase = 'brief';
  $('start-modal').classList.add('hidden');
  $('stage-clear-modal').classList.add('hidden');
  $('result-modal').classList.add('hidden');
  $('cam-hud').classList.add('hidden');
  $('vf-overlay').classList.add('hidden');
  $('cam-dock').classList.add('hidden');
  $('brief-modal').classList.remove('hidden');
}

function loadCurrentMissionCard() {
  const m = STATE.missions[STATE.missionIdx];
  if (!m) return;
  const tiltTxt = m.tilt < 0 ? ' · ↖사선' : m.tilt > 0 ? ' · ↗사선' : '';
  $('ref-num').textContent = `#${m.idx}/${STATE.missions.length}`;
  $('ref-zoom').textContent = `${m.zoom}x${tiltTxt}`;
  $('ref-img').src = m.refDataUrl;
  if ($('ref-comp')) {
    $('ref-comp').textContent = `${m.comp.name} · ${m.spot.name}`;
  }
  $('ref-cap').textContent = m.poseLabel;
  clearActiveChaos();
  STATE.recentPeakMatch = 0;
  STATE.recentPeakTimer = 0;
  STATE.chaosTimer = Math.max(STATE.chaosTimer, 1.35);
  setupMissionStartCamera(m);
}

function beginStageShooting() {
  unlockAudio();
  STATE.phase = 'play';
  STATE.posePhase = 0;
  loadCurrentMissionCard();

  $('brief-modal').classList.add('hidden');
  $('cam-hud').classList.remove('hidden');
  $('vf-overlay').classList.remove('hidden');
  $('cam-dock').classList.remove('hidden');
  updateHUD();

  if (!IS_REC && !BGM.isMuted()) {
    BGM.start('snap');
  }
}

// ─── 배율(`0.5x/1x/2x`), 사선 기울기(`↖/수평/↗`), 드래그 3D 구도 조작 ───
const zoomBtns = Array.from(document.querySelectorAll('.zoom-btn'));
const tiltBtns = Array.from(document.querySelectorAll('.tilt-btn'));

function syncOptionButtons() {
  const curM = STATE.missions[STATE.missionIdx];
  zoomBtns.forEach(btn => {
    const z = Number(btn.dataset.zoom);
    btn.classList.toggle('active', z === STATE.currentZoom);
    btn.classList.toggle('hint', !!curM && z === curM.zoom && z !== STATE.currentZoom);
  });
  tiltBtns.forEach(btn => {
    const t = Number(btn.dataset.tilt);
    btn.classList.toggle('active', t === STATE.currentTilt);
    btn.classList.toggle('hint', !!curM && t === curM.tilt && t !== STATE.currentTilt);
  });
}

zoomBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    unlockAudio();
    STATE.currentZoom = Number(btn.dataset.zoom);
    SFX.tick();
    syncOptionButtons();
  });
});

tiltBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    unlockAudio();
    STATE.currentTilt = Number(btn.dataset.tilt);
    SFX.tick();
    syncOptionButtons();
  });
});

// 우측 하단 단추: 구도가 너무 헷갈릴 때 목표 앵글 근처로 스냅 보정 도와주기!
$('btn-recenter').innerHTML = '<span>📐</span><span>앵글맞춤</span>';
$('btn-recenter').addEventListener('click', () => {
  const m = STATE.missions[STATE.missionIdx];
  if (!m) return;
  STATE.dragU = lerp(STATE.dragU, m.targetU, 0.94);
  STATE.dragV = lerp(STATE.dragV, m.targetV, 0.94);
  STATE.currentZoom = m.zoom;
  STATE.currentTilt = m.tilt;
  SFX.tick();
  syncOptionButtons();
});

glCanvas.addEventListener('pointerdown', e => {
  unlockAudio();
  if (STATE.phase !== 'play') return;
  STATE.dragging = true;
  STATE.pointerId = e.pointerId;
  STATE.lastClientX = e.clientX;
  STATE.lastClientY = e.clientY;
  try { glCanvas.setPointerCapture(e.pointerId); } catch {}
});

glCanvas.addEventListener('pointermove', e => {
  if (STATE.phase !== 'play') return;
  if (!STATE.dragging && (e.buttons > 0 || e.pointerType === 'touch')) {
    STATE.dragging = true;
    STATE.pointerId = e.pointerId;
    STATE.lastClientX = e.clientX;
    STATE.lastClientY = e.clientY;
    return;
  }
  if (!STATE.dragging || e.pointerId !== STATE.pointerId) return;
  const dx = e.clientX - STATE.lastClientX;
  const dy = e.clientY - STATE.lastClientY;
  STATE.lastClientX = e.clientX;
  STATE.lastClientY = e.clientY;

  // 좌우 드래그 → 카메라 궤도 회전/여백, 상하 드래그 → 로우앵글(아래로) ↔ 하이앵글(위로)!
  STATE.dragU = clamp(STATE.dragU + dx * 0.0068, -1.35, 1.35);
  STATE.dragV = clamp(STATE.dragV - dy * 0.0068, -1.35, 1.35);
});

function endPan(e) {
  if (!STATE.dragging || (e && e.pointerId !== STATE.pointerId)) return;
  STATE.dragging = false;
  STATE.pointerId = null;
}
glCanvas.addEventListener('pointerup', endPan);
glCanvas.addEventListener('pointercancel', endPan);

// ─── 실시간 일치도(%) 산출 (구도 앵글 + 배율 + 기울기 + 포즈 타이밍 + 방해물 여부!) ───
function getAngleError() {
  const m = STATE.missions[STATE.missionIdx];
  if (!m) return 0;
  return Math.hypot(STATE.dragU - m.targetU, STATE.dragV - m.targetV);
}

function evaluateLiveMatch() {
  const cfg = STAGE_CONFIGS[STATE.stageIdx];
  const m = STATE.missions[STATE.missionIdx];
  if (!cfg || !m) return 0;

  if (STATE.isBlockedByChaos) {
    return Math.round(22 + STATE.poseAmount * 16);
  }

  // 1) 3D 카메라 구도(앵글·여백·로우/하이) 점수 (0 ~ 32점)
  const angErr = getAngleError();
  const angleScore = angErr <= 0.20 ? 32 : clamp(32 - (angErr - 0.20) * 34, 0, 32);

  // 2) 커플 포즈 정점 타이밍 점수 (0 ~ 44점)
  const poseScore = Math.pow(STATE.poseAmount, 1.3) * 44;

  // 3) 배율(`0.5x/1x/2x`) 점수 (14점)
  const zoomScore = (STATE.currentZoom === m.zoom) ? 14 : 2;

  // 4) 사선 기울기(`↖/수평/↗`) 점수 (10점)
  const tiltScore = (STATE.currentTilt === m.tilt) ? 10 : 1;

  return clamp(Math.round(angleScore + poseScore + zoomScore + tiltScore), 10, 100);
}

// ─── 2D 뷰파인더 구도 가이드 과녁 링 렌더링 (`drawCompositionGuideOverlay`) ───
function drawCompositionGuideOverlay() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (ovCanvas.width !== Math.floor(w * dpr) || ovCanvas.height !== Math.floor(h * dpr)) {
    ovCanvas.width = Math.floor(w * dpr);
    ovCanvas.height = Math.floor(h * dpr);
  }
  ovCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ovCtx.clearRect(0, 0, w, h);

  if (STATE.phase !== 'play') return;
  const m = STATE.missions[STATE.missionIdx];
  if (!m) return;

  const cx = w * 0.5;
  const cy = h * 0.51;
  const du = m.targetU - STATE.dragU;
  const dv = m.targetV - STATE.dragV;
  const dist = Math.hypot(du, dv);

  if (dist > 0.20) {
    // 목표 앵글 방향을 직관적인 점선 화살표 & 노란 과녁 링으로 표시!
    const tx = cx + clamp(du * 115, -135, 135);
    const ty = cy - clamp(dv * 115, -125, 125);

    ovCtx.save();
    ovCtx.strokeStyle = 'rgba(250, 204, 21, 0.88)';
    ovCtx.lineWidth = 3;
    ovCtx.setLineDash([7, 6]);
    ovCtx.beginPath();
    ovCtx.moveTo(cx, cy);
    ovCtx.lineTo(tx, ty);
    ovCtx.stroke();
    ovCtx.setLineDash([]);

    ovCtx.beginPath();
    ovCtx.arc(tx, ty, 22, 0, TAU);
    ovCtx.fillStyle = 'rgba(250, 204, 21, 0.20)';
    ovCtx.fill();
    ovCtx.stroke();

    ovCtx.font = '900 12px "Pretendard","Apple SD Gothic Neo",sans-serif';
    ovCtx.textAlign = 'center';
    ovCtx.fillStyle = '#fef08a';
    ovCtx.fillText('📐 이쪽으로 드래그!', tx, ty - 28);
    ovCtx.restore();
  }
}

// ─── 📸 셔터 촬영 판정!! ───
function showDevelopedPhotoPopup(dataUrl, label, isGood) {
  const box = $('dev-popup');
  $('dev-img').src = dataUrl;
  $('dev-stamp').textContent = label;
  box.classList.toggle('bad', !isGood);
  box.classList.add('show');
  STATE.devPopupTimer = 0.95;
  $('last-shot-slot').innerHTML = `<img src="${dataUrl}" alt="최근 사진">`;
}

function triggerShutter() {
  if (STATE.phase !== 'play') return;
  unlockAudio();
  SFX.shutterClick();

  const fl = $('shutter-flash');
  fl.classList.add('bang');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => fl.classList.remove('bang'));
  });

  const shotUrl = captureCurrentCanvasAsDataURL(0.85);
  const cfg = STAGE_CONFIGS[STATE.stageIdx];
  const m = STATE.missions[STATE.missionIdx];
  const matchPct = STATE.isBlockedByChaos
    ? STATE.currentMatchPct
    : Math.max(STATE.currentMatchPct, STATE.recentPeakMatch);

  if (STATE.isBlockedByChaos || matchPct < cfg.minMatch) {
    SFX.photoFail();
    STATE.hearts -= 1;

    let failReason = `💦 포즈 타이밍 어긋남! (일치 ${matchPct}%)`;
    if (STATE.isBlockedByChaos) {
      failReason = `${STATE.blockingChaosLabel} (일치 ${matchPct}%)`;
    } else if (STATE.currentZoom !== m.zoom) {
      failReason = `🔍 [${m.zoom}x] 배율로 맞춰 찍으세요!`;
    } else if (STATE.currentTilt !== m.tilt) {
      const tName = m.tilt < 0 ? '↖사선' : m.tilt > 0 ? '↗사선' : '수평';
      failReason = `📐 카메라 기울기를 [${tName}]으로 맞추세요!`;
    } else if (getAngleError() > 0.35) {
      failReason = `📐 드래그해서 [${m.comp.name.replace('📐 ', '')}] 구도를 맞추세요!`;
    }

    showDevelopedPhotoPopup(shotUrl, failReason, false);
    updateHUD();

    if (STATE.hearts <= 0) {
      setTimeout(() => finishCareer(false, '커플 인내심 소진! 구도가 엉뚱한 사진만 찍다가 알바 해고…'), 650);
    }
    return;
  }

  SFX.photoPass();
  const bonusMult = matchPct >= 95 ? 1.35 : matchPct >= 88 ? 1.15 : 1.0;
  const pay = Math.round((cfg.basePay * bonusMult) / 100) * 100;

  STATE.totalPay += pay;
  STATE.stagePayEarned += pay;
  STATE.totalShotsSuccess += 1;
  STATE.totalAccSum += matchPct;
  STATE.stageAccSum += matchPct;

  STATE.capturedGallery.push({
    idx: m.idx,
    compName: m.comp.name.replace('📐 ', ''),
    matchPct,
    dataUrl: shotUrl,
  });

  showDevelopedPhotoPopup(
    shotUrl,
    `✨ #${m.idx} 일치 ${matchPct}% 합격! (+${pay.toLocaleString()}원)`,
    true
  );

  STATE.missionIdx += 1;
  STATE.posePhase = 0;

  if (STATE.missionIdx >= STATE.missions.length) {
    STATE.phase = 'transition';
    if (STATE.stageIdx >= STAGE_CONFIGS.length - 1) {
      SFX.win();
      setTimeout(() => finishCareer(true, '👑 10대 월드 명소 올클리어!! 모든 다채로운 구도와 돌발 소동을 정복했습니다!'), 650);
    } else {
      SFX.win();
      setTimeout(() => openStageClearModal(), 580);
    }
    return;
  }

  loadCurrentMissionCard();
  updateHUD();
}

$('btn-shutter').addEventListener('click', triggerShutter);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && STATE.phase === 'play') {
    e.preventDefault();
    triggerShutter();
  }
});

function openStageClearModal() {
  STATE.phase = 'stageclear';
  clearActiveChaos();
  const cfg = STAGE_CONFIGS[STATE.stageIdx];
  const avg = (STATE.stageAccSum / Math.max(1, STATE.capturedGallery.length)).toFixed(1);
  const nextCfg = STAGE_CONFIGS[STATE.stageIdx + 1];

  $('sc-chip').textContent = `🎉 STAGE ${cfg.stage} 클리어! [${cfg.coupleName}] 대만족!`;
  $('sc-title').textContent = `알바비 +${STATE.stagePayEarned.toLocaleString()}원 입금!`;
  $('sc-sub').textContent = `평균 일치도 ${avg}% · 다음 출장지: STAGE ${nextCfg.stage} [${nextCfg.venueName}] (${nextCfg.shotsReq}장)`;

  $('sc-gallery').innerHTML = STATE.capturedGallery.map(it => `
    <div class="brief-item">
      <img src="${it.dataUrl}" alt="${it.compName}">
      <div class="brief-item-txt">#${it.idx} ${it.compName}<br><span style="color:#16a34a">일치 ${it.matchPct}% ✨</span></div>
    </div>
  `).join('');

  $('cam-hud').classList.add('hidden');
  $('vf-overlay').classList.add('hidden');
  $('cam-dock').classList.add('hidden');
  $('stage-clear-modal').classList.remove('hidden');
}

// ─── HUD 업데이트 ───
function updateHUD() {
  const cfg = STAGE_CONFIGS[STATE.stageIdx];
  if (!cfg) return;

  $('hud-stage-title').textContent = `STAGE ${cfg.stage}/10 · ${cfg.venueName}`;
  $('hud-pay').textContent = `💰 ${STATE.totalPay.toLocaleString()}원`;
  $('hud-shot-progress').textContent = `📸 사진 ${Math.min(cfg.shotsReq, STATE.missionIdx + 1)} / ${cfg.shotsReq}`;
  $('hud-hearts').textContent = '❤️'.repeat(Math.max(0, STATE.hearts)) + '🖤'.repeat(Math.max(0, 3 - STATE.hearts));

  const sec = Math.ceil(Math.max(0, STATE.timeLeft));
  const timerEl = $('hud-timer');
  timerEl.textContent = `⏱ ${sec}초`;
  timerEl.classList.toggle('urgent', sec <= 10);

  const m = STATE.missions[STATE.missionIdx];
  const angErr = getAngleError();
  const ready = !STATE.isBlockedByChaos && STATE.currentMatchPct >= cfg.minMatch;

  const mp = $('match-pill');
  const af = $('af-reticle');
  const afLbl = $('af-label');
  const refCard = $('ref-card');
  const shBtn = $('btn-shutter');

  refCard.classList.toggle('ready', ready);
  shBtn.classList.toggle('ready-glow', ready);

  if (STATE.isBlockedByChaos) {
    mp.textContent = `⚠️ 방해물 난입! (${STATE.currentMatchPct}%)`;
    mp.className = 'match-pill bomb';
    af.className = 'af-reticle blocked';
    afLbl.textContent = '⚠️ 찍으면 방해물 찍힘!';
  } else if (m && STATE.currentZoom !== m.zoom) {
    mp.textContent = `🔍 [${m.zoom}x] 배율 선택 필요`;
    mp.className = 'match-pill';
    af.className = 'af-reticle';
    afLbl.textContent = `아래 [${m.zoom}x] 단추를 누르세요`;
  } else if (m && STATE.currentTilt !== m.tilt) {
    const tName = m.tilt < 0 ? '↖사선' : m.tilt > 0 ? '↗사선' : '수평';
    mp.textContent = `📐 [${tName}] 기울기 선택 필요`;
    mp.className = 'match-pill';
    af.className = 'af-reticle';
    afLbl.textContent = `아래 [${tName}] 단추를 누르세요`;
  } else if (angErr > 0.25) {
    mp.textContent = `📐 드래그해 구도 맞추기 (${STATE.currentMatchPct}%)`;
    mp.className = 'match-pill';
    af.className = 'af-reticle';
    afLbl.textContent = '노란 과녁 쪽으로 화면 드래그!';
  } else if (ready) {
    mp.textContent = `✨ 일치 ${STATE.currentMatchPct}% · 지금 찰칵!!`;
    mp.className = 'match-pill good';
    af.className = 'af-reticle locked';
    afLbl.textContent = `삑! ${STATE.currentMatchPct}% 구도·포즈 완벽!`;
  } else {
    mp.textContent = `일치도 ${STATE.currentMatchPct}% (목표 ${cfg.minMatch}%+)`;
    mp.className = 'match-pill';
    af.className = 'af-reticle';
    afLbl.textContent = '구도 OK! 포즈 정점 대기!';
  }

  $('pose-fill').style.width = `${Math.round(STATE.poseAmount * 100)}%`;
}

// ─── 최종 종료 & 랭킹 ───
function computeSnapRankTitle(clearedAll, stageReached, totalPay) {
  if (clearedAll) return '👑 전설의 10대 명소 마스터 스냅 신(神)';
  if (stageReached >= 7 || totalPay >= 350000) return '📸 구도 천재 월드투어 스냅 사진가';
  if (stageReached >= 4 || totalPay >= 140000) return '🦆 돌발 소동 돌파 숙련 알바생';
  return '🐣 수평 맞추기 연습생 수습 알바';
}

function formatLadderMetric(row) {
  const pay = Math.round(Number(row.score || 0)).toLocaleString();
  const st = Math.round(Number(row.actual_value || 1));
  return `${pay}원 · STAGE ${st}`;
}

async function finishCareer(clearedAll, summaryComment) {
  if (STATE.phase === 'gameover') return;
  STATE.phase = 'gameover';
  BGM.setUrgent(false);
  clearActiveChaos();
  if (!clearedAll) SFX.fail();

  const stageReached = clearedAll ? 10 : (STATE.stageIdx + 1);
  const avgAcc = STATE.totalShotsSuccess > 0
    ? Number((STATE.totalAccSum / STATE.totalShotsSuccess).toFixed(1))
    : 0;
  const rankTitle = computeSnapRankTitle(clearedAll, stageReached, STATE.totalPay);

  const prevBestSt = Number(localStorage.getItem(BEST_STAGE_KEY) || '0');
  if (stageReached > prevBestSt) {
    localStorage.setItem(BEST_STAGE_KEY, String(stageReached));
  }

  const isBest = updateBestRecord(GAME_ID, {
    score: STATE.totalPay,
    actualValue: stageReached,
    targetValue: STATE.totalShotsSuccess,
    rankTitle,
  }, false);

  syncBestBadges();

  $('cam-hud').classList.add('hidden');
  $('vf-overlay').classList.add('hidden');
  $('cam-dock').classList.add('hidden');
  $('brief-modal').classList.add('hidden');
  $('stage-clear-modal').classList.add('hidden');

  $('res-rank').textContent = isBest ? `${rankTitle} · 신기록!` : rankTitle;
  $('res-headline').textContent = `${STATE.totalPay.toLocaleString()}원`;
  $('res-comment').textContent = summaryComment;
  $('res-stage').textContent = clearedAll ? '10 / 10 완주!' : `${stageReached} / 10`;
  $('res-shots').textContent = `${STATE.totalShotsSuccess}장`;
  $('res-acc').textContent = `${avgAcc.toFixed(1)}%`;

  $('res-nick').value = getSavedNickname();

  STATE.lastFinalRun = {
    gameId: GAME_ID,
    nickname: $('res-nick').value || '익명 스냅작가',
    targetValue: STATE.totalShotsSuccess,
    actualValue: stageReached,
    score: STATE.totalPay,
    errorMm: null,
    rankTitle,
    seed: 1,
    meta: { clearedAll, stageReached, shots: STATE.totalShotsSuccess, avgAcc },
  };

  $('result-modal').classList.remove('hidden');

  if (!IS_REC) {
    try {
      const saved = await saveResultAndBuildShare(STATE.lastFinalRun, STATE.incomingRef);
      STATE.lastShareData = saved;
      const lbWrap = $('res-lb-wrap');
      lbWrap.innerHTML = renderGlobalLadderHTML(saved, formatLadderMetric);
      lbWrap.style.display = 'block';
    } catch {}
  }
}

function startNewCareer() {
  unlockAudio();
  STATE.totalPay = 0;
  STATE.totalShotsSuccess = 0;
  STATE.totalAccSum = 0;
  STATE.highestStageReached = 1;
  STATE.recentChaosIds = [];
  prepareStage(0);
}

// ─── 배경 명소 애니메이션 업데이트 (대관람차·회전목마·풍차·열기구·벚꽃·눈송이·불꽃놀이!) ───
function updateVenueAnimations(dt, nowSec) {
  if (envAnimState.ferrisWheel) {
    const wz = nowSec * 0.25;
    envAnimState.ferrisWheel.rotation.z = wz;
    for (const ch of envAnimState.ferrisWheel.children) {
      if (ch.userData && ch.userData.isCabin) ch.rotation.z = -wz;
    }
  }
  if (envAnimState.carousel) {
    envAnimState.carousel.rotation.y = nowSec * 0.65;
  }
  if (envAnimState.windmillBlades) {
    envAnimState.windmillBlades.rotation.z = -nowSec * 0.85;
  }
  for (const hb of envAnimState.balloons) {
    hb.mesh.position.y = hb.baseY + Math.sin(nowSec * 1.2 + hb.phase) * 0.65;
  }

  if (envAnimState.particleKind === 'petal' || envAnimState.particleKind === 'snow') {
    for (let i = 0; i < envAnimState.ambientParticles.length; i++) {
      const p = envAnimState.ambientParticles[i];
      p.position.y -= dt * (envAnimState.particleKind === 'petal' ? 1.4 : 1.9);
      p.position.x += Math.sin(nowSec * 2 + i) * dt * 0.8;
      p.rotation.z += dt * 2;
      if (p.position.y < 0.1) p.position.y = 8.8;
    }
  } else if (envAnimState.particleKind === 'firework') {
    for (const fw of envAnimState.ambientParticles) {
      const u = (nowSec * 0.65 + fw.userData.phase) % 1;
      const r = easeOutBurst(u) * fw.userData.spd * 2.4;
      fw.position.set(
        fw.userData.cx + Math.cos(fw.userData.ang) * r,
        fw.userData.cy + Math.sin(fw.userData.ang) * r - u * u * 1.5,
        -13.5
      );
      fw.scale.setScalar(Math.max(0.05, 1.2 - u));
    }
  }
}
function easeOutBurst(t) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 2.4);
}

// ─── 메인 루프 ───
let lastTime = performance.now();

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
  lastTime = now;
  const nowSec = now * 0.001;

  if (STATE.devPopupTimer > 0) {
    STATE.devPopupTimer -= dt;
    if (STATE.devPopupTimer <= 0) $('dev-popup').classList.remove('show');
  }

  updateVenueAnimations(dt, nowSec);
  const cfg = STAGE_CONFIGS[STATE.stageIdx] || STAGE_CONFIGS[0];

  if (STATE.phase === 'menu' || STATE.phase === 'brief' || STATE.phase === 'stageclear') {
    const previewWave = 0.5 + 0.5 * Math.sin(nowSec * 2.0);
    applyCouplePose('hand_hold', previewWave);
    const spot0 = STATE.venueSpots[0] || { x: 0, z: 0, rotY: 0 };
    moveCoupleToSpot(spot0);
    applyDynamicCamera({
      spot: spot0,
      comp: COMPOSITION_PRESETS[0],
      uVal: Math.sin(nowSec * 0.45) * 0.65,
      vVal: -0.25 + Math.cos(nowSec * 0.35) * 0.35,
      zoomVal: 0.5,
      tiltVal: 0,
    });
  } else if (STATE.phase === 'play') {
    STATE.timeLeft = Math.max(0, STATE.timeLeft - dt);
    if (STATE.timeLeft <= 0) {
      finishCareer(false, `⏰ 시간 초과! STAGE ${cfg.stage} 촬영 마감 시간을 넘겼어요!`);
      return;
    }

    const m = STATE.missions[STATE.missionIdx];
    if (m) {
      STATE.posePhase += dt * m.cycleSpeed;
      const rawWave = 0.5 - 0.5 * Math.cos(STATE.posePhase);
      STATE.poseAmount = clamp(Math.pow(rawWave, 0.78) * 1.08, 0, 1);
      applyCouplePose(m.poseId, STATE.poseAmount);

      applyDynamicCamera({
        spot: m.spot,
        comp: m.comp,
        uVal: STATE.dragU,
        vVal: STATE.dragV,
        zoomVal: STATE.currentZoom,
        tiltVal: STATE.currentTilt,
        swaySec: nowSec,
        stageLv: cfg.stage,
      });
    }

    STATE.chaosTimer -= dt;
    if (STATE.chaosTimer <= 0) {
      if (STATE.activeChaos.length < cfg.maxConcurrentChaos) {
        spawnRandomChaosEvent(cfg);
      }
      STATE.chaosTimer = randRange(cfg.chaosInterval[0], cfg.chaosInterval[1]);
    }

    updateActiveChaos(dt, nowSec);
    STATE.currentMatchPct = evaluateLiveMatch();
    if (!STATE.isBlockedByChaos) {
      if (STATE.currentMatchPct >= STATE.recentPeakMatch) {
        STATE.recentPeakMatch = STATE.currentMatchPct;
        STATE.recentPeakTimer = 0.28;
      } else {
        STATE.recentPeakTimer -= dt;
        if (STATE.recentPeakTimer <= 0) STATE.recentPeakMatch = STATE.currentMatchPct;
      }
    } else {
      STATE.recentPeakMatch = 0;
      STATE.recentPeakTimer = 0;
    }

    const readyNow = !STATE.isBlockedByChaos && STATE.currentMatchPct >= cfg.minMatch;
    if (readyNow && !STATE.prevReadyLock) SFX.focusBeep();
    STATE.prevReadyLock = readyNow;

    BGM.setUrgent(STATE.timeLeft <= 10 || cfg.stage >= 7);
    updateHUD();
  }

  renderer.render(scene, camera);
  drawCompositionGuideOverlay();

  const curM = STATE.missions[STATE.missionIdx];
  window.__snapDebug = {
    phase: STATE.phase,
    stage: cfg.stage,
    venue: cfg.venue,
    missionIdx: STATE.missionIdx,
    missionsTotal: STATE.missions.length,
    missionSummary: STATE.missions.map(x => `${x.spot.name}:${x.comp.id}:${x.poseId}`),
    currentZoom: STATE.currentZoom,
    targetZoom: curM ? curM.zoom : 1,
    currentTilt: STATE.currentTilt,
    targetTilt: curM ? curM.tilt : 0,
    dragU: Number(STATE.dragU.toFixed(2)),
    dragV: Number(STATE.dragV.toFixed(2)),
    targetU: curM ? curM.targetU : 0,
    targetV: curM ? curM.targetV : 0,
    matchPct: STATE.currentMatchPct,
    minMatch: cfg.minMatch,
    blocked: STATE.isBlockedByChaos,
    activeChaosIds: STATE.activeChaos.map(c => `${c.def.id}:${c.pattern}`),
    hearts: STATE.hearts,
    totalPay: STATE.totalPay,
  };
}
window.__snapJumpStage = idx => {
  prepareStage(clamp(idx, 0, STAGE_CONFIGS.length - 1));
  beginStageShooting();
};

// ─── UI 버튼 및 공유·랭킹 바인딩 ───
function syncBgmBtn() {
  const btn = $('btn-bgm');
  const muted = BGM.isMuted();
  btn.textContent = muted ? '🔇 BGM' : '🔊 BGM';
  btn.classList.toggle('bgm-off', muted);
}

function syncBestBadges() {
  const best = getBestRecord(GAME_ID);
  const bestSt = Number(localStorage.getItem(BEST_STAGE_KEY) || '0');
  if (best && best.score != null) {
    const pStr = `${Math.round(Number(best.score)).toLocaleString()}원`;
    $('best-pill').textContent = `🏆 최고 ${pStr}`;
    $('start-best').textContent = pStr;
  }
  $('start-best-stage').textContent = `${bestSt} / 10`;
}

$('btn-bgm').addEventListener('click', () => {
  unlockAudio();
  const muted = BGM.toggleMute();
  if (!muted && STATE.phase === 'play') BGM.start('snap');
  syncBgmBtn();
});

$('btn-start').addEventListener('click', () => startNewCareer());
$('btn-begin-stage').addEventListener('click', () => beginStageShooting());
$('btn-next-stage').addEventListener('click', () => prepareStage(STATE.stageIdx + 1));
$('btn-retry').addEventListener('click', () => startNewCareer());

$('res-nick').addEventListener('change', async () => {
  const nick = saveNickname($('res-nick').value);
  if (STATE.lastFinalRun) {
    STATE.lastFinalRun.nickname = nick;
    try {
      const saved = await saveResultAndBuildShare(STATE.lastFinalRun, STATE.incomingRef);
      STATE.lastShareData = saved;
      $('res-lb-wrap').innerHTML = renderGlobalLadderHTML(saved, formatLadderMetric);
    } catch {}
  }
});

$('btn-share').addEventListener('click', async () => {
  if (!STATE.lastFinalRun) return;
  STATE.lastFinalRun.nickname = saveNickname($('res-nick').value || '익명 스냅작가');
  let shareUrl = location.href;
  try {
    const saved = await saveResultAndBuildShare(STATE.lastFinalRun, STATE.incomingRef);
    STATE.lastShareData = saved;
    shareUrl = saved.shareUrl;
    $('res-lb-wrap').innerHTML = renderGlobalLadderHTML(saved, formatLadderMetric);
    $('res-lb-wrap').style.display = 'block';
  } catch {}

  await shareChallengeLink({
    title: '📸 웨딩·여행 스냅 알바 — 이게뭔겜? 404 아케이드',
    text: `📸 [${STATE.lastFinalRun.nickname}]님의 10대 명소 스냅 알바 수입: ${STATE.totalPay.toLocaleString()}원 (STAGE ${STATE.lastFinalRun.actualValue}/10 · 인생샷 ${STATE.totalShotsSuccess}장)! 다양한 구도와 랜덤 소동 이길 수 있나요?`,
    url: shareUrl,
  });
});

$('btn-save-img').addEventListener('click', () => {
  if (!STATE.lastFinalRun) return;
  downloadResultCard({
    gameTitle: '웨딩·여행 스냅 알바 — 10대 명소',
    rankTitle: STATE.lastFinalRun.rankTitle,
    headline: `${STATE.totalPay.toLocaleString()}원 정산`,
    subline: `도달 STAGE ${STATE.lastFinalRun.actualValue}/10 · 인생샷 ${STATE.totalShotsSuccess}장`,
    nickname: $('res-nick').value || '익명 스냅작가',
    shareUrl: (STATE.lastShareData && STATE.lastShareData.shareUrl) || location.href,
  });
});

(async function init() {
  STATE.venueSpots = buildVenueScene('lake_wedding');
  buildCoupleForStage(STAGE_CONFIGS[0]);
  syncBgmBtn();
  syncBestBadges();
  requestAnimationFrame(tick);

  if (IS_REC) return;
  try {
    const inc = await loadIncomingChallenge(GAME_ID);
    if (inc) {
      STATE.incomingRef = inc;
      const who = inc.nickname || '지인';
      const payStr = `${Math.round(Number(inc.score || 0)).toLocaleString()}원`;
      $('rival-banner-text').textContent = `🔥 ${who}님의 알바 수입: ${payStr}`;
      $('rival-banner').style.display = 'flex';
      $('cam-hud').classList.add('with-rival');

      const box = $('start-rival-box');
      box.innerHTML = `<div style="font-size:13px;font-weight:900;color:#fde047">⚔️ ${who} 작가님의 도전장!</div>
        <div style="font-size:12px;color:#e9e3f8;margin-top:3px">목표 알바 수입: <b>${payStr}</b> 돌파에 도전하세요!</div>`;
      box.style.display = 'block';
    }
  } catch {}
})();
