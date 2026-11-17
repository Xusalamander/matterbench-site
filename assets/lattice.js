(() => {
  "use strict";
  const QMM = 2.5;
  function site(A, c) {
    if (A === 2) return [4 * c[0], 4 * c[1], null];
    if (A === 0) return [null, 4 * c[1] + 2, 4 * c[2]];
    return [4 * c[0] + 2, null, 4 * c[2] + 2];
  }
  const isTube = (p) => p.type === "rod" || p.type === "bead";
  const PAL_N = 14, FOOT_Q = 4;
  const palFeet = (p) => p.mount === "pivot" ? [0] : [-1, 1];
  function palBoxes(p) {
    const cx = 4 * p.c[0], cy = 4 * p.c[1], zb = 4 * p.c[2] + (p.s || 0), boxes = [], feet = [];
    (p.cells || []).forEach((row, r) => row.forEach((on, i) => {
      if (!on) return;
      const x = cx - PAL_N + 2 * i, z = zb + 2 * (PAL_N - 1 - r);
      boxes.push([[x, cy - 1, z], [x + 2, cy + 1, z + 2]]);
    }));
    for (const f of palFeet(p)) {
      const b = [[cx + 4 * f - 1, cy - 1, zb - FOOT_Q], [cx + 4 * f + 1, cy + 1, zb]];
      boxes.push(b);
      feet.push(b);
    }
    return { boxes, feet };
  }
  function describe(p) {
    if (p.type === "pal") {
      const { boxes, feet } = palBoxes(p), min2 = [Infinity, Infinity, Infinity], max2 = [-Infinity, -Infinity, -Infinity];
      for (const [a, b] of boxes) for (let t = 0; t < 3; t++) {
        min2[t] = Math.min(min2[t], a[t]);
        max2[t] = Math.max(max2[t], b[t]);
      }
      return { min: min2, max: max2, holes: [], s0: [4 * p.c[0], 4 * p.c[1], null], boxes, feet };
    }
    const min = [0, 0, 0], max = [0, 0, 0], holes = [], A = p.A, c = p.c, s0 = site(A, c);
    if (isTube(p)) {
      const len = p.type === "rod" ? 4 * p.n : 2 * p.n, off = p.type === "bead" ? 2 * (p.s || 0) : 0;
      for (let t = 0; t < 3; t++) {
        if (t === A) {
          const st = (A === 2 ? 4 * c[2] : 4 * c[A] - 2) + off;
          min[t] = st;
          max[t] = st + len;
        } else {
          min[t] = s0[t] - 1;
          max[t] = s0[t] + 1;
        }
      }
    } else {
      const R = p.R, W = 3 - A - R;
      min[A] = 4 * c[A] + p.s;
      min[W] = s0[W] - 2;
      max[W] = s0[W] + 2;
      min[R] = s0[R] - 2;
      let nh;
      if (p.type === "strip") {
        max[A] = min[A] + 1;
        max[R] = s0[R] + 4 * (p.n - 1) + 2;
        nh = p.n;
      } else {
        max[A] = min[A] + p.n;
        max[R] = s0[R] + 6;
        nh = 2;
      }
      for (let k = 0; k < nh; k++) {
        const hmin = min.slice(), hmax = max.slice();
        hmin[R] = s0[R] + 4 * k - 1;
        hmax[R] = hmin[R] + 2;
        hmin[W] = s0[W] - 1;
        hmax[W] = s0[W] + 1;
        holes.push([hmin, hmax]);
      }
    }
    return { min, max, holes, s0 };
  }
  function voxels(p) {
    const d = describe(p), out = [];
    if (d.boxes) {
      for (const [a, b] of d.boxes) for (let x = a[0]; x < b[0]; x++) for (let y = a[1]; y < b[1]; y++) for (let z = a[2]; z < b[2]; z++) out.push(x + "," + y + "," + z);
      return out;
    }
    for (let x = d.min[0]; x < d.max[0]; x++) for (let y = d.min[1]; y < d.max[1]; y++) for (let z = d.min[2]; z < d.max[2]; z++) {
      const inHole = d.holes.some((h) => x >= h[0][0] && x < h[1][0] && y >= h[0][1] && y < h[1][1] && z >= h[0][2] && z < h[1][2]);
      if (!inHole) out.push(x + "," + y + "," + z);
    }
    return out;
  }
  class World {
    constructor() {
      this.occ = new Map();
      this.parts = [];
      this.nextId = 1;
    }
    canPlace(p) {
      return voxels(p).every((v) => !this.occ.has(v));
    }
    add(p) {
      p.id = this.nextId++;
      for (const v of voxels(p)) this.occ.set(v, p.id);
      this.parts.push(p);
      return p;
    }
    remove(p) {
      for (const v of voxels(p)) this.occ.delete(v);
      this.parts.splice(this.parts.indexOf(p), 1);
    }
  }
  function boardParts() {
    const a = [];
    for (let i = 0; i < 12; i++) a.push({ type: "strip", A: 2, R: 0, c: [0, i, 0], s: 0, n: 12, base: true });
    for (let i = 0; i < 12; i++) a.push({ type: "strip", A: 2, R: 1, c: [i, 0, 0], s: 1, n: 12, base: true });
    return a;
  }
  const cutLength = (p) => p.type === "clip" ? p.n * QMM : p.type === "bead" ? p.n * 5 : p.n * 10;
  const palBeads = (p) => (p.cells || []).flat().filter(Boolean).length + palFeet(p).length * (FOOT_Q / 2);
  const overlap = (a0, a1, b0, b1) => [0, 1, 2].every((t) => Math.max(a0[t], b0[t]) < Math.min(a1[t], b1[t]));
  function analyze(parts) {
    const adj = new Map();
    let pins = 0, touches = 0;
    for (const p of parts) adj.set(p, new Map());
    const link = (a, b, kind) => {
      if (adj.get(a).has(b)) return;
      adj.get(a).set(b, kind);
      adj.get(b).set(a, kind);
      if (!a.base || !b.base) {
        if (kind === "pin") pins++;
        else touches++;
      }
    };
    const tubes = parts.filter(isTube), plates = parts.filter((p) => !isTube(p) && p.type !== "pal");
    const dt = tubes.map(describe), dp = plates.map(describe);
    const inHole = new Map();
    const pinHole = (pl, k, q) => {
      if (!inHole.has(pl)) inHole.set(pl, dp[plates.indexOf(pl)].holes.map(() => new Set()));
      inHole.get(pl)[k].add(q);
    };
    tubes.forEach((r, i) => plates.forEach((pl, j) => {
      if (r.A !== pl.A) return;
      dp[j].holes.forEach((h, k) => {
        if (overlap(dt[i].min, dt[i].max, h[0], h[1])) {
          link(r, pl, "pin");
          pinHole(pl, k, r);
        }
      });
    }));
    for (const pal of parts.filter((p) => p.type === "pal")) {
      const feet = describe(pal).feet;
      plates.forEach((pl, j) => {
        if (pl.A !== 2) return;
        dp[j].holes.forEach((h, k) => {
          if (feet.some((f) => overlap(f[0], f[1], h[0], h[1]))) {
            link(pal, pl, "pin");
            pinHole(pl, k, pal);
          }
        });
      });
    }
    const occ = new Map(), vs = parts.map(voxels);
    parts.forEach((p, n) => vs[n].forEach((v) => occ.set(v, p)));
    const D = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    parts.forEach((p, n) => vs[n].forEach((v) => {
      const a = v.split(",").map(Number);
      for (const d of D) {
        const q = occ.get(a[0] + d[0] + "," + (a[1] + d[1]) + "," + (a[2] + d[2]));
        if (q && q !== p && !(p.base && q.base)) link(p, q, "touch");
      }
    }));
    const grounded = new Set(), low = (p) => describe(p).min[2];
    let order = [], ring = parts.filter((p) => p.base);
    ring.forEach((p) => grounded.add(p));
    while (ring.length) {
      const next = [];
      for (const p of ring) adj.get(p).forEach((kind, q) => {
        if (!grounded.has(q)) {
          grounded.add(q);
          next.push(q);
        }
      });
      next.sort((a, b) => low(a) - low(b) || a.id - b.id);
      order = order.concat(next);
      ring = next;
    }
    const kinds = (p) => {
      let pin = 0, other = 0;
      adj.get(p).forEach((k) => {
        if (k === "pin") pin++;
        else other++;
      });
      return { pin, other };
    };
    const floating = parts.filter((p) => !p.base && !grounded.has(p));
    function reach(from, skip) {
      const seen = new Set([from, skip]), todo = [from], group = [];
      while (todo.length) {
        const p = todo.pop();
        if (p.base) return { grounded: true, group };
        group.push(p);
        adj.get(p).forEach((k, q) => {
          if (!seen.has(q)) {
            seen.add(q);
            todo.push(q);
          }
        });
      }
      return { grounded: false, group };
    }
    const roles = new Map();
    for (const p of plates) {
      if (p.type !== "clip" || p.base || !grounded.has(p)) continue;
      const holes = (inHole.get(p) || [new Set(), new Set()]).map((set) => [...set]);
      const used = holes.filter((h) => h.length);
      if (used.length === 2) {
        const a = reach(holes[0][0], p), b = reach(holes[1][0], p);
        if (a.grounded && b.grounded) roles.set(p, { role: "link" });
        else {
          const [fixed, moving] = a.grounded ? [holes[0][0], b] : [holes[1][0], a];
          roles.set(p, { role: "turntable", axis: fixed, carried: moving.group });
        }
      } else if (used.length === 1) roles.set(p, kinds(p).other === 0 ? { role: "hinge", axis: used[0][0] } : { role: "collar", axis: used[0][0] });
    }
    const pivots = plates.filter((p) => !p.base && grounded.has(p) && kinds(p).pin === 1 && kinds(p).other === 0);
    const turntables = [...roles].filter(([, r]) => r.role === "turntable").map(([clip, r]) => ({ clip, axis: r.axis, carried: r.carried }));
    const touchOnly = parts.filter((p) => !p.base && p.type !== "bead" && grounded.has(p) && kinds(p).pin === 0);
    return { adj, pins, touches, order, floating, pivots, turntables, roles, touchOnly, grounded, kinds };
  }
  window.MBLattice = { QMM, PAL_N, FOOT_Q, palFeet, site, describe, voxels, World, boardParts, cutLength, palBeads, analyze, isTube };
})();
