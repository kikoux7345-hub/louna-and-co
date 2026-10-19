# Données et confidentialité

- Les plannings, noms de clients, domiciles et pointages sont conservés dans `localStorage`, sur l’appareil. Il n’y a pas de serveur de sauvegarde ni de synchronisation dans cette version.
- Lors d’une recherche, les adresses sont envoyées à Transitous pour le géocodage, puis les coordonnées, la date et l’heure sont envoyées pour le calcul d’itinéraire. Les noms de clients et la liste des pointages ne sont pas envoyés dans ces requêtes. Une heure de fin réelle peut déterminer l’heure de départ demandée.
- Lorsqu’un lien « Voir le chemin à pied » est utilisé, les coordonnées de départ et d’arrivée de cette portion sont transmises à Google Maps.
- Le contact public figurant dans le code est destiné au suivi du service Transitous. Il ne s’agit pas d’une donnée client.
- Le fichier exporté contient les données du calendrier en clair. Le conserver dans un emplacement personnel protégé.
- La restauration remplace les données de l’appareil après validation explicite et conserve une copie locale avant la dernière restauration. Elle n’est pas une synchronisation.
- Supprimer les données du navigateur supprime aussi les plannings et copies de secours locales. Un autre utilisateur de la même session de navigateur peut accéder aux données.
- Le code public contient seulement des adresses publiques de démonstration. Ne pas remplacer ces valeurs par un domicile ou des informations clients avant de publier le code.

Ce document décrit cette version de l’application. Les services externes et un futur hébergeur ont leurs propres pratiques et conditions.
