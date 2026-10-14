# Drapeau du menu et panorama de Bonifacio — provenance

Retouche demandée par le concepteur le 14 octobre 2026, réalisée avec l’outil
intégré **imagegen**, sans CLI ni ajout de dépendance.

Source de référence : `Panorama des ruines au coucher du soleil.png`, fourni
par le concepteur et conservé dans ses Downloads.
Le fond de l’accueil est retouché dans `assets/menu-360.png`, **1774 × 887** :
tête noire de profil vers la gauche et bandeau blanc couvrant les yeux, selon
le gros plan du drapeau fourni par le concepteur. La composition reste conservée.
Le décor distinct `assets/panorama-360.png`, **1774 × 887**, PNG opaque, représente
une interprétation artistique de Bonifacio depuis une terrasse sur les remparts :
falaises calcaires et mer à gauche, citadelle et fortifications à droite.
Le prompt demandait 3072 × 1536 ; l’outil a livré 1774 × 887. Aucun agrandissement
artificiel n’est présenté comme un gain de détail.
Texture de sol complémentaire : `assets/vr-stone-floor.png`, **1254 × 1254**,
générée avec le même outil, utilisée sur un disque 3D de 3 m de rayon à bord
progressivement transparent. Le panorama reste visible à l’horizon.
Le GIF a été réexporté depuis le rendu du menu dans `assets/menu-animated.gif`.
Le pupitre/autel demandé par le concepteur est une géométrie 3D dans
`js/xr-environment.js` : il reste aligné avec le plateau. La terrasse de l’image
laisse son emplacement libre, pour afficher un seul support dans la scène.

Références géographiques : Office de Tourisme de Bonifacio,
[falaises calcaires](https://bonifacio.fr/decouvrir/bonifacio-grandeur-nature/les-sites-du-conservatoire-du-littoral/falaises-de-calcaire/)
et [Bastion de l’Étendard](https://bonifacio.fr/decouvrir/bonifacio-ville-dart-et-dhistoire/le-bastion-de-letendard/).
Ces descriptions guident le paysage ; l’image n’est pas un relevé photographique
ou une restitution architecturale exacte du site.

Le ratio 2:1 et l’orientation ont été vérifiés. Une illustration générée ne
garantit pas une projection sphérique exacte ou un raccord parfait : inspecter
couture et pôles dans le casque. Le sol 3D complète le nadir, indépendant du
plateau. Il ne change aucune règle du jeu.

Contrôles effectués dans Chrome : accueil et logo, vue frontale avec pupitre,
vues gauche/droite/arrière et sol sous les pieds. Le pupitre d’aperçu est placé
à 1,85 m ; le disque de sol reste opaque jusqu’à 2,4 m puis se fond jusqu’à 3 m.
Les tests du menu sous `/-redita/`, du module d’environnement et de WebXR simulé
passent. Le GIF réexporté contient 72 images sur 6 secondes à 960 × 480.
Le confort, les performances et le raccord perçu avec les deux yeux restent
à contrôler sur un Quest 3 physique.

## Prompt final — drapeau du menu

Use case: precise-object-edit. Asset type: existing Eredità cinematic main-menu background, opaque PNG, exact 2:1 aspect ratio. Input images: the full wide panorama most recently shown is the EDIT TARGET; the user's close-up flag photograph is ONLY the reference for the emblem. Edit ONLY the emblem painted on the flag at the far left of the full panorama. Replace the current emblem with the user's reference: a solid BLACK Moor's head in clean side profile FACING LEFT, a wide off-white cloth BLINDFOLD crossing directly OVER BOTH EYES, tied behind the head with long off-white ribbon tails. The band covers the eyes at eye level, NOT on the forehead. Black curly hair and a clearly defined nose and chin silhouette, elegant historic Corsican flag motif. Keep the flag's exact position, scale, pole, frayed silhouette, existing cloth folds and warm ochre weathered fabric; realistically paint the emblem onto that cloth, following folds and sunset illumination. Preserve EVERYTHING ELSE in the full wide image exactly: sunset, coastline, sea, buildings, rocky foreground, sky and dark clouds, foliage, embers and the lit brazier at the far right. Do not zoom in, do not change the panoramic framing or scenery, do not add a logo or interface. Preserve full original 2:1 panorama proportions. No text, watermark or new objects.

## Prompt final — panorama de Bonifacio

Use case: stylized-concept. Asset type: opaque high-detail game environment PNG, one continuous 360° by 180° EQUIRECTANGULAR spherical panorama, 3072 by 1536 pixels, EXACTLY 2:1. Primary request: a believable cinematic medieval interpretation of BONIFACIO, southern Corsica, seen from a broad stone terrace on the citadel ramparts at sunset. Geography is essential: recognisable pale white horizontally layered limestone cliffs with dramatic sea-cut overhangs and turquoise Mediterranean water to the LEFT of the initial front view; low clustered pale stone houses on the cliff rim; Bonifacio's Genoese citadel and thick weathered limestone defensive walls, squat bastion, arched gateways and a small bell tower on the RIGHT. Landscape is Bonifacio's exposed limestone peninsula, NOT a mountainous Alpine bay, NOT a generic fantasy castle with tall spires. Camera at standing eye height 1.65 metres on a broad continuous paved rampart platform, with a low stone parapet several metres away. There is enough clear stone paving directly ahead to place the game's separate 3D stone lectern and game board; leave that foreground platform empty because the lectern will be a real 3D object rendered by the game. Dark amber sunset light, blue-green sea, cream limestone, bronze/gold highlights, dark storm clouds with luminous edges, readable rich detail and restrained coastal haze; elegant Eredità atmosphere. TECHNICAL PROJECTION: this is a latitude-longitude texture viewed from INSIDE a sphere, NOT a conventional perspective wide-angle photograph. Horizon horizontal at EXACT vertical midpoint. Front direction is horizontal centre x=50%; left-front cliffs around x=37%; right-front citadel around x=63%. Extreme left and right edges both depict the SAME rear view of the rampart walkway and must JOIN seamlessly with identical lighting, geometry and horizon heights. The entire lower hemisphere below mid-height is the terrace/parapet foreground with progressively equirectangular distortion; the bottom pole is uninterrupted detailed limestone flagstone paving directly beneath the viewer, no black border, no cliff or sea underfoot. Top pole is uninterrupted cloud sky with proper zenith distortion. Broad platform surrounds the camera in EVERY direction, stable level viewpoint, no fisheye circle, no tunnel, no collage, no duplicated horizon. Keep sea and walls far enough away for comfortable VR. No people, no text, no logo, no UI, no tabletop or furniture baked into the picture, no modern cars or yachts. Output one polished seamless 2:1 panoramic texture, no frame.

## Ancien prompt — terrasse générique (remplacée par Bonifacio)

Use case: precise-object-edit. Asset type: full-sphere 360 degree equirectangular environment texture for Eredità, a Corsican medieval strategy game viewed inside a VR headset. Edit target: the provided panoramic image. Preserve its cinematic dark sunset, golden light on Mediterranean sea, rugged Corsican coast, Genoese stone towers, ruins, the Corsican black flag on the left and brazier on the right. Improve visual beauty, stone detail, natural light and atmospheric depth. Crucial technical composition: output a genuinely 2:1 equirectangular map covering 360 degrees horizontally and 180 degrees vertically, NOT a normal wide-angle picture. Horizon at exactly mid height; continuous matching left and right edges, camera eye height 1.65m from the center of a safe broad circular medieval stone terrace. The entire lower third to bottom pole must show convincing continuous ochre/charcoal stone paving directly beneath the viewer's feet, with equirectangular nadir distortion appropriate to a sphere; no sea, cliff, bottom black band or blurred rock smear beneath the viewer. The terrace surrounds the camera in all directions, foreground flag pole and brazier standing on this same terrace, sea and mountainous village beyond its low stone perimeter. At top pole continuous cloud sky with no hard seams. Keep the central front view open, broad sunset bay and dark clouds for the golden logo. Match the left and right borders seamlessly in paving, walls, terrain, sky and lighting. Higher clarity, rich bronze/gold highlights and readable ground, dramatic but not crushed black. No text, no logo, no UI, no people, no weapons, no extra flags. Output one polished panoramic environment, exact aspect ratio 2:1.

## Prompt final de la texture de sol

Use case: photorealistic-natural. Asset type: one seamless square PBR-style albedo texture for a medieval Corsican stone terrace under a VR player's feet. Generate a single square, strictly top-down orthographic photograph of weathered irregular sandstone and limestone flagstone paving, warm charcoal, earthy brown, ochre bronze and pale gold, matching a cinematic Mediterranean medieval ruin at golden sunset. Large irregular polygonal stone slabs of varied shape fitted with narrow dark grout gaps, beautifully detailed rough granular stone with natural faint cracks and worn edges. Completely flat overhead texture, no perspective or vanishing point. Soft evenly diffuse illumination, no directional cast shadows, no baked highlights, no specular spots, no vignette. Perfectly seamless and tileable left/right and top/bottom, pattern continues identically across all four borders. Fill the entire square with paving. No scenery, no wall, no grass, no people, no feet, no text, no symbols, no furniture, no borders. Premium realistic game environment material, subtle mottled warm stone, natural crisp surface detail.

## Nouveau logo fourni

Source : nouveau logo EREDITÀ joint par le concepteur, **2172 × 724**.
Fichier retenu : `assets/eredita-logo.png`, **2172 × 724**, avec transparence.
L’outil intégré imagegen a extrait le fond noir puis affiné le détourage.
Le contrôle final porte sur le rendu dans Chrome, qui respecte l’alpha du PNG.
Le menu VR utilise le ratio réel de la texture pour préserver les proportions.

Prompt final de détourage :

Use case: background-extraction. Repair the transparency extraction of this exact gold EREDITÀ logo. There are obvious unwanted pure red, fluorescent yellow and white noisy halos and stray pixels just outside the gold letter contours. Remove every one of these cutout artifacts. Preserve the exact golden metal lettering, letter shapes and all intentional gold highlights. The edges must be clean, smooth, antialiased gold transitioning directly into fully transparent background, with NO red outline, NO bright yellow outline, NO white fringing and NO stray speckles. Remove ONLY background/extraction artifacts, not the normal highlights inside the gold lettering. Preserve the entire golden logo and accent À. Trim excessive transparent top/bottom padding so the full wordmark fills its canvas with a modest 16px margin. Keep width at least 2048px and preserve natural letter proportions, not a redesign. Output a clean high resolution transparent PNG that looks correct over a dark cinematic photograph. No new glow, no extra shadow, no text modifications.
