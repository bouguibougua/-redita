'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{test}=require('node:test');
const root=path.join(__dirname,'..');
function fixture(){const context=vm.createContext({window:{},console});for(const name of ['config','mythology-data','mythology-effects','mythology-match','mythology-ui'])vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),context);return context.window.Eredita;}
const json=x=>JSON.parse(JSON.stringify(x));
test('one catalog contains the sixteen confirmed powers with stable IDs and all requested aliases',()=>{
 const E=fixture();assert.equal(E.Mythology.all.length,16);assert.equal(new Set(E.Mythology.all.map(x=>x.id)).size,16);
 for(const alias of ['A Strega','A Stregha'])assert.equal(E.Mythology.get(alias).id,'a-stregha');
 assert.equal(E.Mythology.get('u-diavule').id,'u-diavulu');assert.equal(E.Mythology.get('I Lacramanti').id,'i-lacrimenti');assert.equal(E.Mythology.get('Ochju di Santa Lucia').id,'oeil-sainte-lucie');
 for(const legend of E.Mythology.all){assert.equal(legend.gameplay.status,'confirmed');assert.ok(E.Mythology.categories.includes(legend.gameplay.category));assert.ok(E.MythologyMatch.activatable(legend));assert.equal(E.MythologyEffects.getBinding(legend.id).entryPoint,'MythologyEffects.activate');}
 assert.equal(E.Cards,undefined);assert.equal(E.CardGame,undefined);
});
test('sixteen real high-definition individual illustrations replace all missing assets',()=>{
 const E=fixture(),r=E.Mythology.report();assert.equal(r.missingNormal.length,0);assert.equal(r.cssMirrorFallback.length,16);assert.equal(r.missingReversed.length,16);
 for(const legend of E.Mythology.all){const a=legend.visuals.normal,bytes=fs.readFileSync(path.join(root,a.src));assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  const type=bytes.subarray(12,16).toString();let width,height;
  if(type==='VP8X'){width=bytes.readUIntLE(24,3)+1;height=bytes.readUIntLE(27,3)+1;}else{assert.equal(type,'VP8 ');width=bytes.readUInt16LE(26)&0x3fff;height=bytes.readUInt16LE(28)&0x3fff;}
  assert.equal(width,a.width);assert.equal(height,a.height);assert.deepEqual(json(a.crop),{x:0,y:0,width:1,height:1});assert.ok(bytes.length<600*1024,'WebP remains small for mobile/Quest');
  assert.equal(E.Mythology.getIllustration(legend.id,'right').mirrored,true);
 }
});
test('an explicit reversed illustration takes precedence and missing files are never guessed',()=>{
 const E=fixture(),normal=E.Mythology.all[0].visuals.normal,reversed=E.Mythology.all[1].visuals.normal;
 const r=E.Mythology.resolveIllustration({normal,reversed},'right');assert.equal(r.image,reversed);assert.equal(r.mirrored,false);
 assert.equal(E.Mythology.resolveIllustration({normal:null,reversed:null}).missing,true);
});
test('confirmed values resolve from the central reinforcement configuration without freezing it',()=>{
 const E=fixture();assert.equal(E.Mythology.getGameplay('squadra-arozza').parameters.resurrectionWindowSeconds,60);
 assert.equal(E.Mythology.getGameplay('u-magu').parameters.residentsPerVillage,1);assert.equal(E.Mythology.getGameplay('l-orcu').parameters.hp,200);
 E.Config.reinforcementPowers.stregaDuration=143;assert.equal(E.Mythology.getGameplay('a-stregha').parameters.durationSeconds,143);
 assert.equal(Object.isFrozen(E.Config.reinforcementPowers),false);assert.equal(Object.isFrozen(E.Mythology.all[0]),true);
});
test('crystal palettes always use the same catalog, independently from power eligibility',()=>{
 const E=fixture();for(const a of E.Mythology.all)for(const b of E.Mythology.all){const p=E.Mythology.getCrystalPalette(a.id,b.id);assert.equal(p.ready,true);assert.equal(p.left.primaryColor,a.visuals.primaryColor);assert.equal(p.right.primaryColor,b.visuals.primaryColor);assert.ok(Object.isFrozen(p));}
});
test('missing and invalid colors remain explicit issues without invented replacements',()=>{
 const E=fixture(),a=E.Mythology.all[0],b=E.Mythology.all[1];
 for(const value of [null,undefined,'invalid','#bad']){const p=E.Mythology.resolveCrystalPalette({...a,visuals:{...a.visuals,primaryColor:value}},b);assert.equal(p.ready,false);assert.equal(p.issues[0].field,'primaryColor');}
 const p=E.Mythology.getCrystalPalette(a.id,b.id);assert.equal(p.missingSecondary.includes('left'),true);
});
test('choice polygons retain four straight segments and exact reflected geometry, with the 500 ms delay',()=>{
 const E=fixture(),left=json(E.MythologyUI.cardGeometry('left')),right=json(E.MythologyUI.cardGeometry('right'));
 assert.deepEqual(left,[[0,0],[100,0],[100,100],[16,100]]);assert.deepEqual(right,left.map(([x,y])=>[100-x,y]).reverse());assert.equal(E.Config.mythology.crystal.cardsAppearAt,.5);
});
