import { exigerProjet } from "@/lib/auth";
import { analyseProjet } from "@/lib/donnees";
import { SEUILS } from "@/lib/analyse";
import { date, fcfa, nombre, pct } from "@/lib/format";
import { CATEGORIES } from "@/lib/labels";
import { donneesMensuelles, pointsCourbe, seriesCategories, libelleMois } from "@/lib/series";
import { Barres, BoiteMoustaches, CourbeCumul, Mensuel, Pareto } from "@/components/app/Graphiques";
import { Mesure, Note, Pastille, Section, Tableau } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analyse" };

export default async function Analyse({ params }: { params: Promise<{ id: string }> }) {
  const { s, projet: p } = await exigerProjet(Number((await params).id), ["INGENIEUR", "CLIENT"]);
  const { analyse: a } = await analyseProjet(p.id, s);
  const d = a.descriptives;
  const va = a.valeurAcquise;
  const r = a.regression;
  const periode = a.mensuel.length ? `de ${libelleMois(a.mensuel[0].mois)} à ${libelleMois(a.mensuel[a.mensuel.length - 1].mois)}` : "aucune période";

  if (d.n === 0) {
    return (
      <Section titre="Analyse des dépenses">
        <p className="py-10 text-center text-sm text-muted-foreground">L&apos;analyse s&apos;affichera dès que des dépenses auront été validées.</p>
      </Section>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Répartition : où part l'argent ? */}
      <Section titre="1. Dépenses par catégorie" description="Budget révisé, dépensé, écart et part de chaque poste dans le coût total.">
        <Tableau entetes={["Catégorie", "Budget révisé", "Dépensé", "Écart", "Consommé", "Part du total"]} droite={[1, 2, 3, 4, 5]}>
          {a.parCategorie.map((c) => (
            <tr key={c.categorie}>
              <td className="font-medium">{CATEGORIES[c.categorie]}</td>
              <td className="text-right tabular-nums">{fcfa(c.revise)}</td>
              <td className="text-right tabular-nums">{fcfa(c.reel)}</td>
              <td className={cn("text-right tabular-nums", c.ecart > 0 && c.revise > 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                {c.ecart > 0 ? "+" : ""}
                {fcfa(c.ecart)}
              </td>
              <td className="text-right tabular-nums">{pct(c.consommation)}</td>
              <td className="text-right tabular-nums">{pct(c.part)}</td>
            </tr>
          ))}
        </Tableau>
        <Note>Écart = dépensé − budget révisé : positif, le poste dépasse son budget. Dépenses validées, {periode}, n = {d.n}.</Note>
      </Section>

      {/* 2. Évolution dans le temps */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Section titre="2. Dépenses par mois" description="Montant validé de chaque mois, empilé par catégorie.">
          <Mensuel data={donneesMensuelles(a)} categories={seriesCategories} />
        </Section>
        <Section titre="3. Prévision du coût final" description="Régression linéaire du coût cumulé sur le temps : y = a·t + b, t en jours depuis le début.">
          <CourbeCumul points={pointsCourbe(a, p.dateDebut)} budget={a.budgetRevise} hauteur={260} />
          {r ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <Mesure nom="Pente a (rythme de dépense)" valeur={`${fcfa(r.a)} / jour`} />
              <Mesure nom="Coefficient R²" valeur={nombre(r.r2, 3)} aide="Part de la variation du coût cumulé expliquée par le temps" />
              <Mesure nom={`Coût prévu au ${date(p.dateFinPrevue)}`} valeur={fcfa(r.coutFinal)} />
            </div>
          ) : (
            <Note>Il faut au moins 3 jours de dépenses validées sur un projet non terminé pour ajuster la droite.</Note>
          )}
          {r && <Note>Intervalle de prévision à 95 % : {fcfa(r.bas)} à {fcfa(r.haut)} (loi de Student à {r.n - 2} degrés de liberté). Hypothèse : rythme de dépense constant jusqu&apos;à la fin.</Note>}
        </Section>
      </div>

      {/* 4. Valeur acquise */}
      <Section
        titre="4. Valeur acquise : le coût de ce qui est réellement fait"
        description="On compare ce qu'ont coûté les travaux réalisés à ce qu'ils devaient coûter selon le budget. C'est la méthode de la valeur acquise (EVM)."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Mesure nom="Budget à l'achèvement (BAC)" valeur={fcfa(a.budgetRevise)} />
          <Mesure nom="Valeur acquise (EV)" valeur={fcfa(va.ev)} aide="Σ budget du lot × % réalisé" />
          <Mesure nom="Coût réel (AC)" valeur={fcfa(a.reel)} />
          <Mesure nom="CPI = EV / AC" valeur={va.cpi == null ? "non calculable" : nombre(va.cpi, 3)} />
          <Mesure nom="Coût estimé à l'achèvement (EAC = BAC / CPI)" valeur={va.eac == null ? "non calculable" : fcfa(va.eac)} />
          <Mesure nom="Écart à l'achèvement (VAC = BAC − EAC)" valeur={va.vac == null ? "non calculable" : fcfa(va.vac)} />
          <Mesure nom="Coût au m² réel / prévu" valeur={`${a.coutM2.reel == null ? "—" : fcfa(a.coutM2.reel)} / ${a.coutM2.budget == null ? "—" : fcfa(a.coutM2.budget)}`} />
          <Mesure nom="Coût au m² estimé à l'achèvement" valeur={a.coutM2.prevu == null ? "non calculable" : fcfa(a.coutM2.prevu)} />
        </div>
        <Note>
          CPI &lt; 1 : chaque franc dépensé produit moins d&apos;un franc de travaux prévus, le projet dérive vers un dépassement. CPI &gt; 1 : économie. Surface bâtie : {nombre(p.surface, 1)} m².
        </Note>
      </Section>

      {/* 5. Dispersion des montants */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Section titre="5. Statistique descriptive des montants" description="Montant de chaque dépense validée, en FCFA.">
          <div className="grid gap-2 sm:grid-cols-3">
            <Mesure nom="Effectif n" valeur={String(d.n)} />
            <Mesure nom="Total" valeur={fcfa(d.somme)} />
            <Mesure nom="Moyenne x̄" valeur={fcfa(d.moyenne)} />
            <Mesure nom="Médiane" valeur={fcfa(d.mediane)} />
            <Mesure nom="Écart-type σ" valeur={fcfa(d.ecartType)} />
            <Mesure nom="Coefficient de variation" valeur={pct(d.cv)} />
            <Mesure nom="Q1" valeur={fcfa(d.q1)} />
            <Mesure nom="Q3" valeur={fcfa(d.q3)} />
            <Mesure nom="Min / max" valeur={`${fcfa(d.min)} / ${fcfa(d.max)}`} />
          </div>
          {d.ic95 && (
            <Note>
              Intervalle de confiance à 95 % de la dépense moyenne : {fcfa(d.ic95.bas)} à {fcfa(d.ic95.haut)}. Moyenne nettement au-dessus de la médiane : quelques grosses dépenses tirent la moyenne vers le haut (distribution asymétrique).
            </Note>
          )}
        </Section>
        <Section titre="6. Boîte à moustaches et histogramme" description="Moustaches de Tukey (Q1 − 1,5·IQR ; Q3 + 1,5·IQR) ; les points rouges sont les dépenses atypiques.">
          {d.boite && <BoiteMoustaches boite={d.boite} />}
          <Barres
            data={d.histogramme.map((c) => ({ classe: `${Math.round(c.borneInf / 1000)}–${Math.round(c.borneSup / 1000)} k`, effectif: c.effectif }))}
            x="classe"
            y="effectif"
            nom="Nombre de dépenses"
            format="nombre"
            hauteur={220}
          />
          <Note>Classes d&apos;amplitude égale, nombre de classes par la règle de Sturges k = 1 + log₂(n) = {d.histogramme.length}.</Note>
        </Section>
      </div>

      {/* 7. Pareto */}
      <Section titre="7. Diagramme de Pareto des principaux postes de coût" description="Articles classés du plus coûteux au moins coûteux. Classe A : les articles qui font ensemble 80 % du coût, à surveiller en priorité.">
        <Pareto data={a.pareto.slice(0, 15).map((l) => ({ nom: l.nom.length > 22 ? `${l.nom.slice(0, 21)}…` : l.nom, part: l.part, partCumulee: l.partCumulee }))} />
        <Tableau entetes={["Rang", "Article ou libellé", "Montant", "Part", "Part cumulée", "Classe"]} droite={[2, 3, 4]}>
          {a.pareto.slice(0, 15).map((l, i) => (
            <tr key={l.nom}>
              <td className="tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="font-medium">{l.nom}</td>
              <td className="text-right tabular-nums">{fcfa(l.valeur)}</td>
              <td className="text-right tabular-nums">{pct(l.part)}</td>
              <td className="text-right tabular-nums">{pct(l.partCumulee)}</td>
              <td>
                <Pastille ton={l.classe === "A" ? "rouge" : l.classe === "B" ? "orange" : "gris"}>Classe {l.classe}</Pastille>
              </td>
            </tr>
          ))}
        </Tableau>
        <Note>
          {a.pareto.filter((l) => l.classe === "A").length} article(s) sur {a.pareto.length} représentent environ 80 % du coût total.
        </Note>
      </Section>

      {/* 8. Prix unitaires */}
      <Section
        titre="8. Prix unitaires par article"
        description={`Dispersion des prix payés pour un même article. Un prix est signalé inhabituel quand |z| > ${SEUILS.scoreZ}, z = (prix − moyenne) / écart-type, dès ${SEUILS.achatsMinPrix} achats validés.`}
      >
        <Tableau entetes={["Article", "Achats", "Prix moyen", "Min", "Max", "Écart-type", "CV", "1er → dernier"]} droite={[1, 2, 3, 4, 5, 6, 7]} vide={!a.prix.length}>
          {a.prix.map((x) => (
            <tr key={x.articleId}>
              <td className="font-medium">
                {x.article}
                <span className="block text-xs text-muted-foreground">par {x.unite}</span>
              </td>
              <td className="text-right tabular-nums">{x.n}</td>
              <td className="text-right tabular-nums">{fcfa(x.moyenne)}</td>
              <td className="text-right tabular-nums">{fcfa(x.min)}</td>
              <td className="text-right tabular-nums">{fcfa(x.max)}</td>
              <td className="text-right tabular-nums">{x.ecartType == null ? "—" : fcfa(x.ecartType)}</td>
              <td className={cn("text-right tabular-nums", x.cv != null && x.cv > 15 && "font-semibold text-amber-600 dark:text-amber-400")}>{x.cv == null ? "—" : pct(x.cv)}</td>
              <td className={cn("text-right tabular-nums", x.variation != null && x.variation > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                {x.variation == null ? "—" : `${x.variation > 0 ? "+" : ""}${pct(x.variation)}`}
              </td>
            </tr>
          ))}
        </Tableau>
        {a.anomalies.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="font-semibold">Prix inhabituels ({a.anomalies.length})</p>
            <ul className="mt-2 space-y-1">
              {a.anomalies.slice(0, 8).map((x) => (
                <li key={x.depenseId}>
                  {date(x.date)} · {x.libelle} : {fcfa(x.prixUnitaire)} pour une moyenne de {fcfa(x.moyenne)} (z = {nombre(x.z, 2)}){x.statut === "EN_ATTENTE" ? " — en attente de validation" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Note>CV = écart-type / moyenne : sous 15 %, prix stable ; au-delà, l&apos;article mérite une négociation ou un changement de fournisseur.</Note>
      </Section>

      {/* 9. Fournisseurs */}
      {a.parFournisseur.length > 0 && (
        <Section titre="9. Dépenses par fournisseur">
          <Barres data={a.parFournisseur.slice(0, 10).map((f) => ({ nom: f.nom, total: f.total }))} x="nom" y="total" nom="Montant validé" hauteur={260} />
          <Tableau entetes={["Fournisseur", "Achats", "Montant", "Part du total"]} droite={[1, 2, 3]}>
            {a.parFournisseur.map((f) => (
              <tr key={f.nom}>
                <td className="font-medium">{f.nom}</td>
                <td className="text-right tabular-nums">{f.n}</td>
                <td className="text-right tabular-nums">{fcfa(f.total)}</td>
                <td className="text-right tabular-nums">{pct(f.part)}</td>
              </tr>
            ))}
          </Tableau>
        </Section>
      )}

      <Section titre="Seuils des alertes">
        <ul className="grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          <li>Budget consommé : attention à {SEUILS.consommationAttention} %, critique à {SEUILS.consommationCritique} %.</li>
          <li>Poste ou lot dépassé : dépensé &gt; budget révisé de la ligne.</li>
          <li>Dépassement prévu : coût estimé à l&apos;achèvement (EAC) &gt; budget ; critique au-delà de 10 %.</li>
          <li>Dépenses plus rapides que les travaux : écart &gt; {SEUILS.ecartAvancement} points.</li>
          <li>Prix inhabituel : |z| &gt; {SEUILS.scoreZ}, à partir de {SEUILS.achatsMinPrix} achats validés de l&apos;article.</li>
          <li>Fonds insuffisants : dépenses validées &gt; versements reçus.</li>
          <li>Dépense en attente depuis plus de {SEUILS.joursAttente} jours.</li>
          <li>Justificatifs : plus de {SEUILS.partNonJustifiee} % du montant sans reçu ni photo.</li>
        </ul>
      </Section>
    </div>
  );
}
