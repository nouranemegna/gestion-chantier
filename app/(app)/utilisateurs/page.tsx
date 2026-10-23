import { prisma } from "@/lib/db";
import { exigerSession } from "@/lib/auth";
import { dateHeure } from "@/lib/format";
import { ROLES } from "@/lib/labels";
import { basculerUtilisateur, creerUtilisateur, reinitialiserMotDePasse } from "@/app/actions/compte";
import { BoutonAction, Formulaire } from "@/components/app/Formulaire";
import { MotDePasse } from "@/components/app/MotDePasse";
import { Champ, Choix, Pastille, Section, Tableau } from "@/components/app/ui";

export const metadata = { title: "Utilisateurs" };

export default async function Utilisateurs() {
  const s = await exigerSession(["INGENIEUR"]);
  const utilisateurs = await prisma.utilisateur.findMany({
    orderBy: [{ role: "asc" }, { nom: "asc" }],
    include: { _count: { select: { projetsClient: true, projetsChef: true } } },
  });
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seule l&apos;ingénieure crée les comptes. Un compte n&apos;est jamais supprimé : il est désactivé, et ses saisies restent attribuées.</p>
      </div>

      <Formulaire action={creerUtilisateur} titre="Nouveau compte" description="Communiquez le mot de passe provisoire à la personne ; elle le changera dans « Mon compte ».">
        <Champ label="Prénom" name="prenom" />
        <Champ label="Nom" name="nom" />
        <Champ label="Téléphone (identifiant)" name="telephone" inputMode="tel" placeholder="6XX XXX XXX" />
        <Choix label="Rôle" name="role" options={[["CLIENT", "Client"], ["CHEF_CHANTIER", "Chef de chantier"], ["INGENIEUR", "Ingénieure"]]} defaut="CLIENT" />
        <Champ label="E-mail" name="email" type="email" requis={false} />
        <MotDePasse name="motDePasse" label="Mot de passe provisoire" autoComplete="new-password" minLength={8} />
      </Formulaire>

      <Section titre={`Comptes (${utilisateurs.length})`}>
        <Tableau entetes={["Nom", "Rôle", "Téléphone", "Projets", "Dernière connexion", "État", ""]} vide={!utilisateurs.length}>
          {utilisateurs.map((u) => (
            <tr key={u.id} className={u.actif ? "" : "opacity-60"}>
              <td className="font-medium">
                {u.prenom} {u.nom}
                {u.email && <span className="block text-xs text-muted-foreground">{u.email}</span>}
              </td>
              <td>{ROLES[u.role]}</td>
              <td className="tabular-nums">{u.telephone}</td>
              <td className="tabular-nums text-muted-foreground">{u.role === "CLIENT" ? u._count.projetsClient : u.role === "CHEF_CHANTIER" ? u._count.projetsChef : "tous"}</td>
              <td className="whitespace-nowrap text-xs text-muted-foreground">{u.derniereConnexion ? dateHeure(u.derniereConnexion) : "jamais"}</td>
              <td>
                <Pastille ton={u.actif ? "vert" : "gris"}>{u.actif ? "Actif" : "Désactivé"}</Pastille>
              </td>
              <td>
                {u.id !== s.id && (
                  <div className="flex justify-end gap-1.5">
                    <BoutonAction action={reinitialiserMotDePasse} champs={{ id: u.id }} motif={`Nouveau mot de passe provisoire pour ${u.prenom} ${u.nom} (8 caractères au moins) :`} nomMotif="motDePasse">
                      Mot de passe
                    </BoutonAction>
                    <BoutonAction
                      action={basculerUtilisateur}
                      champs={{ id: u.id }}
                      variante={u.actif ? "danger" : "secondaire"}
                      confirmer={u.actif ? `Désactiver le compte de ${u.prenom} ${u.nom} ? Il ne pourra plus se connecter.` : undefined}
                    >
                      {u.actif ? "Désactiver" : "Réactiver"}
                    </BoutonAction>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>
    </div>
  );
}
