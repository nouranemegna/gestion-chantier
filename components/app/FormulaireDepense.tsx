"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import type { Categorie } from "@prisma/client";
import { CATEGORIES } from "@/lib/labels";
import { Formulaire, type ActionFormulaire } from "./Formulaire";
import { ChampPhoto } from "./ChampPhoto";
import { classeChamp } from "./ui";

export interface Choix {
  lots: { id: number; nom: string }[];
  articles: { id: number; designation: string; unite: string; categorie: Categorie; dernierPrix: number | null }[];
  fournisseurs: { id: number; nom: string }[];
}

export interface ValeursDepense {
  id?: number;
  lotId?: number;
  categorie?: Categorie;
  articleId?: number | null;
  libelle?: string;
  quantite?: number;
  unite?: string;
  prixUnitaire?: number;
  date: string;
  fournisseurId?: number | null;
  reference?: string | null;
  observation?: string | null;
}

const lire = (v: string) => Number(v.replace(/[\s  ]/g, "").replace(",", "."));

/**
 * Saisie d'une dépense. Choisir un article du catalogue remplit la catégorie,
 * l'unité et le dernier prix payé ; le total quantité × prix unitaire se calcule
 * pendant la saisie (le serveur le recalcule de son côté, c'est lui qui fait foi).
 */
export function FormulaireDepense({
  action,
  projetId,
  choix,
  valeurs,
  stockage,
  bouton = "Enregistrer la dépense",
  titre,
  description,
}: {
  action: ActionFormulaire;
  projetId: number;
  choix: Choix;
  valeurs: ValeursDepense;
  stockage: boolean;
  bouton?: string;
  titre?: string;
  description?: string;
}) {
  const [articleId, setArticleId] = useState(valeurs.articleId ? String(valeurs.articleId) : "");
  const [categorie, setCategorie] = useState<string>(valeurs.categorie ?? "MATERIAUX");
  const [unite, setUnite] = useState(valeurs.unite ?? "");
  const [quantite, setQuantite] = useState(valeurs.quantite != null ? String(valeurs.quantite).replace(".", ",") : "");
  const [prix, setPrix] = useState(valeurs.prixUnitaire != null ? String(valeurs.prixUnitaire) : "");
  const article = choix.articles.find((a) => String(a.id) === articleId);
  const total = lire(quantite) * lire(prix);

  return (
    <Formulaire action={action} titre={titre} description={description} bouton={bouton} cache={{ projetId, ...(valeurs.id ? { id: valeurs.id } : {}) }} garder={Boolean(valeurs.id)}
      onSucces={() => {
        if (valeurs.id) return;
        setArticleId("");
        setUnite("");
        setQuantite("");
        setPrix("");
      }}
    >
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Lot de travaux</span>
        <select name="lotId" required defaultValue={valeurs.lotId ?? ""} className={classeChamp}>
          <option value="">—</option>
          {choix.lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">
          Article du catalogue <span className="font-normal text-muted-foreground">(facultatif)</span>
        </span>
        <select
          name="articleId"
          value={articleId}
          onChange={(e) => {
            setArticleId(e.target.value);
            const a = choix.articles.find((x) => String(x.id) === e.target.value);
            if (a) {
              setCategorie(a.categorie);
              setUnite(a.unite);
              if (a.dernierPrix && !prix) setPrix(String(a.dernierPrix));
            }
          }}
          className={classeChamp}
        >
          <option value="">— Autre (libellé libre)</option>
          {Object.entries(CATEGORIES).map(([c, nom]) => {
            const liste = choix.articles.filter((a) => a.categorie === c);
            return liste.length ? (
              <optgroup key={c} label={nom}>
                {liste.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.designation}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Catégorie</span>
        <select name="categorie" required value={categorie} onChange={(e) => setCategorie(e.target.value)} disabled={!!article} className={classeChamp}>
          {Object.entries(CATEGORIES).map(([c, nom]) => (
            <option key={c} value={c}>
              {nom}
            </option>
          ))}
        </select>
        {article && <input type="hidden" name="categorie" value={categorie} />}
      </label>
      <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-1">
        <span className="font-medium">Libellé{article && <span className="font-normal text-muted-foreground"> (facultatif)</span>}</span>
        <input name="libelle" required={!article} defaultValue={valeurs.libelle} placeholder={article?.designation ?? "Ex. : journées de coffreur"} className={classeChamp} />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Quantité</span>
        <input name="quantite" required inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} placeholder="40" className={classeChamp} />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Unité</span>
        <input name="unite" required value={unite} onChange={(e) => setUnite(e.target.value)} placeholder="sac, m³, jour, voyage…" className={classeChamp} />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Prix unitaire (FCFA)</span>
        <input name="prixUnitaire" required inputMode="numeric" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="5 500" className={classeChamp} />
        {article?.dernierPrix != null && <span className="block text-xs text-muted-foreground">Dernier prix payé : {article.dernierPrix.toLocaleString("fr-FR")} FCFA</span>}
      </label>
      <div className="flex h-full items-end sm:col-span-2 lg:col-span-2">
        <div className="flex w-full items-center gap-3 rounded-xl border border-primary/25 bg-accent/60 px-4 py-2.5">
          <Calculator className="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Montant calculé (quantité × prix unitaire)</p>
            <p className="text-lg font-bold tabular-nums text-primary">{Number.isFinite(total) && total > 0 ? `${Math.round(total).toLocaleString("fr-FR")} FCFA` : "—"}</p>
          </div>
        </div>
      </div>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">Date</span>
        <input name="date" type="date" required defaultValue={valeurs.date} className={classeChamp} />
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">
          Fournisseur <span className="font-normal text-muted-foreground">(facultatif)</span>
        </span>
        <select name="fournisseurId" defaultValue={valeurs.fournisseurId ?? ""} className={classeChamp}>
          <option value="">—</option>
          {choix.fournisseurs.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5 text-sm">
        <span className="font-medium">
          N° de reçu ou de facture <span className="font-normal text-muted-foreground">(facultatif)</span>
        </span>
        <input name="reference" defaultValue={valeurs.reference ?? ""} className={classeChamp} />
      </label>
      <ChampPhoto label="Photo du reçu" actif={stockage} />
      <label className="space-y-1.5 text-sm sm:col-span-2">
        <span className="font-medium">
          Observation <span className="font-normal text-muted-foreground">(facultatif)</span>
        </span>
        <input name="observation" defaultValue={valeurs.observation ?? ""} className={classeChamp} />
      </label>
    </Formulaire>
  );
}
