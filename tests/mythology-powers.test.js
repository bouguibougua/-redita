'use strict';
const assert = require('node:assert/strict'), { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function fixture() {
  const context = vm.createContext({ window: {}, console });
  for (const name of ['config','biomes','crops','livestock','units','buildings','transport','equipment','animals','economy','board','combat',
    'mythology-data','mythology-effects','mythology-match']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','js',name+'.js'),'utf8'),context,{filename:name+'.js'});
  }
  const E=context.window.Eredita, s=E.Board.createState('classic');
  s.phase='running';s.preparationRemaining=0;s.reinforcementEpoch='powers';E.MythologyEffects.init(s);
  for(const p of Object.values(s.players)) for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');}
  let next=0;
  const cast=(id,target={},playerId='red')=>E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId,legendId:id,target,activationId:'power-'+(++next)});
  const deploy=(owner='red',lane=0)=>{const v=s.players[owner].villages[lane],r=v.residents.find(p=>p.mission==='disponible');
    assert.equal(E.Economy.deployResident(s,owner,lane,r.id,'attaque'),true);return s.units.find(u=>u.residentId===r.id);};
  const kill=(owner='red',lane=0)=>{const v=s.players[owner].villages[lane],r=v.residents.find(p=>!p.unitId);E.Economy.removeResident(s,owner,lane,r.id);return r;};
  const setRandom=value=>vm.runInContext('Math.random=()=>'+JSON.stringify(value),context);
  return {E,s,cast,deploy,kill,setRandom};
}
test('all sixteen powers have an independent implementation and do not load the retired card/deck engine',()=>{
  const {E}=fixture();assert.equal(E.Mythology.all.length,16);
  for(const legend of E.Mythology.all) assert.equal(E.MythologyMatch.activatable(legend),true,legend.name);
  assert.equal(E.Cards,undefined);assert.equal(E.CardGame,undefined);assert.equal(E.CardEffects,undefined);
});
test('A Strega and U Stregu apply separate timed yield modifiers on the match clock',()=>{
  const {E,s,cast}=fixture(),v=s.players.blue.villages[0];
  assert.equal(cast('a-stregha',{playerId:'blue',lane:0}).accepted,true);assert.equal(E.MythologyEffects.productionMultiplier(s,v),.5);
  assert.equal(cast('u-stregu',{playerId:'blue',lane:0},'blue').accepted,true);assert.equal(E.MythologyEffects.productionMultiplier(s,v),1);
  s.elapsed=119.99;assert.equal(E.MythologyEffects.productionMultiplier(s,v),1);
  s.elapsed=120;assert.equal(E.MythologyEffects.productionMultiplier(s,v),1);
  assert.equal(cast('a-stregha',{playerId:'red',lane:0}).accepted,false,'Cannot curse own region');
});
test('A Fata creates a river and speeds fishing by exactly 25 percent',()=>{
  const {E,s,cast}=fixture(),v=s.players.red.villages[0],r=v.residents[0];
  assert.equal(cast('a-fata',{playerId:'red',lane:0}).accepted,true);
  assert.equal(v.terrain.river,true);assert.equal(E.Economy.assignResidentJob(s,'red',0,r.id,'peche'),true);
  E.Economy.updateProduction(s,E.Config.temporaryProduction.fishingInterval/1.25);
  assert.equal(v.resources.poisson,E.Config.temporaryProduction.fishAmountPerWorker);
});
test('L’Orcu and U Surpatore have the specified stats; the boar becomes one vampire on death',()=>{
  const {E,s,cast}=fixture();cast('l-orcu',{playerId:'red',lane:0});
  const orcu=s.units[0];assert.equal(orcu.hp,200);assert.equal(orcu.damage,30);assert.ok(orcu.speed<E.Config.units.habitant.speed);
  const pop=s.players.red.villages[0].population;cast('u-surpatore',{playerId:'red',lane:0});const u=s.units[1];
  assert.equal(u.role,'sanglier');u.hp=0;E.Combat.settleDeaths(s);
  assert.equal(u.mythologyForm,'vampire');assert.equal(u.hp,25);assert.equal(u.damage,5);assert.equal(u.animalType,null);
  assert.equal(s.players.red.villages[0].population,pop);u.hp=0;E.Combat.settleDeaths(s);assert.ok(!s.units.includes(u));
  assert.equal(s.mythology.deaths.filter(d=>d.identity.includes(String(u.id)+':')).length,2);
});
test('U Magu buffs only the next true newborn in every surviving allied village',()=>{
  const {E,s,cast}=fixture();cast('u-magu');
  for(const v of s.players.red.villages){const first=E.Economy.addResident(v,s),second=E.Economy.addResident(v,s);
    assert.equal(first.mythologyStatMultiplier,2);assert.equal(first.mythologyScale,1.5);assert.equal(second.mythologyMagu,undefined);
    assert.equal(E.Economy.deployResident(s,'red',v.lane,first.id,'attaque'),true);
    const u=s.units.find(x=>x.residentId===first.id);assert.equal(u.hp,E.Config.units.habitant.hp*2);assert.equal(u.damage,E.Config.units.habitant.damage*2);assert.equal(u.speed,E.Config.units.habitant.speed*2);
  }
  assert.equal(E.Economy.addResident(s.players.blue.villages[0],s).mythologyMagu,undefined);
});
test('U Lupu Mannaru transforms only a free untrained human, otherwise the next newborn; structures only',()=>{
  const {E,s,cast}=fixture(),v=s.players.red.villages[0];
  v.residents[0].profession='guerrier';v.residents[1].mission='chasse';const selected=v.residents[2].id;
  cast('u-lupu-mannaru',{playerId:'red',lane:0});let u=s.units[0];
  assert.ok(!v.residents.some(r=>r.id===selected));assert.equal(u.hp,60);assert.equal(u.damage,20);assert.equal(u.structuresOnly,true);
  v.residents.forEach(r=>r.mission='chasse');cast('u-lupu-mannaru',{playerId:'red',lane:0});assert.equal(v.nextLupuCharges,1);
  const born=E.Economy.addResident(v,s);assert.ok(!v.residents.includes(born));assert.equal(v.nextLupuCharges,0);
  const enemy=E.Units.create('blue',0,'habitant');enemy.position=u.position; s.units.push(enemy);
  const hp=enemy.hp;E.Combat.update(s,.1);assert.equal(enemy.hp,hp,'Lupu does not attack an enemy human in range');
});
test('Anima in Pena creates one task-capable, profession-locked 1 HP / 1 DPS soul per allied column death',()=>{
  const {E,s,cast,kill}=fixture(),v=s.players.red.villages[0];kill();kill();kill('blue');const population=v.population;
  assert.equal(cast('anima-in-pena',{playerId:'red',lane:0}).accepted,true);
  const souls=v.residents.filter(r=>r.isLegend);assert.equal(souls.length,2);assert.equal(v.population,population);
  assert.equal(E.Economy.canSetProfession(s,'red',0,souls[0].id,'habitant'),false);
  assert.equal(E.Economy.assignResidentJob(s,'red',0,souls[0].id,'chasse'),true);
  assert.equal(E.Economy.deployResident(s,'red',0,souls[1].id,'attaque'),true);
  const unit=s.units.find(u=>u.residentId===souls[1].id);assert.equal(unit.hp,1);assert.equal(unit.damage/E.Config.combat.attackInterval,1);
});
test('A Strega Bianca prevents upcoming human deaths for one minute and preserves task and gear, never legends',()=>{
  const {E,s,cast,deploy}=fixture(),v=s.players.red.villages[0];
  v.residents[0].tool='fer';v.residents[0].armor='maille';const u=deploy();cast('a-stregha-bianca');
  s.elapsed=59.99;u.position=45;u.hp=0;E.Combat.settleDeaths(s);
  assert.equal(u.hp,u.maxHp);assert.equal(u.position,0);assert.equal(u.tool,'fer');assert.equal(u.armor,'maille');assert.equal(u.stance,'attack');
  assert.equal(s.mythology.deaths.length,0);assert.equal(v.residents.find(r=>r.id===u.residentId).mission,'attaque');
  cast('l-orcu',{playerId:'red',lane:0});const orcu=s.units.find(x=>x.isLegend);orcu.hp=0;E.Combat.settleDeaths(s);assert.ok(!s.units.includes(orcu));
  s.elapsed=60;u.hp=0;E.Combat.settleDeaths(s);assert.ok(!s.units.includes(u));
});
test('A Squadra d’Arozza resurrects only unclaimed human deaths in the last minute, once, with equipment',()=>{
  const {E,s,cast,kill}=fixture(),v=s.players.red.villages[0];kill();s.elapsed=20;v.residents[0].tool='fer';const recent=kill();
  s.elapsed=70;const before=v.population;assert.equal(cast('squadra-arozza').accepted,true);assert.equal(v.population,before+1);
  assert.equal(v.residents.at(-1).tool,'fer');assert.notEqual(v.residents.at(-1).id,recent.id);assert.equal(cast('squadra-arozza').accepted,false);
});
test('U Diavule destroys field inhabitants, crops and livestock, sparing buildings and residents inside villages',()=>{
  const {E,s,cast,deploy}=fixture();
  const deployed=deploy('blue');deployed.position=80;
  for(const id of ['red','blue']){const v=s.players[id].villages[0];v.buildings.push({type:'artisanat',level:1});E.Crops.place(s,id,0,0,'ble');
    const worker=v.residents.find(r=>!r.unitId);worker.mission='agriculture';worker.workPosition=id==='red'?20:80;v.jobs.agriculture=1;}
  const before=Object.fromEntries(['red','blue'].map(id=>[id,{hp:s.players[id].villages[0].hp,idle:s.players[id].villages[0].residents.filter(r=>r.mission==='disponible').map(r=>r.id)}]));
  assert.equal(cast('u-diavulu',{lane:0}).accepted,true);assert.ok(!s.units.includes(deployed));
  for(const id of ['red','blue']){const v=s.players[id].villages[0];assert.equal(v.hp,before[id].hp);assert.equal(v.buildings.length,1);
    assert.ok(v.slots.every(slot=>!slot.content));assert.ok(before[id].idle.every(key=>v.residents.some(r=>r.id===key)));assert.equal(v.burnUntil,120);}
  assert.equal(E.Mythology.get('u-diavule').gameplay.shortDescription,'Anéantit le village de votre adversaire.');
  s.players.red.villages[0].destroyed=true;
  assert.equal(cast('u-diavulu',{lane:0}).accepted,false,'The existing living source village requirement remains');
});
test('A Mumma turns only intruders back toward their home',()=>{
  const {E,s,cast,deploy}=fixture(),intruder=deploy('blue'),outside=deploy('blue',1),friendly=deploy('red',2);
  intruder.position=20;outside.position=80;friendly.position=20;cast('a-mumma');
  assert.equal(intruder.mythologyRetreating,true);assert.equal(outside.mythologyRetreating,undefined);assert.equal(friendly.mythologyRetreating,undefined);
  E.Combat.update(s,.1);assert.ok(intruder.position>20);
});
test('I Lacramanti counts cumulative allied column deaths, buffs own humans only, including later deployments',()=>{
  const {E,s,cast,kill,deploy}=fixture();kill();kill();kill('blue');const own=deploy(),enemy=deploy('blue');cast('l-orcu',{playerId:'red',lane:0});
  const legend=s.units.find(u=>u.isLegend),before=[own.hp,own.damage,enemy.hp,legend.hp];cast('i-lacrimenti',{lane:0});
  assert.equal(own.hp,before[0]+4);assert.equal(own.damage,before[1]+2);assert.equal(enemy.hp,before[2]);assert.equal(legend.hp,before[3]);
  const later=deploy();assert.equal(later.hp,E.Config.units.habitant.hp+4);assert.equal(later.damage,E.Config.units.habitant.damage+2);
});
test('U Mazzeru reveals only offensive humans; Sainte-Lucie reveals whole enemy coastal regions until match end',()=>{
  const {E,s,cast,deploy}=fixture(),v=s.players.blue.villages[0];
  const attack=deploy('blue');assert.equal(E.MythologyEffects.unitVisible(s,'red',attack),false);cast('u-mazzeru');
  assert.equal(E.MythologyEffects.unitVisible(s,'red',attack),true);assert.equal(E.MythologyEffects.residentVisible(s,'red',v,v.residents.find(r=>!r.unitId)),false);
  s.elapsed=700;assert.equal(E.MythologyEffects.unitVisible(s,'red',attack),true);
  v.biome='littoral';cast('oeil-sainte-lucie');assert.equal(E.MythologyEffects.vision(s,'red',v).all,true);
  assert.equal(E.MythologyEffects.vision(s,'red',s.players.blue.villages[1]).all,false);
});
test('U Fullettu summons five fast units; enemy bank transfers conserve resources and stop on pause',()=>{
  const {E,s,cast}=fixture();for(const v of s.players.blue.villages)v.resources.ble=20;
  assert.equal(cast('u-fullettu').accepted,true);const units=s.units.filter(u=>u.mythologyLegendId==='u-fullettu');assert.equal(units.length,5);
  for(const u of units){assert.equal(u.hp,20);assert.equal(u.damage,0);assert.ok(u.position>=0&&u.position<50);u.position=100;}
  const total=()=>Object.values(s.players).flatMap(p=>p.villages).reduce((sum,v)=>sum+v.resources.ble,0);
  const before=total();E.MythologyEffects.update(s,E.Config.reinforcementPowers.fullettuGatherInterval);
  assert.equal(s.players.red.villages.reduce((n,v)=>n+v.resources.ble,0),5);assert.equal(total(),before);
  s.paused=true;E.MythologyEffects.update(s,100);assert.equal(s.players.red.villages.reduce((n,v)=>n+v.resources.ble,0),5);
});
test('follets appear on dry allied ground even at a coastal random boundary',()=>{
  const {E,s,cast,setRandom}=fixture();
  for(const player of Object.values(s.players))for(const village of player.villages)village.biome='littoral';
  setRandom(0);
  cast('u-fullettu');cast('u-fullettu',{},'blue');
  assert.equal(s.units.length,10);
  for(const unit of s.units){assert.equal(E.Transport.waterOwnerAt(s,unit.lane,unit.position),null);
    assert.ok(unit.ownerId==='red'?unit.position<50:unit.position>50);}
});
test('activation is idempotent, validates target and epoch, and refuses pause',()=>{
  const {E,s}=fixture(),request={epoch:'powers',activationId:'one',legendId:'u-magu',playerId:'red',target:{}};
  assert.equal(E.MythologyEffects.activate(s,request).accepted,true);assert.equal(E.MythologyEffects.activate(s,request).accepted,true);
  assert.equal(s.players.red.villages[0].nextMaguCharges,1);
  assert.equal(E.MythologyEffects.activate(s,{...request,activationId:'two',epoch:'old'}).accepted,false);
  s.paused=true;assert.equal(E.MythologyEffects.activate(s,{...request,activationId:'three'}).accepted,false);
});
