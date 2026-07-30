import React from "react";
import DatePicker from "components/UI/DatePicker.js";

// `min-h-11` (44px) — a mobil UX audit (2026-07-30) érintési célpont
// méret találata: py-2 + text-sm önmagában csak ~38px-et adott ki,
// a HIG/Material 44px-es minimuma alatt.
const inputClass =
  "w-full min-h-11 rounded-lg border border-ink-100 bg-slate-50 px-3 py-2 text-sm text-brand-900 placeholder-ink-300 transition-colors duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-50";

// Egységes mező-minta (label + ikon + input/select/textarea) — korábban
// minden nagy űrlap (jármű, pótkocsi, sofőr, saját adatok) mezőnként
// külön-külön másolta ezt a blokkot.
export default function FormField({
  label,
  icon: Icon,
  required,
  as = "input",
  type = "text",
  className = "",
  inputClassName = "",
  children,
  ...inputProps
}) {
  // A label eddig sosem kapcsolódott az inputhoz (`htmlFor` hiánya) — egy
  // screen reader emiatt nem jelentette be a mező címkéjét fókuszáláskor
  // (WCAG 1.3.1/4.1.2, ld. UX-audit). `id`-t vagy `name`-et a hívók szinte
  // mindig megadnak; ahol egyiket sem, a label ott is renderelődik, csak
  // `htmlFor` nélkül marad (nincs mihez kapcsolni).
  const fieldId = inputProps.id || inputProps.name;

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={fieldId}
          className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-600 dark:text-ink-300"
        >
          {Icon && <Icon className="h-3.5 w-3.5 text-brand-500" />}
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {as === "select" ? (
        <select
          className={`${inputClass} ${inputClassName}`}
          required={required}
          {...inputProps}
          id={fieldId}
        >
          {children}
        </select>
      ) : as === "textarea" ? (
        <textarea
          className={`${inputClass} ${inputClassName}`}
          required={required}
          {...inputProps}
          id={fieldId}
        />
      ) : as === "info" ? (
        <div className={`${inputClass} cursor-default bg-slate-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400 ${inputClassName}`}>
          {inputProps.value || "-"}
        </div>
      ) : type === "date" ? (
        <DatePicker
          required={required}
          className={inputClassName}
          {...inputProps}
          id={fieldId}
        />
      ) : (
        <input
          type={type}
          className={`${inputClass} ${inputClassName}`}
          required={required}
          {...inputProps}
          id={fieldId}
        />
      )}
    </div>
  );
}

const gridColsClass = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
};

// Fájlok-redesign UX-audit (2026-07-23): korábban a rács egyetlen ugrással
// váltott 1-2 oszlopról (mobil) egyenesen `columns` oszlopra `md:`-nél
// (768px+) — egy ~640-768px széles tablet-nézeten ez feleslegesen
// zsúfolt (5 oszlop) vagy pazarló (1-2 oszlop) volt. Egy köztes `sm:`
// lépcső mindig SZŰKEBB oszlopszámot ad, mint a végleges `md:` érték, így
// ez a változás minden meglévő FormSection-hívónál csak javít, sosem ront.
const smGridColsClass = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2",
  4: "sm:grid-cols-2",
  5: "sm:grid-cols-3",
};

const mobileGridColsClass = {
  1: "grid-cols-1",
  2: "grid-cols-2",
};

// `mobileColumns` opcionális, alapértelmezetten 1 (a korábbi, mindig
// egyoszlopos mobil viselkedést megőrizve minden meglévő FormSection
// hívónál) — csak ott adjunk `2`-t, ahol a szekció MINDEN mezője
// egyformán rövid (pl. szám/dátum), így mobilon is párba állíthatók
// hosszú mezők (cím, lakcím) torzítása nélkül.
export function FormSection({ id, title, icon: Icon, columns = 2, mobileColumns = 1, children, className = "" }) {
  return (
    <div id={id} className={`scroll-mt-4 ${className}`}>
      {title && (
        <h4 className="mb-2.5 flex items-center gap-1.5 border-b border-ink-100 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400 dark:border-ink-800 dark:text-ink-500">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {title}
        </h4>
      )}
      <div
        className={`grid gap-x-4 gap-y-3 ${mobileGridColsClass[mobileColumns] || mobileGridColsClass[1]} ${
          smGridColsClass[columns] || smGridColsClass[2]
        } ${gridColsClass[columns] || gridColsClass[2]}`}
      >
        {children}
      </div>
    </div>
  );
}
