import Link from "next/link";
import { AlertTriangle, Filter, Paperclip, Plus } from "lucide-react";
import type { Categorie, Prisma, Statut } from "@prisma/client";
import { prisma } from "@/lib/db";
import { exigerProjet } from "@/lib/auth";
import { analyseProjet } from "@/lib/donnees";
import { date, fcfa, nombre } from "@/lib/format";
import { CATEGORIES, LISTE_CATEGORIES, STATUTS } from "@/lib/labels";
import { libelleMois } from "@/lib/series";
import { deciderDepense } from "@/app/actions/operations";
import { BoutonAction } from "@/components/app/Formulaire";
import { Bouton, Mesure, Pastille, Section, Tableau, classeBoutonPrimaire, classeChamp, tonStatut } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dépenses" };

type Filtres = { categorie?: string; lot?: string; statut?: string; mois?: string; q?: string };

export default async function Depenses({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Filtres> }) {
  const { s, projet: p } = await exigerProjet(Number((await params).id));
  const f = await searchParams;
  const client = s.role === "CLIENT";
  const ingenieure = s.role === "INGENIEUR";

  const where: Prisma.DepenseWhereInput = { projetId: p.id };
  if (client) where.statut = "VALIDEE";
  else if (f.statut && f.statut in STATUTS) where.statut = f.statut as Statut;
  if (f.categorie && (LISTE_CATEGORIES as string[]).includes(f.categorie)) where.categorie = f.categorie as Categorie;
  if (f.lot && Number(f.lot)) where.lotId = Number(f.lot);
  if (f.mois && /^\d{4}-\d{2}$/.test(f.mois)) {
    const [a, m] = f.mois.split("-").map(Number);
    where.date = { gte: new Date(Date.UTC(a, m - 1, 1)), lt: new Date(Date.UTC(a, m, 1)) };
  }
  if (f.q) where.OR = [{ libelle: { contains: f.q, mode: "insensitive" } }, { reference: { contains: f.q, mode: "insensitive" } }];

  const [depenses, lots, { analyse }] = await Promise.all([
    prisma.depense.findMany({
      where,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: { lot: true, fournisseur: true, auteur: true },
      take: 500,
    }),
    prisma.lot.findMany({ where: { projetId: p.id }, orderBy: { ordre: "asc" } }),
    analyseProjet(p.id, s),
  ]);
  const anomalies = new Map(analyse.anomalies.map((x) => [x.depenseId, x]));
  const total = (st: Statut) => depenses.filter((d) => d.statut === st).reduce((t, d) => t + d.montant, 0);
  const mois = analyse.mensuel.map((m) => m.mois).reverse();
  const filtre = Object.values(f).some(Boolean);

  return (
    <div className="space-y-5">
      <Section
        titre="Dépenses du chantier"
        description={
          client
            ? "Dépenses validées par l'ingénieure. Chaque montant est calculé à partir de la quantité et du prix unitaire."
            : "Montant = quantité × prix unitaire, calculé automatiquement. Les saisies du chef de chantier attendent la validation de l'ingénieure."
        }
        actions={
          !client && p.statut !== "TERMINE" ? (
            <Link href={`/projets/${p.id}/depenses/nouvelle`} className={cn("hidden h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold md:inline-flex", classeBoutonPrimaire)}>
              <Plus className="h-4 w-4" /> Nouvelle dépense
            </Link>
          ) : null
        }
      >
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input name="q" defaultValue={f.q} placeholder="Libellé ou n° de reçu" className={cn(classeChamp, "lg:col-span-2")} />
          <select name="categorie" defaultValue={f.categorie ?? ""} className={classeChamp}>
            <option value="">Toutes catégories</option>
            {LISTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c]}
              </option>
            ))}
          </select>
          <select name="lot" defaultValue={f.lot ?? ""} className={classeChamp}>
            <option value="">Tous les lots</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
          <select name="mois" defaultValue={f.mois ?? ""} className={classeChamp}>
            <option value="">Toute la période</option>
            {mois.map((m) => (
              <option key={m} value={m}>
                {libelleMois(m)}
              </option>
            ))}
          </select>
          {!client ? (
            <select name="statut" defaultValue={f.statut ?? ""} className={classeChamp}>
              <option value="">Tous statuts</option>
              {Object.entries(STATUTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          ) : (
            <span />
          )}
          <div className="flex gap-2 lg:col-span-6">
            <Bouton variante="secondaire" type="submit">
              <Filter className="h-4 w-4" /> Filtrer
            </Bouton>
            {filtre && (
              <Link href={`/projets/${p.id}/depenses`} className="inline-flex h-10 items-center px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                Effacer les filtres
              </Link>
            )}
          </div>
        </form>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Mesure nom="Lignes affichées" valeur={`${depenses.length}${depenses.length === 500 ? " (500 au plus)" : ""}`} />
          <Mesure nom="Total validé" valeur={fcfa(total("VALIDEE"))} />
          {!client && <Mesure nom="Total en attente" valeur={fcfa(total("EN_ATTENTE"))} />}
          {!client && <Mesure nom="Rejeté ou annulé" valeur={fcfa(total("REJETEE") + total("ANNULEE"))} />}
        </div>
      </Section>

      <Section>
        <Tableau
          entetes={["Date", "Libellé", "Lot · catégorie", "Quantité × prix", "Montant", "Statut", ...(client ? [] : ["Saisie par", ""])]}
          droite={[3, 4]}
          vide={!depenses.length}
        >
          {depenses.map((d) => {
            const anomalie = anomalies.get(d.id);
            const barre = d.statut === "ANNULEE" || d.statut === "REJETEE";
            return (
              <tr key={d.id} className={cn(barre && "opacity-60")}>
                <td className="whitespace-nowrap">{date(d.date)}</td>
                <td className="min-w-48">
                  <Link href={`/projets/${p.id}/depenses/${d.id}`} className="font-medium hover:text-primary">
                    {d.libelle}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {d.fournisseur && <span>{d.fournisseur.nom}</span>}
                    {(d.reference || d.fichierCle) && (
                      <span className="inline-flex items-center gap-0.5" title="Justificatif">
                        <Paperclip className="h-3 w-3" /> {d.reference ?? "photo"}
                      </span>
                    )}
                  </span>
                  {anomalie && !client && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> Prix inhabituel (z = {nombre(anomalie.z, 1)}, moyenne {fcfa(anomalie.moyenne)})
                    </span>
                  )}
                  {d.motif && <span className="mt-1 block text-xs text-muted-foreground">Motif : {d.motif}</span>}
                </td>
                <td className="text-muted-foreground">
                  {d.lot.nom}
                  <span className="block text-xs">{CATEGORIES[d.categorie]}</span>
                </td>
                <td className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                  {nombre(d.quantite)} {d.unite} × {nombre(d.prixUnitaire, 0)}
                </td>
                <td className={cn("whitespace-nowrap text-right font-semibold tabular-nums", barre && "line-through")}>{fcfa(d.montant)}</td>
                <td>
                  <Pastille ton={tonStatut(d.statut)}>{STATUTS[d.statut]}</Pastille>
                </td>
                {!client && (
                  <>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">
                      {d.auteur.prenom} {d.auteur.nom}
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {ingenieure && d.statut === "EN_ATTENTE" && (
                          <>
                            <BoutonAction action={deciderDepense} champs={{ projetId: p.id, id: d.id, decision: "VALIDER" }} variante="primaire">
                              Valider
                            </BoutonAction>
                            <BoutonAction action={deciderDepense} champs={{ projetId: p.id, id: d.id, decision: "REJETER" }} variante="danger" motif="Motif du rejet :">
                              Rejeter
                            </BoutonAction>
                          </>
                        )}
                        {ingenieure && d.statut === "VALIDEE" && (
                          <BoutonAction action={deciderDepense} champs={{ projetId: p.id, id: d.id, decision: "ANNULER" }} motif="Motif de l'annulation (la dépense restera visible, barrée) :">
                            Annuler
                          </BoutonAction>
                        )}
                        {s.role === "CHEF_CHANTIER" && d.statut === "EN_ATTENTE" && d.auteurId === s.id && (
                          <BoutonAction action={deciderDepense} champs={{ projetId: p.id, id: d.id, decision: "ANNULER" }} motif="Pourquoi retirer cette saisie ?">
                            Retirer
                          </BoutonAction>
                        )}
                      </div>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </Tableau>
      </Section>
    </div>
  );
}
