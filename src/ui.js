// 界面层：区块内容、镜头飞行、导航、总览标签、键盘 / 滚轮 / 手势。
import * as THREE from 'three';

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isCompact = () => matchMedia('(max-width: 760px)').matches || innerWidth / innerHeight < 0.9;

export const ZONES = [
  { id: 'home', num: '01', name: '首页', en: 'Home' },
  { id: 'work', num: '02', name: '作品', en: 'Work', desc: '精选案例。点开卡片，能看到完整的问题、分析和改进思路。', action: { label: '打开 Case 01 →', type: 'case', id: 'cursor' } },
  { id: 'process', num: '03', name: '过程', en: 'Process', desc: '从观察、拆解到推敲的过程记录。更多过程稿正在整理。' },
  { id: 'play', num: '04', name: '实验', en: 'Playground', desc: '动效和前端小实验。移动鼠标或手指，旁边的物件会跟着转。这个网站本身也是一次实验。' },
  { id: 'about', num: '05', name: '关于', en: 'About', desc: '我是 June，正在找 UI/UX 设计实习。我做设计，也用代码把交互做出来。' },
  { id: 'contact', num: '06', name: '联系', en: 'Contact', desc: '实习、合作、聊设计，都欢迎。', action: { label: 'GitHub @wdfau ↗', href: 'https://github.com/wdfau' } },
];

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// 镜头：平滑飞到某个位置，飞行中段抬高一点，鼠标带轻微视差。
export class Rig {
  constructor(camera, parallax = 1) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.mouse = new THREE.Vector2();
    this.smooth = new THREE.Vector2();
    this.parallax = REDUCED ? 0 : parallax;
    this.hold = false;
    this.anim = null;
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      this.mouse.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1);
    });
  }
  set(pos, target) { this.anim = null; this.pos.copy(pos); this.target.copy(target); }
  go(pos, target, { dur = 1.8, lift = 4 } = {}) {
    this.anim = {
      p0: this.pos.clone(), t0: this.target.clone(),
      p1: pos.clone(), t1: target.clone(),
      start: performance.now(), dur: REDUCED ? 1 : dur * 1000, lift,
    };
  }
  get flying() { return !!this.anim; }
  update() {
    const a = this.anim;
    if (a) {
      const k = Math.min(1, (performance.now() - a.start) / a.dur);
      const e = easeInOut(k);
      this.pos.lerpVectors(a.p0, a.p1, e);
      this.target.lerpVectors(a.t0, a.t1, e);
      this.pos.y += Math.sin(Math.PI * e) * a.lift;
      if (k >= 1) this.anim = null;
    }
    this.smooth.lerp(this.hold ? new THREE.Vector2() : this.mouse, 0.05);
    const c = this.camera;
    c.position.copy(this.pos);
    c.position.x += this.smooth.x * this.parallax;
    c.position.y -= this.smooth.y * this.parallax * 0.6;
    c.lookAt(this.target);
  }
}

export function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// views: { [zoneId]: { pos, target, anchor }, overview: { pos, target } }，会随窗口变化重新计算。
export function setupUI({ rig, views, onAction }) {
  const nav = document.getElementById('nav');
  const hero = document.getElementById('hero');
  const panel = document.getElementById('panel');
  const labels = document.getElementById('labels');
  const btnOverview = document.getElementById('btn-overview');
  const more = panel.querySelector('.more');

  const state = { current: 'home', overview: false, locked: false };
  const navButtons = {};
  const tags = {};

  for (const z of ZONES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="line"></span><span class="num">${z.num}</span><span class="name">${z.name}<small>${z.en}</small></span>`;
    b.addEventListener('click', () => go(z.id));
    nav.appendChild(b);
    navButtons[z.id] = b;

    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'tag';
    t.innerHTML = `<b>${z.num}</b>${z.name}`;
    t.addEventListener('click', () => go(z.id));
    labels.appendChild(t);
    tags[z.id] = t;
  }

  function render() {
    const { current, overview } = state;
    for (const z of ZONES) {
      navButtons[z.id].classList.toggle('active', !overview && z.id === current);
      navButtons[z.id].setAttribute('aria-current', !overview && z.id === current ? 'true' : 'false');
    }
    document.body.classList.toggle('overview', overview);
    btnOverview.classList.toggle('on', overview);
    btnOverview.setAttribute('aria-pressed', String(overview));
    hero.classList.toggle('is-hidden', overview || current !== 'home');
    const showPanel = !overview && current !== 'home';
    panel.classList.toggle('is-shown', showPanel);
    panel.setAttribute('aria-hidden', String(!showPanel));
    if (showPanel) {
      const z = ZONES.find(z => z.id === current);
      panel.querySelector('.en').textContent = `${z.num} — ${z.en}`;
      panel.querySelector('h2').textContent = z.name;
      panel.querySelector('p').textContent = z.desc;
      more.hidden = !z.action;
      if (z.action) {
        more.textContent = z.action.label;
        if (z.action.href) { more.href = z.action.href; more.target = '_blank'; more.rel = 'noopener'; }
        else { more.removeAttribute('href'); more.removeAttribute('target'); }
      }
    }
  }

  more.addEventListener('click', e => {
    const z = ZONES.find(z => z.id === state.current);
    if (z?.action && !z.action.href) { e.preventDefault(); onAction?.(z.action); }
  });

  function go(id, { instant = false } = {}) {
    if (state.locked) return;
    state.overview = false;
    state.current = id;
    const v = views[id];
    instant ? rig.set(v.pos, v.target) : rig.go(v.pos, v.target);
    render();
  }

  function toggleOverview(force) {
    if (state.locked) return;
    state.overview = force ?? !state.overview;
    if (state.overview) rig.go(views.overview.pos, views.overview.target, { dur: 2, lift: 2 });
    else { const v = views[state.current]; rig.go(v.pos, v.target); }
    render();
  }

  function step(dir) {
    const i = ZONES.findIndex(z => z.id === state.current);
    const n = Math.max(0, Math.min(ZONES.length - 1, i + dir));
    if (n !== i || state.overview) go(ZONES[n].id);
  }

  // 窗口尺寸变了，镜头位置重新算过，原地对齐，不飞。
  function refresh() {
    const v = state.overview ? views.overview : views[state.current];
    if (!rig.flying && !state.locked) rig.set(v.pos, v.target);
  }

  btnOverview.addEventListener('click', () => toggleOverview());
  document.getElementById('hero-cta').addEventListener('click', () => go('work'));

  addEventListener('keydown', e => {
    if (state.locked || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab' && !e.shiftKey && document.activeElement === document.body) { e.preventDefault(); toggleOverview(); }
    else if (e.key === 'Escape' && state.overview) toggleOverview(false);
    else if (/^[1-6]$/.test(e.key)) go(ZONES[+e.key - 1].id);
    else if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
  });

  // 滚轮切区块，带节流，避免一下滚过头。
  let wheelLock = 0;
  addEventListener('wheel', e => {
    if (state.locked) return;
    const now = performance.now();
    if (now < wheelLock || Math.abs(e.deltaY) < 18) return;
    wheelLock = now + 1300;
    step(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  // 手机：上下滑动切区块。
  let touch = null;
  addEventListener('touchstart', e => {
    if (state.locked || e.touches.length !== 1 || e.target.closest('#nav, #panel, .topbar')) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
  }, { passive: true });
  addEventListener('touchend', e => {
    if (!touch) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - touch.x, dy = p.clientY - touch.y;
    if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * 1.3 && performance.now() - touch.t < 800) step(dy < 0 ? 1 : -1);
    touch = null;
  }, { passive: true });

  const tmp = new THREE.Vector3();
  function updateLabels(camera) {
    if (!state.overview) return;
    for (const z of ZONES) {
      tmp.copy(views[z.id].anchor).project(camera);
      const t = tags[z.id];
      if (tmp.z > 1) { t.style.display = 'none'; continue; }
      t.style.display = '';
      const x = (tmp.x * 0.5 + 0.5) * innerWidth;
      const y = (-tmp.y * 0.5 + 0.5) * innerHeight;
      t.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 14px))`;
    }
  }

  rig.set(views.home.pos, views.home.target);
  render();

  return {
    go, toggleOverview, updateLabels, refresh,
    get current() { return state.overview ? 'overview' : state.current; },
    set locked(v) { state.locked = v; document.body.classList.toggle('locked', v); },
    get locked() { return state.locked; },
  };
}
