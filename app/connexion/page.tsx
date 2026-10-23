import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { session } from "@/lib/auth";
import { LogoComplet } from "@/components/app/Logo";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata = { title: "Connexion" };

export default async function PageConnexion() {
  if (await session()) redirect("/projets");
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.16)_0%,transparent_60%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.22)_0%,transparent_60%)]" />
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/90 p-8 shadow-xl shadow-pink-500/5 backdrop-blur dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="mt-6 flex justify-center">
          <LogoComplet largeur={150} />
        </div>
        <h1 className="mt-5 text-center text-2xl font-bold tracking-tight">Connexion</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Accédez au suivi des coûts de vos chantiers</p>
        <FormulaireConnexion />
      </div>
    </div>
  );
}
