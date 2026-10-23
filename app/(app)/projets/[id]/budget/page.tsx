import { prisma } from "@/lib/db";
import { exigerProjet } from "@/lib/auth";
import { analyseProjet } from "@/lib/donnees";
import { aujourdhui, cleJour, date, fcfa, pct } from "@/lib/format";
import { CATEGORIES, LISTE_CATEGORIES } from "@/lib/labels";
import { ajouterLot, creerAvenant, enregistrerBudget } from "@/app/actions/projets";
import { Formulaire } from "@/components/app/Formulaire";
import { PrevuReel } from "@/components/app/Graphiques";
import { Champ, Choix, Jauge, Mesure, Note, Section, Tableau } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Budget" };

export default async function Budget({ params }: { params: Promise<{ id: string }> }) {
  const { s, projet: p } = await exigerProjet(Number((await params).id));
  const { analyse: a } = await analyseProjet(p.id, s);
  const ingenieure = s.role === "INGENIEUR";
  const enPreparation = p.statut === "PREPARATION";
  const [lots, avenants] = await Promise.all([
    prisma.lot.findMany({ where: { projetId: p.id }, orderBy: { ordre: "asc" } }),
    prisma.avenant.findMany({ where: { projetId: p.id }, orderBy: { date: "desc" }, include: { ligne: { include: { lot: true } }, auteur: true } }),
  ]);
  const cellule = (lotId: number, c: string) => a.matrice.find((m) => m.lotId === lotId && m.categorie === c);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Mesure nom="Budget initial" valeur={fcfa(a.budgetInitial)} />
        <Mesure nom="Avenants" valeur={`${a.totalAvenants > 0 ? "+" : ""}${fcfa(a.totalAvenants)}`} />
        <Mesure nom="Budget révisé" valeur={fcfa(a.budgetRevise)} />
        <Mesure nom="Dépensé (validé)" valeur={`${fcfa(a.reel)} · ${pct(a.consommation)}`} />
        <Mesure nom="Coût au m² (budget révisé)" valeur={a.coutM2.budget == null ? "—" : fcfa(a.coutM2.budget)} />
      </div>

      {ingenieure && enPreparation ? (
        <Section
          titre="Budget prévisionnel ventilé"
          description="Saisissez le montant prévu pour chaque lot et chaque catégorie (0 ou vide si sans objet). Le budget reste modifiable tant que le projet est « en préparation » ; ensuite il est figé et se révise par avenants motivés."
        >
          <Formulaire action={enregistrerBudget} cache={{ projetId: p.id }} garder nu bouton="Enregistrer le budget">
            <div className="-mx-2 overflow-x-auto sm:col-span-2 lg:col-span-3">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Lot</th>
                    {LISTE_CATEGORIES.map((c) => (
                      <th key={c} className="px-2 py-2 text-right font-medium">
                        {CATEGORIES[c]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lots.map((l) => (
                    <tr key={l.id} className="border-b border-border/60">
                      <td className="px-2 py-1.5 font-medium">{l.nom}</td>
                      {LISTE_CATEGORIES.map((c) => (
                        <td key={c} className="px-1 py-1.5">
                          <input
                            name={`b_${l.id}_${c}`}
                            inputMode="numeric"
                            defaultValue={cellule(l.id, c)?.initial || ""}
                            placeholder="0"
                            aria-label={`${l.nom}, ${CATEGORIES[c]}`}
                            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Formulaire>
          <Note>Quand le budget est prêt, passez le projet « en cours » dans l&apos;onglet Paramètres.</Note>
        </Section>
      ) : (
        <Section titre="Budget ventilé par lot et par catégorie" description="Dans chaque case : dépensé / budget révisé. Une case rouge signale un dépassement.">
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2.5 font-medium">Lot</th>
                  {LISTE_CATEGORIES.map((c) => (
                    <th key={c} className="px-2 py-2.5 text-right font-medium">
                      {CATEGORIES[c]}
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-right font-medium">Total lot</th>
                  <th className="px-2 py-2.5 font-medium">Consommé</th>
                </tr>
              </thead>
              <tbody>
                {a.parLot.map((l) => (
                  <tr key={l.lotId} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="px-2 py-2.5 font-medium">{l.nom}</td>
                    {LISTE_CATEGORIES.map((c) => {
                      const m = cellule(l.lotId, c);
                      const depasse = m && m.reel > m.revise;
                      return (
                        <td key={c} className={cn("px-2 py-2.5 text-right tabular-nums", depasse && "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300")}>
                          {m ? (
                            <>
                              <span className="font-medium">{fcfa(m.reel).replace(" FCFA", "")}</span>
                              <span className="block text-xs text-muted-foreground">/ {fcfa(m.revise).replace(" FCFA", "")}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      <span className="font-semibold">{fcfa(l.reel)}</span>
                      <span className="block text-xs text-muted-foreground">/ {fcfa(l.revise)}</span>
                    </td>
                    <td className="w-36 px-2 py-2.5">
                      <span className="text-xs tabular-nums">{pct(l.consommation)}</span>
                      <Jauge valeur={l.consommation} className="mt-1" />
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="px-2 py-2.5">Total</td>
                  {a.parCategorie.map((c) => (
                    <td key={c.categorie} className={cn("px-2 py-2.5 text-right tabular-nums", c.ecart > 0 && c.revise > 0 && "text-red-600 dark:text-red-400")}>
                      {fcfa(c.reel).replace(" FCFA", "")}
                      <span className="block text-xs font-normal text-muted-foreground">/ {fcfa(c.revise).replace(" FCFA", "")}</span>
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {fcfa(a.reel)}
                    <span className="block text-xs font-normal text-muted-foreground">/ {fcfa(a.budgetRevise)}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <span className="text-xs tabular-nums">{pct(a.consommation)}</span>
                    <Jauge valeur={a.consommation} className="mt-1" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <Note>Montants en FCFA. Seules les dépenses validées comptent dans le dépensé.</Note>
        </Section>
      )}

      <Section titre="Budget révisé et dépensé par lot">
        <PrevuReel data={a.parLot.map((l) => ({ nom: l.nom, prevu: l.revise, reel: l.reel }))} />
      </Section>

      {ingenieure && !enPreparation && (
        <Formulaire
          action={creerAvenant}
          cache={{ projetId: p.id }}
          titre="Nouvel avenant"
          description="Révision du budget d'une ligne (lot × catégorie), à la hausse ou à la baisse. Le budget initial n'est jamais modifié : l'écart initial / révisé reste mesurable."
        >
          <Choix label="Lot" name="lotId" options={lots.map((l) => [l.id, l.nom])} />
          <Choix label="Catégorie" name="categorie" options={Object.entries(CATEGORIES)} />
          <Choix label="Sens" name="sens" options={[["HAUSSE", "Hausse du budget"], ["BAISSE", "Baisse du budget"]]} defaut="HAUSSE" />
          <Champ label="Montant (FCFA)" name="montant" inputMode="numeric" />
          <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
          <Champ label="Motif" name="motif" placeholder="Hausse du prix du fer, ajout d'une terrasse…" />
        </Formulaire>
      )}

      <Section titre="Avenants" description="Historique des révisions du budget.">
        <Tableau entetes={["Date", "Ligne", "Montant", "Motif", "Par"]} droite={[2]} vide={!avenants.length}>
          {avenants.map((v) => (
            <tr key={v.id}>
              <td className="whitespace-nowrap">{date(v.date)}</td>
              <td>
                {v.ligne.lot.nom}
                <span className="block text-xs text-muted-foreground">{CATEGORIES[v.ligne.categorie]}</span>
              </td>
              <td className={cn("whitespace-nowrap text-right font-semibold tabular-nums", v.montant > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                {v.montant > 0 ? "+" : "−"}
                {fcfa(Math.abs(v.montant))}
              </td>
              <td>{v.motif}</td>
              <td className="whitespace-nowrap text-xs text-muted-foreground">
                {v.auteur.prenom} {v.auteur.nom}
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>

      {ingenieure && p.statut !== "TERMINE" && (
        <Formulaire action={ajouterLot} cache={{ projetId: p.id }} titre="Ajouter un lot de travaux" colonnes={2}>
          <Champ label="Nom du lot" name="nom" placeholder="Clôture et portail" />
        </Formulaire>
      )}
    </div>
  );
}
