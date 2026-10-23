import Link from "next/link";
import { AlertTriangle, Building2, CircleDollarSign, Clock3, MapPin, Plus, Receipt, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerSession, filtreProjets } from "@/lib/auth";
import { analysesProjets } from "@/lib/donnees";
import { date, fcfa, pct } from "@/lib/format";
import { STATUTS_PROJET, TYPES_OUVRAGE } from "@/lib/labels";
import { Jauge, Pastille, StatCard, Vide, classeBoutonPrimaire, surface, tonStatut } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Projets" };

export default async function PageProjets() {
  const s = await exigerSession();
  const projets = await prisma.projet.findMany({
    where: filtreProjets(s),
    include: { client: true, chef: true },
    orderBy: { creeLe: "desc" },
  });
  const parProjet = await analysesProjets(projets.map((p) => p.id), s);
  const analyses = projets.map((p) => parProjet.get(p.id)!);
  const total = (f: (a: (typeof analyses)[number]) => number) => analyses.reduce((t, a) => t + f(a), 0);
  const enAttente = total((a) => a.nbEnAttente);
  const critiques = total((a) => a.alertes.filter((x) => x.niveau === "critique").length);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{s.role === "CLIENT" ? "Mes projets" : "Projets de construction"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {projets.length} projet{projets.length > 1 ? "s" : ""} · budgets, dépenses et avancement à jour
          </p>
        </div>
        {s.role === "INGENIEUR" && (
          <Link href="/projets/nouveau" className={cn("inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold", classeBoutonPrimaire)}>
            <Plus className="h-4 w-4" /> Nouveau projet
          </Link>
        )}
      </div>

      {projets.length > 0 && s.role !== "CLIENT" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard titre="Budgets révisés cumulés" valeur={fcfa(total((a) => a.budgetRevise))} icone={Wallet} sousTitre={`${projets.length} projets`} />
          <StatCard titre="Dépenses validées" valeur={fcfa(total((a) => a.reel))} icone={Receipt} ton="bleu" sousTitre={pct((total((a) => a.reel) / (total((a) => a.budgetRevise) || NaN)) * 100) + " des budgets"} />
          <StatCard titre="En attente de validation" valeur={String(enAttente)} icone={Clock3} ton="ambre" sousTitre={fcfa(total((a) => a.enAttente))} />
          <StatCard titre="Alertes critiques" valeur={String(critiques)} icone={AlertTriangle} ton={critiques ? "rouge" : "vert"} sousTitre="tous projets confondus" />
        </div>
      )}

      {projets.length === 0 ? (
        <Vide icone={Building2} titre="Aucun projet pour l'instant">
          {s.role === "INGENIEUR" ? "Créez votre premier projet : informations générales, lots de travaux, puis budget prévisionnel." : "L'ingénieure ne vous a encore rattaché à aucun projet."}
        </Vide>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projets.map((p, i) => {
            const a = analyses[i];
            const alertes = a.alertes.filter((x) => x.niveau !== "info").length;
            return (
              <Link key={p.id} href={`/projets/${p.id}`} className={cn(surface, "group flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-pink-500/5")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{p.code}</p>
                    <h2 className="mt-0.5 truncate text-lg font-bold group-hover:text-primary">{p.nom}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {p.localisation} · {TYPES_OUVRAGE[p.type]}
                    </p>
                  </div>
                  <Pastille ton={tonStatut(p.statut)}>{STATUTS_PROJET[p.statut]}</Pastille>
                </div>

                <div className="mt-5 space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">Budget consommé</span>
                      <span className="font-semibold tabular-nums">{pct(a.consommation)}</span>
                    </div>
                    <Jauge valeur={a.consommation} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">Travaux réalisés</span>
                      <span className="font-semibold tabular-nums">{pct(a.valeurAcquise.avancement)}</span>
                    </div>
                    <Jauge valeur={a.valeurAcquise.avancement} ton="bleu" />
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Dépensé</dt>
                    <dd className="font-semibold tabular-nums">{fcfa(a.reel)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Budget révisé</dt>
                    <dd className="font-semibold tabular-nums">{fcfa(a.budgetRevise)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Fin prévue</dt>
                    <dd className="font-medium">{date(p.dateFinPrevue)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{s.role === "CLIENT" ? "Chef de chantier" : "Client"}</dt>
                    <dd className="truncate font-medium">
                      {s.role === "CLIENT" ? (p.chef ? `${p.chef.prenom} ${p.chef.nom}` : "—") : `${p.client.prenom} ${p.client.nom}`}
                    </dd>
                  </div>
                </dl>
                {(alertes > 0 || a.nbEnAttente > 0) && s.role !== "CLIENT" && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {alertes > 0 && <Pastille ton="rouge">{alertes} alerte{alertes > 1 ? "s" : ""}</Pastille>}
                    {a.nbEnAttente > 0 && <Pastille ton="orange">{a.nbEnAttente} en attente</Pastille>}
                  </div>
                )}
                {s.role === "CLIENT" && (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CircleDollarSign className="h-3.5 w-3.5 text-primary" /> Versé : {fcfa(a.versementsRecus)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
