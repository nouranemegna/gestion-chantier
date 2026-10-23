import type { Categorie, ModePaiement, Role, Statut, StatutProjet, TypeOuvrage } from "@prisma/client";

export const ROLES: Record<Role, string> = {
  INGENIEUR: "Ingénieure",
  CLIENT: "Client",
  CHEF_CHANTIER: "Chef de chantier",
};

export const CATEGORIES: Record<Categorie, string> = {
  MATERIAUX: "Matériaux",
  MAIN_OEUVRE: "Main-d'œuvre",
  TRANSPORT: "Transport",
  LOCATION_EQUIPEMENT: "Location d'équipements",
  AUTRES: "Autres frais",
};
export const LISTE_CATEGORIES = Object.keys(CATEGORIES) as Categorie[];

// Couleur fixe par catégorie, partout dans l'application (graphiques, pastilles) :
// la couleur suit le poste, jamais son rang. Ordre validé pour le daltonisme.
export const COULEUR_CATEGORIE: Record<Categorie, string> = {
  MATERIAUX: "#db2777",
  MAIN_OEUVRE: "#2a78d6",
  TRANSPORT: "#1baf7a",
  LOCATION_EQUIPEMENT: "#eda100",
  AUTRES: "#6250d6",
};

export const TYPES_OUVRAGE: Record<TypeOuvrage, string> = {
  MAISON_INDIVIDUELLE: "Maison individuelle",
  IMMEUBLE: "Immeuble",
  BATIMENT_COMMERCIAL: "Bâtiment commercial",
  BATIMENT_PUBLIC: "Bâtiment public",
  AUTRE: "Autre ouvrage",
};

export const STATUTS_PROJET: Record<StatutProjet, string> = {
  PREPARATION: "En préparation",
  EN_COURS: "En cours",
  SUSPENDU: "Suspendu",
  TERMINE: "Terminé",
};

export const STATUTS: Record<Statut, string> = {
  EN_ATTENTE: "En attente",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
  ANNULEE: "Annulée",
};

export const MODES_PAIEMENT: Record<ModePaiement, string> = {
  ESPECES: "Espèces",
  VIREMENT: "Virement",
  MOBILE_MONEY: "Mobile Money",
  CHEQUE: "Chèque",
};

/** Lots proposés à la création d'un projet de bâtiment ; l'ingénieure les ajuste. */
export const LOTS_PAR_DEFAUT = [
  "Installation de chantier",
  "Terrassement",
  "Fondations",
  "Élévation des murs",
  "Dalle et planchers",
  "Charpente et toiture",
  "Menuiseries",
  "Plomberie et sanitaires",
  "Électricité",
  "Enduits et revêtements",
  "Peinture et finitions",
];

export const ACTIONS: Record<string, string> = {
  CONNEXION: "Connexion",
  CREER: "Création",
  MODIFIER: "Modification",
  VALIDER: "Validation",
  REJETER: "Rejet",
  ANNULER: "Annulation",
  AVENANT: "Avenant",
  DESACTIVER: "Désactivation",
  REACTIVER: "Réactivation",
  MOT_DE_PASSE: "Mot de passe",
  EXPORTER: "Export",
};
