# Refonte des modèles de la boutique — plan du 17 novembre 2026

Statut : **800 crédits validés explicitement par le concepteur le 17 novembre 2026**. Les 20 générations sont terminées et intégrées.

L’âne et la barque sont conservés. Le sanglier devient uniquement une tête murale.
Le décor et la pancarte ont été reconstruits localement, sans crédit Tripo.

Modèle : `tripo-p1` → `P1-20260311`, PBR texturé, GLB.
Chaque ligne correspond à **un appel** `text_to_model` (POST `/v3/generation/text-to-model`).
Aucune conversion distante, aucun rig, aucune animation payante, aucune relance automatique.
Les 20 commandes ont été validées avec `--dry-run --json` (sans réseau ni crédits).

| Ordre | Objet | Faces demandées | Coût estimé |
|---:|---|---:|---:|
| 1 | Chien | 5000 | 40 crédits |
| 2 | Tête de sanglier murale | 5000 | 40 crédits |
| 3 | Vache | 5000 | 40 crédits |
| 4 | Chèvre | 5000 | 40 crédits |
| 5 | Cochon | 5000 | 40 crédits |
| 6 | Armes et outils en pierre | 4000 | 40 crédits |
| 7 | Armes et outils en bronze | 4000 | 40 crédits |
| 8 | Armes et outils en fer | 4000 | 40 crédits |
| 9 | Armure de cuir | 5000 | 40 crédits |
| 10 | Cotte de mailles | 5000 | 40 crédits |
| 11 | Armure de fer | 5000 | 40 crédits |
| 12 | Filet de pêche | 5000 | 40 crédits |
| 13 | Piège de chasse | 4000 | 40 crédits |
| 14 | Piège défensif | 4000 | 40 crédits |
| 15 | Panier de blé | 4500 | 40 crédits |
| 16 | Panier de châtaignes | 4500 | 40 crédits |
| 17 | Panier de raisin | 4500 | 40 crédits |
| 18 | Panier de viande | 4500 | 40 crédits |
| 19 | Panier de poisson | 4500 | 40 crédits |
| 20 | Panier de lait | 4500 | 40 crédits |

**Plan avant génération : 800 crédits estimés ; solde initial vérifié : 840 ; reste estimé : 40 crédits.**
Les montants réellement facturés sont consignés dans le tableau final.

Sources/aperçus/reçus : `assets/shop/remake-v2/tripo-out/`.
Modèles web optimisés localement : `assets/models/shop/v2/<id>.glb`.

## Prompts complets

### 1. Chien (`chien`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single adult Corsican shepherd dog, short dark brindle brown fur with warm tan legs and muzzle, alert ears, calm standing pose, four distinct legs and paws, simple worn leather collar. Full body, no leash, no human. Facing forward with head slightly turned.

Destination : `assets/models/shop/v2/chien.glb`.

### 2. Tête de sanglier murale (`sanglier`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. ONLY a mounted wild boar HEAD, frontal wall trophy. Coarse dark brown bristly fur, alert short ears, anatomically convincing dark snout, small curved ivory tusks. Short closed neck attached to a simple small oval dark chestnut wood wall plaque. The head faces straight forward and projects from the plaque. NO BODY, NO LEGS, NO FLOOR STAND. Entire trophy including both ears and tusks visible.

Destination : `assets/models/shop/v2/sanglier.glb`.

### 3. Vache (`vache`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single adult Corsican cow, natural small hardy cattle proportions, warm chestnut brown coat, cream muzzle, small curved horns, subtle udder, four separate hooves, calm standing pose. Full body, no fence, no vegetation. Three quarter pose with head turned toward viewer.

Destination : `assets/models/shop/v2/vache.glb`.

### 4. Chèvre (`chevre`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single adult Corsican goat, warm ivory and light brown coat, fine short fur, realistic backward curved horns, beard, long ears, slender body and four distinct hooves. Calm standing full body pose with head looking forward. No fence, no vegetation.

Destination : `assets/models/shop/v2/chevre.glb`.

### 5. Cochon (`cochon`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single Corsican domestic pig, dusky reddish brown and warm pink bristled skin, small floppy ears, natural snout, curled tail, stocky realistic body, four separate hooves. Calm standing full body pose, head slightly toward viewer. No fence, no vegetation.

Destination : `assets/models/shop/v2/cochon.glb`.

### 6. Armes et outils en pierre (`tools-bois`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A matched pair of primitive stone tools displayed in a compact crossed arrangement: one flint stone axe on a weathered chestnut wood handle and one small harvesting sickle with chipped flint blade and wood grip. Dark grey flint facets, rawhide bindings with visible knots, rough wood grain. Two complete tools, no hands, no rack, no wall.

Destination : `assets/models/shop/v2/tools-bois.glb`.

### 7. Armes et outils en bronze (`tools-bronze`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A matched pair of ancient bronze implements displayed in a compact crossed arrangement: one leaf-shaped short bronze sword pointing upward and one curved bronze harvesting sickle. Aged warm bronze with subtle patina, sharpened edges, leather-wrapped wood handles. Entire blades and grips visible. No hands, no rack, no wall.

Destination : `assets/models/shop/v2/tools-bronze.glb`.

### 8. Armes et outils en fer (`tools-fer`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A matched pair of medieval iron implements displayed in a compact crossed arrangement: one straight short steel sword pointing upward and one curved forged iron harvesting sickle. Forged steel with polished cutting edges, subtle hammer marks, worn dark leather grips, restrained bronze guard fittings. Entire blades and grips visible. No hands, no rack, no wall.

Destination : `assets/models/shop/v2/tools-fer.glb`.

### 9. Armure de cuir (`armors-cuir`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single empty medieval brown leather cuirass, front facing, believable torso shape with shoulder straps, curved chest, cinched waist, layered lower flaps, stitched seams and modest bronze rivets and buckle. Rich worn chestnut leather grain, natural edge wear. Hollow neck and arm openings. NO PERSON, NO MANNEQUIN, NO HELMET, NO WEAPON, NO STAND.

Destination : `assets/models/shop/v2/armors-cuir.glb`.

### 10. Cotte de mailles (`armors-maille`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single empty medieval chainmail shirt front facing, short sleeves, round hollow neck, naturally draped shoulder and torso silhouette, realistic finely interlinked iron rings, slightly darkened steel with brighter worn edges, plain leather belt at waist. Clearly visible knitted ring structure, not fabric. NO PERSON, NO MANNEQUIN, NO HELMET, NO WEAPON, NO STAND.

Destination : `assets/models/shop/v2/armors-maille.glb`.

### 11. Armure de fer (`armors-fer`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single empty medieval forged iron breastplate, front facing, curved anatomical chest and tapered waist, layered steel fauld at bottom, modest shoulder straps, small bronze rivets and dark leather fastenings. Silvery grey hammered iron with realistic soft reflections and worn edges, no fantasy ornament. NO PERSON, NO MANNEQUIN, NO HELMET, NO WEAPON, NO STAND.

Destination : `assets/models/shop/v2/armors-fer.glb`.

### 12. Filet de pêche (`filet`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single traditional handmade hemp fishing net hanging vertically in a roughly rectangular shape, sagging naturally between two upper rope loops. Clearly OPEN diamond mesh holes, individual twisted beige rope strands and knotted intersections. Small aged cork floats across top and a few stone sinkers along bottom. Threaded rope border, weathered natural fibers. No fish, no wall, no frame, no fabric sheet, no opaque backing.

Destination : `assets/models/shop/v2/filet.glb`.

### 13. Piège de chasse (`piege-chasse`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A small rustic medieval wooden live-capture cage trap, rectangular chestnut wood cage with thin round bars, open square entrance, raised sliding wooden door, simple trigger stick and rope mechanism. Aged wood grain and small iron fasteners, clearly hollow interior. Three quarter front view. Empty trap, no animal, no bait, no ground.

Destination : `assets/models/shop/v2/piege-chasse.glb`.

### 14. Piège défensif (`piege-defense`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single medieval forged iron spring jaw trap, OPEN position, two semicircular toothed jaws held apart, circular trigger plate in center, visible leaf spring and short attached chain. Weathered dark iron with brighter worn edges, mechanically believable. Three quarter view from above, no blood, no animal, no ground.

Destination : `assets/models/shop/v2/piege-defense.glb`.

### 15. Panier de blé (`ble`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single low broad oval handwoven wicker market basket filled with golden harvested wheat ears in small upright tied sheaves. Finely defined wheat grains and awns, dry stems, natural jute ties, detailed wicker weave and thick rim. Compact coherent arrangement, no other produce. View slightly from above so contents and front basket are visible.

Destination : `assets/models/shop/v2/ble.glb`.

### 16. Panier de châtaignes (`chataigne`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single low broad oval handwoven wicker market basket full of glossy reddish brown chestnuts, pale rough circular bases, realistic irregular rounded shapes and pointed tips. Two small green split spiny chestnut husks as accents. Detailed wicker weave and thick rim. No other fruit. View slightly from above so contents and front basket are visible.

Destination : `assets/models/shop/v2/chataigne.glb`.

### 17. Panier de raisin (`raisin`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single low broad oval handwoven wicker market basket full of bunches of dark purple and dusky blue grapes, subtle dusty bloom, woody stems and two small muted green vine leaves. Natural grape clusters, detailed wicker weave and thick rim. No other fruit. View slightly from above so contents and front basket are visible.

Destination : `assets/models/shop/v2/raisin.glb`.

### 18. Panier de viande (`viande`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single low broad oval wicker market basket lined with unbleached linen, holding three natural cuts of raw red meat, subtle marbling, pale fat edges and one small pork chop bone. Believable butcher display, fresh muted red and ivory, no blood puddles or gore. Detailed wicker weave, folded linen rim. View slightly from above, no other produce.

Destination : `assets/models/shop/v2/viande.glb`.

### 19. Panier de poisson (`poisson`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single low broad oval wicker fish basket holding four whole fresh Mediterranean silver fish, overlapping naturally. Clearly defined scales, fins, tails, dark eyes, cool grey blue backs and pale bellies. Detailed woven wicker and thick rim, no ice or modern packaging. View slightly from above so contents and front basket are visible.

Destination : `assets/models/shop/v2/poisson.glb`.

### 20. Panier de lait (`lait`)

Refined realistic medieval Corsican market game asset, natural warm earth colors, detailed hand-painted PBR surfaces, believable proportions, clean readable silhouette at small screen size. Isolated single shop article, no background, no floor, no ground plane, no display base, no labels, no text, no watermark. A single low broad oval wicker market basket holding three rustic cream glazed ceramic milk jugs of slightly different sizes, rounded bellies, narrow necks, small spouts, curved handles and simple wooden stoppers. Subtle glaze crackle and worn clay feet, detailed wicker weave. No text or labels, no cartons, no glass bottles. View slightly from above so jugs and basket front are visible.

Destination : `assets/models/shop/v2/lait.glb`.


## Dépenses réelles et résultats

| Ordre | Modèle | Tâche | Étape | Crédits réels | Triangles web |
| ---: | --- | --- | --- | ---: | ---: |
| 1 | Chien | `30942970-cc0a-4533-a05a-a6ee3bb02ab0` | `text_to_model` | 40 | 4,923 |
| 2 | Tête de sanglier murale | `855f2ce5-81a5-4b1a-b87a-8c3bd27089ec` | `text_to_model` | 40 | 4,915 |
| 3 | Vache | `c2c25b03-ea11-477e-b8e8-3d118c91395b` | `text_to_model` | 40 | 4,758 |
| 4 | Chèvre | `fdc38bcc-c01b-4ae2-a986-4d8e4f903b9b` | `text_to_model` | 40 | 4,914 |
| 5 | Cochon | `0103eed3-c33b-479a-b332-0d43e4a92b9c` | `text_to_model` | 40 | 5,116 |
| 6 | Armes et outils en pierre | `743ffea1-1743-4a8c-9fe7-64b8ca63b3ea` | `text_to_model` | 40 | 4,014 |
| 7 | Armes et outils en bronze | `4b6bb8e8-531a-45c9-b91e-a70a71fb7516` | `text_to_model` | 40 | 3,832 |
| 8 | Armes et outils en fer | `4e0a0f23-5138-4d4d-abcc-8fda802a9072` | `text_to_model` | 40 | 3,793 |
| 9 | Armure de cuir | `d836b553-2403-4094-9ba9-1580f3f591a3` | `text_to_model` | 40 | 4,446 |
| 10 | Cotte de mailles | `48d2b262-bcbc-44fe-82d1-2e385036eec8` | `text_to_model` | 40 | 4,722 |
| 11 | Armure de fer | `0838613e-2314-4f57-87b9-65da3d9d67cb` | `text_to_model` | 40 | 4,404 |
| 12 | Filet de pêche | `9220441d-2e4a-4391-93a8-c7ee17517e84` | `text_to_model` | 40 | 7,762 |
| 13 | Piège de chasse | `f3f3f1da-cc98-456f-9f4a-5a343c8f6750` | `text_to_model` | 40 | 3,730 |
| 14 | Piège défensif | `598529f0-9818-4f7b-89f9-5ac9f409cdd5` | `text_to_model` | 40 | 3,910 |
| 15 | Panier de blé | `c0742546-ebcc-48f2-a3c6-7e5d17e0a594` | `text_to_model` | 40 | 5,200 |
| 16 | Panier de châtaignes | `74a17091-308b-4995-97d0-de26083d23a3` | `text_to_model` | 40 | 4,566 |
| 17 | Panier de raisin | `2e3925cc-3664-406b-afc0-0660dfa34547` | `text_to_model` | 40 | 4,592 |
| 18 | Panier de viande | `31261e0c-01c2-4645-a5b5-bf80e43de7aa` | `text_to_model` | 40 | 4,462 |
| 19 | Panier de poisson | `99d6aa30-de02-46b8-b328-adcead25b44c` | `text_to_model` | 40 | 4,584 |
| 20 | Panier de lait | `2a9da0b8-208a-4c81-84e0-3e5649653462` | `text_to_model` | 40 | 4,364 |

**Total réel : 800 crédits ; solde vérifié : 40 crédits.**
