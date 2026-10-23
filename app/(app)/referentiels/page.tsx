import { prisma } from "@/lib/db";
import { exigerSession } from "@/lib/auth";
import { CATEGORIES } from "@/lib/labels";
import { basculerReferentiel, creerArticle, creerFournisseur } from "@/app/actions/operations";
import { BoutonAction, Formulaire } from "@/components/app/Formulaire";
import { Champ, Choix, Pastille, Section, Tableau } from "@/components/app/ui";

export const metadata = { title: "Articles et fournisseurs" };

export default async function Referentiels() {
  const s = await exigerSession(["INGENIEUR", "CHEF_CHANTIER"]);
  const ingenieure = s.role === "INGENIEUR";
  const [articles, fournisseurs] = await Promise.all([
    prisma.article.findMany({ orderBy: [{ categorie: "asc" }, { designation: "asc" }], include: { _count: { select: { depenses: true } } } }),
    prisma.fournisseur.findMany({ orderBy: { nom: "asc" }, include: { _count: { select: { depenses: true } } } }),
  ]);
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Articles et fournisseurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catalogue commun à tous les projets. Choisir un article lors d&apos;une dépense regroupe les achats du même produit : c&apos;est ce qui permet de suivre l&apos;évolution des prix et de repérer un prix anormal.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Formulaire action={creerArticle} titre="Nouvel article" colonnes={2}>
          <Champ label="Désignation" name="designation" placeholder="Ciment CPJ 42,5 (sac de 50 kg)" />
          <Champ label="Unité" name="unite" placeholder="sac" />
          <Choix label="Catégorie" name="categorie" options={Object.entries(CATEGORIES)} defaut="MATERIAUX" />
        </Formulaire>
        <Formulaire action={creerFournisseur} titre="Nouveau fournisseur" colonnes={2}>
          <Champ label="Nom" name="nom" />
          <Champ label="Téléphone" name="telephone" requis={false} inputMode="tel" />
          <Champ label="Activité" name="activite" requis={false} placeholder="Quincaillerie, carrière, transport…" />
        </Formulaire>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section titre={`Articles (${articles.length})`}>
          <Tableau entetes={["Désignation", "Catégorie", "Unité", "Achats", ""]} droite={[3]} vide={!articles.length}>
            {articles.map((a) => (
              <tr key={a.id} className={a.actif ? "" : "opacity-50"}>
                <td className="font-medium">{a.designation}</td>
                <td className="text-muted-foreground">{CATEGORIES[a.categorie]}</td>
                <td>{a.unite}</td>
                <td className="text-right tabular-nums">{a._count.depenses}</td>
                <td className="text-right">
                  {ingenieure ? (
                    <BoutonAction action={basculerReferentiel} champs={{ type: "article", id: a.id }}>
                      {a.actif ? "Retirer" : "Remettre"}
                    </BoutonAction>
                  ) : (
                    !a.actif && <Pastille>Retiré</Pastille>
                  )}
                </td>
              </tr>
            ))}
          </Tableau>
        </Section>
        <Section titre={`Fournisseurs (${fournisseurs.length})`}>
          <Tableau entetes={["Nom", "Activité", "Téléphone", "Achats", ""]} droite={[3]} vide={!fournisseurs.length}>
            {fournisseurs.map((f) => (
              <tr key={f.id} className={f.actif ? "" : "opacity-50"}>
                <td className="font-medium">{f.nom}</td>
                <td className="text-muted-foreground">{f.activite ?? "—"}</td>
                <td className="tabular-nums">{f.telephone ?? "—"}</td>
                <td className="text-right tabular-nums">{f._count.depenses}</td>
                <td className="text-right">
                  {ingenieure && (
                    <BoutonAction action={basculerReferentiel} champs={{ type: "fournisseur", id: f.id }}>
                      {f.actif ? "Retirer" : "Remettre"}
                    </BoutonAction>
                  )}
                </td>
              </tr>
            ))}
          </Tableau>
        </Section>
      </div>
    </div>
  );
}
