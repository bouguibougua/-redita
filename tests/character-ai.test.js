'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function fixture(format='simplified') {
 let seed=42;const math=Object.create(Math);math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const c=vm.createContext({window:{},console,Math:math});
 for(const n of ['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board','bad-omen','combat','mythology-data','mythology-effects'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8'),c);
 const E=c.window.Eredita,s=E.Board.createState(format);s.phase='running';s.preparationRemaining=0;s.reinforcementEpoch='spatial';E.MythologyEffects.init(s);
 for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.terrain={};v.residents=[];v.population=0;}
 return {E,s};
}
function separated(E,s) {
 const all=E.CharacterAI.bodies(s);
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(E.CharacterAI.distance(s,all[i].point,all[j].point)>=all[i].radius+all[j].radius-1e-5,`overlap ${all[i].entity.id}/${all[j].entity.id}`);
}
for(const format of ['classic','simplified'])test(format+': crowd spawns separately, advances and never overlaps across 600 frames',()=>{
 const {E,s}=fixture(format),v=s.players.red.villages[0];
 for(let i=0;i<16;i++){const r=E.Economy.addResident(v);E.Economy.deployResident(s,'red',0,r.id,'attaque','guerrier');}
 separated(E,s);const initial=s.units.map(u=>u.position);
 for(let i=0;i<600;i++){E.Combat.update(s,.03);separated(E,s);}
 assert.ok(s.units.every((u,i)=>u.position>initial[i]+30));assert.ok(s.units.every(u=>u.lane===0&&u.originLane===0));
});
test('swept movement cannot tunnel through a guard, including a large delta; it can go around',()=>{
 const {E,s}=fixture(),u=E.Units.create('red',0,'guerrier'),obstacle=E.Units.create('red',0,'habitant',{stance:'defense'});u.position=35;obstacle.position=42;s.units=[u,obstacle];
 E.CharacterAI.moveUnit(s,u,{position:70,lanePosition:0,terrainOffset:0},u.speed,8);separated(E,s);assert.ok(u.position>42);assert.equal(obstacle.position,42);assert.equal(u.lane,0);
});
test('vision detects a sideways enemy inside its circle but ignores a distant enemy; straight marching resumes',()=>{
 const {E,s}=fixture(),u=E.Units.create('red',0,'guerrier'),foe=E.Units.create('blue',0,'habitant',{stance:'defense'});Object.assign(u,{position:50,terrainOffset:0});Object.assign(foe,{position:50,terrainOffset:.30});s.units=[u,foe];
 E.Combat.update(s,.1);assert.ok(u.terrainOffset>0,'approach visible side target');assert.equal(u.lane,0);
 for(let i=0;i<10&&foe.hp===foe.maxHp;i++)E.Combat.update(s,.1);assert.ok(foe.hp<foe.maxHp);
 foe.hp=0;E.Combat.settleDeaths(s);const before=u.position,x=u.terrainOffset;E.Combat.update(s,.1);assert.ok(u.position>before);assert.equal(u.terrainOffset,x,'straight heading without target');
});
for(const owner of ['red','blue'])for(const mission of ['agriculture','elevage'])test(`${owner} ${mission}: random compatible slots and reserved points, delivery, retarget after destruction`,()=>{
 const {E,s}=fixture(),v=s.players[owner].villages[0];v.buildings=[{type:'bergerie',level:1}];
 for(let i=0;i<4;i++)v.slots[i].content=mission==='agriculture'?{category:'crop',type:'ble',level:1,hp:200,maxHp:200}:{category:'livestock',type:'chevre',count:2,hp:200,maxHp:200,reproductionProgress:0};
 for(let i=0;i<6;i++){const r=E.Economy.addResident(v);assert.ok(E.Economy.assignResidentJob(s,owner,0,r.id,mission));}
 E.Economy.updateProduction(s,.05);
 assert.ok(new Set(v.residents.map(r=>r.targetSlotIndex)).size>1);
 const workers=v.residents;assert.ok(workers.every(r=>r.aiGoal));
 for(const r of workers){const box=E.Board.slotHitbox(s,v,r.targetSlotIndex);assert.ok(E.CharacterAI.distance(s,r.aiGoal,{position:box.position,lanePosition:v.lane,terrainOffset:box.offset})<=box.radius*E.Config.characterAI.workAreaRatio+1e-8);}
 let harvest=false,delivered=false;for(let i=0;i<3000;i++){
  E.Economy.updateProduction(s,.05);separated(E,s);
  harvest ||= workers.some(r=>r.workPhase==='harvesting');delivered ||= v.resources[mission==='agriculture'?'ble':'lait']>0;if(harvest&&delivered)break;
 }
 assert.ok(harvest&&delivered,'workers must reach their places, harvest and deliver');
 const r=workers.find(r=>r.targetSlotIndex!==null),old=r.targetSlotIndex;v.slots[old].content=null;
 for(let i=0;i<2000&&r.targetSlotIndex===old;i++)E.Economy.updateProduction(s,.05);
 assert.notEqual(r.targetSlotIndex,old);assert.doesNotThrow(()=>JSON.stringify(s));
});
test('attackers reserve different places around a target and retain their starting column',()=>{
 const {E,s}=fixture(),foe=E.Units.create('blue',0,'habitant',{stance:'defense'});Object.assign(foe,{position:50,hp:10000,maxHp:10000,damage:0});s.units=[foe];
 for(let i=0;i<5;i++){const u=E.Units.create('red',0,'guerrier');u.position=46;u.terrainOffset=(i-2)*.18;s.units.push(u);}
 let hits=0;for(let i=0;i<250;i++){const hp=foe.hp;E.Combat.update(s,.05);separated(E,s);hits+=foe.hp<hp?1:0;}
 assert.ok(hits>5);assert.ok(s.units.every(u=>u.lane===0));
 const goals=s.units.slice(1).map(u=>u.aiGoal).filter(Boolean);assert.ok(goals.length>=2);assert.ok(new Set(goals.map(p=>p.terrainOffset)).size>1);
});
test('pause and preparation do not move characters or trigger attacks',()=>{
 const {E,s}=fixture(),u=E.Units.create('red',0,'guerrier');s.units=[u];
 s.paused=true;let before=JSON.stringify(s);E.Combat.update(s,1);assert.equal(JSON.stringify(s),before);
 s.paused=false;s.preparationRemaining=5;before=JSON.stringify(s);E.Combat.update(s,1);assert.equal(JSON.stringify(s),before);
});

test('large legends can hit each other at the edge of their larger hitboxes',()=>{
 const {E,s}=fixture(),a=E.Units.create('red',0,'habitant'),b=E.Units.create('blue',0,'habitant');
 Object.assign(a,{position:45,mythologyScale:1.8});Object.assign(b,{position:50,mythologyScale:1.8});s.units=[a,b];
 for(let i=0;i<100&&a.hp===a.maxHp&&b.hp===b.maxHp;i++)E.Combat.update(s,.05);
 separated(E,s);assert.ok(a.hp<a.maxHp||b.hp<b.maxHp);
});
test('an archer can detect a working resident at range without the worker chasing outside its leash',()=>{
 const {E,s}=fixture(),v=s.players.blue.villages[0],r=E.Economy.addResident(v);Object.assign(r,{mission:'agriculture',profession:'agriculteur',workPosition:58,workTerrainOffset:0,workPhase:'harvesting'});
 const a=E.Units.create('red',0,'habitant',{profession:'chasseur'});a.position=47;s.units=[a];
 E.Combat.update(s,.05);const defender=s.units.find(u=>u.residentId===r.id);assert.ok(defender);assert.ok(defender.hp<defender.maxHp);assert.equal(defender.position,58);
 E.Combat.update(s,.1);assert.equal(r.unitId,defender.id,'does not respawn every frame while under fire');assert.equal(defender.position,58);
});

for(const format of ['classic','simplified'])for(const owner of ['red','blue'])test(`${format} ${owner}: an attacker at the edge of its column reaches and hits the village gate`,()=>{
 const {E,s}=fixture(format),u=E.Units.create(owner,0,'guerrier'),enemy=owner==='red'?'blue':'red';
 u.terrainOffset=owner==='red'?1.2:-1.2;s.units=[u];const v=s.players[enemy].villages[0],hp=v.hp;
 for(let i=0;i<1800&&v.hp===hp;i++)E.Combat.update(s,.05);
 assert.ok(v.hp<hp,'a free gate must be reachable from the side of the column');assert.equal(u.lane,0);
});
