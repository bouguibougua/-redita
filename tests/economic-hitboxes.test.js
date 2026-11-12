'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(format,owner,wolf=false){const c=vm.createContext({window:{},console});for(const n of ['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board','combat'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/'+n+'.js'),'utf8'),c);const E=c.window.Eredita,s=E.Board.createState(format);s.phase='running';s.preparationRemaining=0;
 for(const p of Object.values(s.players))for(const v of p.villages){v.biome='plaine';v.slots=E.Biomes.createSlots('plaine');v.residents=[];v.population=0;}
 const enemy=owner==='red'?'blue':'red',v=s.players[enemy].villages[0],u=E.Units.create(owner,0,'ravageur',{profession:'ravageur'});if(wolf)Object.assign(u,{isLegend:true,mythologyLegendId:'u-lupu-mannaru',structuresOnly:true,hp:60,maxHp:60,damage:20});s.units.push(u);return{E,s,v,u,owner,enemy};}
function distance(E,s,u,b){return Math.hypot((b.offset-(u.terrainOffset||0))*E.Board.widthScale(s),E.Board.combatZ(b.position)-E.Board.combatZ(u.position));}
for(const format of ['classic','simplified'])for(const owner of ['red','blue'])for(const wolf of [false,true])test([format,owner,wolf?'Lupu':'Ravageur','contacts each crop/herd, destroys then resumes toward village'].join(' '),()=>{
 const {E,s,v,u}=fixture(format,owner,wolf);
 for(let i=0;i<4;i++)v.slots[i].content={category:i%2?'livestock':'crop',type:i%2?'chevre':'ble',hp:45,maxHp:45,count:2,reproductionProgress:0};
 const initial=v.hp;let hits=0,firstHit=false;
 for(let tick=0;tick<2500&&v.slots.some(x=>x.content);tick++){
  const boxes=v.slots.map((x,i)=>E.Board.slotHitbox(s,v,i));const before=v.slots.map(x=>x.content?.hp||0);E.Combat.update(s,.05);
  v.slots.forEach((slot,index)=>{if((slot.content?.hp||0)<before[index]){const b=boxes[index];assert.ok(distance(E,s,u,b)<=b.radius+E.Config.economicHitboxes.contactReach+1e-7);assert.equal(u.economicTarget.slotIndex,index);hits++;firstHit=true;}});
  assert.equal(v.hp,initial,'economic targets before village');
 }
 assert.ok(firstHit&&hits>=8);assert.ok(v.slots.every(x=>!x.content),'all four slots cleared');
 for(let i=0;i<1600&&v.hp===initial;i++)E.Combat.update(s,.05);assert.ok(v.hp<initial);assert.ok(Math.abs(u.terrainOffset)<.0001);
 assert.doesNotThrow(()=>JSON.stringify(s));
});
test('opposite-side slot is not hit remotely; target coordinates and corpse keep their offset',()=>{
 const{E,s,v,u}=fixture('simplified','red',true);v.slots[1].content={category:'crop',type:'ble',hp:200,maxHp:200};const b=E.Board.slotHitbox(s,v,1);u.position=b.position;
 E.Combat.update(s,.01);assert.equal(v.slots[1].content.hp,200);assert.ok(u.terrainOffset>0);assert.equal(u.visualAttackSequence,0);
 for(let i=0;i<150&&u.visualAttackSequence===0;i++)E.Combat.update(s,.05);
 assert.equal(u.visualAttackTarget.terrainOffset,b.offset);assert.equal(u.visualAttackTarget.position,b.position);
 const offset=u.terrainOffset;u.hp=0;E.Combat.settleDeaths(s);assert.equal(s.unitDeathEffects[0].terrainOffset,offset);
});
test('no hits or movement during pause/preparation/defense; ordinary warriors and allied fields unaffected',()=>{
 const{E,s,v,u,owner}=fixture('classic','red');v.slots[0].content={category:'crop',type:'ble',hp:200,maxHp:200};s.players[owner].villages[0].slots[0].content={...v.slots[0].content};
 const before=JSON.stringify(s.units);s.paused=true;E.Combat.update(s,1);assert.equal(JSON.stringify(s.units),before);s.paused=false;s.preparationRemaining=1;E.Combat.update(s,1);assert.equal(JSON.stringify(s.units),before);s.preparationRemaining=0;
 u.stance='defense';E.Combat.update(s,1);assert.equal(u.position,0);assert.equal(v.slots[0].content.hp,200);u.stance='attack';u.role=u.profession='guerrier';
 for(let i=0;i<100;i++)E.Combat.update(s,.1);assert.equal(v.slots[0].content.hp,200);assert.equal(s.players[owner].villages[0].slots[0].content.hp,200);
});
test('contact geometry mirrors both sides, handles two-slot coasts and projection round trips',()=>{
 const{E,s,v}=fixture('classic','red');for(const x of [0,10,23,30,37,50,70,77,90,100])assert.ok(Math.abs(E.Board.combatPosition(E.Board.combatZ(x))-x)<1e-8);
 const red=s.players.red.villages[0];for(let i=0;i<4;i++){const a=E.Board.slotHitbox(s,red,i),b=E.Board.slotHitbox(s,v,i);assert.ok(Math.abs(a.position+b.position-100)<1e-8);assert.equal(a.offset,b.offset);}
 v.biome='littoral';v.slots=E.Biomes.createSlots('littoral');assert.ok(E.Board.slotHitbox(s,v,1));assert.equal(E.Board.slotHitbox(s,v,2),null);
});
