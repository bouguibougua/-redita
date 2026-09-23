(function () {
  "use strict";

  const E = window.Eredita;
  const labels = { montagne: "Montagne", plaine: "Plaine", littoral: "Littoral" };

  function shuffle(values) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function randomBiome(excludedBiome) {
    const choices = E.Config.biomes.filter((biome) => biome !== excludedBiome);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function createInitialDraw() {
    const fourth = E.Config.biomes[Math.floor(Math.random() * E.Config.biomes.length)];
    return shuffle([...E.Config.biomes, fourth]);
  }

  function createSlots(biome) {
    if (biome === "littoral") {
      return [{ type: "free", content: null }, { type: "free", content: null }];
    }
    if (biome === "montagne") {
      return [
        { type: "free", content: null },
        { type: "free", content: null },
        { type: "animal", content: null },
        { type: "animal", content: null }
      ];
    }
    return Array.from({ length: 4 }, () => ({ type: "free", content: null }));
  }

  E.Biomes = { labels, createInitialDraw, randomBiome, createSlots };
}());
