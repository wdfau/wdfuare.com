// 悬浮画布：深蓝夜空、流动渐变、悬浮的界面卡片。
import './style.css';
import * as THREE from 'three';
import { ZONES, Rig, setupUI, isCompact, toast } from './ui.js';
import { makeUITexture, makeCaseTexture, makeContactTexture, makeGlowTexture, makeDotTexture, roundedRect } from './textures.js';
import { setupCase } from './case.js';

const V = THREE.Vector3;
const compactAtStart = isCompact();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
} catch {
  // 不支持 3D：直接把案例当普通网页展示。
  document.body.classList.add('no-webgl');
  document.getElementById('loader').classList.add('done');
  const el = document.getElementById('case');
  el.hidden = false;
  el.classList.add('is-open', 'is-ready', 'static');
  throw new Error('WebGL unavailable');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, compactAtStart ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#05071a', 0.0065);
const FOV = 40;
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 1000);
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

let seed = 5;
const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + rand() * (b - a);
const time = { value: 0 };

// ---------- 背景：缓慢流动的三团光 ----------
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(500, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { time },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float time; varying vec3 vDir;
      float blob(vec3 d, vec3 c, float s){ return pow(max(dot(d, normalize(c)), 0.0), s); }
      void main(){
        vec3 d = normalize(vDir); float t = time * 0.05;
        vec3 col = vec3(0.02, 0.028, 0.09);
        col += vec3(0.30, 0.18, 0.80) * blob(d, vec3(sin(t) * 0.8, 0.25 + cos(t * 1.3) * 0.3, -1.0), 5.0) * 0.85;
        col += vec3(0.05, 0.50, 0.72) * blob(d, vec3(cos(t * 0.7) * 0.9 + 0.7, -0.3 + sin(t * 0.9) * 0.3, -1.0), 7.0) * 0.7;
        col += vec3(0.62, 0.12, 0.58) * blob(d, vec3(-1.0 + sin(t * 1.1) * 0.4, -0.15, -0.5 + cos(t) * 0.3), 9.0) * 0.55;
        col += 0.018 * sin(d.y * 14.0 + d.x * 7.0 + time * 0.25);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
));

// ---------- 星点 ----------
{
  const N = compactAtStart ? 1200 : 2600;
  const pos = new Float32Array(N * 3), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos.set([rr(-110, 140), rr(-60, 60), rr(-150, 50)], i * 3); ph[i] = rand() * 100; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
  scene.add(new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { time, pr: { value: renderer.getPixelRatio() } },
    vertexShader: `
      attribute float phase; uniform float time; uniform float pr; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        vA = 0.45 + 0.55 * sin(time * 1.4 + phase);
        gl_PointSize = min(6.0, (1.2 + 2.4 * fract(phase * 7.13)) * pr * (40.0 / -mv.z));
      }`,
    fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.82, 0.86, 1.0, smoothstep(0.5, 0.0, r) * vA * 0.9); }`,
  })));
}

// ---------- 点阵地面，像设计软件的画布网格 ----------
{
  const pts = [];
  const step = compactAtStart ? 3.5 : 2.5;
  for (let x = -100; x <= 140; x += step) for (let z = -150; z <= 40; z += step) pts.push(x, -20, z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#5664b8', size: 0.12, transparent: true, opacity: 0.55, depthWrite: false })));
}

// ---------- 发光的玻璃材质 ----------
const glassMat = (a = '#a78bfa', b = '#7dd3fc') => new THREE.ShaderMaterial({
  uniforms: { time, a: { value: new THREE.Color(a) }, b: { value: new THREE.Color(b) } },
  transparent: true,
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `
    uniform float time; uniform vec3 a; uniform vec3 b; varying vec3 vN; varying vec3 vV;
    void main(){
      float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
      vec3 c = mix(a, b, 0.5 + 0.5 * sin(time * 0.8 + vN.y * 3.0 + vN.x * 2.0));
      gl_FragColor = vec4(c * (0.12 + f * 1.25), 0.55 + f * 0.45);
    }`,
});

// ---------- 卡片 ----------
const glowTex = makeGlowTexture();
const cards = [];
function card(zone, { w, h, tex, at, rotY = 0, rotZ = 0, glow = '#7c8cff', r = 0.28, dim = false, caseId = null, soon = false }) {
  const g = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, h * 2), new THREE.MeshBasicMaterial({ map: glowTex, color: glow, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.z = -0.05; g.add(halo);
  const edge = new THREE.Mesh(roundedRect(w + 0.07, h + 0.07, r + 0.035), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.45 }));
  edge.position.z = -0.01; g.add(edge);
  const face = new THREE.Mesh(roundedRect(w, h, r), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, color: dim ? '#9aa0c0' : '#ffffff' }));
  g.add(face);
  g.position.copy(at); g.rotation.set(0, rotY, rotZ);
  scene.add(g);
  const c = { g, face, halo, edge, zone, w, h, base: at.clone(), rotY, rotZ, phase: rand() * 6, hover: 0, frozen: false, caseId, soon, dim };
  face.userData.card = c;
  cards.push(c);
  return c;
}
const ui = opts => makeUITexture(opts);

// ---------- 区块布局 ----------
const C = {
  home: new V(0, 0, 0),
  work: new V(-20, 8, -34),
  process: new V(4, 16, -64),
  play: new V(26, 4, -80),
  about: new V(44, -8, -46),
  contact: new V(56, 5, -16),
};
const at = (id, x, y, z) => C[id].clone().add(new V(x, y, z));
const extras = Object.fromEntries(ZONES.map(z => [z.id, []])); // 非卡片物件，用来算区块范围

// 01 首页
card('home', { w: 7, h: 4.6, at: at('home', 8, 1.4, -2), rotY: -0.28, glow: '#a78bfa', tex: ui({ variant: 'web', accent: '#a78bfa', accent2: '#7dd3fc', title: '作品集 2026' }) });
card('home', { w: 2.2, h: 4.4, at: at('home', 12.8, -1.8, 1.5), rotY: -0.4, glow: '#7dd3fc', r: 0.32, tex: ui({ w: 300, h: 600, variant: 'mobile', accent: '#7dd3fc', accent2: '#a78bfa', title: 'Hi!' }) });
card('home', { w: 4, h: 2.6, at: at('home', 4.6, -3.8, 2.4), rotY: -0.12, glow: '#f0abfc', tex: ui({ variant: 'chart', accent: '#f0abfc', accent2: '#7dd3fc', title: 'Ease in-out' }) });
card('home', { w: 1.6, h: 1.6, at: at('home', 3.4, 3.8, 1), rotZ: 0.12, glow: '#fde68a', r: 0.18, tex: ui({ w: 256, h: 256, variant: 'note', accent: '#fde68a' }) });
const hero = new THREE.Group();
hero.position.copy(at('home', 11, 5, -6));
hero.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2, 1), glassMat('#a78bfa', '#7dd3fc')));
hero.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.04, 1)), new THREE.LineBasicMaterial({ color: '#c4b5fd', transparent: true, opacity: 0.5 })));
scene.add(hero);
extras.home.push([hero.position, 2.2]);

// 02 作品：Case 01 是真案例，另外两张在整理中
const caseCard = card('work', {
  w: 8, h: 5.25, at: at('work', -1.5, 0.4, 1.2), glow: '#a78bfa', caseId: 'cursor',
  tex: makeCaseTexture({ label: 'CASE 01 · UX 分析', title: 'Cursor 界面\n易用性改进', sub: '入口选择 · 画布对象选择', image: '/cases/cursor/figure-2.png' }),
});
card('work', { w: 4.4, h: 2.9, at: at('work', 6.4, 1.75, -0.8), rotY: -0.16, glow: '#6b7bd6', dim: true, soon: true, tex: makeCaseTexture({ label: 'CASE 02', title: '下一个案例', sub: '正在整理', dim: true }) });
card('work', { w: 4.4, h: 2.9, at: at('work', 6.4, -1.65, -0.8), rotY: -0.16, glow: '#6b7bd6', dim: true, soon: true, tex: makeCaseTexture({ label: 'CASE 03', title: '下一个案例', sub: '正在整理', dim: true }) });

// 03 过程
const noteCols = ['#fde68a', '#fbcfe8', '#a5f3fc', '#c4b5fd', '#bbf7d0'];
for (let i = 0; i < 10; i++) {
  const col = noteCols[i % noteCols.length];
  card('process', { w: 2, h: 2, r: 0.14, at: at('process', -6 + (i % 5) * 2.6 + rr(-0.3, 0.3), (i < 5 ? 1.5 : -1.3) + rr(-0.3, 0.3), rr(-0.4, 0.4)), rotZ: rr(-0.12, 0.12), glow: col, tex: ui({ w: 256, h: 256, variant: 'note', accent: col }) });
}
card('process', { w: 4.4, h: 3, at: at('process', 8.5, 0, 0.6), rotY: -0.2, glow: '#c4b5fd', tex: ui({ variant: 'web', accent: '#c4b5fd', accent2: '#fbcfe8', title: '草图 v3' }) });

// 04 实验
const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.7, 0.5, compactAtStart ? 100 : 160, 20), glassMat('#f0abfc', '#7dd3fc'));
knot.position.copy(at('play', -4, 1.2, 0)); scene.add(knot);
extras.play.push([knot.position, 2.4]);
const rings = [];
for (let i = 0; i < 3; i++) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1.4 + i * 0.6, 0.06, 10, 120), glassMat('#a78bfa', '#7dd3fc'));
  m.position.copy(at('play', 4, 1.2, 0)); rings.push(m); scene.add(m);
}
extras.play.push([rings[0].position, 2.8]);
card('play', { w: 3.6, h: 2.3, at: at('play', -4, -3.4, 1), glow: '#7dd3fc', tex: ui({ variant: 'chart', accent: '#7dd3fc', accent2: '#a78bfa', title: 'Spring' }) });
card('play', { w: 3.6, h: 2.3, at: at('play', 4, -3.4, 1), glow: '#f0abfc', tex: ui({ variant: 'chart', accent: '#f0abfc', accent2: '#fde68a', title: 'Bounce' }) });

// 05 关于
card('about', { w: 3.6, h: 4.6, r: 0.3, at: at('about', -4, 0, 0.5), rotY: 0.12, glow: '#a78bfa', tex: ui({ w: 400, h: 512, variant: 'profile', accent: '#a78bfa', accent2: '#7dd3fc', title: 'June' }) });
card('about', { w: 6.2, h: 4.2, at: at('about', 2.4, 0.2, -0.4), rotY: -0.1, glow: '#7dd3fc', tex: ui({ variant: 'web', accent: '#7dd3fc', accent2: '#a78bfa', title: 'UI/UX · 前端动效' }) });

// 06 联系
const contactCard = card('contact', { w: 8, h: 3.7, at: at('contact', -1, 0.6, 0), rotY: -0.18, glow: '#7dd3fc', tex: makeContactTexture() });
contactCard.href = 'https://github.com/wdfau';
card('contact', { w: 2.4, h: 2.4, r: 0.3, at: at('contact', -3.8, -3.4, 1.2), glow: '#bbf7d0', tex: ui({ w: 256, h: 256, variant: 'note', accent: '#bbf7d0' }) });
card('contact', { w: 2.4, h: 2.4, r: 0.3, at: at('contact', -0.8, -3.6, 1.6), glow: '#fbcfe8', tex: ui({ w: 256, h: 256, variant: 'note', accent: '#fbcfe8' }) });

// ---------- 区块之间的原型连线，带一颗流动的光点 ----------
const dotTex = makeDotTexture();
const flows = [];
for (let i = 0; i < ZONES.length - 1; i++) {
  const a = C[ZONES[i].id].clone().add(new V(0, -4.5, 0));
  const b = C[ZONES[i + 1].id].clone().add(new V(0, -4.5, 0));
  const mid = a.clone().lerp(b, 0.5).add(new V(0, -6, 0));
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)), new THREE.LineDashedMaterial({ color: '#7dd3fc', dashSize: 0.7, gapSize: 0.6, transparent: true, opacity: 0.3 }));
  line.computeLineDistances(); scene.add(line);
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: '#bfefff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  dot.scale.setScalar(1.3);
  scene.add(dot);
  flows.push({ curve, dot, offset: i * 0.17 });
}

// ---------- 每个区块的范围 ----------
const zoneBox = {};
for (const z of ZONES) {
  const box = new THREE.Box3();
  for (const c of cards.filter(c => c.zone === z.id)) {
    box.expandByPoint(c.base.clone().add(new V(-c.w / 2, -c.h / 2, 0)));
    box.expandByPoint(c.base.clone().add(new V(c.w / 2, c.h / 2, 0)));
  }
  for (const [p, r] of extras[z.id]) box.expandByPoint(p.clone().addScalar(r)).expandByPoint(p.clone().addScalar(-r));
  zoneBox[z.id] = box;
}

// ---------- 镜头位置：电脑用手调的构图，手机按屏幕自动框住 ----------
const views = {};
function computeViews() {
  const aspect = innerWidth / innerHeight;
  const compact = isCompact();
  const all = new THREE.Box3();
  for (const z of ZONES) {
    const c = C[z.id];
    const box = zoneBox[z.id];
    all.union(box);
    const anchor = new V(box.getCenter(new V()).x, box.max.y + 1.2, box.getCenter(new V()).z);
    if (!compact) {
      const k = Math.max(1, 1.65 / aspect);
      if (z.id === 'home') views.home = { pos: new V(0, 0.6, 24 * k), target: new V(0, 0, 0), anchor };
      else {
        const d = (z.id === 'work' ? 21 : 19) * k;
        views[z.id] = { pos: c.clone().add(new V(3.5, 0.8, d)), target: c.clone().add(new V(3.5, 0, 0)), anchor };
      }
    } else {
      // 手机：主体放在屏幕上半部，下半部留给文字和导航。
      const size = box.getSize(new V()), ctr = box.getCenter(new V());
      const dW = (size.x / 2 + 0.6) / (TAN * aspect * 0.94);
      const dH = (size.y / 2 + 0.6) / (TAN * 0.46);
      const d = Math.max(dW, dH) + size.z / 2;
      const shift = 0.42 * TAN * d;
      views[z.id] = { pos: new V(ctr.x, ctr.y - shift, ctr.z + d), target: new V(ctr.x, ctr.y - shift, ctr.z), anchor };
    }
  }
  if (!compact) views.overview = { pos: new V(14, 26, 64 * Math.max(1, 1.65 / aspect)), target: new V(14, -4, -38) };
  else {
    const size = all.getSize(new V()), ctr = all.getCenter(new V());
    const d = Math.max((size.x / 2 + 3) / (TAN * aspect), (size.y / 2) / TAN);
    views.overview = { pos: new V(ctr.x, ctr.y + d * 0.25, all.max.z + d), target: ctr.clone() };
  }
}
computeViews();

const rig = new Rig(camera, 1.1);
const caseView = setupCase({ rig, camera, renderer, getCard: id => cards.find(c => c.caseId === id), getUI: () => nav, returnView: () => views.work, TAN });
const nav = setupUI({ rig, views, onAction: a => { if (a.type === 'case') caseView.open(a.id); } });

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  computeViews();
  nav.refresh();
});

// ---------- 鼠标 / 手指：悬停发亮，点击跳转或打开案例 ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2(-9, -9);
const mouse = new THREE.Vector2();
const faces = cards.map(c => c.face);
let hovered = null;
function pick(x, y) {
  ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  return ray.intersectObjects(faces, false)[0]?.object.userData.card ?? null;
}
addEventListener('pointermove', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (e.pointerType === 'mouse') ndc.copy(mouse);
});
renderer.domElement.addEventListener('click', e => {
  if (nav.locked) return;
  const c = pick(e.clientX, e.clientY);
  if (!c) return;
  if (c.caseId) caseView.open(c.caseId);
  else if (c.soon) toast('这个案例还在整理中');
  else if (c.href && nav.current === c.zone) open(c.href, '_blank', 'noopener');
  else if (c.zone !== nav.current) nav.go(c.zone);
});

// ---------- 动画 ----------
const clock = new THREE.Clock();
let frameNo = 0;
let running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); requestAnimationFrame(frame); } });

function frame() {
  if (!running) return;
  const t = clock.getElapsedTime();
  time.value = t;

  if (frameNo++ % 3 === 0 && !rig.flying && !nav.locked) {
    ray.setFromCamera(ndc, camera);
    hovered = ray.intersectObjects(faces, false)[0]?.object.userData.card ?? null;
    const clickable = hovered && (hovered.caseId || hovered.soon || hovered.zone !== nav.current || hovered.href);
    renderer.domElement.style.cursor = clickable ? 'pointer' : '';
  }
  for (const c of cards) {
    if (c.frozen) {
      c.g.position.copy(c.base); c.g.rotation.set(0, c.rotY, c.rotZ); c.g.scale.setScalar(1);
      continue;
    }
    c.hover += ((c === hovered ? 1 : 0) - c.hover) * 0.12;
    c.g.position.set(c.base.x, c.base.y + Math.sin(t * 0.6 + c.phase) * 0.22, c.base.z + c.hover * 0.8);
    c.g.rotation.set(Math.sin(t * 0.4 + c.phase) * 0.03, c.rotY + Math.sin(t * 0.3 + c.phase) * 0.04, c.rotZ);
    c.g.scale.setScalar(1 + c.hover * 0.05);
    c.halo.material.opacity = (c.dim ? 0.2 : 0.4) + c.hover * 0.5;
    c.edge.material.opacity = (c.dim ? 0.25 : 0.4) + c.hover * 0.5;
  }

  hero.rotation.y = t * 0.25 + mouse.x * 0.6;
  hero.rotation.x = Math.sin(t * 0.3) * 0.2 - mouse.y * 0.4;
  hero.position.y = 5 + Math.sin(t * 0.7) * 0.3;
  knot.rotation.set(t * 0.3 + mouse.y * 0.8, t * 0.4 + mouse.x * 0.8, 0);
  rings.forEach((m, i) => { m.rotation.x = t * (0.4 + i * 0.25) + mouse.y; m.rotation.y = t * (0.3 + i * 0.2) + mouse.x * (i + 1) * 0.5; });
  for (const f of flows) f.dot.position.copy(f.curve.getPoint((t * 0.09 + f.offset) % 1));
  // 总览时镜头离得远，雾调薄，远处的卡片不至于看不见。
  const fogTarget = nav.current === 'overview' ? 0.0028 : 0.0065;
  scene.fog.density += (fogTarget - scene.fog.density) * 0.04;

  rig.update();
  nav.updateLabels(camera);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
requestAnimationFrame(() => requestAnimationFrame(() => {
  document.getElementById('loader').classList.add('done');
  // 网址带 #work、#contact 之类时，直接停在那个区块，方便分享。
  const zone = location.hash.slice(1);
  if (zone === 'overview') nav.toggleOverview(true);
  else if (ZONES.some(z => z.id === zone)) nav.go(zone, { instant: true });
  caseView.openFromHash();
}));
