import React from "react";
import { PiPlusLight } from "react-icons/pi";
import { GradientCardHeader } from "components/UI/PageCard.js";
import Spinner from "components/UI/Spinner.js";

export function ActionIcon({ icon, onClick, title, danger = false }) {
  return (
    <button
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ease-fluid hover:scale-105 active:scale-95 ${
        danger
          ? "border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-ink-200 bg-white text-ink-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
      }`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {icon}
    </button>
  );
}

// Egységes, márka-stílusú táblázat-kártya. A projektben korábban minden
// entitás (kamion, sofőr, pótkocsi, ...) saját maga másolta ezt a
// fejléc/thead/tbody/üres-állapot mintát — ez az egyetlen hely, ahol
// ez a minta létezik, a különbség csak az oszlopok/sorok/akciók.
export default function DataTable({
  icon,
  title,
  headerAction,
  onAdd,
  addLabel = "Új",
  columns,
  rows,
  rowKey = (row, index) => row.id ?? row.sorszam ?? index,
  onRowDoubleClick,
  loading = false,
  emptyLabel = "Nincs megjeleníthető adat",
  emptyState,
  className = "",
  maxBodyHeight = "min(80vh, 760px)",
  mobileTitleKey,
  // Ha true: a táblázat a szülő flex-konténer rendelkezésre álló
  // magasságát tölti ki (nem egy fix vh-értéket) — így egy olyan oldalon,
  // ahol felette még van cím/szűrő sáv is, a táblázat sosem lóghat túl a
  // képernyőn, akkor sem, ha a szűrő nyitva van. A szülőnek ehhez
  // `flex min-h-0 flex-1` (vagy `h-full`) konténerben kell állnia.
  fill = false,
}) {
  const actionsCol = columns.find((col) => col.key === "actions");
  const fieldCols = columns.filter((col) => col.key !== "actions");
  const primaryCol =
    (mobileTitleKey && fieldCols.find((col) => col.key === mobileTitleKey)) ||
    fieldCols[0];
  const secondaryCols = fieldCols.filter((col) => col.key !== primaryCol?.key);
  const resolvedHeaderAction =
    headerAction ??
    (onAdd ? (
      <button
        className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-all duration-300 ease-fluid hover:bg-brand-700 active:scale-95"
        type="button"
        onClick={onAdd}
      >
        <PiPlusLight className="h-4 w-4" /> {addLabel}
      </button>
    ) : null);

  const bodyMaxHeight = fill ? undefined : maxBodyHeight;
  const bodyFillClass = fill ? "min-h-0 flex-1" : "";

  return (
    <div
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink-100 ${
        fill ? "h-full" : ""
      } ${className}`}
    >
      {title && (
        <GradientCardHeader
          icon={icon}
          title={title}
          action={resolvedHeaderAction}
        />
      )}

      {loading ? (
        <Spinner />
      ) : rows.length === 0 && emptyState ? (
        emptyState
      ) : (
        <>
          {/* Mobil nézet — önálló kártyák, könnyebben kezelhető, mint a görgethető táblázat */}
          <div
            className={`w-full overflow-y-auto bg-sand-50 md:hidden ${bodyFillClass}`}
            style={{ maxHeight: bodyMaxHeight }}
          >
            {rows.length > 0 ? (
              <div className="space-y-3 p-3">
                {rows.map((row, index) => (
                  <div
                    key={rowKey(row, index)}
                    className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft"
                    onClick={
                      onRowDoubleClick ? () => onRowDoubleClick(row) : undefined
                    }
                    style={{ cursor: onRowDoubleClick ? "pointer" : "default" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {primaryCol && (
                        <div className="min-w-0 truncate text-base font-bold text-ink-900">
                          {primaryCol.render
                            ? primaryCol.render(row, index)
                            : row[primaryCol.key]}
                        </div>
                      )}
                      {actionsCol && (
                        <div
                          className="flex flex-shrink-0 gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {actionsCol.render
                            ? actionsCol.render(row, index)
                            : row[actionsCol.key]}
                        </div>
                      )}
                    </div>

                    {secondaryCols.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                        {secondaryCols.map((col) => (
                          <div key={col.key} className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                              {col.label}
                            </div>
                            <div className="mt-0.5 truncate text-sm text-ink-700">
                              {col.render ? col.render(row, index) : row[col.key]}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-6 py-10 text-center text-sm text-ink-400">
                {emptyLabel}
              </p>
            )}
          </div>

          {/* Asztali nézet — táblázat */}
          <div
            className={`hidden w-full overflow-auto md:block ${bodyFillClass}`}
            style={{ maxHeight: bodyMaxHeight }}
          >
            <table className="w-full border-collapse bg-transparent">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`sticky top-0 z-10 whitespace-nowrap border-b border-ink-100 bg-white px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400 text-${
                        col.headerAlign || col.align || "left"
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row, index) => (
                    <tr
                      key={rowKey(row, index)}
                      className="border-b border-ink-100 transition-colors duration-200 last:border-0 hover:bg-brand-50/40"
                      onDoubleClick={
                        onRowDoubleClick ? () => onRowDoubleClick(row) : undefined
                      }
                      style={{ cursor: onRowDoubleClick ? "pointer" : "default" }}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`whitespace-nowrap px-6 py-3.5 text-sm text-ink-600 text-${
                            col.align || "left"
                          } ${col.className || ""}`}
                        >
                          {col.render ? col.render(row, index) : row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-6 py-10 text-center text-sm text-ink-400"
                    >
                      {emptyLabel}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
