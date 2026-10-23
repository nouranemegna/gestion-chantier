"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { classeBoutonPrimaire } from "./ui";
import { cn } from "@/lib/utils";

/**
 * Saisie rapide sur téléphone : le bouton reste sous le pouce, sauf sur les
 * écrans d'une dépense (saisie, détail) où il masquerait le formulaire.
 */
export function BoutonDepense({ projetId }: { projetId: number }) {
  const chemin = usePathname();
  if (/\/depenses\/(nouvelle|\d+)$/.test(chemin)) return null;
  return (
    <Link
      href={`/projets/${projetId}/depenses/nouvelle`}
      className={cn("fixed bottom-5 right-5 z-40 inline-flex h-14 items-center gap-2 rounded-full px-5 text-sm font-semibold md:hidden", classeBoutonPrimaire)}
    >
      <Plus className="h-5 w-5" /> Dépense
    </Link>
  );
}
