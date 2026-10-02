// Stand-in preview character built ONLY from a CosmeticSpec (used when ctx.characters.createPreview is not available).
// Chunky low-poly athlete with IK arms, emote poses, helmets/visors/back items/charms/tagger skins. Faces +Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { suitTexture, skinTexture, mix, hex } from './textures.js';
import { makePose, resetPose, emotePose, EMOTE_DUR } from './emotes.js';

export const TEAM_COL = { ember: 0xff7a2f, tide: 0x2fd0ff };
const DOWN = new THREE.Vector3(0, -1, 0);
const geoCache = new Map();
function rbox(w, h, d, r = 0.02, seg = 2, uvs = 1) {
  const key = [w, h, d, r, seg, uvs].join('|'); let g = geoCache.get(key); if (g) return g;
  g = new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  if (uvs !== 1) { const uv = g.attributes.uv; const s = Math.max(w, h, d) / 0.5 * uvs; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s); }
  geoCache.set(key, g); return g;
}
function cyl(rt, rb, h, seg = 10) { const key = `c${rt}|${rb}|${h}|${seg}`; let g = geoCache.get(key); if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg); geoCache.set(key, g); } return g; }
function sph(r, ws = 12, hs = 8, ...rest) { const key = `s${r}|${ws}|${hs}|${rest.join(',')}`; let g = geoCache.get(key); if (!g) { g = new THREE.SphereGeometry(r, ws, hs, ...rest); geoCache.set(key, g); } return g; }
function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; return m; }
const stdMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0.1, flatShading: o.flat ?? true, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
const glowMat = (color, ei = 2.2) => new THREE.MeshStandardMaterial({ color: mix(color, 0x000000, 0.55), emissive: color, emissiveIntensity: ei, roughness: 0.4, metalness: 0, flatShading: true });
function disposeTree(o) { o.traverse((c) => { if (c.isMesh) { if (c.material && !c.material.userData?.shared) { (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose()); } if (c.geometry && !c.geometry.userData?.cached && !geoCacheHas(c.geometry)) c.geometry.dispose(); } }); }
const cachedSet = new Set(); function geoCacheHas(g) { if (!cachedSet.size) return false; return cachedSet.has(g); }
function refreshCachedSet() { cachedSet.clear(); for (const g of geoCache.values()) cachedSet.add(g); }

// ------------------------------------------------------------------------------------------ tagger builder
export const TAGGER_KINDS = [
  { id: 'pip',   name: 'Pip',   fore: 0.0,  len: 0.30 },
  { id: 'zip',   name: 'Zip',   fore: 0.24, len: 0.62 },
  { id: 'arc',   name: 'Arc',   fore: 0.32, len: 0.92 },
  { id: 'lance', name: 'Lance', fore: 0.38, len: 1.08 },
];
export function buildTagger(kind, skin, mats) {
  const g = new THREE.Group(); g.name = 'tagger-' + kind;
  const { body, dark, glow, accent } = mats;
  const add = (m) => { g.add(m); return m; };
  if (kind === 'pip') {
    add(mesh(rbox(0.05, 0.07, 0.24, 0.012, 2, 0.7), body, 0, 0.055, 0.1));                     // slide
    add(mesh(rbox(0.045, 0.05, 0.16, 0.01), dark, 0, 0.005, 0.07));                                 // frame
    const gr = add(mesh(rbox(0.044, 0.13, 0.06, 0.012), dark, 0, -0.06, -0.01)); gr.rotation.x = 0.28;   // grip
    add(mesh(rbox(0.05, 0.012, 0.19, 0.004), glow, 0, 0.094, 0.1));                                // glow rib
    add(mesh(cyl(0.012, 0.012, 0.08, 8), dark, 0, 0.055, 0.25)).rotation.x = Math.PI / 2;          // barrel
    add(mesh(rbox(0.012, 0.02, 0.02, 0.003), accent, 0, 0.098, 0.2)); add(mesh(rbox(0.012, 0.02, 0.02, 0.003), accent, 0, 0.098, -0.01));
  } else if (kind === 'zip') {
    add(mesh(rbox(0.06, 0.09, 0.34, 0.014, 2, 0.8), body, 0, 0.06, 0.13));
    add(mesh(rbox(0.05, 0.05, 0.12, 0.01), dark, 0, 0.015, 0.02));
    const gr = add(mesh(rbox(0.048, 0.13, 0.06, 0.012), dark, 0, -0.06, 0.0)); gr.rotation.x = 0.22;
    const mag = add(mesh(rbox(0.04, 0.16, 0.055, 0.008), dark, 0, -0.06, 0.18)); mag.rotation.x = -0.08;
    add(mesh(rbox(0.062, 0.014, 0.28, 0.004), glow, 0, 0.11, 0.13));
    add(mesh(cyl(0.016, 0.016, 0.16, 8), dark, 0, 0.065, 0.36)).rotation.x = Math.PI / 2;
    add(mesh(rbox(0.05, 0.075, 0.16, 0.012), accent, 0, 0.055, -0.19));
  } else if (kind === 'arc') {
    add(mesh(rbox(0.06, 0.1, 0.42, 0.014, 2, 0.9), body, 0, 0.06, 0.14));
    add(mesh(rbox(0.058, 0.08, 0.2, 0.012, 2, 0.9), accent, 0, 0.055, 0.5));                        // handguard
    add(mesh(cyl(0.011, 0.011, 0.24, 8), dark, 0, 0.06, 0.72)).rotation.x = Math.PI / 2;
    add(mesh(cyl(0.02, 0.02, 0.06, 8), dark, 0, 0.06, 0.84)).rotation.x = Math.PI / 2;
    const gr = add(mesh(rbox(0.05, 0.13, 0.06, 0.012), dark, 0, -0.06, 0.0)); gr.rotation.x = 0.25;
    const mag = add(mesh(rbox(0.045, 0.19, 0.06, 0.008), dark, 0, -0.07, 0.2)); mag.rotation.x = -0.28;
    add(mesh(rbox(0.055, 0.09, 0.22, 0.012), dark, 0, 0.03, -0.24));                             // stock
    add(mesh(rbox(0.062, 0.014, 0.46, 0.004), glow, 0, 0.115, 0.15));
    add(mesh(rbox(0.03, 0.045, 0.1, 0.008), dark, 0, 0.13, 0.12));                               // rear sight
  } else {  // lance
    add(mesh(rbox(0.055, 0.09, 0.5, 0.012, 2, 0.9), body, 0, 0.05, 0.15));
    add(mesh(rbox(0.05, 0.06, 0.34, 0.01, 2, 0.9), accent, 0, 0.045, 0.62));
    add(mesh(cyl(0.01, 0.01, 0.3, 8), dark, 0, 0.05, 0.92)).rotation.x = Math.PI / 2;
    const sc = add(mesh(cyl(0.028, 0.028, 0.26, 12), dark, 0, 0.14, 0.15)); sc.rotation.x = Math.PI / 2;
    add(mesh(cyl(0.036, 0.03, 0.05, 12), glow, 0, 0.14, 0.29)).rotation.x = Math.PI / 2;
    add(mesh(rbox(0.02, 0.03, 0.04, 0.005), dark, 0, 0.1, 0.12)); add(mesh(rbox(0.02, 0.03, 0.04, 0.005), dark, 0, 0.1, 0.22));
    const gr = add(mesh(rbox(0.05, 0.13, 0.06, 0.012), dark, 0, -0.06, 0.0)); gr.rotation.x = 0.25;
    add(mesh(rbox(0.05, 0.11, 0.26, 0.012), dark, 0, 0.0, -0.3));
    add(mesh(rbox(0.06, 0.012, 0.5, 0.004), glow, 0, 0.098, 0.15));
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  return g;
}

export function makeSkinnedTagger(kind, sk, meta = {}) {
  const tex = skinTexture(sk.pattern, sk.primary, sk.accent, sk.wear, meta.decal, sk.glow); const fin = meta.finish ?? 'matte', w = sk.wear;
  const P = { matte: [0.85, 0.05], gloss: [0.14, 0.25], metal: [0.22, 0.92], holo: [0.2, 0.55], carbon: [0.38, 0.65] }[fin] ?? [0.5, 0.2];
  const bodyMat = fin === 'holo' ? new THREE.MeshPhysicalMaterial({ map: tex, color: 0xffffff, roughness: P[0] + w * 0.5, metalness: P[1] - w * 0.3, iridescence: 1 - w * 0.6, iridescenceIOR: 1.8, iridescenceThicknessRange: [180, 700], flatShading: true, clearcoat: 0.6 - w })
    : new THREE.MeshPhysicalMaterial({ map: tex, color: 0xffffff, roughness: Math.min(1, P[0] + w * 0.55), metalness: Math.max(0, P[1] - w * 0.35), flatShading: true, clearcoat: fin === 'gloss' ? 1 - w * 1.2 : 0, clearcoatRoughness: 0.12 });
  const mats = { body: bodyMat, dark: stdMat(mix(sk.primary, 0x0a0b10, 0.8), { rough: 0.4 + w * 0.3, metal: 0.55 }), glow: glowMat(sk.glow, 1.3), accent: stdMat(sk.accent, { rough: 0.3 + w * 0.4, metal: fin === 'metal' ? 0.9 : 0.4 }) };
  return buildTagger(kind, sk, mats);
}
// ------------------------------------------------------------------------------------------ rig
export function createRig() {
  refreshCachedSet();
  const root = new THREE.Group(); root.name = 'preview-rig';
  const M = {
    suit: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.05, flatShading: false }),
    accent: stdMat(0xcccccc, { rough: 0.4, metal: 0.3 }),
    boot: stdMat(0x22242b, { rough: 0.7 }),
    plate: stdMat(0x333, { rough: 0.45, metal: 0.25 }),
    face: stdMat(0x1c1f27, { rough: 0.6 }),
    team: new THREE.MeshStandardMaterial({ color: 0x222222, emissive: TEAM_COL.ember, emissiveIntensity: 2.0, roughness: 0.5, flatShading: true }),
    glove: stdMat(0x1a1c22, { rough: 0.75 }),
    dark: stdMat(0x2a2d36, { rough: 0.45, metal: 0.5 }),
  };
  for (const k of Object.keys(M)) M[k].userData.shared = true;
  const crystal = new THREE.MeshPhysicalMaterial({ color: 0xbfefff, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.78, emissive: 0x2ab7e0, emissiveIntensity: 0.9, flatShading: true, clearcoat: 1 });
  crystal.userData.shared = true;

  const body = new THREE.Group(); body.position.y = 0.9; root.add(body);
  body.add(mesh(rbox(0.34, 0.15, 0.21, 0.04, 2, 0.6), M.suit, 0, 0.02, 0));
  // legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(sx * 0.1, -0.02, 0); body.add(hip);
    hip.add(mesh(rbox(0.155, 0.46, 0.17, 0.05, 2, 0.6), M.suit, 0, -0.22, 0));
    const knee = new THREE.Group(); knee.position.set(0, -0.44, 0.01); hip.add(knee);
    knee.add(mesh(rbox(0.135, 0.44, 0.15, 0.045, 2, 0.6), M.suit, 0, -0.21, -0.005));
    knee.add(mesh(rbox(0.15, 0.1, 0.08, 0.03), M.accent, 0, 0.02, 0.08));                       // knee pad
    knee.add(mesh(rbox(0.15, 0.1, 0.29, 0.04), M.boot, 0, -0.42, 0.045));                       // boot
    knee.add(mesh(rbox(0.155, 0.03, 0.3, 0.012), M.accent, 0, -0.475, 0.045));                    // sole trim
    legs.push({ hip, knee });
  }
  // spine + chest
  const spine = new THREE.Group(); spine.position.y = 0.05; body.add(spine);
  const chestG = new THREE.Group(); spine.add(chestG);
  chestG.add(mesh(rbox(0.44, 0.47, 0.26, 0.06, 3, 0.7), M.suit, 0, 0.235, 0));
  chestG.add(mesh(rbox(0.36, 0.3, 0.06, 0.03), M.plate, 0, 0.27, 0.15));                               // tag vest plate
  chestG.add(mesh(rbox(0.32, 0.03, 0.03, 0.008), M.team, 0, 0.36, 0.185));                              // team-coloured emissive chest bar
  chestG.add(mesh(rbox(0.2, 0.03, 0.03, 0.008), M.accent, 0, 0.30, 0.185));
  chestG.add(mesh(rbox(0.42, 0.06, 0.25, 0.02), M.accent, 0, -0.005, 0));                              // belt
  chestG.add(mesh(rbox(0.05, 0.05, 0.03, 0.01), M.dark, 0, 0.0, 0.135));                               // buckle
  // neck + head
  const head = new THREE.Group(); head.position.set(0, 0.62, 0); chestG.add(head);
  chestG.add(mesh(cyl(0.05, 0.06, 0.1, 8), M.face, 0, 0.5, 0));
  const headMesh = mesh(rbox(0.235, 0.25, 0.245, 0.06, 3), M.face, 0, 0, 0); head.add(headMesh);
  const helmetG = new THREE.Group(); head.add(helmetG);
  const visorG = new THREE.Group(); head.add(visorG);
  // arms (IK)
  const L1 = 0.32, L2 = 0.3;
  const arms = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Vector3(sx * 0.29, 0.40, 0);
    const upper = new THREE.Group(); upper.position.copy(shoulder); chestG.add(upper);
    const bicep = mesh(rbox(0.115, L1, 0.115, 0.04, 2, 0.6), M.suit, 0, -L1 / 2, 0); upper.add(bicep);
    upper.add(mesh(rbox(0.125, 0.06, 0.125, 0.02), M.team, 0, -0.09, 0));                              // team band
    const fore = new THREE.Group(); fore.position.set(0, -L1, 0); upper.add(fore);
    fore.add(mesh(rbox(0.1, L2 - 0.06, 0.1, 0.035, 2, 0.6), M.suit, 0, -(L2 - 0.06) / 2, 0));
    fore.add(mesh(rbox(0.105, 0.08, 0.105, 0.03), M.accent, 0, -0.05, 0));                              // bracer
    fore.add(mesh(rbox(0.1, 0.1, 0.11, 0.035), M.glove, 0, -(L2 - 0.03), 0.01));                         // hand
    const pad = mesh(rbox(0.16, 0.09, 0.17, 0.035), M.accent, sx * 0.29, 0.44, 0); chestG.add(pad);
    arms.push({ shoulder, upper, fore, bicep, pad, sx });
  }
  const backMount = new THREE.Group(); backMount.position.set(0, 0.26, -0.15); chestG.add(backMount);
  const charmMount = new THREE.Group(); charmMount.position.set(0.22, 0.0, 0.02); chestG.add(charmMount);
  const gunG = new THREE.Group(); chestG.add(gunG);

  // ---- nameplate (sprite)
  const nameCv = document.createElement('canvas'); nameCv.width = 512; nameCv.height = 128;
  const nameTex = new THREE.CanvasTexture(nameCv); nameTex.colorSpace = THREE.SRGBColorSpace; nameTex.anisotropy = 4;
  const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex, transparent: true, depthWrite: false, depthTest: false })); nameSprite.scale.set(1.0, 0.25, 1); nameSprite.position.set(0, 2.05, 0); nameSprite.renderOrder = 20; root.add(nameSprite);

  // ---- state
  const rig = {
    root, body, head, arms, legs, M, crystal, spec: null, team: 'ember', name: 'PLAYER',
    keys: {}, cur: makePose(), tgt: makePose(), emote: null, emoteT: 0, jog: false, jogPh: 0, inspect: 0, inspectTarget: 0, time: 0, crystalOn: false,
    tagger: { kind: 'arc', group: null, fore: 0.32 }, backObj: null, charmObj: null, animated: { flame: [], cloth: null, tail: null, wings: [], halo: null, charm: null, ant: null },
    hover: 0,
  };
  const V = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3(), p: new THREE.Vector3(), t: new THREE.Vector3() };
  const Q = { u: new THREE.Quaternion(), f: new THREE.Quaternion() };

  function solveArm(arm, tx, ty, tz, px, py, pz, lift) {
    const S = V.a.set(arm.shoulder.x, arm.shoulder.y + lift, arm.shoulder.z);
    const T = V.b.set(tx, ty, tz), d = V.c.subVectors(T, S); let dist = d.length();
    const maxR = (L1 + L2) * 0.997; if (dist > maxR) { d.multiplyScalar(maxR / dist); T.copy(S).add(d); dist = maxR; }
    if (dist < 0.1) dist = 0.1;
    const u = V.d.copy(d).normalize();
    const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const p = V.p.set(px, py, pz); p.addScaledVector(u, -p.dot(u)); if (p.lengthSq() < 1e-5) p.set(0, -1, 0).addScaledVector(u, u.y); p.normalize();
    const E = V.e.copy(S).addScaledVector(u, a).addScaledVector(p, h);
    arm.upper.position.copy(S);
    Q.u.setFromUnitVectors(DOWN, V.t.subVectors(E, S).normalize()); arm.upper.quaternion.copy(Q.u);
    Q.f.setFromUnitVectors(DOWN, V.t.subVectors(T, E).normalize()); arm.fore.quaternion.copy(Q.u).invert().multiply(Q.f);
  }

  // ---------------------------------------------------------------- spec application
  rig.setSpec = function (spec, { team = 'ember', name = 'PLAYER' } = {}) {
    rig.spec = spec; rig.team = team; rig.name = name;
    const s = spec.suit;
    // suit material
    const tex = s.pattern === 'solid' ? null : suitTexture(s.pattern, s.base, s.patternColor);
    M.suit.map = tex; M.suit.color.setHex(tex ? 0xffffff : s.base); M.suit.needsUpdate = true;
    const mat = s.material;
    M.suit.roughness = mat === 'matte' ? 0.85 : mat === 'satin' ? 0.5 : mat === 'metallic' ? 0.28 : 0.22;
    M.suit.metalness = mat === 'matte' ? 0.0 : mat === 'satin' ? 0.12 : mat === 'metallic' ? 0.85 : 0.35;
    M.suit.iridescence = mat === 'holo' ? 1 : 0; M.suit.iridescenceIOR = 1.7; M.suit.iridescenceThicknessRange = [200, 650];
    M.suit.emissive.setHex(mat === 'holo' ? mix(s.accent, 0x000000, 0.8) : 0x000000); M.suit.emissiveIntensity = 0.7;
    M.accent.color.setHex(s.accent); M.accent.emissive.setHex(mix(s.accent, 0x000000, 0.86)); M.accent.roughness = mat === 'metallic' ? 0.25 : 0.42; M.accent.metalness = mat === 'metallic' ? 0.7 : 0.25;
    M.plate.color.setHex(mix(s.base, 0x000000, 0.4));
    M.boot.color.setHex(mix(s.base, 0x000000, 0.72));
    M.glove.color.setHex(mix(s.base, 0x000000, 0.78));
    M.team.emissive.setHex(TEAM_COL[team] ?? 0xffffff);
    M.dark.color.setHex(mix(s.base, 0x111318, 0.75));
    // parts
    const kH = JSON.stringify(spec.helmet), kV = JSON.stringify(spec.visor), kB = JSON.stringify(spec.back), kC = JSON.stringify(spec.charm), kT = JSON.stringify(spec.taggerSkin) + rig.tagger.kind, kN = JSON.stringify(spec.nameplate) + name + team;
    if (rig.keys.h !== kH) { rig.keys.h = kH; buildHelmet(spec.helmet); }
    if (rig.keys.v !== kV) { rig.keys.v = kV; buildVisor(spec.visor); }
    if (rig.keys.b !== kB) { rig.keys.b = kB; buildBack(spec.back); }
    if (rig.keys.c !== kC) { rig.keys.c = kC; buildCharm(spec.charm); }
    if (rig.keys.t !== kT) { rig.keys.t = kT; buildGun(spec.taggerSkin); }
    if (rig.keys.n !== kN) { rig.keys.n = kN; drawName(spec.nameplate); }
    refreshCachedSet();
    if (rig.crystalOn) rig.setCrystal(true, true);
  };
  rig.setTaggerKind = function (kind) { if (rig.tagger.kind === kind) return; rig.tagger.kind = kind; if (rig.spec) { rig.keys.t = null; buildGun(rig.spec.taggerSkin); rig.keys.t = JSON.stringify(rig.spec.taggerSkin) + kind; } };

  function clear(g) { while (g.children.length) { const c = g.children[0]; g.remove(c); disposeTree(c); } }

  function buildGun(sk) {
    clear(gunG);
    const tex = skinTexture(sk.pattern, sk.primary, sk.accent, sk.wear);
    const mats = {
      body: new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.32 + sk.wear * 0.55, metalness: 0.45 - sk.wear * 0.25, flatShading: true }),
      dark: stdMat(mix(sk.primary, 0x0a0b10, 0.8), { rough: 0.4 + sk.wear * 0.3, metal: 0.55 }),
      glow: glowMat(sk.glow, 1.3), accent: stdMat(sk.accent, { rough: 0.35 + sk.wear * 0.4, metal: 0.4 }),
    };
    const kd = TAGGER_KINDS.find((k) => k.id === rig.tagger.kind) ?? TAGGER_KINDS[2];
    rig.tagger.fore = kd.fore; const g = buildTagger(kd.id, sk, mats); gunG.add(g); rig.tagger.group = g; rig.tagger.def = kd;
    gunG.visible = true;
  }

  // ---- helmet
  function buildHelmet(h) {
    clear(helmetG);
    const mat = stdMat(h.color, { rough: 0.42, metal: 0.25 }), acc = stdMat(h.accent, { rough: 0.35, metal: 0.3, emissive: mix(h.accent, 0x000000, 0.75) });
    const domeR = 0.158;
    const dome = (theta = Math.PI * 0.44, r = domeR, ws = 12, hs = 7) => mesh(sph(r, ws, hs, 0, Math.PI * 2, 0, theta), mat, 0, 0.02, 0);
    rig.animated.halo = null; rig.animated.ant = null;
    switch (h.shape) {
      case 'none': {
        const hair = mesh(sph(0.138, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), stdMat(0x2a2118, { rough: 0.9 }), 0, 0.045, -0.005); helmetG.add(hair);
        break;
      }
      case 'round': {
        helmetG.add(dome()); const rim = mesh(new THREE.TorusGeometry(0.152, 0.012, 6, 16), acc, 0, 0.05, 0); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.05, 1); helmetG.add(rim);
        helmetG.add(mesh(rbox(0.035, 0.02, 0.3, 0.006), acc, 0, 0.175, 0));
        break;
      }
      case 'visorcap': {
        helmetG.add(mesh(sph(0.15, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.42), mat, 0, 0.03, 0));
        const bill = mesh(rbox(0.2, 0.014, 0.13, 0.006), acc, 0, 0.05, 0.17); bill.rotation.x = 0.18; helmetG.add(bill);
        helmetG.add(mesh(cyl(0.012, 0.012, 0.03, 6), acc, 0, 0.187, 0));
        break;
      }
      case 'hex': {
        const d = mesh(sph(0.165, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.47), mat, 0, 0.02, 0); helmetG.add(d);
        const rim = mesh(new THREE.TorusGeometry(0.16, 0.014, 4, 6), acc, 0, 0.055, 0); rim.rotation.x = Math.PI / 2; helmetG.add(rim);
        helmetG.add(mesh(rbox(0.1, 0.02, 0.1, 0.006), acc, 0, 0.175, 0.02));
        break;
      }
      case 'crest': {
        helmetG.add(dome());
        const fin = new THREE.Shape(); fin.moveTo(-0.16, 0); fin.lineTo(-0.12, 0.14); fin.lineTo(-0.02, 0.2); fin.lineTo(0.08, 0.15); fin.lineTo(0.15, 0.02); fin.lineTo(0.1, 0.02); fin.lineTo(0.0, 0.11); fin.lineTo(-0.1, 0.05); fin.closePath();
        const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.03, bevelEnabled: false }); fg.translate(0, 0, -0.015);
        const fm = new THREE.Mesh(fg, acc); fm.rotation.y = Math.PI / 2; fm.position.set(0, 0.145, 0.0); fm.castShadow = true; helmetG.add(fm);
        break;
      }
      case 'antenna': {
        helmetG.add(dome());
        helmetG.add(mesh(cyl(0.075, 0.075, 0.1, 10), acc, 0.15, 0.0, 0).rotateZ(Math.PI / 2)); helmetG.add(mesh(cyl(0.075, 0.075, 0.1, 10), acc, -0.15, 0.0, 0).rotateZ(Math.PI / 2));
        const rod = mesh(cyl(0.008, 0.01, 0.26, 6), stdMat(0x888c99, { rough: 0.4, metal: 0.7 }), 0.06, 0.29, -0.03); helmetG.add(rod);
        const tip = mesh(sph(0.026, 8, 6), glowMat(h.accent, 3.0), 0.06, 0.43, -0.03); helmetG.add(tip); rig.animated.ant = tip;
        break;
      }
      case 'horns': {
        helmetG.add(dome(Math.PI * 0.42));
        for (const sx of [-1, 1]) {
          const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(sx * 0.1, 0.1, 0.02), new THREE.Vector3(sx * 0.18, 0.2, 0.04), new THREE.Vector3(sx * 0.2, 0.3, 0.09), new THREE.Vector3(sx * 0.14, 0.36, 0.14)]);
          const tg = new THREE.TubeGeometry(curve, 8, 0.024, 6, false); const hm = new THREE.Mesh(tg, acc); hm.castShadow = true; helmetG.add(hm);
          helmetG.add(mesh(cyl(0.001, 0.026, 0.07, 6), acc, sx * 0.14, 0.4, 0.16));
        }
        break;
      }
      case 'halo': {
        helmetG.add(mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 20), acc, 0, 0.02, 0).rotateX(Math.PI / 2));    // headband
        const ring = mesh(new THREE.TorusGeometry(0.19, 0.016, 8, 32), glowMat(h.accent, 3.0), 0, 0.3, -0.01); ring.rotation.x = Math.PI / 2; ring.castShadow = false; helmetG.add(ring); rig.animated.halo = ring;
        helmetG.add(mesh(sph(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.47), mat, 0, 0.03, 0));
        break;
      }
    }
  }

  // ---- visor
  function buildVisor(v) {
    clear(visorG);
    const glow = glowMat(v.glow, 2.6), lens = new THREE.MeshStandardMaterial({ color: v.color, emissive: v.glow, emissiveIntensity: 1.4, roughness: 0.15, metalness: 0.2, flatShading: true });
    const frame = stdMat(0x0d0f14, { rough: 0.4, metal: 0.4 }); const Z = 0.124, y = 0.01;
    switch (v.shape) {
      case 'wide': visorG.add(mesh(rbox(0.215, 0.085, 0.02, 0.03), frame, 0, y, Z - 0.004)); visorG.add(mesh(rbox(0.195, 0.062, 0.02, 0.026), lens, 0, y, Z + 0.004)); break;
      case 'slit': visorG.add(mesh(rbox(0.215, 0.04, 0.02, 0.016), frame, 0, y, Z - 0.004)); visorG.add(mesh(rbox(0.2, 0.024, 0.02, 0.01), lens, 0, y, Z + 0.004)); break;
      case 'round': for (const sx of [-1, 1]) { const f = mesh(cyl(0.056, 0.056, 0.02, 12), frame, sx * 0.058, y, Z - 0.002); f.rotation.x = Math.PI / 2; visorG.add(f); const l = mesh(cyl(0.044, 0.044, 0.02, 12), lens, sx * 0.058, y, Z + 0.006); l.rotation.x = Math.PI / 2; visorG.add(l); } visorG.add(mesh(rbox(0.05, 0.016, 0.014, 0.004), frame, 0, y, Z)); break;
      case 'shades': { const dk = new THREE.MeshStandardMaterial({ color: v.color, roughness: 0.08, metalness: 0.6, flatShading: true }); for (const sx of [-1, 1]) { const g = new THREE.Group(); g.position.set(sx * 0.06, y - 0.004, Z); visorG.add(g); const r = mesh(rbox(0.1, 0.07, 0.02, 0.02), glow, 0, 0, -0.004); g.add(r); const l = mesh(rbox(0.09, 0.058, 0.02, 0.018), dk, 0, 0, 0.004); l.rotation.z = -sx * 0.06; g.add(l); } visorG.add(mesh(rbox(0.05, 0.014, 0.014, 0.004), glow, 0, y + 0.014, Z)); break; }
      case 'cyclops': { const f = mesh(cyl(0.062, 0.062, 0.02, 14), frame, 0, y, Z - 0.002); f.rotation.x = Math.PI / 2; visorG.add(f); const l = mesh(cyl(0.048, 0.048, 0.02, 14), lens, 0, y, Z + 0.006); l.rotation.x = Math.PI / 2; visorG.add(l); visorG.add(mesh(rbox(0.22, 0.026, 0.018, 0.008), frame, 0, y, Z - 0.006)); break; }
      case 'x': for (const s of [-1, 1]) { const b = mesh(rbox(0.22, 0.026, 0.018, 0.008), glow, 0, y, Z + 0.004); b.rotation.z = s * 0.48; visorG.add(b); } visorG.add(mesh(rbox(0.21, 0.08, 0.016, 0.02), frame, 0, y, Z - 0.008)); break;
    }
    visorG.userData.shape = v.shape;
  }

  // ---- back items
  function buildBack(b) {
    clear(backMount); rig.animated.flame.length = 0; rig.animated.cloth = null; rig.animated.tail = null; rig.animated.wings.length = 0;
    if (b.model === 'none') return;
    const mat = stdMat(b.color, { rough: 0.45, metal: 0.25 }), dark = stdMat(mix(b.color, 0x000000, 0.6), { rough: 0.5, metal: 0.4 }), glow = glowMat(TEAM_COL[rig.team], 2.0);
    switch (b.model) {
      case 'pack': {
        backMount.add(mesh(rbox(0.32, 0.4, 0.14, 0.04, 2), mat, 0, 0, -0.02));
        backMount.add(mesh(rbox(0.26, 0.14, 0.05, 0.02), dark, 0, 0.03, -0.11));
        for (const sx of [-1, 1]) backMount.add(mesh(rbox(0.07, 0.24, 0.1, 0.03), dark, sx * 0.19, -0.05, -0.02));
        backMount.add(mesh(rbox(0.22, 0.02, 0.02, 0.006), glow, 0, 0.14, -0.105));
        break;
      }
      case 'jet': {
        backMount.add(mesh(rbox(0.26, 0.3, 0.1, 0.03), dark, 0, 0.0, -0.02));
        for (const sx of [-1, 1]) {
          const cyl1 = mesh(cyl(0.055, 0.07, 0.34, 10), mat, sx * 0.1, -0.06, -0.11); cyl1.rotation.x = -0.12; backMount.add(cyl1);
          backMount.add(mesh(cyl(0.075, 0.06, 0.05, 10), dark, sx * 0.1, -0.24, -0.13));
          const fl = mesh(new THREE.ConeGeometry(0.06, 0.32, 10), new THREE.MeshBasicMaterial({ color: mix(b.color, 0xffffff, 0.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), sx * 0.1, -0.42, -0.135, false);
          fl.rotation.x = Math.PI; fl.material.color.multiplyScalar(1.6); backMount.add(fl); rig.animated.flame.push(fl);
        }
        break;
      }
      case 'banner': {
        backMount.add(mesh(rbox(0.2, 0.1, 0.06, 0.02), dark, 0, -0.02, -0.03));
        backMount.add(mesh(cyl(0.011, 0.011, 0.88, 6), dark, 0, 0.36, -0.06));
        backMount.add(mesh(rbox(0.36, 0.02, 0.02, 0.006), mat, 0, 0.78, -0.06)); backMount.add(mesh(sph(0.02, 6, 4), mat, 0, 0.83, -0.06)); for (const sx of [-1, 1]) backMount.add(mesh(sph(0.018, 6, 4), mat, sx * 0.18, 0.78, -0.06));
        const cg = new THREE.PlaneGeometry(0.32, 0.62, 6, 12); cg.translate(0, -0.31, 0);
        const cm = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.6, side: THREE.DoubleSide, flatShading: true, emissive: mix(b.color, 0x000000, 0.85) })); cm.position.set(0, 0.77, -0.075); cm.castShadow = true;
        // emblem stripe as vertex colours
        const cols = new Float32Array(cg.attributes.position.count * 3); const cc = new THREE.Color(b.color), c2 = new THREE.Color(mix(b.color, 0xffffff, 0.6));
        for (let i = 0; i < cg.attributes.position.count; i++) { const yy = cg.attributes.position.getY(i); const t = -yy / 0.62; const m = (t > 0.55 && t < 0.63) || (t > 0.9) ? 1 : 0; const c = m ? c2 : cc; cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
        cg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); cm.material.vertexColors = true; cm.material.color.setHex(0xffffff);
        backMount.add(cm); rig.animated.cloth = { mesh: cm, base: cg.attributes.position.array.slice() };
        break;
      }
      case 'tail': {
        const segs = []; const n = 7; let parent = backMount;
        for (let i = 0; i < n; i++) {
          const g = new THREE.Group(); g.position.set(0, i === 0 ? -0.1 : 0, i === 0 ? -0.1 : -0.09); parent.add(g);
          const s = 1 - i / n * 0.75; g.add(mesh(rbox(0.11 * s, 0.09 * s + 0.01, 0.12, 0.03, 2), i % 2 ? mat : dark, 0, 0.0, -0.045));
          segs.push(g); parent = g;
        }
        const tip = mesh(new THREE.ConeGeometry(0.06, 0.2, 5), glowMat(b.color, 1.8), 0, 0, -0.16); tip.rotation.x = -Math.PI / 2; segs[n - 1].add(tip);
        rig.animated.tail = segs; break;
      }
      case 'wings': {
        for (const sx of [-1, 1]) {
          const root = new THREE.Group(); root.position.set(sx * 0.1, 0.12, -0.06); backMount.add(root);
          const feathers = [];
          for (let i = 0; i < 6; i++) {
            const len = 0.62 - Math.abs(i - 1.2) * 0.06 - i * 0.03; const fg = new THREE.Group(); fg.rotation.z = sx * (-0.15 - i * 0.24); fg.rotation.y = sx * (0.35 - i * 0.02); root.add(fg);
            const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(sx * 0.055, len * 0.4); shape.lineTo(sx * 0.03, len); shape.lineTo(-sx * 0.02, len * 0.55); shape.closePath();
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
            const fm = new THREE.Mesh(geo, i % 2 ? mat : new THREE.MeshStandardMaterial({ color: mix(b.color, 0xffffff, 0.35), roughness: 0.3, metalness: 0.5, emissive: b.color, emissiveIntensity: 0.55, flatShading: true }));
            fm.castShadow = true; fg.add(fm); fg.position.z = -i * 0.006; feathers.push(fg); fg.userData.rz = fg.rotation.z;
          }
          const rm = mesh(rbox(0.07, 0.07, 0.05, 0.02), dark, 0, 0, 0); root.add(rm); root.userData.sx = sx; rig.animated.wings.push({ root, feathers, sx });
        }
        break;
      }
    }
  }

  // ---- charm
  function buildCharm(c) {
    clear(charmMount); rig.animated.charm = null;
    if (c.model === 'none') return;
    const pivot = new THREE.Group(); charmMount.add(pivot);
    const chain = mesh(cyl(0.004, 0.004, 0.09, 4), stdMat(0xaab0bd, { rough: 0.3, metal: 0.9 }), 0, -0.045, 0); pivot.add(chain);
    const cm = new THREE.MeshStandardMaterial({ color: mix(c.color, 0x000000, 0.25), emissive: c.color, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.1, flatShading: true });
    const item = new THREE.Group(); item.position.y = -0.13; pivot.add(item);
    const extr = (pts, depth, scale) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x * scale, y * scale) : s.moveTo(x * scale, y * scale))); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: depth * 0.25, bevelThickness: depth * 0.25, bevelSegments: 1 }); g.translate(0, 0, -depth / 2); return g; };
    switch (c.model) {
      case 'orb': item.add(mesh(new THREE.IcosahedronGeometry(0.045, 1), cm)); item.add(mesh(cyl(0.008, 0.008, 0.02, 6), stdMat(0xaab0bd, { metal: 0.9, rough: 0.3 }), 0, 0.05, 0)); break;
      case 'cube': item.add(mesh(rbox(0.07, 0.07, 0.07, 0.014), cm)); break;
      case 'star': { const pts = []; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.4 : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } item.add(new THREE.Mesh(extr(pts, 0.02, 0.06), cm)); break; }
      case 'cat': { item.add(mesh(sph(0.05, 8, 6), cm)); for (const sx of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.02, 0.04, 4), cm, sx * 0.03, 0.05, 0); e.rotation.z = -sx * 0.25; item.add(e); item.add(mesh(sph(0.007, 4, 4), stdMat(0x111111), sx * 0.02, 0.008, 0.045)); } break; }
      case 'bolt': item.add(new THREE.Mesh(extr([[0.2, 1], [-0.5, -0.1], [-0.05, -0.1], [-0.3, -1], [0.55, 0.1], [0.08, 0.1], [0.4, 1]], 0.02, 0.06), cm)); break;
    }
    rig.animated.charm = { pivot, item };
  }

  // ---- nameplate
  function drawName(np) {
    const cv = nameCv, ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
    const col = hex(np.color), team = hex(TEAM_COL[rig.team]);
    const txt = rig.name.toUpperCase(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 58px "Barlow Condensed","Rajdhani","Arial Narrow",system-ui,sans-serif';
    const w = Math.min(440, ctx.measureText(txt).width + 60);
    if (np.style === 'hex') {
      const cx = 256, cy = 64, hw = w / 2, hh = 40; ctx.beginPath(); ctx.moveTo(cx - hw, cy); ctx.lineTo(cx - hw + 28, cy - hh); ctx.lineTo(cx + hw - 28, cy - hh); ctx.lineTo(cx + hw, cy); ctx.lineTo(cx + hw - 28, cy + hh); ctx.lineTo(cx - hw + 28, cy + hh); ctx.closePath();
      ctx.fillStyle = 'rgba(8,10,16,0.72)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.fillText(txt, cx, cy + 2);
    } else if (np.style === 'glow') {
      ctx.shadowColor = col; ctx.shadowBlur = 26; ctx.fillStyle = col; for (let i = 0; i < 3; i++) ctx.fillText(txt, 256, 62); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillText(txt, 256, 62);
      ctx.fillStyle = col; ctx.fillRect(256 - w / 2 + 20, 100, w - 40, 3);
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8; ctx.fillStyle = col; ctx.fillText(txt, 256, 62); ctx.shadowBlur = 0; ctx.fillStyle = team; ctx.fillRect(256 - w / 2 + 40, 100, w - 80, 3);
    }
    nameTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- crystal (tag-out freeze)
  rig.setCrystal = function (on, force = false) {
    if (on === rig.crystalOn && !force) return; rig.crystalOn = on;
    const tint = rig.spec?.suit?.accent ?? 0xbfefff; crystal.color.setHex(mix(0xbfefff, tint, 0.25)); crystal.emissive.setHex(mix(0x1f9fc8, tint, 0.3));
    root.traverse((o) => { if (o.isMesh && o !== nameSprite) { if (on) { if (!o.userData.mat0) o.userData.mat0 = o.material; o.material = crystal; } else if (o.userData.mat0) { o.material = o.userData.mat0; o.userData.mat0 = null; } } });
  };
  rig.setVisible = (v) => { body.visible = v; nameSprite.visible = v && showName; };
  let showName = false; rig.setNameVisible = (v) => { showName = v; nameSprite.visible = v && body.visible; };

  // ---------------------------------------------------------------- per-frame
  const A = rig.animated; const tgt = rig.tgt, cur = rig.cur;
  const lerp = (a, b, k) => a + (b - a) * k;
  const R = new THREE.Vector3(), Lh = new THREE.Vector3();
  rig.playEmote = (id) => { rig.emote = id; rig.emoteT = 0; };
  rig.stopEmote = () => { if (rig.emote) { rig.emote = null; cur.bodyYaw = ((cur.bodyYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; } };
  rig.emoteProgress = () => (rig.emote ? rig.emoteT / (EMOTE_DUR[rig.emote] ?? 3) : 0);

  rig.update = function (dt) {
    rig.time += dt; const t = rig.time;
    dt = Math.min(dt, 0.05);
    resetPose(tgt);
    let emoteActive = false;
    if (rig.emote) { rig.emoteT += dt; emoteActive = emotePose(rig.emote, rig.emoteT, tgt); if (!emoteActive) { rig.stopEmote(); } }
    if (!emoteActive) {
      // idle / jog with tagger raised
      tgt.gun = 1;
      const br = Math.sin(t * 1.9);
      if (rig.jog) {
        rig.jogPh += dt * 10.5; const ph = rig.jogPh;
        tgt.lhip = Math.sin(ph) * 0.8; tgt.rhip = -tgt.lhip; tgt.lknee = Math.max(0, Math.cos(ph)) * 1.25; tgt.rknee = Math.max(0, -Math.cos(ph)) * 1.25;
        tgt.bodyY = Math.abs(Math.cos(ph)) * 0.05 - 0.03; tgt.spX = 0.14; tgt.spY = Math.sin(ph) * 0.1; tgt.hdX = -0.08;
      } else { tgt.bodyY = br * 0.004; tgt.spX = br * 0.01; tgt.hdY = Math.sin(t * 0.6) * 0.05; tgt.lhip = 0.03; tgt.rhip = -0.03; tgt.lhipZ = -0.02; tgt.rhipZ = 0.02; }
      // blend gun targets
      const g = rig.tagger.group; if (g) {
        const ins = rig.inspect;
        const kd = rig.tagger.def ?? TAGGER_KINDS[2];
        const px = lerp(0.11, 0.06, ins), py = lerp(0.17, 0.19, ins), pz = lerp(kd.id === 'pip' ? 0.3 : 0.16, kd.id === 'pip' ? 0.42 : 0.2, ins);
        gunG.position.set(px, py + br * 0.003, pz); gunG.rotation.set(lerp(-0.08, -0.02, ins) + (rig.jog ? Math.sin(rig.jogPh * 2) * 0.03 : 0), lerp(-0.06, -0.72, ins), lerp(0, 0.2, ins));
        gunG.updateMatrix();
        const gr = kd.id === 'pip' ? 0.0 : kd.fore;
        R.set(0.0, -0.005, 0.0).applyMatrix4(gunG.matrix);
        if (kd.id === 'pip') Lh.set(-0.03, -0.03, 0.03).applyMatrix4(gunG.matrix); else Lh.set(0, 0.0, gr).applyMatrix4(gunG.matrix);
        tgt.R[0] = R.x; tgt.R[1] = R.y; tgt.R[2] = R.z; tgt.L[0] = Lh.x; tgt.L[1] = Lh.y; tgt.L[2] = Lh.z;
        tgt.pR[0] = 0.8; tgt.pR[1] = -0.6; tgt.pR[2] = -0.3; tgt.pL[0] = -0.6; tgt.pL[1] = -0.7; tgt.pL[2] = -0.2;
        if (rig.jog) { tgt.R[1] += Math.abs(Math.cos(rig.jogPh)) * 0.02; }
      }
    }
    // smooth current pose toward target
    const k = 1 - Math.exp(-dt * (emoteActive ? 16 : 12));
    for (const key of ['bodyY', 'bodyYaw', 'bodyRoll', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'hdZ', 'lhip', 'lknee', 'rhip', 'rknee', 'lhipZ', 'rhipZ', 'sL', 'sR', 'shrug', 'gun']) cur[key] = lerp(cur[key], tgt[key], key === 'bodyYaw' && emoteActive ? 1 : k);
    for (let i = 0; i < 3; i++) { cur.L[i] = lerp(cur.L[i], tgt.L[i], k); cur.R[i] = lerp(cur.R[i], tgt.R[i], k); cur.pL[i] = lerp(cur.pL[i], tgt.pL[i], k); cur.pR[i] = lerp(cur.pR[i], tgt.pR[i], k); }
    // apply
    body.position.y = 0.9 + cur.bodyY; body.rotation.set(0, cur.bodyYaw, cur.bodyRoll);
    spine.rotation.set(cur.spX, cur.spY, cur.spZ); head.rotation.set(cur.hdX, cur.hdY, cur.hdZ);
    legs[0].hip.rotation.set(-cur.lhip, 0, cur.lhipZ); legs[0].knee.rotation.x = cur.lknee; legs[1].hip.rotation.set(-cur.rhip, 0, cur.rhipZ); legs[1].knee.rotation.x = cur.rknee;
    // keep feet planted when hop/crouch: compensate root height for knee bend (approx)
    const gs = Math.max(0.001, cur.gun); gunG.scale.setScalar(gs); gunG.visible = cur.gun > 0.02;
    solveArm(arms[0], cur.L[0], cur.L[1], cur.L[2], cur.pL[0], cur.pL[1], cur.pL[2], cur.shrug); solveArm(arms[1], cur.R[0], cur.R[1], cur.R[2], cur.pR[0], cur.pR[1], cur.pR[2], cur.shrug);
    arms[0].bicep.scale.set(cur.sL, 1, cur.sL); arms[1].bicep.scale.set(cur.sR, 1, cur.sR);
    arms[0].pad.position.y = 0.44 + cur.shrug; arms[1].pad.position.y = 0.44 + cur.shrug;
    // secondary animation
    if (A.flame.length) for (let i = 0; i < A.flame.length; i++) { const f = A.flame[i]; const s = 0.8 + 0.35 * Math.sin(t * 40 + i * 2) + 0.15 * Math.sin(t * 23); f.scale.set(1, s, 1); f.position.y = -0.24 - 0.18 * s; }
    if (A.cloth) { const p = A.cloth.mesh.geometry.attributes.position, b = A.cloth.base; for (let i = 0; i < p.count; i++) { const y = -b[i * 3 + 1] / 0.62, x = b[i * 3]; const amp = y * (0.03 + (rig.jog ? 0.06 : 0)); p.setZ(i, Math.sin(t * 4.2 + y * 6 + x * 5) * amp - y * y * (rig.jog ? 0.16 : 0.03)); } p.needsUpdate = true; A.cloth.mesh.geometry.computeVertexNormals(); }
    if (A.tail) for (let i = 0; i < A.tail.length; i++) { A.tail[i].rotation.x = 0.28 + Math.sin(t * 2.4 - i * 0.55) * 0.14 + (rig.jog ? Math.sin(t * 9 - i * 0.6) * 0.1 : 0); A.tail[i].rotation.y = Math.sin(t * 1.7 - i * 0.6) * 0.16; }
    for (const w of A.wings) { const flap = Math.sin(t * (rig.jog ? 7 : 1.6)) * (rig.jog ? 0.14 : 0.06); w.root.rotation.y = -w.sx * 0.2 + w.sx * flap; for (let i = 0; i < w.feathers.length; i++) w.feathers[i].rotation.z = w.feathers[i].userData.rz + w.sx * Math.sin(t * 1.6 - i * 0.3) * 0.02; }
    if (A.halo) { A.halo.position.y = 0.3 + Math.sin(t * 2) * 0.012; A.halo.rotation.z = t * 0.6; }
    if (A.ant) A.ant.scale.setScalar(1 + 0.25 * Math.sin(t * 5));
    if (A.charm) { const sw = Math.sin(t * 2.6) * 0.16 + (rig.jog ? Math.sin(rig.jogPh) * 0.4 : 0) + cur.lhip * 0.2; A.charm.pivot.rotation.z = sw; A.charm.pivot.rotation.x = Math.cos(t * 1.9) * 0.08; A.charm.item.rotation.y = t * 1.6; }
    // inspect blend
    rig.inspect = lerp(rig.inspect, rig.inspectTarget, 1 - Math.exp(-dt * 5));
  };

  // anchors for trail emission (world space, written into out)
  rig.backWorld = (out) => backMount.getWorldPosition(out);
  rig.heelWorld = (i, out) => legs[i].knee.localToWorld(out.set(0, -0.44, -0.08));
  rig.headWorld = (out) => head.getWorldPosition(out);
  rig.dispose = () => { clear(helmetG); clear(visorG); clear(backMount); clear(charmMount); clear(gunG); nameTex.dispose(); crystal.dispose(); for (const m of Object.values(M)) m.dispose(); };
  return rig;
}
