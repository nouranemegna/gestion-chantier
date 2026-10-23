"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Categorie, StatutProjet, TypeOuvrage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ErreurSaisie, exigerSession, journaliser, verifierProjet } from "@/lib/auth";
import { agir, choix, decimal, entier, identifiant, jour, texte, type Etat } from "@/lib/formulaire";
import { CATEGORIES, LISTE_CATEGORIES, STATUTS_PROJET } from "@/lib/labels";
import { fcfa } from "@/lib/format";

const TYPES: TypeOuvrage[] = ["MAISON_INDIVIDUELLE", "IMMEUBLE", "BATIMENT_COMMERCIAL", "BATIMENT_PUBLIC", "AUTRE"];
const STATUTS: StatutProjet[] = ["PREPARATION", "EN_COURS", "SUSPENDU", "TERMINE"];

async function verifierCompte(id: number | null, role: "CLIENT" | "CHEF_CHANTIER", libelle: string) {
  if (id == null) return;
  const u = await prisma.utilisateur.findUnique({ where: { id } });
  if (!u || u.role !== role || !u.actif) throw new ErreurSaisie(`${libelle} : compte introuvable ou désactivé.`);
}

export async function creerProjet(_: Etat, f: FormData): Promise<Etat> {
  let id = 0;
  const etat = await agir(async () => {
    const s = await exigerSession(["INGENIEUR"]);
    const code = texte(f, "code", "Code")!.toUpperCase();
    if (await prisma.projet.findUnique({ where: { code } })) throw new ErreurSaisie("Ce code de projet existe déjà.");
    const dateDebut = jour(f, "dateDebut", "Date de début")!;
    const dateFinPrevue = jour(f, "dateFinPrevue", "Date de fin prévue")!;
    if (dateFinPrevue <= dateDebut) throw new ErreurSaisie("La fin prévue doit suivre le début.");
    const clientId = identifiant(f, "clientId", "Client")!;
    const chefId = identifiant(f, "chefId", "Chef de chantier", false);
    await verifierCompte(clientId, "CLIENT", "Client");
    await verifierCompte(chefId, "CHEF_CHANTIER", "Chef de chantier");

    // Lots cochés, puis lots ajoutés à la main (un par ligne ou séparés par des virgules).
    const lots = [
      ...f.getAll("lots").map(String),
      ...String(f.get("autresLots") ?? "")
        .split(/[\n,]/)
        .map((l) => l.trim()),
    ].filter((l, i, t) => l && t.indexOf(l) === i);
    if (!lots.length) throw new ErreurSaisie("Choisissez au moins un lot de travaux.");

    const p = await prisma.$transaction(async (tx) => {
      const p = await tx.projet.create({
        data: {
          code,
          nom: texte(f, "nom", "Nom")!,
          description: texte(f, "description", "Description", false),
          localisation: texte(f, "localisation", "Localisation")!,
          type: choix(f, "type", "Type d'ouvrage", TYPES),
          surface: decimal(f, "surface", "Surface", { min: 0, strict: true })!,
          niveaux: entier(f, "niveaux", "Niveaux", { min: 1, max: 60 })!,
          dateDebut,
          dateFinPrevue,
          clientId,
          chefId,
          creeParId: s.id,
          lots: { create: lots.map((nom, ordre) => ({ nom, ordre })) },
        },
      });
      await journaliser(s.id, { action: "CREER", entite: "Projet", entiteId: p.id, projetId: p.id, resume: `Projet créé : ${p.nom} (${p.code}), ${lots.length} lots`, apres: p }, tx);
      return p;
    });
    id = p.id;
    return "Projet créé.";
  });
  if (etat.ok) {
    revalidatePath("/", "layout");
    redirect(`/projets/${id}/budget`);
  }
  return etat;
}

export async function modifierProjet(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet: avant } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR"]);
    const statut = choix(f, "statut", "Statut", STATUTS);
    const motifStatut = texte(f, "motifStatut", "Motif", false);
    if (statut === "SUSPENDU" && !motifStatut) throw new ErreurSaisie("Indiquez le motif de la suspension.");
    const clientId = identifiant(f, "clientId", "Client")!;
    const chefId = identifiant(f, "chefId", "Chef de chantier", false);
    await verifierCompte(clientId, "CLIENT", "Client");
    await verifierCompte(chefId, "CHEF_CHANTIER", "Chef de chantier");
    const dateDebut = jour(f, "dateDebut", "Date de début")!;
    const dateFinPrevue = jour(f, "dateFinPrevue", "Date de fin prévue")!;
    if (dateFinPrevue <= dateDebut) throw new ErreurSaisie("La fin prévue doit suivre le début.");
    const apres = await prisma.projet.update({
      where: { id: avant.id },
      data: {
        nom: texte(f, "nom", "Nom")!,
        description: texte(f, "description", "Description", false),
        localisation: texte(f, "localisation", "Localisation")!,
        type: choix(f, "type", "Type d'ouvrage", TYPES),
        surface: decimal(f, "surface", "Surface", { min: 0, strict: true })!,
        niveaux: entier(f, "niveaux", "Niveaux", { min: 1, max: 60 })!,
        dateDebut,
        dateFinPrevue,
        dateFinReelle: statut === "TERMINE" ? (jour(f, "dateFinReelle", "Date de fin réelle", false) ?? new Date()) : null,
        statut,
        motifStatut,
        clientId,
        chefId,
      },
    });
    const changements = Object.keys(apres).filter((k) => JSON.stringify(apres[k as keyof typeof apres]) !== JSON.stringify(avant[k as keyof typeof avant]));
    if (changements.length) {
      await journaliser(s.id, {
        action: "MODIFIER",
        entite: "Projet",
        entiteId: avant.id,
        projetId: avant.id,
        resume:
          avant.statut !== statut
            ? `Statut du projet : ${STATUTS_PROJET[avant.statut]} → ${STATUTS_PROJET[statut]}${motifStatut ? ` (${motifStatut})` : ""}`
            : `Projet modifié : ${changements.join(", ")}`,
        avant: Object.fromEntries(changements.map((k) => [k, avant[k as keyof typeof avant]])),
        apres: Object.fromEntries(changements.map((k) => [k, apres[k as keyof typeof apres]])),
      });
    }
    revalidatePath("/", "layout");
    return changements.length ? "Projet mis à jour." : "Aucun changement.";
  });
}

export async function ajouterLot(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR"]);
    const nom = texte(f, "nom", "Nom du lot")!;
    if (await prisma.lot.findUnique({ where: { projetId_nom: { projetId: projet.id, nom } } })) throw new ErreurSaisie("Ce lot existe déjà.");
    const ordre = await prisma.lot.count({ where: { projetId: projet.id } });
    const lot = await prisma.lot.create({ data: { projetId: projet.id, nom, ordre } });
    await journaliser(s.id, { action: "CREER", entite: "Lot", entiteId: lot.id, projetId: projet.id, resume: `Lot ajouté : ${nom}` });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return `Lot « ${nom} » ajouté.`;
  });
}

/**
 * Budget prévisionnel ventilé, saisi en une grille lot × catégorie. Il reste
 * modifiable tant que le projet est en préparation ; ensuite, toute révision
 * passe par un avenant motivé, et le budget initial ne bouge plus.
 */
export async function enregistrerBudget(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR"]);
    if (projet.statut !== "PREPARATION") throw new ErreurSaisie("Le projet est lancé : le budget initial est figé. Passez par un avenant.");
    const lots = await prisma.lot.findMany({ where: { projetId: projet.id } });
    const avant = await prisma.ligneBudget.findMany({ where: { projetId: projet.id } });
    let total = 0;
    await prisma.$transaction(async (tx) => {
      for (const lot of lots) {
        for (const c of LISTE_CATEGORIES) {
          const montant = entier(f, `b_${lot.id}_${c}`, `${lot.nom} / ${CATEGORIES[c]}`, { min: 0, requis: false }) ?? 0;
          total += montant;
          const existe = avant.find((l) => l.lotId === lot.id && l.categorie === c);
          if (existe) {
            if (existe.montantInitial !== montant) await tx.ligneBudget.update({ where: { id: existe.id }, data: { montantInitial: montant } });
          } else if (montant > 0) {
            await tx.ligneBudget.create({ data: { projetId: projet.id, lotId: lot.id, categorie: c, montantInitial: montant } });
          }
        }
      }
      const totalAvant = avant.reduce((t, l) => t + l.montantInitial, 0);
      if (totalAvant !== total || avant.length === 0) {
        await journaliser(
          s.id,
          {
            action: "MODIFIER",
            entite: "Budget",
            projetId: projet.id,
            resume: `Budget prévisionnel enregistré : ${fcfa(total)}`,
            avant: { total: totalAvant },
            apres: { total },
          },
          tx,
        );
      }
    });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return `Budget enregistré : ${fcfa(total)}.`;
  });
}

export async function creerAvenant(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR"]);
    const lotId = identifiant(f, "lotId", "Lot")!;
    const categorie = choix<Categorie>(f, "categorie", "Catégorie", LISTE_CATEGORIES);
    const sens = choix(f, "sens", "Sens", ["HAUSSE", "BAISSE"] as const);
    const valeur = entier(f, "montant", "Montant", { min: 0, strict: true })!;
    const montant = sens === "HAUSSE" ? valeur : -valeur;
    const motif = texte(f, "motif", "Motif")!;
    const date = jour(f, "date", "Date")!;
    const lot = await prisma.lot.findFirst({ where: { id: lotId, projetId: projet.id } });
    if (!lot) throw new ErreurSaisie("Lot introuvable.");
    await prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneBudget.upsert({
        where: { lotId_categorie: { lotId, categorie } },
        create: { projetId: projet.id, lotId, categorie, montantInitial: 0 },
        update: {},
        include: { avenants: true },
      });
      const actuel = ligne.montantInitial + ligne.avenants.reduce((t, a) => t + a.montant, 0);
      if (actuel + montant < 0) throw new ErreurSaisie(`La baisse dépasse le budget de la ligne (${fcfa(actuel)}).`);
      const a = await tx.avenant.create({ data: { projetId: projet.id, ligneId: ligne.id, montant, motif, date, auteurId: s.id } });
      await journaliser(
        s.id,
        {
          action: "AVENANT",
          entite: "Avenant",
          entiteId: a.id,
          projetId: projet.id,
          resume: `Avenant ${montant > 0 ? "+" : "−"}${fcfa(valeur)} sur ${lot.nom} / ${CATEGORIES[categorie]} : ${motif}`,
          avant: { budgetLigne: actuel },
          apres: { budgetLigne: actuel + montant },
        },
        tx,
      );
    });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return "Avenant enregistré : le budget révisé est mis à jour.";
  });
}
