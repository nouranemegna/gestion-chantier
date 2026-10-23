import { prisma } from "@/lib/db";
import { exigerSession } from "@/lib/auth";
import { dateHeure } from "@/lib/format";
import { ROLES } from "@/lib/labels";
import { changerMotDePasse } from "@/app/actions/compte";
import { Formulaire } from "@/components/app/Formulaire";
import { MotDePasse } from "@/components/app/MotDePasse";
import { Mesure, Section } from "@/components/app/ui";

export const metadata = { title: "Mon compte" };

export default async function Compte() {
  const s = await exigerSession();
  const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: s.id } });
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Mon compte</h1>
      <Section>
        <div className="grid gap-3 sm:grid-cols-2">
          <Mesure nom="Nom" valeur={`${u.prenom} ${u.nom}`} />
          <Mesure nom="Rôle" valeur={ROLES[u.role]} />
          <Mesure nom="Téléphone (identifiant)" valeur={u.telephone} />
          <Mesure nom="Dernière connexion" valeur={u.derniereConnexion ? dateHeure(u.derniereConnexion) : "—"} />
        </div>
      </Section>
      <Formulaire action={changerMotDePasse} titre="Changer mon mot de passe" colonnes={1} bouton="Changer le mot de passe">
        <MotDePasse name="actuel" label="Mot de passe actuel" />
        <MotDePasse name="nouveau" label="Nouveau mot de passe (8 caractères au moins)" autoComplete="new-password" minLength={8} />
        <MotDePasse name="confirmation" label="Confirmation" autoComplete="new-password" minLength={8} />
      </Formulaire>
    </div>
  );
}
