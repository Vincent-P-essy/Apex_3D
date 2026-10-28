// Niveau graphique : point de départ choisi d'après le GPU, puis abaissé en direct
// par le régulateur de la scène (stage.js) si les images tardent.
//
// Paliers, du plus fin au plus léger. Mesuré en rendu logiciel sur le hero :
// MSAA ×4 ≈ 55 % du coût d'une image, bloom ≈ 38 % ; chaque palier retire le
// poste le plus coûteux restant (sans MSAA, la passe finale applique un FXAA).
export const LEVELS = [
  { dpr: 1.75, msaa: 4, bloom: true }, // GPU dédié
  { dpr: 1.35, msaa: 2, bloom: true }, // mobile (MSAA presque gratuit sur un GPU à tuiles)
  { dpr: 1.25, msaa: 0, bloom: true }, // GPU intégré
  { dpr: 1, msaa: 0, bloom: true },
  { dpr: 1, msaa: 0, bloom: false },
  { dpr: 0.8, msaa: 0, bloom: false }, // rendu logiciel (pas de GPU utilisable)
  { dpr: 0.65, msaa: 0, bloom: false },
];

// Classe du GPU d'après le nom du pilote : 'low' (rendu logiciel), 'medium'
// (GPU intégré au processeur ou mobile) ou 'high'.
export function gpuTier(gl) {
  let name = '';
  try {
    name = String(gl.getParameter(gl.RENDERER) || '');
    // Chrome masque le nom réel derrière « WebKit WebGL »
    if (!name || /^(webkit|mozilla)\b/i.test(name)) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      if (info) name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || name);
    }
  } catch (e) {
    /* nom indisponible : le régulateur fera le travail */
  }
  let tier = 'high';
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) tier = 'low';
  else if (/intel|iris|uhd graphics|hd graphics|radeon(\(tm\))? graphics|radeon vega|vega \d+ graphics|mali|adreno|powervr|videocore/i.test(name)) tier = 'medium';
  return { tier, name };
}

// Palier de départ : rendu logiciel, puis mobile, GPU intégré, appareil modeste.
export function startLevel(tier, { mobile = false, lite = false } = {}) {
  if (tier === 'low') return 5;
  if (mobile) return 1;
  if (tier === 'medium') return 2;
  return lite ? 1 : 0;
}

// Temps GPU réel d'une image (EXT_disjoint_timer_query_webgl2), lu quelques images
// plus tard : indépendant de la cadence d'affichage (écran à 30 Hz, économie d'énergie).
export class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.pending = [];
    this.free = [];
    this.active = null;
  }

  begin() {
    if (!this.ext || this.active || this.pending.length > 6) return;
    const q = this.free.pop() || this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end() {
    if (!this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  // Ajoute à `out` les durées (ms) disponibles, dans l'ordre des images.
  poll(out) {
    const gl = this.gl;
    while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const q = this.pending.shift();
      if (!gl.getParameter(this.ext.GPU_DISJOINT_EXT)) out.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      this.free.push(q);
    }
  }
}
