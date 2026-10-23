import { describe, expect, it } from "vitest";
import { analyser, type DonneesProjet } from "./analyse";

// Petit projet calculé à la main : chaque valeur attendue se refait sur papier.
const j = (jour: number) => new Date(Date.UTC(2026, 0, jour));

function depense(p: Partial<DonneesProjet["depenses"][number]> & { id: number; montant: number }): DonneesProjet["depenses"][number] {
  return {
    lotId: 1,
    categorie: "MATERIAUX",
    articleId: null,
    article: null,
    fournisseur: null,
    libelle: "Achat",
    quantite: 1,
    unite: "u",
    prixUnitaire: p.montant,
    date: j(2),
    statut: "VALIDEE",
    justifiee: true,
    creeLe: j(1),
    ...p,
  };
}

const projet: DonneesProjet = {
  surface: 100,
  dateDebut: j(1),
  dateFinPrevue: j(31),
  termine: false,
  lots: [
    { id: 1, nom: "Fondations", avancement: 50 },
    { id: 2, nom: "Élévation", avancement: 0 },
  ],
  lignes: [
    { id: 1, lotId: 1, categorie: "MATERIAUX", montantInitial: 600_000, avenants: 0 },
    { id: 2, lotId: 1, categorie: "MAIN_OEUVRE", montantInitial: 200_000, avenants: 0 },
    { id: 3, lotId: 2, categorie: "MATERIAUX", montantInitial: 200_000, avenants: 100_000 },
  ],
  depenses: [
    depense({ id: 1, articleId: 1, article: "Ciment", libelle: "Ciment", quantite: 20, prixUnitaire: 5000, montant: 100_000, date: j(2), fournisseur: "Quincaillerie A" }),
    depense({ id: 2, articleId: 1, article: "Ciment", libelle: "Ciment", quantite: 40, prixUnitaire: 5000, montant: 200_000, date: j(5), fournisseur: "Quincaillerie A" }),
    depense({ id: 3, categorie: "MAIN_OEUVRE", libelle: "Journées de maçon", quantite: 10, prixUnitaire: 10_000, montant: 100_000, date: j(8), justifiee: false }),
    depense({ id: 4, lotId: 2, articleId: 2, article: "Fer HA10", libelle: "Fer HA10", quantite: 10, prixUnitaire: 10_000, montant: 100_000, date: j(8), fournisseur: "Quincaillerie B" }),
    depense({ id: 5, articleId: 1, article: "Ciment", libelle: "Ciment", quantite: 10, prixUnitaire: 9000, montant: 90_000, date: j(9), statut: "EN_ATTENTE" }),
  ],
  versements: [
    { montant: 400_000, date: j(1), statut: "VALIDEE" },
    { montant: 300_000, date: j(9), statut: "EN_ATTENTE" },
  ],
};

describe("analyser", () => {
  const a = analyser(projet, j(10));

  it("budget initial, avenants, révisé, réel et reste", () => {
    expect(a.budgetInitial).toBe(1_000_000);
    expect(a.totalAvenants).toBe(100_000);
    expect(a.budgetRevise).toBe(1_100_000);
    expect(a.reel).toBe(500_000);
    expect(a.enAttente).toBe(90_000);
    expect(a.nbEnAttente).toBe(1);
    expect(a.reste).toBe(600_000);
    expect(a.consommation).toBeCloseTo(45.4545, 3);
  });

  it("ventilation par catégorie et par lot", () => {
    const mat = a.parCategorie.find((p) => p.categorie === "MATERIAUX")!;
    expect(mat.revise).toBe(900_000);
    expect(mat.reel).toBe(400_000);
    expect(mat.enAttente).toBe(90_000);
    expect(mat.part).toBeCloseTo(80);
    const lot1 = a.parLot.find((p) => p.lotId === 1)!;
    expect(lot1.revise).toBe(800_000);
    expect(lot1.reel).toBe(400_000);
    expect(lot1.ecart).toBe(-400_000);
  });

  it("valeur acquise : EV, CPI, EAC, VAC", () => {
    const va = a.valeurAcquise;
    expect(va.ev).toBe(400_000);
    expect(va.avancement).toBeCloseTo(36.3636, 3);
    expect(va.cpi).toBeCloseTo(0.8);
    expect(va.eac).toBeCloseTo(1_375_000);
    expect(va.vac).toBeCloseTo(-275_000);
    expect(va.tempsEcoule).toBeCloseTo(30);
  });

  it("régression du coût cumulé : points alignés, R² = 1", () => {
    expect(a.cumul.map((p) => p.cumul)).toEqual([100_000, 300_000, 500_000]);
    const r = a.regression!;
    expect(r.a).toBeCloseTo(200_000 / 3);
    expect(r.b).toBeCloseTo(100_000 / 3);
    expect(r.r2).toBeCloseTo(1);
    expect(r.coutFinal).toBeCloseTo((200_000 / 3) * 30 + 100_000 / 3);
  });

  it("statistique descriptive des montants validés", () => {
    const d = a.descriptives;
    expect(d.n).toBe(4);
    expect(d.moyenne).toBe(125_000);
    expect(d.mediane).toBe(100_000);
    expect(d.ecartType).toBeCloseTo(Math.sqrt(1_875_000_000));
  });

  it("Pareto, fournisseurs, coût au m², justificatifs, trésorerie", () => {
    expect(a.pareto[0]).toMatchObject({ nom: "Ciment", valeur: 300_000, part: 60, classe: "A" });
    expect(a.pareto[2].classe).toBe("B");
    expect(a.parFournisseur[0]).toMatchObject({ nom: "Quincaillerie A", total: 300_000, n: 2 });
    expect(a.coutM2.reel).toBe(5000);
    expect(a.coutM2.budget).toBe(11_000);
    expect(a.partJustifiee).toBeCloseTo(80);
    expect(a.versementsRecus).toBe(400_000);
    expect(a.tresorerie).toBe(-100_000);
  });

  it("alertes attendues, les critiques d'abord", () => {
    const codes = a.alertes.map((x) => x.code);
    expect(codes).toEqual(["PREVISION_DEPASSEMENT", "TRESORERIE", "ATTENTE"]);
    expect(a.alertes[0].niveau).toBe("critique");
  });

  it("prix anormal signalé dès 4 achats validés du même article", () => {
    const prix = [5000, 5000, 5100, 4900, 5000];
    const b = analyser(
      {
        ...projet,
        depenses: [
          ...prix.map((pu, i) => depense({ id: 10 + i, articleId: 1, article: "Ciment", libelle: "Ciment", prixUnitaire: pu, montant: pu * 10 })),
          depense({ id: 20, articleId: 1, article: "Ciment", libelle: "Ciment", prixUnitaire: 9000, montant: 90_000, statut: "EN_ATTENTE" }),
        ],
      },
      j(10),
    );
    expect(b.anomalies).toHaveLength(1);
    expect(b.anomalies[0].depenseId).toBe(20);
    // σ = √4000 ≈ 63,2 FCFA, sous le plancher de 2 % × 5 000 = 100 FCFA : z = 4000 / 100.
    expect(b.anomalies[0].z).toBeCloseTo(40);
    expect(b.alertes.some((x) => x.code === "PRIX_ANORMAL" && x.niveau === "attention")).toBe(true);
  });
});
