'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser}=require('../scripts/export-menu-gif');
(async()=>{const site=await startStaticServer();let browser;
try{
 browser=await startBrowser();const p=browser.page;
 await p.send('Page.navigate',{url:site.url+'?intro=0'});
 await p.waitFor('window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()');
 await p.waitFor("['Mazzeru','Farmer','Shepherd','Warrior','Hunter','Ravager','Villager','Orcu','Lupu','Surpatore','Fullettu','Roccapina'].every(n=>Eredita[n+'Model']?.ready)",30000);
 const result=await p.evaluate(`(()=>{
  const E=Eredita,s=window.walkState=E.GameView.getState();s.phase='running';s.paused=true;s.preparationRemaining=0;s.units=[];
  for(const player of Object.values(s.players))for(const v of player.villages){v.biome='plaine';v.residents=[];v.animals=[];}
  const figures=()=>E.Board3D.getXRContext().world.children[1].children;
  const get=key=>figures().find(f=>f.userData.visualKey===key);
  const update=()=>E.Board3D.update(s,true);
  const checks=[];function check(name,ok){if(!ok)throw Error(name);checks.push(name);}
  const heading=(f,dx,dz)=>Math.cos(f.rotation.y)*dz+Math.sin(f.rotation.y)*dx;
  for(const owner of ['red','blue'])for(const [i,profession] of ['agriculteur','berger','chasseur'].entries()){
   const r={id:owner+profession,profession,mission:profession==='agriculteur'?'agriculture':profession==='berger'?'elevage':'chasse',workPhase:'toField',workPosition:30,workLaneOffset:0,hp:50};
   s.players[owner].villages[0].residents.push(r);update();let f=get('resident-'+owner+'-'+r.id);
   const anim=f.userData.farmer||f.userData.shepherd||f.userData.hunter;
   for(const direction of [1,-1]){r.workPosition+=direction;update();check(owner+profession+' forward '+direction,heading(f,0,direction)>0.99);anim.tick(.05,false);check(owner+profession+' Marche '+direction,anim.action==='Marche');}
   if(profession==='chasseur'){r.workLaneOffset+=.1;update();check(owner+' lateral worker',heading(f,1,0)>.99);}
   const rotation=f.rotation.y;update();check(owner+profession+' stop keeps direction',f.rotation.y===rotation);anim.tick(.05,false);check(owner+profession+' stops walking',anim.action==='Repos');
  }
  const models=[['guerrier'],['ravageur'],['chasseur'],['habitant'],['pecheur'],['chien'],['sanglier'],['habitant','u-mazzeru'],['habitant','l-orcu'],['habitant','lion-roccapina'],['habitant','u-fullettu'],['habitant','u-lupu-mannaru'],['habitant','u-surpatore']];
  for(const owner of ['red','blue'])for(const [profession,legend] of models){
   const role=E.Config.units[profession]?profession:'habitant',u=E.Units.create(owner,0,role,{profession});u.position=35;u.mythologyLegendId=legend;u.isLegend=!!legend;if(legend==='u-surpatore')u.mythologyForm='vampire';
   s.units.push(u);update();const f=get('unit-'+u.id);const a=f.userData.mazzeru||f.userData.villager||f.userData.simpleWalk||f.userData.roccapina||f.userData.orcu||f.userData.fullettu||f.userData.lupu||f.userData.surpatore||f.userData.warrior||f.userData.hunter||f.userData.ravager;
   check(owner+profession+legend+' has locomotion',!!a);
   for(const direction of [1,-1]){u.position+=direction;update();check(owner+profession+legend+' heading '+direction,heading(f,0,direction)>.99);}
   const x=f.position.x,z=f.position.z;u.lanePosition=.25;u.position+=1;update();const dx=f.position.x-x,dz=f.position.z-z;check(owner+profession+legend+' diagonal',heading(f,dx,dz)/Math.hypot(dx,dz)>.999);
   if(a===f.userData.villager){
    const left=f.getObjectByName('marche-jambe-gauche'),right=f.getObjectByName('marche-jambe-droite');
    a.tick(.05,false);check(owner+' villager legs alternate',left.rotation.x!==0 && left.rotation.x===-right.rotation.x);
    const angle=left.rotation.x;a.tick(.05,true);check(owner+' villager legs pause',angle===left.rotation.x);
   }
   if(legend==='lion-roccapina'){
    let leg;f.traverse(b=>{if(b.isBone&&/LeftUpLeg$/.test(b.name))leg=b;});const before=leg.quaternion.clone();a.tick(.05,false);
    check(owner+' Roccapina walks with legs',!leg.quaternion.equals(before));
   }
   const t=a.time;a.tick(.05,true);if(t!==undefined)check(owner+profession+legend+' pause',a.time===t);
   if(a===f.userData.simpleWalk){const part=f.children.find(c=>!c.name.includes('equipe'));const before=part.position.y;a.tick(.05,false);check(owner+profession+' fallback walk',part.position.y!==before);}
  }
  const before=JSON.stringify(s);update();check('render preserves rules',JSON.stringify(s)===before);
  return checks;
 })()`);
 assert.ok(result.length>100);
 await p.evaluate(`(()=>{
  const E=Eredita,T=E.Board3D.getXRContext().THREE,scene=new T.Scene();scene.background=new T.Color('#d6d1c4');
  scene.add(new T.HemisphereLight(0xffffff,0x777777,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,5,4);scene.add(light);
  const models=[E.FarmerModel.create('red'),E.ShepherdModel.create('red'),E.VillagerModel.create('red')];
  models.forEach((f,i)=>{f.position.x=(i-1)*1.2;f.rotation.y=Math.PI/4;scene.add(f);const a=f.userData.farmer||f.userData.shepherd||f.userData.villager;a.setMoving(true);for(let j=0;j<3;j++)a.tick(.05,false);});
  const camera=new T.PerspectiveCamera(35,1.8,.01,100);camera.position.set(3,2,5);camera.lookAt(0,.6,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1000,556);renderer.render(scene,camera);
  const d=document.createElement('dialog');d.style.cssText='border:0;padding:0';d.append(renderer.domElement);document.body.append(d);d.showModal();
 })()`);
 const shot=await p.send('Page.captureScreenshot',{format:'png'});const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'locomotion-workers.png'),Buffer.from(shot.data,'base64'));
 assert.deepEqual(p.errors,[]);console.log(result.length+' contrôles : marche et orientation aller/retour, diagonales, deux camps, métiers/légendes/animaux, arrêt, pause et rendu sans mutation validés.');
}finally{if(browser)await browser.close();await new Promise(r=>site.server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
