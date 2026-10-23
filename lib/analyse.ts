/**
 * Indicateurs financiers et statistiques d'un projet de construction.
 *
 * Fonctions pures : elles reçoivent les données du projet déjà lues dans la base
 * et ne touchent ni à la base ni à l'écran, ce qui permet de les tester sur un
 * projet calculé à la main (analyse.test.ts) et de les réutiliser pour l'écran,
 * le rapport PDF et l'export Excel.
 *
 * Conventions :
 * - seules les dépenses VALIDÉES comptent dans le réel ; les dépenses en attente
 *   sont montrées à part (« engagé, non validé ») ;
 * - le budget de référence est le budget RÉVISÉ (initial + avenants) ; l'écart
 *   initial / révisé est affiché à part ;
 * - un indicateur incalculable vaut null (division par zéro, trop peu de
 *   données) : c'est à l'écran d'écrire « non calculable », jamais d'inventer 0.
 */
import type { Categorie, Statut } from "@prisma/client";
import {
  boiteAMoustaches,
  coefficientVariation,
  ecartType,
  histogramme,
  intervalleConfianceMoyenne,
  mediane,
  moyenne,
  pareto,
  quantile,
  regressionLineaire,
  somme,
  studentT95,
  type Boite,
  type Classe,
} from "./stats";
import { CATEGORIES } from "./labels";

export const CATEGORIES_ORDRE: Categorie[] = ["MATERIAUX", "MAIN_OEUVRE", "TRANSPORT", "LOCATION_EQUIPEMENT", "AUTRES"];

/** Seuils des alertes, regroupés ici pour être cités dans le rapport. */
export const SEUILS = {
  consommationAttention: 80,
  consommationCritique: 100,
  /** Points d'écart tolérés entre % du budget consommé et % des travaux réalisés. */
  ecartAvancement: 10,
  /**
   * |z| au-delà duquel un prix unitaire est jugé anormal. 2,5 plutôt que 2 : avec
   * des centaines d achats, |z| > 2 arrive dans 5 % des cas par simple hasard.
   */
  scoreZ: 2.5,
  /** Achats validés d'un même article nécessaires pour juger un prix. */
  achatsMinPrix: 4,
  joursAttente: 7,
  partNonJustifiee: 20,
};

export interface DonneesProjet {
  surface: number;
  dateDebut: Date;
  dateFinPrevue: Date;
  termine: boolean;
  lots: { id: number; nom: string; avancement: number }[];
  lignes: { id: number; lotId: number; categorie: Categorie; montantInitial: number; avenants: number }[];
  depenses: {
    id: number;
    lotId: number;
    categorie: Categorie;
    articleId: number | null;
    article: string | null;
    fournisseur: string | null;
    libelle: string;
    quantite: number;
    unite: string;
    prixUnitaire: number;
    montant: number;
    date: Date;
    statut: Statut;
    justifiee: boolean;
    creeLe: Date;
  }[];
  versements: { montant: number; date: Date; statut: Statut }[];
}

export interface PosteBudget {
  cle: string;
  nom: string;
  initial: number;
  revise: number;
  reel: number;
  enAttente: number;
  /** reel − revise : positif = dépassement. */
  ecart: number;
  /** Part du budget révisé consommée, en %. */
  consommation: number | null;
  /** Part du réel total, en %. */
  part: number | null;
}

export interface Alerte {
  niveau: "critique" | "attention" | "info";
  code: string;
  titre: string;
  detail: string;
}

export interface Analyse {
  budgetInitial: number;
  totalAvenants: number;
  budgetRevise: number;
  reel: number;
  enAttente: number;
  nbEnAttente: number;
  reste: number;
  consommation: number | null;
  versementsRecus: number;
  versementsEnAttente: number;
  /** Fonds reçus du client moins dépenses validées. */
  tresorerie: number;
  parCategorie: (PosteBudget & { categorie: Categorie })[];
  parLot: (PosteBudget & { lotId: number; avancement: number })[];
  /** Matrice lot × catégorie du budget ventilé. */
  matrice: { lotId: number; categorie: Categorie; ligneId: number; initial: number; revise: number; reel: number }[];
  valeurAcquise: {
    /** Avancement global pondéré par le budget révisé de chaque lot, en %. */
    avancement: number | null;
    /** Part du délai écoulée, en %. */
    tempsEcoule: number | null;
    /** EV = Σ budget du lot × avancement du lot. */
    ev: number;
    /** CPI = EV / coût réel : < 1 signifie qu'on paie plus cher que prévu ce qui est fait. */
    cpi: number | null;
    /** Estimation à l'achèvement EAC = budget / CPI. */
    eac: number | null;
    /** Écart à l'achèvement VAC = budget − EAC (négatif = dépassement attendu). */
    vac: number | null;
  };
  regression: {
    /** Coût cumulé = a × jour + b, ajusté sur les jours où une dépense a été validée. */
    a: number;
    b: number;
    r2: number;
    n: number;
    /** Coût cumulé prévu à la date de fin prévue, et son intervalle de prévision à 95 %. */
    coutFinal: number;
    bas: number;
    haut: number;
    jourFin: number;
  } | null;
  /** Coût cumulé jour par jour (jours de dépense), pour la courbe en S. */
  cumul: { jour: number; date: string; cumul: number }[];
  mensuel: { mois: string; total: number; cumul: number; parCategorie: Record<Categorie, number> }[];
  descriptives: {
    n: number;
    somme: number;
    moyenne: number | null;
    mediane: number | null;
    ecartType: number | null;
    cv: number | null;
    q1: number | null;
    q3: number | null;
    min: number | null;
    max: number | null;
    boite: Boite | null;
    ic95: { bas: number; haut: number } | null;
    histogramme: Classe[];
  };
  pareto: { nom: string; valeur: number; part: number; partCumulee: number; classe: "A" | "B" | "C" }[];
  prix: {
    articleId: number;
    article: string;
    unite: string;
    n: number;
    moyenne: number;
    min: number;
    max: number;
    ecartType: number | null;
    cv: number | null;
    premier: number;
    dernier: number;
    /** (dernier − premier) / premier, en %. */
    variation: number | null;
  }[];
  anomalies: { depenseId: number; libelle: string; prixUnitaire: number; moyenne: number; z: number; statut: Statut; date: Date }[];
  parFournisseur: { nom: string; total: number; n: number; part: number }[];
  coutM2: { reel: number | null; budget: number | null; prevu: number | null };
  partJustifiee: number | null;
  alertes: Alerte[];
}

const JOUR_MS = 86_400_000;
const jourDe = (d: Date, origine: Date) => Math.round((d.getTime() - origine.getTime()) / JOUR_MS);
const pctOuNull = (num: number, den: number) => (den === 0 ? null : (num / den) * 100);
const nf = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} FCFA`;
const p1 = (v: number) => `${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const liste = (noms: string[]) => (noms.length <= 3 ? noms.join(", ") : `${noms.slice(0, 3).join(", ")} et ${noms.length - 3} autre(s)`);

export function analyser(d: DonneesProjet, aujourdhui: Date): Analyse {
  const valides = d.depenses.filter((x) => x.statut === "VALIDEE");
  const attente = d.depenses.filter((x) => x.statut === "EN_ATTENTE");

  const budgetInitial = somme(d.lignes.map((l) => l.montantInitial));
  const totalAvenants = somme(d.lignes.map((l) => l.avenants));
  const budgetRevise = budgetInitial + totalAvenants;
  const reel = somme(valides.map((x) => x.montant));
  const enAttente = somme(attente.map((x) => x.montant));

  // Budget, réel et attente par poste (lot ou catégorie).
  function poste(cle: string, nom: string, lignes: DonneesProjet["lignes"], filtre: (x: DonneesProjet["depenses"][number]) => boolean): PosteBudget {
    const initial = somme(lignes.map((l) => l.montantInitial));
    const revise = initial + somme(lignes.map((l) => l.avenants));
    const r = somme(valides.filter(filtre).map((x) => x.montant));
    return {
      cle,
      nom,
      initial,
      revise,
      reel: r,
      enAttente: somme(attente.filter(filtre).map((x) => x.montant)),
      ecart: r - revise,
      consommation: pctOuNull(r, revise),
      part: pctOuNull(r, reel),
    };
  }

  const parCategorie = CATEGORIES_ORDRE.map((c) => ({
    ...poste(c, CATEGORIES[c], d.lignes.filter((l) => l.categorie === c), (x) => x.categorie === c),
    categorie: c,
  }));
  const parLot = d.lots.map((lot) => ({
    ...poste(String(lot.id), lot.nom, d.lignes.filter((l) => l.lotId === lot.id), (x) => x.lotId === lot.id),
    lotId: lot.id,
    avancement: lot.avancement,
  }));
  const matrice = d.lignes.map((l) => ({
    lotId: l.lotId,
    categorie: l.categorie,
    ligneId: l.id,
    initial: l.montantInitial,
    revise: l.montantInitial + l.avenants,
    reel: somme(valides.filter((x) => x.lotId === l.lotId && x.categorie === l.categorie).map((x) => x.montant)),
  }));

  // Valeur acquise : ce que vaut, au prix du budget, le travail réellement fait.
  const ev = somme(parLot.map((l) => (l.revise * l.avancement) / 100));
  const avancement = pctOuNull(ev, budgetRevise);
  const duree = jourDe(d.dateFinPrevue, d.dateDebut);
  const tempsEcoule = duree <= 0 ? null : Math.max(0, Math.min(100, (jourDe(aujourdhui, d.dateDebut) / duree) * 100));
  const cpi = reel > 0 && ev > 0 ? ev / reel : null;
  const eac = cpi ? budgetRevise / cpi : null;

  // Courbe en S : coût cumulé à chaque jour où une dépense validée est datée.
  const parJour = new Map<number, number>();
  for (const x of valides) {
    const j = jourDe(x.date, d.dateDebut);
    parJour.set(j, (parJour.get(j) ?? 0) + x.montant);
  }
  let c = 0;
  const cumul = Array.from(parJour.entries())
    .sort(([a], [b]) => a - b)
    .map(([jour, v]) => {
      c += v;
      return { jour, date: new Date(d.dateDebut.getTime() + jour * JOUR_MS).toISOString().slice(0, 10), cumul: c };
    });

  // Prévision par régression linéaire du coût cumulé sur le temps. Elle suppose
  // un rythme de dépense constant : valable en plein chantier, pas au démarrage.
  let regression: Analyse["regression"] = null;
  if (cumul.length >= 3 && !d.termine) {
    const xs = cumul.map((p) => p.jour);
    const ys = cumul.map((p) => p.cumul);
    const r = regressionLineaire(xs, ys);
    if (r) {
      const jourFin = Math.max(duree, xs[xs.length - 1]);
      const coutFinal = r.predire(jourFin);
      // Intervalle de prévision : t × s × √(1 + 1/n + (x₀ − x̄)² / Σ(x − x̄)²).
      const mx = moyenne(xs);
      const sxx = somme(xs.map((x) => (x - mx) ** 2));
      const marge = Number.isFinite(r.ecartResiduel)
        ? studentT95(r.n - 2) * r.ecartResiduel * Math.sqrt(1 + 1 / r.n + (jourFin - mx) ** 2 / sxx)
        : NaN;
      regression = {
        a: r.a,
        b: r.b,
        r2: r.r2,
        n: r.n,
        coutFinal,
        bas: Number.isFinite(marge) ? coutFinal - marge : coutFinal,
        haut: Number.isFinite(marge) ? coutFinal + marge : coutFinal,
        jourFin,
      };
    }
  }

  // Dépenses par mois.
  const mois = new Map<string, { total: number; parCategorie: Record<Categorie, number> }>();
  for (const x of valides) {
    const m = x.date.toISOString().slice(0, 7);
    const e = mois.get(m) ?? { total: 0, parCategorie: { MATERIAUX: 0, MAIN_OEUVRE: 0, TRANSPORT: 0, LOCATION_EQUIPEMENT: 0, AUTRES: 0 } };
    e.total += x.montant;
    e.parCategorie[x.categorie] += x.montant;
    mois.set(m, e);
  }
  let cm = 0;
  const mensuel = Array.from(mois.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, e]) => ({ mois: m, total: e.total, cumul: (cm += e.total), parCategorie: e.parCategorie }));

  // Statistique descriptive des montants des dépenses validées.
  const montants = valides.map((x) => x.montant);
  const n = montants.length;
  const ou = (v: number) => (Number.isFinite(v) ? v : null);
  const ic = intervalleConfianceMoyenne(montants);
  const descriptives: Analyse["descriptives"] = {
    n,
    somme: reel,
    moyenne: ou(moyenne(montants)),
    mediane: ou(mediane(montants)),
    ecartType: ou(ecartType(montants)),
    cv: ou(coefficientVariation(montants)),
    q1: ou(quantile(montants, 0.25)),
    q3: ou(quantile(montants, 0.75)),
    min: n ? Math.min(...montants) : null,
    max: n ? Math.max(...montants) : null,
    boite: boiteAMoustaches(montants),
    ic95: ic ? { bas: ic.bas, haut: ic.haut } : null,
    histogramme: histogramme(montants),
  };

  // Pareto des articles (ou du libellé quand la dépense n'a pas d'article).
  const parArticle = new Map<string, number>();
  for (const x of valides) {
    const cle = x.article ?? x.libelle;
    parArticle.set(cle, (parArticle.get(cle) ?? 0) + x.montant);
  }
  const lignesPareto = pareto(Array.from(parArticle.entries()), ([, v]) => v).map((l) => ({
    nom: l.element[0],
    valeur: l.valeur,
    part: l.part,
    partCumulee: l.partCumulee,
    classe: l.classe,
  }));

  // Prix unitaires par article, dans l'ordre chronologique des achats.
  const achats = new Map<number, typeof valides>();
  for (const x of valides) if (x.articleId != null) achats.set(x.articleId, [...(achats.get(x.articleId) ?? []), x]);
  const prix: Analyse["prix"] = [];
  const references = new Map<number, { m: number; s: number; n: number }>();
  for (const [articleId, liste] of achats) {
    const tries = [...liste].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id - b.id);
    const pus = tries.map((x) => x.prixUnitaire);
    const m = moyenne(pus);
    const s = ecartType(pus);
    references.set(articleId, { m, s, n: pus.length });
    prix.push({
      articleId,
      article: tries[0].article ?? tries[0].libelle,
      unite: tries[0].unite,
      n: pus.length,
      moyenne: m,
      min: Math.min(...pus),
      max: Math.max(...pus),
      ecartType: pus.length > 1 ? s : null,
      cv: pus.length > 1 ? ou(coefficientVariation(pus)) : null,
      premier: pus[0],
      dernier: pus[pus.length - 1],
      variation: pus.length > 1 ? ou(((pus[pus.length - 1] - pus[0]) / pus[0]) * 100) : null,
    });
  }
  prix.sort((a, b) => b.n * b.moyenne - a.n * a.moyenne);

  // Prix anormal : score z calculé par rapport aux achats VALIDÉS du même
  // article, ce qui permet de signaler une dépense encore en attente.
  const anomalies: Analyse["anomalies"] = [];
  for (const x of [...valides, ...attente]) {
    if (x.articleId == null) continue;
    const ref = references.get(x.articleId);
    if (!ref || ref.n < SEUILS.achatsMinPrix || ref.s === 0) continue;
    // Plancher de 2 % de la moyenne pour l écart-type : sur un article au prix
    // presque fixe, un écart de quelques francs donnerait sinon un |z| énorme.
    const z = (x.prixUnitaire - ref.m) / Math.max(ref.s, 0.02 * ref.m);
    if (Math.abs(z) > SEUILS.scoreZ) {
      anomalies.push({ depenseId: x.id, libelle: x.libelle, prixUnitaire: x.prixUnitaire, moyenne: ref.m, z, statut: x.statut, date: x.date });
    }
  }
  anomalies.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

  const fournisseurs = new Map<string, { total: number; n: number }>();
  for (const x of valides) {
    if (!x.fournisseur) continue;
    const e = fournisseurs.get(x.fournisseur) ?? { total: 0, n: 0 };
    e.total += x.montant;
    e.n++;
    fournisseurs.set(x.fournisseur, e);
  }
  const parFournisseur = Array.from(fournisseurs.entries())
    .map(([nom, e]) => ({ nom, ...e, part: reel ? (e.total / reel) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  const versementsRecus = somme(d.versements.filter((v) => v.statut === "VALIDEE").map((v) => v.montant));
  const versementsEnAttente = somme(d.versements.filter((v) => v.statut === "EN_ATTENTE").map((v) => v.montant));
  const justifie = somme(valides.filter((x) => x.justifiee).map((x) => x.montant));
  const partJustifiee = pctOuNull(justifie, reel);
  const consommation = pctOuNull(reel, budgetRevise);
  const surf = d.surface > 0 ? d.surface : null;

  const a: Analyse = {
    budgetInitial,
    totalAvenants,
    budgetRevise,
    reel,
    enAttente,
    nbEnAttente: attente.length,
    reste: budgetRevise - reel,
    consommation,
    versementsRecus,
    versementsEnAttente,
    tresorerie: versementsRecus - reel,
    parCategorie,
    parLot,
    matrice,
    valeurAcquise: { avancement, tempsEcoule, ev, cpi, eac, vac: eac == null ? null : budgetRevise - eac },
    regression,
    cumul,
    mensuel,
    descriptives,
    pareto: lignesPareto,
    prix,
    anomalies,
    parFournisseur,
    coutM2: {
      reel: surf ? reel / surf : null,
      budget: surf ? budgetRevise / surf : null,
      prevu: surf && eac ? eac / surf : null,
    },
    partJustifiee,
    alertes: [],
  };
  a.alertes = alertes(a, d, aujourdhui);
  return a;
}

function alertes(a: Analyse, d: DonneesProjet, aujourdhui: Date): Alerte[] {
  const l: Alerte[] = [];
  const c = a.consommation;
  if (c != null && c >= SEUILS.consommationCritique) {
    l.push({ niveau: "critique", code: "BUDGET_DEPASSE", titre: "Budget dépassé", detail: `${p1(c)} du budget révisé est consommé : dépassement de ${nf(-a.reste)}.` });
  } else if (c != null && c >= SEUILS.consommationAttention) {
    l.push({ niveau: "attention", code: "BUDGET_80", titre: "Budget presque épuisé", detail: `${p1(c)} du budget révisé est consommé ; il reste ${nf(a.reste)}.` });
  }

  for (const p of a.parCategorie) {
    if (p.revise > 0 && p.ecart > 0) {
      l.push({ niveau: "critique", code: "POSTE_DEPASSE", titre: `Poste dépassé`, detail: `${p.nom} : ${nf(p.reel)} dépensés pour ${nf(p.revise)} prévus (+${nf(p.ecart)}).` });
    }
  }
  const lots = a.parLot.filter((p) => p.revise > 0 && p.ecart > 0).sort((x, y) => y.ecart - x.ecart);
  if (lots.length) {
    l.push({
      niveau: "attention",
      code: "LOT_DEPASSE",
      titre: lots.length > 1 ? `${lots.length} lots dépassent leur budget` : "Lot dépassé",
      detail: `${liste(lots.map((p) => `${p.nom} (+${nf(p.ecart)})`))}.`,
    });
  }

  const va = a.valeurAcquise;
  if (!d.termine && va.eac != null && va.vac != null && va.vac < 0) {
    const depassement = (-va.vac / a.budgetRevise) * 100;
    l.push({
      niveau: depassement > 10 ? "critique" : "attention",
      code: "PREVISION_DEPASSEMENT",
      titre: "Dépassement prévu à l'achèvement",
      detail: `Au rythme actuel (CPI ${va.cpi!.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}), le projet coûterait ${nf(va.eac)}, soit ${p1(depassement)} de plus que le budget.`,
    });
  }
  if (!d.termine && c != null && va.avancement != null && c - va.avancement > SEUILS.ecartAvancement) {
    l.push({
      niveau: "attention",
      code: "DEPENSE_AVANCE_TRAVAUX",
      titre: "Les dépenses vont plus vite que les travaux",
      detail: `${p1(c)} du budget consommé pour ${p1(va.avancement)} des travaux réalisés.`,
    });
  }

  for (const x of a.anomalies.slice(0, 5)) {
    l.push({
      niveau: x.statut === "EN_ATTENTE" ? "attention" : "info",
      code: "PRIX_ANORMAL",
      titre: x.statut === "EN_ATTENTE" ? "Prix inhabituel à vérifier avant validation" : "Prix inhabituel",
      detail: `${x.libelle} : ${nf(x.prixUnitaire)} l'unité pour une moyenne de ${nf(x.moyenne)} (z = ${x.z.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}).`,
    });
  }

  if (a.tresorerie < 0) {
    l.push({ niveau: "critique", code: "TRESORERIE", titre: "Fonds insuffisants", detail: `Les dépenses validées dépassent les versements reçus du client de ${nf(-a.tresorerie)}.` });
  }

  const vieilles = d.depenses.filter((x) => x.statut === "EN_ATTENTE" && (aujourdhui.getTime() - x.creeLe.getTime()) / JOUR_MS > SEUILS.joursAttente);
  if (vieilles.length) {
    l.push({ niveau: "info", code: "ATTENTE", titre: "Dépenses en attente de validation", detail: `${vieilles.length} dépense(s) attendent depuis plus de ${SEUILS.joursAttente} jours.` });
  }

  if (!d.termine && aujourdhui.getTime() > d.dateFinPrevue.getTime()) {
    l.push({ niveau: "attention", code: "RETARD", titre: "Date de fin dépassée", detail: `Fin prévue le ${d.dateFinPrevue.toLocaleDateString("fr-FR", { timeZone: "UTC" })}, travaux non terminés.` });
  }

  if (a.partJustifiee != null && 100 - a.partJustifiee > SEUILS.partNonJustifiee) {
    l.push({ niveau: "info", code: "JUSTIFICATIFS", titre: "Justificatifs manquants", detail: `${p1(100 - a.partJustifiee)} du montant dépensé n'a ni numéro de reçu ni photo.` });
  }

  const ordre = { critique: 0, attention: 1, info: 2 };
  return l.sort((x, y) => ordre[x.niveau] - ordre[y.niveau]);
}
