"use client";

import { useActionState, useEffect, useRef, startTransition } from "react";
import { Loader2 } from "lucide-react";
import type { Etat } from "@/lib/formulaire";
import { cn } from "@/lib/utils";
import { Bandeau, Bouton, Section } from "./ui";

export type ActionFormulaire = (precedent: Etat, f: FormData) => Promise<Etat>;

/**
 * Formulaire relié à une action serveur. En cas d'erreur, la saisie reste en
 * place pour être corrigée ; après un succès, le formulaire se vide (sauf si
 * `garder`) et le message de confirmation s'affiche.
 */
export function Formulaire({
  action,
  titre,
  description,
  children,
  bouton = "Enregistrer",
  cache,
  garder = false,
  colonnes = 3,
  nu = false,
  onSucces,
}: {
  action: ActionFormulaire;
  titre?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  bouton?: string;
  cache?: Record<string, string | number>;
  garder?: boolean;
  colonnes?: 1 | 2 | 3;
  /** Sans cadre : pour un formulaire déjà placé dans une Section. */
  nu?: boolean;
  /** Appelé après chaque envoi réussi (pour vider aussi les champs contrôlés). */
  onSucces?: () => void;
}) {
  const [etat, envoyer, enCours] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!etat.jeton) return;
    if (!garder) ref.current?.reset();
    onSucces?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat.jeton]);

  const formulaire = (
    <form
      ref={ref}
      onSubmit={(e) => {
        // Envoi manuel : React ne vide pas le formulaire si l'action échoue.
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        startTransition(() => envoyer(f));
      }}
      className={cn("grid items-end gap-4", colonnes >= 2 && "sm:grid-cols-2", colonnes === 3 && "lg:grid-cols-3")}
    >
      {cache && Object.entries(cache).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <div className={cn("flex flex-wrap items-center gap-3", colonnes >= 2 && "sm:col-span-2", colonnes === 3 && "lg:col-span-3")}>
        <Bouton type="submit" disabled={enCours}>
          {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
          {bouton}
        </Bouton>
        <div className="min-w-0 flex-1">
          <Bandeau erreur={etat.erreur} ok={etat.ok} />
        </div>
      </div>
    </form>
  );
  if (nu) return formulaire;
  return (
    <Section titre={titre} description={description}>
      {formulaire}
    </Section>
  );
}

/**
 * Bouton d'une action sur une ligne (valider, rejeter, annuler…). `motif`
 * demande une justification avant l'envoi : elle est gardée dans le journal.
 */
export function BoutonAction({
  action,
  champs,
  children,
  variante = "secondaire",
  motif,
  nomMotif = "motif",
  confirmer,
}: {
  action: ActionFormulaire;
  champs: Record<string, string | number>;
  children: React.ReactNode;
  variante?: "primaire" | "secondaire" | "danger";
  motif?: string;
  /** Nom du champ qui reçoit la réponse à la question `motif`. */
  nomMotif?: string;
  confirmer?: string;
}) {
  const [etat, envoyer, enCours] = useActionState(action, {});
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Bouton
        type="button"
        variante={variante}
        disabled={enCours}
        className="h-8 px-3 text-xs"
        onClick={() => {
          const f = new FormData();
          for (const [k, v] of Object.entries(champs)) f.set(k, String(v));
          if (motif) {
            const m = window.prompt(motif);
            if (m === null) return;
            if (!m.trim()) return window.alert("Une réponse est obligatoire.");
            f.set(nomMotif, m.trim());
          } else if (confirmer && !window.confirm(confirmer)) return;
          startTransition(() => envoyer(f));
        }}
      >
        {enCours && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {children}
      </Bouton>
      {etat.erreur && <span className="max-w-56 text-xs text-red-600 dark:text-red-400">{etat.erreur}</span>}
    </span>
  );
}
