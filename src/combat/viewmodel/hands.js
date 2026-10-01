// Chunky gloved hands + sleeves with team-colour trim. Hand frame: origin at palm centre, fingers extend -Z, back of hand +Y,
// thumb on -X (right hand; the left hand is mirrored with scale.x = -1). Units: metres (authored in cm).
import * as THREE from 'three';
import { Part, toGeometries, S } from './geo.js';

const DEG = Math.PI / 180;
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _w = new THREE.Vector3(), _inv = new THREE.Matrix4(), _zp = new THREE.Vector3(0, 0, 1);

export function createHandMats() {
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  const m = {
    glove: std({ color: 0x2b303a, roughness: 0.82, metalness: 0.02 }),
    gloveLight: std({ color: 0x3a414e, roughness: 0.7, metalness: 0.05 }),
    pad: std({ color: 0x151820, roughness: 0.5, metalness: 0.6 }),
    sleeve: std({ color: 0x3a4658, roughness: 0.7, metalness: 0.1 }),
    sleeveTrim: std({ color: 0xffffff, roughness: 0.5, metalness: 0.2 }),
    cuff: std({ color: 0x191c24, roughness: 0.45, metalness: 0.7 }),
    team: new THREE.MeshBasicMaterial({ color: 0xff7a2f, toneMapped: false }),
  };
  m.setStyle = (team, suit) => {
    m.team.color.set(team === 'tide' ? 0x2fd0ff : 0xff7a2f).multiplyScalar(2.2);
    const base = suit?.base ?? (team === 'tide' ? 0x1f4a58 : 0x5a2d1c), acc = suit?.accent ?? (team === 'tide' ? 0x2fd0ff : 0xff7a2f);
    m.sleeve.color.set(base); m.sleeveTrim.color.set(acc);
    const mat = suit?.material || 'matte';
    m.sleeve.roughness = mat === 'metallic' ? 0.32 : mat === 'satin' ? 0.5 : mat === 'holo' ? 0.25 : 0.72;
    m.sleeve.metalness = mat === 'metallic' ? 0.7 : mat === 'holo' ? 0.5 : 0.08;
  };
  m.dispose = () => { for (const k in m) m[k]?.dispose?.(); };
  return m;
}

function geo(fn) { const p = new Part('h', [0, 0, 0]); fn(p); const out = {}; for (const [k, g] of toGeometries(p)) out[k] = g; return out; }
function meshes(mats, g, parent, pos) {
  for (const k in g) { const m = new THREE.Mesh(g[k], mats[k] || mats.glove); m.matrixAutoUpdate = false; if (pos) { m.position.set(pos[0] * S, pos[1] * S, pos[2] * S); } m.updateMatrix(); parent.add(m); }
}

let shared = null;
function sharedGeo() {
  if (shared) return shared;
  const seg = (len, w, h, tip) => geo((p) => {
    p.box('glove', [0, 0, -len / 2], [w, h, len], { bevel: 0.45 });
    p.box('pad', [0, h / 2 + 0.05, -len / 2], [w * 0.72, 0.4, len * 0.7], { bevel: 0.12 });
    if (tip) p.box('gloveLight', [0, -h * 0.05, -len + 0.15], [w * 0.92, h * 0.9, 0.6], { bevel: 0.2 });
  });
  shared = {
    palm: geo((p) => {
      p.box('glove', [0, 0, 0], [8.6, 3.4, 8.8], { bevel: 1.0 });
      p.box('glove', [0, -0.3, -3.6], [8.8, 3.0, 2.2], { bevel: 0.7 });                   // knuckle bar
      p.box('pad', [0, 1.95, 0.6], [6.6, 0.8, 5.0], { bevel: 0.35 });                      // back-of-hand armour plate
      for (let i = 0; i < 4; i++) p.box('pad', [-3.0 + i * 2.0, 2.0, -3.2], [1.6, 0.7, 1.4], { bevel: 0.25 });   // knuckle guards
      p.box('gloveLight', [0, -1.9, 1.6], [6.4, 0.6, 4.5], { bevel: 0.2 });                // palm pad
      p.box('team', [0, 2.42, 0.6], [4.6, 0.12, 0.35]);                                    // team-colour stitch on the plate
    }),
    cuff: geo((p) => {
      p.cyl('cuff', [0, 0, 0], 4.5, 4.7, 3.4, 8, { shade: 1.0 });
      p.cyl('team', [0, 0, 1.75], 4.75, 4.75, 0.45, 8);
    }),
    prox: [seg(3.9, 1.95, 1.9), seg(4.3, 2.0, 1.95), seg(3.9, 1.95, 1.9), seg(3.3, 1.8, 1.75)],
    dist: [seg(3.3, 1.85, 1.75, true), seg(3.6, 1.9, 1.8, true), seg(3.3, 1.85, 1.75, true), seg(2.8, 1.7, 1.65, true)],
    tProx: seg(3.6, 2.3, 2.2), tDist: seg(3.2, 2.15, 2.05, true),
    sleeve: geo((p) => {
      p.cyl('sleeve', [0, 0, 50], 4.6, 7.2, 100, 8, { open: false, shade: 1.0 });
    }),
    sleeveTrim: geo((p) => { p.cyl('sleeveTrim', [0, 0, 2.2], 4.95, 4.95, 1.4, 8); p.cyl('team', [0, 0, 4.2], 5.05, 5.05, 0.5, 8); }),
  };
  return shared;
}

const FINGER_X = [-3.05, -1.02, 1.02, 3.05], FINGER_Z = [-4.3, -4.5, -4.3, -3.9];

export class Hand {
  constructor(side, mats) {
    const G = sharedGeo(); this.side = side; this.mats = mats;
    this.root = new THREE.Group(); this.root.name = 'hand-' + side;
    this.body = new THREE.Group(); this.root.add(this.body);
    if (side === 'l') this.body.scale.x = -1;
    meshes(mats, G.palm, this.body);
    const cuff = new THREE.Group(); cuff.position.set(0, 0, 6.6 * S); this.body.add(cuff); meshes(mats, G.cuff, cuff);
    this.fingers = [];
    for (let i = 0; i < 4; i++) {
      const g0 = new THREE.Group(); g0.position.set(FINGER_X[i] * S, -0.3 * S, FINGER_Z[i] * S); this.body.add(g0);
      meshes(mats, G.prox[i], g0);
      const g1 = new THREE.Group(); g1.position.z = -[3.9, 4.3, 3.9, 3.3][i] * S; g0.add(g1); meshes(mats, G.dist[i], g1);
      this.fingers.push([g0, g1]);
    }
    const t0 = new THREE.Group(); t0.position.set(-4.2 * S, -0.4 * S, 1.6 * S); t0.rotation.set(0, 0.5, 0); this.body.add(t0); meshes(mats, G.tProx, t0);
    const t1 = new THREE.Group(); t1.position.z = -3.6 * S; t0.add(t1); meshes(mats, G.tDist, t1);
    this.thumb = [t0, t1];
    // sleeve: unit-length tube built along +Z (toward the shoulder), scaled to reach the shoulder anchor
    this.sleeve = new THREE.Group(); this.sleeve.position.set(0, 0, 8.2 * S); this.body.add(this.sleeve);
    this.tube = new THREE.Group(); this.sleeve.add(this.tube); meshes(mats, G.sleeve, this.tube);
    meshes(mats, G.sleeveTrim, this.sleeve);
    this.curl = [0.3, 0.3, 0.3, 0.3, 0.2]; this._c = [0, 0, 0, 0, 0];
    this.pose = { p: [0, 0, 0], r: [0, 0, 0] };
    this.setCurl(this.curl);
  }
  /** c: 5 curls (index,middle,ring,pinky,thumb) 0..1 */
  setCurl(c) {
    for (let i = 0; i < 4; i++) {
      const k = c[i], [a, b] = this.fingers[i];
      a.rotation.x = -k * 78 * DEG; b.rotation.x = -k * 84 * DEG - 0.12 * k;
      a.rotation.y = (i - 1.5) * -0.035 * (1 - k);
    }
    const k = c[4];
    this.thumb[0].rotation.set(-0.15 * k, 0.5 - 0.45 * k, -0.25 * k); this.thumb[1].rotation.x = -k * 52 * DEG;
  }
  /** Aim the sleeve at a shoulder anchor given in world space (viewmodel root must have current matrixWorld). */
  aimSleeve(shoulderWorld) {
    this.root.updateWorldMatrix(true, false);
    _inv.copy(this.body.matrixWorld).invert();
    _s.copy(shoulderWorld).applyMatrix4(_inv);
    _w.set(this.sleeve.position.x, this.sleeve.position.y, this.sleeve.position.z);
    _s.sub(_w); const d = _s.length(); if (d < 1e-4) return; _s.multiplyScalar(1 / d);
    this.sleeve.quaternion.setFromUnitVectors(_zp, _s);
    this.tube.scale.set(1, 1, Math.max(0.1, d / 1.0));
  }
}
