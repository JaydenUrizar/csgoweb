// Procedural inline-SVG icon set (no images). Weapon glyphs are 120x48, barrel to the LEFT, filled with currentColor.
// Usage: icon('arc') -> '<svg class="ic ic-w"><use href="#ic-arc"/></svg>'; sprite() -> hidden <svg> with all symbols.
const W = '0 0 120 48';
// Each entry: [viewBox, inner markup]. `class="k"` = cut-out / secondary tone (uses currentColor at 45% opacity).
const D = {
  // ---------- sidearms ----------
  pip: [W, `<path d="M10 15h72a4 4 0 0 1 4 4v8H10z"/><path d="M6 17h5v7H6z"/><path d="M60 27h27v5l-7 15H66l3-13H60z"/><path class="k" d="M20 20h30v2H20z"/><path d="M47 27h13v3h-13z"/><rect x="14" y="12" width="4" height="3" rx="1"/><rect x="74" y="12" width="5" height="3" rx="1"/>`],
  twin: [W, `<path d="M8 12h72a5 5 0 0 1 5 5v9H8z"/><path d="M4 15h5v8H4z"/><path d="M58 26h26l-6 21H63z"/><path d="M36 26h18l2 6-3 5H40z"/><path class="k" d="M18 16h44v2H18z"/><path class="k" d="M62 32h14v2H62z"/><rect x="30" y="8" width="26" height="4" rx="2"/><rect x="74" y="8" width="6" height="4" rx="1"/>`],
  judge: [W, `<path d="M6 13h58v11H6z"/><path d="M3 15h4v7H3z"/><circle cx="50" cy="20" r="12"/><circle class="k" cx="50" cy="20" r="6"/><path d="M60 22h32a4 4 0 0 1 4 4v3H60z"/><path d="M76 28h22l-10 19H72z"/><path d="M60 28h14v4H60z"/><rect x="10" y="10" width="6" height="3" rx="1"/>`],
  // ---------- SMG ----------
  zip: [W, `<path d="M6 13h64a4 4 0 0 1 4 4v11H6z"/><path d="M2 16h5v8H2z"/><path d="M74 15h36l4 6v5H74z"/><path d="M52 28h14l-2 20H50z"/><path d="M28 28h8l3 12h-9z"/><path d="M76 28h12l-8 18H70z"/><path class="k" d="M14 19h36v2H14z"/><rect x="18" y="9" width="30" height="4" rx="2"/>`],
  hum: [W, `<path d="M8 14h62a4 4 0 0 1 4 4v10H8z"/><path d="M3 17h6v8H3z"/><path d="M74 16h30l10 4v8H74z"/><path d="M104 20h10v14h-10z"/><path d="M44 28h13l-3 20H41z"/><path d="M62 28h10l3 10H66z"/><path d="M78 28h11l-6 15H73z"/><path class="k" d="M14 20h40v2H14z"/><rect x="20" y="10" width="26" height="4" rx="2"/><rect x="10" y="10" width="5" height="4"/>`],
  // ---------- rifles ----------
  arc: [W, `<path d="M2 17h30v6H2z"/><path d="M28 13h40v14H28z"/><path d="M68 15h22l4 3 20 2v16h-6l-6-4H68z"/><path d="M98 34h10v10H98z"/><path d="M50 27h10l-2 8-6 12H40l8-20z" /><path d="M36 26h12v5H36z"/><path class="k" d="M34 17h30v2H34z"/><rect x="12" y="11" width="4" height="6"/><rect x="82" y="10" width="14" height="5" rx="2"/><path class="k" d="M92 22h12v2H92z"/>`],
  rail: [W, `<path d="M2 16h26v6H2z"/><path d="M24 12h50v15H24z"/><path d="M74 13h20l4 3h14v18h-8l-4-4H74z"/><path d="M50 27h11l-1 6-5 14H45l5-14z"/><path d="M34 27h12v4H34z"/><path d="M28 6h30v6H28z"/><path class="k" d="M30 16h34v2H30z"/><rect x="8" y="12" width="4" height="4"/><path class="k" d="M100 18h10v2h-10z"/>`],
  halo: [W, `<path d="M2 20h20v6H2z"/><path d="M20 15h44v13H20z"/><path d="M64 15h30l8 4 14 3v12h-8l-4-3H64z"/><path d="M44 28h11l-2 6-5 13H39l5-13z"/><path d="M92 28h9v14h-9z"/><rect x="24" y="4" width="34" height="11" rx="5.5"/><rect class="k" x="30" y="7" width="22" height="5" rx="2.5"/><path d="M36 14h4v3h-4z"/><path class="k" d="M26 20h34v2H26z"/>`],
  lance: [W, `<path d="M1 20h44v4H1z"/><path d="M4 17h5v10H4z"/><path d="M42 15h36v13H42z"/><path d="M78 16h22l6 4 12 1v11h-8l-4-3H78z"/><path d="M60 28h10l-2 6-4 13H54l4-13z"/><path d="M96 32h10v10H96z"/><rect x="36" y="3" width="38" height="12" rx="6"/><rect class="k" x="40" y="6" width="30" height="6" rx="3"/><path d="M50 14h4v3h-4z"/><path d="M62 14h4v3h-4z"/><path class="k" d="M46 20h28v2H46z"/><rect x="14" y="14" width="3" height="6"/>`],
  // ---------- heavy ----------
  scatter: [W, `<path d="M2 15h64v9H2z"/><path d="M2 26h58v6H2z"/><path d="M40 21h26v13H40z"/><path d="M66 16h24l6 4 20 1v11h-6l-6-3H66z"/><path d="M80 30h10l-2 5-4 12H74l4-12z"/><path class="k" d="M6 18h30v2H6z"/><rect x="42" y="30" width="24" height="8" rx="2"/><rect x="10" y="11" width="4" height="4"/>`],
  storm: [W, `<path d="M2 17h30v6H2z"/><path d="M30 12h46v16H30z"/><path d="M76 14h18l4 3 14 2v16h-6l-6-4H76z"/><rect x="42" y="26" width="26" height="20" rx="3"/><path class="k" d="M46 30h18v2H46z"/><path class="k" d="M46 35h18v2H46z"/><path class="k" d="M46 40h18v2H46z"/><path d="M76 28h11l-6 17H70z"/><path d="M12 22l-4 14h5l4-14z"/><path d="M15 22l-4 14h3l4-14z" class="k"/><path class="k" d="M34 17h38v2H34z"/><rect x="50" y="6" width="18" height="6" rx="2"/>`],
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
