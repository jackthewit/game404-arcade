// 웨딩·여행 스냅 알바 — 10스테이지 리얼 랜덤 돌발 소동 3D 스냅 게임 (이게뭔겜? 404 아케이드)
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

// ─── 100% 순수 암호학적 난수 도우미 (재시작할 때마다 매번 완전히 다른 상황 보장!) ───
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
function randInt(min, maxIncl) {
  return Math.floor(min + trueRand() * (maxIncl - min + 1));
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
scene.fog = new THREE.Fog('#87ceeb', 34, 88);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / Math.max(1, window.innerHeight), 0.3, 140);

const hemiLight = new THREE.HemisphereLight('#fffdf7', '#5a6e58', 1.05);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight('#fff6e0', 1.95);
sunLight.position.set(-12, 26, 18);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 4;
sunLight.shadow.camera.far = 75;
sunLight.shadow.camera.left = -18;
sunLight.shadow.camera.right = 18;
sunLight.shadow.camera.top = 18;
sunLight.shadow.camera.bottom = -14;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// 캔버스 텍스처 유틸
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

// 3D 말풍선 스프라이트 생성기 (전 남친·관광객·로봇·UFO 등의 엉뚱한 대사!)
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

    // 아래 꼬리
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

// ─── 10개 스테이지 구성표 (5개 배경 × 각 배경당 서로 다른 2커플!) ───
// 처음엔 정확히 5장 미션에서 시작해 10스테이지(10장, 최고 난이도 & 뇌절 기행 대폭발)까지 진화!
const STAGE_CONFIGS = [
  {
    stage: 1, venue: 'lake_wedding', venueName: '💍 호숫가 가든 결혼식장',
    coupleName: '순백 클래식 신랑·신부',
    quote: '“작가님! 첫 결혼식 스냅이에요! 아래 예시 사진 5장이랑 똑같이 찍어 주세요!”',
    shotsReq: 5, minMatch: 74, timeLimit: 58, basePay: 12000,
    chaosMaxTier: 1, chaosInterval: [2.8, 4.2], maxConcurrentChaos: 1,
    groomColor: '#1e293b', brideColor: '#ffffff', accentColor: '#f472b6', hatType: 'veil', propType: 'bouquet',
  },
  {
    stage: 2, venue: 'lake_wedding', venueName: '💍 호숫가 가든 결혼식장',
    coupleName: '로즈골드 피로연 커플',
    quote: '“방금 앞 커플 찍으셨죠? 저희는 핑크 드레스 컷 5장 부탁드려요! 오리 조심하세요!”',
    shotsReq: 5, minMatch: 77, timeLimit: 55, basePay: 14000,
    chaosMaxTier: 1, chaosInterval: [2.3, 3.6], maxConcurrentChaos: 1,
    groomColor: '#d6c7b2', brideColor: '#fbcfe8', accentColor: '#fb7185', hatType: 'flower_crown', propType: 'balloon',
  },
  {
    stage: 3, venue: 'emerald_beach', venueName: '🏖️ 에메랄드 제주 해변',
    coupleName: '청량 시밀러룩 바캉스 커플',
    quote: '“바다 여행 스냅 6장이에요! 배율(0.5x·1x·2x)도 예시 카드랑 꼭 맞춰 주세요!”',
    shotsReq: 6, minMatch: 79, timeLimit: 60, basePay: 16000,
    chaosMaxTier: 2, chaosInterval: [2.1, 3.3], maxConcurrentChaos: 1,
    groomColor: '#38bdf8', brideColor: '#f0f9ff', accentColor: '#fde047', hatType: 'straw_hat', propType: 'tube',
  },
  {
    stage: 4, venue: 'emerald_beach', venueName: '🏖️ 에메랄드 제주 해변',
    coupleName: '트로피컬 선샤인 서퍼 커플',
    quote: '“해변에 꽃게랑 이상한 공룡 알바가 돌아다녀요! 빈틈 노려서 6장 칼같이 부탁해요!”',
    shotsReq: 6, minMatch: 81, timeLimit: 58, basePay: 18000,
    chaosMaxTier: 2, chaosInterval: [1.8, 2.9], maxConcurrentChaos: 2,
    groomColor: '#f59e0b', brideColor: '#fef08a', accentColor: '#06b6d4', hatType: 'cap', propType: 'bouquet',
  },
  {
    stage: 5, venue: 'sunset_cliff', venueName: '🌅 노을빛 등대 전망대',
    coupleName: '선셋 감성 트렌치 커플',
    quote: '“노을이 지기 전에 7장 찍어야 해요! 관광객들이랑 서빙 로봇이 왜 여기까지 오는지…!”',
    shotsReq: 7, minMatch: 82, timeLimit: 62, basePay: 21000,
    chaosMaxTier: 2, chaosInterval: [1.6, 2.7], maxConcurrentChaos: 2,
    groomColor: '#78350f', brideColor: '#fed7aa', accentColor: '#fb923c', hatType: 'beret', propType: 'camera',
  },
  {
    stage: 6, venue: 'sunset_cliff', venueName: '🌅 노을빛 등대 전망대',
    coupleName: '드라마틱 프로포즈 커플',
    quote: '“오늘 프로포즈 기념 7장이에요! 하늘에 뭔가 이상한 게 떠다녀도 저희만 예쁘게 찍어주세요!”',
    shotsReq: 7, minMatch: 84, timeLimit: 60, basePay: 24000,
    chaosMaxTier: 3, chaosInterval: [1.5, 2.5], maxConcurrentChaos: 2,
    groomColor: '#1e3a8a', brideColor: '#e11d48', accentColor: '#fde047', hatType: 'tiara', propType: 'bouquet',
  },
  {
    stage: 7, venue: 'blossom_garden', venueName: '🌸 벚꽃 만개 고궁 정원',
    coupleName: '파스텔 고운 한복 커플',
    quote: '“벚꽃 정원 스냅 8장이에요! 알파카랑 UFO가 지나가도 당황하지 말고 찍어 주세요!”',
    shotsReq: 8, minMatch: 85, timeLimit: 66, basePay: 28000,
    chaosMaxTier: 3, chaosInterval: [1.35, 2.3], maxConcurrentChaos: 2,
    groomColor: '#818cf8', brideColor: '#f9a8d4', accentColor: '#fef08a', hatType: 'ribbon', propType: 'fan',
  },
  {
    stage: 8, venue: 'blossom_garden', venueName: '🌸 벚꽃 만개 고궁 정원',
    coupleName: '레트로 모던 경성 커플',
    quote: '“정원이 점점 아수라장이 되고 있어요ㅋㅋㅋ 흔들리지 말고 8장 예술로 남겨 주세요!”',
    shotsReq: 8, minMatch: 86, timeLimit: 64, basePay: 32000,
    chaosMaxTier: 3, chaosInterval: [1.2, 2.1], maxConcurrentChaos: 2,
    groomColor: '#4c0519', brideColor: '#fef3c7', accentColor: '#f43f5e', hatType: 'straw_hat', propType: 'parasol',
  },
  {
    stage: 9, venue: 'starlight_rooftop', venueName: '🌃 별빛 루프탑 야경 웨딩',
    coupleName: '스파클링 시티나이트 커플',
    quote: '“루프탑 나이트 웨딩 9장! 사방에서 외계인이랑 돌고래가 날아다녀도 작가님만 믿어요!”',
    shotsReq: 9, minMatch: 87, timeLimit: 68, basePay: 38000,
    chaosMaxTier: 3, chaosInterval: [1.05, 1.9], maxConcurrentChaos: 3,
    groomColor: '#f8fafc', brideColor: '#fbbf24', accentColor: '#38bdf8', hatType: 'veil', propType: 'balloon',
  },
  {
    stage: 10, venue: 'starlight_rooftop', venueName: '🌃 별빛 루프탑 야경 웨딩',
    coupleName: '👑 전설의 VVIP 월드스타 커플',
    quote: '“마지막 10스테이지! 총 10장! 우주 대혼란 속에서 전부 찍어내면 전설의 스냅 작가 등극입니다!!”',
    shotsReq: 10, minMatch: 88, timeLimit: 74, basePay: 50000,
    chaosMaxTier: 3, chaosInterval: [0.92, 1.7], maxConcurrentChaos: 3,
    groomColor: '#581c87', brideColor: '#f3e8ff', accentColor: '#fde047', hatType: 'tiara', propType: 'bouquet',
  },
];

// ─── 8종 커플 감성 스냅 포즈 정의 ───
const POSE_POOL = [
  { id: 'hand_hold', label: '손잡고 다정 뒷모습', cycleSpeed: 1.55 },
  { id: 'jump_high', label: '하나 둘 셋 점프샷!', cycleSpeed: 1.85 },
  { id: 'bouquet_up', label: '소품 번쩍 만세!', cycleSpeed: 1.65 },
  { id: 'big_heart', label: '머리 위 큰 하트!', cycleSpeed: 1.60 },
  { id: 'lean_in', label: '마주 보고 로맨틱 기울기', cycleSpeed: 1.50 },
  { id: 'kick_leg', label: '한쪽 발 톡! 발랄 포즈', cycleSpeed: 1.75 },
  { id: 'veil_wind', label: '바람에 날리는 베일·스카프', cycleSpeed: 1.70 },
  { id: 'wide_free', label: '양팔 활짝 자유 만끽!', cycleSpeed: 1.60 },
];

// ─── 5대 명소 3D 무대 생성기 (`venueGroup`) ───
const venueGroup = new THREE.Group();
scene.add(venueGroup);

function clearGroup(grp) {
  while (grp.children.length > 0) {
    const ch = grp.children[0];
    grp.remove(ch);
  }
}

function buildVenueScene(venueKey) {
  clearGroup(venueGroup);

  if (venueKey === 'lake_wedding') {
    scene.background = new THREE.Color('#7dd3fc');
    scene.fog = new THREE.Fog('#bae6fd', 36, 90);
    hemiLight.color.set('#ffffff');
    hemiLight.groundColor.set('#4d7c0f');
    sunLight.color.set('#fffbeb');
    sunLight.intensity = 2.0;

    // 잔디밭 + 호수 + 하얀 버진로드 꽃길 + 웨딩 장미 아치 + 하객 뒷모습 의자
    const grass = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 26), new THREE.MeshStandardMaterial({ color: '#65a30d', roughness: 0.85 }));
    grass.position.set(0, -0.5, 2);
    grass.receiveShadow = true;
    const lake = new THREE.Mesh(new THREE.BoxGeometry(90, 0.8, 45), new THREE.MeshPhysicalMaterial({ color: '#0ea5e9', roughness: 0.15, clearcoat: 0.8 }));
    lake.position.set(0, -0.6, -31);
    const aisle = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 22), new THREE.MeshStandardMaterial({ color: '#fffbeb', roughness: 0.5 }));
    aisle.position.set(0, 0.04, 2);
    aisle.receiveShadow = true;
    venueGroup.add(grass, lake, aisle);

    // 꽃 아치
    const archMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 });
    const archRing = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.22, 12, 32, Math.PI), archMat);
    archRing.position.set(0, 2.2, -1.8);
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 2.3, 12), archMat);
    postL.position.set(-3.5, 1.15, -1.8);
    const postR = postL.clone();
    postR.position.x = 3.5;
    venueGroup.add(archRing, postL, postR);

    const flowerColors = ['#fb7185', '#f472b6', '#fde047', '#ffffff'];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI;
      const fl = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 10, 8),
        new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length], roughness: 0.45 })
      );
      fl.position.set(Math.cos(a) * 3.5, 2.2 + Math.sin(a) * 3.5, -1.7);
      venueGroup.add(fl);
    }

    // 양옆 하객 의자와 모자 쓴 하객 뒷모습 (얼굴 없음!)
    const chairMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 });
    for (const sx of [-4.6, -6.4, 4.6, 6.4]) {
      for (const sz of [1.2, 3.8]) {
        const ch = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 0.9), chairMat);
        ch.position.set(sx, 0.6, sz);
        ch.castShadow = true;
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 0.35, 14), new THREE.MeshStandardMaterial({ color: sx > 0 ? '#fde68a' : '#fda4af' }));
        hat.position.set(sx, 1.65, sz);
        venueGroup.add(ch, hat);
      }
    }
  } else if (venueKey === 'emerald_beach') {
    scene.background = new THREE.Color('#38bdf8');
    scene.fog = new THREE.Fog('#7dd3fc', 38, 92);
    sunLight.color.set('#fff9db');
    sunLight.intensity = 2.15;

    const sand = new THREE.Mesh(new THREE.BoxGeometry(84, 1, 24), new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.82 }));
    sand.position.set(0, -0.5, 3);
    sand.receiveShadow = true;
    const sea = new THREE.Mesh(new THREE.BoxGeometry(92, 0.9, 48), new THREE.MeshPhysicalMaterial({ color: '#06b6d4', roughness: 0.12, clearcoat: 1.0 }));
    sea.position.set(0, -0.58, -30);
    const foam = new THREE.Mesh(new THREE.BoxGeometry(84, 0.12, 1.4), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
    foam.position.set(0, 0.02, -7.2);
    venueGroup.add(sand, sea, foam);

    // 야자수 2그루 & 비치 파라솔
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.75 });
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.45 });
    for (const px of [-6.2, 6.5]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 5.6, 10), trunkMat);
      trunk.position.set(px, 2.8, -2.5);
      trunk.rotation.z = px < 0 ? -0.12 : 0.12;
      venueGroup.add(trunk);
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU;
        const lf = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), palmLeafMat);
        lf.scale.set(1.8, 0.18, 0.55);
        lf.rotation.y = ang;
        lf.rotation.z = 0.35;
        lf.position.set(px + Math.cos(ang) * 1.2, 5.5, -2.5 + Math.sin(ang) * 1.2);
        venueGroup.add(lf);
      }
    }
  } else if (venueKey === 'sunset_cliff') {
    scene.background = new THREE.Color('#fb923c');
    scene.fog = new THREE.Fog('#f97316', 36, 90);
    sunLight.color.set('#fed7aa');
    sunLight.intensity = 1.9;

    const deck = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 24), new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.65 }));
    deck.position.set(0, -0.5, 3);
    deck.receiveShadow = true;
    const sunsetSea = new THREE.Mesh(new THREE.BoxGeometry(92, 0.9, 50), new THREE.MeshPhysicalMaterial({ color: '#c2410c', roughness: 0.18, clearcoat: 0.9 }));
    sunsetSea.position.set(0, -1.2, -31);

    // 커다란 황금 석양 태양
    const bigSun = new THREE.Mesh(new THREE.CircleGeometry(6.2, 32), new THREE.MeshBasicMaterial({ color: '#fef08a' }));
    bigSun.position.set(0, 5.2, -34);
    venueGroup.add(deck, sunsetSea, bigSun);

    // 하얀 전망대 난간 & 빨간 지붕 등대
    const railMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 });
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(22, 0.22, 0.22), railMat);
    topBar.position.set(0, 1.35, -3.2);
    venueGroup.add(topBar);
    for (let x = -10; x <= 10; x += 2.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.18), railMat);
      post.position.set(x, 0.7, -3.2);
      venueGroup.add(post);
    }
    const lhBody = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.25, 6.2, 16), railMat);
    lhBody.position.set(7.2, 3.1, -8.5);
    const lhRoof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.5, 16), new THREE.MeshStandardMaterial({ color: '#dc2626' }));
    lhRoof.position.set(7.2, 6.8, -8.5);
    venueGroup.add(lhBody, lhRoof);
  } else if (venueKey === 'blossom_garden') {
    scene.background = new THREE.Color('#fbcfe8');
    scene.fog = new THREE.Fog('#fce7f3', 34, 88);
    sunLight.color.set('#fff5f7');
    sunLight.intensity = 1.95;

    const gardenFloor = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 34), new THREE.MeshStandardMaterial({ color: '#bbf7d0', roughness: 0.8 }));
    gardenFloor.position.set(0, -0.5, -2);
    gardenFloor.receiveShadow = true;
    const stonePath = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 24), new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.65 }));
    stonePath.position.set(0, 0.04, 1);
    venueGroup.add(gardenFloor, stonePath);

    // 풍성한 벚꽃 나무 두 그루
    const barkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.8 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: '#f9a8d4', roughness: 0.5 });
    for (const tx of [-5.2, 5.2]) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.55, 4.2, 12), barkMat);
      tr.position.set(tx, 2.1, -2.4);
      venueGroup.add(tr);
      for (const [ox, oy, oz, r] of [[0, 4.6, 0, 1.8], [-1.2, 4.1, 0.5, 1.3], [1.2, 4.2, -0.4, 1.4], [0.5 * (tx < 0 ? 1 : -1), 5.1, 0.3, 1.35]]) {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), pinkMat);
        crown.position.set(tx + ox, oy, -2.4 + oz);
        venueGroup.add(crown);
      }
    }
  } else {
    // starlight_rooftop (별빛 루프탑 야경 웨딩·여행!)
    scene.background = new THREE.Color('#0f172a');
    scene.fog = new THREE.Fog('#1e1b4b', 38, 95);
    sunLight.color.set('#fde68a');
    sunLight.intensity = 1.75;

    const roofFloor = new THREE.Mesh(new THREE.BoxGeometry(80, 1, 24), new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.45, metalness: 0.15 }));
    roofFloor.position.set(0, -0.5, 3);
    roofFloor.receiveShadow = true;
    venueGroup.add(roofFloor);

    // 도시 고층 빌딩 야경 스카이라인
    const bldgMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
    const winMat = new THREE.MeshBasicMaterial({ color: '#fde047' });
    for (let i = -6; i <= 6; i++) {
      const bh = 6 + ((Math.abs(i * 7) + 3) % 9);
      const bx = i * 3.8;
      const bz = -18 - (Math.abs(i) % 3) * 4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.8, bh, 2.8), bldgMat);
      b.position.set(bx, bh / 2 - 2, bz);
      const w = new THREE.Mesh(new THREE.BoxGeometry(1.8, bh * 0.65, 2.86), winMat);
      w.position.set(bx, bh / 2 - 1.5, bz);
      venueGroup.add(b, w);
    }

    // 황금 네온 루프탑 아치
    const goldNeon = new THREE.MeshBasicMaterial({ color: '#fde047' });
    const neonArch = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.14, 10, 32, Math.PI), goldNeon);
    neonArch.position.set(0, 2.2, -1.8);
    venueGroup.add(neonArch);
  }
}

// ─── 커플 3D 캐릭터 생성기 (사람 얼굴 눈·코·입 일절 없음! 감성 뒷모습 & 소품 실루엣!) ───
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

  // 다리 두 짝 (점프·발들기 애니메이션용)
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.95, 6, 8), new THREE.MeshStandardMaterial({ color: isSkirt ? '#f5cba7' : '#1e293b' }));
  legL.position.set(-0.28, 0.62, 0);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.set(0.28, 0.62, 0);
  root.add(legL, legR);

  // 몸통 (수트 자켓 또는 벨라인 드레스/치마)
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

  // 뒷머리만 보이는 헤드 그룹 (눈·코·입 절대 없음!)
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
    } else if (hatType === 'tiara' || hatType === 'flower_crown') {
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

  // 양쪽 팔 피벗 (어깨 기준 회전으로 손잡기·만세·하트·소품 들기 표현!)
  const armL = new THREE.Group();
  armL.position.set(-0.62, 1.38, 0);
  const armMeshL = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.95, 6, 8), isSkirt ? skinMat : clothMat);
  armMeshL.position.y = -0.45;
  armL.add(armMeshL);

  const armR = new THREE.Group();
  armR.position.set(0.62, 1.38, 0);
  const armMeshR = armMeshL.clone();
  armR.add(armMeshR);

  // 소품 (오른쪽 캐릭터 오른손에 부케 / 하트 풍선 / 양산 등 장착!)
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

// ─── 커플 포즈 적용 함수 (`amount`: 0.0 기본 대기 ↔ 1.0 목표 포즈 정점!) ───
function applyCouplePose(poseId, amount) {
  if (!groomRig || !brideRig) return;
  const a = clamp(amount, 0, 1);

  // 기본 초기화
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
  if (brideRig.veilMesh) {
    brideRig.veilMesh.rotation.set(0.22, 0, 0);
  }

  if (poseId === 'hand_hold') {
    groomRig.root.position.x = lerp(-1.15, -0.78, a);
    brideRig.root.position.x = lerp(1.15, 0.78, a);
    groomRig.armR.rotation.z = lerp(-0.15, -0.72, a);
    brideRig.armL.rotation.z = lerp(0.15, 0.72, a);
    brideRig.armR.rotation.z = lerp(-0.25, -0.95, a);
  } else if (poseId === 'jump_high') {
    const jumpY = Math.pow(a, 1.2) * 1.65;
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
    // wide_free
    groomRig.root.position.x = lerp(-0.92, -1.25, a);
    brideRig.root.position.x = lerp(0.92, 1.25, a);
    groomRig.armL.rotation.z = lerp(0.15, 1.65, a);
    groomRig.armR.rotation.z = lerp(-0.18, -1.65, a);
    brideRig.armL.rotation.z = lerp(0.18, 1.65, a);
    brideRig.armR.rotation.z = lerp(-0.25, -1.65, a);
  }
}

// ─── 14종 엉뚱한 돌발 방해물 3D 생성기 (`CHAOS_CATALOG` — 스테이지가 오를수록 뇌절 기행 해금!) ───
const CHAOS_CATALOG = [
  // Tier 1 (일상·야외 귀여운 방해)
  { id: 'duck_walk', tier: 1, failLabel: '🦆 통통한 오리가 찍혔어요!!', speech: '꽥꽥?! 비켜!!' },
  { id: 'duck_closeup', tier: 1, failLabel: '🦆 오리 초근접 얼빡샷 찍힘!!', speech: '렌즈 맛있다 꽥!' },
  { id: 'ex_lover', tier: 1, failLabel: '💐 전 애인 난입 현장 찍힘!!', speech: '이 스냅 무효야!!!' },
  { id: 'heart_balloons', tier: 1, failLabel: '🎈 풍선 다발에 커플이 가려짐!', speech: '' },
  { id: 'sprinkler', tier: 1, failLabel: '💦 스프링클러 물벼락 찍힘!!', speech: '치이이익—💦' },

  // Tier 2 (엉뚱함 2배! 황당 코믹 소동 — 초반에도 가끔 깜짝 출현, 중반 주력!)
  { id: 'seagull_dive', tier: 1, failLabel: '🕊️ 새우깡 도둑 갈매기 찍힘!', speech: '끼룩!! 내 과자!' },
  { id: 'crab_parade', tier: 1, failLabel: '🦀 대왕 꽃게 댄스단 찍힘!!', speech: '집게집게 딱딱!' },
  { id: 'hiker_group', tier: 1, failLabel: '🧢 단체 등산객 길막 찍힘!!', speech: '여기가 명당이네~!' },
  { id: 'dino_suit', tier: 2, failLabel: '🦖 공룡 인형탈 알바생 찍힘!!', speech: '전단지 받아가세요 크앙!' },
  { id: 'serving_robot', tier: 2, failLabel: '🤖 길 잃은 짬뽕 서빙로봇 찍힘!', speech: '주문하신 짬뽕 왔습니다~' },

  // Tier 3 (우주급 뇌절 대폭발!!)
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
    // 정장 뒷모습 + 얼굴 가린 대형 빨간 장미 꽃다발 (사람 얼굴 없음!)
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
    // 등산복 입은 뒷모습 2명 (선캡 모자 + 얼굴 없음!)
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
    // disco_snowman
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
  phase: 'menu', // 'menu' | 'brief' | 'play' | 'stageclear' | 'gameover'
  stageIdx: 0,   // 0 ~ 9 (STAGE 1 ~ 10)
  totalPay: 0,
  totalShotsSuccess: 0,
  totalAccSum: 0,
  highestStageReached: 1,

  // 현재 스테이지 데이터
  missions: [],      // [{ poseId, poseLabel, zoom, aimX, aimY, refDataUrl }]
  missionIdx: 0,
  capturedGallery: [],
  stagePayEarned: 0,
  stageAccSum: 0,
  hearts: 3,
  timeLeft: 55,

  // 카메라 뷰파인더 조준 & 배율
  currentZoom: 1,    // 0.5 | 1 | 2
  smoothZoom: 1,
  aimX: 0,           // 좌우 드래그 패닝 (-3.2 ~ +3.2)
  aimY: 0,           // 상하 드래그 패닝 (-1.8 ~ +1.8)
  dragging: false,
  pointerId: null,
  lastClientX: 0,
  lastClientY: 0,

  // 커플 실시간 포즈 사이클
  posePhase: 0,
  poseAmount: 0,
  currentMatchPct: 0,
  isBlockedByChaos: false,
  blockingChaosLabel: '',
  prevReadyLock: false,

  // 100% 랜덤 돌발 상황 인스턴스들
  activeChaos: [],
  chaosTimer: 1.5,
  recentChaosIds: [],

  popTexts: [],
  devPopupTimer: 0,
  incomingRef: null,
  lastFinalRun: null,
  lastShareData: null,
};

function getResponsiveCamBaseZ() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const portraitScale = aspect < 0.85 ? clamp(0.85 / Math.max(0.42, aspect), 1.0, 1.68) : 1.0;
  return 11.2 * portraitScale;
}

// ─── 카메라 적용 (배율 `0.5x / 1x / 2x` + 구도 조준 `aimX, aimY`) ───
function applyViewfinderCamera(zoomVal, panX, panY, swaySec = 0, stageLv = 1, instant = false) {
  const fov = zoomVal === 0.5 ? 56 : zoomVal === 2 ? 26 : 40;
  if (instant || Math.abs(camera.fov - fov) > 0.05) {
    camera.fov = instant ? fov : lerp(camera.fov, fov, 0.32);
    camera.updateProjectionMatrix();
  }
  const swayAmp = stageLv <= 2 ? 0.025 : Math.min(0.20, 0.035 + stageLv * 0.016);
  const sx = swaySec > 0 ? Math.sin(swaySec * 1.9) * swayAmp : 0;
  const sy = swaySec > 0 ? Math.cos(swaySec * 2.5) * (swayAmp * 0.65) : 0;
  const baseZ = getResponsiveCamBaseZ();

  camera.position.set((panX + sx) * 0.65, 2.35 + (panY + sy) * 0.45, baseZ);
  camera.lookAt(panX + sx, 1.85 + panY + sy, 0);
}

// ─── 오프스크린으로 이번 스테이지의 미션 예시 사진(5~10장)을 실제 3D 장면으로 즉석 촬영! ───
const snapThumbCanvas = document.createElement('canvas');
snapThumbCanvas.width = 360;
snapThumbCanvas.height = 270;
const snapThumbCtx = snapThumbCanvas.getContext('2d');

function captureCurrentCanvasAsDataURL(quality = 0.84) {
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

function generateRandomMissionsForStage(cfg) {
  // 매번 플레이할 때마다 포즈 순서·배율·앵글이 완전히 랜덤으로 조합됨!
  const zoomChoices = cfg.stage === 1
    ? [1, 1, 1, 2, 0.5]
    : cfg.stage <= 3
      ? [1, 2, 0.5, 1, 2, 0.5]
      : [0.5, 1, 2];

  const shuffledPoses = shuffleTrue(POSE_POOL);
  const missions = [];

  for (let i = 0; i < cfg.shotsReq; i++) {
    const pose = shuffledPoses[i % shuffledPoses.length];
    const zoom = cfg.stage <= 2 ? zoomChoices[i % zoomChoices.length] : randPick(zoomChoices);
    // 스테이지가 올라갈수록 살짝 감성 오프셋 구도도 섞임
    const aimX = cfg.stage <= 2 ? 0 : Number((randRange(-0.85, 0.85)).toFixed(2));
    const aimY = cfg.stage <= 3 ? 0 : Number((randRange(-0.35, 0.45)).toFixed(2));
    missions.push({
      idx: i + 1,
      poseId: pose.id,
      poseLabel: pose.label,
      cycleSpeed: pose.cycleSpeed * (1 + (cfg.stage - 1) * 0.06),
      zoom,
      aimX,
      aimY,
      refDataUrl: '',
    });
  }

  // 방해물이 없는 깨끗한 상태에서 예시 사진을 실제로 찍어 저장!
  const prevFov = camera.fov;
  for (const m of missions) {
    applyCouplePose(m.poseId, 1.0);
    applyViewfinderCamera(m.zoom, m.aimX, m.aimY, 0, cfg.stage, true);
    m.refDataUrl = captureCurrentCanvasAsDataURL(0.84);
  }
  camera.fov = prevFov;
  camera.updateProjectionMatrix();
  applyCouplePose(missions[0].poseId, 0);

  return missions;
}

// ─── 100% 리얼 랜덤 돌발 상황 스포너 (세션 간에도 직전 판과 절대 겹치지 않는 완전 무작위!) ───
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
  for (const c of STATE.activeChaos) {
    scene.remove(c.mesh);
  }
  STATE.activeChaos = [];
}

function spawnRandomChaosEvent(cfg) {
  const eligible = CHAOS_CATALOG.filter(c => c.tier <= cfg.chaosMaxTier);
  const history = [...loadSessionRecentChaos(), ...STATE.recentChaosIds];
  const recentTail = history.slice(-4);
  const freshPool = eligible.filter(c => !recentTail.includes(c.id));
  const pickedDef = randPick(freshPool.length > 0 ? freshPool : eligible);

  STATE.recentChaosIds.push(pickedDef.id);
  if (STATE.recentChaosIds.length > 5) STATE.recentChaosIds.shift();
  saveSessionRecentChaos([...history, pickedDef.id]);

  const mesh = buildChaosMesh(pickedDef);

  // 진입 패턴도 매번 완전 무작위로 결정!
  let pattern = 'cross';
  if (pickedDef.id === 'duck_closeup' || pickedDef.id === 'cool_alpaca' || pickedDef.id === 'sprinkler') {
    pattern = randPick(['pop_bottom', 'cross']);
  } else if (pickedDef.id === 'ufo_beam' || pickedDef.id === 'heart_balloons' || pickedDef.id === 'seagull_dive' || pickedDef.id === 'golden_dolphin') {
    pattern = randPick(['fly_arc', 'hover_top', 'cross']);
  } else {
    pattern = randPick(['cross', 'hesitate_cross']);
  }

  const dir = trueRand() < 0.5 ? 1 : -1;
  const zDepth = pattern === 'pop_bottom' ? randRange(3.8, 5.1) : randRange(1.4, 3.2);
  const dur = clamp(randRange(2.3, 3.6) - cfg.stage * 0.06, 1.55, 3.6);

  mesh.rotation.y = dir < 0 ? Math.PI * 0.12 : -Math.PI * 0.12;
  scene.add(mesh);

  SFX.quackChaos(randRange(0.85, 1.25));

  STATE.activeChaos.push({
    def: pickedDef,
    mesh,
    pattern,
    dir,
    zDepth,
    age: 0,
    dur,
    bobSeed: randRange(0, 10),
  });
}

function updateActiveChaos(dt, nowSec) {
  STATE.isBlockedByChaos = false;
  STATE.blockingChaosLabel = '';

  for (let i = STATE.activeChaos.length - 1; i >= 0; i--) {
    const c = STATE.activeChaos[i];
    c.age += dt;
    if (c.age >= c.dur) {
      scene.remove(c.mesh);
      STATE.activeChaos.splice(i, 1);
      continue;
    }

    const u = c.age / c.dur;
    let x = 0;
    let y = 0;

    if (c.pattern === 'pop_bottom') {
      // 화면 아래에서 불쑥 올라와 기웃거리다가 쏙 내려감!
      const pop = Math.sin(u * Math.PI);
      x = Math.sin(u * TAU + c.bobSeed) * 0.85;
      y = lerp(-3.2, 0.15, Math.min(1, pop * 1.35));
    } else if (c.pattern === 'fly_arc') {
      x = lerp(-6.8 * c.dir, 6.8 * c.dir, u);
      y = 0.5 + Math.sin(u * Math.PI) * 2.2;
    } else if (c.pattern === 'hover_top') {
      x = lerp(-5.5 * c.dir, 5.5 * c.dir, u);
      y = 0.2 + Math.sin(nowSec * 6 + c.bobSeed) * 0.35;
    } else if (c.pattern === 'hesitate_cross') {
      // 한가운데(u = 0.38 ~ 0.62)에서 얄밉게 잠깐 멈칫거리다가 후다닥 지나가는 페인트 모션!
      let prog = u;
      if (u > 0.36 && u < 0.64) {
        prog = 0.36 + (u - 0.36) * 0.22;
      } else if (u >= 0.64) {
        prog = 0.4216 + ((u - 0.64) / 0.36) * 0.5784;
      }
      x = lerp(-6.8 * c.dir, 6.8 * c.dir, prog);
      y = Math.abs(Math.sin(nowSec * 12 + c.bobSeed)) * 0.22;
    } else {
      x = lerp(-6.8 * c.dir, 6.8 * c.dir, u);
      y = Math.abs(Math.sin(nowSec * 11 + c.bobSeed)) * 0.20;
    }

    c.mesh.position.set(x, y, c.zDepth);

    // 현재 카메라 시야 중심(커플 피사체 영역)을 실제로 가리고 있을 때만 방해 판정!
    const relX = Math.abs(x - STATE.aimX * 0.7);
    const blockWidth = c.zDepth > 3.6 ? 1.85 : 1.65;
    if (relX < blockWidth && y > -1.25) {
      STATE.isBlockedByChaos = true;
      STATE.blockingChaosLabel = c.def.failLabel;
    }
  }
}

// ─── 스테이지 준비 & 브리핑 모달 오픈 ───
function prepareStage(stageIndex) {
  STATE.stageIdx = stageIndex;
  STATE.highestStageReached = Math.max(STATE.highestStageReached, stageIndex + 1);
  const cfg = STAGE_CONFIGS[stageIndex];

  clearActiveChaos();
  buildVenueScene(cfg.venue);
  buildCoupleForStage(cfg);

  STATE.missions = generateRandomMissionsForStage(cfg);
  STATE.missionIdx = 0;
  STATE.capturedGallery = [];
  STATE.stagePayEarned = 0;
  STATE.stageAccSum = 0;
  STATE.hearts = 3;
  STATE.timeLeft = cfg.timeLimit;
  STATE.currentZoom = 1;
  STATE.aimX = 0;
  STATE.aimY = 0;
  STATE.posePhase = 0;
  STATE.chaosTimer = randRange(1.2, 2.2);
  syncZoomButtons();

  // 브리핑 모달에 예시 사진 5~10장 채우기
  $('brief-badge').textContent = `STAGE ${cfg.stage} / 10 · ${cfg.venueName}`;
  $('brief-couple').textContent = `💑 ${cfg.coupleName}`;
  $('brief-quote').textContent = cfg.quote;

  const grid = $('brief-grid');
  grid.innerHTML = STATE.missions.map(m => `
    <div class="brief-item">
      <img src="${m.refDataUrl}" alt="${m.poseLabel}">
      <div class="brief-item-txt">#${m.idx} ${m.poseLabel}<br><span style="color:#d97706">(${m.zoom}x 배율)</span></div>
    </div>
  `).join('');

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
  $('ref-num').textContent = `#${m.idx} / ${STATE.missions.length}`;
  $('ref-zoom').textContent = `${m.zoom}x`;
  $('ref-img').src = m.refDataUrl;
  $('ref-cap').textContent = m.poseLabel;
  syncZoomButtons();
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

// ─── 배율 선택 & 드래그 패닝 ───
const zoomBtns = Array.from(document.querySelectorAll('.zoom-btn'));

function syncZoomButtons() {
  const curMission = STATE.missions[STATE.missionIdx];
  zoomBtns.forEach(btn => {
    const z = Number(btn.dataset.zoom);
    btn.classList.toggle('active', z === STATE.currentZoom);
    btn.classList.toggle('hint', !!curMission && z === curMission.zoom && z !== STATE.currentZoom);
  });
}

zoomBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    unlockAudio();
    STATE.currentZoom = Number(btn.dataset.zoom);
    SFX.tick();
    syncZoomButtons();
  });
});

$('btn-recenter').addEventListener('click', () => {
  STATE.aimX = 0;
  STATE.aimY = 0;
  SFX.tick();
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
  if (STATE.phase !== 'play' || !STATE.dragging || e.pointerId !== STATE.pointerId) return;
  const dx = e.clientX - STATE.lastClientX;
  const dy = e.clientY - STATE.lastClientY;
  STATE.lastClientX = e.clientX;
  STATE.lastClientY = e.clientY;

  STATE.aimX = clamp(STATE.aimX - dx * 0.0085, -2.6, 2.6);
  STATE.aimY = clamp(STATE.aimY + dy * 0.0065, -1.3, 1.3);
});

function endPan(e) {
  if (!STATE.dragging || (e && e.pointerId !== STATE.pointerId)) return;
  STATE.dragging = false;
  STATE.pointerId = null;
}
glCanvas.addEventListener('pointerup', endPan);
glCanvas.addEventListener('pointercancel', endPan);

// ─── 실시간 일치도(%) 산출 ───
function evaluateLiveMatch() {
  const cfg = STAGE_CONFIGS[STATE.stageIdx];
  const m = STATE.missions[STATE.missionIdx];
  if (!cfg || !m) return 0;

  if (STATE.isBlockedByChaos) {
    return Math.round(24 + STATE.poseAmount * 16);
  }

  // 1) 포즈 타이밍 점수 (0 ~ 62점)
  const poseScore = Math.pow(STATE.poseAmount, 1.35) * 62;

  // 2) 배율 일치 점수 (일치 시 22점, 불일치 시 감점)
  const zoomScore = (STATE.currentZoom === m.zoom) ? 22 : 4;

  // 3) 구도 중심 조준 점수 (0 ~ 16점)
  const aimErr = Math.hypot(STATE.aimX - m.aimX, STATE.aimY - m.aimY);
  const aimScore = clamp(16 - aimErr * 9.5, 0, 16);

  return clamp(Math.round(poseScore + zoomScore + aimScore), 10, 100);
}

// ─── 📸 셔터 촬영 판정!! ───
function showDevelopedPhotoPopup(dataUrl, label, isGood) {
  const box = $('dev-popup');
  $('dev-img').src = dataUrl;
  $('dev-stamp').textContent = label;
  box.classList.toggle('bad', !isGood);
  box.classList.add('show');
  STATE.devPopupTimer = 0.95;

  const slot = $('last-shot-slot');
  slot.innerHTML = `<img src="${dataUrl}" alt="최근 사진">`;
}

function triggerShutter() {
  if (STATE.phase !== 'play') return;
  unlockAudio();
  SFX.shutterClick();

  // 하얀 셔터 플래시 번쩍!
  const fl = $('shutter-flash');
  fl.classList.add('bang');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => fl.classList.remove('bang'));
  });

  const shotUrl = captureCurrentCanvasAsDataURL(0.85);
  const cfg = STAGE_CONFIGS[STATE.stageIdx];
  const m = STATE.missions[STATE.missionIdx];
  const matchPct = STATE.currentMatchPct;

  // 1) 방해물이 찍혔거나 합격 일치도 미달!
  if (STATE.isBlockedByChaos || matchPct < cfg.minMatch) {
    SFX.photoFail();
    STATE.hearts -= 1;

    let failReason = `💦 타이밍 어긋남! (일치 ${matchPct}% < ${cfg.minMatch}%)`;
    if (STATE.isBlockedByChaos) {
      failReason = `${STATE.blockingChaosLabel} (일치 ${matchPct}%)`;
    } else if (STATE.currentZoom !== m.zoom) {
      failReason = `🔍 배율 불일치! [${m.zoom}x]로 찍어야 해요!`;
    }

    showDevelopedPhotoPopup(shotUrl, failReason, false);
    updateHUD();

    if (STATE.hearts <= 0) {
      setTimeout(() => finishCareer(false, '커플 인내심 소진! 엉뚱한 사진만 찍다가 알바 해고…'), 650);
    }
    return;
  }

  // 2) 미션 컷 촬영 대성공!!
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
    label: m.poseLabel,
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

  // 이번 스테이지의 모든 미션 사진 촬영 완료!!
  if (STATE.missionIdx >= STATE.missions.length) {
    STATE.phase = 'transition';
    if (STATE.stageIdx >= STAGE_CONFIGS.length - 1) {
      // 대망의 10스테이지 올클리어!!
      SFX.win();
      setTimeout(() => finishCareer(true, '👑 전설의 10스테이지 올클리어!! 우주급 소동을 뚫고 모든 인생샷을 건졌습니다!'), 650);
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
  $('sc-sub').textContent = `평균 일치도 ${avg}% · 다음 의뢰: STAGE ${nextCfg.stage} [${nextCfg.coupleName}] (${nextCfg.shotsReq}장)`;

  $('sc-gallery').innerHTML = STATE.capturedGallery.map(it => `
    <div class="brief-item">
      <img src="${it.dataUrl}" alt="${it.label}">
      <div class="brief-item-txt">#${it.idx} 일치 ${it.matchPct}% ✨</div>
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
    mp.textContent = `🔍 [${m.zoom}x] 배율 필요 (${STATE.currentMatchPct}%)`;
    mp.className = 'match-pill';
    af.className = 'af-reticle';
    afLbl.textContent = `아래 [${m.zoom}x] 버튼을 누르세요`;
  } else if (ready) {
    mp.textContent = `✨ 일치 ${STATE.currentMatchPct}% · 지금 찰칵!!`;
    mp.className = 'match-pill good';
    af.className = 'af-reticle locked';
    afLbl.textContent = `삑! ${STATE.currentMatchPct}% 포즈 일치!`;
  } else {
    mp.textContent = `일치도 ${STATE.currentMatchPct}% (목표 ${cfg.minMatch}%+)`;
    mp.className = 'match-pill';
    af.className = 'af-reticle';
    afLbl.textContent = '포즈 정점을 기다리세요';
  }

  $('pose-fill').style.width = `${Math.round(STATE.poseAmount * 100)}%`;
}

// ─── 최종 종료 & 전체 랭킹 기록 ───
function computeSnapRankTitle(clearedAll, stageReached, totalPay) {
  if (clearedAll) {
    return '👑 전설의 10스테이지 마스터 스냅 신(神)';
  }
  if (stageReached >= 7 || totalPay >= 350000) {
    return '📸 우주 기행도 뚫는 프로 스냅 사진가';
  }
  if (stageReached >= 4 || totalPay >= 140000) {
    return '🦆 오리 피하기 숙련 스냅 알바생';
  }
  return '🐣 오리 얼빡샷 수집가 수습 알바';
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
    meta: {
      clearedAll,
      stageReached,
      shots: STATE.totalShotsSuccess,
      avgAcc,
    },
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

// ─── 새 커리어 시작 (1스테이지부터 완전 새로운 랜덤 시나리오 생성!) ───
function startNewCareer() {
  unlockAudio();
  STATE.totalPay = 0;
  STATE.totalShotsSuccess = 0;
  STATE.totalAccSum = 0;
  STATE.highestStageReached = 1;
  STATE.recentChaosIds = [];
  prepareStage(0);
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
    if (STATE.devPopupTimer <= 0) {
      $('dev-popup').classList.remove('show');
    }
  }

  const cfg = STAGE_CONFIGS[STATE.stageIdx] || STAGE_CONFIGS[0];

  if (STATE.phase === 'menu' || STATE.phase === 'brief' || STATE.phase === 'stageclear') {
    const previewWave = 0.5 + 0.5 * Math.sin(nowSec * 2.0);
    applyCouplePose('hand_hold', previewWave);
    camera.fov = 40;
    camera.updateProjectionMatrix();
    const bz = getResponsiveCamBaseZ();
    camera.position.set(Math.sin(nowSec * 0.45) * 1.4, 2.45, bz);
    camera.lookAt(0, 1.85, 0);
  } else if (STATE.phase === 'play') {
    STATE.timeLeft = Math.max(0, STATE.timeLeft - dt);
    if (STATE.timeLeft <= 0) {
      finishCareer(false, `⏰ 시간 초과! STAGE ${cfg.stage} 촬영 마감 시간을 넘겼어요!`);
      return;
    }

    const m = STATE.missions[STATE.missionIdx];
    if (m) {
      // 커플 포즈 주기적 리듬 애니메이션 (정점에서 잠깐 머물러 찍는 손맛 보장!)
      STATE.posePhase += dt * m.cycleSpeed;
      const rawWave = 0.5 - 0.5 * Math.cos(STATE.posePhase);
      STATE.poseAmount = clamp(Math.pow(rawWave, 0.78) * 1.08, 0, 1);
      applyCouplePose(m.poseId, STATE.poseAmount);
    }

    // 100% 랜덤 돌발 상황 출현 타이머
    STATE.chaosTimer -= dt;
    if (STATE.chaosTimer <= 0) {
      if (STATE.activeChaos.length < cfg.maxConcurrentChaos) {
        spawnRandomChaosEvent(cfg);
      }
      STATE.chaosTimer = randRange(cfg.chaosInterval[0], cfg.chaosInterval[1]);
    }

    updateActiveChaos(dt, nowSec);
    applyViewfinderCamera(STATE.currentZoom, STATE.aimX, STATE.aimY, nowSec, cfg.stage);

    STATE.currentMatchPct = evaluateLiveMatch();
    const readyNow = !STATE.isBlockedByChaos && STATE.currentMatchPct >= cfg.minMatch;
    if (readyNow && !STATE.prevReadyLock) {
      SFX.focusBeep();
    }
    STATE.prevReadyLock = readyNow;

    BGM.setUrgent(STATE.timeLeft <= 10 || cfg.stage >= 7);
    updateHUD();
  }

  renderer.render(scene, camera);

  window.__snapDebug = {
    phase: STATE.phase,
    stage: cfg.stage,
    venue: cfg.venue,
    missionIdx: STATE.missionIdx,
    missionsTotal: STATE.missions.length,
    missionPoses: STATE.missions.map(x => `${x.poseId}@${x.zoom}x`),
    currentZoom: STATE.currentZoom,
    targetZoom: STATE.missions[STATE.missionIdx] ? STATE.missions[STATE.missionIdx].zoom : 1,
    matchPct: STATE.currentMatchPct,
    minMatch: cfg.minMatch,
    blocked: STATE.isBlockedByChaos,
    activeChaosIds: STATE.activeChaos.map(c => `${c.def.id}:${c.pattern}:${c.dir}`),
    hearts: STATE.hearts,
    totalPay: STATE.totalPay,
  };
}

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
    text: `📸 [${STATE.lastFinalRun.nickname}]님의 스냅 알바 수입: ${STATE.totalPay.toLocaleString()}원 (STAGE ${STATE.lastFinalRun.actualValue}/10 · 인생샷 ${STATE.totalShotsSuccess}장)! 오리와 UFO 난입 뚫고 더 잘 찍을 수 있나요?`,
    url: shareUrl,
  });
});

$('btn-save-img').addEventListener('click', () => {
  if (!STATE.lastFinalRun) return;
  downloadResultCard({
    gameTitle: '웨딩·여행 스냅 알바 — 10스테이지',
    rankTitle: STATE.lastFinalRun.rankTitle,
    headline: `${STATE.totalPay.toLocaleString()}원 정산`,
    subline: `도달 STAGE ${STATE.lastFinalRun.actualValue}/10 · 인생샷 ${STATE.totalShotsSuccess}장`,
    nickname: $('res-nick').value || '익명 스냅작가',
    shareUrl: (STATE.lastShareData && STATE.lastShareData.shareUrl) || location.href,
  });
});

// 초기 배경 프리뷰 세팅 및 도전장 확인
(async function init() {
  buildVenueScene('lake_wedding');
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
