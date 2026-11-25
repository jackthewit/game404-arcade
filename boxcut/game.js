// 열려라 택배! — 쾌속 직선 슬라이스 타임어택 3D 웹게임 (이게뭔겜? 404 아케이드)
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

const GAME_ID = 'boxcut';
const BEST_BOXES_KEY = 'fgs.boxcut.bestBoxes';
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

// 공개 상태 접근 제어 확인 (?rec=1 녹화 시에는 건너뜀)
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
renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c8bca9');
scene.fog = new THREE.Fog('#b9ad9c', 58, 112);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / Math.max(1, window.innerHeight), 0.5, 160);

// 조명 세팅 (눈부심 없이 입체 음영이 살아나는 따뜻한 현관 & 거실 마루 조명)
const hemiLight = new THREE.HemisphereLight('#fff8ee', '#6b5847', 0.94);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight('#fff3dc', 1.82);
dirLight.position.set(-12, 37, 22);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 8;
dirLight.shadow.camera.far = 105;
dirLight.shadow.camera.left = -26;
dirLight.shadow.camera.right = 26;
dirLight.shadow.camera.top = 36;
dirLight.shadow.camera.bottom = -32;
dirLight.shadow.bias = -0.0006;
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight('#fde68a', 0.52);
rimLight.position.set(18, 24, -18);
scene.add(rimLight);

// ─── 절차적 캔버스 텍스처 도우미 ───
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

// 골판지 테마별 상자 윗면/옆면 텍스처
const BOX_THEMES = [
  { name: 'craft', base: '#cb9c67', side: '#b48450', stripe: null, labelWord: '특급 배송' },
  { name: 'warm', base: '#d6a874', side: '#be8f5b', stripe: '#dc2626', labelWord: '설렘 택배' },
  { name: 'sand', base: '#c59b6d', side: '#ab8154', stripe: '#2563eb', labelWord: '파손 주의' },
  { name: 'mintbox', base: '#b8cbb8', side: '#9ab09a', stripe: '#059669', labelWord: '깜짝 선물' },
  { name: 'gold', base: '#e5b95c', side: '#ca9a3b', stripe: '#f59e0b', labelWord: 'VIP 특송' },
];

const THEME_MATERIALS = BOX_THEMES.map((th, idx) => {
  const topTex = makeCanvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = th.base;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) {
      g.fillStyle = x % 8 === 0 ? 'rgba(70,42,14,0.08)' : 'rgba(255,245,225,0.05)';
      g.fillRect(x, 0, 2, h);
    }
    for (let i = 0; i < 240; i++) {
      const rx = ((i * 73 + idx * 31) % 251);
      const ry = ((i * 137 + idx * 19) % 251);
      g.fillStyle = i % 2 === 0 ? 'rgba(60,35,10,0.06)' : 'rgba(255,240,210,0.05)';
      g.fillRect(rx, ry, 2, 7);
    }
    if (th.stripe) {
      g.fillStyle = th.stripe;
      g.globalAlpha = 0.24;
      g.fillRect(0, h - 22, w, 10);
      g.globalAlpha = 1;
    }
  });

  const sideTex = makeCanvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = th.side;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 5) {
      g.fillStyle = 'rgba(55,32,10,0.08)';
      g.fillRect(x, 0, 2, h);
    }
    if (th.stripe) {
      g.fillStyle = th.stripe;
      g.globalAlpha = 0.65;
      g.fillRect(0, 18, w, 14);
      g.globalAlpha = 1;
    }
  });

  const labelTex = makeCanvasTexture(256, 160, (g, w, h) => {
    g.fillStyle = '#faf9f5';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d4d0c4';
    g.lineWidth = 5;
    g.strokeRect(6, 6, w - 12, h - 12);

    g.fillStyle = th.stripe || '#d97706';
    g.fillRect(14, 14, w - 28, 36);
    g.fillStyle = '#ffffff';
    g.font = '900 22px "Pretendard","Apple SD Gothic Neo",sans-serif';
    g.textBaseline = 'middle';
    g.fillText(th.labelWord, 24, 33);

    g.fillStyle = '#b6b9c0';
    roundRectPath(g, 20, 64, 140, 11, 4); g.fill();
    roundRectPath(g, 20, 82, 105, 11, 4); g.fill();

    g.fillStyle = '#202226';
    const bars = [5, 2, 7, 3, 2, 6, 4, 2, 6, 3, 8, 2, 4, 6, 3, 5];
    let bx = 20;
    for (let i = 0; i < bars.length; i++) {
      const bw = bars[i] * 2.1;
      if (i % 2 === 0) g.fillRect(bx, 106, bw, 34);
      bx += bw + 3.2;
    }
  });

  return {
    topMat: new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.72, metalness: 0.03 }),
    sideMat: new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.78, metalness: 0.03 }),
    labelMat: new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.42, metalness: 0.02 }),
  };
});

// 박스테이프 패턴별 반쪽 스트립 재질 & 중앙 흰색 절취 점선 가이드 재질
function createHalfStripMat(rgbaColor, isLeft) {
  const tex = makeCanvasTexture(64, 256, (g, w, h) => {
    g.fillStyle = rgbaColor;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255, 255, 255, 0.52)';
    if (isLeft) g.fillRect(2, 0, 7, h);
    else g.fillRect(w - 9, 0, 7, h);
  });
  return new THREE.MeshPhysicalMaterial({
    map: tex,
    transparent: true,
    opacity: 0.92,
    roughness: 0.15,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });
}

const TAPE_PALETTES = {
  amber: {
    left: createHalfStripMat('rgba(217, 119, 6, 0.90)', true),
    right: createHalfStripMat('rgba(217, 119, 6, 0.90)', false),
  },
  cyan: {
    left: createHalfStripMat('rgba(2, 132, 199, 0.90)', true),
    right: createHalfStripMat('rgba(2, 132, 199, 0.90)', false),
  },
  gold: {
    left: createHalfStripMat('rgba(234, 179, 8, 0.94)', true),
    right: createHalfStripMat('rgba(234, 179, 8, 0.94)', false),
  },
  purple: {
    left: createHalfStripMat('rgba(147, 51, 234, 0.90)', true),
    right: createHalfStripMat('rgba(147, 51, 234, 0.90)', false),
  },
  crimson: {
    left: createHalfStripMat('rgba(225, 29, 72, 0.92)', true),
    right: createHalfStripMat('rgba(225, 29, 72, 0.92)', false),
  },
};

const cutGuideMat = new THREE.MeshBasicMaterial({
  map: makeCanvasTexture(128, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 8;
    g.setLineDash([22, 14]);
    g.beginPath();
    g.moveTo(w / 2, 28);
    g.lineTo(w / 2, h - 28);
    g.stroke();
    g.setLineDash([]);

    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(w / 2, 10);
    g.lineTo(w / 2 - 19, 36);
    g.lineTo(w / 2 + 19, 36);
    g.closePath();
    g.fill();

    g.beginPath();
    g.moveTo(w / 2, h - 10);
    g.lineTo(w / 2 - 19, h - 36);
    g.lineTo(w / 2 + 19, h - 36);
    g.closePath();
    g.fill();
  }),
  transparent: true,
  depthWrite: false,
});

const slitSharedMat = new THREE.MeshBasicMaterial({ color: '#120e1c' });

// 안쪽 에어캡(뽁뽁이) 완충재 재질
const bubbleWrapTex = makeCanvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#eef3f9';
  g.fillRect(0, 0, w, h);
  for (let y = 12; y < h; y += 24) {
    for (let x = 12; x < w; x += 24) {
      const ox = (Math.floor(y / 24) % 2) * 12;
      g.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc((x + ox) % w, y, 8.5, 0, TAU);
      g.stroke();
      g.fillStyle = 'rgba(255, 255, 255, 0.85)';
      g.beginPath();
      g.arc(((x + ox) % w) - 2.5, y - 2.5, 3, 0, TAU);
      g.fill();
    }
  }
});
const bubbleWrapMat = new THREE.MeshStandardMaterial({
  map: bubbleWrapTex,
  roughness: 0.35,
  metalness: 0.05,
});

// ─── 신발장 옆 우리 집 현관 & 열린 현관문 택배 폭주 3D 무대 구성 ───
const WORK_Z = 4.2;              // 주인공 택배가 놓이는 앞쪽 마루 작업 자리 Z 좌표
const BOX_W = 11.4;
const BOX_D = 11.4;
const BOX_H = 4.2;
const WORK_TOP_Y = 0.0;          // 주인공 상자 윗면 월드 Y 높이 (슬라이스 기준 평면 y = 0)
const DESK_Y = -BOX_H;           // 거실 원목 마루 상판 높이 (-4.2)
const ENTRY_Y = DESK_Y - 0.65;   // 한 단 낮은 한국식 현관 타일 바닥 높이 (-4.85)
const DOOR_Z = -21.2;            // 아파트 현관문 벽체 Z 위치 (HUD 아래로 시원하게 보이도록 배치!)

const stageGroup = new THREE.Group();
scene.add(stageGroup);

// 1) 앞쪽 거실 원목 마루 바닥 (따뜻한 오크 플로어링)
const woodFloorTex = makeCanvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#c89d6c';
  g.fillRect(0, 0, w, h);
  const plankH = 64;
  const tones = ['#cfa474', '#c29563', '#d4ab7c', '#bc8e5c'];
  for (let row = 0; row < h / plankH; row++) {
    const y = row * plankH;
    const offset = (row % 2) * 128;
    for (let col = -1; col < 5; col++) {
      const x = col * 160 + offset;
      g.fillStyle = tones[(row * 3 + col + 8) % tones.length];
      g.fillRect(x + 1, y + 1, 158, plankH - 2);
      // 잔잔한 나뭇결
      g.fillStyle = 'rgba(92, 54, 22, 0.08)';
      for (let k = 0; k < 5; k++) {
        const gy = y + 8 + ((k * 11 + row * 7) % (plankH - 14));
        g.fillRect(x + 6, gy, 146, 2);
      }
    }
    g.fillStyle = 'rgba(78, 46, 18, 0.28)';
    g.fillRect(0, y, w, 2);
  }
});
woodFloorTex.wrapS = THREE.RepeatWrapping;
woodFloorTex.wrapT = THREE.RepeatWrapping;
woodFloorTex.repeat.set(4.5, 2.2);

const livingFloorMesh = new THREE.Mesh(
  new THREE.BoxGeometry(72, 1.4, 30),
  new THREE.MeshStandardMaterial({ map: woodFloorTex, roughness: 0.52, metalness: 0.04 })
);
livingFloorMesh.position.set(0, DESK_Y - 0.7, 13.0);
livingFloorMesh.receiveShadow = true;
stageGroup.add(livingFloorMesh);

// 주인공 택배 언박싱 매트 (원목 마루 위에 깔린 차콜 스티치 데스크 패드 — 상자와 테이프 가독성 극대화)
const unboxPadTex = makeCanvasTexture(512, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#262936';
  roundRectPath(g, 10, 10, w - 20, h - 20, 36);
  g.fill();

  g.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  g.lineWidth = 2;
  for (let i = 48; i < w - 32; i += 32) {
    g.beginPath(); g.moveTo(i, 28); g.lineTo(i, h - 28); g.stroke();
    g.beginPath(); g.moveTo(28, i); g.lineTo(w - 28, i); g.stroke();
  }

  g.strokeStyle = '#fbbf24';
  g.lineWidth = 4;
  g.setLineDash([14, 10]);
  roundRectPath(g, 26, 26, w - 52, h - 52, 26);
  g.stroke();
  g.setLineDash([]);
});
const unboxPadMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(15.4, 14.6),
  new THREE.MeshStandardMaterial({ map: unboxPadTex, transparent: true, roughness: 0.68, metalness: 0.05 })
);
unboxPadMesh.rotation.x = -Math.PI / 2;
unboxPadMesh.position.set(0, DESK_Y + 0.025, WORK_Z);
unboxPadMesh.receiveShadow = true;
stageGroup.add(unboxPadMesh);

// 2) 현관 ↔ 거실 경계 크림 대리석 디딤석(마루턱)
const marbleStepTex = makeCanvasTexture(512, 128, (g, w, h) => {
  g.fillStyle = '#efeae1';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(148, 138, 124, 0.26)';
  g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    const sx = i * 62;
    g.moveTo(sx, 0);
    g.bezierCurveTo(sx + 24, h * 0.4, sx - 18, h * 0.7, sx + 34, h);
    g.stroke();
  }
});
marbleStepTex.wrapS = THREE.RepeatWrapping;
marbleStepTex.repeat.set(4, 1);

const marbleStepMesh = new THREE.Mesh(
  new THREE.BoxGeometry(72, 0.72, 1.25),
  new THREE.MeshStandardMaterial({ map: marbleStepTex, roughness: 0.28, metalness: 0.06 })
);
marbleStepMesh.position.set(0, DESK_Y - 0.34, -2.05);
marbleStepMesh.receiveShadow = true;
marbleStepMesh.castShadow = true;
stageGroup.add(marbleStepMesh);

// 3) 현관 테라조 포세린 타일 바닥 (차분한 웜그레이 스톤 타일로 택배·신발·신발장 대비 극대화)
const terrazzoTex = makeCanvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#d3cbc0';
  g.fillRect(0, 0, w, h);
  const chipColors = ['#b4aa9c', '#c98a67', '#7b8fa0', '#9f9585', '#ede8df'];
  for (let i = 0; i < 420; i++) {
    const cx = (i * 97 + 13) % w;
    const cy = (i * 151 + 29) % h;
    const r = 1.8 + (i % 4) * 1.15;
    g.fillStyle = chipColors[i % chipColors.length];
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
  }
  // 정사각 현관 타일 줄눈
  g.strokeStyle = 'rgba(96, 86, 74, 0.38)';
  g.lineWidth = 3;
  for (let p = 0; p <= w; p += 128) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
  }
});
terrazzoTex.wrapS = THREE.RepeatWrapping;
terrazzoTex.wrapT = THREE.RepeatWrapping;
terrazzoTex.repeat.set(2.4, 2.5);

const entryFloorMesh = new THREE.Mesh(
  new THREE.BoxGeometry(19.2, 1.0, 20.4),
  new THREE.MeshStandardMaterial({ map: terrazzoTex, roughness: 0.48, metalness: 0.04 })
);
entryFloorMesh.position.set(0, ENTRY_Y - 0.5, -11.7);
entryFloorMesh.receiveShadow = true;
stageGroup.add(entryFloorMesh);

// 현관문 앞 코이어 발매트 (HOME 매트)
const doormatTex = makeCanvasTexture(512, 256, (g, w, h) => {
  g.fillStyle = '#362e28';
  roundRectPath(g, 6, 6, w - 12, h - 12, 22);
  g.fill();
  g.fillStyle = '#b48250';
  roundRectPath(g, 22, 22, w - 44, h - 44, 14);
  g.fill();
  for (let i = 0; i < 350; i++) {
    g.fillStyle = i % 2 === 0 ? 'rgba(72,45,18,0.16)' : 'rgba(255,235,205,0.10)';
    g.fillRect((i * 83) % (w - 52) + 26, (i * 59) % (h - 52) + 26, 4, 3);
  }
  g.fillStyle = '#2d2118';
  g.font = '900 46px "Pretendard","Apple SD Gothic Neo",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('HOME SWEET HOME', w / 2, h / 2 + 2);
});
const doormatMesh = new THREE.Mesh(
  new THREE.BoxGeometry(7.6, 0.10, 3.5),
  new THREE.MeshStandardMaterial({ map: doormatTex, roughness: 0.88, metalness: 0.02 })
);
doormatMesh.position.set(0, ENTRY_Y + 0.05, -18.2);
doormatMesh.receiveShadow = true;
stageGroup.add(doormatMesh);

// 4) 왼쪽 벽: 붙박이 신발장(키큰장 + 우드 카운터 벤치장) & 하부 간접조명 & 현관 신발들!
const wallCreamMat = new THREE.MeshStandardMaterial({ color: '#d8cdbc', roughness: 0.76, metalness: 0.02 });
const cabinetWhiteMat = new THREE.MeshStandardMaterial({ color: '#fbf9f5', roughness: 0.34, metalness: 0.04 });
const warmOakMat = new THREE.MeshStandardMaterial({ color: '#bf8750', roughness: 0.45, metalness: 0.05 });
const darkHandleMat = new THREE.MeshStandardMaterial({ color: '#273244', roughness: 0.35, metalness: 0.55 });

// 좌우 벽체 & 거실 확장 가벽 (와이드 화면에서도 빈틈없이 마감)
const leftWallBack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 24.0, 21.0), wallCreamMat);
leftWallBack.position.set(-11.4, ENTRY_Y + 11.0, -11.7);
stageGroup.add(leftWallBack);

const leftLivingWing = new THREE.Mesh(new THREE.BoxGeometry(36, 26.0, 1.4), wallCreamMat);
leftLivingWing.position.set(-28.7, DESK_Y + 12.0, -2.1);
stageGroup.add(leftLivingWing);

const rightLivingWing = new THREE.Mesh(new THREE.BoxGeometry(36, 26.0, 1.4), wallCreamMat);
rightLivingWing.position.set(27.2, DESK_Y + 12.0, -2.1);
stageGroup.add(rightLivingWing);

// [신발장 A] 안쪽 키큰 신발장 (z = -21.0 ~ -13.2, 앞면 x = -8.25, 하부 띄움 시공!)
const tallCabH = 10.2;
const tallCab = new THREE.Mesh(new THREE.BoxGeometry(2.5, tallCabH, 7.8), cabinetWhiteMat);
tallCab.position.set(-9.5, ENTRY_Y + 1.35 + tallCabH / 2, -17.1);
tallCab.castShadow = true;
tallCab.receiveShadow = true;
stageGroup.add(tallCab);

// 키큰장 도어 줄눈 & 손잡이
const doorGrooveMat = new THREE.MeshBasicMaterial({ color: '#cbc3b5' });
for (const dz of [-19.0, -17.1, -15.2]) {
  const groove = new THREE.Mesh(new THREE.BoxGeometry(0.06, tallCabH - 0.5, 0.06), doorGrooveMat);
  groove.position.set(-8.23, ENTRY_Y + 1.35 + tallCabH / 2, dz);
  stageGroup.add(groove);
}
for (const hz of [-17.45, -16.75]) {
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 0.14), darkHandleMat);
  handle.position.set(-8.16, ENTRY_Y + 4.6, hz);
  stageGroup.add(handle);
}

// [신발장 B] 앞쪽 허리 높이 우드 상판 신발장 (모바일에서도 상판 화분·스탠드·신발이 통째로 들어옴!)
const lowCabH = 4.8;
const lowCab = new THREE.Mesh(new THREE.BoxGeometry(2.5, lowCabH, 10.8), cabinetWhiteMat);
lowCab.position.set(-9.5, ENTRY_Y + 1.35 + lowCabH / 2, -7.8);
lowCab.castShadow = true;
lowCab.receiveShadow = true;
stageGroup.add(lowCab);

// 우드 상판 카운터
const lowCabTopY = ENTRY_Y + 1.35 + lowCabH;
const woodCounter = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.30, 11.0), warmOakMat);
woodCounter.position.set(-9.45, lowCabTopY + 0.15, -7.8);
woodCounter.castShadow = true;
woodCounter.receiveShadow = true;
stageGroup.add(woodCounter);

// 하부장 도어 줄눈 & 손잡이
for (const dz of [-10.5, -7.8, -5.1]) {
  const groove = new THREE.Mesh(new THREE.BoxGeometry(0.06, lowCabH - 0.4, 0.06), doorGrooveMat);
  groove.position.set(-8.23, ENTRY_Y + 1.35 + lowCabH / 2, dz);
  stageGroup.add(groove);

  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.85, 0.14), darkHandleMat);
  knob.position.set(-8.16, lowCabTopY - 0.9, dz + 0.95);
  stageGroup.add(knob);
}

// 신발장 하부 띄움 전구색 LED 간접조명 바 + 포인트 라이트
const underGlowMat = new THREE.MeshBasicMaterial({ color: '#ffd17a' });
const underGlowBar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 18.4), underGlowMat);
underGlowBar.position.set(-8.55, ENTRY_Y + 1.30, -11.6);
stageGroup.add(underGlowBar);

const shoeRackLight = new THREE.PointLight('#ffa93a', 10.5, 17, 1.5);
shoeRackLight.position.set(-7.3, ENTRY_Y + 1.25, -9.5);
stageGroup.add(shoeRackLight);

// 신발장 우드 카운터 위 아기자기한 현관 소품들 (모바일 화면 안쪽 x = -9.15 라인에 배치!)
{
  const propY = lowCabTopY + 0.30;
  // 1. 따뜻한 미니 단스탠드 조명
  const lampStand = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.38, 1.0, 12), warmOakMat);
  lampStand.position.set(-9.15, propY + 0.50, -3.9);
  const lampShadeMat = new THREE.MeshStandardMaterial({
    color: '#fff1c9',
    emissive: '#ffa93a',
    emissiveIntensity: 0.75,
    roughness: 0.4,
  });
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.84, 0.90, 16), lampShadeMat);
  lampShade.position.set(-9.15, propY + 1.22, -3.9);
  stageGroup.add(lampStand, lampShade);

  // 2. 테라코타 토분 & 싱그러운 초록 식물
  const potMat = new THREE.MeshStandardMaterial({ color: '#c8643d', roughness: 0.65 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.42 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.46, 1.0, 14), potMat);
  pot.position.set(-9.15, propY + 0.50, -7.5);
  pot.castShadow = true;
  stageGroup.add(pot);
  const leafOffsets = [
    [0, 1.30, 0, 0.52],
    [-0.38, 1.14, 0.30, 0.44],
    [0.40, 1.18, -0.26, 0.46],
    [-0.30, 1.20, -0.34, 0.42],
    [0.34, 1.12, 0.34, 0.42],
  ];
  for (const [lx, ly, lz, lr] of leafOffsets) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(lr, 10, 10), leafMat);
    lf.scale.set(1.15, 0.72, 0.95);
    lf.position.set(-9.15 + lx, propY + ly, -7.5 + lz);
    lf.castShadow = true;
    stageGroup.add(lf);
  }

  // 3. 우드 키 트레이 + 디퓨저 병 + 예비 커터칼
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 2.2), new THREE.MeshStandardMaterial({ color: '#7c4d28', roughness: 0.5 }));
  tray.position.set(-9.15, propY + 0.07, -11.1);
  const diffuser = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.34, 0.78, 12),
    new THREE.MeshPhysicalMaterial({ color: '#7dd3fc', roughness: 0.1, transmission: 0.5, transparent: true, opacity: 0.88 })
  );
  diffuser.position.set(-9.25, propY + 0.50, -11.55);
  const spareCutter = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 1.10), new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.3 }));
  spareCutter.rotation.y = 0.35;
  spareCutter.position.set(-9.05, propY + 0.18, -10.55);
  stageGroup.add(tray, diffuser, spareCutter);
}

// 신발장 앞 현관 타일 & 마루턱에 놓인 입체 신발 생성기 (사람 얼굴 없이 신발 소품만!)
function createShoePairMesh({ mainColor, soleColor = '#f8fafc', style = 'sneaker' }) {
  const pair = new THREE.Group();
  const mainMat = new THREE.MeshStandardMaterial({ color: mainColor, roughness: 0.45 });
  const soleMat = new THREE.MeshStandardMaterial({ color: soleColor, roughness: 0.52 });

  for (const side of [-1, 1]) {
    const shoe = new THREE.Group();
    shoe.position.z = side * 0.52;
    shoe.rotation.y = side * 0.06;

    const sole = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.24, 0.80), soleMat);
    sole.position.y = 0.12;
    shoe.add(sole);

    if (style === 'slipper') {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.42, 0.82), mainMat);
      strap.position.set(0.14, 0.35, 0);
      shoe.add(strap);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.50, 0.76), mainMat);
      body.position.set(-0.08, 0.40, 0);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.40, 10, 8), style === 'sneaker' ? soleMat : mainMat);
      toe.scale.set(1.15, 0.65, 0.96);
      toe.position.set(0.64, 0.31, 0);
      shoe.add(body, toe);
      if (style === 'sneaker') {
        const lace = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.78), soleMat);
        lace.position.set(0.18, 0.60, 0);
        shoe.add(lace);
      }
    }
    shoe.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    pair.add(shoe);
  }
  pair.scale.setScalar(1.12);
  return pair;
}

// 현관 신발 4켤레 & 우산꽂이 배치 (모바일 화면에서도 선명하게 보이는 신발장 옆 라인!)
{
  // 1) 거실 마루턱 위 언박싱 매트 왼쪽 옆에 가지런한 노란 실내화
  const houseSlippers = createShoePairMesh({ mainColor: '#facc15', soleColor: '#fef3c7', style: 'slipper' });
  houseSlippers.position.set(-8.35, DESK_Y, 0.4);
  houseSlippers.rotation.y = -1.25;
  stageGroup.add(houseSlippers);

  // 2) 현관 타일 앞쪽 민트 슬리퍼
  const porchSlippers = createShoePairMesh({ mainColor: '#34d399', soleColor: '#ecfdf5', style: 'slipper' });
  porchSlippers.position.set(-7.15, ENTRY_Y, -3.55);
  porchSlippers.rotation.y = 0.35;
  stageGroup.add(porchSlippers);

  // 3) 신발장 앞 레드&화이트 스니커즈
  const sneakers = createShoePairMesh({ mainColor: '#ef4444', soleColor: '#ffffff', style: 'sneaker' });
  sneakers.position.set(-7.45, ENTRY_Y, -7.85);
  sneakers.rotation.y = 0.08;
  stageGroup.add(sneakers);

  // 4) 신발장 앞 네이비 캐주얼 로퍼
  const loafers = createShoePairMesh({ mainColor: '#1e3a8a', soleColor: '#e2e8f0', style: 'loafer' });
  loafers.position.set(-7.55, ENTRY_Y, -11.9);
  loafers.rotation.y = -0.10;
  stageGroup.add(loafers);

  // 키큰장 앞 화이트 원통 우산꽂이 & 우산 2개
  const standMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35, metalness: 0.15 });
  const umbStand = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.58, 2.1, 16), standMat);
  umbStand.position.set(-7.40, ENTRY_Y + 1.05, -15.2);
  umbStand.castShadow = true;
  const umb1 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.09, 3.2, 10), new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.4 }));
  umb1.position.set(-7.32, ENTRY_Y + 1.80, -15.1);
  umb1.rotation.z = -0.14;
  const umb2 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.09, 2.95, 10), new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.4 }));
  umb2.position.set(-7.50, ENTRY_Y + 1.68, -15.35);
  umb2.rotation.z = 0.12;
  stageGroup.add(umbStand, umb1, umb2);
}

// 5) 오른쪽 현관 벽면: 아치형 거울 + 월패드 스위치 + 이미 뜯어 접어둔 빈 박스 묶음!
const rightWallMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 24.0, 21.0), wallCreamMat);
rightWallMesh.position.set(9.65, ENTRY_Y + 11.0, -11.7);
rightWallMesh.receiveShadow = true;
stageGroup.add(rightWallMesh);

// 우드 걸레받이
const baseboardR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 19.6), warmOakMat);
baseboardR.position.set(8.88, ENTRY_Y + 0.28, -11.7);
stageGroup.add(baseboardR);

// 벽걸이 우드 프레임 거울 & 스마트 월패드
{
  const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.20, 6.2, 4.2), warmOakMat);
  mirrorFrame.position.set(8.86, ENTRY_Y + 5.4, -11.2);
  const mirrorGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 5.6, 3.6),
    new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.08, metalness: 0.86 })
  );
  mirrorGlass.position.set(8.84, ENTRY_Y + 5.4, -11.2);
  stageGroup.add(mirrorFrame, mirrorGlass);

  // 현관 일괄소등·도어벨 스위치 패널
  const padBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.35, 0.95), new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3 }));
  padBody.position.set(8.85, ENTRY_Y + 5.6, -5.2);
  const padLed = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.45), new THREE.MeshBasicMaterial({ color: '#4ade80' }));
  padLed.position.set(8.83, ENTRY_Y + 5.9, -5.2);
  stageGroup.add(padBody, padLed);

  // 오른쪽 구석에 뜯어서 접어 세워둔 납작한 골판지 박스 묶음 + 박스테이프 롤
  const flatCardMat = new THREE.MeshStandardMaterial({ color: '#c4935c', roughness: 0.75 });
  for (let i = 0; i < 3; i++) {
    const flatBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.5 - i * 0.25, 3.6 - i * 0.2), flatCardMat);
    flatBox.position.set(8.25 - i * 0.26, ENTRY_Y + 1.70, -4.1);
    flatBox.rotation.z = 0.11 + i * 0.02;
    flatBox.castShadow = true;
    stageGroup.add(flatBox);
  }
  const tapeRoll = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.18, 10, 20),
    new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.32 })
  );
  tapeRoll.rotation.x = Math.PI / 2;
  tapeRoll.position.set(7.25, ENTRY_Y + 0.18, -3.1);
  stageGroup.add(tapeRoll);
}

// 6) 정면 뒤쪽: 아파트 현관문 프레임 + 활짝 열린 방화문(디지털 도어락) + 천장 센서등 + 문밖 복도!
const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.42, metalness: 0.38 });
const doorLeafMat = new THREE.MeshStandardMaterial({ color: '#2b3950', roughness: 0.38, metalness: 0.32 });
const steelThresholdMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.28, metalness: 0.78 });

// 중앙 통로(x = -4.8 ~ +4.8, 폭 9.6) 양옆 현관 정면 벽체 & 상인방 벽체
const backWallLeft = new THREE.Mesh(new THREE.BoxGeometry(32, 24.0, 1.2), wallCreamMat);
backWallLeft.position.set(-20.8, ENTRY_Y + 11.0, DOOR_Z);
const backWallRight = new THREE.Mesh(new THREE.BoxGeometry(32, 24.0, 1.2), wallCreamMat);
backWallRight.position.set(20.8, ENTRY_Y + 11.0, DOOR_Z);
const backWallHeader = new THREE.Mesh(new THREE.BoxGeometry(10.2, 13.5, 1.2), wallCreamMat);
backWallHeader.position.set(0, ENTRY_Y + 16.8, DOOR_Z);
stageGroup.add(backWallLeft, backWallRight, backWallHeader);

// 스틸 문틀 기둥 & 상단 문틀 & 스테인리스 문지방
const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.58, 10.4, 1.45), doorFrameMat);
jambL.position.set(-4.95, ENTRY_Y + 5.2, DOOR_Z);
const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.58, 10.4, 1.45), doorFrameMat);
jambR.position.set(4.95, ENTRY_Y + 5.2, DOOR_Z);
const jambTop = new THREE.Mesh(new THREE.BoxGeometry(10.48, 0.65, 1.45), doorFrameMat);
jambTop.position.set(0, ENTRY_Y + 10.15, DOOR_Z);
const thresholdMesh = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.16, 1.45), steelThresholdMat);
thresholdMesh.position.set(0, ENTRY_Y + 0.06, DOOR_Z);
stageGroup.add(jambL, jambR, jambTop, thresholdMesh);

// 활짝 열려 있는 아파트 현관 방화문 (파란 디지털 도어락이 HUD 아래에서 또렷하게 보이는 각도!)
const entryDoorPivot = new THREE.Group();
entryDoorPivot.position.set(4.70, ENTRY_Y + 0.12, DOOR_Z - 0.25);
const DOOR_BASE_OPEN_YAW = -1.28; // 복도 바깥 오른쪽 대각선으로 시원하게 열린 각도
entryDoorPivot.rotation.y = DOOR_BASE_OPEN_YAW;
stageGroup.add(entryDoorPivot);

{
  const doorW = 9.2;
  const doorH = 9.8;
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.42), doorLeafMat);
  leaf.position.set(-doorW / 2, doorH / 2, 0);
  leaf.castShadow = true;
  entryDoorPivot.add(leaf);

  // 방화문 입체 몰딩 패널
  const trimMat = new THREE.MeshStandardMaterial({ color: '#1a2436', roughness: 0.45, metalness: 0.3 });
  const panelTop = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.72, 3.2, 0.50), trimMat);
  panelTop.position.set(-doorW / 2, doorH * 0.68, 0);
  const panelBot = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.72, 3.2, 0.50), trimMat);
  panelBot.position.set(-doorW / 2, doorH * 0.26, 0);
  entryDoorPivot.add(panelTop, panelBot);

  // 스마트 디지털 도어락 (파란 키패드 불빛 + 은색 레버 손잡이)
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.35, 0.72), new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.6 }));
  lockBody.position.set(-doorW + 1.15, doorH * 0.46, 0);
  const lockScreen = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.95, 0.78), new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
  lockScreen.position.set(-doorW + 1.15, doorH * 0.52, 0);
  const handleBar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.24, 0.96), steelThresholdMat);
  handleBar.position.set(-doorW + 1.25, doorH * 0.39, 0);
  entryDoorPivot.add(lockBody, lockScreen, handleBar);
}

// 현관 천장 센서등 (새 택배가 문지방을 넘을 때마다 반짝 점등!)
const sensorBulbMat = new THREE.MeshStandardMaterial({
  color: '#fffbeb',
  emissive: '#ffd166',
  emissiveIntensity: 0.9,
  roughness: 0.2,
});
const sensorFixture = new THREE.Mesh(new THREE.CylinderGeometry(1.10, 1.10, 0.28, 20), warmOakMat);
sensorFixture.position.set(0, ENTRY_Y + 9.65, DOOR_Z + 1.25);
const sensorBulb = new THREE.Mesh(new THREE.SphereGeometry(0.82, 16, 12), sensorBulbMat);
sensorBulb.scale.set(1, 0.45, 1);
sensorBulb.position.set(0, ENTRY_Y + 9.48, DOOR_Z + 1.25);
stageGroup.add(sensorFixture, sensorBulb);

const sensorPointLight = new THREE.PointLight('#ffe08a', 11, 26, 1.45);
sensorPointLight.position.set(0, ENTRY_Y + 8.6, DOOR_Z + 1.4);
stageGroup.add(sensorPointLight);

// 7) 열린 현관문 너머 아파트 복도 바닥 & 겹겹이 줄지어 집으로 밀려오는 택배 대홍수!
const corridorFloorTex = makeCanvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#8d96a3';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(51, 65, 85, 0.38)';
  g.lineWidth = 3;
  for (let i = 0; i <= w; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
  }
});
corridorFloorTex.wrapS = THREE.RepeatWrapping;
corridorFloorTex.wrapT = THREE.RepeatWrapping;
corridorFloorTex.repeat.set(4, 4);

const corridorFloor = new THREE.Mesh(
  new THREE.BoxGeometry(36, 1.0, 34),
  new THREE.MeshStandardMaterial({ map: corridorFloorTex, roughness: 0.68, metalness: 0.06 })
);
corridorFloor.position.set(0, ENTRY_Y - 0.62, DOOR_Z - 17.0);
corridorFloor.receiveShadow = true;
stageGroup.add(corridorFloor);

const corridorBackWall = new THREE.Mesh(
  new THREE.BoxGeometry(40, 22, 1.2),
  new THREE.MeshStandardMaterial({ color: '#b8c2cf', roughness: 0.78 })
);
corridorBackWall.position.set(0, ENTRY_Y + 9.5, DOOR_Z - 33.5);
stageGroup.add(corridorBackWall);

const corridorLight = new THREE.PointLight('#f8fafc', 9, 34, 1.5);
corridorLight.position.set(0, ENTRY_Y + 9.8, DOOR_Z - 10.5);
stageGroup.add(corridorLight);

// 문밖 복도에서 현관문 통로를 가득 메우며 밀려 들어오는 1·2층 배경 택배 대열 (8개!)
const corridorRushBoxes = [];
for (let i = 0; i < 8; i++) {
  const th = THEME_MATERIALS[i % THEME_MATERIALS.length];
  const gBox = new THREE.Group();
  const isUpper = i >= 5;
  const bw = isUpper ? 5.2 : (5.8 + (i % 3) * 0.45);
  const bh = isUpper ? 2.2 : (2.5 + (i % 2) * 0.40);
  const bd = isUpper ? 5.2 : (5.8 + ((i + 1) % 3) * 0.45);
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [
    th.sideMat, th.sideMat, th.topMat, th.sideMat, th.sideMat, th.sideMat,
  ]);
  body.position.y = bh / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(bw * 0.34, bd * 0.24), th.labelMat);
  lbl.rotation.x = -Math.PI / 2;
  lbl.position.set(-bw * 0.16, bh + 0.02, -bd * 0.15);
  const tp = new THREE.Mesh(new THREE.PlaneGeometry(1.0, bd * 0.96), new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? '#d97706' : '#0284c7' }));
  tp.rotation.x = -Math.PI / 2;
  tp.position.set(0, bh + 0.015, 0);
  gBox.add(body, lbl, tp);

  const rowIdx = isUpper ? (i - 5) : i;
  const laneX = (rowIdx % 2 === 0 ? -1.75 : 1.75) + (isUpper ? 0.25 : 0);
  const baseY = (ENTRY_Y - 0.12) + (isUpper ? 2.65 : 0);
  const startZ = DOOR_Z - 2.4 - rowIdx * 5.2 - (isUpper ? 1.8 : 0);
  gBox.position.set(laneX, baseY, startZ);
  gBox.rotation.y = (i % 2 === 0 ? 0.11 : -0.13);
  stageGroup.add(gBox);
  corridorRushBoxes.push({ mesh: gBox, laneX, baseY, baseYaw: gBox.rotation.y });
}

let doorSwingKick = 0;
let sensorFlash = 0;

// ─── 10종 랜덤 3D 입체 선물 카탈로그 & 메쉬 생성기 ───
const GIFT_CATALOG = [
  { id: 'diamond', emoji: '💎', name: '무지개 다이아몬드', bonusScore: 300, bonusTime: 0.85, weight: 0.7 },
  { id: 'crown', emoji: '👑', name: '순금 왕관', bonusScore: 260, bonusTime: 0.75, weight: 0.85 },
  { id: 'trophy', emoji: '🏆', name: '황금 트로피', bonusScore: 240, bonusTime: 0.65, weight: 0.95 },
  { id: 'console', emoji: '🎮', name: '휴대용 게임기', bonusScore: 210, bonusTime: 0.55, weight: 1.2 },
  { id: 'headphone', emoji: '🎧', name: '스튜디오 헤드폰', bonusScore: 200, bonusTime: 0.55, weight: 1.2 },
  { id: 'sneaker', emoji: '👟', name: '한정판 스니커즈', bonusScore: 200, bonusTime: 0.55, weight: 1.2 },
  { id: 'camera', emoji: '📸', name: '클래식 카메라', bonusScore: 190, bonusTime: 0.50, weight: 1.25 },
  { id: 'perfume', emoji: '✨', name: '크리스탈 향수병', bonusScore: 185, bonusTime: 0.45, weight: 1.25 },
  { id: 'cake', emoji: '🍰', name: '딸기 생크림 케이크', bonusScore: 180, bonusTime: 0.45, weight: 1.3 },
  { id: 'bouquet', emoji: '💐', name: '장미 꽃다발', bonusScore: 175, bonusTime: 0.45, weight: 1.3 },
];

function buildGiftMesh(giftId) {
  const g = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.18, metalness: 0.88 });
  const rubyMat = new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.15, metalness: 0.25 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.32, metalness: 0.05 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.25 });

  if (giftId === 'diamond') {
    const gemMat = new THREE.MeshPhysicalMaterial({
      color: '#67e8f9',
      emissive: '#0284c7',
      emissiveIntensity: 0.25,
      roughness: 0.05,
      metalness: 0.12,
      transmission: 0.55,
      clearcoat: 1.0,
    });
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.1, 8), gemMat);
    top.position.y = 0.75;
    const bot = new THREE.Mesh(new THREE.ConeGeometry(1.75, 2.1, 8), gemMat);
    bot.rotation.x = Math.PI;
    bot.position.y = -0.85;
    g.add(top, bot);
  } else if (giftId === 'crown') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.35, 1.05, 16), goldMat);
    g.add(base);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.05, 6), goldMat);
      spike.position.set(Math.cos(a) * 1.32, 0.98, Math.sin(a) * 1.32);
      const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), i % 2 === 0 ? rubyMat : new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.15 }));
      jewel.position.set(Math.cos(a) * 1.46, 0.05, Math.sin(a) * 1.46);
      g.add(spike, jewel);
    }
  } else if (giftId === 'trophy') {
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.6), darkMat);
    ped.position.y = -1.25;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 0.9, 12), goldMat);
    stem.position.y = -0.55;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.68, 1.75, 16), goldMat);
    cup.position.y = 0.65;
    const handleL = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.14, 8, 16), goldMat);
    handleL.position.set(-1.15, 0.75, 0);
    const handleR = handleL.clone();
    handleR.position.x = 1.15;
    g.add(ped, stem, cup, handleL, handleR);
  } else if (giftId === 'console') {
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#fb7185', roughness: 0.28, metalness: 0.08 });
    const screenMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.65, 0.48), bodyMat);
    const scr = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.18, 0.52), screenMat);
    const dpadH = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.56), darkMat);
    dpadH.position.x = -1.22;
    const dpadV = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.46, 0.56), darkMat);
    dpadV.position.x = -1.22;
    const btnA = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), goldMat);
    btnA.position.set(1.18, 0.2, 0.24);
    const btnB = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), whiteMat);
    btnB.position.set(1.36, -0.15, 0.24);
    g.add(body, scr, dpadH, dpadV, btnA, btnB);
  } else if (giftId === 'headphone') {
    const mintMat = new THREE.MeshStandardMaterial({ color: '#34d399', roughness: 0.26, metalness: 0.15 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.18, 10, 24, Math.PI), mintMat);
    band.position.y = 0.2;
    const cupGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.52, 16);
    const cupL = new THREE.Mesh(cupGeo, mintMat);
    cupL.rotation.z = Math.PI / 2;
    cupL.position.set(-1.32, -0.05, 0);
    const cupR = cupL.clone();
    cupR.position.x = 1.32;
    const padL = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 16), whiteMat);
    padL.rotation.z = Math.PI / 2;
    padL.position.set(-1.05, -0.05, 0);
    const padR = padL.clone();
    padR.position.x = 1.05;
    g.add(band, cupL, cupR, padL, padR);
  } else if (giftId === 'sneaker') {
    const redMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.36 });
    const sole = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.42, 1.25), whiteMat);
    sole.position.y = -0.65;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.85, 1.15), redMat);
    upper.position.set(-0.1, -0.08, 0);
    const ankle = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.85, 1.12), redMat);
    ankle.position.set(-0.72, 0.52, 0);
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), whiteMat);
    toe.scale.set(1.1, 0.68, 0.96);
    toe.position.set(1.02, -0.22, 0);
    for (let i = 0; i < 3; i++) {
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 1.2), whiteMat);
      lace.position.set(0.15 + i * 0.32, 0.36 - i * 0.1, 0);
      g.add(lace);
    }
    g.add(sole, upper, ankle, toe);
  } else if (giftId === 'camera') {
    const silverMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.24, metalness: 0.75 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.65, 1.05), darkMat);
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(2.72, 0.42, 1.07), silverMat);
    topBar.position.y = 0.65;
    const lensRing = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.65, 20), silverMat);
    lensRing.rotation.x = Math.PI / 2;
    lensRing.position.set(0.1, -0.05, 0.68);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.7, 20), new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.08, metalness: 0.5 }));
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0.1, -0.05, 0.7);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 12), rubyMat);
    btn.position.set(0.9, 0.95, 0);
    g.add(body, topBar, lensRing, glass, btn);
  } else if (giftId === 'perfume') {
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#f472b6', roughness: 0.08, metalness: 0.1, clearcoat: 1.0, transparent: true, opacity: 0.9 });
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.0, 1.75, 8), glassMat);
    bottle.position.y = -0.35;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.45, 12), goldMat);
    neck.position.y = 0.72;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 12), goldMat);
    cap.position.y = 1.22;
    g.add(bottle, neck, cap);
  } else if (giftId === 'cake') {
    const spongeMat = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.65 });
    const wedge = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.25, 3), spongeMat);
    const icing = new THREE.Mesh(new THREE.CylinderGeometry(1.54, 1.54, 0.35, 3), whiteMat);
    icing.position.y = 0.55;
    const berry = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.75, 12), rubyMat);
    berry.position.set(0, 1.08, 0.15);
    g.add(wedge, icing, berry);
  } else {
    // bouquet (장미 꽃다발)
    const wrapMat = new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.55 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.45 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.3, 12), wrapMat);
    cone.rotation.x = Math.PI;
    cone.position.y = -0.45;
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.13, 8, 16), rubyMat);
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.y = -0.55;
    const positions = [[-0.5, 0.85, 0.2], [0.52, 0.88, 0.18], [0, 1.12, -0.25]];
    positions.forEach(([rx, ry, rz]) => {
      const rose = new THREE.Mesh(new THREE.DodecahedronGeometry(0.52, 0), rubyMat);
      rose.position.set(rx, ry, rz);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 8), leafMat);
      leaf.scale.set(1.3, 0.35, 0.8);
      leaf.position.set(rx * 1.25, ry - 0.32, rz * 1.2);
      g.add(rose, leaf);
    });
    g.add(cone, ribbon);
  }

  g.traverse(o => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

// ─── 택배 상자 3D 생성기 ───
// 상자 전체(`root`)가 `boxYaw` 각도만큼 놓여 있어서, 테이프 선과 날개 여닫이 축이 완벽하게 일치함!
function createParcelObject(spec) {
  const root = new THREE.Group();
  const mats = THEME_MATERIALS[spec.themeIdx];
  const w = BOX_W * spec.scale;
  const d = BOX_D * spec.scale;
  const h = BOX_H;
  const wallT = 0.26;

  // 4면 옆벽 + 바닥 + 안쪽 에어캡 완충재
  const frontW = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), mats.sideMat);
  frontW.position.set(0, -h / 2, d / 2 - wallT / 2);
  const backW = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallT), mats.sideMat);
  backW.position.set(0, -h / 2, -d / 2 + wallT / 2);
  const leftW = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d), mats.sideMat);
  leftW.position.set(-w / 2 + wallT / 2, -h / 2, 0);
  const rightW = new THREE.Mesh(new THREE.BoxGeometry(wallT, h, d), mats.sideMat);
  rightW.position.set(w / 2 - wallT / 2, -h / 2, 0);
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(w - 0.56, 0.5, d - 0.56), bubbleWrapMat);
  cushion.position.set(0, -h + 0.9, 0);

  [frontW, backW, leftW, rightW].forEach(m => {
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  });
  root.add(cushion);

  // 양쪽 여닫이 뚜껑 날개 (경첩: x = -w/2, x = +w/2)
  const flapW = w / 2 - 0.03;
  const flapT = 0.18;

  const leftPivot = new THREE.Group();
  leftPivot.position.set(-w / 2, 0, 0);
  const leftFlap = new THREE.Mesh(new THREE.BoxGeometry(flapW, flapT, d), mats.topMat);
  leftFlap.position.set(flapW / 2, -flapT / 2, 0);
  leftFlap.castShadow = true;
  leftFlap.receiveShadow = true;
  leftPivot.add(leftFlap);

  // 송장 스티커 (왼쪽 날개 위)
  const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.30, d * 0.22), mats.labelMat);
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.position.set(flapW * 0.45, 0.015, -d * 0.24);
  leftPivot.add(labelMesh);

  const rightPivot = new THREE.Group();
  rightPivot.position.set(w / 2, 0, 0);
  const rightFlap = new THREE.Mesh(new THREE.BoxGeometry(flapW, flapT, d), mats.topMat);
  rightFlap.position.set(-flapW / 2, -flapT / 2, 0);
  rightFlap.castShadow = true;
  rightFlap.receiveShadow = true;
  rightPivot.add(rightFlap);

  root.add(leftPivot, rightPivot);

  // 날개가 열릴 때도 자연스럽게 남아 있는 얇은 가장자리 테이프 흔적
  const pal = TAPE_PALETTES[spec.palette] || TAPE_PALETTES.amber;
  const tapeW = spec.tapeW || 1.75;
  const flapRemL = new THREE.Mesh(new THREE.PlaneGeometry(tapeW * 0.42, d * 0.96), pal.left);
  flapRemL.rotation.x = -Math.PI / 2;
  flapRemL.position.set(flapW - tapeW * 0.21, 0.014, 0);
  flapRemL.visible = false;
  leftPivot.add(flapRemL);

  const flapRemR = new THREE.Mesh(new THREE.PlaneGeometry(tapeW * 0.42, d * 0.96), pal.right);
  flapRemR.rotation.x = -Math.PI / 2;
  flapRemR.position.set(-flapW + tapeW * 0.21, 0.014, 0);
  flapRemR.visible = false;
  rightPivot.add(flapRemR);

  // 패턴별 다중 테이프 레이어 생성 (1줄 / 평행 2줄 / 십자 2줄 / 대각 X자 2줄 / 중량 H자 3줄!)
  const tapeLayer = new THREE.Group();
  root.add(tapeLayer);

  let rawDefs = [];
  if (spec.pattern === 'parallel') {
    rawDefs = [
      { lx: -w * 0.23, lz: 0, localAngle: Math.PI / 2, len: d * 0.95 },
      { lx: w * 0.23, lz: 0, localAngle: Math.PI / 2, len: d * 0.95 },
    ];
  } else if (spec.pattern === 'cross') {
    rawDefs = [
      { lx: 0, lz: 0, localAngle: Math.PI / 2, len: d * 0.95 },
      { lx: 0, lz: 0, localAngle: 0, len: w * 0.95 },
    ];
  } else if (spec.pattern === 'x_cross') {
    rawDefs = [
      { lx: 0, lz: 0, localAngle: Math.PI / 4, len: w * 1.14 },
      { lx: 0, lz: 0, localAngle: -Math.PI / 4, len: w * 1.14 },
    ];
  } else if (spec.pattern === 'h_heavy') {
    rawDefs = [
      { lx: 0, lz: 0, localAngle: Math.PI / 2, len: d * 0.95 },
      { lx: 0, lz: -d * 0.32, localAngle: 0, len: w * 0.93 },
      { lx: 0, lz: d * 0.32, localAngle: 0, len: w * 0.93 },
    ];
  } else {
    rawDefs = [
      { lx: 0, lz: 0, localAngle: Math.PI / 2, len: d * 0.95 },
    ];
  }

  const tapeLines = rawDefs.map((def, idx) => {
    const lineGroup = new THREE.Group();
    lineGroup.position.set(def.lx, 0.022 + idx * 0.006, def.lz);
    lineGroup.rotation.y = Math.PI / 2 - def.localAngle;
    tapeLayer.add(lineGroup);

    const halfW = tapeW * 0.5;
    const stripL = new THREE.Mesh(new THREE.PlaneGeometry(halfW, def.len), pal.left);
    stripL.rotation.x = -Math.PI / 2;
    stripL.position.set(-halfW * 0.5, 0, 0);
    lineGroup.add(stripL);

    const stripR = new THREE.Mesh(new THREE.PlaneGeometry(halfW, def.len), pal.right);
    stripR.rotation.x = -Math.PI / 2;
    stripR.position.set(halfW * 0.5, 0, 0);
    lineGroup.add(stripR);

    const guideMesh = new THREE.Mesh(new THREE.PlaneGeometry(tapeW * 0.92, def.len * 0.98), cutGuideMat);
    guideMesh.rotation.x = -Math.PI / 2;
    guideMesh.position.set(0, 0.002, 0);
    lineGroup.add(guideMesh);

    const slitMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.30, def.len * 0.98), slitSharedMat);
    slitMesh.rotation.x = -Math.PI / 2;
    slitMesh.position.set(0, 0.003, 0);
    slitMesh.scale.y = 0.001;
    slitMesh.visible = false;
    lineGroup.add(slitMesh);

    return {
      lx: def.lx,
      lz: def.lz,
      localAngle: def.localAngle,
      len: def.len,
      tapeW,
      cut: false,
      progress: 0,
      lineGroup,
      stripL,
      stripR,
      guideMesh,
      slitMesh,
    };
  });

  root.rotation.y = spec.yaw;
  scene.add(root);

  return {
    spec,
    root,
    w,
    d,
    h,
    leftPivot,
    rightPivot,
    flapRemL,
    flapRemR,
    tapeLayer,
    tapeLines,
    openAngle: 0,
    accSum: 0,
    cutCount: 0,
  };
}

function disposeParcel(parcel) {
  if (!parcel || !parcel.root) return;
  scene.remove(parcel.root);
  parcel.root.traverse(obj => {
    if (obj.isMesh && obj.geometry) obj.geometry.dispose();
  });
}

// ─── 입체 노란 커터칼 + 오른손 모델 (사람 얼굴 없음, 손과 커터칼만!) ───
const cutterRig = new THREE.Group();
cutterRig.visible = false;
scene.add(cutterRig);

const cutterTilt = new THREE.Group();
cutterTilt.rotation.z = 0.56; // 손잡이(+x)가 위쪽(+y)으로 들리고 칼끝(0,0,0)이 상자 윗면을 향함!
cutterRig.add(cutterTilt);

const yellowCutterMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.26, metalness: 0.08 });
const gripBlackMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.55, metalness: 0.15 });
const steelBladeMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.12, metalness: 0.92 });
const handSkinMat = new THREE.MeshStandardMaterial({ color: '#f3c3a3', roughness: 0.56, metalness: 0.02 });

// 은색 칼날 (끝점이 정확히 로컬 (0,0,0) 근처!)
const bladeMesh = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.52), steelBladeMat);
bladeMesh.position.set(0.68, 0, 0);
bladeMesh.castShadow = true;
cutterTilt.add(bladeMesh);

const noseCap = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.42, 0.72), gripBlackMat);
noseCap.position.set(1.55, 0, 0);
cutterTilt.add(noseCap);

const cutterBody = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.56, 0.88), yellowCutterMat);
cutterBody.position.set(3.95, 0, 0);
cutterBody.castShadow = true;
cutterTilt.add(cutterBody);

const sliderBtn = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.52), gripBlackMat);
sliderBtn.position.set(2.9, 0.36, 0);
cutterTilt.add(sliderBtn);

// 커터칼을 쥔 손 (단순하고 깔끔한 입체 손)
const palmMesh = new THREE.Mesh(new THREE.SphereGeometry(1.18, 16, 14), handSkinMat);
palmMesh.scale.set(1.35, 0.82, 1.08);
palmMesh.position.set(4.5, 0.48, 0.15);
palmMesh.castShadow = true;
cutterTilt.add(palmMesh);

for (let i = 0; i < 4; i++) {
  const fg = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.85, 6, 10), handSkinMat);
  fg.rotation.x = Math.PI / 2;
  fg.position.set(3.55 + i * 0.52, -0.18, 0.25);
  cutterTilt.add(fg);
}

const wristMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.06, 4.2, 14), handSkinMat);
wristMesh.rotation.z = -1.25;
wristMesh.position.set(6.9, 1.15, 0.2);
cutterTilt.add(wristMesh);

// ─── 난수 씨앗 생성기 ───
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

function pickRandomGift(forceHighTier = false) {
  const pool = forceHighTier ? GIFT_CATALOG.slice(0, 5) : GIFT_CATALOG;
  let totalW = 0;
  for (const it of pool) totalW += it.weight;
  let r = nextRand() * totalW;
  for (const it of pool) {
    r -= it.weight;
    if (r <= 0) return it;
  }
  return pool[pool.length - 1];
}

// ─── 단계(Wave) 정보 & 난이도 커브 ───
const MAX_STACK = 8;
const START_TIME = 11.0;
const MAX_TIME = 14.5;

function getWaveInfo(openedCount) {
  if (openedCount < 5) {
    return { lv: 1, cls: '', label: 'LV.1 워밍업', baseSpawn: 1.55, tapeW: 1.88, perfCut: 93.5 };
  }
  if (openedCount < 12) {
    return { lv: 2, cls: 'lv2', label: 'LV.2 가속', baseSpawn: 1.15, tapeW: 1.74, perfCut: 94.0 };
  }
  if (openedCount < 21) {
    return { lv: 3, cls: 'lv3', label: 'LV.3 물류러시', baseSpawn: 0.88, tapeW: 1.62, perfCut: 94.5 };
  }
  if (openedCount < 32) {
    return { lv: 4, cls: 'lv4', label: 'LV.4 특급폭주', baseSpawn: 0.68, tapeW: 1.50, perfCut: 95.0 };
  }
  if (openedCount < 45) {
    return { lv: 5, cls: 'lv5', label: 'LV.5 지옥물류', baseSpawn: 0.54, tapeW: 1.42, perfCut: 95.5 };
  }
  return { lv: 6, cls: 'lv6', label: 'LV.6 한계돌파', baseSpawn: 0.44, tapeW: 1.35, perfCut: 95.5 };
}

const STATE = {
  phase: 'menu', // 'menu' | 'play' | 'gameover'
  score: 0,
  openedCount: 0,
  currentLv: 1,
  combo: 0,
  maxCombo: 0,
  timeLeft: START_TIME,
  elapsedSec: 0,
  spawnTimer: 1.5,
  overloadTimer: 0,
  boxSeq: 0,
  accTotal: 0,
  accSamples: 0,
  giftsEarned: [],

  activeParcel: null,
  activeSlideT: 1,
  activeFromPos: new THREE.Vector3(),

  queueParcels: [],   // 대기 중인 택배 배열 (각 원소에 targetPos, dropY 애니메이션 포함)
  flyingParcels: [],  // 개봉 완료되어 옆으로 날아가며 사라지는 상자들
  poppingGifts: [],   // 퍼펙트 슬라이스로 튀어오르는 3D 선물들
  confetti: [],       // 3D 색종이·별빛 입자들
  avalancheBoxes: [], // 게임 오버 시 쏟아지는 택배 연출용

  // 현재 그리는 중인 슬라이스 스트로크
  slicing: false,
  cutInThisStroke: false,
  pointerId: null,
  strokeWorldPts: [],
  strokeScreenPts: [],
  slashTrails: [],    // 잔상 광선 이펙트
  popTexts: [],       // 2D 플로팅 텍스트
  camShake: 0,
  sliceSfxCd: 0,

  incomingRef: null,
  lastFinalRun: null,
  lastShareData: null,
};

// 대기열 슬롯 좌표 계산 (신발장 옆 현관 테라조 타일 바닥에 2열 × 2단으로 착착 쌓임!)
function getQueueSlotPos(idx) {
  const firstFloorY = ENTRY_Y + BOX_H * 0.62; // 1층 택배가 현관 바닥에 딱 닿는 높이 (-2.246)
  if (idx < 4) {
    const col = idx % 2 === 0 ? -3.15 : 4.05;
    const row = Math.floor(idx / 2);
    return new THREE.Vector3(col, firstFloorY, -6.6 - row * 6.8);
  }
  const sub = idx - 4;
  const col = sub % 2 === 0 ? -3.05 : 3.90;
  const row = Math.floor(sub / 2);
  return new THREE.Vector3(col, firstFloorY + BOX_H * 0.62 + 0.04, -6.6 - row * 6.8);
}

// 다음 택배 스펙 생성 (단계가 오를수록 1줄 → 십자/평행/X자 2줄 → 중량 H자 3줄 진화!)
function nextParcelSpec() {
  STATE.boxSeq++;
  const n = STATE.boxSeq;
  const wave = getWaveInfo(Math.max(STATE.openedCount, n - 3));

  let pattern = 'single';
  let palette = 'amber';
  let themeIdx = (n - 1) % 4;
  let scale = 0.95 + nextRand() * 0.10;
  let lineCount = 1;

  const r = nextRand();
  if (n <= 5) {
    pattern = 'single';
  } else if (n <= 12) {
    // LV.2: 십자(+) 28% + 평행(‖) 24% + 단선 48%
    if (r < 0.28) pattern = 'cross';
    else if (r < 0.52) pattern = 'parallel';
    else pattern = 'single';
  } else if (n <= 21) {
    // LV.3: 십자(+) 26% + 평행(‖) 26% + 대각X(✕) 26% + 단선 22%
    if (r < 0.26) pattern = 'cross';
    else if (r < 0.52) pattern = 'parallel';
    else if (r < 0.78) pattern = 'x_cross';
    else pattern = 'single';
  } else if (n <= 32) {
    // LV.4: 중량 H자(3줄) 35% + 2줄(53%) + 단선(12%)
    if (r < 0.35) pattern = 'h_heavy';
    else if (r < 0.55) pattern = 'x_cross';
    else if (r < 0.74) pattern = 'parallel';
    else if (r < 0.88) pattern = 'cross';
    else pattern = 'single';
  } else {
    // LV.5~6+: 중량 H자(3줄) 52% + 2줄(44%) + 단선(4%)
    if (r < 0.52) pattern = 'h_heavy';
    else if (r < 0.70) pattern = 'x_cross';
    else if (r < 0.86) pattern = 'parallel';
    else if (r < 0.96) pattern = 'cross';
    else pattern = 'single';
  }

  if (pattern === 'parallel') {
    palette = 'cyan';
    themeIdx = 2;
    lineCount = 2;
  } else if (pattern === 'cross') {
    palette = 'gold';
    themeIdx = 4;
    scale = 1.03;
    lineCount = 2;
  } else if (pattern === 'x_cross') {
    palette = 'purple';
    themeIdx = 3;
    lineCount = 2;
  } else if (pattern === 'h_heavy') {
    palette = 'crimson';
    themeIdx = 1;
    scale = 1.05;
    lineCount = 3;
  }

  let yaw = 0;
  if (n === 1) {
    yaw = 0;
  } else if (n === 2) {
    yaw = Math.PI / 2;
  } else if (pattern === 'x_cross') {
    yaw = (n % 2 === 0) ? 0 : 18 * DEG;
  } else {
    const angles = [0, Math.PI / 2, 34 * DEG, -34 * DEG, 58 * DEG, -58 * DEG, 20 * DEG, -20 * DEG];
    const poolLen = n <= 5 ? 4 : angles.length;
    yaw = angles[Math.floor(nextRand() * poolLen)];
  }

  return {
    seq: n,
    yaw,
    pattern,
    palette,
    isCross: lineCount >= 2,
    lineCount,
    tapeW: wave.tapeW,
    themeIdx,
    scale,
  };
}

function getTotalStacked() {
  return (STATE.activeParcel ? 1 : 0) + STATE.queueParcels.length;
}

function enqueueNewParcel(withDropAnim = true) {
  const spec = nextParcelSpec();
  const obj = createParcelObject(spec);
  const idx = STATE.queueParcels.length;
  const slot = getQueueSlotPos(idx);
  obj.slotPos = slot.clone();

  // 열린 현관문 바깥 복도에서 문지방을 넘어 집 안으로 휙휙! 밀려 들어오는 진입 애니메이션
  const fromX = clamp(slot.x * 0.38 + (nextRand() - 0.5) * 1.6, -3.1, 3.1);
  const fromY = ENTRY_Y + BOX_H * 0.62;
  const fromZ = DOOR_Z - 7.8;
  obj.entryFrom = new THREE.Vector3(fromX, fromY, fromZ);
  obj.entryT = withDropAnim ? 0.0 : 1.0;
  obj.entryArcH = idx >= 4 ? 4.4 : 2.6;

  if (withDropAnim) {
    obj.root.position.copy(obj.entryFrom);
    doorSwingKick = 1.0;
    sensorFlash = 1.0;
  } else {
    obj.root.position.copy(slot);
  }
  obj.root.scale.setScalar(0.62); // 대기열에서는 현관에 차곡차곡 쌓이는 아담한 비율, 앞자리 오면 1.0으로 확대!
  STATE.queueParcels.push(obj);
  if (withDropAnim && STATE.phase === 'play') {
    SFX.boxDrop(clamp(getTotalStacked() / MAX_STACK, 0, 1));
  }
}

function promoteNextParcelToDesk() {
  if (STATE.queueParcels.length === 0) {
    enqueueNewParcel(false);
  }
  const next = STATE.queueParcels.shift();
  STATE.activeParcel = next;
  STATE.activeFromPos.copy(next.root.position);
  STATE.activeSlideT = 0;

  // 남은 대기열 상자들의 목표 슬롯 갱신
  STATE.queueParcels.forEach((p, i) => {
    p.slotPos = getQueueSlotPos(i);
  });
}

// ─── 3D 콘페티 및 선물 튀어오름 스폰 ───
const confettiGeo = new THREE.PlaneGeometry(0.42, 0.26);
const CONFETTI_COLORS = ['#fde047', '#fb7185', '#38bdf8', '#4ade80', '#c084fc', '#fb923c'];

function spawnCelebration(originPos, isPerfect, giftInfo) {
  const count = isPerfect ? 26 : 10;
  for (let i = 0; i < count; i++) {
    const col = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(confettiGeo, mat);
    mesh.position.copy(originPos);
    mesh.position.y += 0.4;
    const ang = (i / count) * TAU + nextRand() * 0.4;
    const spd = (isPerfect ? 9.5 : 6.0) + nextRand() * 8.5;
    scene.add(mesh);
    STATE.confetti.push({
      mesh,
      mat,
      vx: Math.cos(ang) * spd,
      vy: (isPerfect ? 14 : 9) + nextRand() * 9,
      vz: Math.sin(ang) * spd,
      rx: (nextRand() - 0.5) * 14,
      ry: (nextRand() - 0.5) * 14,
      age: 0,
      dur: isPerfect ? 1.05 : 0.65,
    });
  }

  if (isPerfect && giftInfo) {
    const giftMesh = buildGiftMesh(giftInfo.id);
    giftMesh.position.set(originPos.x, originPos.y - 1.2, originPos.z);
    giftMesh.scale.setScalar(0.2);

    // 영롱한 황금 후광 링
    const haloMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.35, 24), haloMat);
    giftMesh.add(halo);

    scene.add(giftMesh);
    STATE.poppingGifts.push({
      mesh: giftMesh,
      halo,
      haloMat,
      info: giftInfo,
      age: 0,
      dur: 1.32,
      startX: originPos.x,
      startZ: originPos.z,
      driftX: (nextRand() - 0.5) * 3.2,
    });
  }
}

// ─── 플로팅 텍스트 추가 (기존 텍스트와 절대 겹치지 않게 최신 메시지 중심으로 깔끔 표시) ───
function addPopText(text, color = '#fde047', subText = '', yRatio = 0.31, scale = 1.0) {
  STATE.popTexts.length = 0;
  STATE.popTexts.push({
    text,
    subText,
    color,
    yRatio,
    scale,
    age: 0,
    dur: 0.92,
  });
}

function setSlicePill(msg, mode = '') {
  const el = $('slice-pill');
  if (!el) return;
  el.textContent = msg;
  el.className = 'slice-pill' + (mode ? ' ' + mode : '');
}

// ─── 화면 좌표 ↔ 작업대 상자 윗면 평면(y = WORK_TOP_Y) 교차점 계산 ───
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _topPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WORK_TOP_Y);
const _hitVec = new THREE.Vector3();

function screenToTopPlane(clientX, clientY) {
  const rect = glCanvas.getBoundingClientRect();
  _ndc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
  _raycaster.setFromCamera(_ndc, camera);
  const hit = _raycaster.ray.intersectPlane(_topPlane, _hitVec);
  if (!hit) return null;
  return { x: hit.x, z: hit.z };
}

function worldToScreen(wx, wy, wz) {
  const v = new THREE.Vector3(wx, wy, wz).project(camera);
  return {
    x: (v.x + 1) * 0.5 * window.innerWidth,
    y: (1 - v.y) * 0.5 * window.innerHeight,
  };
}

// ─── 핵심 직선 슬라이스 판정 & 정확도 산출 엔진 (lineGroup 월드 행렬 직접 투영으로 모든 패턴 100% 일치!) ───
const _wA = new THREE.Vector3();
const _wB = new THREE.Vector3();

function getLineWorldEnds(parcel, line, marginScale = 1.0) {
  parcel.root.updateMatrixWorld(true);
  const h = line.len * 0.5 * marginScale;
  _wA.set(0, 0, -h);
  _wB.set(0, 0, h);
  line.lineGroup.localToWorld(_wA);
  line.lineGroup.localToWorld(_wB);
  return { ax: _wA.x, az: _wA.z, bx: _wB.x, bz: _wB.z };
}

function evaluateStrokeAgainstLine(worldPts, parcel, line) {
  if (worldPts.length < 2) return { valid: false };

  const ends = getLineWorldEnds(parcel, line, 1.0);
  const cx = (ends.ax + ends.bx) * 0.5;
  const cz = (ends.az + ends.bz) * 0.5;
  const dxLine = ends.bx - ends.ax;
  const dzLine = ends.bz - ends.az;
  const worldLen = Math.max(0.5, Math.hypot(dxLine, dzLine));
  const ux = dxLine / worldLen;
  const uz = dzLine / worldLen;
  const nx = -uz;
  const nz = ux;

  const halfL = worldLen * 0.5;
  const nearLimit = Math.max(0.95, line.tapeW * 0.72); // 테이프 폭이 좁아질수록 판정 폭도 타이트해짐!
  const samples = [];

  for (let i = 0; i < worldPts.length - 1; i++) {
    const a = worldPts[i];
    const b = worldPts[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(segLen / 0.20));
    for (let k = (i === 0 ? 0 : 1); k <= steps; k++) {
      const t = k / steps;
      const px = lerp(a.x, b.x, t) - cx;
      const pz = lerp(a.z, b.z, t) - cz;
      const s = px * ux + pz * uz;
      const d = px * nx + pz * nz;
      if (s >= -halfL * 1.05 && s <= halfL * 1.05) {
        samples.push({ s: clamp(s, -halfL, halfL), d, wx: px, wz: pz });
      }
    }
  }

  if (samples.length < 4) return { valid: false, coverage: 0 };

  const nearSamples = samples.filter(p => Math.abs(p.d) <= nearLimit);
  if (nearSamples.length < 4) {
    return { valid: false, coverage: 0, offTape: true };
  }

  let minS = Infinity;
  let maxS = -Infinity;
  let sumAbsD = 0;
  for (const p of nearSamples) {
    if (p.s < minS) minS = p.s;
    if (p.s > maxS) maxS = p.s;
    sumAbsD += Math.abs(p.d);
  }

  const coverage = clamp((maxS - minS) / worldLen, 0, 1);
  const avgAbsD = sumAbsD / nearSamples.length;

  const pFirst = nearSamples[0];
  const pLast = nearSamples[nearSamples.length - 1];
  const ldx = pLast.wx - pFirst.wx;
  const ldz = pLast.wz - pFirst.wz;
  const chordLen = Math.hypot(ldx, ldz);

  let rmsWobble = 0;
  if (chordLen > 1.0) {
    let sqSum = 0;
    for (const p of nearSamples) {
      const cross = Math.abs((p.wx - pFirst.wx) * ldz - (p.wz - pFirst.wz) * ldx) / chordLen;
      sqSum += cross * cross;
    }
    rmsWobble = Math.sqrt(sqSum / nearSamples.length);
  }

  // 더욱 정밀해진 중심선 정확도 (0.09 이내여야 100점, 어긋나면 칼같이 감점!)
  const centerAcc = avgAbsD <= 0.09
    ? 100
    : clamp(100 - ((avgAbsD - 0.09) / (nearLimit * 0.88)) * 38, 56, 100);

  // 직선 반듯함 정확도 (0.045 이내여야 100점!)
  const straightAcc = rmsWobble <= 0.045
    ? 100
    : clamp(100 - (rmsWobble - 0.045) * 68, 52, 100);

  const covPenalty = coverage >= 0.88 ? 0 : (0.88 - coverage) * 38;
  const accuracy = Number(clamp(centerAcc * 0.64 + straightAcc * 0.36 - covPenalty, 50, 100).toFixed(1));

  return {
    valid: coverage >= 0.66 && avgAbsD <= nearLimit * 0.94,
    instantComplete: coverage >= 0.88 && avgAbsD <= nearLimit * 0.90,
    coverage,
    avgAbsD,
    rmsWobble,
    accuracy,
  };
}

// ─── 테이프 절단 및 상자 개봉 처리 ───
function applyLineCut(parcel, line, evalRes) {
  line.cut = true;
  line.progress = 1;

  // 절단 즉시 흰색 점선 가이드가 사라지고 테이프 두 반쪽이 양옆으로 쩍! 벌어져 남은 테이프와 한눈에 구분됨!
  line.guideMesh.visible = false;
  const halfW = line.tapeW * 0.5;
  line.stripL.position.x = -halfW * 0.5 - 0.16;
  line.stripR.position.x = halfW * 0.5 + 0.16;
  line.slitMesh.visible = true;
  line.slitMesh.scale.y = 1;

  parcel.accSum += evalRes.accuracy;
  parcel.cutCount += 1;

  const waveNow = getWaveInfo(STATE.openedCount);
  if (STATE.strokeScreenPts.length >= 2) {
    const p0 = STATE.strokeScreenPts[0];
    const p1 = STATE.strokeScreenPts[STATE.strokeScreenPts.length - 1];
    STATE.slashTrails.push({
      x1: p0.x, y1: p0.y,
      x2: p1.x, y2: p1.y,
      isPerfect: evalRes.accuracy >= waveNow.perfCut,
      age: 0,
      dur: 0.32,
    });
  }

  // 남은 테이프 줄 확인
  const remainCnt = parcel.tapeLines.filter(l => !l.cut).length;
  if (remainCnt > 0) {
    SFX.tapeSlice(1.0);
    addPopText(`⚡ ${remainCnt}줄 남음! 이어서 쫙!`, '#fde047', '', 0.35, 0.92);
    return true;
  }

  // 상자 완전 개봉!!
  parcel.tapeLayer.visible = false;
  parcel.flapRemL.visible = true;
  parcel.flapRemR.visible = true;

  const finalAcc = Number((parcel.accSum / Math.max(1, parcel.cutCount)).toFixed(1));
  const isPerfect = finalAcc >= waveNow.perfCut;
  const isGreat = !isPerfect && finalAcc >= 83.0;
  const lineCnt = parcel.spec.lineCount || 1;

  STATE.openedCount += 1;
  STATE.accTotal += finalAcc;
  STATE.accSamples += 1;

  if (isPerfect || isGreat) {
    STATE.combo += 1;
    if (STATE.combo > STATE.maxCombo) STATE.maxCombo = STATE.combo;
  } else {
    STATE.combo = 0;
  }

  const comboMult = 1 + Math.min(1.6, STATE.combo * 0.1);
  // 6상자 이후부터 시간 충전량이 빠르게 줄어들어 후반엔 연속 칼각만이 살길!
  const timeDecay = clamp(1.0 - Math.max(0, STATE.openedCount - 6) * 0.018, 0.35, 1.0);

  const perLineTime = isPerfect ? 0.56 : isGreat ? 0.44 : 0.31;
  let basePts = (isPerfect ? 240 : isGreat ? 150 : 95) * (1 + (lineCnt - 1) * 0.65);
  let addTime = (perLineTime * lineCnt) * timeDecay;

  let giftPicked = null;
  if (isPerfect) {
    giftPicked = pickRandomGift(lineCnt >= 2);
    basePts += giftPicked.bonusScore;
    addTime += (giftPicked.bonusTime * 0.38) * timeDecay;
    STATE.giftsEarned.push(giftPicked);
    renderGiftShelf();
  }

  const gainedScore = Math.round(basePts * comboMult);
  STATE.score += gainedScore;
  STATE.timeLeft = Math.min(MAX_TIME, STATE.timeLeft + addTime);
  STATE.overloadTimer = 0;

  // 단계(Wave) 상승 체크 및 경보!
  const nextWave = getWaveInfo(STATE.openedCount);
  const leveledUp = nextWave.lv > STATE.currentLv;
  if (leveledUp) {
    STATE.currentLv = nextWave.lv;
    SFX.bell();
  }

  SFX.boxOpen(isPerfect);
  if (isPerfect) {
    setTimeout(() => SFX.giftPop(), 55);
    STATE.camShake = 0.22;
  } else {
    STATE.camShake = 0.09;
  }

  const originPos = parcel.root.position.clone();
  spawnCelebration(originPos, isPerfect, giftPicked);

  if (leveledUp) {
    const lvMsg = nextWave.lv === 2 ? '🚨 LV.2 가속! 2줄 테이프(십자·평행) 유입 시작!'
      : nextWave.lv === 3 ? '🔥 LV.3 물류러시! 대각선(✕) 테이프 & 속도 상승!'
      : nextWave.lv === 4 ? '⚡ LV.4 특급폭주! 중량 H자(3줄) 화물 등장!'
      : nextWave.lv === 5 ? '💀 LV.5 지옥물류! 초고속 다중 테이프 러시!'
      : '👑 LV.6 한계돌파! 최고 속도 폭주 구간!!';
    setSlicePill(lvMsg, 'danger');
  } else if (isPerfect && giftPicked) {
    setSlicePill(`🎁 칼각 ${finalAcc}%! [${giftPicked.name}] 획득! (+${gainedScore}점 · +${addTime.toFixed(2)}초)`, 'perfect');
  } else if (isGreat) {
    setSlicePill(`🔥 깔끔 개봉 ${finalAcc}%! (${waveNow.perfCut}% 이상이면 선물 등장!)`, '');
  } else {
    setSlicePill(`👍 개봉 완료 ${finalAcc}%! 더 정중앙을 직선으로 베어 보세요!`, '');
  }

  if (isPerfect && giftPicked) {
    addPopText(
      `✨ 칼각 ${finalAcc}%! ${giftPicked.emoji} ${giftPicked.name}!`,
      '#fde047',
      `+${gainedScore}점 · ⏱ +${addTime.toFixed(2)}초`,
      0.30,
      1.06
    );
  } else if (isGreat) {
    addPopText(
      `🔥 깔끔 개봉 ${finalAcc}%!`,
      '#38bdf8',
      `+${gainedScore}점 · ⏱ +${addTime.toFixed(2)}초`,
      0.32,
      0.95
    );
  } else {
    addPopText(
      `📦 개봉 ${finalAcc}%`,
      '#e2e8f0',
      `+${gainedScore}점 · ⏱ +${addTime.toFixed(2)}초`,
      0.34,
      0.88
    );
  }

  const flyDir = STATE.openedCount % 2 === 0 ? 1 : -1;
  STATE.flyingParcels.push({
    parcel,
    age: 0,
    dur: 0.45,
    vx: flyDir * 25,
    vy: 6.5,
    vz: 9.5,
    rotZ: -flyDir * 1.35,
  });

  STATE.activeParcel = null;
  promoteNextParcelToDesk();
  updateHUD();
  return true;
}

// ─── 포인터(터치/마우스) 입력 처리 ───
function updateRealtimeTapePreview() {
  const parcel = STATE.activeParcel;
  if (!parcel || STATE.strokeWorldPts.length < 2) return;

  for (const line of parcel.tapeLines) {
    if (line.cut) continue;
    const ev = evaluateStrokeAgainstLine(STATE.strokeWorldPts, parcel, line);
    if (ev.coverage > 0.08 && !ev.offTape) {
      line.slitMesh.visible = true;
      line.slitMesh.scale.y = clamp(ev.coverage, 0.05, 1);
    }

    // 테이프 끝까지(87%+) 반듯하게 관통한 순간 손을 떼기 전이라도 즉시 쾌속 절단!
    if (ev.instantComplete) {
      STATE.cutInThisStroke = true;
      applyLineCut(parcel, line, ev);
      // 상자가 완전히 열려 다음 상자로 넘어갔다면 현재 스트로크를 마감하여 새 상자가 오자마자 오작동하지 않게 보호
      if (STATE.activeParcel !== parcel) {
        STATE.slicing = false;
        STATE.cutInThisStroke = false;
        STATE.pointerId = null;
        STATE.strokeWorldPts = [];
        STATE.strokeScreenPts = [];
        cutterRig.visible = false;
        return;
      }
      // 십자(+) 상자에서 1줄만 잘렸다면 스트로크를 리셋해 바로 이어서 그을 수 있게 지원
      STATE.strokeWorldPts = [STATE.strokeWorldPts[STATE.strokeWorldPts.length - 1]];
      STATE.strokeScreenPts = [STATE.strokeScreenPts[STATE.strokeScreenPts.length - 1]];
      return;
    }
  }
}

glCanvas.addEventListener('pointerdown', e => {
  unlockAudio();
  if (STATE.phase !== 'play') return;
  if (STATE.slicing) return;

  const wp = screenToTopPlane(e.clientX, e.clientY);
  if (!wp) return;

  STATE.slicing = true;
  STATE.cutInThisStroke = false;
  STATE.pointerId = e.pointerId;
  try { glCanvas.setPointerCapture(e.pointerId); } catch {}

  STATE.strokeWorldPts = [wp];
  STATE.strokeScreenPts = [{ x: e.clientX, y: e.clientY }];

  cutterRig.visible = true;
  cutterRig.position.set(wp.x, WORK_TOP_Y + 0.10, wp.z);
  cutterRig.rotation.y = -0.72; // 오른손이 오른쪽 아래에서 자연스럽게 쥐고 들어오는 기본 각도
});

glCanvas.addEventListener('pointermove', e => {
  if (STATE.phase !== 'play' || !STATE.slicing || e.pointerId !== STATE.pointerId) return;

  const wp = screenToTopPlane(e.clientX, e.clientY);
  if (!wp) return;

  const prev = STATE.strokeWorldPts[STATE.strokeWorldPts.length - 1];
  const dist = Math.hypot(wp.x - prev.x, wp.z - prev.z);
  if (dist < 0.08) return;

  STATE.strokeWorldPts.push(wp);
  STATE.strokeScreenPts.push({ x: e.clientX, y: e.clientY });

  // 커터칼 위치 및 오른손 자연 파지 각도 범위 내에서 부드럽게 조향
  cutterRig.visible = true;
  cutterRig.position.set(wp.x, WORK_TOP_Y + 0.06, wp.z);
  const dx = wp.x - prev.x;
  const dz = wp.z - prev.z;
  const targetYaw = -0.72 + clamp(dx * 0.18 - dz * 0.08, -0.45, 0.45);
  cutterRig.rotation.y = lerp(cutterRig.rotation.y, targetYaw, 0.35);

  if (STATE.sliceSfxCd <= 0 && dist > 0.22) {
    SFX.tapeSlice(clamp(dist * 0.9, 0.2, 1.0));
    STATE.sliceSfxCd = 0.055;
  }

  updateRealtimeTapePreview();
});

function finishPointerStroke(e) {
  if (!STATE.slicing || (e && e.pointerId !== STATE.pointerId)) return;

  const parcel = STATE.activeParcel;
  if (parcel && STATE.strokeWorldPts.length >= 2) {
    const first = STATE.strokeWorldPts[0];
    const last = STATE.strokeWorldPts[STATE.strokeWorldPts.length - 1];
    const totalDrag = Math.hypot(last.x - first.x, last.z - first.z);

    if (totalDrag >= 1.2) {
      let bestLine = null;
      let bestEval = null;
      for (const line of parcel.tapeLines) {
        if (line.cut) continue;
        const ev = evaluateStrokeAgainstLine(STATE.strokeWorldPts, parcel, line);
        if (ev.valid && (!bestEval || ev.accuracy > bestEval.accuracy)) {
          bestLine = line;
          bestEval = ev;
        }
      }

      if (bestLine && bestEval) {
        applyLineCut(parcel, bestLine, bestEval);
      } else if (!STATE.cutInThisStroke) {
        // 테이프를 덜 그었거나 빗나감 -> 미개봉 피드백 & 임시 절개선 원복
        for (const line of parcel.tapeLines) {
          if (!line.cut) {
            line.slitMesh.visible = false;
            line.progress = 0;
          }
        }
        STATE.combo = 0;
        SFX.boxScratch();
        addPopText('삑! 테이프를 끝까지 쫙 그으세요!', '#fb7185', '', 0.35, 0.88);
        setSlicePill('⚠️ 테이프 점선을 따라 처음부터 끝까지 반듯하게 그으세요!', 'danger');
        updateHUD();
      }
    }
  }

  STATE.slicing = false;
  STATE.cutInThisStroke = false;
  STATE.pointerId = null;
  STATE.strokeWorldPts = [];
  STATE.strokeScreenPts = [];
  cutterRig.visible = false;
}

glCanvas.addEventListener('pointerup', finishPointerStroke);
glCanvas.addEventListener('pointercancel', finishPointerStroke);
glCanvas.addEventListener('contextmenu', e => e.preventDefault());

// ─── HUD 및 선물 선반 렌더링 ───
const stackCells = Array.from(document.querySelectorAll('#hud-stack-slots .stack-cell'));

function renderGiftShelf() {
  const shelf = $('gift-shelf');
  if (!shelf) return;
  const recent = STATE.giftsEarned.slice(-6);
  shelf.innerHTML = recent
    .map(g => `<span class="gift-chip">${g.emoji} ${g.name}</span>`)
    .join('');
}

function updateHUD() {
  const wave = getWaveInfo(STATE.openedCount);
  $('hud-score').textContent = `${STATE.score.toLocaleString()}점`;
  $('hud-opened').textContent = `📦 ${STATE.openedCount}개`;

  const waveEl = $('hud-wave');
  if (waveEl) {
    waveEl.textContent = wave.label;
    waveEl.className = 'wave-pill' + (wave.cls ? ' ' + wave.cls : '');
  }

  const comboEl = $('hud-combo');
  if (STATE.combo >= 2) {
    comboEl.textContent = `🔥 ${STATE.combo} COMBO`;
    comboEl.classList.remove('idle');
  } else {
    comboEl.textContent = STATE.giftsEarned.length > 0 ? `🎁 선물 ${STATE.giftsEarned.length}개` : `칼각 ${wave.perfCut}%+ 선물!`;
    comboEl.classList.add('idle');
  }

  const t = Math.max(0, STATE.timeLeft);
  const timeTxt = $('hud-time-txt');
  timeTxt.textContent = `${t.toFixed(1)}초`;
  timeTxt.style.color = t <= 3.5 ? '#fb7185' : t <= 6.5 ? '#fbbf24' : '#4ade80';

  const fill = $('hud-time-fill');
  fill.style.width = `${clamp((t / MAX_TIME) * 100, 0, 100).toFixed(1)}%`;
  fill.classList.toggle('warn', t > 3.5 && t <= 6.5);
  fill.classList.toggle('crit', t <= 3.5);

  const stacked = getTotalStacked();
  const stackTxt = $('hud-stack-txt');
  stackTxt.textContent = `${stacked} / ${MAX_STACK}`;
  stackTxt.style.color = stacked >= 6 ? '#fb7185' : '#e2dcf5';

  stackCells.forEach((cell, i) => {
    const on = i < stacked;
    cell.classList.toggle('filled', on);
    cell.classList.toggle('high', on && stacked >= 6);
  });

  const inDanger = STATE.phase === 'play' && (t <= 4.2 || stacked >= 6);
  $('hud-card').classList.toggle('danger-pulse', inDanger);
  $('danger-vignette').classList.toggle('active', inDanger);
  BGM.setUrgent(inDanger);
}

// ─── 게임 시작 / 초기화 / 게임 오버 ───
function clearAllSceneObjects() {
  if (STATE.activeParcel) {
    disposeParcel(STATE.activeParcel);
    STATE.activeParcel = null;
  }
  STATE.queueParcels.forEach(disposeParcel);
  STATE.queueParcels = [];
  STATE.flyingParcels.forEach(f => disposeParcel(f.parcel));
  STATE.flyingParcels = [];
  STATE.avalancheBoxes.forEach(a => disposeParcel(a.parcel));
  STATE.avalancheBoxes = [];

  STATE.poppingGifts.forEach(g => scene.remove(g.mesh));
  STATE.poppingGifts = [];
  STATE.confetti.forEach(c => {
    scene.remove(c.mesh);
    c.mat.dispose();
  });
  STATE.confetti = [];
}

function setupMenuPreviewScene() {
  clearAllSceneObjects();
  seedRng(777);
  STATE.boxSeq = 0;
  enqueueNewParcel(false);
  enqueueNewParcel(false);
  enqueueNewParcel(false);
  promoteNextParcelToDesk();
  STATE.activeSlideT = 1;
  if (STATE.activeParcel) {
    STATE.activeParcel.root.position.set(0, 0, WORK_Z);
    STATE.activeParcel.root.scale.setScalar(1.0);
  }
}

let recRunIdx = 0;

function startGame() {
  unlockAudio();
  clearAllSceneObjects();

  recRunIdx += 1;
  const seed = IS_REC ? (20261125 + recRunIdx * 97) : ((Date.now() ^ Math.floor(Math.random() * 999999)) >>> 0);
  seedRng(seed);

  STATE.phase = 'play';
  STATE.score = 0;
  STATE.openedCount = 0;
  STATE.currentLv = 1;
  STATE.combo = 0;
  STATE.maxCombo = 0;
  STATE.timeLeft = START_TIME;
  STATE.elapsedSec = 0;
  STATE.spawnTimer = 1.55;
  STATE.overloadTimer = 0;
  STATE.boxSeq = 0;
  STATE.accTotal = 0;
  STATE.accSamples = 0;
  STATE.giftsEarned = [];
  STATE.slicing = false;
  STATE.pointerId = null;
  STATE.strokeWorldPts = [];
  STATE.strokeScreenPts = [];
  STATE.slashTrails = [];
  STATE.popTexts = [];
  STATE.camShake = 0;
  cutterRig.visible = false;

  // 시작 시 총 3상자(앞자리 1 + 대기 2) 배치
  enqueueNewParcel(false);
  enqueueNewParcel(false);
  enqueueNewParcel(false);
  promoteNextParcelToDesk();

  $('start-modal').classList.add('hidden');
  $('result-modal').classList.add('hidden');
  $('box-hud').classList.remove('hidden');
  $('bottom-bar').classList.remove('hidden');
  renderGiftShelf();
  setSlicePill('테이프 점선을 따라 끝까지 직선으로 쫙! 그으세요!', '');
  updateHUD();

  if (!IS_REC && !BGM.isMuted()) {
    BGM.start('boxcut');
  }
}

function formatLadderMetric(row) {
  const sc = Math.round(Number(row.score || 0)).toLocaleString();
  const bx = Math.round(Number(row.actual_value || 0));
  return bx > 0 ? `${sc}점 · ${bx}상자` : `${sc}점`;
}

function computeRankTitle(score, opened, giftsCnt, avgAcc) {
  if (score >= 8500 || (opened >= 28 && giftsCnt >= 8)) {
    return {
      title: '👑 전설의 칼각 언박싱 신(神)',
      comment: `택배 ${opened}상자를 빛의 속도로 해체하고 선물 ${giftsCnt}개를 쓸어 담았어요!`,
    };
  }
  if (score >= 4500 || opened >= 18) {
    return {
      title: '⚡ 초고속 물류센터 에이스',
      comment: `평균 정확도 ${avgAcc.toFixed(1)}%! 손놀림이 커터칼 그 자체예요!`,
    };
  }
  if (score >= 2000 || opened >= 9) {
    return {
      title: '📦 손맛 좋은 언박싱 장인',
      comment: '리듬을 탔어요! 테이프 정중앙을 노리면 선물 보너스가 쏟아집니다!',
    };
  }
  return {
    title: '🐣 택배 산더미에 파묻힌 수습생',
    comment: '망설이지 말고 테이프 점선을 따라 한 번에 쫙! 직선으로 그어 보세요!',
  };
}

async function triggerGameOver(reason) {
  if (STATE.phase === 'gameover') return;
  STATE.phase = 'gameover';
  STATE.slicing = false;
  STATE.pointerId = null;
  cutterRig.visible = false;
  BGM.setUrgent(false);
  $('danger-vignette').classList.remove('active');
  $('hud-card').classList.remove('danger-pulse');

  SFX.fail();
  STATE.camShake = 0.35;

  // 열린 현관문을 통해 택배 상자 7개가 거실 마루턱까지 우르르 쏟아져 들어오는 피날레 연출!
  for (let i = 0; i < 7; i++) {
    const p = createParcelObject(nextParcelSpec());
    p.root.position.set((nextRand() - 0.5) * 4.2, ENTRY_Y + 3.2 + i * 1.4, DOOR_Z - 2.0 - i * 2.2);
    p.root.scale.setScalar(0.84);
    STATE.avalancheBoxes.push({
      parcel: p,
      vx: (nextRand() - 0.5) * 7.5,
      vy: 6.5 + nextRand() * 4.5,
      vz: 26 + nextRand() * 14,
      rx: (nextRand() - 0.5) * 3.2,
      rz: (nextRand() - 0.5) * 3.2,
      targetY: -0.6 + (i % 3) * 1.35,
      maxZ: WORK_Z + 1.8 - (i % 4) * 2.8,
    });
  }
  doorSwingKick = 1.4;
  sensorFlash = 1.4;

  addPopText(
    reason === 'stack' ? '📦 택배 과부하!! 현관이 꽉 찼어요!' : '⏰ 시간 초과!! 택배가 밀렸어요!',
    '#fb7185',
    `총 ${STATE.openedCount}상자 개봉 · ${STATE.score.toLocaleString()}점`,
    0.34,
    1.06
  );

  const avgAcc = STATE.accSamples > 0 ? Number((STATE.accTotal / STATE.accSamples).toFixed(1)) : 0;
  const rk = computeRankTitle(STATE.score, STATE.openedCount, STATE.giftsEarned.length, avgAcc);

  const prevBestBoxes = Number(localStorage.getItem(BEST_BOXES_KEY) || '0');
  if (STATE.openedCount > prevBestBoxes) {
    localStorage.setItem(BEST_BOXES_KEY, String(STATE.openedCount));
  }

  const isBest = updateBestRecord(GAME_ID, {
    score: STATE.score,
    actualValue: STATE.openedCount,
    targetValue: STATE.giftsEarned.length,
    rankTitle: rk.title,
  }, false);

  syncBestBadges();

  $('res-rank').textContent = isBest ? `${rk.title} · 신기록!` : rk.title;
  $('res-headline').textContent = `${STATE.score.toLocaleString()}점`;
  $('res-comment').textContent = rk.comment;
  $('res-boxes').textContent = `${STATE.openedCount}상자`;
  $('res-acc').textContent = `${avgAcc.toFixed(1)}%`;
  $('res-gifts-cnt').textContent = `${STATE.giftsEarned.length}개`;

  // 획득한 선물 집계 표시
  const giftBox = $('res-gifts-box');
  const giftList = $('res-gifts-list');
  if (STATE.giftsEarned.length === 0) {
    giftList.innerHTML = `<span class="gift-res-item" style="color:#b8b0cc">정확도 91% 이상으로 그으면 선물이 튀어나와요!</span>`;
  } else {
    const counts = new Map();
    for (const g of STATE.giftsEarned) {
      const prev = counts.get(g.id) || { info: g, cnt: 0 };
      prev.cnt += 1;
      counts.set(g.id, prev);
    }
    giftList.innerHTML = Array.from(counts.values())
      .map(({ info, cnt }) => `<span class="gift-res-item">${info.emoji} ${info.name}${cnt > 1 ? ` ×${cnt}` : ''}</span>`)
      .join('');
  }
  giftBox.style.display = 'flex';

  $('res-nick').value = getSavedNickname();

  STATE.lastFinalRun = {
    gameId: GAME_ID,
    nickname: $('res-nick').value || '익명 언박서',
    targetValue: STATE.giftsEarned.length,
    actualValue: STATE.openedCount,
    score: STATE.score,
    errorMm: Number((100 - avgAcc).toFixed(2)),
    rankTitle: rk.title,
    seed: 1,
    meta: {
      opened: STATE.openedCount,
      avgAcc,
      gifts: STATE.giftsEarned.length,
      maxCombo: STATE.maxCombo,
    },
  };

  setTimeout(async () => {
    if (STATE.phase !== 'gameover') return;
    $('bottom-bar').classList.add('hidden');
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
  }, 850);
}

// ─── 2D 슬라이스 광선 & 플로팅 텍스트 오버레이 렌더링 ───
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

  // 현재 긋고 있는 실시간 커터 궤적
  if (STATE.slicing && STATE.strokeScreenPts.length >= 2) {
    const pts = STATE.strokeScreenPts;
    ovCtx.save();
    ovCtx.lineCap = 'round';
    ovCtx.lineJoin = 'round';

    // 바깥 광채
    ovCtx.strokeStyle = 'rgba(253, 224, 71, 0.42)';
    ovCtx.lineWidth = 14;
    ovCtx.beginPath();
    ovCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ovCtx.lineTo(pts[i].x, pts[i].y);
    ovCtx.stroke();

    // 중심 예리한 날 선
    ovCtx.strokeStyle = '#ffffff';
    ovCtx.lineWidth = 4.5;
    ovCtx.beginPath();
    ovCtx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ovCtx.lineTo(pts[i].x, pts[i].y);
    ovCtx.stroke();
    ovCtx.restore();
  }

  // 절단 직후 번쩍이는 일섬 잔상
  for (let i = STATE.slashTrails.length - 1; i >= 0; i--) {
    const tr = STATE.slashTrails[i];
    tr.age += dt;
    if (tr.age >= tr.dur) {
      STATE.slashTrails.splice(i, 1);
      continue;
    }
    const u = 1 - tr.age / tr.dur;
    ovCtx.save();
    ovCtx.globalAlpha = u;
    ovCtx.lineCap = 'round';
    ovCtx.strokeStyle = tr.isPerfect ? '#fde047' : '#38bdf8';
    ovCtx.lineWidth = (tr.isPerfect ? 22 : 13) * u;
    ovCtx.beginPath();
    ovCtx.moveTo(tr.x1, tr.y1);
    ovCtx.lineTo(tr.x2, tr.y2);
    ovCtx.stroke();

    ovCtx.strokeStyle = '#ffffff';
    ovCtx.lineWidth = 5 * u;
    ovCtx.beginPath();
    ovCtx.moveTo(tr.x1, tr.y1);
    ovCtx.lineTo(tr.x2, tr.y2);
    ovCtx.stroke();
    ovCtx.restore();
  }

  // 녹화 모드(?rec=1)일 때 첫 1.6초 게임 이름 로고 & 터치 고리 표시
  if (IS_REC && recRunIdx === 1 && STATE.elapsedSec < 1.9) {
    const tLogo = STATE.elapsedSec;
    const alpha = tLogo < 1.6 ? 1.0 : clamp(1.0 - (tLogo - 1.6) / 0.3, 0, 1);
    const yOff = tLogo < 1.6 ? 0 : -(tLogo - 1.6) * 45;
    ovCtx.save();
    ovCtx.globalAlpha = alpha;
    ovCtx.textAlign = 'center';
    ovCtx.font = '900 32px "Pretendard","Apple SD Gothic Neo",sans-serif';
    ovCtx.lineWidth = 8;
    ovCtx.strokeStyle = 'rgba(20, 14, 30, 0.95)';
    ovCtx.strokeText('열려라 택배!', w / 2, h * 0.25 + yOff);
    ovCtx.fillStyle = '#ffe24a';
    ovCtx.fillText('열려라 택배!', w / 2, h * 0.25 + yOff);
    ovCtx.restore();
  }

  if (IS_REC && STATE.slicing && STATE.strokeScreenPts.length > 0) {
    const cur = STATE.strokeScreenPts[STATE.strokeScreenPts.length - 1];
    ovCtx.save();
    ovCtx.beginPath();
    ovCtx.arc(cur.x, cur.y, 26, 0, TAU);
    ovCtx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ovCtx.fill();
    ovCtx.lineWidth = 3;
    ovCtx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ovCtx.stroke();
    ovCtx.restore();
  }

  // 2D 팝업 텍스트
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
    ovCtx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ovCtx.shadowBlur = 10;
    ovCtx.shadowOffsetY = 3;
    const fontPx = Math.round(21 * (p.scale || 1));
    ovCtx.font = `900 ${fontPx}px "Pretendard","Apple SD Gothic Neo",sans-serif`;
    ovCtx.lineWidth = 7.5;
    ovCtx.lineJoin = 'round';
    ovCtx.strokeStyle = 'rgba(18, 13, 28, 0.96)';
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

// ─── 카메라 반응형 구도 업데이트 (신발장·현관문·택배 행렬과 앞자리 작업대가 한눈에 잡히는 구도) ───
function updateCameraPose(nowSec) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  // 모바일 세로 화면(aspect < 0.78)에서도 신발장 옆 현관과 열린 현관문 택배 러시가 통째로 들어오도록 보정
  const portraitScale = aspect < 0.78 ? clamp(0.78 / Math.max(0.42, aspect), 1.0, 1.54) : 1.0;
  const baseY = 23.6 * portraitScale;
  const baseZ = WORK_Z + 20.2 * portraitScale;
  const sideBiasX = aspect < 0.78 ? -0.42 : 0;

  if (STATE.phase === 'menu') {
    camera.position.set(sideBiasX + Math.sin(nowSec * 0.45) * 2.3, baseY * 0.96, baseZ);
    camera.lookAt(sideBiasX * 0.4, -1.1, WORK_Z - 3.6);
  } else {
    let sx = 0;
    let sy = 0;
    if (STATE.camShake > 0) {
      sx = (Math.sin(nowSec * 65) * 0.65) * STATE.camShake;
      sy = (Math.cos(nowSec * 79) * 0.55) * STATE.camShake;
    }
    camera.position.set(sideBiasX + sx, baseY + sy, baseZ + (IS_REC ? 1.6 : 0));
    camera.lookAt(sideBiasX * 0.4, IS_REC ? -2.3 : -1.05, WORK_Z - (IS_REC ? 2.5 : 3.6));
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── 메인 게임 루프 ───
let lastTime = performance.now();

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
  lastTime = now;
  const nowSec = now * 0.001;

  if (STATE.camShake > 0) {
    STATE.camShake = Math.max(0, STATE.camShake - dt * 2.2);
  }
  if (STATE.sliceSfxCd > 0) {
    STATE.sliceSfxCd = Math.max(0, STATE.sliceSfxCd - dt);
  }

  // 문밖 복도에서 현관문으로 끝없이 밀려오는 택배 행렬 & 현관문·센서등 애니메이션
  const waveForEnv = getWaveInfo(STATE.openedCount);
  const rushSpeed = STATE.phase === 'play' ? (5.2 + waveForEnv.lv * 2.2) : 3.6;
  for (let i = 0; i < corridorRushBoxes.length; i++) {
    const cb = corridorRushBoxes[i];
    cb.mesh.position.z += dt * rushSpeed;
    if (cb.mesh.position.z > DOOR_Z - 1.5) {
      cb.mesh.position.z -= 26.0;
    }
    cb.mesh.position.y = cb.baseY + Math.abs(Math.sin(nowSec * (5.5 + waveForEnv.lv) + i * 1.3)) * 0.24;
    cb.mesh.rotation.z = Math.sin(nowSec * 8 + i) * 0.03;
  }

  if (doorSwingKick > 0) {
    doorSwingKick = Math.max(0, doorSwingKick - dt * 3.4);
  }
  entryDoorPivot.rotation.y = DOOR_BASE_OPEN_YAW + Math.sin(nowSec * 28) * 0.09 * doorSwingKick;

  if (sensorFlash > 0) {
    sensorFlash = Math.max(0, sensorFlash - dt * 2.6);
  }
  const dangerBlink = (getTotalStacked() >= 6 && STATE.phase === 'play')
    ? (0.5 + 0.5 * Math.sin(nowSec * 14))
    : 0;
  sensorPointLight.color.set(dangerBlink > 0.45 ? '#ff7b72' : '#ffe08a');
  sensorPointLight.intensity = 12.5 + sensorFlash * 15.0 + dangerBlink * 6.0;
  sensorBulbMat.emissive.set(dangerBlink > 0.45 ? '#fb7185' : '#ffd166');
  sensorBulbMat.emissiveIntensity = 0.85 + sensorFlash * 1.4 + dangerBlink * 0.8;

  if (STATE.phase === 'play') {
    STATE.elapsedSec += dt;
    STATE.timeLeft = Math.max(0, STATE.timeLeft - dt);

    const wave = waveForEnv;

    // 단계별로 급격히 빨라지는 택배 유입 타이머!
    const spawnInterval = Math.max(0.38, wave.baseSpawn - Math.min(0.12, STATE.elapsedSec * 0.002));
    STATE.spawnTimer -= dt;
    if (STATE.spawnTimer <= 0) {
      if (getTotalStacked() < MAX_STACK) {
        enqueueNewParcel(true);
        const newest = STATE.queueParcels[STATE.queueParcels.length - 1];
        const extraLines = newest ? Math.max(0, (newest.spec.lineCount || 1) - 1) : 0;
        STATE.spawnTimer = spawnInterval + extraLines * 0.22;
      } else {
        triggerGameOver('stack');
      }
    }

    // 8개 포화 유지 시 짧은 유예(0.75초) 후 즉시 과부하 게임오버!
    if (getTotalStacked() >= MAX_STACK) {
      STATE.overloadTimer += dt;
      if (STATE.overloadTimer >= 0.75) {
        triggerGameOver('stack');
      }
    } else {
      STATE.overloadTimer = 0;
    }

    if (STATE.timeLeft <= 0 && STATE.phase === 'play') {
      triggerGameOver('time');
    }

    updateHUD();
  }

  // 앞자리 주인공 택배 슬라이드 진입 애니메이션 (현관 바닥에서 마루턱을 넘어 언박싱 매트로 척!)
  if (STATE.activeParcel && STATE.activeSlideT < 1) {
    STATE.activeSlideT = Math.min(1, STATE.activeSlideT + dt / 0.15);
    const e = easeOutCubic(STATE.activeSlideT);
    STATE.activeParcel.root.position.lerpVectors(
      STATE.activeFromPos,
      new THREE.Vector3(0, 0, WORK_Z),
      e
    );
    STATE.activeParcel.root.position.y += Math.sin(STATE.activeSlideT * Math.PI) * 1.25;
    const sc = lerp(0.62, 1.0, e);
    STATE.activeParcel.root.scale.setScalar(sc);
    STATE.activeParcel.root.rotation.x = 0;
  }

  // 대기열 택배: 열린 현관문을 돌파해 집 안 현관 타일 바닥으로 슈웅— 탁! 미끄러져 쌓이는 애니메이션
  const stackedDanger = getTotalStacked() >= 6 && STATE.phase === 'play';
  STATE.queueParcels.forEach((p, idx) => {
    const jitterX = stackedDanger ? Math.sin(nowSec * 22 + idx) * 0.14 : 0;
    if (p.entryT !== undefined && p.entryT < 1) {
      p.entryT = Math.min(1, p.entryT + dt / 0.30);
      const e = easeOutCubic(p.entryT);
      p.root.position.x = lerp(p.entryFrom.x, p.slotPos.x, e) + jitterX;
      p.root.position.z = lerp(p.entryFrom.z, p.slotPos.z, e);
      p.root.position.y = lerp(p.entryFrom.y, p.slotPos.y, e) + Math.sin(p.entryT * Math.PI) * (p.entryArcH || 2.6);
      p.root.rotation.x = Math.sin(p.entryT * TAU) * 0.13 * (1 - p.entryT);
      // 착지 순간 쫀득한 탄성 스쿼시
      const bounce = p.entryT > 0.78 ? Math.sin(((p.entryT - 0.78) / 0.22) * Math.PI) * 0.07 : 0;
      p.root.scale.set(0.62 * (1 + bounce), 0.62 * (1 - bounce * 1.3), 0.62 * (1 + bounce));
    } else {
      p.root.position.x = lerp(p.root.position.x, p.slotPos.x + jitterX, Math.min(1, dt * 14));
      p.root.position.y = lerp(p.root.position.y, p.slotPos.y, Math.min(1, dt * 14));
      p.root.position.z = lerp(p.root.position.z, p.slotPos.z, Math.min(1, dt * 14));
      p.root.rotation.x = 0;
      p.root.scale.setScalar(0.62);
    }
  });

  // 개봉되어 날아가는 상자 날개 열림 & 퇴장 물리
  for (let i = STATE.flyingParcels.length - 1; i >= 0; i--) {
    const f = STATE.flyingParcels[i];
    f.age += dt;
    const u = clamp(f.age / f.dur, 0, 1);
    const flapAng = easeOutBack(Math.min(1, u * 2.4)) * 2.15;
    f.parcel.leftPivot.rotation.z = flapAng;
    f.parcel.rightPivot.rotation.z = -flapAng;

    if (f.age > 0.08) {
      f.vy -= 42 * dt;
      f.parcel.root.position.x += f.vx * dt;
      f.parcel.root.position.y += f.vy * dt;
      f.parcel.root.position.z += f.vz * dt;
      f.parcel.root.rotation.z += f.rotZ * dt;
      f.parcel.root.scale.setScalar(Math.max(0.1, 1 - Math.max(0, u - 0.35) * 1.3));
    }

    if (f.age >= f.dur) {
      disposeParcel(f.parcel);
      STATE.flyingParcels.splice(i, 1);
    }
  }

  // 튀어오르는 3D 랜덤 선물 포물선 & 회전 애니메이션
  for (let i = STATE.poppingGifts.length - 1; i >= 0; i--) {
    const g = STATE.poppingGifts[i];
    g.age += dt;
    const u = clamp(g.age / g.dur, 0, 1);
    const popScale = u < 0.22
      ? easeOutBack(u / 0.22) * 1.38
      : u > 0.78
        ? lerp(1.38, 0.05, (u - 0.78) / 0.22)
        : 1.38;

    // 상자 안에서 위로 솟구쳐 한바퀴 멋지게 자랑한 뒤 살짝 위로 사라짐
    const arcY = Math.sin(Math.min(1, u * 1.15) * Math.PI) * 8.4 + u * 2.2;
    g.mesh.position.set(
      g.startX + g.driftX * u,
      -0.5 + arcY,
      g.startZ - u * 1.6
    );
    g.mesh.scale.setScalar(Math.max(0.05, popScale));
    g.mesh.rotation.y += dt * 4.8;
    g.mesh.rotation.x = Math.sin(u * TAU) * 0.18;

    g.halo.lookAt(camera.position);
    g.haloMat.opacity = (1 - u) * 0.75;

    if (g.age >= g.dur) {
      scene.remove(g.mesh);
      g.haloMat.dispose();
      g.halo.geometry.dispose();
      STATE.poppingGifts.splice(i, 1);
    }
  }

  // 콘페티 입자 업데이트
  for (let i = STATE.confetti.length - 1; i >= 0; i--) {
    const c = STATE.confetti[i];
    c.age += dt;
    if (c.age >= c.dur) {
      scene.remove(c.mesh);
      c.mat.dispose();
      STATE.confetti.splice(i, 1);
      continue;
    }
    c.vy -= 36 * dt;
    c.mesh.position.x += c.vx * dt;
    c.mesh.position.y += c.vy * dt;
    c.mesh.position.z += c.vz * dt;
    c.mesh.rotation.x += c.rx * dt;
    c.mesh.rotation.y += c.ry * dt;
    c.mat.opacity = 1 - c.age / c.dur;
  }

  // 게임오버: 열린 현관문에서 쏟아져 들어오는 택배 산사태 업데이트
  for (const a of STATE.avalancheBoxes) {
    if (a.parcel.root.position.z < a.maxZ || a.parcel.root.position.y > a.targetY) {
      a.vy -= 48 * dt;
      a.parcel.root.position.x += a.vx * dt;
      a.parcel.root.position.z = Math.min(a.maxZ, a.parcel.root.position.z + a.vz * dt);
      a.parcel.root.position.y = Math.max(a.targetY, a.parcel.root.position.y + a.vy * dt);
      if (a.parcel.root.position.y <= a.targetY) {
        a.vx *= 0.85;
        a.vz *= 0.85;
      } else {
        a.parcel.root.rotation.x += a.rx * dt;
        a.parcel.root.rotation.z += a.rz * dt;
      }
    }
  }

  updateCameraPose(nowSec);
  renderer.render(scene, camera);
  drawOverlay(dt);

  // 쇼츠 자동 녹화/디버그용 상태 노출 (모든 패턴의 남은 테이프 줄 좌표를 월드 행렬로 정확히 산출!)
  let activeLineScreen = null;
  if (STATE.activeParcel && STATE.activeParcel.tapeLines.length > 0) {
    const parcel = STATE.activeParcel;
    const remainLines = parcel.tapeLines.filter(l => !l.cut);
    const line = remainLines[0] || parcel.tapeLines[0];
    const ends = getLineWorldEnds(parcel, line, 1.14);
    const sA = worldToScreen(ends.ax, WORK_TOP_Y, ends.az);
    const sB = worldToScreen(ends.bx, WORK_TOP_Y, ends.bz);
    activeLineScreen = {
      x1: sA.x,
      y1: sA.y,
      x2: sB.x,
      y2: sB.y,
      pattern: parcel.spec.pattern,
      remainCnt: remainLines.length,
    };
  }

  window.__boxcutDebug = {
    phase: STATE.phase,
    waveLv: STATE.currentLv,
    score: STATE.score,
    openedCount: STATE.openedCount,
    stacked: getTotalStacked(),
    timeLeft: Number(STATE.timeLeft.toFixed(2)),
    giftsCount: STATE.giftsEarned.length,
    activeSlideT: STATE.activeSlideT,
    activeLineScreen,
  };
}

// ─── 버튼 및 공유·랭킹 바인딩 ───
function syncBgmBtn() {
  const btn = $('btn-bgm');
  const muted = BGM.isMuted();
  btn.textContent = muted ? '🔇 BGM' : '🔊 BGM';
  btn.classList.toggle('bgm-off', muted);
}

function syncBestBadges() {
  const best = getBestRecord(GAME_ID);
  const bestBoxes = Number(localStorage.getItem(BEST_BOXES_KEY) || '0');
  if (best && best.score != null) {
    const sc = Math.round(Number(best.score)).toLocaleString();
    $('best-pill').textContent = `🏆 최고 ${sc}점`;
    $('start-best').textContent = `${sc}점`;
  }
  $('start-best-boxes').textContent = `${bestBoxes}상자`;
}

$('btn-bgm').addEventListener('click', () => {
  unlockAudio();
  const muted = BGM.toggleMute();
  if (!muted && STATE.phase === 'play') BGM.start('boxcut');
  syncBgmBtn();
});

$('btn-start').addEventListener('click', () => startGame());
$('btn-retry').addEventListener('click', () => startGame());

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
  STATE.lastFinalRun.nickname = saveNickname($('res-nick').value || '익명 언박서');
  let shareUrl = location.href;
  try {
    const saved = await saveResultAndBuildShare(STATE.lastFinalRun, STATE.incomingRef);
    STATE.lastShareData = saved;
    shareUrl = saved.shareUrl;
    $('res-lb-wrap').innerHTML = renderGlobalLadderHTML(saved, formatLadderMetric);
    $('res-lb-wrap').style.display = 'block';
  } catch {}

  await shareChallengeLink({
    title: '📦 열려라 택배! — 이게뭔겜? 404 아케이드',
    text: `📦 [${STATE.lastFinalRun.nickname}]님의 택배 칼각 슬라이스 기록: ${STATE.score.toLocaleString()}점 (${STATE.openedCount}상자 개봉 · 선물 ${STATE.giftsEarned.length}개 획득)! 이 속도 이길 수 있나요?`,
    url: shareUrl,
  });
});

$('btn-save-img').addEventListener('click', () => {
  if (!STATE.lastFinalRun) return;
  const avgAcc = STATE.accSamples > 0 ? (STATE.accTotal / STATE.accSamples).toFixed(1) : '0.0';
  downloadResultCard({
    gameTitle: '열려라 택배!',
    emoji: '📦',
    rankTitle: STATE.lastFinalRun.rankTitle,
    headline: `${STATE.score.toLocaleString()}점`,
    subline: `${STATE.openedCount}상자 쾌속 개봉 · 선물 ${STATE.giftsEarned.length}개 획득!`,
    stats: [
      { label: '개봉한 택배', value: `${STATE.openedCount}상자`, color: '#fde047' },
      { label: '평균 정확도', value: `${avgAcc}%`, color: '#ffffff' },
      { label: '깜짝 선물', value: `${STATE.giftsEarned.length}개`, color: '#4ade80' },
    ],
    extraCanvas: glCanvas,
  });
});

// 지인 기록(?ref=) 수신 배너 초기화
(async () => {
  syncBgmBtn();
  syncBestBadges();
  setupMenuPreviewScene();

  try {
    const inc = await loadIncomingChallenge(GAME_ID);
    if (inc) {
      STATE.incomingRef = inc;
      const sc = Math.round(Number(inc.score || 0)).toLocaleString();
      const bx = Math.round(Number(inc.actualValue || 0));
      $('rival-banner-text').innerHTML = `🔥 <strong>${inc.nickname}</strong>님의 기록: <strong>${sc}점 (${bx}상자)</strong>에 도전 중!`;
      $('rival-banner').style.display = 'flex';
      $('box-hud').classList.add('with-rival');

      const vsBox = $('start-rival-box');
      vsBox.innerHTML = `<div style="font-size:13px;font-weight:800;color:#fde68a;text-align:center;">🎯 지인 <b>${inc.nickname}</b>님의 <b>${sc}점 (${bx}상자)</b> 기록을 깨 보세요!</div>`;
      vsBox.style.display = 'block';
    }
  } catch {}
})();

requestAnimationFrame(tick);
