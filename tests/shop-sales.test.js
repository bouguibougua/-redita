'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
global.window=global;
['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board'].forEach(file=>vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),{filename:file}));
const E=Eredita,s=E.Board.createState(),v=s.players.red.villages[0],neighbor=s.players.red.villages[1];
s.phase='running';s.paused=false;v.buildings=[{type:'artisanat',level:2},{type:'boucherie',level:3}];
for(const resource of E.Config.resources){
  v.resources[resource]=1110;neighbor.resources[resource]=234;
  for(const quantity of E.Config.shopSaleQuantities){
    const bonus=['viande','poisson'].includes(resource)?.15:.1;
    const q=E.Economy.saleQuote(v,resource,quantity);
    assert.equal(q.amount,quantity);assert.equal(q.gold,quantity*E.Config.resourceSaleValues[resource]*(1+bonus));
    const before=s.players.red.gold;assert.ok(E.Economy.sell(s,'red',0,resource,quantity));
    assert.equal(s.players.red.gold,before+q.gold);assert.equal(neighbor.resources[resource],234);
  }
  assert.equal(v.resources[resource],0);
  const before=s.players.red.gold;assert.equal(E.Economy.sell(s,'red',0,resource,10),false);assert.equal(s.players.red.gold,before);
}
v.resources.ble=99;
for(const quantity of [100,1000,0,-10,1,15,10.5,NaN,Infinity,'10',null,{},[],true]){
  const before=JSON.stringify(s);assert.equal(E.Economy.sell(s,'red',0,'ble',quantity),false);assert.equal(JSON.stringify(s),before);
}
assert.equal(E.Economy.sell(s,'red',0,'__proto__',100),false);
assert.equal(E.Economy.sell(s,'red',0,'ble',10).amount,10);
v.resources.ble=3;assert.equal(E.Economy.sell(s,'red',0,'ble').amount,3,'Le bouton historique vend encore le reliquat');
for(const block of ['paused','destroyed','phase']){
  v.resources.ble=1000;s.paused=block==='paused';v.destroyed=block==='destroyed';s.phase=block==='phase'?'setup':'running';
  const before=JSON.stringify(s);assert.equal(E.Economy.sell(s,'red',0,'ble',100),false);assert.equal(JSON.stringify(s),before);
}
console.log('Ventes boutique : 6 ressources, 3 lots exacts, prix et meilleur bonus, stocks locaux, anciens boutons, refus invalides et états bloqués validés.');
