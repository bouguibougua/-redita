# Matières de l’échoppe

Ces neuf textures 512 × 512 sont des copies des matières déjà présentes dans
le projet, produites par `eredita3D/scripts/create_paysan.py` pour le paysan.
Aucun téléchargement externe ni génération Tripo n’est nécessaire.

| Famille boutique | Sources dans `eredita3D/textures/paysan/` |
| --- | --- |
| `leather-*` | `Cuir_gilet_couleur.png`, `cuir_normal.png`, `cuir_rugosite.png` |
| `linen-*` | `Lin_ecru_couleur.png`, `tissu_normal.png`, `tissu_rugosite.png` |
| `wicker-*` | `Osier_couleur.png`, `tresse_normal.png`, `tresse_rugosite.png` |

`js/shop-materials.js` les charge en trois couches : albedo sRGB, normales et
rugosité en données linéaires. Les matériaux et leurs textures sont partagés.
Les textures retournées par le chargeur gardent leur identité pendant le
chargement, y compris lorsque le rendu clone un matériau pour le survol.

Le bois de châtaignier patiné, la maçonnerie, le métal forgé et la terre cuite
sont créés localement par ce même module : couleur, normales et rugosité en
1024 × 1024, motifs périodiques déterministes. Le bois combine fibres,
cernes, nœuds et variations d’usure ; la pierre combine grains minéraux et
pores ; le métal combine martelage, rayures et oxydation légère. Aucun reflet
directionnel ni ombre ne sont peints dans ces textures.

Le grain du bois suit U. Les géométries doivent conserver des UV à échelle
cohérente, orientées selon la longueur des poutres ; les variantes de bois
partagent leurs maps. Les réglages de présentation sont dans les constantes
du module, surchargeables via `Config.shopScene.materials`.
