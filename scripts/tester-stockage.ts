/**
 * Contrôle de Backblaze B2 : dépose une petite image, la relit par un lien signé,
 * puis la supprime.  npx tsx --env-file=.env scripts/tester-stockage.ts
 */
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { lienSigne, stockageActif, televerser } from "../lib/fichiers";

async function main() {
  if (!stockageActif) throw new Error("Variables B2_* absentes : stockage désactivé.");
  // PNG de 1 × 1 pixel rose.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4/5/hPwAHggJ/PrnB3wAAAABJRU5ErkJggg==", "base64");
  const cle = await televerser(new File([png], "essai.png", { type: "image/png" }), "essais");
  console.log("déposé :", cle);
  const lien = await lienSigne(cle!);
  const r = await fetch(lien!);
  console.log("relu par lien signé : HTTP", r.status, (await r.arrayBuffer()).byteLength, "octets");
  const region = process.env.B2_ENDPOINT!.replace(/^https?:\/\//, "").split(".")[1];
  const s3 = new S3Client({ region, endpoint: process.env.B2_ENDPOINT, credentials: { accessKeyId: process.env.B2_KEY_ID!, secretAccessKey: process.env.B2_APPLICATION_KEY! } });
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.B2_BUCKET, Key: cle! }));
  console.log("supprimé : le stockage fonctionne.");
}

main().catch((e) => {
  console.error("Échec :", e instanceof Error ? e.message : e);
  process.exit(1);
});
