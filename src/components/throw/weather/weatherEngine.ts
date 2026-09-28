// @ts-nocheck — ported 1:1 from the W123 prototype; typed surface is the exported API below.
/**
 * Throw weather engine — one <canvas>, one requestAnimationFrame loop, every condition layered the
 * same way WeatherOverlay.tsx already decides (clouds under rain, dark clouds + heavy rain + wind +
 * lightning for 'thunderstorm', dark clouds + lightning only for 'lightning', …). Conditions
 * cross-fade over ~1.5s by easing per-layer levels toward per-condition targets, so switching in
 * Throw Settings never pops. Lightning keeps LightningController.tsx's exact sequence
 * (pre/main/secondary flash, #E8EEFF, 3–12s random interval) and its FULL/REDUCED caps.
 *
 * No images: clouds, flakes and bokeh are generated into offscreen canvases at start-up.
 */
import type { WeatherCondition, WeatherIntensity } from '../../../types/weather';

export interface WeatherEngineOptions {
  width: number;
  height: number;
  /** 0–1 of height treated as sky above the pitched map (stars, moon, shooting stars). */
  horizon?: number;
  maxDpr?: number;
}
export interface WeatherEngine {
  setWeather(condition: WeatherCondition, intensity: WeatherIntensity): void;
  setReducedFlashing(v: boolean): void;
  /** OS reduce-motion: freezes the loop after one settled frame, disables lightning. */
  setReduceMotion(v: boolean): void;
  resize(width: number, height: number): void;
  pause(): void;
  resume(): void;
  destroy(): void;
}

export function createWeatherEngine(canvas: HTMLCanvasElement, opts: WeatherEngineOptions): WeatherEngine {
const state = { condition: 'clear', intensity: 'medium', reducedFlashing: false, reduceMotion: false };
let raf = 0, alive = true;
const ctx=canvas.getContext('2d');
let W=0,H=0,HZ=0;
const DPR=Math.min(opts.maxDpr ?? 2, (typeof devicePixelRatio!=='undefined'?devicePixelRatio:1)||1);
function resize(w,h){ W=w; H=h; HZ=Math.round(h*(opts.horizon ?? 0.18)); canvas.width=Math.round(w*DPR); canvas.height=Math.round(h*DPR); canvas.style.width=w+'px'; canvas.style.height=h+'px'; ctx.setTransform(DPR,0,0,DPR,0,0); }
resize(opts.width, opts.height);
const rnd=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const persp=y=>0.45+0.75*clamp((y-HZ)/(H-HZ),0,1); // near = bigger
let now=performance.now();

const L={stars:0,clouds:0,dark:0,dim:0,rain:0,snow:0,wind:0,light:0,fog:0};
const T={...L};
let rainSpeed=1, windBase=.3;
function setTargets(c,i){
  const k={light:.42,medium:.72,heavy:1}[i];
  Object.keys(T).forEach(x=>T[x]=0);
  if(c==='clear'){T.stars=1;windBase=.15}
  if(c==='cloudy'){T.clouds=.85;T.dim=.22;T.stars=.2;windBase=.25}
  // T.rain deliberately never set — actual rain (streaks, ground splashes, lens droplets) is drawn
  // by RainOverlay (see WeatherOverlay.web.tsx's own doc comment); this engine only supplies the
  // surrounding cloud/dim/fog ambiance for rain/thunderstorm.
  if(c==='rain'){T.clouds=.8;T.dim=.3+.12*k;T.fog=k;windBase=.3}
  if(c==='thunderstorm'){T.clouds=1;T.dark=1;T.dim=.52;T.fog=1;T.wind=.35+.25*k;T.light=1;windBase=.75}
  if(c==='lightning'){T.clouds=.95;T.dark=1;T.dim=.46;T.light=1;windBase=.3}
  if(c==='wind'){T.wind=k;T.clouds=.35;T.stars=.55;windBase=.5+.5*k}
  if(c==='snow'){T.clouds=.6;T.dim=.16;T.snow=k;T.stars=.1;windBase=.2}
  rainSpeed=c==='thunderstorm'?1.35:1;
}
const gust=t=>{ const s=t/1000; return .5+.28*Math.sin(s*.53)+.14*Math.sin(s*1.37+1.3)+.08*Math.sin(s*3.1+.4); };

// sprites
function cloudMask(){ const c=document.createElement('canvas'); c.width=640;c.height=320; const g=c.getContext('2d');
  for(let i=0;i<90;i++){ const a=Math.random()*Math.PI*2, d=Math.sqrt(Math.random());
    const x=320+Math.cos(a)*d*240, y=180+Math.sin(a)*d*70-(1-d)*40, r=rnd(34,96)*(1-d*.5);
    const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,'rgba(255,255,255,.2)'); gr.addColorStop(.55,'rgba(255,255,255,.09)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,7); g.fill(); }
  return c; }
function tint(m,top,bot){ const c=document.createElement('canvas'); c.width=m.width;c.height=m.height; const g=c.getContext('2d'); g.drawImage(m,0,0); g.globalCompositeOperation='source-in';
  const lg=g.createLinearGradient(0,70,0,290); lg.addColorStop(0,top); lg.addColorStop(1,bot); g.fillStyle=lg; g.fillRect(0,0,c.width,c.height); return c; }
const SPR=[...Array(6)].map(()=>{ const m=cloudMask(); return {
  lt:tint(m,'#b4bdd3','#465170'), dk:tint(m,'#5c6480','#141824'), lit:tint(m,'#f2f5ff','#a6b6e6'), sh:tint(m,'rgba(0,0,8,1)','rgba(0,0,8,1)') }; });
function dot(r0,soft){ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); const gr=g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(r0,'rgba(255,255,255,'+(soft?.5:.95)+')'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,64,64); return c; }
const FLAKE=dot(.35,false), BOKEH=dot(.7,true);

// clouds
const clouds=[...Array(18)].map((_,i)=>{ const y=rnd(-80,H-40); return {x:rnd(-300,W+100),y,s:(.55+1.1*clamp((y+80)/H,0,1))*rnd(.8,1.2),spr:i%6,a:rnd(.55,.95),v:rnd(.6,1.4),ph:rnd(0,6)}; });
// rain
const RMAX=1100; const drops=[...Array(RMAX)].map(()=>({x:rnd(-120,W+120),y:rnd(-H,H),z:Math.pow(Math.random(),1.6)}));
const splashes=[]; const lens=[];
// snow
const SMAX=520; const flakes=[...Array(SMAX)].map(()=>({x:rnd(-40,W+40),y:rnd(-H,H),z:Math.pow(Math.random(),1.4),ph:rnd(0,6.28),f:rnd(.6,1.6)}));
// wind
const streaks=[...Array(46)].map(()=>newStreak(true));
function newStreak(init){ return {x:init?rnd(-200,W+300):rnd(-400,-60),y:rnd(HZ-60,H),len:rnd(90,280),v:rnd(420,820),amp:rnd(4,16),ph:rnd(0,6),w:rnd(.6,1.4),a:rnd(.08,.22)}; }
const LEAF_C=['#7a6f47','#5b6a3c','#8b6a3e','#4d5a36','#9a8252'];
const leaves=[...Array(34)].map(()=>newLeaf(true));
function newLeaf(init){ const y=rnd(HZ,H); return {x:init?rnd(-40,W):rnd(-120,-20),y,s:persp(y)*rnd(5,9),r:rnd(0,6.28),vr:rnd(-5,5),fl:rnd(0,6.28),vf:rnd(3,8),c:LEAF_C[(Math.random()*5)|0],v:rnd(.7,1.3),ph:rnd(0,6)}; }
const dust=[...Array(160)].map(()=>({x:rnd(0,W),y:rnd(HZ-40,H),v:rnd(.6,1.6),z:Math.random()}));
// clear
const stars=[...Array(140)].map(()=>({x:rnd(0,W),y:rnd(0,HZ+40)*Math.random()+rnd(0,20),r:Math.random()<.1?rnd(1,1.6):rnd(.35,.9),tw:rnd(.6,2.4),ph:rnd(0,6.28)}));
const motes=[...Array(34)].map(()=>({x:rnd(0,W),y:rnd(HZ,H),vx:rnd(-6,6),vy:rnd(-8,-2),ph:rnd(0,6.28),r:rnd(.8,1.8)}));
let shoot=null, nextShoot=now+rnd(2500,6000);
// lightning
const FULL={pre:.1,main:.55,sec:.22}, RED={pre:.04,main:.16,sec:.07};
let strike=null, nextStrike=now+900, F=0;
function boltPath(ax,ay,bx,by,disp,it){ let p=[[ax,ay],[bx,by]];
  for(let i=0;i<it;i++){ const n=[]; for(let j=0;j<p.length-1;j++){ const [x1,y1]=p[j],[x2,y2]=p[j+1]; n.push(p[j]); n.push([(x1+x2)/2+rnd(-1,1)*disp,(y1+y2)/2+rnd(-.25,.25)*disp]); } n.push(p[p.length-1]); p=n; disp*=.56; }
  return p; }
function makeStrike(){
  const seq=state.reducedFlashing?RED:FULL;
  const steps=[[90,seq.pre],[70,0],[70,seq.main],[90,seq.main*.35],[160,0],[70,seq.sec],[70,seq.sec*.3],[220,0]];
  const isStorm=state.condition==='thunderstorm';
  const bolt=Math.random()<(isStorm?.6:.5);
  const sx=rnd(40,W-40), gy=rnd(.46,.8)*H;
  const s={t0:now,steps,cx:sx,cy:rnd(80,H*.45),bolt:null,gx:0,gy:0};
  if(bolt){ const main=boltPath(sx,-30,sx+rnd(-90,90),gy,95,7); const br=[];
    const nb=2+(Math.random()*4|0); for(let i=0;i<nb;i++){ const idx=8+(Math.random()*(main.length*.7)|0); const [px,py]=main[Math.min(idx,main.length-1)];
      br.push(boltPath(px,py,px+rnd(-140,140),py+rnd(70,220),38,6)); }
    s.bolt={main,br}; s.gx=main[main.length-1][0]; s.gy=gy; }
  return s; }
function flashAt(s,t){ let e=t-s.t0, v=0; for(const [d,to] of s.steps){ if(e<=d) return v+(to-v)*(e/d); e-=d; v=to; } return -1; }

function strokePath(p){ ctx.beginPath(); ctx.moveTo(p[0][0],p[0][1]); for(let i=1;i<p.length;i++) ctx.lineTo(p[i][0],p[i][1]); ctx.stroke(); }

function frame(t){
  if(!alive) return;
  const dt=Math.min(.05,(t-now)/1000); now=t;
  for(const k in L) L[k]+= (T[k]-L[k])*Math.min(1,dt*(T[k]>L[k]?.9:1.2));
  const G=gust(t); const wind=clamp(windBase*(.55+.9*G),0,1.4);
  ctx.clearRect(0,0,W,H);

  // dim sky
  if(L.dim>.005){ ctx.fillStyle=`rgba(5,8,16,${L.dim})`; ctx.fillRect(0,0,W,H); }

  // ----- clear: moon, stars, shooting star, motes
  if(L.stars>.01){
    const a=L.stars;
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const mx=318,my=86;
    let g=ctx.createRadialGradient(mx,my,0,mx,my,150); g.addColorStop(0,`rgba(190,205,240,${.22*a})`); g.addColorStop(1,'rgba(190,205,240,0)'); ctx.fillStyle=g; ctx.fillRect(mx-150,my-150,300,300);
    for(const s of stars){ const tw=.55+.45*Math.sin(t/1000*s.tw+s.ph); const fade=clamp(1-(s.y-HZ+20)/80,0,1);
      ctx.globalAlpha=a*tw*fade*(s.r>1?.95:.7); ctx.drawImage(FLAKE,s.x-s.r*2,s.y-s.r*2,s.r*4,s.r*4); }
    ctx.globalAlpha=1;
    // moon disc
    ctx.globalCompositeOperation='source-over';
    g=ctx.createRadialGradient(mx-4,my-4,2,mx,my,15); g.addColorStop(0,`rgba(250,248,238,${a})`); g.addColorStop(.85,`rgba(222,220,208,${a})`); g.addColorStop(1,`rgba(200,200,190,${a*.9})`);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(mx,my,15,0,7); ctx.fill();
    ctx.fillStyle=`rgba(150,150,145,${.18*a})`; [[-4,-3,3.2],[5,2,2.4],[-1,6,1.8],[3,-6,1.4]].forEach(([dx,dy,r])=>{ctx.beginPath();ctx.arc(mx+dx,my+dy,r,0,7);ctx.fill();});
    ctx.globalCompositeOperation='lighter';
    // moonlight sheen drifting over the map
    const sx=W*.5+Math.sin(t/9000)*120, sy=H*.55+Math.cos(t/11000)*90;
    g=ctx.createRadialGradient(sx,sy,0,sx,sy,300); g.addColorStop(0,`rgba(140,165,230,${.07*a})`); g.addColorStop(1,'rgba(140,165,230,0)'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // shooting star
    if(!shoot && t>nextShoot && a>.6){ shoot={x:rnd(40,W-80),y:rnd(10,HZ-40),t0:t,vx:rnd(260,380),vy:rnd(70,120)}; }
    if(shoot){ const e=(t-shoot.t0)/1000; if(e>.9){shoot=null;nextShoot=t+rnd(5000,12000);} else {
      const px=shoot.x+shoot.vx*e, py=shoot.y+shoot.vy*e, al=Math.sin(Math.PI*e/.9)*a;
      const lg=ctx.createLinearGradient(px,py,px-shoot.vx*.28,py-shoot.vy*.28); lg.addColorStop(0,`rgba(255,255,255,${al})`); lg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.strokeStyle=lg; ctx.lineWidth=1.4; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(px-shoot.vx*.28,py-shoot.vy*.28); ctx.stroke(); } }
    // drifting motes catching moonlight
    for(const m of motes){ m.x+=(m.vx+Math.sin(t/1400+m.ph)*6)*dt; m.y+=m.vy*dt; if(m.y<HZ-20){m.y=H+10;m.x=rnd(0,W);} if(m.x<-10)m.x=W+10; if(m.x>W+10)m.x=-10;
      const tw=.5+.5*Math.sin(t/700+m.ph); ctx.globalAlpha=a*.45*tw; const r=m.r*persp(m.y)*3; ctx.drawImage(BOKEH,m.x-r,m.y-r,r*2,r*2); }
    ctx.restore();
  }

  // ----- lightning scheduling
  if(L.light>.3 && T.light>0){ if(!strike && t>nextStrike){ strike=makeStrike(); nextStrike=t+rnd(3000,12000); } }
  F=0; if(strike){ const f=flashAt(strike,t); if(f<0) strike=null; else F=f; }

  // ----- clouds + shadows
  if(L.clouds>.01){
    const cs=(6+wind*34)*(T.wind>0&&!T.light?1.6:1);
    for(const c of clouds){ c.x+=cs*c.v*c.s*dt; const w=640*c.s; if(c.x>W+40){ c.x=-w-rnd(0,200); } }
    // shadows on the ground
    ctx.save(); for(const c of clouds){ if(c.y<HZ-40) continue; const w=640*c.s,h=320*c.s*.7; ctx.globalAlpha=L.clouds*c.a*.28*(1-L.dark*.5); ctx.drawImage(SPR[c.spr].sh,c.x+26*c.s,c.y+50*c.s,w,h); } ctx.restore();
    ctx.save();
    for(const c of clouds){ const sp=SPR[c.spr], m=1+.025*Math.sin(t/4000+c.ph), w=640*c.s*m, h=320*c.s*(2-m)*.72;
      const al=L.clouds*c.a;
      if(L.dark<.99){ ctx.globalAlpha=al*(1-L.dark)*.82; ctx.drawImage(sp.lt,c.x,c.y,w,h); }
      if(L.dark>.01){ ctx.globalAlpha=al*L.dark*.95; ctx.drawImage(sp.dk,c.x,c.y,w,h); }
      if(F>.005 && strike){ const d=Math.hypot(c.x+w/2-strike.cx,c.y+h/2-strike.cy); const k=clamp(1-d/420,0,1)*.7+.3;
        ctx.globalAlpha=Math.min(1,F*1.7*k)*al; ctx.drawImage(sp.lit,c.x,c.y,w,h); } }
    ctx.restore();
  }

  // ----- in-cloud glow
  if(F>.005 && strike){ ctx.save(); ctx.globalCompositeOperation='lighter'; const r=260;
    const g=ctx.createRadialGradient(strike.cx,strike.cy,0,strike.cx,strike.cy,r); g.addColorStop(0,`rgba(205,215,255,${F*.9})`); g.addColorStop(1,'rgba(205,215,255,0)'); ctx.fillStyle=g; ctx.fillRect(strike.cx-r,strike.cy-r,r*2,r*2); ctx.restore(); }

  // ----- rain
  const lean=Math.tan((T.light&&T.rain?(12+10*G):(4+wind*10))*Math.PI/180);
  if(L.rain>.005){
    const n=Math.floor(RMAX*L.rain); ctx.save(); ctx.lineCap='round';
    const bins=[[],[],[]];
    for(let i=0;i<n;i++){ const d=drops[i]; const v=(820+d.z*1500)*rainSpeed; d.y+=v*dt; d.x+=v*dt*lean;
      if(d.y>H+40){ d.y=rnd(-160,-20); d.x=rnd(-160,W+60); }
      bins[d.z<.35?0:d.z<.75?1:2].push(d); }
    const st=[[.6,.13,10],[1,.22,20],[1.5,.34,34]];
    bins.forEach((b,bi)=>{ const [lw,al,len]=st[bi]; ctx.lineWidth=lw; ctx.strokeStyle=`rgba(${190+F*60},${205+F*50},${235+F*20},${al*Math.min(1,L.rain*1.4)+F*.4})`;
      ctx.beginPath(); for(const d of b){ const l=len*(.7+d.z*.6)*rainSpeed; ctx.moveTo(d.x,d.y); ctx.lineTo(d.x-l*lean,d.y-l); } ctx.stroke(); });
    // splashes on the ground
    let spawn=L.rain*110*dt; while(spawn>0){ if(Math.random()<spawn){ const y=rnd(HZ+30,H); splashes.push({x:rnd(0,W),y,t0:t,s:persp(y)}); } spawn-=1; }
    ctx.strokeStyle='rgba(210,222,245,1)'; ctx.fillStyle='rgba(215,226,248,1)';
    for(let i=splashes.length-1;i>=0;i--){ const p=splashes[i], e=(t-p.t0)/380; if(e>1){splashes.splice(i,1);continue;}
      const r=(2+e*9)*p.s; ctx.globalAlpha=(1-e)*.5*Math.min(1,L.rain*1.5); ctx.lineWidth=.8*p.s;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,r,r*.38,0,0,7); ctx.stroke();
      if(e<.6){ for(let k=0;k<3;k++){ const a=-Math.PI*(.2+.3*k), dd=(4+e*12)*p.s; ctx.beginPath(); ctx.arc(p.x+Math.cos(a)*dd,p.y+Math.sin(a)*dd*.9-(e*(1-e))*18*p.s,.9*p.s,0,7); ctx.fill(); } } }
    ctx.restore();
  }

  // ----- snow
  if(L.snow>.005){
    const n=Math.floor(SMAX*L.snow), sl=wind*40+14; ctx.save();
    for(let i=0;i<n;i++){ const f=flakes[i]; const v=24+f.z*78; f.y+=v*dt*f.f; f.x+=(Math.sin(t/1000*f.f+f.ph)*(10+f.z*22)+sl)*dt;
      if(f.y>H+20){ f.y=rnd(-60,-10); f.x=rnd(-60,W); } if(f.x>W+30) f.x=-30;
      if(f.z>.88){ const r=6+f.z*9; ctx.globalAlpha=.16*L.snow*1.4; ctx.drawImage(BOKEH,f.x-r,f.y-r,r*2,r*2); }
      else { const r=.8+f.z*2.8; ctx.globalAlpha=(.35+f.z*.6)*Math.min(1,L.snow*1.5); ctx.drawImage(FLAKE,f.x-r,f.y-r,r*2,r*2); } }
    ctx.restore();
    // settled snow + frosted lens
    ctx.save(); ctx.globalCompositeOperation='screen';
    let g=ctx.createLinearGradient(0,HZ,0,H); g.addColorStop(0,'rgba(200,212,238,0)'); g.addColorStop(1,`rgba(200,212,238,${.12*L.snow})`); ctx.fillStyle=g; ctx.fillRect(0,HZ,W,H-HZ);
    g=ctx.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,H*.72); g.addColorStop(0,'rgba(225,235,255,0)'); g.addColorStop(1,`rgba(225,235,255,${.22*L.snow})`); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  // ----- wind
  if(L.wind>.005){
    const a=L.wind, sp=.5+G*1.1; ctx.save(); ctx.lineCap='round';
    for(let i=0;i<Math.floor(dust.length*a);i++){ const d=dust[i]; d.x+=(180+d.z*380)*sp*d.v*dt; d.y+=Math.sin(t/600+i)*12*dt; if(d.x>W+10){d.x=-10;d.y=rnd(HZ-40,H);}
      ctx.fillStyle=`rgba(225,230,245,${(.12+d.z*.28)*a})`; const r=(.5+d.z*.9)*persp(d.y); ctx.fillRect(d.x,d.y,r*2.4,r); }
    const ns=Math.floor(streaks.length*a);
    for(let i=0;i<ns;i++){ const s=streaks[i]; s.x+=s.v*sp*dt; s.ph+=dt*2; if(s.x-s.len>W+20) streaks[i]=newStreak(false);
      const hx=s.x, tx=s.x-s.len; const lg=ctx.createLinearGradient(tx,0,hx,0); lg.addColorStop(0,'rgba(220,228,250,0)'); lg.addColorStop(.7,`rgba(220,228,250,${s.a*a*(.6+G*.6)})`); lg.addColorStop(1,'rgba(220,228,250,0)');
      ctx.strokeStyle=lg; ctx.lineWidth=s.w*persp(s.y); ctx.beginPath();
      for(let k=0;k<=12;k++){ const u=k/12, x=tx+u*s.len, y=s.y+Math.sin(s.ph+u*3.2)*s.amp*(.5+u); k?ctx.lineTo(x,y):ctx.moveTo(x,y); } ctx.stroke(); }
    const nl=Math.floor(leaves.length*a);
    for(let i=0;i<nl;i++){ const l=leaves[i]; l.x+=(160+260*sp)*l.v*dt*(l.s/7); l.y+=(Math.sin(t/500+l.ph)*40+18)*dt; l.r+=l.vr*dt*sp; l.fl+=l.vf*dt;
      if(l.x>W+40||l.y>H+30) leaves[i]=newLeaf(false);
      ctx.save(); ctx.translate(l.x,l.y); ctx.rotate(l.r); ctx.scale(1,Math.cos(l.fl)); ctx.globalAlpha=.9*Math.min(1,a*1.4);
      ctx.fillStyle=l.c; ctx.beginPath(); ctx.moveTo(-l.s,0); ctx.quadraticCurveTo(0,-l.s*.62,l.s,0); ctx.quadraticCurveTo(0,l.s*.62,-l.s,0); ctx.fill();
      ctx.strokeStyle='rgba(20,18,10,.45)'; ctx.lineWidth=.6; ctx.beginPath(); ctx.moveTo(-l.s*1.2,0); ctx.lineTo(l.s*.9,0); ctx.stroke(); ctx.restore(); }
    ctx.restore();
  }

  // ----- bolt
  if(strike && strike.bolt){ const e=t-strike.t0; if(e<560){
    const on=e<160?1:e<300?.35:e<380?.9:clamp(1-(e-380)/180,0,1); const cap=state.reducedFlashing?.35:1; const al=on*cap*(.85+Math.random()*.15);
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.lineJoin='round'; ctx.lineCap='round';
    const g=ctx.createRadialGradient(strike.gx,strike.gy,0,strike.gx,strike.gy,160); g.addColorStop(0,`rgba(190,205,255,${.35*al})`); g.addColorStop(1,'rgba(190,205,255,0)'); ctx.fillStyle=g; ctx.fillRect(strike.gx-160,strike.gy-160,320,320);
    ctx.shadowColor='rgba(150,175,255,1)'; ctx.shadowBlur=28;
    ctx.strokeStyle=`rgba(170,190,255,${.55*al})`; ctx.lineWidth=6; strokePath(strike.bolt.main);
    ctx.lineWidth=2.4; strike.bolt.br.forEach(b=>strokePath(b));
    ctx.shadowBlur=8; ctx.strokeStyle=`rgba(255,255,255,${al})`; ctx.lineWidth=1.8; strokePath(strike.bolt.main);
    ctx.lineWidth=.9; ctx.strokeStyle=`rgba(235,240,255,${al*.8})`; strike.bolt.br.forEach(b=>strokePath(b));
    ctx.restore(); } }

  // ----- flash (LightningController values, #E8EEFF)
  if(F>.002){ ctx.fillStyle=`rgba(232,238,255,${F})`; ctx.fillRect(0,0,W,H); }

  // ----- ground mist
  if(L.fog>.01){ const g=ctx.createLinearGradient(0,H*.35,0,H); g.addColorStop(0,'rgba(120,135,170,0)'); g.addColorStop(1,`rgba(120,135,170,${.16*L.fog})`); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }

  // ----- drops on the lens
  const lensTarget=Math.floor(22*L.rain);
  if(lens.length<lensTarget && Math.random()<dt*6*L.rain) lens.push({x:rnd(10,W-10),y:rnd(10,H-10),r:rnd(2.5,7.5),vy:0,t0:t,a:0,slide:Math.random()<.35,trail:[]});
  for(let i=lens.length-1;i>=0;i--){ const d=lens[i]; d.a=Math.min(1,d.a+dt*3);
    if(d.slide && d.r>4.5){ d.vy=Math.min(90,d.vy+dt*(Math.random()<.1?300:40)); d.y+=d.vy*dt; d.x+=Math.sin(d.y*.05)*.3; if(Math.random()<dt*14) d.trail.push({x:d.x,y:d.y-d.r,r:rnd(.8,1.6)}); }
    const life=(t-d.t0)/1000; const fade=(lensTarget===0||life>14)?Math.max(0,d.a-dt*1.5):d.a; d.a=fade;
    if(d.a<=0||d.y>H+20){ lens.splice(i,1); continue; }
    ctx.save(); ctx.globalAlpha=d.a;
    for(const p of d.trail){ ctx.fillStyle='rgba(220,230,250,.22)'; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); }
    let g=ctx.createRadialGradient(d.x-d.r*.25,d.y-d.r*.3,0,d.x,d.y,d.r); g.addColorStop(0,'rgba(200,215,245,.06)'); g.addColorStop(.7,'rgba(10,14,28,.14)'); g.addColorStop(1,'rgba(0,0,0,.34)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(d.x,d.y,d.r,d.r*1.08,0,0,7); ctx.fill();
    ctx.strokeStyle=`rgba(230,238,255,${.28+F})`; ctx.lineWidth=.7; ctx.beginPath(); ctx.arc(d.x,d.y,d.r*.82,Math.PI*.15,Math.PI*.85); ctx.stroke();
    ctx.fillStyle=`rgba(255,255,255,${.75+F*.25})`; ctx.beginPath(); ctx.arc(d.x-d.r*.36,d.y-d.r*.42,Math.max(.6,d.r*.16),0,7); ctx.fill();
    ctx.restore(); }

  // ----- storm vignette
  if(L.dark>.01){ const g=ctx.createRadialGradient(W/2,H*.45,H*.25,W/2,H*.45,H*.7); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,`rgba(0,0,6,${.45*L.dark*(1-F)})`); ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }

  raf=requestAnimationFrame(frame);
}

function apply(){
  setTargets(state.condition, state.intensity);
  if (state.condition==='thunderstorm'||state.condition==='lightning') nextStrike=now+900;
}
apply(); Object.assign(L,T);
raf=requestAnimationFrame(frame);

return {
  setWeather(c,i){ const changed=c!==state.condition; state.condition=c; state.intensity=i; setTargets(c,i); if(changed&&(c==='thunderstorm'||c==='lightning')) nextStrike=now+900; },
  setReducedFlashing(v){ state.reducedFlashing=v; },
  setReduceMotion(v){ state.reduceMotion=v; if(v){ T.light=0; } else setTargets(state.condition,state.intensity); },
  resize,
  pause(){ cancelAnimationFrame(raf); raf=0; },
  resume(){ if(!raf&&alive){ now=performance.now(); raf=requestAnimationFrame(frame); } },
  destroy(){ alive=false; cancelAnimationFrame(raf); raf=0; ctx.clearRect(0,0,W,H); },
};
}
