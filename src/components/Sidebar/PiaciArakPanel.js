import React, { useEffect, useState } from "react";
import { PiCaretDownLight, PiCaretUpFill, PiCaretDownFill } from "react-icons/pi";
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
// pont fölötte lévő komment. Alapból nyitva (a felhasználó kifejezetten
// "mindig könnyen elérhető" igényt jelzett), de összecsukható, ugyanazzal
// a mintával, mint a nav-csoportok (GroupHeader).
//
// Kompakt "ticker" elrendezés (felhasználói kérésre, egy másik alkalmazás
// sidebar-jának tőzsdei jegyzés-stílusát követve — csak a FELÉPÍTÉST, nem
// a színvilágát): egy sor = címke + érték + irány-nyíl + mértékegység,
// nincs ikon-jelvény és sparkline a fősorban. A %-os delta és az
// időszak-viszonyítás (ld. UX-audit "market intelligence" pontja,
// piaciArakInterface.php `IDOSZAK_CIMKE`) nem veszett el, csak a sor
// `title` tooltipjébe költözött — pontos infó, ticker-tömörség mellett.
export default function PiaciArakPanel() {
  const [open, setOpen] = useState(true);
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

  // Csoportosítás a backend által már adott sorrend megtartásával (nem
  // ábécérendben) — a `csoport` mező hiányában (pl. jövőbeli, még nem
  // kategorizált kulcs) egy "Egyéb" gyűjtő-csoportba esik, hogy semmi ne
  // tűnjön el csendben.
  const csoportok = [];
  const csoportIndex = {};
  tetelek.forEach((t) => {
    const nev = t.csoport || "Egyéb";
    if (!(nev in csoportIndex)) {
      csoportIndex[nev] = csoportok.length;
      csoportok.push({ nev, tetelek: [] });
    }
    csoportok[csoportIndex[nev]].tetelek.push(t);
  });

  // A lábléc a LEGRÉGEBBI frissítést mutatja (nem a legfrissebbet) —
  // ha akár egyetlen forrás is elavult, az egész panel "nem teljesen
  // friss" jelzést kapjon, ne a legjobb esetet mutassa hazug módon.
  const legregebbiFrissitve = tetelek.reduce(
    (legregebbi, t) => (t.frissitve && (!legregebbi || t.frissitve < legregebbi) ? t.frissitve : legregebbi),
    null,
  );
  const mindenFriss = legregebbiFrissitve ? legregebbiFrissitve.slice(0, 10) === maiDatum() : false;

  return (
    <div className="flex-shrink-0 border-t border-ink-100 px-3 py-2.5 dark:border-ink-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between rounded-xl px-1.5 py-1 text-left transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-ink-800"
      >
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-500 group-hover:text-ink-800 dark:text-ink-400 dark:group-hover:text-ink-50">
          Piaci árak
        </span>
        <PiCaretDownLight
          className={`h-3.5 w-3.5 flex-shrink-0 text-ink-400 dark:text-ink-500 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <div className="mt-1">
          {csoportok.map((csoport) => (
            <div key={csoport.nev}>
              {csoportok.length > 1 && (
                <p className="px-1.5 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-ink-400 dark:text-ink-500 first:pt-0.5">
                  {csoport.nev}
                </p>
              )}
              {csoport.tetelek.map((t) => {
                const IranyIcon =
                  t.valtozas === "fel" ? PiCaretUpFill : t.valtozas === "le" ? PiCaretDownFill : null;
                const iranySzin =
                  t.valtozas === "fel"
                    ? "text-emerald-600"
                    : t.valtozas === "le"
                      ? "text-red-600"
                      : "text-ink-400 dark:text-ink-500";
                const tooltip = [
                  t.frissitve ? `Frissítve: ${t.frissitve}` : "Nincs elérhető adat",
                  t.valtozasSzazalek !== null
                    ? `${t.valtozas === "fel" ? "+" : t.valtozas === "le" ? "-" : ""}${formatSzazalek(t.valtozasSzazalek)}%${t.idoszakCimke ? ` (${t.idoszakCimke})` : ""}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={t.kulcs}
                    title={tooltip}
                    className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-ink-800"
                  >
                    <span className="truncate text-xs font-semibold text-ink-600 dark:text-ink-300">{t.cimke}</span>
                    <span className="flex flex-shrink-0 items-center gap-1">
                      <span className="text-xs font-bold tabular-nums text-ink-900 dark:text-ink-50">
                        {formatSzam(t.ertek, t.egyseg === "Ft/l" ? 0 : 2)}
                      </span>
                      {IranyIcon && <IranyIcon className={`h-2.5 w-2.5 ${iranySzin}`} />}
                      <span className="text-[10px] font-medium text-ink-400 dark:text-ink-500">{t.egyseg}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          {legregebbiFrissitve && (
            <div className="mt-1 flex items-center gap-1.5 border-t border-ink-100 px-1.5 pt-1.5 dark:border-ink-800">
              <span
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${mindenFriss ? "bg-emerald-500" : "bg-amber-500"}`}
              />
              <span className="text-[10px] font-semibold text-ink-400 dark:text-ink-500">
                Frissítve: {formatFrissitve(legregebbiFrissitve)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
