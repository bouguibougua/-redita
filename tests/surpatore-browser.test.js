'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startStaticServer,startBrowser,delay}=require('../scripts/export-menu-gif');
async function run(){
  const site=await startStaticServer();let browser;
  try{
    browser=await startBrowser();const page=browser.page;
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
    await page.send('Page.navigate',{url:(process.env.EREDITA_TEST_URL||site.url)+'?intro=0'});
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.waitFor('Eredita.SurpatoreModel?.ready || Eredita.SurpatoreModel?.diagnostics.error',25000);
    const diagnostics=await page.evaluate('Eredita.SurpatoreModel.diagnostics');assert.equal(diagnostics.error,null);
    assert.deepEqual(diagnostics.clips.sort(),['Griffe','Marche','Mort','Repos']);
    await page.click('[data-menu-screen="play"]');await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    const invoked=await page.evaluate(`(()=>{
      const E=Eredita,s=window.vState=E.GameView.getState();s.phase='running';s.paused=false;s.preparationRemaining=0;s.elapsed=0;s.units=[];s.unitDeathEffects=[];
      s.reinforcementEpoch='surpatore-model';E.MythologyEffects.init(s);
      for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.terrain={};v.burnUntil=0;}
      const result=[];for(const owner of ['red','blue']){
        result.push(E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId:owner,legendId:'u-surpatore',target:{playerId:owner,lane:0},activationId:'surpatore-'+owner}).accepted);
      }
      s.units[0].position=39;s.units[1].position=49.5;s.paused=true;
      E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.vFigures=()=>E.Board3D.getXRContext().world.children[1].children;
      window.vFind=owner=>vFigures().find(f=>f.userData.surpatore&&!f.userData.dying&&f.userData.visualSignature.startsWith(owner+':'));
      const boarCount=vFigures().filter(f=>f.userData.visualSignature?.includes('u-surpatore:boar:')).length;
      const prematureVampires=vFigures().filter(f=>f.userData.surpatore).length;
      for(const u of s.units)u.hp=0;E.Combat.settleDeaths(s);E.Board3D.update(s,true);
      window.vRed=vFind('red');window.vBlue=vFind('blue');
      window.vMesh=f=>{let found;f.traverse(p=>{if(!found&&p.isSkinnedMesh)found=p;});return found;};
      window.vBoneObject=(f,suffix)=>vMesh(f).skeleton.bones.find(b=>b.name===({LeftFoot:'foot_l',RightHand:'hand_r',Jaw:'jaw',Hips:'pelvis'}[suffix]||suffix));
      window.vBone=(f,suffix)=>{const T=E.Board3D.getXRContext().THREE;f.updateMatrixWorld(true);return vBoneObject(f,suffix).getWorldPosition(new T.Vector3()).toArray();};
      window.vAdvance=(f,seconds)=>{for(let remaining=seconds;remaining>1e-8;remaining-=.05)f.userData.surpatore.tick(Math.min(.05,remaining),false);};
      return {accepted:result,boarCount,prematureVampires,liveVampires:vFigures().filter(f=>f.userData.surpatore&&!f.userData.dying).length,
        dyingVampires:vFigures().filter(f=>f.userData.surpatore&&f.userData.dying).length,
        stats:s.units.map(u=>({hp:u.hp,damage:u.damage,speed:u.speed,form:u.mythologyForm})),speed:E.Config.reinforcementPowers.vampireSpeed};
    })()`);
    assert.deepEqual(invoked.accepted,[true,true]);assert.equal(invoked.boarCount,2);assert.equal(invoked.prematureVampires,0);
    assert.equal(invoked.liveVampires,2,'La transformation conserve les vampires vivants dès le premier rendu');
    assert.equal(invoked.dyingVampires,0,'La mort du sanglier ne joue pas la mort du vampire');
    assert.ok(invoked.stats.every(u=>u.hp===40&&u.damage===11&&u.speed===invoked.speed&&u.form==='vampire'));
    const imported=await page.evaluate(`(()=>{
      const E=Eredita,T=E.Board3D.getXRContext().THREE,a=vMesh(vRed),b=vMesh(vBlue);
      window.vJawRest=vBoneObject(vRed,'Jaw').quaternion.clone();window.vDisposed=0;a.geometry.addEventListener('dispose',()=>vDisposed++);
      const jaw=vBoneObject(vRed,'Jaw'),jawIndex=a.skeleton.bones.indexOf(jaw),indices=a.geometry.attributes.skinIndex.array,weights=a.geometry.attributes.skinWeight.array;
      let jawSkinnedVertices=0,vertex=-1,strongest=0;
      for(let i=0;i<a.geometry.attributes.position.count;i++)for(let c=0;c<4;c++)if(indices[i*4+c]===jawIndex&&weights[i*4+c]>.001){jawSkinnedVertices++;if(weights[i*4+c]>strongest){strongest=weights[i*4+c];vertex=i;}break;}
      let jawDeformation=0;
      if(vertex>=0){vRed.updateMatrixWorld(true);a.skeleton.update();const before=a.getVertexPosition(vertex,new T.Vector3());jaw.rotateX(.4);vRed.updateMatrixWorld(true);a.skeleton.update();jawDeformation=before.distanceTo(a.getVertexPosition(vertex,new T.Vector3()));jaw.quaternion.copy(vJawRest);vRed.updateMatrixWorld(true);a.skeleton.update();}

      return {jawSkinnedVertices,jawDeformation,count:vFigures().filter(f=>f.userData.surpatore).length,triangles:a.geometry.index.count/3,
        shared:a.geometry===b.geometry,texturesShared:a.material.map===b.material.map,
        separateMaterials:a.material!==b.material,separateBones:a.skeleton.bones[0]!==b.skeleton.bones[0],
        texture:[a.material.map.image.width,a.material.map.image.height],originalColor:a.material.color.getHex(),
        closedDesign:a.userData.bouche_fermee_au_repos===true,jawVertices:a.userData.sommets_machoire,source:a.userData.source_sha256,bones:a.skeleton.bones.length,
        height:new T.Box3().setFromObject(vRed.getObjectByName('u-surpatore-vampire-modele')).getSize(new T.Vector3()).y,
        teams:[vRed,vBlue].map(f=>f.getObjectByName('equipe-surpatore').material.color.getHex())};
    })()`);
    assert.equal(imported.count,2);assert.equal(imported.triangles,8156);
    assert.equal(imported.source,'b4398d72e6bcfe409fb021a4dfb6042d27a1faa71f7f985ef846e522e603bf2f');assert.equal(imported.bones,81);assert.ok(imported.jawSkinnedVertices>20 && imported.jawDeformation>.001,'La mâchoire déforme réellement le mesh');
    assert.ok(imported.shared&&imported.texturesShared&&imported.separateMaterials&&imported.separateBones);
    assert.deepEqual(imported.texture,[2048,2048]);assert.equal(imported.originalColor,0xffffff);
    assert.ok(imported.closedDesign&&imported.jawVertices>20);assert.ok(imported.height>.5&&imported.height<.7);
    assert.notEqual(imported.teams[0],imported.teams[1]);
    const before=await page.evaluate('JSON.stringify(vState)');
    await page.evaluate('Eredita.Board3D.update(vState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('JSON.stringify(vState)'),before);
    const folder=process.env.EREDITA_SURPATORE_PREVIEW_DIR;if(folder)fs.mkdirSync(folder,{recursive:true});
    async function screenshot(name){if(!folder)return;const r=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(r.data,'base64'));}
    await screenshot('surpatore_in_game');
    const walk=await page.evaluate(`(()=>{
      const foot=vBone(vRed,'LeftFoot'),other=vBone(vBlue,'LeftFoot');vRed.userData.surpatore.setMoving(true);vAdvance(vRed,.25);
      const result={action:vRed.userData.surpatore.action,foot,end:vBone(vRed,'LeftFoot'),other,otherEnd:vBone(vBlue,'LeftFoot'),jaw:vBoneObject(vRed,'Jaw').quaternion.angleTo(vJawRest)};
      vRed.userData.surpatore.setMoving(false);vAdvance(vRed,.2);return result;
    })()`);
    assert.equal(walk.action,'Marche');assert.ok(walk.foot.some((v,i)=>Math.abs(v-walk.end[i])>.01));assert.deepEqual(walk.other,walk.otherEnd);assert.ok(walk.jaw<.001);
    const strike=await page.evaluate(`(()=>{
      const E=Eredita,s=vState;s.units[1].position=s.units[0].position+.8;s.paused=false;E.Combat.update(s,.01);s.paused=true;E.Board3D.update(s,true);
      const other=vBone(vBlue,'RightHand');vAdvance(vRed,E.Config.characterModels.surpatore.attackDuration*.24);
      const high=vBone(vRed,'RightHand'),jaw=vBoneObject(vRed,'Jaw').quaternion.angleTo(vJawRest);
      vAdvance(vRed,E.Config.characterModels.surpatore.attackDuration*.44);
      return {action:vRed.userData.surpatore.action,high,low:vBone(vRed,'RightHand'),jaw,other,otherEnd:vBone(vBlue,'RightHand'),hp:s.units.map(u=>u.hp)};
    })()`);
    assert.equal(strike.action,'Griffe');assert.deepEqual(strike.hp,[29,29]);assert.ok(strike.jaw>.3);
    assert.ok(strike.high[1]>strike.low[1]+.08);assert.ok(strike.low[0]>strike.high[0]+.08);assert.deepEqual(strike.other,strike.otherEnd);
    await screenshot('surpatore_attack_in_game');
    const pausedAt=await page.evaluate('vRed.userData.surpatore.time');await delay(180);assert.equal(await page.evaluate('vRed.userData.surpatore.time'),pausedAt);
    const recovered=await page.evaluate(`(()=>{vAdvance(vRed,.65);return {action:vRed.userData.surpatore.action,jaw:vBoneObject(vRed,'Jaw').quaternion.angleTo(vJawRest)};})()`);
    assert.equal(recovered.action,'Repos');assert.ok(recovered.jaw<.001,'La bouche se referme après le coup');
    const death=await page.evaluate(`(()=>{
      const E=Eredita,s=vState;s.units[1].position=49.5;s.units[0].hp=0;E.Combat.settleDeaths(s);E.Board3D.update(s,true);window.vDeath=s.unitDeathEffects.at(-1);
      const initial=vBone(vRed,'Hips')[1];vAdvance(vRed,1.2);
      return {legend:vDeath.mythologyLegendId,form:vDeath.mythologyForm,action:vRed.userData.surpatore.action,initial,fallen:vBone(vRed,'Hips')[1],units:s.units.length};
    })()`);
    assert.equal(death.legend,'u-surpatore');assert.equal(death.form,'vampire');assert.equal(death.action,'Mort');assert.equal(death.units,1);assert.ok(death.fallen<death.initial-.1);
    await page.evaluate('vAdvance(vRed,1.1)');await page.waitFor('Eredita.SurpatoreModel.diagnostics.instances===1');assert.equal(await page.evaluate('vDisposed'),0);
    const late=await page.evaluate(`(()=>{
      vState.unitDeathEffects.push({...vDeath,id:vDeath.id+100,unitId:99999});Eredita.Board3D.update(vState,true);
      const f=vFigures().find(f=>f.userData.surpatore&&f.userData.dying);const result={model:!!f?.getObjectByName('u-surpatore-vampire-modele'),action:f?.userData.surpatore.action};if(f)vAdvance(f,2.1);return result;
    })()`);
    assert.deepEqual(late,{model:true,action:'Mort'});await page.waitFor('Eredita.SurpatoreModel.diagnostics.instances===1');
    const fallback=await page.evaluate(`(()=>{
      const E=Eredita,d=Object.getOwnPropertyDescriptor(E.SurpatoreModel,'ready');Object.defineProperty(E.SurpatoreModel,'ready',{get:()=>false,configurable:true});
      E.Board3D.update(vState,true);const simple=!vFind('blue')&&vState.units[0].hp===29;Object.defineProperty(E.SurpatoreModel,'ready',d);E.Board3D.update(vState,true);
      return {simple,restored:!!vFind('blue'),disposed:vDisposed};
    })()`);
    assert.deepEqual(fallback,{simple:true,restored:true,disposed:0});
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.consoleErrors,[]);assert.deepEqual(page.badResponses.filter(url=>!/favicon/.test(url)),[]);
    console.log('Surpatore : sanglier puis vampire, bouche fermée au repos et ouverte pendant la griffe, marche, dégâts, pause, mort et cache validés.',JSON.stringify(imported));
  }finally{if(browser)await browser.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
