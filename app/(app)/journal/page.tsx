import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { exigerSession } from "@/lib/auth";
import { ACTIONS } from "@/lib/labels";
import { Historique } from "@/components/app/Historique";
import { Bouton, Section, classeChamp } from "@/components/app/ui";

export const metadata = { title: "Journal" };

const PAR_PAGE = 100;

export default async function JournalGeneral({ searchParams }: { searchParams: Promise<{ page?: string; action?: string; auteur?: string }> }) {
  await exigerSession(["INGENIEUR"]);
  const f = await searchParams;
  const page = Math.max(1, Number(f.page) || 1);
  const where: Prisma.JournalWhereInput = {};
  if (f.action && f.action in ACTIONS) where.action = f.action;
  if (f.auteur && Number(f.auteur)) where.auteurId = Number(f.auteur);
  const [entrees, total, auteurs] = await Promise.all([
    prisma.journal.findMany({ where, orderBy: { date: "desc" }, include: { auteur: true, projet: { select: { nom: true } } }, skip: (page - 1) * PAR_PAGE, take: PAR_PAGE }),
    prisma.journal.count({ where }),
    prisma.utilisateur.findMany({ orderBy: { nom: "asc" }, select: { id: true, prenom: true, nom: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));
  const lien = (p: number) => `?${new URLSearchParams({ ...(f.action ? { action: f.action } : {}), ...(f.auteur ? { auteur: f.auteur } : {}), page: String(p) })}`;
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Journal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Traçabilité complète : connexions, saisies, corrections, validations, avenants et gestion des comptes, sur tous les projets.</p>
      </div>
      <Section>
        <form className="mb-6 grid gap-3 sm:grid-cols-3">
          <select name="action" defaultValue={f.action ?? ""} className={classeChamp}>
            <option value="">Toutes les opérations</option>
            {Object.entries(ACTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select name="auteur" defaultValue={f.auteur ?? ""} className={classeChamp}>
            <option value="">Tous les utilisateurs</option>
            {auteurs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom}
              </option>
            ))}
          </select>
          <Bouton variante="secondaire" type="submit">
            Filtrer ({total})
          </Bouton>
        </form>
        <Historique entrees={entrees} avecProjet />
        {pages > 1 && (
          <div className="mt-6 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={lien(page - 1)} className="font-semibold text-primary">
                ← Plus récentes
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Page {page} sur {pages}
            </span>
            {page < pages ? (
              <Link href={lien(page + 1)} className="font-semibold text-primary">
                Plus anciennes →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
