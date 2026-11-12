'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(owner){const c=vm.createContext({window:{},console});for(const n of ['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board','combat'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+n+'.js'),'utf8'),c);const E=c.window.Eredita,s=E.Board.createState('simplified');s.phase='running';s.preparationRemaining=0;for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.residents=[];v.population=0;}
 const foe=owner==='red'?'blue':'red',v=s.players[foe].villages[0],u=E.Units.create(owner,0,'ravageur',{profession:'ravageur'});u.hp=u.maxHp=1000;u.position=owner==='red'?10:90;s.units.push(u);const enemy=E.Units.create(foe,0,'habitant',{stance:'defense'});enemy.position=u.position;enemy.damage=0;s.units.push(enemy);E.Crops.place(s,foe,0,0,'ble');return {E,s,v,u,enemy,foe};}
for(const owner of ['red','blue'])test(owner+' ravager prioritizes crops, keeps its cadence and returns to units then village',()=>{
 const {E,s,v,u,enemy}=fixture(owner),position=u.position;E.Combat.update(s,.1);assert.equal(enemy.hp,enemy.maxHp);assert.ok(owner==='red'?u.position>position:u.position<position);
 const box=E.Board.slotHitbox(s,v,0);u.position=enemy.position=box.position;u.terrainOffset=enemy.terrainOffset=box.offset;const crop=v.slots[0].content,hp=v.hp,damage=u.damage+E.Config.units.ravageur.villageDamageBonus;
 E.Combat.update(s,.1);assert.equal(crop.hp,crop.maxHp-damage);assert.equal(enemy.hp,enemy.maxHp);assert.equal(v.hp,hp);
 E.Combat.update(s,.5);assert.equal(crop.hp,crop.maxHp-damage);crop.hp=1;E.Combat.update(s,.5);assert.equal(v.slots[0].content,null);
 enemy.terrainOffset=0;
 for(let i=0;i<80&&enemy.hp===enemy.maxHp;i++)E.Combat.update(s,.1);assert.equal(enemy.hp,enemy.maxHp-u.damage,'Unit damage has no crop specialization bonus');
 s.units=[u];u.terrainOffset=0;u.position=owner==='red'?100:0;u.attackCooldown=0;E.Combat.update(s,.1);assert.equal(v.hp,hp-damage);
});
test('Lupu now targets crops as requested; defending ravagers still keep their post',()=>{
 const {E,s,v,u,enemy}=fixture('red');u.isLegend=true;u.mythologyLegendId='u-lupu-mannaru';u.structuresOnly=true;
 const box=E.Board.slotHitbox(s,v,0);u.position=box.position;u.terrainOffset=box.offset;E.Combat.update(s,.1);
 assert.equal(v.slots[0].content.hp,200-u.damage-E.Config.units.ravageur.villageDamageBonus);assert.equal(enemy.hp,enemy.maxHp);
 u.isLegend=false;u.mythologyLegendId=null;u.structuresOnly=false;u.stance='defense';const position=u.position,hp=v.slots[0].content.hp;E.Combat.update(s,.1);assert.equal(u.position,position);assert.equal(v.slots[0].content.hp,hp);
});
