import Image from "next/image";
import { cn } from "@/lib/utils";

export const NOM_APPLICATION = "Nourane Génie Civil";

/**
 * Symbole du logo (le N au casque rose et l'immeuble), sans le texte qui serait
 * illisible en petit. Sur une tuile blanche : il reste lisible en mode sombre.
 */
export function Logo({ taille = 40, className }: { taille?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-pink-100 dark:ring-white/10", className)}
      style={{ width: taille, height: taille }}
    >
      <Image src={taille > 96 ? "/embleme-512.png" : "/embleme-192.png"} alt="Nourane Génie Civil" width={taille} height={taille} className="h-full w-full object-contain" priority />
    </span>
  );
}

/** Logo complet (symbole, NOURANE, GÉNIE CIVIL) pour l'accueil et la connexion. */
export function LogoComplet({ largeur = 220, className }: { largeur?: number; className?: string }) {
  return (
    <span className={cn("inline-block overflow-hidden rounded-2xl bg-white p-2 dark:ring-1 dark:ring-white/10", className)} style={{ width: largeur }}>
      <Image src="/logo-nourane.png" alt="Nourane Génie Civil" width={600} height={600} className="h-auto w-full" priority />
    </span>
  );
}
