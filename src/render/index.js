import * as THREE from 'three';
// PLACEHOLDER render module — owner: `render` piece. Contract: see docs/ARCHITECTURE.md §render.
export function create(ctx) {
  const app = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!ctx.params.get('preserve') || !!ctx.params.get('test') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  app.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fb4d8); scene.fog = new THREE.Fog(0x8fb4d8, 40, 160);
  const camera = new THREE.PerspectiveCamera(100, 1, 0.05, 400);
  const viewScene = new THREE.Scene();                      // first-person viewmodel scene (rendered after world, depth cleared)
  const viewCamera = new THREE.PerspectiveCamera(68, 1, 0.01, 10);
  scene.add(new THREE.HemisphereLight(0xdfeeff, 0x6b5a48, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4); sun.position.set(30, 50, 20); sun.castShadow = true; scene.add(sun);
  viewScene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.6));
  const api = {
    renderer, scene, camera, viewScene, viewCamera, sun,
    resize() { const w = app.clientWidth || innerWidth, h = app.clientHeight || innerHeight; renderer.setSize(w, h, false); camera.aspect = viewCamera.aspect = w / h; camera.updateProjectionMatrix(); viewCamera.updateProjectionMatrix(); },
    render() {
      renderer.autoClear = true; renderer.render(scene, camera);
      renderer.autoClear = false; renderer.clearDepth(); renderer.render(viewScene, viewCamera); renderer.autoClear = true;
    },
    info: () => renderer.info.render,
  };
  addEventListener('resize', api.resize); api.resize();
  return api;
}
