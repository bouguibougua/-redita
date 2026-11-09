'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(owner){const c=vm.createContext({window:{},console});for(const n of ['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board','combat'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+n+'.js'),'utf8'),c);const E=c.window.Eredita,s=E.Board.createState('simplified');s.phase='running';s.preparationRemaining=0;for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.residents=[];v.population=0;}
 const foe=owner==='red'?'blue':'red',v=s.players[foe].villages[0],u=E.Units.create(owner,0,'ravageur',{profession:'ravageur'});u.hp=u.maxHp=1000;u.position=owner==='red'?10:90;s.units.push(u);const enemy=E.Units.create(foe,0,'habitant',{stance:'defense'});enemy.position=u.position;enemy.damage=0;s.units.push(enemy);E.Crops.place(s,foe,0,0,'ble');return {E,s,v,u,enemy,foe};}
for(const owner of ['red','blue'])test(owner+' ravager prioritizes crops, keeps its cadence and returns to units then village',()=>{
 const {E,s,v,u,enemy}=fixture(owner),position=u.position;E.Combat.update(s,.1);assert.equal(enemy.hp,enemy.maxHp);assert.ok(owner==='red'?u.position>position:u.position<position);
 u.position=enemy.position=E.Config.temporaryProduction.agricultureFieldPositionByOwner[v.ownerId];const crop=v.slots[0].content,hp=v.hp,damage=u.damage+E.Config.units.ravageur.villageDamageBonus;
 E.Combat.update(s,.1);assert.equal(crop.hp,crop.maxHp-damage);assert.equal(enemy.hp,enemy.maxHp);assert.equal(v.hp,hp);
 E.Combat.update(s,.5);assert.equal(crop.hp,crop.maxHp-damage);crop.hp=1;E.Combat.update(s,.5);assert.equal(v.slots[0].content,null);
 E.Combat.update(s,1);assert.equal(enemy.hp,enemy.maxHp-u.damage,'Unit damage has no crop specialization bonus');
 s.units=[u];u.position=owner==='red'?100:0;u.attackCooldown=0;E.Combat.update(s,.1);assert.equal(v.hp,hp-damage);
});
test('legend wolves keep their structures-only targeting and defending ravagers keep their post',()=>{
 const {E,s,v,u,enemy}=fixture('red');u.isLegend=true;u.mythologyLegendId='u-lupu-mannaru';u.structuresOnly=true;u.position=77;E.Combat.update(s,.1);assert.equal(v.slots[0].content.hp,200);assert.equal(enemy.hp,enemy.maxHp);
 u.isLegend=false;u.mythologyLegendId=null;u.structuresOnly=false;u.stance='defense';const position=u.position;E.Combat.update(s,.1);assert.equal(u.position,position);assert.equal(v.slots[0].content.hp,200);
});
