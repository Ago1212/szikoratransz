import React, { useState } from "react";
import {
  PiWarningCircleLight,
  PiCaretDownLight,
  PiCaretUpLight,
} from "react-icons/pi";

const forint = (ertek) =>
  ertek != null ? `${Number(ertek).toLocaleString("hu-HU")} Ft` : "—";

// Csak jelez, sosem ír automatikusan az `allapot` mezőbe (explicit felhasználói
// döntés — ld. CLAUDE.md "Fuvar státusz-workflow" szakasz) — az admin dönt a
// tényleges állapotváltásról, a "Megnyitás" csak a táblázat nézetre vált,
// a fuvar útvonalára szűkített kereséssel.
function Lista({ cim, tone, tetelek, onMegnyitas, renderMasodikSor }) {
  if (tetelek.length === 0) return null;
  const szinek =
    tone === "danger"
      ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
      : "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20";
  const cimSzin =
    tone === "danger"
      ? "text-red-700 dark:text-red-300"
      : "text-amber-700 dark:text-amber-300";

  return (
    <div className={`rounded-xl border p-3 ${szinek}`}>
      <h4
        className={`mb-2 text-xs font-bold uppercase tracking-wide ${cimSzin}`}
      >
        {cim} ({tetelek.length})
      </h4>
      <ul className="flex flex-col gap-1.5">
        {tetelek.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">
              {t.utvonal}
              {t.megbizoNev && (
                <span className="text-ink-400 dark:text-ink-500">
                  {" "}
                  — {t.megbizoNev}
                </span>
              )}
              <span className="text-ink-400 dark:text-ink-500">
                {" "}
                · {forint(t.osszesen)}
              </span>
              {renderMasodikSor && (
                <span className="text-ink-400 dark:text-ink-500">
                  {" "}
                  · {renderMasodikSor(t)}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => onMegnyitas(t.felrako || t.utvonal)}
              className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-ink-700 shadow-soft hover:bg-slate-50 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
            >
              Megnyitás
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FigyelmeztetesSav({ figyelmeztetesek, onMegnyitas }) {
  const [nyitva, setNyitva] = useState(false);
  if (!figyelmeztetesek) return null;
  const { lejartFizetes = [], szamlazasraVar = [] } = figyelmeztetesek;
  const osszesen = lejartFizetes.length + szamlazasraVar.length;
  if (osszesen === 0) return null;

  return (
    <div className="mb-4 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800">
      <button
        type="button"
        onClick={() => setNyitva((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-ink-800 dark:text-ink-100">
          <PiWarningCircleLight className="h-4 w-4 text-amber-600" />
          Figyelmet igénylő fuvarok ({osszesen})
        </span>
        {nyitva ? (
          <PiCaretUpLight className="h-4 w-4 text-ink-400" />
        ) : (
          <PiCaretDownLight className="h-4 w-4 text-ink-400" />
        )}
      </button>
      {nyitva && (
        <div className="mt-3 flex flex-col gap-3">
          <Lista
            cim="Lejárt fizetési határidő"
            tone="danger"
            tetelek={lejartFizetes}
            onMegnyitas={onMegnyitas}
            renderMasodikSor={(t) => `határidő: ${t.hatarido}`}
          />
          <Lista
            cim="Teljesítve, de még nincs számlázva"
            tone="warning"
            tetelek={szamlazasraVar}
            onMegnyitas={onMegnyitas}
            renderMasodikSor={(t) => `teljesítve: ${t.teljesitesDatuma}`}
          />
        </div>
      )}
    </div>
  );
}
