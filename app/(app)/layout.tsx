import { prisma } from "@/lib/db";
import { exigerSession, filtreProjets } from "@/lib/auth";
import { deconnexion } from "@/app/actions/compte";
import { Coque } from "@/components/app/Coque";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const s = await exigerSession();
  const projets = await prisma.projet.findMany({
    where: filtreProjets(s),
    select: { id: true, code: true, nom: true },
    orderBy: { creeLe: "desc" },
  });
  return (
    <Coque nom={s.nom} role={s.role} projets={projets} deconnexion={deconnexion}>
      {children}
    </Coque>
  );
}
