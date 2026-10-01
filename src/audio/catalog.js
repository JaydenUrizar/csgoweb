// Registers every procedural sound once. Import { ensureRegistered, SOUNDS } from here.
import { registerWeapons } from './weapons.js';
import { registerWorld } from './world.js';
import { registerFeedback } from './feedback.js';
import { registerVoice } from './voice.js';
import { SOUNDS, categories } from './registry.js';
import { MUSIC_STATES } from './music.js';

let done = false;
export function ensureRegistered() {
  if (done) return SOUNDS; done = true;
  registerWeapons(); registerWorld(); registerFeedback(); registerVoice();
  return SOUNDS;
}
export { SOUNDS, categories };
export const musicNames = () => MUSIC_STATES.filter((s) => s !== 'off').map((s) => 'music.' + s);
