const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const context = vm.createContext({ window: {}, console, Audio: undefined });
for (const filename of ["cards.js", "decks.js"]) {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", filename), "utf8");
  vm.runInContext(source, context, { filename });
}

const { Cards, Decks } = context.window.Eredita;
assert.strictEqual(Cards.normal.length, 34, "les 34 cartes normales décrites doivent être disponibles");
assert.strictEqual(Cards.mythological.length, 5, "les cinq Mythologiques doivent être disponibles");
assert.deepStrictEqual([...new Set(Cards.normal.map((card) => card.category))].sort(), ["Action", "Antique", "Équipement"].sort());

const state = Decks.createState();
assert.strictEqual(state.decks.length, 3);
assert.strictEqual(Decks.deckTotal(state, 0), 0);

for (let count = 0; count < 6; count += 1) Decks.adjustQuantity(state, 0, "habitant", 1);
assert.strictEqual(Decks.quantity("habitant", state, 0), 4, "une carte est limitée à quatre exemplaires");
Decks.adjustQuantity(state, 0, "habitant", -1);
assert.strictEqual(Decks.quantity("habitant", state, 0), 3);
assert.strictEqual(Decks.quantity("habitant", state, 1), 0, "les decks restent indépendants");

for (const card of Cards.normal) {
  for (let copy = 0; copy < 4; copy += 1) Decks.adjustQuantity(state, 0, card.id, 1);
}
assert.strictEqual(Decks.deckTotal(state, 0), 30, "le deck est plafonné à trente cartes");
assert.strictEqual(Decks.adjustQuantity(state, 0, Cards.normal.at(-1).id, 1), false);

for (const card of Cards.mythological.slice(0, 3)) assert.strictEqual(Decks.toggleMythological(state, 1, card.id), true);
assert.strictEqual(state.decks[1].mythological.length, 3);
assert.strictEqual(Decks.toggleMythological(state, 1, Cards.mythological[3].id), false, "une quatrième Mythologique est refusée");
assert.strictEqual(Decks.toggleMythological(state, 1, Cards.mythological[0].id), true, "une Mythologique sélectionnée peut être retirée");
assert.strictEqual(state.decks[1].mythological.length, 2);
assert.strictEqual(state.decks[0].mythological.length, 0, "les sélections mythologiques restent indépendantes");

console.log("Deck builder: règles de quantité et états indépendants validés.");
