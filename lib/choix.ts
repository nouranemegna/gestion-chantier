import { prisma } from "./db";
import type { Choix } from "@/components/app/FormulaireDepense";

/** Listes du formulaire de dépense : lots du projet, catalogue avec le dernier prix payé, fournisseurs. */
export async function chargerChoix(projetId: number): Promise<Choix> {
  const [lots, articles, fournisseurs, derniers] = await Promise.all([
    prisma.lot.findMany({ where: { projetId }, orderBy: { ordre: "asc" }, select: { id: true, nom: true } }),
    prisma.article.findMany({ where: { actif: true }, orderBy: { designation: "asc" } }),
    prisma.fournisseur.findMany({ where: { actif: true }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    // Dernier prix validé de chaque article, tous projets confondus.
    prisma.depense.findMany({
      where: { statut: "VALIDEE", articleId: { not: null } },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      distinct: ["articleId"],
      select: { articleId: true, prixUnitaire: true },
    }),
  ]);
  const prix = new Map(derniers.map((d) => [d.articleId!, d.prixUnitaire]));
  return {
    lots,
    articles: articles.map((a) => ({ id: a.id, designation: a.designation, unite: a.unite, categorie: a.categorie, dernierPrix: prix.get(a.id) ?? null })),
    fournisseurs,
  };
}
