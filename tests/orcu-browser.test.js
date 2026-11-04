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
    await page.waitFor('Eredita.OrcuModel?.ready || Eredita.OrcuModel?.diagnostics.error',25000);
    const diagnostics=await page.evaluate('Eredita.OrcuModel.diagnostics');assert.equal(diagnostics.error,null);
    assert.deepEqual(diagnostics.clips.sort(),['Frappe_Droite','Frappe_Gauche','Marche','Mort','Repos']);
    await page.click('[data-menu-screen="play"]');await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.click('[data-setup-action="keep"][data-player="red"]');await page.click('#start-game');
    await page.waitFor("Eredita.GameView.getState().phase==='running'");await page.click('#pause-game');
    const invoked=await page.evaluate(`(()=>{
      const E=Eredita,s=window.oState=E.GameView.getState();s.phase='running';s.paused=false;s.preparationRemaining=0;s.elapsed=0;s.units=[];s.unitDeathEffects=[];
      s.reinforcementEpoch='orcu-model';E.MythologyEffects.init(s);
      for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.terrain={};v.burnUntil=0;}
      const result=[];for(const owner of ['red','blue']){
        result.push(E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId:owner,legendId:'l-orcu',target:{playerId:owner,lane:0},activationId:'orcu-'+owner}).accepted);
      }
      s.units[0].position=39;s.units[1].position=49.5;s.paused=true;
      E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.oFigures=()=>E.Board3D.getXRContext().world.children[1].children;
      window.oFind=owner=>oFigures().find(f=>f.userData.orcu&&f.userData.visualSignature.startsWith(owner+':'));
      window.oRed=oFind('red');window.oBlue=oFind('blue');
      window.oMesh=f=>{let found;f.traverse(p=>{if(!found&&p.isSkinnedMesh)found=p;});return found;};
      window.oBone=(f,suffix)=>{const T=E.Board3D.getXRContext().THREE;f.updateMatrixWorld(true);oMesh(f).skeleton.update();return oMesh(f).skeleton.bones.find(b=>b.name.endsWith(suffix)).getWorldPosition(new T.Vector3()).toArray();};
      window.oAdvance=(f,n)=>{for(let i=0;i<n;i++)f.userData.orcu.tick(.05,false);};
      window.oDisposed=0;oMesh(oRed).geometry.addEventListener('dispose',()=>oDisposed++);
      return result;
    })()`);
    assert.deepEqual(invoked,[true,true]);
    const imported=await page.evaluate(`(()=>{
      const E=Eredita,T=E.Board3D.getXRContext().THREE,a=oMesh(oRed),b=oMesh(oBlue);
      oRed.updateMatrixWorld(true);
      return {count:oFigures().filter(f=>f.userData.orcu).length,triangles:a.geometry.index.count/3,
        shared:a.geometry===b.geometry,texturesShared:a.material.map===b.material.map,
        separateMaterials:a.material!==b.material,separateBones:a.skeleton.bones[0]!==b.skeleton.bones[0],
        texture:[a.material.map.image.width,a.material.map.image.height],originalColor:a.material.color.getHex(),
        height:new T.Box3().setFromObject(oRed.getObjectByName('l-orcu-modele')).getSize(new T.Vector3()).y,
        teams:[oRed,oBlue].map(f=>f.getObjectByName('equipe-orcu').material.color.getHex()),
        stats:oState.units.map(u=>({hp:u.hp,damage:u.damage,speed:u.speed})),expectedSpeed:E.Config.reinforcementPowers.orcuSpeed};
    })()`);
    assert.equal(imported.count,2);assert.equal(imported.triangles,10501);
    assert.ok(imported.shared&&imported.texturesShared&&imported.separateMaterials&&imported.separateBones);
    assert.deepEqual(imported.texture,[2048,2048]);assert.equal(imported.originalColor,0xffffff);
    assert.ok(imported.height>.9&&imported.height<1.2,`Hauteur importée : ${imported.height}`);
    assert.notEqual(imported.teams[0],imported.teams[1]);
    assert.ok(imported.stats.every(u=>u.hp===200&&u.damage===30&&u.speed===imported.expectedSpeed));
    const before=await page.evaluate('JSON.stringify(oState)');
    await page.evaluate('Eredita.Board3D.update(oState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('JSON.stringify(oState)'),before);
    const folder=path.join(__dirname,'../eredita3D/previews');fs.mkdirSync(folder,{recursive:true});
    async function screenshot(name){const r=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(folder,name+'.png'),Buffer.from(r.data,'base64'));}
    await screenshot('orcu_in_game');
    const walking=await page.evaluate(`(()=>{
      const a=oBone(oRed,'LeftFoot'),b=oBone(oBlue,'LeftFoot');oRed.userData.orcu.setMoving(true);oAdvance(oRed,18);
      const result={action:oRed.userData.orcu.action,before:a,after:oBone(oRed,'LeftFoot'),blueBefore:b,blueAfter:oBone(oBlue,'LeftFoot')};
      oRed.userData.orcu.setMoving(false);oAdvance(oRed,4);return result;
    })()`);
    assert.equal(walking.action,'Marche');assert.ok(walking.before.some((v,i)=>Math.abs(v-walking.after[i])>.01));
    assert.deepEqual(walking.blueBefore,walking.blueAfter);
    const strike=await page.evaluate(`(()=>{
      const E=Eredita,s=oState;s.units[1].position=s.units[0].position+.8;s.paused=false;E.Combat.update(s,.01);s.paused=true;E.Board3D.update(s,true);
      const start=oBone(oRed,'RightHand'),blue=oBone(oBlue,'RightHand');oAdvance(oRed,9);
      return {action:oRed.userData.orcu.action,start,end:oBone(oRed,'RightHand'),blueBefore:blue,blueAfter:oBone(oBlue,'RightHand'),hp:s.units.map(u=>u.hp)};
    })()`);
    assert.equal(strike.action,'Frappe_Droite');assert.deepEqual(strike.hp,[170,170]);
    assert.ok(strike.start.some((v,i)=>Math.abs(v-strike.end[i])>.04));assert.deepEqual(strike.blueBefore,strike.blueAfter);
    const pausedAt=await page.evaluate('oRed.userData.orcu.time');await delay(180);
    assert.equal(await page.evaluate('oRed.userData.orcu.time'),pausedAt);
    const second=await page.evaluate(`(()=>{
      oAdvance(oRed,20);const E=Eredita,s=oState;s.paused=false;E.Combat.update(s,1);s.paused=true;E.Board3D.update(s,true);
      return {action:oRed.userData.orcu.action,hp:s.units.map(u=>u.hp)};
    })()`);
    assert.equal(second.action,'Frappe_Gauche');assert.deepEqual(second.hp,[140,140]);
    const death=await page.evaluate(`(()=>{
      const E=Eredita,s=oState;s.units[1].position=49.5;window.oStanding=oBone(oRed,'Hips')[1];s.units[0].hp=0;E.Combat.settleDeaths(s);E.Board3D.update(s,true);
      window.oDeath=s.unitDeathEffects.at(-1);oAdvance(oRed,23);
      return {legend:oDeath.mythologyLegendId,scale:oRed.scale.x,action:oRed.userData.orcu.action,standing:oStanding,fallen:oBone(oRed,'Hips')[1]};
    })()`);
    assert.equal(death.legend,'l-orcu');assert.equal(death.scale,1.8);assert.equal(death.action,'Mort');assert.ok(death.fallen<death.standing-.15);
    await screenshot('orcu_death_in_game');
    await page.evaluate('oAdvance(oRed,25)');await page.waitFor('Eredita.OrcuModel.diagnostics.instances===1');
    assert.equal(await page.evaluate('oDisposed'),0);
    const late=await page.evaluate(`(()=>{
      oState.unitDeathEffects.push({...oDeath,id:oDeath.id+100,unitId:99999});Eredita.Board3D.update(oState,true);
      const figure=oFigures().find(f=>f.userData.orcu&&f.userData.dying);const result={model:!!figure.getObjectByName('l-orcu-modele'),scale:figure.scale.x};oAdvance(figure,42);return result;
    })()`);
    assert.deepEqual(late,{model:true,scale:1.8});await page.waitFor('Eredita.OrcuModel.diagnostics.instances===1');
    const fallback=await page.evaluate(`(()=>{
      const E=Eredita,descriptor=Object.getOwnPropertyDescriptor(E.OrcuModel,'ready');Object.defineProperty(E.OrcuModel,'ready',{get:()=>false,configurable:true});
      E.Board3D.update(oState,true);const simple=!oFind('blue')&&oState.units[0].hp===140;
      Object.defineProperty(E.OrcuModel,'ready',descriptor);E.Board3D.update(oState,true);
      return {simple,restored:!!oFind('blue'),disposed:oDisposed};
    })()`);
    assert.deepEqual(fallback,{simple:true,restored:true,disposed:0});
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.consoleErrors,[]);assert.deepEqual(page.badResponses.filter(url=>!/favicon/.test(url)),[]);
    console.log('Orcu : modèle fourni, texture, invocation, deux équipes, marche, frappes, mort, pause, cache et repli validés.',JSON.stringify(imported));
  }finally{if(browser)await browser.close();await new Promise(resolve=>site.server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
