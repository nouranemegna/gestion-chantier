"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

const COTE_MAX = 1600;

/** Réduit une photo de téléphone (souvent 4 à 8 Mo) à 1600 px de côté en JPEG, soit quelques centaines de Ko. */
async function compresser(f: File): Promise<File> {
  if (!f.type.startsWith("image/") || f.size < 600_000) return f;
  const image = await createImageBitmap(f);
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const toile = document.createElement("canvas");
  toile.width = Math.round(image.width * echelle);
  toile.height = Math.round(image.height * echelle);
  toile.getContext("2d")!.drawImage(image, 0, 0, toile.width, toile.height);
  const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, "image/jpeg", 0.82));
  if (!blob) return f;
  return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Photo facultative (reçu, état du chantier) : appareil photo du téléphone ou fichier. */
export function ChampPhoto({ name = "photo", label, actif }: { name?: string; label: string; actif: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [travail, setTravail] = useState(false);

  if (!actif) {
    return (
      <div className="space-y-1.5 text-sm">
        <span className="font-medium">{label}</span>
        <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">Le stockage des photos n&apos;est pas encore configuré : indiquez le numéro du reçu.</p>
      </div>
    );
  }

  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">
        {label} <span className="font-normal text-muted-foreground">(facultatif)</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/50 px-3 text-sm font-medium text-primary hover:bg-accent">
          {travail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {apercu ? "Changer" : "Prendre ou choisir"}
        </span>
        {apercu && (
          <span className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={apercu} alt="Aperçu" className="h-10 w-10 rounded-lg object-cover ring-1 ring-border" />
            <button
              type="button"
              aria-label="Retirer la photo"
              className="absolute -right-2 -top-2 rounded-full bg-card p-0.5 shadow ring-1 ring-border"
              onClick={(e) => {
                e.preventDefault();
                if (ref.current) ref.current.value = "";
                setApercu(null);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
      </span>
      <input
        ref={ref}
        type="file"
        name={name}
        accept="image/*,application/pdf"
        capture="environment"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return setApercu(null);
          setTravail(true);
          try {
            const c = await compresser(f);
            if (c !== f) {
              const dt = new DataTransfer();
              dt.items.add(c);
              e.target.files = dt.files;
            }
            setApercu(c.type.startsWith("image/") ? URL.createObjectURL(c) : null);
          } finally {
            setTravail(false);
          }
        }}
      />
    </label>
  );
}
