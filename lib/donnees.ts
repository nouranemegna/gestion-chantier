import { cache } from "react";
import { prisma } from "./db";
import { analyser, type Analyse, type DonneesProjet } from "./analyse";
import { aujourdhui } from "./format";
import type { Session } from "./session";

/**
 * Lit tout ce qu'il faut pour analyser un ou plusieurs projets, en cinq requêtes
 * quel que soit leur nombre (la liste des projets et la comparaison en analysent
 * plusieurs à la fois). Le client ne voit que les dépenses validées : celles en
 * attente ne sont pas encore des chiffres fiables.
 */
export async function chargerDonneesPlusieurs(ids: number[], s: Session): Promise<Map<number, DonneesProjet>> {
  if (!ids.length) return new Map();
  const dans = { projetId: { in: ids } };
  const [projets, lots, lignes, depenses, versements] = await Promise.all([
    prisma.projet.findMany({ where: { id: { in: ids } } }),
    prisma.lot.findMany({ where: dans, orderBy: { ordre: "asc" } }),
    prisma.ligneBudget.findMany({ where: dans, include: { avenants: { select: { montant: true } } } }),
    prisma.depense.findMany({
      where: { ...dans, statut: s.role === "CLIENT" ? "VALIDEE" : { in: ["VALIDEE", "EN_ATTENTE"] } },
      select: {
        id: true,
        projetId: true,
        lotId: true,
        categorie: true,
        articleId: true,
        libelle: true,
        quantite: true,
        unite: true,
        prixUnitaire: true,
        montant: true,
        date: true,
        statut: true,
        reference: true,
        fichierCle: true,
        creeLe: true,
        article: { select: { designation: true } },
        fournisseur: { select: { nom: true } },
      },
    }),
    prisma.versement.findMany({ where: dans, select: { projetId: true, montant: true, date: true, statut: true } }),
  ]);
  return new Map(
    projets.map((projet) => [
      projet.id,
      {
        surface: projet.surface,
        dateDebut: projet.dateDebut,
        dateFinPrevue: projet.dateFinPrevue,
        termine: projet.statut === "TERMINE",
        lots: lots.filter((l) => l.projetId === projet.id).map((l) => ({ id: l.id, nom: l.nom, avancement: l.avancement })),
        lignes: lignes
          .filter((l) => l.projetId === projet.id)
          .map((l) => ({
            id: l.id,
            lotId: l.lotId,
            categorie: l.categorie,
            montantInitial: l.montantInitial,
            avenants: l.avenants.reduce((t, a) => t + a.montant, 0),
          })),
        depenses: depenses
          .filter((x) => x.projetId === projet.id)
          .map((x) => ({
            id: x.id,
            lotId: x.lotId,
            categorie: x.categorie,
            articleId: x.articleId,
            article: x.article?.designation ?? null,
            fournisseur: x.fournisseur?.nom ?? null,
            libelle: x.libelle,
            quantite: x.quantite,
            unite: x.unite,
            prixUnitaire: x.prixUnitaire,
            montant: x.montant,
            date: x.date,
            statut: x.statut,
            justifiee: Boolean(x.reference || x.fichierCle),
            creeLe: x.creeLe,
          })),
        versements: versements.filter((v) => v.projetId === projet.id),
      },
    ]),
  );
}

export async function chargerDonnees(projetId: number, s: Session): Promise<DonneesProjet> {
  const d = (await chargerDonneesPlusieurs([projetId], s)).get(projetId);
  if (!d) throw new Error(`Projet ${projetId} introuvable`);
  return d;
}

/** Analyse d'un projet, calculée une seule fois par requête même si le layout et la page la demandent. */
export const analyseProjet = cache(async (projetId: number, s: Session) => {
  const donnees = await chargerDonnees(projetId, s);
  return { donnees, analyse: analyser(donnees, aujourdhui()) };
});

/** Analyses de plusieurs projets d'un coup (liste des projets, comparaison). */
export async function analysesProjets(ids: number[], s: Session): Promise<Map<number, Analyse>> {
  const donnees = await chargerDonneesPlusieurs(ids, s);
  const jour = aujourdhui();
  return new Map(Array.from(donnees, ([id, d]) => [id, analyser(d, jour)]));
}
