// Point d'entrée du rendu 3D. Chargement réel et mesuré (polices, modèles,
// compilation asynchrone des shaders), puis boucle d'animation unique.
// En cas d'échec (pas de WebGL2…), le site reste complet avec ses visuels de repli.
import { Stage } from './stage.js';
import { HeroScene } from './scenes/hero.js';
import { ForgeScene } from './scenes/forge.js';
import { EngraveScene } from './scenes/engrave.js';
import { ViewerScene } from './scenes/viewer.js';
import { Gallery } from './gallery.js';
import { MODEL_IDS, prepareModel } from './engine/knives.js';
import { nextFrame } from './engine/util.js';

const state = (window.__apex = window.__apex || {});
state.progress = state.progress || 0;

function progress(p) {
  state.progress = Math.max(state.progress, p);
  window.dispatchEvent(new CustomEvent('apex:progress', { detail: { p: state.progress } }));
}

function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch (e) {
    return false;
  }
}

async function fontsReady() {
  if (!document.fonts) return;
  const faces = ['700 64px "Playfair Display"', '600 64px "Playfair Display"', 'italic 500 64px "Playfair Display"', '500 32px "JetBrains Mono"', '600 32px Inter'];
  const loads = Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null)));
  await Promise.race([loads, new Promise((r) => setTimeout(r, 2500))]);
}

async function boot() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!hasWebGL2()) throw new Error('WebGL2 indisponible');
  progress(0.04);
  await fontsReady();
  progress(0.12);

  for (let i = 0; i < MODEL_IDS.length; i++) {
    prepareModel(MODEL_IDS[i]);
    progress(0.12 + (0.36 * (i + 1)) / MODEL_IDS.length);
    await nextFrame();
  }

  const q = (s) => document.querySelector(s);
  const stage = new Stage();
  progress(0.54);
  const hero = stage.add(new HeroScene(q('[data-stage="hero"]'), stage, { reduced }));
  const forgeEl = q('[data-stage="forge"]');
  const forge = forgeEl ? stage.add(new ForgeScene(forgeEl, q('#processus'), stage, { reduced })) : null;
  await nextFrame();
  progress(0.62);
  const engraveEl = q('[data-stage="engrave"]');
  const engrave = engraveEl ? stage.add(new EngraveScene(engraveEl, stage, { reduced })) : null;
  const viewer = stage.add(new ViewerScene(q('[data-stage="viewer"]'), stage, { reduced }));
  progress(0.68);
  const gallery = new Gallery(Array.from(document.querySelectorAll('.card[data-model]')), { reduced });
  await nextFrame();
  progress(0.76);

  // compilation parallèle (KHR_parallel_shader_compile) : pas de gel au premier rendu
  const scenes = [hero, forge, engrave].filter(Boolean);
  for (let i = 0; i < scenes.length; i++) {
    try {
      await stage.renderer.compileAsync(scenes[i].scene, scenes[i].camera);
    } catch (e) {
      /* compilation à la volée en repli */
    }
    progress(0.76 + (0.14 * (i + 1)) / scenes.length);
  }
  await gallery.warm();
  progress(0.96);

  // première image hors écran (sous le voile de chargement) : passes de post-traitement compilées
  stage.frame(0.016);

  document.documentElement.classList.add('webgl');
  window.addEventListener('apex:intro', () => hero.start());
  if (state.introRequested) hero.start();
  let modalOpen = false;
  window.addEventListener('apex:modal', (e) => {
    const id = e.detail && e.detail.id;
    modalOpen = !!id;
    if (id) viewer.show(id); else viewer.hide();
  });
  if (engrave) {
    window.addEventListener('apex:engrave', (e) => engrave.set(e.detail || {}));
    if (state.engrave) engrave.set(state.engrave, true);
  }

  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    // rien à rendre tant que le voile de chargement couvre la page
    if (state.introRequested) {
      stage.frame(dt);
      if (!modalOpen) gallery.render(dt, stage.time);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  state.stage = stage;
  progress(1);
}

boot().catch((err) => {
  console.warn('[Apex 3D] rendu 3D désactivé :', err && err.message ? err.message : err);
  state.failed = true;
  document.documentElement.classList.add('no-webgl');
  window.dispatchEvent(new CustomEvent('apex:progress', { detail: { p: 1, failed: true } }));
});
