"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Boite } from "@/lib/stats";

// Couleurs des séries : rose de la marque en tête, puis un ordre validé pour le
// daltonisme (contrôle ΔE en clair et en sombre). La couleur suit l'entité.
export const ROSE = "#db2777";
export const PREVU = "#f9a8d4";
const BLEU = "#2a78d6";
const GRIS = "#94a3b8";

const axe = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const infobulle = {
  contentStyle: {
    borderRadius: "12px",
    border: "1px solid hsl(var(--border))",
    backgroundColor: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    fontSize: "12px",
  },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  labelStyle: { color: "hsl(var(--muted-foreground))", marginBottom: 4 },
};

export const fcfa = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? `${Math.round(v).toLocaleString("fr-FR")} FCFA` : "—");
const court = (v: unknown) => {
  if (typeof v !== "number") return String(v ?? "");
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md`;
  if (a >= 1e6) return `${(v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (a >= 1e3) return `${(v / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  return v.toLocaleString("fr-FR");
};
const pourcent = (v: unknown) => (typeof v === "number" ? `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—");
// Le texte de la légende reste à l'encre du texte ; seule la pastille porte la couleur.
const legende = {
  wrapperStyle: { fontSize: 12, paddingTop: 8 },
  iconType: "circle" as const,
  iconSize: 8,
  formatter: (v: unknown) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{String(v)}</span>,
};

/**
 * Courbe en S : coût cumulé réel, droite de régression prolongée jusqu'à la fin
 * prévue, et budget révisé en ligne de référence. Un seul axe, en FCFA.
 */
export function CourbeCumul({
  points,
  budget,
  hauteur = 300,
}: {
  points: { date: string; reel?: number | null; tendance?: number | null }[];
  budget: number;
  hauteur?: number;
}) {
  const date = (v: unknown) => new Date(Number(v)).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" });
  // Axe du temps continu : deux mois sans dépense occupent la place de deux mois.
  const donnees = points.map((p) => ({ ...p, t: Date.parse(p.date) }));
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={donnees} margin={{ left: 4, right: 12, top: 12 }}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={axe} axisLine={false} tickLine={false} minTickGap={28} tickFormatter={date} />
          <YAxis tick={axe} axisLine={false} tickLine={false} width={56} tickFormatter={court} domain={[0, (max: number) => Math.max(max, budget) * 1.05]} />
          <Tooltip {...infobulle} formatter={fcfa} labelFormatter={(v) => new Date(Number(v)).toLocaleDateString("fr-FR", { timeZone: "UTC" })} />
          <Legend {...legende} />
          <ReferenceLine y={budget} stroke={GRIS} strokeDasharray="6 4" label={{ value: "Budget révisé", position: "insideTopLeft", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <Line type="stepAfter" dataKey="reel" name="Coût cumulé réel" stroke={ROSE} strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls />
          <Line type="linear" dataKey="tendance" name="Tendance (régression)" stroke={BLEU} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Répartition du réel par catégorie (partie d'un tout, 5 postes au plus). */
export function Anneau({ data, hauteur = 280 }: { data: { nom: string; valeur: number; couleur: string }[]; hauteur?: number }) {
  const total = data.reduce((s, d) => s + d.valeur, 0);
  return (
    <div style={{ height: hauteur }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="valeur" nameKey="nom" innerRadius="58%" outerRadius="84%" paddingAngle={1.5} stroke="hsl(var(--card))" strokeWidth={2}>
            {data.map((d) => (
              <Cell key={d.nom} fill={d.couleur} />
            ))}
          </Pie>
          <Tooltip {...infobulle} formatter={(v) => `${fcfa(v)} (${pourcent(total ? ((v as number) / total) * 100 : 0)})`} />
          <Legend {...legende} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Prévu (rose clair) et réel (rose) par poste, barres horizontales. */
export function PrevuReel({ data, hauteur }: { data: { nom: string; prevu: number; reel: number }[]; hauteur?: number }) {
  const h = hauteur ?? Math.max(220, data.length * 46 + 60);
  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4 }} barGap={2}>
          <CartesianGrid stroke="hsl(var(--border))" horizontal={false} />
          <XAxis type="number" tick={axe} axisLine={false} tickLine={false} tickFormatter={court} />
          <YAxis type="category" dataKey="nom" tick={axe} axisLine={false} tickLine={false} width={150} />
          <Tooltip {...infobulle} formatter={fcfa} cursor={{ fill: "hsl(var(--muted))" }} />
          <Legend {...legende} />
          <Bar dataKey="prevu" name="Budget révisé" fill={PREVU} radius={[0, 4, 4, 0]} barSize={12} />
          <Bar dataKey="reel" name="Dépensé" fill={ROSE} radius={[0, 4, 4, 0]} barSize={12}>
            {data.map((d) => (
              <Cell key={d.nom} fill={d.reel > d.prevu && d.prevu > 0 ? "#d03b3b" : ROSE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Dépenses par mois, empilées par catégorie (couleur fixe de chaque catégorie). */
export function Mensuel({
  data,
  categories,
  hauteur = 300,
}: {
  data: Record<string, number | string>[];
  categories: { cle: string; nom: string; couleur: string }[];
  hauteur?: number;
}) {
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="mois" tick={axe} axisLine={false} tickLine={false} />
          <YAxis tick={axe} axisLine={false} tickLine={false} width={56} tickFormatter={court} />
          <Tooltip {...infobulle} formatter={fcfa} cursor={{ fill: "hsl(var(--muted))" }} />
          <Legend {...legende} />
          {categories.map((c, i) => (
            <Bar
              key={c.cle}
              dataKey={c.cle}
              name={c.nom}
              stackId="m"
              fill={c.couleur}
              stroke="hsl(var(--card))"
              strokeWidth={1}
              radius={i === categories.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barres simples (une série) : histogramme, coût au m², etc. */
export function Barres({
  data,
  x,
  y,
  nom,
  format = "fcfa",
  hauteur = 260,
  couleur = ROSE,
  reference,
}: {
  data: Record<string, unknown>[];
  x: string;
  y: string;
  nom: string;
  format?: "fcfa" | "nombre" | "pourcent";
  hauteur?: number;
  couleur?: string;
  reference?: { valeur: number; libelle: string };
}) {
  const f = format === "fcfa" ? fcfa : format === "pourcent" ? pourcent : (v: unknown) => String(v);
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 12 }} barCategoryGap="12%">
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey={x} tick={axe} axisLine={false} tickLine={false} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 56 : 30} />
          <YAxis tick={axe} axisLine={false} tickLine={false} width={56} tickFormatter={format === "pourcent" ? pourcent : court} allowDecimals={format !== "nombre"} />
          <Tooltip {...infobulle} formatter={f} cursor={{ fill: "hsl(var(--muted))" }} />
          {reference && <ReferenceLine y={reference.valeur} stroke={GRIS} strokeDasharray="6 4" label={{ value: reference.libelle, position: "insideTopRight", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />}
          <Bar dataKey={y} name={nom} fill={couleur} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Deux mesures de même unité côte à côte (ex. % du budget consommé et % réalisé). */
export function BarresDoubles({
  data,
  series,
  hauteur = 280,
}: {
  data: Record<string, unknown>[];
  series: [{ cle: string; nom: string }, { cle: string; nom: string }];
  hauteur?: number;
}) {
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 12 }} barGap={2}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="nom" tick={axe} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={axe} axisLine={false} tickLine={false} width={48} tickFormatter={pourcent} />
          <Tooltip {...infobulle} formatter={pourcent} cursor={{ fill: "hsl(var(--muted))" }} />
          <Legend {...legende} />
          <Bar dataKey={series[0].cle} name={series[0].nom} fill={ROSE} radius={[4, 4, 0, 0]} />
          <Bar dataKey={series[1].cle} name={series[1].nom} fill={BLEU} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Pareto sur UN seul axe en % : la part de chaque article (barres) et la part
 * cumulée (courbe), avec le repère des 80 %.
 */
export function Pareto({ data, hauteur = 300 }: { data: { nom: string; part: number; partCumulee: number }[]; hauteur?: number }) {
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 4, right: 8, top: 12 }}>
          <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="nom" tick={axe} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={70} />
          <YAxis domain={[0, 100]} tick={axe} axisLine={false} tickLine={false} width={48} tickFormatter={pourcent} />
          <Tooltip {...infobulle} formatter={pourcent} />
          <Legend {...legende} />
          <ReferenceLine y={80} stroke={GRIS} strokeDasharray="6 4" label={{ value: "80 %", position: "insideTopLeft", fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <Bar dataKey="part" name="Part du coût total" fill={ROSE} radius={[4, 4, 0, 0]} />
          <Line dataKey="partCumulee" name="Part cumulée" stroke={BLEU} strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Boîte à moustaches de Tukey, tracée en SVG. */
export function BoiteMoustaches({ boite }: { boite: Boite }) {
  const lo = Math.min(boite.min, boite.bornesBasse < boite.min ? boite.min : boite.bornesBasse);
  const hi = Math.max(boite.max, boite.bornesHaute > boite.max ? boite.max : boite.bornesHaute);
  const pos = (v: number) => 30 + ((v - lo) / (hi - lo || 1)) * 540;
  const basse = Math.max(boite.min, boite.bornesBasse);
  const haute = Math.min(boite.max, boite.bornesHaute);
  const reperes: [string, number, number][] = [
    ["Q1", boite.q1, 92],
    ["Médiane", boite.mediane, 16],
    ["Q3", boite.q3, 108],
  ];
  return (
    <svg viewBox="0 0 600 120" className="h-32 w-full text-muted-foreground" role="img" aria-label="Boîte à moustaches des montants">
      <line x1={pos(basse)} x2={pos(boite.q1)} y1={50} y2={50} stroke="currentColor" strokeWidth={1.5} />
      <line x1={pos(boite.q3)} x2={pos(haute)} y1={50} y2={50} stroke="currentColor" strokeWidth={1.5} />
      <line x1={pos(basse)} x2={pos(basse)} y1={38} y2={62} stroke="currentColor" strokeWidth={1.5} />
      <line x1={pos(haute)} x2={pos(haute)} y1={38} y2={62} stroke="currentColor" strokeWidth={1.5} />
      <rect x={pos(boite.q1)} y={30} width={Math.max(2, pos(boite.q3) - pos(boite.q1))} height={40} rx={4} fill={`${ROSE}26`} stroke={ROSE} strokeWidth={1.5} />
      <line x1={pos(boite.mediane)} x2={pos(boite.mediane)} y1={30} y2={70} stroke={ROSE} strokeWidth={3} />
      {boite.atypiques.map((v, i) => (
        <circle key={i} cx={pos(v)} cy={50} r={4.5} fill="#d03b3b" stroke="hsl(var(--card))" strokeWidth={2}>
          <title>{`Valeur atypique : ${fcfa(v)}`}</title>
        </circle>
      ))}
      {reperes.map(([n, v, y]) => (
        <text key={n} x={pos(v)} y={y} textAnchor="middle" fontSize="11" fill="currentColor">
          {n} : {court(v)}
        </text>
      ))}
    </svg>
  );
}
