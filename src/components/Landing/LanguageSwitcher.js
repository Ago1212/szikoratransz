import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PiCaretDownLight } from "react-icons/pi";
import { localizePath } from "i18n/index.js";

// Unicode zászló-emoji (🇭🇺/🇬🇧) sok rendszeren (jellemzően Linuxon, emoji-
// betűkészlet nélkül) nem zászlóként, hanem két nyers betűként vagy egy
// törött glyph-ként jelenik meg — ezért helyette kézzel rajzolt, inline SVG
// zászlók, amik minden platformon egyformán, megbízhatóan jelennek meg.
function FlagHU({ className }) {
  return (
    <svg viewBox="0 0 20 14" className={className} aria-hidden="true">
      <rect width="20" height="14" fill="#fff" />
      <rect width="20" height="4.67" y="0" fill="#CE2939" />
      <rect width="20" height="4.67" y="9.33" fill="#477050" />
    </svg>
  );
}

function FlagGB({ className }) {
  return (
    <svg viewBox="0 0 20 14" className={className} aria-hidden="true">
      <rect width="20" height="14" fill="#00247D" />
      <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" strokeWidth="2.8" />
      <path d="M0,0 L8.5,6 M20,0 L11.5,6 M0,14 L8.5,8 M20,14 L11.5,8" stroke="#CF142B" strokeWidth="1" />
      <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="4.6" />
      <path d="M10,0 V14 M0,7 H20" stroke="#CF142B" strokeWidth="2.4" />
    </svg>
  );
}

// Csak HU/EN — a `LOCALES` bővíthető később, ha jön egy harmadik nyelv, a
// lenyíló lista automatikusan felsorolná a jelenlegitől eltérő összes elemet.
const LOCALES = {
  hu: { Flag: FlagHU, label: "Magyar" },
  en: { Flag: FlagGB, label: "English" },
};

// Világos, a navigáció többi eleméhez illő "chip" gomb (fehér háttér,
// halvány szegély) + lenyíló lista — szándékosan NEM sötét/kontrasztos
// kiemelés, hogy ne törje meg a navigációs sáv visszafogott megjelenését.
export default function LanguageSwitcher({ locale, path }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const current = LOCALES[locale];
  const otherLocales = Object.keys(LOCALES).filter((l) => l !== locale);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-xl border border-[#23262B]/15 bg-white hover:border-[#23262B]/30 text-[#23262B]/80 text-sm font-[Overpass] font-semibold transition-colors duration-300"
      >
        <current.Flag className="w-5 h-3.5 rounded-sm flex-shrink-0 ring-1 ring-black/10" />
        {current.label}
        <PiCaretDownLight
          className={`text-xs text-[#23262B]/40 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-40 rounded-xl border border-[#23262B]/10 bg-white shadow-xl overflow-hidden z-50 py-1"
        >
          {otherLocales.map((loc) => {
            const { Flag, label } = LOCALES[loc];
            return (
              <Link
                key={loc}
                to={localizePath(path, loc)}
                onClick={() => setOpen(false)}
                role="option"
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#23262B]/70 hover:bg-[#1E3AA8]/5 hover:text-[#1E3AA8] transition-colors duration-200"
              >
                <Flag className="w-5 h-3.5 rounded-sm flex-shrink-0 ring-1 ring-black/10" />
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
