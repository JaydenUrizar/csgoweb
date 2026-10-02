// Buy system: catalogue, purchase rules (team / time / zone / credits / limits), same-tick rebuy/refund/undo/drop, bot auto-buy.
import { TIMING as MATCH } from './timing.js';
import { CATALOG, BY_ID, MAX_UTILITY } from './catalog.js';

export function installBuy(env) {
  const { ctx, M, emit, ms, C, R, shuffle, addCredits, safe, TUNE, inBuyZone } = env;
  const catalog = CATALOG.map((c) => ({ ...c }));
  const item = (id) => catalog.find((c) => c.id === id);
  const OPEN = (p) => p === 'warmup' || p === 'buy' || p === 'freeze';

  function refreshCatalog() {
    for (const it of catalog) { const d = ctx.combat?.taggers?.[it.id]; if (d && typeof d.killReward === 'number') it.killReward = d.killReward; }
  }

  /** null when this actor may open the buy menu / purchase now, else a reason string. */
  function windowReason(a) {
    if (!a || !a.alive) return 'dead';
    if (M.paused) return 'paused';
    const p = M.phase;
    if (OPEN(p)) return null;
    if (p === 'live') { if (M.armedThisRound) return 'time'; if (M.phaseTime > TUNE.buyGrace) return 'time'; return inBuyZone(a) ? null : 'zone'; }
    return 'phase';
  }
  function buyTimeLeft() {
    if (M.phase === 'buy') return Math.max(0, MATCH.buyTime - M.phaseTime) + MATCH.freezeTime;
    if (M.phase === 'freeze') return Math.max(0, MATCH.freezeTime - M.phaseTime);
    if (M.phase === 'live' && !M.armedThisRound) return Math.max(0, TUNE.buyGrace - M.phaseTime);
    return 0;
  }

  function utilCount(a, id) { const u = ms(a).owned.utility; let n = 0; for (const x of u) if (x === id) n++; return n; }
  const slotKey = (it) => (it.slot === 1 ? 'primary' : it.slot === 2 ? 'secondary' : null);
  const refundable = (a, id) => (OPEN(M.phase) ? ms(a).bought.find((b) => b.id === id && b.round === M.round && b.cost > 0) : null);

  /** Full purchase check without side effects. */
  function check(a, id) {
    const it = item(id); if (!it) return { ok: false, reason: 'unknown' };
    const w = windowReason(a); if (w) return { ok: false, reason: w };
    if (!it.teams.includes(a.team)) return { ok: false, reason: 'team' };
    const o = ms(a).owned;
    const key = slotKey(it);
    if (key && o[key] === id) return { ok: false, reason: 'owned' };
    if (it.utility) { if (utilCount(a, id) >= it.max || o.utility.length >= MAX_UTILITY) return { ok: false, reason: 'limit' }; }
    if (id === 'vest' && a.armor >= 100 && a.helmet) return { ok: false, reason: 'owned' };
    if (id === 'kit' && (o.kit || a.hasKit)) return { ok: false, reason: 'owned' };
    let refund = 0, replaced = null;
    if (key && o[key]) { replaced = o[key]; const e = refundable(a, replaced); if (e) refund = e.cost; }
    if (a.credits + refund < it.cost) return { ok: false, reason: 'credits', need: it.cost - a.credits - refund };
    return { ok: true, item: it, refund, replaced };
  }

  function canBuy(a, id) { return id ? check(a, id).ok : !windowReason(a); }

  function dropLedger(a, id) { const b = ms(a).bought; for (let i = b.length - 1; i >= 0; i--) if (b[i].id === id && b[i].round === M.round) { b.splice(i, 1); return true; } return false; }

  function buy(a, id) {
    const r = check(a, id); if (!r.ok) return r;
    const it = r.item, s = ms(a), o = s.owned, key = slotKey(it);
    if (r.replaced) {
      if (r.refund) { addCredits(a, r.refund, 'refund:' + r.replaced); dropLedger(a, r.replaced); safe('combat.remove', () => C()?.remove?.(a, r.replaced)); emit('buy:refund', { actor: a, item: r.replaced, amount: r.refund, rebuy: id }); }
    }
    if (it.cost) addCredits(a, -it.cost, 'buy:' + id);
    if (key) o[key] = id;
    else if (it.utility) o.utility.push(id);
    else if (id === 'vest') { o.vest = true; a.armor = 100; a.helmet = true; }
    else if (id === 'kit') { o.kit = true; a.hasKit = true; }
    s.bought.push({ id, cost: it.cost, slot: it.slot, round: M.round, t: M.clock, replaced: r.replaced || null });
    safe('combat.give', () => C()?.give?.(a, id));
    emit('buy', { actor: a, item: id, cost: it.cost, refund: r.refund, replaced: r.replaced, credits: a.credits });
    return { ok: true, item: it, cost: it.cost, refund: r.refund, replaced: r.replaced, credits: a.credits };
  }

  function strip(a, id) {
    const s = ms(a), o = s.owned, it = item(id);
    if (!it) return false;
    const key = slotKey(it);
    if (key) { if (o[key] !== id) return false; o[key] = key === 'secondary' ? 'pip' : null; if (key === 'secondary') safe('combat.give', () => C()?.give?.(a, 'pip')); }
    else if (it.utility) { const i = o.utility.indexOf(id); if (i < 0) return false; o.utility.splice(i, 1); }
    else if (id === 'vest') { if (!o.vest) return false; o.vest = false; a.armor = 0; a.helmet = false; }
    else if (id === 'kit') { if (!o.kit) return false; o.kit = false; a.hasKit = false; }
    return true;
  }
  /** Sell back an item bought this round, during warmup/buy/freeze only. */
  function refund(a, id) {
    const e = refundable(a, id);
    if (!e) return { ok: false, reason: OPEN(M.phase) ? 'nothing' : 'phase' };
    if (!strip(a, id)) return { ok: false, reason: 'nothing' };
    dropLedger(a, id);
    safe('combat.remove', () => C()?.remove?.(a, id));
    addCredits(a, e.cost, 'refund:' + id);
    emit('buy:refund', { actor: a, item: id, amount: e.cost, rebuy: null });
    return { ok: true, amount: e.cost, credits: a.credits };
  }
  function undo(a) {
    const b = ms(a).bought;
    for (let i = b.length - 1; i >= 0; i--) if (b[i].cost > 0 && b[i].round === M.round) return refund(a, b[i].id);
    return { ok: false, reason: 'nothing' };
  }
  /** Drop an item on the floor without refund (default sidearm can't be dropped). */
  function drop(a, id) {
    if (!a?.alive || id === 'pip' || id === 'tap') return { ok: false, reason: 'default' };
    if (!strip(a, id)) return { ok: false, reason: 'nothing' };
    dropLedger(a, id);
    safe('combat.drop', () => { const c = C(); if (c?.drop) c.drop(a, id); else c?.remove?.(a, id); });
    emit('buy:drop', { actor: a, item: id });
    return { ok: true };
  }
  /** Re-buy last round's purchases (skips owned / unaffordable). */
  function rebuy(a) {
    const out = []; for (const id of ms(a).lastBuy || []) { const r = buy(a, id); if (r.ok) out.push(id); }
    return out;
  }

  // ------------------------------------------------------------------ bots
  let queue = [];
  function teamPlan(team) {
    if (M.botPlan && M.botPlan.round === M.round) return M.botPlan[team];
    const plan = { round: M.round };
    for (const t of ['ember', 'tide']) {
      const members = M.teams[t], cr = members.map((a) => a.credits).sort((x, y) => x - y);
      const median = cr.length ? cr[Math.floor(cr.length / 2)] : 0;
      const rifle = BY_ID[t === 'ember' ? 'arc' : 'rail'].cost;
      let kind = 'eco';
      if (M.pistolRound) kind = 'pistol';
      else if (median >= rifle + 1000 + 300) kind = 'full';
      else if (median >= 1900) kind = 'force';
      const rich = members.filter((a) => a.credits >= 5750);
      plan[t] = { kind, median, awperId: rich.length && R() < 0.75 ? rich[Math.floor(R() * rich.length)].id : null };
    }
    M.botPlan = plan; return plan[team];
  }

  function botBuy(a, force = false) {
    if (!a || !a.alive) return [];
    const s = ms(a); if (!force && s.botRound === M.round) return [];
    s.botRound = M.round;
    const plan = teamPlan(a.team), o = s.owned, bought = [];
    const cost = (id) => BY_ID[id].cost;
    const tryBuy = (id) => { if (!BY_ID[id].teams.includes(a.team)) return false; const r = buy(a, id); if (r.ok) bought.push(id); return r.ok; };
    const rifle = a.team === 'ember' ? 'arc' : 'rail';
    let kind = plan.kind;
    if (kind === 'eco' && a.credits >= cost(rifle) + 1000 + 900) kind = 'full';       // rich individual on an eco team
    if (kind === 'full' && !o.primary && a.credits < cost(rifle)) kind = a.credits >= 1900 ? 'force' : 'eco';
    const utilFill = (n) => { for (const id of shuffle(['haze', 'strobe', 'pulse'])) { if (n <= 0) break; if (o.utility.length >= MAX_UTILITY) break; if (a.credits >= cost(id) && tryBuy(id)) n--; } };
    const vest = () => { if (!(a.armor >= 100 && a.helmet) && a.credits >= cost('vest')) tryBuy('vest'); };
    if (kind === 'pistol') {
      const menu = a.team === 'tide'
        ? [['twin', 'haze', 'strobe'], ['judge'], ['kit', 'haze', 'strobe'], ['haze', 'strobe', 'pulse'], ['twin', 'kit', 'strobe']]
        : [['twin', 'haze', 'strobe'], ['judge'], ['haze', 'strobe', 'pulse'], ['twin', 'strobe', 'strobe'], ['zip']];
      for (const id of menu[Math.floor(R() * menu.length)]) if (!tryBuy(id)) break;
    } else if (kind === 'full') {
      if (!o.primary) {
        if (plan.awperId === a.id && a.credits >= cost('lance') + (a.armor >= 100 ? 0 : 1000)) tryBuy('lance');
        else if (a.credits >= cost('halo') + 1000 && R() < 0.22) tryBuy('halo');
        else if (a.credits >= cost('storm') + 1000 && R() < 0.06) tryBuy('storm');
        else tryBuy(rifle);
      }
      vest();
      if (a.team === 'tide' && !a.hasKit && a.credits >= cost('kit') && R() < 0.75) tryBuy('kit');
      utilFill(2 + (R() < 0.35 ? 1 : 0));
    } else if (kind === 'force') {
      if (!o.primary) {
        if (a.credits >= cost('hum') + 1000 && R() < 0.5) tryBuy('hum');
        else if (a.credits >= cost('zip') + 1000) tryBuy('zip');
        else if (a.credits >= cost('scatter') && R() < 0.35) tryBuy('scatter');
        else if (a.credits >= cost('hum')) tryBuy(R() < 0.5 ? 'hum' : 'zip');
        else if (a.credits >= cost('zip')) tryBuy('zip');
        else if (a.credits >= cost('judge') && R() < 0.5) tryBuy('judge');
        else tryBuy('twin');
      }
      vest();
      utilFill(1);
    } else {
      // eco: save. A cheap strobe now and then when comfortably above the line.
      if (a.credits >= 1500 && R() < 0.3) tryBuy('strobe');
    }
    return bought;
  }

  function scheduleBots() {
    refreshCatalog();
    queue = [];
    for (const a of ctx.actors) { if (a.isPlayer || !M.teams[a.team]) continue; queue.push({ at: 0.4 + R() * 5.6, a }); }
    queue.sort((x, y) => x.at - y.at);
  }
  function tickBots() {
    if (!queue.length) return;
    const t = M.phase === 'buy' ? M.phaseTime : MATCH.buyTime + M.phaseTime;
    while (queue.length && queue[0].at <= t) botBuy(queue.shift().a);
  }
  function flushBots() { while (queue.length) botBuy(queue.shift().a); }

  return { catalog, canBuy, check, buy, refund, undo, drop, rebuy, botBuy, scheduleBots, tickBots, flushBots, buyTimeLeft, windowReason, refreshCatalog };
}
