import React, { useEffect } from "react";
import { Link } from "react-router-dom";

// Valódi "oldal nem található" nézet a korábbi csendes "*" → "/" redirect
// helyett — az utóbbi minden érvénytelen URL-t szó nélkül a főoldalra
// küldött (soft-404: a szerver mindig 200-at adott, a keresőmotorok nem
// tudták megkülönböztetni a törött linket a valós tartalomtól). Ez a nézet
// `noindex`-et állít be, hogy a keresők ezt sose indexeljék tartalomként.
export default function NotFound() {
  useEffect(() => {
    document.title = "Az oldal nem található | Szikora Transz Kft.";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, follow";
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F3F5] px-4 font-sans">
      <div className="text-center max-w-md">
        <p className="font-[Overpass_Mono] text-sm uppercase tracking-[0.2em] text-[#1E3AA8] mb-4">
          404
        </p>
        <h1 className="font-[Overpass] font-extrabold text-3xl text-[#23262B] mb-4">
          Az oldal nem található
        </h1>
        <p className="text-[#23262B]/60 mb-8">
          A keresett oldal nem létezik, vagy időközben megváltozott a címe.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-semibold rounded-xl transition-colors duration-300"
        >
          Vissza a főoldalra
        </Link>
      </div>
    </div>
  );
}
