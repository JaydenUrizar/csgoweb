// ?scene=sound-lab : clickable list of every sound with first/third-person, distance, azimuth, occlusion and music controls.
export function registerLab(ctx, audio) {
  ctx.debugScenes['sound-lab'] = async () => {
    const root = document.createElement('div');
    root.id = 'sound-lab';
    root.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0c1016;color:#d7e0ea;font:13px/1.35 system-ui,Segoe UI,sans-serif;overflow:auto;padding:14px 18px 60px';
    root.innerHTML = `<style>
      #sound-lab h1{font-size:18px;margin:0 0 4px;letter-spacing:.06em} #sound-lab h2{font-size:12px;margin:16px 0 6px;color:#7fd0ff;text-transform:uppercase;letter-spacing:.12em}
      #sound-lab button{background:#1a2330;color:#d7e0ea;border:1px solid #2b3a4d;border-radius:4px;padding:3px 8px;margin:2px;cursor:pointer;font:12px system-ui}
      #sound-lab button:hover{background:#25344a;border-color:#4b7bb0} #sound-lab button.on{background:#2a6a4a;border-color:#4fd08a}
      #sound-lab .bar{position:sticky;top:0;background:#0c1016ee;padding:8px 0;border-bottom:1px solid #1f2b3a;z-index:2;display:flex;flex-wrap:wrap;gap:14px;align-items:center}
      #sound-lab label{display:flex;align-items:center;gap:6px;color:#9db0c4} #sound-lab input[type=range]{width:120px}
      #sound-lab canvas{background:#070a0e;border:1px solid #1f2b3a;border-radius:4px}
    </style>
    <h1>FLUX TAG  SOUND LAB</h1><div id="sl-status" style="color:#9db0c4">click anywhere to unlock audio</div>
    <div class="bar">
      <label><input type="checkbox" id="sl-fp" checked> first-person</label>
      <label>dist <input type="range" id="sl-dist" min="0" max="120" value="18"><span id="sl-dv">18 m</span></label>
      <label>azimuth <input type="range" id="sl-az" min="-180" max="180" value="35"><span id="sl-av">35&deg;</span></label>
      <label>occlusion <select id="sl-occ"><option value="">auto</option><option>0</option><option>1</option><option>2</option><option>3</option></select></label>
      <label>room <select id="sl-room"><option value="">auto</option><option value="open">open</option><option value="tunnel">tunnel</option><option value="room">room</option></select></label>
      <label>vol <input type="range" id="sl-vol" min="0" max="1" step="0.01" value="0.8"></label>
      <canvas id="sl-meter" width="220" height="34"></canvas><canvas id="sl-spec" width="260" height="34"></canvas>
      <span id="sl-peak" style="min-width:150px;font-variant-numeric:tabular-nums"></span>
    </div><div id="sl-body"></div>`;
    document.body.appendChild(root);
    const $ = (id) => root.querySelector('#' + id);
    const body = $('sl-body');
    const opts = () => {
      const fp = $('sl-fp').checked, dist = +$('sl-dist').value, az = (+$('sl-az').value * Math.PI) / 180, o = { fp };
      if (!fp) {
        const L = audio.mixer?.listener || { x: 0, y: 1.6, z: 0, fx: 0, fz: -1, rx: 1, rz: 0 };
        o.pos = { x: L.x + (L.rx * Math.sin(az) + L.fx * Math.cos(az)) * Math.max(dist, 0.5), y: L.y - 0.4, z: L.z + (L.rz * Math.sin(az) + L.fz * Math.cos(az)) * Math.max(dist, 0.5) };
      }
      if ($('sl-occ').value !== '') o.occ = +$('sl-occ').value;
      return o;
    };
    const ensure = () => new Promise((res) => { audio.unlock(); let n = 0; const t = setInterval(() => { if (audio.unlocked || ++n > 30) { clearInterval(t); res(audio.unlocked); } }, 30); });
    const play = async (name, extra = {}) => { await ensure(); const o = { ...opts(), ...extra }; if (name.startsWith('announce.')) return audio.announce(name.slice(9), { fp: true }); if (name.startsWith('music.')) { audio.music.set(name.slice(6), { immediate: true }); return; } return audio.play(name, o); };
    const groups = {};
    for (const n of audio.debug.list()) { const s = audio.sounds[n]; const k = s.cat.startsWith('tagger.') ? 'tagger' : s.cat; (groups[k] ||= []).push(n); }
    const order = ['tagger', 'hit', 'tag', 'impact', 'step', 'move', 'util', 'beacon', 'ui', 'announce'];
    for (const g of [...order, ...Object.keys(groups).filter((k) => !order.includes(k))]) {
      if (!groups[g]) continue;
      const h = document.createElement('h2'); h.textContent = `${g} (${groups[g].length})`; body.appendChild(h);
      const box = document.createElement('div'); body.appendChild(box);
      const all = document.createElement('button'); all.textContent = 'play all'; all.style.color = '#7fd0ff';
      all.onclick = async () => { for (const n of groups[g]) { await play(n); await new Promise((r) => setTimeout(r, 900)); } };
      box.appendChild(all);
      for (const n of groups[g]) { const b = document.createElement('button'); b.textContent = n.replace(/^tagger\./, ''); b.title = n; b.onclick = () => play(n); box.appendChild(b); }
    }
    const h = document.createElement('h2'); h.textContent = 'music'; body.appendChild(h);
    const mb = document.createElement('div'); body.appendChild(mb);
    for (const s of ['menu', 'buy', 'live', 'armed', 'win', 'lose', 'off']) { const b = document.createElement('button'); b.textContent = s; b.onclick = async () => { await ensure(); audio.music.set(s, { immediate: true }); [...mb.children].forEach((c) => c.classList.toggle('on', c === b)); }; mb.appendChild(b); }
    const iv = document.createElement('label'); iv.innerHTML = ' armed intensity <input type="range" min="0" max="1" step="0.01" value="0">'; iv.querySelector('input').oninput = (e) => audio.music.setIntensity(+e.target.value); mb.appendChild(iv);
    root.addEventListener('pointerdown', () => audio.unlock(), { once: true });
    $('sl-dist').oninput = () => { $('sl-dv').textContent = $('sl-dist').value + ' m'; }; $('sl-az').oninput = () => { $('sl-av').innerHTML = $('sl-az').value + '&deg;'; };
    $('sl-vol').oninput = (e) => audio.mixer?.setVolumes({ master: +e.target.value });
    $('sl-room').onchange = () => { const v = $('sl-room').value; if (v) audio.mixer?.setRoom({ open: v === 'open' ? 1 : 0, tunnel: v === 'tunnel' ? 1 : 0, room: v === 'room' ? 1 : 0 }); };
    // meters
    const mc = $('sl-meter').getContext('2d'), sc = $('sl-spec').getContext('2d'); let fft = null;
    const loop = () => {
      if (!document.body.contains(root)) return; requestAnimationFrame(loop);
      const m = audio.debug.meter(); $('sl-status').textContent = `audio: ${audio.debug.stats().state}  voices ${audio.debug.stats().active ?? 0}  music ${audio.music.playing}`;
      if (!m) return;
      mc.clearRect(0, 0, 220, 34); const w = Math.max(0, Math.min(1, (m.peakDb + 60) / 60)) * 220; mc.fillStyle = m.peakDb > -3 ? '#ff5a4f' : m.peakDb > -12 ? '#ffd24a' : '#4fd08a'; mc.fillRect(0, 4, w, 12);
      const r = Math.max(0, Math.min(1, (m.rmsDb + 60) / 60)) * 220; mc.fillStyle = '#7fd0ff'; mc.fillRect(0, 20, r, 8); $('sl-peak').textContent = `peak ${m.peakDb.toFixed(1)} dBFS  rms ${m.rmsDb.toFixed(1)}`;
      const a = audio.mixer.analyser; fft ||= new Uint8Array(a.frequencyBinCount); a.getByteFrequencyData(fft);
      sc.clearRect(0, 0, 260, 34); sc.fillStyle = '#7fd0ff'; for (let i = 0; i < 130; i++) { const bin = Math.floor(Math.pow(i / 130, 2) * 600) + 2, v = fft[bin] / 255; sc.fillRect(i * 2, 34 - v * 34, 1.6, v * 34); }
    };
    requestAnimationFrame(loop);
    window.__soundLab = { play, opts, root };
  };
}
