'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif');
(async()=>{const site=await startStaticServer();let browser;try{
 browser=await startBrowser();const p=browser.page;
 await p.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:(process.env.EREDITA_TEST_URL||site.url)+'?intro=0'});
 await p.waitFor('window.Eredita?.Board3D?.ready&&Eredita.GameView?.getState()');
 await p.waitFor('Eredita.ConstructionSites.ready&&Eredita.VillageModels.ready',45000);
 await p.click('[data-menu-screen="play"]');await p.click('#training-button');await p.waitFor("Eredita.Network.mode==='solo'");
 await p.evaluate(`(()=>{const E=Eredita,s=window.cState=E.GameView.getState();E.AI.update=()=>false;s.phase='running';s.preparationRemaining=3600;s.paused=false;s.units=[];s.selectedVillage={playerId:'red',lane:0};
 for(const player of Object.values(s.players)){player.gold=10000;for(const v of player.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.buildings=[];v.terrain={};v.destroyed=false;}}
 E.UI.render(s);E.Board3D.update(s,true);document.querySelectorAll('dialog[open]').forEach(d=>d.close());
 window.cTile=(lane=0)=>E.Board3D.getXRContext().terrainGroup.children.find(g=>g.userData.playerId==='red'&&g.userData.lane===lane);
 window.cPoint=type=>{const ctx=E.Board3D.getXRContext(),T=ctx.THREE,root=cTile().getObjectByName('chantier-'+type),rect=ctx.renderer.domElement.getBoundingClientRect();ctx.world.updateMatrixWorld(true);const pos=new T.Box3().setFromObject(root).getCenter(new T.Vector3()).project(ctx.camera),x=rect.left+(pos.x+1)*rect.width/2,y=rect.top+(1-pos.y)*rect.height/2;
 for(const radius of [0,4,9,15,24,38,60])for(let i=0;i<(radius?12:1);i++){const px=x+Math.cos(i*Math.PI/6)*radius,py=y+Math.sin(i*Math.PI/6)*radius,target=E.Board3D.targetAt(px,py);if(target?.kind==='building'&&target.playerId==='red'&&target.lane===0&&target.buildingType===type&&document.elementFromPoint(px,py)===ctx.renderer.domElement)return{x:px,y:py};}throw Error('Chantier non cliquable : '+type);};
 })()`);
 assert.deepEqual(await p.evaluate('Eredita.ConstructionSites.diagnostics'),{ready:true,error:null,batches:1,triangles:1425});
 const shared=await p.evaluate(`(()=>{const a=cTile().getObjectByName('chantier-bergerie'),b=cTile(1).getObjectByName('chantier-artisanat'),T=Eredita.Board3D.getXRContext().THREE;const size=new T.Box3().setFromObject(a).getSize(new T.Vector3());return{shared:a.children[0].geometry===b.children[0].geometry,textures:a.children[0].material.map===b.children[0].material.map,mode:a.userData.constructionModel,height:size.y};})()`);
 assert.equal(shared.shared,true);assert.equal(shared.textures,true);assert.equal(shared.mode,'tripo');assert.ok(shared.height<=.441);
 const folder=process.env.EREDITA_CONSTRUCTION_PREVIEW_DIR;
 if(folder){fs.mkdirSync(folder,{recursive:true});const preview=await p.evaluate(`(()=>{const T=Eredita.Board3D.getXRContext().THREE,scene=new T.Scene();scene.background=new T.Color('#211c14');scene.add(new T.HemisphereLight(0xffebcf,0x655342,3));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-2,5,5);scene.add(light);['bergerie','artisanat','boucherie'].forEach((type,i)=>{const g=Eredita.ConstructionSites.create(T,type);g.position.x=(i-1)*.9;scene.add(g);});const camera=new T.OrthographicCamera(-1.5,1.5,.6,-.6,.01,20);camera.position.set(.9,1.5,5);camera.lookAt(0,.2,0);const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1200,480);renderer.render(scene,camera);const data=renderer.domElement.toDataURL();renderer.dispose();return data;})()`);fs.writeFileSync(path.join(folder,'chantiers-tripo.png'),Buffer.from(preview.split(',')[1],'base64'));
 const shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(folder,'carte-chantiers-tripo.png'),Buffer.from(shot.data,'base64'));}
 for(const type of ['bergerie','artisanat','boucherie']){
  const point=await p.evaluate('cPoint('+JSON.stringify(type)+')');await p.send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});await p.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  assert.match(await p.evaluate("document.querySelector('#map-selection header').textContent"),/Chantier/);
  await p.click('[data-map-action="build"]');assert.equal(await p.evaluate(`!!cTile().getObjectByName('chantier-${type}')`),false);assert.equal(await p.evaluate(`!!cTile().getObjectByName('batiment-${type}')`),true);
  assert.equal(await p.evaluate(`cTile(1).getObjectByName('chantier-${type}').userData.constructionModel`),'tripo');await p.click('[data-map-action="close"]');
 }
 assert.equal(await p.evaluate('cState.players.red.gold'),9400);assert.equal(await p.evaluate('cState.players.red.villages[0].buildings.length'),3);
 await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(100);assert.equal(await p.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);assert.deepEqual(p.badResponses.filter(u=>/\/(js|css|assets)\//.test(u)),[]);
 console.log('Chantiers Tripo : chargement, 1 425 triangles, emprise, géométrie/textures partagées, trois pictogrammes, clics et remplacement indépendant après achat validés.');
 }finally{await browser?.close();await new Promise(r=>site.server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
