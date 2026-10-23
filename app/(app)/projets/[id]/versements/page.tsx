import { prisma } from "@/lib/db";
import { exigerProjet } from "@/lib/auth";
import { analyseProjet } from "@/lib/donnees";
import { aujourdhui, cleJour, date, fcfa, pct } from "@/lib/format";
import { MODES_PAIEMENT, STATUTS } from "@/lib/labels";
import { declarerVersement, deciderVersement } from "@/app/actions/operations";
import { BoutonAction, Formulaire } from "@/components/app/Formulaire";
import { Champ, Choix, Mesure, Note, Pastille, Section, Tableau, tonStatut } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Versements" };

export default async function Versements({ params }: { params: Promise<{ id: string }> }) {
  const { s, projet: p } = await exigerProjet(Number((await params).id), ["INGENIEUR", "CLIENT"]);
  const { analyse: a } = await analyseProjet(p.id, s);
  const versements = await prisma.versement.findMany({ where: { projetId: p.id }, orderBy: [{ date: "desc" }, { id: "desc" }], include: { auteur: true } });
  const ingenieure = s.role === "INGENIEUR";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Mesure nom="Versements reçus" valeur={fcfa(a.versementsRecus)} />
        <Mesure nom="À confirmer" valeur={fcfa(a.versementsEnAttente)} />
        <Mesure nom="Dépenses validées" valeur={fcfa(a.reel)} />
        <Mesure nom="Trésorerie (reçu − dépensé)" valeur={fcfa(a.tresorerie)} />
      </div>
      <Section titre="Financement du projet" description="Part du budget révisé déjà versée par le client.">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Versé / budget révisé</span>
            <span className="font-semibold tabular-nums">{pct(a.budgetRevise ? (a.versementsRecus / a.budgetRevise) * 100 : null)}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-pink-600" style={{ width: `${Math.min(100, a.budgetRevise ? (a.versementsRecus / a.budgetRevise) * 100 : 0)}%` }} />
          </div>
        </div>
        {a.tresorerie < 0 && <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">Les dépenses validées dépassent les fonds reçus de {fcfa(-a.tresorerie)} : un nouveau versement est nécessaire.</p>}
      </Section>

      {p.statut !== "TERMINE" && (
        <Formulaire
          action={declarerVersement}
          cache={{ projetId: p.id }}
          titre={ingenieure ? "Enregistrer un versement reçu" : "Déclarer un versement"}
          description={ingenieure ? "Versement du client dont vous avez constaté la réception." : "Indiquez le versement effectué ; l'ingénieure confirmera sa réception."}
        >
          <Champ label="Montant (FCFA)" name="montant" inputMode="numeric" />
          <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
          <Choix label="Mode de paiement" name="mode" options={Object.entries(MODES_PAIEMENT)} defaut="VIREMENT" />
          <Champ label="Référence de l'opération" name="reference" requis={false} />
        </Formulaire>
      )}

      <Section titre="Historique des versements">
        <Tableau entetes={["Date", "Montant", "Mode", "Référence", "Statut", "Déclaré par", ""]} droite={[1]} vide={!versements.length}>
          {versements.map((v) => (
            <tr key={v.id} className={cn(v.statut === "REJETEE" && "opacity-60")}>
              <td className="whitespace-nowrap">{date(v.date)}</td>
              <td className="whitespace-nowrap text-right font-semibold tabular-nums">{fcfa(v.montant)}</td>
              <td>{MODES_PAIEMENT[v.mode]}</td>
              <td className="text-muted-foreground">
                {v.reference ?? "—"}
                {v.motif && <span className="block text-xs">Motif : {v.motif}</span>}
              </td>
              <td>
                <Pastille ton={tonStatut(v.statut)}>{v.statut === "VALIDEE" ? "Reçu" : STATUTS[v.statut]}</Pastille>
              </td>
              <td className="whitespace-nowrap text-xs text-muted-foreground">
                {v.auteur.prenom} {v.auteur.nom}
              </td>
              <td>
                {ingenieure && v.statut === "EN_ATTENTE" && (
                  <div className="flex justify-end gap-1.5">
                    <BoutonAction action={deciderVersement} champs={{ projetId: p.id, id: v.id, decision: "VALIDER" }} variante="primaire">
                      Confirmer
                    </BoutonAction>
                    <BoutonAction action={deciderVersement} champs={{ projetId: p.id, id: v.id, decision: "REJETER" }} variante="danger" motif="Motif du rejet (ex. : fonds non reçus) :">
                      Rejeter
                    </BoutonAction>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
        <Note>Seuls les versements confirmés comptent dans la trésorerie.</Note>
      </Section>
    </div>
  );
}
