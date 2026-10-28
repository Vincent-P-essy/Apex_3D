// « Du fichier à la lame » : séquence pilotée par le défilement.
// 01 plan holographique coté → 02 impression couche par couche →
// 03 polissage (gerbe d'étincelles) → 04 dépose dans l'écrin velours.
import * as THREE from 'three';
import { createKnife } from '../engine/knives.js';
import { buildHolo } from '../engine/hologram.js';
import { hologram } from '../engine/materials.js';
import { buildSweep } from '../engine/geometry.js';
import { microTextures } from '../engine/textures.js';
import { createDust, Sparks, createFloor, createMirror, createContactShadow } from '../engine/effects.js';
import { clamp, lerp, smoothstep, easeInOutCubic, range } from '../engine/util.js';

const FLOOR = -1.3;
const BED_TOP = FLOOR + 0.14;
const CASE_REST = FLOOR + 0.62;
const HALF_PI = Math.PI / 2;
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function keyframes(L) {
  const up = BED_TOP + L / 2 + 0.01;
  return [
    { p: 0.0, cam: [0.8, 1.1, 9.4], tgt: [0, 0.15, 0], pos: [0, 0.25, 0], rot: [-0.42, -0.42, 0.18] },
    { p: 0.2, cam: [-0.6, 0.9, 8.6], tgt: [0, 0.1, 0], pos: [0, 0.25, 0], rot: [-0.5, -0.1, 0.16] },
    { p: 0.3, cam: [3.6, 1.9, 8.2], tgt: [0, 0.75, 0], pos: [0, up, 0], rot: [0, -0.7, HALF_PI] },
    { p: 0.48, cam: [2.6, 2.6, 7.4], tgt: [0, 0.95, 0], pos: [0, up, 0], rot: [0, -0.35, HALF_PI] },
    { p: 0.56, cam: [0.4, 0.95, 8.0], tgt: [0, 0.25, 0], pos: [0, 0.35, 0], rot: [-0.5, -0.36, 0.26] },
    { p: 0.74, cam: [-0.4, 0.8, 7.6], tgt: [0, 0.25, 0], pos: [0, 0.35, 0], rot: [-0.62, -0.18, 0.2] },
    { p: 0.84, cam: [2.4, 4.3, 6.6], tgt: [0, -0.8, 0], pos: [0, CASE_REST, 0], rot: [-HALF_PI, 0.12, 0] },
    { p: 1.0, cam: [3.2, 4.6, 5.8], tgt: [0, -0.85, 0], pos: [0, CASE_REST, 0], rot: [-HALF_PI, 0.12, 0] },
  ];
}

function sample(keys, p, field, out) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const a = keys[i], b = keys[i + 1];
  const k = easeInOutCubic(clamp((p - a.p) / (b.p - a.p)));
  for (let j = 0; j < 3; j++) out[j] = lerp(a[field][j], b[field][j], k);
  return out;
}

function blueprintGrid() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: /* glsl */`
      uniform float uOpacity, uTime; varying vec3 vW;
      float line( vec2 p, float s ) { vec2 c = p / s; vec2 g = abs( fract( c - 0.5 ) - 0.5 ) / fwidth( c ); return 1.0 - min( min( g.x, g.y ), 1.0 ); }
      void main() {
        float fade = exp( - length( vW.xz ) * 0.16 );
        float g = line( vW.xz, 0.25 ) * 0.22 + line( vW.xz, 1.0 ) * 0.6;
        float scan = exp( - pow( vW.z - ( mod( uTime * 1.2, 10.0 ) - 5.0 ), 2.0 ) * 3.0 );
        vec3 col = vec3( 0.78, 0.6, 0.3 ) * g * fade * 0.55 + vec3( 1.0, 0.82, 0.5 ) * scan * g * fade * 0.8;
        gl_FragColor = vec4( col * uOpacity, 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const geo = new THREE.PlaneGeometry(30, 30);
  geo.rotateX(-HALF_PI);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = FLOOR + 0.01;
  return mesh;
}

function metalMat(color, roughness) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness });
}

function buildPrinter() {
  const group = new THREE.Group();
  const micro = microTextures();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 2.0), new THREE.MeshPhysicalMaterial({ color: 0x1b1b1d, metalness: 0.6, roughness: 0.4 }));
  bed.position.y = BED_TOP - 0.07;
  const sheetMat = new THREE.MeshPhysicalMaterial({ color: 0x9c7a3e, metalness: 0.55, roughness: 0.72, normalMap: micro.normalMap, normalScale: new THREE.Vector2(1.4, 1.4) });
  sheetMat.normalMap = micro.normalMap.clone();
  sheetMat.normalMap.repeat.set(10, 7);
  sheetMat.normalMap.needsUpdate = true;
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.025, 1.84), sheetMat);
  sheet.position.y = BED_TOP - 0.012;
  group.add(bed, sheet);

  const head = new THREE.Group();
  const alu = metalMat(0xc4c8ce, 0.55);
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.4), alu);
  carriage.position.y = 0.42;
  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.018, 0.4), alu);
    fin.position.y = 0.28 + i * 0.05;
    fin.scale.set(1.08, 1, 1.08);
    head.add(fin);
  }
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.2), metalMat(0xc9cdd2, 0.4));
  block.position.y = 0.17;
  const brass = metalMat(0xd7a94f, 0.22);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.016, 0.12, 24), brass);
  nozzle.position.y = 0.06;
  const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.42), new THREE.MeshPhysicalMaterial({ color: 0x0e0e10, roughness: 0.6 }));
  shroud.position.set(0.32, 0.36, 0);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.3), toneMapped: false }));
  // lumière de la buse hors du groupe masqué : elle reste comptée dans la scène
  // (intensité nulle hors impression), sinon chaque apparition de l'imprimante
  // changerait le nombre de lumières et ferait recompiler tous les shaders
  const glow = new THREE.PointLight(0xff8a3a, 0, 2.2, 2);
  head.add(carriage, block, nozzle, shroud, tip);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 4.2, 20), metalMat(0xd0d3d8, 0.18));
  rail.rotation.z = HALF_PI;
  const rail2 = rail.clone();
  rail.position.set(0, 0.42, -0.32);
  rail2.position.set(0, 0.6, -0.32);
  const gantry = new THREE.Group();
  gantry.add(rail, rail2);
  group.add(head, gantry);
  return { group, head, gantry, glow, tip };
}

function textTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 64px "Playfair Display", Georgia, serif';
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '10px';
  ctx.fillText(text, 256, 60);
  ctx.fillRect(150, 100, 212, 3);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function buildCase() {
  const group = new THREE.Group();
  const micro = microTextures();
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x0d0c0d, roughness: 0.62, sheen: 0.4, sheenColor: new THREE.Color(0x3a3430), sheenRoughness: 0.6, normalMap: micro.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) });
  const velvet = new THREE.MeshPhysicalMaterial({ color: 0x0d080a, roughness: 1, sheen: 1, sheenColor: new THREE.Color(0x9a7452), sheenRoughness: 0.28 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf2c879, metalness: 1, roughness: 0.2 });
  const body = buildSweep({ x0: -2.3, x1: 2.3, samples: 2, ring: 72, power: 8, profile: () => ({ y: 0, h: 0.27, w: 0.82 }) });
  const bodyMesh = new THREE.Mesh(body, leather);
  bodyMesh.position.y = FLOOR + 0.27;
  const bed = buildSweep({ x0: -2.16, x1: 2.16, samples: 2, ring: 72, power: 10, profile: () => ({ y: 0, h: 0.035, w: 0.7 }) });
  const bedMesh = new THREE.Mesh(bed, velvet);
  bedMesh.position.y = FLOOR + 0.54;
  const trim = buildSweep({ x0: -2.31, x1: 2.31, samples: 2, ring: 72, power: 8, profile: () => ({ y: 0, h: 0.012, w: 0.83 }) });
  const trimMesh = new THREE.Mesh(trim, gold);
  trimMesh.position.y = FLOOR + 0.535;

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, FLOOR + 0.54, -0.82);
  const lid = new THREE.Mesh(buildSweep({ x0: -2.3, x1: 2.3, samples: 2, ring: 72, power: 8, profile: () => ({ y: 0, h: 0.14, w: 0.82 }) }), leather);
  lid.position.set(0, 0.14, 0.82);
  const lidVelvet = new THREE.Mesh(buildSweep({ x0: -2.16, x1: 2.16, samples: 2, ring: 72, power: 10, profile: () => ({ y: 0, h: 0.02, w: 0.7 }) }), velvet);
  lidVelvet.position.set(0, -0.005, 0.82);
  const logoMat = new THREE.MeshPhysicalMaterial({ color: 0xf2c879, metalness: 1, roughness: 0.25, alphaMap: textTexture('APEX·3D'), transparent: true, alphaTest: 0.4 });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), logoMat);
  logo.rotation.x = HALF_PI;
  logo.position.set(0, -0.03, 0.82);
  lidPivot.add(lid, lidVelvet, logo);
  lidPivot.rotation.x = -1.92;
  group.add(bodyMesh, bedMesh, trimMesh, lidPivot);
  return { group, lidPivot };
}

function dimensionLines(knife) {
  const b = knife.box;
  const yb = b.min.y - 0.16;
  const xh = 0.02;
  const pts = [
    b.min.x, yb, 0, b.max.x, yb, 0,
    b.min.x, yb - 0.05, 0, b.min.x, yb + 0.05, 0,
    b.max.x, yb - 0.05, 0, b.max.x, yb + 0.05, 0,
    xh - 0.12, knife.info.edge(0.15), 0, xh - 0.12, knife.info.spine(0.15), 0,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const mat = hologram();
  mat.uniforms.uLine.value = 1;
  mat.premultipliedAlpha = true;
  const lines = new THREE.LineSegments(geo, mat);
  return {
    object: lines,
    mat,
    anchors: [
      new THREE.Vector3((b.min.x + b.max.x) / 2, yb - 0.12, 0),
      new THREE.Vector3(xh - 0.32, (knife.info.edge(0.15) + knife.info.spine(0.15)) / 2, 0),
    ],
  };
}

export class ForgeScene {
  constructor(el, section, stage, { reduced = false, lite = false } = {}) {
    this.el = el;
    this.section = section;
    this.stage = stage;
    this.reduced = reduced;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040404);
    this.scene.environment = stage.env;
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
    this.post = { bloom: 0.55, bloomRadius: 0.4, threshold: 1.0, exposure: 1.0, grain: 0.045, vignette: 0.6, ca: 0.002 };

    const knife = (this.knife = createKnife('classique'));
    knife.group.position.copy(knife.center).multiplyScalar(-1);
    knife.U.uRough.value = 0.6;
    this.spin = new THREE.Group();
    this.spin.add(knife.group);
    this.rig = new THREE.Group();
    this.rig.rotation.order = 'YZX';
    this.rig.add(this.spin);
    this.scene.add(this.rig);

    this.holo = buildHolo('classique');
    this.holoSpin = new THREE.Group();
    this.holoSpin.add(this.holo.object);
    this.dims = dimensionLines(knife);
    this.dims.object.position.copy(knife.center).multiplyScalar(-1);
    this.holoSpin.add(this.dims.object);
    this.holoRig = new THREE.Group();
    this.holoRig.rotation.order = 'YZX';
    this.holoRig.add(this.holoSpin);
    this.scene.add(this.holoRig);
    this.grid = blueprintGrid();
    this.scene.add(this.grid);

    this.printer = buildPrinter();
    this.scene.add(this.printer.group, this.printer.glow);
    this.case = buildCase();
    this.scene.add(this.case.group);

    this.floor = createFloor({ y: FLOOR, radius: 5, reflect: 0.22, pool: 0x1f1913 });
    this.scene.add(this.floor);
    this.mirror = createMirror(knife.group);
    this.scene.add(this.mirror.object);
    this.shadow = createContactShadow(0.7);
    this.shadow.position.y = FLOOR + 0.005;
    this.scene.add(this.shadow);

    const key = new THREE.DirectionalLight(0xfff0dc, 1.0);
    key.position.set(-4, 6, 5);
    this.scene.add(key);
    this.warm = new THREE.SpotLight(0xffcf8a, 0, 14, 0.5, 0.8, 2);
    this.warm.position.set(0.5, 5, 2.5);
    this.warm.target.position.set(0, FLOOR, 0);
    this.scene.add(this.warm, this.warm.target);

    this.sparks = new Sparks(300, 12);
    this.scene.add(this.sparks.object);
    this.dust = createDust({ count: lite ? 160 : 360, box: [12, 7, 8], center: [0, 1, 0], seed: 33 });
    this.dust.material.uniforms.uLightPos.value.set(-2.5, 6.5, -1.5);
    this.dust.material.uniforms.uLightDir.value.set(0.35, -1, 0.2).normalize();
    this.scene.add(this.dust);

    this.keys = keyframes(knife.length);
    this.labels = Array.from(el.querySelectorAll('[data-anchor]'));
    this.enterT = 0;
    this.p = 0;
    this.emitAcc = 0;
    this.v = [0, 0, 0];
  }

  onEnter() {
    this.enterT = 0;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.portrait = w / h < 0.9;
    this.camera.fov = this.portrait ? 38 : 28;
    // décentrage (lens shift) : le sujet glisse hors de la colonne de texte
    if (this.portrait) this.camera.setViewOffset(w, h, 0, h * 0.16, w, h);
    else if (w > 900) this.camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  progress() {
    const r = this.section.getBoundingClientRect();
    const span = Math.max(1, r.height - window.innerHeight);
    return clamp(-r.top / span);
  }

  update(dt, t) {
    const p = (this.p = this.progress());
    this.enterT += dt;
    const k = this.knife, U = k.U;
    const idle = this.reduced ? 0 : 1;
    const v = this.v;

    // --- caméra et pose ---------------------------------------------------
    sample(this.keys, p, 'cam', v);
    if (this.portrait) { v[0] *= 0.4; v[2] *= 1.25; }
    this.camera.position.set(v[0] + idle * Math.sin(t * 0.2) * 0.15, v[1], v[2]);
    sample(this.keys, p, 'tgt', v);
    tmp2.set(v[0], v[1], v[2]);
    this.camera.lookAt(tmp2);
    sample(this.keys, p, 'pos', v);
    this.rig.position.set(v[0], v[1] + (p < 0.26 || (p > 0.52 && p < 0.76) ? idle * Math.sin(t * 0.8) * 0.05 : 0), v[2]);
    sample(this.keys, p, 'rot', v);
    this.spin.rotation.x = v[0] + (p < 0.26 ? idle * Math.sin(t * 0.4) * 0.2 : 0);
    this.rig.rotation.y = v[1] + (p < 0.26 ? idle * Math.sin(t * 0.25) * 0.3 : 0);
    this.rig.rotation.z = v[2];
    this.holoRig.position.copy(this.rig.position);
    this.holoRig.rotation.copy(this.rig.rotation);
    this.holoSpin.rotation.x = this.spin.rotation.x;

    // --- 01 conception : hologramme coté ---------------------------------
    const wHolo = 1 - smoothstep(0.2, 0.28, p);
    const draw = Math.max(this.reduced ? 1 : easeInOutCubic(clamp(this.enterT / 2.2)), range(p, 0, 0.12));
    this.holo.set(draw, wHolo, t);
    this.holoRig.visible = wHolo > 0.001;
    const dm = this.dims.mat.uniforms;
    dm.uReveal.value = lerp(k.box.min.x - 0.1, k.box.max.x + 0.1, smoothstep(0.55, 1, draw));
    dm.uFade.value = wHolo;
    dm.uTime.value = t;
    this.grid.material.uniforms.uOpacity.value = 1 - smoothstep(0.2, 0.3, p);
    this.grid.material.uniforms.uTime.value = t;

    // --- 02 impression -----------------------------------------------------
    const printing = p >= 0.24;
    const print = printing ? range(p, 0.3, 0.47) : 0;
    k.setPrint(print);
    const hot = smoothstep(0.28, 0.31, p) * (1 - smoothstep(0.47, 0.53, p));
    U.uHot.value = hot;
    U.uTime.value = t;
    const wPrinter = smoothstep(0.24, 0.3, p) * (1 - smoothstep(0.5, 0.56, p));
    this.printer.group.visible = wPrinter > 0.001;
    this.printer.glow.intensity = 0;
    if (this.printer.group.visible) {
      const pg = this.printer;
      pg.group.position.y = -(1 - wPrinter) * 2.2;
      const front = k.printFront();
      const iy = k.info;
      const xl = clamp(front, 0, iy.L);
      const sp = front >= 0 ? iy.spine(xl) : 0.15, ed = front >= 0 ? iy.edge(xl) : -0.18;
      // couche courante : la buse balaie la section, du dos au tranchant
      this.rig.updateMatrixWorld(true);
      tmp.set(front, sp, 0);
      k.group.localToWorld(tmp);
      tmp2.set(front, ed, 0);
      k.group.localToWorld(tmp2);
      const s = this.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 11);
      tmp.lerp(tmp2, s);
      pg.head.position.set(tmp.x, Math.max(tmp.y, BED_TOP) + 0.035 + (1 - wPrinter) * 3, tmp.z);
      pg.gantry.position.y = pg.head.position.y;
      pg.glow.position.set(pg.head.position.x, pg.head.position.y + pg.group.position.y - 0.04, pg.head.position.z);
      pg.glow.intensity = 3 * hot;
      pg.tip.visible = hot > 0.05;
    }

    // --- 03 finition : front de polissage + étincelles --------------------
    U.uLayer.value = p < 0.74 ? 1 : 0;
    const pol = range(p, 0.56, 0.72);
    U.uPolish.value = p < 0.56 ? -10 : p > 0.73 ? 100 : lerp(k.box.min.x - 0.06, k.box.max.x + 0.06, pol);
    const polishing = p > 0.56 && p < 0.72;
    U.uPolishGlow.value = polishing ? 1.6 : 0;
    if (polishing && idle) {
      this.emitAcc += dt * 120;
      const n = Math.floor(this.emitAcc);
      this.emitAcc -= n;
      const x = U.uPolish.value;
      tmp.set(x, x >= 0 ? k.info.edge(Math.min(x, k.info.L)) : -0.15, 0);
      k.group.localToWorld(tmp);
      if (n) this.sparks.emit(tmp, n, { speed: 2.2, spread: 0.7, up: -0.1, life: 0.7, jitter: { x: 0.04, y: 0.02, z: 0.04 } });
    }
    this.sparks.update(dt);

    // --- 04 écrin -----------------------------------------------------------
    const wCase = smoothstep(0.72, 0.82, p);
    this.case.group.visible = wCase > 0.001;
    this.case.group.position.y = -(1 - wCase) * 1.6;
    this.case.lidPivot.rotation.x = lerp(-1.25, -1.92, smoothstep(0.82, 0.95, p));
    this.warm.intensity = 80 * smoothstep(0.76, 0.86, p);
    this.scene.environmentRotation.y = Math.PI * smoothstep(0.74, 0.84, p) + 0.25 * Math.sin(t * 0.15) * idle;


    // --- sol, reflet, ombre ---------------------------------------------------
    const floorW = smoothstep(0.18, 0.3, p);
    this.floor.material.uniforms.uOpacity.value = floorW;
    this.mirror.object.visible = floorW > 0.01 && wCase < 0.5;
    this.rig.updateMatrixWorld(true);
    this.mirror.update(FLOOR);
    const printed = clamp((U.uPrint.value - k.box.min.x) / (k.box.max.x - k.box.min.x));
    this.shadow.material.opacity = 0.6 * printed * floorW * (1 - wCase);
    this.shadow.scale.set(3.2 * Math.abs(Math.cos(this.rig.rotation.z)) + 0.5, 1, 0.8);
    this.shadow.rotation.y = this.rig.rotation.y;
    this.shadow.position.x = this.rig.position.x;

    const du = this.dust.material.uniforms;
    du.uTime.value = t;
    du.uPixelRatio.value = this.stage.dpr;
    du.uFocus.value = this.camera.position.length();
    this.post.bloom = lerp(0.7, 0.42, smoothstep(0.5, 0.6, p));

    // --- étiquettes de cotes (DOM) ------------------------------------------
    const w = this.el.clientWidth, h = this.el.clientHeight;
    this.labels.forEach((lab, i) => {
      const a = this.dims.anchors[i];
      if (!a) return;
      tmp.copy(a);
      this.dims.object.localToWorld(tmp);
      tmp.project(this.camera);
      lab.style.transform = `translate(${((tmp.x + 1) / 2) * w}px, ${((1 - tmp.y) / 2) * h}px) translate(-50%, -50%)`;
      lab.style.opacity = String(wHolo * smoothstep(0.75, 1, draw));
    });
  }
}
