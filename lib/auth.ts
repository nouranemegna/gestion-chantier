import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { COOKIE_SESSION, lireSession, type Role, type Session } from "./session";

export function hacherMotDePasse(mdp: string): string {
  const sel = randomBytes(16).toString("hex");
  return `${sel}:${scryptSync(mdp, sel, 64).toString("hex")}`;
}

export function verifierMotDePasse(mdp: string, hache: string): boolean {
  const [sel, h] = hache.split(":");
  if (!sel || !h) return false;
  const attendu = Buffer.from(h, "hex");
  const calcule = scryptSync(mdp, sel, 64);
  return attendu.length === calcule.length && timingSafeEqual(attendu, calcule);
}

export const session = cache(async (): Promise<Session | null> => {
  return lireSession((await cookies()).get(COOKIE_SESSION)?.value);
});

/** Toute page et toute action commence par ce contrôle : masquer un bouton ne protège rien. */
export async function exigerSession(roles?: Role[]): Promise<Session> {
  const s = await session();
  if (!s) redirect("/connexion");
  if (roles && !roles.includes(s.role)) redirect("/projets");
  return s;
}

/**
 * Projets visibles : l'ingénieure, propriétaire de l'application, les voit tous ;
 * le client voit les siens ; le chef de chantier ceux qu'il dirige.
 */
export function filtreProjets(s: Session): Prisma.ProjetWhereInput {
  switch (s.role) {
    case "INGENIEUR":
      return {};
    case "CLIENT":
      return { clientId: s.id };
    case "CHEF_CHANTIER":
      return { chefId: s.id };
  }
}

/**
 * Charge un projet en vérifiant qu'il est dans le périmètre. Hors périmètre, on
 * répond « introuvable » : on ne révèle pas qu'il existe.
 */
export const exigerProjet = cache(async (id: number, roles?: Role[]) => {
  const s = await exigerSession(roles);
  if (!Number.isInteger(id)) notFound();
  const projet = await prisma.projet.findFirst({
    where: { id, ...filtreProjets(s) },
    include: { client: true, chef: true },
  });
  if (!projet) notFound();
  return { s, projet };
});

/** Même contrôle pour une action serveur : une erreur lisible plutôt qu'une page 404. */
export async function verifierProjet(id: number, roles?: Role[]) {
  const s = await session();
  if (!s) throw new ErreurSaisie("Votre session a expiré : reconnectez-vous.");
  if (roles && !roles.includes(s.role)) throw new ErreurSaisie("Cette action ne vous est pas permise.");
  const projet = await prisma.projet.findFirst({ where: { id, ...filtreProjets(s) } });
  if (!projet) throw new ErreurSaisie("Projet introuvable.");
  return { s, projet };
}

/** Erreur dont le message s'affiche tel quel dans le formulaire. */
export class ErreurSaisie extends Error {}

/** Journal en écriture seule : qui, quoi, sur quel projet, avec l'avant et l'après. */
export async function journaliser(
  auteurId: number,
  e: {
    action: string;
    entite: string;
    entiteId?: number;
    projetId?: number | null;
    resume: string;
    avant?: unknown;
    apres?: unknown;
  },
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.journal.create({
    data: {
      auteurId,
      action: e.action,
      entite: e.entite,
      entiteId: e.entiteId,
      projetId: e.projetId ?? null,
      resume: e.resume,
      avant: e.avant === undefined ? undefined : (JSON.parse(JSON.stringify(e.avant)) as Prisma.InputJsonValue),
      apres: e.apres === undefined ? undefined : (JSON.parse(JSON.stringify(e.apres)) as Prisma.InputJsonValue),
    },
  });
}
