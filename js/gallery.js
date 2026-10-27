// Catalogue : un second contexte WebGL hors écran (OffscreenCanvas) rend chaque
// carte puis lui transfère l'image sans copie (ImageBitmap). Repli : drawImage.
import * as THREE from 'three';
import { createKnife } from './engine/knives.js';
import { createStudioEnvironment } from './engine/environment.js';
import { createContactShadow } from './engine/effects.js';
import { HoloCycle } from './engine/hologram.js';
import { clamp, damp, lerp, smoothstep, easeInOutCubic, range } from './engine/util.js';

export class Gallery {
  constructor(cards, { reduced = false } = {}) {
    this.reduced = reduced;
    this.mode = 'bitmap';
    const attrs = { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' };
    try {
      if (typeof OffscreenCanvas === 'undefined' || typeof ImageBitmapRenderingContext === 'undefined') throw new Error('offscreen');
      this.renderer = new THREE.WebGLRenderer({ canvas: new OffscreenCanvas(2, 2), ...attrs });
    } catch (e) {
      this.mode = '2d';
      this.renderer = new THREE.WebGLRenderer(attrs);
    }
    const r = this.renderer;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.06;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    this.env = createStudioEnvironment(r);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0;
    this.h = 0;
    this.items = cards.map((el, i) => this.createItem(el, i));
  }

  createItem(el, index) {
    const id = el.dataset.model;
    const canvas = el.querySelector('.card-canvas');
    const ctx = canvas.getContext(this.mode === 'bitmap' ? 'bitmaprenderer' : '2d');
    const scene = new THREE.Scene();
    scene.environment = this.env;
    const camera = new THREE.PerspectiveCamera(20, 1.35, 0.1, 50);
    camera.position.set(0, 0.35, 9.6);
    camera.lookAt(0, 0.02, 0);
    const it = { el, id, canvas, ctx, scene, camera, inside: 0, hover: 0, px: 0, py: 0, tx: 0, ty: 0, reveal: -1, phase: index * 1.7, dirty: true };

    if (id === 'custom') {
      it.holo = new HoloCycle();
      it.holo.object.scale.setScalar(0.92);
      scene.add(it.holo.object);
    } else {
      const k = createKnife(id);
      k.group.position.copy(k.center).multiplyScalar(-1);
      it.knife = k;
      it.spin = new THREE.Group();
      it.spin.add(k.group);
      it.rig = new THREE.Group();
      it.rig.rotation.order = 'YZX';
      it.rig.add(it.spin);
      scene.add(it.rig);
      it.shadow = createContactShadow(0.55);
      it.shadow.position.y = -1.18;
      it.shadow.scale.set(3.4, 1, 0.8);
      scene.add(it.shadow);
      const key = new THREE.DirectionalLight(0xfff0dd, 1.0);
      key.position.set(-3, 5, 4);
      scene.add(key);
      k.setPrint(this.reduced ? 1 : 0);
      if (this.reduced) it.reveal = 9;
    }

    const media = el.querySelector('.card-media') || el;
    const move = (e) => {
      const b = media.getBoundingClientRect();
      it.tx = clamp(((e.clientX - b.left) / b.width) * 2 - 1, -1, 1);
      it.ty = clamp(((e.clientY - b.top) / b.height) * 2 - 1, -1, 1);
      it.dirty = true;
    };
    el.addEventListener('pointerenter', (e) => { it.inside = 1; move(e); });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', () => { it.inside = 0; it.tx = 0; it.ty = 0; it.dirty = true; });
    el.addEventListener('focusin', () => { it.inside = 1; it.dirty = true; });
    el.addEventListener('focusout', () => { it.inside = 0; it.dirty = true; });
    return it;
  }

  ensureSize(w, h) {
    if (Math.abs(w - this.w) < 1 && Math.abs(h - this.h) < 1) return;
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    const pw = Math.round(w * this.dpr), ph = Math.round(h * this.dpr);
    for (const it of this.items) {
      it.camera.aspect = w / h;
      // carte étroite (mobile) : on recule un peu pour garder la lame entière
      it.camera.position.z = w / h < 1.15 ? 11.8 : 9.6;
      it.camera.updateProjectionMatrix();
      it.canvas.width = pw;
      it.canvas.height = ph;
      it.dirty = true;
    }
  }

  animate(it, dt, t) {
    it.hover = damp(it.hover, it.inside, 5, dt);
    it.px = damp(it.px, it.tx, 6, dt);
    it.py = damp(it.py, it.ty, 6, dt);
    const idle = this.reduced ? 0 : 1;
    const tt = t + it.phase;

    if (it.holo) {
      it.holo.update(this.reduced ? 1.5 : tt);
      it.holo.object.rotation.y = -0.4 + idle * Math.sin(tt * 0.4) * 0.25 + it.px * 0.6;
      it.holo.object.rotation.x = 0.18 + it.py * 0.15;
      return;
    }

    const k = it.knife, U = k.U;
    if (it.reveal >= 0 && it.reveal < 9) {
      it.reveal += dt;
      const p = easeInOutCubic(range(it.reveal, 0.1, 1.5));
      k.setPrint(p);
      U.uHot.value = smoothstep(0.05, 0.25, it.reveal) * (1 - smoothstep(1.45, 2.2, it.reveal));
      if (it.reveal > 1.5 && it.glint === undefined) it.glint = 0;
      if (it.reveal > 2.4) it.reveal = 9;
    }
    U.uTime.value = tt;

    // éclat périodique sur le fil, plus fréquent au survol
    if (it.glint !== undefined && idle) {
      it.glint += dt * (1 + it.hover * 0.6);
      const g = it.glint;
      U.uGlint.value = lerp(0.05, k.info.L + 0.05, easeInOutCubic(clamp(g / 1.1)));
      U.uGlintAmp.value = g < 1.1 ? Math.sin((g / 1.1) * Math.PI) : 0;
      if (g > 6 + it.phase % 3) it.glint = 0;
    }

    const h = it.hover;
    it.spin.rotation.x = lerp(-0.42 + idle * 0.18 * Math.sin(tt * 0.5), -0.55 + it.px * 0.55, h);
    it.rig.rotation.z = 0.3 - it.py * 0.1 * h;
    it.rig.rotation.y = lerp(-0.32 + idle * 0.16 * Math.sin(tt * 0.33), -0.2 + it.px * 0.45, h);
    it.rig.position.y = 0.08 + idle * 0.05 * Math.sin(tt * 0.9) + h * 0.06;
    it.scene.environmentRotation.y = it.px * 0.9 * h + idle * Math.sin(tt * 0.12) * 0.25;
    const printed = clamp((U.uPrint.value - k.box.min.x) / (k.box.max.x - k.box.min.x));
    it.shadow.material.opacity = (0.5 - h * 0.12) * printed;
    it.shadow.rotation.y = it.rig.rotation.y;
  }

  render(dt, t) {
    const vh = window.innerHeight;
    let sized = false;
    for (const it of this.items) {
      const r = it.canvas.getBoundingClientRect();
      if (!(r.width > 0 && r.bottom > -40 && r.top < vh + 40)) continue;
      if (!sized) {
        this.ensureSize(r.width, r.height);
        sized = true;
      }
      if (it.reveal < 0) it.reveal = 0;
      const busy = !this.reduced || it.dirty || it.inside || it.hover > 0.01;
      this.animate(it, dt, t);
      if (!busy) continue;
      this.renderer.render(it.scene, it.camera);
      this.present(it);
      it.dirty = false;
      if (!it.ready) {
        it.ready = true;
        it.el.classList.add('is-3d');
      }
    }
  }

  present(it) {
    if (this.mode === 'bitmap') {
      it.ctx.transferFromImageBitmap(this.renderer.domElement.transferToImageBitmap());
    } else {
      it.ctx.clearRect(0, 0, it.canvas.width, it.canvas.height);
      it.ctx.drawImage(this.renderer.domElement, 0, 0, it.canvas.width, it.canvas.height);
    }
  }

  // Compile les shaders en amont (évite les saccades au premier affichage).
  async warm() {
    for (const it of this.items) {
      try {
        await this.renderer.compileAsync(it.scene, it.camera);
        // un rendu à vide envoie aussi géométries et textures au GPU
        this.renderer.render(it.scene, it.camera);
      } catch (e) {
        /* compilation paresseuse en repli */
      }
    }
  }
}
