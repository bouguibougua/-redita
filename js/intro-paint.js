(function () {
  'use strict';
  const E = window.Eredita;
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const mix = (a, b, t) => a + (b - a) * t;
  // Chemins de composition : Béziers ouverts, arabesques et contre-courbes.
  // Le logo ne participe à aucune transformation de ces rubans.
  const strokes = [
    { color: 0, delay: 0, width: 35, start: [-.08,.76], curves: [[.00,.18,.30,.11,.35,.35],[.42,.65,.02,.77,.14,.55],[.25,.32,.62,.40,.89,.58]] },
    { color: 2, delay: .24, width: 53, start: [1.08,.17], curves: [[.74,.02,.62,.28,.73,.42],[.88,.61,.99,.83,.70,.83],[.41,.86,.48,.44,.26,.40]] },
    { color: 3, delay: .42, width: 31, start: [1.08,.89], curves: [[.89,.56,.77,.82,.73,.59],[.66,.34,.54,.25,.65,.15],[.89,-.08,1.00,.19,.88,.35],[.75,.50,.55,.47,.23,.42]] },
    { color: 1, delay: .14, width: 24, start: [.13,1.08], curves: [[.31,.87,.40,.79,.28,.63],[.03,.32,.35,.14,.47,.32],[.62,.51,.52,.73,.79,.74]] },
    { color: 4, delay: .62, width: 38, start: [-.12,.15], curves: [[.16,.21,.10,.64,.39,.70],[.64,.76,.72,.54,.57,.44],[.46,.34,.24,.35,.23,.20],[.25,.06,.47,.12,.69,.28]] },
    { color: 5, delay: .8, width: 7, start: [.95,-.13], curves: [[.89,.21,.53,.13,.55,.32],[.56,.56,.80,.56,.65,.69],[.50,.86,.25,.79,.08,.87]] }
  ];
  function random(seed) {
    return () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed); return ((seed ^ seed >>> 14) >>> 0) / 4294967296; };
  }
  const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const rgba = (color, alpha) => `rgba(${color.map(Math.round).join(',')},${clamp(alpha)})`;
  function bezier(a, b, c, d, t) {
    const u = 1 - t;
    return { x: u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0], y: u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1] };
  }
  const paths = strokes.map(stroke => {
    let start = stroke.start;
    const points = [];
    for (const curve of stroke.curves) {
      for (let i = 0; i < 64; i++) points.push(bezier(start, curve.slice(0,2), curve.slice(2,4), curve.slice(4,6), i / 64));
      start = curve.slice(4,6);
    }
    points.push({x:start[0],y:start[1]}); return points;
  });

  function create(canvas, logo, cfg) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    const layer = document.createElement('canvas'), mask = document.createElement('canvas');
    const revealed = document.createElement('canvas'), glint = document.createElement('canvas');
    const paint = layer.getContext('2d'), maskCtx = mask.getContext('2d');
    const logoCtx = revealed.getContext('2d'), lightCtx = glint.getContext('2d');
    const grain = document.createElement('canvas'); grain.width = grain.height = 256;
    const grainCtx = grain.getContext('2d'), grainData = grainCtx.createImageData(256,256), rand = random(9217);
    const pools = Array.from({length:17*17},()=>rand());
    for (let i = 0; i < grainData.data.length; i += 4) {
      const x=(i/4)%256,y=Math.floor(i/1024),gx=Math.floor(x/16),gy=Math.floor(y/16),fx=smooth((x%16)/16),fy=smooth((y%16)/16);
      const pigment=mix(mix(pools[gy*17+gx],pools[gy*17+gx+1],fx),mix(pools[(gy+1)*17+gx],pools[(gy+1)*17+gx+1],fx),fy);
      grainData.data[i+3] = Math.round(4 + pigment*88 + rand()*26 + (rand() > .99 ? 35 : 0));
    }
    grainCtx.putImageData(grainData,0,0);
    const grainPattern = paint.createPattern(grain,'repeat');
    const dust = Array.from({length:cfg.dustCount}, () => ({x:rand(),y:rand(),seed:rand()*100,size:.4+rand()*1.25,goalX:.18+rand()*.66,goalY:.35+rand()*.30}));
    const colors = cfg.palette.map(rgb), gold = colors[5];
    let width, height, ratio, rect;
    function resize() {
      width = Math.max(1, innerWidth); height = Math.max(1, innerHeight);
      ratio = Math.min(devicePixelRatio || 1, cfg.maxPixelRatio, cfg.maxCanvasEdge / Math.max(width,height));
      canvas.width = layer.width = Math.round(width*ratio); canvas.height = layer.height = Math.round(height*ratio);
      ctx.setTransform(ratio,0,0,ratio,0,0); paint.setTransform(ratio,0,0,ratio,0,0);
      const logoWidth = Math.min(1120,width*(width < cfg.mobileBreakpoint ? .92 : .79),height*2.25);
      rect = { x:(width-logoWidth)/2, y:height*.5-logoWidth*logo.height/logo.width/2, width:logoWidth, height:logoWidth*logo.height/logo.width };
      mask.width = revealed.width = glint.width = Math.max(1,Math.round(rect.width*ratio));
      mask.height = revealed.height = glint.height = Math.max(1,Math.round(rect.height*ratio));
    }
    function ribbon(index, seconds, convergence, opacity) {
      const stroke = strokes[index], base = paths[index];
      const growth = smooth((seconds-cfg.birthAt-stroke.delay)/1.65);
      if (!growth || opacity <= 0) return;
      const count = Math.max(2,Math.floor((base.length-1)*growth));
      const scale = Math.min(width,height)/750;
      const goldMix = smooth((seconds-3.45-index*.10)/2.35)*.28;
      const color = colors[stroke.color].map((value,i) => mix(value,gold[i],goldMix));
      const points = [];
      for (let i=0;i<=count;i++) {
        const p = i/(base.length-1), b = base[i], flow = seconds*1.15 + p*9 + index;
        const x = mix(b.x,.5+(b.x-.5)*.69,convergence);
        const y = mix(b.y,.49+(b.y-.49)*.43,convergence);
        const flutter = Math.sin(p*Math.PI);
        const tip = Math.pow(Math.min(1,(count-i)/9),.7);
        const thickness = stroke.width*scale*(.02+.98*Math.pow(Math.sin(p*Math.PI),.65))*(1-convergence*.35)*tip;
        points.push({x:x*width + Math.sin(flow*1.15)*9*scale*flutter,
          y:y*height+Math.sin(flow*1.6+index)*12*scale*flutter,
          radius:thickness*(.77+.20*Math.sin(p*29+index)+.06*Math.sin(p*117+index*4))});
      }
      points.forEach((point,i) => {
        const a=points[Math.max(0,i-1)], b=points[Math.min(points.length-1,i+1)];
        const length=Math.hypot(b.x-a.x,b.y-a.y)||1; point.nx=-(b.y-a.y)/length;point.ny=(b.x-a.x)/length;
      });
      function silhouette(multiplier) {
        paint.beginPath();
        for(let i=0;i<points.length;i++) { const p=points[i], r=p.radius*multiplier; paint[i?'lineTo':'moveTo'](p.x+p.nx*r,p.y+p.ny*r); }
        for(let i=points.length-1;i>=0;i--) { const p=points[i], r=p.radius*multiplier;paint.lineTo(p.x-p.nx*r,p.y-p.ny*r); }
        paint.closePath();
      }
      paint.save();
      silhouette(1.52); paint.fillStyle=rgba(color,.085*opacity); paint.shadowColor=rgba(color,.30*opacity);paint.shadowBlur=18*scale;paint.fill();paint.shadowBlur=0;
      silhouette(1);
      const first=points[0],last=points.at(-1), gradient=paint.createLinearGradient(first.x,first.y,last.x,last.y);
      gradient.addColorStop(0,rgba(color,.06*opacity));gradient.addColorStop(.23,rgba(color,.52*opacity));
      gradient.addColorStop(.65,rgba(color.map(c=>Math.min(255,c*1.12+12)),.70*opacity));gradient.addColorStop(1,rgba(color,.12*opacity));
      paint.globalCompositeOperation='screen';paint.fillStyle=gradient;paint.fill();paint.globalCompositeOperation='source-over';
      // Fibres et veinures longues, irrégulières, incluses dans la peinture.
      paint.save();silhouette(1);paint.clip();
      for(let strand=0;strand<13;strand++) {
        const offset=(strand/12-.5)*1.85;
        paint.beginPath();
        points.forEach((p,i) => {
          const flow = Math.sin(i*.041+strand*1.4+seconds*.6)*p.radius*.09;
          const r = offset*p.radius+flow;
          paint[i?'lineTo':'moveTo'](p.x+p.nx*r,p.y+p.ny*r);
        });
        paint.strokeStyle=rgba(strand%3 ? color.map(c=>Math.min(255,c+62)) : [8,6,19],opacity*(strand%3 ? .11 : .22));
        paint.lineWidth=(strand%3 ? .45 : 1.15)*scale;paint.stroke();
      }
      paint.restore();
      // Filaments libres : lignes issues du même geste de pinceau, pas d’orbites.
      for(let strand=0;strand<4;strand++) {
        paint.beginPath();
        const side=strand%2 ? 1 : -1;
        points.forEach((p,i) => {
          const feather=Math.pow(Math.sin(i/(points.length-1)*Math.PI),.75);
          const r=(p.radius*(1.35+strand*.18)+Math.sin(i*.031+strand)*12*scale)*feather;
          paint[i?'lineTo':'moveTo'](p.x+side*p.nx*r,p.y+side*p.ny*r);
        });
        paint.strokeStyle=rgba(color.map(c=>Math.min(255,c+35)),opacity*.36);paint.lineWidth=(.35+strand*.17)*scale;paint.stroke();
      }
      // Des grains de pigment deviennent de l’or, puis quittent le geste en douceur.
      const goldDust=smooth((seconds-3.05)/1.15)*(1-smooth((seconds-5.7)/.65));
      if (goldDust>0) for(let i=0;i<32;i++) {
        const p=points[Math.floor(((i*.618+seconds*.07)%1)*(points.length-1))];
        const offset=Math.sin(i*2.37+seconds*.8)*p.radius*1.7;
        const x=p.x+p.nx*offset,y=p.y+p.ny*offset;
        paint.strokeStyle=rgba(gold,goldDust*(.32+.38*(.5+.5*Math.sin(i*5.1))));paint.lineWidth=(.55+(i%4)*.27)*scale;
        paint.beginPath();paint.moveTo(x,y);paint.lineTo(x+scale*.5,y-scale*1.5);paint.stroke();
      }
      paint.restore();
    }
    function revealLogo(seconds, reduced) {
      if (!reduced && seconds < cfg.revealAt) return;
      const progress = reduced ? 1 : clamp((seconds-cfg.revealAt)/(cfg.holdAt-cfg.revealAt));
      if (progress===1) { ctx.drawImage(logo,rect.x,rect.y,rect.width,rect.height);return; }
      const w=mask.width,h=mask.height;
      logoCtx.globalCompositeOperation='source-over';logoCtx.clearRect(0,0,w,h);logoCtx.drawImage(logo,0,0,w,h);
      if (progress < 1) {
        maskCtx.clearRect(0,0,w,h);
        const front=(progress*1.36-.18)*w;
        const contour=[];
        for(let y=-12;y<=h+12;y+=4) {
          const x=front+Math.sin(y/h*9+progress*4)*w*.032+Math.sin(y*.16+progress*7)*w*.008;
          contour.push([x,y]);
        }
        maskCtx.beginPath();maskCtx.moveTo(-w,-12);contour.forEach(p=>maskCtx.lineTo(...p));maskCtx.lineTo(-w,h+12);maskCtx.closePath();
        maskCtx.fillStyle='#fff';maskCtx.fill();
        // Bord du masque fibreux : le PNG conserve ses pixels et son propre alpha.
        maskCtx.beginPath();contour.forEach((p,i)=>maskCtx[i?'lineTo':'moveTo'](...p));
        maskCtx.strokeStyle='rgba(255,255,255,.55)';maskCtx.lineWidth=w*.009;maskCtx.shadowColor='#fff';maskCtx.shadowBlur=w*.009;maskCtx.stroke();maskCtx.shadowBlur=0;
        logoCtx.globalCompositeOperation='destination-in';logoCtx.drawImage(mask,0,0);logoCtx.globalCompositeOperation='source-over';
      }
      ctx.save();
      if (progress < 1) { ctx.shadowColor=rgba(gold,.32*Math.sin(progress*Math.PI));ctx.shadowBlur=14; }
      ctx.drawImage(revealed,rect.x,rect.y,rect.width,rect.height);ctx.restore();
      // Le reflet disparaît avant la pose finale : PNG exact, sans filtre à 6 s.
      if (!reduced && progress > .12 && seconds < cfg.holdAt) {
        lightCtx.clearRect(0,0,w,h);
        const sweep=(progress*1.65-.34)*w;
        const gradient=lightCtx.createLinearGradient(sweep-w*.07,0,sweep+w*.07,h);
        gradient.addColorStop(0,'#ffe9a900');gradient.addColorStop(.46,'#ffce6240');gradient.addColorStop(.5,'#fff5cbba');gradient.addColorStop(.55,'#ffce6240');gradient.addColorStop(1,'#ffe9a900');
        lightCtx.fillStyle=gradient;lightCtx.fillRect(0,0,w,h);lightCtx.globalCompositeOperation='destination-in';lightCtx.drawImage(revealed,0,0);lightCtx.globalCompositeOperation='source-over';
        ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=1-smooth((seconds-5.75)/.25);ctx.drawImage(glint,rect.x,rect.y,rect.width,rect.height);ctx.restore();
      }
    }
    function draw(seconds, reduced = false) {
      ctx.fillStyle='#050608';ctx.fillRect(0,0,width,height);
      if (!reduced) {
        const convergence=smooth((seconds-cfg.convergeAt)/(cfg.revealAt-cfg.convergeAt));
        const opacity=1-smooth((seconds-4.65)/1.7);
        if (seconds>=cfg.birthAt && opacity>0) {
          paint.clearRect(0,0,width,height);
          strokes.forEach((_,i)=>ribbon(i,seconds,convergence,opacity));
          paint.save();paint.globalCompositeOperation='destination-out';paint.fillStyle=grainPattern;paint.fillRect(0,0,width,height);paint.restore();
          ctx.drawImage(layer,0,0,width,height);
        }
        const count=width < cfg.mobileBreakpoint ? cfg.mobileDustCount : cfg.dustCount;
        const goldPhase=smooth((seconds-3.2)/1.6), dustFade=1-smooth((seconds-6)/1);
        for(let i=0;i<count;i++) {
          const d=dust[i], travel=smooth((seconds-3.05)/2.2)*.70;
          const x=mix(d.x,d.goalX,travel)*width+Math.sin(seconds*.45+d.seed)*12;
          const y=mix(d.y,d.goalY,travel)*height-seconds*3+Math.cos(seconds*.38+d.seed)*9;
          const alpha=(.12+.36*(.5+.5*Math.sin(d.seed+seconds*1.1)))*dustFade;
          const color=colors[i%5].map((c,k)=>mix(190+(k===2?0:25),gold[k],goldPhase));
          ctx.strokeStyle=rgba(color,alpha);ctx.lineWidth=d.size;
          ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+d.size*.6,y-d.size*1.25);ctx.stroke();
        }
      }
      revealLogo(seconds,reduced);
    }
    resize();
    return { draw, resize, get layout() { return {...rect,viewportWidth:width,viewportHeight:height,pixelRatio:ratio}; },
      dispose() { [canvas,layer,mask,revealed,glint,grain].forEach(c=>{c.width=c.height=1;}); } };
  }
  E.IntroPaint = { create };
}());
