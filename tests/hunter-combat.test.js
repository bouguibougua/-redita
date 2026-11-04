'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
global.window=global;
for(const file of ['config','biomes','crops','livestock','units','buildings','transport','equipment','animals','economy','board','combat'])vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),{filename:file});
const E=Eredita;
function setup(owner='red',stance='attack'){
 const s=E.Board.createState('classic');s.phase='running';s.paused=false;s.preparationRemaining=0;
 for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');}
 const r=s.players[owner].villages[0].residents[0];r.profession='chasseur';assert.ok(E.Economy.deployResident(s,owner,0,r.id,stance==='defense'?'defense':'attaque'));
 const archer=s.units[0],foe=owner==='red'?'blue':'red';archer.position=50;
 const enemy=E.Units.create(foe,0,'habitant');enemy.position=owner==='red'?65:35;s.units.push(enemy);
 return {s,archer,enemy};
}
for(const owner of ['red','blue'])for(const stance of ['attack','defense']){
 const {s,archer,enemy}=setup(owner,stance),hp=enemy.hp,health=archer.hp;
 E.Combat.update(s,.01);assert.equal(enemy.hp,hp-archer.damage,'Tir à 15 unités');assert.equal(archer.position,50,'Le chasseur s’arrête à portée');assert.equal(archer.hp,health,'Le corps à corps adverse ne touche pas à distance');assert.equal(archer.visualAttackTarget.position,owner==='red'?65:35);
 E.Combat.update(s,.01);assert.equal(enemy.hp,hp-archer.damage,'La cadence est respectée');E.Combat.update(s,1);assert.equal(enemy.hp,hp-2*archer.damage);
}
{
 const {s,archer,enemy}=setup();enemy.position=65.1;E.Combat.update(s,.01);assert.equal(enemy.hp,enemy.maxHp,'Hors portée');assert.ok(archer.position>50,'Approche');
}
{
 const {s,archer,enemy}=setup();archer.profession='habitant';E.Combat.update(s,.01);assert.equal(enemy.hp,enemy.maxHp,'Un sans métier ne gagne pas la portée');
}
{
 const {s,archer,enemy}=setup();enemy.lanePosition=1;E.Combat.update(s,.01);assert.equal(enemy.hp,enemy.maxHp,'Pas de tir vers une autre ligne');
}
{
 const {s,archer,enemy}=setup();archer.position=85;s.units=[archer];const v=s.players.blue.villages[0],hp=v.hp,own=archer.hp;E.Combat.update(s,.01);assert.equal(v.hp,hp-archer.damage,'Tir à distance sur village');assert.equal(archer.hp,own,'Riposte de contact limitée à sa portée');
 archer.position=98;E.Combat.update(s,.01);assert.equal(archer.hp,own-E.Config.combat.villageRetaliationDamagePerSecond,'Riposte de contact conservée');
}
{
 const {s,archer,enemy}=setup();enemy.hp=archer.damage;E.Combat.update(s,.01);assert.ok(!s.units.includes(enemy),'Une flèche tue sans attendre un projectile visuel');assert.equal(s.unitDeathEffects[0].profession,'habitant');
}
{
 const {s,archer,enemy}=setup();s.paused=true;const snapshot=JSON.stringify(s);E.Combat.update(s,1);assert.equal(JSON.stringify(s),snapshot,'Pause');
}
console.log('Chasseur : portée 15, détection, attaque/défense, deux camps, cadence, limites, village, mort et pause validés.');
