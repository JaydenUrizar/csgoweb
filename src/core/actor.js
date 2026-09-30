import * as THREE from 'three';
import { PLAYER } from './config.js';
let nextId = 1;
/** A participant in the match (human or bot). Modules attach their own state under actor.<module>. */
export function createActor({ name, team, isPlayer = false, cosmetics = null }) {
  return {
    id: nextId++, name, team, isPlayer, isBot: !isPlayer,
    pos: new THREE.Vector3(),        // feet position, world space
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,                // radians; yaw 0 faces -Z
    onGround: true, crouching: false, walking: false, crouchT: 0,
    height: PLAYER.height, eyeHeight: PLAYER.eye,
    hp: 100, armor: 0, helmet: false, alive: true, tagged: false,
    credits: 800,
    inventory: { slots: {}, current: null, previous: null, utility: [] },  // owned by combat/weapons
    hasBeacon: false,
    cosmetics,                       // loadout (owned by cosmetics)
    stats: { tags: 0, outs: 0, assists: 0, score: 0, damage: 0, crowns: 0 },
    lastDamagedBy: null,
    // module-owned scratch
    move: null, ai: null, model: null,
    eyePos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); },
    forward(out = new THREE.Vector3()) {
      const cp = Math.cos(this.pitch);
      return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    },
  };
}
