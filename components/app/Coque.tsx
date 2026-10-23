"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, ChevronLeft, GitCompare, LibraryBig, LogOut, Menu, ScrollText, UserCircle2, Users, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Logo, NOM_APPLICATION } from "./Logo";
import { BarreNavigation, MiseAJour, Prechargement } from "./Chargement";
import { cn } from "@/lib/utils";

const ROLES: Record<string, string> = {
  INGENIEUR: "Ingénieure",
  CLIENT: "Client",
  CHEF_CHANTIER: "Chef de chantier",
};

const lien = (actif: boolean) =>
  cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
    actif ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

/** Coquille : barre latérale repliable (tiroir sur téléphone), en-tête, zone défilante. */
export function Coque({
  nom,
  role,
  projets,
  deconnexion,
  children,
}: {
  nom: string;
  role: string;
  projets: { id: number; code: string; nom: string }[];
  deconnexion: () => Promise<void>;
  children: React.ReactNode;
}) {
  const chemin = usePathname();
  const [replie, setReplie] = useState(false);
  const [tiroir, setTiroir] = useState(false);

  // Le tiroir se referme dès le toucher d'un lien, sans attendre la page.
  useEffect(() => setTiroir(false), [chemin]);

  const items = [
    { href: "/projets", label: role === "CLIENT" ? "Mes projets" : "Projets", icon: Building2, exact: true },
    ...(role === "INGENIEUR"
      ? [
          { href: "/comparaison", label: "Comparaison", icon: GitCompare, exact: false },
          { href: "/utilisateurs", label: "Utilisateurs", icon: Users, exact: false },
        ]
      : []),
    ...(role !== "CLIENT" ? [{ href: "/referentiels", label: "Articles et fournisseurs", icon: LibraryBig, exact: false }] : []),
    ...(role === "INGENIEUR" ? [{ href: "/journal", label: "Journal", icon: ScrollText, exact: false }] : []),
  ];

  // Écrans préchargés à l'ouverture de la session : le menu et chaque projet.
  const aPrecharger = [...items.map((i) => i.href), ...projets.slice(0, 6).map((p) => `/projets/${p.id}`)];

  const navigation = (court: boolean) => (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((it) => (
          <Link key={it.href} href={it.href} title={it.label} className={lien(it.exact ? chemin === it.href : chemin.startsWith(it.href))}>
            <it.icon className="h-5 w-5 shrink-0" />
            {!court && it.label}
          </Link>
        ))}
        {!court && projets.length > 0 && (
          <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Chantiers</p>
        )}
        {projets.map((p) => (
          <Link key={p.id} href={`/projets/${p.id}`} title={p.nom} className={lien(chemin.startsWith(`/projets/${p.id}`))}>
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                chemin.startsWith(`/projets/${p.id}`) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {p.nom.slice(0, 1).toUpperCase()}
            </span>
            {!court && <span className="truncate">{p.nom}</span>}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-border p-3">
        <Link href="/compte" className={lien(chemin === "/compte")} title="Mon compte">
          <UserCircle2 className="h-5 w-5 shrink-0 text-primary" />
          {!court && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate">{nom}</span>
              <span className="block text-xs font-normal text-muted-foreground">{ROLES[role]}</span>
            </span>
          )}
        </Link>
        <form action={deconnexion}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
            <LogOut className="h-5 w-5 shrink-0" />
            {!court && "Déconnexion"}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <BarreNavigation />
      <MiseAJour />
      <Prechargement liens={aPrecharger} />

      <aside className={cn("hidden flex-col border-r border-border bg-card transition-all duration-300 md:flex", replie ? "w-[72px]" : "w-64")}>
        <Link href="/projets" className="flex h-16 items-center gap-3 border-b border-border px-4">
          <Logo taille={36} />
          {!replie && (
            <span className="leading-tight">
              <span className="block font-bold tracking-tight">{NOM_APPLICATION}</span>
              <span className="block text-[11px] text-muted-foreground">Gestion des coûts de chantier</span>
            </span>
          )}
        </Link>
        {navigation(replie)}
      </aside>

      {/* Tiroir sur téléphone */}
      {tiroir && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/40 backdrop-blur-sm entree-fondu" aria-label="Fermer le menu" onClick={() => setTiroir(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card shadow-2xl entree-gauche">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="flex items-center gap-3 font-bold">
                <Logo taille={34} /> {NOM_APPLICATION}
              </span>
              <button onClick={() => setTiroir(false)} className="rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label="Fermer le menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navigation(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 backdrop-blur md:px-6">
          <button onClick={() => setReplie(!replie)} className="hidden rounded-xl p-2 text-muted-foreground hover:bg-muted md:block" aria-label="Replier le menu">
            {replie ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <button onClick={() => setTiroir(true)} className="flex items-center gap-2 font-bold md:hidden" aria-label="Ouvrir le menu">
            <Menu className="h-5 w-5 text-muted-foreground" />
            <Logo taille={30} />
            {NOM_APPLICATION}
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
              <UserCircle2 className="h-4 w-4" />
              {nom} · {ROLES[role]}
            </span>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
