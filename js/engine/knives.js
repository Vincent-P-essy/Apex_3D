// Catalogue 3D : chaque modèle est construit procéduralement (lame, mitre,
// soie, plaquettes, rivets) puis habillé de matériaux PBR.
// Repère couteau : x le long de la lame (talon en 0, pointe en +x, pommeau en -x),
// y vers le dos, z l'épaisseur. 1 unité ≈ 10 cm.
import * as THREE from 'three';
import { monotone, lerp, smoothstep, clamp } from './util.js';
import { buildBlade, buildSweep, buildPlate, buildPin, buildGrommet } from './geometry.js';
import { paintBlade, woodTextures, g10Textures, gripTextures, microTextures, memo } from './textures.js';
import { knifeUniforms, metal, coating, polymer } from './materials.js';

const GOLD = 0xf2c879;
const STEEL = 0xc9cdd3;

// Dents (crantage, scie) : fonction additive + points de rupture pour des angles nets.
function teeth(a, b, period, amp, ratio = 0.5) {
  const breaks = [];
  for (let x = a; x <= b + 1e-9; x += period) {
    breaks.push(x, Math.min(b, x + period * ratio));
  }
  const fn = (x) => {
    if (x < a || x > b) return 0;
    const f = ((x - a) / period) % 1;
    return amp * (f < ratio ? f / ratio : (1 - f) / (1 - ratio));
  };
  return { fn, breaks };
}

function handleProfile(top, bot, w) {
  return (t) => ({ y: (top(t) + bot(t)) / 2, h: (top(t) - bot(t)) / 2, w: w(t) });
}

function xToT(x, x0, x1) {
  return clamp((x - x0) / (x1 - x0));
}

// ---------------------------------------------------------------------------
const MODELS = {
  classique: {
    name: 'Le Classique',
    build() {
      const L = 2.05;
      const spine = monotone([[-0.06, 0.122], [0, 0.124], [0.55, 0.13], [1.1, 0.115], [1.5, 0.078], [1.8, 0.022], [2.05, -0.075]]);
      const edge = monotone([[-0.06, -0.17], [-0.01, -0.21], [0.03, -0.336], [0.15, -0.352], [0.85, -0.348], [1.3, -0.318], [1.64, -0.25], [1.9, -0.158], [2.05, -0.075]]);
      const blade = buildBlade({
        length: L, spine, edge, thickness: 0.024, taper: 0.62,
        section: (s, T) => [{ v: 0, t: 0.0016 }, { v: 0.022, t: 0.005 }, { v: 0.5, t: T * 0.9 }, { v: 1, t: T }],
        strips: [{ group: 1 }, { group: 1, rows: 3, bulge: 0.05 }, { group: 0, rows: 2 }],
      });
      const tex = paintBlade(blade.info, { rough: 0.2, brushed: 0.8, seed: 11, etch: { x: 0.36, vb: 0.66, size: 0.068, sub: 'PLA+ · FINI MAIN' } });
      blade.info.engraveX = 1.02;

      const hx0 = -0.12, hx1 = -1.32;
      const H = monotone([[0, 0.152], [0.18, 0.142], [0.6, 0.163], [0.9, 0.171], [1, 0.167]]);
      const Wd = monotone([[0, 0.057], [0.5, 0.062], [1, 0.056]]);
      const prof = (t) => ({ y: -0.012 - 0.035 * t * t, h: H(t), w: Wd(t) });
      const handle = buildSweep({ x0: hx0, x1: hx1, samples: 110, ring: 64, power: 3.0, profile: prof, endDome: 0.06, uScale: 3, vScale: 2 });
      const plate = buildPlate({
        x0: -0.125, x1: hx1, thickness: 0.021,
        top: (x) => { const p = prof(xToT(x, hx0, hx1)); return p.y + p.h + 0.0012; },
        bottom: (x) => { const p = prof(xToT(x, hx0, hx1)); return p.y - p.h - 0.0012; },
      });
      const bolster = buildSweep({
        x0: -0.135, x1: 0.035, samples: 28, ring: 56, power: 3.6,
        profile: (t) => ({ y: lerp(-0.034, -0.088, t * t), h: lerp(0.17, 0.226, Math.pow(t, 1.4)), w: lerp(0.064, 0.025, smoothstep(0.3, 1, t)) }),
      });
      const pins = [0.2, 0.5, 0.8].map((t) => {
        const p = prof(t);
        const g = buildPin(0.024, p.w * 2 + 0.004);
        g.translate(lerp(hx0, hx1, t), p.y, 0);
        return g;
      });
      const micro = microTextures();
      return {
        blade,
        parts: [
          { geo: blade.geometry, mat: ['flat', 'bevel', 'spine'] },
          { geo: handle, mat: 'handle' },
          { geo: plate, mat: 'tang' },
          { geo: bolster, mat: 'gold' },
          ...pins.map((g) => ({ geo: g, mat: 'gold' })),
        ],
        materials: {
          flat: (U, o) => metal(U, { color: STEEL, map: tex.map, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, normalScale: 0.5, anisotropy: 0.6, etch: !!o.etch }),
          bevel: (U) => metal(U, { color: 0xd8dbdf, roughness: 0.5, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, normalScale: 0.35, anisotropy: 0.3, edge: true }),
          spine: (U) => metal(U, { color: STEEL, roughness: 0.32 }),
          handle: (U) => polymer(U, { color: 0x0c0c0e, roughness: 0.55, roughnessMap: micro.roughnessMap, normalMap: micro.normalMap, normalScale: 0.35, clearcoat: 0.55, clearcoatRoughness: 0.28, repeat: [6, 4] }),
          tang: (U) => metal(U, { color: STEEL, roughness: 0.3 }),
          gold: (U) => metal(U, { color: GOLD, roughness: 0.2 }),
        },
      };
    },
  },

  ombre: {
    name: "L'Ombre",
    build() {
      const L = 1.55;
      const jimp = teeth(0.03, 0.27, 0.024, 0.006, 0.5);
      const spine = monotone([[-0.06, 0.13], [0, 0.13], [0.86, 0.13], [1.0, 0.12], [1.18, 0.083], [1.4, 0.008], [1.55, -0.045]]);
      const edge = monotone([[-0.06, -0.15], [0, -0.165], [0.055, -0.135], [0.12, -0.205], [0.3, -0.226], [0.9, -0.224], [1.18, -0.186], [1.4, -0.112], [1.55, -0.045]]);
      const blade = buildBlade({
        length: L, spine, edge, thickness: 0.034, taper: 0.35, breaks: jimp.breaks, spineDetail: (x) => -jimp.fn(x),
        section: (s, T, x) => {
          const sw = smoothstep(0.92, 1.38, x);
          return [{ v: 0, t: 0.002 }, { v: 0.04, t: 0.0075 }, { v: 0.47, t: T }, { v: 0.84, t: T }, { v: 1, t: T * lerp(1, 0.3, sw) }];
        },
        strips: [{ group: 1 }, { group: 1, rows: 2 }, { group: 0 }, { group: 0 }],
      });
      const tex = paintBlade(blade.info, { rough: 0.46, brushed: 0.15, baseLum: 0.3, etchLight: true, seed: 23, etch: { x: 0.42, vb: 0.66, size: 0.06, sub: 'TACTICAL · PETG' } });

      const hx0 = -0.03, hx1 = -1.2;
      const top = monotone([[0, 0.132], [0.3, 0.142], [0.75, 0.136], [1, 0.128]]);
      const bot = monotone([[0, -0.152], [0.12, -0.128], [0.24, -0.168], [0.42, -0.158], [0.75, -0.162], [1, -0.178]]);
      const prof = handleProfile(top, bot, (t) => 0.068 + 0.005 * Math.sin(Math.PI * t));
      const handle = buildSweep({ x0: hx0, x1: hx1, samples: 110, ring: 60, power: 2.4, profile: prof, endDome: 0.035, uScale: 4, vScale: 2 });
      const guard = (x) => 0.065 * (1 - smoothstep(-0.11, -0.03, x)) * smoothstep(-0.2, -0.11, x);
      const plate = buildPlate({
        x0: -0.04, x1: hx1, thickness: 0.026, samples: 120,
        top: (x) => { const p = prof(xToT(x, hx0, hx1)); return p.y + p.h + 0.0015; },
        bottom: (x) => { const p = prof(xToT(x, hx0, hx1)); return p.y - p.h - 0.0015 - guard(x); },
      });
      const pins = [0.3, 0.72].map((t) => {
        const p = prof(t);
        const g = buildPin(0.019, p.w * 2 + 0.003, 0.1);
        g.translate(lerp(hx0, hx1, t), p.y, 0);
        return g;
      });
      const pr = prof(0.93);
      const lanyard = buildGrommet(0.022, 0.034, pr.w * 2 + 0.006);
      lanyard.translate(lerp(hx0, hx1, 0.93), pr.y, 0);
      const g10 = g10Textures();
      return {
        blade,
        parts: [
          { geo: blade.geometry, mat: ['flat', 'bevel', 'flat'] },
          { geo: handle, mat: 'handle' },
          { geo: plate, mat: 'flat' },
          ...pins.map((g) => ({ geo: g, mat: 'pin' })),
          { geo: lanyard, mat: 'pin' },
        ],
        materials: {
          flat: (U) => coating(U, { color: 0xa9adb3, map: tex.map, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, metalness: 0.5, normalScale: 0.4 }),
          bevel: (U) => metal(U, { color: STEEL, roughness: 0.3, anisotropy: 0.4, edge: true }),
          handle: (U) => polymer(U, { color: 0x18191b, roughness: 1, roughnessMap: g10.roughnessMap, normalMap: g10.normalMap, normalScale: 0.9, repeat: [5, 2.2] }),
          pin: (U) => metal(U, { color: 0xb9bec5, roughness: 0.35 }),
        },
        tint: 'dark',
      };
    },
  },

  dore: {
    name: 'Le Doré',
    build() {
      const L = 2.0;
      const hh = monotone([[-0.06, 0.1], [0, 0.135], [0.14, 0.168], [0.5, 0.176], [1.0, 0.148], [1.45, 0.092], [1.8, 0.036], [2.0, 0]]);
      const spine = (x) => hh(x), edge = (x) => -hh(x);
      const blade = buildBlade({
        length: L, spine, edge, thickness: 0.052, taper: 0.72, spineGroup: 1,
        section: (s, T) => [{ v: 0, t: 0.0022 }, { v: 0.03, t: 0.0075 }, { v: 0.5, t: T }, { v: 0.97, t: 0.0075 }, { v: 1, t: 0.0022 }],
        strips: [{ group: 1 }, { group: 0, rows: 4, bulge: -0.05 }, { group: 0, rows: 4, bulge: -0.05 }, { group: 1 }],
      });
      const tex = paintBlade(blade.info, { rough: 0.17, brushed: 0.25, seed: 5, deco: true, relief: 2.8 });

      // garde à quillons recourbés vers la lame
      const guard = buildSweep({
        x0: -0.42, x1: 0.42, samples: 64, ring: 40, power: 2.4,
        profile: (t) => { const e = Math.abs(t * 2 - 1); return { y: 0, h: lerp(0.03, 0.046, smoothstep(0.5, 1, e)), w: lerp(0.048, 0.062, smoothstep(0.5, 1, e)) }; },
        startDome: 0.03, endDome: 0.03,
      });
      guard.rotateZ(Math.PI / 2);
      const gp = guard.attributes.position;
      for (let i = 0; i < gp.count; i++) gp.setX(i, gp.getX(i) + 0.15 * Math.pow(Math.abs(gp.getY(i)) / 0.45, 2.4));
      guard.translate(-0.03, 0, 0);
      guard.computeVertexNormals();
      const finials = [-1, 1].map((s) => {
        const g = new THREE.SphereGeometry(0.044, 32, 20);
        g.translate(-0.03 + 0.165, s * 0.47, 0);
        return g;
      });
      const gx0 = -0.065, gx1 = -0.9;
      const grip = buildSweep({
        x0: gx0, x1: gx1, samples: 90, ring: 48, power: 2,
        profile: (t) => ({ y: 0, h: 0.07 + 0.02 * Math.sin(Math.PI * t), w: 0.066 + 0.018 * Math.sin(Math.PI * t) }),
        uScale: 2, vScale: 1,
      });
      const rings = [0.03, 0.5, 0.97].map((t) => {
        const h = 0.07 + 0.02 * Math.sin(Math.PI * t), w = 0.066 + 0.018 * Math.sin(Math.PI * t);
        const g = new THREE.TorusGeometry(1, 0.12, 16, 64);
        g.rotateY(Math.PI / 2);
        g.scale(0.14, h * 1.03, w * 1.03);
        g.translate(lerp(gx0, gx1, t), 0, 0);
        g.computeVertexNormals();
        return g;
      });
      const pommel = new THREE.IcosahedronGeometry(0.09, 1);
      pommel.scale(1.3, 1, 1);
      pommel.translate(gx1 - 0.1, 0, 0);
      const micro = microTextures();
      return {
        blade,
        parts: [
          { geo: blade.geometry, mat: ['flat', 'bevel', 'bevel'] },
          { geo: guard, mat: 'gold' },
          ...finials.map((g) => ({ geo: g, mat: 'gold' })),
          { geo: grip, mat: 'lacquer' },
          ...rings.map((g) => ({ geo: g, mat: 'gold' })),
          { geo: pommel, mat: 'jewel' },
        ],
        materials: {
          flat: (U) => metal(U, { color: GOLD, map: tex.map, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, normalScale: 0.7 }),
          bevel: (U) => metal(U, { color: 0xffe0a0, roughness: 0.55, roughnessMap: tex.roughnessMap, edge: true }),
          gold: (U) => metal(U, { color: GOLD, roughness: 0.18 }),
          jewel: (U) => metal(U, { color: GOLD, roughness: 0.12, flat: true }),
          lacquer: (U) => polymer(U, { color: 0x050506, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, roughnessMap: micro.roughnessMap, normalMap: micro.normalMap, normalScale: 0.08, repeat: [4, 2] }),
        },
      };
    },
  },

  santoku: {
    name: 'Le Santoku',
    build() {
      const L = 1.8;
      const spine = monotone([[-0.06, 0.06], [-0.005, 0.068], [0.02, 0.128], [1.0, 0.13], [1.3, 0.105], [1.52, 0.035], [1.7, -0.1], [1.8, -0.262]]);
      const edge = monotone([[-0.06, -0.1], [-0.005, -0.118], [0.03, -0.333], [0.15, -0.338], [1.2, -0.336], [1.55, -0.318], [1.72, -0.29], [1.8, -0.262]]);
      const blade = buildBlade({
        length: L, spine, edge, thickness: 0.021, taper: 0.55,
        section: (s, T) => [{ v: 0, t: 0.0013 }, { v: 0.025, t: 0.0042 }, { v: 0.44, t: T * 0.86 }, { v: 1, t: T }],
        strips: [{ group: 1 }, { group: 1, rows: 3, bulge: 0.05 }, { group: 0, rows: 2 }],
      });
      const tex = paintBlade(blade.info, {
        rough: 0.2, brushed: 0.35, seed: 31,
        damascus: { density: 64, warp: 2.4, contrast: 0.42 },
        dimples: { from: 0.16, to: 1.15, count: 9, vb: 0.25, rx: 0.04, ry: 0.02 },
        etch: { x: 0.3, vb: 0.7, size: 0.055, sub: 'SANTOKU · PLA+' },
      });
      const ferrule = buildSweep({ x0: 0, x1: -0.11, samples: 10, ring: 48, power: 2.2, profile: () => ({ y: -0.03, h: 0.118, w: 0.088 }) });
      const handle = buildSweep({
        x0: -0.105, x1: -1.38, samples: 40, facets: 8,
        profile: (t) => ({ y: -0.03, h: lerp(0.108, 0.123, t), w: lerp(0.082, 0.095, t) }), uScale: 1, vScale: 1,
      });
      const endCap = buildSweep({ x0: -1.375, x1: -1.43, samples: 6, facets: 8, profile: () => ({ y: -0.03, h: 0.1235, w: 0.0955 }) });
      const wood = woodTextures();
      return {
        blade,
        parts: [
          { geo: blade.geometry, mat: ['flat', 'bevel', 'spine'] },
          { geo: ferrule, mat: 'gold' },
          { geo: handle, mat: 'wood' },
          { geo: endCap, mat: 'horn' },
        ],
        materials: {
          flat: (U) => metal(U, { color: 0xccd0d5, map: tex.map, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, normalScale: 0.8, anisotropy: 0.35 }),
          bevel: (U) => metal(U, { color: 0xd8dbdf, map: tex.map, roughness: 0.62, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, normalScale: 0.9, edge: true }),
          spine: (U) => metal(U, { color: STEEL, roughness: 0.3 }),
          gold: (U) => metal(U, { color: GOLD, roughness: 0.16 }),
          wood: (U) => polymer(U, { color: 0xffffff, map: wood.map, roughness: 1, roughnessMap: wood.roughnessMap, normalMap: wood.normalMap, normalScale: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.3 }),
          horn: (U) => polymer(U, { color: 0x0b0908, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
        },
      };
    },
  },

  ranger: {
    name: 'Le Ranger',
    build() {
      const L = 1.9;
      const saw = teeth(0.24, 0.9, 0.055, 0.034, 0.72);
      const spine = monotone([[-0.06, 0.15], [0, 0.15], [0.95, 0.15], [1.3, 0.13], [1.62, 0.055], [1.9, -0.06]]);
      const edge = monotone([[-0.06, -0.24], [0, -0.26], [0.06, -0.3], [0.3, -0.312], [1.05, -0.306], [1.45, -0.262], [1.72, -0.168], [1.9, -0.06]]);
      const fuller = (x) => 0.34 * smoothstep(0.12, 0.26, x) * (1 - smoothstep(1.0, 1.16, x));
      const blade = buildBlade({
        length: L, spine, edge, thickness: 0.046, taper: 0.42, breaks: saw.breaks, spineDetail: saw.fn,
        section: (s, T) => [{ v: 0, t: 0.0022 }, { v: 0.035, t: 0.009 }, { v: 0.4, t: T }, { v: 0.55, t: T }, { v: 0.74, t: T }, { v: 1, t: T }],
        strips: [{ group: 1 }, { group: 1, rows: 2 }, { group: 0 }, { group: 0, rows: 6, bulge: (x) => -fuller(x) }, { group: 0 }],
      });
      const tex = paintBlade(blade.info, { rough: 0.42, brushed: 0.2, stonewash: true, seed: 17, etch: { x: 0.36, vb: 0.47, size: 0.06, sub: 'RANGER · ABS' } });

      const hx0 = -0.05, hx1 = -1.3;
      const top = monotone([[0, 0.146], [0.5, 0.152], [1, 0.14]]);
      const bot = monotone([[0, -0.172], [0.1, -0.15], [0.2, -0.18], [0.3, -0.152], [0.4, -0.18], [0.5, -0.155], [0.62, -0.182], [1, -0.186]]);
      const prof = handleProfile(top, bot, (t) => 0.078 + 0.008 * Math.sin(Math.PI * t));
      const handle = buildSweep({ x0: hx0, x1: hx1, samples: 130, ring: 60, power: 2.3, profile: prof, uScale: 1.6, vScale: 1.2 });
      const guard = buildSweep({
        x0: -0.37, x1: 0.23, samples: 40, ring: 40, power: 3.2,
        profile: () => ({ y: 0, h: 0.022, w: 0.064 }), startDome: 0.02, endDome: 0.02,
      });
      guard.rotateZ(Math.PI / 2);
      guard.translate(-0.03, 0, 0);
      const pommel = buildSweep({
        x0: hx1 + 0.005, x1: hx1 - 0.13, samples: 20, ring: 48, power: 3,
        profile: (t) => ({ y: -0.018, h: lerp(0.168, 0.14, t), w: lerp(0.083, 0.074, t) }), endDome: 0.035,
      });
      const lanyard = buildGrommet(0.024, 0.036, 0.083 * 2 + 0.01);
      lanyard.translate(hx1 - 0.075, -0.018, 0);
      const grip = gripTextures();
      return {
        blade,
        parts: [
          { geo: blade.geometry, mat: ['flat', 'bevel', 'flat'] },
          { geo: handle, mat: 'grip' },
          { geo: guard, mat: 'gun' },
          { geo: pommel, mat: 'gun' },
          { geo: lanyard, mat: 'bright' },
        ],
        materials: {
          flat: (U) => metal(U, { color: 0x8d9299, map: tex.map, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, normalScale: 0.5 }),
          bevel: (U) => metal(U, { color: 0xd7dbe0, roughness: 0.6, roughnessMap: tex.roughnessMap, normalMap: tex.normalMap, normalScale: 0.5, edge: true }),
          gun: (U) => metal(U, { color: 0x7d8289, roughness: 0.42 }),
          bright: (U) => metal(U, { color: 0xc9cdd2, roughness: 0.25 }),
          grip: (U) => polymer(U, { color: 0x1d2019, roughness: 1, roughnessMap: grip.roughnessMap, normalMap: grip.normalMap, normalScale: 0.8, repeat: [1, 1] }),
        },
      };
    },
  },
};

export const MODEL_IDS = Object.keys(MODELS);

function definition(id) {
  return memo('knife:' + id, () => {
    const def = MODELS[id].build();
    const box = new THREE.Box3();
    def.parts.forEach((p) => {
      p.geo.computeBoundingBox();
      box.union(p.geo.boundingBox);
    });
    def.box = box;
    return def;
  });
}

// Instancie un couteau : géométries et textures partagées, matériaux propres
// (chaque instance anime indépendamment impression, éclat, gravure…).
export function createKnife(id, opts = {}) {
  const def = definition(id);
  const U = knifeUniforms();
  const mats = {};
  const get = (k) => (mats[k] ??= def.materials[k](U, opts));
  const group = new THREE.Group();
  def.parts.forEach((p) => {
    const material = Array.isArray(p.mat) ? p.mat.map(get) : get(p.mat);
    group.add(new THREE.Mesh(p.geo, material));
  });
  const box = def.box;
  return {
    id,
    group,
    U,
    mats,
    materials: Object.values(mats),
    box,
    info: def.blade.info,
    length: box.max.x - box.min.x,
    center: box.getCenter(new THREE.Vector3()),
    setPrint(p) {
      U.uPrint.value = lerp(box.min.x - 0.02, box.max.x + 0.02, clamp(p));
    },
    printFront() {
      return U.uPrint.value;
    },
  };
}

// Silhouette pour l'hologramme : mêmes géométries, sans matériaux.
export function knifeGeometries(id) {
  const def = definition(id);
  return { parts: def.parts.map((p) => p.geo), box: def.box };
}

// Préchauffe les définitions (géométries + textures) pour mesurer la progression.
export function prepareModel(id) {
  definition(id);
}
