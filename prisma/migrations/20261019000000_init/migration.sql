-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('INGENIEUR', 'CLIENT', 'CHEF_CHANTIER');

-- CreateEnum
CREATE TYPE "TypeOuvrage" AS ENUM ('MAISON_INDIVIDUELLE', 'IMMEUBLE', 'BATIMENT_COMMERCIAL', 'BATIMENT_PUBLIC', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutProjet" AS ENUM ('PREPARATION', 'EN_COURS', 'SUSPENDU', 'TERMINE');

-- CreateEnum
CREATE TYPE "Categorie" AS ENUM ('MATERIAUX', 'MAIN_OEUVRE', 'TRANSPORT', 'LOCATION_EQUIPEMENT', 'AUTRES');

-- CreateEnum
CREATE TYPE "Statut" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'REJETEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'VIREMENT', 'MOBILE_MONEY', 'CHEQUE');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" SERIAL NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "motDePasseHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniereConnexion" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projet" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "localisation" TEXT NOT NULL,
    "type" "TypeOuvrage" NOT NULL,
    "surface" DOUBLE PRECISION NOT NULL,
    "niveaux" INTEGER NOT NULL DEFAULT 1,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFinPrevue" TIMESTAMP(3) NOT NULL,
    "dateFinReelle" TIMESTAMP(3),
    "statut" "StatutProjet" NOT NULL DEFAULT 'PREPARATION',
    "motifStatut" TEXT,
    "clientId" INTEGER NOT NULL,
    "chefId" INTEGER,
    "creeParId" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Projet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" SERIAL NOT NULL,
    "projetId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "avancement" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBudget" (
    "id" SERIAL NOT NULL,
    "projetId" INTEGER NOT NULL,
    "lotId" INTEGER NOT NULL,
    "categorie" "Categorie" NOT NULL,
    "montantInitial" INTEGER NOT NULL,

    CONSTRAINT "LigneBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avenant" (
    "id" SERIAL NOT NULL,
    "projetId" INTEGER NOT NULL,
    "ligneId" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "auteurId" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" SERIAL NOT NULL,
    "designation" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "categorie" "Categorie" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fournisseur" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "telephone" TEXT,
    "activite" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Depense" (
    "id" SERIAL NOT NULL,
    "projetId" INTEGER NOT NULL,
    "lotId" INTEGER NOT NULL,
    "categorie" "Categorie" NOT NULL,
    "articleId" INTEGER,
    "libelle" TEXT NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "unite" TEXT NOT NULL,
    "prixUnitaire" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fournisseurId" INTEGER,
    "reference" TEXT,
    "fichierCle" TEXT,
    "observation" TEXT,
    "statut" "Statut" NOT NULL DEFAULT 'EN_ATTENTE',
    "motif" TEXT,
    "auteurId" INTEGER NOT NULL,
    "decideParId" INTEGER,
    "decideLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Depense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Versement" (
    "id" SERIAL NOT NULL,
    "projetId" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "reference" TEXT,
    "statut" "Statut" NOT NULL DEFAULT 'EN_ATTENTE',
    "motif" TEXT,
    "auteurId" INTEGER NOT NULL,
    "decideParId" INTEGER,
    "decideLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Versement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Releve" (
    "id" SERIAL NOT NULL,
    "projetId" INTEGER NOT NULL,
    "lotId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "pourcentage" DOUBLE PRECISION NOT NULL,
    "commentaire" TEXT,
    "photoCle" TEXT,
    "statut" "Statut" NOT NULL DEFAULT 'EN_ATTENTE',
    "motif" TEXT,
    "auteurId" INTEGER NOT NULL,
    "decideParId" INTEGER,
    "decideLe" TIMESTAMP(3),
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Releve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Journal" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" INTEGER NOT NULL,
    "projetId" INTEGER,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" INTEGER,
    "resume" TEXT NOT NULL,
    "avant" JSONB,
    "apres" JSONB,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_telephone_key" ON "Utilisateur"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "Projet_code_key" ON "Projet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_projetId_nom_key" ON "Lot"("projetId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "LigneBudget_lotId_categorie_key" ON "LigneBudget"("lotId", "categorie");

-- CreateIndex
CREATE UNIQUE INDEX "Article_designation_key" ON "Article"("designation");

-- CreateIndex
CREATE UNIQUE INDEX "Fournisseur_nom_key" ON "Fournisseur"("nom");

-- CreateIndex
CREATE INDEX "Depense_projetId_date_idx" ON "Depense"("projetId", "date");

-- CreateIndex
CREATE INDEX "Depense_articleId_idx" ON "Depense"("articleId");

-- CreateIndex
CREATE INDEX "Versement_projetId_date_idx" ON "Versement"("projetId", "date");

-- CreateIndex
CREATE INDEX "Releve_projetId_date_idx" ON "Releve"("projetId", "date");

-- CreateIndex
CREATE INDEX "Journal_projetId_date_idx" ON "Journal"("projetId", "date");

-- CreateIndex
CREATE INDEX "Journal_date_idx" ON "Journal"("date");

-- AddForeignKey
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_chefId_fkey" FOREIGN KEY ("chefId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBudget" ADD CONSTRAINT "LigneBudget_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBudget" ADD CONSTRAINT "LigneBudget_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_ligneId_fkey" FOREIGN KEY ("ligneId") REFERENCES "LigneBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_decideParId_fkey" FOREIGN KEY ("decideParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Versement" ADD CONSTRAINT "Versement_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Versement" ADD CONSTRAINT "Versement_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Versement" ADD CONSTRAINT "Versement_decideParId_fkey" FOREIGN KEY ("decideParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Releve" ADD CONSTRAINT "Releve_decideParId_fkey" FOREIGN KEY ("decideParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Journal" ADD CONSTRAINT "Journal_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

