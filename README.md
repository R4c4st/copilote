# Jarvis (nom provisoire)

Assistant personnel, pro et perso. Il part d'une copie du code de Tempo et s'installe **à côté** de Tempo, sans rien partager avec lui.

| | Tempo | Jarvis |
|---|---|---|
| Appli Android | `fr.rc4st.tempo` | `fr.rc4st.copilote` |
| Liens internes | `tempo://` | `copilote://` |
| Site (mises à jour) | r4c4st.github.io/zap | r4c4st.github.io/copilote |
| Serveur Supabase | projet partagé avec Fly18 | projet **Copilote**, à lui seul |
| Clé de signature | secret `TEMPO_KEY` | secret `COPILOTE_KEY` |

L'identifiant Android est neutre exprès : le nom affiché pourra changer quand le vrai nom sera trouvé, sans réinstaller.

## Ce qui s'ajoute à Tempo

**Mémoire chiffrée.** Une phrase secrète, qui ne quitte jamais le téléphone, donne deux choses :
la clé de chiffrement (gardée dans le téléphone, non exportable) et un jeton d'accès au serveur.
Le serveur (`supabase/functions/copilote-memoire`) ne voit que du chiffré (AES-GCM 256, clé tirée par PBKDF2-SHA-256, 600 000 tours).
La recherche dans la mémoire se fait dans le téléphone ; seuls les souvenirs utiles à une question partent chez Claude.

**Conversation.** Claude Sonnet, appelé directement depuis le téléphone avec ta propre clé.
Il propose de retenir ou d'oublier ; rien n'est gardé ni effacé sans ton OK.
Compteur de dépense et plafond mensuel dans l'appli, en plus du plafond de la console Claude.

## Mise en route du dépôt

1. Secret GitHub `COPILOTE_KEY` (Settings → Secrets and variables → Actions) : un mot de passe long, à toi.
   Au premier passage, GitHub fabrique la clé de signature de l'appli et la range ici, chiffrée avec ce secret.
2. GitHub Pages (Settings → Pages) : branche `main`, dossier `/ (root)`. C'est par là que l'appli se met à jour.
3. L'APK se télécharge ensuite ici : `https://github.com/R4c4st/copilote/releases/download/app/copilote.apk`

Aucune clé et aucune donnée personnelle dans ce dépôt : les clés restent dans le téléphone ou dans les secrets du serveur.

## Horaires de bus

Chaque lundi, GitHub récupère les horaires publics du réseau Stan et les range dans `donnees/stan.json`.
Jarvis cherche les trajets directement dans le téléphone, directs ou avec une correspondance : l'arrêt que tu demandes ne part nulle part.
Source : Réseau Stan / Métropole du Grand Nancy, données ouvertes sous Licence Ouverte (transport.data.gouv.fr).
Les services de nuit à la demande ne figurent pas dans ces données.
