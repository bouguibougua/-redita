'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){const context=vm.createContext({window:{},console});for(const name of ['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board','combat','mythology-data','mythology-effects'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),context);
 const E=context.window.Eredita,s=E.Board.createState('simplified');s.phase='running';s.preparationRemaining=0;s.reinforcementEpoch='missions';E.MythologyEffects.init(s);
 for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.buildings=['artisanat','bergerie','boucherie'].map(type=>({type,level:1}));v.terrain={river:true};v.slots[0].content={category:'crop',type:'ble',hp:200,level:1};v.slots[1].content={category:'livestock',type:'chevre',hp:200,count:2,level:1};}
 const order=(r,mission,owner='red',lane=0)=>E.Economy.assignResidentMission(s,owner,lane,r.id,mission);
 return{E,s,v:s.players.red.villages[0],order};}
function finish(E,s,r){for(let n=0;n<800&&r.unitId;n++)E.Combat.update(s,.1);assert.equal(r.unitId,null,'Retour terminé');}
test('individual tasks replace active work even with no available residents; counts and prerequisites stay correct',()=>{
 const {E,s,v,order}=fixture(),r=v.residents[0];for(const person of v.residents)assert.ok(order(person,'chasse'));assert.equal(E.Economy.getAvailableResidents(s,'red',0),0);
 assert.ok(order(r,'agriculture'));assert.equal(v.jobs.chasse,v.residents.length-1);assert.equal(v.jobs.agriculture,1);assert.equal(r.workTimer,0);
 assert.ok(order(r,'elevage'));assert.equal(v.jobs.agriculture,0);assert.equal(v.jobs.elevage,1);assert.ok(order(r,'peche'));assert.equal(v.jobs.elevage,0);assert.equal(v.jobs.peche,1);
 const before=JSON.stringify(s);v.terrain.river=false;assert.equal(order(r,'agriculture'),true);v.slots[0].content=null;const unchanged=JSON.stringify(s);assert.equal(order(r,'agriculture'),false);assert.equal(JSON.stringify(s),unchanged);assert.ok(order(r,'disponible'));assert.equal(v.jobs.agriculture,0);assert.notEqual(JSON.stringify(s),before);
});
test('both camps turn back immediately, stop attacking and remain vulnerable to enemy fire',()=>{
 for(const owner of ['red','blue']){const {E,s}=fixture(),v=s.players[owner].villages[0],r=v.residents[0];r.profession='guerrier';assert.ok(E.Economy.assignResidentMission(s,owner,0,r.id,'attaque'));const u=s.units[0];u.position=owner==='red'?80:20;u.visualAttackTimer=1;u.visualAttackTarget={position:90};
 const enemy=E.Units.create(owner==='red'?'blue':'red',0,'habitant',{stance:'defense'});enemy.position=u.position;s.units.push(enemy);E.Buildings.updateArtisanatBonuses(s);const hp=u.hp,enemyHp=enemy.hp,pos=u.position;
 assert.ok(E.Economy.assignResidentMission(s,owner,0,r.id,'chasse'));assert.equal(r.pendingMission,'chasse');assert.equal(u.returningToVillage,true);assert.equal(u.visualAttackTimer,0);assert.equal(u.visualAttackTarget,null);
 E.Combat.update(s,.1);assert.ok(owner==='red'?u.position<pos:u.position>pos);assert.equal(enemy.hp,enemyHp);assert.equal(u.hp,hp-enemy.damage);assert.equal(u.visualAttackSequence,0);assert.equal(v.jobs.chasse,0);
 }
});
test('orders can change during return or cancel it; returning does not duplicate a unit or heal the resident',()=>{
 const {E,s,v,order}=fixture(),r=v.residents[0];r.profession='guerrier';r.tool='fer';r.armor='cuir';assert.ok(order(r,'attaque'));const u=s.units[0];u.position=20;u.hp-=13;const ratio=u.hp/u.maxHp;
 assert.ok(order(r,'agriculture'));assert.ok(order(r,'chasse'));assert.equal(r.pendingMission,'chasse');assert.ok(order(r,'attaque'));assert.equal(u.returningToVillage,false);assert.equal(r.pendingMission,undefined);assert.equal(s.units.length,1);
 assert.ok(order(r,'chasse'));finish(E,s,r);assert.equal(s.units.length,0);assert.equal(r.mission,'chasse');assert.equal(v.jobs.chasse,1);assert.equal(r.profession,'chasseur');assert.equal(r.tool,'fer');assert.equal(r.armor,'cuir');assert.equal(r.combatHealthRatio,ratio);
 assert.ok(order(r,'attaque'));assert.equal(v.jobs.chasse,0);assert.equal(s.units.length,1);assert.equal(s.units[0].hp/s.units[0].maxHp,ratio);assert.equal(r.combatHealthRatio,undefined);
});
test('defenders can be reassigned and attack orders can return to their defensive post',()=>{
 const {E,s,v,order}=fixture(),r=v.residents[0];r.profession='guerrier';assert.ok(order(r,'attaque'));s.units[0].position=70;assert.ok(order(r,'defense'));
 for(let n=0;n<200&&r.pendingMission;n++)E.Combat.update(s,.1);
 assert.equal(r.pendingMission,undefined);assert.equal(r.mission,'defense');assert.equal(s.units.length,1);assert.equal(s.units[0].stance,'defense');assert.equal(s.units[0].position,E.Config.combat.defensePositionByOwner.red);
 assert.ok(order(r,'peche'));finish(E,s,r);assert.equal(r.mission,'peche');assert.equal(v.jobs.peche,1);
});
test('a redirected resident returns to the origin village, crosses water with its existing fleet and releases its seat',()=>{
 const {E,s,v,order}=fixture(),r=v.residents[0];for(const p of Object.values(s.players))p.villages[1].biome='littoral';v.maritime.barque=1;assert.ok(order(r,'attaque'));const u=s.units[0];Object.assign(u,{position:70,lane:1,lanePosition:1,waitingForRedirect:true});s.pendingRedirects=[{key:'red-1',playerId:'red',fromLane:1,candidates:[0]}];
 assert.ok(order(r,'disponible'));assert.equal(s.pendingRedirects.length,0);let wasOnWater=false;
 for(let n=0;n<800&&r.unitId;n++){E.Combat.update(s,.1);wasOnWater ||= Boolean(u.waterTransport);}
 assert.ok(wasOnWater);assert.equal(r.unitId,null);assert.equal(r.mission,'disponible');assert.equal(E.Transport.fleetStatus(s,v).occupied,0);assert.equal(v.maritime.barque,1);assert.ok(v.residents.includes(r));assert.ok(!s.players.red.villages[1].residents.includes(r));
});
test('invalid orders and pause are atomic; a lost prerequisite falls back to available after arrival',()=>{
 const {E,s,v,order}=fixture(),r=v.residents[0];assert.ok(order(r,'attaque'));s.units[0].position=15;assert.ok(order(r,'agriculture'));s.paused=true;const before=JSON.stringify(s);assert.equal(order(r,'chasse'),false);E.Combat.update(s,1);assert.equal(JSON.stringify(s),before);s.paused=false;
 const snapshot=JSON.parse(JSON.stringify(s)),restored=snapshot.players.red.villages[0].residents.find(p=>p.id===r.id);finish(E,snapshot,restored);assert.equal(restored.mission,'agriculture','Le retour et la tâche survivent à un snapshot');
 assert.equal(E.Economy.assignResidentMission(s,'blue',0,r.id,'chasse'),false);assert.equal(order(r,'invalid'),false);v.slots[0].content=null;finish(E,s,r);assert.equal(r.mission,'disponible');assert.equal(v.jobs.agriculture,0);
 const saved=JSON.parse(JSON.stringify(s));assert.equal(E.Economy.assignResidentMission(saved,'red',0,r.id,'chasse'),true);
});
test('incoming damage on the arrival frame can kill a recalled resident before any new task begins',()=>{
 const {E,s,v,order}=fixture(),r=v.residents[0];assert.ok(order(r,'attaque'));const u=s.units[0];u.position=.01;u.hp=1;assert.ok(order(r,'chasse'));const enemy=E.Units.create('blue',0,'habitant',{stance:'defense'});enemy.position=0;s.units.push(enemy);E.Combat.update(s,.1);assert.ok(!v.residents.includes(r));assert.equal(v.jobs.chasse,0);assert.ok(!s.units.some(unit=>unit.residentId===r.id));
});

test('a recalled resident who is resurrected returns with full health and no stale recall order',()=>{
 const {E,s,v,order}=fixture(),r=v.residents[0];assert.ok(order(r,'attaque'));assert.ok(order(r,'chasse'));s.units[0].hp=0;E.Combat.settleDeaths(s);const count=v.residents.length;
 const cast=E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId:'red',legendId:'squadra-arozza',target:{},activationId:'revive-recalled'});assert.equal(cast.accepted,true);
 for(let n=0;n<100&&v.residents.length===count;n++){s.elapsed+=1;E.MythologyEffects.update(s,1);}const restored=v.residents.at(-1);assert.equal(v.residents.length,count+1);assert.equal(restored.pendingMission,undefined);assert.equal(restored.combatHealthRatio,undefined);assert.equal(restored.mission,'disponible');
 assert.ok(order(restored,'attaque'));const u=s.units.find(unit=>unit.residentId===restored.id);assert.equal(u.hp,u.maxHp);
});
