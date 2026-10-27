// Effets de mise en scène : poussière en bokeh, étincelles, faisceau
// volumétrique, éclat d'objectif, sol réfléchissant, ombre de contact,
// et chaîne de post-traitement (bloom, tone mapping, grain, vignettage).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { rng } from './util.js';
import { flareTexture, radialTexture } from './textures.js';

// ---------------------------------------------------------------------------
// Poussière en suspension : points animés sur GPU, flou de mise au point
// (cercle de confusion) et sur-éclairage dans le cône de lumière.
// ---------------------------------------------------------------------------
export function createDust({ count = 520, box = [9, 6, 6], center = [0, 0, 0], seed = 3, color = 0xffe3b8 } = {}) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const sd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = center[0] + (r() - 0.5) * box[0];
    pos[i * 3 + 1] = center[1] + (r() - 0.5) * box[1];
    pos[i * 3 + 2] = center[2] + (r() - 0.5) * box[2];
    sd[i * 4] = r(); sd[i * 4 + 1] = r(); sd[i * 4 + 2] = r(); sd[i * 4 + 3] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: 1.6 },
      uFocus: { value: 9 },
      uAperture: { value: 2.2 },
      uLightPos: { value: new THREE.Vector3(-4, 6, 2) },
      uLightDir: { value: new THREE.Vector3(0.5, -1, -0.2).normalize() },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uTime, uPixelRatio, uSize, uFocus, uAperture;
      uniform vec3 uLightPos, uLightDir;
      varying float vAlpha;
      varying float vBlur;
      void main() {
        vec3 p = position;
        float t = uTime * ( 0.08 + aSeed.y * 0.12 );
        p.x += sin( t + aSeed.x * 6.283 ) * 0.4 + sin( uTime * 0.05 + aSeed.w * 20.0 ) * 0.2;
        p.y += sin( t * 0.7 + aSeed.x * 12.0 ) * 0.3 - mod( uTime * 0.012 * ( 0.5 + aSeed.z ), 1.0 ) * 0.4;
        p.z += cos( t * 0.9 + aSeed.x * 9.0 ) * 0.35;
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        float dist = max( - mv.z, 0.1 );
        float coc = abs( dist - uFocus ) / dist * uAperture;
        float sz = uSize * ( 0.35 + aSeed.z * 1.1 );
        float px = ( sz + coc * 9.0 ) * uPixelRatio * ( 9.0 / dist );
        gl_PointSize = clamp( px, 1.0, 64.0 * uPixelRatio );
        vec3 wp = ( modelMatrix * vec4( p, 1.0 ) ).xyz;
        vec3 lp = wp - uLightPos;
        float along = dot( lp, uLightDir );
        float radial = length( lp - uLightDir * along );
        float cone = ( 1.0 - smoothstep( along * 0.12, along * 0.42, radial ) ) * step( 0.0, along );
        float glint = pow( 0.5 + 0.5 * sin( uTime * ( 1.5 + aSeed.w * 3.0 ) + aSeed.x * 40.0 ), 12.0 );
        vAlpha = ( 0.1 + cone * ( 0.9 + glint * 1.5 ) ) * ( 0.3 + aSeed.w * 0.7 ) / ( 1.0 + coc * 4.0 );
        vBlur = clamp( coc * 3.0, 0.0, 1.0 );
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;
      varying float vBlur;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = length( c ) * 2.0;
        if ( r > 1.0 ) discard;
        float core = 1.0 - smoothstep( 0.0, mix( 0.45, 1.0, vBlur ), r );
        float rim = smoothstep( 0.7, 0.92, r ) * ( 1.0 - smoothstep( 0.92, 1.0, r ) ) * vBlur * 0.5;
        float a = ( core * mix( 1.0, 0.45, vBlur ) + rim ) * vAlpha * uOpacity;
        gl_FragColor = vec4( uColor * a, a );
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  return points;
}

// ---------------------------------------------------------------------------
// Étincelles : traînées (segments) simulées sur CPU, refroidissement chromatique.
// ---------------------------------------------------------------------------
export class Sparks {
  constructor(max = 260, seed = 9) {
    this.max = max;
    this.r = rng(seed);
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1);
    this.life = new Float32Array(max).fill(1);
    this.alive = 0;
    this.positions = new Float32Array(max * 6);
    this.colors = new Float32Array(max * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.object = new THREE.LineSegments(geo, mat);
    this.object.frustumCulled = false;
    this.object.renderOrder = 12;
    this.gravity = -2.6;
  }

  emit(origin, count, { spread = 1, speed = 1.6, up = 0.6, life = 0.9, jitter = null } = {}) {
    const r = this.r;
    for (let n = 0; n < count; n++) {
      let i = -1;
      for (let k = 0; k < this.max; k++) if (this.age[k] >= this.life[k]) { i = k; break; }
      if (i < 0) return;
      const a = r() * Math.PI * 2;
      const s = speed * (0.35 + r() * 0.9);
      this.p[i * 3] = origin.x + (jitter ? (r() - 0.5) * jitter.x : 0);
      this.p[i * 3 + 1] = origin.y + (jitter ? (r() - 0.5) * jitter.y : 0);
      this.p[i * 3 + 2] = origin.z + (jitter ? (r() - 0.5) * jitter.z : 0);
      this.v[i * 3] = Math.cos(a) * s * spread;
      this.v[i * 3 + 1] = (up + r() * 0.8) * s;
      this.v[i * 3 + 2] = Math.sin(a) * s * spread;
      this.age[i] = 0;
      this.life[i] = life * (0.4 + r() * 0.9);
    }
  }

  update(dt) {
    let n = 0;
    const P = this.positions, C = this.colors;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += dt;
      const k = this.age[i] / this.life[i];
      if (k >= 1) continue;
      this.v[i * 3 + 1] += this.gravity * dt;
      const drag = Math.exp(-1.8 * dt);
      this.v[i * 3] *= drag; this.v[i * 3 + 1] *= drag; this.v[i * 3 + 2] *= drag;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      const tail = 0.035;
      const o = n * 6;
      P[o] = this.p[i * 3]; P[o + 1] = this.p[i * 3 + 1]; P[o + 2] = this.p[i * 3 + 2];
      P[o + 3] = this.p[i * 3] - this.v[i * 3] * tail;
      P[o + 4] = this.p[i * 3 + 1] - this.v[i * 3 + 1] * tail;
      P[o + 5] = this.p[i * 3 + 2] - this.v[i * 3 + 2] * tail;
      // blanc-jaune → orange → rouge sombre (HDR pour le bloom)
      const heat = 1 - k;
      const rr = 4.0 * heat + 0.6, gg = 3.2 * heat * heat + 0.12 * heat, bb = 2.2 * Math.pow(heat, 4);
      C[o] = rr; C[o + 1] = gg; C[o + 2] = bb;
      C[o + 3] = rr * 0.25; C[o + 4] = gg * 0.2; C[o + 5] = bb * 0.1;
      n++;
    }
    this.alive = n;
    const g = this.object.geometry;
    g.setDrawRange(0, n * 2);
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Faisceau volumétrique (cône additif à bords doux).
// ---------------------------------------------------------------------------
export function createBeam({ from, to, radiusTop = 0.12, radiusBottom = 2.4, color = 0xffe7c2, intensity = 0.16 }) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  dir.normalize();
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 64, 24, true);
  geo.translate(0, -len / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity }, uTime: { value: 0 }, uLen: { value: len } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP;
      uniform float uLen;
      void main() {
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vN = normalize( normalMatrix * normal );
        vV = normalize( - mv.xyz );
        vY = - position.y / uLen;
        vP = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uIntensity; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vP;
      void main() {
        float facing = pow( abs( dot( normalize( vN ), normalize( vV ) ) ), 2.2 );
        float fall = smoothstep( 0.0, 0.08, vY ) * pow( 1.0 - vY, 1.4 );
        float flick = 0.85 + 0.15 * sin( uTime * 1.3 + vP.y * 1.7 ) * sin( uTime * 0.7 + atan( vP.x, vP.z ) * 3.0 );
        vec3 c = uColor * facing * fall * flick * uIntensity;
        gl_FragColor = vec4( c, 1.0 );
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  mesh.renderOrder = 9;
  return mesh;
}

export function createFlare(color = 0xffffff) {
  const mat = new THREE.SpriteMaterial({ map: flareTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, toneMapped: false });
  const s = new THREE.Sprite(mat);
  s.renderOrder = 20;
  s.scale.setScalar(0.001);
  return s;
}

// ---------------------------------------------------------------------------
// Sol laqué noir : flaque de lumière + reflet (copie miroir vue par transparence).
// ---------------------------------------------------------------------------
export function createFloor({ y = -1.6, size = 40, bg = 0x060606, pool = 0x2a2218, radius = 4.2, reflect = 0.2 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uBg: { value: new THREE.Color(bg) },
      uPool: { value: new THREE.Color(pool) },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uRadius: { value: radius },
      uReflect: { value: reflect },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4( position, 1.0 );
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uBg, uPool; uniform vec2 uCenter; uniform float uRadius, uReflect, uOpacity;
      varying vec3 vW;
      void main() {
        float d = length( vW.xz - uCenter ) / uRadius;
        float pool = exp( - d * d * 2.2 );
        float a = mix( 1.0, 1.0 - uReflect, exp( - d * d * 1.2 ) );
        gl_FragColor = vec4( uBg + uPool * pool, a * uOpacity );
      }`,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.renderOrder = 1;
  return mesh;
}

const reflectM = new THREE.Matrix4();
export function createMirror(source) {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  source.traverse((o) => {
    if (o.isMesh) {
      const m = new THREE.Mesh(o.geometry, o.material);
      m.matrixAutoUpdate = false;
      m.matrix.copy(o.matrix);
      group.add(m);
    }
  });
  return {
    object: group,
    update(floorY) {
      source.updateWorldMatrix(true, false);
      reflectM.set(1, 0, 0, 0, 0, -1, 0, 2 * floorY, 0, 0, 1, 0, 0, 0, 0, 1);
      group.matrix.multiplyMatrices(reflectM, source.matrixWorld);
      group.matrixWorldNeedsUpdate = true;
    },
  };
}

export function createContactShadow(opacity = 0.75) {
  // noir prémultiplié : assombrit un fond opaque comme un canvas transparent
  const mat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: 0x000000, transparent: true, opacity, depthWrite: false, premultipliedAlpha: true, toneMapped: false });
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

// ---------------------------------------------------------------------------
// Post-traitement
// ---------------------------------------------------------------------------
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.04 },
    uVignette: { value: 0.5 },
    uCA: { value: 0.0022 },
    uFade: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uCA, uFade;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash( vec2 p ) { p = fract( p * vec2( 233.34, 851.73 ) ); p += dot( p, p + 23.45 ); return fract( p.x * p.y ); }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot( d, d );
      vec2 off = d * r2 * uCA * 4.0;
      vec3 col;
      col.r = texture2D( tDiffuse, vUv - off ).r;
      col.g = texture2D( tDiffuse, vUv ).g;
      col.b = texture2D( tDiffuse, vUv + off ).b;
      float vig = smoothstep( 0.95, 0.25, length( d * vec2( 1.0, 1.15 ) ) );
      col *= mix( 1.0 - uVignette, 1.0, vig );
      float g = hash( floor( vUv * uRes ) + fract( uTime * 7.31 ) * 97.0 ) - 0.5;
      col += g * uGrain * ( 0.6 + 0.4 * ( 1.0 - dot( col, vec3( 0.333 ) ) ) );
      gl_FragColor = vec4( col * uFade, 1.0 );
    }`,
};

export function createPost(renderer, { samples = 4 } = {}) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.86);
  const output = new OutputPass();
  const finish = new ShaderPass(FinishShader);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(output);
  composer.addPass(finish);
  return {
    composer, renderPass, bloom, output, finish,
    setSize(w, h, dpr) {
      composer.setPixelRatio(dpr);
      composer.setSize(w, h);
      finish.uniforms.uRes.value.set(w * dpr, h * dpr);
    },
  };
}
