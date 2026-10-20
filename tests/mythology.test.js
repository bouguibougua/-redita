'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8');
const core = ['config','biomes','crops','livestock','equipment','units','buildings','transport','animals','economy','board','combat','cards','card-effects','card-game'];
const additions = ['mythology-data','mythology-effects','mythology-ui'];
function fixture(withCatalog = true) {
  const math = Object.create(Math); math.random = () => .5;
  const context = vm.createContext({ window: {}, Math: math });
  core.forEach(name => vm.runInContext(read(name), context, { filename: name }));
  if (withCatalog) additions.forEach(name => vm.runInContext(read(name), context, { filename: name }));
  return { context, E: context.window.Eredita };
}
const json = value => JSON.parse(JSON.stringify(value));
const names = ['U Mazzeru','A Stregha','U Stregu','A Fata','Anima in Pena',"L'Orcu",'U Magu','U Surpatore','U Lupu Mannaru','U Diavule','A Stregha Bianca',"A Squadra d'Arozza",'A Mumma','I Lacrimenti','U Fullettu','Ochju di Santa Lucia'];

test('the 16 legends preserve requested names, legacy IDs, aliases and explicit unknown powers', () => {
  const { E } = fixture();
  assert.deepEqual(json(E.Mythology.all.map(item => item.name)), names);
  assert.equal(new Set(E.Mythology.all.map(item => item.id)).size, 16);
  assert.equal(E.Mythology.get('u-diavule').id, 'u-diavulu');
  assert.equal(E.Mythology.get('A Squadra d’Arozza').id, 'squadra-arozza');
  assert.equal(E.Mythology.get('Ochju di Santa Lucia').id, 'oeil-sainte-lucie');
  assert.equal(E.Mythology.get('Œil de Sainte-Lucie').id, 'oeil-sainte-lucie');
  assert.equal(E.Mythology.get('unknown'), null);
  const report = E.Mythology.report();
  assert.equal(report.unconfiguredPowers.length, 11);
  for (const item of E.Mythology.all) {
    assert.ok(Object.isFrozen(item.visuals)); assert.ok(Object.isFrozen(item.gameplay));
    assert.match(item.visuals.primaryColor, /^#[0-9a-f]{6}$/i);
    if (item.gameplay.status === 'unconfigured') {
      assert.equal(item.gameplay.category, null);
      assert.equal(item.gameplay.parameters, null);
      assert.equal(item.gameplay.description, null);
      assert.equal(item.implementation.effectKey, null);
      assert.equal(E.MythologyEffects.getBinding(item.id), null);
      assert.equal(E.Cards.get(item.id), null, 'Unconfigured legend is not made playable');
    } else {
      assert.ok(E.Mythology.categories.includes(item.gameplay.category));
      assert.ok(item.gameplay.source.sections.length);
      const binding = E.MythologyEffects.getBinding(item.id);
      assert.equal(binding.cardId, item.id);
      assert.equal(binding.entryPoint, 'CardGame.play');
      assert.equal(binding.implementation, 'CardEffects.apply');
    }
  }
  assert.equal(E.MythologyEffects.apply, undefined, 'No alternative activation path bypasses card validation');
});

test('only real existing images are referenced and the full-card crop excludes printed text and icons', () => {
  const { E } = fixture(), report = E.Mythology.report();
  assert.equal(report.missingNormal.length, 11);
  assert.equal(report.missingReversed.length, 16);
  assert.equal(report.cssMirrorFallback.length, 5);
  for (const item of E.Mythology.all) {
    const left = E.Mythology.getIllustration(item.id), right = E.Mythology.getIllustration(item.id, 'right');
    assert.equal(left.mirrored, false);
    assert.equal(right.mirrored, Boolean(item.visuals.normal));
    assert.equal(right.image, item.visuals.normal);
    for (const asset of [item.visuals.normal, item.visuals.reversed].filter(Boolean)) {
      const bytes = fs.readFileSync(path.join(root, asset.src));
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      assert.equal(bytes.subarray(12, 16).toString(), 'VP8X');
      assert.equal(bytes.readUIntLE(24, 3) + 1, asset.width);
      assert.equal(bytes.readUIntLE(27, 3) + 1, asset.height);
      const crop = asset.crop;
      assert.ok(crop.x > 0 && crop.x + crop.width < 1);
      assert.ok(crop.y >= .12 && crop.y + crop.height <= .60, 'Crop stays between title and printed description');
    }
  }
});

test('a supplied reversed asset is used directly; missing sides are never guessed', () => {
  const { E } = fixture();
  const normal = E.Mythology.get('u-mazzeru').visuals.normal;
  const reversed = E.Mythology.get('a-stregha').visuals.normal; // Two real assets stand in for a future pair.
  const right = E.Mythology.resolveIllustration({ normal, reversed }, 'right');
  assert.equal(right.image, reversed); assert.equal(right.mirrored, false); assert.equal(right.source, 'reversed');
  assert.equal(E.Mythology.resolveIllustration({ normal, reversed }, 'left').image, normal);
  assert.equal(E.Mythology.resolveIllustration({ normal: null, reversed }, 'left').missing, true);
  assert.equal(E.Mythology.resolveIllustration({ normal: null, reversed }, 'right').missing, false);
});

test('confirmed gameplay parameters follow existing Config without duplicating tunable timings', () => {
  const { E } = fixture();
  assert.equal(E.Mythology.getGameplay('u-mazzeru').parameters.durationSeconds, 120);
  assert.equal(E.Mythology.getGameplay('a-stregha').parameters.productionMultiplier, .5);
  assert.equal(E.Mythology.getGameplay('u-diavule').parameters.mountainDamage, 125);
  assert.equal(E.Mythology.getGameplay('squadra-arozza').parameters.resurrectionWindowSeconds, 180);
  assert.equal(E.Mythology.getGameplay('squadra-arozza').parameters.plainsResurrectionWindowSeconds, 300);
  assert.equal(E.Mythology.getGameplay('ochju-di-santa-lucia').parameters.sourceBiome, 'littoral');
  E.Config.cardGame.effectDuration = 143;
  assert.equal(E.Mythology.getGameplay('u-mazzeru').parameters.durationSeconds, 143);
  assert.equal(E.Mythology.getGameplay('a-stregha').parameters.durationSeconds, 143);
  assert.equal(E.Mythology.getGameplay('u-diavule').parameters.burnDurationSeconds, 143);
  assert.equal(Object.isFrozen(E.Config.cardGame), false, 'Reading the catalog must not freeze existing balance configuration');
});

test('the crystal reads both palettes from the catalog independently of power configuration', () => {
  const { E } = fixture(), before = JSON.stringify(E.Config.mythology.entries);
  for (const left of E.Mythology.all) for (const right of E.Mythology.all) {
    const palette = E.Mythology.getCrystalPalette(left.id, right.id);
    assert.equal(palette.ready, true);
    assert.equal(palette.left.primaryColor, left.visuals.primaryColor);
    assert.equal(palette.right.primaryColor, right.visuals.primaryColor);
    assert.equal(palette.left.secondaryColor, left.visuals.secondaryColor);
    assert.equal(palette.right.secondaryColor, right.visuals.secondaryColor);
    assert.equal(palette.provisional, true);
    assert.ok(Object.isFrozen(palette.left));
    assert.equal(palette.missingSecondary.includes('left'), left.visuals.secondaryColor === null);
    assert.equal(palette.missingSecondary.includes('right'), right.visuals.secondaryColor === null);
  }
  assert.equal(E.Mythology.getCrystalPalette('u-diavule', 'U Mazzeru').left.id, 'u-diavulu');
  assert.equal(E.Mythology.get('u-stregu').gameplay.status, 'unconfigured');
  assert.equal(E.Mythology.getCrystalPalette('u-stregu', 'a-fata').ready, true);
  assert.equal(JSON.stringify(E.Config.mythology.entries), before);
});

test('missing or invalid crystal colors are reported without inventing a fallback', () => {
  const { E } = fixture(), legend = E.Mythology.get('u-mazzeru'), other = E.Mythology.get('a-fata');
  for (const value of [null, undefined, '', 'invalid', '#bad', 42]) {
    const incomplete = { ...legend, visuals: { ...legend.visuals, primaryColor: value } };
    const palette = E.Mythology.resolveCrystalPalette(incomplete, other);
    assert.equal(palette.ready, false);
    assert.equal(palette.issues[0].field, 'primaryColor');
    assert.equal(palette.issues[0].side, 'left');
    assert.equal(palette.left.primaryColor, value === undefined || value === '' ? null : value);
  }
  const incomplete = { ...legend, visuals: { ...legend.visuals, secondaryColor: null } };
  const optional = E.Mythology.resolveCrystalPalette(incomplete, other);
  assert.equal(optional.ready, true); assert.equal(optional.left.secondaryColor, null);
  assert.deepEqual(json(optional.missingSecondary), ['left', 'right']);
  const invalidSecondary = E.Mythology.resolveCrystalPalette({ ...legend, visuals: { ...legend.visuals, secondaryColor: 'invalid' } }, other);
  assert.equal(invalidSecondary.ready, false); assert.equal(invalidSecondary.issues[0].field, 'secondaryColor');
  const unknown = E.Mythology.getCrystalPalette('absent', other.id);
  assert.equal(unknown.ready, false); assert.equal(unknown.left, null);
  assert.equal(unknown.issues[0].field, 'legend');
});

test('loading and consulting the catalog preserves state, rules, cards and simulation functions', () => {
  const { context, E } = fixture(false);
  const state = E.Board.createState('classic'), before = JSON.stringify(state);
  const config = JSON.stringify(E.Config), cards = JSON.stringify(E.Cards.all);
  const methods = [E.Board.createState, E.Units.create, E.Economy.update, E.Combat.update, E.CardGame.play, E.CardEffects.apply];
  additions.forEach(name => vm.runInContext(read(name), context));
  for (const item of E.Mythology.all) {
    E.Mythology.getGameplay(item.id); E.Mythology.getIllustration(item.id, 'right'); E.MythologyEffects.getBinding(item.id);
  }
  assert.equal(JSON.stringify(state), before);
  const { mythology, ...originalConfig } = E.Config;
  assert.equal(JSON.stringify(originalConfig), config);
  assert.equal(JSON.stringify(E.Cards.all), cards);
  assert.deepEqual([E.Board.createState, E.Units.create, E.Economy.update, E.Combat.update, E.CardGame.play, E.CardEffects.apply], methods);
  assert.equal(E.Cards.all.length, 39); assert.equal(E.Cards.mythological.length, 5);
  assert.equal(E.Cards.rules.mythologicalMax, 3); assert.equal(E.Cards.rules.futureMythologicalDraw, 2);
  assert.equal(E.CardGame.validateDeck({ quantities: { habitant: 1 }, mythological: ['u-stregu'] }), false);
});

test('the five existing effects produce the same match state with and without the catalog', () => {
  function result(withCatalog, cardId) {
    const { E } = fixture(withCatalog), state = E.Board.createState('classic');
    state.phase = 'running'; state.elapsed = 650;
    for (const player of Object.values(state.players)) player.villages.forEach(village => {
      village.biome = 'littoral'; village.slots = E.Biomes.createSlots('littoral');
    });
    E.CardGame.start(state, () => .5);
    E.Economy.removeResident(state, 'red', 0, state.players.red.villages[0].residents[0].id);
    state.players.red.cards.mythological = [{ id: 'test-held', cardId, unlockAt: 0, used: false }];
    const allowed = Boolean(E.CardGame.play(state, 'red', 'test-held', { lane: 0, targetLane: 0 })?.allowed);
    return { allowed, state: JSON.stringify(state) };
  }
  for (const id of ['u-mazzeru','a-stregha','u-diavulu','squadra-arozza','oeil-sainte-lucie']) {
    const old = result(false, id), added = result(true, id);
    assert.equal(old.allowed, true, id); assert.deepEqual(added, old, id);
  }
});
