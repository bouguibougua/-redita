(function () {
  'use strict';
  const E = window.Eredita;
  const variants = {
    red: E.TerrainModel.create('littoral_rouge'),
    blue: E.TerrainModel.create('littoral_bleu')
  };
  E.CoastTerrain = {
    async init(three) { return (await Promise.all(Object.values(variants).map(model => model.init(three)))).some(Boolean); },
    create(width, burned, owner) {
      const group = variants[owner]?.create(width, burned);
      if (group) { group.name = 'terrain-littoral'; group.userData.owner = owner; }
      return group;
    },
    get ready() { return Object.values(variants).every(model => model.ready); },
    get diagnostics() { return { red: variants.red.diagnostics, blue: variants.blue.diagnostics }; }
  };
}());
