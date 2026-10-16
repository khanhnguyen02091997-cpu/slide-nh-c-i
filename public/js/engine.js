/* ===== Slide engine: shared by the studio page and every exported slideshow file ===== */
(function(G){
"use strict";
const F={play:'"Playfair Display",Georgia,serif',corm:'"Cormorant Garamond",Georgia,serif',sans:'"Be Vietnam Pro",system-ui,sans-serif',mont:'Montserrat,"Be Vietnam Pro",system-ui,sans-serif'};
const ready=document.fonts?Promise.all(['italic 500 40px "Playfair Display"','italic 400 40px "Playfair Display"','italic 500 40px "Cormorant Garamond"','italic 400 40px "Cormorant Garamond"','300 40px "Be Vietnam Pro"','400 40px "Be Vietnam Pro"','800 40px Montserrat','600 40px Montserrat'].map(f=>document.fonts.load(f,"Ắ").catch(()=>{}))).then(()=>{}):Promise.resolve();
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
const easeOut=x=>1-Math.pow(1-clamp(x),3);
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)};
const U=(W,H)=>Math.min(W,H)/1080;

function prep(img){
  const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,k=Math.min(1,2400/Math.max(w,h));
  const c=document.createElement("canvas");c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  const t=document.createElement("canvas"),tk=20/Math.max(w,h);t.width=Math.max(2,Math.round(w*tk));t.height=Math.max(2,Math.round(h*tk));
  t.getContext("2d").drawImage(c,0,0,t.width,t.height);
  const b=document.createElement("canvas");b.width=t.width*10;b.height=t.height*10;const bx=b.getContext("2d");bx.imageSmoothingQuality="high";bx.drawImage(t,0,0,b.width,b.height);
  return {c,b,ar:c.width/c.height};
}
// fx/fy on the source (0..1, set by focus()) choose which part survives the crop; px/py add Ken Burns drift.
function cover(ctx,src,x,y,w,h,z=1,px=0,py=0){
  const s=Math.max(w/src.width,h/src.height)*z,dw=src.width*s,dh=src.height*s;
  const fx=src.fx==null?.5:src.fx,fy=src.fy==null?.5:src.fy;
  const ox=clamp((w-dw)*fx+px*(dw-w)/2,w-dw,0),oy=clamp((h-dh)*fy+py*(dh-h)/2,h-dh,0);
  ctx.drawImage(src,x+ox,y+oy,dw,dh);
}
function focus(ph,fx=.5,fy=.5){ph.fx=ph.c.fx=ph.b.fx=fx;ph.fy=ph.c.fy=ph.b.fy=fy;return ph}
function fit(ar,x,y,w,h){let fw=w,fh=w/ar;if(fh>h){fh=h;fw=h*ar}return{x:x+(w-fw)/2,y:y+(h-fh)/2,w:fw,h:fh}}
function kb(p,seed,amt){const a=hash(seed+1)*6.283;return{z:1+amt*p,px:Math.cos(a)*(p-.5)*1.2,py:Math.sin(a)*(p-.5)*1.2}}
function vignette(ctx,W,H,a){const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.hypot(W,H)*.62);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,"+a+")");ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
function wrap(ctx,text,maxW){const out=[];let cur="";for(const w of text.split(/\s+/)){const t=cur?cur+" "+w:w;if(ctx.measureText(t).width>maxW&&cur){out.push(cur);cur=w}else cur=t}if(cur)out.push(cur);return out}
function spW(ctx,s,sp){const ch=[...s];return ch.reduce((a,c)=>a+ctx.measureText(c).width,0)+sp*Math.max(0,ch.length-1)}
function spaced(ctx,s,x,y,sp,align){const w=spW(ctx,s,sp);let cx=align==="left"?x:x-w/2;const ta=ctx.textAlign;ctx.textAlign="left";for(const c of s){ctx.fillText(c,cx,y);cx+=ctx.measureText(c).width+sp}ctx.textAlign=ta}
function bigLines(ctx,text,tpl,S,maxW,sp){
  const m=t=>sp?spW(ctx,t,sp*S):ctx.measureText(t).width;
  let size=S;ctx.font=tpl.replace("{s}",size);if(m(text)<=maxW)return{lines:[text],size};
  size=S*.8;ctx.font=tpl.replace("{s}",size);
  let lines=sp?[text]:wrap(ctx,text,maxW);
  for(let i=0;i<12&&lines.some(l=>m(l)>maxW);i++){size*=.9;ctx.font=tpl.replace("{s}",size);if(!sp)lines=wrap(ctx,text,maxW)}
  return{lines,size};
}
function stack(ctx,items,cy,a){
  const total=items.reduce((s,i)=>s+i.h,0);let y=cy-total/2;
  ctx.save();ctx.globalAlpha*=a;ctx.textAlign="center";ctx.textBaseline="middle";
  for(const it of items){it.f(y+it.h/2);y+=it.h}
  ctx.restore();return{top:cy-total/2,bottom:cy+total/2};
}
function gold(ctx,x0,x1,t){const sh=Math.sin(t*.5)*(x1-x0)*.25,g=ctx.createLinearGradient(x0+sh,0,x1+sh,0);[["#9c7434",0],["#f6e7c1",.3],["#d4ac63",.55],["#fbefcf",.78],["#9c7434",1]].forEach(([c,s])=>g.addColorStop(s,c));return g}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
let noise=null;
function grain(ctx,W,H,t,a){
  if(!noise){noise=document.createElement("canvas");noise.width=noise.height=256;const g=noise.getContext("2d"),d=g.createImageData(256,256);for(let i=0;i<d.data.length;i+=4){const v=Math.random()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}g.putImageData(d,0,0)}
  const f=Math.floor(t*24),u=U(W,H);ctx.save();ctx.globalAlpha=a;ctx.globalCompositeOperation="overlay";
  ctx.translate(-hash(f)*256,-hash(f+3)*256);ctx.scale(Math.max(1,u*1.5),Math.max(1,u*1.5));ctx.fillStyle=ctx.createPattern(noise,"repeat");ctx.fillRect(0,0,W+512,H+512);ctx.restore();
}
function dust(ctx,W,H,t){
  const u=U(W,H);ctx.save();ctx.fillStyle="#f6e7c1";
  for(let i=0;i<70;i++){
    const v=.012+hash(i+7)*.03,y=(((hash(i+40)-t*v)%1)+1)%1,x=hash(i)+Math.sin(t*.4+i)*.012;
    ctx.globalAlpha=(.2+.5*hash(i+5))*(.55+.45*Math.sin(t*1.7+i*2));
    ctx.beginPath();ctx.arc(x*W,y*H,(.7+hash(i+3)*1.9)*u*1.3,0,6.283);ctx.fill();
  }
  ctx.restore();
}

/* ---------- styles ---------- */
const STY={};
STY.lux={T:1.4,
  base(ctx,W,H,ph){ctx.fillStyle="#120d08";ctx.fillRect(0,0,W,H);if(ph){ctx.globalAlpha=.6;cover(ctx,ph.b,0,0,W,H,1.1);ctx.globalAlpha=1}
    ctx.fillStyle="rgba(20,13,6,.6)";ctx.fillRect(0,0,W,H);vignette(ctx,W,H,.8)},
  photo(ctx,W,H,ph,p,i,info,t){
    this.base(ctx,W,H,ph);const u=U(W,H),bot=info.cap?H*.17:H*.07,r=fit(ph.ar,W*.06,H*.07,W*.88,H-H*.07-bot);
    ctx.save();ctx.shadowColor="rgba(0,0,0,.65)";ctx.shadowBlur=60*u;ctx.fillStyle="#000";ctx.fillRect(r.x,r.y,r.w,r.h);ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();const k=kb(p,i,.1);cover(ctx,ph.c,r.x,r.y,r.w,r.h,k.z,k.px,k.py);ctx.restore();
    ctx.strokeStyle="rgba(246,231,193,.9)";ctx.lineWidth=1.5*u;ctx.strokeRect(r.x,r.y,r.w,r.h);
    ctx.strokeStyle="rgba(212,172,99,.55)";ctx.lineWidth=u;ctx.strokeRect(r.x-9*u,r.y-9*u,r.w+18*u,r.h+18*u);
    if(info.cap){const cy=H-bot/2+4*u;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font=`italic 500 ${42*u}px ${F.play}`;const w=ctx.measureText(info.names).width;ctx.fillStyle=gold(ctx,W/2-w/2,W/2+w/2,t);ctx.fillText(info.names,W/2,cy-14*u);
      ctx.font=`300 ${14*u}px ${F.sans}`;ctx.fillStyle="#d4ac63";spaced(ctx,info.date,W/2,cy+24*u,6*u)}
  },
  card(ctx,W,H,c,t,ph){
    this.base(ctx,W,H,ph);const u=U(W,H),a=clamp(t/1.4),maxW=Math.min(W*.74,1050*u),items=[];
    if(c.kicker)items.push({h:44*u,f(y){ctx.font=`300 ${16*u}px ${F.sans}`;ctx.fillStyle="#d4ac63";spaced(ctx,c.kicker.toUpperCase(),W/2,y,8*u)}});
    c.big.forEach((b,j)=>{
      if(j>0&&c.amp)items.push({h:58*u,f(y){ctx.font=`italic 400 ${46*u}px ${F.play}`;ctx.fillStyle="#d4ac63";ctx.fillText("&",W/2,y)}});
      const L=bigLines(ctx,b,`italic 500 {s}px ${F.play}`,(c.amp?118:100)*u,maxW);
      L.lines.forEach(l=>items.push({h:L.size*1.18,f(y){ctx.font=`italic 500 ${L.size}px ${F.play}`;const w=ctx.measureText(l).width;ctx.fillStyle=gold(ctx,W/2-w/2,W/2+w/2,t);ctx.fillText(l,W/2,y)}}));
    });
    items.push({h:50*u,f(y){ctx.strokeStyle="#d4ac63";ctx.lineWidth=u;ctx.beginPath();ctx.moveTo(W/2-110*u,y);ctx.lineTo(W/2-16*u,y);ctx.moveTo(W/2+16*u,y);ctx.lineTo(W/2+110*u,y);ctx.stroke();
      ctx.fillStyle="#d4ac63";ctx.beginPath();ctx.moveTo(W/2,y-6*u);ctx.lineTo(W/2+6*u,y);ctx.lineTo(W/2,y+6*u);ctx.lineTo(W/2-6*u,y);ctx.fill()}});
    if(c.sub)items.push({h:34*u,f(y){ctx.font=`300 ${16*u}px ${F.sans}`;ctx.fillStyle="#e9d3a4";spaced(ctx,c.sub,W/2,y,7*u)}});
    if(c.msg){ctx.font=`italic 400 ${28*u}px ${F.play}`;wrap(ctx,c.msg,maxW*.85).forEach((l,j)=>items.push({h:(j?40:58)*u,f(y){ctx.font=`italic 400 ${28*u}px ${F.play}`;ctx.fillStyle="rgba(246,231,193,.88)";ctx.fillText(l,W/2,y+(j?0:9*u))}}))}
    const b=stack(ctx,items,H/2,a),bw=Math.min(W*.9,maxW+150*u),bx=W/2-bw/2,by=b.top-56*u,bh=b.bottom-b.top+112*u;
    ctx.save();ctx.globalAlpha=a;ctx.strokeStyle="rgba(212,172,99,.55)";ctx.lineWidth=u;ctx.strokeRect(bx,by,bw,bh);
    ctx.strokeStyle="rgba(212,172,99,.25)";ctx.strokeRect(bx-10*u,by-10*u,bw+20*u,bh+20*u);
    ctx.strokeStyle="#d4ac63";ctx.lineWidth=2.2*u;const k=28*u,o=6*u;
    [[bx-o,by-o,1,1],[bx+bw+o,by-o,-1,1],[bx-o,by+bh+o,1,-1],[bx+bw+o,by+bh+o,-1,-1]].forEach(([x,y,sx,sy])=>{ctx.beginPath();ctx.moveTo(x+sx*k,y);ctx.lineTo(x,y);ctx.lineTo(x,y+sy*k);ctx.stroke()});
    ctx.restore();
  },
  trans(ctx,A,B,x){ctx.drawImage(A,0,0);ctx.globalAlpha=x;ctx.drawImage(B,0,0);ctx.globalAlpha=1},
  overlay(ctx,W,H,t){dust(ctx,W,H,t)}
};
STY.korea={T:1.6,
  base(ctx,W,H){const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,"#faf6f0");g.addColorStop(1,"#efe6da");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    const l=ctx.createRadialGradient(W*.92,H*.05,0,W*.92,H*.05,Math.max(W,H)*.55);l.addColorStop(0,"rgba(255,214,170,.35)");l.addColorStop(1,"rgba(255,214,170,0)");ctx.fillStyle=l;ctx.fillRect(0,0,W,H)},
  photo(ctx,W,H,ph,p,i,info){
    this.base(ctx,W,H);const u=U(W,H),bot=info.cap?H*.15:H*.07,m=14*u,r=fit(ph.ar,W*.08+m,H*.07+m,W*.84-2*m,H-H*.07-bot-2*m);
    ctx.save();ctx.shadowColor="rgba(90,65,40,.22)";ctx.shadowBlur=46*u;ctx.shadowOffsetY=14*u;ctx.fillStyle="#fffdf9";ctx.fillRect(r.x-m,r.y-m,r.w+2*m,r.h+2*m);ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();const k=kb(p,i,.05);cover(ctx,ph.c,r.x,r.y,r.w,r.h,k.z,k.px,k.py);
    ctx.fillStyle="rgba(255,240,222,.1)";ctx.fillRect(r.x,r.y,r.w,r.h);ctx.restore();
    if(info.cap){const cy=H-bot/2+6*u;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.font=`italic 500 ${40*u}px ${F.corm}`;ctx.fillStyle="#6e5b48";ctx.fillText(info.names,W/2,cy-12*u);
      ctx.font=`400 ${13*u}px ${F.sans}`;ctx.fillStyle="#a39280";spaced(ctx,info.date,W/2,cy+22*u,5*u)}
  },
  card(ctx,W,H,c,t,ph){
    this.base(ctx,W,H);const u=U(W,H),a=clamp(t/1.6),dy=(1-easeOut(t/1.6))*22*u;
    let cx=W/2,cy=H/2,maxW=Math.min(W*.8,900*u);
    if(ph){let aw,ah,ax,ay;
      if(W>H*1.15){ah=H*.7;aw=ah*.72;ax=W*.3-aw/2;ay=(H-ah)/2;cx=W*.66;maxW=W*.48}
      else{aw=W*.58;ah=Math.min(aw*1.3,H*.46);ax=W/2-aw/2;ay=H*.07;cy=ay+ah+(H-ay-ah)/2;maxW=W*.84}
      const arch=(o)=>{const x=ax-o,y=ay-o,w=aw+2*o,h=ah+2*o,r=w/2;ctx.beginPath();ctx.moveTo(x,y+h);ctx.lineTo(x,y+r);ctx.arc(x+r,y+r,r,Math.PI,0);ctx.lineTo(x+w,y+h);ctx.closePath()};
      ctx.save();ctx.globalAlpha=clamp(t/1.2);arch(0);ctx.clip();cover(ctx,ph.c,ax,ay,aw,ah,1.02+t*.004);ctx.fillStyle="rgba(255,240,222,.1)";ctx.fillRect(ax,ay,aw,ah);ctx.restore();
      ctx.save();ctx.globalAlpha=clamp(t/1.2)*.8;ctx.strokeStyle="#c9b49b";ctx.lineWidth=u;arch(12*u);ctx.stroke();ctx.restore();
    }
    const items=[],X=()=>cx;
    if(c.kicker)items.push({h:40*u,f(y){ctx.font=`400 ${14*u}px ${F.sans}`;ctx.fillStyle="#a39280";spaced(ctx,c.kicker.toUpperCase(),X(),y,6*u)}});
    c.big.forEach((b,j)=>{
      if(j>0&&c.amp)items.push({h:50*u,f(y){ctx.font=`italic 400 ${44*u}px ${F.corm}`;ctx.fillStyle="#b39b80";ctx.fillText("&",X(),y)}});
      const L=bigLines(ctx,b,`italic 500 {s}px ${F.corm}`,(c.amp?100:88)*u,maxW);
      L.lines.forEach(l=>items.push({h:L.size*1.12,f(y){ctx.font=`italic 500 ${L.size}px ${F.corm}`;ctx.fillStyle="#5a4838";ctx.fillText(l,X(),y)}}));
    });
    if(c.sub)items.push({h:52*u,f(y){ctx.font=`400 ${14*u}px ${F.sans}`;ctx.fillStyle="#8f7b66";spaced(ctx,c.sub,X(),y+6*u,6*u)}});
    if(c.msg){ctx.font=`italic 400 ${27*u}px ${F.corm}`;wrap(ctx,c.msg,maxW*.9).forEach((l,j)=>items.push({h:(j?36:52)*u,f(y){ctx.font=`italic 400 ${27*u}px ${F.corm}`;ctx.fillStyle="#7d6a57";ctx.fillText(l,X(),y+(j?0:8*u))}}))}
    stack(ctx,items,cy+dy,a);
  },
  trans(ctx,A,B,x,W,H){ctx.drawImage(A,0,0);ctx.globalAlpha=x;ctx.drawImage(B,0,(1-x)*24*U(W,H));ctx.globalAlpha=1}
};
STY.cinema={T:1.6,
  bars(W,H){return W>H?Math.max(0,(H-W/2.39)/2):H*.08},
  grade(ctx,W,H){ctx.save();ctx.globalCompositeOperation="saturation";ctx.fillStyle="rgba(128,128,128,.28)";ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation="soft-light";const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,"rgba(29,92,107,.75)");g.addColorStop(1,"rgba(217,133,59,.75)");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore()},
  frame(ctx,W,H){vignette(ctx,W,H,.85);const b=this.bars(W,H);ctx.fillStyle="#000";ctx.fillRect(0,0,W,b);ctx.fillRect(0,H-b,W,b);return b},
  photo(ctx,W,H,ph,p,i,info,t){
    ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);const u=U(W,H),k=kb(p,i,.13);cover(ctx,ph.c,0,0,W,H,1.02+(k.z-1),k.px*.6,k.py*.6);
    this.grade(ctx,W,H);const b=this.frame(ctx,W,H);
    if(info.cap){const a=clamp((t-.8)/1.2);ctx.save();ctx.globalAlpha=a*.9;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#fff";
      const y=b>40*u?H-b/2:H-60*u;ctx.font=`300 ${18*u}px ${F.sans}`;spaced(ctx,(info.names+"   ·   "+info.date).toUpperCase(),W/2,y,7*u);ctx.restore()}
  },
  card(ctx,W,H,c,t,ph){
    ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);const u=U(W,H);
    if(ph){ctx.save();ctx.globalAlpha=.3*clamp(t/2);cover(ctx,ph.c,0,0,W,H,1.04+t*.006);ctx.restore();this.grade(ctx,W,H)}
    this.frame(ctx,W,H);
    const a=clamp((t-.3)/2),sp=.16+Math.min(t,10)*.006,maxW=W*.84,items=[];
    if(c.kicker)items.push({h:56*u,f(y){ctx.font=`300 ${15*u}px ${F.sans}`;ctx.fillStyle="rgba(255,255,255,.62)";spaced(ctx,c.kicker.toUpperCase(),W/2,y,10*u)}});
    c.big.forEach((b,j)=>{
      if(j>0&&c.amp)items.push({h:52*u,f(y){ctx.font=`300 ${30*u}px ${F.sans}`;ctx.fillStyle="rgba(255,255,255,.7)";ctx.fillText("&",W/2,y)}});
      const txt=b.toUpperCase(),L=bigLines(ctx,txt,`300 {s}px ${F.sans}`,(c.amp?78:70)*u,maxW,sp);
      L.lines.forEach(l=>items.push({h:L.size*1.3,f(y){ctx.font=`300 ${L.size}px ${F.sans}`;ctx.fillStyle="#fff";spaced(ctx,l,W/2,y,L.size*sp)}}));
    });
    if(c.sub)items.push({h:60*u,f(y){ctx.font=`400 ${15*u}px ${F.sans}`;ctx.fillStyle="rgba(255,255,255,.7)";spaced(ctx,c.sub,W/2,y+8*u,8*u)}});
    if(c.msg){ctx.font=`300 ${21*u}px ${F.sans}`;wrap(ctx,c.msg,maxW*.75).forEach((l,j)=>items.push({h:(j?32:48)*u,f(y){ctx.font=`300 ${21*u}px ${F.sans}`;ctx.fillStyle="rgba(255,255,255,.66)";ctx.fillText(l,W/2,y+(j?0:8*u))}}))}
    stack(ctx,items,H/2,a);
  },
  trans(ctx,A,B,x,W,H){if(x<.5){ctx.drawImage(A,0,0);ctx.fillStyle="rgba(0,0,0,"+(x*2)+")";ctx.fillRect(0,0,W,H)}else{ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);ctx.globalAlpha=(x-.5)*2;ctx.drawImage(B,0,0);ctx.globalAlpha=1}},
  overlay(ctx,W,H,t){grain(ctx,W,H,t,.09)}
};
STY.modern={T:.8,ACC:"#ff5470",INK:"#121214",PAPER:"#f4f1ea",
  photo(ctx,W,H,ph,p,i,info,t){
    const u=U(W,H),punch=1.16-.16*easeOut(t/1.1)+.05*p;
    ctx.fillStyle=this.INK;ctx.fillRect(0,0,W,H);
    if(W>H*1.2&&ph.ar<1){
      const sx=W*.4;ctx.save();ctx.beginPath();ctx.rect(sx,0,W-sx,H);ctx.clip();cover(ctx,ph.c,sx,0,W-sx,H,punch,0,(p-.5)*.6);ctx.restore();
      ctx.fillStyle=this.ACC;ctx.fillRect(sx-8*u,0,8*u,H*easeOut(t/.9));
      const x=W*.06;ctx.textAlign="left";ctx.textBaseline="alphabetic";
      if(info.cap){const e=easeOut(t/.8),ox=-(1-e)*80*u;ctx.fillStyle=this.ACC;ctx.fillRect(x+ox,H*.4,90*u*e,10*u);
        ctx.font=`800 ${44*u}px ${F.mont}`;ctx.fillStyle=this.PAPER;const ls=wrap(ctx,info.names.toUpperCase(),sx-x-40*u);ls.forEach((l,j)=>ctx.fillText(l,x+ox,H*.5+j*52*u));
        ctx.font=`600 ${18*u}px ${F.mont}`;ctx.fillStyle="rgba(244,241,234,.6)";spaced(ctx,info.date,x+ox,H*.5+ls.length*52*u+24*u,4*u,"left")}
    }else{
      cover(ctx,ph.c,0,0,W,H,punch,(p-.5)*.5*(i%2?1:-1),0);
      const g=ctx.createLinearGradient(0,H*.55,0,H);g.addColorStop(0,"rgba(18,18,20,0)");g.addColorStop(1,"rgba(18,18,20,.55)");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      if(info.cap){ctx.font=`800 ${28*u}px ${F.mont}`;const n=info.names.toUpperCase(),tw=ctx.measureText(n).width,x=48*u,bh=82*u,y=H-48*u-bh,e=easeOut((t-.3)/.7),bw=(tw+56*u)*e;
        ctx.fillStyle=this.ACC;ctx.fillRect(x,y,bw,bh);ctx.save();ctx.beginPath();ctx.rect(x,y,bw,bh);ctx.clip();ctx.textAlign="left";ctx.textBaseline="alphabetic";ctx.fillStyle="#fff";ctx.fillText(n,x+28*u,y+40*u);
        ctx.font=`600 ${15*u}px ${F.mont}`;ctx.fillStyle="rgba(255,255,255,.85)";spaced(ctx,info.date,x+28*u,y+64*u,3*u,"left");ctx.restore()}
    }
  },
  card(ctx,W,H,c,t,ph){
    const u=U(W,H),x=W*.08,maxW=W*.84;
    if(c.photoBg&&ph){cover(ctx,ph.c,0,0,W,H,1.05+t*.01);ctx.fillStyle="rgba(18,18,20,.62)";ctx.fillRect(0,0,W,H)}else{ctx.fillStyle=this.ACC;ctx.fillRect(0,0,W,H)}
    ctx.textAlign="left";ctx.textBaseline="alphabetic";const rows=[];
    c.big.forEach((b,j)=>{if(j>0&&c.amp)rows.push({amp:true,size:100*u});const L=bigLines(ctx,b.toUpperCase(),`800 {s}px ${F.mont}`,(c.amp?150:120)*u,maxW);L.lines.forEach(l=>rows.push({t:l,size:L.size}))});
    const kh=c.kicker?70*u:0,total=kh+rows.reduce((s,r)=>s+r.size*1.02,0)+(c.sub?70*u:0)+(c.msg?60*u:0);let y=(H-total)/2;
    if(c.kicker){ctx.font=`600 ${16*u}px ${F.mont}`;const k=c.kicker.toUpperCase(),kw=spW(ctx,k,3*u)+36*u,e=easeOut(t/.6);ctx.fillStyle=this.INK;roundRect(ctx,x,y,kw*e,40*u,20*u);ctx.fill();
      ctx.save();ctx.beginPath();ctx.rect(x,y,kw*e,40*u);ctx.clip();ctx.fillStyle="#fff";spaced(ctx,k,x+18*u,y+26*u,3*u,"left");ctx.restore();y+=kh}
    rows.forEach((r,j)=>{const e=easeOut((t-.15-j*.12)/.7),ox=(1-e)*-W*.25;y+=r.size*.9;ctx.save();ctx.globalAlpha=clamp(e*1.4);
      if(r.amp){ctx.font=`800 ${r.size}px ${F.mont}`;ctx.lineWidth=3*u;ctx.strokeStyle="#fff";ctx.strokeText("&",x+ox,y)}else{ctx.font=`800 ${r.size}px ${F.mont}`;ctx.fillStyle="#fff";ctx.fillText(r.t,x+ox,y)}
      ctx.restore();y+=r.size*.12});
    const e2=easeOut((t-.6)/.7);ctx.save();ctx.globalAlpha=e2;
    if(c.sub){y+=50*u;ctx.font=`600 ${22*u}px ${F.mont}`;ctx.fillStyle="#fff";spaced(ctx,c.sub,x,y,4*u,"left");ctx.fillStyle=c.photoBg?this.ACC:this.INK;ctx.fillRect(x,y+18*u,140*u*e2,6*u)}
    if(c.msg){y+=60*u;ctx.font=`600 ${20*u}px ${F.mont}`;ctx.fillStyle="rgba(255,255,255,.88)";wrap(ctx,c.msg,maxW*.8).forEach((l,j)=>ctx.fillText(l,x,y+j*30*u))}
    ctx.restore();
  },
  trans(ctx,A,B,x,W,H,k){
    const e=ease(x),kind=k%4;
    if(kind===0){ctx.drawImage(A,0,0);ctx.save();ctx.beginPath();ctx.rect(0,0,W*e,H);ctx.clip();ctx.drawImage(B,0,0);ctx.restore();ctx.fillStyle=this.ACC;ctx.fillRect(W*e-6,0,12,H)}
    else if(kind===1){ctx.drawImage(A,-W*e,0);ctx.drawImage(B,W*(1-e),0)}
    else if(kind===2){ctx.drawImage(A,0,0);ctx.save();ctx.beginPath();ctx.arc(W/2,H/2,Math.hypot(W,H)/2*e,0,6.283);ctx.clip();ctx.drawImage(B,0,0);ctx.restore()}
    else{const s=1+e*.25;ctx.save();ctx.translate(W/2,H/2);ctx.scale(s,s);ctx.drawImage(A,-W/2,-H/2);ctx.restore();ctx.globalAlpha=e;const s2=1.2-.2*e;ctx.save();ctx.translate(W/2,H/2);ctx.scale(s2,s2);ctx.drawImage(B,-W/2,-H/2);ctx.restore();ctx.globalAlpha=1}
  }
};

/* ---------- five more looks ---------- */
function card2(c,W,H,cd,t,o){
  const u=U(W,H),a=clamp(t/1.4),maxW=o.maxW||Math.min(W*.76,980*u),cx=o.cx||W/2,items=[];
  if(o.top)items.push(o.top(cx,u));
  if(cd.kicker)items.push({h:44*u,f(y){c.font=o.kick[0](u);c.fillStyle=o.kick[1];spaced(c,cd.kicker.toUpperCase(),cx,y,o.kick[2]*u)}});
  cd.big.forEach((b,j)=>{
    if(j>0&&cd.amp)items.push({h:56*u,f(y){c.font=o.amp[0](u);c.fillStyle=o.amp[1];c.fillText("&",cx,y)}});
    const L=bigLines(c,o.upper?b.toUpperCase():b,o.big[0],(cd.amp?o.big[2]:o.big[3])*u,maxW);
    L.lines.forEach(l=>items.push({h:L.size*1.18,f(y){c.font=o.big[0].replace("{s}",L.size);const col=o.big[1];c.fillStyle=typeof col==="function"?col(c,cx,c.measureText(l).width,t):col;c.fillText(l,cx,y)}}));
  });
  if(cd.sub)items.push({h:48*u,f(y){c.font=o.sub[0](u);c.fillStyle=o.sub[1];spaced(c,cd.sub,cx,y+6*u,o.sub[2]*u)}});
  if(cd.msg){c.font=o.msg[0](u);wrap(c,cd.msg,maxW*.85).forEach((l,j)=>items.push({h:(j?38:54)*u,f(y){c.font=o.msg[0](u);c.fillStyle=o.msg[1];c.fillText(l,cx,y+(j?0:8*u))}}))}
  return stack(c,items,o.cy||H/2,a);
}
function caption(c,W,cy,u,info,nf,nc,df,dc,sp){c.textAlign="center";c.textBaseline="middle";c.font=nf;c.fillStyle=nc;c.fillText(info.names,W/2,cy-13*u);c.font=df;c.fillStyle=dc;spaced(c,info.date,W/2,cy+23*u,sp*u)}
function shot(c,ph,r,p,i,amt,filter){c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();if(filter)c.filter=filter;const k=kb(p,i,amt);cover(c,ph.c,r.x,r.y,r.w,r.h,k.z,k.px,k.py);c.filter="none";c.restore()}
function flower(c,x,y,r,col,mid,rot){c.save();c.translate(x,y);c.rotate(rot);c.fillStyle=col;for(let k=0;k<5;k++){c.rotate(1.2566);c.beginPath();c.ellipse(0,-r*.55,r*.36,r*.58,0,0,6.283);c.fill()}c.fillStyle=mid;c.beginPath();c.arc(0,0,r*.2,0,6.283);c.fill();c.restore()}
function leaf(c,x,y,len,rot,col){c.save();c.translate(x,y);c.rotate(rot);c.fillStyle=col;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(len*.5,-len*.3,len,0);c.quadraticCurveTo(len*.5,len*.3,0,0);c.fill();c.restore()}
function bouquet(c,x,y,u,d){
  [[70,8,.15],[10,80,1.4],[150,22,.35],[30,150,1.25],[130,110,.8],[190,60,.1]].forEach(([lx,ly,r])=>leaf(c,x+d*lx*u,y+d*ly*u,100*u,r+(d<0?Math.PI:0),"rgba(128,152,112,.7)"));
  [[44,44,56,"#f2b6bf"],[112,30,40,"#f8d5d0"],[28,112,42,"#eda3b0"],[100,100,28,"#fde6e1"],[165,70,22,"#f2b6bf"]].forEach(([fx,fy,r,col])=>flower(c,x+d*fx*u,y+d*fy*u,r*u,col,"#e5b35d",fx));
}
function sprig(c,x,y,u,rot,len){c.save();c.translate(x,y);c.rotate(rot);c.strokeStyle="#6f8a62";c.lineWidth=2*u;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(len*.5,-len*.08,len,0);c.stroke();
  for(let k=1;k<7;k++){const px=len*k/7;leaf(c,px,0,(34-k*2.5)*u,-.75,"rgba(111,138,98,.85)");leaf(c,px+6*u,0,(30-k*2.5)*u,.75,"rgba(141,166,124,.85)")}c.restore()}
function falling(c,W,H,t,n,cols,sz,leafy){const u=U(W,H);c.save();for(let i=0;i<n;i++){const v=.025+hash(i+9)*.035,y=((hash(i+30)+t*v)%1)*1.1-.05,x=hash(i)+Math.sin(t*.5+i)*.04;
  c.save();c.translate(x*W,y*H);c.rotate(t*(.4+hash(i+2))+i);c.globalAlpha=.6;c.fillStyle=cols[i%cols.length];c.beginPath();if(leafy){c.moveTo(-sz*u,0);c.quadraticCurveTo(0,-sz*.6*u,sz*u,0);c.quadraticCurveTo(0,sz*.6*u,-sz*u,0)}else c.ellipse(0,0,sz*u,sz*.55*u,0,0,6.283);c.fill();c.restore()}c.restore()}
function archPath(c,x,y,w,h){const r=w/2;c.beginPath();c.moveTo(x,y+h);c.lineTo(x,y+r);c.arc(x+r,y+r,r,Math.PI,0);c.lineTo(x+w,y+h);c.closePath()}
const fade=(c,A,B,x)=>{c.drawImage(A,0,0);c.globalAlpha=x;c.drawImage(B,0,0);c.globalAlpha=1};
const HY='"Songti SC","STSong","SimSun","Noto Serif CJK SC","Noto Serif SC",serif';

STY.vintage={T:1.5,
  base(c,W,H){c.fillStyle="#ece0c8";c.fillRect(0,0,W,H);const g=c.createRadialGradient(W/2,H/2,Math.min(W,H)*.25,W/2,H/2,Math.hypot(W,H)*.6);g.addColorStop(0,"rgba(255,248,230,.55)");g.addColorStop(1,"rgba(110,80,40,.38)");c.fillStyle=g;c.fillRect(0,0,W,H)},
  tape(c,x,y,w,h,a){c.save();c.translate(x,y);c.rotate(a);c.fillStyle="rgba(226,212,178,.82)";c.fillRect(-w/2,-h/2,w,h);c.restore()},
  photo(c,W,H,ph,p,i,info,t){
    this.base(c,W,H);const u=U(W,H),bot=info.cap?H*.16:H*.08,m=18*u,r=fit(ph.ar,W*.1+m,H*.08+m,W*.8-2*m,H-H*.08-bot-2*m),a=(i%2?1:-1)*.018,cy=r.y+r.h/2;
    c.save();c.translate(W/2,cy);c.rotate(a);c.translate(-W/2,-cy);
    c.save();c.shadowColor="rgba(60,40,20,.35)";c.shadowBlur=30*u;c.shadowOffsetY=8*u;c.fillStyle="#fbf6ea";c.fillRect(r.x-m,r.y-m,r.w+2*m,r.h+2*m);c.restore();
    shot(c,ph,r,p,i,.06,"sepia(.6) contrast(1.05) saturate(.85)");c.fillStyle="rgba(180,140,80,.1)";c.fillRect(r.x,r.y,r.w,r.h);
    this.tape(c,r.x+24*u,r.y-8*u,120*u,32*u,-.62);this.tape(c,r.x+r.w-24*u,r.y-8*u,120*u,32*u,.62);c.restore();
    if(info.cap)caption(c,W,H-bot/2+4*u,u,info,`italic 500 ${40*u}px ${F.corm}`,"#5b4630",`400 ${13*u}px ${F.sans}`,"#8a7356",6);
  },
  card(c,W,H,cd,t){this.base(c,W,H);const u=U(W,H);
    const b=card2(c,W,H,cd,t,{kick:[u=>`400 ${15*u}px ${F.sans}`,"#8a7356",7],big:[`italic 500 {s}px ${F.corm}`,"#4a3622",104,92],amp:[u=>`italic 400 ${46*u}px ${F.corm}`,"#a08560"],sub:[u=>`400 ${15*u}px ${F.sans}`,"#7a6448",6],msg:[u=>`italic 400 ${27*u}px ${F.corm}`,"#6b5539"]});
    c.save();c.globalAlpha=clamp(t/1.4);c.strokeStyle=c.fillStyle="#a08560";c.lineWidth=u;[b.top-36*u,b.bottom+36*u].forEach(y=>{c.beginPath();c.moveTo(W/2-170*u,y);c.lineTo(W/2+170*u,y);c.stroke();c.beginPath();c.arc(W/2,y,4*u,0,6.283);c.fill()});c.restore();
  },
  trans:fade,
  overlay(c,W,H,t){grain(c,W,H,t,.08)}
};
STY.floral={T:1.6,
  base(c,W,H){const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,"#fdf3f2");g.addColorStop(1,"#f5dfe0");c.fillStyle=g;c.fillRect(0,0,W,H);const u=U(W,H);bouquet(c,0,0,u,1);bouquet(c,W,H,u,-1)},
  photo(c,W,H,ph,p,i,info,t){
    this.base(c,W,H);const u=U(W,H),bot=info.cap?H*.16:H*.08,m=14*u,r=fit(ph.ar,W*.12+m,H*.08+m,W*.76-2*m,H-H*.08-bot-2*m),R=22*u;
    c.save();c.shadowColor="rgba(160,82,95,.25)";c.shadowBlur=40*u;c.shadowOffsetY=12*u;c.fillStyle="#fff";roundRect(c,r.x-m,r.y-m,r.w+2*m,r.h+2*m,R+m);c.fill();c.restore();
    c.save();roundRect(c,r.x,r.y,r.w,r.h,R);c.clip();const k=kb(p,i,.06);cover(c,ph.c,r.x,r.y,r.w,r.h,k.z,k.px,k.py);c.fillStyle="rgba(255,225,228,.08)";c.fillRect(r.x,r.y,r.w,r.h);c.restore();
    if(info.cap)caption(c,W,H-bot/2+4*u,u,info,`italic 500 ${42*u}px ${F.play}`,"#a0525f",`400 ${13*u}px ${F.sans}`,"#c48a92",6);
  },
  card(c,W,H,cd,t,ph){this.base(c,W,H);const u=U(W,H);let o={};
    if(ph){const land=W>H*1.15,R=land?H*.27:W*.26,x=land?W*.3:W/2,y=land?H/2:H*.07+R;
      c.save();c.globalAlpha=clamp(t/1.2);c.fillStyle="#fff";c.beginPath();c.arc(x,y,R+12*u,0,6.283);c.fill();c.beginPath();c.arc(x,y,R,0,6.283);c.clip();cover(c,ph.c,x-R,y-R,2*R,2*R,1.02+t*.004);c.restore();
      o=land?{cx:W*.66,maxW:W*.46}:{cy:y+R+(H-y-R)/2,maxW:W*.84}}
    card2(c,W,H,cd,t,Object.assign({kick:[u=>`400 ${14*u}px ${F.sans}`,"#c48a92",6],big:[`italic 500 {s}px ${F.play}`,"#8f4352",98,86],amp:[u=>`italic 400 ${44*u}px ${F.play}`,"#e3a1ac"],sub:[u=>`400 ${14*u}px ${F.sans}`,"#b07a83",6],msg:[u=>`italic 400 ${26*u}px ${F.play}`,"#a0525f"]},o));
  },
  trans(c,A,B,x,W,H){c.drawImage(A,0,0);c.globalAlpha=x;const s=1.05-.05*x;c.save();c.translate(W/2,H/2);c.scale(s,s);c.drawImage(B,-W/2,-H/2);c.restore();c.globalAlpha=1},
  overlay(c,W,H,t){falling(c,W,H,t,22,["#f4b9c1","#fbd9d5","#eda3b0"],9)}
};
STY.red={T:1.3,
  base(c,W,H){const u=U(W,H),g=c.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.hypot(W,H)*.6);g.addColorStop(0,"#a8161d");g.addColorStop(1,"#5a090d");c.fillStyle=g;c.fillRect(0,0,W,H);
    c.save();c.globalAlpha=.06;c.fillStyle="#f6d48b";c.font=`${Math.min(W,H)*.92}px ${HY}`;c.textAlign="center";c.textBaseline="middle";c.fillText("囍",W/2,H/2);c.restore();
    const p=24*u;c.strokeStyle="rgba(232,190,110,.8)";c.lineWidth=2*u;c.strokeRect(p,p,W-2*p,H-2*p);c.lineWidth=u;c.strokeRect(p+9*u,p+9*u,W-2*p-18*u,H-2*p-18*u);
    c.fillStyle="#e8be6e";[[p,p],[W-p,p],[p,H-p],[W-p,H-p]].forEach(([x,y])=>{c.save();c.translate(x,y);c.rotate(.785);c.fillRect(-8*u,-8*u,16*u,16*u);c.restore()})},
  photo(c,W,H,ph,p,i,info,t){
    this.base(c,W,H);const u=U(W,H),bot=info.cap?H*.18:H*.1,r=fit(ph.ar,W*.12,H*.1,W*.76,H-H*.1-bot);
    c.save();c.shadowColor="rgba(0,0,0,.5)";c.shadowBlur=40*u;c.fillStyle="#000";c.fillRect(r.x,r.y,r.w,r.h);c.restore();shot(c,ph,r,p,i,.08);
    c.strokeStyle="#e8be6e";c.lineWidth=2.5*u;c.strokeRect(r.x,r.y,r.w,r.h);c.lineWidth=u;c.strokeRect(r.x-10*u,r.y-10*u,r.w+20*u,r.h+20*u);
    if(info.cap){const cy=H-bot/2+6*u;c.textAlign="center";c.textBaseline="middle";c.font=`italic 500 ${42*u}px ${F.play}`;const w=c.measureText(info.names).width;c.fillStyle=gold(c,W/2-w/2,W/2+w/2,t);c.fillText(info.names,W/2,cy-14*u);
      c.font=`400 ${14*u}px ${F.sans}`;c.fillStyle="#f0cf8a";spaced(c,info.date,W/2,cy+24*u,6*u)}
  },
  card(c,W,H,cd,t){this.base(c,W,H);
    card2(c,W,H,cd,t,{top:(cx,u)=>({h:130*u,f(y){c.font=`${92*u}px ${HY}`;c.fillStyle=gold(c,cx-50*u,cx+50*u,t);c.fillText("囍",cx,y)}}),
      kick:[u=>`400 ${15*u}px ${F.sans}`,"#f0cf8a",8],big:[`italic 500 {s}px ${F.play}`,(c,cx,w,t)=>gold(c,cx-w/2,cx+w/2,t),108,94],amp:[u=>`italic 400 ${44*u}px ${F.play}`,"#e8be6e"],sub:[u=>`400 ${15*u}px ${F.sans}`,"#f0cf8a",7],msg:[u=>`italic 400 ${26*u}px ${F.play}`,"rgba(250,226,180,.9)"]});
  },
  trans:fade,
  overlay(c,W,H,t){dust(c,W,H,t)}
};
STY.mono={T:1,
  base(c,W,H){c.fillStyle="#f7f6f3";c.fillRect(0,0,W,H)},
  photo(c,W,H,ph,p,i,info,t){
    this.base(c,W,H);const u=U(W,H),gray="grayscale(1) contrast(1.08)";
    if(W>H*1.15){const r=fit(ph.ar,W*.05,H*.08,W*.6,H*.84);shot(c,ph,r,p,i,.05,gray);
      if(info.cap){const x=Math.max(r.x+r.w+60*u,W*.7),a=easeOut((t-.2)/.8);c.save();c.globalAlpha=a;c.textAlign="left";c.textBaseline="alphabetic";c.fillStyle="#111";
        c.font=`500 ${40*u}px ${F.play}`;const ls=wrap(c,info.names,W-x-50*u);ls.forEach((l,j)=>c.fillText(l,x,H*.46+j*50*u));
        c.fillRect(x,H*.46+ls.length*50*u-14*u,60*u*a,2*u);c.font=`300 ${14*u}px ${F.sans}`;c.fillStyle="#666";spaced(c,info.date.toUpperCase(),x,H*.46+ls.length*50*u+22*u,5*u,"left");c.restore()}}
    else{const bot=info.cap?H*.16:H*.06,r=fit(ph.ar,W*.07,H*.06,W*.86,H-H*.06-bot);shot(c,ph,r,p,i,.05,gray);
      if(info.cap)caption(c,W,H-bot/2,u,info,`500 ${36*u}px ${F.play}`,"#111",`300 ${13*u}px ${F.sans}`,"#666",5)}
  },
  card(c,W,H,cd,t){this.base(c,W,H);const u=U(W,H);
    const b=card2(c,W,H,cd,t,{kick:[u=>`300 ${13*u}px ${F.sans}`,"#777",9],big:[`500 {s}px ${F.play}`,"#111",110,96],amp:[u=>`italic 400 ${44*u}px ${F.play}`,"#999"],sub:[u=>`300 ${14*u}px ${F.sans}`,"#555",8],msg:[u=>`300 ${22*u}px ${F.sans}`,"#555"]});
    c.save();c.fillStyle="#111";c.fillRect(W/2-30*u,b.bottom+34*u,60*u*easeOut(t/1),2*u);c.restore()},
  trans(c,A,B,x,W,H){c.drawImage(A,0,-H*x*.25);c.save();c.shadowColor="rgba(0,0,0,.25)";c.shadowBlur=30;c.drawImage(B,0,H*(1-x));c.restore()}
};
STY.garden={T:1.6,
  base(c,W,H){const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,"#eef2e8");g.addColorStop(1,"#dce5d2");c.fillStyle=g;c.fillRect(0,0,W,H);const u=U(W,H);
    sprig(c,-10*u,60*u,u,-.15,260*u);sprig(c,60*u,-10*u,u,1.2,200*u);sprig(c,W+10*u,H-60*u,u,Math.PI-.15,260*u);sprig(c,W-60*u,H+10*u,u,Math.PI+1.2,200*u)},
  photo(c,W,H,ph,p,i,info,t){
    this.base(c,W,H);const u=U(W,H),bot=info.cap?H*.16:H*.08,portrait=ph.ar<1.05,box=[W*.12,H*.08,W*.76,H-H*.08-bot-16*u];
    const r=portrait?fit(.76,...box):fit(ph.ar,...box),path=portrait?()=>archPath(c,r.x,r.y,r.w,r.h):()=>roundRect(c,r.x,r.y,r.w,r.h,26*u);
    c.save();c.shadowColor="rgba(63,85,56,.25)";c.shadowBlur=36*u;c.shadowOffsetY=10*u;c.fillStyle="#fff";path();c.fill();c.restore();
    c.save();path();c.clip();const k=kb(p,i,.05);cover(c,ph.c,r.x,r.y,r.w,r.h,k.z,k.px,k.py);c.restore();
    const o=12*u;c.strokeStyle="#7d9471";c.lineWidth=1.5*u;if(portrait)archPath(c,r.x-o,r.y-o,r.w+2*o,r.h+2*o);else roundRect(c,r.x-o,r.y-o,r.w+2*o,r.h+2*o,26*u+o);c.stroke();
    if(info.cap)caption(c,W,H-bot/2+4*u,u,info,`italic 500 ${42*u}px ${F.corm}`,"#3f5538",`400 ${13*u}px ${F.sans}`,"#6f8466",6);
  },
  card(c,W,H,cd,t,ph){this.base(c,W,H);const u=U(W,H);let o={};
    if(ph){const land=W>H*1.15;let aw,ah,ax,ay;if(land){ah=H*.68;aw=ah*.74;ax=W*.3-aw/2;ay=(H-ah)/2;o={cx:W*.66,maxW:W*.46}}else{aw=W*.56;ah=Math.min(aw*1.3,H*.46);ax=W/2-aw/2;ay=H*.07;o={cy:ay+ah+(H-ay-ah)/2,maxW:W*.84}}
      c.save();c.globalAlpha=clamp(t/1.2);archPath(c,ax,ay,aw,ah);c.clip();cover(c,ph.c,ax,ay,aw,ah,1.02+t*.004);c.restore();
      c.save();c.globalAlpha=clamp(t/1.2);c.strokeStyle="#7d9471";c.lineWidth=1.5*u;archPath(c,ax-12*u,ay-12*u,aw+24*u,ah+24*u);c.stroke();c.restore()}
    card2(c,W,H,cd,t,Object.assign({kick:[u=>`400 ${14*u}px ${F.sans}`,"#6f8466",6],big:[`italic 500 {s}px ${F.corm}`,"#2f4229",104,90],amp:[u=>`italic 400 ${44*u}px ${F.corm}`,"#8aa37c"],sub:[u=>`400 ${14*u}px ${F.sans}`,"#5c7353",6],msg:[u=>`italic 400 ${27*u}px ${F.corm}`,"#4b6243"]},o));
  },
  trans(c,A,B,x,W,H){c.drawImage(A,0,0);c.globalAlpha=x;c.drawImage(B,(1-x)*30*U(W,H),0);c.globalAlpha=1},
  overlay(c,W,H,t){falling(c,W,H,t,9,["#8aa37c","#a9bf98"],11,true)}
};

/* ---------- transitions the user can pick (A = old frame, B = new frame, e = 0..1) ---------- */
function heartPath(c,x,y,w){const t=w/2;c.beginPath();c.moveTo(x,y+t*.75);c.bezierCurveTo(x-t*1.25,y-t*.05,x-t*.62,y-t*1.15,x,y-t*.42);c.bezierCurveTo(x+t*.62,y-t*1.15,x+t*1.25,y-t*.05,x,y+t*.75);c.closePath()}
function veil(c,A,B,e,W,H,col){if(e<.5){c.drawImage(A,0,0);c.fillStyle=col+(e*2)+")";c.fillRect(0,0,W,H)}else{c.drawImage(B,0,0);c.fillStyle=col+((1-e)*2)+")";c.fillRect(0,0,W,H)}}
function reveal(c,A,B,path){c.drawImage(A,0,0);c.save();path();c.clip();c.drawImage(B,0,0);c.restore()}
const TR={
  fade(c,A,B,e){c.drawImage(A,0,0);c.globalAlpha=e;c.drawImage(B,0,0);c.globalAlpha=1},
  white(c,A,B,e,W,H){veil(c,A,B,e,W,H,"rgba(255,250,242,")},
  black(c,A,B,e,W,H){veil(c,A,B,e,W,H,"rgba(0,0,0,")},
  slide(c,A,B,e,W){c.drawImage(A,-W*e,0);c.drawImage(B,W*(1-e),0)},
  up(c,A,B,e,W,H){c.drawImage(A,0,-H*e*.35);c.save();c.shadowColor="rgba(0,0,0,.5)";c.shadowBlur=40;c.drawImage(B,0,H*(1-e));c.restore()},
  wipe(c,A,B,e,W,H){reveal(c,A,B,()=>{c.beginPath();c.rect(0,0,W*e,H)})},
  diag(c,A,B,e,W,H){const x=(W+H)*e;reveal(c,A,B,()=>{c.beginPath();c.moveTo(0,0);c.lineTo(x,0);c.lineTo(x-H,H);c.lineTo(0,H);c.closePath()})},
  circle(c,A,B,e,W,H){reveal(c,A,B,()=>{c.beginPath();c.arc(W/2,H/2,Math.hypot(W,H)/2*e,0,6.283)})},
  heart(c,A,B,e,W,H){reveal(c,A,B,()=>heartPath(c,W/2,H*.55,Math.hypot(W,H)*2.4*e*e))},
  zoom(c,A,B,e,W,H){const s=1+e*.3;c.save();c.translate(W/2,H/2);c.scale(s,s);c.drawImage(A,-W/2,-H/2);c.restore();c.globalAlpha=e;const s2=1.25-.25*e;c.save();c.translate(W/2,H/2);c.scale(s2,s2);c.drawImage(B,-W/2,-H/2);c.restore();c.globalAlpha=1},
  flip(c,A,B,e,W,H){c.fillStyle="#000";c.fillRect(0,0,W,H);const k=e<.5?1-e*2:e*2-1,S=e<.5?A:B;c.save();c.translate(W/2,H/2);c.scale(Math.max(.001,k),1);c.drawImage(S,-W/2,-H/2);c.restore()},
  blinds(c,A,B,e,W,H){const n=9,w=W/n;reveal(c,A,B,()=>{c.beginPath();for(let j=0;j<n;j++)c.rect(j*w,0,w*clamp(e*1.6-j/n*.6),H)})},
};
const MIX=["fade","heart","slide","white","circle","zoom","wipe","flip","diag","blinds","up"];
// Varied per-photo transitions that suit each style, no kind twice in a row.
const POOL={lux:["fade","white","zoom","circle","heart"],korea:["fade","white","slide","heart","zoom"],cinema:["black","fade","zoom","wipe"],modern:["slide","wipe","circle","zoom","diag","blinds","flip","up"],
  vintage:["fade","black","flip","zoom"],floral:["heart","fade","white","circle","zoom"],red:["fade","white","heart","circle","zoom"],mono:["up","wipe","slide","fade","diag"],garden:["fade","slide","white","circle","heart"]};
function autoTrans(style,n,seed=0){const pool=POOL[style]||MIX,out=[];let prev="";for(let i=0;i<n;i++){const k=Math.floor(hash(i*7.13+seed*31.7+1)*pool.length);let t=pool[k];if(t===prev)t=pool[(k+1)%pool.length];out.push(t);prev=t}return out}
function pickTrans(name,k){if(!name||name==="auto")return null;if(name==="mix")return TR[MIX[k%MIX.length]];return TR[name]||null}

/* ---------- photo frames the user can pick, drawn in the colors of the chosen style ---------- */
const PAL={
  lux:{acc:"#d4ac63",bg(c,W,H,ph){STY.lux.base(c,W,H,ph)},cap(c,W,y,info,t,u){c.font=`italic 500 ${42*u}px ${F.play}`;const w=c.measureText(info.names).width;c.fillStyle=gold(c,W/2-w/2,W/2+w/2,t);c.fillText(info.names,W/2,y-14*u);c.font=`300 ${14*u}px ${F.sans}`;c.fillStyle="#d4ac63";spaced(c,info.date,W/2,y+24*u,6*u)}},
  korea:{acc:"#c9b49b",bg(c,W,H){STY.korea.base(c,W,H)},cap(c,W,y,info,t,u){c.font=`italic 500 ${40*u}px ${F.corm}`;c.fillStyle="#6e5b48";c.fillText(info.names,W/2,y-12*u);c.font=`400 ${13*u}px ${F.sans}`;c.fillStyle="#a39280";spaced(c,info.date,W/2,y+22*u,5*u)}},
  cinema:{acc:"#d9853b",bg(c,W,H,ph){c.fillStyle="#000";c.fillRect(0,0,W,H);if(ph){c.globalAlpha=.4;cover(c,ph.b,0,0,W,H,1.1);c.globalAlpha=1}vignette(c,W,H,.9)},cap(c,W,y,info,t,u){c.font=`300 ${18*u}px ${F.sans}`;c.fillStyle="rgba(255,255,255,.88)";spaced(c,(info.names+"   ·   "+info.date).toUpperCase(),W/2,y,7*u)}},
  vintage:{acc:"#a08560",bg(c,W,H){STY.vintage.base(c,W,H)},cap(c,W,y,info,t,u){caption(c,W,y,u,info,`italic 500 ${40*u}px ${F.corm}`,"#5b4630",`400 ${13*u}px ${F.sans}`,"#8a7356",6)}},
  floral:{acc:"#e7a3ae",bg(c,W,H){STY.floral.base(c,W,H)},cap(c,W,y,info,t,u){caption(c,W,y,u,info,`italic 500 ${42*u}px ${F.play}`,"#a0525f",`400 ${13*u}px ${F.sans}`,"#c48a92",6)}},
  red:{acc:"#e8be6e",bg(c,W,H){STY.red.base(c,W,H)},cap(c,W,y,info,t,u){c.font=`italic 500 ${42*u}px ${F.play}`;const w=c.measureText(info.names).width;c.fillStyle=gold(c,W/2-w/2,W/2+w/2,t);c.fillText(info.names,W/2,y-14*u);c.font=`400 ${14*u}px ${F.sans}`;c.fillStyle="#f0cf8a";spaced(c,info.date,W/2,y+24*u,6*u)}},
  mono:{acc:"#111111",bg(c,W,H){STY.mono.base(c,W,H)},cap(c,W,y,info,t,u){caption(c,W,y,u,info,`500 ${36*u}px ${F.play}`,"#111",`300 ${13*u}px ${F.sans}`,"#666",5)}},
  garden:{acc:"#7d9471",bg(c,W,H){STY.garden.base(c,W,H)},cap(c,W,y,info,t,u){caption(c,W,y,u,info,`italic 500 ${42*u}px ${F.corm}`,"#3f5538",`400 ${13*u}px ${F.sans}`,"#6f8466",6)}},
  modern:{acc:"#ff5470",bg(c,W,H){c.fillStyle="#121214";c.fillRect(0,0,W,H)},cap(c,W,y,info,t,u){c.font=`800 ${34*u}px ${F.mont}`;c.fillStyle="#f4f1ea";c.fillText(info.names.toUpperCase(),W/2,y-10*u);c.font=`600 ${15*u}px ${F.mont}`;c.fillStyle="#ff5470";spaced(c,info.date,W/2,y+24*u,4*u)}},
};
function framed(style,c,W,H,ph,p,i,info,t,frame){
  const P=PAL[style]||PAL.lux,u=U(W,H),k=kb(p,i,.08);
  P.bg(c,W,H,ph);c.save();c.textAlign="center";c.textBaseline="middle";
  if(frame==="full"){cover(c,ph.c,0,0,W,H,k.z,k.px,k.py);
    if(info.cap){const g=c.createLinearGradient(0,H*.6,0,H);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.6)");c.fillStyle=g;c.fillRect(0,0,W,H);P.cap(c,W,H-80*u,info,t,u)}
    c.restore();return}
  const bot=info.cap?H*.17:H*.06,top=H*.06,bx=W*.07,bw=W*.86,bh=H-top-bot;
  const shadow=()=>{c.shadowColor="rgba(0,0,0,.45)";c.shadowBlur=40*u;c.shadowOffsetY=10*u};
  const photoIn=(path,r)=>{c.save();path();c.clip();cover(c,ph.c,r.x,r.y,r.w,r.h,k.z,k.px,k.py);c.restore()};
  const rect=(r)=>()=>{c.beginPath();c.rect(r.x,r.y,r.w,r.h)};
  if(frame==="polaroid"){
    const m=16*u,mb=64*u,r=fit(ph.ar,bx+m,top+m,bw-2*m,bh-m-mb),a=(i%2?1:-1)*.026;
    c.save();c.translate(r.x+r.w/2,r.y+r.h/2+mb/2-m/2);c.rotate(a);c.translate(-(r.x+r.w/2),-(r.y+r.h/2+mb/2-m/2));
    c.save();shadow();c.fillStyle="#fffdf8";c.fillRect(r.x-m,r.y-m,r.w+2*m,r.h+m+mb);c.restore();photoIn(rect(r),r);
    c.font=`italic 500 ${30*u}px ${F.corm}`;c.fillStyle="#5d5148";c.fillText(info.date||info.names,r.x+r.w/2,r.y+r.h+mb/2);c.restore();
  }else if(frame==="arch"||frame==="oval"){
    const r=fit(frame==="arch"?.74:.8,bx,top+8*u,bw,bh-16*u),R=r.w/2;
    const path=frame==="arch"?()=>{c.beginPath();c.moveTo(r.x,r.y+r.h);c.lineTo(r.x,r.y+R);c.arc(r.x+R,r.y+R,R,Math.PI,0);c.lineTo(r.x+r.w,r.y+r.h);c.closePath()}:()=>{c.beginPath();c.ellipse(r.x+R,r.y+r.h/2,R,r.h/2,0,0,6.283)};
    c.save();shadow();c.fillStyle="#000";path();c.fill();c.restore();photoIn(path,r);
    c.save();c.strokeStyle=P.acc;c.lineWidth=2*u;const o=12*u,g={x:r.x-o,y:r.y-o,w:r.w+2*o,h:r.h+2*o},G=g.w/2;
    if(frame==="arch"){c.beginPath();c.moveTo(g.x,g.y+g.h);c.lineTo(g.x,g.y+G);c.arc(g.x+G,g.y+G,G,Math.PI,0);c.lineTo(g.x+g.w,g.y+g.h);c.stroke()}else{c.beginPath();c.ellipse(g.x+G,g.y+g.h/2,G,g.h/2,0,0,6.283);c.stroke()}
    c.restore();
  }else{
    const m=frame==="white"?22*u:0,r=fit(ph.ar,bx+m,top+m,bw-2*m,bh-2*m),rad=frame==="round"?Math.min(r.w,r.h)*.06:0;
    const path=rad?()=>roundRect(c,r.x,r.y,r.w,r.h,rad):rect(r);
    c.save();shadow();c.fillStyle=frame==="white"?"#fffdf8":"#000";if(m)c.fillRect(r.x-m,r.y-m,r.w+2*m,r.h+2*m);else{path();c.fill()}c.restore();
    photoIn(path,r);
    if(frame==="thin"){c.strokeStyle=P.acc;c.lineWidth=2*u;c.strokeRect(r.x,r.y,r.w,r.h);c.globalAlpha=.5;c.lineWidth=u;c.strokeRect(r.x-10*u,r.y-10*u,r.w+20*u,r.h+20*u);c.globalAlpha=1}
  }
  if(info.cap)P.cap(c,W,H-bot/2+6*u,info,t,u);
  c.restore();
}

/* ---------- scenes ---------- */
function build(mode,n,cfg){
  const sec=cfg.sec,ord=[...Array(n).keys()],s=[];
  if(cfg.shuffle)for(let i=n-1;i>0;i--){const j=Math.random()*(i+1)|0;[ord[i],ord[j]]=[ord[j],ord[i]]}
  if(mode==="stage"){
    s.push({type:"title",name:"Màn hình tên",dur:7});
    (cfg.cues||[]).forEach((c,j)=>{if(/^\[.*ảnh.*\]$/i.test(c))s.push({type:"gallery",name:"Trình chiếu ảnh",dur:sec*Math.min(4,Math.max(1,n))});else s.push({type:"cue",text:c,i:j,name:c,dur:5})});
  }else if(mode==="party"){
    s.push({type:"title",name:"Màn hình tên",dur:Math.max(7,sec)});
    ord.forEach((i,j)=>{if(cfg.every&&j>0&&j%cfg.every===0)s.push({type:"title",name:"Màn hình tên",dur:Math.max(6,sec)});s.push({type:"photo",i,name:"Ảnh "+(i+1),dur:sec})});
  }else{
    s.push({type:"title",name:"Mở đầu",dur:Math.max(6,sec)});
    ord.forEach(i=>s.push({type:"photo",i,name:"Ảnh "+(i+1),dur:sec}));
    s.push({type:"end",name:"Lời cảm ơn",dur:7});
  }
  // Fit to music: every scene lasts a whole number of beats, so cuts land on the beat.
  if(cfg.beat>0&&mode!=="stage")s.forEach(x=>x.dur=Math.max(2,Math.round(x.dur/cfg.beat))*cfg.beat);
  s.forEach((x,j)=>x.k=j);return s;
}

/* ---------- engine ---------- */
function Engine(canvas,o){
  const ctx=canvas.getContext("2d"),bufs=[0,1,2,3].map(()=>document.createElement("canvas"));
  let idx=0,t=0,time=0,prev=null,prevT=0,ended=false;
  const S=()=>STY[o.style]||STY.lux;
  // o.trs[i] is the transition into photo i (per-photo choice); other scenes use o.trans.
  const nameFor=(sc,kk)=>{const i=sc?(sc.type==="photo"?sc.i:null):kk;return(i!=null&&o.trs&&o.trs[i])||o.trans};
  const TT=(nm)=>pickTrans(nm,0)?1.1:S().T;
  const photo=(c,W,H,ph,p,i,I,lt)=>{if(o.frame&&o.frame!=="auto")framed(o.style,c,W,H,ph,p,i,I,lt,o.frame);else S().photo(c,W,H,ph,p,i,I,lt)};
  const trans=(c,A,B,x,W,H,k,nm)=>{const f=pickTrans(nm,k);if(f){c.save();f(c,A,B,x,W,H);c.restore()}else S().trans(c,A,B,x,W,H,k)};
  function fitBufs(){for(const b of bufs)if(b.width!==canvas.width||b.height!==canvas.height){b.width=canvas.width;b.height=canvas.height}}
  function photoAt(sc){const n=o.photos.length;if(!n)return null;return o.photos[((sc.i||0)%n+n)%n]}
  function drawPhotoGallery(c,lt){
    const s=S(),n=o.photos.length,per=o.sec,k=Math.floor(lt/per),l=lt-k*per,W=canvas.width,H=canvas.height;
    const nm=nameFor(null,k%n),T=TT(nm),one=(cx,kk,tt)=>photo(cx,W,H,o.photos[kk%n],clamp(tt/(per+T)),kk%n,o.info,tt);
    if(k>0&&l<T){const A=bufs[2],B=bufs[3];one(A.getContext("2d"),k-1,per+l);one(B.getContext("2d"),k,l);c.save();trans(c,A,B,ease(l/T),W,H,k,nm);c.restore()}
    else one(c,k,l);
  }
  function draw(c,sc,lt){
    const s=S(),W=canvas.width,H=canvas.height,I=o.info;c.save();
    if(!o.photos.length&&sc.type!=="cue"){s.card(c,W,H,{kicker:"Lễ thành hôn",big:[I.groom,I.bride],amp:true,sub:I.date},lt,null)}
    else if(sc.type==="photo")photo(c,W,H,photoAt(sc),clamp(lt/(sc.dur+TT(nameFor(sc)))),sc.i,I,lt);
    else if(sc.type==="gallery")drawPhotoGallery(c,lt);
    else if(sc.type==="title")s.card(c,W,H,{kicker:"Lễ thành hôn",big:[I.groom,I.bride],amp:true,sub:I.date,msg:I.msg},lt,o.photos[0]);
    else if(sc.type==="end")s.card(c,W,H,{kicker:"Trân trọng cảm ơn",big:[I.groom,I.bride],amp:true,sub:I.date,msg:I.msg},lt,o.photos[Math.min(1,o.photos.length-1)]);
    else if(sc.type==="cue")s.card(c,W,H,{kicker:I.names,big:[sc.text],sub:I.date,photoBg:true},lt,photoAt(sc));
    c.restore();
  }
  function render(){
    const s=S(),W=canvas.width,H=canvas.height,cur=o.scenes[idx];if(!cur)return;
    ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";
    const nm=nameFor(cur),T=TT(nm);
    if(prev&&t<T){fitBufs();const A=bufs[0],B=bufs[1];draw(A.getContext("2d"),prev,prevT+t);draw(B.getContext("2d"),cur,t);ctx.fillStyle="#000";ctx.fillRect(0,0,W,H);trans(ctx,A,B,ease(t/T),W,H,cur.k,nm)}
    else{if(cur.type==="gallery")fitBufs();draw(ctx,cur,t)}
    if(s.overlay)s.overlay(ctx,W,H,time);
    ctx.restore();
  }
  function go(n){
    const len=o.scenes.length;prev=o.scenes[idx];prevT=t;
    if(n>=len){if(o.loop){if(o.onLoop)o.scenes=o.onLoop();n=0}else{n=len-1;if(n===idx){prev=null;if(!ended){ended=true;o.onEnd&&o.onEnd()}return}}}
    if(n<0)n=o.loop?len-1:0;
    if(n===idx&&prev){prev=null}
    idx=n;t=0;ended=false;o.onScene&&o.onScene(idx,o.scenes[idx]);
  }
  function step(dt){time+=dt;t+=dt;const sc=o.scenes[idx];if(o.auto&&sc&&sc.dur&&t>=sc.dur)go(idx+1)}
  return{step,render,go,next:()=>go(idx+1),prev:()=>go(idx-1),get idx(){return idx},get scene(){return o.scenes[idx]},get scenes(){return o.scenes},opts:o};
}
function total(sc){return sc.reduce((s,x)=>s+x.dur,0)}

/* ---------- fullscreen player ---------- */
let cssDone=false;
function css(){if(cssDone)return;cssDone=true;const st=document.createElement("style");st.textContent=
`.ss-ov{position:fixed;inset:0;z-index:2147483000;background:#000;overflow:hidden}
.ss-ov canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ss-ov.idle{cursor:none}
.ss-blk{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .6s}
.ss-blk.on{opacity:1}
.ss-ctl{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));display:flex;gap:6px;flex-wrap:wrap;justify-content:center;align-items:center;width:max-content;max-width:calc(100% - 24px);transition:opacity .4s;font:500 14px "Be Vietnam Pro",system-ui,sans-serif}
.ss-ov.idle .ss-ctl{opacity:0;pointer-events:none}
.ss-ctl button,.ss-ctl .ss-lbl{font:inherit;color:#fff;background:rgba(18,18,18,.6);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:8px 14px;backdrop-filter:blur(8px)}
.ss-ctl button{cursor:pointer}
.ss-ctl button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.ss-ctl .ss-lbl{max-width:42vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}`;document.head.appendChild(st)}
function Player(p){
  css();const manual=p.mode==="stage";
  const ov=document.createElement("div");ov.className="ss-ov";
  ov.innerHTML=`<canvas></canvas><div class="ss-blk"></div><div class="ss-ctl"><button data-a="prev" aria-label="Màn trước">‹</button><span class="ss-lbl"></span><button data-a="next" aria-label="Màn sau">›</button>`+
    (manual?`<button data-a="black">Che đen (B)</button>`:`<button data-a="pause">❚❚ Dừng</button>`)+
    (p.tracks&&p.tracks.length?`<button data-a="music"></button>`:"")+`<button data-a="full">⛶ Toàn màn hình</button><button data-a="close">✕ Thoát</button></div>`;
  document.body.appendChild(ov);
  const cv=ov.querySelector("canvas"),lbl=ov.querySelector(".ss-lbl"),blk=ov.querySelector(".ss-blk");
  function size(){const dpr=Math.min(2,window.devicePixelRatio||1);let w=ov.clientWidth*dpr,h=ov.clientHeight*dpr;const k=Math.min(1,2560/Math.max(w,h));cv.width=Math.round(w*k);cv.height=Math.round(h*k)}
  size();const ro=new ResizeObserver(size);ro.observe(ov);
  const mk=()=>build(p.mode,p.photos.length,p.cfg);
  const eng=Engine(cv,{style:p.style,photos:p.photos,info:p.info,sec:p.cfg.sec,trans:p.cfg.trans,trs:p.cfg.trs,frame:p.cfg.frame,scenes:mk(),auto:!manual,loop:!manual,onLoop:mk,onScene:label});
  function label(i,sc){lbl.textContent=(i+1)+"/"+eng.scenes.length+" · "+sc.name}
  label(0,eng.scene);
  // music
  const au=new Audio();let ti=0,musicOn=!!(p.tracks&&p.tracks.length&&p.musicOn),paused=false;
  au.addEventListener("ended",()=>{ti=(ti+1)%p.tracks.length;au.src=p.tracks[ti];if(musicOn&&!paused)au.play().catch(()=>{})});
  function fade(to,ms,done){const from=au.volume,t0=performance.now();(function f(n){const k=Math.min(1,(n-t0)/ms);au.volume=from+(to-from)*k;k<1?requestAnimationFrame(f):done&&done()})(t0)}
  function music(){const b=ov.querySelector('[data-a="music"]');if(b)b.textContent=musicOn?"♪ Tắt nhạc":"♪ Bật nhạc";
    if(musicOn&&!paused){if(!au.src){au.src=p.tracks[0];if(p.cfg.beat0)au.currentTime=p.cfg.beat0}au.volume=0;au.play().then(()=>fade(1,2000)).catch(()=>{})}else if(!au.paused)fade(0,500,()=>au.pause())}
  music();
  // loop
  let raf=0,last=performance.now();
  function frame(n){const dt=Math.min(.1,(n-last)/1000);last=n;if(!paused)eng.step(dt);eng.render();raf=requestAnimationFrame(frame)}
  raf=requestAnimationFrame(frame);
  // wake lock, fullscreen
  let wl=null;const lock=async()=>{try{wl=await navigator.wakeLock.request("screen")}catch(e){}};lock();
  const vis=()=>{if(document.visibilityState==="visible")lock()};document.addEventListener("visibilitychange",vis);
  const full=()=>{try{const r=document.fullscreenElement?document.exitFullscreen():ov.requestFullscreen&&ov.requestFullscreen();r&&r.catch&&r.catch(()=>{})}catch(e){}};
  if(p.fullscreen!==false)full();
  // idle
  let it=0;const poke=()=>{ov.classList.remove("idle");clearTimeout(it);it=setTimeout(()=>ov.classList.add("idle"),2500)};poke();
  ov.addEventListener("mousemove",poke);ov.addEventListener("touchstart",poke,{passive:true});
  function pause(){paused=!paused;const b=ov.querySelector('[data-a="pause"]');if(b)b.textContent=paused?"▶ Chạy tiếp":"❚❚ Dừng";if(musicOn){if(paused)au.pause();else au.play().catch(()=>{})}}
  function black(){blk.classList.toggle("on")}
  const act={prev:()=>eng.prev(),next:()=>eng.next(),pause,black,full,close,music:()=>{musicOn=!musicOn;music()}};
  ov.querySelector(".ss-ctl").addEventListener("click",e=>{const b=e.target.closest("button");if(b){act[b.dataset.a]();poke()}});
  function key(e){const k=e.key;
    if(k==="ArrowRight"||k==="PageDown"||(manual&&(k===" "||k==="Enter"))){e.preventDefault();if(blk.classList.contains("on"))black();eng.next()}
    else if(k==="ArrowLeft"||k==="PageUp"){e.preventDefault();eng.prev()}
    else if(k===" "){e.preventDefault();pause()}
    else if(k==="b"||k==="B"||k==="."){black()}
    else if(k==="f"||k==="F"){full()}
    else if(k==="Escape"&&!document.fullscreenElement){close()}
    poke()}
  document.addEventListener("keydown",key);
  function close(){cancelAnimationFrame(raf);ro.disconnect();au.pause();au.removeAttribute("src");document.removeEventListener("keydown",key);document.removeEventListener("visibilitychange",vis);
    try{wl&&wl.release()}catch(e){}if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});ov.remove();p.onClose&&p.onClose()}
  return{close};
}
G.SlideEngine={ready,prep,focus,autoTrans,build,Engine,Player,total,STY};
})(window);
