# Tests de non-régression de Nestor

Scripts Playwright (Chrome sans écran) qui chargent `index.html` avec un faux pont natif (`TN`) et des réponses d'IA simulées.
Aucune clé, aucune donnée personnelle : les noms sont fictifs.

- Le dépôt doit être cloné dans `/home/claude/copilote` (chemin écrit dans les scripts).
- Créer `/tmp/nt` (captures d'écran) puis lancer un script : `cd outils/tests && python3 test.py`.
- Chaque script affiche un JSON ; le champ `errors` (erreurs JavaScript de la page) doit être vide.
- `test17.py` couvre le fond d'écran animé (lots 29 à 33).
