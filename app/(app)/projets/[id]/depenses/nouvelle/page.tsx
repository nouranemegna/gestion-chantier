import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigerProjet } from "@/lib/auth";
import { chargerChoix } from "@/lib/choix";
import { aujourdhui, cleJour } from "@/lib/format";
import { stockageActif } from "@/lib/fichiers";
import { creerDepense } from "@/app/actions/operations";
import { FormulaireDepense } from "@/components/app/FormulaireDepense";

export const metadata = { title: "Nouvelle dépense" };

export default async function NouvelleDepense({ params }: { params: Promise<{ id: string }> }) {
  const { s, projet } = await exigerProjet(Number((await params).id), ["INGENIEUR", "CHEF_CHANTIER"]);
  const choix = await chargerChoix(projet.id);
  return (
    <div className="space-y-4">
      <Link href={`/projets/${projet.id}/depenses`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Dépenses
      </Link>
      <FormulaireDepense
        action={creerDepense}
        projetId={projet.id}
        choix={choix}
        valeurs={{ date: cleJour(aujourdhui()) }}
        stockage={stockageActif}
        titre="Nouvelle dépense"
        description={
          s.role === "INGENIEUR"
            ? "Vos saisies sont validées d'office. Le montant est calculé automatiquement."
            : "Votre saisie sera validée par l'ingénieure. Le montant est calculé automatiquement."
        }
      />
    </div>
  );
}
