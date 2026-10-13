(function () {
  "use strict";
  const E = window.Eredita;
  // The supplied sheet includes printed rules; this overlay displays the validated game text.
  function html(card) {
    if (!card.fullCard) return `<img src="${card.image}" alt="" loading="lazy">`;
    return `<span class="fantasy-card" style="--card-description-top:${card.descriptionTop || 72}%;--card-description-height:${card.descriptionHeight || 18}%">
      <img src="${card.image}" alt="" loading="lazy">
      ${card.generatedTitle ? `<span class="fantasy-card-name">${card.name}</span>` : ""}
      <span class="fantasy-card-description">${card.shortEffect}</span>
    </span>`;
  }
  E.CardArt = { html };
}());
