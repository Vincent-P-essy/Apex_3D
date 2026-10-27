// Géométrie paramétrique : lames à émouture réelle, manches ergonomiques balayés.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

const outwardCheck = new THREE.Vector3();
const ab = new THREE.Vector3();
const ac = new THREE.Vector3();

// Ajoute une grille (colonnes × rangées) et ses triangles, orientés vers `outward`.
function pushGrid(acc, nCols, nRows, pointAt, uvAt, group, outward) {
  const base = acc.count;
  for (let i = 0; i < nCols; i++) {
    for (let r = 0; r <= nRows; r++) {
      const p = pointAt(i, r);
      acc.pos.push(p[0], p[1], p[2]);
      const uv = uvAt(p, i, r);
      acc.uv.push(uv[0], uv[1]);
      acc.count++;
    }
  }
  const stride = nRows + 1;
  // orientation : on teste le premier quad non dégénéré
  let flip = false;
  search: for (let i = 0; i < nCols - 1; i++) {
    for (let r = 0; r < nRows; r++) {
      const a = (base + i * stride + r) * 3, b = (base + (i + 1) * stride + r) * 3, c = (base + (i + 1) * stride + r + 1) * 3;
      ab.set(acc.pos[b] - acc.pos[a], acc.pos[b + 1] - acc.pos[a + 1], acc.pos[b + 2] - acc.pos[a + 2]);
      ac.set(acc.pos[c] - acc.pos[a], acc.pos[c + 1] - acc.pos[a + 1], acc.pos[c + 2] - acc.pos[a + 2]);
      ab.cross(ac);
      if (ab.lengthSq() < 1e-14) continue;
      outward(outwardCheck, acc.pos[a], acc.pos[a + 1], acc.pos[a + 2]);
      flip = ab.dot(outwardCheck) < 0;
      break search;
    }
  }
  const I = (acc.groups[group] ??= []);
  for (let i = 0; i < nCols - 1; i++) {
    for (let r = 0; r < nRows; r++) {
      const a = base + i * stride + r, b = base + (i + 1) * stride + r, c = b + 1, d = a + 1;
      if (flip) I.push(a, c, b, a, d, c); else I.push(a, b, c, a, c, d);
    }
  }
}

function finalize(acc) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
  const index = [];
  Object.keys(acc.groups).sort((a, b) => a - b).forEach((key) => {
    const list = acc.groups[key];
    g.addGroup(index.length, list.length, Number(key));
    for (let i = 0; i < list.length; i++) index.push(list[i]);
  });
  g.setIndex(index);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// Lame. La section est décrite par des nœuds {v, t} (v : 0 tranchant → 1 dos,
// t : épaisseur totale). Chaque bande entre deux nœuds a ses propres sommets :
// les arêtes d'émouture restent nettes, comme sur une vraie lame meulée.
// Groupes de matériaux : 0 plats, 1 biseaux/fil, 2 dos et talon.
// ---------------------------------------------------------------------------
export function buildBlade(spec) {
  const L = spec.length;
  const x0 = -(spec.heel ?? 0.05);
  const N = spec.samples ?? 240;
  let S = [];
  for (let i = 0; i <= N; i++) S.push(i / N);
  if (spec.breaks) S = S.concat(spec.breaks.map((x) => (x - x0) / (L - x0)).filter((s) => s > 0 && s < 1));
  S.sort((a, b) => a - b);
  S = S.filter((s, i) => i === 0 || s - S[i - 1] > 1e-6);

  let yMin = Infinity, yMax = -Infinity;
  // `spine` reste lisse (répartition des bandes) ; `spineDetail` (crantage, scie)
  // ne déforme que la bande supérieure et le dos.
  const detail = spec.spineDetail || (() => 0);
  const cols = S.map((s) => {
    const x = x0 + s * (L - x0);
    const ys = spec.spine(x), ye = spec.edge(x);
    const top = ys + detail(x);
    const sb = clamp(x / L);
    const T = spec.thickness * (1 - (spec.taper ?? 0.55) * Math.pow(sb, 1.6));
    const nodes = spec.section(sb, T, x);
    const yN = nodes.map((n, j) => (j === nodes.length - 1 ? top : ye + n.v * (ys - ye)));
    yMin = Math.min(yMin, top, ye);
    yMax = Math.max(yMax, top, ye);
    return { x, ys, ye, top, T, nodes, yN };
  });
  const info = { x0, L, yMin, yMax, spine: spec.spine, edge: spec.edge };
  const uvAt = (p) => [(p[0] - x0) / (L - x0), (p[1] - yMin) / (yMax - yMin)];
  const acc = { pos: [], uv: [], groups: {}, count: 0 };
  const nCols = cols.length;
  const nodesCount = cols[0].nodes.length;
  const sideOut = (z) => (o) => o.set(0, 0, z);

  for (let side = -1; side <= 1; side += 2) {
    spec.strips.forEach((strip, j) => {
      const rows = strip.rows ?? 1;
      const pointAt = (i, r) => {
        const c = cols[i];
        const n0 = c.nodes[j], n1 = c.nodes[j + 1];
        const k = r / rows;
        const bulge = typeof strip.bulge === 'function' ? strip.bulge(c.x) : (strip.bulge ?? 0);
        const t = Math.max(0.0004, lerp(n0.t, n1.t, k) + bulge * Math.sin(Math.PI * k) * c.T);
        return [c.x, lerp(c.yN[j], c.yN[j + 1], k), side * t * 0.5];
      };
      pushGrid(acc, nCols, rows, pointAt, uvAt, strip.group, sideOut(side));
    });
  }

  // dos (vers +y) et fil (vers -y)
  const last = nodesCount - 1;
  pushGrid(acc, nCols, 1, (i, r) => {
    const c = cols[i];
    return [c.x, c.top, (r ? -1 : 1) * Math.max(0.0004, c.nodes[last].t) * 0.5];
  }, uvAt, spec.spineGroup ?? 2, (o, x, y) => o.set(0, 1, 0));
  pushGrid(acc, nCols, 1, (i, r) => {
    const c = cols[i];
    return [c.x, c.ye, (r ? -1 : 1) * Math.max(0.0004, c.nodes[0].t) * 0.5];
  }, uvAt, 1, (o) => o.set(0, -1, 0));

  // talon (caché dans la mitre / le manche, mais fermé proprement)
  const c0 = cols[0];
  const ring = [];
  c0.nodes.forEach((n, j) => ring.push([c0.x, c0.yN[j], n.t * 0.5]));
  for (let j = c0.nodes.length - 1; j >= 0; j--) ring.push([c0.x, c0.yN[j], -c0.nodes[j].t * 0.5]);
  const cy = (c0.top + c0.ye) / 2;
  const base = acc.count;
  acc.pos.push(c0.x, cy, 0);
  acc.uv.push(0, 0.5);
  acc.count++;
  ring.forEach((p) => { acc.pos.push(p[0], p[1], p[2]); acc.uv.push(0, 0.5); acc.count++; });
  const I = (acc.groups[2] ??= []);
  for (let k = 0; k < ring.length; k++) {
    const a = base + 1 + k, b = base + 1 + ((k + 1) % ring.length);
    I.push(base, a, b);
  }

  const geometry = finalize(acc);
  return { geometry, info };
}

// ---------------------------------------------------------------------------
// Balayage d'une section le long de x : superellipse (manches, mitres) ou
// polygone à facettes (manche japonais octogonal).
// spec.profile(t) -> { y, h, w } pour t ∈ [0, 1]
// ---------------------------------------------------------------------------
export function buildSweep(spec) {
  const { x0, x1 } = spec;
  const samples = spec.samples ?? 96;
  const rings = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    rings.push({ x: lerp(x0, x1, t), t, ...spec.profile(t) });
  }
  const dir = Math.sign(x1 - x0);
  const dome = (len, at, sign) => {
    const out = [];
    const K = 12;
    for (let k = 1; k <= K; k++) {
      const a = (k / K) * Math.PI / 2;
      const s = Math.cos(a);
      out.push({ x: at.x + sign * len * Math.sin(a), t: at.t, y: at.y, h: at.h * s, w: at.w * s });
    }
    return out;
  };
  if (spec.endDome) rings.push(...dome(spec.endDome, rings[rings.length - 1], dir));
  if (spec.startDome) rings.unshift(...dome(spec.startDome, rings[0], -dir).reverse());

  const acc = { pos: [], uv: [], groups: {}, count: 0 };
  const uScale = spec.uScale ?? 1;
  const vScale = spec.vScale ?? 1;
  const outward = (o, x, y, z) => {
    // direction radiale par rapport à l'axe local de la section la plus proche
    let best = rings[0], bd = Infinity;
    for (const r of rings) { const d = Math.abs(r.x - x); if (d < bd) { bd = d; best = r; } }
    o.set(0, y - best.y, z);
    if (o.lengthSq() < 1e-12) o.set(dir, 0, 0);
  };

  if (spec.facets) {
    const F = spec.facets;
    const k = 1 / Math.cos(Math.PI / F);
    for (let f = 0; f < F; f++) {
      const a0 = ((f - 0.5) / F) * Math.PI * 2, a1 = ((f + 0.5) / F) * Math.PI * 2;
      pushGrid(acc, rings.length, 1, (i, r) => {
        const R = rings[i], a = r ? a1 : a0;
        return [R.x, R.y + R.h * Math.cos(a) * k, R.w * Math.sin(a) * k];
      }, (p, i, r) => [rings[i].t * uScale, ((f + r) / F) * vScale], 0, outward);
    }
  } else {
    const M = spec.ring ?? 56;
    const pw = 2 / (spec.power ?? 2.6);
    const shape = [];
    for (let m = 0; m <= M; m++) {
      const th = (m / M) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      shape.push([Math.sign(c) * Math.pow(Math.abs(c), pw), Math.sign(s) * Math.pow(Math.abs(s), pw)]);
    }
    pushGrid(acc, rings.length, M, (i, m) => {
      const R = rings[i];
      return [R.x, R.y + R.h * shape[m][0], R.w * shape[m][1]];
    }, (p, i, m) => [rings[i].t * uScale, (m / M) * vScale], 0, outward);
  }

  // bouchons plats aux extrémités sans dôme
  const cap = (R, sign) => {
    if (R.h < 1e-5) return;
    const base = acc.count;
    const n = spec.facets ? spec.facets : 48;
    const kf = spec.facets ? 1 / Math.cos(Math.PI / spec.facets) : 1;
    const pw = 2 / (spec.power ?? 2.6);
    acc.pos.push(R.x, R.y, 0);
    acc.uv.push(0.5, 0.5);
    acc.count++;
    for (let m = 0; m < n; m++) {
      let yy, zz;
      if (spec.facets) {
        const a = ((m - 0.5) / n) * Math.PI * 2;
        yy = Math.cos(a) * kf;
        zz = Math.sin(a) * kf;
      } else {
        const th = (m / n) * Math.PI * 2;
        const c = Math.cos(th), s = Math.sin(th);
        yy = Math.sign(c) * Math.pow(Math.abs(c), pw);
        zz = Math.sign(s) * Math.pow(Math.abs(s), pw);
      }
      acc.pos.push(R.x, R.y + R.h * yy, R.w * zz);
      acc.uv.push(0.5 + zz * 0.5, 0.5 + yy * 0.5);
      acc.count++;
    }
    const I = (acc.groups[spec.capGroup ?? 0] ??= []);
    // normale attendue : sign * dir sur x
    const ax = acc.pos[(base + 1) * 3 + 1] - R.y, az = acc.pos[(base + 1) * 3 + 2];
    const bx = acc.pos[(base + 2) * 3 + 1] - R.y, bz = acc.pos[(base + 2) * 3 + 2];
    const nx = ax * bz - az * bx; // composante x de (0,ay,az)×(0,by,bz)
    const flip = nx * sign * dir < 0;
    for (let m = 0; m < n; m++) {
      const a = base + 1 + m, b = base + 1 + ((m + 1) % n);
      if (flip) I.push(base, b, a); else I.push(base, a, b);
    }
  };
  if (!spec.startDome && spec.startCap !== false) cap(rings[0], -1);
  if (!spec.endDome && spec.endCap !== false) cap(rings[rings.length - 1], 1);

  const g = finalize(acc);

  // couture : moyenne des normales des sommets dupliqués (m = 0 et m = M)
  if (!spec.facets) {
    const M = spec.ring ?? 56;
    const nrm = g.attributes.normal;
    for (let i = 0; i < rings.length; i++) {
      const a = i * (M + 1), b = a + M;
      const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      nrm.setXYZ(a, x / l, y / l, z / l);
      nrm.setXYZ(b, x / l, y / l, z / l);
    }
    nrm.needsUpdate = true;
  }
  return g;
}

// Plaque (soie, garde intégrée) : contour dessus/dessous extrudé en épaisseur.
export function buildPlate({ top, bottom, x0, x1, thickness, samples = 90 }) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= samples; i++) {
    const x = lerp(x0, x1, i / samples);
    if (i) shape.lineTo(x, top(x)); else shape.moveTo(x, top(x));
  }
  for (let i = samples; i >= 0; i--) {
    const x = lerp(x0, x1, i / samples);
    shape.lineTo(x, bottom(x));
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -thickness / 2);
  return g;
}

// Rivet / goupille à têtes légèrement bombées, axe z.
export function buildPin(radius, length, dome = 0.22, segments = 28) {
  const hl = length / 2, d = radius * dome;
  const pts = [new THREE.Vector2(0, -hl - d)];
  for (let i = 1; i <= 5; i++) {
    const a = (i / 5) * Math.PI / 2;
    pts.push(new THREE.Vector2(radius * Math.sin(a), -hl - d * Math.cos(a)));
  }
  for (let i = 5; i >= 1; i--) {
    const a = (i / 5) * Math.PI / 2;
    pts.push(new THREE.Vector2(radius * Math.sin(a), hl + d * Math.cos(a)));
  }
  pts.push(new THREE.Vector2(0, hl + d));
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateX(Math.PI / 2);
  return g;
}

// Anneau tubulaire (passe-dragonne), axe z.
export function buildGrommet(rIn, rOut, length, segments = 32) {
  const hl = length / 2;
  const pts = [
    new THREE.Vector2(rIn, -hl), new THREE.Vector2(rOut * 0.97, -hl), new THREE.Vector2(rOut, -hl * 0.9),
    new THREE.Vector2(rOut, hl * 0.9), new THREE.Vector2(rOut * 0.97, hl), new THREE.Vector2(rIn, hl),
  ];
  const g = new THREE.LatheGeometry(pts, segments);
  g.rotateX(Math.PI / 2);
  return g;
}
