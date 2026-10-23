import { analyseProjet } from "@/lib/donnees";
import { classeurProjet } from "@/lib/excel";
import { journaliser } from "@/lib/auth";
import { aujourdhui, cleJour } from "@/lib/format";
import { nomFichier, projetPourExport, refus } from "@/lib/routes";

export const dynamic = "force-dynamic";

/** Export Excel d'un projet : ingénieure et client. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acces = await projetPourExport((await params).id, ["INGENIEUR", "CLIENT"]);
  if (!acces) return refus();
  const { s, projet } = acces;
  const { analyse } = await analyseProjet(projet.id, s);
  const fichier = await classeurProjet(projet, analyse, s);
  await journaliser(s.id, { action: "EXPORTER", entite: "Projet", entiteId: projet.id, projetId: projet.id, resume: "Export Excel du projet" });
  return new Response(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier(`${projet.code}-${cleJour(aujourdhui())}`)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
