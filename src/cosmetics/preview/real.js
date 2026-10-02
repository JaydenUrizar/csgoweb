// Preview rig backed by the REAL in-game athlete (ctx.characters): what you see in the Locker is exactly what you play.
// The model is spawned for a private preview actor, re-parented into the locker's own scene, animated by characters.update(),
// then emotes are layered on top as post-animation bone offsets (characters has no emote clips).
import * as THREE from 'three';
import { createActor } from '../../core/actor.js';
import { boneEmote, makePoseOut, BONE_EMOTE_DUR } from './bone_emotes.js';
import { buildCharmObject } from './charm.js';

const IDX = { pel: 0, spine: 1, chest: 2, head: 4, uL: 5, fL: 6, uR: 8, fR: 9, legL: 11, kneeL: 12, legR: 14, kneeR: 15 };
const ARMS = ['uL', 'fL', 'uR', 'fR'];
const KIND_TO_ID = { pip: 'pip', zip: 'zip', arc: 'arc', lance: 'lance' };

export function createRealRig(ctx, name = 'PLAYER') {
  const C = ctx.characters;
  if (!C || C.__stub || typeof C.spawn !== 'function' || !C.models || !C.group) return null;
  const root = new THREE.Group(), face = new THREE.Group(); face.rotation.y = Math.PI; root.add(face);
  const rig = {
    isReal: true, root, body: { position: new THREE.Vector3() }, spec: null, team: 'ember', name, emote: null, emoteT: 0, jog: false, inspect: 0, inspectTarget: 0, time: 0,
    tagger: { kind: 'arc', get group() { return m?.attach.weapon ?? null; }, focus(out) { const o = m?.held.obj; if (!o) return null; bb.setFromObject(o); return bb.isEmpty() ? null : bb.getCenter(out); } }, animated: { charm: null }, crystalOn: false,
  };
  const bb = new THREE.Box3(); let actor = null, m = null, entered = false, charm = null, charmKey = '', stash = null, groupParent = null, pose = makePoseOut();
  const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), e1 = new THREE.Euler(), dq = new THREE.Quaternion();
  let spawnedTeam = null;

  function build(team, spec) {
    if (m) { m.root.removeFromParent(); C.remove(actor); m = null; }
    actor = createActor({ name: rig.name, team }); actor.isBot = true; actor.isPlayer = false; actor.alive = true; actor.yaw = 0; actor.pos.set(0, 0, 0);
    m = C.spawn(actor, { spec, materialise: false });
    m.visible = true; m.isPreview = true; m.dbg = { instant: true, weapon: KIND_TO_ID[rig.tagger.kind] ?? 'arc' }; m.manual = true;
    face.add(m.root); spawnedTeam = team; charmKey = '';
  }
  rig.enter = () => {
    if (entered) return; entered = true; stash = [];
    for (const o of C.models.values()) { stash.push([o, o.visible, o.root.visible]); o.visible = false; o.root.visible = false; }
    groupParent = C.group.parent; rig.stageScene?.add(C.group);
    if (rig.spec) build(rig.team, rig.spec);
  };
  rig.leave = () => {
    if (!entered) return; entered = false;
    if (m) { m.root.removeFromParent(); C.remove(actor); m = null; actor = null; }
    if (charm) { charm.group.removeFromParent(); charm = null; charmKey = ''; }
    for (const [o, v, rv] of stash || []) { o.visible = v; o.root.visible = rv; }
    stash = null; (groupParent || ctx.render?.scene)?.add(C.group);
  };
  rig.setSpec = (spec, { team = 'ember', name: nm = rig.name } = {}) => {
    const first = !rig.spec; rig.spec = spec; rig.name = nm;
    if (!entered) { rig.team = team; return; }
    if (!m || team !== spawnedTeam) { rig.team = team; build(team, spec); }
    else { rig.team = team; m.actor.name = nm; C.spawn(actor, { spec }); m.wantId = undefined; }   // applyCosmetics + force the held tagger/skin to refresh
    m.hideHeld = !!rig.emote;
    const k = JSON.stringify(spec.charm);
    if (k !== charmKey) { charmKey = k; if (charm) { charm.group.removeFromParent(); charm.dispose?.(); charm = null; } charm = buildCharmObject(spec.charm, 1.25); if (charm) { m.attach.hip.add(charm.group); charm.group.position.set(0.02, 0, 0); } rig.animated.charm = charm ? { item: charm.item } : null; }
    void first;
  };
  rig.setTaggerKind = (kind) => { rig.tagger.kind = kind; if (m) { m.dbg.weapon = KIND_TO_ID[kind] ?? 'arc'; } };
  rig.playEmote = (id) => { rig.emote = id; rig.emoteT = 0; };
  rig.stopEmote = () => { rig.emote = null; };
  rig.setCrystal = () => {};
  rig.setVisible = (v) => { if (m) m.root.visible = v; };
  rig.tagOut = (style) => { if (m) { m.hideHeld = false; C.tagOut(actor, new THREE.Vector3(0, 0, -1), { style }); } };
  rig.respawn = () => { if (m) C.spawn(actor, { spec: rig.spec, materialise: true }); };
  rig.get = () => m;

  rig.update = (dt) => {
    if (!m) return; rig.time += dt;
    m.dbg.vel = rig.jog ? { x: 0, z: -5.2 } : undefined;
    m.hideHeld = !!rig.emote;
    C.update(dt, 1);
    const o = pose;
    if (rig.emote) { rig.emoteT += dt; if (!boneEmote(rig.emote, rig.emoteT, o)) { rig.emote = null; } }
    if (rig.emote) {
      const b = m.bones;
      for (const k of ARMS) { const bone = b[IDX[k]]; q1.setFromEuler(e1.set(o[k][0], o[k][1], o[k][2], 'XYZ')); bone.quaternion.slerp(q1, o.armW); }
      for (const k of ['pel', 'spine', 'chest', 'head', 'legL', 'kneeL', 'legR', 'kneeR']) { const a = o[k]; if (!a[0] && !a[1] && !a[2]) continue; const bone = b[IDX[k]]; dq.setFromEuler(e1.set(a[0] * o.w, a[1] * o.w, a[2] * o.w, 'XYZ')); bone.quaternion.multiply(dq); }
      m.root.position.y += o.rootY * o.w; m.root.rotation.y += o.yaw * o.w;
      m.root.updateMatrixWorld(true);
    }
    if (charm) charm.update(rig.time, rig.jog ? Math.sin(rig.time * 10) * 0.4 : 0);
  };
  rig.backWorld = (out) => (m ? m.attach.back.getWorldPosition(out) : out.set(0, 1.2, 0));
  rig.heelWorld = (i, out) => { if (!m) return out.set(0, 0.1, 0); m.attach.trailEmitter.getWorldPosition(out); out.y = 0.1; out.x += (i ? 0.1 : -0.1); return out; };
  rig.headWorld = (out) => (m ? m.attach.head.getWorldPosition(out) : out.set(0, 1.7, 0));
  rig.dispose = () => rig.leave();
  return rig;
}
