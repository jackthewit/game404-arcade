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

function buildVenueScene(venueKey) {
  clearGroup(venueGroup);
  envAnimState.ferrisWheel = null;
  envAnimState.carousel = null;
  envAnimState.windmillBlades = null;
  envAnimState.balloons = [];
  envAnimState.ambientParticles = [];
  envAnimState.particleKind = 'none';

  // 각 씬마다 3개의 서로 다른 포토존 스팟 반환!
  let spots = [
    { name: '중앙 메인 스팟', x: 0, z: 0, rotY: 0 },
    { name: '왼쪽 서브 스팟', x: -4.8, z: -1.0, rotY: 0.22 },
    { name: '오른쪽 서브 스팟', x: 4.8, z: -1.0, rotY: -0.22 },
  ];

  const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.25, metalness: 0.65 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.7 });

  if (venueKey === 'lake_wedding') {
    scene.background = new THREE.Color('#7dd3fc');
    scene.fog = new THREE.Fog('#bae6fd', 42, 105);
    sunLight.color.set('#fffbeb');
    sunLight.intensity = 2.0;

    const grass = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 32), new THREE.MeshStandardMaterial({ color: '#65a30d', roughness: 0.85 }));
    grass.position.set(0, -0.5, 3);
    grass.receiveShadow = true;
    const lake = new THREE.Mesh(new THREE.BoxGeometry(100, 0.8, 52), new THREE.MeshPhysicalMaterial({ color: '#0ea5e9', roughness: 0.14, clearcoat: 0.85 }));
    lake.position.set(0, -0.62, -33);
    const aisle = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.08, 22), new THREE.MeshStandardMaterial({ color: '#fffbeb', roughness: 0.5 }));
    aisle.position.set(0, 0.04, 2);
    venueGroup.add(grass, lake, aisle);

    // [스팟 1: 중앙 장미 웨딩 아치]
    const archRing = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.22, 12, 32, Math.PI), whiteMat);
    archRing.position.set(0, 2.2, -2.0);
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 2.3, 12), whiteMat);
    postL.position.set(-3.3, 1.15, -2.0);
    const postR = postL.clone(); postR.position.x = 3.3;
    venueGroup.add(archRing, postL, postR);
    const flCols = ['#fb7185', '#f472b6', '#fde047', '#ffffff'];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshStandardMaterial({ color: flCols[i % 4] }));
      fl.position.set(Math.cos(a) * 3.3, 2.2 + Math.sin(a) * 3.3, -1.9);
      venueGroup.add(fl);
    }

    // [스팟 2: 왼쪽 민트 클래식 오픈 웨딩카 + 풍선!]
    const carGrp = new THREE.Group();
    carGrp.position.set(-6.2, 0, -2.8);
    carGrp.rotation.y = 0.35;
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 2.1), new THREE.MeshStandardMaterial({ color: '#5eead4', roughness: 0.25, metalness: 0.2 }));
    carBody.position.y = 0.85;
    carBody.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.75, 1.9), new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', transmission: 0.6, transparent: true, opacity: 0.8 }));
    windshield.position.set(0.6, 1.65, 0);
    windshield.rotation.z = -0.25;
    carGrp.add(carBody, windshield);
    for (const [wx, wz] of [[-1.3, -1.05], [1.3, -1.05], [-1.3, 1.05], [1.3, 1.05]]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 14), darkMat);
      wh.rotation.x = Math.PI / 2;
      wh.position.set(wx, 0.48, wz);
      carGrp.add(wh);
    }
    venueGroup.add(carGrp);

    // [스팟 3: 오른쪽 호수 원목 선착장 & 하얀 백조 보트 + 3단 웨딩케이크!]
    const pier = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 10), woodMat);
    pier.position.set(6.0, 0.08, -4.5);
    const swanBody = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 12), whiteMat);
    swanBody.scale.set(1.3, 0.75, 0.9);
    swanBody.position.set(7.2, 0.4, -12.0);
    const swanNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.0, 10), whiteMat);
    swanNeck.position.set(6.1, 1.6, -12.0);
    venueGroup.add(pier, swanBody, swanNeck);

    spots = [
      { name: '장미 아치 꽃길', x: 0, z: 0, rotY: 0 },
      { name: '민트 웨딩 오픈카 옆', x: -4.6, z: -0.6, rotY: 0.25 },
      { name: '호수 백조 선착장', x: 5.2, z: -1.0, rotY: -0.22 },
    ];
  } else if (venueKey === 'euro_cafe') {
    scene.background = new THREE.Color('#93c5fd');
    scene.fog = new THREE.Fog('#dbeafe', 42, 105);
    sunLight.color.set('#fff7ed');
    sunLight.intensity = 1.95;

    const cobble = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#d6d3d1', roughness: 0.78 }));
    cobble.position.set(0, -0.5, -4);
    cobble.receiveShadow = true;
    venueGroup.add(cobble);

    // [스팟 1: 중앙 3단 유럽 대리석 분수대]
    const marbleMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3 });
    const waterMat = new THREE.MeshPhysicalMaterial({ color: '#38bdf8', roughness: 0.1, clearcoat: 1 });
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.65, 24), marbleMat);
    pool.position.set(0, 0.32, -4.2);
    const poolW = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, 0.68, 24), waterMat);
    poolW.position.set(0, 0.33, -4.2);
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.45, 20), marbleMat);
    tier2.position.set(0, 1.8, -4.2);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 3.2, 14), marbleMat);
    pillar.position.set(0, 1.6, -4.2);
    venueGroup.add(pool, poolW, tier2, pillar);

    // [스팟 2: 왼쪽 빨간 차양 노천카페 건물 & 야외 테이블]
    const cafeWall = new THREE.Mesh(new THREE.BoxGeometry(7.5, 8.5, 4.0), new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.65 }));
    cafeWall.position.set(-6.8, 4.25, -5.5);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.8, 2.4), new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.5 }));
    awning.rotation.x = 0.32;
    awning.position.set(-6.8, 3.6, -2.8);
    const cafeTbl = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 16), whiteMat);
    cafeTbl.position.set(-5.8, 1.1, -1.8);
    const cafeLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 1.1, 10), darkMat);
    cafeLeg.position.set(-5.8, 0.55, -1.8);
    venueGroup.add(cafeWall, awning, cafeTbl, cafeLeg);

    // [스팟 3: 오른쪽 유럽 시계탑 & 클래식 가로등]
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 11.5, 3.4), new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.6 }));
    tower.position.set(6.8, 5.75, -6.2);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.2, 4), new THREE.MeshStandardMaterial({ color: '#1e3a8a' }));
    roof.rotation.y = Math.PI / 4;
    roof.position.set(6.8, 13.1, -6.2);
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(1.05, 20), whiteMat);
    clockFace.position.set(6.8, 8.8, -4.45);
    const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 4.8, 10), darkMat);
    lampPost.position.set(3.8, 2.4, -2.5);
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshBasicMaterial({ color: '#fef08a' }));
    lampBulb.position.set(3.8, 4.9, -2.5);
    venueGroup.add(tower, roof, clockFace, lampPost, lampBulb);

    spots = [
      { name: '대리석 분수 광장', x: 0, z: 0, rotY: 0 },
      { name: '빨간 차양 노천카페 앞', x: -4.2, z: -0.2, rotY: 0.28 },
      { name: '유럽 시계탑 가로등 거리', x: 4.5, z: -0.5, rotY: -0.25 },
    ];
  } else if (venueKey === 'emerald_beach') {
    scene.background = new THREE.Color('#38bdf8');
    scene.fog = new THREE.Fog('#7dd3fc', 42, 105);
    sunLight.color.set('#fff9db');
    sunLight.intensity = 2.1;

    const sand = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 28), new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.82 }));
    sand.position.set(0, -0.5, 4);
    sand.receiveShadow = true;
    const sea = new THREE.Mesh(new THREE.BoxGeometry(100, 0.9, 52), new THREE.MeshPhysicalMaterial({ color: '#06b6d4', roughness: 0.12, clearcoat: 1.0 }));
    sea.position.set(0, -0.58, -32);
    const foam = new THREE.Mesh(new THREE.BoxGeometry(96, 0.12, 1.5), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
    foam.position.set(0, 0.02, -6.5);
    venueGroup.add(sand, sea, foam);

    // [스팟 2: 왼쪽 제주 무지개 해안 방호벽!]
    const rainbowCols = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6'];
    for (let i = 0; i < 6; i++) {
      const blk = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 0.85), new THREE.MeshStandardMaterial({ color: rainbowCols[i], roughness: 0.45 }));
      blk.position.set(-8.8 + i * 1.45, 0.48, -3.6);
      blk.castShadow = true;
      venueGroup.add(blk);
    }

    // [스팟 1 & 3: 야자수 + 서핑보드 3개 & 비치 파라솔!]
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.45 });
    for (const px of [-2.8, 7.6]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 5.8, 10), woodMat);
      trunk.position.set(px, 2.9, -3.5);
      trunk.rotation.z = px < 0 ? -0.12 : 0.14;
      venueGroup.add(trunk);
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU;
        const lf = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 6), palmLeafMat);
        lf.scale.set(1.85, 0.18, 0.55);
        lf.rotation.y = ang;
        lf.rotation.z = 0.35;
        lf.position.set(px + Math.cos(ang) * 1.25, 5.7, -3.5 + Math.sin(ang) * 1.25);
        venueGroup.add(lf);
      }
    }
    const surfCols = ['#fb7185', '#38bdf8', '#facc15'];
    for (let i = 0; i < 3; i++) {
      const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 2.6, 8, 12), new THREE.MeshStandardMaterial({ color: surfCols[i], roughness: 0.25 }));
      sb.scale.set(1, 1, 0.22);
      sb.position.set(4.5 + i * 1.05, 1.7, -3.0);
      sb.rotation.z = -0.12 + i * 0.08;
      venueGroup.add(sb);
    }

    spots = [
      { name: '에메랄드 파도 해변 중앙', x: 0.4, z: 0, rotY: 0 },
      { name: '제주 무지개 방호벽 포토존', x: -5.0, z: -0.8, rotY: 0.20 },
      { name: '서핑보드 & 야자수 비치', x: 5.0, z: -0.6, rotY: -0.24 },
    ];
  } else if (venueKey === 'amusement_park') {
    scene.background = new THREE.Color('#a5b4fc');
    scene.fog = new THREE.Fog('#e0e7ff', 42, 105);
    sunLight.color.set('#fff1f2');
    sunLight.intensity = 1.95;

    const plaza = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#fce7f3', roughness: 0.72 }));
    plaza.position.set(0, -0.5, -4);
    plaza.receiveShadow = true;
    venueGroup.add(plaza);

    // [스팟 1: 실제로 회전하는 대형 파스텔 대관람차!]
    const wheelCenterY = 8.4;
    const wheelZ = -9.5;
    const legA = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 9.8, 10), whiteMat);
    legA.position.set(-2.2, 4.4, wheelZ);
    legA.rotation.z = -0.22;
    const legB = legA.clone();
    legB.position.x = 2.2;
    legB.rotation.z = 0.22;
    venueGroup.add(legA, legB);

    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, wheelCenterY, wheelZ);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.18, 12, 36), new THREE.MeshStandardMaterial({ color: '#f472b6' }));
    wheelGroup.add(rim);
    const cabinCols = ['#38bdf8', '#facc15', '#fb7185', '#4ade80', '#c084fc', '#fb923c'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6.2, 6), whiteMat);
      spoke.rotation.z = a - Math.PI / 2;
      spoke.position.set(Math.cos(a) * 3.1, Math.sin(a) * 3.1, 0);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.95), new THREE.MeshStandardMaterial({ color: cabinCols[i % 6] }));
      cabin.position.set(Math.cos(a) * 6.2, Math.sin(a) * 6.2, 0.3);
      wheelGroup.add(spoke, cabin);
    }
    venueGroup.add(wheelGroup);
    envAnimState.ferrisWheel = wheelGroup;

    // [스팟 2: 왼쪽 회전목마 파빌리온]
    const carouselGrp = new THREE.Group();
    carouselGrp.position.set(-6.4, 0, -4.2);
    const cBase = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.0, 0.4, 20), goldMat);
    cBase.position.y = 0.2;
    const cRoof = new THREE.Mesh(new THREE.ConeGeometry(3.1, 2.2, 16), new THREE.MeshStandardMaterial({ color: '#fb7185' }));
    cRoof.position.y = 4.5;
    const cPole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.6, 12), goldMat);
    cPole.position.y = 2.1;
    carouselGrp.add(cBase, cRoof, cPole);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), goldMat);
      pole.position.set(Math.cos(a) * 2.0, 2.0, Math.sin(a) * 2.0);
      const horse = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.4), whiteMat);
      horse.position.set(Math.cos(a) * 2.0, 1.5, Math.sin(a) * 2.0);
      carouselGrp.add(pole, horse);
    }
    venueGroup.add(carouselGrp);
    envAnimState.carousel = carouselGrp;

    // [스팟 3: 오른쪽 풍선 아치 & 솜사탕 왜건]
    const booth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.0), new THREE.MeshStandardMaterial({ color: '#38bdf8' }));
    booth.position.set(6.4, 1.2, -3.8);
    const boothTop = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), new THREE.MeshStandardMaterial({ color: '#fde047' }));
    boothTop.rotation.y = Math.PI / 4;
    boothTop.position.set(6.4, 3.1, -3.8);
    venueGroup.add(booth, boothTop);

    spots = [
      { name: '대관람차 정면 광장', x: 0, z: 0, rotY: 0 },
      { name: '황금 회전목마 앞', x: -4.8, z: -0.6, rotY: 0.24 },
      { name: '유원지 퍼레이드 부스 옆', x: 4.8, z: -0.6, rotY: -0.24 },
    ];
  } else if (venueKey === 'sunset_cliff') {
    scene.background = new THREE.Color('#fb923c');
    scene.fog = new THREE.Fog('#f97316', 40, 100);
    sunLight.color.set('#fed7aa');
    sunLight.intensity = 1.9;

    const deck = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 26), woodMat);
    deck.position.set(0, -0.5, 4);
    deck.receiveShadow = true;
    const sunsetSea = new THREE.Mesh(new THREE.BoxGeometry(100, 0.9, 52), new THREE.MeshPhysicalMaterial({ color: '#c2410c', roughness: 0.18, clearcoat: 0.9 }));
    sunsetSea.position.set(0, -1.2, -32);
    const bigSun = new THREE.Mesh(new THREE.CircleGeometry(6.8, 32), new THREE.MeshBasicMaterial({ color: '#fef08a' }));
    bigSun.position.set(0, 5.5, -36);
    venueGroup.add(deck, sunsetSea, bigSun);

    const topBar = new THREE.Mesh(new THREE.BoxGeometry(26, 0.22, 0.22), whiteMat);
    topBar.position.set(0, 1.35, -3.4);
    venueGroup.add(topBar);
    for (let x = -12; x <= 12; x += 2.4) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), whiteMat);
      post.position.set(x, 0.7, -3.4);
      venueGroup.add(post);
    }

    // [스팟 2: 왼쪽 빨간 감성 공중전화 부스!]
    const booth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.8, 1.8), new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.35 }));
    booth.position.set(-6.2, 1.9, -2.2);
    const boothWin = new THREE.Mesh(new THREE.BoxGeometry(1.86, 2.2, 1.3), new THREE.MeshBasicMaterial({ color: '#fef08a' }));
    boothWin.position.set(-6.2, 2.1, -2.2);
    venueGroup.add(booth, boothWin);

    // [스팟 3: 오른쪽 빨간 지붕 하얀 등대!]
    const lhBody = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.4, 7.2, 16), whiteMat);
    lhBody.position.set(6.8, 3.6, -5.8);
    const lhRoof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.7, 16), new THREE.MeshStandardMaterial({ color: '#dc2626' }));
    lhRoof.position.set(6.8, 7.9, -5.8);
    venueGroup.add(lhBody, lhRoof);

    spots = [
      { name: '황금 석양 전망 난간', x: 0, z: 0, rotY: 0 },
      { name: '빨간 감성 전화부스 옆', x: -4.4, z: -0.4, rotY: 0.26 },
      { name: '절벽 하얀 등대 아래', x: 4.8, z: -0.8, rotY: -0.26 },
    ];
  } else if (venueKey === 'ginkgo_avenue') {
    scene.background = new THREE.Color('#bae6fd');
    scene.fog = new THREE.Fog('#fed7aa', 40, 100);
    sunLight.color.set('#fef08a');
    sunLight.intensity = 2.0;

    const road = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.82 }));
    road.position.set(0, -0.5, -4);
    road.receiveShadow = true;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.08, 28), new THREE.MeshStandardMaterial({ color: '#fef08a', roughness: 0.7 }));
    lane.position.set(0, 0.04, 1);
    venueGroup.add(road, lane);

    // 노란 황금 은행나무 가로수 4그루
    const ginkgoMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.5 });
    for (const [tx, tz] of [[-4.2, -3.5], [4.2, -3.5], [-8.2, -6.5], [8.2, -6.5]]) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.52, 4.4, 10), woodMat);
      tr.position.set(tx, 2.2, tz);
      const cr1 = new THREE.Mesh(new THREE.SphereGeometry(2.0, 12, 10), ginkgoMat);
      cr1.position.set(tx, 5.0, tz);
      const cr2 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), ginkgoMat);
      cr2.position.set(tx + 0.8, 6.2, tz);
      venueGroup.add(tr, cr1, cr2);
    }

    // [스팟 2: 왼쪽 버터옐로 빈티지 캠핑카!]
    const van = new THREE.Group();
    van.position.set(-6.5, 0, -2.6);
    van.rotation.y = 0.32;
    const vBot = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.4, 2.2), new THREE.MeshStandardMaterial({ color: '#f59e0b' }));
    vBot.position.y = 1.05;
    const vTop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 2.1), whiteMat);
    vTop.position.y = 2.3;
    van.add(vBot, vTop);
    venueGroup.add(van);

    // 하늘에 둥실둥실 떠 있는 대형 열기구 4개!
    const hbCols = ['#ef4444', '#38bdf8', '#a855f7', '#22c55e'];
    for (let i = 0; i < 4; i++) {
      const hb = new THREE.Group();
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(1.75, 16, 14), new THREE.MeshStandardMaterial({ color: hbCols[i] }));
      balloon.scale.set(1, 1.22, 1);
      const basket = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), woodMat);
      basket.position.y = -2.4;
      hb.add(balloon, basket);
      hb.position.set(-9 + i * 6.2, 8.2 + (i % 2) * 2.2, -16 - (i % 2) * 4);
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
    scene.fog = new THREE.Fog('#fce7f3', 40, 100);
    sunLight.color.set('#fff5f7');
    sunLight.intensity = 1.95;

    const garden = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#bbf7d0', roughness: 0.8 }));
    garden.position.set(0, -0.5, -4);
    garden.receiveShadow = true;
    const pond = new THREE.Mesh(new THREE.CircleGeometry(6.5, 28), new THREE.MeshPhysicalMaterial({ color: '#38bdf8', roughness: 0.12, clearcoat: 1 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(-5.2, 0.03, -6.2);
    venueGroup.add(garden, pond);

    // 벚꽃 나무들
    const pinkMat = new THREE.MeshStandardMaterial({ color: '#f9a8d4', roughness: 0.5 });
    for (const [tx, tz] of [[-2.5, -3.2], [2.8, -3.5], [7.8, -4.5]]) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4.0, 10), woodMat);
      tr.position.set(tx, 2.0, tz);
      for (const [ox, oy, r] of [[0, 4.4, 1.85], [-1.2, 3.9, 1.35], [1.2, 4.0, 1.4]]) {
        const cr = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), pinkMat);
        cr.position.set(tx + ox, oy, tz);
        venueGroup.add(cr);
      }
      venueGroup.add(tr);
    }

    // [스팟 2: 왼쪽 붉은 홍예교 아치 다리]
    const redWood = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.45 });
    const bridgeArch = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.45, 10, 24, Math.PI), redWood);
    bridgeArch.position.set(-5.2, -0.8, -4.2);
    venueGroup.add(bridgeArch);

    // [스팟 3: 오른쪽 기와 정자]
    const pavRoof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.8, 6), new THREE.MeshStandardMaterial({ color: '#1e293b' }));
    pavRoof.position.set(5.8, 4.6, -4.5);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 3.8, 8), redWood);
      col.position.set(5.8 + Math.cos(a) * 2.1, 1.9, -4.5 + Math.sin(a) * 2.1);
      venueGroup.add(col);
    }
    venueGroup.add(pavRoof);

    // 흩날리는 벚꽃잎 입자 28개!
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
    scene.fog = new THREE.Fog('#f1f5f9', 38, 95);
    sunLight.color.set('#ffffff');
    sunLight.intensity = 1.85;

    const snowFloor = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6 }));
    snowFloor.position.set(0, -0.5, -4);
    snowFloor.receiveShadow = true;
    venueGroup.add(snowFloor);

    // [스팟 1: 중앙 뾰족 지붕 통나무 스노우 채플]
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 5.2), woodMat);
    cabin.position.set(0, 2.1, -6.5);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 3.8, 4), whiteMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 6.1, -6.5);
    const steeple = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 8), whiteMat);
    steeple.position.set(0, 8.8, -6.5);
    const warmWin = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), new THREE.MeshBasicMaterial({ color: '#fde047' }));
    warmWin.position.set(0, 2.8, -3.86);
    venueGroup.add(cabin, roof, steeple, warmWin);

    // [스팟 2 & 3: 눈 덮인 전나무 크리스마스트리 숲]
    const pineMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.65 });
    for (const [tx, tz, sc] of [[-5.8, -3.8, 1.25], [-7.8, -5.5, 0.95], [5.8, -3.8, 1.15], [7.8, -5.2, 1.0]]) {
      for (let lv = 0; lv < 3; lv++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry((1.8 - lv * 0.4) * sc, 2.2 * sc, 10), pineMat);
        cone.position.set(tx, (1.5 + lv * 1.4) * sc, tz);
        venueGroup.add(cone);
      }
    }

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
    scene.fog = new THREE.Fog('#ede9fe', 40, 100);
    sunLight.color.set('#fef9c3');
    sunLight.intensity = 2.0;

    const field = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 44), new THREE.MeshStandardMaterial({ color: '#8b5cf6', roughness: 0.85 }));
    field.position.set(0, -0.5, -4);
    field.receiveShadow = true;
    venueGroup.add(field);

    // 라벤더 꽃 이랑 줄무늬
    const lavMat = new THREE.MeshStandardMaterial({ color: '#a855f7', roughness: 0.7 });
    for (let x = -12; x <= 12; x += 2.2) {
      if (Math.abs(x) < 1.8) continue;
      const row = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 14, 6, 10), lavMat);
      row.rotation.x = Math.PI / 2;
      row.position.set(x, 0.22, -6);
      venueGroup.add(row);
    }

    // [스팟 1: 돌아가는 대형 네덜란드 풍차!]
    const millBody = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 7.2, 12), new THREE.MeshStandardMaterial({ color: '#fef3c7' }));
    millBody.position.set(0, 3.6, -7.2);
    const millCap = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.8, 12), woodMat);
    millCap.position.set(0, 8.1, -7.2);
    const bladesGrp = new THREE.Group();
    bladesGrp.position.set(0, 6.2, -5.5);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.65, 4.4, 0.12), whiteMat);
      b.rotation.z = (i / 4) * TAU;
      b.position.set(Math.cos((i / 4) * TAU + Math.PI / 2) * 2.2, Math.sin((i / 4) * TAU + Math.PI / 2) * 2.2, 0);
      bladesGrp.add(b);
    }
    venueGroup.add(millBody, millCap, bladesGrp);
    envAnimState.windmillBlades = bladesGrp;

    // [스팟 2: 왼쪽 꽃밭 위 하얀 그랜드 피아노!]
    const piano = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.0), whiteMat);
    piano.position.set(-6.0, 1.2, -2.5);
    for (const [lx, lz] of [[-7.0, -3.3], [-5.0, -3.3], [-6.0, -1.7]]) {
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 1.2, 8), whiteMat);
      pl.position.set(lx, 0.6, lz);
      venueGroup.add(pl);
    }
    venueGroup.add(piano);

    spots = [
      { name: '대형 네덜란드 풍차 언덕', x: 0, z: 0, rotY: 0 },
      { name: '라벤더 밭 하얀 피아노 옆', x: -4.4, z: -0.6, rotY: 0.25 },
      { name: '보랏빛 프로방스 꽃길', x: 4.6, z: -0.6, rotY: -0.25 },
    ];
  } else {
    // starlight_rooftop (별빛 마천루 루프탑 인피니티풀 & 불꽃놀이!)
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.Fog('#1e1b4b', 42, 105);
    sunLight.color.set('#fde68a');
    sunLight.intensity = 1.8;

    const roofFloor = new THREE.Mesh(new THREE.BoxGeometry(96, 1, 28), new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.42, metalness: 0.18 }));
    roofFloor.position.set(0, -0.5, 4);
    roofFloor.receiveShadow = true;
    const infPool = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 6.5), new THREE.MeshPhysicalMaterial({ color: '#0284c7', roughness: 0.06, clearcoat: 1.0 }));
    infPool.position.set(-5.2, 0.05, -4.8);
    venueGroup.add(roofFloor, infPool);

    // 도시 마천루 스카이라인
    const bldgMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
    const winMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
    for (let i = -7; i <= 7; i++) {
      const bh = 7 + ((Math.abs(i * 7) + 3) % 10);
      const bx = i * 3.8;
      const bz = -18 - (Math.abs(i) % 3) * 4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.9, bh, 2.9), bldgMat);
      b.position.set(bx, bh / 2 - 2, bz);
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.9, bh * 0.68, 2.96), winMat);
      w.position.set(bx, bh / 2 - 1.5, bz);
      venueGroup.add(b, w);
    }

    const neonArch = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.16, 12, 32, Math.PI), new THREE.MeshBasicMaterial({ color: '#fde047' }));
    neonArch.position.set(0, 2.2, -2.0);
    venueGroup.add(neonArch);

    // 샴페인 골드 타워 (오른쪽 스팟)
    for (let lv = 0; lv < 4; lv++) {
      const tier = new THREE.Mesh(new THREE.CylinderGeometry(1.2 - lv * 0.25, 1.2 - lv * 0.25, 0.35, 16), goldMat);
      tier.position.set(6.0, 0.8 + lv * 0.42, -2.5);
      venueGroup.add(tier);
    }

    // 밤하늘에 터지는 불꽃놀이 파티클!
    envAnimState.particleKind = 'firework';
    const fwCols = ['#fde047', '#fb7185', '#38bdf8', '#4ade80', '#c084fc'];
    const fwGeo = new THREE.SphereGeometry(0.18, 6, 6);
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

// ─── 커플 3D 캐릭터 생성기 (사람 얼굴 눈·코·입 없음! 감성 뒷모습 & 소품 실루엣!) ───
const coupleRoot = new THREE.Group();
scene.add(coupleRoot);

let groomRig = null;
let brideRig = null;

function buildPersonBackRig({ bodyColor, isSkirt, accentColor, hatType, propType, isRightSide }) {
  const root = new THREE.Group();
  const clothMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.42 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f5cba7', roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: isRightSide ? '#3b2314' : '#1f1610', roughness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.35 });

  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.95, 6, 8), new THREE.MeshStandardMaterial({ color: isSkirt ? '#f5cba7' : '#1e293b' }));
  legL.position.set(-0.28, 0.62, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.set(0.28, 0.62, 0);
  root.add(legL, legR);

  // 귀여운 구두 디테일 (발끝 클로즈업 샷에서 예쁘게 보임!)
  const shoeMat = new THREE.MeshStandardMaterial({ color: isSkirt ? accentColor : '#0f172a', roughness: 0.3 });
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.20, 0.52), shoeMat);
  shoeL.position.set(-0.28, 0.10, -0.06);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.28;
  root.add(shoeL, shoeR);

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 1.15;
  root.add(bodyGroup);

  if (isSkirt) {
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(1.12, 1.75, 20), clothMat);
    skirt.position.y = 0.25;
    skirt.castShadow = true;
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 0.85, 16), clothMat);
    waist.position.y = 1.05;
    waist.castShadow = true;
    bodyGroup.add(skirt, waist);
  } else {
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.48, 1.55, 16), clothMat);
    torso.scale.set(1.15, 1, 0.72);
    torso.position.y = 0.75;
    torso.castShadow = true;
    bodyGroup.add(torso);
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.92, 0);
  const headBack = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 14), hairMat);
  headGroup.add(headBack);

  let veilMesh = null;
  if (isRightSide) {
    if (hatType === 'veil') {
      veilMesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.85, 2.1, 14, 1, true),
        new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.72, side: THREE.DoubleSide })
      );
      veilMesh.position.set(0, -0.65, 0.32);
      veilMesh.rotation.x = 0.22;
      headGroup.add(veilMesh);
    } else if (hatType === 'straw_hat') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.08, 20), new THREE.MeshStandardMaterial({ color: '#fde68a' }));
      brim.position.y = 0.22;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.50, 0.38, 16), new THREE.MeshStandardMaterial({ color: '#fcd34d' }));
      crown.position.y = 0.40;
      headGroup.add(brim, crown);
    } else if (hatType === 'tiara') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.09, 8, 18), accentMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.36;
      headGroup.add(ring);
    } else if (hatType === 'beret' || hatType === 'ribbon') {
      const beret = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), accentMat);
      beret.scale.set(1.1, 0.45, 1.1);
      beret.position.set(0.08, 0.36, 0);
      headGroup.add(beret);
    }
  }
  bodyGroup.add(headGroup);

  const armL = new THREE.Group();
  armL.position.set(-0.62, 1.38, 0);
  const armMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.95, 6, 8), isSkirt ? skinMat : clothMat);
  armMeshL.position.y = -0.45;
  armL.add(armMeshL);

  const armR = new THREE.Group();
  armR.position.set(0.62, 1.38, 0);
  const armMeshR = armMeshL.clone();
  armR.add(armMeshR);

  if (isRightSide) {
    const propHolder = new THREE.Group();
    propHolder.position.set(0, -0.95, 0);
    if (propType === 'balloon') {
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), accentMat);
      balloon.position.y = 1.65;
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      string.position.y = 0.8;
      propHolder.add(balloon, string);
    } else {
      const bouquet = new THREE.Mesh(new THREE.DodecahedronGeometry(0.46, 1), accentMat);
      propHolder.add(bouquet);
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
  if (brideRig.veilMesh) brideRig.veilMesh.rotation.set(0.22, 0, 0);

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
      brideRig.veilMesh.rotation.z = lerp(0, 0.95, a);
      brideRig.veilMesh.rotation.x = lerp(0.22, 0.75, a);
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
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.25 });

  if (def.id === 'duck_walk' || def.id === 'duck_closeup') {
    const sc = def.id === 'duck_closeup' ? 1.55 : 1.15;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.75 * sc, 16, 14), whiteMat);
    body.scale.set(1.2, 0.92, 0.95);
    body.position.y = 0.8 * sc;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.52 * sc, 16, 14), whiteMat);
    head.position.set(0.45 * sc, 1.55 * sc, 0.15 * sc);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.55 * sc, 0.22 * sc, 0.42 * sc), orangeMat);
    beak.position.set(0.85 * sc, 1.50 * sc, 0.32 * sc);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08 * sc, 8, 8), darkMat);
    eyeL.position.set(0.62 * sc, 1.68 * sc, 0.48 * sc);
    g.add(body, head, beak, eyeL);
  } else if (def.id === 'ex_lover') {
    const suit = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 1.75, 14), darkMat);
    suit.position.y = 1.25;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 12), darkMat);
    hair.position.y = 2.35;
    const roses = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 1), new THREE.MeshStandardMaterial({ color: '#e11d48' }));
    roses.position.set(0.55, 2.05, 0.25);
    g.add(suit, hair, roses);
  } else if (def.id === 'heart_balloons') {
    const colors = ['#fb7185', '#f43f5e', '#fde047', '#c084fc'];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.65, 14, 12), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.2 }));
      b.position.set((i - 2) * 0.52, 1.8 + (i % 2) * 0.55, (i % 3 - 1) * 0.25);
      g.add(b);
    }
  } else if (def.id === 'sprinkler') {
    const waterMat = new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.78 });
    for (let i = -3; i <= 3; i++) {
      const jet = new THREE.Mesh(new THREE.ConeGeometry(0.38, 3.6, 10), waterMat);
      jet.position.set(i * 0.45, 1.8, 0);
      jet.rotation.z = -i * 0.18;
      g.add(jet);
    }
  } else if (def.id === 'seagull_dive') {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9, 8, 10), whiteMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 2.6;
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 2.2), whiteMat);
    wingL.position.set(0, 2.75, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 8), orangeMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.75, 2.6, 0);
    g.add(body, wingL, beak);
  } else if (def.id === 'crab_parade') {
    const redMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.35 });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 12), redMat);
    shell.scale.set(1.35, 0.65, 0.95);
    shell.position.y = 0.85;
    const clawL = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 10), redMat);
    clawL.position.set(-1.1, 1.55, 0.3);
    const clawR = clawL.clone();
    clawR.position.x = 1.1;
    g.add(shell, clawL, clawR);
  } else if (def.id === 'hiker_group') {
    const vestColors = ['#f97316', '#84cc16'];
    for (let i = 0; i < 2; i++) {
      const ox = (i - 0.5) * 1.35;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.48, 1.65, 12), new THREE.MeshStandardMaterial({ color: vestColors[i] }));
      body.position.set(ox, 1.15, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.28, 14), new THREE.MeshStandardMaterial({ color: '#fde047' }));
      cap.position.set(ox, 2.22, 0);
      g.add(body, cap);
    }
  } else if (def.id === 'dino_suit') {
    const dinoMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.42 });
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.72, 1.2, 10, 12), dinoMat);
    belly.position.y = 1.45;
    const snout = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 0.78), dinoMat);
    snout.position.set(0.55, 2.35, 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.4, 10), dinoMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-0.95, 0.85, 0);
    g.add(belly, snout, tail);
  } else if (def.id === 'serving_robot') {
    const botMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.25, metalness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 1.85, 16), botMat);
    base.position.y = 0.95;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.65), new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
    screen.position.set(0, 2.05, 0.15);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.35, 14), new THREE.MeshStandardMaterial({ color: '#dc2626' }));
    bowl.position.set(0, 1.65, 0.45);
    g.add(base, screen, bowl);
  } else if (def.id === 'ufo_beam') {
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.85, 0.45, 24), new THREE.MeshStandardMaterial({ color: '#67e8f9', metalness: 0.7, roughness: 0.15 }));
    saucer.position.y = 3.55;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), new THREE.MeshBasicMaterial({ color: '#fde047' }));
    dome.position.y = 3.75;
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.65, 3.6, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: '#4ade80', transparent: true, opacity: 0.38, side: THREE.DoubleSide })
    );
    beam.position.y = 1.75;
    g.add(saucer, dome, beam);
  } else if (def.id === 'cool_alpaca') {
    const woolMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.85 });
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.58, 1.8, 10, 12), woolMat);
    neck.position.y = 1.35;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 12), woolMat);
    head.position.y = 2.45;
    const shades = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.32, 0.45), darkMat);
    shades.position.set(0, 2.52, 0.52);
    g.add(neck, head, shades);
  } else if (def.id === 'golden_dolphin') {
    const goldMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.78, roughness: 0.18 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.7, 10, 14), goldMat);
    body.rotation.z = Math.PI / 2 - 0.25;
    body.position.y = 2.35;
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.75, 6), goldMat);
    fin.position.set(0, 2.95, 0);
    g.add(body, fin);
  } else {
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.82, 16, 14), whiteMat);
    b1.position.y = 0.82;
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 14), whiteMat);
    b2.position.y = 1.95;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 8), orangeMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.98, 0.58);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.55, 14), darkMat);
    hat.position.y = 2.62;
    g.add(b1, b2, nose, hat);
  }

  if (def.speech) {
    const sp = createSpeechSprite(def.speech);
    sp.position.set(0, 3.55, 0.2);
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
  const fov = zoomVal === 0.5 ? 56 : zoomVal === 2 ? 26 : 40;
  if (instant || Math.abs(camera.fov - fov) > 0.05) {
    camera.fov = instant ? fov : lerp(camera.fov, fov, 0.35);
    camera.updateProjectionMatrix();
  }

  const dist = getResponsiveCamBaseDist();
  // uVal: 좌우 궤도 방위각(±42°) + 삼분할 여백 시선 이동을 자연스럽게 결합!
  const isThirds = comp && (comp.id === 'wide_thirds_l' || comp.id === 'wide_thirds_r');
  const orbitYaw = spot.rotY + (isThirds ? uVal * 0.18 : uVal * 0.68);
  const lookSideShift = isThirds ? uVal * 2.35 : uVal * 0.35;

  // vVal: 음수면 바닥 가까이 무릎 꿇은 로우앵글(하늘 올려다봄!), 양수면 위에서 내려다보는 하이앵글!
  const camHeight = clamp(2.45 + vVal * 2.55, 0.55, 5.8);
  const baseLookY = (comp && comp.focusFeet) ? 0.85 : 1.90;
  const lookHeight = baseLookY - vVal * 0.55;

  const swayAmp = (swaySec > 0 && stageLv > 2) ? Math.min(0.16, 0.03 + stageLv * 0.013) : 0;
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
  const targetRoll = tiltVal * (12.5 * DEG);
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
  const camYaw = curM ? (curM.spot.rotY + STATE.dragU * 0.55) : 0;
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

    if (Math.abs(sideOffset) < 1.72 && y > -1.25) {
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
  STATE.dragU = lerp(STATE.dragU, m.targetU, 0.85);
  STATE.dragV = lerp(STATE.dragV, m.targetV, 0.85);
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
  const matchPct = STATE.currentMatchPct;

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
    envAnimState.ferrisWheel.rotation.z = nowSec * 0.25;
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
