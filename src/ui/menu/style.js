// All menu CSS (injected once). Prefix .fx-. Scales with viewport via the root font-size clamp (1024x600 .. 4K).


export const CSS = /* css */ `
#ui > .fx{position:absolute;inset:0;pointer-events:none;overflow:clip;
  --ember:#ff7a2f;--tide:#2fd0ff;--ember-rgb:255,122,47;--tide-rgb:47,208,255;
  --acc:var(--ember);--acc-rgb:var(--ember-rgb);--acc2:var(--tide);
  --ink:#04060b;--glass:rgba(12,15,22,.72);--glass2:rgba(8,10,16,.9);--panel:rgba(20,25,35,.62);
  --line:rgba(255,255,255,.085);--line2:rgba(255,255,255,.2);--txt:#eaf0f8;--dim:#93a0b6;--mute:#5f6b7f;--ok:#6dff9a;--bad:#ff5d6c;
  --disp:'Barlow Condensed','Roboto Condensed','Arial Narrow','Liberation Sans Narrow','Helvetica Neue',Arial,sans-serif;
  --body:'Barlow Condensed','Barlow','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  --ease:cubic-bezier(.2,.8,.2,1);
  font:500 calc(1*var(--u))/1.3 var(--body);color:var(--txt);--u:clamp(12px,min(1.1vw,1.95vh),40px);font-size:var(--u);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;letter-spacing:.01em;cursor:default}
.fx *,.fx *::before,.fx *::after{box-sizing:border-box}
:where(.fx) :where(button,input,select){font:inherit;color:inherit}
:where(.fx) button{cursor:pointer;border:0;background:none;padding:0;text-align:inherit}
:where(.fx) :focus{outline:none}
.fx :focus-visible{outline:2px solid var(--acc);outline-offset:2px;box-shadow:0 0 0 5px rgba(var(--acc-rgb),.18)}
.fx svg{display:block}
.fx .fx-disp{font-family:var(--disp);text-transform:uppercase}
.fx [hidden]{display:none!important}

/* ---------- layers ---------- */
.fx-layer{position:absolute;inset:0;pointer-events:none}
.fx-scrim{background:
  radial-gradient(120% 90% at 50% 50%,transparent 45%,rgba(2,4,9,.55) 100%),
  linear-gradient(90deg,rgba(3,5,10,.78) 0%,rgba(3,5,10,.42) 26%,rgba(3,5,10,0) 46%,rgba(3,5,10,0) 62%,rgba(3,5,10,.5) 100%),
  linear-gradient(0deg,rgba(3,5,10,.7) 0%,rgba(3,5,10,0) 22%),linear-gradient(180deg,rgba(3,5,10,.55) 0%,rgba(3,5,10,0) 16%);
  transition:opacity .5s var(--ease)}
.fx-grain{opacity:.07;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>")}
.fx-scan{opacity:.05;background:repeating-linear-gradient(0deg,#000 0 1px,transparent 1px 3px)}
.fx-screen{position:absolute;inset:0;overflow:clip;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .28s var(--ease),visibility 0s .28s}
.fx-screen.on{opacity:1;visibility:visible;pointer-events:none;transition:opacity .34s var(--ease),visibility 0s}
.fx-screen.on .fx-hit,.fx-screen.on button,.fx-screen.on input,.fx-screen.on select,.fx-screen.on .fx-modal{pointer-events:auto}
.fx-hit{pointer-events:auto}
.fx-screen.on .fx-in{animation:fxIn .55s var(--ease) both;animation-delay:calc(var(--i,0)*45ms + 60ms)}
@keyframes fxIn{from{opacity:0;transform:translate3d(-18px,0,0)}to{opacity:1;transform:none}}
@keyframes fxInR{from{opacity:0;transform:translate3d(22px,0,0)}to{opacity:1;transform:none}}
@keyframes fxInU{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}
@keyframes fxPop{0%{transform:scale(.96);opacity:0}100%{transform:none;opacity:1}}
.fx-screen.on .fx-inR{animation:fxInR .6s var(--ease) both;animation-delay:.18s}
.fx-screen.on .fx-inU{animation:fxInU .5s var(--ease) both;animation-delay:calc(var(--i,0)*50ms + 80ms)}

/* ---------- top bar & footer ---------- */
.fx-top{position:absolute;left:0;right:0;top:0;height:calc(4*var(--u));display:flex;align-items:center;gap:calc(1*var(--u));padding:0 calc(2.6*var(--u));pointer-events:none}
.fx-top>*{pointer-events:auto}
.fx-brand{display:flex;align-items:center;gap:calc(.7*var(--u));font:800 calc(1.15*var(--u))/1 var(--disp);letter-spacing:.24em;text-transform:uppercase;opacity:.9}
.fx-brand svg{width:calc(1.7*var(--u));height:calc(1.7*var(--u))}
.fx-spacer{flex:1}
.fx-chip{display:flex;align-items:center;gap:calc(.6*var(--u));height:calc(2.4*var(--u));padding:0 calc(1*var(--u));border:1px solid var(--line);background:rgba(10,13,20,.55);backdrop-filter:blur(10px);border-radius:2px;font:600 calc(.95*var(--u)) var(--disp);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);transition:all .15s}
.fx-chip b{color:var(--txt);font-weight:700}
button.fx-chip:hover{border-color:var(--line2);color:var(--txt);background:rgba(20,26,38,.7)}
.fx-ico{width:calc(2.4*var(--u));height:calc(2.4*var(--u));display:grid;place-items:center;border:1px solid var(--line);background:rgba(10,13,20,.55);backdrop-filter:blur(10px);border-radius:2px;color:var(--dim);transition:all .15s var(--ease)}
.fx-ico svg{width:calc(1.2*var(--u));height:calc(1.2*var(--u));fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.fx-ico:hover{color:#fff;border-color:rgba(var(--acc-rgb),.6);background:rgba(var(--acc-rgb),.16);transform:translateY(-1px)}
.fx-avatar{width:calc(1.5*var(--u));height:calc(1.5*var(--u));border-radius:50%;background:conic-gradient(from 200deg,var(--ember),var(--tide),var(--ember));box-shadow:0 0 0 1px rgba(255,255,255,.3) inset}
.fx-foot{position:absolute;left:0;right:0;bottom:0;height:calc(3.4*var(--u));display:flex;align-items:center;gap:calc(1.6*var(--u));padding:0 calc(2.6*var(--u));font:600 calc(.86*var(--u)) var(--disp);letter-spacing:.14em;text-transform:uppercase;color:var(--mute);pointer-events:none}
.fx-foot .tip{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62%;color:var(--dim);letter-spacing:.06em;font:500 calc(.95*var(--u)) var(--body);text-transform:none;transition:opacity .4s}
.fx-foot .tip b{color:var(--acc);font:700 calc(.82*var(--u)) var(--disp);letter-spacing:.16em;margin-right:calc(.6*var(--u))}
.fx-hint{display:inline-flex;align-items:center;gap:calc(.5*var(--u))}
.fx-key{display:inline-grid;place-items:center;min-width:1.7em;height:1.7em;padding:0 .45em;border:1px solid var(--line2);border-bottom-width:2px;border-radius:3px;background:rgba(255,255,255,.06);font:700 .82em/1 var(--disp);letter-spacing:.06em;color:var(--txt);text-transform:uppercase;white-space:nowrap}

/* ---------- main menu ---------- */
.fx-main .col-l{position:absolute;left:calc(4.4*var(--u));top:calc(5.2*var(--u));bottom:calc(4.4*var(--u));width:calc(22*var(--u));display:flex;flex-direction:column}
.fx-logo{width:calc(21*var(--u));max-width:100%;filter:drop-shadow(0 calc(.4*var(--u)) calc(1.2*var(--u)) rgba(0,0,0,.6))}
.fx-logo svg{width:100%;height:auto;overflow:visible}
.fx-tag{margin:calc(.3*var(--u)) 0 calc(1.5*var(--u)) calc(.2*var(--u));font:700 calc(.98*var(--u)) var(--disp);letter-spacing:.42em;text-transform:uppercase;color:var(--dim);display:flex;align-items:center;gap:calc(.8*var(--u))}
.fx-tag i{flex:0 0 calc(2.4*var(--u));height:2px;background:linear-gradient(90deg,var(--ember),var(--tide))}
.fx-menu{display:flex;flex-direction:column;gap:calc(.3*var(--u));margin:0;padding:0;list-style:none}
.fx-mi{position:relative;display:flex;align-items:center;gap:calc(1*var(--u));width:100%;height:calc(3.1*var(--u));padding:0 calc(1.2*var(--u)) 0 calc(1.4*var(--u));color:#c5cfdf;overflow:hidden;
  font:700 calc(1.6*var(--u))/1 var(--disp);letter-spacing:.07em;text-transform:uppercase;transition:color .18s,background .25s var(--ease),transform .25s var(--ease),letter-spacing .25s var(--ease)}
.fx-mi::before{content:"";position:absolute;left:0;top:calc(.35*var(--u));bottom:calc(.35*var(--u));width:3px;background:var(--acc);transform:scaleY(0);transition:transform .25s var(--ease);box-shadow:0 0 calc(.9*var(--u)) var(--acc)}
.fx-mi::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(var(--acc-rgb),.28),rgba(var(--acc-rgb),.06) 60%,transparent);opacity:0;transform:translateX(-30%);transition:all .35s var(--ease);z-index:-1}
.fx-mi .n{font:600 calc(.82*var(--u)) var(--disp);letter-spacing:.14em;color:var(--mute);width:calc(1.5*var(--u));transition:color .2s}
.fx-mi .sub{display:none}
.fx-mi .sub{margin-left:auto;font:500 calc(.88*var(--u)) var(--body);letter-spacing:.02em;text-transform:none;color:var(--mute);transition:color .2s,transform .3s var(--ease)}
.fx-mi:hover,.fx-mi.foc,.fx-mi:focus-visible{color:#fff;transform:translateX(calc(.5*var(--u)));letter-spacing:.09em;outline:none;box-shadow:none}
.fx-mi:hover::before,.fx-mi:focus-visible::before{transform:scaleY(1)}
.fx-mi:hover::after,.fx-mi:focus-visible::after{opacity:1;transform:none}
.fx-mi:hover .n,.fx-mi:focus-visible .n{color:var(--acc)}
.fx-mi:hover .sub,.fx-mi:focus-visible .sub{color:var(--dim);transform:translateX(calc(-.3*var(--u)))}
.fx-mi:active{transform:translateX(calc(.35*var(--u))) scale(.985);transition-duration:.06s}
.fx-mi.pri{color:#fff;background:linear-gradient(90deg,rgba(var(--ember-rgb),.95),rgba(255,150,70,.78) 70%,rgba(255,150,70,.15));height:calc(3.8*var(--u));font-size:calc(1.95*var(--u));margin-bottom:calc(.4*var(--u));
  clip-path:polygon(0 0,100% 0,calc(100% - calc(1.1*var(--u))) 100%,0 100%);text-shadow:0 1px 0 rgba(0,0,0,.25)}
.fx-mi.pri::before{display:none}.fx-mi.pri::after{display:none}
.fx-mi.pri .n{color:rgba(255,255,255,.75)}
.fx-mi.pri .sub{color:rgba(255,255,255,.8);margin-right:calc(1.2*var(--u))}
.fx-mi.pri:hover,.fx-mi.pri:focus-visible{filter:brightness(1.12) saturate(1.1);transform:translateX(calc(.5*var(--u)))}
.fx-mi.pri .shine{position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.4) 50%,transparent 65%);transform:translateX(-120%);transition:none}
.fx-mi.pri:hover .shine,.fx-mi.pri:focus-visible .shine{transform:translateX(120%);transition:transform .75s var(--ease)}
.fx-ver{margin-top:auto;font:600 calc(.8*var(--u)) var(--disp);letter-spacing:.2em;color:var(--mute);text-transform:uppercase}

.fx-card{position:relative;background:linear-gradient(180deg,rgba(18,23,33,.78),rgba(9,12,18,.86));border:1px solid var(--line);border-radius:3px;backdrop-filter:blur(16px) saturate(1.2);box-shadow:0 calc(1.6*var(--u)) calc(4*var(--u)) rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.4)}
.fx-card::before,.fx-card::after{content:"";position:absolute;width:calc(1.1*var(--u));height:calc(1.1*var(--u));pointer-events:none;border:2px solid var(--acc);opacity:.9}
.fx-card::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
.fx-card::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.fx-setup{position:absolute;right:calc(4.4*var(--u));top:50%;translate:0 -50%;width:calc(27*var(--u));padding:calc(1.4*var(--u)) calc(1.5*var(--u)) calc(1.5*var(--u))}
.fx-h{display:flex;align-items:baseline;gap:calc(.8*var(--u));font:800 calc(1.02*var(--u)) var(--disp);letter-spacing:.26em;text-transform:uppercase;color:var(--dim);margin-bottom:calc(1.15*var(--u))}
.fx-h::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}
.fx-h b{color:var(--acc)}
.fx-lab{display:flex;justify-content:space-between;align-items:baseline;margin:calc(1.05*var(--u)) 0 calc(.5*var(--u));font:700 calc(.82*var(--u)) var(--disp);letter-spacing:.2em;text-transform:uppercase;color:var(--mute)}
.fx-lab em{font:500 calc(.88*var(--u)) var(--body);font-style:normal;letter-spacing:.02em;text-transform:none;color:var(--dim)}
.fx-seg{display:flex;gap:calc(.3*var(--u))}
.fx-seg>button{position:relative;flex:1;height:calc(3*var(--u));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(.15*var(--u));border:1px solid var(--line);background:rgba(255,255,255,.035);border-radius:2px;
  font:700 calc(1.08*var(--u))/1 var(--disp);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);transition:all .16s var(--ease);overflow:hidden}
.fx-seg>button small{font:600 calc(.68*var(--u)) var(--disp);letter-spacing:.14em;color:var(--mute);transition:color .16s}
.fx-seg>button:hover{color:#fff;border-color:var(--line2);background:rgba(255,255,255,.07);transform:translateY(-1px)}
.fx-seg>button.on{color:#fff;border-color:rgba(var(--c,var(--acc-rgb)),.85);background:linear-gradient(180deg,rgba(var(--c,var(--acc-rgb)),.3),rgba(var(--c,var(--acc-rgb)),.1));box-shadow:0 0 calc(1.2*var(--u)) rgba(var(--c,var(--acc-rgb)),.22) inset,0 calc(.2*var(--u)) calc(1*var(--u)) rgba(var(--c,var(--acc-rgb)),.12)}
.fx-seg>button.on small{color:rgba(255,255,255,.7)}
.fx-seg>button.on::after{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:rgb(var(--c,var(--acc-rgb)))}
.fx-seg>button:active{transform:scale(.97);transition-duration:.05s}
.fx-seg>button .dots{display:flex;gap:2px}.fx-seg>button .dots i{width:calc(.5*var(--u));height:3px;background:rgba(255,255,255,.18);border-radius:1px}.fx-seg>button .dots i.f{background:rgb(var(--c,var(--acc-rgb)))}
.fx-seg.side>button{flex-direction:row;gap:calc(.6*var(--u))}
.fx-seg.side .sw{width:calc(.85*var(--u));height:calc(.85*var(--u));transform:rotate(45deg);background:rgb(var(--c));box-shadow:0 0 calc(.7*var(--u)) rgba(var(--c),.8)}
.fx-seg.side .sw.rnd{background:linear-gradient(90deg,var(--ember) 50%,var(--tide) 50%)}
.fx-map{display:flex;gap:calc(.9*var(--u));align-items:center;padding:calc(.6*var(--u));border:1px solid rgba(var(--acc-rgb),.55);background:linear-gradient(90deg,rgba(var(--acc-rgb),.14),rgba(255,255,255,.03));border-radius:2px}
.fx-map .th{flex:0 0 calc(6.2*var(--u));height:calc(3.6*var(--u));border-radius:2px;overflow:hidden;position:relative;border:1px solid var(--line2)}
.fx-map .th svg{width:100%;height:100%}
.fx-map .nm{font:800 calc(1.3*var(--u))/1 var(--disp);letter-spacing:.1em;text-transform:uppercase}
.fx-map .ds{font:500 calc(.84*var(--u)) var(--body);color:var(--dim);margin-top:calc(.25*var(--u))}
.fx-map .ok{margin-left:auto;width:calc(1.3*var(--u));height:calc(1.3*var(--u));border-radius:50%;background:var(--acc);display:grid;place-items:center}
.fx-map .ok svg{width:calc(.8*var(--u));height:calc(.8*var(--u));stroke:#0a0d14;stroke-width:3;fill:none}
.fx-go{position:relative;display:flex;align-items:center;justify-content:center;gap:calc(1*var(--u));width:100%;height:calc(4.3*var(--u));margin-top:calc(1.5*var(--u));overflow:hidden;
  background:linear-gradient(180deg,#ff8f4d,#f2661c);color:#fff;font:800 calc(2.1*var(--u))/1 var(--disp);letter-spacing:.16em;text-transform:uppercase;border-radius:2px;
  box-shadow:0 calc(.5*var(--u)) calc(1.6*var(--u)) rgba(var(--ember-rgb),.32),inset 0 1px 0 rgba(255,255,255,.4);transition:transform .2s var(--ease),box-shadow .2s,filter .2s}
.fx-go::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 calc(.7*var(--u)),rgba(255,255,255,.05) calc(.7*var(--u)) calc(1.4*var(--u)))}
.fx-go .shine{position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transform:translateX(-120%)}
.fx-go:hover,.fx-go:focus-visible{transform:translateY(-2px);filter:brightness(1.08);box-shadow:0 calc(.8*var(--u)) calc(2.4*var(--u)) rgba(var(--ember-rgb),.5),inset 0 1px 0 rgba(255,255,255,.5)}
.fx-go:hover .shine,.fx-go:focus-visible .shine{transform:translateX(120%);transition:transform .8s var(--ease)}
.fx-go:active{transform:translateY(1px) scale(.99);filter:brightness(.95);transition-duration:.05s}
.fx-go .fx-key{background:rgba(0,0,0,.25);border-color:rgba(255,255,255,.3);font-size:.62em}
.fx-go2{display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:calc(.6*var(--u));height:calc(2.6*var(--u));padding:0 calc(1*var(--u));border:1px solid var(--line);background:rgba(255,255,255,.035);border-radius:2px;font:700 calc(1*var(--u)) var(--disp);letter-spacing:.16em;text-transform:uppercase;color:var(--dim);transition:all .16s var(--ease)}
.fx-go2 small{font:500 calc(.84*var(--u)) var(--body);letter-spacing:.02em;text-transform:none;color:var(--mute)}
.fx-go2:hover{color:#fff;border-color:var(--line2);background:rgba(255,255,255,.08)}
.fx-rules{margin-top:calc(1*var(--u));display:flex;gap:calc(.5*var(--u)) calc(1.2*var(--u));flex-wrap:wrap;font:500 calc(.84*var(--u)) var(--body);color:var(--mute)}
.fx-rules b{color:var(--dim);font-weight:600}

/* ---------- sheet (settings / help / credits / locker fallback) ---------- */
.fx-dim{background:rgba(2,4,9,.55);backdrop-filter:blur(5px)}
.fx-end .fx-enddim{background:radial-gradient(90% 70% at 50% 25%,rgba(var(--acc-rgb),.14),rgba(2,4,9,.93) 80%);backdrop-filter:blur(8px)}
.fx-sheet{position:absolute;left:50%;top:50%;translate:-50% -50%;width:min(calc(78*var(--u)),95vw);height:min(calc(52*var(--u)),92vh);display:flex;flex-direction:column;overflow:hidden;padding:0}
.fx-sheet::before,.fx-sheet::after{z-index:3}
.fx-sh-head{display:flex;align-items:center;gap:calc(1.2*var(--u));height:calc(4.4*var(--u));padding:0 calc(1.6*var(--u)) 0 calc(2*var(--u));border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.04),transparent)}
.fx-sh-head h2{margin:0;font:800 calc(2*var(--u))/1 var(--disp);letter-spacing:.14em;text-transform:uppercase}
.fx-sh-head h2 i{font-style:normal;color:var(--acc)}
.fx-x{width:calc(2.6*var(--u));height:calc(2.6*var(--u));display:grid;place-items:center;border:1px solid var(--line);border-radius:2px;color:var(--dim);transition:all .15s var(--ease)}
.fx-x:hover{color:#fff;background:rgba(255,255,255,.1);border-color:var(--line2);transform:rotate(90deg)}
.fx-x svg{width:calc(1.1*var(--u));height:calc(1.1*var(--u));stroke:currentColor;stroke-width:2.2;fill:none;stroke-linecap:round}
.fx-btn{display:inline-flex;align-items:center;justify-content:center;gap:calc(.6*var(--u));height:calc(2.6*var(--u));padding:0 calc(1.3*var(--u));border:1px solid var(--line2);border-radius:2px;background:rgba(255,255,255,.05);font:700 calc(1*var(--u)) var(--disp);letter-spacing:.14em;text-transform:uppercase;color:#dbe4f1;transition:all .15s var(--ease);white-space:nowrap}
.fx-btn:hover{background:rgba(255,255,255,.12);color:#fff;transform:translateY(-1px)}
.fx-btn:active{transform:scale(.97);transition-duration:.05s}
.fx-btn.pri{background:linear-gradient(180deg,#ff8f4d,#f2661c);border-color:transparent;color:#fff;box-shadow:0 calc(.3*var(--u)) calc(1*var(--u)) rgba(var(--ember-rgb),.3)}
.fx-btn.pri:hover{filter:brightness(1.1)}
.fx-btn.ghost{border-color:var(--line);background:transparent;color:var(--dim)}
.fx-btn.danger:hover{background:rgba(255,93,108,.2);border-color:var(--bad);color:#fff}
.fx-btn.sm{height:calc(2.1*var(--u));padding:0 calc(.9*var(--u));font-size:calc(.88*var(--u))}
.fx-sh-body{flex:1;display:flex;min-height:0;position:relative}
.fx-pane.more{-webkit-mask-image:linear-gradient(180deg,#000 calc(100% - calc(3.4*var(--u))),transparent);mask-image:linear-gradient(180deg,#000 calc(100% - calc(3.4*var(--u))),transparent)}
.fx-scrollcue{position:absolute;right:calc(2.4*var(--u));bottom:calc(.9*var(--u));display:flex;align-items:center;gap:calc(.5*var(--u));padding:calc(.35*var(--u)) calc(.8*var(--u));border:1px solid var(--line2);border-radius:calc(2*var(--u));background:rgba(10,13,20,.85);font:700 calc(.8*var(--u)) var(--disp);letter-spacing:.18em;text-transform:uppercase;color:var(--dim);opacity:0;transform:translateY(6px);transition:all .25s var(--ease);pointer-events:none}
.fx-scrollcue svg{width:calc(.9*var(--u));height:calc(.9*var(--u));stroke:currentColor;fill:none;stroke-width:2.2}
.fx-sh-body.more .fx-scrollcue{opacity:1;transform:none;animation:fxBob 1.6s ease-in-out infinite}
@keyframes fxBob{50%{transform:translateY(3px)}}
.fx-rail{flex:0 0 calc(15.5*var(--u));padding:calc(1.2*var(--u)) 0 calc(1*var(--u));border-right:1px solid var(--line);display:flex;flex-direction:column;gap:calc(.15*var(--u));background:rgba(0,0,0,.18)}
.fx-tab{position:relative;display:flex;align-items:center;gap:calc(.9*var(--u));height:calc(3.2*var(--u));padding:0 calc(1.2*var(--u)) 0 calc(1.6*var(--u));font:700 calc(1.2*var(--u)) var(--disp);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);transition:all .16s var(--ease)}
.fx-tab svg{width:calc(1.3*var(--u));height:calc(1.3*var(--u));fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;opacity:.85}
.fx-tab::before{content:"";position:absolute;left:0;top:calc(.3*var(--u));bottom:calc(.3*var(--u));width:3px;background:var(--acc);transform:scaleY(0);transition:transform .2s var(--ease)}
.fx-tab:hover{color:#fff;background:rgba(255,255,255,.05)}
.fx-tab.on{color:#fff;background:linear-gradient(90deg,rgba(var(--acc-rgb),.2),transparent)}
.fx-tab.on::before{transform:scaleY(1)}
.fx-tab.on svg{color:var(--acc);opacity:1}
.fx-rail .sp{flex:1}
.fx-pane{flex:1;min-width:0;overflow:auto;padding:calc(1.4*var(--u)) calc(2.2*var(--u)) calc(3*var(--u));scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent}
.fx-pane::-webkit-scrollbar{width:calc(.55*var(--u))}.fx-pane::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:calc(1*var(--u))}
.fx-pane.swap>*{animation:fxInU .38s var(--ease) both;animation-delay:calc(var(--i,0)*30ms)}
.fx-sh-foot{display:flex;align-items:center;gap:calc(1.4*var(--u));height:calc(3.2*var(--u));padding:0 calc(1.6*var(--u)) 0 calc(2*var(--u));border-top:1px solid var(--line);font:600 calc(.84*var(--u)) var(--disp);letter-spacing:.14em;text-transform:uppercase;color:var(--mute);background:rgba(0,0,0,.22)}
.fx-grp{margin:0 0 calc(1.9*var(--u))}
.fx-grp>h3{display:flex;align-items:center;gap:calc(.8*var(--u));margin:0 0 calc(.5*var(--u));font:800 calc(1.05*var(--u)) var(--disp);letter-spacing:.28em;text-transform:uppercase;color:var(--acc)}
.fx-grp>h3::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}
.fx-row{display:grid;grid-template-columns:minmax(calc(12*var(--u)),calc(17*var(--u))) minmax(0,calc(30*var(--u)));gap:calc(2*var(--u));align-items:center;justify-content:start;min-height:calc(4.2*var(--u));padding:calc(.55*var(--u)) calc(.6*var(--u));border-bottom:1px solid rgba(255,255,255,.05);transition:background .15s}
.fx-row:hover,.fx-row:focus-within{background:linear-gradient(90deg,rgba(255,255,255,.055),transparent 85%)}
.fx-row .lb b{display:block;font:700 calc(1.32*var(--u))/1.1 var(--disp);letter-spacing:.07em;text-transform:uppercase;color:#eef3fa}
.fx-row .lb small{display:block;margin-top:calc(.22*var(--u));font:500 calc(.98*var(--u))/1.25 var(--body);color:#9db0c9}
.fx-row .ct{min-width:0;display:flex;align-items:center;gap:calc(1*var(--u));justify-content:flex-start}
.fx-row.wide{grid-template-columns:minmax(calc(12*var(--u)),calc(17*var(--u))) minmax(0,1fr)}
.fx-row.tall{align-items:flex-start}
.fx-val{flex:0 0 calc(4.6*var(--u));text-align:left;font:700 calc(1.35*var(--u)) var(--disp);letter-spacing:.04em;font-variant-numeric:tabular-nums;color:#fff}
.fx-val small{font-size:.7em;color:var(--dim);margin-left:calc(.15*var(--u))}
.fx-sl{position:relative;flex:1;min-width:calc(11*var(--u));max-width:calc(22*var(--u));height:calc(2.2*var(--u));display:flex;align-items:center}
.fx-sl input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:calc(2*var(--u));margin:0;background:transparent;cursor:pointer;--p:50%}
.fx-sl input[type=range]::-webkit-slider-runnable-track{height:calc(.36*var(--u));border-radius:calc(.2*var(--u));background:linear-gradient(90deg,var(--acc2) var(--p),rgba(255,255,255,.13) var(--p))}
.fx-sl input[type=range]::-moz-range-track{height:calc(.36*var(--u));border-radius:calc(.2*var(--u));background:rgba(255,255,255,.13)}
.fx-sl input[type=range]::-moz-range-progress{height:calc(.36*var(--u));border-radius:calc(.2*var(--u));background:var(--acc2)}
.fx-sl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:calc(.9*var(--u));height:calc(1.4*var(--u));margin-top:calc(-.52*var(--u));border-radius:2px;background:#fff;border:0;box-shadow:0 0 0 2px rgba(0,0,0,.4),0 calc(.2*var(--u)) calc(.6*var(--u)) rgba(0,0,0,.5);transition:transform .12s var(--ease),background .12s}
.fx-sl input[type=range]::-moz-range-thumb{width:calc(.9*var(--u));height:calc(1.4*var(--u));border-radius:2px;background:#fff;border:0;box-shadow:0 0 0 2px rgba(0,0,0,.4)}
.fx-sl input[type=range]:hover::-webkit-slider-thumb{transform:scaleY(1.12);background:var(--acc2)}
.fx-sl input[type=range]:active::-webkit-slider-thumb{transform:scale(1.15);background:var(--acc2)}
.fx-sl input[type=range]:focus-visible{outline:none;box-shadow:none}
.fx-sl input[type=range]:focus-visible::-webkit-slider-thumb{outline:2px solid var(--acc);outline-offset:2px;background:var(--acc2)}
.fx-sl .tick.def{background:var(--acc);height:calc(.5*var(--u));width:2px;top:calc(1.35*var(--u))}
.fx-sl .tick{position:absolute;top:calc(1.42*var(--u));width:1px;height:calc(.3*var(--u));background:rgba(255,255,255,.25);pointer-events:none}
.fx-tg{position:relative;width:calc(3.6*var(--u));height:calc(1.8*var(--u));flex:0 0 auto;border-radius:calc(1*var(--u));border:1px solid var(--line2);background:rgba(255,255,255,.06);transition:all .2s var(--ease)}
.fx-tg::after{content:"";position:absolute;left:calc(.18*var(--u));top:calc(.18*var(--u));width:calc(1.3*var(--u));height:calc(1.3*var(--u));border-radius:50%;background:#9aa6ba;transition:all .22s var(--ease)}
.fx-tg.on{background:rgba(var(--tide-rgb),.28);border-color:var(--tide)}
.fx-tg.on::after{left:calc(1.98*var(--u));background:#fff;box-shadow:0 0 calc(.9*var(--u)) var(--tide)}
.fx-tg:hover{border-color:#fff}
.fx-tg .t{position:absolute;right:calc(100% + calc(.7*var(--u)));top:50%;translate:0 -50%;font:700 calc(.84*var(--u)) var(--disp);letter-spacing:.14em;color:var(--mute)}
.fx-num{width:calc(6.2*var(--u));height:calc(2.2*var(--u));padding:0 calc(.6*var(--u));text-align:right;font:700 calc(1.1*var(--u)) var(--disp);font-variant-numeric:tabular-nums;letter-spacing:.04em;border:1px solid var(--line2);border-radius:2px;background:rgba(0,0,0,.35);color:#fff;transition:border-color .15s}
.fx-num:hover{border-color:rgba(255,255,255,.4)}.fx-num:focus{border-color:var(--acc);outline:none}
.fx-txt{width:100%;height:calc(2.4*var(--u));padding:0 calc(.8*var(--u));font:600 calc(1*var(--u)) var(--body);border:1px solid var(--line2);border-radius:2px;background:rgba(0,0,0,.35);color:#fff;letter-spacing:.02em}
.fx-txt:focus{border-color:var(--acc);outline:none}
.fx-pill{display:inline-flex;gap:calc(.3*var(--u))}
.fx-pill>button{height:calc(2.3*var(--u));padding:0 calc(1*var(--u));border:1px solid var(--line);border-radius:2px;background:rgba(255,255,255,.04);font:700 calc(.96*var(--u)) var(--disp);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);transition:all .15s var(--ease)}
.fx-pill>button:hover{color:#fff;border-color:var(--line2)}
.fx-pill>button.on{color:#fff;background:rgba(var(--tide-rgb),.2);border-color:var(--tide);box-shadow:inset 0 -2px 0 var(--tide)}
.fx-pill>button:active{transform:scale(.96)}
.fx-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:calc(.7*var(--u));width:100%}
.fx-qc{position:relative;padding:calc(.85*var(--u)) calc(.9*var(--u)) calc(.8*var(--u));border:1px solid var(--line);border-radius:2px;background:rgba(255,255,255,.035);transition:all .18s var(--ease);text-align:left}
.fx-qc b{display:block;font:800 calc(1.2*var(--u)) var(--disp);letter-spacing:.12em;text-transform:uppercase;color:#dfe7f3}
.fx-qc small{display:block;margin-top:calc(.25*var(--u));font:500 calc(.8*var(--u))/1.25 var(--body);color:var(--mute)}
.fx-qc .bars{display:flex;gap:2px;margin-bottom:calc(.5*var(--u))}.fx-qc .bars i{width:calc(.7*var(--u));height:calc(.28*var(--u));background:rgba(255,255,255,.14);border-radius:1px}.fx-qc .bars i.f{background:var(--tide)}
.fx-qc:hover{border-color:var(--line2);background:rgba(255,255,255,.07);transform:translateY(-2px)}
.fx-qc.on{border-color:var(--tide);background:linear-gradient(180deg,rgba(var(--tide-rgb),.18),rgba(var(--tide-rgb),.04));box-shadow:0 0 calc(1.4*var(--u)) rgba(var(--tide-rgb),.12)}
.fx-qc.on b{color:#fff}
.fx-note{padding:calc(.7*var(--u)) calc(.9*var(--u));margin-top:calc(.5*var(--u));border-left:2px solid var(--acc);background:rgba(var(--acc-rgb),.07);font:500 calc(.9*var(--u))/1.4 var(--body);color:var(--dim)}
.fx-ro{display:flex;gap:calc(.8*var(--u));flex-wrap:wrap;margin-top:calc(.5*var(--u))}
.fx-ro>div{padding:calc(.45*var(--u)) calc(.8*var(--u));border:1px solid var(--line);border-radius:2px;background:rgba(0,0,0,.25);min-width:calc(5.6*var(--u))}
.fx-ro small{display:block;font:700 calc(.68*var(--u)) var(--disp);letter-spacing:.2em;color:var(--mute);text-transform:uppercase}
.fx-ro b{font:800 calc(1.5*var(--u))/1.1 var(--disp);letter-spacing:.04em;font-variant-numeric:tabular-nums}
.fx-ro b i{font:600 calc(.8*var(--u)) var(--disp);font-style:normal;color:var(--dim);margin-left:calc(.2*var(--u))}

/* keybinds */
.fx-keys{display:grid;grid-template-columns:1fr 1fr;gap:0 calc(3*var(--u))}
.fx-kb{display:flex;align-items:center;gap:calc(.7*var(--u));height:calc(3.05*var(--u));border-bottom:1px solid rgba(255,255,255,.045)}
.fx-kb .an{flex:1;font:700 calc(1.08*var(--u)) var(--disp);letter-spacing:.08em;text-transform:uppercase;color:#cfd8e6}
.fx-kc{position:relative;min-width:calc(5.6*var(--u));height:calc(2.2*var(--u));padding:0 calc(.8*var(--u));display:grid;place-items:center;border:1px solid var(--line2);border-bottom-width:2px;border-radius:3px;background:rgba(255,255,255,.06);font:700 calc(.98*var(--u)) var(--disp);letter-spacing:.08em;text-transform:uppercase;color:#fff;transition:all .14s var(--ease);white-space:nowrap}
.fx-kc.empty{color:var(--mute);border-style:dashed;background:transparent}
.fx-kc:hover{border-color:var(--acc);background:rgba(var(--acc-rgb),.14)}
.fx-kc.lock{opacity:.5;pointer-events:none}
.fx-kc.cap{border-color:var(--acc);background:rgba(var(--acc-rgb),.25);color:#fff;animation:fxPulse 1s ease-in-out infinite}
.fx-kc.dup{animation:fxShake .35s;border-color:var(--bad)}
@keyframes fxPulse{50%{box-shadow:0 0 calc(1.2*var(--u)) rgba(var(--acc-rgb),.7)}}
@keyframes fxShake{20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}

/* crosshair designer */
.fx-xh{display:flex;flex-direction:column;gap:calc(1.2*var(--u))}
.fx-xh-prev{position:relative;top:0;z-index:4;display:grid;grid-template-columns:minmax(calc(13*var(--u)),calc(19*var(--u))) minmax(0,1fr);gap:calc(1.6*var(--u));align-items:start;margin:calc(-1.4*var(--u)) calc(-2.2*var(--u)) 0;padding:calc(1.4*var(--u)) calc(2.2*var(--u)) calc(1*var(--u));background:linear-gradient(180deg,rgba(11,14,21,.97) 82%,rgba(11,14,21,0))}
.fx-xh-prev .side{min-width:0}
.fx-xh-prev .fx-lab{margin-top:calc(.9*var(--u))}
.fx-xh-prev .fx-code{margin-top:calc(.5*var(--u))}
.fx-xh-view{position:relative;width:100%;aspect-ratio:16/9;border:1px solid var(--line2);border-radius:3px;overflow:hidden;background:#222}
.fx-xh-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.fx-xh-view .cap{position:absolute;left:calc(.7*var(--u));top:calc(.6*var(--u));font:700 calc(.74*var(--u)) var(--disp);letter-spacing:.2em;color:rgba(255,255,255,.75);text-shadow:0 1px 3px rgba(0,0,0,.8);text-transform:uppercase}
.fx-xh-bg{display:flex;gap:calc(.4*var(--u));margin-top:calc(.5*var(--u));flex-wrap:wrap}
.fx-code{display:flex;gap:calc(.5*var(--u));margin-top:calc(.9*var(--u))}
.fx-code input{flex:1;height:calc(2.4*var(--u));padding:0 calc(.8*var(--u));font:600 calc(.98*var(--u)) 'SFMono-Regular',Consolas,'Liberation Mono',monospace;letter-spacing:.06em;border:1px solid var(--line2);border-radius:2px;background:rgba(0,0,0,.4);color:#cfe;min-width:0}
.fx-code input:focus{border-color:var(--acc);outline:none}
.fx-sw{display:flex;gap:calc(.4*var(--u));flex-wrap:wrap;justify-content:flex-end}
.fx-sw button{width:calc(1.7*var(--u));height:calc(1.7*var(--u));border-radius:2px;border:2px solid rgba(255,255,255,.15);background:var(--c);transition:transform .12s var(--ease),border-color .12s}
.fx-sw button:hover{transform:scale(1.15)}
.fx-sw button.on{border-color:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.6),0 0 calc(.8*var(--u)) var(--c)}
.fx-hue{-webkit-appearance:none;appearance:none;flex:1;min-width:calc(7*var(--u));width:100%;height:calc(.7*var(--u));border-radius:calc(.4*var(--u));background:linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);cursor:pointer;margin:0}
.fx-hue::-webkit-slider-thumb{-webkit-appearance:none;width:calc(.9*var(--u));height:calc(1.3*var(--u));border-radius:2px;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.55)}
.fx-hue::-moz-range-thumb{width:calc(.9*var(--u));height:calc(1.3*var(--u));border-radius:2px;background:#fff;border:0}
.fx-vmprev{position:relative;width:100%;aspect-ratio:16/9;border:1px solid var(--line2);border-radius:3px;overflow:hidden;background:linear-gradient(180deg,#3a5a7a,#b9a27c 58%,#7d6a4c)}
.fx-vmprev svg{position:absolute;inset:0;width:100%;height:100%}

/* ---------- help / credits ---------- */
.fx-help{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:calc(1.4*var(--u)) calc(2.2*var(--u))}
.fx-help .g h4{margin:0 0 calc(.5*var(--u));font:800 calc(.96*var(--u)) var(--disp);letter-spacing:.26em;color:var(--acc);text-transform:uppercase;display:flex;gap:calc(.7*var(--u));align-items:center}
.fx-help .g h4::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}
.fx-help .r{display:flex;align-items:center;justify-content:space-between;gap:calc(1*var(--u));height:calc(2.15*var(--u));border-bottom:1px solid rgba(255,255,255,.04);font:700 calc(1.02*var(--u)) var(--disp);letter-spacing:.08em;text-transform:uppercase;color:#c7d1e0}
.fx-help .r .fx-key{font-size:calc(.98*var(--u))}
.fx-rules-box{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:calc(.9*var(--u));margin-top:calc(.6*var(--u))}
.fx-rb{padding:calc(1*var(--u)) calc(1.1*var(--u));border:1px solid var(--line);background:rgba(255,255,255,.035);border-radius:2px}
.fx-rb .no{font:800 calc(.8*var(--u)) var(--disp);letter-spacing:.22em;color:var(--acc)}
.fx-rb b{display:block;margin:calc(.2*var(--u)) 0 calc(.35*var(--u));font:800 calc(1.3*var(--u)) var(--disp);letter-spacing:.08em;text-transform:uppercase}
.fx-rb p{margin:0;font:500 calc(.9*var(--u))/1.4 var(--body);color:var(--dim)}
.fx-cred{max-width:calc(44*var(--u));margin:0 auto;text-align:center;padding-top:calc(1*var(--u))}
.fx-cred h3{margin:calc(2*var(--u)) 0 calc(.5*var(--u));font:800 calc(.9*var(--u)) var(--disp);letter-spacing:.34em;color:var(--acc);text-transform:uppercase}
.fx-cred p{margin:calc(.2*var(--u)) 0;font:600 calc(1.5*var(--u)) var(--disp);letter-spacing:.08em;text-transform:uppercase;color:#dfe7f3}
.fx-cred small{display:block;margin-top:calc(.3*var(--u));font:500 calc(.92*var(--u))/1.5 var(--body);color:var(--mute);letter-spacing:.02em}

/* ---------- pause / end / overlays ---------- */
.fx-pause .fx-pbox{position:absolute;left:50%;top:50%;translate:-50% -50%;width:calc(29*var(--u));padding:calc(1.9*var(--u)) calc(1.9*var(--u)) calc(1.7*var(--u))}
.fx-pause .ttl{font:800 calc(2.6*var(--u))/1 var(--disp);letter-spacing:.18em;text-transform:uppercase;text-align:center;margin-bottom:calc(.25*var(--u))}
.fx-pause .sub{text-align:center;font:600 calc(.9*var(--u)) var(--disp);letter-spacing:.3em;text-transform:uppercase;color:var(--dim);margin-bottom:calc(1.6*var(--u))}
.fx-pause .list{display:flex;flex-direction:column;gap:calc(.5*var(--u))}
.fx-pb{display:flex;align-items:center;justify-content:space-between;height:calc(3.3*var(--u));padding:0 calc(1.2*var(--u));border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:2px;font:700 calc(1.35*var(--u)) var(--disp);letter-spacing:.14em;text-transform:uppercase;color:#d5deec;transition:all .15s var(--ease)}
.fx-pb:hover,.fx-pb:focus-visible{color:#fff;border-color:rgba(var(--acc-rgb),.7);background:linear-gradient(90deg,rgba(var(--acc-rgb),.22),rgba(255,255,255,.04));transform:translateX(3px)}
.fx-pb.pri{background:linear-gradient(180deg,#ff8f4d,#f2661c);border-color:transparent;color:#fff;height:calc(3.7*var(--u));font-size:calc(1.55*var(--u));box-shadow:0 calc(.4*var(--u)) calc(1.3*var(--u)) rgba(var(--ember-rgb),.3)}
.fx-pb.pri:hover{filter:brightness(1.1);transform:translateX(3px)}
.fx-pb.danger:hover,.fx-pb.danger:focus-visible{border-color:var(--bad);background:rgba(255,93,108,.18)}
.fx-pb .fx-key{font-size:.62em}
.fx-quick{margin-top:calc(1.1*var(--u));padding-top:calc(.9*var(--u));border-top:1px solid var(--line)}
.fx-quick .qr{display:flex;align-items:center;gap:calc(.8*var(--u));height:calc(2.2*var(--u));font:700 calc(.86*var(--u)) var(--disp);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.fx-quick .qr>span{flex:0 0 calc(8*var(--u))}.fx-quick .fx-sl{max-width:none}.fx-quick .fx-val{flex:0 0 calc(3.4*var(--u));font-size:calc(1.05*var(--u))}
.fx-pause .foot{margin-top:calc(1.2*var(--u));text-align:center;font:600 calc(.82*var(--u)) var(--disp);letter-spacing:.16em;color:var(--mute);text-transform:uppercase}
.fx-pause .lost{margin:calc(-.6*var(--u)) 0 calc(1.2*var(--u));text-align:center;font:500 calc(.92*var(--u)) var(--body);color:var(--dim)}
.fx-confirm{position:absolute;inset:0;display:grid;place-items:center;background:rgba(3,5,10,.7);backdrop-filter:blur(3px);z-index:5}
.fx-confirm .fx-card{width:calc(24*var(--u));padding:calc(1.6*var(--u));text-align:center}
.fx-confirm h4{margin:0 0 calc(.4*var(--u));font:800 calc(1.6*var(--u)) var(--disp);letter-spacing:.14em;text-transform:uppercase}
.fx-confirm p{margin:0 0 calc(1.2*var(--u));color:var(--dim);font-size:calc(.95*var(--u))}
.fx-confirm .b{display:flex;gap:calc(.6*var(--u));justify-content:center}

.fx-end .fx-etop{position:absolute;left:0;right:0;top:calc(1.4*var(--u));text-align:center}
.fx-end .res{font:800 calc(4.2*var(--u))/.95 var(--disp);letter-spacing:.12em;font-style:italic;text-transform:uppercase;text-shadow:0 calc(.4*var(--u)) calc(3*var(--u)) rgba(var(--acc-rgb),.5);background:linear-gradient(180deg,#fff 30%,rgb(var(--acc-rgb)) 130%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.15em}
.fx-end .sc{display:inline-flex;align-items:center;gap:calc(1.6*var(--u));margin-top:calc(.3*var(--u));font:800 calc(2.4*var(--u))/1 var(--disp);letter-spacing:.06em}
.fx-end .sc i{font-style:normal;color:var(--mute);font-size:calc(1.3*var(--u));letter-spacing:.2em}
.fx-end .sc .e{color:var(--ember)}.fx-end .sc .t{color:var(--tide)}
.fx-end .reason{margin-top:calc(.4*var(--u));font:700 calc(1*var(--u)) var(--disp);letter-spacing:.32em;color:var(--dim);text-transform:uppercase}
.fx-end .fx-ebody{gap:calc(.9*var(--u))!important;position:absolute;left:50%;top:calc(10.6*var(--u));translate:-50% 0;width:min(calc(76*var(--u)),92vw);display:grid;grid-template-columns:1fr 1fr;gap:calc(1.2*var(--u))}
.fx-tb{padding:0;overflow:hidden}
.fx-tb .th{display:flex;align-items:center;gap:calc(.8*var(--u));height:calc(2.4*var(--u));padding:0 calc(1.1*var(--u));font:800 calc(1.15*var(--u)) var(--disp);letter-spacing:.2em;text-transform:uppercase;border-bottom:1px solid var(--line);background:linear-gradient(90deg,rgba(var(--c),.3),transparent 70%)}
.fx-tb .th i{margin-left:auto;font:800 calc(1.5*var(--u)) var(--disp);font-style:normal}
.fx-tb .th s{width:calc(.8*var(--u));height:calc(.8*var(--u));transform:rotate(45deg);background:rgb(var(--c));box-shadow:0 0 calc(.8*var(--u)) rgb(var(--c))}
.fx-tb table{width:100%;border-collapse:collapse}
.fx-tb td,.fx-tb th.c{padding:0 calc(.8*var(--u));height:calc(1.85*var(--u));font:700 calc(1*var(--u)) var(--disp);letter-spacing:.06em;text-align:right;font-variant-numeric:tabular-nums;color:#cbd5e4;border-bottom:1px solid rgba(255,255,255,.04)}
.fx-tb th.c{height:calc(1.6*var(--u));font-size:calc(.72*var(--u));letter-spacing:.2em;color:var(--mute);font-weight:700;text-transform:uppercase}
.fx-tb td:first-child,.fx-tb th.c:first-child{text-align:left;padding-left:calc(1.1*var(--u));width:52%}
.fx-tb tr.me td{background:rgba(255,255,255,.07);color:#fff}
.fx-tb tr.mvp td{background:linear-gradient(90deg,rgba(255,210,90,.22),rgba(255,210,90,.05));color:#fff}
.fx-tb .star{display:inline-block;margin-right:calc(.5*var(--u));color:#ffd25a;filter:drop-shadow(0 0 calc(.4*var(--u)) #ffb700)}
.fx-awards{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:calc(.8*var(--u))}
.fx-aw{display:flex;align-items:center;gap:calc(.8*var(--u));padding:calc(.55*var(--u)) calc(.9*var(--u));border:1px solid var(--line);border-left:3px solid rgb(var(--c));border-radius:2px;background:linear-gradient(90deg,rgba(var(--c),.16),rgba(10,13,20,.7) 70%);backdrop-filter:blur(10px)}
.fx-aw.hot{border-color:rgba(255,210,90,.5);border-left-color:#ffd25a;background:linear-gradient(90deg,rgba(255,210,90,.2),rgba(10,13,20,.7) 70%)}
.fx-aw .ic{flex:0 0 calc(2.4*var(--u))}.fx-aw .ic svg{width:calc(2.4*var(--u));height:calc(2.4*var(--u));fill:none;stroke:rgb(var(--c));stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.fx-aw.hot .ic svg{filter:drop-shadow(0 0 calc(.7*var(--u)) rgba(255,190,40,.7))}
.fx-aw small{display:block;font:800 calc(.72*var(--u)) var(--disp);letter-spacing:.24em;color:var(--dim);text-transform:uppercase}.fx-aw.hot small{color:#ffd25a}
.fx-aw b{display:block;font:800 calc(1.45*var(--u))/1.05 var(--disp);letter-spacing:.08em;text-transform:uppercase}
.fx-aw em{font:600 calc(.95*var(--u)) var(--body);font-style:normal;color:#aebbd0}
.fx-tl{grid-column:1/-1;padding:calc(.7*var(--u)) calc(1.2*var(--u)) calc(.8*var(--u))}
.fx-tl .fx-h{font-size:calc(.9*var(--u))}.fx-tl .lg{margin-left:auto;display:flex;align-items:center;gap:calc(.5*var(--u));font:700 calc(.78*var(--u)) var(--disp);letter-spacing:.14em;color:var(--dim)}.fx-tl .lg i{width:calc(.7*var(--u));height:calc(.7*var(--u));transform:rotate(45deg);background:rgb(var(--c))}.fx-tl .lg em{font-style:normal;color:var(--mute);margin-left:calc(.6*var(--u))}
.fx-tl .ch svg{display:block;width:100%;height:calc(4*var(--u))}
.fx-hist{display:flex;gap:calc(.25*var(--u));flex-wrap:wrap;margin-top:calc(.5*var(--u))}
.fx-hist i{flex:1;max-width:calc(2*var(--u));height:calc(1.4*var(--u));border-radius:2px;display:grid;place-items:center;font:800 calc(.72*var(--u)) var(--disp);font-style:normal;color:#0a0d14;background:rgb(var(--c))}
.fx-end .fx-eact{position:absolute;left:50%;bottom:calc(1.1*var(--u));translate:-50% 0;display:flex;gap:calc(.9*var(--u))}
.fx-end .fx-eact .fx-go{width:calc(17*var(--u));margin:0;height:calc(3.4*var(--u));font-size:calc(1.5*var(--u))}
.fx-end .fx-eact .fx-btn{height:calc(3.4*var(--u));padding:0 calc(1.8*var(--u));font-size:calc(1.1*var(--u))}

.fx-tut{position:absolute;left:calc(1.8*var(--u));top:calc(50% - calc(2*var(--u)));width:calc(23*var(--u));padding:calc(1.05*var(--u)) calc(1.2*var(--u)) calc(1*var(--u));pointer-events:none}
.fx-tut .hd{display:flex;align-items:center;gap:calc(.7*var(--u));font:800 calc(.78*var(--u)) var(--disp);letter-spacing:.26em;text-transform:uppercase;color:var(--acc)}
.fx-tut .hd .st{margin-left:auto;display:flex;gap:calc(.25*var(--u))}.fx-tut .hd .st i{width:calc(1.3*var(--u));height:3px;background:rgba(255,255,255,.16);transition:background .3s}.fx-tut .hd .st i.d{background:var(--acc)}.fx-tut .hd .st i.c{background:#fff}
.fx-tut h4{margin:calc(.5*var(--u)) 0 calc(.25*var(--u));font:800 calc(1.55*var(--u))/1 var(--disp);letter-spacing:.08em;text-transform:uppercase}
.fx-tut p{margin:0;font:500 calc(.95*var(--u))/1.4 var(--body);color:var(--dim)}
.fx-tut .keys{display:flex;gap:calc(.4*var(--u));align-items:center;flex-wrap:wrap;margin:calc(.7*var(--u)) 0 calc(.2*var(--u));font:600 calc(.84*var(--u)) var(--disp);letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
.fx-tut .keys .fx-key{font-size:calc(1.02*var(--u))}
.fx-tut .bar{height:4px;margin-top:calc(.8*var(--u));background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}
.fx-tut .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ember),var(--tide));transition:width .25s linear}
.fx-tut .ft{display:flex;justify-content:space-between;margin-top:calc(.55*var(--u));font:600 calc(.76*var(--u)) var(--disp);letter-spacing:.16em;color:var(--mute);text-transform:uppercase}
.fx-tut .ft button{pointer-events:auto;color:var(--dim);padding:calc(.2*var(--u)) calc(.3*var(--u));transition:color .15s}.fx-tut .ft button:hover{color:#fff}
.fx-tut.done{border-color:var(--ok)}
.fx-tut.ok h4::after{content:"  \\2713";color:var(--ok)}
.fx-tut{animation:fxPop .4s var(--ease) both}

.fx-toast{position:absolute;left:50%;bottom:calc(5.6*var(--u));translate:-50% 0;padding:calc(.7*var(--u)) calc(1.3*var(--u));border:1px solid var(--line2);background:rgba(10,13,20,.9);backdrop-filter:blur(8px);border-radius:2px;font:700 calc(1*var(--u)) var(--disp);letter-spacing:.14em;text-transform:uppercase;pointer-events:none;opacity:0;transform:translateY(8px);transition:all .3s var(--ease)}
.fx-toast.on{opacity:1;transform:none}
.fx-fps{position:absolute;right:calc(1*var(--u));top:calc(.7*var(--u));padding:calc(.25*var(--u)) calc(.6*var(--u));font:700 calc(.92*var(--u)) var(--disp);letter-spacing:.1em;color:#cfe;background:rgba(0,0,0,.45);border-radius:2px;font-variant-numeric:tabular-nums;pointer-events:none}
.fx-wipe{position:absolute;inset:0;background:#04060b;opacity:0;pointer-events:none;transition:opacity .55s ease;z-index:20;display:grid;place-items:center}
.fx-wipe.on{opacity:1;pointer-events:auto;transition-duration:.12s}
.fx-wipe .msg{font:800 calc(1.2*var(--u)) var(--disp);letter-spacing:.42em;color:var(--dim);text-transform:uppercase;display:flex;flex-direction:column;align-items:center;gap:calc(1.1*var(--u))}
.fx-wipe .bar{width:calc(16*var(--u));height:3px;background:rgba(255,255,255,.1);overflow:hidden}.fx-wipe .bar i{display:block;height:100%;width:40%;background:linear-gradient(90deg,var(--ember),var(--tide));animation:fxInd 1s ease-in-out infinite}
@keyframes fxInd{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}

/* ---------- boot ---------- */
.fx-boot{background:radial-gradient(90% 80% at 50% 45%,#0c1626 0%,#04060b 70%);opacity:1;visibility:visible;pointer-events:auto;transition:opacity .7s var(--ease),visibility 0s .7s;z-index:30}
.fx-boot.out{opacity:0;visibility:hidden;pointer-events:none}
.fx-boot .stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.fx-boot .lg{width:min(calc(46*var(--u)),70vw);animation:fxBootLogo 1.1s var(--ease) both}
.fx-boot .lg svg{width:100%;height:auto;overflow:visible}
@keyframes fxBootLogo{from{opacity:0;transform:scale(.94) translateY(8px);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}
.fx-boot .glow{position:absolute;left:50%;top:50%;width:calc(60*var(--u));height:calc(26*var(--u));translate:-50% -60%;background:radial-gradient(closest-side,rgba(var(--ember-rgb),.16),transparent),radial-gradient(closest-side at 30% 60%,rgba(var(--tide-rgb),.12),transparent);filter:blur(20px);animation:fxBreath 4s ease-in-out infinite}
@keyframes fxBreath{50%{opacity:.6;transform:scale(1.06)}}
.fx-boot .pb{position:absolute;left:50%;bottom:9vh;translate:-50% 0;width:min(calc(34*var(--u)),60vw)}
.fx-boot .pb .trk{position:relative;height:4px;background:rgba(255,255,255,.1);overflow:hidden;border-radius:2px}
.fx-boot .pb .fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,var(--ember),#ffb070 55%,var(--tide));box-shadow:0 0 calc(1*var(--u)) rgba(var(--ember-rgb),.7);transition:width .35s var(--ease)}
.fx-boot .pb .inf{display:flex;justify-content:space-between;margin-top:calc(.8*var(--u));font:700 calc(.84*var(--u)) var(--disp);letter-spacing:.24em;color:var(--dim);text-transform:uppercase;font-variant-numeric:tabular-nums}
.fx-boot .pb .inf b{color:var(--txt)}
.fx-boot .press{position:absolute;left:0;right:0;bottom:4.2vh;text-align:center;font:700 calc(.95*var(--u)) var(--disp);letter-spacing:.4em;color:var(--dim);text-transform:uppercase;opacity:0;transition:opacity .5s}
.fx-boot .press.on{opacity:1;animation:fxBlink 1.6s ease-in-out infinite}
@keyframes fxBlink{50%{opacity:.35}}

.fx-gallery-tag{position:absolute;left:calc(1*var(--u));bottom:calc(1*var(--u));padding:calc(.3*var(--u)) calc(.7*var(--u));font:700 calc(.8*var(--u)) var(--disp);letter-spacing:.2em;color:#0a0d14;background:#ffd25a;border-radius:2px;z-index:40;text-transform:uppercase}

@media (max-height:640px){.fx-tag{margin-bottom:calc(1.1*var(--u))}.fx-mi{height:calc(3*var(--u))}.fx-mi.pri{height:calc(3.5*var(--u))}}
@media (max-aspect-ratio:4/3){.fx-main .col-l{left:calc(2.4*var(--u))}.fx-setup{right:calc(2*var(--u));width:calc(26*var(--u))}}
@media (prefers-reduced-motion:reduce){.fx *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
html.fx-test .fx *,html.fx-test .fx *::before,html.fx-test .fx *::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}
.fx-vm2{display:grid;grid-template-columns:minmax(0,1fr) minmax(calc(14*var(--u)),calc(22*var(--u)));gap:calc(2*var(--u));align-items:start}
@media (min-height:860px){.fx-xh-prev{position:sticky;top:calc(-1.4*var(--u))}}
@media (max-width:1100px){.fx-vm2{grid-template-columns:1fr}.fx-xh-prev{grid-template-columns:1fr}}
`;
