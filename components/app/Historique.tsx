import { Ban, CheckCircle2, KeyRound, LogIn, Pencil, PlusCircle, Scale, XCircle, type LucideIcon } from "lucide-react";
import type { Journal, Utilisateur } from "@prisma/client";
import { dateHeure } from "@/lib/format";
import { ACTIONS, ROLES } from "@/lib/labels";
import { cn } from "@/lib/utils";

const ICONES: Record<string, { icone: LucideIcon; classe: string }> = {
  CONNEXION: { icone: LogIn, classe: "text-muted-foreground" },
  CREER: { icone: PlusCircle, classe: "text-primary" },
  MODIFIER: { icone: Pencil, classe: "text-sky-600 dark:text-sky-400" },
  VALIDER: { icone: CheckCircle2, classe: "text-emerald-600 dark:text-emerald-400" },
  REJETER: { icone: XCircle, classe: "text-red-600 dark:text-red-400" },
  ANNULER: { icone: Ban, classe: "text-red-600 dark:text-red-400" },
  AVENANT: { icone: Scale, classe: "text-amber-600 dark:text-amber-400" },
  MOT_DE_PASSE: { icone: KeyRound, classe: "text-muted-foreground" },
};

function valeur(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10).split("-").reverse().join("/");
  if (typeof v === "number") return v.toLocaleString("fr-FR");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Différences avant / après d'une modification, champ par champ. */
function Differences({ avant, apres }: { avant: unknown; apres: unknown }) {
  if (!avant || typeof avant !== "object" || !apres || typeof apres !== "object") return null;
  const a = avant as Record<string, unknown>;
  const b = apres as Record<string, unknown>;
  const cles = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  if (!cles.length) return null;
  return (
    <ul className="mt-1.5 space-y-0.5 text-xs">
      {cles.map((k) => (
        <li key={k} className="text-muted-foreground">
          <span className="font-medium text-foreground">{k}</span> : <span className="line-through decoration-red-400">{valeur(a[k])}</span> → <span className="text-foreground">{valeur(b[k])}</span>
        </li>
      ))}
    </ul>
  );
}

/** Fil chronologique des opérations : qui, quoi, quand, avec l'avant et l'après. */
export function Historique({ entrees, avecProjet }: { entrees: (Journal & { auteur: Utilisateur; projet?: { nom: string } | null })[]; avecProjet?: boolean }) {
  if (!entrees.length) return <p className="py-8 text-center text-sm text-muted-foreground">Aucune opération enregistrée.</p>;
  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {entrees.map((e) => {
        const st = ICONES[e.action] ?? ICONES.CREER;
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[33px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-card ring-4 ring-card">
              <st.icone className={cn("h-4 w-4", st.classe)} />
            </span>
            <p className="text-sm">
              <span className="font-medium">{e.resume}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {ACTIONS[e.action] ?? e.action} · {e.auteur.prenom} {e.auteur.nom} ({ROLES[e.auteur.role]}) · {dateHeure(e.date)}
              {avecProjet && e.projet && <> · {e.projet.nom}</>}
            </p>
            {e.action === "MODIFIER" && <Differences avant={e.avant} apres={e.apres} />}
          </li>
        );
      })}
    </ol>
  );
}
