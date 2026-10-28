// Un seul contexte WebGL « cinéma » (post-traitement complet) partagé entre
// plusieurs sections : le canvas est déplacé dans la section la plus visible.
// La section quittée garde un instantané figé de sa dernière image.
import * as THREE from 'three';
import { createPost } from './engine/effects.js';
import { createStudioEnvironment } from './engine/environment.js';
import { LEVELS, GpuTimer } from './engine/quality.js';
import { DEBUG, precompileAll } from './engine/util.js';

const median = (a) => a.sort((x, y) => x - y)[a.length >> 1];
const bloomMaterials = (b) => [b.materialHighPassFilter, ...b.separableBlurMaterials, b.compositeMaterial, b.blendMaterial];

export class Stage {
  // level : palier de qualité de départ (quality.js) ; deferBloom : bloom ajouté
  // après l'affichage (addBloom), hors du chemin critique
  constructor({ canvas = document.createElement('canvas'), context, level = 0, deferBloom = false } = {}) {
    canvas.className = 'stage-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x050505, 1);
    renderer.debug.checkShaderErrors = DEBUG;
    this.renderer = renderer;
    this.maxSamples = renderer.capabilities.maxSamples || 0;
    this.level = level;
    const L = LEVELS[level];
    this.post = createPost(renderer, { samples: Math.min(L.msaa, this.maxSamples), bloom: L.bloom && !deferBloom });
    this.bloomGain = 1;
    this.env = createStudioEnvironment(renderer);
    this.timer = new GpuTimer(renderer.getContext());
    this.frameTimes = [];
    this.gpuTimes = [];
    this.windowT = 0;
    this.listeners = [];
    this.hosts = [];
    this.active = null;
    this.w = 0;
    this.h = 0;
    this.time = 0;
    this.lost = false;
    this.applyLevel();
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
      canvas.remove();
    });
  }

  // Compilation des shaders avec l'éclairage de la vraie scène et la cible du
  // post-traitement, sans gel prolongé de l'interface. `roots` limite la
  // compilation à une partie de la scène (objet ajouté après coup).
  async compile(host, onProgress, roots = [host.scene]) {
    const objects = [];
    for (const root of roots) root.traverse((o) => { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) objects.push(o); });
    await precompileAll(this.renderer, objects, host.camera, host.scene, this.post.composer.renderTarget1, onProgress);
  }

  // Shaders plein écran (passes de post-traitement), compilés comme ceux des scènes.
  async compilePasses(materials, onProgress) {
    const quad = new THREE.PlaneGeometry(2, 2);
    await precompileAll(this.renderer, materials.map((m) => new THREE.Mesh(quad, m)), new THREE.Camera(), new THREE.Scene(), this.post.composer.renderTarget1, onProgress);
    quad.dispose();
  }

  // Finition et bloom prêts avant la première image (pas d'attente à l'affichage).
  async compilePost(onProgress) {
    const b = this.post.bloom;
    await this.compilePasses([this.post.finish.material, ...(b ? bloomMaterials(b) : [])], onProgress);
  }

  // Bloom différé : shaders compilés en tâche de fond, puis intensité montée en
  // douceur (pas de saut de lumière à l'écran).
  async addBloom() {
    if (this.post.bloom || this.lost || !LEVELS[this.level].bloom) return;
    const bloom = this.post.createBloom();
    await this.compilePasses(bloomMaterials(bloom));
    this.bloomGain = 0;
    this.post.addBloom(bloom);
  }

  // Applique le palier courant : résolution, MSAA (ou FXAA), bloom.
  applyLevel() {
    const L = LEVELS[this.level];
    this.maxDpr = Math.min(window.devicePixelRatio || 1, L.dpr);
    this.dpr = this.maxDpr;
    const samples = Math.min(L.msaa, this.maxSamples);
    this.post.setSamples(samples);
    this.post.finish.uniforms.uFxaa.value = samples ? 0 : 1;
    this.listeners.forEach((fn) => fn(this.level));
  }

  // Abonnement aux changements de palier (le catalogue suit la scène principale).
  onLevel(fn) {
    this.listeners.push(fn);
    fn(this.level);
  }

  // Palier suivant qui change effectivement quelque chose sur cet écran.
  lower() {
    const key = (l) => {
      const L = LEVELS[l];
      return [Math.min(window.devicePixelRatio || 1, L.dpr), Math.min(L.msaa, this.maxSamples), L.bloom].join();
    };
    const current = key(this.level);
    for (let l = this.level + 1; l < LEVELS.length; l++) {
      if (key(l) === current) continue;
      this.level = l;
      this.applyLevel();
      if (DEBUG) console.info('[Apex 3D] qualité : palier', l, LEVELS[l]);
      return;
    }
  }

  // Régulateur, appelé à chaque image où la 3D a travaillé. Signal : temps GPU
  // réel de la scène quand le navigateur le mesure (insensible à un écran bridé
  // à 30 Hz), sinon durée des images. Médiane sur ~1,5 s (les à-coups isolés ne
  // comptent pas) ; trop lent → palier suivant. Jamais de remontée : pas d'oscillation.
  adapt(dt) {
    this.timer.poll(this.gpuTimes);
    this.frameTimes.push(dt);
    this.windowT += dt;
    if (this.windowT < 1.5 || this.frameTimes.length < 8) return;
    const frame = median(this.frameTimes) * 1000;
    const gpu = this.gpuTimes.length >= 4 ? median(this.gpuTimes) : null;
    this.frameTimes.length = 0;
    this.gpuTimes.length = 0;
    this.windowT = 0;
    const slow = gpu === null ? frame > 26 : gpu > 12 || (frame > 26 && gpu > 6);
    if (slow) this.lower();
  }

  add(host) {
    if (!host.noStill) {
      const still = document.createElement('canvas');
      still.className = 'stage-still';
      still.setAttribute('aria-hidden', 'true');
      host.el.appendChild(still);
      host.still = still;
    }
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
      // instantané (une image de plus) seulement si la section quittée reste à
      // l'écran et pas pour l'ouverture de la fiche, qui la recouvre
      if (!host?.forced && this.onScreen(prev)) this.snapshot(prev);
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

  onScreen(host) {
    const r = host.el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
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
      bloom.enabled = LEVELS[this.level].bloom && (p.bloom ?? 0.6) > 0;
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
    this.timer.begin();
    composer.render();
    this.timer.end();
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
    return true;
  }
}
