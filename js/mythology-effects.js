(function () {
  'use strict';
  const E = window.Eredita;
  // Registre de compatibilité en lecture seule. Il n’exécute aucun pouvoir.
  // La seule voie de jeu reste CardGame.play -> CardEffects.apply, avec ses contrôles.
  const bindings = Object.freeze(Object.fromEntries(E.Mythology.all
    .filter(legend => legend.implementation.status === 'existing')
    .map(legend => [legend.implementation.effectKey, Object.freeze({
      effectKey: legend.implementation.effectKey, cardId: legend.implementation.cardId,
      entryPoint: 'CardGame.play', implementation: 'CardEffects.apply'
    })])));
  function getBinding(id) {
    const legend = E.Mythology.get(id);
    return legend ? bindings[legend.implementation.effectKey] || null : null;
  }
  E.MythologyEffects = Object.freeze({ bindings, getBinding });
}());
