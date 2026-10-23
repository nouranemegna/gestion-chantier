import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerProjet } from "@/lib/auth";
import { chargerChoix } from "@/lib/choix";
import { cleJour, date, dateHeure, fcfa, nombre } from "@/lib/format";
import { CATEGORIES, STATUTS } from "@/lib/labels";
import { stockageActif } from "@/lib/fichiers";
import { modifierDepense } from "@/app/actions/operations";
import { FormulaireDepense } from "@/components/app/FormulaireDepense";
import { Historique } from "@/components/app/Historique";
import { Mesure, Pastille, Section, tonStatut } from "@/components/app/ui";

export const metadata = { title: "Dépense" };

export default async function Depense({ params }: { params: Promise<{ id: string; depenseId: string }> }) {
  const { id, depenseId } = await params;
  const { s, projet: p } = await exigerProjet(Number(id));
  const d = await prisma.depense.findFirst({
    where: { id: Number(depenseId) || 0, projetId: p.id, ...(s.role === "CLIENT" ? { statut: "VALIDEE" } : {}) },
    include: { lot: true, article: true, fournisseur: true, auteur: true, decidePar: true },
  });
  if (!d) notFound();
  const modifiable = d.statut === "EN_ATTENTE" && (s.role === "INGENIEUR" || (s.role === "CHEF_CHANTIER" && d.auteurId === s.id));
  const [historique, choix] = await Promise.all([
    s.role === "CLIENT" ? [] : prisma.journal.findMany({ where: { entite: "Depense", entiteId: d.id }, orderBy: { date: "desc" }, include: { auteur: true } }),
    modifiable ? chargerChoix(p.id) : null,
  ]);

  return (
    <div className="space-y-5">
      <Link href={`/projets/${p.id}/depenses`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Dépenses
      </Link>
      <Section
        titre={d.libelle}
        description={`${d.lot.nom} · ${CATEGORIES[d.categorie]}${d.article ? ` · article « ${d.article.designation} »` : ""}`}
        actions={<Pastille ton={tonStatut(d.statut)}>{STATUTS[d.statut]}</Pastille>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Mesure nom="Quantité" valeur={`${nombre(d.quantite)} ${d.unite}`} />
          <Mesure nom="Prix unitaire" valeur={fcfa(d.prixUnitaire)} />
          <Mesure nom="Montant (calculé)" valeur={fcfa(d.montant)} />
          <Mesure nom="Date" valeur={date(d.date)} />
          <Mesure nom="Fournisseur" valeur={d.fournisseur?.nom ?? "—"} />
          <Mesure nom="N° de reçu" valeur={d.reference ?? "—"} />
          <Mesure nom="Saisie par" valeur={`${d.auteur.prenom} ${d.auteur.nom}, le ${dateHeure(d.creeLe)}`} />
          <Mesure nom="Décision" valeur={d.decidePar ? `${d.decidePar.prenom} ${d.decidePar.nom}, le ${dateHeure(d.decideLe!)}` : "En attente"} />
        </div>
        {d.motif && <p className="mt-4 rounded-xl bg-muted/60 px-3 py-2 text-sm">Motif : {d.motif}</p>}
        {d.observation && <p className="mt-3 text-sm text-muted-foreground">Observation : {d.observation}</p>}
        {d.fichierCle && (
          <a href={`/projets/${p.id}/fichier?cle=${encodeURIComponent(d.fichierCle)}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ImageIcon className="h-4 w-4" /> Voir la photo du reçu
          </a>
        )}
      </Section>

      {modifiable && choix && (
        <FormulaireDepense
          action={modifierDepense}
          projetId={p.id}
          choix={choix}
          stockage={stockageActif}
          bouton="Enregistrer les corrections"
          titre="Corriger la saisie"
          description="Possible tant que la dépense n'est pas validée. L'ancienne et la nouvelle valeur restent dans l'historique."
          valeurs={{
            id: d.id,
            lotId: d.lotId,
            categorie: d.categorie,
            articleId: d.articleId,
            libelle: d.libelle,
            quantite: d.quantite,
            unite: d.unite,
            prixUnitaire: d.prixUnitaire,
            date: cleJour(d.date),
            fournisseurId: d.fournisseurId,
            reference: d.reference,
            observation: d.observation,
          }}
        />
      )}

      {s.role !== "CLIENT" && (
        <Section titre="Historique" description="Toutes les opérations sur cette dépense, de la plus récente à la plus ancienne.">
          <Historique entrees={historique} />
        </Section>
      )}
    </div>
  );
}
