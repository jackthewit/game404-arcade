// 짬뽕 탄막 — 흰 티 입은 날, 사악한 짬뽕 국물 회피 서바이벌 3D 웹게임 (이게뭔겜? 404 아케이드)
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

const GAME_ID = 'jjamppong';
const BEST_WAVES_KEY = 'fgs.jjamppong.bestWaves';
const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeOutBack = t => {
  const x = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

const IS_REC = new URLSearchParams(location.search).get('rec') === '1';

if (!IS_REC) {
  enforceGameAccess(GAME_ID);
}

// ─── 캔버스 및 Three.js 렌더러 초기화 ───
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
scene.background = new THREE.Color('#230e10');
scene.fog = new THREE.Fog('#230e10', 48, 96);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(36, window.innerWidth / Math.max(1, window.innerHeight), 0.5, 160);

// 조명 세팅 (따뜻한 중화반점 조명 + 사악한 보스 각성 시 붉은 스포트라이트 연출!)
const hemiLight = new THREE.HemisphereLight('#fff7ed', '#451a14', 1.05);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight('#fff5e6', 1.95);
dirLight.position.set(-10, 34, 18);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 8;
dirLight.shadow.camera.far = 90;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 24;
dirLight.shadow.camera.bottom = -24;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

const lanternLightL = new THREE.PointLight('#ff5a36', 11, 28, 1.5);
lanternLightL.position.set(-11, 11, -15);
scene.add(lanternLightL);

const lanternLightR = new THREE.PointLight('#ff5a36', 11, 28, 1.5);
lanternLightR.position.set(11, 11, -15);
scene.add(lanternLightR);

const bossEvilLight = new THREE.PointLight('#ff2e00', 0, 22, 1.4);
bossEvilLight.position.set(0, 6.5, -8.5);
scene.add(bossEvilLight);

// ─── 캔버스 텍스처 도우미 ───
function makeCanvasTexture(w, h, drawFn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  drawFn(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// ─── 무대 치수 상수 ───
const BOWL_Z = -9.6;
const ARENA_HALF_X = 7.3;
const ARENA_MIN_Z = -3.4;
const ARENA_MAX_Z = 10.8;
const SHIRT_CORE_R = 0.35; // 탄막 회피 정밀 코어 판정 반지름

// ─── 1. 중국집(중화반점) 식탁 & 인테리어 3D 디오라마 ───
const restaurantGroup = new THREE.Group();
scene.add(restaurantGroup);

// 붉은 옻칠 원목 중식당 큰 식탁 상판
const redWoodTex = makeCanvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#5c1916';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 6) {
    g.fillStyle = y % 12 === 0 ? 'rgba(30, 6, 6, 0.18)' : 'rgba(255, 190, 150, 0.04)';
    g.fillRect(0, y, w, 3);
  }
});
const tableMesh = new THREE.Mesh(
  new THREE.BoxGeometry(58, 1.4, 46),
  new THREE.MeshStandardMaterial({ map: redWoodTex, roughness: 0.42, metalness: 0.08 })
);
tableMesh.position.set(0, -0.72, -1.0);
tableMesh.receiveShadow = true;
restaurantGroup.add(tableMesh);

// 회피 구역(아레나) 식탁보 매트: 새하얀 흰 티셔츠와 주황 국물 방울이 동시에 쨍하게 돋보이는 청자·민트 체크 매트!
const checkClothTex = makeCanvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#d3eae5';
  g.fillRect(0, 0, w, h);
  const cell = 32;
  for (let r = 0; r < h / cell; r++) {
    for (let c = 0; c < w / cell; c++) {
      if ((r + c) % 2 === 0) {
        g.fillStyle = 'rgba(148, 197, 190, 0.42)';
        g.fillRect(c * cell, r * cell, cell, cell);
      }
      if (r % 2 === 0 && c % 2 === 0) {
        g.fillStyle = 'rgba(110, 172, 165, 0.28)';
        g.fillRect(c * cell, r * cell, cell, cell);
      }
    }
  }
  // 가장자리 금박·붉은 안전 경계 테두리
  g.strokeStyle = '#dc2626';
  g.lineWidth = 10;
  roundRectPath(g, 10, 10, w - 20, h - 20, 22);
  g.stroke();
  g.strokeStyle = '#fbbf24';
  g.lineWidth = 4;
  roundRectPath(g, 20, 20, w - 40, h - 40, 16);
  g.stroke();
});

const arenaW = (ARENA_HALF_X + 1.05) * 2;
const arenaD = (ARENA_MAX_Z - ARENA_MIN_Z) + 2.2;
const arenaCenterZ = (ARENA_MIN_Z + ARENA_MAX_Z) * 0.5;
const arenaClothMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(arenaW, arenaD),
  new THREE.MeshStandardMaterial({ map: checkClothTex, roughness: 0.68, metalness: 0.02 })
);
arenaClothMesh.rotation.x = -Math.PI / 2;
arenaClothMesh.position.set(0, 0.015, arenaCenterZ);
arenaClothMesh.receiveShadow = true;
restaurantGroup.add(arenaClothMesh);

// 중국집 뒤쪽 홀 벽면, 금박 현판, 빨간 홍등(紅燈), 반찬 접시들
{
  const wallDarkRed = new THREE.MeshStandardMaterial({ color: '#381012', roughness: 0.75 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.28, metalness: 0.72 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(64, 26, 1.2), wallDarkRed);
  backWall.position.set(0, 11.5, -23.5);
  restaurantGroup.add(backWall);

  // 중화풍 금박 격자 장식 기둥
  for (const px of [-14.5, -6.8, 6.8, 14.5]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 24, 1.45), goldTrimMat);
    pillar.position.set(px, 11.0, -23.2);
    restaurantGroup.add(pillar);
  }

  // 중국집 금박 현판 ("원조 대왕짬뽕")
  const signTex = makeCanvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#1c090a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fbbf24';
    g.lineWidth = 10;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#fde047';
    g.font = '900 58px "Pretendard","Apple SD Gothic Neo",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🔥 전설의 반점 🔥', w / 2, h / 2 + 2);
  });
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 3.1, 0.5),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 })
  );
  signBoard.position.set(0, 7.2, -22.6);
  restaurantGroup.add(signBoard);

  // 천장 빨간 홍등 4개 (모바일 인트로 시야에도 한눈에 쏙 들어오는 높이)
  const lanternMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 0.62,
    roughness: 0.35,
  });
  for (const [lx, ly, lz] of [[-6.8, 7.6, -17.5], [6.8, 7.6, -17.5], [-12.5, 9.2, -13.0], [12.5, 9.2, -13.0]]) {
    const lan = new THREE.Group();
    lan.position.set(lx, ly, lz);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 12), lanternMat);
    globe.scale.set(1, 0.85, 1);
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 12), goldTrimMat);
    capTop.position.y = 1.15;
    const capBot = capTop.clone();
    capBot.position.y = -1.15;
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 1.1, 8), goldTrimMat);
    tassel.position.y = -1.8;
    lan.add(globe, capTop, capBot, tassel);
    restaurantGroup.add(lan);
  }

  // 식탁 위 중국집 반찬 소품: 왼쪽 샛노란 단무지 접시 & 오른쪽 양파·춘장 종지 & 고춧가루 통!
  const plateWhiteMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.22 });
  const danmujiDish = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.6, 0.36, 20), plateWhiteMat);
  danmujiDish.position.set(-10.8, 0.18, -7.2);
  danmujiDish.castShadow = true;
  restaurantGroup.add(danmujiDish);

  const danmujiMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.32 });
  for (let i = 0; i < 4; i++) {
    const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 14, 1, false, 0, Math.PI), danmujiMat);
    slice.position.set(-11.1 + (i % 2) * 0.65, 0.42 + i * 0.05, -7.5 + Math.floor(i / 2) * 0.65);
    slice.rotation.y = i * 0.5;
    restaurantGroup.add(slice);
  }

  // 오른쪽 춘장 종지 & 생양파 조각
  const chunjangDish = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.3, 0.38, 18), plateWhiteMat);
  chunjangDish.position.set(10.6, 0.19, -7.6);
  const sauce = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.25, 0.12, 16), new THREE.MeshStandardMaterial({ color: '#171010', roughness: 0.12 }));
  sauce.position.set(10.6, 0.38, -7.6);
  restaurantGroup.add(chunjangDish, sauce);

  // 고춧가루 양념통 & 식초병
  const spiceJar = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 1.85, 14), new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.25 }));
  spiceJar.position.set(11.2, 0.92, -3.6);
  const spiceLid = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.42, 14), new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.35 }));
  spiceLid.position.set(11.2, 1.95, -3.6);
  restaurantGroup.add(spiceJar, spiceLid);
}

// 중국집 빨간 메뉴판 (인트로 주문 컷에서 식탁 위에 펼쳐짐!)
const menuTex = makeCanvasTexture(256, 360, (g, w, h) => {
  g.fillStyle = '#b91c1c';
  roundRectPath(g, 6, 6, w - 12, h - 12, 16);
  g.fill();
  g.strokeStyle = '#fbbf24';
  g.lineWidth = 6;
  roundRectPath(g, 16, 16, w - 32, h - 32, 10);
  g.stroke();

  g.fillStyle = '#fde047';
  g.font = '900 32px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.textAlign = 'center';
  g.fillText('차 림 표', w / 2, 64);

  g.fillStyle = '#fffbeb';
  g.font = '800 23px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.fillText('짜장면 …… 7,000', w / 2, 135);

  g.fillStyle = '#fde047';
  roundRectPath(g, 28, 168, w - 56, 54, 10);
  g.fill();
  g.fillStyle = '#991b1b';
  g.font = '900 25px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.fillText('🔥특미 짬뽕 9,000', w / 2, 203);

  g.fillStyle = '#fffbeb';
  g.font = '800 22px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.fillText('탕수육 …… 18,000', w / 2, 275);
});
const menuBoardMesh = new THREE.Mesh(
  new THREE.BoxGeometry(3.8, 0.12, 5.2),
  new THREE.MeshStandardMaterial({ map: menuTex, roughness: 0.45 })
);
menuBoardMesh.position.set(-11.4, 0.08, 1.5);
menuBoardMesh.rotation.y = 0.28;
restaurantGroup.add(menuBoardMesh);

// 인트로 전용: 새하얀 흰 티셔츠를 입은 손님 뒷모습 상체 & 주문하는 손 (사람 얼굴 없음! 뒷모습과 손만!)
const introCustomerGroup = new THREE.Group();
introCustomerGroup.visible = false;
scene.add(introCustomerGroup);
{
  const pureWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#f1f5f9', emissiveIntensity: 0.15, roughness: 0.38 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f3c5a5', roughness: 0.55 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.1, 4.8, 16), pureWhiteMat);
  torso.scale.set(1.28, 1, 0.68);
  torso.position.set(0, 1.8, 10.6);
  const sleeveL = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.68, 2.2, 12), pureWhiteMat);
  sleeveL.rotation.z = 0.55;
  sleeveL.position.set(-2.95, 2.9, 10.4);
  const sleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.68, 2.2, 12), pureWhiteMat);
  sleeveR.rotation.z = -0.55;
  sleeveR.position.set(2.95, 2.9, 10.4);
  // 주문하며 차림표를 짚는 오른팔과 손
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 3.6, 6, 10), skinMat);
  armR.rotation.x = 1.32;
  armR.rotation.z = -0.22;
  armR.position.set(2.1, 1.9, 7.2);
  introCustomerGroup.add(torso, sleeveL, sleeveR, armR);
}

// ─── 2. 대왕 짬뽕 그릇 보스 & "씨익—" 웃는 사악한 짬뽕 파츠 ───
const bowlRoot = new THREE.Group();
bowlRoot.position.set(0, 0, BOWL_Z);
scene.add(bowlRoot);

// 전통 중식 대접 외벽 (붉은 칠기 + 금박 번개 문양 테두리)
const bowlRimTex = makeCanvasTexture(512, 128, (g, w, h) => {
  g.fillStyle = '#b91c1c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fbbf24';
  g.fillRect(0, 10, w, 10);
  g.fillRect(0, h - 18, w, 8);
  // 전통 중식 그릇 번개/소용돌이 금박 문양
  g.strokeStyle = '#fde047';
  g.lineWidth = 5;
  for (let x = 12; x < w; x += 48) {
    g.strokeRect(x, 30, 28, 28);
    g.beginPath();
    g.moveTo(x + 8, 38);
    g.lineTo(x + 20, 38);
    g.lineTo(x + 20, 50);
    g.lineTo(x + 12, 50);
    g.stroke();
  }
});
bowlRimTex.wrapS = THREE.RepeatWrapping;
bowlRimTex.repeat.set(3, 1);

const BOWL_R = 4.9;
const BOWL_H = 2.85;
{
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.4, 0.55, 28),
    new THREE.MeshStandardMaterial({ color: '#991b1b', roughness: 0.35 })
  );
  foot.position.y = 0.28;
  foot.castShadow = true;

  const outerBody = new THREE.Mesh(
    new THREE.CylinderGeometry(BOWL_R, 2.8, BOWL_H - 0.35, 36, 1, true),
    new THREE.MeshStandardMaterial({ map: bowlRimTex, roughness: 0.28, metalness: 0.08, side: THREE.DoubleSide })
  );
  outerBody.position.y = 0.45 + (BOWL_H - 0.35) / 2;
  outerBody.castShadow = true;

  const innerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(BOWL_R - 0.22, 2.65, BOWL_H - 0.4, 36, 1, true),
    new THREE.MeshStandardMaterial({ color: '#fff8f0', roughness: 0.22, side: THREE.BackSide })
  );
  innerWall.position.y = 0.48 + (BOWL_H - 0.4) / 2;

  const lipRing = new THREE.Mesh(
    new THREE.TorusGeometry(BOWL_R - 0.11, 0.16, 12, 40),
    new THREE.MeshStandardMaterial({ color: '#fde047', roughness: 0.25, metalness: 0.65 })
  );
  lipRing.rotation.x = Math.PI / 2;
  lipRing.position.y = BOWL_H + 0.06;

  bowlRoot.add(foot, outerBody, innerWall, lipRing);
}

// 매콤하고 영롱한 주황빛 고추기름 짬뽕 국물 수면 (검붉지 않은 맛있는 다홍·주황빛!)
const brothTex = makeCanvasTexture(512, 512, (g, w, h) => {
  const grad = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
  grad.addColorStop(0, '#ff7b24');
  grad.addColorStop(0.62, '#f04e18');
  grad.addColorStop(1, '#c7350e');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  // 반짝이는 고추기름 동그라미들
  for (let i = 0; i < 65; i++) {
    const a = (i * 2.39996);
    const rad = Math.sqrt(i / 65) * (w * 0.43);
    const ox = w / 2 + Math.cos(a) * rad;
    const oy = h / 2 + Math.sin(a) * rad;
    const rr = 5 + (i % 5) * 3.5;
    g.fillStyle = i % 3 === 0 ? 'rgba(255, 214, 102, 0.42)' : 'rgba(255, 145, 55, 0.38)';
    g.beginPath();
    g.arc(ox, oy, rr, 0, TAU);
    g.fill();
  }
});
const brothMesh = new THREE.Mesh(
  new THREE.CircleGeometry(BOWL_R - 0.28, 40),
  new THREE.MeshPhysicalMaterial({
    map: brothTex,
    roughness: 0.14,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  })
);
brothMesh.rotation.x = -Math.PI / 2;
brothMesh.position.y = 2.32;
bowlRoot.add(brothMesh);

// 평상시 짬뽕 고명 그룹 (노란 면발 뭉치, 오징어 링, 초록 청경채, 홍합)
const normalToppings = new THREE.Group();
normalToppings.position.y = 2.34;
bowlRoot.add(normalToppings);
{
  const noodleMat = new THREE.MeshStandardMaterial({ color: '#fcd34d', roughness: 0.36 });
  for (let i = 0; i < 9; i++) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(1.1 + (i % 3) * 0.45, 0.16, 8, 20), noodleMat);
    loop.rotation.set(Math.PI / 2 + (i % 2) * 0.18, i * 0.7, i * 0.4);
    loop.position.set(Math.cos(i * 0.9) * 1.15, 0.05 + (i % 3) * 0.06, Math.sin(i * 0.9) * 1.15);
    normalToppings.add(loop);
  }
  // 하얀 오징어 링 2개 & 초록 청경채 잎 3개
  const squidMat = new THREE.MeshStandardMaterial({ color: '#fff1f2', roughness: 0.3 });
  for (const [sx, sz] of [[-1.9, 1.2], [2.1, -0.9]]) {
    const sq = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.17, 10, 18), squidMat);
    sq.rotation.x = Math.PI / 2 - 0.15;
    sq.position.set(sx, 0.14, sz);
    normalToppings.add(sq);
  }
  const vegMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.42 });
  for (const [vx, vz, vr] of [[-2.4, -1.3, 0.4], [1.6, 1.9, -0.8], [0.2, -2.5, 1.2]]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), vegMat);
    leaf.scale.set(1.35, 0.25, 0.85);
    leaf.rotation.y = vr;
    leaf.position.set(vx, 0.12, vz);
    normalToppings.add(leaf);
  }
}

// 😈 사악한 짬뽕 얼굴 파츠 (홍합 껍데기 눈매 + 황금 매운 기름 안광 + 씨익— 올라가는 홍고추·오징어 입꼬리!)
const evilFaceGroup = new THREE.Group();
evilFaceGroup.position.y = 2.38;
evilFaceGroup.visible = false;
bowlRoot.add(evilFaceGroup);

const musselShellMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.28, metalness: 0.45 });
const evilGlowEyeMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
const chiliSmileMat = new THREE.MeshStandardMaterial({
  color: '#ff1e00',
  emissive: '#dc2626',
  emissiveIntensity: 0.55,
  roughness: 0.22,
});
const fangSquidMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

const evilEyeL = new THREE.Group();
const evilEyeR = new THREE.Group();
const grinSegments = [];
const grinFangs = [];

{
  // 왼쪽 사악한 홍합 눈 (매섭게 치켜뜬 검은 홍합 눈썹 + 불타는 황금 매운 안광!)
  const shellL = new THREE.Mesh(new THREE.SphereGeometry(1.32, 16, 12), musselShellMat);
  shellL.scale.set(1.32, 0.42, 0.82);
  shellL.position.y = 0.30;
  const pupilL = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.35, 3), evilGlowEyeMat);
  pupilL.rotation.x = -Math.PI / 2;
  pupilL.rotation.z = -0.38;
  pupilL.position.set(0.16, 0.56, 0.18);
  const browL = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.38, 0.58), musselShellMat);
  browL.rotation.y = -0.42;
  browL.position.set(0.15, 0.68, -0.28);
  evilEyeL.add(shellL, pupilL, browL);
  evilEyeL.position.set(-1.72, 0, -1.05);

  // 오른쪽 사악한 홍합 눈
  const shellR = shellL.clone();
  const pupilR = new THREE.Mesh(new THREE.ConeGeometry(0.68, 1.35, 3), evilGlowEyeMat);
  pupilR.rotation.x = -Math.PI / 2;
  pupilR.rotation.z = 0.38;
  pupilR.position.set(-0.16, 0.56, 0.18);
  const browR = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.38, 0.58), musselShellMat);
  browR.rotation.y = 0.42;
  browR.position.set(-0.15, 0.68, -0.28);
  evilEyeR.add(shellR, pupilR, browR);
  evilEyeR.position.set(1.72, 0, -1.05);

  evilFaceGroup.add(evilEyeL, evilEyeR);

  // "씨익—" 비대칭으로 사악하게 올라가는 홍고추 입꼬리 (11개 세그먼트 + 진한 배경 입안 + 하얀 오징어 송곳니 6개!)
  const segCount = 11;
  for (let i = 0; i < segCount; i++) {
    const u = (i / (segCount - 1)) * 2 - 1; // -1.0 ~ +1.0
    const r = 0.52 - Math.abs(u) * 0.16;
    const segGroup = new THREE.Group();
    const darkBase = new THREE.Mesh(new THREE.SphereGeometry(r * 1.28, 12, 10), musselShellMat);
    darkBase.scale.set(1.38, 0.45, 1.15);
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), chiliSmileMat);
    seg.scale.set(1.35, 0.72, 1.0);
    seg.position.y = 0.12;
    segGroup.add(darkBase, seg);
    evilFaceGroup.add(segGroup);
    grinSegments.push({ mesh: segGroup, u });
  }

  for (let i = 0; i < 6; i++) {
    const u = -0.68 + (i / 5) * 1.36;
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.85, 4), fangSquidMat);
    fang.rotation.x = -Math.PI / 2;
    evilFaceGroup.add(fang);
    grinFangs.push({ mesh: fang, u });
  }
}

// grinT (0: 일자 무표정 → 1: 오른쪽 입꼬리가 확 치켜올라가며 "씨익—😈" 비웃는 사악한 곡선!)
function updateEvilGrinPose(emergeT, grinT) {
  const e = easeOutBack(clamp(emergeT, 0, 1));
  evilFaceGroup.visible = emergeT > 0.02;
  evilFaceGroup.position.y = lerp(1.85, 2.48, e);
  normalToppings.visible = emergeT < 0.35; // 사악한 표정이 뜰 때는 면발이 가리지 않게 국물 아래로 잠수!
  normalToppings.position.y = lerp(2.34, 1.75, clamp(emergeT, 0, 1));

  const g = easeOutBack(clamp(grinT, 0, 1));
  for (const item of grinSegments) {
    const u = item.u;
    const x = u * (2.45 + g * 0.65);
    const smileCurve = (u * u) * (1.55 * g) + (u > 0 ? Math.pow(u, 1.5) * 0.85 * g : 0);
    const z = 1.95 - smileCurve;
    item.mesh.position.set(x, 0.22, z);
  }
  for (let i = 0; i < grinFangs.length; i++) {
    const f = grinFangs[i];
    const u = f.u;
    const x = u * (2.15 + g * 0.50);
    const smileCurve = (u * u) * (1.42 * g) + (u > 0 ? Math.pow(u, 1.5) * 0.72 * g : 0);
    const z = 1.55 - smileCurve;
    f.mesh.position.set(x, 0.42, z);
    f.mesh.scale.setScalar(clamp(g * 1.15, 0.01, 1.0));
  }
}

// 모락모락 피어오르는 입체 김 입자들
const steamPuffs = [];
const steamGeo = new THREE.SphereGeometry(0.65, 10, 8);
for (let i = 0; i < 8; i++) {
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false });
  const m = new THREE.Mesh(steamGeo, mat);
  scene.add(m);
  steamPuffs.push({ mesh: m, mat, phase: i / 8 });
}

// ─── 3. 거대 원목 나무 젓가락 & 들어 올려지는 면발 다발 ───
const chopsticksGroup = new THREE.Group();
chopsticksGroup.position.set(0, 3.2, BOWL_Z);
chopsticksGroup.visible = false;
scene.add(chopsticksGroup);

const woodStickMat = new THREE.MeshStandardMaterial({ color: '#d49b62', roughness: 0.42 });
const stickUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, 13.5, 12), woodStickMat);
stickUpper.rotation.z = 1.18;
stickUpper.position.set(5.2, 2.8, -0.35);
stickUpper.castShadow = true;

const stickLower = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, 13.5, 12), woodStickMat);
stickLower.rotation.z = 1.28;
stickLower.position.set(5.3, 2.1, 0.35);
stickLower.castShadow = true;
chopsticksGroup.add(stickUpper, stickLower);

// 젓가락 끝에 걸려 딸려 올라오는 탱글탱글한 면발 다발
const liftedNoodlesGroup = new THREE.Group();
chopsticksGroup.add(liftedNoodlesGroup);
{
  const liftedMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.28 });
  for (let i = 0; i < 7; i++) {
    const strand = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 2.3 + (i % 3) * 0.45, 5, 8), liftedMat);
    strand.position.set((i - 3) * 0.24, -1.25 - (i % 2) * 0.2, (i % 2 - 0.5) * 0.22);
    strand.rotation.z = Math.sin(i * 1.7) * 0.16;
    strand.castShadow = true;
    liftedNoodlesGroup.add(strand);
  }
}

// ─── 4. 플레이어 기체: 새하얀 순백 3D 티셔츠 & 국물 얼룩 자국 ───
const playerGroup = new THREE.Group();
playerGroup.position.set(0, 0.38, 5.6);
scene.add(playerGroup);

const shirtTiltGroup = new THREE.Group();
playerGroup.add(shirtTiltGroup);

const shirtPureMat = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  emissive: '#f8fafc',
  emissiveIntensity: 0.18,
  roughness: 0.38,
});
const shirtTrimMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.45 });
const coreGlowMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
const coreRingMat = new THREE.MeshBasicMaterial({ color: '#0284c7', transparent: true, opacity: 0.65, side: THREE.DoubleSide });
const stainOrangeMat = new THREE.MeshBasicMaterial({ color: '#f97316' });
const stainEdgeMat = new THREE.MeshBasicMaterial({ color: '#fdba74', transparent: true, opacity: 0.65 });

const stainMeshes = []; // 맞을 때마다 하나씩 드러나는 3개의 국물 얼룩!
{
  // 밝은 식탁보 위에서도 반팔 흰 티셔츠 실루엣이 칼같이 선명하게 보이도록 진남색 입체 아웃라인 받침 추가!
  const shirtOutlineMat = new THREE.MeshBasicMaterial({ color: '#1e293b' });
  const bodyOutline = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.30, 2.62), shirtOutlineMat);
  bodyOutline.position.y = -0.06;
  const sleeveOutGeo = new THREE.BoxGeometry(1.18, 0.28, 1.16);
  const sleeveOutL = new THREE.Mesh(sleeveOutGeo, shirtOutlineMat);
  sleeveOutL.position.set(-1.36, -0.07, -0.58);
  sleeveOutL.rotation.y = 0.46;
  const sleeveOutR = new THREE.Mesh(sleeveOutGeo, shirtOutlineMat);
  sleeveOutR.position.set(1.36, -0.07, -0.58);
  sleeveOutR.rotation.y = -0.46;
  shirtTiltGroup.add(bodyOutline, sleeveOutL, sleeveOutR);

  // 몸통 + 반팔 양쪽 소매 + 라운드 넥 칼라
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.38, 2.35), shirtPureMat);
  body.castShadow = true;
  body.receiveShadow = true;

  const sleeveGeo = new THREE.BoxGeometry(0.95, 0.34, 0.92);
  const sleeveL = new THREE.Mesh(sleeveGeo, shirtPureMat);
  sleeveL.position.set(-1.32, -0.01, -0.58);
  sleeveL.rotation.y = 0.46;
  sleeveL.castShadow = true;

  const sleeveR = new THREE.Mesh(sleeveGeo, shirtPureMat);
  sleeveR.position.set(1.32, -0.01, -0.58);
  sleeveR.rotation.y = -0.46;
  sleeveR.castShadow = true;

  // 목 둘레 시보리 & 파인 목 구멍
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.11, 10, 22), shirtTrimMat);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.set(0, 0.20, -0.96);
  const neckHole = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), new THREE.MeshBasicMaterial({ color: '#cbd5e1' }));
  neckHole.rotation.x = -Math.PI / 2;
  neckHole.position.set(0, 0.205, -0.96);

  // 정밀 회피 중심 코어 (배 위쪽 명치 자리 — 빛나는 하늘색 보석 코어!)
  const coreDot = new THREE.Mesh(new THREE.CylinderGeometry(SHIRT_CORE_R * 0.72, SHIRT_CORE_R * 0.72, 0.08, 20), coreGlowMat);
  coreDot.position.set(0, 0.22, 0.08);
  const coreRing = new THREE.Mesh(new THREE.RingGeometry(SHIRT_CORE_R * 0.95, SHIRT_CORE_R * 1.18, 24), coreRingMat);
  coreRing.rotation.x = -Math.PI / 2;
  coreRing.position.set(0, 0.215, 0.08);

  shirtTiltGroup.add(body, sleeveL, sleeveR, collarRing, neckHole, coreDot, coreRing);

  // 피격 시 티셔츠 위에 실제로 남는 동그란 주황 국물 얼룩 3단계!
  const stainSpecs = [
    { x: -0.62, z: 0.68, r: 0.32 }, // 1타: 왼쪽 밑단에 한 방울 톡!
    { x: 0.65, z: -0.35, r: 0.38 }, // 2타: 오른쪽 가슴팍에 두 방울!
    { x: 0.02, z: 0.10, r: 0.68 },  // 3타(치명타): 정중앙 명치에 왕건이 국물 얼룩!
  ];
  for (const sp of stainSpecs) {
    const sg = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.CircleGeometry(sp.r * 1.32, 18), stainEdgeMat);
    outer.rotation.x = -Math.PI / 2;
    const inner = new THREE.Mesh(new THREE.CircleGeometry(sp.r, 18), stainOrangeMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.004;
    sg.add(outer, inner);
    sg.position.set(sp.x, 0.23, sp.z);
    sg.visible = false;
    shirtTiltGroup.add(sg);
    stainMeshes.push(sg);
  }
}

// ─── 5. 입체 주황 국물 탄막 방울 공유 지오메트리 & 재질 ───
// 피로 보이지 않는 쨍하고 먹음직스러운 매콤 주황·금빛 고추기름 방울!
const dropletGeo = new THREE.SphereGeometry(1, 16, 12);
const dropletHighlightGeo = new THREE.SphereGeometry(0.28, 8, 8);
const dropletShadowGeo = new THREE.CircleGeometry(1, 16);

const matDropSmall = new THREE.MeshPhysicalMaterial({
  color: '#ff8c1a',
  emissive: '#ea580c',
  emissiveIntensity: 0.32,
  roughness: 0.10,
  clearcoat: 1.0,
});
const matDropNormal = new THREE.MeshPhysicalMaterial({
  color: '#ff6214',
  emissive: '#d9480f',
  emissiveIntensity: 0.36,
  roughness: 0.10,
  clearcoat: 1.0,
});
const matDropBig = new THREE.MeshPhysicalMaterial({
  color: '#ff4500',
  emissive: '#f59e0b',
  emissiveIntensity: 0.45,
  roughness: 0.08,
  clearcoat: 1.0,
});
const matDropSplitter = new THREE.MeshPhysicalMaterial({
  color: '#fbbf24',
  emissive: '#ff3b00',
  emissiveIntensity: 0.58,
  roughness: 0.06,
  clearcoat: 1.0,
});
const matHighlight = new THREE.MeshBasicMaterial({ color: '#fffbeb' });
const matDropShadow = new THREE.MeshBasicMaterial({ color: '#7c2d12', transparent: true, opacity: 0.22, depthWrite: false });

// ─── 난수 생성기 ───
let rngState = 20261125;
function seedRng(s) {
  rngState = (Number(s) || 1) >>> 0;
  if (rngState === 0) rngState = 1;
}
function nextRand() {
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  return ((rngState >>> 0) % 1000000) / 1000000;
}

// ─── 생존 시간에 따른 단계(Stage) & 공격 주기 정보 ───
function getStageInfo(sec) {
  if (sec < 9) {
    return { lv: 1, cls: '', label: 'LV.1 첫 젓가락', interval: 1.38 };
  }
  if (sec < 20) {
    return { lv: 2, cls: '', label: 'LV.2 폭풍 면치기', interval: 1.15 };
  }
  if (sec < 34) {
    return { lv: 3, cls: 'lv3', label: 'LV.3 후루룩 경보', interval: 0.96 };
  }
  if (sec < 50) {
    return { lv: 4, cls: 'lv4', label: 'LV.4 곱빼기 소용돌이', interval: 0.82 };
  }
  if (sec < 68) {
    return { lv: 5, cls: 'lv5', label: 'LV.5 사악한 완뽕 폭주', interval: 0.70 };
  }
  return {
    lv: 6,
    cls: 'lv5',
    label: 'LV.6 전설의 순백 수호신',
    interval: Math.max(0.54, 0.68 - (sec - 68) * 0.003),
  };
}

// ─── 전체 게임 상태 ───
const STATE = {
  phase: 'menu', // 'menu' | 'intro' | 'play' | 'gameover'
  introTime: 0,
  introBellPlayed: false,
  introOrderPlayed: false,
  introLaughPlayed: false,

  survivedSec: 0,
  currentLv: 1,
  hitsTaken: 0,        // 0 ~ 3 (3방울 맞으면 끝!)
  invulnTimer: 0,      // 피격 직후 짧은 무적 보호
  chopstickCount: 0,   // 총 젓가락질 공격 횟수
  grazeCount: 0,       // 아슬아슬 근접 회피 횟수

  // 젓가락 애니메이션 & 발사 타이머
  attackTimer: 0.55,
  chopAnimT: 1.0,      // 0 ~ 1 한 번의 젓가락질 모션 진행도
  pendingShotFired: true,
  pendingPattern: 'fan',
  bossEvilTimer: 0,    // 대왕 패턴 시 사악한 얼굴 잠시 출현
  slurpBannerTimer: 0,

  // 플레이어 위치 및 입력
  px: 0,
  pz: 5.8,
  vx: 0,
  vz: 0,
  dragging: false,
  pointerId: null,
  lastClientX: 0,
  lastClientY: 0,
  keys: new Set(),

  droplets: [],        // 활성 국물 탄막 배열
  splashes: [],        // 튀기는 작은 물방울/스파크 입자
  popTexts: [],        // 2D 플로팅 텍스트
  camShake: 0,

  incomingRef: null,
  lastFinalRun: null,
  lastShareData: null,
};

// ─── 국물 탄막 방울 생성기 ───
function spawnDroplet({
  x, z, vx, vz, radius = 0.45, kind = 'normal', curveRate = 0, splitAfter = 0,
}) {
  const mat = kind === 'splitter' ? matDropSplitter
    : kind === 'big' ? matDropBig
    : kind === 'small' ? matDropSmall
    : matDropNormal;

  const group = new THREE.Group();
  const body = new THREE.Mesh(dropletGeo, mat);
  body.scale.set(radius, radius * 0.82, radius);
  body.position.y = radius * 0.72;

  const hl = new THREE.Mesh(dropletHighlightGeo, matHighlight);
  hl.scale.setScalar(radius);
  hl.position.set(-radius * 0.28, radius * 1.18, -radius * 0.25);

  const shadow = new THREE.Mesh(dropletShadowGeo, matDropShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.setScalar(radius * 0.95);
  shadow.position.y = 0.03;

  group.add(body, hl, shadow);
  group.position.set(x, 0, z);
  scene.add(group);

  STATE.droplets.push({
    group,
    body,
    x,
    z,
    vx,
    vz,
    radius,
    hitR: radius * 0.74, // 억울한 피격이 없도록 시각 반경의 74%를 정밀 피격원 반지름으로 사용!
    kind,
    curveRate,
    age: 0,
    splitAfter,
    grazed: false,
  });
}

function removeDropletAt(idx) {
  const d = STATE.droplets[idx];
  if (!d) return;
  scene.remove(d.group);
  STATE.droplets.splice(idx, 1);
}

function clearAllDroplets() {
  for (const d of STATE.droplets) scene.remove(d.group);
  STATE.droplets = [];
  for (const sp of STATE.splashes) {
    scene.remove(sp.mesh);
    sp.mat.dispose();
  }
  STATE.splashes = [];
}

// 튀는 물방울 / 아슬 스파크 이펙트
const sparkGeo = new THREE.SphereGeometry(0.16, 8, 6);
function spawnBurstParticles(x, z, colorHex, count = 10, speedScale = 1.0) {
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(sparkGeo, mat);
    mesh.position.set(x, 0.45, z);
    const ang = (i / count) * TAU + nextRand() * 0.4;
    const spd = (4.5 + nextRand() * 6.5) * speedScale;
    scene.add(mesh);
    STATE.splashes.push({
      mesh,
      mat,
      vx: Math.cos(ang) * spd,
      vy: 4.5 + nextRand() * 5.5,
      vz: Math.sin(ang) * spd,
      age: 0,
      dur: 0.42,
    });
  }
}

function showSlurpAlert(msg) {
  const el = $('slurp-alert');
  const txt = $('slurp-alert-txt');
  if (!el || !txt) return;
  txt.textContent = msg;
  el.classList.add('show');
  STATE.slurpBannerTimer = 1.25;
}

function setGuidePill(msg, mode = '') {
  const el = $('guide-pill');
  if (!el) return;
  el.textContent = msg;
  el.className = 'guide-pill' + (mode ? ' ' + mode : '');
}

function addPopText(text, color = '#fde047', subText = '', yRatio = 0.34, scale = 1.0) {
  STATE.popTexts.length = 0;
  STATE.popTexts.push({ text, subText, color, yRatio, scale, age: 0, dur: 0.88 });
}

// ─── 젓가락질 공격 발동! (버틴 시간이 길어질수록 개수·크기·패턴이 흉악하게 진화!) ───
function startChopstickCycle() {
  STATE.chopstickCount += 1;
  STATE.chopAnimT = 0;
  STATE.pendingShotFired = false;

  const lv = getStageInfo(STATE.survivedSec).lv;
  const n = STATE.chopstickCount;

  // 단계별 패턴 선택
  let pat = 'fan';
  const r = nextRand();
  if (lv === 1) {
    pat = (n % 3 === 0) ? 'aim_mix' : 'fan';
  } else if (lv === 2) {
    if (r < 0.35) pat = 'big_aim';
    else if (r < 0.68) pat = 'double_fan';
    else pat = 'fan';
  } else if (lv === 3) {
    if (r < 0.34) pat = 'slurp_stream';
    else if (r < 0.68) pat = 'giant_mix';
    else pat = 'double_fan';
  } else if (lv === 4) {
    if (r < 0.34) pat = 'splitter_bomb';
    else if (r < 0.68) pat = 'spiral_whirl';
    else pat = 'slurp_stream';
  } else {
    if (r < 0.30) pat = 'splitter_bomb';
    else if (r < 0.58) pat = 'spiral_whirl';
    else if (r < 0.82) pat = 'giant_mix';
    else pat = 'slurp_stream';
  }

  STATE.pendingPattern = pat;

  if (pat === 'slurp_stream') {
    SFX.slurpWarn();
    showSlurpAlert('⚠️ 후루룩 주의!! 고속 국물 물줄기!!');
    STATE.bossEvilTimer = 1.3;
  } else if (pat === 'splitter_bomb') {
    SFX.slurpWarn();
    showSlurpAlert('💥 특대 고추기름 왕방울!! 중간에 터집니다!!');
    STATE.bossEvilTimer = 1.5;
  } else if (pat === 'giant_mix' && lv >= 3) {
    showSlurpAlert('🔥 왕건이 국물 방울 세례!! 크기 주의!!');
  }
}

// 젓가락이 면을 번쩍 들어 올리는 정점(chopAnimT >= 0.26)에서 실제 국물 탄막 발사!
function fireChopstickBarrage() {
  const sec = STATE.survivedSec;
  const stage = getStageInfo(sec);
  const lv = stage.lv;
  const pat = STATE.pendingPattern;

  const originX = (nextRand() - 0.5) * 1.4;
  const originZ = BOWL_Z + 2.2;
  const aimAngle = Math.atan2(STATE.px - originX, STATE.pz - originZ); // +Z 방향 기준 각도
  const speedScale = 1.0 + Math.min(0.68, sec * 0.0085);
  const sizeBoost = 1.0 + Math.min(0.32, sec * 0.0038);

  SFX.chopstickSnap(clamp(lv / 5, 0.3, 1.0));
  spawnBurstParticles(originX, originZ, '#ff7b24', 8, 0.9);
  STATE.camShake = Math.max(STATE.camShake, 0.07);

  if (pat === 'fan') {
    // 1) 기본 부채꼴: 시간이 갈수록 방울 개수(5 → 13개)와 반지름 증가!
    const count = Math.min(13, 5 + Math.floor(sec / 6.5));
    const spread = (68 + Math.min(28, sec * 0.45)) * DEG;
    const baseSpd = 8.4 * speedScale;
    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0 : (i / (count - 1)) - 0.5;
      const ang = clamp(aimAngle * 0.45, -0.35, 0.35) + u * spread;
      const isBig = lv >= 2 && (i === Math.floor(count / 2));
      const rad = (isBig ? 0.72 : 0.43) * sizeBoost;
      spawnDroplet({
        x: originX,
        z: originZ,
        vx: Math.sin(ang) * baseSpd,
        vz: Math.cos(ang) * baseSpd,
        radius: rad,
        kind: isBig ? 'big' : 'normal',
      });
    }
  } else if (pat === 'aim_mix' || pat === 'big_aim') {
    // 2) 플레이어 조준 왕방울 + 양옆 호위 잔방울!
    const sideCnt = 4 + lv * 2;
    const baseSpd = 9.0 * speedScale;
    // 중앙 묵직한 왕방울
    spawnDroplet({
      x: originX,
      z: originZ,
      vx: Math.sin(aimAngle) * (baseSpd * 1.06),
      vz: Math.cos(aimAngle) * (baseSpd * 1.06),
      radius: (pat === 'big_aim' ? 0.86 : 0.66) * sizeBoost,
      kind: 'big',
    });
    for (let i = 0; i < sideCnt; i++) {
      const u = (i / (sideCnt - 1)) - 0.5;
      const ang = aimAngle + u * (84 * DEG);
      if (Math.abs(u) < 0.08) continue;
      spawnDroplet({
        x: originX,
        z: originZ,
        vx: Math.sin(ang) * (baseSpd * 0.92),
        vz: Math.cos(ang) * (baseSpd * 0.92),
        radius: 0.36 * sizeBoost,
        kind: 'small',
      });
    }
  } else if (pat === 'double_fan') {
    // 3) 엇갈리는 2단 파동 부채꼴 (빠른 잔방울 + 느리고 큼직한 중간방울!)
    const countA = 6 + lv;
    const countB = 5 + lv;
    const spdFast = 10.2 * speedScale;
    const spdSlow = 7.4 * speedScale;
    for (let i = 0; i < countA; i++) {
      const ang = ((i / (countA - 1)) - 0.5) * (88 * DEG);
      spawnDroplet({
        x: originX, z: originZ,
        vx: Math.sin(ang) * spdFast,
        vz: Math.cos(ang) * spdFast,
        radius: 0.35 * sizeBoost,
        kind: 'small',
      });
    }
    for (let i = 0; i < countB; i++) {
      const ang = ((i / (countB - 1)) - 0.5) * (74 * DEG);
      spawnDroplet({
        x: originX, z: originZ,
        vx: Math.sin(ang) * spdSlow,
        vz: Math.cos(ang) * spdSlow,
        radius: 0.58 * sizeBoost,
        kind: 'normal',
      });
    }
  } else if (pat === 'slurp_stream') {
    // 4) 후루룩 폭풍 물줄기! 면 꼬리가 요동치며 3갈래 고속 연사 + 왕방울 섞임
    const waves = 4 + Math.min(3, Math.floor(lv / 2));
    const baseSpd = 11.2 * speedScale;
    for (let w = 0; w < waves; w++) {
      const delayRatio = 1 - w * 0.085;
      const wobble = Math.sin(w * 1.4) * 0.14;
      for (const side of [-0.34, 0, 0.34]) {
        const ang = clamp(aimAngle * 0.75, -0.5, 0.5) + side + wobble;
        const isHead = (w === 0 && side === 0);
        spawnDroplet({
          x: originX,
          z: originZ,
          vx: Math.sin(ang) * baseSpd * delayRatio,
          vz: Math.cos(ang) * baseSpd * delayRatio,
          radius: (isHead ? 0.88 : 0.39) * sizeBoost,
          kind: isHead ? 'big' : 'normal',
        });
      }
    }
  } else if (pat === 'giant_mix') {
    // 5) 대왕·중간·잔방울 혼합 폭격 (크기가 제각각이라 빈틈 찾기가 훨씬 쫄깃함!)
    const total = 10 + lv * 2;
    for (let i = 0; i < total; i++) {
      const u = (i / (total - 1)) - 0.5;
      const ang = u * (96 * DEG) + (nextRand() - 0.5) * 0.08;
      const tier = i % 4;
      const rad = (tier === 0 ? 0.94 : tier === 2 ? 0.56 : 0.33) * sizeBoost;
      const spd = (tier === 0 ? 8.0 : tier === 2 ? 9.4 : 10.8) * speedScale;
      spawnDroplet({
        x: originX,
        z: originZ,
        vx: Math.sin(ang) * spd,
        vz: Math.cos(ang) * spd,
        radius: rad,
        kind: tier === 0 ? 'big' : tier === 2 ? 'normal' : 'small',
      });
    }
  } else if (pat === 'spiral_whirl') {
    // 6) 면발 돌돌 말기 소용돌이(휘어지는 곡선 탄막!)
    const count = 11 + lv * 2;
    const spinDir = STATE.chopstickCount % 2 === 0 ? 1 : -1;
    const baseSpd = 8.8 * speedScale;
    for (let i = 0; i < count; i++) {
      const u = (i / (count - 1)) - 0.5;
      const ang = u * (94 * DEG);
      spawnDroplet({
        x: originX,
        z: originZ,
        vx: Math.sin(ang) * baseSpd,
        vz: Math.cos(ang) * baseSpd,
        radius: (i % 3 === 0 ? 0.62 : 0.38) * sizeBoost,
        kind: i % 3 === 0 ? 'big' : 'normal',
        curveRate: spinDir * 0.36,
      });
    }
  } else if (pat === 'splitter_bomb') {
    // 7) 초대형 고추기름 분열탄!! 아레나 한가운데로 굴러오다 펑! 8방향 분열!
    const bombCnt = lv >= 5 ? 2 : 1;
    for (let b = 0; b < bombCnt; b++) {
      const offsetAng = bombCnt === 1 ? clamp(aimAngle * 0.6, -0.35, 0.35) : (b === 0 ? -0.28 : 0.28);
      const spd = 7.4 * speedScale;
      spawnDroplet({
        x: originX,
        z: originZ,
        vx: Math.sin(offsetAng) * spd,
        vz: Math.cos(offsetAng) * spd,
        radius: 1.18 * Math.min(1.2, sizeBoost),
        kind: 'splitter',
        splitAfter: 0.92 + b * 0.16,
      });
    }
    // 양옆 견제 방울
    for (const side of [-0.62, -0.44, 0.44, 0.62]) {
      spawnDroplet({
        x: originX,
        z: originZ,
        vx: Math.sin(side) * 9.2 * speedScale,
        vz: Math.cos(side) * 9.2 * speedScale,
        radius: 0.42 * sizeBoost,
        kind: 'normal',
      });
    }
  }
}

// ─── 플레이어 조작 (어디든 드래그 시 손가락에 가리지 않는 1:1 상대 이동 + 키보드 WASD/방향키) ───
function screenDeltaToArenaScale() {
  // 현재 화면 세로 크기가 월드 Z 몇 유닛에 해당하는지 비례 환산
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const baseSpan = aspect < 0.75 ? 27.5 : 23.5;
  return (baseSpan / Math.max(320, window.innerHeight)) * 1.18;
}

glCanvas.addEventListener('pointerdown', e => {
  unlockAudio();
  if (STATE.phase !== 'play') return;
  if (STATE.dragging) return;
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

  const scale = screenDeltaToArenaScale();
  const nextX = clamp(STATE.px + dx * scale, -ARENA_HALF_X, ARENA_HALF_X);
  const nextZ = clamp(STATE.pz + dy * scale, ARENA_MIN_Z, ARENA_MAX_Z);
  STATE.vx = (nextX - STATE.px) * 18;
  STATE.vz = (nextZ - STATE.pz) * 18;
  STATE.px = nextX;
  STATE.pz = nextZ;
});

function endDrag(e) {
  if (!STATE.dragging || (e && e.pointerId !== STATE.pointerId)) return;
  STATE.dragging = false;
  STATE.pointerId = null;
}
glCanvas.addEventListener('pointerup', endDrag);
glCanvas.addEventListener('pointercancel', endDrag);
glCanvas.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'shift'].includes(k)) {
    STATE.keys.add(k);
    if (STATE.phase === 'play') e.preventDefault();
  }
});
window.addEventListener('keyup', e => {
  STATE.keys.delete(e.key.toLowerCase());
});

// ─── HUD 갱신 ───
function updateHUD() {
  const st = getStageInfo(STATE.survivedSec);
  $('hud-time').textContent = `${STATE.survivedSec.toFixed(2)}초`;

  const stEl = $('hud-stage');
  stEl.textContent = st.label;
  stEl.className = 'stage-pill' + (st.cls ? ' ' + st.cls : '');

  const cleanPct = STATE.hitsTaken === 0 ? 100 : STATE.hitsTaken === 1 ? 65 : STATE.hitsTaken === 2 ? 30 : 0;
  const cleanEl = $('hud-clean-txt');
  cleanEl.textContent = `👕 깨끗함 ${cleanPct}%`;
  cleanEl.style.color = cleanPct === 100 ? '#7dd3fc' : cleanPct === 65 ? '#fde047' : '#fda4af';

  const shields = [];
  for (let i = 0; i < 3; i++) {
    shields.push(i < (3 - STATE.hitsTaken) ? '🤍' : '🟠');
  }
  $('hud-shields').textContent = shields.join('');
  $('hud-waves').textContent = `🥢 ${STATE.chopstickCount}젓가락 · ✨ 아슬 ${STATE.grazeCount}`;

  const inDanger = STATE.phase === 'play' && STATE.hitsTaken >= 2;
  $('jjam-card').classList.toggle('danger-pulse', inDanger);
  $('stain-vignette').classList.toggle('active', inDanger);
  BGM.setUrgent(inDanger || st.lv >= 4);
}

// ─── 시네마틱 인트로 & 본게임 시작 흐름 ───
function resetArenaState() {
  clearAllDroplets();
  STATE.survivedSec = 0;
  STATE.currentLv = 1;
  STATE.hitsTaken = 0;
  STATE.invulnTimer = 0;
  STATE.chopstickCount = 0;
  STATE.grazeCount = 0;
  STATE.attackTimer = 0.45;
  STATE.chopAnimT = 1.0;
  STATE.pendingShotFired = true;
  STATE.bossEvilTimer = 0;
  STATE.slurpBannerTimer = 0;

  STATE.px = 0;
  STATE.pz = 6.2;
  STATE.vx = 0;
  STATE.vz = 0;
  STATE.dragging = false;
  STATE.pointerId = null;
  STATE.popTexts = [];
  STATE.camShake = 0;

  playerGroup.position.set(STATE.px, 0.38, STATE.pz);
  playerGroup.visible = true;
  shirtTiltGroup.rotation.set(0, 0, 0);
  stainMeshes.forEach(m => { m.visible = false; });
  $('slurp-alert').classList.remove('show');
}

function startIntroSequence() {
  unlockAudio();
  BGM.stop();
  resetArenaState();

  const seed = IS_REC ? 20261125 : ((Date.now() ^ Math.floor(Math.random() * 999999)) >>> 0);
  seedRng(seed);

  STATE.phase = 'intro';
  STATE.introTime = 0;
  STATE.introBellPlayed = false;
  STATE.introOrderPlayed = false;
  STATE.introLaughPlayed = false;

  playerGroup.visible = false;
  chopsticksGroup.visible = false;
  introCustomerGroup.visible = true;
  bowlRoot.position.set(0, -8.0, BOWL_Z); // 주문 전에는 아직 식탁 아래에 대기!
  updateEvilGrinPose(0, 0);
  bossEvilLight.intensity = 0;

  $('start-modal').classList.add('hidden');
  $('result-modal').classList.add('hidden');
  $('jjam-hud').classList.add('hidden');
  $('bottom-guide').classList.add('hidden');
  $('topbar').style.display = 'none';
  $('intro-layer').classList.remove('hidden');

  $('intro-speaker').textContent = '👕 나 (새하얀 순백 티셔츠 착용)';
  $('intro-line').textContent = '딸랑~! 하필 오늘 아끼는 새하얀 흰 티를 입었는데…';
}

function beginBattleFromIntroOrDirect(reseed = false) {
  unlockAudio();
  if (reseed) {
    const seed = IS_REC ? 20261125 : ((Date.now() ^ Math.floor(Math.random() * 999999)) >>> 0);
    seedRng(seed);
  }
  resetArenaState();

  STATE.phase = 'play';
  introCustomerGroup.visible = false;
  menuBoardMesh.position.set(-11.4, 0.08, 1.5);
  bowlRoot.position.set(0, 0, BOWL_Z);
  chopsticksGroup.visible = true;
  chopsticksGroup.position.set(0, 3.5, BOWL_Z);
  liftedNoodlesGroup.visible = false;
  updateEvilGrinPose(0, 0);
  bossEvilLight.intensity = 0;

  $('intro-layer').classList.add('hidden');
  $('start-modal').classList.add('hidden');
  $('result-modal').classList.add('hidden');
  $('topbar').style.display = '';
  $('topbar').style.opacity = '1';
  $('jjam-hud').classList.remove('hidden');
  $('bottom-guide').classList.remove('hidden');

  setGuidePill('화면을 드래그(또는 방향키)해 튀어오는 짬뽕 국물을 피하세요!', '');
  addPopText('🥢 국물 회피 시작!! 오래 버티세요!', '#fde047', '새하얀 흰 티를 사수하라!', 0.36, 1.04);
  updateHUD();

  if (!IS_REC && !BGM.isMuted()) {
    BGM.start('jjamppong');
  }
}

// ─── 칭호 및 랭킹 포맷 ───
function computeRankTitle(sec, waves, cleanLeft) {
  if (sec >= 60) {
    return {
      title: '👑 전설의 순백 방탄 티셔츠 신(神)',
      comment: `${sec.toFixed(2)}초 동안 폭주하는 짬뽕 국물 지옥에서 살아남았습니다! 중국집 사장님도 기립박수!`,
    };
  }
  if (sec >= 38) {
    return {
      title: '⚡ 고추기름을 가르는 회피 달인',
      comment: `무려 ${waves}번의 젓가락질 폭격을 버텨냈어요! 반사신경이 면발처럼 쫄깃합니다!`,
    };
  }
  if (sec >= 20) {
    return {
      title: '👕 세탁소 단골 아슬아슬 생존자',
      comment: '초반 후루룩 러시는 잘 넘겼는데 대왕 국물 방울에 그만… 흰 티 입은 날은 짜장면이요!',
    };
  }
  return {
    title: '🟠 첫 젓가락에 주황 물든 흰 티',
    comment: '…하필 제일 잘 보이는 명치 한복판에 튀었어요! 손가락을 빈 공간에서 부드럽게 굴려 보세요!',
  };
}

function formatLadderMetric(row) {
  const sec = Number(row.score || 0).toFixed(2);
  const wv = Math.round(Number(row.actual_value || 0));
  return wv > 0 ? `${sec}초 · ${wv}젓가락` : `${sec}초`;
}

async function triggerGameOver() {
  if (STATE.phase === 'gameover') return;
  STATE.phase = 'gameover';
  STATE.dragging = false;
  STATE.pointerId = null;
  BGM.setUrgent(false);
  $('stain-vignette').classList.remove('active');
  $('jjam-card').classList.remove('danger-pulse');
  $('slurp-alert').classList.remove('show');

  SFX.stainHit(true);
  setTimeout(() => SFX.evilLaugh(), 180);
  STATE.camShake = 0.42;

  // 보스 짬뽕이 다시 사악하게 씨익 웃으며 승리 선언!
  updateEvilGrinPose(1, 1);
  bossEvilLight.intensity = 16;

  const finalSec = Number(STATE.survivedSec.toFixed(2));
  addPopText(
    '🟠 으악!! 흰 티에 짬뽕 국물 직격!!',
    '#fb7185',
    `버틴 기록: ${finalSec.toFixed(2)}초 (${STATE.chopstickCount}젓가락 방어)`,
    0.35,
    1.05
  );

  const prevBestWaves = Number(localStorage.getItem(BEST_WAVES_KEY) || '0');
  if (STATE.chopstickCount > prevBestWaves) {
    localStorage.setItem(BEST_WAVES_KEY, String(STATE.chopstickCount));
  }

  const rk = computeRankTitle(finalSec, STATE.chopstickCount, 0);
  const isBest = updateBestRecord(GAME_ID, {
    score: finalSec,
    actualValue: STATE.chopstickCount,
    targetValue: STATE.grazeCount,
    rankTitle: rk.title,
  }, false);

  syncBestBadges();

  $('res-rank').textContent = isBest ? `${rk.title} · 신기록!` : rk.title;
  $('res-headline').textContent = `${finalSec.toFixed(2)}초 생존`;
  $('res-comment').textContent = rk.comment;
  $('res-time').textContent = `${finalSec.toFixed(2)}초`;
  $('res-waves').textContent = `${STATE.chopstickCount}회`;
  $('res-graze').textContent = `${STATE.grazeCount}회`;

  $('res-nick').value = getSavedNickname();

  STATE.lastFinalRun = {
    gameId: GAME_ID,
    nickname: $('res-nick').value || '익명 흰티족',
    targetValue: STATE.grazeCount,
    actualValue: STATE.chopstickCount,
    score: finalSec,
    errorMm: null,
    rankTitle: rk.title,
    seed: 1,
    meta: {
      survivedSec: finalSec,
      waves: STATE.chopstickCount,
      graze: STATE.grazeCount,
    },
  };

  setTimeout(async () => {
    if (STATE.phase !== 'gameover') return;
    $('bottom-guide').classList.add('hidden');
    $('result-modal').classList.remove('hidden');

    if (!IS_REC) {
      try {
        const saved = await saveResultAndBuildShare(STATE.lastFinalRun, STATE.incomingRef);
        STATE.lastShareData = saved;
        const lbWrap = $('res-lb-wrap');
        lbWrap.innerHTML = renderGlobalLadderHTML(saved, formatLadderMetric);
        lbWrap.style.display = 'block';
      } catch {
        // 오프라인 시 무시
      }
    }
  }, 950);
}

// ─── 플레이어 피격 및 아슬 회피(GRAZE) 판정 ───
function checkDropletCollisions(dt) {
  if (STATE.invulnTimer > 0) {
    STATE.invulnTimer = Math.max(0, STATE.invulnTimer - dt);
  }

  const coreX = STATE.px;
  const coreZ = STATE.pz + 0.08;

  for (let i = STATE.droplets.length - 1; i >= 0; i--) {
    const d = STATE.droplets[i];
    const dist = Math.hypot(d.x - coreX, d.z - coreZ);
    const hitDist = SHIRT_CORE_R + d.hitR;
    const grazeDist = hitDist + 0.78;

    // 1) 직격 판정!
    if (dist <= hitDist) {
      if (STATE.invulnTimer > 0) {
        spawnBurstParticles(d.x, d.z, '#fdba74', 5, 0.7);
        removeDropletAt(i);
        continue;
      }

      spawnBurstParticles(coreX, coreZ, '#f97316', 16, 1.25);
      removeDropletAt(i);

      STATE.hitsTaken += 1;
      const stainIdx = clamp(STATE.hitsTaken - 1, 0, stainMeshes.length - 1);
      stainMeshes[stainIdx].visible = true;

      if (STATE.hitsTaken >= 3) {
        updateHUD();
        triggerGameOver();
        return;
      }

      // 1~2타 피격: 얼룩이 남고 짧은 무적 부여 + 주변 너무 가까운 탄 살짝 정리
      SFX.stainHit(false);
      STATE.invulnTimer = 1.35;
      STATE.camShake = 0.28;
      for (let j = STATE.droplets.length - 1; j >= 0; j--) {
        const other = STATE.droplets[j];
        if (Math.hypot(other.x - coreX, other.z - coreZ) < 2.9) {
          removeDropletAt(j);
        }
      }

      const leftLives = 3 - STATE.hitsTaken;
      setGuidePill(
        leftLives === 2
          ? '🟠 앗! 흰 티 밑단에 한 방울 묻었어요! (2번 더 튀면 끝!)'
          : '🚨 비상!! 한 방울만 더 튀면 새하얀 흰 티 사망!!',
        'hit'
      );
      addPopText(
        leftLives === 2 ? '🟠 앗! 한 방울 튀었다!!' : '🚨 위험!! 마지막 순백 방어선!!',
        '#fb7185',
        `남은 여유 ${leftLives}방울`,
        0.38,
        0.96
      );
      updateHUD();
      continue;
    }

    // 2) 아슬아슬 스침 회피(GRAZE) 판정!
    if (!d.grazed && dist <= grazeDist && STATE.invulnTimer <= 0) {
      d.grazed = true;
      STATE.grazeCount += 1;
      SFX.graze();
      spawnBurstParticles(coreX, coreZ, '#38bdf8', 5, 0.65);
      setGuidePill(`✨ 아슬아슬 칼회피! (누적 아슬 ${STATE.grazeCount}회!)`, 'graze');
      addPopText('✨ 아슬!!', '#7dd3fc', '', 0.44, 0.85);
    }
  }
}

// ─── 반응형 카메라 연출 (메뉴 / 3막 인트로 / 본게임 아레나 완벽 피팅) ───
function computeArenaCameraPose() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const vFovRad = camera.fov * DEG;
  const tanHalfV = Math.tan(vFovRad * 0.5);
  const tanHalfH = tanHalfV * aspect;

  // 그릇 위쪽(z = -14.8)부터 아레나 아래쪽(z = +12.2)까지 HUD에 가리지 않고 100% 들어오는 거리 자동 산출!
  const pitch = 65 * DEG;
  const neededHalfWidth = 9.0;
  const neededHalfHeightProj = 13.8 * Math.sin(pitch);

  const distH = neededHalfWidth / Math.max(0.14, tanHalfH * 0.93);
  const distV = neededHalfHeightProj / Math.max(0.18, tanHalfV * 0.68);
  const dist = Math.max(distH, distV);

  const lookZ = -0.9;
  const camY = Math.sin(pitch) * dist;
  const camZ = lookZ + Math.cos(pitch) * dist;
  return { camY, camZ, lookZ };
}

function updateCameraAndIntro(dt, nowSec) {
  if (STATE.phase === 'intro') {
    STATE.introTime += dt;
    const t = STATE.introTime;

    // [1막: 0.0 ~ 1.65초] 중국집 문을 열고 식탁으로 입장 (흰 티 입은 뒷모습 + 홍등·전설의 반점 현판!)
    if (t < 1.65) {
      if (!STATE.introBellPlayed) {
        STATE.introBellPlayed = true;
        SFX.bell();
      }
      const u = easeOutCubic(t / 1.65);
      menuBoardMesh.position.set(1.5, 0.08, 4.2);
      camera.position.set(lerp(-3.2, -0.8, u), lerp(14.5, 11.8, u), lerp(28.5, 22.8, u));
      camera.lookAt(0, lerp(3.6, 2.8, u), lerp(-10.0, -5.0, u));
    }
    // [2막: 1.65 ~ 3.25초] "사장님 짬뽕이요!" 주문 → 대왕 짬뽕 그릇이 식탁 중앙에 쿵!! 착지!
    else if (t < 3.25) {
      if (!STATE.introOrderPlayed) {
        STATE.introOrderPlayed = true;
        SFX.gong();
        STATE.camShake = 0.28;
        $('intro-speaker').textContent = '🗣️ 주문 완료!';
        $('intro-line').textContent = '“사장님! 여기 얼큰한 해물짬뽕 곱빼기요!!” (쿵—!!)';
      }
      const u = clamp((t - 1.65) / 1.6, 0, 1);
      const dropU = easeOutBack(clamp(u * 2.2, 0, 1));
      bowlRoot.position.y = lerp(11.0, 0.0, dropU);
      menuBoardMesh.position.set(lerp(1.5, -11.4, easeOutCubic(u)), 0.08, lerp(4.2, 1.5, easeOutCubic(u)));

      let sx = 0, sy = 0;
      if (STATE.camShake > 0) {
        sx = Math.sin(nowSec * 65) * 0.45 * STATE.camShake;
        sy = Math.cos(nowSec * 78) * 0.35 * STATE.camShake;
      }
      camera.position.set(lerp(-0.8, 0, easeOutCubic(u)) + sx, lerp(11.8, 12.6, easeOutCubic(u)) + sy, lerp(22.8, 8.5, easeOutCubic(u)));
      camera.lookAt(0, 2.2, BOWL_Z + 1.0);
    }
    // [3막: 3.25 ~ 5.35초] 사악한 짬뽕 그릇 위쪽 정면 클로즈업 + 홍합 눈 번쩍 + 홍고추 입꼬리 "씨익—😈" 미소!
    else if (t < 5.35) {
      if (!STATE.introLaughPlayed) {
        STATE.introLaughPlayed = true;
        SFX.evilLaugh();
        $('intro-speaker').textContent = '😈 사악한 해물짬뽕 (보스 각성)';
        $('intro-line').textContent = '“크하하핫… 새하얀 흰 티를 입었군? 한 방울도 남김없이 튀겨주마!!”';
      }
      introCustomerGroup.visible = false;
      bowlRoot.position.y = 0;
      const subT = (t - 3.25) / 2.1;
      const emergeT = clamp(subT * 2.8, 0, 1);
      const grinT = clamp((subT - 0.12) * 2.1, 0, 1);
      updateEvilGrinPose(emergeT, grinT);

      bossEvilLight.intensity = lerp(0, 24, clamp(subT * 2.5, 0, 1));
      bowlRoot.position.x = Math.sin(nowSec * 52) * 0.09 * grinT;

      const zoomU = easeOutCubic(subT);
      camera.position.set(Math.sin(nowSec * 3.5) * 0.25, lerp(12.6, 13.8, zoomU), lerp(8.5, -1.6, zoomU));
      camera.lookAt(0, 2.45, BOWL_Z + 0.35);
    }
    // [인트로 종료 → 즉시 탄막 전투 시작!]
    else {
      bowlRoot.position.x = 0;
      beginBattleFromIntroOrDirect(false);
    }
    return;
  }

  const arenaCam = computeArenaCameraPose();
  if (STATE.phase === 'menu') {
    bowlRoot.position.set(0, 0, BOWL_Z);
    updateEvilGrinPose(1, 0.85 + Math.sin(nowSec * 2.5) * 0.15);
    bossEvilLight.intensity = 10;
    camera.position.set(Math.sin(nowSec * 0.55) * 2.6, arenaCam.camY * 0.92, arenaCam.camZ * 0.95);
    camera.lookAt(0, 0.5, arenaCam.lookZ - 1.5);
  } else {
    let sx = 0, sy = 0;
    if (STATE.camShake > 0) {
      sx = Math.sin(nowSec * 68) * 0.65 * STATE.camShake;
      sy = Math.cos(nowSec * 81) * 0.55 * STATE.camShake;
    }
    camera.position.set(sx, arenaCam.camY + sy, arenaCam.camZ);
    camera.lookAt(0, 0, arenaCam.lookZ);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── 2D 오버레이 렌더링 (플로팅 텍스트 & 무적 보호막 표시) ───
function drawOverlay(dt) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (ovCanvas.width !== Math.floor(w * dpr) || ovCanvas.height !== Math.floor(h * dpr)) {
    ovCanvas.width = Math.floor(w * dpr);
    ovCanvas.height = Math.floor(h * dpr);
  }
  ovCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ovCtx.clearRect(0, 0, w, h);

  for (let i = STATE.popTexts.length - 1; i >= 0; i--) {
    const p = STATE.popTexts[i];
    p.age += dt;
    if (p.age >= p.dur) {
      STATE.popTexts.splice(i, 1);
      continue;
    }
    const k = p.age / p.dur;
    const alpha = k < 0.10 ? k / 0.10 : (k < 0.72 ? 1.0 : 1 - (k - 0.72) / 0.28);
    const py = h * p.yRatio - k * 28;

    ovCtx.save();
    ovCtx.globalAlpha = clamp(alpha, 0, 1);
    ovCtx.textAlign = 'center';
    ovCtx.shadowColor = 'rgba(0, 0, 0, 0.58)';
    ovCtx.shadowBlur = 10;
    ovCtx.shadowOffsetY = 3;
    const fontPx = Math.round(21 * (p.scale || 1));
    ovCtx.font = `900 ${fontPx}px "Pretendard","Apple SD Gothic Neo",sans-serif`;
    ovCtx.lineWidth = 7.5;
    ovCtx.lineJoin = 'round';
    ovCtx.strokeStyle = 'rgba(18, 10, 14, 0.96)';
    ovCtx.strokeText(p.text, w / 2, py);
    ovCtx.fillStyle = p.color;
    ovCtx.fillText(p.text, w / 2, py);

    if (p.subText) {
      ovCtx.font = '800 14px "Pretendard","Apple SD Gothic Neo",sans-serif';
      ovCtx.lineWidth = 5.5;
      ovCtx.strokeText(p.subText, w / 2, py + 23);
      ovCtx.fillStyle = '#ffffff';
      ovCtx.fillText(p.subText, w / 2, py + 23);
    }
    ovCtx.restore();
  }
}

// ─── 메인 게임 루프 ───
let lastTime = performance.now();

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
  lastTime = now;
  const nowSec = now * 0.001;

  if (STATE.camShake > 0) {
    STATE.camShake = Math.max(0, STATE.camShake - dt * 2.4);
  }

  // 국물 수면 일렁임 & 뜨거운 김 상승 애니메이션
  brothMesh.rotation.z = Math.sin(nowSec * 1.4) * 0.08;
  for (let i = 0; i < steamPuffs.length; i++) {
    const sp = steamPuffs[i];
    const u = (nowSec * 0.45 + sp.phase) % 1;
    const ang = i * 1.3 + nowSec * 0.6;
    const rad = 0.8 + u * 2.2;
    sp.mesh.visible = bowlRoot.position.y > -3;
    sp.mesh.position.set(
      bowlRoot.position.x + Math.cos(ang) * rad,
      bowlRoot.position.y + 2.8 + u * 4.6,
      BOWL_Z + Math.sin(ang) * rad * 0.7
    );
    sp.mesh.scale.setScalar(0.55 + u * 1.15);
    sp.mat.opacity = Math.sin(u * Math.PI) * (STATE.phase === 'intro' ? 0.24 : 0.11);
  }

  if (STATE.phase === 'play') {
    STATE.survivedSec += dt;

    // 단계 상승 알림
    const st = getStageInfo(STATE.survivedSec);
    if (st.lv > STATE.currentLv) {
      STATE.currentLv = st.lv;
      SFX.gong();
      const msgMap = {
        2: '🔥 LV.2 폭풍 면치기! 국물 개수 증가 & 왕방울 등장!',
        3: '🚨 LV.3 후루룩 경보! 초고속 물줄기 & 대왕 방울 주의!',
        4: '🌪️ LV.4 곱빼기 소용돌이! 휘어지는 탄막 & 분열 왕방울 출현!',
        5: '😈 LV.5 사악한 완뽕 폭주! 짬뽕 보스가 진심으로 날뜁니다!',
        6: '👑 LV.6 전설의 순백 수호신! 한계 돌파 극한 생존 구간!!',
      };
      setGuidePill(msgMap[st.lv] || st.label, 'hit');
      addPopText(`⚡ ${st.label} 돌입!!`, '#fde047', '국물 개수·크기 대폭 상승!', 0.32, 1.02);
    }

    if (STATE.slurpBannerTimer > 0) {
      STATE.slurpBannerTimer -= dt;
      if (STATE.slurpBannerTimer <= 0) {
        $('slurp-alert').classList.remove('show');
      }
    }

    // 사악한 보스 얼굴 점멸 (LV.5 이상이거나 특수 패턴 발동 중일 때 씨익 웃는 얼굴 출현!)
    if (st.lv >= 5) {
      updateEvilGrinPose(1, 0.9 + Math.sin(nowSec * 5) * 0.1);
      bossEvilLight.intensity = 12;
    } else if (STATE.bossEvilTimer > 0) {
      STATE.bossEvilTimer = Math.max(0, STATE.bossEvilTimer - dt);
      const em = clamp(STATE.bossEvilTimer * 2.5, 0, 1);
      updateEvilGrinPose(em, em);
      bossEvilLight.intensity = em * 14;
    } else {
      updateEvilGrinPose(0, 0);
      bossEvilLight.intensity = 0;
    }

    // 키보드 이동 처리
    let kx = 0, kz = 0;
    if (STATE.keys.has('arrowleft') || STATE.keys.has('a')) kx -= 1;
    if (STATE.keys.has('arrowright') || STATE.keys.has('d')) kx += 1;
    if (STATE.keys.has('arrowup') || STATE.keys.has('w')) kz -= 1;
    if (STATE.keys.has('arrowdown') || STATE.keys.has('s')) kz += 1;
    if (kx !== 0 || kz !== 0) {
      const len = Math.hypot(kx, kz);
      const spd = (STATE.keys.has('shift') ? 6.2 : 12.6);
      STATE.vx = (kx / len) * spd;
      STATE.vz = (kz / len) * spd;
      STATE.px = clamp(STATE.px + STATE.vx * dt, -ARENA_HALF_X, ARENA_HALF_X);
      STATE.pz = clamp(STATE.pz + STATE.vz * dt, ARENA_MIN_Z, ARENA_MAX_Z);
    } else {
      STATE.vx *= Math.pow(0.04, dt);
      STATE.vz *= Math.pow(0.04, dt);
    }

    // 플레이어 흰 티셔츠 위치 및 경쾌한 기울기·무적 깜빡임 업데이트
    playerGroup.position.set(STATE.px, 0.38, STATE.pz);
    shirtTiltGroup.rotation.z = lerp(shirtTiltGroup.rotation.z, clamp(-STATE.vx * 0.018, -0.22, 0.22), Math.min(1, dt * 14));
    shirtTiltGroup.rotation.x = lerp(shirtTiltGroup.rotation.x, clamp(STATE.vz * 0.015, -0.18, 0.18), Math.min(1, dt * 14));
    if (STATE.invulnTimer > 0) {
      playerGroup.visible = Math.floor(nowSec * 18) % 2 === 0;
    } else {
      playerGroup.visible = true;
    }

    // 젓가락질 주기 타이머 & 3D 젓가락 면 들기 애니메이션!
    STATE.attackTimer -= dt;
    if (STATE.attackTimer <= 0) {
      startChopstickCycle();
      STATE.attackTimer = st.interval;
    }

    if (STATE.chopAnimT < 1.0) {
      const cycleDur = Math.min(0.72, st.interval * 0.85);
      STATE.chopAnimT = Math.min(1.0, STATE.chopAnimT + dt / cycleDur);
      const u = STATE.chopAnimT;

      if (u < 0.26) {
        // 1) 젓가락이 그릇 국물 속으로 쑥 들어가 면을 집는 동작
        const k = easeOutCubic(u / 0.26);
        chopsticksGroup.position.y = lerp(3.6, 2.25, k);
        stickUpper.rotation.z = lerp(1.12, 1.23, k);
        liftedNoodlesGroup.visible = false;
      } else if (u < 0.68) {
        // 2) 면발 다발을 높이 들어 올리며 탈탈 흔드는 순간 → 국물 탄막 발사!!
        if (!STATE.pendingShotFired) {
          STATE.pendingShotFired = true;
          fireChopstickBarrage();
        }
        const k = (u - 0.26) / 0.42;
        const lift = Math.sin(k * Math.PI * 0.78);
        chopsticksGroup.position.y = 2.25 + lift * 4.3;
        chopsticksGroup.position.x = Math.sin(k * TAU * 2) * 0.45;
        stickUpper.rotation.z = 1.23;
        liftedNoodlesGroup.visible = true;
        liftedNoodlesGroup.scale.y = clamp(0.4 + lift * 0.85, 0.3, 1.25);
      } else {
        // 3) 다음 젓가락질 대기 위치로 복귀
        const k = (u - 0.68) / 0.32;
        chopsticksGroup.position.y = lerp(5.1, 3.6, k);
        chopsticksGroup.position.x = lerp(chopsticksGroup.position.x, 0, k);
        stickUpper.rotation.z = lerp(1.23, 1.12, k);
        liftedNoodlesGroup.visible = k < 0.45;
      }
    }

    // 활성 국물 탄막 이동, 곡선 회전, 분열탄 폭발 처리!
    for (let i = STATE.droplets.length - 1; i >= 0; i--) {
      const d = STATE.droplets[i];
      d.age += dt;

      if (d.curveRate !== 0) {
        const c = Math.cos(d.curveRate * dt);
        const s = Math.sin(d.curveRate * dt);
        const nvx = d.vx * c - d.vz * s;
        const nvz = d.vx * s + d.vz * c;
        d.vx = nvx;
        d.vz = nvz;
      }

      d.x += d.vx * dt;
      d.z += d.vz * dt;
      d.group.position.set(d.x, 0, d.z);

      // 탱글탱글 살아 움직이는 액체 방울 맥동 애니메이션
      const wobble = 1 + Math.sin(nowSec * 16 + i) * 0.06;
      d.body.scale.set(d.radius * wobble, d.radius * (0.82 / wobble), d.radius * wobble);

      // 초대형 분열 왕방울 폭발!
      if (d.kind === 'splitter' && d.splitAfter > 0 && d.age >= d.splitAfter) {
        const bx = d.x;
        const bz = d.z;
        removeDropletAt(i);
        SFX.pop();
        spawnBurstParticles(bx, bz, '#fbbf24', 12, 1.1);
        const childCnt = st.lv >= 5 ? 8 : 6;
        const childSpd = 8.4 + st.lv * 0.6;
        for (let k = 0; k < childCnt; k++) {
          const ang = (k / childCnt) * TAU + 0.25;
          spawnDroplet({
            x: bx,
            z: bz,
            vx: Math.sin(ang) * childSpd,
            vz: Math.cos(ang) * childSpd,
            radius: 0.38,
            kind: 'small',
          });
        }
        continue;
      }

      // 아레나 바깥으로 완전히 벗어난 탄 제거
      if (d.x < -ARENA_HALF_X - 3.5 || d.x > ARENA_HALF_X + 3.5 || d.z > ARENA_MAX_Z + 3.2 || d.z < BOWL_Z - 4.0) {
        removeDropletAt(i);
      }
    }

    checkDropletCollisions(dt);
    if (STATE.phase === 'play') {
      updateHUD();
    }
  }

  // 스파크·물방울 파티클 업데이트
  for (let i = STATE.splashes.length - 1; i >= 0; i--) {
    const s = STATE.splashes[i];
    s.age += dt;
    if (s.age >= s.dur) {
      scene.remove(s.mesh);
      s.mat.dispose();
      STATE.splashes.splice(i, 1);
      continue;
    }
    s.vy -= 26 * dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y = Math.max(0.05, s.mesh.position.y + s.vy * dt);
    s.mesh.position.z += s.vz * dt;
    s.mat.opacity = 1 - s.age / s.dur;
  }

  updateCameraAndIntro(dt, nowSec);
  renderer.render(scene, camera);
  drawOverlay(dt);

  window.__jjamppongDebug = {
    phase: STATE.phase,
    introTime: Number(STATE.introTime.toFixed(2)),
    survivedSec: Number(STATE.survivedSec.toFixed(2)),
    stageLv: STATE.currentLv,
    hitsTaken: STATE.hitsTaken,
    chopstickCount: STATE.chopstickCount,
    grazeCount: STATE.grazeCount,
    dropletsCount: STATE.droplets.length,
    px: Number(STATE.px.toFixed(2)),
    pz: Number(STATE.pz.toFixed(2)),
  };
}

// ─── UI 버튼 및 공유·랭킹 이벤트 연결 ───
function syncBgmBtn() {
  const btn = $('btn-bgm');
  const muted = BGM.isMuted();
  btn.textContent = muted ? '🔇 BGM' : '🔊 BGM';
  btn.classList.toggle('bgm-off', muted);
}

function syncBestBadges() {
  const best = getBestRecord(GAME_ID);
  const bestWaves = Number(localStorage.getItem(BEST_WAVES_KEY) || '0');
  if (best && best.score != null) {
    const secStr = `${Number(best.score).toFixed(2)}초`;
    $('best-pill').textContent = `🏆 최고 ${secStr}`;
    $('start-best').textContent = secStr;
  }
  $('start-best-waves').textContent = `${bestWaves}회`;
}

$('btn-bgm').addEventListener('click', () => {
  unlockAudio();
  const muted = BGM.toggleMute();
  if (!muted && STATE.phase === 'play') BGM.start('jjamppong');
  syncBgmBtn();
});

$('btn-start-intro').addEventListener('click', () => startIntroSequence());
$('btn-start-direct').addEventListener('click', () => beginBattleFromIntroOrDirect(true));
$('btn-skip-intro').addEventListener('click', () => beginBattleFromIntroOrDirect(false));
$('btn-retry').addEventListener('click', () => beginBattleFromIntroOrDirect(true));
$('btn-replay-intro').addEventListener('click', () => startIntroSequence());

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
  STATE.lastFinalRun.nickname = saveNickname($('res-nick').value || '익명 흰티족');
  let shareUrl = location.href;
  try {
    const saved = await saveResultAndBuildShare(STATE.lastFinalRun, STATE.incomingRef);
    STATE.lastShareData = saved;
    shareUrl = saved.shareUrl;
    $('res-lb-wrap').innerHTML = renderGlobalLadderHTML(saved, formatLadderMetric);
    $('res-lb-wrap').style.display = 'block';
  } catch {}

  await shareChallengeLink({
    title: '🍜 짬뽕 탄막 — 이게뭔겜? 404 아케이드',
    text: `👕 [${STATE.lastFinalRun.nickname}]님의 새하얀 흰 티 생존 기록: ${Number(STATE.lastFinalRun.score).toFixed(2)}초 (${STATE.chopstickCount}젓가락 방어 · 아슬 ${STATE.grazeCount}회)! 사악한 짬뽕 국물 피하기 이길 수 있나요?`,
    url: shareUrl,
  });
});

$('btn-save-img').addEventListener('click', () => {
  if (!STATE.lastFinalRun) return;
  downloadResultCard({
    gameTitle: '짬뽕 탄막 — 흰 티 생존 챌린지',
    rankTitle: STATE.lastFinalRun.rankTitle,
    headline: `${Number(STATE.lastFinalRun.score).toFixed(2)}초 생존`,
    subline: `피한 젓가락질 ${STATE.chopstickCount}회 · 아슬 회피 ${STATE.grazeCount}회`,
    nickname: $('res-nick').value || '익명 흰티족',
    shareUrl: (STATE.lastShareData && STATE.lastShareData.shareUrl) || location.href,
  });
});

// 지인 기록 도전장 수신 확인
(async function initIncoming() {
  syncBgmBtn();
  syncBestBadges();
  playerGroup.visible = true;
  requestAnimationFrame(tick);

  if (IS_REC) return;
  try {
    const inc = await loadIncomingChallenge(GAME_ID);
    if (inc) {
      STATE.incomingRef = inc;
      const who = inc.nickname || '지인';
      const sc = Number(inc.score || 0).toFixed(2);
      $('rival-banner-text').textContent = `🔥 ${who}님의 생존 기록: ${sc}초`;
      $('rival-banner').style.display = 'flex';
      $('jjam-hud').classList.add('with-rival');

      const box = $('start-rival-box');
      box.innerHTML = `<div style="font-size:13px;font-weight:900;color:#fde047">⚔️ ${who}님의 도전장 도착!</div>
        <div style="font-size:12px;color:#e9e3f8;margin-top:3px">목표 생존 시간: <b>${sc}초</b> 이상 버티면 승리!</div>`;
      box.style.display = 'block';
    }
  } catch {}
})();
