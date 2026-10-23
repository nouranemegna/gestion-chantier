import type { NextConfig } from "next";

const config: NextConfig = {
  // Le moteur PDF et ExcelJS chargent leurs polices et modules à l'exécution :
  // ils ne doivent pas passer par le regroupement de Next.
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
  // Les polices standard de pdfkit sont chargées par un require dynamique : le
  // traçage de Vercel ne les voit pas, il faut les embarquer à la main.
  outputFileTracingIncludes: {
    "/projets/[id]/rapport": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
  },
  experimental: {
    // Photos de reçus et du chantier (compressées dans le navigateur, 4 Mo au
    // plus) : la limite par défaut des actions serveur est de 1 Mo.
    serverActions: { bodySizeLimit: "5mb" },
    // Copie locale d'abord : une page déjà vue se rouvre aussitôt depuis le
    // cache du routeur, puis <MiseAJour> la remplace par la version du serveur.
    staleTimes: { dynamic: 300, static: 300 },
  },
};

export default config;
