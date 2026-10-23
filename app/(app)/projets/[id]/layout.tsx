import { CalendarRange, FileDown, FileSpreadsheet, MapPin, Ruler } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerProjet } from "@/lib/auth";
import { date, nombre } from "@/lib/format";
import { STATUTS_PROJET, TYPES_OUVRAGE } from "@/lib/labels";
import { Onglets } from "@/components/app/Onglets";
import { BoutonDepense } from "@/components/app/BoutonDepense";
import { Pastille, tonStatut } from "@/components/app/ui";

export default async function LayoutProjet({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { s, projet: p } = await exigerProjet(Number((await params).id));
  const ingenieure = s.role === "INGENIEUR";
  const [depensesAttente, relevesAttente, versementsAttente] = ingenieure
    ? await Promise.all([
        prisma.depense.count({ where: { projetId: p.id, statut: "EN_ATTENTE" } }),
        prisma.releve.count({ where: { projetId: p.id, statut: "EN_ATTENTE" } }),
        prisma.versement.count({ where: { projetId: p.id, statut: "EN_ATTENTE" } }),
      ])
    : [0, 0, 0];

  // Les onglets suivent les droits de chaque rôle ; chaque page revérifie côté serveur.
  const onglets: [string, string, number?][] =
    s.role === "INGENIEUR"
      ? [["", "Tableau de bord"], ["depenses", "Dépenses", depensesAttente], ["budget", "Budget"], ["avancement", "Avancement", relevesAttente], ["versements", "Versements", versementsAttente], ["analyse", "Analyse"], ["journal", "Journal"], ["parametres", "Paramètres"]]
      : s.role === "CLIENT"
        ? [["", "Tableau de bord"], ["avancement", "Avancement"], ["depenses", "Dépenses"], ["budget", "Budget"], ["versements", "Mes versements"], ["analyse", "Analyse"]]
        : [["", "Tableau de bord"], ["depenses", "Dépenses"], ["avancement", "Avancement"], ["budget", "Budget"]];

  const lienExport = "inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:border-primary/40 hover:text-primary";
  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-20 md:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{p.nom}</h1>
            <Pastille ton={tonStatut(p.statut)}>{STATUTS_PROJET[p.statut]}</Pastille>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-semibold text-primary">{p.code}</span>
            <span>{TYPES_OUVRAGE[p.type]}</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {p.localisation}
            </span>
            <span className="flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" /> {nombre(p.surface, 1)} m² · R+{p.niveaux - 1}
            </span>
            <span className="flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" /> {date(p.dateDebut)} → {date(p.dateFinPrevue)}
            </span>
          </p>
          {p.statut === "SUSPENDU" && p.motifStatut && <p className="mt-1 text-sm text-amber-600">Suspendu : {p.motifStatut}</p>}
        </div>
        {s.role !== "CHEF_CHANTIER" && (
          <div className="flex flex-wrap gap-2">
            <a href={`/projets/${p.id}/rapport`} className={lienExport}>
              <FileDown className="h-4 w-4" /> Rapport PDF
            </a>
            <a href={`/projets/${p.id}/export`} className={lienExport}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </a>
          </div>
        )}
      </div>
      <Onglets base={`/projets/${p.id}`} onglets={onglets} />
      {children}

      {/* Saisie rapide sur téléphone : le bouton reste sous le pouce. */}
      {s.role !== "CLIENT" && p.statut !== "TERMINE" && <BoutonDepense projetId={p.id} />}
    </div>
  );
}
