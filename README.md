# BiblioTroc

## Description

BiblioTroc est un assistant intelligent de bibliothèque communautaire pour faciliter l’échange et la vente de livres scolaires entre utilisateurs.
(Description provenant de `metadata.json`)

## Déploiement sur GitHub Pages

Ce projet est configuré pour un déploiement simple sur GitHub Pages.

1.  **Poussez le code vers un dépôt GitHub.**
    Assurez-vous que tous les fichiers, y compris `index.html` à la racine, sont poussés vers votre dépôt.

2.  **Activez GitHub Pages dans les paramètres de votre dépôt.**
    *   Allez dans `Settings` > `Pages`.
    *   Sous "Build and deployment", sélectionnez la branche que vous souhaitez déployer (généralement `main`).
    *   Sélectionnez le dossier `/ (root)` comme source de publication.
    *   Sauvegardez les modifications.

3.  **Accédez à votre site.**
    Après quelques instants, votre application devrait être accessible à l'adresse `https://VOTRE_NOM_UTILISATEUR.github.io/NOM_DE_VOTRE_DEPOT/`.
    L'application utilise `HashRouter`, donc les URLs incluront un `#`.

## Structure du Projet

*   `index.html`: Point d'entrée principal de l'application.
*   `index.tsx`: Fichier racine de l'application React.
*   `components/`: Contient les composants React réutilisables.
*   `pages/`: Contient les composants React représentant les différentes pages/vues de l'application.
*   `context/`: Contient les contextes React pour la gestion de l'état global.
*   `hooks/`: Contient les hooks React personnalisés.
*   `types.ts`: Définit les types TypeScript utilisés dans l'application.
*   `constants.ts`: Définit les constantes globales de l'application.
*   `metadata.json`: Contient les métadonnées de l'application.

## Technologies Utilisées

*   React
*   TypeScript
*   Tailwind CSS (via CDN)
*   Heroicons
*   Bibliothèques JavaScript via esm.sh (pour un fonctionnement sans étape de build)
