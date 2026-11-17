(() => {
  "use strict";
  const LED = 8;
  const FX = ["solid", "breathe", "rainbow", "rise", "twinkle"];
  const FX_NAMES = { solid: "常亮", breathe: "呼吸", rainbow: "彩虹环绕", rise: "流光上升", twinkle: "星光闪烁" };
  const hexToRgb = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  };
  function hsv(h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][(i % 6 + 6) % 6];
  }
  function hash32(a) {
    a >>>= 0;
    a ^= a >>> 16;
    a = Math.imul(a, 2146121005) >>> 0;
    a ^= a >>> 15;
    a = Math.imul(a, 2221713035) >>> 0;
    a ^= a >>> 16;
    return a >>> 0;
  }
  function ledAt(light, f, lx, ly, t, faces = 4) {
    const [br, bg, bb] = hexToRgb(light.color).map((v) => v / 255);
    const sp = light.speed;
    let r = br, g = bg, b = bb;
    if (light.fx === "breathe") {
      const k2 = 0.2 + 0.8 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t * 0.06 * sp));
      r *= k2;
      g *= k2;
      b *= k2;
    } else if (light.fx === "rainbow") {
      let h = (f * LED + lx) / (faces * LED) + t * 0.05 * sp;
      h -= Math.floor(h);
      [r, g, b] = hsv(h, 1, 1);
    } else if (light.fx === "rise") {
      const ph = ly / LED + t * 0.12 * sp;
      const s = 0.5 + 0.5 * Math.sin(2 * Math.PI * ph);
      const k2 = 0.15 + 0.85 * s * s;
      r *= k2;
      g *= k2;
      b *= k2;
    } else if (light.fx === "twinkle") {
      const id = (f * LED + ly) * LED + lx;
      const s = t * 0.8 * sp + hash32(id) % 1e3 / 1e3;
      const step = Math.floor(s), fr = s - step;
      const base = [r * 0.3, g * 0.3, b * 0.3];
      if (hash32(id * 7919 + step >>> 0) % 100 < 12) {
        const spark = [Math.min(1, r + 60 / 255), Math.min(1, g + 60 / 255), Math.min(1, b + 60 / 255)];
        [r, g, b] = spark.map((v, i) => v + (base[i] - v) * fr);
      } else [r, g, b] = base;
    }
    const k = light.bright / 100;
    return [r * k, g * k, b * k];
  }
  function transmit(bead, L, out = [0, 0, 0]) {
    let o;
    if (!bead) o = [L[0] * 0.55, L[1] * 0.55, L[2] * 0.55];
    else {
      const bc = hexToRgb(bead).map((v) => v / 255);
      o = bc.map((v, k) => v * 0.04 + L[k] * (0.15 + 0.85 * v) * 1.7);
    }
    const over = Math.max(0, Math.max(o[0], o[1], o[2]) - 1) * 0.45;
    out[0] = Math.min(1, o[0] + over);
    out[1] = Math.min(1, o[1] + over);
    out[2] = Math.min(1, o[2] + over);
    return out;
  }
  const srgb = (THREE, tex) => {
    if ("colorSpace" in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  };
  function makeLedPanel(THREE, size) {
    const data = new Uint8Array(LED * LED * 4).fill(40);
    const tex = new THREE.DataTexture(data, LED, LED, THREE.RGBAFormat);
    srgb(THREE, tex);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    return { mesh, tex };
  }
  function paintPanel(tex, led, on, offset = 0) {
    const data = tex.image.data;
    let sr = 0, sg = 0, sb = 0;
    for (let ly = 0; ly < LED; ly++) for (let lx = 0; lx < LED; lx++) {
      const j = offset + (ly * LED + lx) * 3;
      const r = on ? led[j] : 0.12, g = on ? led[j + 1] : 0.12, b = on ? led[j + 2] : 0.13;
      sr += r;
      sg += g;
      sb += b;
      const o = ((LED - 1 - ly) * LED + lx) * 4;
      data[o] = r * 255;
      data[o + 1] = g * 255;
      data[o + 2] = b * 255;
      data[o + 3] = 255;
    }
    tex.needsUpdate = true;
    const n = LED * LED;
    return [sr / n, sg / n, sb / n];
  }
  function makeEsp32(THREE, u) {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.8 * u, 0.25 * u, 5.2 * u), new THREE.MeshStandardMaterial({ color: 2060106, roughness: 0.6 }));
    board.position.y = 0.13 * u;
    const chip = new THREE.Mesh(new THREE.BoxGeometry(1.6 * u, 0.3 * u, 1.8 * u), new THREE.MeshStandardMaterial({ color: 12106948, metalness: 0.6, roughness: 0.3 }));
    chip.position.set(0, 0.4 * u, -1 * u);
    g.add(board, chip);
    g.userData.pins = { data: [0.9 * u, 0.3 * u, 2.2 * u], button: [-0.9 * u, 0.3 * u, 2.2 * u], gnd: [0, 0.3 * u, 2.4 * u] };
    return g;
  }
  window.MBLampCore = { LED, FX, FX_NAMES, hexToRgb, hsv, hash32, ledAt, transmit, makeLedPanel, paintPanel, makeEsp32 };
})();
