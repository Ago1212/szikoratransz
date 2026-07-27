import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PiCaretDownLight } from "react-icons/pi";
import { localizePath } from "i18n/index.js";

// Csak HU/EN — a `LOCALES` bővíthető később, ha jön egy harmadik nyelv, a
// lenyíló lista automatikusan felsorolná a jelenlegitől eltérő összes elemet.
const LOCALES = {
  hu: { flag: "🇭🇺", label: "Magyar" },
  en: { flag: "🇬🇧", label: "English" },
};

// Sötét, lekerekített "chip" gomb + lenyíló lista — ugyanaz a vizuális nyelv,
// mint a hero ajánlatkérő kártya (#23262B/#2E3239 sötét panel), hogy a
// nyelvváltó ne süllyedjen el a világos navigációs sávban.
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
        className="inline-flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-xl bg-[#23262B] hover:bg-[#2E3239] text-white text-sm font-[Overpass] font-semibold transition-colors duration-300"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {current.flag}
        </span>
        {current.label}
        <PiCaretDownLight
          className={`text-xs text-white/60 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-40 rounded-xl bg-[#23262B] shadow-xl overflow-hidden z-50 py-1"
        >
          {otherLocales.map((loc) => (
            <Link
              key={loc}
              to={localizePath(path, loc)}
              onClick={() => setOpen(false)}
              role="option"
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-white/90 hover:bg-white hover:text-[#23262B] transition-colors duration-200"
            >
              <span className="text-base leading-none" aria-hidden="true">
                {LOCALES[loc].flag}
              </span>
              {LOCALES[loc].label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
