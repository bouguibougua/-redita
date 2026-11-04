'use strict';
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif');
async function run(){
 const site=await startStaticServer();let browser;
 try{
  browser=await startBrowser();const p=browser.page;
  await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await p.send('Page.navigate',{url:(process.env.EREDITA_TEST_URL||site.url)+'?intro=0'});
  await p.waitFor('window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()');
  await p.waitFor('Eredita.FarmerModel?.ready || Eredita.FarmerModel?.diagnostics.error',30000);
  const d=await p.evaluate('Eredita.FarmerModel.diagnostics');assert.equal(d.error,null);assert.equal(d.triangles,18000);assert.deepEqual(d.clips.sort(),['Frappe','Marche','Mort','Recolte','Repos']);
  await p.waitFor('Eredita.VillagerModel?.ready',30000);
  await p.click('[data-menu-screen="play"]');await p.click('#training-button');await p.waitFor("Eredita.Network.mode==='solo'");
  await p.evaluate(`(()=>{const E=Eredita,s=window.fState=E.GameView.getState();s.phase='running';s.paused=true;s.preparationRemaining=0;s.units=[];s.unitDeathEffects=[];
  for(const player of Object.values(s.players))for(const v of player.villages){v.biome='plaine';v.residents=v.lane===0?v.residents.slice(0,1):[];for(const r of v.residents)Object.assign(r,{profession:'agriculteur',mission:'agriculture',workPosition:20,workPhase:'toField',tool:null,armor:null,unitId:null,hp:50});}
  window.fResident=id=>s.players[id].villages[0].residents[0];s.selectedVillage={playerId:'red',lane:0};s.selectedResidentId=fResident('red').id;
  E.UI.render(s);E.Board3D.update(s,true);E.Board3D.setMode(true);document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  window.fFigures=()=>E.Board3D.getXRContext().world.children[1].children;window.fFind=id=>fFigures().find(f=>!f.userData.dying&&f.userData.visualSignature.startsWith(id+':'));
  window.fRed=fFind('red');window.fBlue=fFind('blue');window.fMesh=f=>{let m;f.traverse(p=>{if(!m&&p.isSkinnedMesh)m=p;});return m;};
  window.fPoint=(f,name)=>{const T=E.Board3D.getXRContext().THREE;f.updateMatrixWorld(true);return fMesh(f).skeleton.bones.find(b=>b.name===name).getWorldPosition(new T.Vector3()).toArray();};
  window.fAdvance=(f,n)=>{for(let i=0;i<n;i++)f.userData.farmer.tick(.04,false);};window.fDisposed=0;fMesh(fRed).geometry.addEventListener('dispose',()=>fDisposed++);})()`);
  assert.equal(await p.evaluate('fFigures().length'),2);
  assert.equal(await p.evaluate('fMesh(fRed).geometry===fMesh(fBlue).geometry && fMesh(fRed).material.map===fMesh(fBlue).material.map'),true);
  assert.equal(await p.evaluate('fMesh(fRed).material===fMesh(fBlue).material || fMesh(fRed).skeleton.bones[0]===fMesh(fBlue).skeleton.bones[0]'),false);
  await p.evaluate("fResident('red').workPosition=21;Eredita.Board3D.update(fState,true);fAdvance(fRed,8)");assert.equal(await p.evaluate('fRed.userData.farmer.action'),'Marche');
  await p.evaluate("fResident('red').workPhase='harvesting';Eredita.Board3D.update(fState,true);fAdvance(fRed,1)");assert.equal(await p.evaluate('fRed.userData.farmer.action'),'Recolte');
  const pose=()=>p.evaluate("({head:fPoint(fRed,'head'),hip:fPoint(fRed,'pelvis'),foot:fPoint(fRed,'footL'),hand:fPoint(fRed,'handR')})");
  const standing=await pose(),blue=await p.evaluate("fPoint(fBlue,'head')");await p.evaluate('fAdvance(fRed,35)');const squat=await pose();
  assert.ok(standing.head[1]-squat.head[1]>.12,'La tête descend');assert.ok(standing.hip[1]-squat.hip[1]>.08,'Le bassin descend');assert.ok(standing.hand[1]-squat.hand[1]>.08,'La main récolte');assert.ok(Math.abs(standing.foot[1]-squat.foot[1])<.008,'Les pieds restent au sol');
  assert.deepEqual(await p.evaluate("fPoint(fBlue,'head')"),blue,'Squelettes indépendants');const at=await p.evaluate('fRed.userData.farmer.time');await delay(220);assert.equal(await p.evaluate('fRed.userData.farmer.time'),at,'Pause');
  if(process.env.EREDITA_FARMER_PREVIEW_DIR){fs.mkdirSync(process.env.EREDITA_FARMER_PREVIEW_DIR,{recursive:true});const shot=await p.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.env.EREDITA_FARMER_PREVIEW_DIR,'agriculteur-recolte-jeu.png'),Buffer.from(shot.data,'base64'));}
  for(const phase of ['toVillage','villageStop','waitingForWork']){await p.evaluate(`fResident('red').workPhase=${JSON.stringify(phase)};Eredita.Board3D.update(fState,true);fAdvance(fRed,8)`);assert.equal(await p.evaluate('fRed.userData.farmer.action'),'Repos',phase);}
  await p.evaluate("fResident('red').mission='elevage';fResident('red').workPhase='harvesting';Eredita.Board3D.update(fState,true);fAdvance(fRed,8)");assert.equal(await p.evaluate('fRed.userData.farmer.action'),'Repos','Autre tâche');
  await p.evaluate("fResident('blue').profession='habitant';fResident('blue').workPhase='harvesting';Eredita.Board3D.update(fState,true)");assert.equal(await p.evaluate("!!fFind('blue').getObjectByName('habitant-sans-metier') && !fFind('blue').userData.farmer"),true,'Métier indépendant');
  await p.evaluate("fResident('red').tool='fer';fResident('red').armor='maille';fResident('red').donkey=true;Eredita.Board3D.update(fState,true);fRed=fFind('red');void 0");
  assert.equal(await p.evaluate("!!fRed.getObjectByName('outil-tete') && !!fRed.getObjectByName('armure-maille') && !!fRed.getObjectByName('animal-ane')"),true,'Équipement');assert.equal(await p.evaluate("fRed.getObjectByName('outil-tete').parent.name"),'handR');assert.equal(await p.evaluate('fDisposed'),0);
  assert.equal(await p.evaluate("Array.from(document.querySelectorAll('.profession-agriculteur')).every(el=>getComputedStyle(el).backgroundImage.includes('agriculteur-v1.png'))"),true);
  await p.evaluate(`(()=>{const E=Eredita,r=fResident('red');r.mission='attaque';const u=E.Units.create('red',0,'habitant',{residentId:r.id,profession:r.profession,tool:r.tool,armor:r.armor,donkey:r.donkey});r.unitId=u.id;u.position=45;u.waterTransport='barque';fState.units=[u];E.Board3D.update(fState,true);fRed=fFind('red');})()`);
  assert.equal(await p.evaluate("fFigures().length===2 && !!fRed.getObjectByName('agriculteur-modele') && fRed.userData.waterTransport==='barque' && !fRed.userData.farmer.harvesting"),true,'Transport');
  const rules=await p.evaluate('JSON.stringify(fState.players)+JSON.stringify(fState.units)');await p.evaluate('Eredita.Board3D.update(fState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');assert.equal(await p.evaluate('JSON.stringify(fState.players)+JSON.stringify(fState.units)'),rules,'Rendu sans effet sur les règles');
  await p.evaluate('fState.units[0].visualAttackSequence=1;fState.units[0].visualAttackTimer=.3;Eredita.Board3D.update(fState,true)');assert.equal(await p.evaluate('fRed.userData.farmer.action'),'Frappe');await p.evaluate('fAdvance(fRed,25)');assert.equal(await p.evaluate('fRed.userData.farmer.action'),'Repos');
  await p.evaluate(`(()=>{const dead=fState.units.shift();fResident('red').hp=0;fState.unitDeathEffects=[{...dead,id:991,unitId:dead.id}];Eredita.Board3D.update(fState,true);window.fDead=fFigures().find(f=>f.userData.dying);})()`);assert.equal(await p.evaluate('fDead.userData.farmer.action'),'Mort');await p.evaluate('fAdvance(fDead,48)');await p.waitFor('!fFigures().includes(fDead)',3000);assert.equal(await p.evaluate('Eredita.FarmerModel.diagnostics.instances'),0);assert.equal(await p.evaluate('fDisposed'),0);
  assert.deepEqual(p.errors,[]);assert.deepEqual(p.consoleErrors,[]);assert.deepEqual(p.badResponses.filter(u=>/\/(assets|js)\//.test(u)),[]);
  console.log('Agriculteur : récolte accroupie, pieds au sol, phases, pause, équipement, transport et nettoyage validés.');
 }finally{await browser?.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
