// Hero : le couteau se matérialise par fusion laser couche par couche, puis
// flotte au-dessus d'un sol laqué, dans un faisceau de lumière poussiéreux.
import * as THREE from 'three';
import { createKnife } from '../engine/knives.js';
import { createDust, Sparks, createBeam, createFlare, createFloor, createMirror, createContactShadow } from '../engine/effects.js';
import { clamp, damp, lerp, smoothstep, easeInOutCubic, range } from '../engine/util.js';

const tmp = new THREE.Vector3();
const L_SHADOW = 3.0;

export class HeroScene {
  constructor(el, stage, { reduced = false } = {}) {
    this.el = el;
    this.stage = stage;
    this.reduced = reduced;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050505);
    this.scene.environment = stage.env;
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.1, 80);
    this.post = { bloom: 0.42, bloomRadius: 0.38, threshold: 1.05, exposure: 1.0, grain: 0.045, vignette: 0.62, ca: 0.0025, fade: 1 };

    const knife = (this.knife = createKnife('classique'));
    knife.group.position.copy(knife.center).multiplyScalar(-1);
    this.spin = new THREE.Group();
    this.spin.add(knife.group);
    this.rig = new THREE.Group();
    this.rig.rotation.order = 'YZX';
    this.rig.add(this.spin);
    this.set = new THREE.Group();
    this.set.add(this.rig);
    this.scene.add(this.set);

    this.floorY = -1.7;
    this.floor = createFloor({ y: this.floorY, radius: 4.8, reflect: 0.26, pool: 0x221c15 });
    this.set.add(this.floor);
    this.mirror = createMirror(knife.group);
    this.scene.add(this.mirror.object);
    this.shadow = createContactShadow(0.85);
    this.shadow.position.y = this.floorY + 0.004;
    this.set.add(this.shadow);

    const key = new THREE.DirectionalLight(0xfff1df, 1.1);
    key.position.set(-4, 6, 5);
    this.scene.add(key);
    this.spot = new THREE.SpotLight(0xffe6c0, 80, 22, 0.45, 0.75, 2);
    this.set.add(this.spot, this.spot.target);

    this.beamFrom = new THREE.Vector3(-2.4, 7.2, -2.2);
    const to = new THREE.Vector3(0.5, this.floorY, 0.4);
    this.beam = createBeam({ from: this.beamFrom, to, radiusTop: 0.12, radiusBottom: 1.6, intensity: 0, color: 0xfff1dc });
    this.set.add(this.beam);
    this.dust = createDust({ count: 620, box: [13, 8, 8], center: [-0.5, 1.2, 0.5], seed: 21 });
    this.dust.material.uniforms.uLightDir.value.subVectors(to, this.beamFrom).normalize();
    this.set.add(this.dust);
    this.sparks = new Sparks(360, 4);
    this.scene.add(this.sparks.object);
    this.flare = createFlare(0xfff1d8);
    this.scene.add(this.flare);

    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', (e) => {
      this.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    this.intro = reduced ? 99 : -1;
    this.glintT = 99;
    this.emitAcc = 0;
    this.layout = { x: 1.4, y: 0, dist: 10.5, tilt: 0.42, camY: 0.55 };
    knife.setPrint(reduced ? 1 : 0);
  }

  start() {
    if (this.intro < 0) this.intro = 0;
  }

  resize(w, h) {
    const a = w / h;
    const cam = this.camera;
    cam.aspect = a;
    const t = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const L = this.knife.length;
    if (a > 1.05) {
      this.layout.tilt = 0.42;
      this.layout.dist = 10.4;
      const halfW = t * this.layout.dist * a;
      this.layout.x = Math.max(halfW * 0.36, 0.9);
      this.layout.y = -0.1;
      this.layout.camY = 0.55;
    } else {
      this.layout.tilt = 0.78;
      const extent = L * Math.cos(this.layout.tilt) + 0.6;
      this.layout.dist = Math.max(10.5, (extent * 0.72) / (t * a));
      const halfH = t * this.layout.dist;
      this.layout.x = 0;
      this.layout.y = halfH * 0.44;
      this.layout.camY = 0.3 + halfH * 0.1;
    }
    cam.position.set(0, this.layout.camY, this.layout.dist);
    cam.lookAt(0, 0.05, 0);
    cam.updateProjectionMatrix();
  }

  frontY(x) {
    const i = this.knife.info;
    return x >= 0 ? (i.spine(Math.min(x, i.L)) + i.edge(Math.min(x, i.L))) / 2 : -0.03;
  }

  update(dt, t) {
    const k = this.knife, U = k.U, P = this.pointer;
    P.x = damp(P.x, P.tx, 2.6, dt);
    P.y = damp(P.y, P.ty, 2.6, dt);
    const r = this.rect || this.el.getBoundingClientRect();
    const s = clamp(-r.top / Math.max(1, r.height));
    const idle = this.reduced ? 0 : 1;

    // --- intro : matérialisation -------------------------------------
    let print = 1, hot = 0, beamI = 0.1;
    if (this.intro < 0) {
      print = 0;
      beamI = 0;
    } else if (this.intro < 99) {
      this.intro += dt;
      const ti = this.intro;
      beamI = 0.1 * smoothstep(0, 0.7, ti) * (1 - 0.35 * Math.max(0, Math.sin(ti * 47)) * (1 - smoothstep(0.15, 0.7, ti)));
      print = easeInOutCubic(range(ti, 0.4, 3.1));
      hot = smoothstep(0.35, 0.7, ti) * (1 - smoothstep(3.0, 4.0, ti));
      if (ti > 3.05 && !this.introGlint) {
        this.introGlint = true;
        this.glintT = 0;
      }
      if (ti > 4.6) this.intro = 99;
    }
    k.setPrint(print);
    U.uHot.value = hot;
    U.uTime.value = t;
    this.beam.material.uniforms.uIntensity.value = beamI;
    this.beam.material.uniforms.uTime.value = t;

    // --- pose ---------------------------------------------------------
    this.set.position.set(this.layout.x, this.layout.y, 0);
    // roulis : alterne acier sombre à arêtes vives et dégradé argent (sans saturer)
    this.spin.rotation.x = -0.72 + idle * 0.13 * Math.sin(t * 0.31) - P.y * 0.12 + s * 1.3;
    this.rig.rotation.z = this.layout.tilt + P.y * 0.05 + s * 0.3;
    this.rig.rotation.y = -0.4 + idle * 0.1 * Math.sin(t * 0.19) + P.x * 0.26 - s * 0.7;
    this.rig.position.y = idle * 0.07 * Math.sin(t * 0.8) + s * 1.5;
    this.scene.environmentRotation.y = P.x * 0.6 + idle * Math.sin(t * 0.07) * 0.3;
    this.spot.position.set(-1.6 + P.x * 3.4, 5.4 - P.y * 1.4, 5.2);
    this.spot.target.position.set(0, 0, 0);

    // --- sol : reflet, flaque, ombre -----------------------------------
    this.set.updateMatrixWorld(true);
    this.mirror.update(this.set.position.y + this.floorY);
    this.floor.material.uniforms.uCenter.value.set(this.set.position.x, 0.2);
    const h = this.rig.position.y - this.floorY;
    this.shadow.scale.set(L_SHADOW * Math.abs(Math.cos(this.rig.rotation.z)) + 0.4, 1, 0.75);
    this.shadow.rotation.y = this.rig.rotation.y;
    this.shadow.material.opacity = print * clamp(1.4 / h) * 0.75;

    // --- éclat sur le fil + étoile en pointe ---------------------------
    this.glintT += dt;
    if (idle && this.intro >= 99 && this.glintT > 8) this.glintT = 0;
    const g = this.glintT;
    if (g < 1.6) {
      U.uGlint.value = lerp(0.1, k.info.L + 0.05, easeInOutCubic(clamp(g / 1.15)));
      U.uGlintAmp.value = Math.sin(clamp(g / 1.15) * Math.PI) * 1.2;
      const f = smoothstep(0.85, 1.1, g) * (1 - smoothstep(1.15, 1.6, g));
      tmp.set(k.info.L - 0.03, k.info.spine(k.info.L) + 0.005, 0);
      k.group.localToWorld(tmp);
      this.flare.position.copy(tmp);
      this.flare.scale.setScalar(0.05 + f * 1.3);
      this.flare.material.opacity = f;
      this.flare.material.rotation = g * 0.4;
    } else {
      U.uGlintAmp.value = 0;
      this.flare.material.opacity = 0;
    }

    // --- étincelles au front d'impression ------------------------------
    if (hot > 0.05 && print > 0.001 && print < 0.999) {
      this.emitAcc += dt * 170 * hot;
      const n = Math.floor(this.emitAcc);
      this.emitAcc -= n;
      if (n > 0) {
        const xf = k.printFront();
        tmp.set(xf, this.frontY(xf), 0);
        k.group.localToWorld(tmp);
        this.sparks.emit(tmp, n, { speed: 1.7, spread: 0.9, up: 0.35, life: 0.85, jitter: { x: 0.06, y: 0.14, z: 0.06 } });
      }
    }
    this.sparks.update(dt);

    // --- atmosphère ----------------------------------------------------
    const du = this.dust.material.uniforms;
    du.uTime.value = t;
    du.uPixelRatio.value = this.stage.dpr;
    du.uFocus.value = this.layout.dist;
    du.uLightPos.value.copy(this.beamFrom).add(this.set.position);
    du.uOpacity.value = smoothstep(0, 1.2, this.intro < 0 ? 0 : Math.min(this.intro, 2));
    this.post.fade = 1 - s * 0.75;
  }
}
