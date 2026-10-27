// Hologramme « plan de conception » : surfaces en fresnel doré + arêtes vives,
// qui se redessinent d'une forme de lame à l'autre (offre sur mesure).
import * as THREE from 'three';
import { knifeGeometries } from './knives.js';
import { hologram } from './materials.js';
import { clamp, smoothstep, lerp, easeInOutCubic } from './util.js';

const edgeCache = new Map();
function edgesOf(geo) {
  if (!edgeCache.has(geo)) edgeCache.set(geo, new THREE.EdgesGeometry(geo, 26));
  return edgeCache.get(geo);
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
  constructor(ids = ['classique', 'ombre', 'santoku', 'dore'], period = 3.4) {
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
