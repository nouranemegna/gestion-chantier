"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, HandCoins, LayoutDashboard, Receipt, ScrollText, Settings, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONES: Record<string, LucideIcon> = {
  "": LayoutDashboard,
  depenses: Receipt,
  budget: Wallet,
  avancement: ClipboardList,
  versements: HandCoins,
  analyse: BarChart3,
  journal: ScrollText,
  parametres: Settings,
};

/**
 * Onglets d'un projet. Préchargement standard de Next : le squelette de chaque
 * onglet est prêt dès que l'onglet est visible, et un onglet déjà ouvert se
 * rouvre aussitôt depuis la copie locale (staleTimes). Précharger les données
 * complètes des 8 onglets ferait calculer 8 analyses à chaque ouverture de projet.
 */
export function Onglets({ base, onglets }: { base: string; onglets: [string, string, number?][] }) {
  const chemin = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {onglets.map(([seg, label, compte]) => {
        const href = seg ? `${base}/${seg}` : base;
        const actif = seg ? chemin.startsWith(href) : chemin === base;
        const Icone = ICONES[seg];
        return (
          <Link
            key={seg}
            href={href}
            className={cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              actif ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone className="h-4 w-4" />
            {label}
            {!!compte && (
              <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", actif ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground")}>
                {compte}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
