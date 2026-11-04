'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
global.window=global;
for(const file of ['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board','combat','mythology-data','mythology-effects'])vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),{filename:file});
const E=Eredita;
function setup(){const s=E.Board.createState('classic');s.phase='running';s.preparationRemaining=0;s.reinforcementEpoch='village-equipment';E.MythologyEffects.init(s);const v=s.players.red.villages[0];v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');E.Buildings.buildT1(s,'red',0,'artisanat');v.buildings[0].level=3;return {s,v};}
assert.deepEqual(Object.values(E.Config.equipment.tools).map(i=>i.gold),[150,250,400]);assert.deepEqual(Object.values(E.Config.equipment.armors).map(i=>i.gold),[150,250,400]);
{
 const {s,v}=setup(),attacker=v.residents[2],guard=v.residents[3];
 v.residents[1].mission='agriculture';
 guard.mythologyStatMultiplier=2;guard.mythologyHpBonus=7;guard.mythologyDamageBonus=3;
 E.Economy.deployResident(s,'red',0,attacker.id,'attaque');E.Economy.deployResident(s,'red',0,guard.id,'defense');
 const attackUnit=s.units[0],guardUnit=s.units[1];attackUnit.hp-=12;guardUnit.hp-=5;
 const ghost={id:'legend-resident',name:'Légende',isLegend:true,mythologyLegendId:'anima-in-pena',profession:'habitant',mission:'disponible',tool:'bronze',armor:'fer',hp:5};v.residents.push(ghost);
 const legend=E.Units.create('red',0,'habitant');Object.assign(legend,{isLegend:true,mythologyLegendId:'l-orcu',hp:200,maxHp:200,damage:30});
 const dog=E.Units.create('red',0,'chien',{animalType:'chien'}),other=E.Units.create('red',1,'habitant'),enemy=E.Units.create('blue',0,'habitant'),dead=E.Units.create('red',0,'habitant');dead.hp=0;other.lane=0;s.units.push(legend,dog,other,enemy,dead);
 const protectedBefore=JSON.stringify({ghost,legend,dog,other,enemy,dead,neighbor:s.players.red.villages[1].residents,opponent:s.players.blue.villages[0].residents});
 const beforeGold=s.players.red.gold,attackMax=attackUnit.maxHp,attackDamage=attackUnit.damage;
 assert.ok(E.Equipment.buy(s,'red',0,'tools','bois'));assert.equal(s.players.red.gold,beforeGold-150,'Un seul prix pour le village');
 assert.ok(v.residents.filter(r=>!r.isLegend).every(r=>r.tool==='bois'));assert.equal(attackUnit.tool,'bois');assert.equal(attackUnit.damage,attackDamage+5);assert.equal(guardUnit.damage,27,'Multiplicateur et bonus mythologique conservés');
 assert.ok(E.Equipment.buy(s,'red',0,'armors','cuir'));assert.equal(s.players.red.gold,beforeGold-300);assert.ok(v.residents.filter(r=>!r.isLegend).every(r=>r.armor==='cuir'));assert.equal(attackUnit.maxHp,attackMax+15);assert.equal(attackUnit.maxHp-attackUnit.hp,12);assert.equal(guardUnit.maxHp,147);assert.equal(guardUnit.maxHp-guardUnit.hp,5);
 assert.equal(JSON.stringify({ghost,legend,dog,other,enemy,dead,neighbor:s.players.red.villages[1].residents,opponent:s.players.blue.villages[0].residents}),protectedBefore,'Légendes, animaux, autre village, adversaire et morts exclus');
 const snapshot=JSON.stringify(s);assert.equal(E.Equipment.buy(s,'red',0,'tools','bois'),false);assert.equal(JSON.stringify(s),snapshot,'Aucun second paiement');
 const newborn=E.Economy.addResident(v,s);assert.equal(newborn.tool,'bois');assert.equal(newborn.armor,'cuir');
 v.resources.ble=1000;const purchased=E.Economy.buyResident(s,'red',0,'ble');assert.equal(purchased.tool,'bois');assert.equal(purchased.armor,'cuir');
 const beforeBirth=new Set(v.residents.map(r=>r.id));E.Economy.updatePopulation(s,E.Config.population.generationByLivingVillages[4]+.01);const natural=v.residents.find(r=>!beforeBirth.has(r.id));assert.ok(natural);assert.equal(natural.tool,'bois');assert.equal(natural.armor,'cuir');
 v.nextResidentProfession='guerrier';v.nextResidentMission='attaque';const recruit=E.Economy.addResident(v,s),deployed=s.units.find(u=>u.id===recruit.unitId);assert.equal(deployed.tool,'bois');assert.equal(deployed.armor,'cuir');assert.equal(deployed.maxHp,90);assert.equal(deployed.damage,17,'Équipement hérité avant le déploiement automatique');
 const bonusBefore={hp:guardUnit.artisanatHpBonus,damage:guardUnit.artisanatDamageBonus};E.Buildings.updateArtisanatBonuses(s);assert.equal(guardUnit.maxHp,147);assert.equal(guardUnit.damage,27);assert.deepEqual({hp:guardUnit.artisanatHpBonus,damage:guardUnit.artisanatDamageBonus},bonusBefore);
 assert.ok(E.Equipment.buy(s,'red',0,'tools','fer'));assert.equal(attackUnit.damage,attackDamage+20,'Remplacement sans cumul');assert.equal(guardUnit.damage,57);assert.ok(E.Equipment.buy(s,'red',0,'armors','maille'));assert.equal(attackUnit.maxHp,attackMax+35);assert.equal(attackUnit.maxHp-attackUnit.hp,12);assert.equal(guardUnit.maxHp,187);assert.equal(guardUnit.maxHp-guardUnit.hp,5);
 assert.deepEqual(v.equipment,{tool:'fer',armor:'maille'});assert.equal(v.residents[1].mission,'agriculture','Tâches et métiers conservés');
 // A newly transformed legendary invocation never inherits the village equipment.
 v.nextLupuCharges=1;const born=E.Economy.addResident(v,s);assert.ok(!v.residents.includes(born));const wolf=s.units.at(-1);assert.equal(wolf.mythologyLegendId,'u-lupu-mannaru');assert.equal(wolf.tool,null);assert.equal(wolf.armor,null);assert.equal(wolf.hp,60);assert.equal(wolf.damage,20);
 const received=JSON.parse(JSON.stringify(s)),arrival=E.Economy.addResident(received.players.red.villages[0]);assert.equal(arrival.tool,'fer');assert.equal(arrival.armor,'maille','Les snapshots conservent les achats du village');
}
{
 const {s,v}=setup();v.residents=[];v.population=0;assert.ok(E.Equipment.buy(s,'red',0,'tools','bois'),'Achat possible pour les futurs habitants');assert.equal(E.Economy.addResident(v,s).tool,'bois');
}
{
 const {s,v}=setup();E.Equipment.buy(s,'red',0,'tools','bois');E.Equipment.buy(s,'red',0,'armors','cuir');const r=v.residents[0];E.Economy.deployResident(s,'red',0,r.id,'attaque');s.units[0].hp=0;E.Combat.settleDeaths(s);
 E.Equipment.buy(s,'red',0,'tools','bronze');E.Equipment.buy(s,'red',0,'armors','maille');const before=v.residents.length;
 const result=E.MythologyEffects.activate(s,{epoch:s.reinforcementEpoch,playerId:'red',legendId:'squadra-arozza',target:{},activationId:'resurrection'});assert.equal(result.accepted,true);E.MythologyEffects.update(s,.1);assert.equal(v.residents.length,before+1);assert.equal(v.residents.at(-1).tool,'bronze');assert.equal(v.residents.at(-1).armor,'maille','La résurrection adopte l’équipement actuel du village');
}
console.log('Équipement collectif : prix, paiement unique, habitants actuels/futurs, combattants blessés, bonus, exclusions, isolation des villages, snapshots et résurrection validés.');
