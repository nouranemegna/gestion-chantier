/**
 * Affiche les indicateurs de chaque projet dans le terminal, pour contrôler les
 * calculs sans ouvrir l'application :  npx tsx --env-file=.env scripts/verifier-indicateurs.ts
 */
import { prisma } from "../lib/db";
import { chargerDonnees } from "../lib/donnees";
import { analyser } from "../lib/analyse";
import { aujourdhui } from "../lib/format";

const f = (v: number | null | undefined, d = 0) => (v == null ? "—" : v.toLocaleString("fr-FR", { maximumFractionDigits: d }));

async function main() {
  const ing = await prisma.utilisateur.findFirstOrThrow({ where: { role: "INGENIEUR" } });
  for (const p of await prisma.projet.findMany({ orderBy: { id: "asc" } })) {
    const a = analyser(await chargerDonnees(p.id, { id: ing.id, role: "INGENIEUR", nom: "", exp: 0 }), aujourdhui());
    const va = a.valeurAcquise;
    console.log(`\n${p.code} ${p.nom} (${p.statut})`);
    console.log(`  budget ${f(a.budgetInitial)} + avenants ${f(a.totalAvenants)} = ${f(a.budgetRevise)} ; réel ${f(a.reel)} (${f(a.consommation, 1)} %) ; attente ${f(a.enAttente)} (${a.nbEnAttente})`);
    console.log(`  avancement ${f(va.avancement, 1)} % ; temps ${f(va.tempsEcoule, 1)} % ; CPI ${f(va.cpi, 3)} ; EAC ${f(va.eac)} ; régression ${f(a.regression?.coutFinal)} (R² ${f(a.regression?.r2, 3)})`);
    console.log(`  coût/m² réel ${f(a.coutM2.reel)} ; budget ${f(a.coutM2.budget)} ; versé ${f(a.versementsRecus)} ; trésorerie ${f(a.tresorerie)} ; justifié ${f(a.partJustifiee, 1)} %`);
    console.log(`  n ${a.descriptives.n} ; moyenne ${f(a.descriptives.moyenne)} ; médiane ${f(a.descriptives.mediane)} ; CV ${f(a.descriptives.cv, 1)} % ; Pareto A ${a.pareto.filter((l) => l.classe === "A").length}/${a.pareto.length}`);
    for (const x of a.alertes) console.log(`  [${x.niveau}] ${x.titre} — ${x.detail}`);
  }
}

main().finally(() => prisma.$disconnect());
