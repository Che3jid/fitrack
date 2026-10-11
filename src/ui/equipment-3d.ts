import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ModelEquipment = 'dumbbell' | 'barbell' | 'kettlebells';

export function hasEquipmentModel(value: string | null): value is ModelEquipment {
  return value === 'dumbbell' || value === 'barbell' || value === 'kettlebells';
}

const names: Record<ModelEquipment, string> = { dumbbell: '哑铃', barbell: '杠铃', kettlebells: '壶铃' };

export function mountEquipmentModel(host: HTMLElement, equipment: ModelEquipment): () => void {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f8f8f9');
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(3.6, 2.4, 4.8);
  camera.lookAt(0, 0.15, 0);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  } catch {
    host.textContent = '此设备暂不支持 3D 预览，请查看动作示意图。';
    return () => { host.textContent = ''; };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label', `${names[equipment]} 3D 模型，可拖动旋转`);
  renderer.domElement.setAttribute('role', 'img');
  host.replaceChildren(renderer.domElement);

  const dark = new THREE.MeshStandardMaterial({ color: '#34343b', metalness: .6, roughness: .34 });
  const steel = new THREE.MeshStandardMaterial({ color: '#a9abb3', metalness: .75, roughness: .27 });
  const accent = new THREE.MeshStandardMaterial({ color: '#b95f82', metalness: .35, roughness: .38 });
  const floor = new THREE.MeshStandardMaterial({ color: '#e9e9ed', roughness: 1 });
  const materials = [dark, steel, accent, floor];

  function cylinder(radius: number, length: number, x: number, material: THREE.Material): void {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 32), material);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.x = x;
    scene.add(mesh);
  }
  if (equipment === 'dumbbell' || equipment === 'barbell') {
    const long = equipment === 'barbell';
    const half = long ? 1.48 : .68;
    cylinder(.08, long ? 3.5 : 1.8, 0, steel);
    for (const sign of [-1, 1]) {
      cylinder(long ? .48 : .43, long ? .22 : .32, sign * half, dark);
      cylinder(long ? .39 : .35, .075, sign * (half + (long ? .15 : .2)), accent);
      cylinder(.16, .09, sign * (half + (long ? .3 : .36)), steel);
    }
  } else {
    const body = new THREE.Mesh(new THREE.SphereGeometry(.78, 40, 32), dark);
    body.scale.set(1, .86, .79);
    body.position.y = -.12;
    scene.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.45, .115, 16, 48), steel);
    handle.position.y = .79;
    scene.add(handle);
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .035, 32), accent);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0, -.14, .625);
    scene.add(badge);
  }
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, .035, 64), floor);
  disc.position.y = -1.12;
  scene.add(disc);
  scene.add(new THREE.AmbientLight(0xffffff, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(3, 5, 4);
  scene.add(key);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = .35;
  controls.maxPolarAngle = Math.PI - .35;
  controls.target.set(0, 0, 0);
  controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 1.2;
  controls.update();

  const resize = (): void => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.render(scene, camera);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  let frame = 0;
  const animate = (): void => {
    if (!host.isConnected) { dispose(); return; }
    if (!document.hidden) {
      controls.update();
      renderer.render(scene, camera);
    }
    frame = requestAnimationFrame(animate);
  };
  if (controls.autoRotate) frame = requestAnimationFrame(animate);
  else controls.addEventListener('change', resize);

  const detached = new MutationObserver(() => { if (!host.isConnected) dispose(); });
  detached.observe(document.body, { childList: true, subtree: true });
  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    detached.disconnect();
    controls.dispose();
    scene.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    materials.forEach((material) => material.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    host.replaceChildren();
  };
  return dispose;
}
