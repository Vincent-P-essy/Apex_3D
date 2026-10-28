// Hologramme « plan de conception » : surfaces en fresnel doré + arêtes vives,
// qui se redessinent d'une forme de lame à l'autre (offre sur mesure).
import * as THREE from 'three';
import { knifeGeometries, prepareModelAsync } from './knives.js';
import { hologram } from './materials.js';
import { clamp, smoothstep, lerp, easeInOutCubic, lazyValue } from './util.js';

export const HOLO_IDS = ['classique', 'ombre', 'santoku', 'dore'];

// Arêtes vives (même résultat qu'EdgesGeometry) avec des clés numériques au lieu
// de chaînes, calculées par étapes : plusieurs fois plus rapide, jamais d'un bloc.
function* edgeSteps(geo, thresholdAngle) {
  const P = 1e4, B = 131072, O = 65536; // positions quantifiées à 1e-4, 17 bits par axe
  const pos = geo.getAttribute('position'), index = geo.getIndex();
  const count = index ? index.count : pos.count;
  const nv = pos.count;
  const cosT = Math.cos(THREE.MathUtils.DEG2RAD * thresholdAngle);
  const ids = new Map();
  const vid = (i) => {
    const k = ((Math.round(pos.getX(i) * P) + O) * B + (Math.round(pos.getY(i) * P) + O)) * B + (Math.round(pos.getZ(i) * P) + O);
    let id = ids.get(k);
    if (id === undefined) ids.set(k, (id = ids.size));
    return id;
  };
  const normals = new Float32Array(count);
  const open = new Map(); // arête orientée (a→b) → [face, sommet 0, sommet 1], ou null une fois appariée
  const out = [];
  const push = (i) => out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  const vi = [0, 0, 0], vk = [0, 0, 0];
  for (let f = 0; f < count; f += 3) {
    for (let j = 0; j < 3; j++) {
      vi[j] = index ? index.getX(f + j) : f + j;
      vk[j] = vid(vi[j]);
    }
    if (vk[0] === vk[1] || vk[1] === vk[2] || vk[2] === vk[0]) continue;
    const ax = pos.getX(vi[0]), ay = pos.getY(vi[0]), az = pos.getZ(vi[0]);
    const bx = pos.getX(vi[1]), by = pos.getY(vi[1]), bz = pos.getZ(vi[1]);
    const ux = pos.getX(vi[2]) - bx, uy = pos.getY(vi[2]) - by, uz = pos.getZ(vi[2]) - bz;
    const wx = ax - bx, wy = ay - by, wz = az - bz;
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 0) { nx /= len; ny /= len; nz /= len; }
    normals[f] = nx; normals[f + 1] = ny; normals[f + 2] = nz;
    for (let j = 0; j < 3; j++) {
      const n = (j + 1) % 3;
      const fwd = vk[j] * nv + vk[n], rev = vk[n] * nv + vk[j];
      const other = open.get(rev);
      if (other) {
        const g = other[0];
        if (nx * normals[g] + ny * normals[g + 1] + nz * normals[g + 2] <= cosT) {
          push(vi[j]);
          push(vi[n]);
        }
        open.set(rev, null);
      } else if (!open.has(fwd)) {
        open.set(fwd, [f, vi[j], vi[n]]);
      }
    }
    if (f % 4500 === 0) yield;
  }
  for (const e of open.values()) {
    if (!e) continue;
    push(e[1]);
    push(e[2]);
  }
  const edges = new THREE.BufferGeometry();
  edges.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return edges;
}

const edgeCache = new Map();
function edgesLazy(geo) {
  if (!edgeCache.has(geo)) edgeCache.set(geo, lazyValue(() => edgeSteps(geo, 26)));
  return edgeCache.get(geo);
}
const edgesOf = (geo) => edgesLazy(geo)();

// Prépare par tranches la géométrie et les arêtes des hologrammes de ces modèles.
export async function prepareHolo(ids, pause) {
  for (const id of ids) {
    await prepareModelAsync(id, pause, { textures: false });
    for (const geo of knifeGeometries(id).parts) await edgesLazy(geo).prepare(pause);
  }
}

export function buildHolo(id) {
  const { parts, box } = knifeGeometries(id);
  const surface = hologram();
  const line = hologram();
  line.uniforms.uLine.value = 1;
  surface.premultipliedAlpha = line.premultipliedAlpha = true;
  const group = new THREE.Group();
  parts.forEach((geo) => {
    group.add(new THREE.Mesh(geo, surface));
    group.add(new THREE.LineSegments(edgesOf(geo), line));
  });
  const center = box.getCenter(new THREE.Vector3());
  group.position.copy(center).multiplyScalar(-1);
  const holder = new THREE.Group();
  holder.add(group);
  return {
    object: holder,
    box,
    set(reveal, fade, time) {
      const x = lerp(box.min.x - 0.05, box.max.x + 0.05, clamp(reveal));
      for (const m of [surface, line]) {
        m.uniforms.uReveal.value = x;
        m.uniforms.uFade.value = fade;
        m.uniforms.uTime.value = time;
      }
      holder.visible = fade > 0.001 && reveal > 0;
    },
  };
}

// Cycle de formes (carte « Sur mesure », visionneuse).
export class HoloCycle {
  constructor(ids = HOLO_IDS, period = 3.4) {
    this.object = new THREE.Group();
    this.shapes = ids.map((id) => {
      const h = buildHolo(id);
      this.object.add(h.object);
      return h;
    });
    this.period = period;
    const grid = new THREE.GridHelper(6, 24, 0xc9a84c, 0xc9a84c);
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    grid.material.blending = THREE.AdditiveBlending;
    grid.material.depthWrite = false;
    grid.position.y = -1.0;
    this.grid = grid;
    this.object.add(grid);
  }

  update(t) {
    const n = this.shapes.length;
    const cycle = t / this.period;
    const cur = Math.floor(cycle) % n;
    const local = cycle - Math.floor(cycle);
    this.shapes.forEach((s, i) => {
      if (i === cur) {
        const reveal = easeInOutCubic(smoothstep(0, 0.42, local));
        const fade = 1 - smoothstep(0.86, 1.0, local);
        s.set(reveal, fade, t);
      } else {
        s.set(0, 0, t);
      }
    });
  }
}
