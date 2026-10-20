# Sons d’interface

Fichiers fournis par le concepteur et intégrés le 15 octobre 2026 :

| Source locale | Fichier publié | Utilisation |
| --- | --- | --- |
| `Downloads/Epee.wav` | `sword.wav` | Boutons du menu principal, de l’armurerie et du multijoueur |
| Même enregistrement inversé, démarrant à 0,20 s | `sword-reverse.wav` | Tous les boutons Retour |
| `Downloads/Page qui tourne.wav` | `page-turn.wav` | Consultation d’une légende |
| Même enregistrement inversé | `page-turn-reverse.wav` | Variante de page inversée conservée dans la bibliothèque sonore |

Les deux fichiers sources ont été copiés sans altération. Ils sont mono,
PCM 16 bits, 44 100 Hz : environ 0,967 seconde pour l’épée et 0,575 seconde
pour la page. Les originaux restent dans Downloads.

Les deux sons inversés conservent les paramètres audio et inversent l’ordre des trames
PCM complètes, sans inverser les octets d’un échantillon. À la demande du concepteur,
les 0,20 premières secondes de l’épée inversée ont ensuite été retirées : sa durée
publiée est d’environ 0,767 seconde, sans réencodage ni changement de volume.
Aucun son n’est généré
ou téléchargé depuis un service externe. Les quatre WAV sont servis avec le type
`audio/wav` et lus depuis les chemins relatifs de `Config.audio.effects`.
