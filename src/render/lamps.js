import * as THREE from 'three';

// Lamp lighting + glow. Picks the nearest map lamps every frame (no allocation) and
//  - feeds the 6 closest to the global shader hook (soft 6 m wrapped falloff that lights floors, walls, ceilings, pillars),
//  - draws additive billboard halos (one InstancedMesh) for up to 64 lamps so fixtures bloom and read as light sources.
const NL = 6, NG = 64, GLOW_RANGE = 55, LIGHT_RANGE = 16;

export function createLamps(scene, skyU) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `varying vec2 vP; varying vec3 vC;
      void main(){ vP = position.xy * 2.0; vC = instanceColor;
        vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sz = length(instanceMatrix[0].xyz); c.xy += position.xy * sz; c.z += 0.25;
        gl_Position = projectionMatrix * c; }`,
    fragmentShader: `varying vec2 vP; varying vec3 vC;
      void main(){ float r = length(vP); if (r > 1.0) discard; float core = exp(-r * r * 22.0), halo = pow(1.0 - r, 2.6);
        gl_FragColor = vec4(vC * (core * 2.2 + halo * 0.42), 1.0); }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, NG); mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 5; mesh.name = 'lampGlow';
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(NG * 3), 3);
  scene.add(mesh);
  const M = new THREE.Matrix4(), col = new THREE.Color(), pos = new THREE.Vector3();
  const sel = new Int32Array(NG), selD = new Float32Array(NG);
  let lamps = null, indoorReady = false;
  return {
    mesh,
    setLamps(l) { lamps = l && l.length ? l : null; indoorReady = false; },
    prep(sample) { if (!lamps) return; for (const l of lamps) l._in = Math.min(1, sample(l.pos.x, l.pos.y, l.pos.z) * 1.6); indoorReady = true; },
    update(camera) {
      if (!lamps) { mesh.count = 0; for (let i = 0; i < NL; i++) skyU.uLampP.value[i].w = 0; return; }
      const cp = camera.position; let n = 0;
      for (let i = 0; i < lamps.length; i++) {
        const p = lamps[i].pos, dx = p.x - cp.x, dy = p.y - cp.y, dz = p.z - cp.z, d = dx * dx + dy * dy + dz * dz;
        if (d > GLOW_RANGE * GLOW_RANGE) continue;
        // insertion into the sorted nearest-NG list
        let j; if (n < NG) j = n++; else if (d >= selD[NG - 1]) continue; else j = NG - 1;
        while (j > 0 && selD[j - 1] > d) { selD[j] = selD[j - 1]; sel[j] = sel[j - 1]; j--; }
        selD[j] = d; sel[j] = i;
      }
      for (let i = 0; i < NL; i++) {
        const U = skyU.uLampP.value[i], C = skyU.uLampC.value[i];
        if (i < n && selD[i] < LIGHT_RANGE * LIGHT_RANGE) { const l = lamps[sel[i]]; U.set(l.pos.x, l.pos.y - 0.1, l.pos.z, Math.max(4.5, Math.min(7, (l.radius || 5) * 1.15))); C.set(l.color ?? 0xffd9a0).multiplyScalar((l.intensity ?? 1) * 0.85 * (0.3 + 0.7 * (l._in ?? 1))); }
        else U.w = 0;
      }
      mesh.count = n;
      for (let i = 0; i < n; i++) {
        const l = lamps[sel[i]], d = Math.sqrt(selD[i]), k = (l.intensity ?? 1) * (0.18 + 0.82 * (l._in ?? 1));
        const size = (l.kind === 'sign' ? 0.9 : 1.5) * (0.8 + 0.2 * k) * (1 + Math.min(d, 30) * 0.02);
        M.makeScale(size, size, size); M.setPosition(l.pos.x, l.pos.y, l.pos.z); mesh.setMatrixAt(i, M);
        col.set(l.color ?? 0xffd9a0).multiplyScalar(1.4 * k * Math.min(1, 1.4 - d / GLOW_RANGE)); mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
  };
}
