// 案例详情：镜头先正对卡片，再让页面从卡片的位置展开成全屏；关闭时收回卡片里。
import * as THREE from 'three';
import { REDUCED } from './ui.js';

export function setupCase({ rig, camera, getCard, getUI, TAN }) {
  const el = document.getElementById('case');
  const scroller = el.querySelector('.case-scroll');
  const bar = el.querySelector('.case-progress');
  const baseTitle = document.title;
  let openId = null;
  let busy = false;
  let lastFocus = null;

  const wait = ms => new Promise(r => setTimeout(r, REDUCED ? 0 : ms));

  function cardRect(c) {
    c.g.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const xs = [], ys = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = new THREE.Vector3(sx * c.w / 2, sy * c.h / 2, 0).applyMatrix4(c.g.matrixWorld).project(camera);
      xs.push((p.x * 0.5 + 0.5) * innerWidth);
      ys.push((-p.y * 0.5 + 0.5) * innerHeight);
    }
    const clamp = v => Math.max(0, Math.round(v));
    return {
      top: clamp(Math.min(...ys)), left: clamp(Math.min(...xs)),
      right: clamp(innerWidth - Math.max(...xs)), bottom: clamp(innerHeight - Math.max(...ys)),
    };
  }
  const clip = (r, radius) => `inset(${r.top}px ${r.right}px ${r.bottom}px ${r.left}px round ${radius}px)`;

  // 镜头正对卡片，卡片差不多占满屏幕。
  function facing(c) {
    const n = new THREE.Vector3(Math.sin(c.rotY), 0, Math.cos(c.rotY));
    const aspect = innerWidth / innerHeight;
    const d = Math.max((c.h / 2) / TAN, (c.w / 2) / (TAN * aspect)) * 1.12;
    return { pos: c.base.clone().addScaledVector(n, d), target: c.base.clone() };
  }

  async function open(id, { instant = false, push = true } = {}) {
    if (busy || openId) return;
    const c = getCard(id);
    if (!c) return;
    const ui = getUI();
    busy = true; openId = id;
    ui.locked = true; rig.hold = true; c.frozen = true;
    lastFocus = document.activeElement;
    document.body.classList.add('case-mode');

    const f = facing(c);
    if (instant) rig.set(f.pos, f.target);
    else { rig.go(f.pos, f.target, { dur: 1.1, lift: 0.6 }); await wait(1180); }

    const r = cardRect(c);
    el.hidden = false;
    el.style.transition = 'none';
    el.style.clipPath = clip(r, 18);
    scroller.scrollTop = 0;
    void el.offsetHeight;
    el.style.transition = '';
    el.classList.add('is-open');
    el.style.clipPath = 'inset(0px 0px 0px 0px round 0px)';
    await wait(instant ? 0 : 720);
    el.classList.add('is-ready');
    el.querySelector('.case-close').focus({ preventScroll: true });
    if (push && location.hash !== `#case/${id}`) history.pushState({ case: id }, '', `#case/${id}`);
    document.title = `${el.querySelector('h1').textContent} · ${baseTitle}`;
    busy = false;
  }

  async function close({ pop = false } = {}) {
    if (busy || !openId) return;
    busy = true;
    const c = getCard(openId);
    el.classList.remove('is-ready');
    el.style.clipPath = clip(cardRect(c), 18);
    await wait(720);
    el.hidden = true;
    el.classList.remove('is-open');
    c.frozen = false; rig.hold = false;
    document.body.classList.remove('case-mode');
    const ui = getUI();
    ui.locked = false;
    ui.go('work');
    if (!pop && location.hash.startsWith('#case/')) history.pushState(null, '', location.pathname + location.search);
    document.title = baseTitle;
    openId = null; busy = false;
    lastFocus?.focus?.({ preventScroll: true });
  }

  el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => close()));
  addEventListener('keydown', e => { if (e.key === 'Escape' && openId) close(); });
  addEventListener('popstate', () => {
    const m = location.hash.match(/^#case\/([\w-]+)/);
    if (m && !openId) open(m[1], { push: false });
    else if (!m && openId) close({ pop: true });
  });
  scroller.addEventListener('scroll', () => {
    const max = scroller.scrollHeight - scroller.clientHeight;
    bar.style.transform = `scaleX(${max > 0 ? scroller.scrollTop / max : 0})`;
  }, { passive: true });

  return {
    open, close,
    openFromHash() {
      const m = location.hash.match(/^#case\/([\w-]+)/);
      if (m) open(m[1], { instant: true, push: false });
    },
  };
}
