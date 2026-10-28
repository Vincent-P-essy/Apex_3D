// Visionneuse 360° de la fiche produit : glisser pour tourner (avec inertie),
// molette / pincement pour zoomer, flèches au clavier.
import * as THREE from 'three';
import { createKnife, prepareModelAsync } from '../engine/knives.js';
import { HoloCycle, HOLO_IDS, prepareHolo } from '../engine/hologram.js';
import { createDust, createFloor, createMirror, createContactShadow } from '../engine/effects.js';
import { clamp, damp, lerp, smoothstep, easeInOutCubic, range, yieldTask } from '../engine/util.js';

export class ViewerScene {
  constructor(el, stage, { reduced = false, lite = false } = {}) {
    this.el = el;
    this.stage = stage;
    this.reduced = reduced;
    this.forced = false;
    this.noStill = true; // la fiche se referme : jamais d'instantané à garder
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070707);
    this.scene.environment = stage.env;
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
    this.post = { bloom: 0.4, bloomRadius: 0.35, threshold: 1.1, exposure: 1.0, grain: 0.035, vignette: 0.5, ca: 0.0015 };

    this.floorY = -1.25;
    this.floor = createFloor({ y: this.floorY, radius: 3.6, reflect: 0.22, pool: 0x1d1813 });
    this.scene.add(this.floor);
    this.shadow = createContactShadow(0.7);
    this.shadow.position.y = this.floorY + 0.004;
    this.scene.add(this.shadow);
    const key = new THREE.DirectionalLight(0xfff0dd, 1.1);
    key.position.set(-3, 5, 4);
    this.scene.add(key);
    this.dust = createDust({ count: lite ? 110 : 220, box: [8, 4, 5], center: [0, 0.6, 0], seed: 8 });
    this.dust.material.uniforms.uLightPos.value.set(-2, 6, 0);
    this.dust.material.uniforms.uLightDir.value.set(0.3, -1, 0.1).normalize();
    this.scene.add(this.dust);

    this.items = new Map();
    this.current = null;
    this.yaw = -0.5;
    this.pitch = 0;
    this.vyaw = 0;
    this.vpitch = 0;
    this.zoom = 1;
    this.tzoom = 1;
    this.idle = 0;
    this.bindInput();
  }

  bindInput() {
    const el = this.el;
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.vyaw = dx * 0.0065;
      this.vpitch = dy * 0.0045;
      this.yaw += this.vyaw;
      this.pitch = clamp(this.pitch + this.vpitch, -0.9, 0.9);
      this.idle = 0;
    });
    const end = () => {
      drag = null;
      el.classList.remove('is-dragging');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      if (!this.forced) return;
      e.preventDefault();
      this.tzoom = clamp(this.tzoom * Math.exp(e.deltaY * 0.0012), 0.6, 1.35);
      this.idle = 0;
    }, { passive: false });
    el.addEventListener('keydown', (e) => {
      const step = { ArrowLeft: [-0.25, 0], ArrowRight: [0.25, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
      if (!step) return;
      e.preventDefault();
      this.vyaw = step[0] * 0.4;
      this.yaw += step[0];
      this.pitch = clamp(this.pitch + step[1], -0.9, 0.9);
      this.idle = 0;
    });
  }

  item(id) {
    if (this.items.has(id)) return this.items.get(id);
    let it;
    if (id === 'custom') {
      const holo = new HoloCycle();
      holo.grid.position.y = this.floorY + 0.01;
      it = { id, holo, object: holo.object };
    } else {
      const knife = createKnife(id);
      knife.group.position.copy(knife.center).multiplyScalar(-1);
      const spin = new THREE.Group();
      spin.add(knife.group);
      const mirror = createMirror(knife.group);
      this.scene.add(mirror.object);
      it = { id, knife, spin, object: spin, mirror };
    }
    this.scene.add(it.object);
    this.items.set(id, it);
    return it;
  }

  // Ouverture de la fiche : le modèle est préparé (géométrie, textures) par
  // tranches, puis ses shaders compilés avant d'apparaître, sans figer la page.
  async show(id) {
    const token = (this.pending = {});
    this.forced = true;
    for (const it of this.items.values()) {
      it.object.visible = false;
      if (it.mirror) it.mirror.object.visible = false;
    }
    this.current = null;
    this.shadow.material.opacity = 0;
    let it = this.items.get(id);
    if (!it) {
      if (id === 'custom') await prepareHolo(HOLO_IDS, yieldTask);
      else await prepareModelAsync(id, yieldTask);
      if (this.pending !== token) return;
      it = this.item(id);
      it.object.visible = false;
      if (it.mirror) it.mirror.object.visible = false;
      await this.stage.compile(this, null, [it.object, it.mirror?.object].filter(Boolean));
      if (this.pending !== token) return;
    }
    it.object.visible = true;
    if (it.mirror) it.mirror.object.visible = true;
    this.current = it;
    this.yaw = -0.55;
    this.pitch = -0.08;
    this.vyaw = this.reduced ? 0 : 0.035;
    this.tzoom = this.zoom = 1;
    this.t0 = -1;
    if (it.knife) it.knife.setPrint(this.reduced ? 1 : 0);
    this.forced = true;
  }

  hide() {
    this.forced = false;
    this.pending = null;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.baseDist = w / h < 1 ? 11.5 : 8.6;
    this.camera.updateProjectionMatrix();
  }

  update(dt, t) {
    const it = this.current;
    if (!it) return;
    if (this.t0 < 0) this.t0 = t;
    const local = t - this.t0;
    this.idle += dt;
    // inertie puis rotation automatique lente
    this.vyaw *= Math.exp(-2.4 * dt);
    if (!this.reduced && this.idle > 2.5) this.vyaw = damp(this.vyaw, 0.004, 1.5, dt);
    this.yaw += this.idle > 0.05 ? this.vyaw * dt * 60 : 0;
    this.zoom = damp(this.zoom, this.tzoom, 8, dt);
    const d = (this.baseDist || 8.6) * this.zoom;
    this.camera.position.set(0, 0.55 * this.zoom, d);
    this.camera.lookAt(0, 0, 0);

    if (it.holo) {
      it.holo.update(local + 0.2);
      it.object.rotation.set(this.pitch * 0.6 + 0.12, this.yaw, 0);
    } else {
      const k = it.knife;
      if (!this.reduced) {
        k.setPrint(easeInOutCubic(range(local, 0.05, 1.1)));
        k.U.uHot.value = smoothstep(0, 0.2, local) * (1 - smoothstep(1.0, 1.7, local));
        const g = (local - 1.2) % 7;
        k.U.uGlint.value = lerp(0.05, k.info.L + 0.05, easeInOutCubic(clamp(g / 1.1)));
        k.U.uGlintAmp.value = g > 0 && g < 1.1 ? Math.sin((g / 1.1) * Math.PI) : 0;
      }
      k.U.uTime.value = t;
      it.spin.rotation.order = 'YXZ';
      it.spin.rotation.set(this.pitch - 0.35, this.yaw, 0.12);
      it.spin.position.y = 0.05 + (this.reduced ? 0 : Math.sin(t * 0.9) * 0.04);
      it.spin.updateMatrixWorld(true);
      it.mirror.update(this.floorY);
      this.shadow.rotation.y = this.yaw;
      this.shadow.scale.set(3.2 * Math.abs(Math.cos(this.yaw)) + 0.8, 1, 0.9 + Math.abs(Math.sin(this.yaw)) * 1.6);
      this.shadow.material.opacity = 0.55 * clamp((k.U.uPrint.value - k.box.min.x) / (k.box.max.x - k.box.min.x));
    }
    this.shadow.visible = !it.holo;
    this.scene.environmentRotation.y = this.yaw * 0.25;
    const du = this.dust.material.uniforms;
    du.uTime.value = t;
    du.uPixelRatio.value = this.stage.dpr;
    du.uFocus.value = d;
  }
}
