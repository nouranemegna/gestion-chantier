import { prisma } from "@/lib/db";
import { exigerProjet } from "@/lib/auth";
import { cleJour } from "@/lib/format";
import { STATUTS_PROJET, TYPES_OUVRAGE } from "@/lib/labels";
import { modifierProjet } from "@/app/actions/projets";
import { Formulaire } from "@/components/app/Formulaire";
import { Champ, Choix, Note, Section, Zone } from "@/components/app/ui";

export const metadata = { title: "Paramètres du projet" };

export default async function Parametres({ params }: { params: Promise<{ id: string }> }) {
  const { projet: p } = await exigerProjet(Number((await params).id), ["INGENIEUR"]);
  const [clients, chefs] = await Promise.all([
    prisma.utilisateur.findMany({ where: { role: "CLIENT", OR: [{ actif: true }, { id: p.clientId }] }, orderBy: { nom: "asc" } }),
    prisma.utilisateur.findMany({ where: { role: "CHEF_CHANTIER", OR: [{ actif: true }, { id: p.chefId ?? 0 }] }, orderBy: { nom: "asc" } }),
  ]);
  return (
    <div className="space-y-5">
      <Formulaire action={modifierProjet} cache={{ projetId: p.id }} garder titre="Informations et statut du projet" description="Chaque changement est inscrit au journal avec l'ancienne et la nouvelle valeur.">
        <Champ label="Nom du projet" name="nom" defaultValue={p.nom} />
        <Choix label="Type d'ouvrage" name="type" options={Object.entries(TYPES_OUVRAGE)} defaut={p.type} />
        <Champ label="Localisation" name="localisation" defaultValue={p.localisation} />
        <Champ label="Surface bâtie (m²)" name="surface" inputMode="decimal" defaultValue={String(p.surface).replace(".", ",")} />
        <Champ label="Nombre de niveaux" name="niveaux" type="number" min={1} defaultValue={p.niveaux} />
        <Champ label="Date de début" name="dateDebut" type="date" defaultValue={cleJour(p.dateDebut)} />
        <Champ label="Date de fin prévue" name="dateFinPrevue" type="date" defaultValue={cleJour(p.dateFinPrevue)} />
        <Choix label="Client" name="clientId" options={clients.map((c) => [c.id, `${c.prenom} ${c.nom}`])} defaut={p.clientId} />
        <Choix label="Chef de chantier" name="chefId" requis={false} options={chefs.map((c) => [c.id, `${c.prenom} ${c.nom}`])} defaut={p.chefId ?? ""} />
        <Choix label="Statut" name="statut" options={Object.entries(STATUTS_PROJET)} defaut={p.statut} />
        <Champ label="Motif (suspension, reprise…)" name="motifStatut" requis={false} defaultValue={p.motifStatut ?? ""} />
        <Champ label="Date de fin réelle (si terminé)" name="dateFinReelle" type="date" requis={false} defaultValue={p.dateFinReelle ? cleJour(p.dateFinReelle) : ""} />
        <Zone label="Description" name="description" requis={false} large defaut={p.description ?? ""} />
      </Formulaire>
      <Section titre="Cycle de vie du projet">
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          <li><span className="font-medium text-foreground">En préparation</span> : le budget initial se saisit et se corrige librement.</li>
          <li><span className="font-medium text-foreground">En cours</span> : le budget initial est figé ; il se révise par avenants. Les dépenses et l&apos;avancement se saisissent.</li>
          <li><span className="font-medium text-foreground">Suspendu</span> : un motif est obligatoire ; les saisies restent possibles pour régulariser.</li>
          <li><span className="font-medium text-foreground">Terminé</span> : plus aucune saisie ; le projet reste consultable et exportable.</li>
        </ul>
        <Note>Un projet n&apos;est jamais supprimé : ses données servent à comparer les coûts au m² des projets suivants.</Note>
      </Section>
    </div>
  );
}
