import ExcelJS from "exceljs";
import type { Projet, Utilisateur } from "@prisma/client";
import { prisma } from "./db";
import type { Analyse } from "./analyse";
import { CATEGORIES, MODES_PAIEMENT, ROLES, STATUTS, STATUTS_PROJET, TYPES_OUVRAGE } from "./labels";
import type { Session } from "./session";

// Export Excel : les nombres restent des nombres (pas du texte), pour que
// Nourane puisse refaire les calculs et les graphiques dans le tableur.

const ROSE = "FFDB2777";
const FCFA = '#,##0 "FCFA"';
const POURCENT = '0.0" %"';

type Colonne = { titre: string; cle: string; largeur?: number; format?: string };

function feuille(classeur: ExcelJS.Workbook, nom: string, colonnes: Colonne[], lignes: Record<string, unknown>[]) {
  const f = classeur.addWorksheet(nom, { views: [{ state: "frozen", ySplit: 1 }] });
  f.columns = colonnes.map((c) => ({ header: c.titre, key: c.cle, width: c.largeur ?? Math.max(12, c.titre.length + 2), style: c.format ? { numFmt: c.format } : {} }));
  const entete = f.getRow(1);
  entete.font = { bold: true, color: { argb: "FFFFFFFF" } };
  entete.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROSE } };
  entete.alignment = { vertical: "middle", wrapText: true };
  entete.height = 30;
  for (const l of lignes) f.addRow(l);
  if (lignes.length) f.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colonnes.length } };
  return f;
}

const nom = (u: Pick<Utilisateur, "prenom" | "nom"> | null | undefined) => (u ? `${u.prenom} ${u.nom}` : "");
const arrondi = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Classeur complet d'un projet : synthèse, budget, dépenses, analyses, versements, avancement (et journal pour l'ingénieure). */
export async function classeurProjet(p: Projet & { client: Utilisateur; chef: Utilisateur | null }, a: Analyse, s: Session) {
  const client = s.role === "CLIENT";
  const [depenses, versements, lots, journal] = await Promise.all([
    prisma.depense.findMany({
      where: { projetId: p.id, ...(client ? { statut: "VALIDEE" } : {}) },
      orderBy: [{ date: "asc" }, { id: "asc" }],
      include: { lot: true, article: true, fournisseur: true, auteur: true, decidePar: true },
    }),
    prisma.versement.findMany({ where: { projetId: p.id }, orderBy: { date: "asc" } }),
    prisma.lot.findMany({ where: { projetId: p.id }, orderBy: { ordre: "asc" } }),
    s.role === "INGENIEUR" ? prisma.journal.findMany({ where: { projetId: p.id }, orderBy: { date: "asc" }, include: { auteur: true } }) : Promise.resolve([]),
  ]);

  const c = new ExcelJS.Workbook();
  c.creator = "Nourane Génie Civil";
  c.created = new Date();

  const va = a.valeurAcquise;
  const synthese = feuille(
    c,
    "Synthèse",
    [
      { titre: "Indicateur", cle: "k", largeur: 42 },
      { titre: "Valeur", cle: "v", largeur: 28 },
    ],
    [
      { k: "Projet", v: `${p.nom} (${p.code})` },
      { k: "Type d'ouvrage", v: TYPES_OUVRAGE[p.type] },
      { k: "Localisation", v: p.localisation },
      { k: "Surface bâtie (m²)", v: p.surface },
      { k: "Statut", v: STATUTS_PROJET[p.statut] },
      { k: "Début", v: p.dateDebut },
      { k: "Fin prévue", v: p.dateFinPrevue },
      { k: "Client", v: nom(p.client) },
      { k: "Chef de chantier", v: nom(p.chef) },
      { k: "Budget initial", v: a.budgetInitial },
      { k: "Avenants", v: a.totalAvenants },
      { k: "Budget révisé", v: a.budgetRevise },
      { k: "Dépenses validées", v: a.reel },
      ...(client ? [] : [{ k: "Dépenses en attente", v: a.enAttente }]),
      { k: "Budget restant", v: a.reste },
      { k: "Budget consommé (%)", v: arrondi(a.consommation, 1) },
      { k: "Avancement global des travaux (%)", v: arrondi(va.avancement, 1) },
      { k: "Valeur acquise (EV)", v: Math.round(va.ev) },
      { k: "Indice de performance des coûts (CPI)", v: arrondi(va.cpi, 3) },
      { k: "Coût estimé à l'achèvement (EAC)", v: arrondi(va.eac, 0) },
      { k: "Écart à l'achèvement (VAC)", v: arrondi(va.vac, 0) },
      { k: "Coût prévu à la fin (régression)", v: arrondi(a.regression?.coutFinal, 0) },
      { k: "Coût au m² réel", v: arrondi(a.coutM2.reel, 0) },
      { k: "Coût au m² budgété", v: arrondi(a.coutM2.budget, 0) },
      { k: "Versements reçus du client", v: a.versementsRecus },
      { k: "Trésorerie (versements − dépenses)", v: a.tresorerie },
      { k: "Extrait le", v: new Date() },
    ],
  );
  synthese.getColumn("v").eachCell((cell, i) => {
    if (i > 1 && typeof cell.value === "number" && Math.abs(cell.value) >= 1000) cell.numFmt = FCFA;
    if (cell.value instanceof Date) cell.numFmt = "dd/mm/yyyy";
  });

  const lotNom = new Map(lots.map((l) => [l.id, l.nom]));
  feuille(
    c,
    "Budget",
    [
      { titre: "Lot", cle: "lot", largeur: 28 },
      { titre: "Catégorie", cle: "cat", largeur: 22 },
      { titre: "Budget initial", cle: "initial", format: FCFA, largeur: 18 },
      { titre: "Avenants", cle: "avenants", format: FCFA, largeur: 16 },
      { titre: "Budget révisé", cle: "revise", format: FCFA, largeur: 18 },
      { titre: "Dépensé", cle: "reel", format: FCFA, largeur: 18 },
      { titre: "Écart (dépensé − révisé)", cle: "ecart", format: FCFA, largeur: 20 },
      { titre: "Consommé (%)", cle: "pct", format: POURCENT },
    ],
    a.matrice.map((m) => ({
      lot: lotNom.get(m.lotId),
      cat: CATEGORIES[m.categorie],
      initial: m.initial,
      avenants: m.revise - m.initial,
      revise: m.revise,
      reel: m.reel,
      ecart: m.reel - m.revise,
      pct: m.revise ? arrondi((m.reel / m.revise) * 100, 1) : null,
    })),
  );

  feuille(
    c,
    "Dépenses",
    [
      { titre: "N°", cle: "id", largeur: 7 },
      { titre: "Date", cle: "date", format: "dd/mm/yyyy" },
      { titre: "Lot", cle: "lot", largeur: 24 },
      { titre: "Catégorie", cle: "cat", largeur: 20 },
      { titre: "Article", cle: "article", largeur: 26 },
      { titre: "Libellé", cle: "libelle", largeur: 30 },
      { titre: "Quantité", cle: "q", format: "#,##0.##" },
      { titre: "Unité", cle: "u" },
      { titre: "Prix unitaire", cle: "pu", format: FCFA, largeur: 16 },
      { titre: "Montant", cle: "m", format: FCFA, largeur: 18 },
      { titre: "Fournisseur", cle: "f", largeur: 22 },
      { titre: "N° de reçu", cle: "ref" },
      { titre: "Photo", cle: "photo", largeur: 8 },
      { titre: "Statut", cle: "statut" },
      { titre: "Motif", cle: "motif", largeur: 26 },
      { titre: "Saisie par", cle: "auteur", largeur: 20 },
      { titre: "Décidée par", cle: "decideur", largeur: 20 },
    ],
    depenses.map((d) => ({
      id: d.id,
      date: d.date,
      lot: d.lot.nom,
      cat: CATEGORIES[d.categorie],
      article: d.article?.designation ?? "",
      libelle: d.libelle,
      q: d.quantite,
      u: d.unite,
      pu: d.prixUnitaire,
      m: d.montant,
      f: d.fournisseur?.nom ?? "",
      ref: d.reference ?? "",
      photo: d.fichierCle ? "oui" : "",
      statut: STATUTS[d.statut],
      motif: d.motif ?? "",
      auteur: nom(d.auteur),
      decideur: nom(d.decidePar),
    })),
  );

  feuille(
    c,
    "Par catégorie",
    [
      { titre: "Catégorie", cle: "cat", largeur: 24 },
      { titre: "Budget révisé", cle: "revise", format: FCFA, largeur: 18 },
      { titre: "Dépensé", cle: "reel", format: FCFA, largeur: 18 },
      { titre: "Écart", cle: "ecart", format: FCFA, largeur: 18 },
      { titre: "Consommé (%)", cle: "conso", format: POURCENT },
      { titre: "Part du total (%)", cle: "part", format: POURCENT },
    ],
    a.parCategorie.map((x) => ({ cat: CATEGORIES[x.categorie], revise: x.revise, reel: x.reel, ecart: x.ecart, conso: arrondi(x.consommation, 1), part: arrondi(x.part, 1) })),
  );

  feuille(
    c,
    "Par mois",
    [
      { titre: "Mois", cle: "mois" },
      ...Object.entries(CATEGORIES).map(([k, v]) => ({ titre: v, cle: k, format: FCFA, largeur: 18 })),
      { titre: "Total du mois", cle: "total", format: FCFA, largeur: 18 },
      { titre: "Cumul", cle: "cumul", format: FCFA, largeur: 18 },
    ],
    a.mensuel.map((m) => ({ mois: m.mois, ...m.parCategorie, total: m.total, cumul: m.cumul })),
  );

  feuille(
    c,
    "Pareto",
    [
      { titre: "Rang", cle: "rang", largeur: 7 },
      { titre: "Article ou libellé", cle: "nom", largeur: 34 },
      { titre: "Montant", cle: "valeur", format: FCFA, largeur: 18 },
      { titre: "Part (%)", cle: "part", format: POURCENT },
      { titre: "Part cumulée (%)", cle: "cumul", format: POURCENT },
      { titre: "Classe", cle: "classe" },
    ],
    a.pareto.map((l, i) => ({ rang: i + 1, nom: l.nom, valeur: l.valeur, part: arrondi(l.part, 1), cumul: arrondi(l.partCumulee, 1), classe: l.classe })),
  );

  feuille(
    c,
    "Prix unitaires",
    [
      { titre: "Article", cle: "article", largeur: 34 },
      { titre: "Unité", cle: "unite" },
      { titre: "Achats", cle: "n" },
      { titre: "Prix moyen", cle: "moy", format: FCFA, largeur: 16 },
      { titre: "Min", cle: "min", format: FCFA, largeur: 16 },
      { titre: "Max", cle: "max", format: FCFA, largeur: 16 },
      { titre: "Écart-type", cle: "et", format: FCFA, largeur: 16 },
      { titre: "CV (%)", cle: "cv", format: POURCENT },
      { titre: "Variation 1er → dernier (%)", cle: "var", format: POURCENT, largeur: 16 },
    ],
    a.prix.map((x) => ({ article: x.article, unite: x.unite, n: x.n, moy: Math.round(x.moyenne), min: x.min, max: x.max, et: arrondi(x.ecartType, 0), cv: arrondi(x.cv, 1), var: arrondi(x.variation, 1) })),
  );

  feuille(
    c,
    "Avancement",
    [
      { titre: "Lot", cle: "lot", largeur: 28 },
      { titre: "Budget révisé", cle: "revise", format: FCFA, largeur: 18 },
      { titre: "Réalisé (%)", cle: "av", format: POURCENT },
      { titre: "Valeur acquise", cle: "ev", format: FCFA, largeur: 18 },
      { titre: "Dépensé", cle: "reel", format: FCFA, largeur: 18 },
      { titre: "Consommé (%)", cle: "conso", format: POURCENT },
    ],
    a.parLot.map((l) => ({ lot: l.nom, revise: l.revise, av: l.avancement, ev: Math.round((l.revise * l.avancement) / 100), reel: l.reel, conso: arrondi(l.consommation, 1) })),
  );

  feuille(
    c,
    "Versements",
    [
      { titre: "Date", cle: "date", format: "dd/mm/yyyy" },
      { titre: "Montant", cle: "m", format: FCFA, largeur: 18 },
      { titre: "Mode", cle: "mode", largeur: 16 },
      { titre: "Référence", cle: "ref", largeur: 20 },
      { titre: "Statut", cle: "statut" },
    ],
    versements.map((v) => ({ date: v.date, m: v.montant, mode: MODES_PAIEMENT[v.mode], ref: v.reference ?? "", statut: v.statut === "VALIDEE" ? "Reçu" : STATUTS[v.statut] })),
  );

  if (journal.length) {
    feuille(
      c,
      "Journal",
      [
        { titre: "Date et heure", cle: "date", format: "dd/mm/yyyy hh:mm", largeur: 18 },
        { titre: "Utilisateur", cle: "auteur", largeur: 22 },
        { titre: "Rôle", cle: "role", largeur: 16 },
        { titre: "Opération", cle: "action" },
        { titre: "Détail", cle: "resume", largeur: 80 },
      ],
      journal.map((j) => ({ date: j.date, auteur: nom(j.auteur), role: ROLES[j.auteur.role], action: j.action, resume: j.resume })),
    );
  }

  return Buffer.from(await c.xlsx.writeBuffer());
}

/** Classeur de comparaison de tous les projets (ingénieure). */
export async function classeurComparaison(lignes: { p: Projet; a: Analyse }[]) {
  const c = new ExcelJS.Workbook();
  c.creator = "Nourane Génie Civil";
  feuille(
    c,
    "Projets",
    [
      { titre: "Code", cle: "code" },
      { titre: "Projet", cle: "nom", largeur: 28 },
      { titre: "Type", cle: "type", largeur: 20 },
      { titre: "Surface (m²)", cle: "surface" },
      { titre: "Statut", cle: "statut" },
      { titre: "Budget révisé", cle: "budget", format: FCFA, largeur: 18 },
      { titre: "Dépensé", cle: "reel", format: FCFA, largeur: 18 },
      { titre: "Consommé (%)", cle: "conso", format: POURCENT },
      { titre: "Réalisé (%)", cle: "av", format: POURCENT },
      { titre: "CPI", cle: "cpi", format: "0.000" },
      { titre: "Coût estimé à l'achèvement", cle: "eac", format: FCFA, largeur: 20 },
      { titre: "Coût/m² réel", cle: "m2", format: FCFA, largeur: 16 },
      { titre: "Coût/m² budgété", cle: "m2b", format: FCFA, largeur: 16 },
      { titre: "Coût/m² estimé", cle: "m2e", format: FCFA, largeur: 16 },
      ...Object.entries(CATEGORIES).map(([k, v]) => ({ titre: `${v} (FCFA)`, cle: k, format: FCFA, largeur: 18 })),
    ],
    lignes.map(({ p, a }) => ({
      code: p.code,
      nom: p.nom,
      type: TYPES_OUVRAGE[p.type],
      surface: p.surface,
      statut: STATUTS_PROJET[p.statut],
      budget: a.budgetRevise,
      reel: a.reel,
      conso: arrondi(a.consommation, 1),
      av: arrondi(a.valeurAcquise.avancement, 1),
      cpi: arrondi(a.valeurAcquise.cpi, 3),
      eac: arrondi(a.valeurAcquise.eac, 0),
      m2: arrondi(a.coutM2.reel, 0),
      m2b: arrondi(a.coutM2.budget, 0),
      m2e: arrondi(a.coutM2.prevu, 0),
      ...Object.fromEntries(a.parCategorie.map((x) => [x.categorie, x.reel])),
    })),
  );
  return Buffer.from(await c.xlsx.writeBuffer());
}
