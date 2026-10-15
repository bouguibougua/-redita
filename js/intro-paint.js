(function () {
  'use strict';
  const E = window.Eredita;
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const rgb = hex => [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const rgba = (color, alpha) => `rgba(${color.map(Math.round).join(',')},${clamp(alpha)})`;
  function create(canvas, logo, cfg) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const mask = document.createElement('canvas');
    const revealed = document.createElement('canvas'), glint = document.createElement('canvas');
    const maskCtx = mask.getContext('2d');
    const logoCtx = revealed.getContext('2d'), lightCtx = glint.getContext('2d');
    const gold = rgb(cfg.revealColor);
    let width, height, ratio, rect;
    function resize() {
      width = Math.max(1, canvas.parentElement.clientWidth);
      height = width * logo.height / logo.width;
      ratio = Math.min(devicePixelRatio || 1, cfg.maxPixelRatio, cfg.maxCanvasEdge / Math.max(width,height));
      canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
      canvas.style.height = `${height}px`;
      ctx.setTransform(ratio,0,0,ratio,0,0);
      rect = { x:0, y:0, width, height };
      mask.width = revealed.width = glint.width = Math.max(1,Math.round(rect.width*ratio));
      mask.height = revealed.height = glint.height = Math.max(1,Math.round(rect.height*ratio));
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
      // Le reflet disparaît avant le retour à l’image du menu.
      if (!reduced && progress > .12 && seconds < cfg.holdAt) {
        lightCtx.clearRect(0,0,w,h);
        const sweep=(progress*1.65-.34)*w;
        const gradient=lightCtx.createLinearGradient(sweep-w*.07,0,sweep+w*.07,h);
        gradient.addColorStop(0,'#ffe9a900');gradient.addColorStop(.46,'#ffce6240');gradient.addColorStop(.5,'#fff5cbba');gradient.addColorStop(.55,'#ffce6240');gradient.addColorStop(1,'#ffe9a900');
        lightCtx.fillStyle=gradient;lightCtx.fillRect(0,0,w,h);lightCtx.globalCompositeOperation='destination-in';lightCtx.drawImage(revealed,0,0);lightCtx.globalCompositeOperation='source-over';
        ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=1-smooth((progress-5/6)*6);ctx.drawImage(glint,rect.x,rect.y,rect.width,rect.height);ctx.restore();
      }
    }
    function draw(seconds, reduced = false) {
      ctx.clearRect(0,0,width,height);
      revealLogo(seconds,reduced);
    }
    resize();
    return { draw, resize, get layout() { return {...rect,viewportWidth:width,viewportHeight:height,pixelRatio:ratio}; },
      dispose() { [canvas,mask,revealed,glint].forEach(c=>{c.width=c.height=1;}); } };
  }
  E.IntroPaint = { create };
}());
