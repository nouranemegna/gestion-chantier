"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { surface } from "./ui";

/**
 * Fine barre en haut de l'écran, lancée dès le clic sur un lien interne et
 * retirée quand la nouvelle page est affichée : le clic est pris en compte
 * aussitôt, même si le serveur met un moment à répondre.
 */
export function BarreNavigation() {
  const chemin = usePathname();
  const [cible, setCible] = useState<string | null>(null);

  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      setCible(url.pathname);
    };
    document.addEventListener("click", surClic, true);
    return () => document.removeEventListener("click", surClic, true);
  }, []);

  useEffect(() => setCible(null), [chemin]);

  // Jamais de barre bloquée si la navigation est abandonnée.
  useEffect(() => {
    if (!cible) return;
    const minuteur = setTimeout(() => setCible(null), 20_000);
    return () => clearTimeout(minuteur);
  }, [cible]);

  return cible ? <Barre cle={cible} /> : null;
}

function Barre({ cle }: { cle: string }) {
  return (
    <div className="barre-navigation" role="progressbar" aria-label="Chargement">
      <div key={cle} />
    </div>
  );
}

/**
 * Copie locale d'abord : une page déjà vue pendant la session se rouvre aussitôt
 * depuis le cache du routeur (staleTimes, next.config.ts), puis la version du
 * serveur la remplace sur place, sans perdre le défilement ni une saisie en
 * cours. La fine barre rose signale cette mise à jour.
 */
export function MiseAJour() {
  const chemin = usePathname();
  const routeur = useRouter();
  const vues = useRef(new Map<string, number>());
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    const derniere = vues.current.get(chemin);
    vues.current.set(chemin, Date.now());
    // Première visite : la page vient d'arriver du serveur, rien à rafraîchir.
    if (derniere && Date.now() - derniere > 2_000) demarrer(() => routeur.refresh());
  }, [chemin, routeur]);

  // Retour sur l'onglet du navigateur ou retour du réseau : on se remet à jour.
  useEffect(() => {
    const rafraichir = () => document.visibilityState === "visible" && navigator.onLine && demarrer(() => routeur.refresh());
    document.addEventListener("visibilitychange", rafraichir);
    window.addEventListener("online", rafraichir);
    return () => {
      document.removeEventListener("visibilitychange", rafraichir);
      window.removeEventListener("online", rafraichir);
    };
  }, [routeur]);

  return enCours ? <Barre cle="maj" /> : null;
}

/**
 * Préchargement des écrans du menu dès l'ouverture de la session : leurs
 * données arrivent en arrière-plan, la première ouverture est alors immédiate.
 * Il s'arrête hors connexion et reprend au retour du réseau.
 */
export function Prechargement({ liens }: { liens: string[] }) {
  const routeur = useRouter();
  const cle = liens.join("|");
  useEffect(() => {
    // Un écran toutes les 400 ms : la page affichée garde la priorité sur le serveur.
    const minuteurs: ReturnType<typeof setTimeout>[] = [];
    const charger = () => {
      if (!navigator.onLine) return;
      cle
        .split("|")
        .filter(Boolean)
        .forEach((l, i) => minuteurs.push(setTimeout(() => navigator.onLine && routeur.prefetch(l), 1500 + i * 400)));
    };
    charger();
    window.addEventListener("online", charger);
    return () => {
      minuteurs.forEach(clearTimeout);
      window.removeEventListener("online", charger);
    };
  }, [cle, routeur]);
  return null;
}

/* Squelettes : la forme du contenu à venir, à sa place. */

export function SqueletteTitre() {
  return (
    <div className="space-y-2.5">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-4 w-[min(28rem,80%)]" />
    </div>
  );
}

export function SqueletteCartes({ nombre = 4 }: { nombre?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: nombre }, (_, i) => (
        <div key={i} className={cn(surface, "flex items-start justify-between p-5")}>
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-36 rounded-lg" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-11 w-11 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function SqueletteTableau({ lignes = 6 }: { lignes?: number }) {
  return (
    <div className={cn(surface, "space-y-3 p-5 sm:p-6")}>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-8 w-full opacity-70" />
      {Array.from({ length: lignes }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-6 w-[18%]" />
          <Skeleton className="h-6 flex-1" style={{ maxWidth: `${60 - (i % 3) * 9}%` }} />
          <Skeleton className="ml-auto h-6 w-[14%]" />
        </div>
      ))}
    </div>
  );
}

export function SqueletteGraphique({ hauteur = 260 }: { hauteur?: number }) {
  return (
    <div className={cn(surface, "space-y-4 p-5 sm:p-6")}>
      <Skeleton className="h-5 w-56" />
      <div className="flex items-end gap-2" style={{ height: hauteur }}>
        {[45, 70, 55, 85, 60, 92, 75, 50, 66, 80].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Page entière en cours d'ouverture : titre, cartes, graphique et tableau à leur place. */
export function SquelettePage({ cartes = true, graphique = true }: { cartes?: boolean; graphique?: boolean }) {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">Ouverture de la page…</span>
      {cartes && <SqueletteCartes />}
      {graphique && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SqueletteGraphique />
          <SqueletteGraphique />
        </div>
      )}
      <SqueletteTableau />
    </div>
  );
}
