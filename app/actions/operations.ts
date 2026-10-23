"use server";

import { revalidatePath } from "next/cache";
import type { Categorie, ModePaiement } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ErreurSaisie, exigerSession, journaliser, verifierProjet } from "@/lib/auth";
import { agir, choix, decimal, entier, fichier, identifiant, jour, texte, type Etat } from "@/lib/formulaire";
import { CATEGORIES, LISTE_CATEGORIES, MODES_PAIEMENT } from "@/lib/labels";
import { aujourdhui, fcfa, nombre } from "@/lib/format";
import { televerser } from "@/lib/fichiers";

const MODES: ModePaiement[] = ["ESPECES", "VIREMENT", "MOBILE_MONEY", "CHEQUE"];

function pasDansLeFutur(d: Date) {
  if (d.getTime() > aujourdhui().getTime()) throw new ErreurSaisie("La date ne peut pas être dans le futur.");
}

function pasTermine(statut: string) {
  if (statut === "TERMINE") throw new ErreurSaisie("Le projet est terminé : il n'accepte plus de saisie.");
}

/* ───────────── Dépenses ───────────── */

/** Champs communs à la création et à la modification ; le montant est calculé ici, jamais saisi. */
async function lireDepense(f: FormData, projetId: number) {
  const lotId = identifiant(f, "lotId", "Lot")!;
  if (!(await prisma.lot.findFirst({ where: { id: lotId, projetId } }))) throw new ErreurSaisie("Lot introuvable.");
  const categorie = choix<Categorie>(f, "categorie", "Catégorie", LISTE_CATEGORIES);
  const articleId = identifiant(f, "articleId", "Article", false);
  const article = articleId ? await prisma.article.findUnique({ where: { id: articleId } }) : null;
  if (articleId && !article) throw new ErreurSaisie("Article introuvable.");
  const fournisseurId = identifiant(f, "fournisseurId", "Fournisseur", false);
  if (fournisseurId && !(await prisma.fournisseur.findUnique({ where: { id: fournisseurId } }))) throw new ErreurSaisie("Fournisseur introuvable.");
  const quantite = decimal(f, "quantite", "Quantité", { min: 0, strict: true, max: 1e7 })!;
  const prixUnitaire = entier(f, "prixUnitaire", "Prix unitaire", { min: 0, strict: true, max: 1e10 })!;
  const montant = Math.round(quantite * prixUnitaire);
  if (montant > 5e10) throw new ErreurSaisie("Montant hors limites : vérifiez la quantité et le prix.");
  const date = jour(f, "date", "Date")!;
  pasDansLeFutur(date);
  return {
    lotId,
    categorie: article?.categorie ?? categorie,
    articleId,
    libelle: texte(f, "libelle", "Libellé", !article) ?? article!.designation,
    quantite,
    unite: texte(f, "unite", "Unité", !article) ?? article!.unite,
    prixUnitaire,
    montant,
    date,
    fournisseurId,
    reference: texte(f, "reference", "N° de reçu", false),
    observation: texte(f, "observation", "Observation", false),
  };
}

export async function creerDepense(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR", "CHEF_CHANTIER"]);
    pasTermine(projet.statut);
    const champs = await lireDepense(f, projet.id);
    const fichierCle = await televerser(fichier(f, "photo"), `projets/${projet.id}/depenses`);
    // La dépense saisie par l'ingénieure est validée d'office ; celle du chef attend sa validation.
    const validee = s.role === "INGENIEUR";
    const d = await prisma.$transaction(async (tx) => {
      const d = await tx.depense.create({
        data: {
          ...champs,
          projetId: projet.id,
          fichierCle,
          auteurId: s.id,
          statut: validee ? "VALIDEE" : "EN_ATTENTE",
          decideParId: validee ? s.id : null,
          decideLe: validee ? new Date() : null,
        },
      });
      await journaliser(
        s.id,
        {
          action: "CREER",
          entite: "Depense",
          entiteId: d.id,
          projetId: projet.id,
          resume: `Dépense saisie${validee ? " et validée" : ""} : ${d.libelle}, ${nombre(d.quantite)} ${d.unite} × ${fcfa(d.prixUnitaire)} = ${fcfa(d.montant)}`,
          apres: d,
        },
        tx,
      );
      return d;
    });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return `Dépense enregistrée : ${fcfa(d.montant)}${validee ? "." : ", en attente de validation."}`;
  });
}

/** Une dépense en attente se corrige ; l'avant et l'après restent dans le journal. */
export async function modifierDepense(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR", "CHEF_CHANTIER"]);
    const avant = await prisma.depense.findFirst({ where: { id: identifiant(f, "id", "Dépense")!, projetId: projet.id } });
    if (!avant) throw new ErreurSaisie("Dépense introuvable.");
    if (avant.statut !== "EN_ATTENTE") throw new ErreurSaisie("Seule une dépense en attente se modifie. Une dépense validée s'annule, avec un motif.");
    if (s.role === "CHEF_CHANTIER" && avant.auteurId !== s.id) throw new ErreurSaisie("Vous ne pouvez modifier que vos propres saisies.");
    const champs = await lireDepense(f, projet.id);
    const photo = await televerser(fichier(f, "photo"), `projets/${projet.id}/depenses`);
    const apres = await prisma.depense.update({ where: { id: avant.id }, data: { ...champs, ...(photo ? { fichierCle: photo } : {}) } });
    const changes = (Object.keys(champs) as (keyof typeof champs)[]).filter((k) => JSON.stringify(avant[k]) !== JSON.stringify(apres[k]));
    if (photo) changes.push("photo" as never);
    if (!changes.length) return "Aucun changement.";
    await journaliser(s.id, {
      action: "MODIFIER",
      entite: "Depense",
      entiteId: avant.id,
      projetId: projet.id,
      resume: `Dépense modifiée (${changes.join(", ")}) : ${apres.libelle}, ${fcfa(avant.montant)} → ${fcfa(apres.montant)}`,
      avant: Object.fromEntries(changes.map((k) => [k, avant[k as keyof typeof avant]])),
      apres: Object.fromEntries(changes.map((k) => [k, apres[k as keyof typeof apres]])),
    });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return "Dépense modifiée.";
  });
}

/** Validation, rejet (motif obligatoire) ou annulation (motif obligatoire). */
export async function deciderDepense(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR", "CHEF_CHANTIER"]);
    const decision = choix(f, "decision", "Décision", ["VALIDER", "REJETER", "ANNULER"] as const);
    const d = await prisma.depense.findFirst({ where: { id: identifiant(f, "id", "Dépense")!, projetId: projet.id } });
    if (!d) throw new ErreurSaisie("Dépense introuvable.");
    const motif = texte(f, "motif", "Motif", decision !== "VALIDER");

    if (s.role === "CHEF_CHANTIER") {
      // Le chef retire seulement sa propre saisie, tant qu'elle n'est pas validée.
      if (decision !== "ANNULER" || d.auteurId !== s.id || d.statut !== "EN_ATTENTE") throw new ErreurSaisie("Cette décision revient à l'ingénieure.");
    } else if (decision === "ANNULER" ? !["VALIDEE", "EN_ATTENTE"].includes(d.statut) : d.statut !== "EN_ATTENTE") {
      throw new ErreurSaisie("Cette dépense a déjà été traitée.");
    }
    const statut = decision === "VALIDER" ? "VALIDEE" : decision === "REJETER" ? "REJETEE" : "ANNULEE";
    await prisma.$transaction(async (tx) => {
      await tx.depense.update({ where: { id: d.id }, data: { statut, motif, decideParId: s.id, decideLe: new Date() } });
      await journaliser(
        s.id,
        {
          action: decision,
          entite: "Depense",
          entiteId: d.id,
          projetId: projet.id,
          resume: `Dépense ${decision === "VALIDER" ? "validée" : decision === "REJETER" ? "rejetée" : "annulée"} : ${d.libelle}, ${fcfa(d.montant)}${motif ? ` — ${motif}` : ""}`,
          avant: { statut: d.statut },
          apres: { statut, motif },
        },
        tx,
      );
    });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return decision === "VALIDER" ? "Dépense validée." : decision === "REJETER" ? "Dépense rejetée." : "Dépense annulée.";
  });
}

/* ───────────── Versements du client ───────────── */

export async function declarerVersement(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR", "CLIENT"]);
    const montant = entier(f, "montant", "Montant", { min: 0, strict: true, max: 1e11 })!;
    const date = jour(f, "date", "Date")!;
    pasDansLeFutur(date);
    const mode = choix(f, "mode", "Mode de paiement", MODES);
    const recu = s.role === "INGENIEUR";
    const v = await prisma.versement.create({
      data: {
        projetId: projet.id,
        montant,
        date,
        mode,
        reference: texte(f, "reference", "Référence", false),
        auteurId: s.id,
        statut: recu ? "VALIDEE" : "EN_ATTENTE",
        decideParId: recu ? s.id : null,
        decideLe: recu ? new Date() : null,
      },
    });
    await journaliser(s.id, {
      action: "CREER",
      entite: "Versement",
      entiteId: v.id,
      projetId: projet.id,
      resume: `Versement ${recu ? "enregistré" : "déclaré"} : ${fcfa(montant)} par ${MODES_PAIEMENT[mode]}`,
      apres: v,
    });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return recu ? "Versement enregistré." : "Versement déclaré : l'ingénieure confirmera sa réception.";
  });
}

export async function deciderVersement(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR"]);
    const decision = choix(f, "decision", "Décision", ["VALIDER", "REJETER"] as const);
    const v = await prisma.versement.findFirst({ where: { id: identifiant(f, "id", "Versement")!, projetId: projet.id } });
    if (!v) throw new ErreurSaisie("Versement introuvable.");
    if (v.statut !== "EN_ATTENTE") throw new ErreurSaisie("Ce versement a déjà été traité.");
    const motif = texte(f, "motif", "Motif", decision === "REJETER");
    const statut = decision === "VALIDER" ? "VALIDEE" : "REJETEE";
    await prisma.versement.update({ where: { id: v.id }, data: { statut, motif, decideParId: s.id, decideLe: new Date() } });
    await journaliser(s.id, {
      action: decision,
      entite: "Versement",
      entiteId: v.id,
      projetId: projet.id,
      resume: `Versement ${decision === "VALIDER" ? "confirmé" : "rejeté"} : ${fcfa(v.montant)}${motif ? ` — ${motif}` : ""}`,
      avant: { statut: v.statut },
      apres: { statut, motif },
    });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return decision === "VALIDER" ? "Réception confirmée." : "Versement rejeté.";
  });
}

/* ───────────── Avancement des travaux ───────────── */

export async function declarerReleve(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR", "CHEF_CHANTIER"]);
    pasTermine(projet.statut);
    const lot = await prisma.lot.findFirst({ where: { id: identifiant(f, "lotId", "Lot")!, projetId: projet.id } });
    if (!lot) throw new ErreurSaisie("Lot introuvable.");
    const pourcentage = decimal(f, "pourcentage", "Avancement", { min: 0, max: 100 })!;
    const commentaire = texte(f, "commentaire", "Commentaire", false);
    // Un recul de l'avancement (malfaçon, démolition) reste possible, mais il doit être expliqué.
    if (pourcentage < lot.avancement && !commentaire) throw new ErreurSaisie(`L'avancement validé du lot est de ${lot.avancement} % : expliquez ce recul en commentaire.`);
    const date = jour(f, "date", "Date")!;
    pasDansLeFutur(date);
    const photoCle = await televerser(fichier(f, "photo"), `projets/${projet.id}/avancement`);
    const valide = s.role === "INGENIEUR";
    await prisma.$transaction(async (tx) => {
      const r = await tx.releve.create({
        data: {
          projetId: projet.id,
          lotId: lot.id,
          date,
          pourcentage,
          commentaire,
          photoCle,
          auteurId: s.id,
          statut: valide ? "VALIDEE" : "EN_ATTENTE",
          decideParId: valide ? s.id : null,
          decideLe: valide ? new Date() : null,
        },
      });
      if (valide) await tx.lot.update({ where: { id: lot.id }, data: { avancement: pourcentage } });
      await journaliser(
        s.id,
        {
          action: "CREER",
          entite: "Releve",
          entiteId: r.id,
          projetId: projet.id,
          resume: `Avancement ${valide ? "validé" : "déclaré"} : ${lot.nom} à ${pourcentage} %`,
          avant: { avancement: lot.avancement },
          apres: { pourcentage },
        },
        tx,
      );
    });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return valide ? "Avancement enregistré." : "Avancement déclaré : l'ingénieure le validera.";
  });
}

export async function deciderReleve(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const { s, projet } = await verifierProjet(identifiant(f, "projetId", "Projet")!, ["INGENIEUR"]);
    const decision = choix(f, "decision", "Décision", ["VALIDER", "REJETER"] as const);
    const r = await prisma.releve.findFirst({ where: { id: identifiant(f, "id", "Relevé")!, projetId: projet.id }, include: { lot: true } });
    if (!r) throw new ErreurSaisie("Relevé introuvable.");
    if (r.statut !== "EN_ATTENTE") throw new ErreurSaisie("Ce relevé a déjà été traité.");
    const motif = texte(f, "motif", "Motif", decision === "REJETER");
    await prisma.$transaction(async (tx) => {
      await tx.releve.update({ where: { id: r.id }, data: { statut: decision === "VALIDER" ? "VALIDEE" : "REJETEE", motif, decideParId: s.id, decideLe: new Date() } });
      if (decision === "VALIDER") await tx.lot.update({ where: { id: r.lotId }, data: { avancement: r.pourcentage } });
      await journaliser(
        s.id,
        {
          action: decision,
          entite: "Releve",
          entiteId: r.id,
          projetId: projet.id,
          resume: `Avancement ${decision === "VALIDER" ? "validé" : "rejeté"} : ${r.lot.nom} à ${r.pourcentage} %${motif ? ` — ${motif}` : ""}`,
          avant: { avancementLot: r.lot.avancement },
          apres: decision === "VALIDER" ? { avancementLot: r.pourcentage } : { motif },
        },
        tx,
      );
    });
    revalidatePath(`/projets/${projet.id}`, "layout");
    return decision === "VALIDER" ? "Avancement validé." : "Relevé rejeté.";
  });
}

/* ───────────── Articles et fournisseurs ───────────── */

export async function creerArticle(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const s = await exigerSession(["INGENIEUR", "CHEF_CHANTIER"]);
    const designation = texte(f, "designation", "Désignation")!;
    if (await prisma.article.findFirst({ where: { designation: { equals: designation, mode: "insensitive" } } })) throw new ErreurSaisie("Cet article existe déjà.");
    const categorie = choix<Categorie>(f, "categorie", "Catégorie", LISTE_CATEGORIES);
    const a = await prisma.article.create({ data: { designation, unite: texte(f, "unite", "Unité")!, categorie } });
    await journaliser(s.id, { action: "CREER", entite: "Article", entiteId: a.id, resume: `Article ajouté : ${designation} (${CATEGORIES[categorie]}, ${a.unite})` });
    revalidatePath("/", "layout");
    return `Article « ${designation} » ajouté.`;
  });
}

export async function creerFournisseur(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const s = await exigerSession(["INGENIEUR", "CHEF_CHANTIER"]);
    const nom = texte(f, "nom", "Nom")!;
    if (await prisma.fournisseur.findFirst({ where: { nom: { equals: nom, mode: "insensitive" } } })) throw new ErreurSaisie("Ce fournisseur existe déjà.");
    const fo = await prisma.fournisseur.create({ data: { nom, telephone: texte(f, "telephone", "Téléphone", false), activite: texte(f, "activite", "Activité", false) } });
    await journaliser(s.id, { action: "CREER", entite: "Fournisseur", entiteId: fo.id, resume: `Fournisseur ajouté : ${nom}` });
    revalidatePath("/", "layout");
    return `Fournisseur « ${nom} » ajouté.`;
  });
}

export async function basculerReferentiel(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const s = await exigerSession(["INGENIEUR"]);
    const type = choix(f, "type", "Type", ["article", "fournisseur"] as const);
    const id = identifiant(f, "id", "Élément")!;
    if (type === "article") {
      const a = await prisma.article.findUniqueOrThrow({ where: { id } });
      await prisma.article.update({ where: { id }, data: { actif: !a.actif } });
      await journaliser(s.id, { action: a.actif ? "DESACTIVER" : "REACTIVER", entite: "Article", entiteId: id, resume: `Article ${a.actif ? "retiré" : "remis"} : ${a.designation}` });
    } else {
      const fo = await prisma.fournisseur.findUniqueOrThrow({ where: { id } });
      await prisma.fournisseur.update({ where: { id }, data: { actif: !fo.actif } });
      await journaliser(s.id, { action: fo.actif ? "DESACTIVER" : "REACTIVER", entite: "Fournisseur", entiteId: id, resume: `Fournisseur ${fo.actif ? "retiré" : "remis"} : ${fo.nom}` });
    }
    revalidatePath("/referentiels");
    return "Mis à jour.";
  });
}
