import Link from "next/link";
import { ArrowRight, Gauge, HandCoins, PiggyBank, Receipt, TrendingUp, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerProjet } from "@/lib/auth";
import { analyseProjet } from "@/lib/donnees";
import { date, fcfa, nombre, pct } from "@/lib/format";
import { CATEGORIES } from "@/lib/labels";
import { anneauCategories, pointsCourbe } from "@/lib/series";
import { Alertes } from "@/components/app/Alertes";
import { Anneau, CourbeCumul, PrevuReel } from "@/components/app/Graphiques";
import { Jauge, Note, Pastille, Section, StatCard, Tableau, tonStatut } from "@/components/app/ui";
import { STATUTS } from "@/lib/labels";

export default async function TableauDeBord({ params }: { params: Promise<{ id: string }> }) {
  const { s, projet: p } = await exigerProjet(Number((await params).id));
  const { analyse: a } = await analyseProjet(p.id, s);
  const va = a.valeurAcquise;
  const dernieres = await prisma.depense.findMany({
    where: { projetId: p.id, ...(s.role === "CLIENT" ? { statut: "VALIDEE" } : {}) },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 6,
    include: { lot: true },
  });
  const client = s.role === "CLIENT";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          titre="Budget révisé"
          valeur={fcfa(a.budgetRevise)}
          icone={Wallet}
          sousTitre={a.totalAvenants ? `Initial ${fcfa(a.budgetInitial)} · avenants ${a.totalAvenants > 0 ? "+" : ""}${fcfa(a.totalAvenants)}` : "Aucun avenant"}
        />
        <StatCard
          titre="Dépensé (validé)"
          valeur={fcfa(a.reel)}
          icone={Receipt}
          ton={a.consommation != null && a.consommation >= 100 ? "rouge" : a.consommation != null && a.consommation >= 80 ? "ambre" : "bleu"}
          sousTitre={
            <span className="block space-y-1.5">
              <span>{pct(a.consommation)} du budget{!client && a.enAttente > 0 ? ` · ${fcfa(a.enAttente)} en attente` : ""}</span>
              <Jauge valeur={a.consommation} />
            </span>
          }
        />
        <StatCard titre="Budget restant" valeur={fcfa(a.reste)} icone={PiggyBank} ton={a.reste < 0 ? "rouge" : "vert"} sousTitre={a.reste < 0 ? "Dépassement" : "Budget révisé − dépensé"} />
        <StatCard
          titre="Travaux réalisés"
          valeur={pct(va.avancement)}
          icone={Gauge}
          ton="bleu"
          sousTitre={
            <span className="block space-y-1.5">
              <span>{pct(va.tempsEcoule)} du délai écoulé</span>
              <Jauge valeur={va.avancement} ton="bleu" />
            </span>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          titre="Coût final estimé"
          valeur={va.eac == null ? "non calculable" : fcfa(va.eac)}
          icone={TrendingUp}
          ton={va.vac != null && va.vac < 0 ? "rouge" : "vert"}
          sousTitre={va.cpi == null ? "Il faut des dépenses et un avancement validés" : `Indice de performance des coûts (CPI) : ${nombre(va.cpi, 2)}${va.vac != null ? ` · écart ${fcfa(va.vac)}` : ""}`}
        />
        <StatCard
          titre={client ? "Mes versements reçus" : "Versements du client"}
          valeur={fcfa(a.versementsRecus)}
          icone={HandCoins}
          sousTitre={a.versementsEnAttente ? `${fcfa(a.versementsEnAttente)} à confirmer` : "Tous confirmés"}
        />
        <StatCard
          titre="Trésorerie du chantier"
          valeur={fcfa(a.tresorerie)}
          icone={PiggyBank}
          ton={a.tresorerie < 0 ? "rouge" : "vert"}
          sousTitre="Versements reçus − dépenses validées"
          className="sm:col-span-2 xl:col-span-1"
        />
      </div>

      {a.alertes.length > 0 && !client && <Alertes alertes={a.alertes} />}

      <div className="grid gap-5 lg:grid-cols-5">
        <Section
          titre="Évolution du coût cumulé"
          description="Courbe en S des dépenses validées, avec la tendance prolongée jusqu'à la fin prévue (régression linéaire)."
          className="lg:col-span-3"
        >
          {a.cumul.length ? <CourbeCumul points={pointsCourbe(a, p.dateDebut)} budget={a.budgetRevise} /> : <p className="py-16 text-center text-sm text-muted-foreground">Aucune dépense validée pour l&apos;instant.</p>}
          {a.regression && (
            <Note>
              Au rythme observé, le coût cumulé atteindrait {fcfa(a.regression.coutFinal)} à la fin prévue (intervalle de prévision à 95 % : {fcfa(a.regression.bas)} à {fcfa(a.regression.haut)} ; R² = {nombre(a.regression.r2, 3)}, {a.regression.n} jours de dépense).
            </Note>
          )}
        </Section>
        <Section titre="Répartition par catégorie" description="Part de chaque poste dans les dépenses validées." className="lg:col-span-2">
          {a.reel > 0 ? <Anneau data={anneauCategories(a)} /> : <p className="py-16 text-center text-sm text-muted-foreground">Pas encore de dépense.</p>}
        </Section>
      </div>

      <Section titre="Budget et dépenses par catégorie" description="Budget révisé comparé au dépensé ; une barre rouge signale un poste dépassé.">
        <PrevuReel data={a.parCategorie.map((c) => ({ nom: CATEGORIES[c.categorie], prevu: c.revise, reel: c.reel }))} />
      </Section>

      <Section
        titre="Dernières dépenses"
        actions={
          <Link href={`/projets/${p.id}/depenses`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Toutes les dépenses <ArrowRight className="h-4 w-4" />
          </Link>
        }
      >
        <Tableau entetes={["Date", "Libellé", "Lot", "Catégorie", "Montant", "Statut"]} droite={[4]} vide={!dernieres.length}>
          {dernieres.map((d) => (
            <tr key={d.id}>
              <td className="whitespace-nowrap">{date(d.date)}</td>
              <td className="font-medium">
                <Link href={`/projets/${p.id}/depenses/${d.id}`} className="hover:text-primary">
                  {d.libelle}
                </Link>
              </td>
              <td className="text-muted-foreground">{d.lot.nom}</td>
              <td className="text-muted-foreground">{CATEGORIES[d.categorie]}</td>
              <td className="whitespace-nowrap text-right font-semibold tabular-nums">{fcfa(d.montant)}</td>
              <td>
                <Pastille ton={tonStatut(d.statut)}>{STATUTS[d.statut]}</Pastille>
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>
    </div>
  );
}
