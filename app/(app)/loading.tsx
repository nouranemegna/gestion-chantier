import { SquelettePage, SqueletteTitre } from "@/components/app/Chargement";

// Affiché dès le clic sur un lien, le temps que la page demandée soit prête.
export default function Chargement() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <SqueletteTitre />
      <SquelettePage />
    </div>
  );
}
