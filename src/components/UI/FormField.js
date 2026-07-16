import React from "react";
import DatePicker from "components/UI/DatePicker.js";

const inputClass =
  "w-full rounded-lg border border-ink-100 bg-slate-50 px-3 py-2 text-sm text-brand-900 placeholder-ink-300 transition-colors duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60";

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
  return (
    <div className={className}>
      {label && (
        <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-600">
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
        >
          {children}
        </select>
      ) : as === "textarea" ? (
        <textarea
          className={`${inputClass} ${inputClassName}`}
          required={required}
          {...inputProps}
        />
      ) : as === "info" ? (
        <div className={`${inputClass} cursor-default bg-slate-100 text-ink-500 ${inputClassName}`}>
          {inputProps.value || "-"}
        </div>
      ) : type === "date" ? (
        <DatePicker
          required={required}
          className={inputClassName}
          {...inputProps}
        />
      ) : (
        <input
          type={type}
          className={`${inputClass} ${inputClassName}`}
          required={required}
          {...inputProps}
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

export function FormSection({ id, title, icon: Icon, columns = 2, children, className = "" }) {
  return (
    <div id={id} className={`scroll-mt-4 ${className}`}>
      {title && (
        <h4 className="mb-2.5 flex items-center gap-1.5 border-b border-ink-100 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {title}
        </h4>
      )}
      <div className={`grid grid-cols-1 gap-x-4 gap-y-3 ${gridColsClass[columns] || gridColsClass[2]}`}>
        {children}
      </div>
    </div>
  );
}
