'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
global.window=global;
['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board'].forEach(file=>vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8')));
const E=Eredita,s=E.Board.createState();s.phase='running';s.players.red.gold=20000;
const v=s.players.red.villages[0];v.biome='littoral';v.buildings=[{type:'artisanat',level:3},{type:'boucherie',level:3}];
for(const kind of ['tools','armors'])for(const type of Object.keys(E.Config.equipment[kind]))assert.ok(E.Equipment.buy(s,'red',0,kind,type));
for(const kind of ['tools','armors'])for(const type of Object.keys(E.Config.equipment[kind])){
  const before=JSON.stringify(s);assert.equal(E.Equipment.quote(s,'red',0,kind,type).soldOut,true);assert.equal(E.Equipment.buy(s,'red',0,kind,type),false);assert.equal(JSON.stringify(s),before);
}
assert.ok(E.Transport.buy(s,'red',0,'barque'));assert.equal(E.Transport.buy(s,'red',0,'barque'),false);
for(let i=0;i<3;i++){assert.equal(E.Transport.shopQuote(s,'red',0,'filet').soldOut,false);assert.ok(E.Transport.buy(s,'red',0,'filet'));}
const before=JSON.stringify(s);assert.equal(E.Transport.shopQuote(s,'red',0,'filet').soldOut,true);assert.equal(E.Transport.buy(s,'red',0,'filet'),false);assert.equal(JSON.stringify(s),before);
const snapshot=JSON.parse(JSON.stringify(s));assert.equal(E.Equipment.quote(snapshot,'red',0,'tools','bois').soldOut,true);assert.equal(E.Transport.shopQuote(snapshot,'red',0,'filet').soldOut,true);
assert.equal(E.Equipment.quote(snapshot,'red',1,'tools','bois').soldOut,false);assert.equal(E.Transport.shopQuote(snapshot,'red',1,'barque').soldOut,false);
assert.equal(E.Transport.buy(s,'red',0,'piege-defense'),false);assert.equal(E.Transport.buy(s,'red',0,'piege-chasse'),false);
assert.equal(E.Config.shopCatalogLimits['piege-defense'],5);assert.equal(E.Config.shopCatalogLimits['piege-chasse'],10);
console.log('Stocks boutique : six équipements uniques, historique après remplacement et snapshot, une barque, trois filets, villages indépendants et pièges inactifs validés.');
