// Studio photo virtuel : boîtes à lumière émissives (HDR) captées dans une
// carte d'environnement préfiltrée (PMREM). Les reflets du métal viennent de là.
import * as THREE from 'three';
import { softboxTexture } from './textures.js';

export function createStudioEnvironment(renderer, { warmth = 1 } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.006, 0.006, 0.007);
  const plane = new THREE.PlaneGeometry(1, 1);
  const flat = softboxTexture(false);
  const graded = softboxTexture(true);
  const target = new THREE.Vector3(0, 0, 0);

  const panel = (w, h, intensity, color, position, tex = flat) => {
    const c = new THREE.Color(color).multiplyScalar(intensity);
    const mat = new THREE.MeshBasicMaterial({ color: c, map: tex, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(plane, mat);
    mesh.scale.set(w, h, 1);
    mesh.position.copy(position);
    mesh.lookAt(target);
    scene.add(mesh);
    return mesh;
  };

  const warm = new THREE.Color(1.0, 0.9, 0.78).lerp(new THREE.Color(1, 1, 1), 1 - warmth);
  // grande boîte haute frontale à dégradé : c'est elle que reflètent les plats de lame
  panel(11, 6, 1.1, 0xfffaf2, new THREE.Vector3(0.0, 5.2, 5.4), graded);
  // lumière principale : grande boîte à gauche, légèrement chaude
  panel(4.2, 3.4, 4.2, warm, new THREE.Vector3(-5.6, 2.2, 2.6));
  // bande de plafond longue (ligne lumineuse le long du dos et du fil)
  panel(10, 0.7, 8, 0xffffff, new THREE.Vector3(0.4, 6.4, -0.6));
  // contre-jour froid à droite
  panel(0.9, 6.8, 5.5, new THREE.Color(0.8, 0.88, 1.0), new THREE.Vector3(5.4, 1.2, -2.2));
  // découpe arrière gauche
  panel(0.7, 5.5, 3.2, 0xfff2e2, new THREE.Vector3(-4.0, 1.0, -4.6));
  // réflecteur bas (carton blanc) : la lame inclinée vers le sol garde un modelé
  panel(12, 3.2, 0.28, 0xfff6ea, new THREE.Vector3(0.0, -3.0, 5.6));
  // rebond doré bas droit
  panel(2.6, 1.4, 1.8, new THREE.Color(1.0, 0.7, 0.34), new THREE.Vector3(3.6, -2.2, 3.4));
  // petits points spéculaires (scintillement des arêtes)
  panel(0.3, 0.3, 16, 0xffffff, new THREE.Vector3(2.8, 3.8, 4.4));
  panel(0.22, 0.22, 14, 0xfff0dd, new THREE.Vector3(-2.0, 4.6, -2.8));

  // sol sombre et fond légèrement dégradé (jamais de noir absolu dans les reflets)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.018, 0.016), toneMapped: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.2;
  scene.add(floor);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = vP.y * 0.5 + 0.5; gl_FragColor = vec4(mix(vec3(0.008, 0.0075, 0.007), vec3(0.035, 0.034, 0.033), smoothstep(0.35, 1.0, h)), 1.0); }',
  }));
  scene.add(dome);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.isMesh) o.material.dispose();
  });
  plane.dispose();
  return rt.texture;
}
