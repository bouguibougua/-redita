(function () {
  "use strict";
  const E = window.Eredita;
  // Coordonnées du calque transparent, dans le repère 1672 × 941.
  // Les chemins des animaux séparent leurs silhouettes qui se recouvrent.
  E.ShopArt = [
    {id:'chien', label:'Chien', kind:'special', bounds:[132,255,114,127], labelAt:[190,390], path:'M130 252H248V383H130Z'},
    {id:'sanglier', label:'Sanglier', kind:'special', bounds:[265,228,158,180], labelAt:[344,398], path:'M265 228H423V408H265Z'},
    {id:'vache', label:'Vache', kind:'animal', bounds:[9,415,349,256], labelAt:[220,561], path:'M10 670L13 539Q17 493 79 481L181 482L193 461Q183 442 195 419L213 423L220 442L252 437L277 442L307 435L321 419Q342 424 331 453L351 463L359 480L330 500L322 533L310 558L272 579L268 599L247 602L218 620L180 637L156 619L147 590L125 551L91 538L58 561L33 615L30 670Z', head:'M182 414H359V582H182Z'},
    {id:'ane', label:'Âne', kind:'special', bounds:[270,405,189,389], labelAt:[397,622], path:'M269 615L280 579L313 550L339 503L355 472Q346 425 363 409Q378 405 391 451L400 477L414 460Q429 409 449 410Q462 422 449 470L446 505L449 556L454 581L446 602L427 611L407 602L383 622L364 674L365 781L342 790L327 757L329 713L315 681L296 663L279 641Z', head:'M350 405H459V618H350Z'},
    {id:'chevre', label:'Chèvre', kind:'animal', bounds:[9,523,157,283], labelAt:[86,642], path:'M11 735L12 638L23 592L33 572L34 551L67 526L94 524L128 541L156 553L158 574L150 595L148 621L137 641L136 681L125 714L123 783L108 800L89 798L83 777L79 727L67 768L65 801L43 803L32 780L26 748Z', head:'M20 520H166V640H20Z'},
    {id:'cochon', label:'Cochon', kind:'animal', bounds:[153,595,191,221], labelAt:[249,699], path:'M154 743L159 678Q170 639 199 632L223 627L225 597L247 601L264 626L287 620L311 605L342 611L328 632L321 651L329 676L323 701L302 709L293 745L291 789L280 807L258 812L244 796L229 775L225 806L203 814L187 802L186 779L180 749L172 796L157 798Z', head:'M213 592H347V713H213Z'},
    ...[['bois','Bois',531],['bronze','Bronze',729],['fer','Fer',924]].map(([type,label,x])=>({id:'tools-'+type,type,kind:'tools',label,bounds:[x,227,170,156],labelAt:[x+85,390]})),
    ...[['cuir','Cuir',561],['maille','Mailles',727],['fer','Fer',939]].map(([type,label,x],i)=>({id:'armors-'+type,type,kind:'armors',label,bounds:[x,403,i===1?190:146,187],labelAt:[x+(i===1?95:73),601]})),
    {id:'filet',label:'Filet de pêche',kind:'transport',bounds:[1140,231,344,270],labelAt:[1322,412],path:'M1142 231H1485V506L1320 502L1300 479L1190 470L1142 452Z'},
    {id:'piege-chasse',label:'Piège de chasse',kind:'inactive',bounds:[1150,474,165,111],labelAt:[1233,602]},
    {id:'piege-defense',label:'Piège défensif',kind:'inactive',bounds:[1320,505,136,80],labelAt:[1390,602]},
    {id:'barque',label:'Barque',kind:'transport',bounds:[1350,590,317,211],labelAt:[1505,819]},
    ...[['ble','Blé'],['chataigne','Châtaigne'],['raisin','Raisin'],['viande','Viande'],['poisson','Poisson'],['lait','Lait']].map(([id,label],i)=>({id,label,kind:'resource',bounds:[342+i*171,614,181,279],labelAt:[432+i*171,757]}))
  ];
}());
