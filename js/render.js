/* Skyworks Concourse — canvas renderer: clouds, hex tiles, units, highlights, effects, minimap */
'use strict';

function hashHex(q, r) { let h = (q * 374761393 + r * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function hexPath(g, cx, cy, size, inset = 0) {
  const pts = Hex.corners(cx, cy, size, inset);
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 6; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, gg = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); gg = Math.max(0, Math.min(255, gg)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (gg << 8) | b).toString(16).padStart(6, '0');
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ---------- unit sprites (shared by the board, the turn bar and the minimap) ---------- */
function drawUnitSprite(g, u, x, y, s, time, opts = {}) {
  const def = UNIT_TYPES[u.type];
  const bob = Math.sin(time / 420 + (u.id || 0)) * 1.5 * s;
  g.save();
  g.translate(x, y);
  if (!opts.noShadow) {
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(0, 6 * s, 12 * s, 5 * s, 0, 0, Math.PI * 2); g.fill();
  }
  switch (u.type) {
    case 'courier': {
      // Legs, coat, pack, head and cap
      g.fillStyle = '#1f2a36'; g.fillRect(-5 * s, -2 * s, 4 * s, 9 * s); g.fillRect(1 * s, -2 * s, 4 * s, 9 * s);
      g.fillStyle = '#2f6f5e'; g.fillRect(-7 * s, -16 * s, 14 * s, 15 * s);
      g.fillStyle = '#39ffb8'; g.fillRect(-1 * s, -16 * s, 2 * s, 15 * s);
      g.fillStyle = '#5a4225'; g.fillRect(-11 * s, -15 * s, 5 * s, 12 * s);
      g.fillStyle = rgba('#39ffb8', 0.8 + 0.2 * Math.sin(time / 200)); g.fillRect(-10 * s, -13 * s, 3 * s, 2 * s);
      g.fillStyle = '#e8c39e'; g.beginPath(); g.arc(0, -21 * s, 5 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1f2a36'; g.fillRect(-6 * s, -26 * s, 12 * s, 4 * s); g.fillRect(-7 * s, -23 * s, 14 * s, 1.5 * s);
      g.fillStyle = '#9fe3ff'; g.fillRect(-4 * s, -22 * s, 8 * s, 2 * s);
      break;
    }
    case 'drone': {
      const spin = time / 120;
      g.translate(0, bob - 10 * s);
      g.strokeStyle = 'rgba(200,220,235,.35)'; g.lineWidth = 1.2 * s;
      g.beginPath(); g.ellipse(0, -6 * s, 14 * s, 4 * s, 0, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 3; i++) { const a = spin + i * Math.PI * 2 / 3; g.beginPath(); g.moveTo(0, -6 * s); g.lineTo(Math.cos(a) * 14 * s, -6 * s + Math.sin(a) * 4 * s); g.stroke(); }
      g.fillStyle = '#3a4656'; g.beginPath(); g.ellipse(0, 0, 10 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#56657a'; g.beginPath(); g.ellipse(0, -2 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = u.state === 'flee' ? '#ffd45e' : '#ff6b6b'; g.beginPath(); g.arc(0, 1 * s, 3 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = rgba(u.state === 'flee' ? '#ffd45e' : '#ff6b6b', 0.35); g.beginPath(); g.arc(0, 1 * s, 5 * s, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'scuttler': {
      const ph = time / 90;
      g.strokeStyle = '#7a4a1e'; g.lineWidth = 1.6 * s;
      for (let i = -1; i <= 1; i++) for (const side of [-1, 1]) {
        const k = Math.sin(ph + i * 1.3 + (side > 0 ? 1 : 0)) * 3 * s;
        g.beginPath(); g.moveTo(side * 5 * s, -2 * s + i * 4 * s); g.lineTo(side * 12 * s, -4 * s + i * 4 * s + k); g.lineTo(side * 14 * s, 3 * s + i * 4 * s); g.stroke();
      }
      g.fillStyle = '#b35e24'; g.beginPath(); g.ellipse(0, -3 * s, 9 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffb36b'; g.beginPath(); g.ellipse(0, -5 * s, 6 * s, 3.5 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(-3 * s, -8 * s, 1.4 * s, 0, Math.PI * 2); g.arc(3 * s, -8 * s, 1.4 * s, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'turret': {
      g.fillStyle = '#4a4036';
      for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; g.beginPath(); g.moveTo(0, -6 * s); g.lineTo(Math.cos(a) * 12 * s, Math.sin(a) * 6 * s + 4 * s); g.lineTo(Math.cos(a) * 12 * s + 3 * s, Math.sin(a) * 6 * s + 4 * s); g.closePath(); g.fill(); }
      g.fillStyle = '#6b5a3a'; g.beginPath(); g.arc(0, -8 * s, 7 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d7a74a'; g.beginPath(); g.arc(0, -8 * s, 4 * s, 0, Math.PI * 2); g.fill();
      const aim = u.aim == null ? -Math.PI / 2 : u.aim;
      g.strokeStyle = '#8a7a5a'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(0, -8 * s); g.lineTo(Math.cos(aim) * 14 * s, -8 * s + Math.sin(aim) * 14 * s * 0.6); g.stroke();
      g.fillStyle = rgba('#ff6b6b', 0.6 + 0.4 * Math.sin(time / 300)); g.beginPath(); g.arc(0, -8 * s, 1.6 * s, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'skimmer': {
      g.translate(0, bob * 1.5 - 12 * s);
      g.fillStyle = '#2d4a66'; g.beginPath(); g.moveTo(-14 * s, 0); g.lineTo(0, -6 * s); g.lineTo(14 * s, 0); g.lineTo(0, 4 * s); g.closePath(); g.fill();
      g.fillStyle = '#8ad0ff'; g.beginPath(); g.moveTo(-6 * s, -1 * s); g.lineTo(0, -4 * s); g.lineTo(6 * s, -1 * s); g.lineTo(0, 1 * s); g.closePath(); g.fill();
      g.fillStyle = rgba('#8ad0ff', 0.5); g.fillRect(-16 * s, -1 * s, 4 * s, 1.5 * s); g.fillRect(12 * s, -1 * s, 4 * s, 1.5 * s);
      g.fillStyle = rgba('#8ad0ff', 0.25 + 0.2 * Math.sin(time / 150)); g.beginPath(); g.ellipse(0, 8 * s, 8 * s, 2 * s, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'warden': {
      const glow = 0.5 + 0.5 * Math.sin(time / 350);
      g.fillStyle = '#2a2240'; g.fillRect(-9 * s, -4 * s, 7 * s, 12 * s); g.fillRect(2 * s, -4 * s, 7 * s, 12 * s);
      g.fillStyle = '#3d3360'; g.beginPath(); g.moveTo(-16 * s, -8 * s); g.lineTo(-12 * s, -30 * s); g.lineTo(12 * s, -30 * s); g.lineTo(16 * s, -8 * s); g.closePath(); g.fill();
      g.fillStyle = '#5a4c88'; g.fillRect(-20 * s, -30 * s, 9 * s, 8 * s); g.fillRect(11 * s, -30 * s, 9 * s, 8 * s);
      g.fillStyle = rgba('#c678ff', 0.5 + glow * 0.5); g.fillRect(-3 * s, -26 * s, 6 * s, 14 * s);
      g.fillStyle = '#1b1530'; g.fillRect(-8 * s, -38 * s, 16 * s, 9 * s);
      g.fillStyle = rgba('#ff6b6b', 0.7 + glow * 0.3); g.fillRect(-6 * s, -35 * s, 12 * s, 2 * s);
      break;
    }
  }
  g.restore();
}

function makeRenderer(canvas, mini, game) {
  const g = canvas.getContext('2d');
  const mg = mini.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const view = { size: 36, ox: 0, oy: 0 };
  let cloudLayers = null, cloudPal = null;
  const tileCache = new Map();

  function makeCloudLayer(seed, w, h, puffs, tint, alpha, stretch) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cg = c.getContext('2d');
    let sd = seed;
    const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
    for (let i = 0; i < puffs; i++) {
      const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 90;
      const grad = cg.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, rgba(tint, alpha)); grad.addColorStop(1, rgba(tint, 0));
      cg.fillStyle = grad; cg.save(); cg.scale(stretch, 1); cg.beginPath(); cg.arc(x / stretch, y, r, 0, Math.PI * 2); cg.fill(); cg.restore();
    }
    return c;
  }
  function ensureClouds(pal) {
    if (cloudPal === pal.sky) return;
    cloudPal = pal.sky;
    cloudLayers = [
      { c: makeCloudLayer(11, 1600, 760, 70, shade(pal.sky, -30), 0.5, 2.2), speed: 0.004 },
      { c: makeCloudLayer(23, 1600, 760, 50, pal.sky, 0.55, 2.6), speed: 0.009 },
      { c: makeCloudLayer(37, 1600, 760, 28, shade(pal.sky, 40), 0.5, 3.0), speed: 0.016 }
    ];
  }

  function fit() {
    const map = game.map; if (!map) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of map.tiles.values()) {
      if (t.def.id === 'sky') continue;
      const p = Hex.toPixel(t, 1);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const areaX0 = 30, areaX1 = 960, areaY0 = 110, areaY1 = 620;
    const spanX = (maxX - minX) + Hex.SQRT3, spanY = (maxY - minY) + 2.2;
    view.size = Math.min(38, (areaX1 - areaX0) / spanX, (areaY1 - areaY0) / spanY);
    view.ox = (areaX0 + areaX1) / 2 - ((minX + maxX) / 2) * view.size;
    view.oy = (areaY0 + areaY1) / 2 - ((minY + maxY) / 2) * view.size;
  }
  function hexToScreen(h) { const p = Hex.toPixel(h, view.size); return { x: p.x + view.ox, y: p.y + view.oy }; }
  function hexAt(sx, sy) { return Hex.fromPixel(sx - view.ox, sy - view.oy, view.size); }
  function unitPos(u, now) {
    if (u.anim) {
      const t = Math.min(1, (now - u.anim.t0) / u.anim.dur);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = u.anim.from.x + (u.anim.to.x - u.anim.from.x) * e, y = u.anim.from.y + (u.anim.to.y - u.anim.from.y) * e;
      const hop = u.type === 'courier' || u.type === 'scuttler' || u.type === 'warden' ? -Math.sin(t * Math.PI) * 5 : 0;
      if (t >= 1) u.anim = null;
      return { x, y: y + hop };
    }
    return hexToScreen(u);
  }

  /* ---------- tile sprites ---------- */
  function tileSprite(t, pal) {
    const variant = (hashHex(t.q, t.r) * 4) | 0;
    const k = pal.deck + '|' + t.def.id + '|' + variant + '|' + (t.lift || '') + '|' + Math.round(view.size * 10);
    if (tileCache.has(k)) return tileCache.get(k);
    const s = view.size, pad = 4, c = document.createElement('canvas');
    c.width = Math.ceil(Hex.SQRT3 * s + pad * 2); c.height = Math.ceil(2 * s + pad * 2 + 10);
    const cg = c.getContext('2d'), cx = c.width / 2, cy = s + pad;
    const id = t.def.id;
    // Platform underside (thickness) so the deck reads as a slab over the sky
    cg.fillStyle = shade(pal.deckLine, -8); hexPath(cg, cx, cy + 9, s); cg.fill();
    cg.fillStyle = shade(pal.deckLine, -2); hexPath(cg, cx, cy + 5, s); cg.fill();
    const base = id === 'catwalk' ? shade(pal.catwalk, -30) : pal.deck;
    cg.fillStyle = base; hexPath(cg, cx, cy, s); cg.fill();
    cg.save(); hexPath(cg, cx, cy, s); cg.clip();
    if (id === 'deck' || id === 'cover' || id === 'vent' || id === 'lift' || id === 'marker') {
      // Panel seams and rivets
      cg.strokeStyle = rgba(pal.deckLine, 0.9); cg.lineWidth = 1;
      if (variant === 0) { cg.beginPath(); cg.moveTo(cx - s, cy); cg.lineTo(cx + s, cy); cg.stroke(); }
      if (variant === 1) { cg.beginPath(); cg.moveTo(cx, cy - s); cg.lineTo(cx, cy + s); cg.stroke(); }
      if (variant === 2) { cg.beginPath(); cg.moveTo(cx - s * 0.6, cy - s); cg.lineTo(cx + s * 0.2, cy + s); cg.stroke(); }
      cg.fillStyle = rgba('#ffffff', 0.08);
      for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); cg.beginPath(); cg.arc(cx + Math.cos(a) * s * 0.72, cy + Math.sin(a) * s * 0.72, 1.3, 0, Math.PI * 2); cg.fill(); }
      // subtle grain
      for (let i = 0; i < 14; i++) { const gx = cx + (hashHex(t.q + i, t.r * 3 + i) - 0.5) * s * 1.6, gy = cy + (hashHex(t.r + i * 7, t.q) - 0.5) * s * 1.6; cg.fillStyle = rgba('#ffffff', 0.03 + 0.03 * hashHex(i, t.q)); cg.fillRect(gx, gy, 3, 1); }
    }
    if (id === 'catwalk') {
      cg.strokeStyle = rgba(pal.catwalk, 0.9); cg.lineWidth = 1.5;
      for (let y = -s; y <= s; y += 5) { cg.beginPath(); cg.moveTo(cx - s, cy + y); cg.lineTo(cx + s, cy + y); cg.stroke(); }
      cg.strokeStyle = rgba('#000', 0.35); for (let x = -s; x <= s; x += 9) { cg.beginPath(); cg.moveTo(cx + x, cy - s); cg.lineTo(cx + x, cy + s); cg.stroke(); }
      cg.strokeStyle = shade(pal.catwalk, 30); cg.lineWidth = 2.5; hexPath(cg, cx, cy, s, 2); cg.stroke();
    }
    if (id === 'vent') {
      cg.fillStyle = '#1a1512'; cg.beginPath(); cg.arc(cx, cy, s * 0.55, 0, Math.PI * 2); cg.fill();
      cg.strokeStyle = '#4a3a2a'; cg.lineWidth = 2;
      for (let r = s * 0.15; r < s * 0.55; r += s * 0.13) { cg.beginPath(); cg.arc(cx, cy, r, 0, Math.PI * 2); cg.stroke(); }
      cg.strokeStyle = '#2a2018'; cg.lineWidth = 3; cg.beginPath(); cg.moveTo(cx - s * 0.55, cy); cg.lineTo(cx + s * 0.55, cy); cg.moveTo(cx, cy - s * 0.55); cg.lineTo(cx, cy + s * 0.55); cg.stroke();
      cg.strokeStyle = '#ffb36b'; cg.lineWidth = 1; cg.setLineDash([4, 4]); cg.beginPath(); cg.arc(cx, cy, s * 0.66, 0, Math.PI * 2); cg.stroke(); cg.setLineDash([]);
    }
    if (id === 'lift') {
      const col = ['#39ffb8', '#ff7bd5', '#ffd45e'][(t.lift || 1) - 1] || '#39ffb8';
      cg.fillStyle = shade(pal.deck, -12); cg.beginPath(); cg.arc(cx, cy, s * 0.62, 0, Math.PI * 2); cg.fill();
      cg.strokeStyle = rgba(col, 0.9); cg.lineWidth = 2;
      for (let r = s * 0.2; r < s * 0.62; r += s * 0.14) { cg.beginPath(); cg.arc(cx, cy, r, 0, Math.PI * 2); cg.stroke(); }
      cg.fillStyle = col; cg.font = `bold ${Math.round(s * 0.5)}px system-ui,sans-serif`; cg.textAlign = 'center'; cg.textBaseline = 'middle';
      cg.fillStyle = '#0b1016'; cg.beginPath(); cg.arc(cx, cy, s * 0.22, 0, Math.PI * 2); cg.fill();
      cg.fillStyle = col; cg.fillText(String(t.lift), cx, cy + 1);
    }
    cg.restore();
    // Edge highlight
    cg.strokeStyle = id === 'catwalk' ? rgba('#000', 0.5) : rgba(shade(pal.deck, 40), 0.55); cg.lineWidth = 1; hexPath(cg, cx, cy, s, 0.5); cg.stroke();
    const sprite = { c, dx: cx, dy: cy };
    tileCache.set(k, sprite);
    return sprite;
  }

  function drawCover(t, pal, p) {
    const s = view.size, lift = s * 0.5;
    const col = shade(pal.deck, 24), dark = shade(pal.deck, -16), top = shade(pal.catwalk, 10);
    // Side walls between the floor hex and the raised top hex
    const lo = Hex.corners(p.x, p.y, s, 6), hi = Hex.corners(p.x, p.y - lift, s, 6);
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      if (hi[i][1] < lo[i][1] && (i === 0 || i === 1 || i === 2 || i === 5)) {
        g.fillStyle = i <= 1 ? dark : col;
        g.beginPath(); g.moveTo(lo[i][0], lo[i][1]); g.lineTo(lo[j][0], lo[j][1]); g.lineTo(hi[j][0], hi[j][1]); g.lineTo(hi[i][0], hi[i][1]); g.closePath(); g.fill();
      }
    }
    g.fillStyle = shade(pal.deck, 36); hexPath(g, p.x, p.y - lift, s, 6); g.fill();
    g.strokeStyle = rgba(top, 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(p.x - s * 0.5, p.y - lift); g.lineTo(p.x + s * 0.5, p.y - lift); g.moveTo(p.x, p.y - lift - s * 0.5); g.lineTo(p.x, p.y - lift + s * 0.5); g.stroke();
    g.strokeStyle = rgba('#000', 0.45); g.lineWidth = 1; hexPath(g, p.x, p.y - lift, s, 6); g.stroke();
  }

  function drawMarker(t, pal, p, now) {
    const s = view.size, m = game.map.markers[t.marker], pulse = 0.5 + 0.5 * Math.sin(now / 400);
    const done = m && m.done;
    const col = done ? '#39ffb8' : '#ffd45e';
    g.strokeStyle = rgba(col, 0.5 + 0.5 * pulse); g.lineWidth = 2; hexPath(g, p.x, p.y, s, 4); g.stroke();
    g.fillStyle = rgba(col, 0.08 + 0.08 * pulse); hexPath(g, p.x, p.y, s, 4); g.fill();
    if (m.kind === 'beacon') {
      const lit = game.beaconLit;
      const hgt = s * 2.6;
      g.strokeStyle = lit ? '#ffe9a8' : '#8a7a5a'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(p.x - s * 0.35, p.y); g.lineTo(p.x - s * 0.12, p.y - hgt); g.moveTo(p.x + s * 0.35, p.y); g.lineTo(p.x + s * 0.12, p.y - hgt); g.stroke();
      g.lineWidth = 1; for (let i = 1; i <= 5; i++) { const yy = p.y - hgt * i / 5.5, w = s * (0.35 - 0.23 * i / 5.5); g.beginPath(); g.moveTo(p.x - w, yy); g.lineTo(p.x + w, yy); g.stroke(); }
      const gl = lit ? 1 : 0.25 + 0.15 * pulse;
      const grad = g.createRadialGradient(p.x, p.y - hgt - 4, 0, p.x, p.y - hgt - 4, lit ? s * 2.4 : s * 0.5);
      grad.addColorStop(0, rgba(lit ? '#fff4c8' : '#c678ff', gl)); grad.addColorStop(1, rgba(lit ? '#ffd45e' : '#c678ff', 0));
      g.fillStyle = grad; g.beginPath(); g.arc(p.x, p.y - hgt - 4, lit ? s * 2.4 : s * 0.5, 0, Math.PI * 2); g.fill();
    } else if (m.kind === 'console') {
      g.fillStyle = '#1b2733'; g.fillRect(p.x - s * 0.28, p.y - s * 0.9, s * 0.56, s * 0.55);
      g.fillStyle = rgba(col, 0.9); g.fillRect(p.x - s * 0.2, p.y - s * 0.82, s * 0.4, s * 0.3);
      g.fillStyle = '#243240'; g.fillRect(p.x - s * 0.1, p.y - s * 0.36, s * 0.2, s * 0.3);
    } else if (m.kind === 'exit') {
      g.fillStyle = rgba(col, 0.9); g.beginPath(); g.moveTo(p.x, p.y - s * 0.9); g.lineTo(p.x + s * 0.3, p.y - s * 0.5); g.lineTo(p.x + s * 0.12, p.y - s * 0.5); g.lineTo(p.x + s * 0.12, p.y - s * 0.1); g.lineTo(p.x - s * 0.12, p.y - s * 0.1); g.lineTo(p.x - s * 0.12, p.y - s * 0.5); g.lineTo(p.x - s * 0.3, p.y - s * 0.5); g.closePath(); g.fill();
    } else if (m.kind === 'npc') {
      g.fillStyle = '#6b4a8a'; g.fillRect(p.x - s * 0.18, p.y - s * 0.75, s * 0.36, s * 0.55);
      g.fillStyle = '#e8c39e'; g.beginPath(); g.arc(p.x, p.y - s * 0.9, s * 0.15, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = rgba('#000', 0.6); g.font = `${Math.max(9, Math.round(s * 0.3))}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
    const label = m.label; const tw = g.measureText(label).width;
    g.fillRect(p.x - tw / 2 - 4, p.y + s * 0.42, tw + 8, s * 0.38);
    g.fillStyle = col; g.fillText(label, p.x, p.y + s * 0.46);
  }

  function drawPickup(pk, p, now) {
    const s = view.size, bob = Math.sin(now / 300 + pk.hex.q) * 2;
    if (pk.kind === 'shard') {
      g.fillStyle = rgba('#39ffb8', 0.25); g.beginPath(); g.ellipse(p.x, p.y + 4, 7, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#39ffb8'; g.beginPath(); g.moveTo(p.x, p.y - 12 + bob); g.lineTo(p.x + 5, p.y - 4 + bob); g.lineTo(p.x, p.y + 2 + bob); g.lineTo(p.x - 5, p.y - 4 + bob); g.closePath(); g.fill();
      g.fillStyle = '#bffde8'; g.beginPath(); g.moveTo(p.x, p.y - 12 + bob); g.lineTo(p.x + 5, p.y - 4 + bob); g.lineTo(p.x, p.y - 4 + bob); g.closePath(); g.fill();
    } else {
      g.fillStyle = '#5a4225'; g.fillRect(p.x - 8, p.y - 10 + bob, 16, 12);
      g.fillStyle = '#d7a74a'; g.fillRect(p.x - 8, p.y - 5 + bob, 16, 2); g.fillRect(p.x - 1, p.y - 10 + bob, 2, 12);
      g.fillStyle = rgba('#ffd45e', 0.7 + 0.3 * Math.sin(now / 200)); g.fillRect(p.x - 3, p.y - 8 + bob, 6, 2);
      g.fillStyle = rgba('#000', 0.6); g.font = `${Math.max(9, Math.round(s * 0.28))}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
      const tw = g.measureText(pk.item.name).width; g.fillRect(p.x - tw / 2 - 3, p.y + 6, tw + 6, s * 0.36); g.fillStyle = '#ffd45e'; g.fillText(pk.item.name, p.x, p.y + 8);
    }
  }

  function drawSteam(t, p, now) {
    const s = view.size;
    const glow = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 0.8);
    glow.addColorStop(0, rgba('#ff9a3c', 0.35)); glow.addColorStop(1, rgba('#ff9a3c', 0));
    g.fillStyle = glow; g.beginPath(); g.arc(p.x, p.y, s * 0.8, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 5; i++) {
      const ph = ((now / 900) + i / 5 + hashHex(t.q, t.r + i)) % 1;
      const x = p.x + Math.sin(ph * 6 + i) * s * 0.25, y = p.y - ph * s * 1.6, r = s * (0.15 + ph * 0.3);
      g.fillStyle = rgba('#dfe9ef', 0.35 * (1 - ph)); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }

  function drawHighlights(now) {
    const s = view.size, st = game.sel;
    if (!st) return;
    if (st.mode === 'move' && st.reach) {
      for (const d of st.reach.values()) {
        if (d.cost === 0) continue;
        const p = hexToScreen(d.hex);
        const t = game.map.tiles.get(Hex.key(d.hex.q, d.hex.r));
        const hazard = t && t.def.hazard && game.ventsActive;
        g.fillStyle = hazard ? 'rgba(255,154,60,.22)' : 'rgba(57,255,184,.16)'; hexPath(g, p.x, p.y, s, 2); g.fill();
        g.strokeStyle = hazard ? 'rgba(255,154,60,.5)' : 'rgba(57,255,184,.35)'; g.lineWidth = 1; g.stroke();
      }
    }
    if ((st.mode === 'strike' || st.mode === 'bolt') && st.rangeHexes) {
      for (const h of st.rangeHexes) {
        const p = hexToScreen(h);
        g.fillStyle = 'rgba(255,107,107,.14)'; hexPath(g, p.x, p.y, s, 2); g.fill();
        g.strokeStyle = 'rgba(255,107,107,.35)'; g.lineWidth = 1; g.stroke();
      }
      for (const u of st.targets || []) {
        const p = hexToScreen(u), pulse = 0.5 + 0.5 * Math.sin(now / 200);
        g.strokeStyle = rgba('#ff6b6b', 0.6 + 0.4 * pulse); g.lineWidth = 2.5; hexPath(g, p.x, p.y, s, 3); g.stroke();
      }
    }
    if (st.path && st.path.length > 1) {
      g.strokeStyle = 'rgba(223,245,236,.9)'; g.lineWidth = 3; g.setLineDash([6, 5]); g.lineDashOffset = -now / 40;
      g.beginPath();
      st.path.forEach((h, i) => { const p = hexToScreen(h); if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y); });
      g.stroke(); g.setLineDash([]);
      const last = hexToScreen(st.path[st.path.length - 1]);
      g.fillStyle = '#dff5ec'; g.beginPath(); g.arc(last.x, last.y, 4, 0, Math.PI * 2); g.fill();
    }
    if (game.hoverHex) {
      const t = game.map.tiles.get(Hex.key(game.hoverHex.q, game.hoverHex.r));
      if (t && t.def.id !== 'sky') {
        const p = hexToScreen(game.hoverHex);
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; hexPath(g, p.x, p.y, s, 1.5); g.stroke();
      }
    }
  }

  function drawEffects(now) {
    const s = view.size;
    game.effects = game.effects.filter(e => now - e.t0 < e.life);
    for (const e of game.effects) {
      const t = (now - e.t0) / e.life;
      if (e.type === 'text') {
        g.font = `bold ${e.size || 16}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = rgba('#000', 0.7 * (1 - t)); g.fillText(e.text, e.x + 1, e.y - t * 30 + 1);
        g.fillStyle = rgba(e.colour || '#ffffff', 1 - t); g.fillText(e.text, e.x, e.y - t * 30);
      } else if (e.type === 'bolt') {
        g.strokeStyle = rgba(e.colour || '#39ffb8', 1 - t); g.lineWidth = 4 * (1 - t) + 1; g.beginPath(); g.moveTo(e.from.x, e.from.y); g.lineTo(e.to.x, e.to.y); g.stroke();
        g.strokeStyle = rgba('#ffffff', 0.8 * (1 - t)); g.lineWidth = 1; g.stroke();
      } else if (e.type === 'flash') {
        const p = hexToScreen(e.hex); g.fillStyle = rgba(e.colour || '#ffffff', 0.5 * (1 - t)); hexPath(g, p.x, p.y, s, 1); g.fill();
      } else if (e.type === 'ring') {
        const p = hexToScreen(e.hex); g.strokeStyle = rgba(e.colour || '#39ffb8', 1 - t); g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, s * (0.3 + t * 1.2), 0, Math.PI * 2); g.stroke();
      } else if (e.type === 'slash') {
        g.strokeStyle = rgba('#dff5ec', 1 - t); g.lineWidth = 3; g.beginPath(); g.arc(e.x, e.y - 10, 16, -Math.PI * 0.8 + t * 2, -Math.PI * 0.2 + t * 2); g.stroke();
      }
    }
  }

  function draw(now) {
    const map = game.map;
    g.clearRect(0, 0, W, H);
    const pal = map ? map.def.palette : { deck: '#2b3a4a', deckLine: '#1b2733', catwalk: '#8a6a2e', glow: '#39ffb8', sky: '#4a5a6e' };
    // Sky and cloud sea
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, shade(pal.sky, -50)); grad.addColorStop(0.6, shade(pal.sky, -25)); grad.addColorStop(1, shade(pal.sky, 10));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    ensureClouds(pal);
    for (const L of cloudLayers) {
      const off = (now * L.speed) % L.c.width;
      g.drawImage(L.c, -off, 0); g.drawImage(L.c, L.c.width - off, 0);
    }
    if (game.beaconLit) { g.fillStyle = rgba('#ffd45e', Math.min(0.35, (now - game.beaconLit) / 6000)); g.fillRect(0, 0, W, H); }
    if (!map) return;

    const s = view.size;
    const rows = [...map.tiles.values()].filter(t => t.def.id !== 'sky').sort((a, b) => a.r - b.r || a.q - b.q);
    // Tiles
    for (const t of rows) {
      const p = hexToScreen(t), sp = tileSprite(t, pal);
      g.drawImage(sp.c, p.x - sp.dx, p.y - sp.dy);
    }
    drawHighlights(now);
    // Active unit ring
    const active = game.activeUnit && game.activeUnit();
    if (active && active.alive) { const p = hexToScreen(active); g.strokeStyle = rgba(active.isPlayer ? '#39ffb8' : '#ff6b6b', 0.8); g.lineWidth = 2; hexPath(g, p.x, p.y, s, 4); g.stroke(); }
    // Steam and markers and pickups, then covers and units sorted by row so that tall things overlap correctly
    for (const t of rows) {
      const p = hexToScreen(t);
      if (t.def.hazard && game.ventsActive) drawSteam(t, p, now);
      if (t.marker) drawMarker(t, pal, p, now);
    }
    for (const pk of map.pickups) drawPickup(pk, hexToScreen(pk.hex), now);
    const drawables = [];
    for (const t of rows) if (t.def.cover) drawables.push({ y: hexToScreen(t).y, fn: () => drawCover(t, pal, hexToScreen(t)) });
    for (const u of game.units) if (u.alive) {
      const p = unitPos(u, now);
      drawables.push({ y: p.y, fn: () => {
        if (u.acted && u.isPlayer === false && game.phase === 'enemy') { /* keep normal */ }
        drawUnitSprite(g, u, p.x, p.y, 1, now);
        // HP bar
        const w = 28, h = 4, x = p.x - w / 2, y = p.y - (u.type === 'warden' ? 46 : u.type === 'courier' ? 34 : 26);
        g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
        g.fillStyle = u.isPlayer ? '#39ffb8' : (u.hp <= Math.ceil(u.maxHp / 3) ? '#ffd45e' : '#ff6b6b'); g.fillRect(x, y, w * u.hp / u.maxHp, h);
        if (u.state && !u.isPlayer && u.state !== 'patrol') {
          g.font = 'bold 9px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
          g.fillStyle = u.state === 'flee' ? '#ffd45e' : '#ff8a8a'; g.fillText(u.state === 'flee' ? 'fleeing' : u.state === 'charge' ? 'charging' : 'alert', p.x, y - 2);
        }
      } });
    }
    drawables.sort((a, b) => a.y - b.y).forEach(d => d.fn());
    drawEffects(now);
  }

  function drawMinimap() {
    const map = game.map; mg.clearRect(0, 0, mini.width, mini.height);
    if (!map) return;
    mg.fillStyle = 'rgba(8,12,18,.9)'; mg.fillRect(0, 0, mini.width, mini.height);
    const sz = 11, pal = map.def.palette;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const t of map.tiles.values()) if (t.def.id !== 'sky') { const p = Hex.toPixel(t, sz); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const ox = mini.width / 2 - (minX + maxX) / 2, oy = mini.height / 2 - (minY + maxY) / 2;
    const at = h => { const p = Hex.toPixel(h, sz); return { x: p.x + ox, y: p.y + oy }; };
    for (const t of map.tiles.values()) {
      if (t.def.id === 'sky') continue;
      const p = at(t);
      mg.fillStyle = t.def.id === 'catwalk' ? pal.catwalk : t.def.cover ? shade(pal.deck, 50) : t.def.hazard ? '#8a4a1e' : t.def.lift ? '#1a6a5a' : shade(pal.deck, 10);
      hexPath(mg, p.x, p.y, sz - 0.5); mg.fill();
      if (t.marker) { mg.strokeStyle = map.markers[t.marker].done ? '#39ffb8' : '#ffd45e'; mg.lineWidth = 2; hexPath(mg, p.x, p.y, sz - 2); mg.stroke(); }
    }
    for (const pk of map.pickups) { const p = at(pk.hex); mg.fillStyle = pk.kind === 'shard' ? '#39ffb8' : '#ffd45e'; mg.beginPath(); mg.arc(p.x, p.y, 3, 0, Math.PI * 2); mg.fill(); }
    for (const u of game.units) if (u.alive) { const p = at(u); mg.fillStyle = u.isPlayer ? '#39ffb8' : UNIT_TYPES[u.type].colour; mg.beginPath(); mg.arc(p.x, p.y, u.isPlayer ? 6 : 5, 0, Math.PI * 2); mg.fill(); mg.strokeStyle = '#000'; mg.lineWidth = 1; mg.stroke(); }
  }

  function drawPortrait(c, u) {
    const pg = c.getContext('2d'); pg.clearRect(0, 0, c.width, c.height);
    pg.fillStyle = rgba(UNIT_TYPES[u.type].colour, 0.18); pg.fillRect(0, 0, c.width, c.height);
    const sc = u.type === 'warden' ? 0.75 : u.type === 'courier' ? 1 : 1.1;
    drawUnitSprite(pg, u, c.width / 2, c.height / 2 + (u.type === 'courier' ? 12 : u.type === 'warden' ? 14 : 6), sc, 0, { noShadow: true });
  }

  return { view, fit, draw, drawMinimap, drawPortrait, hexToScreen, hexAt, unitPos, clearTiles: () => tileCache.clear() };
}
