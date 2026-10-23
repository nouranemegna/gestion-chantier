/**
 * Données de démonstration : quatre chantiers fictifs au Cameroun, avec des prix
 * courants (ciment, fer, sable, journées d'ouvriers…), pour que chaque écran et
 * chaque statistique ait de quoi s'afficher.
 *
 *   npm run db:seed                    refuse si la base contient déjà des projets
 *   npm run db:seed -- --reinitialiser efface tout, puis recharge
 *
 * Les tirages sont pseudo-aléatoires mais reproductibles (graine fixe) : deux
 * chargements donnent exactement les mêmes chiffres.
 */
import { PrismaClient, type Categorie, type Prisma, type Statut } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const MOT_DE_PASSE = "Nourane2026";
const JOUR = 86_400_000;
const AUJOURDHUI = (() => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
})();

// Générateur pseudo-aléatoire à graine (mulberry32).
let graine = 20261019;
function alea() {
  graine |= 0;
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a: number, b: number) => a + (b - a) * alea();
/** Loi normale par Box-Muller : bruit des prix autour du prix de référence. */
const normale = (m: number, s: number) => m + s * Math.sqrt(-2 * Math.log(alea() || 1e-9)) * Math.cos(2 * Math.PI * alea());
const choisir = <T,>(t: T[]) => t[Math.floor(alea() * t.length)];
const jourUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const d = (s: string) => new Date(`${s}T00:00:00Z`);

function hacher(m: string) {
  const sel = randomBytes(16).toString("hex");
  return `${sel}:${scryptSync(m, sel, 64).toString("hex")}`;
}

/* ───────────── Catalogue ───────────── */

const ARTICLES: { designation: string; unite: string; categorie: Categorie; prix: number }[] = [
  { designation: "Ciment CPJ 42,5 (sac de 50 kg)", unite: "sac", categorie: "MATERIAUX", prix: 5500 },
  { designation: "Sable de rivière", unite: "m³", categorie: "MATERIAUX", prix: 13000 },
  { designation: "Gravier 15/25", unite: "m³", categorie: "MATERIAUX", prix: 22000 },
  { designation: "Fer HA8 (barre de 12 m)", unite: "barre", categorie: "MATERIAUX", prix: 3300 },
  { designation: "Fer HA10 (barre de 12 m)", unite: "barre", categorie: "MATERIAUX", prix: 4800 },
  { designation: "Fer HA12 (barre de 12 m)", unite: "barre", categorie: "MATERIAUX", prix: 6900 },
  { designation: "Parpaing creux de 15", unite: "unité", categorie: "MATERIAUX", prix: 400 },
  { designation: "Parpaing creux de 20", unite: "unité", categorie: "MATERIAUX", prix: 500 },
  { designation: "Planche de coffrage", unite: "unité", categorie: "MATERIAUX", prix: 2500 },
  { designation: "Bois de charpente (chevron 8/8)", unite: "unité", categorie: "MATERIAUX", prix: 3200 },
  { designation: "Tôle bac aluminium 6/10", unite: "feuille", categorie: "MATERIAUX", prix: 9500 },
  { designation: "Carreaux de sol 40 × 40", unite: "m²", categorie: "MATERIAUX", prix: 6500 },
  { designation: "Peinture à eau (seau de 25 kg)", unite: "seau", categorie: "MATERIAUX", prix: 32000 },
  { designation: "Tuyau PVC Ø100 (barre de 4 m)", unite: "barre", categorie: "MATERIAUX", prix: 7500 },
  { designation: "Câble électrique 2,5 mm² (rouleau de 100 m)", unite: "rouleau", categorie: "MATERIAUX", prix: 38000 },
  { designation: "Porte isoplane", unite: "unité", categorie: "MATERIAUX", prix: 45000 },
  { designation: "Fenêtre aluminium vitrée", unite: "unité", categorie: "MATERIAUX", prix: 85000 },
  { designation: "Appareils sanitaires (lot)", unite: "lot", categorie: "MATERIAUX", prix: 120000 },
  { designation: "Journée de maçon", unite: "jour", categorie: "MAIN_OEUVRE", prix: 7000 },
  { designation: "Journée de manœuvre", unite: "jour", categorie: "MAIN_OEUVRE", prix: 3500 },
  { designation: "Journée de ferrailleur", unite: "jour", categorie: "MAIN_OEUVRE", prix: 7000 },
  { designation: "Journée de menuisier-charpentier", unite: "jour", categorie: "MAIN_OEUVRE", prix: 8000 },
  { designation: "Journée de plombier", unite: "jour", categorie: "MAIN_OEUVRE", prix: 8000 },
  { designation: "Journée d'électricien", unite: "jour", categorie: "MAIN_OEUVRE", prix: 8000 },
  { designation: "Journée de carreleur", unite: "jour", categorie: "MAIN_OEUVRE", prix: 7500 },
  { designation: "Journée de peintre", unite: "jour", categorie: "MAIN_OEUVRE", prix: 6000 },
  { designation: "Voyage de camion benne (10 m³)", unite: "voyage", categorie: "TRANSPORT", prix: 35000 },
  { designation: "Transport de matériaux (camionnette)", unite: "voyage", categorie: "TRANSPORT", prix: 15000 },
  { designation: "Location de bétonnière", unite: "jour", categorie: "LOCATION_EQUIPEMENT", prix: 15000 },
  { designation: "Location de vibreur à béton", unite: "jour", categorie: "LOCATION_EQUIPEMENT", prix: 10000 },
  { designation: "Location d'étais métalliques (lot de 50)", unite: "jour", categorie: "LOCATION_EQUIPEMENT", prix: 20000 },
  { designation: "Location de pelle mécanique", unite: "heure", categorie: "LOCATION_EQUIPEMENT", prix: 45000 },
  { designation: "Gardiennage du chantier", unite: "mois", categorie: "AUTRES", prix: 60000 },
  { designation: "Eau et électricité de chantier", unite: "mois", categorie: "AUTRES", prix: 25000 },
  { designation: "Petit outillage et consommables", unite: "lot", categorie: "AUTRES", prix: 18000 },
];

const FOURNISSEURS = [
  { nom: "Quincaillerie du Centre", activite: "Quincaillerie", telephone: "699112233" },
  { nom: "Cimencam Dépôt Mvan", activite: "Ciment", telephone: "677223344" },
  { nom: "Aciéries du Littoral", activite: "Fers à béton", telephone: "655334455" },
  { nom: "Carrière de Nkometou", activite: "Sable et gravier", telephone: "690445566" },
  { nom: "Transports Abena", activite: "Transport", telephone: "698556677" },
  { nom: "Loc'Matériel BTP", activite: "Location d'engins", telephone: "676667788" },
  { nom: "Menuiserie Alu Moderne", activite: "Menuiseries", telephone: "694778899" },
  { nom: "Elec Plus Douala", activite: "Électricité et plomberie", telephone: "651889900" },
];

// Fournisseur habituel de chaque famille d'articles.
function fournisseurPour(article: string): string | null {
  if (/Ciment/.test(article)) return choisir(["Cimencam Dépôt Mvan", "Quincaillerie du Centre"]);
  if (/Fer/.test(article)) return choisir(["Aciéries du Littoral", "Quincaillerie du Centre"]);
  if (/Sable|Gravier/.test(article)) return "Carrière de Nkometou";
  if (/Voyage|Transport/.test(article)) return "Transports Abena";
  if (/Location/.test(article)) return "Loc'Matériel BTP";
  if (/Porte|Fenêtre|charpente/.test(article)) return "Menuiserie Alu Moderne";
  if (/Câble|PVC|sanitaires/.test(article)) return "Elec Plus Douala";
  if (/Journée|Gardiennage|Eau/.test(article)) return null;
  return "Quincaillerie du Centre";
}

/* ───────────── Lots : part du budget, ventilation et articles achetés ───────────── */

type Profil = { part: number; fenetre: [number, number]; cat: Partial<Record<Categorie, number>>; articles: Partial<Record<Categorie, string[]>> };
const LOTS: Record<string, Profil> = {
  "Installation de chantier": { part: 0.03, fenetre: [0, 0.05], cat: { MATERIAUX: 0.3, MAIN_OEUVRE: 0.2, TRANSPORT: 0.2, AUTRES: 0.3 }, articles: { MATERIAUX: ["Planche de coffrage"], MAIN_OEUVRE: ["Journée de manœuvre"], TRANSPORT: ["Transport de matériaux (camionnette)"], AUTRES: ["Gardiennage du chantier", "Eau et électricité de chantier", "Petit outillage et consommables"] } },
  Terrassement: { part: 0.05, fenetre: [0.03, 0.1], cat: { MAIN_OEUVRE: 0.35, TRANSPORT: 0.3, LOCATION_EQUIPEMENT: 0.35 }, articles: { MAIN_OEUVRE: ["Journée de manœuvre"], TRANSPORT: ["Voyage de camion benne (10 m³)"], LOCATION_EQUIPEMENT: ["Location de pelle mécanique"] } },
  Fondations: { part: 0.14, fenetre: [0.08, 0.25], cat: { MATERIAUX: 0.62, MAIN_OEUVRE: 0.2, TRANSPORT: 0.08, LOCATION_EQUIPEMENT: 0.07, AUTRES: 0.03 }, articles: { MATERIAUX: ["Ciment CPJ 42,5 (sac de 50 kg)", "Sable de rivière", "Gravier 15/25", "Fer HA10 (barre de 12 m)", "Fer HA12 (barre de 12 m)", "Fer HA8 (barre de 12 m)", "Parpaing creux de 20"], MAIN_OEUVRE: ["Journée de maçon", "Journée de ferrailleur", "Journée de manœuvre"], TRANSPORT: ["Voyage de camion benne (10 m³)"], LOCATION_EQUIPEMENT: ["Location de bétonnière", "Location de vibreur à béton"], AUTRES: ["Petit outillage et consommables"] } },
  "Élévation des murs": { part: 0.17, fenetre: [0.2, 0.45], cat: { MATERIAUX: 0.62, MAIN_OEUVRE: 0.26, TRANSPORT: 0.06, LOCATION_EQUIPEMENT: 0.04, AUTRES: 0.02 }, articles: { MATERIAUX: ["Parpaing creux de 15", "Ciment CPJ 42,5 (sac de 50 kg)", "Sable de rivière", "Fer HA10 (barre de 12 m)", "Fer HA8 (barre de 12 m)"], MAIN_OEUVRE: ["Journée de maçon", "Journée de manœuvre"], TRANSPORT: ["Transport de matériaux (camionnette)"], LOCATION_EQUIPEMENT: ["Location de bétonnière"], AUTRES: ["Gardiennage du chantier"] } },
  "Dalle et planchers": { part: 0.14, fenetre: [0.35, 0.55], cat: { MATERIAUX: 0.6, MAIN_OEUVRE: 0.2, TRANSPORT: 0.05, LOCATION_EQUIPEMENT: 0.12, AUTRES: 0.03 }, articles: { MATERIAUX: ["Ciment CPJ 42,5 (sac de 50 kg)", "Gravier 15/25", "Sable de rivière", "Fer HA12 (barre de 12 m)", "Fer HA10 (barre de 12 m)", "Planche de coffrage"], MAIN_OEUVRE: ["Journée de maçon", "Journée de ferrailleur", "Journée de manœuvre"], TRANSPORT: ["Voyage de camion benne (10 m³)"], LOCATION_EQUIPEMENT: ["Location d'étais métalliques (lot de 50)", "Location de bétonnière", "Location de vibreur à béton"], AUTRES: ["Eau et électricité de chantier"] } },
  "Charpente et toiture": { part: 0.09, fenetre: [0.5, 0.65], cat: { MATERIAUX: 0.7, MAIN_OEUVRE: 0.22, TRANSPORT: 0.05, AUTRES: 0.03 }, articles: { MATERIAUX: ["Tôle bac aluminium 6/10", "Bois de charpente (chevron 8/8)"], MAIN_OEUVRE: ["Journée de menuisier-charpentier", "Journée de manœuvre"], TRANSPORT: ["Transport de matériaux (camionnette)"], AUTRES: ["Petit outillage et consommables"] } },
  Menuiseries: { part: 0.09, fenetre: [0.6, 0.85], cat: { MATERIAUX: 0.78, MAIN_OEUVRE: 0.17, TRANSPORT: 0.05 }, articles: { MATERIAUX: ["Fenêtre aluminium vitrée", "Porte isoplane"], MAIN_OEUVRE: ["Journée de menuisier-charpentier"], TRANSPORT: ["Transport de matériaux (camionnette)"] } },
  "Plomberie et sanitaires": { part: 0.07, fenetre: [0.55, 0.85], cat: { MATERIAUX: 0.7, MAIN_OEUVRE: 0.27, TRANSPORT: 0.03 }, articles: { MATERIAUX: ["Tuyau PVC Ø100 (barre de 4 m)", "Appareils sanitaires (lot)"], MAIN_OEUVRE: ["Journée de plombier"], TRANSPORT: ["Transport de matériaux (camionnette)"] } },
  "Électricité": { part: 0.07, fenetre: [0.55, 0.85], cat: { MATERIAUX: 0.68, MAIN_OEUVRE: 0.3, AUTRES: 0.02 }, articles: { MATERIAUX: ["Câble électrique 2,5 mm² (rouleau de 100 m)"], MAIN_OEUVRE: ["Journée d'électricien"], AUTRES: ["Petit outillage et consommables"] } },
  "Enduits et revêtements": { part: 0.09, fenetre: [0.65, 0.9], cat: { MATERIAUX: 0.65, MAIN_OEUVRE: 0.3, TRANSPORT: 0.05 }, articles: { MATERIAUX: ["Carreaux de sol 40 × 40", "Ciment CPJ 42,5 (sac de 50 kg)", "Sable de rivière"], MAIN_OEUVRE: ["Journée de carreleur", "Journée de maçon"], TRANSPORT: ["Transport de matériaux (camionnette)"] } },
  "Peinture et finitions": { part: 0.06, fenetre: [0.85, 1], cat: { MATERIAUX: 0.6, MAIN_OEUVRE: 0.38, AUTRES: 0.02 }, articles: { MATERIAUX: ["Peinture à eau (seau de 25 kg)"], MAIN_OEUVRE: ["Journée de peintre"], AUTRES: ["Petit outillage et consommables"] } },
};

/* ───────────── Projets ───────────── */

interface Scenario {
  code: string;
  nom: string;
  description: string;
  localisation: string;
  type: "MAISON_INDIVIDUELLE" | "IMMEUBLE" | "BATIMENT_COMMERCIAL";
  surface: number;
  niveaux: number;
  debut: string;
  fin: string;
  finReelle?: string;
  statut: "PREPARATION" | "EN_COURS" | "TERMINE";
  budget: number;
  client: string;
  chef: string;
  /** Rythme réel / rythme prévu : < 1 = retard. */
  vitesse: number;
  /** Coût réel / coût prévu, par catégorie. */
  surcout: Partial<Record<Categorie, number>>;
  /** Part du budget versée par le client, par tranche. */
  tranches: number[];
  avenants: { lot: string; categorie: Categorie; montant: number; motif: string; date: string }[];
}

const SCENARIOS: Scenario[] = [
  {
    code: "PRJ-2025-001",
    nom: "Maison plain-pied Mfou",
    description: "Maison de 3 chambres, salon, cuisine et 2 salles d'eau, sur un terrain de 400 m².",
    localisation: "Mfou",
    type: "MAISON_INDIVIDUELLE",
    surface: 110,
    niveaux: 1,
    debut: "2025-11-03",
    fin: "2026-06-30",
    finReelle: "2026-07-17",
    statut: "TERMINE",
    budget: 32_000_000,
    client: "690000003",
    chef: "690000010",
    vitesse: 0.93,
    surcout: { MATERIAUX: 1.07, MAIN_OEUVRE: 1.02, TRANSPORT: 1.1, LOCATION_EQUIPEMENT: 0.95, AUTRES: 1 },
    tranches: [0.3, 0.25, 0.25, 0.27],
    avenants: [
      { lot: "Fondations", categorie: "MATERIAUX", montant: 650_000, motif: "Sol argileux : semelles élargies après l'étude géotechnique", date: "2026-01-12" },
      { lot: "Charpente et toiture", categorie: "MATERIAUX", montant: 420_000, motif: "Hausse du prix de la tôle aluminium", date: "2026-03-20" },
    ],
  },
  {
    code: "PRJ-2026-002",
    nom: "Villa R+1 Odza",
    description: "Villa de 5 chambres sur deux niveaux, dalle en béton armé, terrasse couverte.",
    localisation: "Yaoundé, Odza",
    type: "MAISON_INDIVIDUELLE",
    surface: 220,
    niveaux: 2,
    debut: "2026-04-06",
    fin: "2026-12-18",
    statut: "EN_COURS",
    budget: 78_000_000,
    client: "690000002",
    chef: "690000010",
    vitesse: 0.86,
    surcout: { MATERIAUX: 1.09, MAIN_OEUVRE: 1.04, TRANSPORT: 1.12, LOCATION_EQUIPEMENT: 1.0, AUTRES: 0.95 },
    tranches: [0.3, 0.25, 0.2, 0.15],
    avenants: [{ lot: "Dalle et planchers", categorie: "MATERIAUX", montant: 1_800_000, motif: "Terrasse ajoutée à la demande du client", date: "2026-07-08" }],
  },
  {
    code: "PRJ-2026-003",
    nom: "Immeuble R+3 Bonamoussadi",
    description: "Immeuble de 8 appartements sur 4 niveaux, structure poteaux-poutres en béton armé.",
    localisation: "Douala, Bonamoussadi",
    type: "IMMEUBLE",
    surface: 640,
    niveaux: 4,
    debut: "2026-06-01",
    fin: "2027-08-30",
    statut: "EN_COURS",
    budget: 235_000_000,
    client: "690000004",
    chef: "690000011",
    vitesse: 0.92,
    surcout: { MATERIAUX: 1.2, MAIN_OEUVRE: 1.08, TRANSPORT: 1.25, LOCATION_EQUIPEMENT: 1.15, AUTRES: 1.05 },
    tranches: [0.15, 0.1, 0.08],
    avenants: [],
  },
  {
    code: "PRJ-2026-004",
    nom: "Boutique Mvog-Mbi",
    description: "Local commercial de plain-pied avec réserve et sanitaires.",
    localisation: "Yaoundé, Mvog-Mbi",
    type: "BATIMENT_COMMERCIAL",
    surface: 85,
    niveaux: 1,
    debut: "2026-11-09",
    fin: "2027-04-30",
    statut: "PREPARATION",
    budget: 24_500_000,
    client: "690000003",
    chef: "690000011",
    vitesse: 1,
    surcout: {},
    tranches: [],
    avenants: [],
  },
];

/* ───────────── Chargement ───────────── */

async function main() {
  const reinitialiser = process.argv.includes("--reinitialiser");
  if ((await prisma.projet.count()) > 0) {
    if (!reinitialiser) {
      console.log("La base contient déjà des projets. Pour tout effacer et recharger : npm run db:seed -- --reinitialiser");
      return;
    }
    console.log("Effacement des données…");
    await prisma.$transaction([
      prisma.journal.deleteMany(),
      prisma.releve.deleteMany(),
      prisma.versement.deleteMany(),
      prisma.depense.deleteMany(),
      prisma.avenant.deleteMany(),
      prisma.ligneBudget.deleteMany(),
      prisma.lot.deleteMany(),
      prisma.projet.deleteMany(),
      prisma.article.deleteMany(),
      prisma.fournisseur.deleteMany(),
      prisma.utilisateur.deleteMany(),
    ]);
  }

  const hache = hacher(MOT_DE_PASSE);
  const comptes = [
    { prenom: "Nourane", nom: "", telephone: "690000001", role: "INGENIEUR" as const, email: "ingenieure@exemple.cm" },
    { prenom: "Jean", nom: "Fotso", telephone: "690000002", role: "CLIENT" as const },
    { prenom: "Aïcha", nom: "Bello", telephone: "690000003", role: "CLIENT" as const },
    { prenom: "Patrice", nom: "Ekané", telephone: "690000004", role: "CLIENT" as const },
    { prenom: "Paul", nom: "Ndongo", telephone: "690000010", role: "CHEF_CHANTIER" as const },
    { prenom: "Serge", nom: "Mbarga", telephone: "690000011", role: "CHEF_CHANTIER" as const },
  ];
  const users = await prisma.utilisateur.createManyAndReturn({ data: comptes.map((c) => ({ ...c, motDePasseHash: hache })) });
  const parTel = new Map(users.map((u) => [u.telephone, u]));
  const ing = parTel.get("690000001")!;

  const articles = await prisma.article.createManyAndReturn({ data: ARTICLES.map(({ prix: _p, ...a }) => a) });
  const article = new Map(articles.map((a) => [a.designation, a]));
  const prixRef = new Map(ARTICLES.map((a) => [a.designation, a.prix]));
  const fournisseurs = await prisma.fournisseur.createManyAndReturn({ data: FOURNISSEURS });
  const fournisseur = new Map(fournisseurs.map((f) => [f.nom, f]));

  const journal: { date: Date; auteurId: number; projetId: number | null; action: string; entite: string; entiteId: number | null; resume: string }[] = [];
  const nf = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} FCFA`;

  for (const sc of SCENARIOS) {
    const debut = d(sc.debut);
    const fin = d(sc.fin);
    const duree = (fin.getTime() - debut.getTime()) / JOUR;
    const client = parTel.get(sc.client)!;
    const chef = parTel.get(sc.chef)!;
    const termine = sc.statut === "TERMINE";
    const finActivite = termine ? d(sc.finReelle!) : AUJOURDHUI;

    const projet = await prisma.projet.create({
      data: {
        code: sc.code,
        nom: sc.nom,
        description: sc.description,
        localisation: sc.localisation,
        type: sc.type,
        surface: sc.surface,
        niveaux: sc.niveaux,
        dateDebut: debut,
        dateFinPrevue: fin,
        dateFinReelle: termine ? d(sc.finReelle!) : null,
        statut: sc.statut,
        clientId: client.id,
        chefId: chef.id,
        creeParId: ing.id,
        creeLe: new Date(debut.getTime() - 21 * JOUR),
      },
    });
    journal.push({ date: new Date(debut.getTime() - 21 * JOUR), auteurId: ing.id, projetId: projet.id, action: "CREER", entite: "Projet", entiteId: projet.id, resume: `Projet créé : ${sc.nom} (${sc.code}), ${Object.keys(LOTS).length} lots` });

    // Lots et budget ventilé : arrondis à 10 000 FCFA, comme un devis.
    const lots = await prisma.lot.createManyAndReturn({ data: Object.keys(LOTS).map((nom, ordre) => ({ projetId: projet.id, nom, ordre })) });
    const lignesData: { projetId: number; lotId: number; categorie: Categorie; montantInitial: number }[] = [];
    for (const lot of lots) {
      const prof = LOTS[lot.nom];
      for (const [c, part] of Object.entries(prof.cat) as [Categorie, number][]) {
        lignesData.push({ projetId: projet.id, lotId: lot.id, categorie: c, montantInitial: Math.round((sc.budget * prof.part * part) / 10_000) * 10_000 });
      }
    }
    const lignes = await prisma.ligneBudget.createManyAndReturn({ data: lignesData });
    journal.push({ date: new Date(debut.getTime() - 14 * JOUR), auteurId: ing.id, projetId: projet.id, action: "MODIFIER", entite: "Budget", entiteId: null, resume: `Budget prévisionnel enregistré : ${nf(lignesData.reduce((t, l) => t + l.montantInitial, 0))}` });
    if (sc.statut !== "PREPARATION") {
      journal.push({ date: debut, auteurId: ing.id, projetId: projet.id, action: "MODIFIER", entite: "Projet", entiteId: projet.id, resume: "Statut du projet : En préparation → En cours" });
    }
    if (sc.statut === "PREPARATION") continue;

    for (const av of sc.avenants) {
      const lot = lots.find((l) => l.nom === av.lot)!;
      const ligne = lignes.find((l) => l.lotId === lot.id && l.categorie === av.categorie)!;
      const a = await prisma.avenant.create({ data: { projetId: projet.id, ligneId: ligne.id, montant: av.montant, motif: av.motif, date: d(av.date), auteurId: ing.id, creeLe: d(av.date) } });
      journal.push({ date: d(av.date), auteurId: ing.id, projetId: projet.id, action: "AVENANT", entite: "Avenant", entiteId: a.id, resume: `Avenant +${nf(av.montant)} sur ${av.lot} : ${av.motif}` });
    }

    // Avancement réel de chaque lot : fenêtre prévue étirée par le rythme réel.
    const tauxTemps = Math.min(1, (finActivite.getTime() - debut.getTime()) / JOUR / duree);
    const depenses: Prisma.DepenseCreateManyInput[] = [];
    const releves: { lotId: number; date: Date; pourcentage: number; statut: Statut; commentaire: string }[] = [];

    for (const lot of lots) {
      const prof = LOTS[lot.nom];
      const [s0, s1] = prof.fenetre;
      const ef = termine ? 1 : sc.vitesse * tauxTemps;
      const avancement = termine ? 100 : Math.round(Math.max(0, Math.min(1, (ef - s0) / (s1 - s0))) * 100);
      if (avancement === 0) continue;
      const jDebut = (s0 / sc.vitesse) * duree;
      const jFin = Math.min((finActivite.getTime() - debut.getTime()) / JOUR, (s1 / sc.vitesse) * duree);
      const jour = (frac: number) => jourUTC(new Date(debut.getTime() + (jDebut + (jFin - jDebut) * frac) * JOUR));

      // Dépenses de chaque ligne : budget × avancement × surcoût, en achats successifs.
      for (const [c, part] of Object.entries(prof.cat) as [Categorie, number][]) {
        const ligne = lignes.find((l) => l.lotId === lot.id && l.categorie === c)!;
        const budgetLigne = ligne.montantInitial + sc.avenants.filter((v) => v.lot === lot.nom && v.categorie === c).reduce((t, v) => t + v.montant, 0);
        const cibleLigne = budgetLigne * (avancement / 100) * (sc.surcout[c] ?? 1) * entre(0.96, 1.04);
        const choix = prof.articles[c] ?? [];
        // La ligne se répartit entre tous ses articles (poids tirés au hasard), et chaque
        // article s achète en plusieurs fois au fil du lot : il faut plusieurs achats du
        // même article pour juger ses prix.
        const poids = choix.map(() => entre(0.5, 1.5));
        const totalPoids = poids.reduce((t, x) => t + x, 0);
        for (const [ia, nomArticle] of choix.entries()) {
          const art = article.get(nomArticle)!;
          let reste = (cibleLigne * poids[ia]) / totalPoids;
          const achats = Math.max(1, Math.min(9, Math.round(reste / entre(250_000, 700_000))));
          for (let k = 0; k < achats && reste > 5_000; k++) {
          const date = jour((k + entre(0.1, 0.9)) / achats);
          // Prix : référence + 0,6 % de hausse par mois + bruit de 3 %.
          const mois = (date.getTime() - d("2025-11-01").getTime()) / (30 * JOUR);
          const pu = Math.round((prixRef.get(nomArticle)! * (1 + 0.006 * mois) * normale(1, 0.03)) / 50) * 50;
          const cible = k === achats - 1 ? reste : (reste / (achats - k)) * entre(0.7, 1.3);
          const quantite = Math.max(1, Math.round(cible / pu));
          const montant = quantite * pu;
          reste -= montant;
          const fo = fournisseurPour(nomArticle);
          depenses.push({
            projetId: projet.id,
            lotId: lot.id,
            categorie: c,
            articleId: art.id,
            libelle: nomArticle,
            quantite,
            unite: art.unite,
            prixUnitaire: pu,
            montant,
            date,
            fournisseurId: fo ? fournisseur.get(fo)!.id : null,
            reference: alea() < 0.8 ? `R-${date.getUTCFullYear()}${String(Math.floor(alea() * 90000) + 10000)}` : null,
            statut: "VALIDEE",
            auteurId: alea() < 0.85 ? chef.id : ing.id,
            decideParId: ing.id,
            decideLe: new Date(date.getTime() + Math.floor(entre(0, 3)) * JOUR + 17 * 3600_000),
            creeLe: new Date(date.getTime() + 15 * 3600_000),
          });
          }
        }
      }

      // Relevés d'avancement : 2 à 4 étapes jusqu'à la valeur actuelle.
      const etapes = avancement === 100 ? [35, 70, 100] : avancement > 50 ? [Math.round(avancement / 2), avancement] : [avancement];
      etapes.forEach((p, i) => releves.push({ lotId: lot.id, date: jour((i + 1) / etapes.length), pourcentage: p, statut: "VALIDEE", commentaire: p === 100 ? "Lot achevé et réceptionné" : `Travaux du lot à ${p} %` }));
      await prisma.lot.update({ where: { id: lot.id }, data: { avancement } });
    }

    // Les saisies récentes du chef attendent la validation ; quelques rejets et une annulation.
    depenses.sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());
    if (!termine) {
      for (const x of depenses.slice(-5)) Object.assign(x, { statut: "EN_ATTENTE", auteurId: chef.id, decideParId: null, decideLe: null });
    }
    for (const x of depenses.filter(() => alea() < 0.025).slice(0, 3)) {
      if (x.statut === "VALIDEE") Object.assign(x, { statut: "REJETEE", motif: "Reçu illisible : ressaisir avec la photo du reçu" });
    }
    const aAnnuler = depenses.find((x) => x.statut === "VALIDEE" && x.categorie === "TRANSPORT");
    if (aAnnuler) Object.assign(aAnnuler, { statut: "ANNULEE", motif: "Doublon : voyage déjà saisi le même jour" });

    // Anomalies de prix volontaires, pour la démonstration des alertes.
    if (sc.code === "PRJ-2026-002") {
      const ciment = article.get("Ciment CPJ 42,5 (sac de 50 kg)")!;
      depenses.push({
        projetId: projet.id,
        lotId: lots.find((l) => l.nom === "Élévation des murs")!.id,
        categorie: "MATERIAUX",
        articleId: ciment.id,
        libelle: ciment.designation,
        quantite: 60,
        unite: "sac",
        prixUnitaire: 8_200,
        montant: 492_000,
        date: new Date(AUJOURDHUI.getTime() - 2 * JOUR),
        fournisseurId: fournisseur.get("Quincaillerie du Centre")!.id,
        reference: "R-2026-77812",
        statut: "EN_ATTENTE",
        auteurId: chef.id,
        creeLe: new Date(AUJOURDHUI.getTime() - 2 * JOUR + 16 * 3600_000),
      });
    }
    if (sc.code === "PRJ-2026-003") {
      const fer = article.get("Fer HA12 (barre de 12 m)")!;
      const vieille = new Date(AUJOURDHUI.getTime() - 12 * JOUR);
      depenses.push({
        projetId: projet.id,
        lotId: lots.find((l) => l.nom === "Fondations")!.id,
        categorie: "MATERIAUX",
        articleId: fer.id,
        libelle: fer.designation,
        quantite: 180,
        unite: "barre",
        prixUnitaire: 10_900,
        montant: 1_962_000,
        date: vieille,
        fournisseurId: fournisseur.get("Quincaillerie du Centre")!.id,
        reference: null,
        statut: "EN_ATTENTE",
        auteurId: chef.id,
        creeLe: vieille,
      });
    }

    const creees = await prisma.depense.createManyAndReturn({ data: depenses });
    for (const x of creees) {
      const auteur = x.auteurId === ing.id ? ing : chef;
      journal.push({ date: x.creeLe, auteurId: auteur.id, projetId: projet.id, action: "CREER", entite: "Depense", entiteId: x.id, resume: `Dépense saisie${auteur.id === ing.id ? " et validée" : ""} : ${x.libelle}, ${x.quantite} ${x.unite} × ${nf(x.prixUnitaire)} = ${nf(x.montant)}` });
      if (x.decideLe && auteur.id !== ing.id) {
        const action = x.statut === "REJETEE" ? "REJETER" : "VALIDER";
        journal.push({ date: x.decideLe, auteurId: ing.id, projetId: projet.id, action, entite: "Depense", entiteId: x.id, resume: `Dépense ${action === "VALIDER" ? "validée" : "rejetée"} : ${x.libelle}, ${nf(x.montant)}${x.statut === "REJETEE" ? ` — ${x.motif}` : ""}` });
      }
      if (x.statut === "ANNULEE") {
        journal.push({ date: new Date(x.creeLe.getTime() + 4 * JOUR), auteurId: ing.id, projetId: projet.id, action: "ANNULER", entite: "Depense", entiteId: x.id, resume: `Dépense annulée : ${x.libelle}, ${nf(x.montant)} — ${x.motif}` });
      }
    }

    // Dernier relevé du chef encore à valider sur les projets en cours.
    if (!termine && releves.length) {
      const dernier = [...releves].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
      releves.push({ lotId: dernier.lotId, date: AUJOURDHUI, pourcentage: Math.min(100, dernier.pourcentage + 8), statut: "EN_ATTENTE", commentaire: "Avancement de la semaine" });
    }
    for (const r of releves) {
      const rel = await prisma.releve.create({
        data: { projetId: projet.id, ...r, auteurId: chef.id, decideParId: r.statut === "VALIDEE" ? ing.id : null, decideLe: r.statut === "VALIDEE" ? r.date : null, creeLe: r.date },
      });
      const lot = lots.find((l) => l.id === r.lotId)!;
      journal.push({ date: r.date, auteurId: chef.id, projetId: projet.id, action: "CREER", entite: "Releve", entiteId: rel.id, resume: `Avancement déclaré : ${lot.nom} à ${r.pourcentage} %` });
      if (r.statut === "VALIDEE") journal.push({ date: new Date(r.date.getTime() + 3600_000), auteurId: ing.id, projetId: projet.id, action: "VALIDER", entite: "Releve", entiteId: rel.id, resume: `Avancement validé : ${lot.nom} à ${r.pourcentage} %` });
    }

    // Versements du client par tranches ; la dernière reste à confirmer.
    const totalBudget = lignesData.reduce((t, l) => t + l.montantInitial, 0);
    const dureeActivite = (finActivite.getTime() - debut.getTime()) / JOUR;
    for (const [i, part] of sc.tranches.entries()) {
      const date = jourUTC(new Date(debut.getTime() + (dureeActivite * i) / sc.tranches.length * JOUR - 5 * JOUR));
      const enAttente = !termine && i === sc.tranches.length - 1 && sc.tranches.length > 2;
      const v = await prisma.versement.create({
        data: {
          projetId: projet.id,
          montant: Math.round((totalBudget * part) / 100_000) * 100_000,
          date,
          mode: i === 0 ? "VIREMENT" : choisir(["VIREMENT", "MOBILE_MONEY", "CHEQUE"] as const),
          reference: `VIR-${sc.code.slice(-3)}-${i + 1}`,
          statut: enAttente ? "EN_ATTENTE" : "VALIDEE",
          auteurId: client.id,
          decideParId: enAttente ? null : ing.id,
          decideLe: enAttente ? null : new Date(date.getTime() + JOUR),
          creeLe: date,
        },
      });
      journal.push({ date, auteurId: client.id, projetId: projet.id, action: "CREER", entite: "Versement", entiteId: v.id, resume: `Versement déclaré : ${nf(v.montant)}` });
      if (!enAttente) journal.push({ date: new Date(date.getTime() + JOUR), auteurId: ing.id, projetId: projet.id, action: "VALIDER", entite: "Versement", entiteId: v.id, resume: `Versement confirmé : ${nf(v.montant)}` });
    }

    console.log(`${sc.nom} : ${creees.length} dépenses, ${releves.length} relevés`);
  }

  for (const u of users) journal.push({ date: new Date(AUJOURDHUI.getTime() - 200 * JOUR), auteurId: ing.id, projetId: null, action: "CREER", entite: "Utilisateur", entiteId: u.id, resume: `Compte créé : ${u.prenom} ${u.nom}` });
  journal.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (let i = 0; i < journal.length; i += 500) await prisma.journal.createMany({ data: journal.slice(i, i + 500) });
  console.log(`Journal : ${journal.length} opérations. Comptes de démonstration, mot de passe ${MOT_DE_PASSE}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
