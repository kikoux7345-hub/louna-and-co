# Louna & Co

**Ta journée, simplement.**

Application React et TypeScript, construite avec Vite : planning par date, noms des clients, pointages et corrections, itinéraires MOTIS, prévisualisation de la journée et export/restauration des données. Interface adaptée au téléphone, dans des tons rose clair.

## Démarrer

Installer Node.js avec npm, puis dans le dossier du projet :

```sh
npm ci
npm run dev
```

Dans PowerShell, utiliser `npm.cmd` si l’exécution des scripts npm est bloquée. Pour tester depuis un téléphone sur le même réseau : `npm.cmd run dev -- --host`.

```sh
npm run build
npm run lint
npm run preview
```

La compilation produit le dossier `dist/`. Le serveur de développement ne doit pas servir d’hébergement public.

## Données personnelles

Les lieux prédéfinis sont des lieux publics de Tours utilisés pour des interventions fictives. L’adresse de départ de démonstration est celle du château de Tours, et non un domicile privé. Renseigner ses propres informations dans « Modifier le planning ».

Les noms, adresses, horaires et pointages saisis sont conservés dans le stockage local du navigateur. Ils ne doivent pas être ajoutés au dépôt de code. Le stockage n’est pas partagé entre appareils ni entre adresses de sites. Exporter une sauvegarde avant de changer d’adresse ou de navigateur, puis la restaurer sur la destination.

Les fichiers JSON exportés contiennent les données personnelles. Les garder hors du dépôt, même privé. Les règles `.gitignore` sont une protection supplémentaire ; elles ne rendent pas secret un fichier déjà publié.

## Itinéraires et services externes

Le moteur MOTIS est interrogé via le service public [Transitous](https://transitous.org/api/). Les recherches sont déclenchées par l’utilisateur, sans interrogation automatique en arrière-plan. Le service est fourni sans garantie et soumis à ses propres conditions, notamment projet ouvert, usage non commercial et consommation limitée. La licence du code de cette application ne donne aucun droit supplémentaire sur ce service. Si un usage est incertain, consulter son équipe avant cet usage.

Contact public de cette application : kikoux7345@gmail.com. Les crédits sont accessibles dans l’application.

- [Sources des données de transport](https://transitous.org/sources/).
- Données cartographiques © [contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright).
- Les liens de marche ouvrent Google Maps ; le parcours peut différer de celui calculé par MOTIS.

Les trajets sont des prévisions à vérifier avant le départ. Certains réseaux ne fournissent pas de temps réel. Le géocodage est actuellement limité à Tours et à ses environs proches.

## Publication

Publier uniquement ce dossier source nettoyé. Ne pas y ajouter de sauvegardes, de captures contenant des informations privées, de fichiers `.env`, ni l’historique Git d’une version qui contenait des données personnelles.

Cette application n’inclut ni connexion utilisateur, ni synchronisation entre appareils, ni fonctionnement hors ligne garanti. Une publication privée nécessite une protection d’accès configurée chez l’hébergeur.

## Licence

Code de Louna & Co sous [licence MIT](LICENSE). Les dépendances et données externes conservent leurs propres licences et conditions. Le texte de la licence est également fourni dans `public/LICENSE.txt` pour l’hébergement.
