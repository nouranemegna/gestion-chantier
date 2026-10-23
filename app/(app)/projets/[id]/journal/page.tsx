import Link from "next/link";
import { prisma } from "@/lib/db";
import { exigerProjet } from "@/lib/auth";
import { Historique } from "@/components/app/Historique";
import { Section } from "@/components/app/ui";

export const metadata = { title: "Journal du projet" };

const PAR_PAGE = 100;

export default async function JournalProjet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { projet: p } = await exigerProjet(Number((await params).id), ["INGENIEUR"]);
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [entrees, total] = await Promise.all([
    prisma.journal.findMany({ where: { projetId: p.id }, orderBy: { date: "desc" }, include: { auteur: true }, skip: (page - 1) * PAR_PAGE, take: PAR_PAGE }),
    prisma.journal.count({ where: { projetId: p.id } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  return (
    <Section
      titre={`Journal du projet (${total} opérations)`}
      description="Tout ce qui a été saisi, modifié, validé, rejeté ou annulé sur ce projet, par qui et quand. Le journal ne peut être ni modifié ni effacé."
    >
      <Historique entrees={entrees} />
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`?page=${page - 1}`} className="font-semibold text-primary">← Plus récentes</Link> : <span />}
          <span className="text-muted-foreground">Page {page} sur {pages}</span>
          {page < pages ? <Link href={`?page=${page + 1}`} className="font-semibold text-primary">Plus anciennes →</Link> : <span />}
        </div>
      )}
    </Section>
  );
}
