// FLUX TAG wordmark: hand-built angular letterforms (stroke paths, mitre joins) with a light-pulse underline.
const L = {
  F: { w: 78, d: 'M9 100V9H72M9 54H60' },
  L: { w: 78, d: 'M9 0V91H72' },
  U: { w: 80, d: 'M9 0V70L30 91H50L71 70V0' },
  X: { w: 78, d: 'M7 0L71 100M71 0L7 100' },
  T: { w: 78, d: 'M0 9H78M39 9V100' },
  A: { w: 78, d: 'M7 100L39 8L71 100M21 69H57' },
  G: { w: 78, d: 'M72 9H27L9 27V73L27 91H72V54H43' },
};
let uid = 0;
export function logoSVG({ animate = false, tagline = false } = {}) {
  const id = 'lg' + (uid++);
  const gap = 15;
  let x = 0; const flux = [];
  for (const c of 'FLUX') { flux.push(`<path class="lp" style="--d:${flux.length}" transform="translate(${x} 0)" pathLength="1" d="${L[c].d}"/>`); x += L[c].w + gap; }
  const fw = x - gap;
  // TAG smaller, right-aligned
  const s = .56; let tx = 0; const tag = [];
  for (const c of 'TAG') { tag.push(`<path class="lp" style="--d:${4 + tag.length}" transform="translate(${tx} 0)" pathLength="1" d="${L[c].d}"/>`); tx += L[c].w + 22; }
  const tw = (tx - 22) * s; const tagX = fw - tw;
  return `<svg class="fx-lgo${animate ? ' anim' : ''}" viewBox="-14 -14 ${fw + 28} ${100 + 26 + 66}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="FLUX TAG">
  <defs>
    <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e6edf6"/><stop offset="1" stop-color="#9fb0c6"/></linearGradient>
    <linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb070"/><stop offset=".5" stop-color="#ff7a2f"/><stop offset="1" stop-color="#ff4d2a"/></linearGradient>
    <linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2fd0ff" stop-opacity="0"/><stop offset=".08" stop-color="#2fd0ff"/><stop offset=".55" stop-color="#ffffff"/><stop offset=".62" stop-color="#ff7a2f"/><stop offset="1" stop-color="#ff7a2f" stop-opacity="0"/></linearGradient>
    <filter id="${id}g" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g transform="skewX(-11) translate(14 0)">
    <g fill="none" stroke="url(#${id}w)" stroke-width="18" stroke-linejoin="miter" stroke-miterlimit="3" stroke-linecap="butt">${flux.join('')}</g>
    <g transform="translate(${tagX + 4} 116) scale(${s})" fill="none" stroke="url(#${id}e)" stroke-width="20" stroke-linejoin="miter" stroke-miterlimit="3" stroke-linecap="butt" filter="url(#${id}g)">${tag.join('')}</g>
    <g>
      <rect x="0" y="130" width="${tagX - 22}" height="4" fill="url(#${id}l)"/>
      <rect x="0" y="139" width="${(tagX - 22) * .62}" height="2" fill="url(#${id}l)" opacity=".55"/>
      <path class="lspark" d="M${tagX - 34} 132 l7 -12 l7 12 l-7 12z" fill="#fff"/>
    </g>
  </g>
</svg>`;
}
export const LOGO_CSS = `
.fx-lgo .lspark{filter:drop-shadow(0 0 6px #fff)}
.fx-lgo.anim .lp{stroke-dasharray:1 1;stroke-dashoffset:1;animation:fxDraw .9s cubic-bezier(.6,.05,.2,1) forwards;animation-delay:calc(var(--d)*.09s + .15s)}
@keyframes fxDraw{to{stroke-dashoffset:0}}
.fx-lgo.anim .lspark{animation:fxSpark 1.2s .9s ease-out both}
@keyframes fxSpark{from{opacity:0;transform:translateX(-140px)}to{opacity:1;transform:none}}
`;
export const emblemSVG = () => `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 26 16 3l12 23-12-6z" fill="#ff7a2f"/><path d="M16 3l12 23-12-6z" fill="#2fd0ff" opacity=".9"/><path d="M16 20v-8" stroke="#04060b" stroke-width="2"/></svg>`;
