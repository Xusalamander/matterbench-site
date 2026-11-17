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
  const LAMP = { half: 16, panel: 32, base: 3, back: 8 };
  function lampBoxes(p) {
    const cx = 4 * p.c[0], cy = 4 * p.c[1], zb = 4 * p.c[2] + (p.s || 0), top = zb + LAMP.base, feet = [];
    const boxes = [
      [[cx - LAMP.half, cy - LAMP.back, zb], [cx + LAMP.half, cy + 1, top]],
      [[cx - LAMP.half, cy - 1, top], [cx + LAMP.half, cy + 1, top + LAMP.panel]],
      [[cx + 2, cy - 7, top], [cx + 12, cy - 2, top + 2]],
      [[cx - 12, cy - 7, top], [cx - 8, cy - 3, top + 2]]
    ];
    for (const f of [-3, 3]) {
      const b = [[cx + 4 * f - 1, cy - 5, zb - FOOT_Q], [cx + 4 * f + 1, cy - 3, zb]];
      boxes.push(b);
      feet.push(b);
    }
    return { boxes, feet };
  }
  const boxed = (p) => p.type === "pal" || p.type === "lamp";
  function describe(p) {
    if (boxed(p)) {
      const { boxes, feet } = p.type === "lamp" ? lampBoxes(p) : palBoxes(p), min2 = [Infinity, Infinity, Infinity], max2 = [-Infinity, -Infinity, -Infinity];
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
  function baseboardConfig(value = {}) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !["columns", "rows", "color"].includes(k))) throw Error("底板参数无效");
    const columns = value.columns ?? 12, rows = value.rows ?? 12, color = value.color ?? "#5A6661";
    if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 4 || columns > 12 || rows < 4 || rows > 12 || !/^#[a-f0-9]{6}$/i.test(color)) throw Error("底板孔数范围为4到12，颜色为RGB");
    return { columns, rows, color: color.toUpperCase() };
  }
  function boardParts(value) {
    const cfg = baseboardConfig(value);
    const a = [];
    for (let i = 0; i < cfg.rows; i++) a.push({ type: "strip", A: 2, R: 0, c: [0, i, 0], s: 0, n: cfg.columns, base: true });
    for (let i = 0; i < cfg.columns; i++) a.push({ type: "strip", A: 2, R: 1, c: [i, 0, 0], s: 1, n: cfg.rows, base: true });
    return a;
  }
  const cutLength = (p) => p.type === "clip" ? p.n * QMM : p.type === "bead" ? p.n * 5 : p.n * 10;
  const palBeads = (p) => (p.cells || []).flat().filter(Boolean).length + (p.mount === "clip" ? 0 : palFeet(p).length * (FOOT_Q / 2));
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
    const tubes = parts.filter(isTube), plates = parts.filter((p) => !isTube(p) && !boxed(p));
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
    for (const pal of parts.filter(boxed)) {
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
    function reach(from, skip, skip2 = null) {
      const seen = new Set([from, skip, ...skip2 ? [skip2] : []]), todo = [from], group = [];
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
    const axles = new Map();
    const axleOf = (p) => {
      if (!axles.has(p)) {
        const rods = [];
        adj.get(p).forEach((k, q) => {
          if (k === "pin" && isTube(q) && reach(q, p).grounded) rods.push(q);
        });
        axles.set(p, rods.length === 1 ? rods[0] : null);
      }
      return axles.get(p);
    };
    const stacked = (p, q, A) => {
      const a = describe(p), b = describe(q);
      return a.max[A] === b.min[A] ? "above" : b.max[A] === a.min[A] ? "below" : null;
    };
    const bearingSide = (p, q) => {
      const rod = axleOf(p);
      if (!rod || isTube(q) || boxed(q) || adj.get(p).get(q) !== "touch" || adj.get(q).get(rod) !== "pin") return null;
      return stacked(p, q, rod.A);
    };
    const kinds = (p) => {
      let pin = 0, bearing = 0, other = 0;
      adj.get(p).forEach((k, q) => {
        if (k === "pin") pin++;
        else if (bearingSide(p, q)) bearing++;
        else other++;
      });
      return { pin, bearing, other };
    };
    const floating = parts.filter((p) => !p.base && !grounded.has(p));
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
      } else if (used.length === 1) {
        const k = kinds(p);
        roles.set(p, k.other === 0 && k.bearing === 0 ? { role: "hinge", axis: used[0][0] } : { role: "collar", axis: used[0][0] });
      }
    }
    const rotors = [];
    for (const p of plates) {
      if (p.base || !grounded.has(p) || p.type === "clip" && roles.get(p)?.role !== "hinge") continue;
      const axle = axleOf(p);
      if (!axle) continue;
      let fixed = false;
      const carried = new Set();
      adj.get(p).forEach((k, q) => {
        if (q === axle || bearingSide(p, q)) return;
        const r = reach(q, p, axle);
        if (r.grounded) fixed = true;
        else r.group.forEach((x) => carried.add(x));
      });
      if (!fixed) rotors.push({ rotor: p, axle, carried: [...carried] });
    }
    const pivots = rotors.map((r) => r.rotor);
    const turntables = [...roles].filter(([, r]) => r.role === "turntable").map(([clip, r]) => ({ clip, axis: r.axis, carried: r.carried }));
    const retention = new Map([...pivots, ...turntables.map((t) => t.clip)].map((p) => {
      const side = { below: false, above: false };
      adj.get(p).forEach((k, q) => {
        const s = bearingSide(p, q);
        if (s) side[s] = true;
      });
      return [p, side];
    }));
    const touchOnly = parts.filter((p) => !p.base && p.type !== "bead" && grounded.has(p) && kinds(p).pin === 0);
    return { adj, pins, touches, order, floating, pivots, rotors, turntables, roles, touchOnly, grounded, kinds, retention, axleOf };
  }
  function sweepHits(parts, moving, axle) {
    const A = axle.A, [u, v] = [0, 1, 2].filter((t) => t !== A), s0 = site(A, axle.c), mine = new Set(moving);
    const ring = new Map();
    for (const p of moving) for (const key of voxels(p)) {
      const a = key.split(",").map(Number), r = Math.hypot(a[u] + 0.5 - s0[u], a[v] + 0.5 - s0[v]), old = ring.get(a[A]);
      ring.set(a[A], old ? [Math.min(old[0], r), Math.max(old[1], r)] : [r, r]);
    }
    const hits = new Set();
    for (const q of parts) {
      if (mine.has(q) || q === axle) continue;
      for (const key of voxels(q)) {
        const a = key.split(",").map(Number), band = ring.get(a[A]);
        if (!band) continue;
        const d = Math.hypot(a[u] + 0.5 - s0[u], a[v] + 0.5 - s0[v]);
        if (d >= band[0] - 1 && d <= band[1]) {
          hits.add(q);
          break;
        }
      }
    }
    return [...hits];
  }
  function rotationCheck(parts, part, info = analyze(parts)) {
    const reasons = [], turntable = info.turntables.find((t) => t.clip === part || t.carried.includes(part));
    const entry = turntable ? null : info.rotors.find((r) => r.rotor === part || r.carried.includes(part));
    const rotor = turntable ? turntable.clip : entry ? entry.rotor : part;
    const axle = turntable ? turntable.axis : entry ? entry.axle : info.axleOf(part);
    const pivot = turntable || entry;
    if (!pivot || !axle) reasons.push("没有被认作能转：需要只套在一根轴上，除了同轴限位圈和它带着的装饰之外不连着别的零件");
    const retention = info.retention.get(rotor) || { below: false, above: false };
    if (pivot && axle && axle.A === 2 && !retention.below) reasons.push("下方没有限位，会顺着轴滑下去");
    if (pivot && axle && axle.A === 2 && !retention.above) reasons.push("上方没有限位，拨动时可能脱出");
    const moving = turntable ? [turntable.clip, ...turntable.carried] : entry ? [entry.rotor, ...entry.carried] : [part];
    const mine = new Set(moving), rides = (q) => axle && info.adj.get(q)?.get(axle) === "pin" && [...info.adj.get(q).keys()].every((x) => x === axle || mine.has(x));
    const hits = axle ? sweepHits(parts, moving, axle).filter((q) => !rides(q)) : [];
    if (hits.length) reasons.push("转一圈会碰到 " + hits.length + " 个零件");
    return { ok: reasons.length === 0, rotor, axle, moving, retention, hits, reasons };
  }
  function slideCheck(parts, part, info = analyze(parts)) {
    const reasons = [], adj = info.adj;
    const reach = (from, skip) => {
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
    };
    const plates = parts.filter((p) => !p.base && !isTube(p) && !boxed(p) && p.type !== "clip");
    let entry = null;
    for (const p of plates) {
      const guides = [], carried = new Set();
      let fixed = false;
      adj.get(p).forEach((k, q) => {
        const r = reach(q, p);
        if (k === "pin" && isTube(q) && r.grounded) guides.push(q);
        else if (!r.grounded) r.group.forEach((x) => carried.add(x));
        else if (k !== "pin") {
          const a = describe(p), b = describe(q);
          if (b.max[2] !== a.min[2]) fixed = true;
        } else fixed = true;
      });
      if (guides.length >= 2 && !fixed && guides.every((g) => g.A === guides[0].A) && (p === part || carried.has(part))) entry = { slider: p, guides, carried: [...carried] };
    }
    if (!entry) return { ok: false, reasons: ["没有被认作能滑：需要套在两根以上平行导杆上，除了带着的装饰和下面的支撑之外不连着别的零件"], moving: [], guides: [], travel: { up: 0, down: 0 } };
    const A = entry.guides[0].A, moving = [entry.slider, ...entry.carried], mine = new Set(moving);
    const occ = new Map();
    for (const q of parts) if (!mine.has(q)) for (const v of voxels(q)) occ.set(v, q);
    const cells = moving.flatMap((p) => voxels(p).map((v) => v.split(",").map(Number)));
    const blocker = (k) => {
      for (const a of cells) {
        const b = a.slice();
        b[A] += k;
        const q = occ.get(b.join(","));
        if (q) return q;
      }
      return null;
    };
    const top = Math.min(...entry.guides.map((g) => describe(g).max[A])), sliderTop = describe(entry.slider).max[A];
    let up = 0, stop = null;
    while (up < 400) {
      stop = blocker(up + 1);
      if (stop || sliderTop + up + 1 > top) break;
      up++;
    }
    let down = 0;
    while (down < 400 && !blocker(-(down + 1))) down++;
    const caught = stop && entry.guides.some((g) => adj.get(stop)?.get(g) === "pin");
    if (!caught) reasons.push(stop ? "往上推会碰到别的零件，不是被导杆上的限位圈挡住" : "导杆顶端没有限位，推到顶会滑出导杆");
    if (up + down < 2) reasons.push("没有可以上下滑的空间");
    return { ok: reasons.length === 0, slider: entry.slider, guides: entry.guides, moving, axis: A, travel: { up, down }, reasons };
  }
  window.MBLattice = { QMM, PAL_N, FOOT_Q, LAMP, boxed, palFeet, site, describe, voxels, World, baseboardConfig, boardParts, cutLength, palBeads, analyze, isTube, sweepHits, rotationCheck, slideCheck };
})();
