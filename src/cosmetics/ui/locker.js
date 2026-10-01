// The Locker: full-screen character cosmetics screen (CS2 inventory / loadout visual language).
import { CATEGORIES, BY_ID, BY_CAT, SETS, SET_BY_ID, RARITY, RARITY_LIST, WEARS } from '../catalog.js';
import { SLOT_CATS, defaultLoadout, normalize, cloneLoadout, sameLoadout, encodeLoadout, decodeLoadout, randomLoadout, resolve, applySet, setCompletion, wearOf } from '../loadout.js';
import { SLOT_COUNT, STAR_LEVELS } from '../store.js';
import { createStage } from '../preview/stage.js';
import { TAGGER_KINDS } from '../preview/rig.js';
import { iconFor } from './icons.js';
import { CSS, FONT_LINK } from './styles.js';
import { rng as coreRng } from '../../core/rng.js';

const CAT_FOCUS = { suit: 'body', helmet: 'head', visor: 'head', pattern: 'body', back: 'back', trail: 'run', tagOut: 'body', skin: 'tagger', charm: 'charm', nameplate: 'name', emote: 'wide', sets: 'wide' };
const TEAM_NAME = { ember: 'EMBER', tide: 'TIDE' };
const SVG = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/></svg>',
  dice: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>',
  turn: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5"/></svg>',
  run: '<svg viewBox="0 0 24 24"><circle cx="14" cy="5" r="2"/><path d="M8 21l3-6 3 2v4M11 15l1-5 4 2 2 3M10 9l4-1"/></svg>',
  mirror: '<svg viewBox="0 0 24 24"><path d="M12 3v18M8 7L3 12l5 5zM16 7l5 5-5 5z"/></svg>',
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createLocker(ctx, api) {
  const { store } = api;
  const L = {
    open: false, side: 'ember', slot: 0, cat: 'suit', drafts: [], q: '', rar: new Set(), setFilter: 'all', sort: 'default',
    over: null, view: null, focusId: null, stage: null, raf: 0, last: 0, root: null, prevPaused: false, wearDrag: false,
    tHover: 0, tLeave: 0, tFx: 0, tToast: 0, playTag: false, stageFail: false, nudges: 0,
  };
  const $ = (sel) => L.root.querySelector(sel);
  const cur = () => L.drafts[L.slot][L.side];
  const savedOf = (slot = L.slot, side = L.side) => store.loadout(side, slot);
  const dirtySlot = (i) => !sameLoadout(L.drafts[i].ember, savedOf(i, 'ember')) || !sameLoadout(L.drafts[i].tide, savedOf(i, 'tide'));
  const playerName = () => ctx.localActor?.name || 'PLAYER';
  const emit = (n, d) => ctx.events?.emit?.(n, d);
  const rngObj = () => (ctx.params?.get('seed') ? coreRng : { next: Math.random });

  // ================================================================== DOM
  function ensureDom() {
    if (L.root) return;
    if (!document.getElementById('fx-locker-css')) {
      const st = document.createElement('style'); st.id = 'fx-locker-css'; st.textContent = CSS; document.head.appendChild(st);
      if (!document.getElementById('fx-locker-font')) { const lk = document.createElement('link'); lk.id = 'fx-locker-font'; lk.rel = 'stylesheet'; lk.href = FONT_LINK; lk.onerror = () => {}; document.head.appendChild(lk); }
    }
    const root = L.root = document.createElement('div'); root.id = 'fx-locker'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Locker');
    root.innerHTML = `
      <div class="lk-bg"><i class="e"></i><i class="t"></i></div>
      <div class="lk-main">
        <canvas class="lk-canvas" tabindex="0" aria-label="Character preview. Drag to rotate."></canvas>
        <div class="lk-vig"></div>
        <div class="lk-sidetog"><button data-s="ember">EMBER</button><button data-s="tide">TIDE</button></div>
        <div class="lk-hint"><span><b>DRAG</b> ROTATE</span><span><b>WHEEL</b> ZOOM</span><span><b>Q / E</b> CATEGORY</span><span><b>R</b> RANDOMISE</span></div>
        <div class="lk-side l"></div><div class="lk-side r"></div>
        <div class="lk-info"><div class="n"></div><div class="m"></div><div class="f"></div></div>
        <div class="lk-ctl"></div>
      </div>
      <div class="lk-top">
        <button class="lk-back" data-a="close">${SVG.back}<span>Back</span></button>
        <div class="lk-title">Locker<small>FLUX TAG</small></div>
        <div class="lk-tabs" role="tablist"></div>
        <div class="lk-lvl"></div>
        <button class="lk-x" data-a="close" aria-label="Close">${SVG.x}</button>
      </div>
      <div class="lk-inv">
        <div class="lk-tool"></div>
        <div class="lk-gridw"><div class="lk-grid"></div></div>
        <div class="lk-foot"></div>
      </div>
      <div class="lk-toast"></div>
      <div class="lk-modal"><div class="bx"><h3></h3><p></p><div class="r"></div></div></div>`;
    (document.getElementById('ui') || document.body).appendChild(root);
    bindEvents();
  }

  // ================================================================== render pieces
  const rc = (r) => RARITY[r].css;
  function renderTabs() {
    const tabs = CATEGORIES.map((c) => `<button class="lk-tab ${L.cat === c.id ? 'on' : ''}" role="tab" data-cat="${c.id}">${c.name}</button>`).join('') +
      `<button class="lk-tab ${L.cat === 'sets' ? 'on' : ''}" role="tab" data-cat="sets">Sets</button>`;
    $('.lk-tabs').innerHTML = tabs;
    const on = $('.lk-tab.on'); on?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    const lv = store.level();
    $('.lk-lvl').innerHTML = `<span>&#9733; <b>${store.stars}</b></span><span>LVL ${lv.level}</span><span class="bar"><i style="width:${Math.round(lv.into / lv.need * 100)}%"></i></span>`;
    $('.lk-lvl').title = `Earn stars by playing rounds: ${lv.into}/${lv.need} to level ${lv.level + 1}. Everything is already unlocked.`;
  }
  function renderSides() {
    const left = ['suit', 'helmet', 'visor', 'pattern', 'back', 'trail'], right = ['tagOut', 'skin', 'charm', 'nameplate', 'emote'];
    const row = (c) => {
      const cat = CATEGORIES.find((x) => x.id === c); const it = BY_ID[cur()[c]];
      let sub = RARITY[it.rarity].name;
      return `<button class="lk-slot ${L.cat === c ? 'on' : ''}" data-cat="${c}" style="--rc:${rc(it.rarity)}"><span class="im"><img alt="" src="${iconFor(it, 0.75)}"></span><span class="tx"><span class="k">${cat.slot}</span><span class="v">${esc(it.name)}</span><span class="rt">${sub}</span></span></button>`;
    };
    const wear = wearOf(cur().skinWear);
    $('.lk-side.l').innerHTML = `<div class="lk-sideh"><span>${TEAM_NAME[L.side]} KIT</span><span>${L.slot + 1}/${SLOT_COUNT}</span></div>` + left.map(row).join('');
    $('.lk-side.r').innerHTML = `<div class="lk-sideh"><span>ACTIONS &amp; GEAR</span><span>${esc(wear.short)}</span></div>` + right.map(row).join('');
  }
  function filtered() {
    let list = BY_CAT[L.cat] ?? [];
    if (L.q) { const q = L.q.toLowerCase(); list = list.filter((i) => i.searchText.includes(q)); }
    if (L.rar.size) list = list.filter((i) => L.rar.has(i.rarity));
    if (L.setFilter !== 'all') list = list.filter((i) => i.set === L.setFilter);
    if (L.sort === 'rarity') list = [...list].sort((a, b) => b.rarityInfo.rank - a.rarityInfo.rank || a.n - b.n);
    else if (L.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (L.sort === 'set') list = [...list].sort((a, b) => SETS.findIndex((s) => s.id === a.set) - SETS.findIndex((s) => s.id === b.set) || a.n - b.n);
    return list;
  }
  function renderTool() {
    const c = CATEGORIES.find((x) => x.id === L.cat);
    const sets = SETS.map((s) => `<option value="${s.id}" ${L.setFilter === s.id ? 'selected' : ''}>${s.name}</option>`).join('');
    const rar = RARITY_LIST.map((r) => `<button data-rar="${r}" class="${L.rar.has(r) ? 'on' : ''}" style="--c:${rc(r)}"><i></i>${RARITY[r].name}</button>`).join('');
    if (L.cat === 'sets') { $('.lk-tool').innerHTML = `<div class="lab">Themed Sets<small>${SETS.length - 1} COLLECTIONS</small></div><div class="lk-sp"></div><div class="lk-count">Hover a set to preview it on your character</div>`; return; }
    $('.lk-tool').innerHTML = `<div class="lab">${c.name}<small id="lk-cnt"></small></div>
      <div class="lk-search">${SVG.search}<input type="text" placeholder="Search ${c.name.toLowerCase()}…" value="${esc(L.q)}" spellcheck="false" maxlength="30"></div>
      <div class="lk-rar">${rar}</div>
      <select class="lk-sel" data-f="set" aria-label="Set filter"><option value="all">All Sets</option>${sets}</select>
      <select class="lk-sel" data-f="sort" aria-label="Sort"><option value="default" ${L.sort === 'default' ? 'selected' : ''}>Default order</option><option value="rarity" ${L.sort === 'rarity' ? 'selected' : ''}>Rarity</option><option value="name" ${L.sort === 'name' ? 'selected' : ''}>Name</option><option value="set" ${L.sort === 'set' ? 'selected' : ''}>Set</option></select>
      <div class="lk-sp"></div><div class="lk-count"></div>`;
  }
  function cardHTML(it, i) {
    const eq = cur()[it.cat] === it.id; const set = SET_BY_ID[it.set]; const stars = store.itemStars(it.id);
    const tag = it.cat === 'suit' && it.material !== 'matte' ? `<span class="hot">${it.material}</span>` : it.cat === 'skin' ? '' : '';
    return `<button class="card r-${it.rarity} ${eq ? 'eq' : ''}" data-id="${it.id}" style="--rc:${rc(it.rarity)};--i:${Math.min(i, 30)}" aria-pressed="${eq}"><span class="ic"><img alt="" loading="lazy" src="${iconFor(it)}"><span class="glowf"></span></span><i class="bar"></i><span class="tick"></span>${stars ? `<span class="st">&#9733; ${stars}</span>` : ''}${tag}<span class="txt"><span class="nm">${esc(it.name)}</span><span class="sb">${esc(set.name)} &middot; ${RARITY[it.rarity].name}</span></span></button>`;
  }
  function renderGrid() {
    const grid = $('.lk-grid'); const wrap = $('.lk-gridw');
    if (L.cat === 'sets') {
      grid.className = 'sets';
      grid.innerHTML = SETS.filter((s) => s.id !== 'issue').map((s, i) => {
        const cp = setCompletion(cur(), s.id);
        const imgs = s.items.map((id) => { const it = BY_ID[id]; const have = cur()[it.cat] === id; return `<img class="${have ? 'have' : ''}" style="--rc:${rc(it.rarity)}" title="${esc(it.name)}" alt="" src="${iconFor(it, 0.5)}">`; }).join('');
        return `<div class="setc" data-set="${s.id}" style="--sc:${'#' + s.color.toString(16).padStart(6, '0')};--i:${i}"><div class="hd"><span class="nm">${s.name}</span><span class="cp">${cp.have}/${cp.total} EQUIPPED</span></div><div class="bl">${esc(s.blurb)}</div><div class="mi">${imgs}</div><div class="ac"><button class="lk-cb pri" data-set-eq="${s.id}">${SVG.save}Equip full set</button></div></div>`;
      }).join('');
      wrap.scrollTop = 0; return;
    }
    grid.className = 'lk-grid';
    const list = filtered();
    grid.innerHTML = list.length ? list.map(cardHTML).join('') : `<div class="empty" style="grid-column:1/-1">No items match your filters</div>`;
    const cnt = $('#lk-cnt'); if (cnt) cnt.textContent = `${list.length} ITEMS`;
    const ct = $('.lk-count'); if (ct) ct.textContent = `${list.length} of ${(BY_CAT[L.cat] ?? []).length} items shown`;
    wrap.scrollTop = 0;
  }
  function refreshEquipped() {
    L.root.querySelectorAll('.card').forEach((el) => { const eq = cur()[BY_ID[el.dataset.id].cat] === el.dataset.id; el.classList.toggle('eq', eq); el.setAttribute('aria-pressed', eq); });
  }
  function renderCtl() {
    const c = L.cat; let h = '';
    const view = L.view ?? CAT_FOCUS[c];
    const vb = (id, lab) => `<button class="lk-cb ${view === id ? 'on' : ''}" data-view="${id}">${lab}</button>`;
    h += `<div class="g"><button class="lk-cb ${L.stage?.stage?.turntable === false ? '' : 'on'}" data-a="turn" title="Turntable (double-click preview)">${SVG.turn}Spin</button></div>`;
    h += `<div class="g">${vb('wide', 'Full')}${vb('head', 'Head')}${vb('back', 'Back')}${vb('tagger', 'Tagger')}</div>`;
    if (c === 'skin') {
      const kind = L.stage?.rig?.tagger?.kind ?? 'arc'; const w = cur().skinWear; const wr = wearOf(w);
      h += `<div class="g">${TAGGER_KINDS.map((k) => `<button class="lk-cb ${kind === k.id ? 'on' : ''}" data-tk="${k.id}">${k.name}</button>`).join('')}</div>`;
      h += `<div class="g"><div class="lk-wear"><div class="t"><span>Wear</span><b>${wr.name} &middot; ${w.toFixed(3)}</b></div><div class="bar" data-wear><i style="left:${(w * 100).toFixed(1)}%"></i></div></div></div>`;
    }
    if (c === 'tagOut') h += `<div class="g"><button class="lk-cb pri" data-a="tagout">${SVG.play}Play tag-out</button></div>`;
    if (c === 'emote') h += `<div class="g"><button class="lk-cb pri" data-a="emote">${SVG.play}Play emote</button></div>`;
    if (c === 'trail') h += `<div class="g"><button class="lk-cb ${L.stage?.stage?.jog ? 'on' : ''}" data-a="run">${SVG.run}Run</button></div>`;
    h += `<div class="g"><button class="lk-cb" data-a="mirror" title="Copy this kit to the other side">${SVG.mirror}Copy to ${L.side === 'ember' ? 'Tide' : 'Ember'}</button></div>`;
    $('.lk-ctl').innerHTML = h;
  }
  function renderFoot() {
    const slots = L.drafts.map((d, i) => {
      const dots = SLOT_CATS.map((cc) => `<i style="--rc:${rc(BY_ID[d[L.side][cc]].rarity)}"></i>`).join('');
      return `<button class="lk-ls ${i === L.slot ? 'on' : ''} ${dirtySlot(i) ? 'dirty' : ''}" data-slot="${i}" title="Double-click to rename"><span class="a">${esc(store.slot(i).name)}${store.data.active === i ? '<em>ACTIVE</em>' : ''}</span><span class="p">${dots}</span><span class="dd"></span></button>`;
    }).join('');
    const code = encodeLoadout(cur()); const dirty = dirtySlot(L.slot);
    $('.lk-foot').innerHTML = `<div class="lk-slots">${slots}</div>
      <div class="lk-code"><span class="lb">Share code</span><input type="text" value="${code}" spellcheck="false" aria-label="Loadout code" data-code><button class="lk-cb" data-a="copy">${SVG.copy}Copy</button><button class="lk-cb" data-a="import">Apply</button></div>
      <div class="lk-sp" style="flex:1"></div>
      <div class="lk-acts"><button class="lk-btn" data-a="random">${SVG.dice}Randomise</button><button class="lk-btn" data-a="reset" ${dirty ? '' : 'disabled'}>${SVG.reset}Reset</button><button class="lk-btn pri" data-a="save">${SVG.save}${dirty ? 'Save &amp; equip' : (store.data.active === L.slot ? 'Equipped' : 'Equip loadout')}</button></div>`;
  }
  function renderAll() { L.root.dataset.side = L.side; renderTabs(); renderSides(); renderTool(); renderGrid(); renderCtl(); renderFoot(); syncSideTog(); }
  function syncSideTog() { L.root.querySelectorAll('.lk-sidetog button').forEach((b) => b.classList.toggle('on', b.dataset.s === L.side)); }

  // ================================================================== preview sync
  function currentOverride() {
    const l = cloneLoadout(cur());
    if (L.over?.set) return applySet(l, L.over.set);
    if (L.over?.id) { const it = BY_ID[L.over.id]; l[it.cat] = it.id; }
    return l;
  }
  function syncStage(force = true) {
    if (!L.stage) return; const spec = resolve(currentOverride());
    L.stage.setSpec(spec, L.side, playerName()); L.stage.setTrail(spec.trail); if (force) L.stage.stage.spec = spec;
    L.stage.render();
  }
  function applyFocus() {
    if (!L.stage) return; const f = L.view ?? CAT_FOCUS[L.cat] ?? 'body';
    L.stage.setFocus(f);
    const run = L.cat === 'trail' || (L.over?.id && BY_ID[L.over.id]?.cat === 'trail');
    if (L.stage.stage.jog !== run && !L.runPinned) L.stage.setJog(run);
  }
  function showInfo(it) {
    const el = $('.lk-info'); if (!it) { el.classList.remove('on'); return; }
    const set = SET_BY_ID[it.set]; el.style.setProperty('--rc', rc(it.rarity));
    el.querySelector('.n').textContent = it.name; el.querySelector('.m').innerHTML = `${RARITY[it.rarity].name} <span>&middot;</span> ${esc(set.name)} <span>&middot;</span> ${esc(CATEGORIES.find((c) => c.id === it.cat).slot)}`;
    el.querySelector('.f').textContent = it.flavor || ''; el.classList.add('on');
  }
  function hoverItem(id) {
    clearTimeout(L.tLeave); const it = BY_ID[id]; if (!it) return;
    L.over = { id }; showInfo(it); L.focusId = id;
    syncStage(); applyFocus(); emit('ui:hover', { id: 'locker-card' });
    if (it.cat === 'emote') { clearTimeout(L.tFx); L.tFx = setTimeout(() => L.stage?.playEmote(it.anim), 220); }
    else if (it.cat === 'tagOut') { clearTimeout(L.tFx); L.tFx = setTimeout(() => { if (L.over?.id === id && L.stage?.tagPhase === 'idle') L.stage.playTagOut(it.effect, it.color); }, 380); }
  }
  function leaveItem() {
    clearTimeout(L.tLeave); L.tLeave = setTimeout(() => {
      clearTimeout(L.tFx); if (!L.over) return; L.over = null; showInfo(null); syncStage(); applyFocus();
      if (L.cat === 'emote') { const it = BY_ID[cur().emote]; if (L.stage?.emoting) L.stage.stopEmote(); void it; }
    }, 90);
  }
  function setSetHover(id) { clearTimeout(L.tLeave); L.over = { set: id }; syncStage(); L.stage?.setFocus('wide'); }

  // ================================================================== actions
  function equip(id, { silent = false } = {}) {
    const it = BY_ID[id]; if (!it) return;
    cur()[it.cat] = id; store.markSeen?.([id]);
    L.over = null; showInfo(it); syncStage(); refreshEquipped(); renderSides(); renderFoot();
    const el = L.root.querySelector(`.card[data-id="${id}"]`); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    if (!silent) emit('ui:click', { id: 'locker-equip' });
    if (it.cat === 'emote') L.stage?.playEmote(it.anim); else if (it.cat === 'tagOut') L.stage?.playTagOut(it.effect, it.color);
  }
  function setCat(cat, { keepFilters = false } = {}) {
    if (cat !== 'sets' && !CATEGORIES.some((c) => c.id === cat)) return;
    L.cat = cat; L.view = null; L.over = null; L.runPinned = false; if (!keepFilters) { L.q = ''; L.rar.clear(); L.setFilter = 'all'; L.sort = 'default'; }
    showInfo(null); renderTabs(); renderSides(); renderTool(); renderGrid(); syncStage(); applyFocus(); renderCtl();
    if (cat === 'emote') { clearTimeout(L.tFx); L.tFx = setTimeout(() => L.stage?.playEmote(cur().emote), 450); } else L.stage?.stopEmote();
    emit('ui:click', { id: 'locker-tab' });
  }
  function cycleCat(d) { const ids = [...CATEGORIES.map((c) => c.id), 'sets']; setCat(ids[(ids.indexOf(L.cat) + d + ids.length) % ids.length]); L.root.querySelector('.lk-tab.on')?.scrollIntoView?.({ block: 'nearest', inline: 'center' }); }
  function setSide(s) {
    if (s === L.side) return; L.side = s; store.setSide(s); L.over = null; showInfo(null);
    L.root.dataset.side = s; syncSideTog(); renderSides(); renderGrid(); renderCtl(); renderFoot(); syncStage(); L.stage?.stage && L.stage.setSpec(resolve(cur()), s, playerName());
    emit('ui:click', { id: 'locker-side' });
  }
  function setSlot(i) { if (i === L.slot || i < 0 || i >= SLOT_COUNT) return; L.slot = i; L.over = null; showInfo(null); renderSides(); refreshEquipped(); renderGrid(); renderCtl(); renderFoot(); syncStage(); emit('ui:click', { id: 'locker-slot' }); }
  function randomize() {
    const l = randomLoadout(rngObj(), L.side); L.drafts[L.slot][L.side] = normalize(l, L.side);
    L.over = null; showInfo(null); renderSides(); refreshEquipped(); renderFoot(); renderCtl(); syncStage();
    L.stage?.stopEmote(); L.stage?.nudge(Math.PI * 0.6); toast('RANDOMISED');
    L.root.querySelectorAll('.card').forEach((el, i) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; el.style.setProperty('--i', Math.min(i, 30)); });
    emit('ui:click', { id: 'locker-random' });
  }
  function reset() { L.drafts[L.slot][L.side] = cloneLoadout(savedOf()); L.over = null; showInfo(null); renderSides(); refreshEquipped(); renderFoot(); renderCtl(); syncStage(); toast('RESET TO SAVED'); }
  function save() {
    const d = L.drafts[L.slot]; store.setLoadout('ember', d.ember, L.slot); store.setLoadout('tide', d.tide, L.slot); store.setActive(L.slot); store.setSide(L.side); store.flush();
    L.drafts[L.slot] = { ember: cloneLoadout(store.loadout('ember', L.slot)), tide: cloneLoadout(store.loadout('tide', L.slot)) };
    api.refreshLocal?.(); renderFoot(); renderSides(); toast('LOADOUT SAVED'); emit('cosmetics:save', { slot: L.slot }); emit('ui:click', { id: 'locker-save' });
  }
  function mirror() {
    const other = L.side === 'ember' ? 'tide' : 'ember'; const l = cloneLoadout(cur()); l.team = other; L.drafts[L.slot][other] = normalize(l, other); toast(`COPIED TO ${TEAM_NAME[other]}`);
    renderFoot();
  }
  function toast(msg) { const t = $('.lk-toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(L.tToast); L.tToast = setTimeout(() => t.classList.remove('on'), 1500); }
  function ask(title, text, buttons) {
    return new Promise((res) => { const m = $('.lk-modal'); m.querySelector('h3').textContent = title; m.querySelector('p').textContent = text; const r = m.querySelector('.r'); r.innerHTML = buttons.map((b, i) => `<button class="lk-btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join(''); m.classList.add('on');
      const h = (e) => { const b = e.target.closest('button'); if (!b) return; m.classList.remove('on'); r.removeEventListener('click', h); res(buttons[+b.dataset.i].val); }; r.addEventListener('click', h); r.querySelector('button:last-child')?.focus(); });
  }
  async function requestClose() {
    if (L.drafts.some((_, i) => dirtySlot(i))) {
      const v = await ask('Unsaved changes', 'Save your loadout before leaving the locker?', [{ label: 'Discard', val: 'd' }, { label: 'Keep editing', val: 'k' }, { label: 'Save', val: 's', cls: 'pri' }]);
      if (v === 'k') return; if (v === 's') for (let i = 0; i < SLOT_COUNT; i++) if (dirtySlot(i)) { const s = L.slot; L.slot = i; save(); L.slot = s; }
    }
    close();
  }
  function copyCode() {
    const code = encodeLoadout(cur()); const done = () => toast('CODE COPIED');
    try { if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(code).then(done, () => fallback()); return; } } catch { /* fall through */ }
    fallback(); function fallback() { const i = $('[data-code]'); i.select(); try { document.execCommand('copy'); } catch { /* ignore */ } done(); }
  }
  function importCode() {
    const inp = $('[data-code]'); const l = decodeLoadout(inp.value);
    if (!l) { inp.classList.remove('bad'); void inp.offsetWidth; inp.classList.add('bad'); toast('INVALID CODE'); return; }
    inp.classList.remove('bad'); if (l.team !== L.side) { L.side = l.team; store.setSide(l.team); L.root.dataset.side = l.team; syncSideTog(); }
    L.drafts[L.slot][L.side] = l; L.over = null; renderSides(); refreshEquipped(); renderGrid(); renderCtl(); renderFoot(); syncStage(); toast('LOADOUT IMPORTED');
  }

  // ================================================================== events
  function bindEvents() {
    const root = L.root;
    root.addEventListener('click', (e) => {
      const t = e.target;
      const card = t.closest('.card'); if (card) { equip(card.dataset.id); return; }
      const tab = t.closest('[data-cat]'); if (tab) { setCat(tab.dataset.cat); return; }
      const se = t.closest('[data-set-eq]'); if (se) { const l = applySet(cur(), se.dataset.setEq); L.drafts[L.slot][L.side] = l; L.over = null; renderSides(); renderGrid(); renderFoot(); syncStage(); toast(`${SET_BY_ID[se.dataset.setEq].name} EQUIPPED`); return; }
      const sd = t.closest('[data-s]'); if (sd) { setSide(sd.dataset.s); return; }
      const sl = t.closest('[data-slot]'); if (sl && !t.closest('input')) { setSlot(+sl.dataset.slot); return; }
      const rar = t.closest('[data-rar]'); if (rar) { const r = rar.dataset.rar; L.rar.has(r) ? L.rar.delete(r) : L.rar.add(r); renderTool(); renderGrid(); return; }
      const vw = t.closest('[data-view]'); if (vw) { L.view = vw.dataset.view; applyFocus(); renderCtl(); return; }
      const tk = t.closest('[data-tk]'); if (tk) { L.stage?.setTaggerKind(tk.dataset.tk); syncStage(); renderCtl(); return; }
      const a = t.closest('[data-a]'); if (!a) return;
      switch (a.dataset.a) {
        case 'close': requestClose(); break;
        case 'save': save(); break; case 'reset': reset(); break; case 'random': randomize(); break;
        case 'copy': copyCode(); break; case 'import': importCode(); break; case 'mirror': mirror(); break;
        case 'turn': { const on = L.stage?.stage.turntable === false; L.stage?.setTurntable(on); renderCtl(); break; }
        case 'tagout': { const it = BY_ID[L.over?.id && BY_ID[L.over.id].cat === 'tagOut' ? L.over.id : cur().tagOut]; L.stage?.playTagOut(it.effect, it.color); break; }
        case 'emote': L.stage?.playEmote(BY_ID[cur().emote].anim); break;
        case 'run': { const on = !L.stage.stage.jog; L.runPinned = !on ? false : true; L.stage.setJog(on); if (!on) L.runPinned = true; renderCtl(); break; }
      }
    });
    root.addEventListener('dblclick', (e) => {
      const sl = e.target.closest('[data-slot]'); if (sl) { const i = +sl.dataset.slot; const span = sl.querySelector('.a'); const inp = document.createElement('input'); inp.value = store.slot(i).name; inp.maxLength = 18; span.replaceChildren(inp); inp.focus(); inp.select();
        const fin = () => { store.rename(i, inp.value.trim() || `Loadout ${i + 1}`); renderFoot(); }; inp.addEventListener('blur', fin); inp.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = store.slot(i).name; inp.blur(); } }); return; }
      if (e.target.closest('.lk-canvas')) { L.stage?.setTurntable(!(L.stage.stage.turntable)); renderCtl(); }
    });
    root.addEventListener('mouseover', (e) => {
      const card = e.target.closest('.card'); if (card) { if (L.focusId !== card.dataset.id || !L.over) hoverItem(card.dataset.id); return; }
      const sc = e.target.closest('.setc'); if (sc) { setSetHover(sc.dataset.set); return; }
    });
    root.addEventListener('mouseout', (e) => { const from = e.target.closest('.card, .setc'); if (from && !from.contains(e.relatedTarget)) leaveItem(); });
    root.addEventListener('focusin', (e) => { const card = e.target.closest?.('.card'); if (card && e.target.matches(':focus-visible')) hoverItem(card.dataset.id); });
    root.addEventListener('focusout', (e) => { if (e.target.closest?.('.card')) leaveItem(); });
    root.addEventListener('input', (e) => { if (e.target.matches('.lk-search input')) { L.q = e.target.value; renderGrid(); } });
    root.addEventListener('change', (e) => { if (e.target.dataset.f === 'set') { L.setFilter = e.target.value; renderGrid(); } else if (e.target.dataset.f === 'sort') { L.sort = e.target.value; renderGrid(); } });
    root.addEventListener('keydown', onKey);
    // wear bar drag
    const wearSet = (e) => { const bar = e.target.closest?.('[data-wear]') ?? $('[data-wear]'); if (!bar) return; const r = bar.getBoundingClientRect(); const v = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); cur().skinWear = Math.round(v * 1000) / 1000; syncStage(); const w = cur().skinWear, wr = wearOf(w); bar.querySelector('i').style.left = (w * 100) + '%'; bar.parentElement.querySelector('.t b').innerHTML = `${wr.name} &middot; ${w.toFixed(3)}`; renderFoot(); };
    root.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-wear]')) { L.wearDrag = true; e.target.closest('[data-wear]').setPointerCapture?.(e.pointerId); wearSet(e); } });
    root.addEventListener('pointermove', (e) => { if (L.wearDrag) wearSet(e); });
    root.addEventListener('pointerup', () => { if (L.wearDrag) { L.wearDrag = false; renderSides(); } });
    // canvas drag rotate
    const cv = $('.lk-canvas'); let px = 0, lastT = 0, vel = 0, drag = false;
    cv.addEventListener('pointerdown', (e) => { drag = true; px = e.clientX; lastT = performance.now(); vel = 0; cv.setPointerCapture?.(e.pointerId); cv.classList.add('drag'); L.stage?.setDragging(true); });
    cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - px; px = e.clientX; const now = performance.now(), dt = Math.max(1, now - lastT) / 1000; lastT = now; L.stage?.nudge(dx * 0.0085); L.stage?.setDragging(true); vel = vel * 0.6 + (dx * 0.0085 / dt) * 0.4; });
    const up = () => { if (!drag) return; drag = false; cv.classList.remove('drag'); L.stage?.setDragging(false); L.stage?.fling(Math.max(-9, Math.min(9, vel))); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); L.stage?.zoomBy(e.deltaY * 0.0009); }, { passive: false });
    if (typeof ResizeObserver !== 'undefined') { L.ro = new ResizeObserver(() => resizeStage()); L.ro.observe($('.lk-main')); }
  }
  function onKey(e) {
    if (!L.open) return; const tag = e.target.tagName; const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if ($('.lk-modal').classList.contains('on')) { if (e.key === 'Escape') { $('.lk-modal button:nth-child(2)')?.click(); e.preventDefault(); } e.stopPropagation(); return; }
    if (e.key === 'Escape') { if (typing) { e.target.blur(); } else requestClose(); e.preventDefault(); e.stopPropagation(); return; }
    e.stopPropagation();
    if (typing) { if (e.key === 'Enter' && e.target.matches('[data-code]')) importCode(); return; }
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 's') { e.preventDefault(); save(); return; }
    if (k === 'q') cycleCat(-1); else if (k === 'e') cycleCat(1); else if (k === 'r') randomize();
    else if (k === 't') setSide(L.side === 'ember' ? 'tide' : 'ember');
    else if (/^[1-4]$/.test(k)) setSlot(+k - 1);
    else if (k === 'a' || (k === 'arrowleft' && !e.target.closest('.card'))) L.stage?.nudge(-0.18);
    else if (k === 'd' || (k === 'arrowright' && !e.target.closest('.card'))) L.stage?.nudge(0.18);
    else if (e.target.closest('.card') && k.startsWith('arrow')) gridNav(e);
    else if (k === 'arrowdown' || k === 'arrowup') { const first = L.root.querySelector('.card.eq') || L.root.querySelector('.card'); first?.focus(); e.preventDefault(); }
  }
  function gridNav(e) {
    const cards = [...L.root.querySelectorAll('.card')]; const i = cards.indexOf(e.target.closest('.card')); if (i < 0) return;
    const top = cards[0].offsetTop; let cols = 0; for (const c of cards) { if (c.offsetTop !== top) break; cols++; } cols = Math.max(1, cols);
    const d = { arrowleft: -1, arrowright: 1, arrowup: -cols, arrowdown: cols }[e.key.toLowerCase()]; const n = cards[Math.min(cards.length - 1, Math.max(0, i + d))]; n?.focus(); n?.scrollIntoView({ block: 'nearest' }); e.preventDefault();
  }

  // ================================================================== stage lifecycle
  function resizeStage() {
    if (!L.stage || !L.open) return; const m = $('.lk-main'); const w = m.clientWidth, h = m.clientHeight; if (w > 8 && h > 8) { L.stage.resize(w, h); L.stage.render(); }
  }
  function initStage() {
    if (L.stage || L.stageFail) return;
    const canvas = $('.lk-canvas');
    try {
      let foreign = null;
      try { const p = ctx.characters?.createPreview?.(); if (p && p.root && typeof p.setSpec === 'function' && typeof p.update === 'function') foreign = p; } catch { foreign = null; }
      L.stage = createStage(canvas, { resolve, preserve: !!ctx.params?.get('test') || !!ctx.params?.get('preserve'), name: playerName(), foreignRig: foreign });
    } catch (err) {
      L.stageFail = true; $('.lk-main').insertAdjacentHTML('afterbegin', '<div class="empty" style="position:absolute;inset:0;display:grid;place-items:center">3D preview unavailable (WebGL)</div>'); ctx.errors?.push?.('locker stage: ' + (err?.stack || err)); return;
    }
    resizeStage(); syncStage(); applyFocus();
  }
  function frame(now) {
    if (!L.open) { L.raf = 0; return; }
    L.raf = requestAnimationFrame(frame); const dt = Math.min(0.1, (now - L.last) / 1000); L.last = now; if (document.hidden) return;
    tick(dt);
  }
  function tick(dt) { if (!L.stage) return; L.stage.tick(dt); L.stage.render(); }

  // ================================================================== open / close
  function open(opts = {}) {
    ensureDom(); if (L.open) return;
    L.drafts = Array.from({ length: SLOT_COUNT }, (_, i) => ({ ember: cloneLoadout(store.loadout('ember', i)), tide: cloneLoadout(store.loadout('tide', i)) }));
    L.slot = store.data.active; L.side = opts.side || ctx.localActor?.team || store.data.side || 'ember'; if (L.side !== 'tide') L.side = 'ember';
    L.cat = opts.cat && (opts.cat === 'sets' || CATEGORIES.some((c) => c.id === opts.cat)) ? opts.cat : 'suit'; L.q = ''; L.rar.clear(); L.setFilter = 'all'; L.sort = 'default'; L.over = null; L.view = null; L.runPinned = false;
    L.root.classList.add('open'); L.open = true;
    L.root.querySelectorAll('.lk-top,.lk-inv,.lk-side,.lk-ctl,.lk-sidetog').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
    renderAll(); initStage(); syncStage(); applyFocus(); renderCtl();
    L.prevPaused = ctx.engine?.paused; if (!ctx.manualStepping && ctx.engine) ctx.engine.paused = true;
    ctx.render?.renderer && (L.prevCanvasVis = ctx.render.renderer.domElement.style.visibility, ctx.render.renderer.domElement.style.visibility = 'hidden');
    if (opts.cat === 'emote') L.stage?.playEmote(cur().emote);
    if (!ctx.manualStepping) { L.last = performance.now(); cancelAnimationFrame(L.raf); L.raf = requestAnimationFrame(frame); }
    else { tick(0.5); }
    if (document.pointerLockElement) document.exitPointerLock?.();
    emit('ui:open', { id: 'locker' }); emit('locker:open');
    L.root.querySelector('.lk-canvas')?.focus({ preventScroll: true });
  }
  function close() {
    if (!L.open) return; L.open = false; L.root.classList.remove('open'); cancelAnimationFrame(L.raf); L.raf = 0;
    clearTimeout(L.tFx); clearTimeout(L.tHover); clearTimeout(L.tLeave);
    if (ctx.engine && !ctx.manualStepping) ctx.engine.paused = !!L.prevPaused;
    if (ctx.render?.renderer) ctx.render.renderer.domElement.style.visibility = L.prevCanvasVis || '';
    L.stage?.stopEmote(); L.stage?.stopTagOut();
    emit('ui:close', { id: 'locker' }); emit('locker:close');
  }
  function dispose() { close(); L.stage?.dispose(); L.stage = null; L.ro?.disconnect(); L.root?.remove(); L.root = null; }

  // ================================================================== debug
  const debug = {
    state: () => ({ open: L.open, side: L.side, slot: L.slot, cat: L.cat, loadout: cloneLoadout(cur()), dirty: L.drafts.map((_, i) => dirtySlot(i)), items: L.root ? L.root.querySelectorAll('.card').length : 0 }),
    setCat, hover: hoverItem, leave: () => { L.over = null; showInfo(null); syncStage(); applyFocus(); }, equip, setSide, setSlot, randomize, save, reset, tick, cycleCat,
    setSet: setSetHover, filter: (o) => { Object.assign(L, o); renderTool(); renderGrid(); },
    get stage() { return L.stage; }, get root() { return L.root; },
    view: (v) => { L.view = v; applyFocus(); renderCtl(); }, toast,
    setLoadout: (l) => { L.drafts[L.slot][L.side] = normalize(l, L.side); L.over = null; renderSides(); refreshEquipped(); renderFoot(); renderCtl(); syncStage(); },
    settle(seconds = 1.2) { const n = Math.ceil(seconds / 0.05); for (let i = 0; i < n; i++) L.stage?.tick(0.05); L.stage?.render(); },
  };
  return { open, close, isOpen: () => L.open, tick: (dt) => { if (L.open && ctx.manualStepping) tick(dt); }, dispose, debug, requestClose };
}
