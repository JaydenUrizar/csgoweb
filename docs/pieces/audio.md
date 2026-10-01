# audio — procedural WebAudio (src/audio/*, tools/audio_*.{mjs,py})

Files: `dsp.js` (synth primitives) · `registry.js`/`catalog.js` (198 sounds) · `weapons.js` (12 taggers x fire/reload1-3/draw/empty/inspect, lance.bolt, scatter.pump, scope) · `world.js` (impact.*, step.*, move.*, util.*, beacon.*) · `feedback.js` (hit.tick/crown/kill, dmg.taken, tag.out.*, UI, round stings) · `voice.js` (formant-synth announcer, `announce.<id>`, aliases incl. match `announce {id}` ids) · `music.js` (16-step sequencer: menu/buy/live/armed/win/lose) · `mixer.js` (buses, comp+limiter, ducking, deafen, HRTF voices, air-absorption LPF, raycast occlusion with cache, 3 convolver reverbs) · `reverb.js` (generated IRs) · `events.js` (event->sound wiring, room probing, beacon/timer polling) · `offline.js` · `lab.js` · `index.js`.

API: `ctx.audio.play(name,{pos,gain,pitch,actor,fp,delay})`, `music.set/setIntensity`, `announce(id)`, `setListener(cam)` (default ctx.render.camera), `unlock()` (auto on first gesture; immediate under ?test), `duck`, `deafen`, `sounds`, `debug.{renderOffline, renderOfflineFull, list, stats, meter, log, recent, room}`. Local actor = first-person mix (2D, no distance); others positional. Events consumed: weapon:*, impact, tag:hit/out, footstep/land/jump/slide, util:*, beacon (state polled from ctx.match.beacon), round:*, match:end, credits, buy, ui:*, announce, ping.

## Inspect
* `?test=1&seed=1&scene=sound-lab` — click any sound; FP/TP, distance, azimuth, occlusion, room, volume, music states, live meters.
* Offline: `node tools/audio_dump.mjs [--only regex] [--dry] [--tp]` -> `shots/audio/*.wav|png`, `metrics.txt/json` (peak, RMS, LUFS-ish, attack, decay, centroid, rolloff). Needs python numpy/scipy/matplotlib.
* Real CS2 reference: `python3 tools/audio_ref_fetch.py` (downloads trailer audio), `python3 tools/audio_ref.py scan N | cut N T0 DUR NAME | compare ours.wav ref.wav`.

## Tuning
Per-weapon params `FIRE` + `TRIM` in weapons.js; global makeup/comp in mixer.js; music state gains in music.js; voice level in voice.js (`cg`).

## Known gaps
Trailer audio is music/VO-mixed, so only rough spectral targets (centroid 1-3 kHz, short-term ~-19 LUFS) were used; gunshots still low-end heavy (low_ratio ~0.8). Not yet auditioned by a human ear. Announcer is intelligible-robotic at best. Occlusion counts front-face hits only (no thickness). No Doppler; no speed-of-sound delay.
