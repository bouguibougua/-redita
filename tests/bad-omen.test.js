'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){const c=vm.createContext({window:{},console});for(const n of ['config','biomes','crops','livestock','units','buildings','transport','equipment','animals','economy','board','combat','bad-omen','mythology-data','mythology-effects'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+n+'.js'),'utf8'),c);
 const E=c.window.Eredita,s=E.Board.createState('classic');s.phase='running';s.preparationRemaining=0;s.reinforcementEpoch='omen';E.MythologyEffects.init(s);for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.residents=[];v.population=0;}
 let id=0;const cast=(legend,owner='red',lane=0)=>{assert.equal(E.MythologyEffects.activate(s,{epoch:'omen',playerId:owner,legendId:legend,target:{playerId:owner,lane},activationId:'omen-'+(++id)}).accepted,true);return s.units.at(-1);};
 const add=(owner='blue',lane=0,hp=100)=>{const u=E.Units.create(owner,lane,'habitant',{stance:'defense'});Object.assign(u,{position:owner==='blue'?85:15,hp,maxHp:hp,damage:0});s.units.push(u);return u;};return{E,s,cast,add};}
const tick=(E,s,n,dt=.05)=>{for(let i=0;i<n;i++)E.Combat.update(s,dt);};
test('Mazzeru replaces vision, stays at spawn, shoots globally, hits after flight and respects nine seconds',()=>{
 const{E,s,cast,add}=fixture(),m=cast('u-mazzeru'),target=add('blue',3);const initial=m.position;
 assert.equal(E.Mythology.get('u-mazzeru').gameplay.category,'invocation');assert.equal(m.hp,45);assert.equal(m.damage,15);
 E.Combat.update(s,.05);assert.equal(m.position,initial);assert.equal(target.hp,100);assert.equal(s.badOmen.projectiles.length,1);assert.equal(target.badOmen,undefined);
 tick(E,s,80);assert.equal(target.hp,85);assert.equal(target.badOmen.ownerId,'red');assert.equal(m.visualAttackSequence,1);
 add('blue',2);tick(E,s,99);assert.equal(m.visualAttackSequence,1);E.Combat.update(s,.1);assert.equal(m.visualAttackSequence,2);
});
test('nearest unmarked across columns takes priority over closer marked opponents; all marked permits advancing',()=>{
 const{E,s,cast,add}=fixture(),m=cast('u-mazzeru'),near=add('blue',0),far=add('blue',3);near.position=30;
 const t=E.BadOmen.characters(s).find(t=>t.entity===near);E.BadOmen.applyMark(s,t,m);E.Combat.update(s,.05);
 assert.equal(s.badOmen.projectiles[0].targetKey,E.BadOmen.characters(s).find(t=>t.entity===far).key);assert.equal(m.position,20);
 E.BadOmen.applyMark(s,E.BadOmen.characters(s).find(t=>t.entity===far),m);near.position=90;far.position=90;E.Combat.update(s,.05);assert.ok(m.position>20);
});
test('15 percent execution is inclusive, max-only growth applies once to the living author of the mark',()=>{
 const{E,s,cast,add}=fixture(),a=cast('u-mazzeru'),b=cast('u-mazzeru','red',1),enemyMaz=cast('u-mazzeru','blue'),victim=add();
 E.BadOmen.applyMark(s,E.BadOmen.characters(s).find(t=>t.entity===victim),a);victim.hp=15.01;E.Combat.settleDeaths(s);assert.ok(s.units.includes(victim));
 victim.hp=15;E.Combat.settleDeaths(s);assert.ok(!s.units.includes(victim));assert.equal(a.maxHp,60);assert.equal(b.maxHp,45);assert.equal(a.hp,45);assert.equal(enemyMaz.maxHp,45);E.Combat.settleDeaths(s);assert.equal(a.maxHp,60);
 const second=add();E.BadOmen.applyMark(s,E.BadOmen.characters(s).find(t=>t.entity===second),a);second.hp=0;E.Combat.settleDeaths(s);assert.equal(a.maxHp,75);assert.ok(a.omenGrowthTimer>0);
});
test('workers are global targets; marks survive deployment/recall, threshold follows current max HP',()=>{
 const{E,s,cast}=fixture(),m=cast('u-mazzeru'),v=s.players.blue.villages[2],r=E.Economy.addResident(v,s);r.mission='agriculture';r.profession='agriculteur';r.workPosition=77;
 const shelteredVillage=s.players.blue.villages[0],sheltered=E.Economy.addResident(shelteredVillage,s);
 E.Combat.update(s,.05);assert.equal(s.badOmen.projectiles[0].targetKey,`blue:resident:${r.id}`);tick(E,s,60);
 assert.ok(r.badOmen);assert.equal(sheltered.badOmen,undefined);assert.ok(r.combatHealthRatio<1);r.mission='disponible';assert.equal(E.Economy.deployResident(s,'blue',2,r.id,'attaque'),true);const u=s.units.find(u=>u.residentId===r.id);assert.ok(u.badOmen);
 u.hp=u.maxHp*.15;E.Combat.settleDeaths(s);assert.ok(!v.residents.includes(r));assert.equal(m.maxHp,60);
});
test('Mazzeru advances while enemies shelter and stops when a worker crosses the gate',()=>{
 for(const enemy of ['red','blue']){
  const {E,s,cast}=fixture();
  const m=cast('u-mazzeru',enemy==='red'?'blue':'red'),v=s.players[enemy].villages[2];
  const worker=E.Economy.addResident(v,s);
  const gate=enemy==='red'?0:E.Config.movement.columnLength;
  const towardEnemy=Math.sign(gate-m.position);
  Object.assign(worker,{mission:'agriculture',profession:'agriculteur',workPosition:gate+towardEnemy*6});
  const initial=m.position;
  E.Combat.update(s,.05);
  assert.equal(m.mazzeruMarking,false);
  assert.equal(s.badOmen.projectiles.length,0);
  assert.ok((m.position-initial)*towardEnemy>0);
  worker.workPosition=gate-towardEnemy*20;
  const advanced=m.position;
  E.Combat.update(s,.05);
  assert.equal(m.position,advanced);
  assert.equal(m.mazzeruMarking,true);
  assert.equal(s.badOmen.projectiles[0].targetKey,`${enemy}:resident:${worker.id}`);
 }
});
test('an arrow dissipates if its target returns inside a village before impact',()=>{
 const {E,s,cast}=fixture(),m=cast('u-mazzeru'),v=s.players.blue.villages[2],worker=E.Economy.addResident(v,s);
 Object.assign(worker,{mission:'agriculture',profession:'agriculteur',workPosition:77});
 const hp=E.Economy.residentStats(s,v,worker).hp;
 E.Combat.update(s,.05);
 assert.equal(s.badOmen.projectiles[0].targetKey,`blue:resident:${worker.id}`);
 worker.workPosition=E.Config.movement.columnLength+6;
 E.Combat.update(s,.05);
 assert.equal(s.badOmen.projectiles.length,0);
 assert.equal(m.mazzeruMarking,false);
 assert.equal(worker.badOmen,undefined);
 assert.equal(E.Economy.residentStats(s,v,worker).hp,hp);
});
test('vampire applies omen, keeps the same target even if a closer unmarked target appears, and retargets on death',()=>{
 const{E,s,cast,add}=fixture();const v=cast('u-surpatore');v.hp=0;E.Combat.settleDeaths(s);assert.equal(v.mythologyForm,'vampire');
 const first=add();v.position=50;first.position=52.3;E.Combat.update(s,.05);assert.ok(first.badOmen);const key=v.vampireTargetKey;
 const next=add();next.position=50.5;next.terrainOffset=-.17;v.attackCooldown=0;E.Combat.update(s,.05);assert.equal(v.vampireTargetKey,key);assert.equal(first.hp,78);assert.equal(next.hp,100);
 first.hp=0;E.Combat.settleDeaths(s);v.attackCooldown=0;E.Combat.update(s,.05);assert.notEqual(v.vampireTargetKey,key);assert.ok(next.badOmen);
});
test('pause/preparation freeze arrows, effects and growth; dead targets are not replaced mid-flight; no attack duplicates',()=>{
 const{E,s,cast,add}=fixture(),m=cast('u-mazzeru'),t=add();E.Combat.update(s,.05);s.paused=true;const before=JSON.stringify(s);E.Combat.update(s,1);assert.equal(JSON.stringify(s),before);s.paused=false;s.preparationRemaining=2;const pending=s.badOmen.projectiles[0].remaining;E.Combat.update(s,1);assert.equal(s.badOmen.projectiles[0].remaining,pending);s.preparationRemaining=0;
 t.hp=0;E.Combat.settleDeaths(s);const other=add();tick(E,s,30);assert.equal(other.hp,100);assert.equal(s.badOmen.projectiles.length,0);assert.equal(m.visualAttackSequence,1);
});

test('Bianca prevents execution rewards while protection is active, then marked death pays once',()=>{
 const{E,s,cast,add}=fixture(),m=cast('u-mazzeru'),target=add();s.players.blue.mythologyProtectionUntil=60;
 E.BadOmen.applyMark(s,E.BadOmen.characters(s).find(t=>t.entity===target),m);target.hp=15;E.Combat.settleDeaths(s);assert.equal(target.hp,100);assert.equal(m.maxHp,45);assert.ok(target.badOmen);
 s.elapsed=60;target.hp=15;E.Combat.settleDeaths(s);assert.equal(m.maxHp,60);assert.ok(!s.units.includes(target));
});
test('local resident death by another cause grants max HP; unmarked deaths and dead Mazzeri gain nothing',()=>{
 const{E,s,cast,add}=fixture(),m=cast('u-mazzeru'),dead=cast('u-mazzeru','red',1);dead.hp=0;E.Combat.settleDeaths(s);
 const v=s.players.blue.villages[0],r=E.Economy.addResident(v,s);E.BadOmen.applyMark(s,E.BadOmen.characters(s).find(t=>t.entity===r),m);E.Economy.removeResident(s,'blue',0,r.id);assert.equal(m.maxHp,60);assert.equal(dead.maxHp,45);
 const unmarked=add();unmarked.hp=0;E.Combat.settleDeaths(s);assert.equal(m.maxHp,60);
});
test('mark does not stack, the threshold updates with max HP, and a new field target stops the archer',()=>{
 const{E,s,cast,add}=fixture(),m=cast('u-mazzeru'),u=add();let t=E.BadOmen.characters(s).find(t=>t.entity===u);E.BadOmen.applyMark(s,t,m);E.BadOmen.applyMark(s,t,m);
 u.maxHp=200;u.hp=30;E.Combat.settleDeaths(s);assert.equal(m.maxHp,60);
 const marked=add();marked.position=90;t=E.BadOmen.characters(s).find(t=>t.entity===marked);E.BadOmen.applyMark(s,t,m);E.Combat.update(s,.05);assert.ok(m.position>20);const stopped=m.position;
 const fresh=add('blue',3);fresh.position=95;E.Combat.update(s,.05);assert.equal(m.position,stopped);assert.equal(m.mazzeruMarking,true);
});
test('vampire boar form cannot apply omen; projectile target identity survives a worker deployment',()=>{
 const{E,s,cast,add}=fixture(),boar=cast('u-surpatore'),u=add();boar.position=50;u.position=50.5;E.Combat.update(s,.05);assert.equal(u.badOmen,undefined);
 s.units=[];const m=cast('u-mazzeru'),v=s.players.blue.villages[1],r=E.Economy.addResident(v,s);
 Object.assign(r,{mission:'agriculture',profession:'agriculteur',workPosition:77});
 E.Combat.update(s,.05);assert.equal(s.badOmen.projectiles.length,1);r.mission='disponible';
 assert.equal(E.Economy.deployResident(s,'blue',1,r.id,'defense'),true);const deployed=s.units.find(x=>x.residentId===r.id);tick(E,s,80);assert.ok(deployed.badOmen&&r.badOmen);assert.ok(deployed.hp<deployed.maxHp);assert.equal(m.hp,45);
});

test('ordinary archer mode attacks the village instead of the defender at its gate',()=>{
 const{E,s,cast,add}=fixture(),m=cast('u-mazzeru'),v=s.players.blue.villages[0],defender=add();
 defender.position=E.Config.movement.columnLength;m.position=85;const hp=v.hp;
 E.Combat.update(s,.05);assert.equal(m.mazzeruMarking,false);assert.equal(v.hp,hp);assert.equal(s.badOmen.projectiles.length,1);
 assert.equal(s.badOmen.projectiles[0].targetKey,'blue:village:0');
 tick(E,s,20);assert.equal(v.hp,hp-15);assert.equal(v.badOmen,undefined);assert.equal(m.visualAttackSequence,1);tick(E,s,140);assert.equal(m.visualAttackSequence,1);
 assert.equal(defender.hp,100);assert.equal(defender.badOmen,undefined);
});

test('marked independent animal execution rewards only once and is never registered as a human death',()=>{
 const{E,s,cast}=fixture(),m=cast('u-mazzeru'),v=s.players.blue.villages[0];const a={id:'blue-dog',type:'chien',mission:'disponible',unitId:null,hp:40,maxHp:40};v.animals.push(a);
 const t=E.BadOmen.characters(s).find(t=>t.entity===a);E.BadOmen.applyMark(s,t,m);a.hp=6;E.Combat.settleDeaths(s);
 assert.ok(!v.animals.includes(a));assert.equal(m.maxHp,60);assert.equal(s.mythology.deaths.at(-1).human,false);E.Combat.settleDeaths(s);assert.equal(m.maxHp,60);
});

test('vampire receives its own +15 max HP after its marked target dies to another cause; allied Mazzeru does not',()=>{
 const {E,s,cast,add}=fixture(),v=cast('u-surpatore');v.hp=0;E.Combat.settleDeaths(s);const m=cast('u-mazzeru'),victim=add();
 v.position=50;victim.position=52.5;E.Combat.update(s,.05);assert.ok(victim.badOmen);const hp=v.hp;
 assert.ok(victim.badOmen.sourceKey.includes(v.id+':vampire'));
 victim.hp=0;E.Combat.settleDeaths(s);assert.equal(v.maxHp,55);assert.equal(v.hp,hp);assert.equal(m.maxHp,45);assert.ok(v.omenGrowthTimer>0);
 E.Combat.settleDeaths(s);assert.equal(v.maxHp,55);
});
test('a later hit cannot steal the existing mark or grant the reward to both appliers',()=>{
 const {E,s,cast,add}=fixture(),m=cast('u-mazzeru'),v=cast('u-surpatore');v.hp=0;E.Combat.settleDeaths(s);const target=add();
 const t=E.BadOmen.characters(s).find(t=>t.entity===target);E.BadOmen.applyMark(s,t,m);const author=target.badOmen.sourceKey;
 E.BadOmen.hit(s,v,t.key,11);assert.equal(target.badOmen.sourceKey,author);target.hp=0;E.Combat.settleDeaths(s);
 assert.equal(m.maxHp,60);assert.equal(v.maxHp,40);
});
test('arrows retain their author after its death; another Mazzeru cannot collect the reward',()=>{
 const {E,s,cast,add}=fixture(),source=cast('u-mazzeru'),target=add('blue',3);E.Combat.update(s,.05);
 const projectile=s.badOmen.projectiles[0],key=projectile.sourceKey;source.hp=0;E.Combat.settleDeaths(s);const replacement=cast('u-mazzeru','red',1);
 E.BadOmen.updateProjectiles(s,10);assert.equal(target.badOmen.sourceKey,key);target.hp=0;E.Combat.settleDeaths(s);assert.equal(replacement.maxHp,45);
});
test('attribution survives worker deployment, snapshots and recall, with one reward for the original applier',()=>{
 const {E,s,cast}=fixture(),m=cast('u-mazzeru'),v=s.players.blue.villages[0],r=E.Economy.addResident(v);
 E.BadOmen.applyMark(s,E.BadOmen.characters(s).find(t=>t.entity===r),m);assert.ok(E.Economy.deployResident(s,'blue',0,r.id,'attaque'));
 const saved=JSON.parse(JSON.stringify(s)),resident=saved.players.blue.villages[0].residents[0],u=saved.units.find(u=>u.residentId===r.id),source=saved.units.find(u=>u.id===m.id);
 assert.equal(u.badOmen.sourceKey,resident.badOmen.sourceKey);E.Economy.completeRecall(saved,u);
 E.Economy.removeResident(saved,'blue',0,resident.id);assert.equal(source.maxHp,60);E.Combat.settleDeaths(saved);assert.equal(source.maxHp,60);
});
