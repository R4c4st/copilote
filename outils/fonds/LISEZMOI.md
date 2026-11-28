# Générateur des fonds d'écran et des icônes de Nestor

Rendu sur canvas dans Chrome sans écran (Playwright). Les scripts attendent ces fichiers dans `/home/claude/wall`.

- `gen.html` : outils de dessin et fonds (coordonnées logiques 1080×2340).
- `scene.js` : scènes du fond vivant (décor + `scene.json`) et rendu de référence que suit `NestorFond.java`.
- `scene_export.py` : produit `fonds/v2/*.jpg|json` ; `plus_video.py` : aperçu vidéo d'une scène.
- `icon.js` + `*_render.py` : pistes d'icône ; l'icône en place est `c-bord-samsung` (bordure d'or, forme Samsung k≈2,65).
