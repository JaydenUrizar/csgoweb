// Keyboard/mouse input + pointer lock. Tests can drive it via input.inject().
// Actions: forward back left right jump crouch walk fire aim reload use(E) drop
//          slot1..slot5 (1-5), lastWeapon(Q), inspect(F), buy(B), scoreboard(Tab), utility1..3, chat, pause(Esc handled by menu)
const DEFAULT_KEYS = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right', Space: 'jump',
  ControlLeft: 'crouch', KeyC: 'crouch', ShiftLeft: 'walk', KeyR: 'reload', KeyE: 'use',
  KeyG: 'drop', KeyQ: 'lastWeapon', KeyF: 'inspect', KeyB: 'buy', Tab: 'scoreboard',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Digit5: 'slot5',
  KeyZ: 'utilitySwap', KeyM: 'map', KeyV: 'ping',
};
export function createInput(ctx) {
  const held = new Set(), pressedThisTick = new Set(), releasedThisTick = new Set();
  const injected = new Set();
  const m = { dx: 0, dy: 0, wheel: 0, locked: false };
  const keys = { ...DEFAULT_KEYS };
  const el = document.getElementById('app');
  const press = (a) => { if (!held.has(a)) pressedThisTick.add(a); held.add(a); };
  const release = (a) => { if (held.delete(a)) releasedThisTick.add(a); };
  addEventListener('keydown', (e) => {
    const a = keys[e.code]; if (!a || ctx.input.captureKeys) return;
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (!e.repeat) press(a);
  });
  addEventListener('keyup', (e) => { const a = keys[e.code]; if (a) release(a); });
  addEventListener('blur', () => { for (const a of [...held]) release(a); });
  el.addEventListener('mousedown', (e) => { if (!m.locked) return; press(e.button === 0 ? 'fire' : e.button === 2 ? 'aim' : 'mouse' + e.button); });
  addEventListener('mouseup', (e) => release(e.button === 0 ? 'fire' : e.button === 2 ? 'aim' : 'mouse' + e.button));
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('mousemove', (e) => { if (m.locked) { m.dx += e.movementX; m.dy += e.movementY; } });
  addEventListener('wheel', (e) => { if (m.locked) m.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    m.locked = document.pointerLockElement === el || document.pointerLockElement === document.body;
    ctx.events.emit(m.locked ? 'input:lock' : 'input:unlock');
  });
  return {
    captureKeys: false,           // menus set true while typing
    get locked() { return m.locked || this.fakeLock; },
    fakeLock: false,              // tests/headless: pretend pointer is locked
    lock() { try { el.requestPointerLock?.({ unadjustedMovement: true })?.catch?.(() => el.requestPointerLock()); } catch { el.requestPointerLock?.(); } },
    unlock() { document.exitPointerLock?.(); },
    down: (a) => held.has(a) || injected.has(a),
    pressed: (a) => pressedThisTick.has(a),
    released: (a) => releasedThisTick.has(a),
    /** Returns and clears accumulated mouse delta (pixels). */
    consumeMouse() { const r = { dx: m.dx, dy: m.dy, wheel: m.wheel }; m.dx = m.dy = m.wheel = 0; return r; },
    /** Test hook: hold/release actions programmatically, and add mouse delta. */
    inject(actions = {}, mouse) {
      for (const [a, v] of Object.entries(actions)) { if (v) { if (!injected.has(a)) pressedThisTick.add(a); injected.add(a); } else if (injected.delete(a)) releasedThisTick.add(a); }
      if (mouse) { m.dx += mouse.dx || 0; m.dy += mouse.dy || 0; }
    },
    clearInjected() { injected.clear(); },
    rebind(code, action) { keys[code] = action; },
    /** Called by the engine once per rendered frame AFTER all fixed steps ran. */
    endFrame() { pressedThisTick.clear(); releasedThisTick.clear(); },
  };
}
