import { AlertTriangle, CheckCircle2, Circle, Clock3, Info, Ban, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Surface commune : carte blanche en clair, prune profond en mode nuit. */
export const surface =
  "rounded-2xl border border-border bg-card text-card-foreground shadow-[0_1px_3px_rgba(219,39,119,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]";

/** Bouton principal : dégradé rose. */
export const classeBoutonPrimaire =
  "bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-[0_4px_14px_rgba(219,39,119,0.32)] hover:brightness-110";

export function StatCard({
  titre,
  valeur,
  icone: Icone,
  sousTitre,
  ton = "rose",
  className,
}: {
  titre: string;
  valeur: string;
  icone: LucideIcon;
  sousTitre?: React.ReactNode;
  ton?: "rose" | "vert" | "ambre" | "rouge" | "bleu";
  className?: string;
}) {
  const tons = {
    rose: "bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300",
    vert: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    ambre: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
    rouge: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
    bleu: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  };
  return (
    <div className={cn(surface, "p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{titre}</p>
          <p className="text-xl font-bold leading-tight tracking-tight 2xl:text-2xl">{valeur}</p>
          {sousTitre && <div className="text-xs text-muted-foreground">{sousTitre}</div>}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tons[ton])}>
          <Icone className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function Section({
  titre,
  description,
  children,
  actions,
  className,
}: {
  titre?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(surface, "p-5 sm:p-6", className)}>
      {(titre || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {titre && <h3 className="text-base font-semibold">{titre}</h3>}
            {description && <p className="max-w-3xl text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Bandeau({ erreur, ok }: { erreur?: string; ok?: string }) {
  if (!erreur && !ok) return null;
  return (
    <div
      role={erreur ? "alert" : "status"}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
        erreur
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
      )}
    >
      {erreur ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
      {erreur ?? ok}
    </div>
  );
}

/** Chaque statistique dit sur quoi elle porte : période, unité, effectif. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// Un état = une icône et une couleur de texte : jamais la couleur seule.
const TONS = {
  vert: { icone: CheckCircle2, classe: "text-emerald-600 dark:text-emerald-400" },
  orange: { icone: Clock3, classe: "text-amber-600 dark:text-amber-400" },
  rouge: { icone: XCircle, classe: "text-red-600 dark:text-red-400" },
  barre: { icone: Ban, classe: "text-muted-foreground line-through" },
  gris: { icone: Circle, classe: "text-muted-foreground" },
  rose: { icone: Info, classe: "text-primary" },
};
export type Ton = keyof typeof TONS;

export function Pastille({ ton = "gris", children }: { ton?: Ton; children: React.ReactNode }) {
  const { icone: Icone, classe } = TONS[ton];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium", classe)}>
      <Icone className="h-3.5 w-3.5 shrink-0" />
      {children}
    </span>
  );
}

export function tonStatut(s: string): Ton {
  if (["VALIDEE", "TERMINE", "EN_COURS"].includes(s)) return "vert";
  if (["EN_ATTENTE", "SUSPENDU", "PREPARATION"].includes(s)) return "orange";
  if (s === "REJETEE") return "rouge";
  if (s === "ANNULEE") return "barre";
  return "gris";
}

export function Tableau({
  entetes,
  children,
  vide,
  droite = [],
}: {
  entetes: string[];
  children: React.ReactNode;
  vide?: boolean;
  /** Index des colonnes de nombres, alignées à droite. */
  droite?: number[];
}) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {entetes.map((e, i) => (
              <th key={`${e}-${i}`} className={cn("whitespace-nowrap px-2 py-2.5 font-medium", droite.includes(i) && "text-right")}>
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:px-2 [&_td]:py-2.5 [&_td]:align-top [&_tr:hover]:bg-muted/40 [&_tr:last-child]:border-0 [&_tr]:border-b [&_tr]:border-border/70">
          {children}
        </tbody>
      </table>
      {vide && <p className="px-2 py-8 text-center text-sm text-muted-foreground">Aucune donnée pour l&apos;instant.</p>}
    </div>
  );
}

export const classeChamp =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Champ({
  label,
  name,
  type = "text",
  requis = true,
  aide,
  ...rest
}: { label: string; name: string; type?: string; requis?: boolean; aide?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">
        {label}
        {!requis && <span className="font-normal text-muted-foreground"> (facultatif)</span>}
      </span>
      <input name={name} type={type} required={requis} className={classeChamp} {...rest} />
      {aide && <span className="block text-xs text-muted-foreground">{aide}</span>}
    </label>
  );
}

export function Choix({
  label,
  name,
  options,
  requis = true,
  defaut,
  vide = "—",
}: {
  label: string;
  name: string;
  options: [string | number, string][];
  requis?: boolean;
  defaut?: string | number;
  vide?: string;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">
        {label}
        {!requis && <span className="font-normal text-muted-foreground"> (facultatif)</span>}
      </span>
      <select name={name} required={requis} defaultValue={defaut ?? ""} className={classeChamp}>
        {(!requis || defaut === undefined) && <option value="">{vide}</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Zone({ label, name, requis = true, large, defaut }: { label: string; name: string; requis?: boolean; large?: boolean; defaut?: string }) {
  return (
    <label className={cn("space-y-1.5 text-sm", large && "sm:col-span-2 lg:col-span-3")}>
      <span className="font-medium">
        {label}
        {!requis && <span className="font-normal text-muted-foreground"> (facultatif)</span>}
      </span>
      <textarea
        name={name}
        required={requis}
        rows={3}
        defaultValue={defaut}
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

export function Bouton({
  children,
  variante = "primaire",
  className,
  ...rest
}: { variante?: "primaire" | "secondaire" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all disabled:opacity-50",
        variante === "primaire" && classeBoutonPrimaire,
        variante === "secondaire" && "border border-border bg-card hover:border-primary/40 hover:bg-accent",
        variante === "danger" && "border border-red-200 bg-card text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Mesure({ nom, valeur, aide }: { nom: string; valeur: string; aide?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2" title={aide}>
      <p className="text-xs text-muted-foreground">{nom}</p>
      <p className="font-semibold tabular-nums">{valeur}</p>
    </div>
  );
}

/** Barre de progression : % consommé ou % réalisé. Au-delà de 100 %, elle passe au rouge. */
export function Jauge({ valeur, ton = "rose", className }: { valeur: number | null; ton?: "rose" | "bleu"; className?: string }) {
  const v = valeur == null || !Number.isFinite(valeur) ? 0 : valeur;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all",
          v > 100 ? "bg-red-500" : v >= 80 && ton === "rose" ? "bg-amber-500" : ton === "bleu" ? "bg-sky-500" : "bg-pink-500",
        )}
        style={{ width: `${Math.max(0, Math.min(100, v))}%` }}
      />
    </div>
  );
}

export function Vide({ icone: Icone, titre, children }: { icone: LucideIcon; titre: string; children?: React.ReactNode }) {
  return (
    <div className={cn(surface, "flex flex-col items-center px-6 py-14 text-center")}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Icone className="h-7 w-7" />
      </span>
      <p className="mt-4 font-semibold">{titre}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
