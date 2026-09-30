// Tiny synchronous event bus. Event catalogue lives in docs/ARCHITECTURE.md.
export function createEvents() {
  const map = new Map();
  return {
    on(type, fn) { (map.get(type) || map.set(type, new Set()).get(type)).add(fn); return () => map.get(type)?.delete(fn); },
    off(type, fn) { map.get(type)?.delete(fn); },
    emit(type, data) {
      const s = map.get(type); if (!s) return;
      for (const fn of [...s]) { try { fn(data, type); } catch (e) { console.error('[events]', type, e); (window.__errors ||= []).push(String(e?.stack || e)); } }
    },
  };
}
