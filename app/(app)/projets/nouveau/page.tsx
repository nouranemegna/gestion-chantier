import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerSession } from "@/lib/auth";
import { cleJour, aujourdhui, ajouterJours } from "@/lib/format";
import { LOTS_PAR_DEFAUT, TYPES_OUVRAGE } from "@/lib/labels";
import { creerProjet } from "@/app/actions/projets";
import { Formulaire } from "@/components/app/Formulaire";
import { Champ, Choix, Zone } from "@/components/app/ui";

export const metadata = { title: "Nouveau projet" };

export default async function NouveauProjet() {
  await exigerSession(["INGENIEUR"]);
  const [clients, chefs, nb] = await Promise.all([
    prisma.utilisateur.findMany({ where: { role: "CLIENT", actif: true }, orderBy: { nom: "asc" } }),
    prisma.utilisateur.findMany({ where: { role: "CHEF_CHANTIER", actif: true }, orderBy: { nom: "asc" } }),
    prisma.projet.count(),
  ]);
  const code = `PRJ-${new Date().getFullYear()}-${String(nb + 1).padStart(3, "0")}`;
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/projets" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Projets
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nouveau projet</h1>
        <p className="mt-1 text-sm text-muted-foreground">Étape 1 sur 2 : informations générales et lots de travaux. Le budget prévisionnel se saisit ensuite, lot par lot.</p>
      </div>
      {clients.length === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Créez d&apos;abord le compte du client dans <Link href="/utilisateurs" className="font-semibold underline">Utilisateurs</Link>.
        </p>
      )}
      <Formulaire action={creerProjet} bouton="Créer le projet et saisir le budget" garder>
        <Champ label="Code" name="code" defaultValue={code} />
        <Champ label="Nom du projet" name="nom" placeholder="Villa R+1 à Odza" />
        <Choix label="Type d'ouvrage" name="type" options={Object.entries(TYPES_OUVRAGE)} defaut="MAISON_INDIVIDUELLE" />
        <Champ label="Localisation" name="localisation" placeholder="Yaoundé, Odza" />
        <Champ label="Surface bâtie (m²)" name="surface" inputMode="decimal" placeholder="180" aide="Base du coût au m²" />
        <Champ label="Nombre de niveaux" name="niveaux" type="number" min={1} defaultValue={1} />
        <Champ label="Date de début" name="dateDebut" type="date" defaultValue={cleJour(aujourdhui())} />
        <Champ label="Date de fin prévue" name="dateFinPrevue" type="date" defaultValue={cleJour(ajouterJours(aujourdhui(), 240))} />
        <Choix label="Client" name="clientId" options={clients.map((c) => [c.id, `${c.prenom} ${c.nom}`])} />
        <Choix label="Chef de chantier" name="chefId" requis={false} options={chefs.map((c) => [c.id, `${c.prenom} ${c.nom}`])} />
        <Zone label="Description" name="description" requis={false} large />
        <fieldset className="space-y-2 text-sm sm:col-span-2 lg:col-span-3">
          <legend className="mb-2 font-medium">Lots de travaux</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {LOTS_PAR_DEFAUT.map((l) => (
              <label key={l} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 hover:bg-accent/50">
                <input type="checkbox" name="lots" value={l} defaultChecked className="h-4 w-4 accent-pink-600" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <Zone label="Autres lots (un par ligne)" name="autresLots" requis={false} large />
      </Formulaire>
    </div>
  );
}
