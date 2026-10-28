// Textures procédurales (générées une seule fois, partagées par tous les rendus).
// Tout est dessiné en canvas 2D : aucune image externe à télécharger. Les calculs
// pixel par pixel sont des générateurs qui cèdent la main toutes les quelques
// lignes : ils peuvent s'exécuter d'un trait ou par tranches (voir lazyValue).
import * as THREE from 'three';
import { clamp, smoothstep, lerp, makeNoise, fbm, rng, finish, lazyValue } from './util.js';

const cache = new Map();
export const memo = (key, build) => {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
};

// Résolution des textures générées (0.5 sur mobile : 4× moins de pixels à calculer).
export const quality = { tex: 1 };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Champ de bruit basse fréquence calculé sur une grille grossière puis interpolé :
// mêmes ondulations, 64× moins d'appels au bruit.
function coarseField(W, H, step, fn) {
  const gw = Math.ceil(W / step) + 1, gh = Math.ceil(H / step) + 1;
  const g = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) g[j * gw + i] = fn(i * step, j * step);
  return (i, j) => {
    const fx = i / step, fy = j / step;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

function toTexture(canvas, { srgb = false, repeat = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Écrit un champ scalaire [0,1] dans un canvas en niveaux de gris.
function* grayCanvas(field, w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0, p = 0; y < h; y++) {
    for (let i = y * w, end = i + w; i < end; i++, p += 4) {
      const v = clamp(field[i]) * 255;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
      img.data[p + 3] = 255;
    }
    if ((y & 31) === 31) yield;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Carte de normales (espace tangent) à partir d'un champ de hauteur.
function* normalCanvas(height, w, h, strength, wrap = false) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const at = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = x < 0 ? 0 : x >= w ? w - 1 : x; y = y < 0 ? 0 : y >= h ? h - 1 : y; }
    return height[y * w + x];
  };
  for (let y = 0, p = 0; y < h; y++) {
    for (let x = 0; x < w; x++, p += 4) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5 * strength;
      // l'axe v de la texture monte quand la ligne du canvas descend (flipY)
      const dy = (at(x, y - 1) - at(x, y + 1)) * 0.5 * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      img.data[p] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[p + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[p + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[p + 3] = 255;
    }
    if ((y & 15) === 15) yield;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function readMask(canvas) {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4] / 255;
  return out;
}

// ---------------------------------------------------------------------------
// Lames : couleur, rugosité et relief, dans le repère UV planaire de la lame.
// info = { x0, L, yMin, yMax, spine(x), edge(x) } (fourni par buildBlade)
// ---------------------------------------------------------------------------
export function* paintBlade(info, opts = {}) {
  const W = Math.round(1024 * quality.tex), H = Math.round(256 * quality.tex);
  const N = W * H;
  const px1 = W / 1024; // tailles de trait / motifs exprimées pour 1024 px
  const rough = new Float32Array(N).fill(opts.rough ?? 0.3);
  const lum = new Float32Array(N).fill(opts.baseLum ?? 1);
  const hgt = new Float32Array(N);
  const spanX = info.L - info.x0, spanY = info.yMax - info.yMin;
  const texelAspect = (spanX / W) / (spanY / H);
  const toPx = (x, y) => [((x - info.x0) / spanX) * W, (1 - (y - info.yMin) / spanY) * H];
  const along = (x, vb) => info.edge(x) + vb * (info.spine(x) - info.edge(x));

  const masks = {};
  const maskCtx = (name) => {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    masks[name] = c;
    return ctx;
  };

  if (opts.stonewash) {
    const ctx = maskCtx('stonewash');
    const r = rng(opts.seed ?? 7);
    for (let i = 0, n = Math.round(2600 * px1 * px1); i < n; i++) {
      if (i % 400 === 399) yield;
      const g = Math.floor(r() * 255);
      ctx.fillStyle = `rgba(${g},${g},${g},${0.04 + r() * 0.08})`;
      ctx.beginPath();
      ctx.ellipse(r() * W, r() * H, (1 + r() * 7) * px1, (1 + r() * 5) * px1, r() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineWidth = 0.6 * px1;
    yield;
    for (let i = 0, n = Math.round(700 * px1 * px1); i < n; i++) {
      const x = r() * W, y = r() * H, a = r() * Math.PI * 2, l = (4 + r() * 22) * px1;
      ctx.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.12})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  }

  if (opts.etch) {
    const ctx = maskCtx('etch');
    const { x, vb, size } = opts.etch;
    const [px, py] = toPx(x, along(x, vb));
    const sizePx = (size / spanY) * H;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1 / texelAspect, 1);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${sizePx}px "Playfair Display", Georgia, serif`;
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${sizePx * 0.12}px`;
    ctx.fillText('APEX·3D', 0, 0);
    ctx.font = `500 ${sizePx * 0.32}px "JetBrains Mono", monospace`;
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${sizePx * 0.1}px`;
    ctx.fillText(opts.etch.sub || 'HANDCRAFTED · FRANCE', 0, sizePx * 0.78);
    ctx.fillRect(-sizePx * 1.9, sizePx * 0.5, sizePx * 3.8, Math.max(1, sizePx * 0.035));
    ctx.restore();
  }

  if (opts.deco) {
    const ctx = maskCtx('deco');
    ctx.strokeStyle = '#fff';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const line = (pts, wdt) => {
      ctx.lineWidth = Math.max(0.7, wdt * px1);
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const [px, py] = toPx(x, y);
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      });
      ctx.stroke();
    };
    const follow = (vb, xa, xb) => {
      const pts = [];
      for (let i = 0; i <= 60; i++) { const x = lerp(xa, xb, i / 60); pts.push([x, along(x, vb)]); }
      return pts;
    };
    // filets parallèles aux tranchants et à l'arête centrale
    [0.17, 0.83].forEach((vb) => line(follow(vb, 0.08, 1.62), 2.4));
    [0.44, 0.56].forEach((vb) => line(follow(vb, 0.08, 1.45), 1.6));
    // chevrons art déco orientés vers la pointe
    for (let x = 0.24; x < 1.32; x += 0.12) {
      line([[x, along(x, 0.2)], [x + 0.07, along(x + 0.07, 0.41)]], 1.8);
      line([[x, along(x, 0.8)], [x + 0.07, along(x + 0.07, 0.59)]], 1.8);
      line([[x + 0.035, along(x + 0.035, 0.2)], [x + 0.095, along(x + 0.095, 0.38)]], 1.1);
      line([[x + 0.035, along(x + 0.035, 0.8)], [x + 0.095, along(x + 0.095, 0.62)]], 1.1);
    }
    // soleil levant près de la garde
    for (let i = -5; i <= 5; i++) {
      const a = (i / 5) * 0.95;
      line([[0.03, 0], [0.03 + Math.cos(a) * 0.17, Math.sin(a) * 0.13]], 1.4);
    }
    // losanges sur l'arête
    for (let x = 0.3; x < 1.4; x += 0.24) {
      line([[x - 0.03, along(x - 0.03, 0.5)], [x, along(x, 0.535)], [x + 0.03, along(x + 0.03, 0.5)], [x, along(x, 0.465)], [x - 0.03, along(x - 0.03, 0.5)]], 1.5);
    }
  }

  if (opts.dimples) {
    const ctx = maskCtx('dimples');
    const { from, to, count, vb, rx, ry } = opts.dimples;
    for (let i = 0; i < count; i++) {
      const x = lerp(from, to, i / (count - 1));
      const [px, py] = toPx(x, along(x, vb));
      const rxp = (rx / spanX) * W, ryp = (ry / spanY) * H;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(rxp, ryp);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.55, 'rgba(255,255,255,0.75)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  yield;
  const m = {};
  for (const k in masks) {
    m[k] = readMask(masks[k]);
    yield;
  }

  const noise = makeNoise((opts.seed ?? 3) * 13 + 1, 256);
  const noise2 = makeNoise((opts.seed ?? 3) * 29 + 5, 128);
  const brushed = opts.brushed ?? 0.6;
  const dam = opts.damascus;
  const xOf = (i) => info.x0 + ((i + 0.5) / W) * spanX;
  const yOf = (j) => info.yMin + (1 - (j + 0.5) / H) * spanY;

  // stries du brossage : bruit séparable (deux profils de rangée mêlés le long de x)
  const rowA = new Float32Array(H), rowB = new Float32Array(H), mixX = new Float32Array(W);
  if (brushed > 0) {
    for (let j = 0; j < H; j++) { rowA[j] = fbm(noise, 3.7, j * 0.75, 3); rowB[j] = fbm(noise, 61.3, j * 0.75, 3); }
    for (let i = 0; i < W; i++) mixX[i] = smoothstep(0.25, 0.75, fbm(noise2, (i / px1) * 0.004, 17.1, 2));
  }
  const warp = dam ? coarseField(W, H, 8, (i, j) => fbm(noise2, xOf(i) * 1.7, yOf(j) * 3.1, 4) * 2 - 1) : null;
  yield;

  for (let j = 0; j < H; j++) {
    if ((j & 7) === 7) yield;
    const y = yOf(j);
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const x = xOf(i);
      if (brushed > 0) {
        const n = rowA[j] + (rowB[j] - rowA[j]) * mixX[i];
        rough[k] += (n - 0.5) * brushed * 0.2;
        lum[k] *= 1 + (n - 0.5) * brushed * 0.035;
      }
      if (dam) {
        const w = warp(i, j);
        const ph = y * dam.density + w * dam.warp + Math.sin(x * 2.4 + y * 4.0) * 0.8;
        const d = Math.sin(ph * Math.PI * 2);
        const band = smoothstep(-0.3, 0.3, d);
        lum[k] *= lerp(1 - dam.contrast, 1, band);
        rough[k] += (1 - band) * 0.06;
        hgt[k] += band * 0.2;
      }
      if (m.stonewash) {
        const s = m.stonewash[k];
        rough[k] += (s - 0.08) * 0.22;
        lum[k] *= 1 - s * 0.05;
      }
      if (m.etch) {
        const e = m.etch[k];
        rough[k] = lerp(rough[k], opts.etchLight ? 0.3 : 0.62, e);
        lum[k] = opts.etchLight ? lerp(lum[k], 1, e) : lum[k] * (1 - e * 0.68);
        hgt[k] -= e * 0.12;
      }
      if (m.deco) {
        const e = m.deco[k];
        rough[k] = lerp(rough[k], 0.5, e);
        lum[k] *= 1 - e * 0.6;
        hgt[k] -= e * 0.9;
      }
      if (m.dimples) {
        const e = m.dimples[k];
        hgt[k] -= e * 0.4;
        rough[k] += e * 0.03;
      }
    }
  }

  const rc = yield* grayCanvas(rough, W, H);
  const lc = yield* grayCanvas(lum, W, H);
  const nc = yield* normalCanvas(hgt, W, H, opts.relief ?? 2.2);
  return {
    map: toTexture(lc, { srgb: true }),
    roughnessMap: toTexture(rc),
    normalMap: toTexture(nc),
  };
}

// ---------------------------------------------------------------------------
// Manches
// ---------------------------------------------------------------------------
export const woodTextures = lazyValue(function* () {
  const W = Math.round(1024 * quality.tex), H = Math.round(256 * quality.tex), N = W * H;
  const col = makeCanvas(W, H);
  const ctx = col.getContext('2d');
  const img = ctx.createImageData(W, H);
  const rough = new Float32Array(N), hgt = new Float32Array(N);
  const noise = makeNoise(41, 256), noise2 = makeNoise(77, 256);
  const light = [150, 96, 58], dark = [74, 40, 20];
  const warpF = coarseField(W, H, 8, (i, j) => fbm(noise, (i / W) * 2.2, (j / H) * 3.0, 4) * 1.6);
  const figureF = coarseField(W, H, 8, (i, j) => fbm(noise, (i / W) * 0.9 + 7, (j / H) * 1.4, 3));
  yield;
  for (let j = 0; j < H; j++) {
    if ((j & 7) === 7) yield;
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const u = i / W, v = j / H;
      // veines longitudinales ondulées (bois de fil) + figure douce
      const warp = warpF(i, j) + Math.sin(u * 5.0 + v * 2.0) * 0.08;
      const ring = (((v * 14.0 + warp) % 1) + 1) % 1;
      const late = Math.pow(Math.sin(ring * Math.PI), 6);
      const fine = fbm(noise2, u * 3.0, v * 90.0, 2);
      const figure = figureF(i, j);
      const t = clamp(late * 0.7 + (fine - 0.5) * 0.35 + (figure - 0.5) * 0.5);
      const pore = fbm(noise2, u * 140.0, v * 6.0, 1) < 0.18 ? 0.86 : 1;
      img.data[k * 4] = lerp(light[0], dark[0], t) * pore;
      img.data[k * 4 + 1] = lerp(light[1], dark[1], t) * pore;
      img.data[k * 4 + 2] = lerp(light[2], dark[2], t) * pore;
      img.data[k * 4 + 3] = 255;
      rough[k] = 0.45 + late * 0.1 + (1 - pore) * 0.4;
      hgt[k] = late * 0.25 + (fine - 0.5) * 0.25 - (1 - pore) * 0.8;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: toTexture(col, { srgb: true }),
    roughnessMap: toTexture(yield* grayCanvas(rough, W, H)),
    normalMap: toTexture(yield* normalCanvas(hgt, W, H, 1.0)),
  };
});

// G10 usiné : motif pyramidal en losanges.
export const g10Textures = lazyValue(function* () {
  const S = 256, N = S * S;
  const hgt = new Float32Array(N), rough = new Float32Array(N);
  const noise = makeNoise(91, 128);
  const cells = 16;
  for (let j = 0; j < S; j++) {
    if ((j & 31) === 31) yield;
    for (let i = 0; i < S; i++) {
      const k = j * S + i;
      const u = (i / S) * cells, v = (j / S) * cells;
      const a = Math.abs(((u + v) % 1) - 0.5), b = Math.abs(((u - v + 64) % 1) - 0.5);
      const pyr = 1 - Math.max(a, b) * 2;
      const n = noise(i * 0.16, j * 0.16);
      hgt[k] = smoothstep(0.05, 0.6, pyr) + n * 0.08;
      rough[k] = 0.62 + n * 0.16 - smoothstep(0.7, 1, pyr) * 0.12;
    }
  }
  return {
    roughnessMap: toTexture(yield* grayCanvas(rough, S, S), { repeat: true }),
    normalMap: toTexture(yield* normalCanvas(hgt, S, S, 2.6, true), { repeat: true }),
  };
});

// Grip caoutchouté : nervures transversales + grain fin.
export const gripTextures = lazyValue(function* () {
  const S = 256, N = S * S;
  const hgt = new Float32Array(N), rough = new Float32Array(N);
  const noise = makeNoise(13, 256);
  for (let j = 0; j < S; j++) {
    if ((j & 31) === 31) yield;
    for (let i = 0; i < S; i++) {
      const k = j * S + i;
      const u = i / S;
      const rib = Math.pow(Math.abs(Math.sin(u * Math.PI * 24)), 0.6);
      const n = fbm(noise, i * 0.24, j * 0.24, 2);
      hgt[k] = rib * 0.8 + n * 0.25;
      rough[k] = 0.82 + n * 0.12;
    }
  }
  return {
    roughnessMap: toTexture(yield* grayCanvas(rough, S, S), { repeat: true }),
    normalMap: toTexture(yield* normalCanvas(hgt, S, S, 1.9, true), { repeat: true }),
  };
});

// Micro-relief discret (polymère satiné, laque, métal fondu).
export const microTextures = lazyValue(function* () {
  const S = 128, N = S * S;
  const hgt = new Float32Array(N), rough = new Float32Array(N);
  const noise = makeNoise(5, 32);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const k = j * S + i;
      const n = fbm(noise, i * 0.5, j * 0.5, 3);
      hgt[k] = n;
      rough[k] = 0.85 + (n - 0.5) * 0.3;
    }
  }
  return {
    roughnessMap: toTexture(yield* grayCanvas(rough, S, S), { repeat: true }),
    normalMap: toTexture(yield* normalCanvas(hgt, S, S, 0.9, true), { repeat: true }),
  };
});

// ---------------------------------------------------------------------------
// Sprites et masques
// ---------------------------------------------------------------------------
export function softboxTexture(gradient = false) {
  return memo('softbox' + gradient, () => {
    const S = 256, N = S * S;
    const f = new Float32Array(N);
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = (i + 0.5) / S * 2 - 1, y = (j + 0.5) / S * 2 - 1;
        const qx = Math.abs(x) - 0.82, qy = Math.abs(y) - 0.82;
        const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 0.12;
        const inside = 1 - smoothstep(-0.12, 0.02, out);
        const hot = 0.72 + 0.28 * (1 - (x * x + y * y) * 0.5);
        const grad = gradient ? Math.pow(lerp(1.0, 0.04, (y + 1) / 2), 1.6) : 1;
        f[j * S + i] = inside * hot * grad;
      }
    }
    const tex = toTexture(finish(grayCanvas(f, S, S)));
    tex.colorSpace = THREE.NoColorSpace;
    return tex;
  });
}

export function flareTexture() {
  return memo('flare', () => {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.08, 'rgba(255,240,210,0.85)');
    g.addColorStop(0.25, 'rgba(255,200,120,0.18)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'lighter';
    const streak = (angle, len, width, alpha) => {
      ctx.save();
      ctx.translate(S / 2, S / 2);
      ctx.rotate(angle);
      const lg = ctx.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,230,190,0)');
      lg.addColorStop(0.5, `rgba(255,248,235,${alpha})`);
      lg.addColorStop(1, 'rgba(255,230,190,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(0, 0, len, width, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    streak(0, S * 0.5, 2.2, 0.95);
    streak(Math.PI / 2, S * 0.36, 1.8, 0.75);
    streak(Math.PI / 4, S * 0.18, 1.2, 0.35);
    streak(-Math.PI / 4, S * 0.18, 1.2, 0.35);
    return toTexture(c, { srgb: true });
  });
}

export function radialTexture() {
  return memo('radial', () => {
    const S = 256;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return toTexture(c);
  });
}

// Masque de gravure laser pour l'atelier sur mesure (texte libre).
// Renvoie aussi l'étendue du texte (u0..u1) et sa ligne médiane (yc, repère lame).
export function drawEngraving(canvas, info, text, font) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const spanX = info.L - info.x0, spanY = info.yMax - info.yMin;
  const texelAspect = (spanX / W) / (spanY / H);
  const x = info.engraveX;
  const yc = info.edge(x) + 0.6 * (info.spine(x) - info.edge(x));
  const px = ((x - info.x0) / spanX) * W, py = (1 - (yc - info.yMin) / spanY) * H;
  const families = {
    serif: '600 {s}px "Playfair Display", Georgia, serif',
    script: 'italic 500 {s}px "Playfair Display", Georgia, serif',
    mono: '500 {s}px "JetBrains Mono", monospace',
    sans: '600 {s}px Inter, system-ui, sans-serif',
  };
  const fam = families[font] || families.serif;
  let size = Math.round(H * 0.2);
  ctx.font = fam.replace('{s}', size);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = font === 'mono' ? '5px' : '2px';
  const maxW = W * 0.5 * texelAspect;
  let mw = ctx.measureText(text).width;
  if (mw > maxW) {
    size = Math.max(14, Math.floor((size * maxW) / mw));
    ctx.font = fam.replace('{s}', size);
    mw = ctx.measureText(text).width;
  }
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(1 / texelAspect, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
  const half = mw / texelAspect / 2;
  return {
    u0: (px - half) / W,
    u1: (px + half) / W,
    yc,
    halfH: ((size * 0.36) / H) * spanY,
  };
}

export function createCanvas(w, h) {
  return makeCanvas(w, h);
}

export function canvasToTexture(canvas) {
  return toTexture(canvas);
}
