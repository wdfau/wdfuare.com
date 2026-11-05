// 卡片贴图和几何体。贴图用 2D canvas 画，不需要额外的图片文件。
import * as THREE from 'three';

const FONT_EN = 'Inter, "Segoe UI", system-ui, sans-serif';
const FONT_ZH = '"PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif';

function finish(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// 抽象的界面截图。
export function makeUITexture({ w = 640, h = 420, variant = 'web', accent = '#7c8cff', accent2 = '#22d3ee', title = '' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const ink = 'rgba(232,236,255,0.92)';
  const soft = 'rgba(232,236,255,0.14)';
  const softer = 'rgba(232,236,255,0.07)';
  const rr = (x, y, ww, hh, r) => { g.beginPath(); g.roundRect(x, y, ww, hh, r); };
  const grad = (x0, y0, x1, y1) => { const l = g.createLinearGradient(x0, y0, x1, y1); l.addColorStop(0, accent); l.addColorStop(1, accent2); return l; };
  g.fillStyle = '#0f1430'; g.fillRect(0, 0, w, h);

  if (variant === 'web') {
    g.fillStyle = softer; g.fillRect(0, 0, w, 34);
    ['#ff6b6b', '#ffd93d', '#6bcb77'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(20 + i * 18, 17, 5, 0, 7); g.fill(); });
    g.fillStyle = soft; rr(w * 0.3, 10, w * 0.4, 14, 7); g.fill();
    g.fillStyle = ink; g.font = `700 ${Math.round(h * 0.075)}px ${FONT_EN}, ${FONT_ZH}`;
    g.fillText(title || 'Case Study', 36, 92);
    g.fillStyle = soft; rr(36, 110, w * 0.42, 10, 5); g.fill(); rr(36, 130, w * 0.32, 10, 5); g.fill();
    g.fillStyle = grad(36, 0, 200, 0); rr(36, 160, 110, 32, 16); g.fill();
    g.fillStyle = grad(w * 0.55, 60, w - 30, h * 0.55); rr(w * 0.55, 60, w * 0.4, h * 0.42, 14); g.fill();
    for (let i = 0; i < 3; i++) { g.fillStyle = softer; rr(36 + i * ((w - 72) / 3), h * 0.62, (w - 72) / 3 - 16, h * 0.3, 12); g.fill(); g.fillStyle = soft; rr(52 + i * ((w - 72) / 3), h * 0.62 + 18, 60, 8, 4); g.fill(); }
  } else if (variant === 'mobile') {
    g.fillStyle = soft; rr(w * 0.35, 14, w * 0.3, 10, 5); g.fill();
    g.fillStyle = grad(0, 40, w, h * 0.5); rr(20, 44, w - 40, h * 0.34, 18); g.fill();
    g.fillStyle = ink; g.font = `700 ${Math.round(w * 0.08)}px ${FONT_EN}`;
    g.fillText(title || 'Hello', 24, h * 0.48);
    for (let i = 0; i < 4; i++) { const y = h * 0.53 + i * h * 0.1; g.fillStyle = softer; rr(20, y, w - 40, h * 0.08, 12); g.fill(); g.fillStyle = soft; g.beginPath(); g.arc(44, y + h * 0.04, h * 0.022, 0, 7); g.fill(); rr(66, y + h * 0.03, w * 0.45, 8, 4); g.fill(); }
  } else if (variant === 'note') {
    g.fillStyle = accent; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 5; i++) { rr(28, 40 + i * 34, w * (0.4 + ((i * 37) % 40) / 100), 9, 4); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 4; g.beginPath(); g.moveTo(30, h - 60); g.bezierCurveTo(w * 0.3, h - 120, w * 0.6, h - 10, w - 30, h - 70); g.stroke();
  } else if (variant === 'profile') {
    g.fillStyle = grad(0, 0, w, h); g.beginPath(); g.arc(w / 2, h * 0.3, h * 0.15, 0, 7); g.fill();
    g.fillStyle = ink; g.font = `700 ${Math.round(h * 0.08)}px ${FONT_EN}`; g.textAlign = 'center';
    g.fillText(title || 'June', w / 2, h * 0.58);
    g.fillStyle = soft; rr(w * 0.25, h * 0.64, w * 0.5, 10, 5); g.fill(); rr(w * 0.32, h * 0.7, w * 0.36, 10, 5); g.fill();
    g.fillStyle = grad(0, 0, w, 0); rr(w * 0.3, h * 0.8, w * 0.4, h * 0.09, h * 0.045); g.fill();
  } else if (variant === 'chart') {
    g.fillStyle = ink; g.font = `600 ${Math.round(h * 0.07)}px ${FONT_EN}`; g.fillText(title || 'Motion', 28, 56);
    g.strokeStyle = soft; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(28, 90 + i * (h - 130) / 4); g.lineTo(w - 28, 90 + i * (h - 130) / 4); g.stroke(); }
    g.strokeStyle = grad(0, 0, w, 0); g.lineWidth = 5; g.lineCap = 'round'; g.beginPath();
    const curve = title === 'Spring'
      ? x => 1 - Math.exp(-6 * x) * Math.cos(12 * x)
      : title === 'Bounce'
        ? x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; }
        : x => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
    for (let x = 0; x <= 1.0001; x += 0.01) { const y = 1 - curve(x) * 0.85; const px = 28 + x * (w - 56), py = 90 + y * (h - 130); x === 0 ? g.moveTo(px, py) : g.lineTo(px, py); }
    g.stroke();
  }
  return finish(c);
}

// 案例卡封面：标题 + 截图缩略图。图片加载完再补画上去。
export function makeCaseTexture({ label, title, sub, image, accent = '#a78bfa', accent2 = '#7dd3fc', dim = false }) {
  const w = 1024, h = 672;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const tex = finish(c);
  const draw = img => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#0f1430'; g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(w * 0.85, h * 0.1, 10, w * 0.85, h * 0.1, w * 0.7);
    glow.addColorStop(0, dim ? 'rgba(120,130,200,0.12)' : 'rgba(167,139,250,0.35)'); glow.addColorStop(1, 'rgba(15,20,48,0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(232,236,255,0.5)'; g.font = `600 22px ${FONT_EN}`;
    g.fillText(label.split('').join(String.fromCharCode(8202)), 60, 86);
    g.fillStyle = dim ? 'rgba(232,236,255,0.55)' : '#eef0ff';
    g.font = `700 60px ${FONT_ZH}`;
    title.split('\n').forEach((line, i) => g.fillText(line, 60, 176 + i * 78));
    g.fillStyle = 'rgba(232,236,255,0.6)'; g.font = `400 26px ${FONT_ZH}`; g.fillText(sub, 60, 176 + title.split('\n').length * 78 + 14);
    const l = g.createLinearGradient(60, 0, 300, 0); l.addColorStop(0, accent); l.addColorStop(1, accent2);
    g.fillStyle = dim ? 'rgba(232,236,255,0.1)' : l;
    g.beginPath(); g.roundRect(60, h - 130, dim ? 200 : 210, 62, 31); g.fill();
    g.fillStyle = dim ? 'rgba(232,236,255,0.55)' : '#0b1030'; g.font = `700 24px ${FONT_ZH}`;
    g.fillText(dim ? '整理中 · Soon' : '打开案例 →', 88, h - 90);
    if (img) {
      const bx = w * 0.56, by = 120, bw = w * 0.38, bh = h - 220;
      g.save(); g.beginPath(); g.roundRect(bx, by, bw, bh, 20); g.clip();
      const s = Math.max(bw / img.width, bh / img.height);
      g.drawImage(img, bx + (bw - img.width * s) / 2, by, img.width * s, img.height * s);
      g.restore();
      g.strokeStyle = 'rgba(232,236,255,0.18)'; g.lineWidth = 2; g.beginPath(); g.roundRect(bx, by, bw, bh, 20); g.stroke();
    }
    tex.needsUpdate = true;
  };
  draw(null);
  if (image) { const img = new Image(); img.onload = () => draw(img); img.src = image; }
  return tex;
}

export function makeContactTexture() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 420;
  const g = c.getContext('2d');
  g.fillStyle = '#0f1430'; g.fillRect(0, 0, 900, 420);
  g.fillStyle = 'rgba(238,240,255,0.45)'; g.font = `600 26px ${FONT_EN}`; g.fillText('S A Y   H E L L O', 56, 96);
  const l = g.createLinearGradient(56, 0, 760, 0); l.addColorStop(0, '#a78bfa'); l.addColorStop(0.55, '#7dd3fc'); l.addColorStop(1, '#f0abfc');
  g.fillStyle = l; g.font = `700 76px ${FONT_EN}`; g.fillText('github.com/wdfau', 56, 200);
  g.fillStyle = 'rgba(238,240,255,0.7)'; g.font = `400 30px ${FONT_ZH}`; g.fillText('实习、合作、聊设计，都欢迎。', 56, 268);
  g.fillStyle = 'rgba(125,211,252,0.15)'; g.beginPath(); g.roundRect(56, 312, 230, 60, 30); g.fill();
  g.fillStyle = '#7dd3fc'; g.font = `600 26px ${FONT_ZH}`; g.fillText('去 GitHub ↗', 92, 352);
  return finish(c);
}

export function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.shadowColor = '#ffffff'; g.shadowBlur = 48; g.fillStyle = '#ffffff';
  g.beginPath(); g.roundRect(64, 64, 128, 128, 20); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.shadowBlur = 0;
  g.beginPath(); g.roundRect(70, 70, 116, 116, 16); g.fill();
  return new THREE.CanvasTexture(c);
}

export function makeDotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// 圆角矩形，UV 归一到 0–1。
export function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const geo = new THREE.ShapeGeometry(s, 8);
  const uv = geo.attributes.uv, p = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - x) / w, (p.getY(i) - y) / h);
  return geo;
}
