# Nourane Génie Civil — gestion des coûts de construction

Application web de collecte, de stockage et d'analyse des données financières des chantiers de
maisons et de bâtiments. Projet de l'unité d'enseignement Statistique (3ᵉ année, génie civil).

## Acteurs

| Rôle | Ce qu'il fait |
|---|---|
| **Ingénieure** (propriétaire) | Crée les projets, les comptes et le budget ventilé ; valide les dépenses, l'avancement et les versements ; révise le budget par avenants ; voit toutes les analyses, la comparaison des projets et le journal |
| **Chef de chantier** | Saisit les dépenses (avec photo du reçu) et l'avancement des lots depuis son téléphone ; ses saisies attendent la validation |
| **Client** | Suit l'avancement de son projet, le budget et les dépenses validées ; déclare ses versements ; télécharge le rapport |

Tout est tracé : chaque création, modification (avec l'avant et l'après), validation, rejet,
annulation, avenant, export et connexion est inscrit au journal, qui ne se modifie pas.
Rien ne se supprime : une dépense fausse est rejetée ou annulée, avec son motif.

## Documentation

Dans `docs/`, en HTML et en PDF :

| Document | Pour qui |
|---|---|
| `manuel.pdf`, `guide.pdf` | Nourane : les trois manuels et les trois guides réunis |
| `manuel-ingenieure.pdf`, `guide-ingenieure.pdf` | L'ingénieure |
| `manuel-chef-de-chantier.pdf`, `guide-chef-de-chantier.pdf` | Les chefs de chantier |
| `manuel-client.pdf`, `guide-client.pdf` | Les clients |

Le manuel décrit chaque écran avec ses captures ; le guide de première utilisation donne les
étapes dans l'ordre, avec le schéma de ce qui dépend de quoi.

## Fonctionnalités

| Cahier des charges | Où |
|---|---|
| Gestion des projets, budget prévisionnel | Projets → Nouveau projet, onglet **Budget** (grille lot × catégorie, avenants) |
| Collecte des dépenses (matériaux, main-d'œuvre, transport, location, autres) | Onglet **Dépenses**, bouton rose « Dépense » sur téléphone |
| Calcul automatique des coûts | Montant = quantité × prix unitaire, calculé par le serveur ; totaux par poste |
| Suivi budgétaire | Tableau de bord : budget révisé, dépensé, reste, dépassements, alertes |
| Analyse par catégorie, par période, par projet | Onglet **Analyse**, page **Comparaison** |
| Visualisation graphique | Courbe en S, anneau, barres prévu / réel, mois, Pareto, boîte à moustaches, histogramme |
| Stockage dans le Cloud | PostgreSQL sur Neon, photos sur Backblaze B2, application sur Vercel |
| Plusieurs projets | Liste des projets, comparaison du coût au m² |
| Rapports PDF et Excel | Boutons « Rapport PDF » et « Excel » de chaque projet, Excel de la comparaison |
| Sécurisation | Connexion par téléphone et mot de passe, droits vérifiés par le serveur à chaque requête |

## Où se trouvent les calculs

| Fichier | Contenu |
|---|---|
| `lib/stats.ts` | Statistique pure : moyenne, médiane, variance, quartiles, CV, boîte à moustaches, histogramme (Sturges), régression, Pareto, intervalle de confiance |
| `lib/analyse.ts` | Indicateurs du projet : budget révisé, écarts, valeur acquise (EV, CPI, EAC), prévision par régression avec intervalle de prévision, prix unitaires et scores z, coût au m², alertes |
| `lib/*.test.ts` | Tests, dont un petit projet calculé à la main (`npm test`) |

## Lancer en local

Prérequis : Node.js 20 ou plus, une base PostgreSQL (locale ou Neon).

```bash
npm install
cp .env.example .env        # renseigner DATABASE_URL, DIRECT_URL, SESSION_SECRET (et B2_* si photos)
npx prisma migrate deploy   # crée les tables
npm run db:seed             # charge 4 chantiers de démonstration
npm run dev                 # http://localhost:3000
npm test                    # tests des calculs
```

Comptes de démonstration, mot de passe `Nourane2026` :

| Téléphone | Rôle |
|---|---|
| 690000001 | Ingénieure |
| 690000010 | Chef de chantier (Mfou, villa d'Odza) |
| 690000011 | Chef de chantier (immeuble de Bonamoussadi, boutique) |
| 690000002 | Client de la villa d'Odza |
| 690000003 | Cliente de la maison de Mfou et de la boutique |
| 690000004 | Client de l'immeuble de Bonamoussadi |

`npm run db:seed` refuse de tourner sur une base qui contient déjà des projets.
Pour tout effacer et recharger : `npm run db:seed -- --reinitialiser`.

## Déploiement : Neon, Backblaze B2, Vercel

1. **Neon** : copier la chaîne « pooled » (hôte `-pooler`) dans `DATABASE_URL` en ajoutant
   `&pgbouncer=true`, et la chaîne directe dans `DIRECT_URL`.
2. **Backblaze B2** (facultatif) : compartiment privé et clé limitée à ce compartiment ;
   renseigner `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET` et `B2_ENDPOINT`
   (`https://s3.<region>.backblazeb2.com`). Sans ces variables, l'application fonctionne sans photos.
   Contrôle : `npx tsx --env-file=.env scripts/tester-stockage.ts` (dépose, relit puis supprime une image).
3. **Vercel** : importer le dépôt GitHub, renseigner les variables d'environnement ci-dessus et
   `SESSION_SECRET` (32 caractères aléatoires au moins), puis déployer. La commande de build
   applique les migrations avant de compiler.

## Architecture

- **Next.js 16** (App Router) : pages rendues côté serveur, actions serveur pour les écritures.
  Chaque page et chaque action vérifie le rôle et le projet concerné.
- **Prisma 6 et PostgreSQL** : 11 tables ; montants en FCFA entiers.
- **Navigation fluide** : squelettes à la forme du contenu, copie locale d'abord (une page déjà
  vue se rouvre aussitôt puis se met à jour), préchargement des écrans du menu.
- **Interface** : blanc et rose du logo, mode sombre, utilisable au téléphone et installable
  comme une application.
- **Session** : cookie signé HMAC-SHA256, mots de passe hachés par scrypt.
