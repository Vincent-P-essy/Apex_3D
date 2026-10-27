// Matériaux PBR des couteaux + extension de shader commune :
// impression couche par couche (plan de coupe et section en fusion), lignes de
// couches, polissage progressif, éclat sur le fil et gravure laser.
import * as THREE from 'three';

export function knifeUniforms() {
  return {
    uPrint: { value: 100 },
    uHot: { value: 0 },
    uTime: { value: 0 },
    uPolish: { value: 100 },
    uRough: { value: 0.62 },
    uLayer: { value: 0 },
    uPolishGlow: { value: 0 },
    uGlint: { value: -100 },
    uGlintAmp: { value: 0 },
    uEtchMap: { value: null },
    uEtchReveal: { value: 1 },
    uEtchHot: { value: 0 },
    uEtchDepth: { value: 1 },
    uEtchMode: { value: 0 },
  };
}

const VERT_PARS = /* glsl */`
varying vec3 vKPos;
varying vec3 vKAxis;
varying vec2 vKUv;
`;

const VERT_BODY = /* glsl */`
vKPos = position;
vKUv = uv;
vKAxis = normalize( ( modelViewMatrix * vec4( 1.0, 0.0, 0.0, 0.0 ) ).xyz );
`;

const FRAG_PARS = /* glsl */`
uniform float uPrint;
uniform float uHot;
uniform float uTime;
uniform float uPolish;
uniform float uRough;
uniform float uLayer;
uniform float uPolishGlow;
uniform float uGlint;
uniform float uGlintAmp;
varying vec3 vKPos;
varying vec3 vKAxis;
varying vec2 vKUv;
#ifdef K_ETCH
uniform sampler2D uEtchMap;
uniform float uEtchReveal;
uniform float uEtchHot;
uniform float uEtchDepth;
uniform float uEtchMode;
#endif
`;

// Avant tout éclairage : plan d'impression et section intérieure incandescente.
const FRAG_MAIN_START = /* glsl */`
void main() {
	if ( vKPos.x > uPrint ) discard;
	if ( ! gl_FrontFacing ) {
		float kd0 = max( uPrint - vKPos.x, 0.0 );
		vec3 kCap = mix( vec3( 0.014, 0.012, 0.011 ), vec3( 1.0, 0.34, 0.05 ) * 4.5, exp( - kd0 * 9.0 ) * uHot );
		#ifdef TONE_MAPPING
		kCap = toneMapping( kCap );
		#endif
		gl_FragColor = linearToOutputTexel( vec4( kCap, 1.0 ) );
		return;
	}
`;

const FRAG_ROUGHNESS = /* glsl */`
#include <roughnessmap_fragment>
float kPol = 1.0 - smoothstep( uPolish - 0.06, uPolish + 0.06, vKPos.x );
roughnessFactor = mix( max( roughnessFactor, uRough ), roughnessFactor, kPol );
diffuseColor.rgb *= mix( 1.0 - 0.35 * step( 0.001, uLayer ), 1.0, kPol );
`;

// Gravure : sombre sur acier/or, claire (métal mis à nu) sur revêtement noir.
const FRAG_METAL = /* glsl */`
#include <metalnessmap_fragment>
#ifdef K_ETCH
	float kEt = texture2D( uEtchMap, vKUv ).r * ( 1.0 - smoothstep( uEtchReveal - 0.003, uEtchReveal + 0.003, vKUv.x ) ) * uEtchDepth;
	roughnessFactor = mix( roughnessFactor, mix( 0.62, 0.3, uEtchMode ), kEt );
	diffuseColor.rgb = mix( diffuseColor.rgb * ( 1.0 - 0.74 * kEt ), mix( diffuseColor.rgb, vec3( 0.8, 0.82, 0.85 ), kEt ), uEtchMode );
	metalnessFactor = mix( metalnessFactor, 1.0, kEt * uEtchMode );
#endif
`;

const FRAG_NORMAL = /* glsl */`
#include <normal_fragment_maps>
{
	float kLay = uLayer * ( 1.0 - kPol );
	if ( kLay > 0.001 ) {
		float kPh = vKPos.x * 480.0;
		float kAa = 1.0 - smoothstep( 0.8, 2.6, fwidth( kPh ) );
		normal = normalize( normal + vKAxis * sin( kPh ) * 0.5 * kLay * kAa );
	}
}
`;

const FRAG_EMISSIVE = /* glsl */`
#include <emissivemap_fragment>
{
	float kd = max( uPrint - vKPos.x, 0.0 );
	float kHot = uHot * exp( - kd * 24.0 );
	vec3 kMol = mix( vec3( 1.0, 0.2, 0.025 ), vec3( 1.0, 0.76, 0.42 ), exp( - kd * 110.0 ) );
	totalEmissiveRadiance += kMol * kHot * 4.0 * ( 0.6 + 0.4 * sin( vKPos.x * 480.0 ) );
	totalEmissiveRadiance += vec3( 1.0, 0.95, 0.88 ) * exp( - abs( vKPos.x - uPolish ) * 70.0 ) * uPolishGlow;
	#ifdef K_EDGE
		float kG = vKPos.x - uGlint;
		totalEmissiveRadiance += vec3( 1.0, 0.92, 0.78 ) * exp( - kG * kG * 140.0 ) * uGlintAmp * 5.0;
	#endif
	#ifdef K_ETCH
		float kEh = texture2D( uEtchMap, vKUv ).r * exp( - abs( vKUv.x - uEtchReveal ) * 140.0 ) * uEtchHot;
		totalEmissiveRadiance += vec3( 1.0, 0.45, 0.12 ) * kEh * 7.0;
	#endif
}
`;

function hook(material, U, { edge = false, etch = false } = {}) {
  material.side = THREE.DoubleSide;
  material.defines = { ...(material.defines || {}) };
  if (edge) material.defines.K_EDGE = '';
  if (etch) material.defines.K_ETCH = '';
  material.onBeforeCompile = (shader) => {
    for (const k in U) shader.uniforms[k] = U[k];
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('void main() {', FRAG_MAIN_START)
      .replace('#include <roughnessmap_fragment>', FRAG_ROUGHNESS)
      .replace('#include <metalnessmap_fragment>', FRAG_METAL)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE);
  };
  material.customProgramCacheKey = () => 'apex-knife';
  return material;
}

const v2 = (x, y = x) => new THREE.Vector2(x, y);

// Répétition propre à un matériau : clone léger (même image GPU, transformation UV distincte).
function repeated(tex, rx, ry) {
  if (!tex || (rx === 1 && ry === 1)) return tex;
  const t = tex.clone();
  t.repeat.set(rx, ry);
  return t;
}

// --- Familles de matériaux (couleurs en sRGB, converties par three.js) -----
export function metal(U, opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0xd9dde2,
    metalness: 1,
    roughness: opts.roughness ?? 1,
    map: opts.map ?? null,
    roughnessMap: opts.roughnessMap ?? null,
    normalMap: opts.normalMap ?? null,
    normalScale: v2(opts.normalScale ?? 0.6),
    anisotropy: opts.anisotropy ?? 0,
    anisotropyRotation: opts.anisotropyRotation ?? 0,
    envMapIntensity: opts.env ?? 1,
    clearcoat: opts.clearcoat ?? 0,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.1,
    flatShading: !!opts.flat,
  });
  return hook(m, U, opts);
}

export function coating(U, opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0x2a2b2f,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 1,
    map: opts.map ?? null,
    roughnessMap: opts.roughnessMap ?? null,
    normalMap: opts.normalMap ?? null,
    normalScale: v2(opts.normalScale ?? 0.5),
    envMapIntensity: opts.env ?? 1,
    clearcoat: opts.clearcoat ?? 0.15,
    clearcoatRoughness: 0.4,
  });
  return hook(m, U, opts);
}

export function polymer(U, opts = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0x101012,
    metalness: 0,
    roughness: opts.roughness ?? 0.5,
    map: opts.map ?? null,
    roughnessMap: opts.roughnessMap ?? null,
    normalMap: opts.normalMap ?? null,
    normalScale: v2(opts.normalScale ?? 0.5),
    clearcoat: opts.clearcoat ?? 0,
    clearcoatRoughness: opts.clearcoatRoughness ?? 0.2,
    sheen: opts.sheen ?? 0,
    sheenColor: new THREE.Color(opts.sheenColor ?? 0x000000),
    sheenRoughness: opts.sheenRoughness ?? 0.5,
    envMapIntensity: opts.env ?? 1,
    specularIntensity: opts.specular ?? 1,
  });
  const rep = opts.repeat;
  if (rep) {
    m.normalMap = repeated(m.normalMap, rep[0], rep[1]);
    m.roughnessMap = repeated(m.roughnessMap, rep[0], rep[1]);
  }
  return hook(m, U, opts);
}

// Hologramme (carte « Sur mesure ») : fresnel doré, lignes de balayage.
export function hologram() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(1.0, 0.72, 0.3) },
      uReveal: { value: 10 },
      uFade: { value: 1 },
      uLine: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vN = normalize( normalMatrix * normal );
        vV = - mv.xyz;
        vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uColor; uniform float uReveal; uniform float uFade; uniform float uLine;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      // isoligne antialiasée (maillage façon CAO)
      float iso( float v, float s ) { float c = v / s; return 1.0 - min( abs( fract( c - 0.5 ) - 0.5 ) / fwidth( c ), 1.0 ); }
      void main() {
        if ( vP.x > uReveal ) discard;
        float f = pow( 1.0 - abs( dot( normalize( vN ), normalize( vV ) ) ), 2.0 ) * 0.6;
        float scan = 0.75 + 0.25 * sin( vP.y * 160.0 - uTime * 6.0 );
        float mesh = max( iso( vP.x, 0.09 ), iso( vP.y + vP.z, 0.045 ) );
        float sweep = exp( - pow( ( vP.x - ( mod( uTime * 0.8, 4.4 ) - 1.6 ) ) * 4.0, 2.0 ) );
        float front = exp( - max( uReveal - vP.x, 0.0 ) * 28.0 );
        vec3 col = uColor * ( 0.012 + f * 0.55 ) * scan + uColor * mesh * ( 0.32 + sweep * 0.8 ) + vec3( 1.0, 0.9, 0.7 ) * front * 1.2;
        col = mix( col, uColor * ( 0.9 + 0.5 * sweep ) + vec3( 1.0, 0.92, 0.75 ) * front * 2.0, uLine );
        vec3 c = col * uFade;
        gl_FragColor = vec4( c, clamp( max( c.r, max( c.g, c.b ) ), 0.0, 1.0 ) );
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
