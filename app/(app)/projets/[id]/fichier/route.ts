import { prisma } from "@/lib/db";
import { filtreProjets, session } from "@/lib/auth";
import { lienSigne } from "@/lib/fichiers";

export const dynamic = "force-dynamic";

/**
 * Ouvre une photo (reçu, état du chantier) par un lien signé de 10 minutes,
 * après avoir vérifié que le fichier appartient à un projet visible par l'utilisateur.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await session();
  if (!s) return new Response("Non connecté", { status: 401 });
  const id = Number((await params).id);
  const cle = new URL(req.url).searchParams.get("cle") ?? "";
  const projet = Number.isInteger(id) ? await prisma.projet.findFirst({ where: { id, ...filtreProjets(s) } }) : null;
  if (!projet || !cle.startsWith(`projets/${id}/`) || cle.includes("..")) return new Response("Introuvable", { status: 404 });
  const lien = await lienSigne(cle);
  if (!lien) return new Response("Stockage des photos non configuré", { status: 503 });
  return Response.redirect(lien, 302);
}
