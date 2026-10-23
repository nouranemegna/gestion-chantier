"use client";

import { useActionState } from "react";
import { Loader2, LogIn, Phone } from "lucide-react";
import { connexion } from "@/app/actions/compte";
import { Bandeau, classeBoutonPrimaire } from "@/components/app/ui";
import { MotDePasse } from "@/components/app/MotDePasse";
import { cn } from "@/lib/utils";

export function FormulaireConnexion() {
  const [etat, envoyer, enCours] = useActionState(connexion, {});
  return (
    <form action={envoyer} className="mt-7 space-y-4">
      <Bandeau erreur={etat.erreur} />
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Téléphone</span>
        <span className="relative block">
          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="telephone"
            inputMode="tel"
            required
            autoComplete="username"
            placeholder="6XX XXX XXX"
            className="h-11 w-full rounded-xl border border-input bg-background/60 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </span>
      </label>
      <MotDePasse name="motDePasse" label="Mot de passe" icone placeholder="Votre mot de passe" />
      <button disabled={enCours} className={cn("mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-60", classeBoutonPrimaire)}>
        {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Se connecter
      </button>
    </form>
  );
}
