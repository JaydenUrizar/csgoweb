// Locker CSS (injected once). Visual language: CS2 inventory/loadout — condensed sans caps, dark glass, rarity bars.
export const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&display=swap';
export const CSS = /* css */`
#fx-locker{--ac:#ff7a2f;--ac2:#ffb37a;--acd:rgba(255,122,47,.16);--bg0:#0b0709;--bg1:#1a0d0d;--panel:rgba(18,20,27,.68);--line:rgba(255,255,255,.09);--txt:#e9edf5;--dim:#8d96a8;--dim2:#5f6879;
 --f-cond:"Barlow Condensed","Rajdhani","Arial Narrow","Roboto Condensed",system-ui,sans-serif;--f-body:"Barlow","Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
 --inv-h:clamp(340px,47vh,620px);position:fixed;inset:0;z-index:1000;color:var(--txt);font-family:var(--f-body);display:none;overflow:hidden;user-select:none;-webkit-user-select:none;font-size:14px;letter-spacing:.01em}
#fx-locker[data-side=tide]{--ac:#2fd0ff;--ac2:#8bebff;--acd:rgba(47,208,255,.16);--bg0:#05090f;--bg1:#0a1522}
#fx-locker.open{display:block}
#fx-locker *{box-sizing:border-box}
#fx-locker button{font-family:inherit;color:inherit;cursor:pointer;background:none;border:0;padding:0;text-align:left}
#fx-locker button:focus-visible,#fx-locker select:focus-visible,#fx-locker input:focus-visible{outline:2px solid var(--ac);outline-offset:1px}
#fx-locker .lk-bg{position:absolute;inset:0;background:linear-gradient(180deg,#0d0f15 0%,#07080c 100%);}
#fx-locker .lk-bg i{position:absolute;inset:0;opacity:0;transition:opacity .6s ease}
#fx-locker .lk-bg i.e{background:radial-gradient(120% 90% at 20% 30%,#3a1a10 0%,#1c0e0c 40%,#0a0708 80%)}
#fx-locker .lk-bg i.t{background:radial-gradient(120% 90% at 80% 30%,#0f2d40 0%,#0a1a29 40%,#05090f 80%)}
#fx-locker[data-side=ember] .lk-bg i.e,#fx-locker[data-side=tide] .lk-bg i.t{opacity:1}
#fx-locker .lk-bg::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.018) 0 2px,transparent 2px 46px);pointer-events:none}
/* top bar */
#fx-locker .lk-top{position:absolute;left:0;right:0;top:0;height:64px;display:flex;align-items:center;padding:0 22px;gap:18px;z-index:5;background:linear-gradient(180deg,rgba(6,7,10,.96),rgba(6,7,10,.7));border-bottom:1px solid var(--line);animation:lk-drop .5s cubic-bezier(.2,.8,.2,1) both}
#fx-locker .lk-back{display:flex;align-items:center;gap:8px;height:38px;padding:0 14px 0 10px;border-radius:3px;font:600 18px var(--f-cond);letter-spacing:.09em;text-transform:uppercase;color:var(--dim);transition:.15s}
#fx-locker .lk-back:hover{color:#fff;background:rgba(255,255,255,.07)}
#fx-locker .lk-back svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2.4}
#fx-locker .lk-title{font:700 28px var(--f-cond);letter-spacing:.14em;text-transform:uppercase;color:#fff;display:flex;align-items:baseline;gap:10px;white-space:nowrap}
#fx-locker .lk-title small{font:500 14px var(--f-cond);letter-spacing:.2em;color:var(--dim)}
#fx-locker .lk-tabs{flex:1;display:flex;gap:0;justify-content:safe center;overflow-x:auto;scrollbar-width:none;min-width:0}
#fx-locker .lk-tabs::-webkit-scrollbar{display:none}
#fx-locker .lk-tab{position:relative;height:44px;padding:0 11px;font:500 20px var(--f-cond);letter-spacing:.06em;text-transform:uppercase;color:#98a2b6;white-space:nowrap;transition:color .15s;display:flex;align-items:center}
#fx-locker .lk-tab:hover{color:#fff}
#fx-locker .lk-tab.on{color:#fff;text-shadow:0 0 18px var(--ac)}
#fx-locker .lk-tab.on::after{content:"";position:absolute;left:14px;right:14px;bottom:2px;height:3px;background:var(--ac);box-shadow:0 0 12px var(--ac);border-radius:2px;animation:lk-under .25s ease both}
#fx-locker .lk-tab .n{font:500 12px var(--f-cond);margin-left:6px;color:var(--dim2);letter-spacing:.06em;transform:translateY(-6px)}
#fx-locker .lk-tab .dot{width:6px;height:6px;border-radius:50%;background:var(--ac);margin-left:6px;box-shadow:0 0 8px var(--ac);transform:translateY(-8px)}
#fx-locker .lk-lvl{display:flex;align-items:center;gap:10px;height:38px;padding:0 14px;border:1px solid var(--line);border-radius:3px;background:rgba(0,0,0,.32);font:600 17px var(--f-cond);letter-spacing:.1em;white-space:nowrap}
#fx-locker .lk-lvl b{color:#ffd166;font-weight:700}
#fx-locker .lk-lvl .bar{width:70px;height:5px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden}
#fx-locker .lk-lvl .bar i{display:block;height:100%;background:linear-gradient(90deg,#ffb627,#ffe08a);box-shadow:0 0 8px #ffb627}
#fx-locker .lk-x{width:38px;height:38px;border-radius:3px;display:grid;place-items:center;color:var(--dim);transition:.15s}
#fx-locker .lk-x:hover{color:#fff;background:rgba(255,80,80,.25)}
/* stage */
#fx-locker .lk-main{position:absolute;left:0;right:0;top:60px;bottom:var(--inv-h);}
#fx-locker .lk-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none;outline:none}
#fx-locker .lk-canvas.drag{cursor:grabbing}
#fx-locker .lk-vig{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.35) 0,rgba(0,0,0,0) 22%,rgba(0,0,0,0) 78%,rgba(0,0,0,.55) 100%),linear-gradient(90deg,rgba(0,0,0,.45),transparent 22%,transparent 78%,rgba(0,0,0,.45))}
#fx-locker .lk-side{position:absolute;top:14px;bottom:76px;width:min(272px,22vw);display:flex;flex-direction:column;gap:6px;z-index:3;animation:lk-in-l .55s cubic-bezier(.2,.8,.2,1) both}
#fx-locker .lk-side.r{right:22px;animation-name:lk-in-r}
#fx-locker .lk-side.l{left:22px}
#fx-locker .lk-sideh{font:600 14px var(--f-cond);letter-spacing:.24em;color:var(--dim);text-transform:uppercase;padding:0 4px 2px;display:flex;justify-content:space-between}
#fx-locker .lk-slot{position:relative;display:flex;align-items:center;gap:12px;flex:1;min-height:0;max-height:64px;padding:5px 10px 5px 5px;background:var(--panel);border:1px solid var(--line);border-radius:3px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);transition:transform .15s,border-color .15s,background .15s}
#fx-locker .lk-slot:hover{background:rgba(34,38,50,.78);transform:translateX(2px)}
#fx-locker .lk-side.r .lk-slot:hover{transform:translateX(-2px)}
#fx-locker .lk-slot.on{border-color:var(--ac);background:linear-gradient(90deg,var(--acd),rgba(18,20,27,.7) 70%);box-shadow:0 0 0 1px var(--ac) inset,0 0 22px -6px var(--ac)}
#fx-locker .lk-slot .im{position:relative;width:78px;height:100%;min-height:36px;max-height:54px;flex:none;border-radius:2px;overflow:hidden;background:#2a2d36}
#fx-locker .lk-slot .im img{width:100%;height:100%;object-fit:cover;display:block}
#fx-locker .lk-slot .im::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--rc);box-shadow:0 0 10px var(--rc)}
#fx-locker .lk-slot .tx{min-width:0;display:flex;flex-direction:column;gap:1px}
#fx-locker .lk-slot .k{font:500 12px var(--f-cond);letter-spacing:.22em;color:var(--dim);text-transform:uppercase}
#fx-locker .lk-slot .v{font:600 19px var(--f-cond);letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f2f5fa}
#fx-locker .lk-slot .rt{font:500 12px var(--f-cond);letter-spacing:.14em;color:var(--rc);text-transform:uppercase}
/* overlays over the stage */
#fx-locker .lk-sidetog{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;gap:0;z-index:4;animation:lk-drop .55s .1s cubic-bezier(.2,.8,.2,1) both}
#fx-locker .lk-sidetog button{position:relative;height:42px;min-width:132px;padding:0 20px;text-align:center;font:700 22px var(--f-cond);letter-spacing:.16em;text-transform:uppercase;background:rgba(0,0,0,.45);border:1px solid var(--line);color:var(--dim);transition:.18s;backdrop-filter:blur(8px)}
#fx-locker .lk-sidetog button:first-child{border-radius:3px 0 0 3px}#fx-locker .lk-sidetog button:last-child{border-radius:0 3px 3px 0;margin-left:-1px}
#fx-locker .lk-sidetog button:hover{color:#fff}
#fx-locker .lk-sidetog button.on{color:#0b0d12;border-color:transparent}
#fx-locker .lk-sidetog button[data-s=ember].on{background:#ff7a2f;box-shadow:0 0 24px rgba(255,122,47,.55)}
#fx-locker .lk-sidetog button[data-s=tide].on{background:#2fd0ff;box-shadow:0 0 24px rgba(47,208,255,.55)}
#fx-locker .lk-hint{position:absolute;left:50%;top:64px;opacity:.0;transform:translateX(-50%);font:500 13px var(--f-cond);letter-spacing:.2em;color:var(--dim);text-transform:uppercase;z-index:3;white-space:nowrap;pointer-events:none;display:flex;gap:14px;align-items:center}
#fx-locker .lk-hint b{color:#cbd3e2;font-weight:600}
#fx-locker .lk-info{position:absolute;left:calc(50% + 190px);top:14px;transform:translateY(-6px);z-index:4;min-width:250px;max-width:340px;padding:9px 16px 9px;text-align:left;background:rgba(10,12,17,.78);border:1px solid var(--line);border-bottom:3px solid var(--rc,#888);border-radius:3px;backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:opacity .16s,transform .16s;box-shadow:0 12px 40px rgba(0,0,0,.5),0 0 40px -12px var(--rc,#000)}
#fx-locker .lk-info.on{opacity:1;transform:none}
#fx-locker .lk-info .n{font:700 27px var(--f-cond);letter-spacing:.06em;text-transform:uppercase;color:#fff;line-height:1}
#fx-locker .lk-info .m{margin-top:4px;font:600 14px var(--f-cond);letter-spacing:.2em;text-transform:uppercase;color:var(--rc)}
#fx-locker .lk-info .m span{color:var(--dim)}
#fx-locker .lk-info .f{margin-top:6px;font:italic 400 14px var(--f-body);color:#aab3c5}
#fx-locker .lk-ctl{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 24px);gap:6px;align-items:center;z-index:4;padding:6px;background:rgba(10,12,17,.62);border:1px solid var(--line);border-radius:4px;backdrop-filter:blur(10px);animation:lk-up .6s .15s cubic-bezier(.2,.8,.2,1) both}
#fx-locker .lk-ctl .g{display:flex;gap:2px;align-items:center}
#fx-locker .lk-ctl .g+.g{padding-left:8px;border-left:1px solid var(--line)}
#fx-locker .lk-cb{height:34px;min-width:34px;padding:0 12px;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:3px;font:600 16px var(--f-cond);letter-spacing:.12em;text-transform:uppercase;color:#b4bdd0;transition:.14s;white-space:nowrap}
#fx-locker .lk-cb:hover{background:rgba(255,255,255,.09);color:#fff}
#fx-locker .lk-cb.on{background:var(--acd);color:#fff;box-shadow:0 0 0 1px var(--ac) inset}
#fx-locker .lk-cb.pri{background:var(--ac);color:#0b0d12;box-shadow:0 0 18px -2px var(--ac)}
#fx-locker .lk-cb.pri:hover{filter:brightness(1.12)}
#fx-locker .lk-cb svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
#fx-locker .lk-wear{display:flex;flex-direction:column;gap:3px;min-width:220px;padding:0 6px}
#fx-locker .lk-wear .t{display:flex;justify-content:space-between;font:600 13px var(--f-cond);letter-spacing:.16em;color:var(--dim);text-transform:uppercase}
#fx-locker .lk-wear .t b{color:#fff;font-weight:600}
#fx-locker .lk-wear .bar{position:relative;height:12px;border-radius:2px;cursor:pointer;background:linear-gradient(90deg,#3fd97f 0 7%,#8bd53a 7% 15%,#e8c531 15% 38%,#f08a2a 38% 45%,#e0453a 45% 100%);box-shadow:0 0 0 1px rgba(0,0,0,.6) inset}
#fx-locker .lk-wear .bar i{position:absolute;top:-4px;width:4px;height:20px;background:#fff;border-radius:2px;box-shadow:0 0 8px #fff,0 0 0 1px rgba(0,0,0,.5);transform:translateX(-2px);transition:left .12s}
/* inventory */
#fx-locker .lk-inv{position:absolute;left:0;right:0;bottom:0;height:var(--inv-h,336px);z-index:4;display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(9,10,14,.82),rgba(7,8,11,.94));border-top:1px solid var(--line);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);animation:lk-up .6s cubic-bezier(.2,.8,.2,1) both}
#fx-locker .lk-inv::before{content:"";position:absolute;left:0;right:0;top:-1px;height:2px;background:linear-gradient(90deg,transparent,var(--ac),transparent);opacity:.7}
#fx-locker .lk-tool{display:flex;align-items:center;gap:10px;padding:8px 22px 6px;flex:none;min-width:0}
#fx-locker .lk-tool .lab{font:600 19px var(--f-cond);letter-spacing:.12em;text-transform:uppercase;color:#fff;white-space:nowrap;margin-right:6px}
#fx-locker .lk-tool .lab small{font:500 14px var(--f-cond);color:var(--dim);letter-spacing:.14em;margin-left:8px}
#fx-locker .lk-search{position:relative;width:230px}
#fx-locker .lk-search input{width:100%;height:34px;padding:0 10px 0 32px;border:1px solid var(--line);border-radius:3px;background:rgba(0,0,0,.35);color:#fff;font:500 15px var(--f-body);user-select:text;-webkit-user-select:text}
#fx-locker .lk-search input::placeholder{color:#6b7488}
#fx-locker .lk-search svg{position:absolute;left:9px;top:9px;width:16px;height:16px;stroke:#7d879b;fill:none;stroke-width:2.2}
#fx-locker .lk-rar{display:flex;gap:6px}
#fx-locker .lk-rar button{display:flex;align-items:center;gap:6px;height:34px;padding:0 11px;border:1px solid var(--line);border-radius:3px;background:rgba(0,0,0,.28);font:600 14px var(--f-cond);letter-spacing:.12em;text-transform:uppercase;color:#8790a3;transition:.14s}
#fx-locker .lk-rar button i{width:9px;height:9px;border-radius:50%;background:var(--c);box-shadow:0 0 8px var(--c)}
#fx-locker .lk-rar button:hover{color:#fff}
#fx-locker .lk-rar button.on{color:#fff;border-color:var(--c);background:linear-gradient(180deg,transparent,rgba(255,255,255,.05));box-shadow:0 0 14px -4px var(--c)}
#fx-locker .lk-sel{height:34px;border:1px solid var(--line);border-radius:3px;background:rgba(0,0,0,.4);color:#dfe5f2;font:500 14px var(--f-body);padding:0 8px;cursor:pointer;max-width:170px}
#fx-locker .lk-sp{flex:1}
#fx-locker .lk-count{font:500 14px var(--f-cond);letter-spacing:.16em;color:var(--dim);text-transform:uppercase}
#fx-locker .lk-gridw{flex:1;min-height:0;overflow-y:auto;padding:4px 22px 10px;scrollbar-width:thin;scrollbar-color:#3b4254 transparent}
#fx-locker .lk-gridw::-webkit-scrollbar{width:8px}#fx-locker .lk-gridw::-webkit-scrollbar-thumb{background:#343a4a;border-radius:4px}
#fx-locker .lk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(156px,1fr));gap:10px}
#fx-locker .card{position:relative;display:block;padding:0;border-radius:3px;background:linear-gradient(180deg,#2c2f38,#1b1e25);border:1px solid rgba(255,255,255,.06);overflow:hidden;transition:transform .14s,box-shadow .14s,border-color .14s,filter .14s;animation:lk-card .25s ease-out;box-shadow:0 2px 10px rgba(0,0,0,.4)}
#fx-locker .card .ic{display:block;aspect-ratio:240/150;position:relative;overflow:hidden}
#fx-locker .card .ic img{width:100%;height:100%;object-fit:cover;object-position:center 40%;display:block;transition:transform .35s cubic-bezier(.2,.8,.2,1)}
#fx-locker .card:hover .ic img{transform:scale(1.06)}
#fx-locker .card::after{content:"";position:absolute;left:0;right:0;bottom:0;height:0;pointer-events:none}
#fx-locker .card .bar{display:block;position:relative;height:3px;background:var(--rc);box-shadow:0 0 12px 1px var(--rc);z-index:2}
#fx-locker .card .txt{display:block;padding:6px 9px 7px;background:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.35));min-height:44px}
#fx-locker .card .nm{display:block;font:700 15px var(--f-body);color:#f1f4fa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.01em}
#fx-locker .card .sb{display:block;font:400 13px var(--f-body);color:#8d96a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
#fx-locker .card:hover,#fx-locker .card:focus-visible{transform:translateY(-3px);border-color:rgba(255,255,255,.28);box-shadow:0 10px 26px rgba(0,0,0,.55),0 0 26px -6px var(--rc);z-index:2;outline:none}
#fx-locker .card .glowf{position:absolute;inset:0;pointer-events:none;background:radial-gradient(90% 60% at 50% 100%,var(--rc),transparent 70%);opacity:var(--gl,.15);mix-blend-mode:screen}
#fx-locker .card.r-rare{--gl:.2}#fx-locker .card.r-epic{--gl:.3}#fx-locker .card.r-legendary{--gl:.42}
#fx-locker .card.r-epic .glowf{animation:lk-pulse 3.4s ease-in-out infinite}
#fx-locker .card.r-legendary .glowf{animation:lk-pulse 2.6s ease-in-out infinite}
#fx-locker .card.r-legendary .ic::after{content:"";position:absolute;top:0;bottom:0;width:38%;left:-60%;background:linear-gradient(105deg,transparent,rgba(255,236,170,.4),transparent);animation:lk-shine 3.6s ease-in-out infinite;animation-delay:calc(var(--i,0)*120ms)}
#fx-locker .card.eq{border-color:var(--rc);box-shadow:0 0 0 1px var(--rc) inset,0 0 22px -6px var(--rc)}
#fx-locker .card .tick{position:absolute;right:7px;top:7px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.6);border:2px solid var(--ac);display:none;place-items:center;box-shadow:0 0 12px var(--ac);z-index:3}
#fx-locker .card.eq .tick{display:grid}
#fx-locker .card .tick::after{content:"";width:7px;height:7px;border-radius:50%;background:var(--ac)}
#fx-locker .card .newb{position:absolute;left:0;top:8px;padding:1px 8px 1px 7px;font:700 12px var(--f-cond);letter-spacing:.18em;background:var(--ac);color:#0b0d12;border-radius:0 2px 2px 0;z-index:3}
#fx-locker .card .st{position:absolute;left:8px;bottom:50px;font:600 12px var(--f-cond);letter-spacing:.06em;color:#ffd166;text-shadow:0 1px 3px #000;z-index:3}
#fx-locker .card .hot{position:absolute;right:6px;bottom:50px;font:700 11px var(--f-cond);letter-spacing:.12em;color:#fff;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.2);padding:0 5px;border-radius:2px;z-index:3;text-transform:uppercase}
#fx-locker .card.flash{animation:lk-flash .55s ease}
/* sets */
#fx-locker .sets{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px}
#fx-locker .setc{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px 14px 12px;border-radius:3px;background:linear-gradient(135deg,color-mix(in srgb,var(--sc) 20%,#1d2028),#15171d 70%);border:1px solid rgba(255,255,255,.07);overflow:hidden;animation:lk-card .3s ease-out;transition:transform .15s,border-color .15s,box-shadow .15s}
#fx-locker .setc::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--sc);box-shadow:0 0 18px var(--sc)}
#fx-locker .setc:hover{transform:translateY(-2px);border-color:var(--sc);box-shadow:0 10px 26px rgba(0,0,0,.5),0 0 26px -8px var(--sc)}
#fx-locker .setc .hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
#fx-locker .setc .nm{font:700 24px var(--f-cond);letter-spacing:.08em;text-transform:uppercase;color:#fff}
#fx-locker .setc .cp{font:600 14px var(--f-cond);letter-spacing:.14em;color:var(--sc);text-transform:uppercase;white-space:nowrap}
#fx-locker .setc .bl{font:400 13.5px var(--f-body);color:#9aa3b6;line-height:1.35;min-height:36px}
#fx-locker .setc .mi{display:flex;gap:4px;flex-wrap:wrap}
#fx-locker .setc .mi img{width:54px;height:40px;border-radius:2px;border-bottom:2px solid var(--rc);object-fit:cover;filter:saturate(1.05)}
#fx-locker .setc .mi img.have{box-shadow:0 0 0 1px var(--ac)}
#fx-locker .setc .ac{display:flex;gap:8px;margin-top:2px}
#fx-locker .setc .ac .lk-cb{border:1px solid var(--line);height:32px}
#fx-locker .empty{padding:40px;text-align:center;color:var(--dim);font:500 18px var(--f-cond);letter-spacing:.14em;text-transform:uppercase}
/* footer */
#fx-locker .lk-foot{flex:none;display:flex;align-items:center;gap:12px;padding:7px 22px 9px;flex-wrap:nowrap;border-top:1px solid var(--line);background:rgba(0,0,0,.28)}
#fx-locker .lk-slots{display:flex;gap:6px;min-width:0;flex:0 1 auto}
#fx-locker .lk-ls{position:relative;min-width:84px;flex:0 1 118px;overflow:hidden;height:40px;padding:4px 12px;border:1px solid var(--line);border-radius:3px;background:rgba(0,0,0,.35);transition:.14s;display:flex;flex-direction:column;justify-content:center}
#fx-locker .lk-ls:hover{background:rgba(255,255,255,.07)}
#fx-locker .lk-ls.on{border-color:var(--ac);background:var(--acd);box-shadow:0 0 16px -6px var(--ac)}
#fx-locker .lk-ls .a{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:600 16px var(--f-cond);letter-spacing:.1em;text-transform:uppercase;color:#e9edf5;display:flex;align-items:center;gap:6px;line-height:1.1}
#fx-locker .lk-ls .a em{font-style:normal;width:6px;height:6px;border-radius:50%;background:var(--ac);box-shadow:0 0 8px var(--ac);font-size:0;flex:none}
#fx-locker .lk-ls .a input{width:86px;background:transparent;border:0;border-bottom:1px solid var(--ac);color:#fff;font:600 16px var(--f-cond);letter-spacing:.1em;text-transform:uppercase;padding:0;user-select:text}
#fx-locker .lk-ls .p{display:flex;gap:2px;margin-top:3px}
#fx-locker .lk-ls .p i{width:8px;height:3px;border-radius:1px;background:var(--rc)}
#fx-locker .lk-ls .dd{position:absolute;right:6px;top:6px;width:7px;height:7px;border-radius:50%;background:#ffb627;box-shadow:0 0 8px #ffb627;display:none}
#fx-locker .lk-ls.dirty .dd{display:block}
#fx-locker .lk-code{display:flex;align-items:center;gap:0;flex:1 1 300px;max-width:520px;min-width:230px;height:40px;border:1px solid var(--line);border-radius:3px;background:rgba(0,0,0,.4);overflow:hidden}
#fx-locker .lk-code .lb{padding:0 10px;font:600 12px var(--f-cond);letter-spacing:.22em;color:var(--dim);text-transform:uppercase;border-right:1px solid var(--line);height:100%;display:flex;align-items:center;white-space:nowrap}
#fx-locker .lk-code input{flex:1 1 auto;min-width:96px;height:100%;background:transparent;border:0;color:#dfe6f5;font:600 16px "Barlow Condensed",ui-monospace,monospace;letter-spacing:.06em;padding:0 8px;user-select:text;-webkit-user-select:text}
#fx-locker .lk-code input.bad{color:#ff6a6a;animation:lk-shake .3s}
#fx-locker .lk-code .lk-cb{height:100%;border-radius:0;border-left:1px solid var(--line);flex:none;padding:0 11px}
#fx-locker .lk-acts{display:flex;gap:8px;flex:none}
#fx-locker .lk-btn{height:40px;padding:0 20px;display:flex;align-items:center;gap:8px;border-radius:3px;font:700 19px var(--f-cond);letter-spacing:.14em;text-transform:uppercase;text-align:center;justify-content:center;border:1px solid var(--line);background:rgba(255,255,255,.05);color:#cdd5e5;transition:.14s;white-space:nowrap}
#fx-locker .lk-btn:hover{background:rgba(255,255,255,.12);color:#fff}
#fx-locker .lk-btn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
#fx-locker .lk-btn.pri{background:var(--ac);border-color:transparent;color:#0b0d12;box-shadow:0 0 24px -4px var(--ac)}
#fx-locker .lk-btn.pri:hover{filter:brightness(1.1)}
#fx-locker .lk-btn[disabled]{opacity:.45;pointer-events:none}
/* toast + modal */
#fx-locker .lk-toast{position:absolute;left:50%;top:132px;transform:translate(-50%,-10px);z-index:20;padding:9px 20px;background:rgba(10,12,17,.92);border:1px solid var(--ac);border-radius:3px;font:700 19px var(--f-cond);letter-spacing:.16em;text-transform:uppercase;color:#fff;opacity:0;pointer-events:none;transition:.22s;box-shadow:0 0 30px -6px var(--ac)}
#fx-locker .lk-toast.on{opacity:1;transform:translate(-50%,0)}
#fx-locker .lk-modal{position:absolute;inset:0;z-index:30;display:none;place-items:center;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}
#fx-locker .lk-modal.on{display:grid;animation:lk-fade .2s both}
#fx-locker .lk-modal .bx{width:min(460px,92vw);padding:24px 26px;background:#14161d;border:1px solid var(--line);border-top:3px solid var(--ac);border-radius:3px;box-shadow:0 30px 80px rgba(0,0,0,.7)}
#fx-locker .lk-modal h3{margin:0 0 6px;font:700 28px var(--f-cond);letter-spacing:.1em;text-transform:uppercase}
#fx-locker .lk-modal p{margin:0 0 18px;color:#9aa3b6;font:400 15px var(--f-body)}
#fx-locker .lk-modal .r{display:flex;gap:8px;justify-content:flex-end}
@keyframes lk-drop{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}
@keyframes lk-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
#fx-locker .lk-ctl{animation-name:lk-ctl-in}
@keyframes lk-ctl-in{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}
#fx-locker .lk-sidetog{animation-name:lk-tog-in}
@keyframes lk-tog-in{from{opacity:0;transform:translate(-50%,-14px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes lk-in-l{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@keyframes lk-in-r{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
@keyframes lk-card{from{opacity:.0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes lk-under{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes lk-pulse{0%,100%{opacity:calc(var(--gl,.2)*.7)}50%{opacity:calc(var(--gl,.2)*1.4)}}
@keyframes lk-shine{0%,55%{left:-60%}100%{left:130%}}
@keyframes lk-flash{0%{filter:brightness(2.2)}100%{filter:none}}
@keyframes lk-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
@keyframes lk-fade{from{opacity:0}to{opacity:1}}
#fx-locker .lk-tab .s{display:none}
@media (max-width:1500px){#fx-locker .lk-tab .f{display:none}#fx-locker .lk-tab .s{display:inline}#fx-locker .lk-tab{padding:0 9px;font-size:19px}#fx-locker .lk-title small{display:none}#fx-locker .lk-title{font-size:24px}#fx-locker .lk-hint{display:none}#fx-locker .lk-lvl .bar{display:none}}
@media (max-width:1320px){#fx-locker .lk-side{width:210px}#fx-locker .lk-slot .im{width:62px}#fx-locker .lk-slot .v{font-size:17px}#fx-locker .lk-btn{padding:0 13px;font-size:17px}#fx-locker .lk-btn svg+*{}#fx-locker .lk-btn .t{display:none}#fx-locker .lk-code .lb{display:none}#fx-locker .lk-lvl span:nth-child(2){display:none}#fx-locker .lk-search{width:170px}#fx-locker .lk-sel{max-width:120px}#fx-locker .lk-rar button{padding:0 7px;font-size:0}#fx-locker .lk-rar button i{margin:0}}
@media (max-width:1100px){#fx-locker .lk-side{width:64px}#fx-locker .lk-slot{padding:3px}#fx-locker .lk-slot .tx{display:none}#fx-locker .lk-slot .im{width:100%}#fx-locker .lk-code{display:none}}
@media (max-height:800px){#fx-locker{--inv-h:clamp(300px,52vh,420px)}#fx-locker .lk-grid{grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px}#fx-locker .card .txt{min-height:36px;padding:4px 8px 5px}#fx-locker .card .nm{font-size:13px}#fx-locker .card .sb{font-size:11.5px}#fx-locker .card .st,#fx-locker .card .hot{bottom:40px}#fx-locker .lk-top{height:52px}#fx-locker .lk-main{top:52px}#fx-locker .lk-slot{max-height:46px}#fx-locker .lk-slot .im{max-height:38px;min-height:30px;width:54px}#fx-locker .lk-slot .k{font-size:10.5px}#fx-locker .lk-slot .rt{display:none}#fx-locker .lk-slot .v{font-size:16px}#fx-locker .lk-side{top:8px;bottom:64px;gap:4px}#fx-locker .lk-sidetog{top:8px}#fx-locker .lk-sidetog button{height:34px;font-size:18px;min-width:110px}#fx-locker .lk-ls{height:34px}#fx-locker .lk-btn,#fx-locker .lk-code{height:34px}#fx-locker .lk-tool{padding:5px 18px 4px}#fx-locker .lk-search input,#fx-locker .lk-sel,#fx-locker .lk-rar button{height:30px}#fx-locker .lk-info{display:none}#fx-locker .lk-cb{height:30px}#fx-locker .lk-wear{min-width:170px}}
@media (prefers-reduced-motion:reduce){#fx-locker *{animation-duration:.01ms!important;animation-delay:0s!important}}
`;
