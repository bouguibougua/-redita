(function () {
  'use strict';
  const E=window.Eredita;
  // Présentation seulement : le survol n'autorise jamais une transaction.
  function create(config) {
    const clamp=value=>Math.max(-1,Math.min(1,value));
    function point(record,event,canvas,sceneConfig) {
      if(!event){record.hoverPointer={x:0,y:0};return;}
      const basket=event.target?.closest?.('[data-shop-basket]');
      if(basket){
        const rect=basket.getBoundingClientRect();
        record.hoverPointer={x:clamp((event.clientX-rect.left)/rect.width*2-1),y:clamp(1-(event.clientY-rect.top)/rect.height*2)};
        return;
      }
      const rect=canvas.getBoundingClientRect();
      const [left,top,width,height]=record.hitBounds;
      const x=(event.clientX-rect.left)/rect.width*sceneConfig.width;
      const y=(event.clientY-rect.top)/rect.height*sceneConfig.height;
      record.hoverPointer={x:clamp((x-left)/width*2-1),y:clamp(1-(y-top)/height*2)};
    }
    function update(record,active,dt,reduced) {
      const ease=1-Math.exp(-config.response*dt),target=active&&!record.sold?1:0;
      record.amount+=(target-record.amount)*ease;
      if(!target&&record.amount<.0001)record.amount=0;
      const amount=reduced?0:record.amount,tilt=record.hoverTilt,pointer=record.hoverPointer;
      tilt.x+=((target?-pointer.y*config.tiltX:0)-tilt.x)*ease;
      tilt.y+=((target?pointer.x*config.tiltY:0)-tilt.y)*ease;
      if(!target&&Math.abs(tilt.x)+Math.abs(tilt.y)<.0001)tilt.x=tilt.y=0;
      const scale=1+(config.scale-1)*amount;
      record.display.position.set(0,config.lift*amount,config.depth*amount);
      record.display.rotation.set(reduced?0:tilt.x*amount,reduced?0:tilt.y*amount,0);
      record.display.scale.set(scale,scale*(reduced?1:record.breath||1),scale);
    }
    return {point,update};
  }
  E.ShopHover={create};
}());
