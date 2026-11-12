'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { startStaticServer, startBrowser, delay } = require('../scripts/export-menu-gif');

async function run() {
  const site = await startStaticServer(); let browser;
  try {
    browser = await startBrowser(); const page = browser.page;
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: (process.env.EREDITA_TEST_URL || site.url) + '?intro=0' });
    await page.waitFor("document.readyState==='complete' && window.Eredita?.Board3D?.ready && Eredita.GameView?.getState()");
    await page.waitFor('Eredita.LupuModel?.ready || Eredita.LupuModel?.diagnostics.error', 25000);
    const diagnostics = await page.evaluate('Eredita.LupuModel.diagnostics');
    assert.equal(diagnostics.error, null);
    assert.deepEqual(diagnostics.clips.sort(), ['Garde_Debout', 'Griffes_Croisees', 'Mort', 'Quatre_Pattes', 'Repos']);
    await page.click('[data-menu-screen="play"]'); await page.click('#training-button');
    await page.waitFor("Eredita.Network.mode==='solo'");
    await page.evaluate("Eredita.GameView.command('confirmBiomes','red','keep')"); await page.click('#start-game');
    await page.waitFor("Eredita.GameView.getState().phase==='running'"); await page.evaluate("Eredita.GameView.command('togglePause')");
    const transformed = await page.evaluate(`(() => {
      const E=Eredita,s=window.lState=E.GameView.getState();s.phase='running';s.paused=false;s.preparationRemaining=0;s.elapsed=0;s.units=[];s.unitDeathEffects=[];
      s.reinforcementEpoch='lupu-model';E.MythologyEffects.init(s);
      for(const p of Object.values(s.players))for(const v of p.villages){
        v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.terrain={};v.burnUntil=0;
        for(const r of v.residents){r.mission='disponible';r.profession='habitant';r.unitId=null;}
      }
      const before=['red','blue'].map(owner=>s.players[owner].villages[0].residents.length);
      const accepted=['red','blue'].map(owner=>E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId:owner,legendId:'u-lupu-mannaru',target:{playerId:owner,lane:0},activationId:'lupu-'+owner}).accepted);
      const after=['red','blue'].map(owner=>s.players[owner].villages[0].residents.length);
      for(const u of s.units){u.lane=u.originLane=u.lanePosition=0;u.position=u.ownerId==='red'?35:49.5;}
      s.paused=true;E.UI.render(s);E.Board3D.setMode(true);E.Board3D.update(s,true);
      document.querySelectorAll('dialog[open]').forEach(d=>d.close());
      window.lFigures=()=>E.Board3D.getXRContext().world.children[1].children;
      window.lFind=owner=>lFigures().find(f=>f.userData.lupu&&f.userData.visualSignature.startsWith(owner+':'));
      window.lRed=lFind('red');window.lBlue=lFind('blue');
      window.lMesh=f=>{let mesh;f.traverse(p=>{if(!mesh&&p.isSkinnedMesh)mesh=p;});return mesh;};
      window.lBone=(f,suffix)=>{const T=E.Board3D.getXRContext().THREE;f.updateMatrixWorld(true);lMesh(f).skeleton.update();return lMesh(f).skeleton.bones.find(b=>b.name.endsWith(suffix)).getWorldPosition(new T.Vector3()).toArray();};
      window.lVertices=f=>{const T=E.Board3D.getXRContext().THREE,m=lMesh(f),result=[];f.updateMatrixWorld(true);m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i+=Math.max(1,Math.floor(m.geometry.attributes.position.count/128)))result.push(m.getVertexPosition(i,new T.Vector3()).applyMatrix4(m.matrixWorld).toArray());return result;};
      window.lAdvance=(f,n)=>{for(let i=0;i<n;i++)f.userData.lupu.tick(.05,false);};
      window.lAdvanceSeconds=(f,duration)=>{for(let remaining=duration;remaining>1e-8;){const delta=Math.min(.05,remaining);f.userData.lupu.tick(delta,false);remaining-=delta;}};
      window.lDisposed=0;lMesh(lRed).geometry.addEventListener('dispose',()=>lDisposed++);
      return {accepted,before,after,stats:s.units.map(u=>({hp:u.hp,damage:u.damage,speed:u.speed,role:u.role,structuresOnly:u.structuresOnly})),expectedSpeed:E.Config.units.ravageur.speed};
    })()`);
    assert.deepEqual(transformed.accepted, [true, true]);
    assert.deepEqual(transformed.after, transformed.before.map(n => n - 1));
    assert.equal(transformed.stats.length, 2);
    assert.ok(transformed.stats.every(u => u.hp === 60 && u.damage === 20 && u.speed === transformed.expectedSpeed && u.role === 'ravageur' && u.structuresOnly));
    const imported = await page.evaluate(`(() => {
      const E=Eredita,T=E.Board3D.getXRContext().THREE,a=lMesh(lRed),b=lMesh(lBlue);
      lRed.updateMatrixWorld(true);
      return {count:lFigures().filter(f=>f.userData.lupu).length,triangles:a.geometry.index.count/3,
        shared:a.geometry===b.geometry,texturesShared:a.material.map===b.material.map,
        separateMaterials:a.material!==b.material,separateBones:a.skeleton.bones[0]!==b.skeleton.bones[0],
        texture:[a.material.map.image.width,a.material.map.image.height],originalColor:a.material.color.getHex(),
        height:new T.Box3().setFromObject(lRed.getObjectByName('u-lupu-mannaru-modele')).getSize(new T.Vector3()).y,
        teams:[lRed,lBlue].map(f=>f.getObjectByName('equipe-lupu').material.color.getHex())};
    })()`);
    assert.equal(imported.count, 2); assert.ok(imported.triangles > 8000 && imported.triangles < 20000);
    assert.ok(imported.shared && imported.texturesShared && imported.separateMaterials && imported.separateBones);
    assert.deepEqual(imported.texture, [2048, 2048]); assert.equal(imported.originalColor, 0xffffff);
    assert.ok(imported.height > .2 && imported.height < .9, `Hauteur importée : ${imported.height}`);
    assert.notEqual(imported.teams[0], imported.teams[1]);
    const beforeRender = await page.evaluate('JSON.stringify(lState)');
    await page.evaluate('Eredita.Board3D.update(lState,true);Eredita.Board3D.setXRPreview(true);Eredita.Board3D.setXRPreview(false)');
    assert.equal(await page.evaluate('JSON.stringify(lState)'), beforeRender);
    const folder = path.join(__dirname, '../eredita3D/previews'); fs.mkdirSync(folder, { recursive: true });
    async function screenshot(name) { const result = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(folder, name + '.png'), Buffer.from(result.data, 'base64')); }
    await screenshot('lupu_in_game');
    const gait = await page.evaluate(`(() => {
      const before=['LeftHand','RightHand','LeftFoot','RightFoot'].map(name=>lBone(lRed,name));
      const vertices=lVertices(lRed);
      const blue=['LeftHand','RightHand','LeftFoot','RightFoot'].map(name=>lBone(lBlue,name));
      lRed.userData.lupu.setMoving(true);const samples=[];
      for(const duration of [.19,.17,.23]){lAdvanceSeconds(lRed,duration);samples.push({bones:['LeftHand','RightHand','LeftFoot','RightFoot'].map(name=>lBone(lRed,name)),vertices:lVertices(lRed)});}
      const result={action:lRed.userData.lupu.action,before,samples,verticesBefore:vertices,blueBefore:blue,blueAfter:['LeftHand','RightHand','LeftFoot','RightFoot'].map(name=>lBone(lBlue,name))};
      lRed.userData.lupu.setMoving(false);lAdvance(lRed,4);return result;
    })()`);
    assert.equal(gait.action, 'Quatre_Pattes');
    assert.ok(gait.before.every((position, i) => gait.samples.some(sample => position.some((value, j) => Math.abs(value - sample.bones[i][j]) > .005))), 'Les quatre membres participent au déplacement');
    assert.ok(gait.samples.some(sample => gait.verticesBefore.some((position, i) => position.some((value, j) => Math.abs(value - sample.vertices[i][j]) > .01))), 'Le maillage suit réellement le squelette');
    assert.deepEqual(gait.blueBefore, gait.blueAfter);
    const lateral = await page.evaluate(`(() => {
      const E=Eredita,s=lState,u=s.units.find(u=>u.ownerId==='red');
      E.Board3D.update(s,true);u.lanePosition+=.1;E.Board3D.update(s,true);lAdvance(lRed,2);
      const action=lRed.userData.lupu.action;u.lanePosition=0;E.Board3D.update(s,true);E.Board3D.update(s,true);lAdvance(lRed,3);
      return {action,rest:lRed.userData.lupu.action,sameFigure:lRed===lFind('red')};
    })()`);
    assert.deepEqual(lateral, { action: 'Quatre_Pattes', rest: 'Repos', sameFigure: true });
    const ignored = await page.evaluate(`(() => {
      const E=Eredita,s=lState,u=s.units.find(u=>u.ownerId==='red');
      const human=E.Units.create('blue',0,'habitant',{stance:'defense'});human.position=u.position+.5;human.terrainOffset=.3;human.attackCooldown=99;s.units.push(human);
      const position=u.position,hp=human.hp;s.paused=false;E.Combat.update(s,.01);s.paused=true;
      const result={before:position,after:u.position,hpBefore:hp,hpAfter:human.hp,sequence:u.visualAttackSequence};
      s.units=s.units.filter(item=>item!==human);return result;
    })()`);
    assert.ok(ignored.after > ignored.before); assert.equal(ignored.hpBefore, ignored.hpAfter); assert.equal(ignored.sequence, 0);
    const strike = await page.evaluate(`(() => {
      const E=Eredita,s=lState,u=s.units.find(u=>u.ownerId==='red'),v=s.players.blue.villages[0];
      u.position=100;u.attackCooldown=0;u.retaliationCooldown=99;const hp=v.hp;
      window.lCrouch=lBone(lRed,'Head');s.paused=false;E.Combat.update(s,.01);s.paused=true;E.Board3D.update(s,true);E.Board3D.update(s,true);
      const blue=lBone(lBlue,'RightHand');
      const duration=E.Config.characterModels.lupu.attackDuration;
      lAdvanceSeconds(lRed,duration*.24);const raised={head:lBone(lRed,'Head'),right:lBone(lRed,'RightHand'),left:lBone(lRed,'LeftHand'),feet:['LeftFoot','RightFoot'].map(n=>lBone(lRed,n))};
      lAdvanceSeconds(lRed,duration*(.38-.24));const together={right:lBone(lRed,'RightHand'),left:lBone(lRed,'LeftHand')};
      lAdvanceSeconds(lRed,duration*(.57-.38));const crossed={right:lBone(lRed,'RightHand'),left:lBone(lRed,'LeftHand'),feet:['LeftFoot','RightFoot'].map(n=>lBone(lRed,n))};
      const blueAfter=lBone(lBlue,'RightHand');
      lAdvanceSeconds(lRed,duration*(.95-.57));const recovered=lBone(lRed,'Head');
      lAdvanceSeconds(lRed,duration*.20);const guard={head:lBone(lRed,'Head'),action:lRed.userData.lupu.action};
      return {crouch:lCrouch,raised,together,crossed,recovered,guard,blueBefore:blue,blueAfter,damage:hp-v.hp,expectedDamage:u.damage+E.Config.units.ravageur.villageDamageBonus};
    })()`);
    assert.equal(strike.damage,strike.expectedDamage,'Un seul impact du moteur malgré les deux griffes');
    assert.deepEqual(strike.blueBefore,strike.blueAfter);
    assert.ok(strike.raised.head[1]>strike.crouch[1]+.04,'Le loup se redresse pour attaquer');
    assert.ok(strike.crossed.right[0]>strike.raised.right[0]+.04&&strike.crossed.right[1]<strike.raised.right[1]-.04,'La griffe droite descend en diagonale');
    assert.ok(strike.crossed.left[0]<strike.raised.left[0]-.04&&strike.crossed.left[1]<strike.raised.left[1]-.04,'La griffe gauche descend en même temps dans la diagonale opposée');
    assert.ok(strike.together.right[1]<strike.raised.right[1]-.015&&strike.together.left[1]<strike.raised.left[1]-.015,'Les deux griffes descendent dans la même phase, sans alternance');
    assert.ok(strike.crossed.right[0]>strike.crossed.left[0],'Les trajectoires se croisent réellement');
    assert.equal(strike.guard.action,'Garde_Debout');
    assert.ok(strike.recovered[1]>strike.raised.head[1]-.02&&strike.guard.head[1]>strike.raised.head[1]-.02,'Il reste sur ses deux pattes après le geste et entre deux coups');
    for(let i=0;i<2;i++)assert.ok(Math.hypot(...strike.crossed.feet[i].map((n,j)=>n-strike.raised.feet[i][j]))<.01,'Les pattes arrière restent plantées pendant la coupe');
    await screenshot('lupu_attack_in_game');
    const crossPreview=await page.evaluate(`(()=>{
      const E=Eredita,T=E.Board3D.getXRContext().THREE,scene=new T.Scene();scene.background=new T.Color('#d8d1c1');scene.add(new T.HemisphereLight(0xffffff,0x777777,3));const light=new T.DirectionalLight(0xffefdc,3);light.position.set(2,4,3);scene.add(light);
      const models=[],phases=[.24,.57,1.2],labels=['Préparation debout','Deux griffes en X','Garde debout'];
      phases.forEach((phase,i)=>{const f=E.LupuModel.create('red');models.push(f);f.scale.setScalar(1.25);f.position.x=(i-1)*.95;scene.add(f);f.userData.lupu.attack(1);let remaining=E.Config.characterModels.lupu.attackDuration*phase;while(remaining>1e-8){const step=Math.min(remaining,1/120);f.userData.lupu.tick(step,false);remaining-=step;}
        const c=document.createElement('canvas');c.width=512;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#352a1f';ctx.textAlign='center';ctx.font='bold 28px system-ui';ctx.fillText(labels[i],256,40);const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const label=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false}));label.scale.set(.85,.11,1);label.position.set(f.position.x,1,0);scene.add(label);
      });
      const camera=new T.PerspectiveCamera(33,1.8,.01,100);camera.position.set(.9,1.4,3.9);camera.lookAt(0,.44,0);const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1400,778);renderer.render(scene,camera);const png=renderer.domElement.toDataURL('image/png').split(',')[1];models.forEach(f=>{f.userData.lupu.dispose();f.traverse(o=>{if(!o.userData.sharedGeometry)o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});});scene.traverse(o=>{if(o.isSprite){o.material.map?.dispose();o.material.dispose();}});renderer.dispose();return png;
    })()`);fs.writeFileSync(path.join(folder,'lupu-simultaneous-cross.png'),Buffer.from(crossPreview,'base64'));
    const pausedAt = await page.evaluate('lRed.userData.lupu.time'); await delay(180);
    assert.equal(await page.evaluate('lRed.userData.lupu.time'), pausedAt);
    const repeated = await page.evaluate(`(() => {
      lAdvance(lRed,10);const E=Eredita,s=lState,u=s.units.find(u=>u.ownerId==='red'),v=s.players.blue.villages[0],hp=v.hp;
      s.paused=false;E.Combat.update(s,1);s.paused=true;E.Board3D.update(s,true);
      return {action:lRed.userData.lupu.action,sequence:lRed.userData.lupu.sequence,damage:hp-v.hp};
    })()`);
    assert.deepEqual(repeated, { action: 'Griffes_Croisees', sequence: 2, damage: strike.expectedDamage });
    const death = await page.evaluate(`(() => {
      const E=Eredita,s=lState,u=s.units.find(u=>u.ownerId==='red');u.hp=0;E.Combat.settleDeaths(s);E.Board3D.update(s,true);lAdvance(lRed,23);
      window.lDeath=s.unitDeathEffects.at(-1);return {legend:lDeath.mythologyLegendId,scale:lRed.scale.x,action:lRed.userData.lupu.action};
    })()`);
    assert.deepEqual(death, { legend: 'u-lupu-mannaru', scale: 1.25, action: 'Mort' });
    await page.evaluate('lAdvance(lRed,25)'); await page.waitFor('Eredita.LupuModel.diagnostics.instances===1');
    assert.equal(await page.evaluate('lDisposed'), 0);
    const fallback = await page.evaluate(`(() => {
      const E=Eredita,descriptor=Object.getOwnPropertyDescriptor(E.LupuModel,'ready');Object.defineProperty(E.LupuModel,'ready',{get:()=>false,configurable:true});
      E.Board3D.update(lState,true);const simple=!lFind('blue')&&lState.units[0].hp===60;
      Object.defineProperty(E.LupuModel,'ready',descriptor);E.Board3D.update(lState,true);
      return {simple,restored:!!lFind('blue'),disposed:lDisposed};
    })()`);
    assert.deepEqual(fallback, { simple: true, restored: true, disposed: 0 });
    assert.deepEqual(page.errors, []); assert.deepEqual(page.consoleErrors, []);
    assert.deepEqual(page.badResponses.filter(url => !/favicon/.test(url)), []);
    console.log('U Lupu Mannaru : transformation, modèle fourni, quatre pattes, griffes debout, structures uniquement, pause, mort, cache et repli validés.', JSON.stringify(imported));
  } finally { if (browser) await browser.close(); await new Promise(resolve => site.server.close(resolve)); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
