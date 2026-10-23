import { ErreurSaisie } from "./auth";
import { jourUTC } from "./format";

// Lecture des champs d'un formulaire : chaque valeur est contrôlée par le
// serveur, quel que soit le contrôle déjà fait dans le navigateur.

export interface Etat {
  ok?: string;
  erreur?: string;
  /** Change à chaque envoi réussi : le formulaire s'en sert pour se vider. */
  jeton?: number;
}

export function texte(f: FormData, nom: string, libelle: string, requis = true): string | null {
  const v = String(f.get(nom) ?? "").trim();
  if (!v) {
    if (requis) throw new ErreurSaisie(`${libelle} : champ obligatoire.`);
    return null;
  }
  if (v.length > 500) throw new ErreurSaisie(`${libelle} : 500 caractères au plus.`);
  return v;
}

function nombreBrut(f: FormData, nom: string): string {
  // Accepte « 12 500 », « 12500 » et « 2,5 ».
  return String(f.get(nom) ?? "").replace(/[\s  ]/g, "").replace(",", ".");
}

export function decimal(f: FormData, nom: string, libelle: string, { min = 0, max = Infinity, requis = true, strict = false } = {}): number | null {
  const brut = nombreBrut(f, nom);
  if (!brut) {
    if (requis) throw new ErreurSaisie(`${libelle} : champ obligatoire.`);
    return null;
  }
  const v = Number(brut);
  if (!Number.isFinite(v)) throw new ErreurSaisie(`${libelle} : nombre attendu.`);
  if (strict ? v <= min : v < min) throw new ErreurSaisie(`${libelle} : doit être ${strict ? "supérieur à" : "au moins"} ${min}.`);
  if (v > max) throw new ErreurSaisie(`${libelle} : ${max} au plus.`);
  return v;
}

export function entier(f: FormData, nom: string, libelle: string, opts: { min?: number; max?: number; requis?: boolean; strict?: boolean } = {}): number | null {
  const v = decimal(f, nom, libelle, opts);
  if (v === null) return null;
  if (!Number.isInteger(v)) throw new ErreurSaisie(`${libelle} : nombre entier attendu.`);
  return v;
}

export function identifiant(f: FormData, nom: string, libelle: string, requis = true): number | null {
  return entier(f, nom, libelle, { min: 1, requis });
}

export function choix<T extends string>(f: FormData, nom: string, libelle: string, valeurs: readonly T[]): T {
  const v = String(f.get(nom) ?? "");
  if (!(valeurs as readonly string[]).includes(v)) throw new ErreurSaisie(`${libelle} : choix invalide.`);
  return v as T;
}

export function jour(f: FormData, nom: string, libelle: string, requis = true): Date | null {
  const v = String(f.get(nom) ?? "");
  if (!v) {
    if (requis) throw new ErreurSaisie(`${libelle} : champ obligatoire.`);
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ErreurSaisie(`${libelle} : date invalide.`);
  return jourUTC(v);
}

export function fichier(f: FormData, nom: string): File | null {
  const v = f.get(nom);
  return v instanceof File && v.size > 0 ? v : null;
}

/** Enveloppe d'une action : un message d'erreur lisible au lieu d'une page d'erreur. */
export async function agir(travail: () => Promise<string>): Promise<Etat> {
  try {
    return { ok: await travail(), jeton: Date.now() };
  } catch (e) {
    if (e instanceof ErreurSaisie) return { erreur: e.message };
    // Les redirections de Next passent par une exception : on la laisse filer.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error(e);
    return { erreur: "L'opération n'a pas abouti. Réessayez ; si cela se répète, prévenez l'ingénieure." };
  }
}
