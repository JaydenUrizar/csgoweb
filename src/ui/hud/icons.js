// Procedural inline-SVG icon set (no images). Weapon glyphs are 120x48, barrel to the LEFT, filled with currentColor.
// Usage: icon('arc') -> '<svg class="ic ic-w"><use href="#ic-arc"/></svg>'; sprite() -> hidden <svg> with all symbols.
const W = '0 0 120 48';
// Each entry: [viewBox, inner markup]. `class="k"` = cut-out / secondary tone (uses currentColor at 45% opacity).
const D = {
  // ---------- sidearms ----------
  pip: [W, `<path d="M8 14h70q5 0 5 5v8H8z"/><rect x="3" y="16" width="6" height="8" rx="1.5"/><path d="M52 27h30l-3 8-5 13H61l5-13h-14z"/><path d="M40 27h12v5q0 3-3 3h-6q-3 0-3-3z"/><rect x="12" y="11" width="4" height="3" rx="1"/><rect x="73" y="11" width="6" height="3" rx="1"/><path class="k" d="M22 19h30v2.5H22z"/><path class="k" d="M62 15v10M66 15v10M70 15v10" stroke="#05070c" stroke-opacity=".5" stroke-width="1.6" fill="none"/><path class="k" d="M44 30h6v3h-6z"/>`],
  twin: [W, `<path d="M6 12h74q6 0 6 6v8H6z"/><rect x="2" y="14" width="5" height="9" rx="1.5"/><path d="M56 26h30l-3 8-6 14H62l5-14H56z"/><path d="M34 26h20l3 9v10H46l-1-8h-8z"/><rect x="26" y="8" width="30" height="4" rx="2"/><rect x="76" y="8" width="7" height="4" rx="1"/><path class="k" d="M12 16h56v2.5H12z"/><path class="k" d="M70 14v9M74 14v9" stroke="#05070c" stroke-opacity=".5" stroke-width="1.6" fill="none"/><path class="k" d="M40 30h12v2H40z"/>`],
  judge: [W, `<path d="M5 14h46v10H5z"/><rect x="2" y="16" width="5" height="6" rx="1"/><circle cx="62" cy="21" r="14"/><circle class="k" cx="62" cy="21" r="8"/><circle cx="62" cy="21" r="3.5"/><path d="M73 16h24q4 0 4 4v6H73z"/><path d="M82 26h22l-9 22H78z"/><path d="M68 32h14v4H68z"/><rect x="10" y="10" width="7" height="4" rx="1"/><path class="k" d="M12 18h30v2H12z"/>`],
  // ---------- SMG ----------
  zip: [W, `<path d="M8 13h60q5 0 5 5v11H8z"/><rect x="2" y="16" width="7" height="8" rx="1.5"/><path d="M73 14h28q5 0 8 5l4 7v3H73z"/><path d="M50 29h14l-2 19H48z"/><path d="M28 29h8l3 12h-9z"/><path d="M76 29h12l-8 17H70z"/><rect x="16" y="9" width="34" height="4" rx="2"/><path class="k" d="M14 20h44v2H14z"/><path class="k" d="M20 24h12v2H20z"/><path d="M104 24h10v8h-10z"/>`],
  hum: [W, `<path d="M6 14h62q5 0 5 5v9H6z"/><rect x="1" y="17" width="6" height="8" rx="1.5"/><path d="M72 15h28l12 5v8H72z"/><path d="M104 20h12v16h-12z"/><path d="M42 28h14l-3 20H38z"/><path d="M62 28h10l3 11H65z"/><path d="M78 28h12l-6 15H72z"/><rect x="18" y="9" width="30" height="5" rx="2.5"/><rect x="10" y="10" width="6" height="4"/><path class="k" d="M12 20h46v2H12z"/><path class="k" d="M80 18h20v2H80z"/>`],
  // ---------- rifles ----------
  arc: [W, `<rect x="2" y="19" width="26" height="5" rx="1"/><path d="M26 14h42v14H26z"/><path d="M66 15h24l6 3 20 3q4 1 4 5v14l-6 4-8-10H66z"/><path d="M52 28h10l-1 8q-4 12-12 14-6 0-8-3 4-3 6-8z"/><path d="M34 28h12v6H34z"/><rect x="8" y="14" width="5" height="5"/><rect x="40" y="10" width="20" height="4" rx="2"/><path class="k" d="M30 18h34v2H30z"/><path class="k" d="M92 22h18v2H92z"/><path d="M26 28l-6 4h12z"/>`],
  rail: [W, `<rect x="2" y="19" width="24" height="5" rx="1"/><path d="M24 14h50v14H24z"/><path d="M72 15h24l5 4h12v18h-8l-4-5H72z"/><path d="M50 28h12l-2 8-4 12H44l5-12z"/><path d="M32 28h14v5H32z"/><path d="M24 7h36q3 0 3 3v4H24z"/><rect x="6" y="14" width="4" height="5"/><path class="k" d="M28 18h40v2H28z"/><path class="k" d="M102 21h10v2h-10z"/><path class="k" d="M30 10h28v2H30z"/>`],
  halo: [W, `<rect x="2" y="21" width="20" height="5" rx="1"/><path d="M20 15h44v14H20z"/><path d="M64 15h30l8 4 14 3v12h-8l-4-3H64z"/><path d="M42 29h12l-2 6-5 13H38l5-13z"/><path d="M90 29h10v14H90z"/><rect x="24" y="3" width="36" height="12" rx="6"/><rect class="k" x="29" y="6" width="26" height="6" rx="3"/><path d="M34 15h4v3h-4zM48 15h4v3h-4z"/><path class="k" d="M24 21h36v2H24z"/>`],
  lance: [W, `<rect x="1" y="21" width="46" height="3" rx="1"/><rect x="4" y="18" width="6" height="9" rx="1"/><path d="M44 16h36v13H44z"/><path d="M80 17h22l6 4 10 1v12h-8l-4-3H80z"/><path d="M60 29h10l-2 6-4 13H54l4-13z"/><path d="M100 32h10v10h-10z"/><rect x="36" y="3" width="40" height="13" rx="6.5"/><rect class="k" x="41" y="6.5" width="30" height="6" rx="3"/><path d="M50 16h4v3h-4zM64 16h4v3h-4z"/><path d="M80 24l10 0 0 5-10 0z"/><circle cx="92" cy="30" r="3.5"/><path class="k" d="M48 21h28v2H48z"/>`],
  // ---------- heavy ----------
  scatter: [W, `<rect x="2" y="15" width="62" height="7" rx="1"/><rect x="2" y="24" width="56" height="6" rx="1"/><path d="M38 21h28v13H38z"/><path d="M66 16h24l6 4h18v11h-6l-6-3H66z"/><path d="M80 30h10l-2 5-5 13H73l5-13z"/><rect x="40" y="31" width="24" height="9" rx="2.5"/><rect x="8" y="11" width="5" height="4"/><path class="k" d="M6 18h30v2H6z"/><path class="k" d="M44 35h16v2H44z"/>`],
  storm: [W, `<rect x="2" y="19" width="30" height="5" rx="1"/><path d="M30 13h46v16H30z"/><path d="M76 14h18l4 3 16 3v15h-6l-6-4H76z"/><rect x="40" y="27" width="30" height="20" rx="3"/><path class="k" d="M45 32h20v2H45zM45 37h20v2H45zM45 42h20v2H45z"/><path d="M76 29h11l-6 17H70z"/><path d="M12 24l-6 18h4l5-18zM18 24l1 18h4l-1-18z"/><rect x="48" y="7" width="20" height="6" rx="2"/><path class="k" d="M34 18h40v2H34z"/>`],
  // ---------- grip ----------
  tap: [W, `<path d="M6 40L88 13Q96 9 106 11Q115 14 114 22Q112 29 103 29L17 46Q8 47 6 40z"/><circle cx="8" cy="41" r="6"/><path d="M27 37l7 8M40 33l7 8M53 29l7 8" stroke="#05070c" stroke-opacity=".5" stroke-width="2.6" fill="none"/><path d="M84 15l4 13" stroke="#05070c" stroke-opacity=".4" stroke-width="2.4" fill="none"/>`],
  // ---------- utility ----------
  haze: [W, `<circle cx="60" cy="27" r="16"/><rect x="50" y="6" width="20" height="9" rx="2"/><path d="M56 15h8v6h-8z"/><path class="k" d="M44 24h32v3H44z"/><path class="k" d="M46 31h28v3H46z"/><circle class="k" cx="60" cy="27" r="6"/><circle cx="60" cy="27" r="2.5"/><path d="M76 8h6v4h-6z"/>`],
  strobe: [W, `<path d="M60 5l5 8 9-3-3 9 9 4-9 4 3 9-9-3-5 8-5-8-9 3 3-9-9-4 9-4-3-9 9 3z"/><circle class="k" cx="60" cy="24" r="8"/><circle cx="60" cy="24" r="3.5"/>`],
  pulse: [W, `<circle cx="60" cy="24" r="6"/><circle cx="60" cy="24" r="12" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="60" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="3" opacity=".7"/><path d="M60 3v6M60 39v6M39 24h6M75 24h6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`],
  // ---------- gear ----------
  vest: [W, `<path d="M40 8l10 4h20l10-4 8 6-4 12-6-2v22a3 3 0 0 1-3 3H45a3 3 0 0 1-3-3V24l-6 2-4-12z"/><path class="k" d="M52 16h16v3H52z"/><path class="k" d="M50 24h20v2H50zM50 30h20v2H50zM50 36h20v2H50z"/>`],
  kit: [W, `<path d="M20 8l38 16-38 16-6-6 20-10-20-10z"/><path d="M100 8L62 24l38 16 6-6-20-10 20-10z"/><circle cx="60" cy="24" r="6"/><circle class="k" cx="60" cy="24" r="2.2"/>`],
  beacon: [W, `<path d="M48 40h24l4 6H44z"/><path d="M54 14h12l3 26H51z"/><circle cx="60" cy="11" r="6"/><path d="M40 6a22 22 0 0 0 0 16M80 6a22 22 0 0 1 0 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M31 1a34 34 0 0 0 0 26M89 1a34 34 0 0 1 0 26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".6"/><path class="k" d="M55 22h10v2H55zM55 28h10v2H55z"/>`],
  // ---------- ui glyphs (square 24x24) ----------
  charge: ['0 0 24 24', `<path d="M13.5 1L4 14h6.5L9 23l11-14h-7z"/>`],
  shield: ['0 0 24 24', `<path d="M12 1.5l9 3.2v6.7c0 5.4-3.6 9.3-9 11.1-5.4-1.8-9-5.7-9-11.1V4.7z"/>`],
  helmetShield: ['0 0 24 24', `<path d="M12 1.5l9 3.2v6.7c0 5.4-3.6 9.3-9 11.1-5.4-1.8-9-5.7-9-11.1V4.7z"/><path class="k" d="M7 9h10v2.2H7z"/>`],
  credit: ['0 0 24 24', `<circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M13.3 5.5v1.7c1.6.3 2.6 1.3 2.7 2.7h-2c-.1-.7-.6-1.1-1.6-1.1-.9 0-1.5.4-1.5 1 0 .6.5.9 1.9 1.2 2.2.5 3.4 1.2 3.4 3 0 1.5-1.1 2.5-2.9 2.8v1.7h-1.6v-1.7c-1.9-.3-3-1.4-3.1-3h2.1c.1.9.7 1.3 1.8 1.3 1 0 1.6-.4 1.6-1 0-.7-.5-1-2-1.3-2.1-.5-3.3-1.2-3.3-2.9 0-1.4 1-2.4 2.7-2.7V5.5z"/>`],
  crown: ['0 0 24 24', `<path d="M2.5 18.5l-1-11 5.3 4.2L12 3.5l5.2 8.2 5.3-4.2-1 11z"/><path d="M3.5 20.5h17v2h-17z"/>`],
  wall: ['0 0 24 24', `<path d="M2 4h9v5H2zM13 4h9v5h-9zM2 11h5v5H2zM9 11h6v5H9zM17 11h5v5h-5zM2 18h9v3H2zM13 18h9v3h-9z"/>`],
  smoke: ['0 0 24 24', `<path d="M7 19a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.2 4.8 4.8 0 0 1 17.5 19z"/>`],
  blind: ['0 0 24 24', `<path d="M12 5C6.5 5 2.7 9 1 12c1.7 3 5.5 7 11 7s9.3-4 11-7c-1.7-3-5.5-7-11-7zm0 10.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/><path d="M3 3.5L21 20.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>`],
  noscope: ['0 0 24 24', `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.6"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`],
  tagout: ['0 0 24 24', `<path d="M12 1.5l8.5 6.2-3.2 13.3H6.7L3.5 7.7z" opacity=".95"/><path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" stroke="#05070c" stroke-opacity=".55" stroke-width="2.2" stroke-linecap="round" fill="none"/>`],
  star: ['0 0 24 24', `<path d="M12 1.8l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.5 5.7 21.2l1.5-7.1L1.8 9.2l7.2-.8z"/>`],
  bolt: ['0 0 24 24', `<path d="M13.5 1L4 14h6.5L9 23l11-14h-7z"/>`],
  assist: ['0 0 24 24', `<path d="M3 20l5-9 4 4 5-8 4 3v10z"/>`],
  eyeoff: ['0 0 24 24', `<path d="M3 3l18 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`],
  back: ['0 0 24 24', `<path d="M9 5L3 11l6 6v-4h6a4 4 0 0 1 4 4v2h2v-2a6 6 0 0 0-6-6H9z"/>`],
  chevL: ['0 0 24 24', `<path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`],
  chevR: ['0 0 24 24', `<path d="M9 4l8 8-8 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`],
  lock: ['0 0 24 24', `<path d="M6 10V8a6 6 0 0 1 12 0v2h1.5v12h-15V10zm2.5 0h7V8a3.5 3.5 0 0 0-7 0z"/>`],
  check: ['0 0 24 24', `<path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`],
};
// Tagger id -> icon id (aliases) and display names.
export const ALIAS = { grip: 'tap', melee: 'tap', kevlar: 'vest', armor: 'vest', defuse: 'kit', bomb: 'beacon', flash: 'strobe', nade: 'pulse' };
export const NAMES = { tap: 'Tap', pip: 'Pip', twin: 'Twin', judge: 'Judge', zip: 'Zip', hum: 'Hum', arc: 'Arc', rail: 'Rail', halo: 'Halo', lance: 'Lance', scatter: 'Scatter', storm: 'Storm', haze: 'Haze', strobe: 'Strobe', pulse: 'Pulse', vest: 'Vest', kit: 'Kit', beacon: 'Beacon' };
export const WEAPON_IDS = ['tap', 'pip', 'twin', 'judge', 'zip', 'hum', 'arc', 'rail', 'halo', 'lance', 'scatter', 'storm', 'haze', 'strobe', 'pulse', 'vest', 'kit', 'beacon'];
export const hasIcon = (id) => !!D[ALIAS[id] || id];
export function sprite() {
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true"><defs>';
  for (const [id, [vb, body0]] of Object.entries(D)) { const body = body0.replace(/class="k"/g, 'fill="#05070c" fill-opacity=".5"'); s += `<symbol id="ic-${id}" viewBox="${vb}" fill="currentColor">${body}</symbol>`; }
  return s + '</defs></svg>';
}
/** Inline icon markup. kind: 'w' weapon (120x48) or 'g' glyph (square). */
export function icon(id, cls = '') {
  id = ALIAS[id] || id; const e = D[id]; if (!e) return '';
  return `<svg class="ic ${e[0] === W ? 'ic-w' : 'ic-g'} ${cls}" viewBox="${e[0]}"><use href="#ic-${id}"/></svg>`;
}
