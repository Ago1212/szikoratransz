import React, { useState } from "react";
import { PiFunnelLight, PiXLight, PiBookmarkSimpleLight } from "react-icons/pi";
import FormField, { FormSection } from "components/UI/FormField.js";
import { KATEGORIA_INFO, MODUL_LABEL } from "components/Fajlok/fajlKategoriaInfo.js";

const MENTETT_NEZETEK_KULCS = "fajlok-mentett-nezetek";

// Gyors filter-chipek (kategória + "Ez a hét") ÉLŐ darabszámmal a
// statisztikából — a ritkábban használt dimenziók (feltöltő, egyedi
// dátumtartomány, modul) egy "Egyedi szűrő" felugró panelba kerülnek, a
// meglévő FormSection-alapú mintát követve (ld. Karbantartasok.js).
export default function FajlFilterChips({
  kategoriaSzerint,
  aktivKategoria,
  onKategoriaChange,
  ezAHetAktiv,
  onEzAHetToggle,
  szuro,
  onSzuroChange,
  feltoltok,
}) {
  const [panelNyitva, setPanelNyitva] = useState(false);
  const [mentettNezetek, setMentettNezetek] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(MENTETT_NEZETEK_KULCS) || "[]");
    } catch (e) {
      return [];
    }
  });

  const egyediSzuroAktivSzam = ["modul", "feltoltoId", "datumTol", "datumIg"].filter((k) => szuro[k]).length;

  const nezetMentese = () => {
    const nev = window.prompt("Nézet neve (pl. „Bank importok, 30 napon belül”):", "");
    if (!nev) return;
    const uj = [...mentettNezetek.filter((n) => n.nev !== nev), { nev, kategoria: aktivKategoria, ezAHet: ezAHetAktiv, szuro }];
    setMentettNezetek(uj);
    localStorage.setItem(MENTETT_NEZETEK_KULCS, JSON.stringify(uj));
  };

  const nezetBetoltese = (nezet) => {
    onKategoriaChange(nezet.kategoria);
    onEzAHetToggle(nezet.ezAHet);
    onSzuroChange(nezet.szuro);
  };

  const nezetTorlese = (nev) => {
    const uj = mentettNezetek.filter((n) => n.nev !== nev);
    setMentettNezetek(uj);
    localStorage.setItem(MENTETT_NEZETEK_KULCS, JSON.stringify(uj));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onKategoriaChange("")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
            !aktivKategoria
              ? "bg-brand-600 text-white"
              : "border border-ink-200 bg-white text-ink-600 hover:border-brand-200 hover:text-brand-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
          }`}
        >
          Összes <span className="opacity-70">{kategoriaSzerint.reduce((sum, k) => sum + k.darab, 0)}</span>
        </button>
        {kategoriaSzerint.map((k) => {
          const info = KATEGORIA_INFO[k.fajl_kategoria] || KATEGORIA_INFO.egyeb;
          const aktiv = aktivKategoria === k.fajl_kategoria;
          return (
            <button
              key={k.fajl_kategoria}
              type="button"
              onClick={() => onKategoriaChange(aktiv ? "" : k.fajl_kategoria)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
                aktiv
                  ? "bg-brand-600 text-white"
                  : "border border-ink-200 bg-white text-ink-600 hover:border-brand-200 hover:text-brand-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
              }`}
            >
              {info.label} <span className="opacity-70">{k.darab}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onEzAHetToggle(!ezAHetAktiv)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
            ezAHetAktiv
              ? "bg-brand-600 text-white"
              : "border border-ink-200 bg-white text-ink-600 hover:border-brand-200 hover:text-brand-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
          }`}
        >
          Ez a hét
        </button>

        <button
          type="button"
          onClick={() => setPanelNyitva((v) => !v)}
          className={`relative flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
            panelNyitva || egyediSzuroAktivSzam > 0
              ? "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
              : "border-ink-200 bg-white text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
          }`}
        >
          <PiFunnelLight className="h-3.5 w-3.5" />
          Egyedi szűrő
          {egyediSzuroAktivSzam > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
              {egyediSzuroAktivSzam}
            </span>
          )}
        </button>

        {mentettNezetek.map((nezet) => (
          <span
            key={nezet.nev}
            className="flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-sm text-ink-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
          >
            <button type="button" onClick={() => nezetBetoltese(nezet)} className="flex items-center gap-1.5">
              <PiBookmarkSimpleLight className="h-3.5 w-3.5 text-brand-500" />
              {nezet.nev}
            </button>
            <button type="button" onClick={() => nezetTorlese(nezet.nev)} className="text-ink-300 hover:text-red-500 dark:text-ink-600">
              <PiXLight className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={nezetMentese}
          className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
        >
          + Nézet mentése
        </button>
      </div>

      {panelNyitva && (
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft dark:border-ink-800 dark:bg-ink-900">
          <FormSection columns={3}>
            <FormField
              as="select"
              label="Modul"
              value={szuro.modul}
              onChange={(e) => onSzuroChange({ ...szuro, modul: e.target.value })}
            >
              <option value="">Összes modul</option>
              {Object.entries(MODUL_LABEL).map(([kulcs, label]) => (
                <option key={kulcs} value={kulcs}>
                  {label}
                </option>
              ))}
            </FormField>
            <FormField
              as="select"
              label="Feltöltő"
              value={szuro.feltoltoId}
              onChange={(e) => onSzuroChange({ ...szuro, feltoltoId: e.target.value })}
            >
              <option value="">Összes feltöltő</option>
              {feltoltok.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </FormField>
            <div />
            <FormField
              type="date"
              label="Dátumtól"
              value={szuro.datumTol}
              onChange={(e) => onSzuroChange({ ...szuro, datumTol: e.target.value })}
            />
            <FormField
              type="date"
              label="Dátumig"
              value={szuro.datumIg}
              onChange={(e) => onSzuroChange({ ...szuro, datumIg: e.target.value })}
            />
          </FormSection>
        </div>
      )}
    </div>
  );
}
