import { prisma } from "@/lib/db";
import { exigerProjet } from "@/lib/auth";
import { analyseProjet } from "@/lib/donnees";
import { aujourdhui, cleJour, date, fcfa, nombre, pct } from "@/lib/format";
import { STATUTS } from "@/lib/labels";
import { stockageActif } from "@/lib/fichiers";
import { declarerReleve, deciderReleve } from "@/app/actions/operations";
import { BoutonAction, Formulaire } from "@/components/app/Formulaire";
import { ChampPhoto } from "@/components/app/ChampPhoto";
import { BarresDoubles } from "@/components/app/Graphiques";
import { Champ, Choix, Jauge, Mesure, Note, Pastille, Section, Tableau, tonStatut } from "@/components/app/ui";

export const metadata = { title: "Avancement" };

export default async function Avancement({ params }: { params: Promise<{ id: string }> }) {
  const { s, projet: p } = await exigerProjet(Number((await params).id));
  const { analyse: a } = await analyseProjet(p.id, s);
  const client = s.role === "CLIENT";
  const releves = await prisma.releve.findMany({
    where: { projetId: p.id, ...(client ? { statut: "VALIDEE" } : {}) },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { lot: true, auteur: true },
    take: 200,
  });
  const photos = releves.filter((r) => r.photoCle && r.statut === "VALIDEE").slice(0, 12);
  const va = a.valeurAcquise;
  const lien = (cle: string) => `/projets/${p.id}/fichier?cle=${encodeURIComponent(cle)}`;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Mesure nom="Avancement global (pondéré par le budget)" valeur={pct(va.avancement)} />
        <Mesure nom="Délai écoulé" valeur={pct(va.tempsEcoule)} />
        <Mesure nom="Valeur des travaux réalisés" valeur={fcfa(va.ev)} aide="Valeur acquise : Σ budget du lot × % réalisé" />
        <Mesure nom="Budget consommé" valeur={pct(a.consommation)} />
      </div>

      <Section
        titre="Avancement par lot"
        description="Dernier pourcentage validé de chaque lot. L'avancement global pondère chaque lot par son budget : un lot cher compte plus qu'un lot bon marché."
      >
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {a.parLot.map((l) => (
            <div key={l.lotId}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{l.nom}</span>
                <span className="tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{nombre(l.avancement, 0)} %</span> réalisé · {pct(l.consommation)} du budget
                </span>
              </div>
              <Jauge valeur={l.avancement} ton="bleu" />
            </div>
          ))}
        </div>
      </Section>

      <Section titre="Travaux réalisés et budget consommé, par lot" description="Un lot dont la barre rose dépasse nettement la bleue coûte plus cher que prévu pour ce qui est fait.">
        <BarresDoubles
          data={a.parLot.map((l) => ({ nom: l.nom.length > 14 ? `${l.nom.slice(0, 13)}…` : l.nom, consomme: l.consommation ?? 0, realise: l.avancement }))}
          series={[
            { cle: "consomme", nom: "% du budget consommé" },
            { cle: "realise", nom: "% des travaux réalisés" },
          ]}
        />
      </Section>

      {photos.length > 0 && (
        <Section titre="Photos du chantier" description="Les plus récentes, jointes aux relevés validés.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {photos.map((r) => (
              <a key={r.id} href={lien(r.photoCle!)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lien(r.photoCle!)} alt={`${r.lot.nom}, ${date(r.date)}`} loading="lazy" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">
                  {r.lot.nom} · {date(r.date)}
                </span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {!client && p.statut !== "TERMINE" && (
        <Formulaire
          action={declarerReleve}
          cache={{ projetId: p.id }}
          titre="Nouveau relevé d'avancement"
          description={s.role === "INGENIEUR" ? "Pourcentage CUMULÉ réalisé du lot à cette date ; votre relevé est validé d'office." : "Pourcentage CUMULÉ réalisé du lot à cette date ; l'ingénieure le validera."}
        >
          <Choix label="Lot" name="lotId" options={a.parLot.map((l) => [l.lotId, `${l.nom} (actuellement ${nombre(l.avancement, 0)} %)`])} />
          <Champ label="Avancement (%)" name="pourcentage" type="number" min={0} max={100} step="any" />
          <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
          <Champ label="Commentaire" name="commentaire" requis={false} placeholder="Chaînage haut coulé, murs du R+1 montés…" />
          <ChampPhoto label="Photo du chantier" actif={stockageActif} />
        </Formulaire>
      )}

      <Section titre="Relevés" description={client ? "Relevés validés par l'ingénieure." : "Historique des relevés, du plus récent au plus ancien."}>
        <Tableau entetes={["Date", "Lot", "Avancement", "Commentaire", "Statut", ...(client ? [] : ["Par", ""])]} droite={[2]} vide={!releves.length}>
          {releves.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap">{date(r.date)}</td>
              <td className="font-medium">{r.lot.nom}</td>
              <td className="text-right font-semibold tabular-nums">{nombre(r.pourcentage, 1)} %</td>
              <td className="max-w-md text-muted-foreground">
                {r.commentaire ?? "—"}
                {r.photoCle && (
                  <a href={lien(r.photoCle)} target="_blank" rel="noreferrer" className="ml-2 text-xs font-semibold text-primary hover:underline">
                    photo
                  </a>
                )}
                {r.motif && <span className="block text-xs">Motif : {r.motif}</span>}
              </td>
              <td>
                <Pastille ton={tonStatut(r.statut)}>{STATUTS[r.statut]}</Pastille>
              </td>
              {!client && (
                <>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">
                    {r.auteur.prenom} {r.auteur.nom}
                  </td>
                  <td>
                    {s.role === "INGENIEUR" && r.statut === "EN_ATTENTE" && (
                      <div className="flex justify-end gap-1.5">
                        <BoutonAction action={deciderReleve} champs={{ projetId: p.id, id: r.id, decision: "VALIDER" }} variante="primaire">
                          Valider
                        </BoutonAction>
                        <BoutonAction action={deciderReleve} champs={{ projetId: p.id, id: r.id, decision: "REJETER" }} variante="danger" motif="Motif du rejet :">
                          Rejeter
                        </BoutonAction>
                      </div>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </Tableau>
        <Note>Valider un relevé fixe l&apos;avancement du lot à ce pourcentage ; c&apos;est cette valeur qui entre dans la valeur acquise et le coût final estimé.</Note>
      </Section>
    </div>
  );
}
