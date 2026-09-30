const KEY = 'fluxtag.settings.v1';
const DEFAULTS = {
  sensitivity: 1.0, fov: 100, invertY: false, volume: 0.8, musicVolume: 0.5, sfxVolume: 1,
  quality: 'high',            // low | medium | high | ultra
  crosshair: { style: 'classic', size: 5, gap: 3, thickness: 1.6, color: '#6dff9a', dot: false, outline: true, dynamic: true },
  viewmodel: { fov: 68, offsetX: 0.0, offsetY: 0.0, offsetZ: 0.0, bob: 1 },
  showFps: false, screenShake: 1, hudScale: 1, colorblind: 'off', autoBhop: false,
};
export function createSettings(ctx) {
  let data = structuredClone(DEFAULTS);
  try { Object.assign(data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
  const s = {
    data,
    get: (k) => data[k],
    set(k, v) { data[k] = v; try { localStorage.setItem(KEY, JSON.stringify(data)); } catch {} ctx.events.emit('settings:change', { key: k, value: v }); },
    reset() { data = structuredClone(DEFAULTS); s.data = data; try { localStorage.removeItem(KEY); } catch {} },
  };
  return s;
}
