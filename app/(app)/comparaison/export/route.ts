import { prisma } from "@/lib/db";
import { journaliser, session } from "@/lib/auth";
import { analysesProjets } from "@/lib/donnees";
import { classeurComparaison } from "@/lib/excel";
import { aujourdhui, cleJour } from "@/lib/format";
import { refus } from "@/lib/routes";

export const dynamic = "force-dynamic";

/** Export Excel de la comparaison de tous les projets : ingénieure seulement. */
export async function GET() {
  const s = await session();
  if (!s || s.role !== "INGENIEUR") return refus();
  const projets = await prisma.projet.findMany({ orderBy: { dateDebut: "asc" } });
  const analyses = await analysesProjets(projets.map((p) => p.id), s);
  const lignes = projets.map((p) => ({ p, a: analyses.get(p.id)! }));
  const fichier = await classeurComparaison(lignes);
  await journaliser(s.id, { action: "EXPORTER", entite: "Projet", resume: "Export Excel de la comparaison des projets" });
  return new Response(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="comparaison-projets-${cleJour(aujourdhui())}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
