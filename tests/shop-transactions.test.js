'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function engine(){
  const context=vm.createContext({console,performance});context.window=context;
  for(const file of ['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board','combat','shop-transactions'])
    vm.runInContext(fs.readFileSync(path.join(root,'js',file+'.js'),'utf8'),context,{filename:file});
  const E=context.Eredita,sounds=[],receipts=[];
  E.Audio={play(){},playEffect(name){sounds.push(name);}};
  E.ShopTransactions.subscribe(r=>receipts.push(r));
  return {context,E,sounds,receipts};
}
const local=engine(),E=local.E,s=E.Board.createState();s.phase='running';s.selectedVillage={playerId:'red',lane:0};s.players.red.gold=20000;
const village=s.players.red.villages[0];village.buildings=[{type:'artisanat',level:3}];
function purchase(kind,type){return E.ShopTransactions.execute(s,'buyEquipment',[kind,type],()=>E.Equipment.buy(s,'red',0,kind,type));}
assert.equal(purchase('tools','fer'),false);assert.equal(purchase('tools','bronze'),false);
assert.equal(s.players.red.gold,20000);assert.equal(local.sounds.length,0,'Un refus ne joue pas le son de réussite');
assert.ok(purchase('tools','bois'));assert.equal(s.players.red.gold,19850);
assert.deepEqual(local.sounds,['shopPurchase']);
assert.equal(purchase('armors','maille'),false,'Les filières restent indépendantes');
assert.ok(purchase('tools','bronze'));assert.ok(purchase('tools','fer'));
assert.ok(purchase('armors','cuir'));assert.ok(purchase('armors','maille'));assert.ok(purchase('armors','fer'));
assert.equal(local.sounds.length,6);
const newcomer=E.Economy.addResident(village,s);assert.equal(newcomer.tool,'fer');assert.equal(newcomer.armor,'fer');
assert.equal(s.players.red.villages[1].equipment.tool,null);
const restored=JSON.parse(JSON.stringify(s));delete restored.players.red.villages[0].equipmentPurchases;
assert.equal(E.Equipment.buy(restored,'red',0,'tools','bois'),false,'Un ancien état équipé en fer ne régresse pas');
assert.equal(restored.players.red.villages[0].equipment.tool,'fer');
village.resources.ble=100;
E.ShopTransactions.execute(s,'sell',['ble',100],()=>E.Economy.sell(s,'red',0,'ble',100));
assert.equal(local.sounds.at(-1),'shopSale');assert.equal(local.receipts.at(-1).deltaGold,115);
E.ShopTransactions.observe(s);assert.equal(local.sounds.length,7,'Relire les reçus ne rejoue pas le son');

// Deux contextes distincts : l'hôte réel exécute game.js, l'invité attend son reçu.
const host=engine(),guest=engine();let handlers,view;const snapshots=[];
host.E.Network={mode:'host',playerId:'red',init(h){handlers=h;},sendState(state){snapshots.push(JSON.parse(JSON.stringify(state)));}};
host.E.UI={init(){},render(){},renderFrame(){}};
host.E.GameView={init(v){view=v;}};
host.context.document={querySelector(){return null;}};host.context.requestAnimationFrame=()=>{};
vm.runInContext(fs.readFileSync(path.join(root,'js/game.js'),'utf8'),host.context,{filename:'game.js'});
const state=view.getState();state.phase='running';state.players.blue.gold=20000;
const blue=state.players.blue.villages[0];blue.buildings=[{type:'bergerie',level:3},{type:'artisanat',level:3}];
const requestId=guest.E.ShopTransactions.issue('blue');
const message={method:'buySpecialAnimal',args:['chien'],playerId:'blue',commandId:requestId,view:{selectedVillage:{playerId:'blue',lane:0}}};
handlers.onCommand(message);
assert.equal(blue.animals.length,1);assert.equal(state.players.blue.gold,19880);
assert.equal(host.sounds.length,0,'Le PC Rouge ne joue pas le son de la commande Bleue');
assert.equal(guest.sounds.length,0,'Pas de son prédictif avant réception');
guest.E.ShopTransactions.observe(snapshots.at(-1));
assert.deepEqual(guest.sounds,['shopPurchase']);assert.equal(guest.receipts[0].deltaGold,-120);
handlers.onCommand(message);guest.E.ShopTransactions.observe(snapshots.at(-1));
assert.equal(blue.animals.length,1,'Le même identifiant ne crée pas un deuxième chien');
assert.equal(state.players.blue.gold,19880);assert.equal(guest.sounds.length,1);
const nextId=guest.E.ShopTransactions.issue('blue');handlers.onCommand({...message,commandId:nextId});guest.E.ShopTransactions.observe(snapshots.at(-1));
assert.equal(blue.animals.length,2,'Deux clics intentionnels distincts restent deux achats');assert.equal(guest.sounds.length,2);
const failedId=guest.E.ShopTransactions.issue('blue');handlers.onCommand({...message,method:'buyEquipment',args:['tools','fer'],commandId:failedId});
guest.E.ShopTransactions.observe(snapshots.at(-1));assert.equal(guest.sounds.length,2);assert.equal(guest.receipts.at(-1).accepted,false);assert.equal(blue.equipment.tool,null);
const before=JSON.stringify(state);
handlers.onCommand({...message,commandId:'bad-lane',view:{selectedVillage:{playerId:'blue',lane:99}}});
handlers.onCommand({...message,commandId:'enemy',view:{selectedVillage:{playerId:'red',lane:0}}});
assert.equal(JSON.stringify(state),before,'Ni village absent ni camp adverse');
for(let i=0;i<host.E.Config.shopReceiptHistory+1;i++)handlers.onCommand({...message,commandId:'rejected-'+i,method:'buyEquipment',args:['tools','fer']});
handlers.onCommand(message);assert.equal(blue.animals.length,2,'La déduplication dure toute la partie, pas seulement le journal de reçus');
assert.equal(state.shopReceipts.length,host.E.Config.shopReceiptHistory);
blue.destroyed=true;const deadId=guest.E.ShopTransactions.issue('blue');handlers.onCommand({...message,commandId:deadId});guest.E.ShopTransactions.observe(snapshots.at(-1));
assert.equal(blue.animals.length,2);assert.equal(guest.sounds.length,2,'Destruction avant validation : aucun achat ni son');
console.log('Transactions boutique : tiers, héritage, refus, son confirmé, reçus hôte/invité, doubles messages, nouveaux clics, villages et destruction validés.');
