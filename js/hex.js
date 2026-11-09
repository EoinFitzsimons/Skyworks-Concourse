/* Skyworks Concourse — hex grid maths (pointy-top, axial coordinates, odd-r offset storage) */
'use strict';

const Hex = (() => {
  const SQRT3 = Math.sqrt(3);
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

  const key = (q, r) => q + ',' + r;
  const parseKey = k => k.split(',').map(Number);

  function offsetToAxial(col, row) { return { q: col - ((row - (row & 1)) >> 1), r: row }; }
  function axialToOffset(q, r) { return { col: q + ((r - (r & 1)) >> 1), row: r }; }

  function distance(a, b) {
    const dq = a.q - b.q, dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }
  function neighbours(h) { return DIRS.map(([dq, dr]) => ({ q: h.q + dq, r: h.r + dr })); }
  function equals(a, b) { return a && b && a.q === b.q && a.r === b.r; }

  function toPixel(h, size) { return { x: size * SQRT3 * (h.q + h.r / 2), y: size * 1.5 * h.r }; }
  function fromPixel(x, y, size) {
    const q = (SQRT3 / 3 * x - y / 3) / size, r = (2 / 3 * y) / size;
    return round({ q, r });
  }
  function round(h) {
    let x = h.q, z = h.r, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    return { q: rx, r: rz };
  }
  function line(a, b) {
    const n = distance(a, b);
    if (n === 0) return [{ q: a.q, r: a.r }];
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      // Nudge slightly so that ties resolve consistently
      out.push(round({ q: a.q + (b.q - a.q) * t + 1e-6, r: a.r + (b.r - a.r) * t + 1e-6 }));
    }
    return out;
  }
  function ring(centre, radius) {
    if (radius === 0) return [{ q: centre.q, r: centre.r }];
    const out = [];
    let h = { q: centre.q + DIRS[4][0] * radius, r: centre.r + DIRS[4][1] * radius };
    for (let side = 0; side < 6; side++) for (let i = 0; i < radius; i++) {
      out.push({ q: h.q, r: h.r });
      h = { q: h.q + DIRS[side][0], r: h.r + DIRS[side][1] };
    }
    return out;
  }
  function within(centre, radius) {
    const out = [];
    for (let dq = -radius; dq <= radius; dq++)
      for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++)
        out.push({ q: centre.q + dq, r: centre.r + dr });
    return out;
  }
  function corners(cx, cy, size, inset = 0) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI / 180 * (60 * i - 30);
      pts.push([cx + (size - inset) * Math.cos(ang), cy + (size - inset) * Math.sin(ang)]);
    }
    return pts;
  }

  /* Dijkstra flood from `start` limited by `budget` movement points.
     costFn(hex) returns the cost to enter a hex, or Infinity when blocked.
     stopFn(hex) returns true when movement must end on that hex (lift pads).
     Returns Map key -> {cost, from}. */
  function reachable(start, budget, costFn, stopFn) {
    const dist = new Map();
    dist.set(key(start.q, start.r), { cost: 0, from: null, hex: { q: start.q, r: start.r } });
    const open = [{ q: start.q, r: start.r, cost: 0 }];
    while (open.length) {
      open.sort((a, b) => a.cost - b.cost);
      const cur = open.shift();
      const ck = key(cur.q, cur.r);
      if (dist.get(ck).cost < cur.cost) continue;
      if (stopFn && stopFn(cur) && cur.cost > 0) continue;
      for (const n of neighbours(cur)) {
        const c = costFn(n);
        if (!isFinite(c)) continue;
        const nc = cur.cost + c;
        if (nc > budget) continue;
        const nk = key(n.q, n.r);
        const prev = dist.get(nk);
        if (!prev || nc < prev.cost) {
          dist.set(nk, { cost: nc, from: ck, hex: n });
          open.push({ q: n.q, r: n.r, cost: nc });
        }
      }
    }
    return dist;
  }
  function pathFrom(dist, target) {
    let k = key(target.q, target.r);
    if (!dist.has(k)) return null;
    const path = [];
    while (k) { const d = dist.get(k); path.push(d.hex); k = d.from; }
    return path.reverse();
  }

  /* A* between two hexes with a cost function; the goal may itself be blocked
     (an occupied hex) when `allowGoal` is set, so that units can path "towards" something. */
  function astar(start, goal, costFn, allowGoal = true, maxNodes = 4000) {
    const sk = key(start.q, start.r), gk = key(goal.q, goal.r);
    const g = new Map([[sk, 0]]), from = new Map(), hexes = new Map([[sk, start]]);
    const open = [{ k: sk, f: distance(start, goal) }];
    let nodes = 0;
    while (open.length && nodes++ < maxNodes) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      if (cur.k === gk) {
        const path = [];
        let k = gk;
        while (k) { path.push(hexes.get(k)); k = from.get(k); }
        return path.reverse();
      }
      const ch = hexes.get(cur.k), cg = g.get(cur.k);
      for (const n of neighbours(ch)) {
        const nk = key(n.q, n.r);
        let c = costFn(n);
        if (!isFinite(c)) { if (allowGoal && nk === gk) c = 1; else continue; }
        const ng = cg + c;
        if (!g.has(nk) || ng < g.get(nk)) {
          g.set(nk, ng); from.set(nk, cur.k); hexes.set(nk, n);
          open.push({ k: nk, f: ng + distance(n, goal) });
        }
      }
    }
    return null;
  }

  return { SQRT3, DIRS, key, parseKey, offsetToAxial, axialToOffset, distance, neighbours, equals,
    toPixel, fromPixel, round, line, ring, within, corners, reachable, pathFrom, astar };
})();
