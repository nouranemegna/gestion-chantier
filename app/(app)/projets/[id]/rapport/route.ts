import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { analyseProjet } from "@/lib/donnees";
import { journaliser } from "@/lib/auth";
import { aujourdhui, cleJour } from "@/lib/format";
import { RapportProjet } from "@/lib/rapport-pdf";
import { LOGO_PDF } from "@/lib/logo-pdf";
import { nomFichier, projetPourExport, refus } from "@/lib/routes";

export const dynamic = "force-dynamic";

/** Rapport récapitulatif du projet en PDF : ingénieure et client. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const acces = await projetPourExport((await params).id, ["INGENIEUR", "CLIENT"]);
  if (!acces) return refus();
  const { s, projet: p } = acces;
  const { analyse } = await analyseProjet(p.id, s);
  let pdf: Buffer;
  try {
    pdf = await renderToBuffer(
      createElement(RapportProjet, {
        projet: {
          code: p.code,
          nom: p.nom,
          type: p.type,
          statut: p.statut,
          localisation: p.localisation,
          surface: p.surface,
          dateDebut: p.dateDebut,
          dateFinPrevue: p.dateFinPrevue,
          client: `${p.client.prenom} ${p.client.nom}`,
          chef: p.chef ? `${p.chef.prenom} ${p.chef.nom}` : "-",
        },
        auteur: s.nom,
        logo: LOGO_PDF,
        a: analyse,
      }) as Parameters<typeof renderToBuffer>[0],
    );
  } catch (e) {
    console.error("Rapport PDF :", e);
    return new Response(`Le rapport PDF n'a pas pu être généré : ${e instanceof Error ? e.message : String(e)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  await journaliser(s.id, { action: "EXPORTER", entite: "Projet", entiteId: p.id, projetId: p.id, resume: "Rapport PDF du projet" });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rapport-${nomFichier(p.code)}-${cleJour(aujourdhui())}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
