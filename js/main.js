// Point d'entrée du rendu 3D. Chemin critique minimal : seul le hero est préparé
// avant l'affichage ; catalogue, fabrication, atelier et fiche produit sont
// construits à l'approche de leur section ou pendant les temps morts, sans geler
// l'interface. En cas d'échec (pas de WebGL2…), le site garde ses visuels de repli.
import { Stage } from './stage.js';
import { HeroScene } from './scenes/hero.js';
import { prepareModel } from './engine/knives.js';
import { quality } from './engine/textures.js';
import { gpuTier, startLevel } from './engine/quality.js';
import { DEBUG, nextFrame, idle as pause } from './engine/util.js';

const state = (window.__apex = window.__apex || {});
state.progress = state.progress || 0;

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(pointer: coarse)').matches;
const q = (s) => document.querySelector(s);

function progress(p) {
  state.progress = Math.max(state.progress, p);
  window.dispatchEvent(new CustomEvent('apex:progress', { detail: { p: state.progress } }));
}

async function fonts(faces, timeout) {
  if (!document.fonts) return;
  const loads = Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null)));
  await Promise.race([loads, new Promise((r) => setTimeout(r, timeout))]);
}

// Constructions différées : en file pendant les temps morts, ou immédiatement
// (en parallèle, par petites tranches) pour la section vers laquelle on se dirige.
function createQueue() {
  const jobs = new Map();
  const pending = [];
  let running = false;
  const start = (job) => {
    job.started = true;
    return job.fn().catch((e) => console.warn('[Apex 3D]', job.name, e));
  };
  const run = async () => {
    if (running) return;
    running = true;
    while (pending.length) {
      const job = pending.shift();
      if (!job.started) await start(job);
    }
    running = false;
  };
  return {
    add(name, fn) {
      jobs.set(name, { name, fn, started: false, queued: false });
    },
    request(name, urgent = false) {
      const job = jobs.get(name);
      if (!job || job.started) return;
      if (urgent) {
        start(job);
      } else if (!job.queued) {
        job.queued = true;
        pending.push(job);
        run();
      }
    },
  };
}

async function boot() {
  // le contexte WebGL2 de la scène est créé d'entrée : un refus (GPU bloqué,
  // WebGL désactivé…) est détecté tout de suite, sans contexte d'essai jetable
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: false, antialias: false, stencil: false, powerPreference: 'high-performance' });
  if (!context) throw new Error('WebGL2 indisponible');
  // niveau graphique de départ d'après le GPU (rendu logiciel, intégré, dédié) ;
  // ?gpu=high|medium|low dans l'adresse force la classe (recette, comparaisons)
  const detected = gpuTier(context);
  const forced = new URLSearchParams(location.search).get('gpu');
  const tier = ['high', 'medium', 'low'].includes(forced) ? forced : detected.tier;
  const name = detected.name;
  // mode allégé : écran tactile, appareil modeste ou rendu logiciel
  // (textures en demi-résolution, moins de particules, bloom différé)
  const lite = mobile || (navigator.deviceMemory || 8) <= 4 || tier === 'low';
  const level = startLevel(tier, { mobile, lite });
  if (DEBUG) console.info('[Apex 3D] GPU :', name || '?', '→', tier, ', palier', level);
  quality.tex = lite ? 0.5 : 1;
  // polices de la gravure du logo (attente plafonnée), puis textures du hero peintes
  // avant l'initialisation du GPU : les canvas n'attendent pas un GPU déjà occupé
  await fonts(['700 64px "Playfair Display"', '500 32px "JetBrains Mono"'], 900);
  progress(0.08);
  prepareModel('classique');
  progress(0.2);
  await nextFrame();
  const stage = new Stage({ canvas, context, level, deferBloom: lite });
  progress(0.55);
  await nextFrame();
  const hero = stage.add(new HeroScene(q('[data-stage="hero"]'), stage, { reduced, lite }));
  progress(0.62);
  await stage.compile(hero, (k) => progress(0.62 + 0.24 * k));
  await stage.compilePost((k) => progress(0.86 + 0.06 * k));
  // première image hors écran (sous le voile de chargement) : passes finales compilées
  stage.frame(0.016);
  document.documentElement.classList.add('webgl');

  let gallery = null;
  let viewer = null;
  let modalOpen = false;
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    // rien à rendre tant que le voile de chargement couvre la page
    if (state.introRequested) {
      const drawn = stage.frame(dt);
      const cards = gallery && !modalOpen ? gallery.render(dt, stage.time) : false;
      // le régulateur ne juge que les images où la 3D a réellement travaillé
      if (drawn || cards) stage.adapt(dt);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.addEventListener('apex:intro', () => hero.start());
  if (state.introRequested) hero.start();
  progress(1);

  // --- sections différées ---------------------------------------------------
  const queue = createQueue();
  // mode allégé : bloom ajouté après coup, tout de suite si le pilote compile en
  // parallèle (aucun à-coup), sinon avec les autres constructions différées
  queue.add('bloom', () => stage.addBloom());
  if (lite && stage.renderer.extensions.has('KHR_parallel_shader_compile')) queue.request('bloom', true);
  queue.add('gallery', async () => {
    const { Gallery } = await import('./gallery.js');
    gallery = new Gallery({ reduced, tier });
    stage.onLevel((l) => gallery.setLevel(l));
    await pause();
    await gallery.addCards(Array.from(document.querySelectorAll('.card[data-model]')), pause);
  });
  queue.add('forge', async () => {
    const el = q('[data-stage="forge"]');
    if (!el) return;
    const [{ ForgeScene }, { prepareHolo }] = await Promise.all([import('./scenes/forge.js'), import('./engine/hologram.js')]);
    await prepareHolo(['classique'], pause);
    const forge = new ForgeScene(el, q('#processus'), stage, { reduced, lite });
    await pause();
    await stage.compile(forge);
    stage.add(forge);
  });
  queue.add('engrave', async () => {
    const el = q('[data-stage="engrave"]');
    if (!el) return;
    await fonts(['600 64px "Playfair Display"', 'italic 500 64px "Playfair Display"', '600 32px Inter', '500 32px "JetBrains Mono"'], 2500);
    const { EngraveScene } = await import('./scenes/engrave.js');
    const engrave = new EngraveScene(el, stage, { reduced, lite });
    if (state.engrave) engrave.set(state.engrave, true);
    window.addEventListener('apex:engrave', (e) => engrave.set(e.detail || {}));
    await pause();
    await stage.compile(engrave);
    stage.add(engrave);
  });
  // fiche 3D : décor compilé d'avance, chaque modèle préparé à son ouverture
  let viewerReady = null;
  const ensureViewer = () => (viewerReady ??= (async () => {
    const { ViewerScene } = await import('./scenes/viewer.js');
    const v = new ViewerScene(q('[data-stage="viewer"]'), stage, { reduced, lite });
    await stage.compile(v);
    viewer = stage.add(v);
    return viewer;
  })());
  queue.add('viewer', ensureViewer);

  window.addEventListener('apex:modal', async (e) => {
    const id = e.detail && e.detail.id;
    modalOpen = !!id;
    if (id) {
      const v = await ensureViewer();
      if (modalOpen) v.show(id).catch((err) => console.warn('[Apex 3D] fiche', err));
    } else if (viewer) {
      viewer.hide();
    }
  });

  // le catalogue suit le hero : on le prépare dès le premier défilement
  window.addEventListener('scroll', () => queue.request('gallery', true), { once: true, passive: true });
  const near = (sel, name) => {
    const el = q(sel);
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      io.disconnect();
      queue.request(name, true);
    }, { rootMargin: '100% 0px' });
    io.observe(el);
  };
  near('#processus', 'forge');
  near('#sur-mesure', 'engrave');
  // le reste pendant les temps morts, une fois l'intro du hero jouée
  setTimeout(() => ['bloom', 'gallery', 'forge', 'engrave', 'viewer'].forEach((n) => queue.request(n)), reduced ? 400 : 5200);
}

boot().catch((err) => {
  console.warn('[Apex 3D] rendu 3D désactivé :', err && err.message ? err.message : err);
  state.failed = true;
  document.documentElement.classList.add('no-webgl');
  window.dispatchEvent(new CustomEvent('apex:progress', { detail: { p: 1, failed: true } }));
});
