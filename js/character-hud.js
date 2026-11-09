(function () {
  'use strict';
  const E = window.Eredita = window.Eredita || {};
  let THREE, planeGeometry;
  const rings = new Map();
  const tierOf = (item, armor = false) => (armor ? {cuir:1,maille:2,fer:3} : {bois:1,bronze:2,fer:3})[item] || 0;
  const iconOf = person => E.Config.specialAnimals[person.animalType]?.icon || E.Config.professions[person.profession || 'habitant']?.icon || '👤';

  const getStats = (state, village, person) => E.Economy.residentStats(state, village, person);

  function init(three) { THREE=three; planeGeometry=new THREE.PlaneGeometry(1,1); }
  function texture(canvas) {
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.generateMipmaps=false;map.minFilter=THREE.LinearFilter;return map;
  }
  function weapon(c,x,y,color,shield) {
    c.save();c.translate(x,y);c.fillStyle='#171c2c';c.strokeStyle=color;c.lineWidth=2;
    c.beginPath();c.arc(0,0,19,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=color;c.lineWidth=2;c.strokeStyle='#172032';
    c.beginPath();
    if(shield){c.moveTo(-10,-12);c.lineTo(10,-12);c.lineTo(9,1);c.quadraticCurveTo(6,10,0,14);c.quadraticCurveTo(-8,8,-9,1);c.closePath();}
    else{c.moveTo(-3,5);c.lineTo(-3,-10);c.lineTo(0,-16);c.lineTo(4,-10);c.lineTo(3,5);c.lineTo(9,5);c.lineTo(9,9);c.lineTo(2,9);c.lineTo(2,15);c.lineTo(-2,15);c.lineTo(-2,9);c.lineTo(-9,9);c.lineTo(-9,5);c.closePath();}
    c.fill();c.stroke();c.restore();
  }
  function ringTexture(person, allied) {
    const tool=person.isLegend?0:tierOf(person.tool),armor=person.isLegend?0:tierOf(person.armor,true),icon=iconOf(person);
    const key=`${icon}:${allied}:${tool}:${armor}`;if(rings.has(key))return rings.get(key);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),cfg=E.Config.characterHud;
    const color=allied?cfg.ally:cfg.enemy;
    c.translate(128,124);
    const glow=c.createRadialGradient(0,0,67,0,0,112);glow.addColorStop(0,color+'12');glow.addColorStop(.65,color+'78');glow.addColorStop(1,color+'00');
    c.fillStyle=glow;c.fillRect(-122,-122,244,244);c.beginPath();c.arc(0,0,89,0,Math.PI*2);c.fillStyle=color+'28';c.fill();
    c.strokeStyle=color;c.lineWidth=6;c.shadowColor=color;c.shadowBlur=12;c.stroke();c.shadowBlur=0;
    c.beginPath();c.arc(0,0,76,0,Math.PI*2);c.strokeStyle=color+'77';c.lineWidth=2;c.stroke();
    c.font='58px system-ui, Apple Color Emoji, Segoe UI Emoji';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f8fcff';c.fillText(icon,0,2);
    weapon(c,-80,90,cfg.tiers[tool],false);weapon(c,-36,90,cfg.tiers[armor],true);
    const map=texture(canvas);rings.set(key,map);return map;
  }
  function drawHealth(hud,hp,maxHp,allied) {
    const key=`${Math.ceil(hp)}/${Math.ceil(maxHp)}:${allied}`;if(hud.healthKey===key)return;hud.healthKey=key;
    const c=hud.canvas.getContext('2d'),color=allied?E.Config.characterHud.ally:E.Config.characterHud.enemy;c.clearRect(0,0,256,80);
    c.font='bold 27px system-ui';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.strokeStyle='#101427';c.lineWidth=7;
    c.strokeText(`${Math.ceil(Math.max(0,hp))}/${Math.ceil(maxHp)}`,128,22);c.fillStyle='#fff';c.fillText(`${Math.ceil(Math.max(0,hp))}/${Math.ceil(maxHp)}`,128,22);
    c.beginPath();c.roundRect(9,43,238,25,12);c.fillStyle='#17243c';c.fill();c.lineWidth=4;c.strokeStyle='#091322';c.stroke();
    const width=Math.max(0,Math.min(1,hp/maxHp))*230;if(width){c.beginPath();c.roundRect(13,47,Math.max(2,width),17,8);c.fillStyle=color;c.fill();}
    hud.health.material.map.needsUpdate=true;
  }
  function sync(figure,person,allied) {
    if(!THREE)return;
    let hud=figure.userData.characterHud;const cfg=E.Config.characterHud;
    if(!hud){
      const box=new THREE.Box3().setFromObject(figure),height=Math.max(.15,box.max.y-figure.position.y)/figure.scale.y;
      const group=new THREE.Group();group.name='character-hud';
      const floor=new THREE.Mesh(planeGeometry,new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide}));
      floor.name='character-profession-ring';floor.userData.sharedGeometry=true;floor.rotation.x=-Math.PI/2;floor.position.y=.017;floor.scale.setScalar(cfg.ringSize);floor.renderOrder=3;
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;
      const health=new THREE.Sprite(new THREE.SpriteMaterial({map:texture(canvas),transparent:true,depthWrite:false,depthTest:false}));
      health.name='character-health';health.userData.sharedGeometry=true;health.scale.set(cfg.healthWidth,cfg.healthHeight,1);health.renderOrder=25;
      group.add(floor,health);figure.add(group);hud={group,floor,health,canvas,height};figure.userData.characterHud=hud;
    }
    hud.group.visible=!figure.userData.dying;hud.group.quaternion.copy(figure.quaternion).invert();hud.group.scale.set(1/figure.scale.x,1/figure.scale.y,1/figure.scale.z);
    hud.floor.material.map=ringTexture(person,allied);hud.health.position.y=hud.height*figure.scale.y+cfg.healthGap;
    const maxHp=Math.max(1,Number(person.maxHp)||1),hp=Math.max(0,Number(person.hp)||0);hud.health.visible=hp>0&&hp<maxHp-.0001;
    if(hud.health.visible)drawHealth(hud,hp,maxHp,allied);
    Object.assign(hud.group.userData,{allied,profession:person.profession||'habitant',hp,maxHp,toolTier:person.isLegend?0:tierOf(person.tool),armorTier:person.isLegend?0:tierOf(person.armor,true)});
  }
  function dispose(figure) { figure.userData.characterHud?.health.material.map.dispose(); }
  function svg(shield,color) {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="${color}" stroke="#172032" stroke-width="2" d="${shield?'M5 4h22l-1 14q-3 8-10 11Q8 24 6 18Z':'M13 19V7l3-5 4 5v12h7v4h-9v7h-4v-7H5v-4Z'}"/></svg>`;
  }
  function html(person,allied) {
    const cfg=E.Config.characterHud,maxHp=Math.max(1,Number(person.maxHp)||1),hp=Math.max(0,Number(person.hp)||0),tool=person.isLegend?0:tierOf(person.tool),armor=person.isLegend?0:tierOf(person.armor,true);
    return `<span class="character-floor ${allied?'allied':'enemy'}" aria-hidden="true"><b>${iconOf(person)}</b><i class="character-gear">${svg(false,cfg.tiers[tool])}${svg(true,cfg.tiers[armor])}</i></span>${hp>0&&hp<maxHp-.0001?`<span class="character-hp ${allied?'allied':'enemy'}" role="meter" aria-label="Points de vie" aria-valuenow="${Math.ceil(hp)}" aria-valuemax="${Math.ceil(maxHp)}"><b>${Math.ceil(hp)}/${Math.ceil(maxHp)}</b><i style="width:${Math.min(1,hp/maxHp)*100}%"></i></span>`:''}`;
  }
  E.CharacterHUD={init,getStats,sync,dispose,html,tierOf};
}());
