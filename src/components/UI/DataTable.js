import React from "react";
import { PiPlusLight, PiDownloadSimpleLight } from "react-icons/pi";
import { GradientCardHeader } from "components/UI/PageCard.js";
import Spinner from "components/UI/Spinner.js";

// Excel export — a `render` oszlopok JSX-et adnak vissza (pl. állapot-
// jelvény, gombok), ezért azoknál nem a renderelt kimenetet exportáljuk.
// Egy oszlop opcionálisan megadhat egy `exportValue(row)` függvényt, ami
// egy sima szöveget ad vissza kifejezetten az exporthoz (pl. egy számított
// oszlopnál, aminek a `key`-e nem is létezik nyers mezőként a soron —
// enélkül az ilyen oszlopok korábban NÉMÁN ÜRESEN exportálódtak, mert az
// export a puszta `row[col.key]`-t nézte). Ha nincs `exportValue`, a nyers
// `row[col.key]` érték kerül a cellába. Az "actions" oszlop mindig kimarad.
//
// A táblázatot megjelenítő `columns`-tól függetlenül egy oldal megadhat
// egy bővebb `exportColumns` listát is (ld. DataTable `exportColumns`
// propja) — így az exportba bekerülhetnek olyan mezők is, amik a kompakt
// nézetben helyhiány miatt nem látszanak (pl. lejárati dátumok, biztosítási
// adatok), anélkül hogy a képernyőn megjelenő táblázat zsúfolt lenne.
//
// Szándékosan NEM az npm `xlsx` (SheetJS) csomagot használjuk: az onnan
// telepíthető legfrissebb verzió (0.18.5) ismert, javítatlan sérülékeny-
// ségeket hordoz (a SheetJS 2023 óta a saját CDN-jén ad ki javított
// verziókat, nem az npm registry-n). Ehelyett egy natív, függőség nélküli
// formátumot építünk: a "SpreadsheetML" (Excel 2003 XML) egy egyszerű,
// jól dokumentált XML-fájl, amit az Excel dupla kattintásra natívan,
// valódi cellákkal/sorokkal nyit meg — nem csak egy átnevezett CSV.
function exportRowsToExcel(columns, rows, filename) {
  const exportCols = columns.filter((col) => col.key !== "actions");
  const escapeXml = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };
  const cell = (value) =>
    `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
  const resolveValue = (col, row) =>
    col.exportValue ? col.exportValue(row) : row[col.key];

  const headerRow = `<Row>${exportCols.map((col) => cell(col.label)).join("")}</Row>`;
  const dataRows = rows
    .map(
      (row) =>
        `<Row>${exportCols.map((col) => cell(resolveValue(col, row))).join("")}</Row>`,
    )
    .join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(filename).slice(0, 31)}">
  <Table>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// A gomb látható mérete változatlan (h-8/32px — sűrű asztali táblázathoz
// illő), de az érinthető terület mobilon 44×44px-re nő (Apple/Google
// minimum érintési célterület ajánlása) — az utóbbi a sűrű mobil
// kártyanézetben számít, ahol a szerkesztés/törlés gombok egymás
// mellett, ujjal érintve könnyen összecserélhetők lennének.
export function ActionIcon({ icon, onClick, title, danger = false }) {
  return (
    <button
      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ease-fluid hover:scale-105 active:scale-95 md:h-8 md:w-8 ${
        danger
          ? "border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-ink-200 bg-white text-ink-500 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
      }`}
      onClick={onClick}
      title={title}
      aria-label={title}
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
  // Ha meg van adva, a fejlécben megjelenik egy "Excel export" gomb, ami a
  // jelenleg megjelenített (szűrt) sorokat tölti le ezzel a fájlnévvel.
  exportFilename,
  // Opcionális, bővebb oszlopkészlet KIFEJEZETTEN az exporthoz — ha nincs
  // megadva, a képernyőn is látható `columns` kerül exportálásra. Ezzel egy
  // oldal olyan mezőket is belefoglalhat az Excel-be, amik a kompakt
  // táblázat-/kártyanézetben helyhiány miatt nem jelennek meg.
  exportColumns,
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
  // Mobilon nincs Excel-exportra szükség (nincs hova letölteni/megnyitni
  // kényelmesen egy .xlsx fájlt egy kártyalistás nézetben) — a gomb csak
  // `md:` fölött jelenik meg, hogy a mobil fejléc ne zsúfolódjon tele.
  const exportButton = exportFilename && (
    <button
      className="hidden items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-ink-500 shadow-soft transition-all duration-300 ease-fluid hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-95 md:flex"
      type="button"
      title="Táblázat exportálása Excelbe"
      onClick={() => exportRowsToExcel(exportColumns || columns, rows, exportFilename)}
    >
      <PiDownloadSimpleLight className="h-4 w-4" /> Excel
    </button>
  );

  const resolvedHeaderAction =
    headerAction ??
    (onAdd || exportButton ? (
      <div className="flex items-center gap-2">
        {exportButton}
        {onAdd && (
          <button
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-all duration-300 ease-fluid hover:bg-brand-700 active:scale-95"
            type="button"
            onClick={onAdd}
          >
            <PiPlusLight className="h-4 w-4" /> {addLabel}
          </button>
        )}
      </div>
    ) : null);

  const bodyMaxHeight = fill ? undefined : maxBodyHeight;
  const bodyFillClass = fill ? "min-h-0 flex-1" : "";

  // Alapértelmezett üres-állapot — a táblázat saját fejléc-ikonját
  // (nagyobban, halványan) használja, hogy azonnal lásd, milyen típusú
  // adat hiányzik, nem csak egy sima szöveg lóg a semmiben. Ha van
  // hozzáadás-akció, egy közvetlen "+ Új" gomb is megjelenik itt, hogy
  // egy üres listánál (pl. friss fiók) ne kelljen felgörgetni a fejléc
  // gombjáig a következő lépéshez.
  const EmptyContent = () => (
    <div className="flex flex-col items-center gap-3 py-4">
      {icon && React.createElement(icon, { className: "h-8 w-8 text-ink-200" })}
      <span>{emptyLabel}</span>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-1 flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-all duration-300 ease-fluid hover:bg-brand-700 active:scale-95"
        >
          <PiPlusLight className="h-4 w-4" /> {addLabel}
        </button>
      )}
    </div>
  );

  return (
    <div
      className={`relative -mx-4 flex min-w-0 flex-col overflow-hidden bg-white shadow-none ring-0 md:mx-0 md:rounded-3xl md:shadow-soft md:ring-1 md:ring-ink-100 ${
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
          {/* Mobil nézet — önálló kártyák, könnyebben kezelhető, mint a görgethető táblázat.
              `fill` módban (pl. Karbantartasok, ahol a szülő már `h-full flex-col`, saját
              overflow NÉLKÜL) ez a doboz jogosan maga görget, mert ő az egyetlen görgethető
              réteg. Alap (`!fill`) módban viszont az Admin.js layout már maga is
              `overflow-y-auto` — ha ez a doboz ITT is kap egy saját, fix `max-h`-s
              overflow-t, az egy beágyazott ("scroll a scrollban") csapdát hoz létre
              mobilon: a lista nagy részét egy alacsony belső dobozban kellene görgetni,
              a lapot magát meg csak alig. Ezért mobilon `!fill` esetén NINCS itt saját
              overflow/max-height — a kártyalista egyszerűen a lap normál folyásába illeszkedik. */}
          <div
            className={`w-full bg-slate-50 md:hidden ${fill ? `overflow-y-auto ${bodyFillClass}` : ""}`}
            style={fill ? { maxHeight: bodyMaxHeight } : undefined}
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
                              {col.render
                                ? col.render(row, index)
                                : row[col.key]}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-ink-400">
                <EmptyContent />
              </div>
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
                        onRowDoubleClick
                          ? () => onRowDoubleClick(row)
                          : undefined
                      }
                      style={{
                        cursor: onRowDoubleClick ? "pointer" : "default",
                      }}
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
                      <EmptyContent />
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
