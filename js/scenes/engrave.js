// Atelier de gravure : le texte saisi est gravé au laser, en temps réel,
// sur la lame (masque de gravure + front incandescent + étincelles).
import * as THREE from 'three';
import { createKnife } from '../engine/knives.js';
import { drawEngraving, createCanvas, canvasToTexture } from '../engine/textures.js';
import { Sparks, createDust, createFlare } from '../engine/effects.js';
import { clamp, damp, lerp, smoothstep, easeInOutCubic } from '../engine/util.js';

const FINISHES = {
  acier: { flat: 0xc9cdd3, bevel: 0xd8dbdf, metalness: 1, etch: 0 },
  or: { flat: 0xf2c879, bevel: 0xffe0a0, metalness: 1, etch: 0 },
  noir: { flat: 0x2c2d31, bevel: 0xd8dbdf, metalness: 0.45, etch: 1 },
};

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export class EngraveScene {
  constructor(el, stage, { reduced = false, lite = false } = {}) {
    this.el = el;
    this.stage = stage;
    this.reduced = reduced;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060606);
    this.scene.environment = stage.env;
    this.camera = new THREE.PerspectiveCamera(24, 1.4, 0.05, 40);
    this.post = { bloom: 0.45, bloomRadius: 0.35, threshold: 1.1, exposure: 1.0, grain: 0.04, vignette: 0.55, ca: 0.0015 };

    const knife = (this.knife = createKnife('classique', { etch: true }));
    const info = knife.info;
    const cx = info.engraveX + 0.05;
    knife.group.position.set(-cx, -(info.spine(cx) + info.edge(cx)) / 2, 0);
    this.spin = new THREE.Group();
    this.spin.add(knife.group);
    this.rig = new THREE.Group();
    this.rig.rotation.order = 'YZX';
    this.rig.add(this.spin);
    this.scene.add(this.rig);

    this.canvas = createCanvas(1024, 256);
    this.tex = canvasToTexture(this.canvas);
    knife.U.uEtchMap.value = this.tex;
    knife.U.uEtchReveal.value = 0;

    const key = new THREE.DirectionalLight(0xfff0dc, 1.0);
    key.position.set(-3, 5, 4);
    this.scene.add(key);

    // faisceau laser : cylindre additif + point d'impact + lumière locale
    const beamGeo = new THREE.CylinderGeometry(0.004, 0.004, 1, 8, 1, true);
    beamGeo.translate(0, 0.5, 0);
    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.2, 0.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.beam.renderOrder = 15;
    this.scene.add(this.beam);
    this.impact = createFlare(0xffc27a);
    this.scene.add(this.impact);
    this.hotLight = new THREE.PointLight(0xff8a3c, 0, 1.6, 2);
    this.scene.add(this.hotLight);
    this.sparks = new Sparks(220, 77);
    this.sparks.gravity = -3.2;
    this.scene.add(this.sparks.object);
    this.dust = createDust({ count: lite ? 80 : 160, box: [6, 3, 3], center: [0, 0.4, 0.2], seed: 51 });
    this.dust.material.uniforms.uSize.value = 1.1;
    this.dust.material.uniforms.uLightPos.value.set(-1.5, 3.5, 1);
    this.dust.material.uniforms.uLightDir.value.set(0.3, -1, -0.1).normalize();
    this.scene.add(this.dust);

    this.state = { text: '', font: 'serif', finish: 'acier' };
    this.job = null;
    this.emitAcc = 0;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    el.addEventListener('pointermove', (e) => {
      const b = el.getBoundingClientRect();
      this.pointer.tx = ((e.clientX - b.left) / b.width) * 2 - 1;
      this.pointer.ty = ((e.clientY - b.top) / b.height) * 2 - 1;
    }, { passive: true });
    el.addEventListener('pointerleave', () => { this.pointer.tx = 0; this.pointer.ty = 0; });
    this.set({ text: 'Hugo', font: 'serif', finish: 'acier' }, true);
  }

  set({ text = this.state.text, font = this.state.font, finish = this.state.finish }, instant = false) {
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, 18);
    const changed = clean !== this.state.text || font !== this.state.font;
    this.state = { text: clean, font, finish };
    const f = FINISHES[finish] || FINISHES.acier;
    const m = this.knife.mats;
    m.flat.color.set(f.flat);
    m.flat.metalness = f.metalness;
    m.bevel.color.set(f.bevel);
    this.knife.U.uEtchMode.value = f.etch;
    if (!changed) return;
    const ext = drawEngraving(this.canvas, this.knife.info, clean, font);
    this.tex.needsUpdate = true;
    this.ext = ext;
    if (instant || this.reduced || !clean) {
      this.knife.U.uEtchReveal.value = 1;
      this.job = null;
    } else {
      this.job = { t: 0, dur: 0.5 + Math.min(2.2, clean.length * 0.16) };
      this.knife.U.uEtchReveal.value = ext.u0;
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    const narrow = w / h < 1.2;
    this.camera.position.set(0, 0.32, narrow ? 4.9 : 3.9);
    this.camera.lookAt(0, -0.02, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt, t) {
    const k = this.knife, U = k.U, P = this.pointer;
    const idle = this.reduced ? 0 : 1;
    P.x = damp(P.x, P.tx, 4, dt);
    P.y = damp(P.y, P.ty, 4, dt);
    this.spin.rotation.x = -0.36 + idle * Math.sin(t * 0.4) * 0.04 - P.y * 0.06;
    this.rig.rotation.y = -0.12 + P.x * 0.22 + idle * Math.sin(t * 0.27) * 0.05;
    this.rig.rotation.z = 0.03;
    this.scene.environmentRotation.y = P.x * 0.45 + idle * Math.sin(t * 0.1) * 0.15;
    U.uTime.value = t;

    let laser = 0;
    if (this.job) {
      const j = this.job;
      j.t += dt;
      const e = this.ext;
      const k01 = clamp(j.t / j.dur);
      const u = lerp(e.u0, e.u1, easeInOutCubic(k01));
      U.uEtchReveal.value = u;
      U.uEtchHot.value = 1 - smoothstep(0.92, 1, k01);
      laser = 1 - smoothstep(0.95, 1, k01);
      // point d'impact : balayage vertical rapide (gravure en trame)
      const info = k.info;
      const x = info.x0 + u * (info.L - info.x0);
      tmp.set(x, e.yc + Math.sin(t * 70) * e.halfH, 0.02);
      this.rig.updateMatrixWorld(true);
      k.group.localToWorld(tmp);
      tmp2.set(tmp.x - 0.35, tmp.y + 2.4, tmp.z + 0.6);
      const dir = tmp2.clone().sub(tmp);
      this.beam.position.copy(tmp);
      this.beam.scale.set(1, dir.length(), 1);
      this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      this.impact.position.copy(tmp);
      this.impact.scale.setScalar(0.12 + Math.random() * 0.08);
      this.hotLight.position.copy(tmp).add(new THREE.Vector3(0, 0.05, 0.1));
      this.emitAcc += dt * 90 * laser;
      const n = Math.floor(this.emitAcc);
      this.emitAcc -= n;
      if (n) this.sparks.emit(tmp, n, { speed: 0.9, spread: 0.8, up: 0.5, life: 0.45 });
      if (k01 >= 1) {
        this.job = null;
        U.uEtchHot.value = 0;
      }
    } else {
      U.uEtchHot.value = damp(U.uEtchHot.value, 0, 6, dt);
    }
    this.beam.visible = laser > 0.01;
    this.beam.material.opacity = laser * (0.75 + 0.25 * Math.sin(t * 90));
    this.impact.material.opacity = laser;
    this.hotLight.intensity = laser * 2.2;
    this.sparks.update(dt);
    const du = this.dust.material.uniforms;
    du.uTime.value = t;
    du.uPixelRatio.value = this.stage.dpr;
    du.uFocus.value = this.camera.position.z;
  }
}
