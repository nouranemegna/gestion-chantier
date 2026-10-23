import { FileSpreadsheet } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerSession } from "@/lib/auth";
import { analysesProjets } from "@/lib/donnees";
import { fcfa, nombre, pct } from "@/lib/format";
import { CATEGORIES, COULEUR_CATEGORIE, LISTE_CATEGORIES, STATUTS_PROJET, TYPES_OUVRAGE } from "@/lib/labels";
import { coefficientVariation, ecartType, moyenne } from "@/lib/stats";
import { Barres, BarresDoubles, Mensuel } from "@/components/app/Graphiques";
import { Mesure, Note, Section, Tableau, Vide } from "@/components/app/ui";
import { GitCompare } from "lucide-react";

export const metadata = { title: "Comparaison des projets" };

const court = (n: string) => (n.length > 16 ? `${n.slice(0, 15)}…` : n);

export default async function Comparaison() {
  const s = await exigerSession(["INGENIEUR"]);
  const projets = await prisma.projet.findMany({ orderBy: { dateDebut: "asc" } });
  const analyses = await analysesProjets(projets.map((p) => p.id), s);
  const lignes = projets.map((p) => ({ p, a: analyses.get(p.id)! }));
  if (lignes.length < 1) return <Vide icone={GitCompare} titre="Aucun projet à comparer" />;

  // Coût au m² « de référence » : le réel pour un projet terminé, sinon l'estimation à l'achèvement.
  const reference = lignes.map(({ p, a }) => ({ nom: p.nom, valeur: p.statut === "TERMINE" ? a.coutM2.reel : (a.coutM2.prevu ?? a.coutM2.budget) }));
  const valeurs = reference.map((r) => r.valeur).filter((v): v is number => v != null);
  const m = moyenne(valeurs);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Comparaison des projets</h1>
          <p className="mt-1 text-sm text-muted-foreground">Budgets, dépenses et coût au m² de tous les chantiers, côte à côte.</p>
        </div>
        <a href="/comparaison/export" className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:border-primary/40 hover:text-primary">
          <FileSpreadsheet className="h-4 w-4" /> Excel (tous les projets)
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Mesure nom="Projets" valeur={String(lignes.length)} />
        <Mesure nom="Coût moyen au m²" valeur={valeurs.length ? fcfa(m) : "—"} />
        <Mesure nom="Écart-type du coût au m²" valeur={valeurs.length > 1 ? fcfa(ecartType(valeurs)) : "—"} />
        <Mesure nom="Coefficient de variation" valeur={valeurs.length > 1 ? pct(coefficientVariation(valeurs)) : "—"} />
      </div>

      <Section titre="Tableau comparatif">
        <Tableau entetes={["Projet", "Type · surface", "Statut", "Budget révisé", "Dépensé", "Consommé", "Réalisé", "CPI", "Coût final estimé", "Coût/m² réel", "Coût/m² estimé"]} droite={[3, 4, 5, 6, 7, 8, 9, 10]}>
          {lignes.map(({ p, a }) => (
            <tr key={p.id}>
              <td className="font-medium">
                {p.nom}
                <span className="block text-xs text-muted-foreground">{p.code}</span>
              </td>
              <td className="text-muted-foreground">
                {TYPES_OUVRAGE[p.type]}
                <span className="block text-xs">{nombre(p.surface, 0)} m²</span>
              </td>
              <td className="whitespace-nowrap text-xs">{STATUTS_PROJET[p.statut]}</td>
              <td className="text-right tabular-nums">{fcfa(a.budgetRevise)}</td>
              <td className="text-right tabular-nums">{fcfa(a.reel)}</td>
              <td className="text-right tabular-nums">{pct(a.consommation)}</td>
              <td className="text-right tabular-nums">{pct(a.valeurAcquise.avancement)}</td>
              <td className="text-right tabular-nums">{a.valeurAcquise.cpi == null ? "—" : nombre(a.valeurAcquise.cpi, 2)}</td>
              <td className="text-right tabular-nums">{a.valeurAcquise.eac == null ? "—" : fcfa(a.valeurAcquise.eac)}</td>
              <td className="text-right tabular-nums">{a.coutM2.reel == null ? "—" : fcfa(a.coutM2.reel)}</td>
              <td className="text-right tabular-nums">{a.coutM2.prevu == null ? "—" : fcfa(a.coutM2.prevu)}</td>
            </tr>
          ))}
        </Tableau>
        <Note>CPI : indice de performance des coûts (valeur acquise / coût réel). Coût final estimé = budget révisé / CPI.</Note>
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section titre="Coût au m² de référence" description="Réel pour un projet terminé ; estimé à l'achèvement pour un projet en cours. La ligne pointillée marque la moyenne.">
          <Barres
            data={reference.map((r) => ({ nom: court(r.nom), valeur: r.valeur ?? 0 }))}
            x="nom"
            y="valeur"
            nom="Coût au m²"
            reference={valeurs.length ? { valeur: m, libelle: "Moyenne" } : undefined}
          />
        </Section>
        <Section titre="Budget consommé et travaux réalisés" description="Un projet dont la barre rose dépasse nettement la bleue dépense plus vite qu'il n'avance.">
          <BarresDoubles
            data={lignes.map(({ p, a }) => ({ nom: court(p.nom), consomme: a.consommation ?? 0, realise: a.valeurAcquise.avancement ?? 0 }))}
            series={[
              { cle: "consomme", nom: "% du budget consommé" },
              { cle: "realise", nom: "% des travaux réalisés" },
            ]}
          />
        </Section>
      </div>

      <Section titre="Structure des coûts par projet" description="Dépenses validées de chaque projet, réparties par catégorie.">
        <Mensuel
          data={lignes.map(({ p, a }) => ({ mois: court(p.nom), ...Object.fromEntries(a.parCategorie.map((c) => [c.categorie, c.reel])) }))}
          categories={LISTE_CATEGORIES.map((c) => ({ cle: c, nom: CATEGORIES[c], couleur: COULEUR_CATEGORIE[c] }))}
        />
        <Tableau entetes={["Projet", ...LISTE_CATEGORIES.map((c) => CATEGORIES[c])]} droite={[1, 2, 3, 4, 5]}>
          {lignes.map(({ p, a }) => (
            <tr key={p.id}>
              <td className="font-medium">{p.nom}</td>
              {a.parCategorie.map((c) => (
                <td key={c.categorie} className="text-right tabular-nums">
                  {pct(c.part)}
                </td>
              ))}
            </tr>
          ))}
        </Tableau>
        <Note>Parts en % des dépenses validées de chaque projet.</Note>
      </Section>
    </div>
  );
}
