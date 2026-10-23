import { AlertTriangle, Info, XCircle } from "lucide-react";
import type { Alerte } from "@/lib/analyse";
import { cn } from "@/lib/utils";
import { Section } from "./ui";

export function Alertes({ alertes }: { alertes: Alerte[] }) {
  const style = {
    critique: { icone: XCircle, classe: "border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200", libelle: "Critique" },
    attention: { icone: AlertTriangle, classe: "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200", libelle: "Attention" },
    info: { icone: Info, classe: "border-sky-200 bg-sky-50/70 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200", libelle: "Information" },
  };
  return (
    <Section titre={`Alertes (${alertes.length})`} description="Calculées à chaque ouverture, à partir des seuils indiqués dans l'onglet Analyse.">
      <ul className="grid gap-2.5 md:grid-cols-2">
        {alertes.map((x, i) => {
          const st = style[x.niveau];
          return (
            <li key={i} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", st.classe)}>
              <st.icone className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  {x.titre} <span className="ml-1 text-xs font-normal opacity-75">· {st.libelle}</span>
                </p>
                <p className="mt-0.5 opacity-90">{x.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
