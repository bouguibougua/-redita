'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(owner='red'){
 const ctx=vm.createContext({window:{},console});for(const n of ['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board','combat','mythology-data','mythology-effects'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',n+'.js'),'utf8'),ctx);
 const E=ctx.window.Eredita,s=E.Board.createState('simplified');s.phase='running';s.preparationRemaining=0;s.reinforcementEpoch='proximity';E.MythologyEffects.init(s);
 for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.terrain={};v.residents=[];v.population=0;}
 const v=s.players[owner].villages[0],r=E.Economy.addResident(v);E.Crops.place(s,owner,0,0,'ble');E.Economy.assignResidentMission(s,owner,0,r.id,'agriculture');
 const position=owner==='red'?2:98;r.workPosition=position;r.workPhase='toVillage';r.carrying={resource:'ble',amount:3};r.workTimer=.7;
 const enemy=E.Units.create(owner==='red'?'blue':'red',0,'habitant',{stance:'defense'});enemy.position=owner==='red'?3:97;s.units.push(enemy);
 return {E,s,v,r,enemy};
}
for(const owner of ['red','blue'])test(`${owner}: farmer interrupts delivery, fights back, then resumes with cargo and wounds`,()=>{
 const {E,s,v,r,enemy}=fixture(owner),cargo=JSON.stringify(r.carrying),pos=r.workPosition;
 E.Combat.update(s,.1);const u=s.units.find(u=>u.id===r.unitId);assert.ok(u.autoDefense);assert.equal(u.profession,'agriculteur');assert.equal(r.mission,'agriculture');assert.equal(v.jobs.agriculture,1);assert.ok(enemy.hp<enemy.maxHp);assert.ok(u.hp<u.maxHp);
 E.Economy.updateProduction(s,1);assert.equal(r.workPosition,pos);assert.equal(r.workTimer,.7);assert.equal(JSON.stringify(r.carrying),cargo);assert.equal(v.resources.ble,0);
 const ratio=u.hp/u.maxHp;enemy.hp=0;E.Combat.settleDeaths(s);E.Combat.update(s,.1);assert.equal(r.unitId,null);assert.equal(r.combatHealthRatio,ratio);assert.equal(r.profession,'agriculteur');assert.equal(JSON.stringify(r.carrying),cargo);
 E.Economy.updateProduction(s,1);assert.equal(v.resources.ble,3);assert.equal(r.carrying,null);assert.equal(v.jobs.agriculture,1);
});
test('leash prevents pursuit across the map; no production or engagement during pause/preparation',()=>{
 const {E,s,r,enemy}=fixture();s.paused=true;const before=JSON.stringify(s);E.Combat.update(s,1);assert.equal(JSON.stringify(s),before);s.paused=false;s.preparationRemaining=10;E.Combat.update(s,1);assert.equal(r.unitId,null);s.preparationRemaining=0;
 enemy.position=20;E.Combat.update(s,.1);assert.equal(r.unitId,null);enemy.position=6;E.Combat.update(s,.1);assert.ok(r.unitId);const u=s.units.find(u=>u.id===r.unitId);assert.ok(u.position>2);enemy.position=25;
 for(let i=0;i<20&&r.unitId;i++)E.Combat.update(s,.1);assert.equal(r.unitId,null);assert.equal(r.workPosition,2);
});
test('new orders override automatic defense without duplicated units or stale job counts',()=>{
 const {E,s,v,r,enemy}=fixture();E.Combat.update(s,.1);const u=s.units.find(u=>u.id===r.unitId);u.hp-=7;enemy.position=40;
 assert.equal(E.Economy.assignResidentMission(s,'red',0,r.id,'attaque','ravageur'),true);
 for(let i=0;i<50&&r.pendingMission;i++)E.Combat.update(s,.1);
 assert.equal(r.pendingMission,undefined);assert.equal(v.jobs.agriculture,0);assert.equal(r.mission,'attaque');assert.equal(r.profession,'ravageur');assert.equal(s.units.filter(u=>u.residentId===r.id).length,1);assert.ok(s.units.find(u=>u.residentId===r.id).hp<s.units.find(u=>u.residentId===r.id).maxHp);
});
test('a defending worker can die, removes the job and cargo and stays serializable',()=>{
 const {E,s,v,r,enemy}=fixture();E.Combat.update(s,.1);const saved=JSON.parse(JSON.stringify(s));const worker=saved.players.red.villages[0].residents[0],u=saved.units.find(u=>u.id===worker.unitId);u.hp=1;
 saved.units.find(u=>u.id===enemy.id).attackCooldown=0;E.Combat.update(saved,.1);assert.equal(saved.players.red.villages[0].residents.length,0);assert.equal(saved.players.red.villages[0].jobs.agriculture,0);assert.equal(saved.players.red.villages[0].resources.ble,0);
});
test('a nearby attacker turns around toward another troop before resuming its march',()=>{
 const {E,s,r,enemy}=fixture();s.players.red.villages[0].residents=[];const u=E.Units.create('red',0,'habitant');u.position=35;enemy.position=31;s.units=[u,enemy];E.Combat.update(s,.1);assert.ok(u.position<35);enemy.hp=0;E.Combat.settleDeaths(s);const previous=u.position;E.Combat.update(s,.1);assert.ok(u.position>previous);
});

test('legacy bulk-release command recalls a farmer engaged in proximity combat',()=>{
 const {E,s,v,r,enemy}=fixture();E.Combat.update(s,.1);assert.ok(r.unitId);
 assert.equal(E.Economy.unassignResidentJob(s,'red',0,r.id),true);assert.equal(r.pendingMission,'disponible');enemy.position=40;
 for(let i=0;i<50&&r.unitId;i++)E.Combat.update(s,.1);
 assert.equal(r.unitId,null);assert.equal(r.mission,'disponible');assert.equal(v.jobs.agriculture,0);assert.equal(r.carrying,null);
});
