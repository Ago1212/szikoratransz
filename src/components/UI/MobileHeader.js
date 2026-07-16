import React from "react";
import { useHistory } from "react-router-dom";
import { PiArrowLeftLight } from "react-icons/pi";

// Egységes fejléc a sofőr-oldal aloldalaihoz (Kamion/Pótkocsi
// kiválasztás, Új bejelentés, Tankolás, stb.) — sticky a tartalom
// fölött, opcionális vissza-gombbal, hogy egykezes használat mellett is
// mindig elérhető legyen.
//
// `back={false}` esetén (a fő nav-fülekhez tartozó tetején lévő oldalak:
// Bejelentéseim, Értesítések, Profil) ez a fejléc csak egy puszta cím —
// asztali nézetben ez feleslegesen duplikálja a fő navigáció már amúgy is
// kiemelt aktív fülét, ezért ott `md:hidden`. Ahol VAN vissza-gomb
// (`back` alapértelmezetten `true` — Kamion/Pótkocsi kiválasztás, Új
// bejelentés, stb.), a fejléc marad látható asztalon is, mert ott ez adja
// az egyetlen navigációs utat vissza — azt nem szabad eltüntetni.
export default function MobileHeader({ title, back = true, action }) {
  const history = useHistory();

  return (
    <div
      className={`sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-2 border-b border-ink-100 bg-slate-50/95 px-4 py-3 backdrop-blur ${
        back ? "" : "md:hidden"
      }`}
    >
      {back && (
        <button
          type="button"
          onClick={() => history.goBack()}
          className="-ml-1.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors duration-150 hover:bg-white hover:text-ink-900"
          aria-label="Vissza"
        >
          <PiArrowLeftLight className="h-5 w-5" />
        </button>
      )}
      <h1 className="min-w-0 flex-1 truncate font-display text-base font-bold text-brand-900">
        {title}
      </h1>
      {action}
    </div>
  );
}
