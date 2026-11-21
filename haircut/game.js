// 전설의 미용사 — 1cm만요 실제 웹게임 버전 (원본 1cm만요 감성 미용실 풀 데코 + 입체 손님·미용사 두 손·꼬리빗·가위)
// 핵심:
// 1. 원본 「1cm만요」의 따뜻한 파스텔 미용실(나무 프레임 거울·헐리우드 전구 6개·펜던트 조명·원목 선반과 샴푸 병들·테라코타 화분·미용 트롤리·벽 액자·유리문과 문종·미용 의자)을 반응형으로 구현해 모바일과 데스크톱 모두에서 아기자기한 미용실 전경이 보인다!
// 2. 머리카락 평면(z=0)의 세로 1 월드 단위 = 정확히 실제 물리 1cm(pxPerCm)가 되도록 카메라 거리를 수학적으로 역산(1cm 실측 정확도 100% 보존).
// 3. 라벤더 Lathe 곡면 가운 + 하얀 목지 + 자연스러운 36가닥 엔젤링 머릿결 + 미용사 두 손(꼬리빗·빨간 고무줄 팔찌·입체 미용 가위).
// 4. 자른 뒤 3.0초 동안 1mm 실측 눈금자로 결과물 감상 → 전체 플레이어 글로벌 랭킹 + "내가 아는 ○○님 위치" 핀!

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SFX, BGM, unlockAudio } from '../shared/audio.js';
import { getPxPerCm, openCalibrationModal } from '../shared/calibration.js';
import { enforceGameAccess } from '../shared/catalog.js';
enforceGameAccess('haircut');
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

// ── DOM 요소 ──
const glCanvas = document.getElementById('gl');
const ovCanvas = document.getElementById('ov');
const ovCtx = ovCanvas.getContext('2d');
const orderBubble = document.getElementById('order-bubble');
const orderCmEl = document.getElementById('order-cm');
const rivalBanner = document.getElementById('rival-banner');
const rivalBannerText = document.getElementById('rival-banner-text');
const hintPill = document.getElementById('hint-pill');
const btnSnip = document.getElementById('btn-snip');
const startModal = document.getElementById('start-modal');
const resultModal = document.getElementById('result-modal');

// ── Three.js 렌더러 & 환경 ──
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.03;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f3ead8');
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.52;
  pmrem.dispose();
}

const FOV_DEG = 28;
const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 320);

// ── 따뜻한 미용실 조명 ──
scene.add(new THREE.HemisphereLight('#fffdf8', '#d2bc9d', 1.32));
const sun = new THREE.DirectionalLight('#fff2da', 1.25);
sun.position.set(-14, 28, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0005;
scene.add(sun);

const mirrorGlowLight = new THREE.PointLight('#ffe09e', 1.15, 58, 1.35);
mirrorGlowLight.position.set(0, 12, -12);
scene.add(mirrorGlowLight);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── 1) 아기자기한 미용실 인테리어 (원본 games/haircut1cm/room.js 감성 + 반응형 레이아웃) ──
const Z_WALL = -18;
const salon = new THREE.Group();
scene.add(salon);

const woodMat = new THREE.MeshStandardMaterial({ color: '#b9824e', roughness: 0.58 });
const woodLightMat = new THREE.MeshStandardMaterial({ color: '#cfa16c', roughness: 0.62 });
const brassMat = new THREE.MeshStandardMaterial({ color: '#e2b857', roughness: 0.28, metalness: 0.78 });
const creamMat = new THREE.MeshStandardMaterial({ color: '#faf6ec', roughness: 0.62 });

// 뒷벽 + 민트 웨인스코팅 허리벽 + 세로 몰딩 패널 + 흰 띠 몰딩 + 우드 바닥
const dadoTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#a8cbb9';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) {
    const x = i * (w / 6) + 10;
    const pw = w / 6 - 20;
    g.strokeStyle = 'rgba(255,255,255,0.42)';
    g.lineWidth = 4;
    g.strokeRect(x, 20, pw, h - 42);
    g.strokeStyle = 'rgba(65,105,86,0.16)';
    g.lineWidth = 2;
    g.strokeRect(x + 4, 24, pw - 8, h - 50);
  }
});
dadoTex.wrapS = THREE.RepeatWrapping;
dadoTex.repeat.set(4, 1);

const backWall = new THREE.Mesh(
  new THREE.PlaneGeometry(110, 80),
  new THREE.MeshStandardMaterial({ color: '#f5eddc', roughness: 0.92 })
);
backWall.position.set(0, 14, Z_WALL);
salon.add(backWall);

const dado = new THREE.Mesh(
  new THREE.PlaneGeometry(110, 18),
  new THREE.MeshStandardMaterial({ map: dadoTex, roughness: 0.85 })
);
dado.position.set(0, -8.5, Z_WALL + 0.06);
salon.add(dado);

const dadoCap = new THREE.Mesh(
  new THREE.BoxGeometry(110, 0.45, 0.35),
  creamMat
);
dadoCap.position.set(0, 0.5, Z_WALL + 0.16);
salon.add(dadoCap);

// 우드 플랭크 바닥
const woodFloorTex = canvasTex(512, 512, (g, w, h) => {
  const n = 8, ph = h / n;
  for (let j = 0; j < n; j++) {
    for (let i = -1; i < 3; i++) {
      const x0 = (i + (j % 2 ? 0.5 : 0) + (j % 3) * 0.17) * w / 2;
      g.fillStyle = ['#e3c69b', '#ddbe91', '#e7cba3', '#d9ba8b'][(i + j * 3 + 8) % 4];
      g.fillRect(x0, j * ph, w / 2, ph);
      g.fillStyle = '#c5a273'; g.fillRect(x0, j * ph, 2, ph);
    }
    g.fillStyle = '#be9b6b'; g.fillRect(0, j * ph, w, 2);
  }
});
woodFloorTex.wrapS = woodFloorTex.wrapT = THREE.RepeatWrapping;
woodFloorTex.repeat.set(3.5, 3.5);
const floorMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(110, 60),
  new THREE.MeshStandardMaterial({ map: woodFloorTex, roughness: 0.72 })
);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.set(0, -16.5, -2);
salon.add(floorMesh);

// 중앙 대형 미용실 거울 + 헐리우드 전구 6개 + 원목 화장대 선반 (하나의 그룹으로 반응형 위치·스케일 제어!)
const mirrorStation = new THREE.Group();
mirrorStation.position.set(0, 0, Z_WALL + 0.25);
salon.add(mirrorStation);
{
  // 나무 프레임 거울
  const mirW = 11.4, mirH = 12.6;
  const mirFrame = new THREE.Mesh(new THREE.BoxGeometry(mirW + 1.0, mirH + 1.0, 0.55), woodMat);
  mirFrame.position.set(0, 7.6, 0.1);
  mirrorStation.add(mirFrame);

  // 안쪽 황금빛 얇은 테두리
  const innerTrim = new THREE.Mesh(new THREE.BoxGeometry(mirW + 0.22, mirH + 0.22, 0.62), brassMat);
  innerTrim.position.set(0, 7.6, 0.12);
  mirrorStation.add(innerTrim);

  // 하늘빛 대각선 광택 유리 (얼굴 비치지 않음)
  const mirTex = canvasTex(256, 512, (g, w, h) => {
    const q = g.createLinearGradient(0, 0, w, h);
    q.addColorStop(0, '#def2f8');
    q.addColorStop(0.5, '#cde8f2');
    q.addColorStop(1, '#b6d9e8');
    g.fillStyle = q; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.58)';
    g.beginPath(); g.moveTo(w * 0.08, h); g.lineTo(w * 0.46, 0); g.lineTo(w * 0.65, 0); g.lineTo(w * 0.27, h); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.34)';
    g.beginPath(); g.moveTo(w * 0.42, h); g.lineTo(w * 0.78, 0); g.lineTo(w * 0.85, 0); g.lineTo(w * 0.49, h); g.fill();
  });
  const mirGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(mirW, mirH),
    new THREE.MeshBasicMaterial({ map: mirTex })
  );
  mirGlass.position.set(0, 7.6, 0.45);
  mirrorStation.add(mirGlass);

  // 거울 위 나무 전구 바 + 따뜻한 헐리우드 전구 6개 (글로우 후광 포함!)
  const bulbBar = new THREE.Mesh(new THREE.BoxGeometry(mirW + 1.0, 0.72, 0.7), woodMat);
  bulbBar.position.set(0, 14.3, 0.22);
  mirrorStation.add(bulbBar);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: '#fffbe6', emissive: '#ffdc78', emissiveIntensity: 0.95, roughness: 0.18
  });
  const haloTex = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,232,145,0.85)');
    gr.addColorStop(0.45, 'rgba(255,220,120,0.32)');
    gr.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false });

  for (let i = 0; i < 6; i++) {
    const bx = -4.6 + i * 1.84;
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.28, 12), brassMat);
    sock.rotation.x = Math.PI / 2;
    sock.position.set(bx, 14.3, 0.56);
    mirrorStation.add(sock);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 12), bulbMat);
    bulb.position.set(bx, 14.3, 0.92);
    mirrorStation.add(bulb);

    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(2.1, 2.1, 1);
    halo.position.set(bx, 14.3, 1.05);
    mirrorStation.add(halo);
  }

  // 거울 양옆 사이드 전구 2개씩 (모바일 좁은 폭에서도 전구 감성이 톡톡 보이게!)
  [-1, 1].forEach(side => {
    [11.4, 8.2].forEach(by => {
      const sb = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), bulbMat);
      sb.position.set(side * (mirW * 0.5 + 0.18), by, 0.72);
      mirrorStation.add(sb);
      const sh = new THREE.Sprite(haloMat);
      sh.scale.set(1.6, 1.6, 1);
      sh.position.set(side * (mirW * 0.5 + 0.18), by, 0.85);
      mirrorStation.add(sh);
    });
  });

  // 거울 밑 원목 화장대 선반 + 양옆 다리 + 파스텔 샴푸·에센스·펌프 병 6개
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(17.8, 0.55, 2.6), woodLightMat);
  shelf.position.set(0, 1.05, 1.15);
  mirrorStation.add(shelf);

  [-7.8, 7.8].forEach(lx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 6.5, 2.2), woodLightMat);
    leg.position.set(lx, -2.4, 1.15);
    mirrorStation.add(leg);
  });

  const bottles = [
    { x: -7.5, r: 0.48, h: 1.85, col: '#f5f4ef', pump: true },
    { x: -6.25, r: 0.40, h: 1.45, col: '#eebcc7', pump: false },
    { x: -5.15, r: 0.44, h: 1.65, col: '#9bc6de', pump: true },
    { x: 5.25, r: 0.42, h: 1.55, col: '#f5f4ef', pump: false },
    { x: 6.35, r: 0.50, h: 1.90, col: '#f2d586', pump: true },
    { x: 7.55, r: 0.38, h: 1.35, col: '#b5dac6', pump: false },
  ];
  for (const b of bottles) {
    const bm = new THREE.Mesh(
      new THREE.CylinderGeometry(b.r * 0.96, b.r * 1.04, b.h, 16),
      new THREE.MeshStandardMaterial({ color: b.col, roughness: 0.34 })
    );
    bm.position.set(b.x, 1.33 + b.h / 2, 1.35);
    mirrorStation.add(bm);

    // 라벨 띠
    const lbl = new THREE.Mesh(
      new THREE.CylinderGeometry(b.r * 1.01, b.r * 1.02, b.h * 0.42, 16),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 })
    );
    lbl.position.set(b.x, 1.33 + b.h * 0.48, 1.35);
    mirrorStation.add(lbl);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(b.r * 0.44, b.r * 0.50, 0.34, 12),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 })
    );
    cap.position.set(b.x, 1.33 + b.h + 0.17, 1.35);
    mirrorStation.add(cap);

    if (b.pump) {
      const nozzle = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.12, 0.12),
        new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 })
      );
      nozzle.position.set(b.x + 0.16, 1.33 + b.h + 0.38, 1.35);
      mirrorStation.add(nozzle);
    }
  }
}

// 따뜻한 천장 펜던트 조명 2개 (거울 좌우 상단에서 살짝 내려와 미용실 무드 극대화!)
const leftPendant = new THREE.Group();
const rightPendant = new THREE.Group();
[leftPendant, rightPendant].forEach(p => {
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6.0, 8), new THREE.MeshStandardMaterial({ color: '#3b3733', roughness: 0.7 }));
  cord.position.y = 3.0;
  p.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.95, 20, 1, false), new THREE.MeshStandardMaterial({ color: '#f7e7c8', roughness: 0.42 }));
  shade.position.y = -0.1;
  p.add(shade);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.06, 8, 22), brassMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.56;
  p.add(rim);
  const glowBulb = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshStandardMaterial({ color: '#fffbe6', emissive: '#ffda78', emissiveIntensity: 1.0 }));
  glowBulb.position.y = -0.62;
  p.add(glowBulb);
  salon.add(p);
});

// 왼쪽 데코 그룹: 테라코타 화분 + 따뜻한 벽 액자 (그룹 z를 벽면에 고정해 어떤 스케일에서도 벽 뒤로 숨지 않음!)
const leftDecor = new THREE.Group();
salon.add(leftDecor);
{
  // 벽 액자 (따뜻한 파스텔 미용실 포스터: 「살롱 404 · 1cm만요」)
  const artFrame = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.8, 0.28), woodMat);
  artFrame.position.set(0, 9.2, 0.08);
  leftDecor.add(artFrame);
  const artCanvas = new THREE.Mesh(
    new THREE.PlaneGeometry(3.15, 4.15),
    new THREE.MeshBasicMaterial({
      map: canvasTex(220, 290, (g, w, h) => {
        g.fillStyle = '#fffaf0'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#d4b896'; g.lineWidth = 6; g.strokeRect(12, 12, w - 24, h - 24);
        g.fillStyle = '#7c6f8d';
        g.font = '800 22px Pretendard, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('SALON 404', w * 0.5, h * 0.24);
        g.fillStyle = '#d94662';
        g.font = '900 44px Pretendard, sans-serif';
        g.fillText('1cm만요', w * 0.5, h * 0.50);
        g.fillStyle = '#4a3d5a';
        g.font = '700 18px Pretendard, sans-serif';
        g.fillText('정성껏 다듬어 드려요 ✂️', w * 0.5, h * 0.74);
      })
    })
  );
  artCanvas.position.set(0, 9.2, 0.24);
  leftDecor.add(artCanvas);

  // 테라코타 화분 + 풍성한 관엽식물
  const potG = new THREE.Group();
  potG.position.set(0.2, -3.2, 2.8);
  leftDecor.add(potG);
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.15, 2.9, 18),
    new THREE.MeshStandardMaterial({ color: '#d88a59', roughness: 0.76 })
  );
  potG.add(pot);
  const potRim = new THREE.Mesh(
    new THREE.CylinderGeometry(1.68, 1.58, 0.45, 18),
    new THREE.MeshStandardMaterial({ color: '#e19767', roughness: 0.72 })
  );
  potRim.position.y = 1.35;
  potG.add(potRim);
  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(1.45, 1.45, 0.15, 16),
    new THREE.MeshStandardMaterial({ color: '#5c4635', roughness: 0.95 })
  );
  soil.position.y = 1.48;
  potG.add(soil);

  const leafColors = ['#54a265', '#64b274', '#468f57'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.25;
    const lg = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 2.2 + (i % 3) * 0.5, 8),
      new THREE.MeshStandardMaterial({ color: '#458052', roughness: 0.6 })
    );
    stem.position.y = 1.1;
    lg.add(stem);
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.78, 12, 10),
      new THREE.MeshStandardMaterial({ color: leafColors[i % 3], roughness: 0.48 })
    );
    leaf.scale.set(0.82, 1.55, 0.22);
    leaf.position.y = 2.4 + (i % 3) * 0.42;
    lg.add(leaf);
    lg.position.set(Math.cos(a) * 0.45, 1.3, Math.sin(a) * 0.45);
    lg.rotation.set(Math.sin(a) * 0.42, a, -Math.cos(a) * 0.42);
    potG.add(lg);
  }
}

// 오른쪽 데코 그룹: 3단 미용 트롤리 수레 + 원형 벽시계 + 유리문과 황금 종
const rightDecor = new THREE.Group();
salon.add(rightDecor);
{
  // 파스텔 원형 벽시계
  const clockG = new THREE.Group();
  clockG.position.set(0, 9.8, 0.14);
  rightDecor.add(clockG);
  const cFrame = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.28, 24), woodMat);
  cFrame.rotation.x = Math.PI / 2;
  clockG.add(cFrame);
  const cFace = new THREE.Mesh(
    new THREE.CircleGeometry(1.32, 24),
    new THREE.MeshBasicMaterial({
      map: canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = '#fffdf7'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#6f5c4d'; g.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          g.beginPath();
          g.moveTo(w / 2 + Math.cos(a) * 44, h / 2 + Math.sin(a) * 44);
          g.lineTo(w / 2 + Math.cos(a) * 53, h / 2 + Math.sin(a) * 53);
          g.stroke();
        }
        g.strokeStyle = '#2d2536'; g.lineWidth = 4.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 - 18, h / 2 - 22); g.stroke();
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + 28, h / 2 - 16); g.stroke();
        g.fillStyle = '#e8615a'; g.beginPath(); g.arc(w / 2, h / 2, 4.5, 0, Math.PI * 2); g.fill();
      })
    })
  );
  cFace.position.z = 0.16;
  clockG.add(cFace);

  // 3단 미용 트롤리 수레
  const cart = new THREE.Group();
  cart.position.set(0.1, -5.0, 3.6);
  rightDecor.add(cart);
  const trayMat = new THREE.MeshStandardMaterial({ color: '#f5f1e8', roughness: 0.52 });
  const poleMat = new THREE.MeshStandardMaterial({ color: '#9ea8b4', roughness: 0.26, metalness: 0.68 });
  [0, 3.0, 6.0].forEach(y => {
    const tr = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.32, 3.0), trayMat);
    tr.position.y = y;
    cart.add(tr);
  });
  [[-1.82, -1.32], [1.82, -1.32], [-1.82, 1.32], [1.82, 1.32]].forEach(([px, pz]) => {
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.4, 10), poleMat);
    pl.position.set(px, 3.0, pz);
    cart.add(pl);
  });
  // 돌돌 만 하얀 수건 3개
  for (let i = 0; i < 3; i++) {
    const tw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 1.75, 14),
      new THREE.MeshStandardMaterial({ color: i === 1 ? '#f5e8eb' : '#ffffff', roughness: 0.88 })
    );
    tw.rotation.x = Math.PI / 2;
    tw.position.set(-0.95 + i * 0.82, 3.52, 0.1);
    cart.add(tw);
  }
  // 파란 분무기 + 트리거 + 흰 샴푸통 + 헤어드라이어
  const sprayBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.50, 1.55, 14),
    new THREE.MeshStandardMaterial({ color: '#8ac2e0', roughness: 0.28 })
  );
  sprayBody.position.set(-0.75, 6.9, 0.1);
  cart.add(sprayBody);
  const sprayHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.28, 0.26),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35 })
  );
  sprayHead.position.set(-0.62, 7.82, 0.1);
  cart.add(sprayHead);

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.48, 0.62, 16),
    new THREE.MeshStandardMaterial({ color: '#393e4a', roughness: 0.45 })
  );
  bowl.position.set(0.8, 6.48, 0.15);
  cart.add(bowl);

  // 미용실 유리문 테두리 + 황금 종 (데스크톱에서 오른쪽 끝에 살짝 보여 공간감 완성!)
  const doorG = new THREE.Group();
  doorG.position.set(5.4, 2.2, 0.18);
  rightDecor.add(doorG);
  doorG.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 16, 0.45), woodMat));
  const doorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 14.8),
    new THREE.MeshBasicMaterial({ color: '#ffecd0', transparent: true, opacity: 0.45 })
  );
  doorGlass.position.set(2.3, 0, -0.05);
  doorG.add(doorGlass);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65), brassMat);
  bell.position.set(1.6, 6.8, 0.3);
  doorG.add(bell);
}

// 미용실 의자 팔걸이(양옆 아래쪽 크롬 포인트)
const chairLeft = new THREE.Group();
const chairRight = new THREE.Group();
const chairMat = new THREE.MeshStandardMaterial({ color: '#393e4a', roughness: 0.52 });
const chromeMat = new THREE.MeshStandardMaterial({ color: '#c8cfd8', roughness: 0.20, metalness: 0.85 });
[chairLeft, chairRight].forEach(cg => {
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 4.2), chairMat);
  cg.add(pad);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.6, 10), chromeMat);
  bar.position.y = -2.0;
  cg.add(bar);
  salon.add(cg);
});

// ── 2) 손님 뒷모습 (얼굴 없음! 매끄러운 Lathe 라벤더 가운 + 하얀 목지 + 자연스러운 36가닥 엔젤링 머릿결) ──
const guestGroup = new THREE.Group();
scene.add(guestGroup);

// 주름진 라벤더 미용 가운 텍스처
const capeTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#ddd6f2';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 20; i++) {
    const x = (i / 20) * w;
    const sw = w / 20;
    const grd = g.createLinearGradient(x, 0, x + sw, 0);
    grd.addColorStop(0, 'rgba(84,68,128,0.08)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(84,68,128,0.06)');
    g.fillStyle = grd;
    g.fillRect(x, 0, sw, h);
  }
});
capeTex.wrapS = THREE.RepeatWrapping;
const capeMat = new THREE.MeshStandardMaterial({ map: capeTex, color: '#ffffff', roughness: 0.66, metalness: 0.02 });

// 목 → 완만한 어깨 곡선 → 아래로 자연스럽게 퍼지는 Lathe 가운! (붕 뜬 도넛 어깨 제거!)
const capePts = [
  new THREE.Vector2(1.45, 9.6),  // 목 윗단
  new THREE.Vector2(1.85, 9.15), // 목 밑
  new THREE.Vector2(3.15, 8.65), // 어깨 안쪽
  new THREE.Vector2(4.25, 7.95), // 어깨 둥근 곡선
  new THREE.Vector2(4.65, 6.8),  // 팔뚝 상단
  new THREE.Vector2(5.15, 3.8),  // 등 중간
  new THREE.Vector2(6.05, -1.5), // 허리~무릎
  new THREE.Vector2(7.15, -8.5), // 아래쪽 퍼짐
];
const capeGeo = new THREE.LatheGeometry(capePts, 36);
// 앞뒤(z)는 살짝 납작하게 해 머리카락 평면(z=0) 뒤쪽에 우아하게 자리 잡음
capeGeo.scale(1.0, 1.0, 0.56);
const capeMesh = new THREE.Mesh(capeGeo, capeMat);
capeMesh.position.set(0, 0, -4.6);
capeMesh.receiveShadow = true;
guestGroup.add(capeMesh);

// 가운 위 하얀 미용 목지(넥 스트립)
const neckStrip = new THREE.Mesh(
  new THREE.CylinderGeometry(1.52, 1.72, 0.72, 24),
  new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 })
);
neckStrip.scale.set(1.0, 1.0, 0.78);
neckStrip.position.set(0, 9.65, -3.5);
guestGroup.add(neckStrip);

// 실키한 머릿결 + 2단 엔젤링 윤기 텍스처
const hairTex = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 2) {
    const v = 226 + Math.round(Math.sin(x * 0.55) * 14 + Math.cos(x * 1.9) * 10);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, 0, 2, h);
  }
  // 상단 엔젤링 하이라이트
  const s1 = g.createLinearGradient(0, h * 0.18, 0, h * 0.42);
  s1.addColorStop(0, 'rgba(255,255,255,0)');
  s1.addColorStop(0.5, 'rgba(255,255,255,0.34)');
  s1.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = s1;
  g.fillRect(0, h * 0.18, w, h * 0.24);
  // 하단 부드러운 윤기
  const s2 = g.createLinearGradient(0, h * 0.58, 0, h * 0.78);
  s2.addColorStop(0, 'rgba(255,255,255,0)');
  s2.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  s2.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = s2;
  g.fillRect(0, h * 0.58, w, h * 0.20);
});

const hairMatA = new THREE.MeshStandardMaterial({ map: hairTex, color: '#61402b', roughness: 0.34, metalness: 0.08 });
const hairMatB = new THREE.MeshStandardMaterial({ map: hairTex, color: '#6f4b33', roughness: 0.30, metalness: 0.10 });
const hairMatC = new THREE.MeshStandardMaterial({ map: hairTex, color: '#533522', roughness: 0.38, metalness: 0.06 });
const hairMatD = new THREE.MeshStandardMaterial({ map: hairTex, color: '#68452f', roughness: 0.32, metalness: 0.09 });
const hairMats = [hairMatA, hairMatB, hairMatC, hairMatD];

// 손님 뒤통수 + 뒤돌아볼 때 드러나는 매끈한 옆볼·귀 윤곽 + 양쪽 자연스러운 옆머리 (눈·코·입 없음!)
const headGroup = new THREE.Group();
headGroup.position.set(0, 11.4, -2.55);
guestGroup.add(headGroup);

const headSkinMat = new THREE.MeshStandardMaterial({ color: '#f2c7a7', roughness: 0.56, metalness: 0.01 });
// 앞쪽(거울 방향 -z)에 배치된 매끈한 살색 옆얼굴·턱 윤곽 (눈·코·입 없음! 고개를 뒤돌아볼 때 옆볼·귀가 뚜렷하게 드러남)
const headSkin = new THREE.Mesh(new THREE.SphereGeometry(2.68, 28, 22), headSkinMat);
headSkin.scale.set(0.95, 1.08, 1.02);
headSkin.position.set(0, -0.22, -0.82);
headGroup.add(headSkin);

// 작은 양쪽 귀 (고개 뒤돌아볼 때 옆모습 실루엣을 귀엽고 또렷하게 살려줌!)
[-1, 1].forEach(side => {
  const ear = new THREE.Mesh(new THREE.SphereGeometry(0.60, 14, 12), headSkinMat);
  ear.scale.set(0.45, 1.05, 0.78);
  ear.position.set(side * 2.48, -0.35, -0.45);
  headGroup.add(ear);
});

const headBack = new THREE.Mesh(new THREE.SphereGeometry(2.86, 32, 24), hairMatA);
headBack.scale.set(1.04, 1.12, 0.92);
headBack.position.set(0, 0.08, 0.30);
headBack.castShadow = true;
headGroup.add(headBack);

// 앞머리(이마 위 덮개 — 고개 뒤돌려도 매끈하고 귀여운 윗선 유지)
const headTopFront = new THREE.Mesh(new THREE.SphereGeometry(2.75, 24, 18), hairMatA);
headTopFront.scale.set(1.02, 0.72, 1.02);
headTopFront.position.set(0, 1.08, -0.58);
headGroup.add(headTopFront);

// 정수리 엔젤링 링
const crownSheen = new THREE.Mesh(
  new THREE.TorusGeometry(2.15, 0.14, 10, 28),
  new THREE.MeshBasicMaterial({ color: '#fff3e2', transparent: true, opacity: 0.18 })
);
crownSheen.rotation.x = Math.PI * 0.48;
crownSheen.position.set(0, 1.55, 0.15);
headGroup.add(crownSheen);

[-1, 1].forEach(side => {
  const sideHair = new THREE.Mesh(new THREE.SphereGeometry(1.18, 18, 16), hairMatB);
  sideHair.scale.set(0.72, 2.35, 0.86);
  sideHair.position.set(side * 2.15, -1.9, 0.42);
  sideHair.rotation.z = side * -0.06;
  headGroup.add(sideHair);
});

// 풍성하고 실키한 36가닥 머리카락 (z = 0 평면! 세로 y = 0.0 원래 끝 ~ HAIR_TOP_Y 위쪽)
// 중요: 세로 y 스케일은 절대 왜곡하지 않음(정확히 1 월드 단위 = 실제 1cm)!
const STRAND_COUNT = 36;
let currentHairTopY = 9.8;
let currentHairWidth = 3.8;
const hairRoot = new THREE.Group();
scene.add(hairRoot);

const strands = [];
const fallingBits = [];

for (let i = 0; i < STRAND_COUNT; i++) {
  const u = (i / (STRAND_COUNT - 1)) * 2 - 1; // -1 ~ +1
  const mat = hairMats[i % hairMats.length];
  // 서로 살짝 겹치는 리본형 둥근 머리카락 다발 → 대나무 발 틈새 없는 자연스러운 긴 생머리!
  const geo = new THREE.CylinderGeometry(0.088, 0.094, 1, 8);
  geo.scale(1.0, 1.0, 0.34);
  geo.translate(0, -0.5, 0);
  const mesh = new THREE.Mesh(geo, mat);
  const archZ = (1 - u * u) * 0.065 + (i % 2 === 0 ? 0.012 : -0.008);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  hairRoot.add(mesh);
  strands.push({ mesh, u, x: 0, archZ, phase: i * 0.34, widthMul: 0.92 + ((i * 7) % 5) * 0.04 });

  const fGeo = new THREE.CylinderGeometry(0.086, 0.090, 1, 7);
  fGeo.scale(1.0, 1.0, 0.32);
  const fMesh = new THREE.Mesh(fGeo, mat);
  fMesh.visible = false;
  scene.add(fMesh);
  fallingBits.push({ mesh: fMesh, u, x: 0, y: 0, vy: 0, vx: 0, rot: 0, vrot: 0, h: 0 });
}

// ── 3) 미용사의 두 손 + 검은 소매(빨간 고무줄 팔찌) + 꼬리빗 + 입체 은색 미용 가위 ──
const skinMat = new THREE.MeshStandardMaterial({ color: '#f2c7a7', roughness: 0.50, metalness: 0.02 });
const nailMat = new THREE.MeshStandardMaterial({ color: '#fde6da', roughness: 0.25, metalness: 0.06 });
const sleeveMat = new THREE.MeshStandardMaterial({ color: '#2b2d36', roughness: 0.72 });
const cuffMat = new THREE.MeshStandardMaterial({ color: '#3b3e4b', roughness: 0.66 });
const bandMat = new THREE.MeshStandardMaterial({ color: '#e8615a', roughness: 0.42 });

// 3-A. 오른손 + 입체 은색 미용 가위
const rightRig = new THREE.Group();
scene.add(rightRig);

const steelMat = new THREE.MeshStandardMaterial({ color: '#eef4fa', roughness: 0.13, metalness: 0.92 });
const ringMat = new THREE.MeshStandardMaterial({ color: '#252934', roughness: 0.34, metalness: 0.35 });
const screwMat = new THREE.MeshStandardMaterial({ color: '#ffd84a', roughness: 0.18, metalness: 0.90 });

const scissorGroup = new THREE.Group();
rightRig.add(scissorGroup);

function makeBlade(sign) {
  const g = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0.42, 0);
  bladeShape.lineTo(-4.65, sign * 0.02);
  bladeShape.lineTo(-4.35, sign * 0.20);
  bladeShape.lineTo(0.42, sign * 0.27);
  bladeShape.closePath();
  const bGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.08, bevelEnabled: false });
  bGeo.translate(0, 0, sign > 0 ? 0.01 : -0.09);
  const bMesh = new THREE.Mesh(bGeo, steelMat);
  bMesh.castShadow = true;
  g.add(bMesh);

  const shank = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.20, 0.10), steelMat);
  shank.position.set(1.25, sign * 0.15, 0);
  g.add(shank);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.10, 10, 24), ringMat);
  ring.position.set(2.45, sign * 0.46, 0);
  g.add(ring);

  // 미용 가위 새끼손가락 받침(탱)
  if (sign < 0) {
    const tang = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.50, 6, 8), steelMat);
    tang.rotation.z = -1.1;
    tang.position.set(3.08, -0.56, 0);
    g.add(tang);
  }
  return g;
}

const topBlade = makeBlade(1);
const botBlade = makeBlade(-1);
scissorGroup.add(topBlade, botBlade);

const pivotScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.25, 16), screwMat);
pivotScrew.rotation.x = Math.PI / 2;
scissorGroup.add(pivotScrew);

// 오른손 + 손목 이음새 구 + 빨간 고무줄 팔찌 + 걷어 올린 검은 소매
const rHand = new THREE.Group();
rHand.position.set(3.0, -0.08, 0.16);
rightRig.add(rHand);
{
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.95, 18, 14), skinMat);
  palm.scale.set(1.25, 0.84, 0.62);
  palm.position.set(0.85, -0.14, 0.14);
  palm.castShadow = true;
  rHand.add(palm);

  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.95, 8, 12), skinMat);
  thumb.rotation.z = 1.24;
  thumb.position.set(-0.22, 0.48, 0.14);
  rHand.add(thumb);

  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.92, 8, 12), skinMat);
    f.rotation.z = 1.40;
    f.position.set(-0.14 + i * 0.11, -0.22 - i * 0.31, 0.11);
    rHand.add(f);
  }

  // 손목 이음새 부드럽게 연결
  const wristJoint = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 12), skinMat);
  wristJoint.position.set(1.75, -0.24, 0.10);
  rHand.add(wristJoint);

  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.78, 3.0, 16), skinMat);
  wrist.rotation.z = Math.PI / 2 - 0.14;
  wrist.position.set(3.05, -0.44, 0.09);
  rHand.add(wrist);

  const hairTie = new THREE.Mesh(new THREE.TorusGeometry(0.73, 0.11, 10, 22), bandMat);
  hairTie.rotation.y = Math.PI / 2;
  hairTie.position.set(2.42, -0.35, 0.09);
  rHand.add(hairTie);

  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.72, 16), cuffMat);
  cuff.rotation.z = Math.PI / 2 - 0.14;
  cuff.position.set(4.65, -0.68, 0.09);
  rHand.add(cuff);

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.10, 7.5, 16), sleeveMat);
  sleeve.rotation.z = Math.PI / 2 - 0.14;
  sleeve.position.set(8.4, -1.2, 0.09);
  rHand.add(sleeve);
}

// 3-B. 왼손 + 엄지에 끼운 검은 꼬리빗 + 검은 소매
const leftPinch = new THREE.Group();
scene.add(leftPinch);
{
  const lPalm = new THREE.Mesh(new THREE.SphereGeometry(0.92, 18, 14), skinMat);
  lPalm.scale.set(1.22, 0.82, 0.58);
  lPalm.position.set(-2.65, 0.12, 0.16);
  lPalm.castShadow = true;
  leftPinch.add(lPalm);

  // 머리카락을 살짝 집는 검지(앞) & 중지(뒤)
  const idxF = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 2.25, 8, 12), skinMat);
  idxF.rotation.z = Math.PI / 2;
  idxF.position.set(-1.12, 0.22, 0.26);
  idxF.castShadow = true;
  leftPinch.add(idxF);

  const idxNail = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), nailMat);
  idxNail.scale.set(1.1, 0.65, 0.34);
  idxNail.position.set(0.05, 0.22, 0.42);
  leftPinch.add(idxNail);

  const midF = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 2.15, 8, 12), skinMat);
  midF.rotation.z = Math.PI / 2;
  midF.position.set(-1.18, -0.21, -0.22);
  leftPinch.add(midF);

  for (let i = 0; i < 2; i++) {
    const curled = new THREE.Mesh(new THREE.CapsuleGeometry(0.20, 0.82, 8, 10), skinMat);
    curled.rotation.z = Math.PI / 2 - 0.38;
    curled.position.set(-2.05, -0.52 - i * 0.30, 0.22);
    leftPinch.add(curled);
  }

  // 엄지 + 검은 꼬리빗
  const lThumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.92, 8, 12), skinMat);
  lThumb.rotation.z = -1.0;
  lThumb.position.set(-1.95, 0.64, 0.24);
  leftPinch.add(lThumb);

  const combGroup = new THREE.Group();
  combGroup.position.set(-2.15, 1.05, 0.34);
  combGroup.rotation.z = 0.44;
  const combMat = new THREE.MeshStandardMaterial({ color: '#22242c', roughness: 0.38 });
  combGroup.add(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.22, 0.12), combMat));
  for (let i = 0; i < 14; i++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.50, 0.08), combMat);
    tooth.position.set(-1.38 + i * 0.205, -0.32, 0);
    combGroup.add(tooth);
  }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 2.2, 8), combMat);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-2.48, 0.02, 0);
  combGroup.add(tail);
  leftPinch.add(combGroup);

  const lWristJoint = new THREE.Mesh(new THREE.SphereGeometry(0.66, 14, 12), skinMat);
  lWristJoint.position.set(-3.55, 0.02, 0.12);
  leftPinch.add(lWristJoint);

  const lWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.78, 2.9, 16), skinMat);
  lWrist.rotation.z = Math.PI / 2 + 0.14;
  lWrist.position.set(-4.85, -0.18, 0.10);
  leftPinch.add(lWrist);

  const lCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.72, 16), cuffMat);
  lCuff.rotation.z = Math.PI / 2 + 0.14;
  lCuff.position.set(-6.4, -0.42, 0.10);
  leftPinch.add(lCuff);

  const lSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.10, 7.5, 16), sleeveMat);
  lSleeve.rotation.z = Math.PI / 2 + 0.14;
  lSleeve.position.set(-10.1, -0.96, 0.10);
  leftPinch.add(lSleeve);
}

// ── 부드러운 미용실 효과음 신스 (가위 찰칵 · 은은한 반짝임 · 경쾌한 싹둑 · 부드러운 말풍선 · 판정 딩동) ──
let _salonAC = null;
function getSalonAC() {
  try {
    if (!_salonAC) _salonAC = new (window.AudioContext || window.webkitAudioContext)();
    if (_salonAC.state === 'suspended') _salonAC.resume();
    return _salonAC;
  } catch { return null; }
}
const SALON_SFX = {
  softSnip(step = 0) {
    const ac = getSalonAC(); if (!ac) return;
    const now = ac.currentTime;
    const freq = 1520 + step * 180;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.85, now + 0.042);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g).connect(ac.destination);
    osc.start(now); osc.stop(now + 0.08);
  },
  glint() {
    const ac = getSalonAC(); if (!ac) return;
    const now = ac.currentTime;
    [1318.5, 1760, 2093].forEach((f, idx) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.03);
      g.gain.setValueAtTime(0.001, now + idx * 0.03);
      g.gain.linearRampToValueAtTime(0.06, now + idx * 0.03 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.03 + 0.24);
      osc.connect(g).connect(ac.destination);
      osc.start(now + idx * 0.03); osc.stop(now + idx * 0.03 + 0.26);
    });
  },
  cleanCut(step = 0) {
    const ac = getSalonAC(); if (!ac) return;
    const now = ac.currentTime;
    // 경쾌하고 깔끔한 미용 가위 싹둑! 소리
    const len = Math.floor(ac.sampleRate * 0.11);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(2400 + step * 240, now);
    flt.Q.value = 2.6;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.16, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    src.connect(flt).connect(ng).connect(ac.destination);
    src.start(now);

    const tone = ac.createOscillator();
    const tg = ac.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(980 + step * 110, now);
    tone.frequency.exponentialRampToValueAtTime(520, now + 0.09);
    tg.gain.setValueAtTime(0.09, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.10);
    tone.connect(tg).connect(ac.destination);
    tone.start(now); tone.stop(now + 0.11);
  },
  stampChime(isGreat = true) {
    const ac = getSalonAC(); if (!ac) return;
    const now = ac.currentTime;
    const notes = isGreat ? [587.3, 739.9, 880, 1174.6] : [440, 392, 349.2];
    notes.forEach((f, idx) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, now + idx * 0.055);
      g.gain.setValueAtTime(0.001, now + idx * 0.055);
      g.gain.linearRampToValueAtTime(0.10, now + idx * 0.055 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.28);
      o.connect(g).connect(ac.destination);
      o.start(now + idx * 0.055); o.stop(now + idx * 0.055 + 0.30);
    });
  },
  bubblePop() {
    const ac = getSalonAC(); if (!ac) return;
    const now = ac.currentTime;
    [520, 760].forEach((f, idx) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now + idx * 0.055);
      o.frequency.exponentialRampToValueAtTime(f * 1.32, now + idx * 0.055 + 0.09);
      g.gain.setValueAtTime(0.001, now + idx * 0.055);
      g.gain.linearRampToValueAtTime(0.11, now + idx * 0.055 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.13);
      o.connect(g).connect(ac.destination);
      o.start(now + idx * 0.055); o.stop(now + idx * 0.055 + 0.15);
    });
  },
  okReply() {
    const ac = getSalonAC(); if (!ac) return;
    const now = ac.currentTime;
    [659.25, 880].forEach((f, idx) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, now + idx * 0.06);
      g.gain.setValueAtTime(0.001, now + idx * 0.06);
      g.gain.linearRampToValueAtTime(0.10, now + idx * 0.06 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);
      o.connect(g).connect(ac.destination);
      o.start(now + idx * 0.06); o.stop(now + idx * 0.06 + 0.24);
    });
  },
};

// ── 3구간 정의 (왼쪽 0~11 · 가운데 12~23 · 오른쪽 24~35) ──
const SECTIONS = [
  { id: 'left',   label: '왼쪽',   range: [0, 11],  xFactor: -0.333, col: '#f43f5e' },
  { id: 'center', label: '가운데', range: [12, 23], xFactor:  0.000, col: '#f59e0b' },
  { id: 'right',  label: '오른쪽', range: [24, 35], xFactor:  0.333, col: '#0ea5e9' },
];

// ── 부드러운 미용실 VFX 상태 ──
const vfx = {
  sparks: [],
  pops: [],
  cutLineAlpha: 0,
  cutLineX0: 0,
  cutLineX1: 0,
  cutLineY: 0,
  softFlash: 0,
  introSnipStep: 0,
  introOkFired: false,
  guestBubbleProg: 0,
  replyBubbleProg: 0,
  focusGlintFired: false,
  stampFired: false,
  stampAnim: 0,
  stampInfo: null,
};

function spawnSparks(sx, sy, count = 16, palette = ['#ffffff', '#fde68a', '#fda4af']) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 90 + Math.random() * 260;
    vfx.sparks.push({
      x: sx, y: sy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 60,
      size: 2.5 + Math.random() * 4,
      len: 7 + Math.random() * 12,
      col: palette[i % palette.length],
      life: 0.28 + Math.random() * 0.34,
      maxLife: 0.62,
      confetti: false,
      rot: ang,
      vrot: (Math.random() - 0.5) * 8,
    });
  }
}

function spawnConfetti(count = 36) {
  const cols = ['#fde68a', '#fda4af', '#86efac', '#93c5fd', '#d8b4fe', '#ffffff'];
  for (let i = 0; i < count; i++) {
    vfx.sparks.push({
      x: viewW * (0.15 + Math.random() * 0.7),
      y: viewH * (0.16 + Math.random() * 0.22),
      vx: (Math.random() - 0.5) * 320,
      vy: -160 - Math.random() * 240,
      size: 5 + Math.random() * 6,
      len: 10 + Math.random() * 7,
      col: cols[i % cols.length],
      life: 1.3 + Math.random() * 1.0,
      maxLife: 2.3,
      confetti: true,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 10,
    });
  }
}

function spawnPopText(text, sub, sx, sy, opts = {}) {
  vfx.pops.push({
    text,
    sub: sub || '',
    x: sx,
    y: sy,
    size: opts.size || 32,
    color: opts.color || '#fffdf7',
    stroke: opts.stroke || '#2c2235',
    shadow: opts.shadow || 'rgba(44, 34, 53, 0.28)',
    rot: opts.rot != null ? opts.rot : (-0.06 + Math.random() * 0.12),
    life: opts.life || 0.68,
    maxLife: opts.life || 0.68,
    vy: opts.vy != null ? opts.vy : -28,
  });
}

function getStampInfo(ev) {
  if (ev.totalErrMm <= 0.8) {
    return { main: '청담동 원장님', sub: `종합 오차 ${ev.totalErrMm.toFixed(1)}mm · 완벽한 일자 컷!`, bg: '#fef08a', fg: '#2c2235', border: '#ca8a04', mode: 'god' };
  }
  if (ev.totalErrMm <= 1.8) {
    return { main: '프로 디자이너', sub: `종합 오차 ${ev.totalErrMm.toFixed(1)}mm · 단골 예약!`, bg: '#bbf7d0', fg: '#14532d', border: '#16a34a', mode: 'great' };
  }
  if (ev.totalErrMm <= 3.4) {
    return { main: '깔끔한 감각', sub: `종합 오차 ${ev.totalErrMm.toFixed(1)}mm · 자연스러워요`, bg: '#bae6fd', fg: '#0c4a6e', border: '#0284c7', mode: 'good' };
  }
  if (ev.unevenMm >= 5.0) {
    return { main: '계단 머리 발생!', sub: `좌우 단차 ${ev.unevenMm.toFixed(1)}mm · 손님 깜짝!`, bg: '#fecdd3', fg: '#881337', border: '#e11d48', mode: 'disaster' };
  }
  if (ev.signedAvgMm > 5.0) {
    return { main: '너무 짧아졌어요', sub: `평균 +${ev.signedAvgMm.toFixed(1)}mm · 단발 위기!`, bg: '#fecdd3', fg: '#881337', border: '#e11d48', mode: 'disaster' };
  }
  return { main: '살짝 삐끗했어요', sub: `종합 오차 ${ev.totalErrMm.toFixed(1)}mm · 한 번 더!`, bg: '#fed7aa', fg: '#7c2d12', border: '#ea580c', mode: 'miss' };
}

// ── 게임 상태 ──
const STREAK_KEY = 'fgs.haircut.streak';
const GUEST_THEMES = [
  { hair: ['#61402b', '#6f4b33', '#533522', '#68452f'], cape: '#ddd6f3' },
  { hair: ['#2b2628', '#393236', '#201c1e', '#322b2e'], cape: '#cce5dd' },
  { hair: ['#7a4d2b', '#8d5b35', '#653e21', '#825330'], cape: '#f3ddd4' },
  { hair: ['#4a282c', '#5e343a', '#3a1e21', '#532d32'], cape: '#d5e5f5' },
];
const state = {
  phase: 'start',
  pxPerCm: 50,
  calibrated: false,
  calLabel: '',
  targetCm: 1.0,
  seed: 1,
  step: 0, // 0: 왼쪽, 1: 가운데, 2: 오른쪽
  cuts: [null, null, null],
  tilts: [0, 0, 0],
  cutFlags: [false, false, false],
  cutCm: 2.0,
  liveCutCm: 2.0,
  tiltDeg: 0,
  stillSec: 0,
  streak: Number(localStorage.getItem(STREAK_KEY) || 0),
  introAnim: 0,
  cutAnim: 0,
  revealAnim: 0,
  isDragging: false,
  lastPointerX: 0,
  lastPointerY: 0,
  lastRustleY: 0,
  rival: null,
  lastResult: null,
  lastShareData: null,
  handScale: 1,
  baseCamY: 3.5,
  baseCamZ: 30,
  camFocusX: 0,
  camLookX: 0,
  handCenterX: 0,
};

// ── 실제 물리 1cm 역산 투영 + 모바일·데스크톱 반응형 미용실 레이아웃 ──
let viewW = window.innerWidth;
let viewH = window.innerHeight;

function sectionCenterX(idx) {
  return SECTIONS[idx].xFactor * currentHairWidth;
}

function layoutResponsiveScene(visibleCmW, visibleCmH, camZ, camY) {
  const isPortrait = viewW < viewH;

  // 1) 머리카락 폭 & 손님 뒷모습 스케일 (세로 1cm는 절대 변경하지 않음!)
  // 3구간이 시원하게 구분되도록 머리카락 폭을 원본 1cm만요처럼 넉넉하게 잡음!
  currentHairWidth = isPortrait
    ? Math.max(3.0, Math.min(4.2, visibleCmW * 0.56))
    : Math.max(4.0, Math.min(5.0, visibleCmW * 0.25));
  currentHairTopY = isPortrait
    ? Math.max(6.4, Math.min(8.6, visibleCmH * 0.56))
    : Math.max(8.2, Math.min(10.6, visibleCmH * 0.58));

  const strandScaleX = (currentHairWidth / 3.8);
  for (let i = 0; i < STRAND_COUNT; i++) {
    const s = strands[i];
    s.x = s.u * (currentHairWidth * 0.5 - (currentHairWidth / STRAND_COUNT) * 0.5);
    s.topY = currentHairTopY + 0.95;
    s.mesh.position.set(s.x, s.topY, s.archZ);
    s.mesh.scale.x = strandScaleX * s.widthMul;
    const fb = fallingBits[i];
    fb.x = s.x;
    fb.mesh.scale.x = strandScaleX * s.widthMul;
  }

  const guestScaleX = currentHairWidth / 3.8;
  const guestScaleY = currentHairTopY / 9.8;
  guestGroup.scale.set(guestScaleX, guestScaleY, Math.min(guestScaleX, guestScaleY));
  guestGroup.position.set(0, 0, 0);

  // 2) 미용사 두 손 & 가위 스케일
  state.handScale = isPortrait
    ? Math.max(0.46, Math.min(0.66, visibleCmW / 10.8))
    : Math.max(0.80, Math.min(1.02, visibleCmW / 24.5));
  rightRig.scale.setScalar(state.handScale);
  leftPinch.scale.setScalar(state.handScale);

  // 3) 배경 미용실(Z_WALL = -18) 반응형 배치
  const bgFactor = (camZ - Z_WALL) / camZ;
  const wallVisW = visibleCmW * bgFactor;
  const wallVisH = visibleCmH * bgFactor;
  const wallHalfW = wallVisW * 0.5;
  const wallTopY = camY + wallVisH * 0.5;
  const wallBotY = camY - wallVisH * 0.5;

  const mScale = isPortrait
    ? Math.max(0.56, Math.min(0.84, wallVisW / 13.8))
    : Math.max(0.92, Math.min(1.22, wallVisH / 20.5));
  mirrorStation.scale.setScalar(mScale);
  const targetMirrorBaseY = (wallTopY - (isPortrait ? 1.35 : 1.55)) - 14.3 * mScale;
  mirrorStation.position.set(0, targetMirrorBaseY, Z_WALL + 0.25);

  const pendScale = mScale * 0.92;
  const pendX = Math.min(wallHalfW * 0.78, 7.6 * mScale);
  leftPendant.scale.setScalar(pendScale);
  rightPendant.scale.setScalar(pendScale);
  leftPendant.position.set(-pendX, wallTopY - 1.8 * pendScale, Z_WALL + 3.2);
  rightPendant.position.set(pendX, wallTopY - 1.8 * pendScale, Z_WALL + 3.2);

  const dadoTopY = targetMirrorBaseY + 0.5 * mScale;
  dadoCap.position.y = dadoTopY;
  dado.position.y = dadoTopY - 9.0;
  floorMesh.position.y = wallBotY - 1.5;

  const sideScale = isPortrait ? mScale * 0.84 : mScale * 0.96;
  const sideX = isPortrait
    ? Math.max(wallHalfW * 0.74, 4.9 * mScale)
    : Math.min(wallHalfW * 0.66, 12.6 * mScale);

  leftDecor.scale.setScalar(sideScale);
  leftDecor.position.set(-sideX, targetMirrorBaseY + 0.3 * mScale, Z_WALL + 0.25);

  rightDecor.scale.setScalar(sideScale);
  rightDecor.position.set(sideX, targetMirrorBaseY + 0.3 * mScale, Z_WALL + 0.25);

  const chairX = currentHairWidth * 1.18;
  chairLeft.position.set(-chairX, -2.5, -5.8);
  chairRight.position.set(chairX, -2.5, -5.8);
  chairLeft.scale.setScalar(guestScaleX);
  chairRight.scale.setScalar(guestScaleX);
}

function syncRealScaleCamera(overridePxPerCm = null) {
  viewW = window.innerWidth;
  viewH = window.innerHeight;

  const cal = getPxPerCm();
  state.pxPerCm = overridePxPerCm != null ? overridePxPerCm : cal.pxPerCm;
  state.calibrated = cal.calibrated;
  state.calLabel = cal.label || '';

  renderer.setSize(viewW, viewH, false);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ovCanvas.width = Math.round(viewW * dpr);
  ovCanvas.height = Math.round(viewH * dpr);
  ovCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  camera.aspect = viewW / viewH;
  camera.updateProjectionMatrix();

  const visibleCmH = viewH / state.pxPerCm;
  const visibleCmW = viewW / state.pxPerCm;
  const halfFovRad = (FOV_DEG * Math.PI / 180) / 2;
  const camZ = visibleCmH / (2 * Math.tan(halfFovRad));

  const camY = 0.24 * visibleCmH;
  state.baseCamY = camY;
  state.baseCamZ = camZ;
  camera.position.set(0, camY, camZ);
  camera.lookAt(0, camY, 0);
  camera.updateMatrixWorld(true);

  layoutResponsiveScene(visibleCmW, visibleCmH, camZ, camY);
  updateCalLabel();
}

function worldToScreen(wx, wy, wz = 0) {
  const v = new THREE.Vector3(wx, wy, wz).project(camera);
  return { x: (v.x + 1) * 0.5 * viewW, y: (1 - v.y) * 0.5 * viewH };
}
function worldYToScreenY(worldY) { return worldToScreen(0, worldY, 0).y; }
function worldXToScreenX(worldX) { return worldToScreen(worldX, 0, 0).x; }

function updateCalLabel() {
  const note = document.getElementById('start-cal-note');
  const topBtn = document.getElementById('btn-cal');
  if (note) {
    note.textContent = state.calibrated
      ? `✓ 실측 보정됨 (${state.calLabel} · 1cm = ${state.pxPerCm.toFixed(1)}px)`
      : `자동 감지: ${state.calLabel || '기본'} (1cm = ${state.pxPerCm.toFixed(1)}px) · 실측과 다르면 위 버튼으로 1초 보정하세요`;
  }
  if (topBtn) {
    topBtn.textContent = state.calibrated ? '📏 1cm 보정됨 ✓' : '📏 실제 자 보정';
  }
}

function updateStepChips() {
  for (let i = 0; i < 3; i++) {
    const el = document.getElementById(`chip-${i}`);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (state.cutFlags[i]) {
      el.classList.add('done');
      el.textContent = `✓ ${SECTIONS[i].label}`;
    } else if (i === state.step && (state.phase === 'aim' || state.phase === 'cutting')) {
      el.classList.add('active');
      el.textContent = `${['①', '②', '③'][i]} ${SECTIONS[i].label}`;
    } else {
      el.textContent = `${['①', '②', '③'][i]} ${SECTIONS[i].label}`;
    }
  }
}

// ── 3구간 종합 오차 평가 (목표 평균 오차 + 좌우 수평 단차 오차!) ──
function evaluateThreeCuts(targetCm, rawCuts) {
  const cuts = rawCuts.map(c => Number((c != null ? c : 0).toFixed(2)));
  const diffsMm = cuts.map(c => Number(((c - targetCm) * 10).toFixed(1)));
  const absErrsMm = diffsMm.map(d => Math.abs(d));
  const avgCutCm = Number(((cuts[0] + cuts[1] + cuts[2]) / 3).toFixed(2));
  const signedAvgMm = Number(((avgCutCm - targetCm) * 10).toFixed(1));
  const goalErrMm = Number(((absErrsMm[0] + absErrsMm[1] + absErrsMm[2]) / 3).toFixed(1));
  const unevenMm = Number(((Math.max(...cuts) - Math.min(...cuts)) * 10).toFixed(1));
  // 목표 정확도 + 좌우 수평 균형 단차(50% 가중)를 합산!
  const totalErrMm = Number((goalErrMm + unevenMm * 0.5).toFixed(1));

  const score = Math.max(0, Number((100 - totalErrMm * 7.2).toFixed(1)));
  const accuracy = Math.max(0, Math.min(100, Number((100 - (totalErrMm / Math.max(5, targetCm * 10)) * 100).toFixed(1))));

  let rankTitle, comment, color;
  if (totalErrMm <= 0.8) {
    rankTitle = '✨ 청담동 수석 원장님';
    comment = '왼쪽·가운데·오른쪽 모두 완벽한 일자 컷! 손님이 거울 보고 환하게 웃으셨어요.';
    color = '#4ade80';
  } else if (totalErrMm <= 1.8) {
    rankTitle = '💇‍♀️ 단골 예약 프로 디자이너';
    comment = `길이도 균형도 아주 깔끔해요! (최대 단차 ${unevenMm.toFixed(1)}mm)`;
    color = '#4ade80';
  } else if (totalErrMm <= 3.4) {
    rankTitle = '✂️ 깔끔한 감각의 미용사';
    comment = '자연스럽게 잘 다듬었어요. 좌우 단차만 조금 더 맞추면 원장님 급이에요!';
    color = '#fde047';
  } else if (unevenMm >= 5.0) {
    rankTitle = '😱 계단 머리 발생!';
    comment = `왼쪽·가운데·오른쪽 단차가 ${unevenMm.toFixed(1)}mm나 벌어졌어요… 손님이 고개를 갸웃거립니다!`;
    color = '#fb7185';
  } else if (signedAvgMm > 5.0) {
    rankTitle = '😳 생각보다 너무 짧아졌어요';
    comment = `“${targetCm.toFixed(1)}cm만 다듬어 달랬는데…” 손님이 거울을 조용히 바라봅니다.`;
    color = '#fb7185';
  } else {
    rankTitle = '😅 살짝 삐끗한 연습생';
    comment = `목표 ${targetCm.toFixed(1)}cm와 조금 차이가 났어요. 한 번 더 차분하게 도전해 보세요!`;
    color = '#fb923c';
  }

  return {
    targetCm,
    cuts,
    diffsMm,
    avgCutCm,
    signedAvgMm,
    goalErrMm,
    unevenMm,
    totalErrMm,
    absErrMm: totalErrMm,
    score,
    accuracy,
    rankTitle,
    comment,
    color,
  };
}

function nextStartCutCm(stepIdx) {
  const base = Math.max(0.5, state.targetCm + 0.85);
  const offset = (((state.seed * 13 + stepIdx * 7) % 15) / 15) * 1.45;
  return Math.min(4.4, Number((base + offset).toFixed(2)));
}

function prepareRound(targetCm, seed = Math.floor(Math.random() * 9999) + 1) {
  state.targetCm = Number(targetCm.toFixed(1));
  state.seed = seed;
  state.step = 0;
  state.cuts = [null, null, null];
  state.tilts = [0, 0, 0];
  state.cutFlags = [false, false, false];
  state.cutCm = nextStartCutCm(0);
  state.liveCutCm = state.cutCm;
  state.tiltDeg = 0;
  state.stillSec = 0;
  state.introAnim = 0;
  state.cutAnim = 0;
  state.revealAnim = 0;
  state.lastResult = null;
  state.lastShareData = null;
  state.camFocusX = 0;
  state.camLookX = 0;
  state.handCenterX = sectionCenterX(0);

  vfx.sparks.length = 0;
  vfx.pops.length = 0;
  vfx.cutLineAlpha = 0;
  vfx.softFlash = 0;
  vfx.introSnipStep = 0;
  vfx.introOkFired = false;
  vfx.guestBubbleProg = 0;
  vfx.replyBubbleProg = 0;
  vfx.focusGlintFired = false;
  vfx.stampFired = false;
  vfx.stampAnim = 0;
  vfx.stampInfo = null;

  scissorGroup.rotation.set(0, 0, 0);
  leftPinch.rotation.set(0, 0, 0);
  headGroup.rotation.set(0, 0, 0);
  hairRoot.position.z = 0;
  orderBubble.style.opacity = '1';

  const theme = GUEST_THEMES[Math.abs(seed) % GUEST_THEMES.length];
  hairMatA.color.set(theme.hair[0]);
  hairMatB.color.set(theme.hair[1]);
  hairMatC.color.set(theme.hair[2]);
  hairMatD.color.set(theme.hair[3]);
  capeMat.color.set(theme.cape);

  const streakPill = document.getElementById('streak-pill');
  if (streakPill) {
    streakPill.style.display = state.streak > 0 ? 'inline-flex' : 'none';
    streakPill.textContent = `✨ ${state.streak}연속`;
  }

  for (let i = 0; i < STRAND_COUNT; i++) fallingBits[i].mesh.visible = false;

  orderCmEl.textContent = `${state.targetCm.toFixed(1)}cm`;
  document.getElementById('start-target').textContent = `${state.targetCm.toFixed(1)} cm`;
  updateStepChips();
  btnSnip.disabled = false;
  btnSnip.classList.remove('ready-glow');
  btnSnip.textContent = '✂️ 왼쪽 자르기 (1/3)';
  hintPill.classList.remove('focus-max');
  hintPill.textContent = '화면을 위아래로 움직여 왼쪽 높이를 맞춰 보세요';
  resultModal.classList.add('hidden');
}

// ── 부드러운 미용실 오프닝 (손님 뒤돌아봄 주문 → 미용사 “네~ 딱 맞춰 드릴게요!” & 가볍게 찰칵 → 왼쪽 구간 줌인) ──
function startIntroShow() {
  unlockAudio();
  BGM.start('haircut');
  startModal.classList.add('hidden');
  state.phase = 'intro';
  state.introAnim = 0;
  vfx.introSnipStep = 0;
  vfx.introOkFired = false;
  vfx.guestBubbleProg = 0;
  vfx.replyBubbleProg = 0;
  headGroup.rotation.set(0, 0, 0);
  orderBubble.style.opacity = '0';
  btnSnip.disabled = true;
  btnSnip.textContent = '💬 손님 주문 듣는 중…';
  hintPill.textContent = '손님이 주문 중이에요 (화면 터치 시 바로 시작)';
  SALON_SFX.bubblePop();
}

function enterSectionAim(stepIdx) {
  state.step = stepIdx;
  state.phase = 'aim';
  state.cutCm = nextStartCutCm(stepIdx);
  state.liveCutCm = state.cutCm;
  state.tiltDeg = 0;
  state.stillSec = 0;
  vfx.focusGlintFired = false;
  const sec = SECTIONS[stepIdx];
  updateStepChips();
  btnSnip.disabled = false;
  btnSnip.classList.remove('ready-glow');
  btnSnip.textContent = `✂️ ${sec.label} 자르기 (${stepIdx + 1}/3)`;
  hintPill.classList.remove('focus-max');
  hintPill.textContent = stepIdx === 0
    ? '위아래로 드래그해 왼쪽 다발 높이를 맞추고 잘라 주세요'
    : `방금 자른 옆 머리와 수평이 맞게 ${sec.label} 높이를 맞춰 보세요`;
}

function finishIntroToAim() {
  scissorGroup.rotation.set(0, 0, 0);
  leftPinch.rotation.set(0, 0, 0);
  headGroup.rotation.set(0, 0, 0);
  hairRoot.position.z = 0;
  orderBubble.style.opacity = '1';
  vfx.guestBubbleProg = 0;
  vfx.replyBubbleProg = 0;
  enterSectionAim(0);
  SALON_SFX.glint();
}

function triggerSnip() {
  if (state.phase !== 'aim') return;
  unlockAudio();
  const stepIdx = state.step;
  const sec = SECTIONS[stepIdx];
  state.phase = 'cutting';
  const cutVal = Math.max(0.05, Number(state.liveCutCm.toFixed(2)));
  const tiltVal = Number(state.tiltDeg.toFixed(1));
  state.cuts[stepIdx] = cutVal;
  state.tilts[stepIdx] = tiltVal;
  state.cutFlags[stepIdx] = true;
  state.cutAnim = 0;

  updateStepChips();
  btnSnip.disabled = true;
  btnSnip.classList.remove('ready-glow');
  hintPill.classList.remove('focus-max');
  hintPill.textContent = stepIdx < 2 ? `✂️ ${sec.label} 완료! 다음 구간으로 이동합니다…` : '✂️ 3구간 커트 완료! 실측 결과를 확인 중…';

  // 깔끔하고 부드러운 가위 컷 효과
  SFX.snip();
  SALON_SFX.cleanCut(stepIdx);
  vfx.softFlash = 0.42;

  const secCX = sectionCenterX(stepIdx);
  const halfSecW = currentHairWidth / 6;
  const pL = worldToScreen(secCX - halfSecW, cutVal, 0.1);
  const pR = worldToScreen(secCX + halfSecW, cutVal, 0.1);
  vfx.cutLineAlpha = 1.0;
  vfx.cutLineX0 = pL.x;
  vfx.cutLineX1 = pR.x;
  vfx.cutLineY = (pL.y + pR.y) * 0.5;

  const midX = (pL.x + pR.x) * 0.5;
  spawnSparks(midX, vfx.cutLineY, 16, ['#ffffff', '#fde68a', '#fda4af']);
  spawnPopText('싹둑!', `${sec.label} (${stepIdx + 1}/3)`, midX, Math.max(150, vfx.cutLineY - 30), {
    size: viewW < 500 ? 34 : 44,
    color: '#fffdf7',
    stroke: '#2c2235',
    shadow: 'rgba(44,34,53,0.35)',
    rot: (stepIdx - 1) * 0.06,
    life: 0.65,
    vy: -24,
  });

  // 현재 구간의 12가닥만 정확히 잘려 팔랑팔랑 떨어짐!
  const [iStart, iEnd] = sec.range;
  const tiltRad = (tiltVal * Math.PI) / 180;
  for (let i = iStart; i <= iEnd; i++) {
    const fb = fallingBits[i];
    const s = strands[i];
    const localCut = Math.max(0.08, cutVal + Math.tan(tiltRad) * (s.x - secCX));
    fb.h = localCut;
    fb.x = s.x;
    fb.y = localCut / 2;
    fb.vy = 0.6 - Math.random() * 2.0;
    fb.vx = (Math.random() - 0.5) * 2.4;
    fb.rot = 0;
    fb.vrot = (Math.random() - 0.5) * 4.5;
    fb.mesh.scale.y = localCut;
    fb.mesh.position.set(fb.x, fb.y, 0.16);
    fb.mesh.rotation.set(0, 0, 0);
    fb.mesh.visible = true;
  }
}

async function showResultModal() {
  state.phase = 'result';
  const ev = evaluateThreeCuts(state.targetCm, state.cuts);
  state.lastResult = ev;

  if (ev.totalErrMm <= 2.2) state.streak += 1;
  else state.streak = 0;
  localStorage.setItem(STREAK_KEY, String(state.streak));
  const streakPill = document.getElementById('streak-pill');
  if (streakPill) {
    streakPill.style.display = state.streak > 0 ? 'inline-flex' : 'none';
    streakPill.textContent = `✨ ${state.streak}연속`;
  }

  if (ev.totalErrMm <= 1.8) SFX.win();
  else if (ev.totalErrMm > 4.5) SFX.fail();
  else SFX.tick();

  const isNewBest = updateBestRecord('haircut', {
    score: ev.score,
    errorMm: ev.totalErrMm,
    actualValue: ev.avgCutCm,
    targetValue: ev.targetCm,
    rankTitle: ev.rankTitle,
  }, true);

  document.getElementById('res-rank').textContent = isNewBest ? `${ev.rankTitle} · 신기록!` : ev.rankTitle;
  document.getElementById('res-headline').textContent = `종합 오차 ${ev.totalErrMm.toFixed(1)} mm`;
  document.getElementById('res-headline').style.color = ev.color;
  document.getElementById('res-comment').textContent = ev.comment;

  for (let i = 0; i < 3; i++) {
    const valEl = document.getElementById(`res-sec-${i}`);
    const diffEl = document.getElementById(`res-diff-${i}`);
    if (valEl) valEl.textContent = `${ev.cuts[i].toFixed(2)}cm`;
    if (diffEl) {
      const d = ev.diffsMm[i];
      diffEl.textContent = `${d >= 0 ? '+' : ''}${d.toFixed(1)}mm`;
      diffEl.style.color = Math.abs(d) <= 1.5 ? '#4ade80' : Math.abs(d) <= 3.0 ? '#fde047' : '#fb7185';
    }
  }

  document.getElementById('res-target').textContent = `${ev.targetCm.toFixed(2)}cm`;
  document.getElementById('res-actual').textContent = `${ev.avgCutCm.toFixed(2)}cm`;
  const unevenEl = document.getElementById('res-uneven');
  if (unevenEl) {
    unevenEl.textContent = `${ev.unevenMm.toFixed(1)}mm`;
    unevenEl.style.color = ev.unevenMm <= 1.5 ? '#4ade80' : ev.unevenMm <= 3.5 ? '#fde047' : '#fb7185';
  }
  document.getElementById('res-pct').textContent = `정확도 ${ev.accuracy.toFixed(1)}%`;

  const track = document.getElementById('res-ruler-track');
  const maxAxis = Math.max(ev.targetCm * 2.0, ...ev.cuts.map(c => c * 1.25), state.rival ? state.rival.actualValue * 1.25 : 0, 2.5);
  const pctOf = cm => Math.max(5, Math.min(95, (cm / maxAxis) * 100));
  let trackHTML = `
    <div class="ruler-mark" style="left:${pctOf(ev.targetCm)}%;background:#4ade80"></div>
    <div class="ruler-tag" style="left:${pctOf(ev.targetCm)}%;background:#14532d;color:#86efac">목표 ${ev.targetCm.toFixed(1)}</div>
  `;
  const labels = ['왼', '중', '오'];
  const cols = ['#fb7185', '#fde047', '#38bdf8'];
  for (let i = 0; i < 3; i++) {
    trackHTML += `
      <div class="ruler-mark" style="left:${pctOf(ev.cuts[i])}%;background:${cols[i]}"></div>
      <div class="ruler-tag" style="left:${pctOf(ev.cuts[i])}%;top:22px;background:#1f192b;color:${cols[i]}">${labels[i]} ${ev.cuts[i].toFixed(2)}</div>
    `;
  }
  track.innerHTML = trackHTML;

  document.getElementById('res-vs-wrap').style.display = 'none';
  document.getElementById('res-nick').value = getSavedNickname();
  document.getElementById('res-lb-wrap').style.display = 'none';
  resultModal.classList.remove('hidden');
  refreshBestBadge();

  const saved = await saveResultAndBuildShare({
    gameId: 'haircut',
    nickname: getSavedNickname() || '익명 도전자',
    targetValue: ev.targetCm,
    actualValue: ev.avgCutCm,
    score: ev.score,
    errorMm: ev.totalErrMm,
    rankTitle: ev.rankTitle,
    seed: state.seed,
    meta: { cuts: ev.cuts, unevenMm: ev.unevenMm, goalErrMm: ev.goalErrMm, calibrated: state.calibrated },
  }, state.rival);

  state.lastShareData = saved;
  renderLeaderboardIfAny(saved);
}

function renderLeaderboardIfAny(saved) {
  const lbWrap = document.getElementById('res-lb-wrap');
  if (!saved || !saved.ladder || saved.ladder.length === 0) return;
  lbWrap.style.display = 'block';
  lbWrap.innerHTML = renderGlobalLadderHTML(saved, r =>
    `${Number(r.error_mm != null ? r.error_mm : 0).toFixed(1)}mm · ${Number(r.score || 0).toFixed(1)}점`
  );
}

// ── 2D 부드러운 미용실 오버레이 + 3구간 실측 눈금자 ──
function drawLensStar(ctx, x, y, r, alpha, rot = 0) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  const gr = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.85);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.4, 'rgba(253,230,138,0.55)');
  gr.addColorStop(1, 'rgba(253,230,138,0)');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 2; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.10, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.10, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSoftText(ctx, text, x, y, size, color, stroke, shadow, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `900 ${size}px Pretendard, "Apple SD Gothic Neo", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.fillStyle = shadow;
  ctx.fillText(text, 2, 4);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(5, size * 0.15);
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// 손님 뒤돌아봄 부드러운 크림 말풍선 (“1.0cm만 다듬어 주세요”)
function drawGuestTurnBubble(ctx, prog) {
  if (prog <= 0.01) return;
  const p = Math.min(1, prog);
  const scale = p < 0.28 ? 0.55 + (p / 0.28) * 0.52 : p < 0.45 ? 1.07 - ((p - 0.28) / 0.17) * 0.07 : 1.0;
  const isMob = viewW < 600;
  const bx = isMob ? viewW * 0.50 : viewW * 0.72;
  const by = isMob ? viewH * 0.43 : viewH * 0.27;
  const bw = isMob ? Math.min(viewW * 0.84, 316) : 362;
  const bh = isMob ? 92 : 104;

  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(44, 34, 53, 0.16)';
  ctx.beginPath(); ctx.roundRect(-bw / 2 + 5, -bh / 2 + 7, bw, bh, 24); ctx.fill();

  ctx.fillStyle = '#fffdf7';
  ctx.strokeStyle = '#3c2f4a';
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 24); ctx.fill(); ctx.stroke();

  // 꼬리
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  if (isMob) {
    ctx.moveTo(-14, -bh / 2 + 2);
    ctx.lineTo(10, -bh / 2 - 20);
    ctx.lineTo(16, -bh / 2 + 2);
  } else {
    ctx.moveTo(-bw / 2 + 2, -12);
    ctx.lineTo(-bw / 2 - 26, -2);
    ctx.lineTo(-bw / 2 + 2, 14);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fffdf7';
  if (isMob) ctx.fillRect(-12, -bh / 2 + 1, 26, 7);
  else ctx.fillRect(-bw / 2 + 1, -10, 7, 22);

  const cmStr = `${state.targetCm.toFixed(1)}cm`;
  const mainSize = isMob ? 24 : 28;
  ctx.font = `900 ${mainSize}px Pretendard, sans-serif`;
  const w1 = ctx.measureText(`“${cmStr}`).width;
  const w2 = ctx.measureText('만 다듬어 주세요”').width;
  const startX = -(w1 + w2) / 2;

  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#d94662';
  ctx.fillText(`“${cmStr}`, startX, -10);
  ctx.fillStyle = '#2c2235';
  ctx.fillText('만 다듬어 주세요”', startX + w1, -10);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7c6f8d';
  ctx.font = `700 ${isMob ? 12.5 : 14}px Pretendard, sans-serif`;
  ctx.fillText('왼쪽 · 가운데 · 오른쪽 고르게 부탁드려요 ✂️', 0, bh * 0.24);
  ctx.restore();
}

function drawStylistReplyBubble(ctx, prog) {
  if (prog <= 0.01) return;
  const p = Math.min(1, prog);
  const scale = p < 0.28 ? 0.6 + (p / 0.28) * 0.46 : p < 0.45 ? 1.06 - ((p - 0.28) / 0.17) * 0.06 : 1.0;
  const isMob = viewW < 600;
  const bw = isMob ? 268 : 318;
  const bh = isMob ? 66 : 74;

  ctx.save();
  ctx.translate(viewW * 0.5, viewH * 0.44);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(44, 34, 53, 0.18)';
  ctx.beginPath(); ctx.roundRect(-bw / 2 + 4, -bh / 2 + 6, bw, bh, 22); ctx.fill();
  ctx.fillStyle = '#2c2235';
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 22); ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.font = `900 ${isMob ? 21 : 25}px Pretendard, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('“네~ 딱 맞춰 드릴게요!”', 0, 0);
  ctx.restore();
}

function drawOverlay(nowSec) {
  ovCtx.clearRect(0, 0, viewW, viewH);

  // 1) 인트로 부드러운 말풍선 + 은은한 가위 반짝임
  if (state.phase === 'intro') {
    const p = state.introAnim;
    if (p < 1.05) {
      drawGuestTurnBubble(ovCtx, vfx.guestBubbleProg);
    } else if (p < 1.72) {
      drawStylistReplyBubble(ovCtx, vfx.replyBubbleProg);
      const sp = worldToScreen(rightRig.position.x, rightRig.position.y, 0.6);
      drawLensStar(ovCtx, sp.x, sp.y, 28 + Math.sin(nowSec * 14) * 6, 0.82, nowSec * 1.6);
    }
  }

  // 2) 조준 중 안정화(초집중) 은은한 가위 나사 반짝임
  if (state.phase === 'aim') {
    const calm = Math.min(1, state.stillSec / 0.55);
    if (calm > 0.65) {
      const f = (calm - 0.65) / 0.35;
      const piv = worldToScreen(rightRig.position.x, rightRig.position.y, 0.55);
      drawLensStar(ovCtx, piv.x, piv.y, (20 + Math.sin(nowSec * 10) * 5) * f, f * 0.85, nowSec * 1.4);
    }
  }

  // 3) 자르는 순간 부드러운 플래시 + 산뜻한 화이트-골드 컷 라인
  if (vfx.softFlash > 0.01) {
    ovCtx.save();
    ovCtx.fillStyle = `rgba(255, 253, 245, ${vfx.softFlash * 0.38})`;
    ovCtx.fillRect(0, 0, viewW, viewH);
    ovCtx.restore();
  }
  if (vfx.cutLineAlpha > 0.01) {
    const a = vfx.cutLineAlpha;
    ovCtx.save();
    ovCtx.strokeStyle = `rgba(255, 255, 255, ${a * 0.95})`;
    ovCtx.lineWidth = 3 + a * 5;
    ovCtx.lineCap = 'round';
    ovCtx.beginPath();
    ovCtx.moveTo(vfx.cutLineX0 - 10, vfx.cutLineY);
    ovCtx.lineTo(vfx.cutLineX1 + 10, vfx.cutLineY);
    ovCtx.stroke();
    ovCtx.restore();
  }

  // 4) 3구간 실측 1mm 눈금자 + 왼쪽/가운데/오른쪽 각각의 실제 잘린 선 공개!
  if (state.phase === 'reveal' || state.phase === 'result') {
    const k = Math.min(1, state.revealAnim);
    const easeK = k * k * (3 - 2 * k);
    const pxCm = state.pxPerCm;
    const baseY = worldYToScreenY(0);
    const rightEdgeX = Math.min(viewW - 58, worldXToScreenX(currentHairWidth * 0.5) + 18);
    const leftEdgeX = Math.max(12, worldXToScreenX(-currentHairWidth * 0.56));

    ovCtx.save();
    ovCtx.globalAlpha = easeK;

    // 원래 머리끝 기준선 (0cm)
    ovCtx.strokeStyle = 'rgba(44, 34, 53, 0.45)';
    ovCtx.lineWidth = 1.8;
    ovCtx.setLineDash([5, 5]);
    ovCtx.beginPath();
    ovCtx.moveTo(leftEdgeX, baseY);
    ovCtx.lineTo(rightEdgeX + 46, baseY);
    ovCtx.stroke();
    ovCtx.setLineDash([]);

    // 1mm 실측 눈금자
    const maxCm = 5;
    const rulerTopY = baseY - maxCm * pxCm;
    ovCtx.fillStyle = 'rgba(255, 253, 247, 0.96)';
    ovCtx.strokeStyle = '#3c2f4a';
    ovCtx.lineWidth = 2;
    ovCtx.beginPath();
    ovCtx.roundRect(rightEdgeX, rulerTopY - 12, 52, maxCm * pxCm + 24, 10);
    ovCtx.fill();
    ovCtx.stroke();

    for (let mm = 0; mm <= maxCm * 10; mm++) {
      const y = baseY - (mm / 10) * pxCm;
      const isCm = mm % 10 === 0;
      const isHalf = mm % 5 === 0;
      const tickW = isCm ? 24 : isHalf ? 15 : 9;
      ovCtx.strokeStyle = isCm ? '#2c2235' : '#857a94';
      ovCtx.lineWidth = isCm ? 2 : 1;
      ovCtx.beginPath();
      ovCtx.moveTo(rightEdgeX, y);
      ovCtx.lineTo(rightEdgeX + tickW, y);
      ovCtx.stroke();

      if (isCm) {
        ovCtx.fillStyle = '#2c2235';
        ovCtx.font = '800 12px Pretendard, sans-serif';
        ovCtx.textAlign = 'right';
        ovCtx.textBaseline = 'middle';
        ovCtx.fillText(`${mm / 10}`, rightEdgeX + 46, y);
      }
    }

    // 초록 목표선 (전체 가로)
    const targetY = baseY - state.targetCm * pxCm;
    ovCtx.strokeStyle = '#16a34a';
    ovCtx.lineWidth = 2.5;
    ovCtx.beginPath();
    ovCtx.moveTo(leftEdgeX, targetY);
    ovCtx.lineTo(rightEdgeX, targetY);
    ovCtx.stroke();
    drawTag(ovCtx, leftEdgeX, targetY - 14, `목표 ${state.targetCm.toFixed(1)}cm`, '#16a34a', '#ffffff', 'left');

    // 왼쪽 · 가운데 · 오른쪽 3구간 각각의 실제 자른 높이와 꼬리표!
    const halfSecW = currentHairWidth / 6;
    for (let i = 0; i < 3; i++) {
      const c = state.cuts[i];
      if (c == null) continue;
      const cx = sectionCenterX(i);
      const sx0 = worldXToScreenX(cx - halfSecW + 0.04);
      const sx1 = worldXToScreenX(cx + halfSecW - 0.04);
      const sy = baseY - c * pxCm;

      ovCtx.strokeStyle = SECTIONS[i].col;
      ovCtx.lineWidth = 3.5;
      ovCtx.beginPath();
      ovCtx.moveTo(sx0, sy);
      ovCtx.lineTo(sx1, sy);
      ovCtx.stroke();

      const labelY = sy + (i === 1 ? 17 : (Math.abs(sy - targetY) < 22 ? 17 : -14));
      drawTag(ovCtx, (sx0 + sx1) * 0.5, labelY, `${SECTIONS[i].label} ${c.toFixed(2)}`, '#2c2235', '#fff8e7', 'center');
    }

    ovCtx.restore();

    // 4-B) 부드러운 미용실 판정 도장 카드
    if (vfx.stampInfo && vfx.stampAnim > 0 && state.phase === 'reveal') {
      const sp = Math.min(1, vfx.stampAnim);
      const scale = sp < 0.35 ? 1.5 - (sp / 0.35) * 0.56 : 0.94 + Math.sin((sp - 0.35) * 8) * 0.06 * (1 - sp);
      const st = vfx.stampInfo;
      const sx = viewW < 600 ? viewW * 0.44 : viewW * 0.25;
      const sy = viewW < 600 ? Math.max(204, viewH * 0.29) : viewH * 0.36;

      ovCtx.save();
      ovCtx.translate(sx, sy);
      ovCtx.rotate(-0.06);
      ovCtx.scale(scale, scale);

      const bw = viewW < 600 ? 236 : 284;
      const bh = viewW < 600 ? 78 : 92;
      ovCtx.fillStyle = 'rgba(44, 34, 53, 0.22)';
      ovCtx.beginPath(); ovCtx.roundRect(-bw / 2 + 5, -bh / 2 + 6, bw, bh, 18); ovCtx.fill();

      ovCtx.fillStyle = st.bg;
      ovCtx.strokeStyle = st.border;
      ovCtx.lineWidth = 3.5;
      ovCtx.beginPath(); ovCtx.roundRect(-bw / 2, -bh / 2, bw, bh, 18); ovCtx.fill(); ovCtx.stroke();

      ovCtx.fillStyle = st.fg;
      ovCtx.font = `900 ${viewW < 600 ? 25 : 31}px Pretendard, sans-serif`;
      ovCtx.textAlign = 'center'; ovCtx.textBaseline = 'middle';
      ovCtx.fillText(st.main, 0, -10);

      ovCtx.font = `700 ${viewW < 600 ? 12 : 13.5}px Pretendard, sans-serif`;
      ovCtx.fillText(st.sub, 0, bh * 0.25);
      ovCtx.restore();
    }
  }

  // 5) 스파크 & 컨페티 파티클
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
      ovCtx.arc(0, 0, p.size * 0.65, 0, Math.PI * 2);
      ovCtx.fill();
    }
    ovCtx.restore();
  }

  // 6) 산뜻한 의성어 팝업 (“찰칵!”, “싹둑!”)
  for (const pop of vfx.pops) {
    const p = 1 - pop.life / pop.maxLife;
    const scale = p < 0.2 ? 0.55 + (p / 0.2) * 0.55 : p < 0.35 ? 1.1 - ((p - 0.2) / 0.15) * 0.1 : 1.0;
    const alpha = p > 0.7 ? Math.max(0, 1 - (p - 0.7) / 0.3) : 1;
    ovCtx.save();
    ovCtx.globalAlpha = alpha;
    ovCtx.translate(pop.x, pop.y);
    ovCtx.scale(scale, scale);
    drawSoftText(ovCtx, pop.text, 0, 0, pop.size, pop.color, pop.stroke, pop.shadow, pop.rot);
    if (pop.sub) {
      drawSoftText(ovCtx, pop.sub, 0, pop.size * 0.76, Math.round(pop.size * 0.38), '#fde68a', '#2c2235', 'rgba(44,34,53,0.28)', pop.rot * 0.5);
    }
    ovCtx.restore();
  }
}

function drawTag(ctx, x, y, text, bg, fg, align = 'center') {
  ctx.save();
  ctx.font = '800 11.5px Pretendard, sans-serif';
  const w = ctx.measureText(text).width + 14;
  const h = 21;
  const rx = align === 'right' ? Math.max(8, x - w) : align === 'left' ? x : Math.max(8, Math.min(viewW - w - 8, x - w / 2));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(rx, y - h / 2, w, h, 7);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rx + w / 2, y);
  ctx.restore();
}

// ── 입력 처리 ──
glCanvas.addEventListener('pointerdown', e => {
  if (state.phase === 'intro') {
    finishIntroToAim();
    return;
  }
  if (state.phase !== 'aim') return;
  unlockAudio();
  state.isDragging = true;
  state.stillSec = 0;
  vfx.focusGlintFired = false;
  state.lastPointerX = e.clientX;
  state.lastPointerY = e.clientY;
  state.lastRustleY = e.clientY;
  glCanvas.setPointerCapture(e.pointerId);
});

glCanvas.addEventListener('pointermove', e => {
  if (!state.isDragging || state.phase !== 'aim') return;
  const dxPx = e.clientX - state.lastPointerX;
  const dyPx = state.lastPointerY - e.clientY;
  state.lastPointerX = e.clientX;
  state.lastPointerY = e.clientY;
  const deltaCm = dyPx / state.pxPerCm;
  state.cutCm = Math.max(0.05, Math.min(5.2, state.cutCm + deltaCm));
  state.tiltDeg = Math.max(-4.5, Math.min(4.5, state.tiltDeg + dxPx * 0.03));
  if (Math.abs(dyPx) > 1.2 || Math.abs(dxPx) > 1.2) {
    state.stillSec = 0;
    vfx.focusGlintFired = false;
  }

  if (Math.abs(e.clientY - state.lastRustleY) > 22) {
    state.lastRustleY = e.clientY;
    SFX.rustle();
  }
});

const endDrag = () => { state.isDragging = false; };
glCanvas.addEventListener('pointerup', endDrag);
glCanvas.addEventListener('pointercancel', endDrag);

window.addEventListener('keydown', e => {
  if (state.phase === 'intro' && (e.key === ' ' || e.key === 'Enter')) {
    finishIntroToAim();
    e.preventDefault();
    return;
  }
  if (state.phase !== 'aim') return;
  if (e.key === 'ArrowUp') { state.cutCm = Math.min(5.2, state.cutCm + 0.05); state.stillSec = 0; vfx.focusGlintFired = false; e.preventDefault(); }
  else if (e.key === 'ArrowDown') { state.cutCm = Math.max(0.05, state.cutCm - 0.05); state.stillSec = 0; vfx.focusGlintFired = false; e.preventDefault(); }
  else if (e.key === ' ' || e.key === 'Enter') { triggerSnip(); e.preventDefault(); }
});

btnSnip.addEventListener('click', triggerSnip);
document.getElementById('btn-start').addEventListener('click', startIntroShow);

const openCal = () => openCalibrationModal(
  saved => {
    syncRealScaleCamera(saved.pxPerCm);
    showToast(`📏 1cm = ${saved.pxPerCm.toFixed(1)}px 저장 완료!`);
  },
  livePxPerCm => {
    syncRealScaleCamera(livePxPerCm);
  }
);
document.getElementById('btn-cal').addEventListener('click', openCal);
document.getElementById('btn-start-cal').addEventListener('click', openCal);

const btnBgm = document.getElementById('btn-bgm');
function syncBgmBtn() {
  if (!btnBgm) return;
  const muted = BGM.isMuted();
  btnBgm.textContent = muted ? '🔇 BGM 꺼짐' : '🔊 BGM 켜짐';
  btnBgm.classList.toggle('bgm-off', muted);
}
syncBgmBtn();
if (btnBgm) {
  btnBgm.addEventListener('click', () => {
    unlockAudio();
    const muted = BGM.toggleMute();
    if (!muted) BGM.start('haircut');
    syncBgmBtn();
  });
}

document.getElementById('btn-share').addEventListener('click', async () => {
  if (!state.lastResult) return;
  const nick = saveNickname(document.getElementById('res-nick').value.trim() || getSavedNickname() || '익명 도전자');
  const data = await saveResultAndBuildShare({
    gameId: 'haircut',
    nickname: nick,
    targetValue: state.lastResult.targetCm,
    actualValue: state.lastResult.avgCutCm,
    score: state.lastResult.score,
    errorMm: state.lastResult.totalErrMm,
    rankTitle: state.lastResult.rankTitle,
    seed: state.seed,
    meta: { cuts: state.lastResult.cuts, unevenMm: state.lastResult.unevenMm, calibrated: state.calibrated },
  }, state.rival);
  state.lastShareData = data;
  renderLeaderboardIfAny(data);

  const ev = state.lastResult;
  const rankStr = data.myRank ? `전체 ${data.myRank}위 · ` : '';
  await shareChallengeLink({
    title: `✂️ ${nick}님의 [어떻게 잘라드릴까요?] 랭킹 기록`,
    text: `✂️ [어떻게 잘라드릴까요?] ${rankStr}${ev.targetCm.toFixed(1)}cm 주문에 3구간 종합 오차 ${ev.totalErrMm.toFixed(1)}mm! (단차 ${ev.unevenMm.toFixed(1)}mm · ${ev.rankTitle})\n전체 랭킹에서 내 위치 보고 도전해 봐 👇`,
    url: data.shareUrl,
  });
});

document.getElementById('btn-save-img').addEventListener('click', () => {
  if (!state.lastResult) return;
  const ev = state.lastResult;
  downloadResultCard({
    gameTitle: '어떻게 잘라드릴까요?',
    emoji: '✂️',
    rankTitle: ev.rankTitle,
    headline: `종합 오차 ${ev.totalErrMm.toFixed(1)} mm`,
    subline: `${ev.targetCm.toFixed(1)}cm 주문 · 왼 ${ev.cuts[0].toFixed(2)} / 중 ${ev.cuts[1].toFixed(2)} / 오 ${ev.cuts[2].toFixed(2)}cm`,
    stats: [
      { label: '주문 길이', value: `${ev.targetCm.toFixed(1)}cm` },
      { label: '3구간 단차', value: `${ev.unevenMm.toFixed(1)}mm`, color: '#fde047' },
      { label: '정확도', value: `${ev.accuracy.toFixed(0)}%`, color: ev.color },
    ],
    extraCanvas: glCanvas,
  });
});

document.getElementById('btn-retry-same').addEventListener('click', () => {
  prepareRound(state.targetCm, state.seed + 1);
  startIntroShow();
});

document.getElementById('btn-retry-rand').addEventListener('click', () => {
  const choices = [0.6, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.3, 2.5, 3.0];
  const nextCm = choices[Math.floor(Math.random() * choices.length)];
  state.rival = null;
  rivalBanner.style.display = 'none';
  orderBubble.classList.remove('with-rival');
  prepareRound(nextCm);
  startIntroShow();
});

// ── 메인 루프 ──
let prevT = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = Math.min(0.05, (now - prevT) / 1000);
  prevT = now;
  const t = now / 1000;
  const dt = rawDt;

  vfx.softFlash = Math.max(0, vfx.softFlash - rawDt * 4.2);
  vfx.cutLineAlpha = Math.max(0, vfx.cutLineAlpha - rawDt * 2.8);

  for (let i = vfx.sparks.length - 1; i >= 0; i--) {
    const p = vfx.sparks[i];
    p.life -= rawDt;
    if (p.life <= 0) { vfx.sparks.splice(i, 1); continue; }
    p.vy += (p.confetti ? 460 : 620) * rawDt;
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

  // 3구간별 머리카락 길이 + 현재 잡은 다발 살짝 앞으로 빗겨 들기!
  for (let i = 0; i < STRAND_COUNT; i++) {
    const s = strands[i];
    const secIdx = i < 12 ? 0 : i < 24 ? 1 : 2;
    const isCut = state.cutFlags[secIdx];
    const secCX = sectionCenterX(secIdx);
    const tiltRad = ((isCut ? state.tilts[secIdx] : 0) * Math.PI) / 180;
    const curBottomY = isCut
      ? Math.max(0.05, state.cuts[secIdx] + Math.tan(tiltRad) * (s.x - secCX))
      : 0;
    const len = Math.max(1.5, (s.topY || currentHairTopY) - curBottomY);
    s.mesh.scale.y = len;

    // 현재 조준 중인 구간만 살짝 앞으로(z+0.085) 빗겨 올라와 자연스럽게 구분됨!
    const isCurrentActive = (state.phase === 'aim' || state.phase === 'cutting') && secIdx === state.step;
    const targetZ = s.archZ + (isCurrentActive ? 0.085 : 0);
    s.mesh.position.z += (targetZ - s.mesh.position.z) * Math.min(1, dt * 10);

    const sway = (state.phase === 'aim' || state.phase === 'start' || state.phase === 'intro')
      ? Math.sin(t * 1.6 + s.phase) * 0.025
      : 0;
    s.mesh.rotation.z = sway * 0.04;
  }

  const secW = currentHairWidth / 3;
  const activeSecX = sectionCenterX(state.step);
  // 손과 가위가 부드럽게 현재 구간(왼쪽 → 가운데 → 오른쪽)으로 이동!
  state.handCenterX += (activeSecX - state.handCenterX) * Math.min(1, dt * 9.0);

  // 원본 1cm만요 샷(007.80.jpg)처럼 왼손이 현재 다발을 가로질러 집고, 오른손 가위가 그 바로 오른쪽 끝에서 대기!
  const rightBaseX = state.handCenterX + secW * 0.5 + 0.34 * state.handScale;
  const leftBaseX = state.handCenterX - secW * 0.5 + 0.24 * state.handScale;

  let targetCamX = 0;
  let targetLookX = 0;
  let introCamOffsetY = 0;
  let introCamZoom = 1;

  if (state.phase === 'intro') {
    state.introAnim += rawDt;
    const p = state.introAnim;
    rightRig.visible = true;
    leftPinch.visible = true;

    if (p < 1.05) {
      // 1막: 원본 1cm만요 구도 A 느낌(살짝 오른쪽 비스듬한 뒤 앵글) + 손님 뒤돌아보며 주문!
      const u = Math.min(1, p / 0.36);
      const easeU = 1 - Math.pow(1 - u, 3);
      vfx.guestBubbleProg = Math.min(1, p / 0.34);

      const nod = p > 0.36 ? Math.sin((p - 0.36) * 8) * 0.045 : 0;
      headGroup.rotation.set(0.05 + nod, -1.42 * easeU, -0.06 * easeU);
      hairRoot.position.z = -1.75 * easeU;

      targetCamX = 1.65 * easeU;
      targetLookX = 0.15 * easeU;
      introCamOffsetY = easeU * 1.9;
      introCamZoom = 1 - easeU * 0.12;

      rightRig.position.set(currentHairWidth * 0.5 + 3.4, state.cutCm - 1.2, 0.52);
      rightRig.rotation.z = -0.25;
      leftPinch.position.set(-currentHairWidth * 0.5 - 3.4, state.cutCm - 1.2, 0.22);
      leftPinch.rotation.z = 0.2;
    } else if (p < 1.78) {
      // 2막: 미용사 “네~ 딱 맞춰 드릴게요!” + 가위 가볍게 2번 찰칵! + 왼손 꼬리빗 빗어내리기
      const u = (p - 1.05) / 0.73;
      const easeU = 1 - Math.pow(1 - Math.min(1, u * 1.8), 3);
      vfx.guestBubbleProg = 0;
      vfx.replyBubbleProg = Math.min(1, u * 3.2);

      if (!vfx.introOkFired) {
        vfx.introOkFired = true;
        SALON_SFX.okReply();
        btnSnip.textContent = '✂️ “네~ 딱 맞춰 드릴게요!”';
        hintPill.textContent = '가위와 빗을 준비하고 있어요 (터치 시 바로 시작)';
      }

      headGroup.rotation.set(0.05 * (1 - easeU), -1.42 * (1 - easeU), -0.06 * (1 - easeU));
      hairRoot.position.z = -1.75 * (1 - easeU);
      targetCamX = 1.65 * (1 - easeU);
      introCamOffsetY = 1.9 * (1 - easeU);
      introCamZoom = 0.88 + 0.12 * easeU;

      // 공중에서 우아하게 2번 찰칵!
      const snipCyc = (u * 2) % 1;
      const openA = Math.abs(Math.sin(snipCyc * Math.PI)) * 0.28;
      topBlade.rotation.z = -openA;
      botBlade.rotation.z = openA;
      rightRig.position.set(rightBaseX + 0.4 * (1 - u), state.cutCm + 1.05 * (1 - u), 0.60);
      rightRig.rotation.z = Math.sin(u * Math.PI * 2) * 0.08;

      const stepIdx = Math.min(2, Math.floor(u * 2) + 1);
      if (stepIdx > vfx.introSnipStep) {
        vfx.introSnipStep = stepIdx;
        SALON_SFX.softSnip(stepIdx - 1);
        const sp = worldToScreen(rightRig.position.x - 0.6, rightRig.position.y, 0.55);
        spawnSparks(sp.x, sp.y, 8, ['#ffffff', '#fde68a']);
        spawnPopText('찰칵!', '', sp.x - 24, sp.y - 34, { size: 28, color: '#fffdf7', stroke: '#2c2235', life: 0.42, vy: -35 });
      }

      // 왼손 꼬리빗 위→아래 빗어내리기
      const combY = currentHairTopY * 0.62 - u * (currentHairTopY * 0.62 - (state.cutCm + 0.24 * state.handScale));
      leftPinch.position.set(leftBaseX, combY, 0.26);
      leftPinch.rotation.z = 0.24 * (1 - u);
    } else if (p < 2.25) {
      // 3막: 1단계 [왼쪽] 다발로 부드럽게 안착!
      const u = (p - 1.78) / 0.47;
      const easeU = 1 - Math.pow(1 - u, 3);
      vfx.replyBubbleProg = Math.max(0, 1 - u * 3);
      orderBubble.style.opacity = String(Math.min(1, u * 2.5));
      headGroup.rotation.set(0, 0, 0);
      hairRoot.position.z = 0;

      targetCamX = sectionCenterX(0) * 0.42 * easeU;
      targetLookX = sectionCenterX(0) * 0.28 * easeU;
      rightRig.position.set(rightBaseX, state.cutCm + (1 - easeU) * 0.15, 0.52);
      rightRig.rotation.z = 0;
      topBlade.rotation.z = -0.16;
      botBlade.rotation.z = 0.16;
      leftPinch.position.set(leftBaseX, state.cutCm + 0.24 * state.handScale, 0.22);
      leftPinch.rotation.z = 0;
    } else {
      finishIntroToAim();
    }
  } else if (state.phase === 'aim') {
    if (!state.isDragging) {
      state.stillSec = Math.min(1.5, state.stillSec + dt);
      state.tiltDeg *= Math.max(0, 1 - dt * 2.8);
    }
    const calm = Math.min(1, state.stillSec / 0.55);
    const tremorCm = (1 - calm * 0.90) * (Math.sin(t * 9.0) * 0.028 + Math.cos(t * 13.5) * 0.014);
    state.liveCutCm = Math.max(0.05, state.cutCm + tremorCm);

    // 원본 1cm만요 구도 B/B3처럼 현재 자르는 구간 쪽으로 카메라 살짝 포커스! (y, z 고정 → 1cm 실측 유지!)
    targetCamX = activeSecX * 0.42;
    targetLookX = activeSecX * 0.28;

    const sec = SECTIONS[state.step];
    if (calm > 0.78) {
      if (!vfx.focusGlintFired) {
        vfx.focusGlintFired = true;
        SALON_SFX.glint();
        const piv = worldToScreen(rightBaseX, state.liveCutCm, 0.55);
        spawnSparks(piv.x, piv.y, 10, ['#ffffff', '#fde68a']);
      }
      hintPill.classList.add('focus-max');
      hintPill.textContent = `✓ 안정됨! 지금 ${sec.label}을 깔끔하게 잘라 보세요`;
      btnSnip.classList.add('ready-glow');
      btnSnip.textContent = `✂️ 지금 ${sec.label} 자르기 (${state.step + 1}/3)`;
    } else {
      hintPill.classList.remove('focus-max');
      hintPill.textContent = `위아래로 드래그해 ${sec.label} 높이를 맞추고 잠시 멈춰 보세요`;
      btnSnip.classList.remove('ready-glow');
      btnSnip.textContent = `✂️ ${sec.label} 자르기 (${state.step + 1}/3)`;
    }
  } else {
    state.liveCutCm = state.cutCm;
  }

  const aimY = state.liveCutCm;
  if (state.phase === 'start' || state.phase === 'aim') {
    rightRig.visible = true;
    leftPinch.visible = true;
    scissorGroup.rotation.z = 0;
    leftPinch.rotation.z = 0;
    rightRig.position.set(rightBaseX, aimY, 0.52);
    rightRig.rotation.z = (state.tiltDeg * Math.PI) / 180;
    const openAngle = 0.16 + Math.sin(t * 3.4) * 0.012;
    topBlade.rotation.z = -openAngle;
    botBlade.rotation.z = openAngle;

    leftPinch.position.set(leftBaseX, aimY + 0.24 * state.handScale, 0.22);
  } else if (state.phase === 'cutting') {
    targetCamX = activeSecX * 0.42;
    targetLookX = activeSecX * 0.28;
    state.cutAnim += dt * 3.6;
    const closeK = Math.min(1, state.cutAnim);
    const openAngle = 0.16 * (1 - closeK);
    topBlade.rotation.z = -openAngle;
    botBlade.rotation.z = openAngle;
    const curCut = state.cuts[state.step] || state.liveCutCm;
    const curTilt = state.tilts[state.step] || 0;
    rightRig.rotation.z = (curTilt * Math.PI) / 180;
    rightRig.position.set(rightBaseX - Math.sin(closeK * Math.PI) * 0.26, curCut, 0.52);
    leftPinch.position.set(leftBaseX, curCut + 0.24 * state.handScale, 0.22);

    if (state.cutAnim >= 1.35) {
      if (state.step < 2) {
        enterSectionAim(state.step + 1);
      } else {
        state.phase = 'reveal';
        state.revealAnim = 0;
        state.cutAnim = 0;
        SFX.tick();
      }
    }
  } else if (state.phase === 'reveal' || state.phase === 'result') {
    // 3구간 전체가 한눈에 들어오도록 정면 중앙(x=0)으로 부드럽게 복귀!
    targetCamX = 0;
    targetLookX = 0;
    state.revealAnim = Math.min(1, state.revealAnim + dt * 2.0);
    const retreat = state.revealAnim;
    rightRig.position.x = rightBaseX + retreat * 14;
    leftPinch.position.x = leftBaseX - retreat * 12;

    if (state.phase === 'reveal') {
      if (!vfx.stampFired && state.revealAnim >= 0.62) {
        vfx.stampFired = true;
        const previewEv = evaluateThreeCuts(state.targetCm, state.cuts);
        vfx.stampInfo = getStampInfo(previewEv);
        vfx.stampAnim = 0.001;
        const isGood = vfx.stampInfo.mode === 'god' || vfx.stampInfo.mode === 'great';
        SALON_SFX.stampChime(isGood);
        if (isGood) spawnConfetti(42);
      }
      if (vfx.stampAnim > 0) vfx.stampAnim = Math.min(1, vfx.stampAnim + rawDt * 2.6);

      if (state.revealAnim >= 1) {
        state.cutAnim += rawDt;
        const waitLeft = Math.max(0, 2.6 - state.cutAnim);
        hintPill.textContent = `📏 3구간 실측 결과 감상 중… (${Math.ceil(waitLeft)}초 뒤 결과 카드)`;
        if (state.cutAnim >= 2.6) showResultModal();
      }
    }
  }

  // 떨어진 머리카락 조각 물리 낙하 (3구간 모두 계속 부드럽게 떨어짐!)
  for (let i = 0; i < STRAND_COUNT; i++) {
    const fb = fallingBits[i];
    if (!fb.mesh.visible) continue;
    fb.vy -= 38 * dt;
    fb.y += fb.vy * dt;
    fb.x += fb.vx * dt;
    fb.rot += fb.vrot * dt;
    fb.mesh.position.set(fb.x, fb.y, 0.18);
    fb.mesh.rotation.z = fb.rot;
    if (fb.y < -35) fb.mesh.visible = false;
  }

  // 카메라 부드러운 구간 추적 (세로 y·거리 z는 aim 중 100% 고정 → 실제 1cm 정밀도 유지!)
  state.camFocusX += (targetCamX - state.camFocusX) * Math.min(1, dt * 6.5);
  state.camLookX += (targetLookX - state.camLookX) * Math.min(1, dt * 6.5);
  const finalCamY = state.baseCamY + introCamOffsetY;
  const finalCamZ = state.baseCamZ * introCamZoom;
  camera.position.set(state.camFocusX, finalCamY, finalCamZ);
  camera.lookAt(state.camLookX, finalCamY, 0);

  renderer.render(scene, camera);
  drawOverlay(t);
  window.__haircutDebug = { phase: state.phase, step: state.step, introAnim: state.introAnim, cuts: state.cuts.slice(), targetCm: state.targetCm };
}

function refreshBestBadge() {
  const best = getBestRecord('haircut');
  const el = document.getElementById('start-best');
  if (el && best && best.errorMm != null) el.textContent = `오차 ${Number(best.errorMm).toFixed(1)}mm`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function init() {
  syncRealScaleCamera();
  window.addEventListener('resize', () => syncRealScaleCamera());
  refreshBestBadge();

  const incoming = await loadIncomingChallenge('haircut');
  if (incoming) {
    state.rival = incoming;
    const tgt = incoming.targetValue > 0 ? incoming.targetValue : 1.0;
    prepareRound(tgt, incoming.seed || 7);

    rivalBanner.style.display = 'flex';
    orderBubble.classList.add('with-rival');
    rivalBannerText.innerHTML = `<strong>${escapeHtml(incoming.nickname)}</strong>님의 기록: ${tgt.toFixed(1)}cm 주문에서 <strong>오차 ${Number(incoming.errorMm || 0).toFixed(1)}mm</strong> (${escapeHtml(incoming.rankTitle)})`;

    const startRivalBox = document.getElementById('start-rival-box');
    startRivalBox.style.display = 'flex';
    startRivalBox.innerHTML = `
      <div class="vs-verdict" style="color:var(--accent);font-size:15px">🏆 내가 아는 ${escapeHtml(incoming.nickname)}님의 기록</div>
      <div style="text-align:center;font-size:13px;color:var(--muted)">
        똑같은 <b>${tgt.toFixed(1)}cm</b> 주문에서 <b>오차 ${Number(incoming.errorMm || 0).toFixed(1)}mm</b> 기록!<br>
        왼쪽·가운데·오른쪽 3구간을 더 고르게 잘라 순위를 넘겨 보세요!
      </div>
    `;
  } else {
    prepareRound(1.0);
  }

  requestAnimationFrame(animate);
}

init();
