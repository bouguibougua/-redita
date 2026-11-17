(function () {
  'use strict';
  const E=window.Eredita;
  const methods=new Set(['sell','buyEquipment','buyShopItem','buyAnimal','buySpecialAnimal']);
  const pending=new Map(),listeners=new Set(),processed=new WeakMap();
  let serial=0;
  const session=globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  function issue(playerId){const id=`${session}:${++serial}`;pending.set(id,playerId);return id;}
  function itemId(method,args){
    if(method==='buyEquipment'){const offset=args.length===3?1:0;return `${args[offset]}-${args[offset+1]}`;}
    return args[0];
  }
  function observe(state){
    for(const receipt of state.shopReceipts||[]){
      if(!pending.has(receipt.id)||pending.get(receipt.id)!==receipt.playerId)continue;
      pending.delete(receipt.id);
      if(receipt.accepted)E.Audio?.playEffect(receipt.method==='sell'?'shopSale':'shopPurchase');
      for(const listener of listeners)listener(receipt);
    }
  }
  function execute(state,method,args,run,id,feedback=true){
    if(!methods.has(method))return run();
    if(id!==undefined&&(typeof id!=='string'||id.length>160||!id.length))return false;
    const local=id===undefined;if(local){id=issue(state.selectedVillage.playerId);if(!feedback)pending.delete(id);}
    const {playerId,lane}=state.selectedVillage;
    const key=`${playerId}:${id}`;
    if(!processed.has(state))processed.set(state,new Map());
    const cache=processed.get(state);
    if(cache.has(key)){
      const receipt=cache.get(key);
      // Un reçu sorti du journal peut être renvoyé sans exécuter de nouveau l'achat.
      if(!(state.shopReceipts||[]).some(r=>r.id===id&&r.playerId===playerId))
        state.shopReceipts=[...(state.shopReceipts||[]),receipt].slice(-E.Config.shopReceiptHistory);
      return receipt.accepted;
    }
    const before=state.players[playerId].gold;
    const result=run();
    const receipt={id,playerId,lane,method,itemId:itemId(method,args),accepted:Boolean(result),deltaGold:state.players[playerId].gold-before};
    cache.set(key,receipt);
    state.shopReceipts=[...(state.shopReceipts||[]),receipt].slice(-E.Config.shopReceiptHistory);
    if(local)observe(state);
    return result;
  }
  E.ShopTransactions={methods,issue,execute,observe,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},resetPending(){pending.clear();}};
}());
