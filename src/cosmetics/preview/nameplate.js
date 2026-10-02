// Floating nameplate sprite for the locker preview (styles plain|glow|hex), team-coloured underline.
import * as THREE from 'three';
import { hex } from './textures.js';
const TEAM = { ember: 0xff7a2f, tide: 0x2fd0ff };
export function createNameplate() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false })); sprite.scale.set(1.15, 0.29, 1); sprite.renderOrder = 20; sprite.visible = false;
  let key = '';
  function draw(np, name, team) {
    const k = JSON.stringify(np) + name + team; if (k === key) return; key = k;
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, 512, 128); const col = hex(np.color), tc = hex(TEAM[team] ?? 0xffffff);
    const txt = String(name).toUpperCase(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 62px "Barlow Condensed","Rajdhani","Arial Narrow",system-ui,sans-serif';
    const w = Math.min(450, ctx.measureText(txt).width + 70);
    if (np.style === 'hex') {
      const cx = 256, cy = 64, hw = w / 2, hh = 42; ctx.beginPath(); ctx.moveTo(cx - hw, cy); ctx.lineTo(cx - hw + 30, cy - hh); ctx.lineTo(cx + hw - 30, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx + hw - 30, cy + hh); ctx.lineTo(cx - hw + 30, cy + hh); ctx.closePath();
      ctx.fillStyle = 'rgba(8,10,16,0.8)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy + 2);
    } else if (np.style === 'glow') {
      ctx.shadowColor = col; ctx.shadowBlur = 28; ctx.fillStyle = col; for (let i = 0; i < 3; i++) ctx.fillText(txt, 256, 60); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillText(txt, 256, 60); ctx.fillStyle = col; ctx.fillRect(256 - w / 2 + 20, 100, w - 40, 4);
    } else {
      ctx.fillStyle = 'rgba(8,10,16,0.55)'; ctx.fillRect(256 - w / 2, 18, w, 84); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8; ctx.fillStyle = col; ctx.fillText(txt, 256, 60); ctx.shadowBlur = 0; ctx.fillStyle = tc; ctx.fillRect(256 - w / 2, 98, w, 4);
    }
    tex.needsUpdate = true;
  }
  return { sprite, draw, dispose() { tex.dispose(); sprite.material.dispose(); } };
}
