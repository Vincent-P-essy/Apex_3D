// Un seul contexte WebGL « cinéma » (post-traitement complet) partagé entre
// plusieurs sections : le canvas est déplacé dans la section la plus visible.
// La section quittée garde un instantané figé de sa dernière image.
import * as THREE from 'three';
import { createPost } from './engine/effects.js';
import { createStudioEnvironment } from './engine/environment.js';
import { DEBUG, precompileAll } from './engine/util.js';

export class Stage {
  constructor({ lite = false, canvas = document.createElement('canvas'), context } = {}) {
    canvas.className = 'stage-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x050505, 1);
    renderer.debug.checkShaderErrors = DEBUG;
    this.renderer = renderer;
    this.maxDpr = Math.min(window.devicePixelRatio || 1, lite ? 1.35 : 1.75);
    this.dpr = this.maxDpr;
    // mode allégé : bloom ajouté après l'affichage (addBloom), hors du chemin critique
    this.post = createPost(renderer, { samples: Math.min(lite ? 2 : 4, renderer.capabilities.maxSamples || 0), bloom: !lite });
    this.bloomGain = 1;
    this.env = createStudioEnvironment(renderer);
    this.hosts = [];
    this.active = null;
    this.w = 0;
    this.h = 0;
    this.time = 0;
    this.slow = 0;
    this.lost = false;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      canvas.remove();
    });
  }

  // Compilation des shaders avec l'éclairage de la vraie scène et la cible du
  // post-traitement, sans gel prolongé de l'interface.
  async compile(host, onProgress) {
    const objects = [];
    host.scene.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) objects.push(o); });
    await precompileAll(this.renderer, objects, host.camera, host.scene, this.post.composer.renderTarget1, onProgress);
  }

  // Bloom différé : shaders compilés en tâche de fond, puis intensité montée en
  // douceur (pas de saut de lumière à l'écran).
  async addBloom() {
    if (this.post.bloom || this.lost) return;
    const bloom = this.post.createBloom();
    const quad = new THREE.PlaneGeometry(2, 2);
    const materials = [bloom.materialHighPassFilter, ...bloom.separableBlurMaterials, bloom.compositeMaterial, bloom.blendMaterial];
    await precompileAll(this.renderer, materials.map((m) => new THREE.Mesh(quad, m)), new THREE.Camera(), new THREE.Scene(), this.post.composer.renderTarget1);
    quad.dispose();
    this.bloomGain = 0;
    this.post.addBloom(bloom);
  }

  add(host) {
    const still = document.createElement('canvas');
    still.className = 'stage-still';
    still.setAttribute('aria-hidden', 'true');
    host.el.appendChild(still);
    host.still = still;
    this.hosts.push(host);
    return host;
  }

  pick() {
    for (const h of this.hosts) if (h.forced) return h;
    const vw = window.innerWidth, vh = window.innerHeight;
    let best = null, bestArea = 0, curArea = 0;
    for (const h of this.hosts) {
      const r = h.el.getBoundingClientRect();
      h.rect = r;
      const a = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
      if (h === this.active) curArea = a;
      if (a > bestArea) { bestArea = a; best = h; }
    }
    // hystérésis : pas de va-et-vient entre deux sections à moitié visibles
    if (this.active && !this.active.forced && curArea > 0 && best !== this.active && bestArea < curArea * 1.3) return this.active;
    return best;
  }

  activate(host) {
    if (host === this.active) return;
    const prev = this.active;
    if (prev) {
      this.snapshot(prev);
      prev.onLeave?.();
    }
    this.active = host;
    if (!host) {
      this.canvas.remove();
      return;
    }
    host.el.appendChild(this.canvas);
    this.resize(true);
    host.onEnter?.();
  }

  snapshot(host) {
    if (!host.still || !this.w || this.lost) return;
    try {
      this.draw(host);
      const k = Math.min(this.dpr, 1.5);
      const s = host.still;
      s.width = Math.round(this.w * k);
      s.height = Math.round(this.h * k);
      s.getContext('2d').drawImage(this.canvas, 0, 0, s.width, s.height);
      s.classList.add('is-ready');
    } catch (e) {
      /* instantané facultatif */
    }
  }

  resize(force = false) {
    const el = this.active.el;
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    if (!force && w === this.w && h === this.h && this.appliedDpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.appliedDpr = this.dpr;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, this.dpr);
    this.active.resize(w, h, this.dpr);
  }

  draw(host) {
    const p = host.post || {};
    const { bloom, finish, renderPass, composer } = this.post;
    renderPass.scene = host.scene;
    renderPass.camera = host.camera;
    if (bloom) {
      bloom.enabled = (p.bloom ?? 0.6) > 0 && this.slow < 2;
      bloom.strength = (p.bloom ?? 0.6) * this.bloomGain;
      bloom.radius = p.bloomRadius ?? 0.5;
      bloom.threshold = p.threshold ?? 0.86;
    }
    const u = finish.uniforms;
    u.toneMappingExposure.value = p.exposure ?? 1;
    u.uTime.value = this.time;
    u.uGrain.value = p.grain ?? 0.04;
    u.uVignette.value = p.vignette ?? 0.5;
    u.uCA.value = p.ca ?? 0.002;
    u.uFade.value = p.fade ?? 1;
    composer.render();
  }

  // Qualité adaptative : on baisse la résolution si le GPU peine.
  adapt(dt) {
    this.acc = (this.acc || 0) + dt;
    this.frames = (this.frames || 0) + 1;
    if (this.acc < 2) return;
    const avg = this.acc / this.frames;
    this.acc = 0;
    this.frames = 0;
    if (avg > 0.026) {
      if (this.dpr > 1) this.dpr = Math.max(1, this.dpr - 0.25);
      else this.slow++;
    }
  }

  frame(dt) {
    if (this.lost) return false;
    this.time += dt;
    this.bloomGain = Math.min(1, this.bloomGain + dt / 0.8);
    const host = this.pick();
    this.activate(host);
    if (!host) return false;
    this.resize();
    host.update(dt, this.time);
    this.draw(host);
    this.adapt(dt);
    return true;
  }
}
