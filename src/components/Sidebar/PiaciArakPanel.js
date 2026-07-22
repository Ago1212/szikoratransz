import React, { useEffect, useState } from "react";
import { PiCaretDownLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

const FRISSITES_MS = 5 * 60 * 1000; // a backend saját 1/12 órás gyorsítótárán belül elég 5 percenként újranézni

const formatSzam = (ertek, tizedesek) =>
  ertek === null
    ? "—"
    : new Intl.NumberFormat("hu-HU", {
        minimumFractionDigits: tizedesek,
        maximumFractionDigits: tizedesek,
      }).format(ertek);

const formatSzazalek = (ertek) =>
  new Intl.NumberFormat("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    Math.abs(ertek),
  );

const maiDatum = () => new Date().toISOString().slice(0, 10);

// UX-audit 5. pont ("mikor frissült utoljára, dátum-tudatosan") — a
// backend "YYYY-MM-DD HH:MM:SS" (szerver saját időzónája szerinti, naiv)
// formátumot ad; ne a böngésző `Date`-jére bízzuk a parse-olást (ami
// UTC-nek értelmezné), csak szövegként vágjuk szét. Ha a dátumrész NEM a
// mai nap, a teljes dátumot is kiírjuk — egy 3 napja "beragadt" 07:30-as
// időbélyeg sose tűnjön mainak.
const formatFrissitve = (frissitve) => {
  if (!frissitve) return null;
  const [datum, idoResz] = frissitve.split(" ");
  const ora = idoResz ? idoResz.slice(0, 5) : null;
  if (!ora) return null;
  return datum === maiDatum() ? `ma ${ora}` : `${datum} ${ora}`;
};

// A "Piaci árak" panel a Sidebar SAJÁT, mindig látható (nem a görgethető
// nav-listával együtt eltűnő) sávjában él — ld. Sidebar.js beillesztési
// pont fölötte lévő komment. Fiókonkénti localStorage-perzisztenciával
// nyílik/csukódik (ld. Sidebar.js `sidebar-groups-${user.id}` minta),
// alapból csukva.
//
// UI/UX-újratervezés (2026-07-21, felhasználói visszajelzés alapján — "nem
// tetszik"): a korábbi változat vizuálisan ÖSSZEKEVEREDETT a nav-csoportokkal
// (ugyanaz a félkövér, nagybetűs, `tracking-wide` fejléc-stílus, mint
// FLOTTA/CSAPAT/stb.), miközben ez nem navigáció, hanem egy háttér-infó
// widget — más kategóriájú tartalom, más vizuális nyelvet érdemel. Emellett
// 3 tétel köré 5 KÜLÖNBÖZŐ vizuális réteg tornyosult: fejléc, 2 db mikro-
// csoport-címke (ÁRFOLYAMOK/ÜZEMANYAG — ekkora tételszámnál a csoportosítás
// maga nem ért annyit, amennyi zajt hozott), soronkénti irány-nyíl ikon +
// külön szín, és egy pöttyös frissesség-lábléc — összesen túl sok jelzés egy
// alapvetően csendes, ambiens adatra. Az új verzió:
// - halványan elkülönített kártya-háttér (nem a nyílt nav-lista folytatása),
// - kisbetűs, nem-kövér fejléc-címke (vizuálisan egyértelműen NEM egy
//   nav-csoport-fejléc),
// - nincs mikro-csoportosítás — a 3 tétel egyszerűen egymás alatt,
// - az irány NEM külön ikon, hanem magának az értéknek a színe hordozza
//   (zöld/piros/semleges) — egy jelzés, nem kettő,
// - a %-os delta és az időszak-viszonyítás továbbra is a sor `title`
//   tooltipjében él (nem veszett el, csak nem tolakszik),
// - a frissesség-lábléc pöttyözés nélkül, egyetlen halvány sorként.
export default function PiaciArakPanel() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(`piaci-arak-nyitva-${user?.id}`);
      if (stored !== null) return stored === "true";
    } catch (e) {
      // ignore — sérült/hiányzó localStorage-bejegyzés esetén marad az alapértelmezett
    }
    return false;
  });
  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(`piaci-arak-nyitva-${user.id}`, String(open));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const [tetelek, setTetelek] = useState([]);

  const betolt = () => {
    fetchAction("getPiaciArak", {}).then((result) => {
      if (result?.success) setTetelek(result.tetelek || []);
    });
  };

  useEffect(() => {
    betolt();
    const id = setInterval(betolt, FRISSITES_MS);
    return () => clearInterval(id);
  }, []);

  if (tetelek.length === 0) return null;

  // A lábléc a LEGRÉGEBBI frissítést mutatja (nem a legfrissebbet) —
  // ha akár egyetlen forrás is elavult, az egész panel "nem teljesen
  // friss" jelzést kapjon, ne a legjobb esetet mutassa hazug módon.
  const legregebbiFrissitve = tetelek.reduce(
    (legregebbi, t) => (t.frissitve && (!legregebbi || t.frissitve < legregebbi) ? t.frissitve : legregebbi),
    null,
  );

  return (
    <div className="flex-shrink-0 px-3 py-2">
      <div className="overflow-hidden rounded-xl bg-slate-50 dark:bg-ink-800/50">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="group flex w-full items-center justify-between px-2.5 py-2 text-left transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-ink-800"
        >
          <span className="text-[11px] font-medium text-ink-400 group-hover:text-ink-600 dark:text-ink-500 dark:group-hover:text-ink-300">
            Piaci árak
          </span>
          <PiCaretDownLight
            className={`h-3 w-3 flex-shrink-0 text-ink-300 transition-transform duration-200 dark:text-ink-600 ${open ? "" : "-rotate-90"}`}
          />
        </button>

        {open && (
          <div className="border-t border-ink-100 px-2.5 py-1 dark:border-ink-700">
            {tetelek.map((t) => {
              const ertekSzin =
                t.valtozas === "fel"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : t.valtozas === "le"
                    ? "text-red-600 dark:text-red-400"
                    : "text-ink-800 dark:text-ink-100";
              const tooltip = [
                t.frissitve ? `Frissítve: ${t.frissitve}` : "Nincs elérhető adat",
                t.valtozasSzazalek !== null
                  ? `${t.valtozas === "fel" ? "+" : t.valtozas === "le" ? "-" : ""}${formatSzazalek(t.valtozasSzazalek)}%${t.idoszakCimke ? ` (${t.idoszakCimke})` : ""}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={t.kulcs} title={tooltip} className="flex items-center justify-between gap-2 py-1">
                  <span className="truncate text-xs text-ink-500 dark:text-ink-400">{t.cimke}</span>
                  <span className="flex flex-shrink-0 items-baseline gap-1">
                    <span className={`text-xs font-semibold tabular-nums ${ertekSzin}`}>
                      {formatSzam(t.ertek, t.egyseg === "Ft/l" ? 0 : 2)}
                    </span>
                    <span className="text-[10px] text-ink-400 dark:text-ink-500">{t.egyseg}</span>
                  </span>
                </div>
              );
            })}

            {legregebbiFrissitve && (
              <p className="mt-0.5 border-t border-ink-100 pt-1 text-center text-[10px] text-ink-300 dark:border-ink-700 dark:text-ink-600">
                Frissítve: {formatFrissitve(legregebbiFrissitve)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
