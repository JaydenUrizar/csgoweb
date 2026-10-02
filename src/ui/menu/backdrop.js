// Live 3D showcase behind the main menu: a lit stage, team athletes idling, light shafts, drifting motes,
// occasional tag-pulse streaks, mouse parallax. Renders through its OWN composer on ctx.render.renderer while
// the menu is up (ctx.render.render is patched for the duration; restored on leave()).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createActor } from '../../core/actor.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const EMBER = 0xff7a2f, TIDE = 0x2fd0ff;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- procedural textures ----------
function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 4; return t;
}
const radialTex = (stops, size = 128) => canvasTex(size, size, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const gridTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
  g.globalAlpha = .35; g.lineWidth = 1.5; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
}, { repeat: 40 });
const streakTex = () => canvasTex(256, 16, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.75, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, w, h);
});

// ---------- stand-in athlete (used when ctx.characters can't provide a preview) ----------
function buildAthlete({ team = 'ember', height = 1.8, variant = 0, seed = 0 }) {
  const tc = team === 'ember' ? EMBER : TIDE;
  const suitBase = team === 'ember' ? 0x2a2523 : 0x1b2635;
  const suitMid = team === 'ember' ? 0x4a3a33 : 0x2c4058;
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .15, flatShading: true, ...o });
  const suit = M(suitBase), suit2 = M(suitMid, { roughness: .7 }), dark = M(0x10131a, { roughness: .5, metalness: .4 });
  const glow = new THREE.MeshStandardMaterial({ color: tc, emissive: tc, emissiveIntensity: 1.5, roughness: .4, flatShading: true });
  const glowSoft = new THREE.MeshStandardMaterial({ color: tc, emissive: tc, emissiveIntensity: .9, roughness: .5, flatShading: true });
  const helm = M(team === 'ember' ? 0xd9d2c8 : 0xdfe7ee, { roughness: .35, metalness: .2 });
  const root = new THREE.Group(); const s = height / 1.8; root.scale.setScalar(s);
  const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const cap = (r, l, seg = 6) => new THREE.CapsuleGeometry(r, l, 2, seg);

  const hips = grp(root, 0, .93, 0);
  mesh(new THREE.BoxGeometry(.34, .2, .22), dark, hips, 0, 0, 0);
  const legs = [-1, 1].map((sd) => {
    const th = grp(hips, sd * .1, -.06, 0);
    mesh(cap(.085, .3), suit, th, 0, -.2, 0);
    mesh(new THREE.BoxGeometry(.13, .12, .13), suit2, th, 0, -.1, -.03); // knee guard hint
    const sh = grp(th, 0, -.42, 0);
    mesh(cap(.068, .3), suit2, sh, 0, -.2, 0);
    mesh(new THREE.BoxGeometry(.11, .08, .27), dark, sh, 0, -.42, -.05);
    mesh(new THREE.BoxGeometry(.115, .02, .28), glowSoft, sh, 0, -.465, -.05);
    mesh(new THREE.BoxGeometry(.13, .06, .12), suit, sh, 0, -.13, -.07); // shin guard
    return { th, sh };
  });
  const spine = grp(hips, 0, .1, 0);
  const torsoGeo = new THREE.CylinderGeometry(.215, .155, .52, 6); torsoGeo.scale(1.22, 1, .72);
  const torso = mesh(torsoGeo, suit, spine, 0, .27, 0);
  mesh(new THREE.BoxGeometry(.42, .26, .07), suit2, spine, 0, .32, -.115);        // chest plate
  mesh(new THREE.BoxGeometry(.05, .27, .075), glow, spine, -.06, .32, -.118);      // team stripe
  mesh(new THREE.BoxGeometry(.05, .27, .075), glow, spine, .06, .32, -.118);
  mesh(new THREE.BoxGeometry(.4, .07, .1), dark, spine, 0, .05, -.03);              // belt
  mesh(new THREE.BoxGeometry(.06, .06, .09), glow, spine, 0, .05, -.06);           // buckle
  const pack = mesh(new THREE.BoxGeometry(.3, .4, .14), suit2, spine, 0, .32, .17);
  mesh(new THREE.BoxGeometry(.24, .03, .148), glow, spine, 0, .42, .17);
  if (variant % 2 === 1) mesh(new THREE.CylinderGeometry(.015, .015, .34, 4), dark, spine, .1, .6, .18); // antenna
  const neck = mesh(new THREE.CylinderGeometry(.06, .07, .08, 6), dark, spine, 0, .58, 0);
  const head = grp(spine, 0, .72, 0);
  const hg = new THREE.IcosahedronGeometry(.165, 1); hg.scale(1, .96, 1.08);
  mesh(hg, helm, head, 0, 0, 0);
  mesh(new THREE.BoxGeometry(.24, .085, .09), glow, head, 0, -.008, -.135);          // visor
  mesh(new THREE.BoxGeometry(.255, .1, .06), dark, head, 0, -.008, -.12);            // visor frame
  const ridge = variant === 2
    ? mesh(new THREE.BoxGeometry(.03, .1, .3), glow, head, 0, .17, .0)                  // crest fin
    : mesh(new THREE.BoxGeometry(.04, .03, .32), glowSoft, head, 0, .165, 0);           // stripe
  mesh(new THREE.BoxGeometry(.05, .09, .1), dark, head, .17, -.02, .0); mesh(new THREE.BoxGeometry(.05, .09, .1), dark, head, -.17, -.02, 0); // ear cans
  const arms = [-1, 1].map((sd) => {
    const up = grp(spine, sd * .29, .49, 0);
    mesh(new THREE.SphereGeometry(.098, 6, 4), suit2, up, 0, 0, 0);                    // shoulder pad
    mesh(new THREE.BoxGeometry(.05, .03, .16), glowSoft, up, sd * .04, .07, 0);
    mesh(cap(.062, .24), suit, up, 0, -.19, 0);
    const lo = grp(up, 0, -.34, 0);
    mesh(cap(.055, .22), suit2, lo, 0, -.15, 0);
    mesh(new THREE.BoxGeometry(.1, .1, .12), dark, lo, 0, -.31, 0);                     // glove
    return { up, lo, side: sd };
  });
  // tagger prop
  const gunBody = M(0xc9d2dc, { roughness: .35, metalness: .3 });
  const gun = new THREE.Group();
  mesh(new THREE.BoxGeometry(.075, .13, .5), gunBody, gun, 0, 0, 0);
  mesh(new THREE.BoxGeometry(.06, .08, .34), gunBody, gun, 0, .03, -.32);
  mesh(new THREE.CylinderGeometry(.018, .022, .26, 6).rotateX(Math.PI / 2), glowSoft, gun, 0, .02, -.6);
  mesh(new THREE.BoxGeometry(.02, .02, .3), glow, gun, 0, .075, -.05);
  mesh(new THREE.BoxGeometry(.06, .16, .07), dark, gun, 0, -.11, .05);
  mesh(new THREE.BoxGeometry(.07, .13, .18), dark, gun, 0, -.02, .32);

  // ---- poses. Character faces -Z. Arms use a tiny analytic 2-bone IK so hands always meet the tagger grips. ----
  spine.add(gun);
  const A_LEN = .34, B_LEN = .3;
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _DOWN = new THREE.Vector3(0, -1, 0);
  const solveArm = (arm, target, poleDir) => {
    const sh = arm.up.position; _d.copy(target).sub(sh); let dist = _d.length(); _d.multiplyScalar(1 / (dist || 1));
    dist = Math.min(Math.max(dist, Math.abs(A_LEN - B_LEN) + .02), A_LEN + B_LEN - .01);
    const x = (A_LEN * A_LEN - B_LEN * B_LEN + dist * dist) / (2 * dist), hgt = Math.sqrt(Math.max(0, A_LEN * A_LEN - x * x));
    _p.copy(poleDir); _p.addScaledVector(_d, -_p.dot(_d)).normalize();
    _e.copy(sh).addScaledVector(_d, x).addScaledVector(_p, hgt);      // elbow (spine space)
    _n.copy(_e).sub(sh).normalize(); arm.up.quaternion.setFromUnitVectors(_DOWN, _n);
    _n.copy(target).sub(_e).normalize(); _q.setFromUnitVectors(_DOWN, _n);
    arm.lo.quaternion.copy(arm.up.quaternion).invert().multiply(_q);
  };
  const poses = [
    { gp: [.09, .2, -.3], gr: [.18, .0, .0], sway: 1, stance: .07, lean: .05 },     // low ready
    { gp: [.12, .1, -.2], gr: [-.42, .0, .0], sway: 1, stance: .16, lean: .0 },      // sling / relaxed
    { gp: [.05, .44, -.36], gr: [.02, .06, .0], sway: 0, stance: .05, lean: .09 },  // shouldered
  ];
  const pose = poses[variant % 3];
  const gripR = new THREE.Vector3(0, -.09, .1), gripL = new THREE.Vector3(0, -.02, -.32), tgt = new THREE.Vector3();
  const poleR = new THREE.Vector3(.7, -.9, .25), poleL = new THREE.Vector3(-.7, -.9, .25);
  const setPose = (p, breathe, sway) => {
    const st = p.stance;
    hips.position.y = .93 - st * .12 + breathe * .003;
    hips.rotation.z = sway * .012; hips.rotation.y = sway * .03 * p.sway;
    spine.rotation.x = p.lean + breathe * .006; spine.rotation.z = -sway * .015;
    head.rotation.x = -p.lean * .8 + breathe * .008; head.rotation.y = sway * .05 * p.sway;
    legs[0].th.rotation.x = -.05 - st; legs[0].sh.rotation.x = st * 1.5;
    legs[1].th.rotation.x = .09 + st * .5; legs[1].sh.rotation.x = st * .5;
    legs[0].th.rotation.z = .05; legs[1].th.rotation.z = -.07;
    gun.position.set(p.gp[0], p.gp[1] + breathe * .004, p.gp[2]); gun.rotation.set(p.gr[0] + sway * .01, p.gr[1], p.gr[2]);
    gun.updateMatrix();
    solveArm(arms[1], tgt.copy(gripR).applyMatrix4(gun.matrix), poleR);
    solveArm(arms[0], tgt.copy(gripL).applyMatrix4(gun.matrix), poleL);
  };
  const api = {
    group: root, gun, head, tagger: gun, team,
    update(t) {
      const b = Math.sin(t * 1.6 + seed) , sw = Math.sin(t * .5 + seed * 2.1);
      setPose(pose, b, sw);
    },
    dispose() { root.traverse((o) => { o.geometry?.dispose?.(); }); },
  };
  api.update(0);
  return api;
}

// ---------- backdrop ----------
export function createBackdrop(ctx) {
  const R = ctx.render?.renderer;
  if (!R) return null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, .1, 400);
  const fogColor = new THREE.Color(0x0a1626); scene.fog = new THREE.FogExp2(fogColor, .014); scene.background = fogColor;
  const rand = (() => { let a = 1337; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  // sky dome
  const sunDir = V(.5, .1, -1).normalize();
  const skyMat = track(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x03060f) }, mid: { value: new THREE.Color(0x0a2238) }, hor: { value: new THREE.Color(0xff7a38) }, sun: { value: sunDir }, t: { value: 0 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vD; uniform vec3 top, mid, hor, sun; uniform float t;
      void main(){ vec3 d = normalize(vD); float y = clamp(d.y, -.2, 1.);
        vec3 c = mix(mid, top, smoothstep(.02, .75, y)); c = mix(hor*.18, c, smoothstep(-.12, .25, y));
        float s = max(dot(d, sun), 0.); c += hor * (pow(s, 6.)*.28 + pow(s, 40.)*.9) ;
        float band = smoothstep(.0,.06,y)*smoothstep(.22,.06,y); c += mix(mid, hor, .3) * band * .14;
        gl_FragColor = vec4(c, 1.); }`,
  }));
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(300, 32, 16)), skyMat); sky.frustumCulled = false; scene.add(sky);
  const sun = new THREE.Mesh(track(new THREE.CircleGeometry(9, 40)), track(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa060).multiplyScalar(3.2), fog: false, depthWrite: false })));
  sun.position.copy(sunDir).multiplyScalar(240); sun.lookAt(0, 0, 0); scene.add(sun);

  // skyline (3 depth layers of silhouettes with lit windows)
  const skyline = new THREE.Group(); scene.add(skyline);
  const winGeo = track(new THREE.PlaneGeometry(1, 1));
  const winMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  const layers = [{ z: -46, h: [10, 26], c: 0x0c1a2a, n: 20, spread: 90 }, { z: -68, h: [16, 42], c: 0x132a41, n: 24, spread: 140 }, { z: -100, h: [24, 70], c: 0x1b3c5a, n: 26, spread: 220 }];
  const winCount = 260; const wins = new THREE.InstancedMesh(winGeo, winMat, winCount); let wi = 0; const dummy = new THREE.Object3D(); const col = new THREE.Color();
  for (const L of layers) {
    const mat = track(new THREE.MeshBasicMaterial({ color: L.c, fog: false }));
    for (let i = 0; i < L.n; i++) {
      const w = 3 + rand() * 7, h = L.h[0] + rand() * (L.h[1] - L.h[0]), x = (rand() - .5) * L.spread, d = 3 + rand() * 6;
      const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, h / 2 - 1, L.z + rand() * 6); skyline.add(m);
      const rows = Math.min(6, Math.floor(h / 4));
      for (let r = 0; r < rows && wi < winCount; r++) if (false) {
        dummy.position.set(x + (rand() - .5) * (w - 1.2), 1 + r * 3.6 + rand() * 1.5, m.position.z + d / 2 + .02); dummy.scale.set(.7, .42, 1); dummy.updateMatrix();
        wins.setMatrixAt(wi, dummy.matrix); col.setHex(rand() > .5 ? 0xffb066 : 0x66d8ff).multiplyScalar(.7 + rand() * .6); wins.setColorAt(wi, col); wi++;
      }
    }
  }
  wins.count = wi; wins.instanceMatrix.needsUpdate = true; if (wins.instanceColor) wins.instanceColor.needsUpdate = true; skyline.add(wins);

  // beacon ring gate behind the athletes
  const gate = new THREE.Group(); gate.position.set(.6, 2.8, -8); scene.add(gate);
  const ringMat = (c, i) => track(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: .5, toneMapped: false }));
  const ringA = new THREE.Mesh(track(new THREE.TorusGeometry(3.7, .04, 8, 96, Math.PI)), ringMat(EMBER, 2.2)); ringA.rotation.z = -Math.PI / 2 + 0; gate.add(ringA);
  const ringB = new THREE.Mesh(track(new THREE.TorusGeometry(3.7, .04, 8, 96, Math.PI)), ringMat(TIDE, 2.2)); ringB.rotation.z = Math.PI / 2; gate.add(ringB);
  const ringC = new THREE.Mesh(track(new THREE.TorusGeometry(3.1, .02, 6, 96)), ringMat(0xffffff, .9)); gate.add(ringC);
  const ringD = new THREE.Mesh(track(new THREE.TorusGeometry(4.5, .015, 6, 128)), ringMat(0x7fa8c8, .5)); gate.add(ringD);
  const ticks = new THREE.Group(); gate.add(ticks);
  const tickGeo = track(new THREE.BoxGeometry(.06, .5, .06));
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; const tk = new THREE.Mesh(tickGeo, ringMat(i % 4 === 0 ? 0xffffff : 0x4a6a88, i % 4 === 0 ? 1.6 : .5)); tk.position.set(Math.cos(a) * 4.1, Math.sin(a) * 4.1, 0); tk.rotation.z = a; ticks.add(tk); }

  // floor: reflective polished deck + emissive grid + team pads
  const floorBase = new THREE.Mesh(track(new THREE.CircleGeometry(80, 48)), track(new THREE.MeshStandardMaterial({ color: 0x080c14, roughness: .25, metalness: .7 })));
  floorBase.rotation.x = -Math.PI / 2; floorBase.position.y = -.02; floorBase.receiveShadow = true; scene.add(floorBase);
  let reflector = null;
  try {
    reflector = new Reflector(track(new THREE.CircleGeometry(30, 48)), { textureWidth: 512, textureHeight: 512, clipBias: .003, color: 0x6a7a90 });
    reflector.rotation.x = -Math.PI / 2; reflector.position.y = -.005; scene.add(reflector);
  } catch { reflector = null; }
  const veilTex = track(radialTex([[0, 'rgba(255,255,255,.55)'], [.35, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,1)']], 256));
  const veil = new THREE.Mesh(track(new THREE.CircleGeometry(30, 48)), track(new THREE.MeshBasicMaterial({ color: 0x05080f, transparent: true, opacity: reflector ? .72 : 1, alphaMap: veilTex, depthWrite: false })));
  veil.rotation.x = -Math.PI / 2; veil.position.y = .002; scene.add(veil);
  const grid = track(gridTex()); grid.repeat.set(44, 44);
  const gridMesh = new THREE.Mesh(track(new THREE.CircleGeometry(30, 48)), track(new THREE.MeshBasicMaterial({ map: grid, color: 0x2a6f95, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, alphaMap: track(radialTex([[0, '#fff'], [.5, '#999'], [1, '#000']], 256)) })));
  gridMesh.rotation.x = -Math.PI / 2; gridMesh.position.y = .006; scene.add(gridMesh);
  // centre ring markings
  const decal = new THREE.Group(); decal.position.y = .012; decal.rotation.x = -Math.PI / 2; scene.add(decal);
  const arcMat = (c) => track(new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6), side: THREE.DoubleSide, transparent: true, opacity: .95, depthWrite: false }));
  for (const [r0, r1, a0, a1, c] of [[3.55, 3.62, .12, Math.PI - .12, TIDE], [3.55, 3.62, Math.PI + .12, Math.PI * 2 - .12, EMBER], [4.1, 4.13, .0, Math.PI * 2, 0x6aa0c0]]) {
    const m = new THREE.Mesh(track(new THREE.RingGeometry(r0, r1, 96, 1, a0, a1 - a0)), arcMat(c)); decal.add(m);
  }
  const padGeo = track(new THREE.RingGeometry(.62, .7, 6)), padFill = track(new THREE.CircleGeometry(.62, 6));
  const pads = [];
  const blobTex = track(radialTex([[0, 'rgba(0,0,0,.7)'], [.6, 'rgba(0,0,0,.25)'], [1, 'rgba(0,0,0,0)']]));
  const blobMat = track(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));

  // lights
  scene.add(new THREE.HemisphereLight(0x5c86b8, 0x241a12, .5));
  const key = new THREE.DirectionalLight(0xffe2c4, 2.6); key.position.set(3.2, 5.5, 7); key.target.position.set(0, 1, 0); scene.add(key, key.target);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const sc = key.shadow.camera; sc.left = -5; sc.right = 5; sc.top = 5; sc.bottom = -3; sc.near = 1; sc.far = 20; key.shadow.bias = -.0004; key.shadow.radius = 4;
  const rimT = new THREE.DirectionalLight(TIDE, 2.2); rimT.position.set(-7, 3.5, -5); scene.add(rimT);
  const rimE = new THREE.DirectionalLight(EMBER, 2.6); rimE.position.set(7, 3, -4.5); scene.add(rimE);
  const fillL = new THREE.PointLight(TIDE, 7, 9, 2); fillL.position.set(-3.6, 1.1, 3.2); scene.add(fillL);
  const fillR = new THREE.PointLight(EMBER, 6, 9, 2); fillR.position.set(3.6, 1.1, 3.2); scene.add(fillR);

  // light shafts
  const shaftMat = track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { c: { value: new THREE.Color(0xffa060) }, a: { value: .08 }, t: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vU; uniform vec3 c; uniform float a, t; void main(){ float e = pow(smoothstep(0.,.5,vU.x)*smoothstep(1.,.5,vU.x), 1.6); float f = smoothstep(0.,.35,vU.y)*smoothstep(1.,.5,vU.y); float fl = .8+.2*sin(t*.7+vU.x*9.); gl_FragColor = vec4(c*e*f*a*fl, 1.); }',
  }));
  const shafts = new THREE.Group(); scene.add(shafts);
  const shaftGeo = track(new THREE.PlaneGeometry(1, 1));
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(shaftGeo, i % 3 === 0 ? track(shaftMat.clone()) : shaftMat);
    if (m.material !== shaftMat) { m.material.uniforms = { c: { value: new THREE.Color(TIDE) }, a: { value: .05 }, t: { value: 0 } }; }
    const w = 1.2 + rand() * 2.4; m.scale.set(w, 22, 1); m.position.set(-8 + i * 3 + rand() * 2, 8, -6 - rand() * 4); m.rotation.z = -.5 + rand() * .15; m.userData.s = rand() * 6; shafts.add(m);
  }

  // motes
  const N = 260; const pp = new Float32Array(N * 3), pc = new Float32Array(N * 3), ps = new Float32Array(N), pph = new Float32Array(N);
  const palette = [new THREE.Color(EMBER), new THREE.Color(TIDE), new THREE.Color(0xffffff), new THREE.Color(0xffd9a0)];
  for (let i = 0; i < N; i++) { pp.set([(rand() - .5) * 22, rand() * 9, -8 + rand() * 18], i * 3); const c = palette[Math.floor(rand() * 4)]; pc.set([c.r, c.g, c.b], i * 3); ps[i] = .6 + rand() * (i % 9 === 0 ? 5 : 1.6); pph[i] = rand() * 6.28; }
  const pg = track(new THREE.BufferGeometry()); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3)); pg.setAttribute('size', new THREE.BufferAttribute(ps, 1)); pg.setAttribute('ph', new THREE.BufferAttribute(pph, 1));
  const moteMat = track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 }, px: { value: 1 } },
    vertexShader: `attribute float size; attribute float ph; attribute vec3 color; uniform float t, px; varying vec3 vC; varying float vA;
      void main(){ vec3 p = position; p.y = mod(p.y + t*(.18+size*.04) + ph, 9.); p.x += sin(t*.3+ph*3.)*.6; p.z += cos(t*.25+ph)*.5;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; gl_PointSize = size*px*(38./-mv.z);
        vC = color; vA = (.35+.65*(.5+.5*sin(t*1.3+ph*5.))) * smoothstep(0.,1.2,p.y) * smoothstep(9.,6.,p.y) * (size>3.?.28:1.); }`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord-.5; float r = length(d)*2.; float a = smoothstep(1.,.0,r); a*=a; gl_FragColor = vec4(vC*vA*a*1.6, 1.); }',
  }));
  const motes = new THREE.Points(pg, moteMat); motes.frustumCulled = false; scene.add(motes);

  // tag-pulse streaks
  const stTex = track(streakTex());
  const streaks = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(4.2, .09)), track(new THREE.MeshBasicMaterial({ map: stTex, color: new THREE.Color(i % 2 ? EMBER : TIDE).multiplyScalar(2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    m.visible = false; scene.add(m); streaks.push({ m, t: -1, dir: 1, next: 2 + i * 2.6 });
  }
  const pulses = []; // expanding floor rings
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(track(new THREE.RingGeometry(.96, 1, 64)), track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    m.rotation.x = -Math.PI / 2; m.position.y = .02; scene.add(m); pulses.push({ m, t: -1 });
  }

  // athletes
  const heroes = [];
  const layout = [
    { team: 'tide', x: -1.4, z: .35, yaw: .95, h: 1.86, variant: 0, weapon: 'rail' },
    { team: 'tide', x: -.5, z: .95, yaw: .55, h: 1.76, variant: 1, weapon: 'halo', crouch: 1 },
    { team: 'ember', x: .5, z: .75, yaw: -.35, h: 1.8, variant: 2, weapon: 'zip' },
    { team: 'ember', x: 1.45, z: .3, yaw: -1.0, h: 1.9, variant: 1, weapon: 'arc' },
    { team: 'tide', x: -3.3, z: -2.4, yaw: .9, h: 1.82, variant: 2, weapon: 'lance', back: true },
    { team: 'ember', x: 3.2, z: -2.2, yaw: -.7, h: 1.82, variant: 0, weapon: 'scatter', back: true },
    { team: 'tide', x: -5.0, z: -5, yaw: .4, h: 1.8, variant: 1, weapon: 'pip', back: true },
    { team: 'ember', x: 5.0, z: -5, yaw: -.5, h: 1.8, variant: 1, weapon: 'twin', back: true },
  ];
  let usingReal = false;
  // Real in-game athletes: spawn detached dummy actors through ctx.characters and re-parent their model roots into this scene.
  const realActors = [];
  function tryRealPreview(spec, idx) {
    const C = ctx.characters; if (!C || C.__stub || typeof C.spawn !== 'function') return null;
    try {
      const a = createActor({ name: 'Showcase' + idx, team: spec.team }); a.pos.set(spec.x, 0, spec.z); a.yaw = Math.PI + spec.yaw; a.alive = true; a.isBot = true; a.cosmetics = { team: spec.team };
      const m = C.spawn(a, { materialise: false }); const root = m?.root; if (!root?.isObject3D) { C.remove?.(a); return null; }
      m.dbg = { ...(m.dbg || {}), weapon: spec.weapon || 'arc', crouch: spec.crouch || 0, pitch: (idx % 3 - 1) * .12 };
      scene.add(root); root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root), hgt = box.max.y - box.min.y;
      if (!isFinite(hgt) || hgt < 1.2 || hgt > 3) { C.remove?.(a); return null; }
      realActors.push(a);
      return { group: null, real: true, actor: a, update() { a.pos.set(spec.x, 0, spec.z); a.vel.set(0, 0, 0); a.yaw = Math.PI + spec.yaw; a.onGround = true; }, dispose() { try { C.remove(a); } catch {} root.removeFromParent(); } };
    } catch { return null; }
  }
  function buildHeroes() {
    for (const h of heroes) { scene.remove(h.wrap); h.hero.dispose?.(); h.blob.geometry.dispose(); } realActors.length = 0;
    heroes.length = 0; usingReal = false;
    layout.forEach((sp, i) => {
      let hero = tryRealPreview(sp, i); if (hero) usingReal = true;
      if (!hero) hero = buildAthlete({ team: sp.team, height: sp.h, variant: sp.variant, seed: i * 1.7 });
      const wrap = new THREE.Group(); wrap.position.set(sp.x, 0, sp.z); wrap.rotation.y = Math.PI + sp.yaw;
      // athletes face -Z in their own space; rotating by PI+yaw makes them face +Z (camera) turned inward
      if (hero.group) { wrap.add(hero.group); } scene.add(wrap);
      const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), blobMat); blob.rotation.x = -Math.PI / 2; blob.position.set(sp.x, .014, sp.z); scene.add(blob);
      if (!sp.back) {
        const col = sp.team === 'ember' ? EMBER : TIDE;
        const pad = new THREE.Mesh(padGeo, track(new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.7), transparent: true, opacity: .9, depthWrite: false }))); pad.rotation.x = -Math.PI / 2; pad.position.set(sp.x, .016, sp.z); scene.add(pad);
        const fill = new THREE.Mesh(padFill, track(new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .1, depthWrite: false }))); fill.rotation.x = -Math.PI / 2; fill.position.set(sp.x, .015, sp.z); scene.add(fill);
        wrap.userData.pads = [pad, fill];
      }
      heroes.push({ wrap, hero, blob, spec: sp });
    });
  }
  buildHeroes();
  // if characters piece finishes after us, rebuild lazily on first enter
  let triedRealAt = 0, dirty = false;

  // ---------- rendering ----------
  let composer = null, bloom = null, W = 0, H = 0, pr = 1;
  function ensureComposer() {
    const size = R.getSize(new THREE.Vector2()); const ratio = R.getPixelRatio();
    if (composer && size.x === W && size.y === H && ratio === pr) return;
    W = size.x; H = size.y; pr = ratio;
    if (!composer) {
      composer = new EffectComposer(R, new THREE.WebGLRenderTarget(W * pr, H * pr, { type: THREE.HalfFloatType, samples: 4 }));
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .5, .5, .9); composer.addPass(bloom);
      composer.addPass(new OutputPass());
    }
    composer.setPixelRatio(pr); composer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
    moteMat.uniforms.px.value = pr * H / 720;
  }

  // ---------- state ----------
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  const mood = { name: 'main', x: 0, dim: 0, push: 0, tx: 0, tdim: 0, tpush: 0 };
  let T = 0, active = false, saved = null, origRender = null, low = !!ctx.params.get('lowfx'), suspended = false, lastT = 0, slow = 0, nFrames = 0;
  const applyLow = () => { if (reflector) reflector.visible = !low; veil.material.opacity = low ? 1 : (reflector ? .72 : 1); motes.visible = !low; shafts.visible = !low; };
  applyLow();
  addEventListener('pointermove', (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; });
  const look = V(0, 1.2, 0);

  function update(dt) {
    if (!active || suspended) return;
    const nowT = performance.now(); if (lastT && !ctx.manualStepping) { const fr = nowT - lastT; if (fr < 1000) { slow = slow * .95 + fr * .05; if (++nFrames > 90 && !low && slow > 70) { low = true; applyLow(); } } } lastT = nowT;
    T += dt;
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 2.6); mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 2.6);
    const k = 1 - Math.exp(-dt * 2.2);
    mood.x += (mood.tx - mood.x) * k; mood.dim += (mood.tdim - mood.dim) * k; mood.push += (mood.tpush - mood.push) * k;
    // camera: slow orbit sway + mouse parallax
    const az = Math.sin(T * .09) * .06 + -mouse.sx * .07, el = mouse.sy * .022;
    const dist = 14.6 - mood.push;
    camera.position.set(Math.sin(az) * dist + mood.x, 1.2 + el * 3 + Math.sin(T * .13) * .05, Math.cos(az) * dist);
    look.set(-.05 + mood.x * .6 + mouse.sx * .18, 1.3 - el * 2, 0); camera.lookAt(look);
    camera.fov = 30;
    if (api.free) { camera.position.copy(api.free.pos); camera.lookAt(api.free.look); }
    // animate
    for (const h of heroes) h.hero.update(T, dt);
    gate.rotation.z = T * .02; ticks.rotation.z = -T * .05; ringD.rotation.z = T * .03;
    gate.position.y = 3.2 + Math.sin(T * .3) * .04;
    skyMat.uniforms.t.value = T; moteMat.uniforms.t.value = T; shaftMat.uniforms.t.value = T;
    for (const s of shafts.children) { s.rotation.z = -.55 + Math.sin(T * .12 + s.userData.s) * .05; s.position.x += Math.sin(T * .05 + s.userData.s) * .0015; if (s.material.uniforms) s.material.uniforms.t.value = T; }
    for (const s of streaks) {
      s.next -= dt;
      if (s.t < 0 && s.next <= 0) { s.t = 0; s.dir = Math.sin(T * 12.9898 + s.next * 7.1) > 0 ? 1 : -1; s.y = 1.0 + (Math.sin(T * 78.233 + 2.1) * .5 + .5) * 2.4; s.z = -2.5 - (Math.sin(T * 37.7) * .5 + .5) * 3; s.m.visible = true; s.m.scale.x = s.dir; s.next = 5 + (Math.sin(T * 91.3) * .5 + .5) * 5; p2(s.dir); }
      if (s.t >= 0) { s.t += dt / .5; const p = s.t; s.m.position.set(-10 + 20 * p * s.dir + (s.dir < 0 ? 0 : 0), s.y, s.z); if (s.dir < 0) s.m.position.x = 10 - 20 * p; s.m.material.opacity = Math.sin(Math.min(1, p) * Math.PI); if (s.t >= 1) { s.t = -1; s.m.visible = false; } }
    }
    function p2() { const p = pulses.find((q) => q.t < 0); if (p) { p.t = 0; p.m.material.color.setHex(Math.sin(T * 5.1) > 0 ? TIDE : EMBER).multiplyScalar(2.2); } }
    for (const p of pulses) if (p.t >= 0) { p.t += dt / 1.6; const r = .5 + p.t * 9; p.m.scale.setScalar(r); p.m.material.opacity = Math.max(0, .7 * (1 - p.t)) ; if (p.t >= 1) { p.t = -1; p.m.material.opacity = 0; } }
    for (const h of heroes) if (h.wrap.userData.pads) { const b = .8 + .2 * Math.sin(T * 1.8 + h.spec.x); h.wrap.userData.pads[0].material.opacity = b; }
    bloom.strength = .55 - mood.dim * .2; R.toneMappingExposure = 1.05 - mood.dim * .32;
  }

  function render() {
    if (!active || suspended) return;
    if (low) { const st = { tm: R.toneMapping, ac: R.autoClear }; R.toneMapping = THREE.ACESFilmicToneMapping; R.autoClear = true; R.setRenderTarget(null); R.render(scene, camera); R.toneMapping = st.tm; R.autoClear = st.ac; camera.aspect = R.domElement.width / R.domElement.height; camera.updateProjectionMatrix(); return; }
    ensureComposer();
    const st = { tm: R.toneMapping, ex: R.toneMappingExposure, ac: R.autoClear };
    R.toneMapping = THREE.ACESFilmicToneMapping; R.autoClear = true;
    composer.render();
    R.toneMapping = st.tm; R.autoClear = st.ac;
  }

  const api = {
    free: null,
    setLow(v) { low = !!v; applyLow(); }, get low() { return low; }, suspend(v) { suspended = !!v; lastT = 0; },
    get active() { return active; },
    get usingReal() { return usingReal; },
    scene, camera,
    enter() {
      if (active) return; active = true;
      saved = { ex: R.toneMappingExposure };
      if (dirty || (!usingReal && ctx.characters && !ctx.characters.__stub && performance.now() - triedRealAt > 1000)) { triedRealAt = performance.now(); dirty = false; buildHeroes(); }
      origRender = ctx.render.render; ctx.render.render = render;
      R.toneMappingExposure = 1.05; ensureComposer();
    },
    leave() {
      if (!active) return; active = false;
      if (origRender) ctx.render.render = origRender; origRender = null;
      if (usingReal) { for (const h of heroes) h.hero.dispose?.(); realActors.length = 0; dirty = true; for (const h of heroes) { scene.remove(h.wrap); } heroes.length = 0; usingReal = false; }
      if (saved) R.toneMappingExposure = saved.ex;
    },
    warm() { const was = active; active = true; try { ensureComposer(); composer.render(); } catch (e) { console.warn('[menu] backdrop warm failed', e); } active = was; },
    update, render,
    setMood(name) { mood.name = name; const m = { main: [0, 0, 0], dim: [0, 1, .8], side: [.5, .6, .4], locker: [0, .6, 1.6], end: [0, .3, .3] }[name] || [0, 0, 0]; mood.tx = m[0]; mood.tdim = m[1]; mood.tpush = m[2]; },
    snapMood() { mood.x = mood.tx; mood.dim = mood.tdim; mood.push = mood.tpush; },
    dispose() { this.leave(); disposables.forEach((d) => d.dispose?.()); composer?.dispose?.(); },
  };
  return api;
}
