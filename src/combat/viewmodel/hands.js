// Chunky gloved hands + sleeves with team-colour trim. ONE SkinnedMesh per hand (fingers/thumb/sleeve are bones), one uber material.
// Hand frame: origin at palm centre, fingers extend -Z, back of hand +Y, thumb on -X (right hand; the left hand is a mirrored mesh).
// Units: metres (authored in cm).
import * as THREE from 'three';
import { Part, S } from './geo.js';
import { createUber, setSub, setGlow } from './uber.js';

const DEG = Math.PI / 180;
const _s = new THREE.Vector3(), _w = new THREE.Vector3(), _inv = new THREE.Matrix4(), _zp = new THREE.Vector3(0, 0, 1);
const HID = { glove: 0, gloveLight: 1, pad: 2, cuff: 3, team: 4, sleeve: 5, sleeveTrim: 6, sleeveDark: 7 };

export function createHandMats() {
  const u = createUber(8, { noTone: [4] });
  const m = { u, material: u.material, team: new THREE.Color(0xff7a2f) };
  setSub(u, HID.glove, 0x434b59, 0.8, 0.03); setSub(u, HID.gloveLight, 0x636e80, 0.65, 0.06); setSub(u, HID.pad, 0x1a1e26, 0.5, 0.6);
  setSub(u, HID.cuff, 0x262b35, 0.45, 0.7); setGlow(u, HID.team, 0xff7a2f, 2.2);
  const c = new THREE.Color();
  m.setStyle = (team, suit) => {
    const tc = team === 'tide' ? 0x2fd0ff : 0xff7a2f; setGlow(u, HID.team, tc, 2.2);
    const base = suit?.base ?? (team === 'tide' ? 0x1f4a58 : 0x5a2d1c), acc = suit?.accent ?? tc;
    // sleeve: suit colour pulled hard toward a dark tactical fabric so the arm reads as sleeve, not a flat team wedge
    c.set(base).multiplyScalar(0.5).lerp(new THREE.Color(0x1f242c), 0.9);
    const mat = suit?.material || 'matte';
    setSub(u, HID.sleeve, c, mat === 'metallic' ? 0.32 : mat === 'satin' ? 0.5 : mat === 'holo' ? 0.25 : 0.72, mat === 'metallic' ? 0.7 : mat === 'holo' ? 0.5 : 0.06);
    setSub(u, HID.sleeveDark, c.clone().multiplyScalar(0.55), 0.8, 0.05);
    setSub(u, HID.sleeveTrim, acc, 0.45, 0.2);
  };
  m.setStyle('ember', null);
  m.dispose = () => { u.material.dispose(); };
  return m;
}

// ---- geometry baking: authored with Part (cm) -> accumulated into one skinned buffer
function bake(acc, fn, off, bone, mirror) {
  const p = new Part('h', [0, 0, 0]); fn(p);
  for (const [key, t] of p.mats) {
    const id = HID[key] ?? 0, n = t.count;
    for (let tri = 0; tri < n; tri++) {
      for (let v = 0; v < 3; v++) {
        const vi = mirror ? (v === 0 ? 0 : v === 1 ? 2 : 1) : v, k = (tri * 3 + vi) * 3;
        let x = t.pos[k] + off[0] * S, y = t.pos[k + 1] + off[1] * S, z = t.pos[k + 2] + off[2] * S, nx = t.nor[k];
        if (mirror) { x = -x; nx = -nx; }
        acc.pos.push(x, y, z); acc.nor.push(nx, t.nor[k + 1], t.nor[k + 2]); acc.col.push(t.col[k], t.col[k + 1], t.col[k + 2]);
        acc.uv.push(0, 0); acc.id.push(id); acc.bone.push(bone);
      }
    }
  }
}

const seg = (len, w, h, tip) => (p) => {
  p.box('glove', [0, 0, -len / 2], [w, h, len], { bevel: 0.45 });
  p.box('pad', [0, h / 2 + 0.05, -len / 2], [w * 0.72, 0.4, len * 0.7], { bevel: 0.12 });
  if (tip) p.box('gloveLight', [0, -h * 0.05, -len + 0.15], [w * 0.92, h * 0.9, 0.6], { bevel: 0.2 });
};
const palm = (p) => {
  p.box('glove', [0, 0, 0], [8.6, 3.4, 8.8], { bevel: 1.0 });
  p.box('glove', [0, -0.3, -3.6], [8.8, 3.0, 2.2], { bevel: 0.7 });                   // knuckle bar
  p.box('pad', [0, 1.95, 0.6], [6.6, 0.8, 5.0], { bevel: 0.35 });                      // back-of-hand armour plate
  for (let i = 0; i < 4; i++) p.box('pad', [-3.0 + i * 2.0, 2.0, -3.2], [1.6, 0.7, 1.4], { bevel: 0.25 });   // knuckle guards
  p.box('gloveLight', [0, -1.9, 1.6], [6.4, 0.6, 4.5], { bevel: 0.2 });                // palm pad
  p.box('team', [0, 2.42, 0.6], [4.6, 0.12, 0.35]);                                    // team-colour stitch on the plate
  p.box('gloveLight', [0, 1.7, 4.6], [7.2, 0.5, 1.2], { bevel: 0.2 });                 // wrist strap
  p.cyl('cuff', [0, 0, 6.6], 3.9, 4.1, 3.4, 8, { shade: 1.0 });
  p.cyl('team', [0, 0, 8.35], 4.15, 4.15, 0.4, 8);
};
const tube = (p) => {   // sleeve tube along +Z, length 100 (scaled to the shoulder); 12 facets, accent panel on top, shaded underside
  const sides = 12, r0 = 3.1, r1 = 4.8, verts = [], faces = [], mats = [], shades = [];
  for (let i = 0; i < sides; i++) { const a = (i / sides) * Math.PI * 2 + Math.PI / sides; verts.push([Math.cos(a) * r0, Math.sin(a) * r0, 0]); }
  for (let i = 0; i < sides; i++) { const a = (i / sides) * Math.PI * 2 + Math.PI / sides; verts.push([Math.cos(a) * r1, Math.sin(a) * r1, 100]); }
  for (let i = 0; i < sides; i++) {
    const a = ((i + 0.5) / sides) * Math.PI * 2 + Math.PI / sides, ny = Math.sin(a), nx = Math.cos(a);
    mats.push(ny > 0.93 ? 'sleeveTrim' : ny < -0.4 ? 'sleeveDark' : 'sleeve'); shades.push(0.7 + 0.35 * Math.max(0, ny) + 0.1 * nx);
    const j = (i + 1) % sides; faces.push({ f: [i, j, sides + j, sides + i], w: [nx, ny, 0] });
  }
  faces.forEach((f, i) => p._build(mats[i], verts, [f], [0, 0, 0], { shade: shades[i] }));
};
const ring = (p) => {
  p.cyl('sleeveDark', [0, 0, 1.0], 4.3, 4.6, 2.0, 12);                               // flared gauntlet cuff over the glove
  p.cyl('cuff', [0, 0, 2.6], 4.1, 4.1, 1.2, 12);
  p.cyl('team', [0, 0, 3.4], 4.15, 4.15, 0.35, 12);
  p.cyl('sleeveTrim', [0, 0, 4.1], 4.1, 4.1, 0.8, 12);
  p.box('pad', [0, 4.15, 9], [4.4, 1.0, 11], { bevel: 0.45, tz: [0.8, 1, 1, 1] });  // forearm armour plate
  p.box('team', [0, 4.72, 9], [0.45, 0.16, 10]);
  for (const sx of [-1, 1]) { p.box('pad', [sx * 3.5, 2.4, 8.5], [0.9, 2.8, 7], { bevel: 0.3 }); p.box('gloveLight', [sx * 3.62, 2.4, 13.5], [0.5, 1.0, 1.4], { bevel: 0.15 }); }
  p.cyl('sleeveDark', [0, 0, 15.5], 3.95, 4.05, 1.6, 12);                            // strap
  p.box('cuff', [0, 4.1, 15.5], [1.4, 0.5, 1.8], { bevel: 0.15 });                    // buckle
  p.cyl('sleeveDark', [0, 0, 23], 4.2, 4.3, 1.4, 12);
  p.cyl('sleeveTrim', [0, 0, 24.2], 4.25, 4.25, 0.5, 12);
};

const FINGER_X = [-3.05, -1.02, 1.02, 3.05], FINGER_Z = [-4.3, -4.5, -4.3, -3.9], PROX = [3.9, 4.3, 3.9, 3.3];
const DIST = [[3.3, 1.85, 1.75], [3.6, 1.9, 1.8], [3.3, 1.85, 1.75], [2.8, 1.7, 1.65]];
const PROXW = [[1.95, 1.9], [2.0, 1.95], [1.95, 1.9], [1.8, 1.75]];

export class Hand {
  constructor(side, mats) {
    this.side = side; this.mats = mats; const L = side === 'l', mx = L ? -1 : 1;
    this.root = new THREE.Group(); this.root.name = 'hand-' + side;
    const bones = [], mk = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x * S, y * S, z * S); parent.add(b); bones.push(b); return b; };
    this.body = new THREE.Bone(); this.body.name = 'palm'; bones.push(this.body); this.root.add(this.body);
    this.fingers = [];
    for (let i = 0; i < 4; i++) {
      const a = mk('f' + i + 'a', this.body, FINGER_X[i] * mx, -0.3, FINGER_Z[i]), b = mk('f' + i + 'b', a, 0, 0, -PROX[i]);
      this.fingers.push([a, b]);
    }
    const t0 = mk('t0', this.body, -4.2 * mx, -0.4, 1.6), t1 = mk('t1', t0, 0, 0, -3.6);
    this.thumb = [t0, t1];
    this.sleeve = mk('sleeve', this.body, 0, 0, 8.2); this.ringBone = mk('ring', this.body, 0, 0, 8.2);
    const acc = { pos: [], nor: [], col: [], uv: [], id: [], bone: [] };
    bake(acc, palm, [0, 0, 0], 0, L);
    for (let i = 0; i < 4; i++) {
      bake(acc, seg(PROX[i], PROXW[i][0], PROXW[i][1]), [FINGER_X[i], -0.3, FINGER_Z[i]], 1 + i * 2, L);
      bake(acc, seg(DIST[i][0], DIST[i][1], DIST[i][2], true), [FINGER_X[i], -0.3, FINGER_Z[i] - PROX[i]], 2 + i * 2, L);
    }
    bake(acc, seg(3.6, 2.3, 2.2), [-4.2, -0.4, 1.6], 9, L);
    bake(acc, seg(3.2, 2.15, 2.05, true), [-4.2, -0.4, 1.6 - 3.6], 10, L);
    bake(acc, tube, [0, 0, 8.2], 11, L);
    bake(acc, ring, [0, 0, 8.2], 12, L);
    const g = new THREE.BufferGeometry(), n = acc.id.length;
    g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(acc.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(acc.col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(acc.id, 1));
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = acc.bone[i]; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0.5), 1.2);
    this.mesh = new THREE.SkinnedMesh(g, mats.material); this.mesh.frustumCulled = false; this.mesh.name = 'hand-mesh-' + side;
    this.root.add(this.mesh); this.root.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(bones));
    this.curl = [0.3, 0.3, 0.3, 0.3, 0.2]; this._c = [0, 0, 0, 0, 0];
    this.setCurl(this.curl);
  }
  /** c: 5 curls (index,middle,ring,pinky,thumb) 0..1 */
  setCurl(c) {
    const mx = this.side === 'l' ? -1 : 1;
    for (let i = 0; i < 4; i++) {
      const k = c[i], [a, b] = this.fingers[i];
      a.rotation.x = -k * 78 * DEG; b.rotation.x = -k * 84 * DEG - 0.12 * k;
      a.rotation.y = (i - 1.5) * -0.035 * (1 - k) * mx;
    }
    const k = c[4];
    this.thumb[0].rotation.set(-0.15 * k, (0.5 - 0.45 * k) * mx, -0.25 * k * mx); this.thumb[1].rotation.x = -k * 52 * DEG;
  }
  /** Aim the sleeve at a shoulder anchor given in world space (viewmodel root must have current matrixWorld). */
  aimSleeve(shoulderWorld) {
    this.root.updateWorldMatrix(true, false);
    _inv.copy(this.body.matrixWorld).invert();
    _s.copy(shoulderWorld).applyMatrix4(_inv);
    _w.copy(this.sleeve.position);
    _s.sub(_w); const d = _s.length(); if (d < 1e-4) return; _s.multiplyScalar(1 / d);
    this.sleeve.quaternion.setFromUnitVectors(_zp, _s); this.ringBone.quaternion.copy(this.sleeve.quaternion);
    this.sleeve.scale.set(1, 1, Math.max(0.1, d));
  }
}
