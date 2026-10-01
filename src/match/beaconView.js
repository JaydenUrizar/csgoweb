// World prop for the Beacon: dropped / arming / armed (beating) / disarming / disarmed / complete. Purely visual; state comes from ctx.match.beacon.
import * as THREE from 'three';

const COL = {
  dropped: 0xffb35a, arming: 0xffd24a, armed: 0xff4a2a, disarming: 0x35e0ff, disarmed: 0x53ff9a, complete: 0xffffff,
};

export function createBeaconView(ctx, M) {
  const B = M.beacon;
  const g = new THREE.Group(); g.name = 'beacon-view'; g.visible = false;
  const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b303b, roughness: 0.55, metalness: 0.5, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.1, 8), bodyMat); base.position.y = 0.05;
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.36), bodyMat); core.position.y = 0.23;
  const lightMat = new THREE.MeshBasicMaterial({ color: hdr(COL.dropped, 2.2), toneMapped: false });
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), lightMat); light.position.y = 0.45;
  const stripMat = new THREE.MeshBasicMaterial({ color: hdr(COL.dropped, 1.6), toneMapped: false });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.38), stripMat); strip.position.y = 0.3;
  const ringMat = new THREE.MeshBasicMaterial({ color: hdr(COL.armed, 2), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
  const progMat = new THREE.MeshBasicMaterial({ color: hdr(COL.arming, 2), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const prog = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.7, 64, 1, Math.PI / 2, Math.PI * 2), progMat); prog.rotation.x = -Math.PI / 2; prog.position.y = 0.04; prog.visible = false;
  g.add(base, core, light, strip, ring, prog);
  ctx.render?.scene?.add?.(g);

  let pulse = 0, shock = -1;
  const off = [
    ctx.events.on('beacon:beep', () => { pulse = 1; }),
    ctx.events.on('beacon:complete', () => { shock = 0; }),
  ];
  const setColor = (hex, k = 2) => { lightMat.color.copy(hdr(hex, k)); stripMat.color.copy(hdr(hex, k * 0.7)); ringMat.color.copy(hdr(hex, 2)); progMat.color.copy(hdr(hex, 2)); };

  return {
    group: g,
    update(dt) {
      const st = B.state;
      const show = st === 'dropped' || st === 'arming' || st === 'armed' || st === 'disarming' || st === 'disarmed' || st === 'complete';
      if (!show || (M.phase === 'buy' || M.phase === 'freeze' || M.phase === 'warmup' || M.phase === 'halftime')) { g.visible = false; return; }
      g.visible = true; g.position.copy(B.pos);
      const t = M.clock;
      pulse = Math.max(0, pulse - dt * 4.2);
      ring.visible = true; prog.visible = false;
      if (st === 'dropped') { setColor(COL.dropped, 1.4 + Math.sin(t * 4) * 0.5); ringMat.opacity = 0.35 + 0.25 * Math.sin(t * 4); ring.scale.setScalar(0.7); g.rotation.y = t * 0.8; }
      else if (st === 'arming' || st === 'disarming') {
        const col = st === 'arming' ? COL.arming : COL.disarming; setColor(col, 2.2);
        ringMat.opacity = 0.0; prog.visible = true; progMat.color.copy(hdr(col, 2.4));
        prog.geometry.setDrawRange(0, Math.max(1, Math.ceil(Math.min(1, B.progress) * 64)) * 6);
        if (st === 'disarming') { light.material.color.copy(hdr(col, 2 + Math.sin(t * 24))); }
      } else if (st === 'armed') {
        const k = 1.2 + pulse * 3.2; setColor(COL.armed, k);
        ring.scale.setScalar(0.5 + (1 - pulse) * 1.6); ringMat.opacity = pulse * 0.85;
        core.scale.y = 1 + pulse * 0.1;
      } else if (st === 'disarmed') { setColor(COL.disarmed, 2); ringMat.opacity = 0.0; }
      else if (st === 'complete') {
        setColor(COL.complete, 3);
        if (shock >= 0) { shock += dt; const k = Math.min(1, shock / 0.9); ring.scale.setScalar(0.5 + k * 14); ringMat.opacity = (1 - k) * 0.9; ringMat.color.copy(hdr(0xff6a2a, 3)); }
      }
    },
    dispose() { for (const o of off) o?.(); g.parent?.remove(g); g.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); },
  };
}
