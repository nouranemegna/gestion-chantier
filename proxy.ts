import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSION, lireSession } from "@/lib/session";

// Premier filtre : sans session valide, retour à la connexion. Les droits fins
// (rôle, projet concerné) sont vérifiés par chaque page et chaque action.
export async function proxy(req: NextRequest) {
  const s = await lireSession(req.cookies.get(COOKIE_SESSION)?.value);
  if (!s) return NextResponse.redirect(new URL("/connexion", req.url));
  return NextResponse.next();
}

export const config = {
  // L'accueil (/), la connexion, le manifeste et les fichiers statiques restent publics.
  matcher: ["/((?!connexion|_next|favicon.ico|icon.png|apple-icon.png|embleme|logo-nourane.png|manifest.webmanifest).+)"],
};
