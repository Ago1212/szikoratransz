import React from "react";
import { kategoriaInfo, fajlKiterjesztes } from "components/Fajlok/fajlKategoriaInfo.js";

// Nem-kép fájloknál nincs valódi tartalom-előnézet — helyette egy "szép
// logó", ami a dokumentum-lapon (folded-corner sziluett, tiszta CSS
// clip-path, nincs hozzá SVG-útvonal-rajzolás) a tényleges kiterjesztést
// (PDF/XLSX/DOCX/…) mutatja, kategóriánként színezve (ld.
// fajlKategoriaInfo.js KATEGORIA_INFO.badgeBg) — így egy pillantásból
// megkülönböztethető egy .pdf és egy .docx kártya, nem csak a tág
// "Dokumentum" kategória-ikon szintjén.
export default function FileTypeIcon({ file, className = "h-12 w-9" }) {
  const info = kategoriaInfo(file.fajl_kategoria);
  const ext = fajlKiterjesztes(file.filename);

  return (
    <div className={`relative ${className}`}>
      <div
        className={`absolute inset-0 ${info.badgeBg} shadow-sm`}
        style={{ clipPath: "polygon(0 0, 70% 0, 100% 30%, 100% 100%, 0 100%)" }}
      />
      <div
        className="absolute right-0 top-0 border-b-[9px] border-l-[9px] border-b-white/40 border-l-transparent dark:border-b-black/20"
        style={{ width: 0, height: 0 }}
      />
      <div className="absolute inset-0 flex items-end justify-center pb-1.5">
        <span className="text-[9px] font-extrabold uppercase tracking-tight text-white drop-shadow-sm">
          {ext}
        </span>
      </div>
    </div>
  );
}
