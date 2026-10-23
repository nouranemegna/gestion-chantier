"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ErreurSaisie, exigerSession, hacherMotDePasse, journaliser, session, verifierMotDePasse } from "@/lib/auth";
import { COOKIE_SESSION, DUREE_SESSION_S, signerSession } from "@/lib/session";
import { agir, choix, identifiant, texte, type Etat } from "@/lib/formulaire";
import { ROLES } from "@/lib/labels";

const telephoneNormalise = (t: string) => t.replace(/[\s.\-]/g, "").replace(/^(\+?237)/, "");

export async function connexion(_: Etat, f: FormData): Promise<Etat> {
  const telephone = telephoneNormalise(String(f.get("telephone") ?? ""));
  const mdp = String(f.get("motDePasse") ?? "");
  const u = await prisma.utilisateur.findUnique({ where: { telephone } });
  // Même message pour un numéro inconnu et un mauvais mot de passe : on ne dit
  // pas quels numéros ont un compte.
  if (!u || !verifierMotDePasse(mdp, u.motDePasseHash)) return { erreur: "Téléphone ou mot de passe incorrect." };
  if (!u.actif) return { erreur: "Ce compte est désactivé. Adressez-vous à l'ingénieure." };
  const jeton = await signerSession({ id: u.id, role: u.role, nom: `${u.prenom} ${u.nom}` });
  (await cookies()).set(COOKIE_SESSION, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_SESSION_S,
  });
  await prisma.utilisateur.update({ where: { id: u.id }, data: { derniereConnexion: new Date() } });
  await journaliser(u.id, { action: "CONNEXION", entite: "Utilisateur", entiteId: u.id, resume: `Connexion de ${u.prenom} ${u.nom}` });
  redirect("/projets");
}

export async function deconnexion() {
  (await cookies()).delete(COOKIE_SESSION);
  redirect("/connexion");
}

function verifierMdp(m: string) {
  if (m.length < 8) throw new ErreurSaisie("Le mot de passe doit compter au moins 8 caractères.");
}

export async function changerMotDePasse(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const s = await session();
    if (!s) throw new ErreurSaisie("Session expirée : reconnectez-vous.");
    const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id: s.id } });
    if (!verifierMotDePasse(String(f.get("actuel") ?? ""), u.motDePasseHash)) throw new ErreurSaisie("Mot de passe actuel incorrect.");
    const nouveau = String(f.get("nouveau") ?? "");
    verifierMdp(nouveau);
    if (nouveau !== String(f.get("confirmation") ?? "")) throw new ErreurSaisie("Les deux nouveaux mots de passe diffèrent.");
    await prisma.utilisateur.update({ where: { id: s.id }, data: { motDePasseHash: hacherMotDePasse(nouveau) } });
    await journaliser(s.id, { action: "MOT_DE_PASSE", entite: "Utilisateur", entiteId: s.id, resume: "Mot de passe changé par son titulaire" });
    return "Mot de passe changé.";
  });
}

/* Comptes : seule l'ingénieure les crée, les désactive et réinitialise leur mot de passe. */

export async function creerUtilisateur(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const s = await exigerSession(["INGENIEUR"]);
    const telephone = telephoneNormalise(texte(f, "telephone", "Téléphone")!);
    if (!/^\d{8,12}$/.test(telephone)) throw new ErreurSaisie("Téléphone : 8 à 12 chiffres.");
    if (await prisma.utilisateur.findUnique({ where: { telephone } })) throw new ErreurSaisie("Ce numéro a déjà un compte.");
    const mdp = String(f.get("motDePasse") ?? "");
    verifierMdp(mdp);
    const role = choix<Role>(f, "role", "Rôle", ["CLIENT", "CHEF_CHANTIER", "INGENIEUR"]);
    const u = await prisma.utilisateur.create({
      data: {
        prenom: texte(f, "prenom", "Prénom")!,
        nom: texte(f, "nom", "Nom")!,
        telephone,
        email: texte(f, "email", "E-mail", false),
        role,
        motDePasseHash: hacherMotDePasse(mdp),
      },
    });
    await journaliser(s.id, {
      action: "CREER",
      entite: "Utilisateur",
      entiteId: u.id,
      resume: `Compte créé : ${u.prenom} ${u.nom} (${ROLES[role]})`,
      apres: { prenom: u.prenom, nom: u.nom, telephone: u.telephone, role: u.role },
    });
    revalidatePath("/utilisateurs");
    return `Compte de ${u.prenom} ${u.nom} créé. Communiquez-lui son mot de passe provisoire.`;
  });
}

export async function basculerUtilisateur(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const s = await exigerSession(["INGENIEUR"]);
    const id = identifiant(f, "id", "Compte")!;
    if (id === s.id) throw new ErreurSaisie("Vous ne pouvez pas désactiver votre propre compte.");
    const u = await prisma.utilisateur.findUniqueOrThrow({ where: { id } });
    await prisma.utilisateur.update({ where: { id }, data: { actif: !u.actif } });
    await journaliser(s.id, {
      action: u.actif ? "DESACTIVER" : "REACTIVER",
      entite: "Utilisateur",
      entiteId: id,
      resume: `Compte ${u.actif ? "désactivé" : "réactivé"} : ${u.prenom} ${u.nom}`,
      avant: { actif: u.actif },
      apres: { actif: !u.actif },
    });
    revalidatePath("/utilisateurs");
    return u.actif ? "Compte désactivé." : "Compte réactivé.";
  });
}

export async function reinitialiserMotDePasse(_: Etat, f: FormData): Promise<Etat> {
  return agir(async () => {
    const s = await exigerSession(["INGENIEUR"]);
    const id = identifiant(f, "id", "Compte")!;
    const mdp = String(f.get("motDePasse") ?? "");
    verifierMdp(mdp);
    const u = await prisma.utilisateur.update({ where: { id }, data: { motDePasseHash: hacherMotDePasse(mdp) } });
    await journaliser(s.id, { action: "MOT_DE_PASSE", entite: "Utilisateur", entiteId: id, resume: `Mot de passe réinitialisé : ${u.prenom} ${u.nom}` });
    return `Nouveau mot de passe enregistré pour ${u.prenom} ${u.nom}.`;
  });
}
