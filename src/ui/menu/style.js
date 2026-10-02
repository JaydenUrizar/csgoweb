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
  font:500 1rem/1.3 var(--body);color:var(--txt);font-size:clamp(11px,min(1.02vw,1.85vh),40px);
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
.fx-top{position:absolute;left:0;right:0;top:0;height:4rem;display:flex;align-items:center;gap:1rem;padding:0 2.6rem;pointer-events:none}
.fx-top>*{pointer-events:auto}
.fx-brand{display:flex;align-items:center;gap:.7rem;font:800 1.15rem/1 var(--disp);letter-spacing:.24em;text-transform:uppercase;opacity:.9}
.fx-brand svg{width:1.7rem;height:1.7rem}
.fx-spacer{flex:1}
.fx-chip{display:flex;align-items:center;gap:.6rem;height:2.4rem;padding:0 1rem;border:1px solid var(--line);background:rgba(10,13,20,.55);backdrop-filter:blur(10px);border-radius:2px;font:600 .95rem var(--disp);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);transition:all .15s}
.fx-chip b{color:var(--txt);font-weight:700}
button.fx-chip:hover{border-color:var(--line2);color:var(--txt);background:rgba(20,26,38,.7)}
.fx-ico{width:2.4rem;height:2.4rem;display:grid;place-items:center;border:1px solid var(--line);background:rgba(10,13,20,.55);backdrop-filter:blur(10px);border-radius:2px;color:var(--dim);transition:all .15s var(--ease)}
.fx-ico svg{width:1.2rem;height:1.2rem;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.fx-ico:hover{color:#fff;border-color:rgba(var(--acc-rgb),.6);background:rgba(var(--acc-rgb),.16);transform:translateY(-1px)}
.fx-avatar{width:1.5rem;height:1.5rem;border-radius:50%;background:conic-gradient(from 200deg,var(--ember),var(--tide),var(--ember));box-shadow:0 0 0 1px rgba(255,255,255,.3) inset}
.fx-foot{position:absolute;left:0;right:0;bottom:0;height:3.4rem;display:flex;align-items:center;gap:1.6rem;padding:0 2.6rem;font:600 .86rem var(--disp);letter-spacing:.14em;text-transform:uppercase;color:var(--mute);pointer-events:none}
.fx-foot .tip{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62%;color:var(--dim);letter-spacing:.06em;font:500 .95rem var(--body);text-transform:none;transition:opacity .4s}
.fx-foot .tip b{color:var(--acc);font:700 .82rem var(--disp);letter-spacing:.16em;margin-right:.6rem}
.fx-hint{display:inline-flex;align-items:center;gap:.5rem}
.fx-key{display:inline-grid;place-items:center;min-width:1.7em;height:1.7em;padding:0 .45em;border:1px solid var(--line2);border-bottom-width:2px;border-radius:3px;background:rgba(255,255,255,.06);font:700 .82em/1 var(--disp);letter-spacing:.06em;color:var(--txt);text-transform:uppercase;white-space:nowrap}

/* ---------- main menu ---------- */
.fx-main .col-l{position:absolute;left:4.4rem;top:5.2rem;bottom:4.4rem;width:22rem;display:flex;flex-direction:column}
.fx-logo{width:21rem;max-width:100%;filter:drop-shadow(0 .4rem 1.2rem rgba(0,0,0,.6))}
.fx-logo svg{width:100%;height:auto;overflow:visible}
.fx-tag{margin:.3rem 0 1.5rem .2rem;font:700 .98rem var(--disp);letter-spacing:.42em;text-transform:uppercase;color:var(--dim);display:flex;align-items:center;gap:.8rem}
.fx-tag i{flex:0 0 2.4rem;height:2px;background:linear-gradient(90deg,var(--ember),var(--tide))}
.fx-menu{display:flex;flex-direction:column;gap:.3rem;margin:0;padding:0;list-style:none}
.fx-mi{position:relative;display:flex;align-items:center;gap:1rem;width:100%;height:3.1rem;padding:0 1.2rem 0 1.4rem;color:#c5cfdf;overflow:hidden;
  font:700 1.6rem/1 var(--disp);letter-spacing:.07em;text-transform:uppercase;transition:color .18s,background .25s var(--ease),transform .25s var(--ease),letter-spacing .25s var(--ease)}
.fx-mi::before{content:"";position:absolute;left:0;top:.35rem;bottom:.35rem;width:3px;background:var(--acc);transform:scaleY(0);transition:transform .25s var(--ease);box-shadow:0 0 .9rem var(--acc)}
.fx-mi::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(var(--acc-rgb),.28),rgba(var(--acc-rgb),.06) 60%,transparent);opacity:0;transform:translateX(-30%);transition:all .35s var(--ease);z-index:-1}
.fx-mi .n{font:600 .82rem var(--disp);letter-spacing:.14em;color:var(--mute);width:1.5rem;transition:color .2s}
.fx-mi .sub{display:none}
.fx-mi .sub{margin-left:auto;font:500 .88rem var(--body);letter-spacing:.02em;text-transform:none;color:var(--mute);transition:color .2s,transform .3s var(--ease)}
.fx-mi:hover,.fx-mi.foc,.fx-mi:focus-visible{color:#fff;transform:translateX(.5rem);letter-spacing:.09em;outline:none;box-shadow:none}
.fx-mi:hover::before,.fx-mi:focus-visible::before{transform:scaleY(1)}
.fx-mi:hover::after,.fx-mi:focus-visible::after{opacity:1;transform:none}
.fx-mi:hover .n,.fx-mi:focus-visible .n{color:var(--acc)}
.fx-mi:hover .sub,.fx-mi:focus-visible .sub{color:var(--dim);transform:translateX(-.3rem)}
.fx-mi:active{transform:translateX(.35rem) scale(.985);transition-duration:.06s}
.fx-mi.pri{color:#fff;background:linear-gradient(90deg,rgba(var(--ember-rgb),.95),rgba(255,150,70,.78) 70%,rgba(255,150,70,.15));height:3.8rem;font-size:1.95rem;margin-bottom:.4rem;
  clip-path:polygon(0 0,100% 0,calc(100% - 1.1rem) 100%,0 100%);text-shadow:0 1px 0 rgba(0,0,0,.25)}
.fx-mi.pri::before{display:none}.fx-mi.pri::after{display:none}
.fx-mi.pri .n{color:rgba(255,255,255,.75)}
.fx-mi.pri .sub{color:rgba(255,255,255,.8);margin-right:1.2rem}
.fx-mi.pri:hover,.fx-mi.pri:focus-visible{filter:brightness(1.12) saturate(1.1);transform:translateX(.5rem)}
.fx-mi.pri .shine{position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.4) 50%,transparent 65%);transform:translateX(-120%);transition:none}
.fx-mi.pri:hover .shine,.fx-mi.pri:focus-visible .shine{transform:translateX(120%);transition:transform .75s var(--ease)}
.fx-ver{margin-top:auto;font:600 .8rem var(--disp);letter-spacing:.2em;color:var(--mute);text-transform:uppercase}

.fx-card{position:relative;background:linear-gradient(180deg,rgba(18,23,33,.78),rgba(9,12,18,.86));border:1px solid var(--line);border-radius:3px;backdrop-filter:blur(16px) saturate(1.2);box-shadow:0 1.6rem 4rem rgba(0,0,0,.5),0 0 0 1px rgba(0,0,0,.4)}
.fx-card::before,.fx-card::after{content:"";position:absolute;width:1.1rem;height:1.1rem;pointer-events:none;border:2px solid var(--acc);opacity:.9}
.fx-card::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
.fx-card::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.fx-setup{position:absolute;right:4.4rem;top:50%;translate:0 -50%;width:27rem;padding:1.4rem 1.5rem 1.5rem}
.fx-h{display:flex;align-items:baseline;gap:.8rem;font:800 1.02rem var(--disp);letter-spacing:.26em;text-transform:uppercase;color:var(--dim);margin-bottom:1.15rem}
.fx-h::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}
.fx-h b{color:var(--acc)}
.fx-lab{display:flex;justify-content:space-between;align-items:baseline;margin:1.05rem 0 .5rem;font:700 .82rem var(--disp);letter-spacing:.2em;text-transform:uppercase;color:var(--mute)}
.fx-lab em{font:500 .88rem var(--body);font-style:normal;letter-spacing:.02em;text-transform:none;color:var(--dim)}
.fx-seg{display:flex;gap:.3rem}
.fx-seg>button{position:relative;flex:1;height:3rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.15rem;border:1px solid var(--line);background:rgba(255,255,255,.035);border-radius:2px;
  font:700 1.08rem/1 var(--disp);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);transition:all .16s var(--ease);overflow:hidden}
.fx-seg>button small{font:600 .68rem var(--disp);letter-spacing:.14em;color:var(--mute);transition:color .16s}
.fx-seg>button:hover{color:#fff;border-color:var(--line2);background:rgba(255,255,255,.07);transform:translateY(-1px)}
.fx-seg>button.on{color:#fff;border-color:rgba(var(--c,var(--acc-rgb)),.85);background:linear-gradient(180deg,rgba(var(--c,var(--acc-rgb)),.3),rgba(var(--c,var(--acc-rgb)),.1));box-shadow:0 0 1.2rem rgba(var(--c,var(--acc-rgb)),.22) inset,0 .2rem 1rem rgba(var(--c,var(--acc-rgb)),.12)}
.fx-seg>button.on small{color:rgba(255,255,255,.7)}
.fx-seg>button.on::after{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:rgb(var(--c,var(--acc-rgb)))}
.fx-seg>button:active{transform:scale(.97);transition-duration:.05s}
.fx-seg>button .dots{display:flex;gap:2px}.fx-seg>button .dots i{width:.5rem;height:3px;background:rgba(255,255,255,.18);border-radius:1px}.fx-seg>button .dots i.f{background:rgb(var(--c,var(--acc-rgb)))}
.fx-seg.side>button{flex-direction:row;gap:.6rem}
.fx-seg.side .sw{width:.85rem;height:.85rem;transform:rotate(45deg);background:rgb(var(--c));box-shadow:0 0 .7rem rgba(var(--c),.8)}
.fx-seg.side .sw.rnd{background:linear-gradient(90deg,var(--ember) 50%,var(--tide) 50%)}
.fx-map{display:flex;gap:.9rem;align-items:center;padding:.6rem;border:1px solid rgba(var(--acc-rgb),.55);background:linear-gradient(90deg,rgba(var(--acc-rgb),.14),rgba(255,255,255,.03));border-radius:2px}
.fx-map .th{flex:0 0 6.2rem;height:3.6rem;border-radius:2px;overflow:hidden;position:relative;border:1px solid var(--line2)}
.fx-map .th svg{width:100%;height:100%}
.fx-map .nm{font:800 1.3rem/1 var(--disp);letter-spacing:.1em;text-transform:uppercase}
.fx-map .ds{font:500 .84rem var(--body);color:var(--dim);margin-top:.25rem}
.fx-map .ok{margin-left:auto;width:1.3rem;height:1.3rem;border-radius:50%;background:var(--acc);display:grid;place-items:center}
.fx-map .ok svg{width:.8rem;height:.8rem;stroke:#0a0d14;stroke-width:3;fill:none}
.fx-go{position:relative;display:flex;align-items:center;justify-content:center;gap:1rem;width:100%;height:4.3rem;margin-top:1.5rem;overflow:hidden;
  background:linear-gradient(180deg,#ff8f4d,#f2661c);color:#fff;font:800 2.1rem/1 var(--disp);letter-spacing:.16em;text-transform:uppercase;border-radius:2px;
  box-shadow:0 .5rem 1.6rem rgba(var(--ember-rgb),.32),inset 0 1px 0 rgba(255,255,255,.4);transition:transform .2s var(--ease),box-shadow .2s,filter .2s}
.fx-go::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,transparent 0 .7rem,rgba(255,255,255,.05) .7rem 1.4rem)}
.fx-go .shine{position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transform:translateX(-120%)}
.fx-go:hover,.fx-go:focus-visible{transform:translateY(-2px);filter:brightness(1.08);box-shadow:0 .8rem 2.4rem rgba(var(--ember-rgb),.5),inset 0 1px 0 rgba(255,255,255,.5)}
.fx-go:hover .shine,.fx-go:focus-visible .shine{transform:translateX(120%);transition:transform .8s var(--ease)}
.fx-go:active{transform:translateY(1px) scale(.99);filter:brightness(.95);transition-duration:.05s}
.fx-go .fx-key{background:rgba(0,0,0,.25);border-color:rgba(255,255,255,.3);font-size:.62em}
.fx-go2{display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:.6rem;height:2.6rem;padding:0 1rem;border:1px solid var(--line);background:rgba(255,255,255,.035);border-radius:2px;font:700 1rem var(--disp);letter-spacing:.16em;text-transform:uppercase;color:var(--dim);transition:all .16s var(--ease)}
.fx-go2 small{font:500 .84rem var(--body);letter-spacing:.02em;text-transform:none;color:var(--mute)}
.fx-go2:hover{color:#fff;border-color:var(--line2);background:rgba(255,255,255,.08)}
.fx-rules{margin-top:1rem;display:flex;gap:.5rem 1.2rem;flex-wrap:wrap;font:500 .84rem var(--body);color:var(--mute)}
.fx-rules b{color:var(--dim);font-weight:600}

/* ---------- sheet (settings / help / credits / locker fallback) ---------- */
.fx-dim{background:rgba(2,4,9,.55);backdrop-filter:blur(5px)}
.fx-end .fx-enddim{background:radial-gradient(90% 70% at 50% 25%,rgba(var(--acc-rgb),.14),rgba(2,4,9,.93) 80%);backdrop-filter:blur(8px)}
.fx-sheet{position:absolute;left:50%;top:50%;translate:-50% -50%;width:min(88rem,94vw);height:min(53rem,88vh);display:flex;flex-direction:column;overflow:hidden;padding:0}
.fx-sheet::before,.fx-sheet::after{z-index:3}
.fx-sh-head{display:flex;align-items:center;gap:1.2rem;height:4.4rem;padding:0 1.6rem 0 2rem;border-bottom:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.04),transparent)}
.fx-sh-head h2{margin:0;font:800 2rem/1 var(--disp);letter-spacing:.14em;text-transform:uppercase}
.fx-sh-head h2 i{font-style:normal;color:var(--acc)}
.fx-x{width:2.6rem;height:2.6rem;display:grid;place-items:center;border:1px solid var(--line);border-radius:2px;color:var(--dim);transition:all .15s var(--ease)}
.fx-x:hover{color:#fff;background:rgba(255,255,255,.1);border-color:var(--line2);transform:rotate(90deg)}
.fx-x svg{width:1.1rem;height:1.1rem;stroke:currentColor;stroke-width:2.2;fill:none;stroke-linecap:round}
.fx-btn{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;height:2.6rem;padding:0 1.3rem;border:1px solid var(--line2);border-radius:2px;background:rgba(255,255,255,.05);font:700 1rem var(--disp);letter-spacing:.14em;text-transform:uppercase;color:#dbe4f1;transition:all .15s var(--ease);white-space:nowrap}
.fx-btn:hover{background:rgba(255,255,255,.12);color:#fff;transform:translateY(-1px)}
.fx-btn:active{transform:scale(.97);transition-duration:.05s}
.fx-btn.pri{background:linear-gradient(180deg,#ff8f4d,#f2661c);border-color:transparent;color:#fff;box-shadow:0 .3rem 1rem rgba(var(--ember-rgb),.3)}
.fx-btn.pri:hover{filter:brightness(1.1)}
.fx-btn.ghost{border-color:var(--line);background:transparent;color:var(--dim)}
.fx-btn.danger:hover{background:rgba(255,93,108,.2);border-color:var(--bad);color:#fff}
.fx-btn.sm{height:2.1rem;padding:0 .9rem;font-size:.88rem}
.fx-sh-body{flex:1;display:flex;min-height:0}
.fx-rail{flex:0 0 15.5rem;padding:1.2rem 0 1rem;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:.15rem;background:rgba(0,0,0,.18)}
.fx-tab{position:relative;display:flex;align-items:center;gap:.9rem;height:3.2rem;padding:0 1.2rem 0 1.6rem;font:700 1.2rem var(--disp);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);transition:all .16s var(--ease)}
.fx-tab svg{width:1.3rem;height:1.3rem;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;opacity:.85}
.fx-tab::before{content:"";position:absolute;left:0;top:.3rem;bottom:.3rem;width:3px;background:var(--acc);transform:scaleY(0);transition:transform .2s var(--ease)}
.fx-tab:hover{color:#fff;background:rgba(255,255,255,.05)}
.fx-tab.on{color:#fff;background:linear-gradient(90deg,rgba(var(--acc-rgb),.2),transparent)}
.fx-tab.on::before{transform:scaleY(1)}
.fx-tab.on svg{color:var(--acc);opacity:1}
.fx-rail .sp{flex:1}
.fx-pane{flex:1;min-width:0;overflow:auto;padding:1.4rem 2.2rem 2rem;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent}
.fx-pane::-webkit-scrollbar{width:.55rem}.fx-pane::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:1rem}
.fx-pane.swap>*{animation:fxInU .38s var(--ease) both;animation-delay:calc(var(--i,0)*30ms)}
.fx-sh-foot{display:flex;align-items:center;gap:1.4rem;height:3.2rem;padding:0 1.6rem 0 2rem;border-top:1px solid var(--line);font:600 .84rem var(--disp);letter-spacing:.14em;text-transform:uppercase;color:var(--mute);background:rgba(0,0,0,.22)}
.fx-grp{margin:0 0 1.9rem}
.fx-grp>h3{display:flex;align-items:center;gap:.8rem;margin:0 0 .4rem;font:800 .96rem var(--disp);letter-spacing:.28em;text-transform:uppercase;color:var(--acc)}
.fx-grp>h3::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}
.fx-row{display:flex;align-items:center;gap:1.6rem;min-height:3.5rem;padding:.4rem .3rem;border-bottom:1px solid rgba(255,255,255,.045);transition:background .15s}
.fx-row:hover{background:linear-gradient(90deg,rgba(255,255,255,.04),transparent 80%)}
.fx-row .lb{flex:0 0 17rem}
.fx-row .lb b{display:block;font:700 1.16rem/1.1 var(--disp);letter-spacing:.07em;text-transform:uppercase;color:#dfe7f3}
.fx-row .lb small{display:block;margin-top:.15rem;font:500 .84rem/1.25 var(--body);color:var(--mute)}
.fx-row .ct{flex:1;min-width:0;display:flex;align-items:center;gap:1rem;justify-content:flex-end}
.fx-row.tall{align-items:flex-start;padding-top:.7rem}
.fx-val{flex:0 0 5rem;text-align:right;font:700 1.25rem var(--disp);letter-spacing:.04em;font-variant-numeric:tabular-nums;color:#fff}
.fx-val small{font-size:.7em;color:var(--dim);margin-left:.15rem}
.fx-sl{position:relative;flex:1;max-width:26rem;height:2rem;display:flex;align-items:center}
.fx-sl input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:2rem;margin:0;background:transparent;cursor:pointer;--p:50%}
.fx-sl input[type=range]::-webkit-slider-runnable-track{height:.36rem;border-radius:.2rem;background:linear-gradient(90deg,var(--acc2) var(--p),rgba(255,255,255,.13) var(--p))}
.fx-sl input[type=range]::-moz-range-track{height:.36rem;border-radius:.2rem;background:rgba(255,255,255,.13)}
.fx-sl input[type=range]::-moz-range-progress{height:.36rem;border-radius:.2rem;background:var(--acc2)}
.fx-sl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:.9rem;height:1.4rem;margin-top:-.52rem;border-radius:2px;background:#fff;border:0;box-shadow:0 0 0 2px rgba(0,0,0,.4),0 .2rem .6rem rgba(0,0,0,.5);transition:transform .12s var(--ease),background .12s}
.fx-sl input[type=range]::-moz-range-thumb{width:.9rem;height:1.4rem;border-radius:2px;background:#fff;border:0;box-shadow:0 0 0 2px rgba(0,0,0,.4)}
.fx-sl input[type=range]:hover::-webkit-slider-thumb{transform:scaleY(1.12);background:var(--acc2)}
.fx-sl input[type=range]:active::-webkit-slider-thumb{transform:scale(1.15);background:var(--acc2)}
.fx-sl input[type=range]:focus-visible{outline:none;box-shadow:none}
.fx-sl input[type=range]:focus-visible::-webkit-slider-thumb{outline:2px solid var(--acc);outline-offset:2px;background:var(--acc2)}
.fx-sl .tick{position:absolute;top:1.42rem;width:1px;height:.3rem;background:rgba(255,255,255,.25);pointer-events:none}
.fx-tg{position:relative;width:3.6rem;height:1.8rem;flex:0 0 auto;border-radius:1rem;border:1px solid var(--line2);background:rgba(255,255,255,.06);transition:all .2s var(--ease)}
.fx-tg::after{content:"";position:absolute;left:.18rem;top:.18rem;width:1.3rem;height:1.3rem;border-radius:50%;background:#9aa6ba;transition:all .22s var(--ease)}
.fx-tg.on{background:rgba(var(--tide-rgb),.28);border-color:var(--tide)}
.fx-tg.on::after{left:1.98rem;background:#fff;box-shadow:0 0 .9rem var(--tide)}
.fx-tg:hover{border-color:#fff}
.fx-tg .t{position:absolute;right:calc(100% + .7rem);top:50%;translate:0 -50%;font:700 .84rem var(--disp);letter-spacing:.14em;color:var(--mute)}
.fx-num{width:6.2rem;height:2.2rem;padding:0 .6rem;text-align:right;font:700 1.1rem var(--disp);font-variant-numeric:tabular-nums;letter-spacing:.04em;border:1px solid var(--line2);border-radius:2px;background:rgba(0,0,0,.35);color:#fff;transition:border-color .15s}
.fx-num:hover{border-color:rgba(255,255,255,.4)}.fx-num:focus{border-color:var(--acc);outline:none}
.fx-txt{width:100%;height:2.4rem;padding:0 .8rem;font:600 1rem var(--body);border:1px solid var(--line2);border-radius:2px;background:rgba(0,0,0,.35);color:#fff;letter-spacing:.02em}
.fx-txt:focus{border-color:var(--acc);outline:none}
.fx-pill{display:inline-flex;gap:.3rem}
.fx-pill>button{height:2.3rem;padding:0 1rem;border:1px solid var(--line);border-radius:2px;background:rgba(255,255,255,.04);font:700 .96rem var(--disp);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);transition:all .15s var(--ease)}
.fx-pill>button:hover{color:#fff;border-color:var(--line2)}
.fx-pill>button.on{color:#fff;background:rgba(var(--tide-rgb),.2);border-color:var(--tide);box-shadow:inset 0 -2px 0 var(--tide)}
.fx-pill>button:active{transform:scale(.96)}
.fx-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:.7rem;width:100%}
.fx-qc{position:relative;padding:.85rem .9rem .8rem;border:1px solid var(--line);border-radius:2px;background:rgba(255,255,255,.035);transition:all .18s var(--ease);text-align:left}
.fx-qc b{display:block;font:800 1.2rem var(--disp);letter-spacing:.12em;text-transform:uppercase;color:#dfe7f3}
.fx-qc small{display:block;margin-top:.25rem;font:500 .8rem/1.25 var(--body);color:var(--mute)}
.fx-qc .bars{display:flex;gap:2px;margin-bottom:.5rem}.fx-qc .bars i{width:.7rem;height:.28rem;background:rgba(255,255,255,.14);border-radius:1px}.fx-qc .bars i.f{background:var(--tide)}
.fx-qc:hover{border-color:var(--line2);background:rgba(255,255,255,.07);transform:translateY(-2px)}
.fx-qc.on{border-color:var(--tide);background:linear-gradient(180deg,rgba(var(--tide-rgb),.18),rgba(var(--tide-rgb),.04));box-shadow:0 0 1.4rem rgba(var(--tide-rgb),.12)}
.fx-qc.on b{color:#fff}
.fx-note{padding:.7rem .9rem;margin-top:.5rem;border-left:2px solid var(--acc);background:rgba(var(--acc-rgb),.07);font:500 .9rem/1.4 var(--body);color:var(--dim)}
.fx-ro{display:flex;gap:1.6rem;flex-wrap:wrap;margin-top:.5rem}
.fx-ro>div{padding:.55rem .9rem;border:1px solid var(--line);border-radius:2px;background:rgba(0,0,0,.25);min-width:7.5rem}
.fx-ro small{display:block;font:700 .68rem var(--disp);letter-spacing:.2em;color:var(--mute);text-transform:uppercase}
.fx-ro b{font:800 1.5rem/1.1 var(--disp);letter-spacing:.04em;font-variant-numeric:tabular-nums}
.fx-ro b i{font:600 .8rem var(--disp);font-style:normal;color:var(--dim);margin-left:.2rem}

/* keybinds */
.fx-keys{display:grid;grid-template-columns:1fr 1fr;gap:0 3rem}
.fx-kb{display:flex;align-items:center;gap:.7rem;height:3.05rem;border-bottom:1px solid rgba(255,255,255,.045)}
.fx-kb .an{flex:1;font:700 1.08rem var(--disp);letter-spacing:.08em;text-transform:uppercase;color:#cfd8e6}
.fx-kc{position:relative;min-width:5.6rem;height:2.2rem;padding:0 .8rem;display:grid;place-items:center;border:1px solid var(--line2);border-bottom-width:2px;border-radius:3px;background:rgba(255,255,255,.06);font:700 .98rem var(--disp);letter-spacing:.08em;text-transform:uppercase;color:#fff;transition:all .14s var(--ease);white-space:nowrap}
.fx-kc.empty{color:var(--mute);border-style:dashed;background:transparent}
.fx-kc:hover{border-color:var(--acc);background:rgba(var(--acc-rgb),.14)}
.fx-kc.lock{opacity:.5;pointer-events:none}
.fx-kc.cap{border-color:var(--acc);background:rgba(var(--acc-rgb),.25);color:#fff;animation:fxPulse 1s ease-in-out infinite}
.fx-kc.dup{animation:fxShake .35s;border-color:var(--bad)}
@keyframes fxPulse{50%{box-shadow:0 0 1.2rem rgba(var(--acc-rgb),.7)}}
@keyframes fxShake{20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}

/* crosshair designer */
.fx-xh{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:2.2rem;align-items:start}
.fx-xh-prev{position:sticky;top:0}
.fx-xh-view{position:relative;width:100%;aspect-ratio:16/10;border:1px solid var(--line2);border-radius:3px;overflow:hidden;background:#222}
.fx-xh-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.fx-xh-view .cap{position:absolute;left:.7rem;top:.6rem;font:700 .74rem var(--disp);letter-spacing:.2em;color:rgba(255,255,255,.75);text-shadow:0 1px 3px rgba(0,0,0,.8);text-transform:uppercase}
.fx-xh-bg{display:flex;gap:.4rem;margin-top:.7rem;flex-wrap:wrap}
.fx-code{display:flex;gap:.5rem;margin-top:.9rem}
.fx-code input{flex:1;height:2.4rem;padding:0 .8rem;font:600 .98rem 'SFMono-Regular',Consolas,'Liberation Mono',monospace;letter-spacing:.06em;border:1px solid var(--line2);border-radius:2px;background:rgba(0,0,0,.4);color:#cfe;min-width:0}
.fx-code input:focus{border-color:var(--acc);outline:none}
.fx-sw{display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end}
.fx-sw button{width:1.7rem;height:1.7rem;border-radius:2px;border:2px solid rgba(255,255,255,.15);background:var(--c);transition:transform .12s var(--ease),border-color .12s}
.fx-sw button:hover{transform:scale(1.15)}
.fx-sw button.on{border-color:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.6),0 0 .8rem var(--c)}
.fx-hue{-webkit-appearance:none;appearance:none;flex:1;min-width:7rem;width:100%;height:.7rem;border-radius:.4rem;background:linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);cursor:pointer;margin:0}
.fx-hue::-webkit-slider-thumb{-webkit-appearance:none;width:.9rem;height:1.3rem;border-radius:2px;background:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.55)}
.fx-hue::-moz-range-thumb{width:.9rem;height:1.3rem;border-radius:2px;background:#fff;border:0}
.fx-vmprev{position:relative;width:100%;aspect-ratio:16/9;border:1px solid var(--line2);border-radius:3px;overflow:hidden;background:linear-gradient(180deg,#3a5a7a,#b9a27c 58%,#7d6a4c)}
.fx-vmprev svg{position:absolute;inset:0;width:100%;height:100%}

/* ---------- help / credits ---------- */
.fx-help{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.4rem 2.2rem}
.fx-help .g h4{margin:0 0 .5rem;font:800 .96rem var(--disp);letter-spacing:.26em;color:var(--acc);text-transform:uppercase;display:flex;gap:.7rem;align-items:center}
.fx-help .g h4::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}
.fx-help .r{display:flex;align-items:center;justify-content:space-between;gap:1rem;height:2.15rem;border-bottom:1px solid rgba(255,255,255,.04);font:700 1.02rem var(--disp);letter-spacing:.08em;text-transform:uppercase;color:#c7d1e0}
.fx-help .r .fx-key{font-size:.98rem}
.fx-rules-box{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:.9rem;margin-top:.6rem}
.fx-rb{padding:1rem 1.1rem;border:1px solid var(--line);background:rgba(255,255,255,.035);border-radius:2px}
.fx-rb .no{font:800 .8rem var(--disp);letter-spacing:.22em;color:var(--acc)}
.fx-rb b{display:block;margin:.2rem 0 .35rem;font:800 1.3rem var(--disp);letter-spacing:.08em;text-transform:uppercase}
.fx-rb p{margin:0;font:500 .9rem/1.4 var(--body);color:var(--dim)}
.fx-cred{max-width:44rem;margin:0 auto;text-align:center;padding-top:1rem}
.fx-cred h3{margin:2rem 0 .5rem;font:800 .9rem var(--disp);letter-spacing:.34em;color:var(--acc);text-transform:uppercase}
.fx-cred p{margin:.2rem 0;font:600 1.5rem var(--disp);letter-spacing:.08em;text-transform:uppercase;color:#dfe7f3}
.fx-cred small{display:block;margin-top:.3rem;font:500 .92rem/1.5 var(--body);color:var(--mute);letter-spacing:.02em}

/* ---------- pause / end / overlays ---------- */
.fx-pause .fx-pbox{position:absolute;left:50%;top:50%;translate:-50% -50%;width:29rem;padding:1.9rem 1.9rem 1.7rem}
.fx-pause .ttl{font:800 2.6rem/1 var(--disp);letter-spacing:.18em;text-transform:uppercase;text-align:center;margin-bottom:.25rem}
.fx-pause .sub{text-align:center;font:600 .9rem var(--disp);letter-spacing:.3em;text-transform:uppercase;color:var(--dim);margin-bottom:1.6rem}
.fx-pause .list{display:flex;flex-direction:column;gap:.5rem}
.fx-pb{display:flex;align-items:center;justify-content:space-between;height:3.3rem;padding:0 1.2rem;border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:2px;font:700 1.35rem var(--disp);letter-spacing:.14em;text-transform:uppercase;color:#d5deec;transition:all .15s var(--ease)}
.fx-pb:hover,.fx-pb:focus-visible{color:#fff;border-color:rgba(var(--acc-rgb),.7);background:linear-gradient(90deg,rgba(var(--acc-rgb),.22),rgba(255,255,255,.04));transform:translateX(3px)}
.fx-pb.pri{background:linear-gradient(180deg,#ff8f4d,#f2661c);border-color:transparent;color:#fff;height:3.7rem;font-size:1.55rem;box-shadow:0 .4rem 1.3rem rgba(var(--ember-rgb),.3)}
.fx-pb.pri:hover{filter:brightness(1.1);transform:translateX(3px)}
.fx-pb.danger:hover,.fx-pb.danger:focus-visible{border-color:var(--bad);background:rgba(255,93,108,.18)}
.fx-pb .fx-key{font-size:.62em}
.fx-quick{margin-top:1.1rem;padding-top:.9rem;border-top:1px solid var(--line)}
.fx-quick .qr{display:flex;align-items:center;gap:.8rem;height:2.2rem;font:700 .86rem var(--disp);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.fx-quick .qr>span{flex:0 0 8rem}.fx-quick .fx-sl{max-width:none}.fx-quick .fx-val{flex:0 0 3.4rem;font-size:1.05rem}
.fx-pause .foot{margin-top:1.2rem;text-align:center;font:600 .82rem var(--disp);letter-spacing:.16em;color:var(--mute);text-transform:uppercase}
.fx-pause .lost{margin:-.6rem 0 1.2rem;text-align:center;font:500 .92rem var(--body);color:var(--dim)}
.fx-confirm{position:absolute;inset:0;display:grid;place-items:center;background:rgba(3,5,10,.7);backdrop-filter:blur(3px);z-index:5}
.fx-confirm .fx-card{width:24rem;padding:1.6rem;text-align:center}
.fx-confirm h4{margin:0 0 .4rem;font:800 1.6rem var(--disp);letter-spacing:.14em;text-transform:uppercase}
.fx-confirm p{margin:0 0 1.2rem;color:var(--dim);font-size:.95rem}
.fx-confirm .b{display:flex;gap:.6rem;justify-content:center}

.fx-end .fx-etop{position:absolute;left:0;right:0;top:2.4rem;text-align:center}
.fx-end .res{font:800 5rem/.95 var(--disp);letter-spacing:.12em;font-style:italic;text-transform:uppercase;text-shadow:0 .4rem 3rem rgba(var(--acc-rgb),.5);background:linear-gradient(180deg,#fff 30%,rgb(var(--acc-rgb)) 130%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.15em}
.fx-end .sc{display:inline-flex;align-items:center;gap:1.6rem;margin-top:.3rem;font:800 2.4rem/1 var(--disp);letter-spacing:.06em}
.fx-end .sc i{font-style:normal;color:var(--mute);font-size:1.3rem;letter-spacing:.2em}
.fx-end .sc .e{color:var(--ember)}.fx-end .sc .t{color:var(--tide)}
.fx-end .reason{margin-top:.4rem;font:700 1rem var(--disp);letter-spacing:.32em;color:var(--dim);text-transform:uppercase}
.fx-end .fx-ebody{position:absolute;left:50%;top:13.2rem;translate:-50% 0;width:min(82rem,92vw);display:grid;grid-template-columns:1fr 1fr;gap:1.2rem}
.fx-tb{padding:0;overflow:hidden}
.fx-tb .th{display:flex;align-items:center;gap:.8rem;height:2.7rem;padding:0 1.1rem;font:800 1.15rem var(--disp);letter-spacing:.2em;text-transform:uppercase;border-bottom:1px solid var(--line);background:linear-gradient(90deg,rgba(var(--c),.3),transparent 70%)}
.fx-tb .th i{margin-left:auto;font:800 1.5rem var(--disp);font-style:normal}
.fx-tb .th s{width:.8rem;height:.8rem;transform:rotate(45deg);background:rgb(var(--c));box-shadow:0 0 .8rem rgb(var(--c))}
.fx-tb table{width:100%;border-collapse:collapse}
.fx-tb td,.fx-tb th.c{padding:0 .8rem;height:2.1rem;font:700 1.02rem var(--disp);letter-spacing:.06em;text-align:right;font-variant-numeric:tabular-nums;color:#cbd5e4;border-bottom:1px solid rgba(255,255,255,.04)}
.fx-tb th.c{height:1.9rem;font-size:.72rem;letter-spacing:.2em;color:var(--mute);font-weight:700;text-transform:uppercase}
.fx-tb td:first-child,.fx-tb th.c:first-child{text-align:left;padding-left:1.1rem;width:52%}
.fx-tb tr.me td{background:rgba(255,255,255,.07);color:#fff}
.fx-tb tr.mvp td{background:linear-gradient(90deg,rgba(255,210,90,.22),rgba(255,210,90,.05));color:#fff}
.fx-tb .star{display:inline-block;margin-right:.5rem;color:#ffd25a;filter:drop-shadow(0 0 .4rem #ffb700)}
.fx-mvp{grid-column:1/-1;display:flex;align-items:center;gap:1.4rem;padding:.9rem 1.4rem;border-color:rgba(255,210,90,.4)}
.fx-mvp .st{width:3.2rem;height:3.2rem;flex:0 0 auto;filter:drop-shadow(0 0 1rem rgba(255,190,40,.7))}
.fx-mvp .who small{display:block;font:800 .74rem var(--disp);letter-spacing:.3em;color:#ffd25a}
.fx-mvp .who b{font:800 2rem/1.05 var(--disp);letter-spacing:.1em;text-transform:uppercase}
.fx-mvp .who em{font:500 .95rem var(--body);color:var(--dim);font-style:normal}
.fx-hist{margin-left:auto;display:flex;gap:.25rem;flex-wrap:wrap;max-width:36rem;justify-content:flex-end}
.fx-hist i{width:1.5rem;height:1.5rem;border-radius:2px;display:grid;place-items:center;font:800 .72rem var(--disp);font-style:normal;color:#0a0d14;background:rgb(var(--c))}
.fx-end .fx-eact{position:absolute;left:50%;bottom:1.5rem;translate:-50% 0;display:flex;gap:.9rem}
.fx-end .fx-eact .fx-go{width:18rem;margin:0;height:4rem;font-size:1.7rem}
.fx-end .fx-eact .fx-btn{height:4rem;padding:0 2rem;font-size:1.2rem}

.fx-tut{position:absolute;left:1.8rem;top:calc(50% - 8rem);width:23rem;padding:1.05rem 1.2rem 1rem;pointer-events:none}
.fx-tut .hd{display:flex;align-items:center;gap:.7rem;font:800 .78rem var(--disp);letter-spacing:.26em;text-transform:uppercase;color:var(--acc)}
.fx-tut .hd .st{margin-left:auto;display:flex;gap:.25rem}.fx-tut .hd .st i{width:1.3rem;height:3px;background:rgba(255,255,255,.16);transition:background .3s}.fx-tut .hd .st i.d{background:var(--acc)}.fx-tut .hd .st i.c{background:#fff}
.fx-tut h4{margin:.5rem 0 .25rem;font:800 1.55rem/1 var(--disp);letter-spacing:.08em;text-transform:uppercase}
.fx-tut p{margin:0;font:500 .95rem/1.4 var(--body);color:var(--dim)}
.fx-tut .keys{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;margin:.7rem 0 .2rem;font:600 .84rem var(--disp);letter-spacing:.14em;color:var(--mute);text-transform:uppercase}
.fx-tut .keys .fx-key{font-size:1.02rem}
.fx-tut .bar{height:4px;margin-top:.8rem;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}
.fx-tut .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ember),var(--tide));transition:width .25s linear}
.fx-tut .ft{display:flex;justify-content:space-between;margin-top:.55rem;font:600 .76rem var(--disp);letter-spacing:.16em;color:var(--mute);text-transform:uppercase}
.fx-tut .ft button{pointer-events:auto;color:var(--dim);padding:.2rem .3rem;transition:color .15s}.fx-tut .ft button:hover{color:#fff}
.fx-tut.done{border-color:var(--ok)}
.fx-tut.ok h4::after{content:"  \\2713";color:var(--ok)}
.fx-tut{animation:fxPop .4s var(--ease) both}

.fx-toast{position:absolute;left:50%;bottom:5.6rem;translate:-50% 0;padding:.7rem 1.3rem;border:1px solid var(--line2);background:rgba(10,13,20,.9);backdrop-filter:blur(8px);border-radius:2px;font:700 1rem var(--disp);letter-spacing:.14em;text-transform:uppercase;pointer-events:none;opacity:0;transform:translateY(8px);transition:all .3s var(--ease)}
.fx-toast.on{opacity:1;transform:none}
.fx-fps{position:absolute;right:1rem;top:.7rem;padding:.25rem .6rem;font:700 .92rem var(--disp);letter-spacing:.1em;color:#cfe;background:rgba(0,0,0,.45);border-radius:2px;font-variant-numeric:tabular-nums;pointer-events:none}
.fx-wipe{position:absolute;inset:0;background:#04060b;opacity:0;pointer-events:none;transition:opacity .55s ease;z-index:20;display:grid;place-items:center}
.fx-wipe.on{opacity:1;pointer-events:auto;transition-duration:.12s}
.fx-wipe .msg{font:800 1.2rem var(--disp);letter-spacing:.42em;color:var(--dim);text-transform:uppercase;display:flex;flex-direction:column;align-items:center;gap:1.1rem}
.fx-wipe .bar{width:16rem;height:3px;background:rgba(255,255,255,.1);overflow:hidden}.fx-wipe .bar i{display:block;height:100%;width:40%;background:linear-gradient(90deg,var(--ember),var(--tide));animation:fxInd 1s ease-in-out infinite}
@keyframes fxInd{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}

/* ---------- boot ---------- */
.fx-boot{background:radial-gradient(90% 80% at 50% 45%,#0c1626 0%,#04060b 70%);opacity:1;visibility:visible;pointer-events:auto;transition:opacity .7s var(--ease),visibility 0s .7s;z-index:30}
.fx-boot.out{opacity:0;visibility:hidden;pointer-events:none}
.fx-boot .stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.fx-boot .lg{width:min(46rem,70vw);animation:fxBootLogo 1.1s var(--ease) both}
.fx-boot .lg svg{width:100%;height:auto;overflow:visible}
@keyframes fxBootLogo{from{opacity:0;transform:scale(.94) translateY(8px);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}
.fx-boot .glow{position:absolute;left:50%;top:50%;width:60rem;height:26rem;translate:-50% -60%;background:radial-gradient(closest-side,rgba(var(--ember-rgb),.16),transparent),radial-gradient(closest-side at 30% 60%,rgba(var(--tide-rgb),.12),transparent);filter:blur(20px);animation:fxBreath 4s ease-in-out infinite}
@keyframes fxBreath{50%{opacity:.6;transform:scale(1.06)}}
.fx-boot .pb{position:absolute;left:50%;bottom:9vh;translate:-50% 0;width:min(34rem,60vw)}
.fx-boot .pb .trk{position:relative;height:4px;background:rgba(255,255,255,.1);overflow:hidden;border-radius:2px}
.fx-boot .pb .fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,var(--ember),#ffb070 55%,var(--tide));box-shadow:0 0 1rem rgba(var(--ember-rgb),.7);transition:width .35s var(--ease)}
.fx-boot .pb .inf{display:flex;justify-content:space-between;margin-top:.8rem;font:700 .84rem var(--disp);letter-spacing:.24em;color:var(--dim);text-transform:uppercase;font-variant-numeric:tabular-nums}
.fx-boot .pb .inf b{color:var(--txt)}
.fx-boot .press{position:absolute;left:0;right:0;bottom:4.2vh;text-align:center;font:700 .95rem var(--disp);letter-spacing:.4em;color:var(--dim);text-transform:uppercase;opacity:0;transition:opacity .5s}
.fx-boot .press.on{opacity:1;animation:fxBlink 1.6s ease-in-out infinite}
@keyframes fxBlink{50%{opacity:.35}}

.fx-gallery-tag{position:absolute;left:1rem;bottom:1rem;padding:.3rem .7rem;font:700 .8rem var(--disp);letter-spacing:.2em;color:#0a0d14;background:#ffd25a;border-radius:2px;z-index:40;text-transform:uppercase}

@media (max-height:640px){.fx-tag{margin-bottom:1.1rem}.fx-mi{height:3rem}.fx-mi.pri{height:3.5rem}}
@media (max-aspect-ratio:4/3){.fx-main .col-l{left:2.4rem}.fx-setup{right:2rem;width:26rem}}
@media (prefers-reduced-motion:reduce){.fx *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
html.fx-test .fx *,html.fx-test .fx *::before,html.fx-test .fx *::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}
`;
