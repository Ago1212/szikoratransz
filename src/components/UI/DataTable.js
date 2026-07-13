import React, { useEffect, useRef, useState } from "react";
import {
  PiPlusLight,
  PiDownloadSimpleLight,
  PiMagnifyingGlassLight,
  PiCaretLeftLight,
  PiCaretRightLight,
} from "react-icons/pi";
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
export function exportRowsToExcel(columns, rows, filename) {
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
  // Ha true, a fejlécben megjelenik egy szabadszavas keresőmező, ami az
  // összes (nem "actions") oszlop értékét szűri — ugyanazt az
  // `exportValue`/`row[col.key]` felbontást használja, mint az Excel-
  // export, hogy a keresés a látott/exportált szöveg alapján működjön,
  // ne a `render()` által visszaadott JSX-en.
  searchable = false,
  searchPlaceholder = "Keresés...",
  // Ha meg van adva egy szám, a sorok lapozva jelennek meg ennyi soronként
  // — nélküle (alapértelmezetten) nincs lapozás, minden sor egyszerre
  // látszik (a meglévő `maxBodyHeight` szerinti görgetéssel).
  pageSize,
  // Ha true, a `rows` prop MÁR a szervertől kapott, lapozott/szűrt oldalt
  // tartalmazza — a komponens nem szűr/szeletel helyben, csak megjeleníti.
  // Ilyenkor a szülő felel a tényleges adatlekérésért; a keresőmező és a
  // lapozó gombok csak jelzik a szándékot (`onSearchChange`/`onPageChange`),
  // nem magát a szűrést végzik. Kötelező kísérő propok: `totalRows`, `page`,
  // `onPageChange` (lapozáshoz), `onSearchChange` (kereséshez, ha `searchable`).
  serverSide = false,
  totalRows = 0,
  page: pageProp = 1,
  onPageChange,
  onSearchChange,
  // Kereséskor ennyi ms tétlenség után fut le ténylegesen az `onSearchChange`
  // (szerver-kérés), hogy ne induljon új lekérdezés minden egyes leütött
  // billentyűre — a mező maga persze minden billentyűre azonnal frissül.
  searchDebounceMs = 400,
  // Szerver oldali módban az Excel-exportnak a JELENLEG betöltött (egy
  // oldalnyi) sornál többre van szüksége — ez a callback a teljes, aktuális
  // keresésnek megfelelő sorhalmazt kéri le (pl. ugyanaz a fetchAction, csak
  // page/pageSize nélkül) és azzal tér vissza. Ha nincs megadva, a gomb
  // (kényszerűségből) csak az épp látott oldalt exportálja.
  onExportAll,
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const debounceRef = useRef(null);

  // Szerver oldali keresésnél a mezőbe gépelt érték azonnal megjelenik,
  // de az `onSearchChange` (és ezzel az új szerver-lekérdezés) csak
  // `searchDebounceMs` tétlenség után fut le — enélkül minden leütött
  // billentyű egy külön API-hívást indítana.
  useEffect(() => {
    if (!serverSide || !searchable) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange?.(search.trim());
      onPageChange?.(1);
    }, searchDebounceMs);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, serverSide, searchable]);

  const actionsCol = columns.find((col) => col.key === "actions");
  const fieldCols = columns.filter((col) => col.key !== "actions");
  const primaryCol =
    (mobileTitleKey && fieldCols.find((col) => col.key === mobileTitleKey)) ||
    fieldCols[0];
  // Egy oszlop opcionálisan `mobileHidden: true`-val jelezheti, hogy a
  // mobil kártyanézetből kimaradjon (pl. ritkán kitöltött, másodlagos
  // mező, mint egy számlaszám vagy megjegyzés) — az asztali táblázatot
  // és az Excel-exportot ez nem érinti, csak a mobil kártya-grid mezőit.
  const secondaryCols = fieldCols.filter((col) => col.key !== primaryCol?.key && !col.mobileHidden);

  // Szabadszavas keresés — ugyanazt az `exportValue(row) ?? row[col.key]`
  // felbontást használja minden nem-"actions" oszlopra, mint az Excel-
  // export (ld. fenti komment), hogy a látott/exportált szöveg alapján
  // szűrjön, ne a `render()` JSX-én. Szerver oldali módban ez a helyi
  // szűrés/szeletelés ki van kapcsolva — a `rows` már a szerver válasza.
  const searchTerm = search.trim().toLowerCase();
  const filteredRows =
    !serverSide && searchable && searchTerm
      ? rows.filter((row) =>
          fieldCols.some((col) => {
            const value = col.exportValue ? col.exportValue(row) : row[col.key];
            return value != null && String(value).toLowerCase().includes(searchTerm);
          }),
        )
      : rows;

  const effectiveTotal = serverSide ? totalRows : filteredRows.length;
  const totalPages = pageSize ? Math.max(1, Math.ceil(effectiveTotal / pageSize)) : 1;
  const safePage = serverSide ? Math.min(Math.max(pageProp, 1), totalPages) : Math.min(Math.max(page, 1), totalPages);
  const pagedRows = serverSide
    ? rows
    : pageSize
      ? filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)
      : filteredRows;

  const goToPage = (nextPage) => {
    if (serverSide) {
      onPageChange?.(nextPage);
    } else {
      setPage(nextPage);
    }
  };

  const searchInput = searchable && (
    <div className="relative">
      <PiMagnifyingGlassLight className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-300" />
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!serverSide) setPage(1);
        }}
        placeholder={searchPlaceholder}
        className="w-full rounded-xl border border-ink-200 bg-white py-2 pl-8 pr-3 text-xs text-ink-700 placeholder-ink-300 transition-colors duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 sm:w-44"
      />
    </div>
  );

  const handleExportClick = async () => {
    if (serverSide && onExportAll) {
      setExporting(true);
      try {
        const allRows = await onExportAll();
        exportRowsToExcel(exportColumns || columns, allRows ?? [], exportFilename);
      } finally {
        setExporting(false);
      }
      return;
    }
    exportRowsToExcel(exportColumns || columns, filteredRows, exportFilename);
  };

  // Mobilon nincs Excel-exportra szükség (nincs hova letölteni/megnyitni
  // kényelmesen egy .xlsx fájlt egy kártyalistás nézetben) — a gomb csak
  // `md:` fölött jelenik meg, hogy a mobil fejléc ne zsúfolódjon tele.
  const exportButton = exportFilename && (
    <button
      className="hidden items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-ink-500 shadow-soft transition-all duration-300 ease-fluid hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-95 disabled:cursor-wait disabled:opacity-60 md:flex"
      type="button"
      title="Táblázat exportálása Excelbe"
      disabled={exporting}
      onClick={handleExportClick}
    >
      <PiDownloadSimpleLight className="h-4 w-4" /> {exporting ? "Exportálás..." : "Excel"}
    </button>
  );

  // A `headerAction` (egy oldal saját, teljesen egyedi fejléc-gombja, pl.
  // Fájlok feltöltés-gombja) NEM cseréli le teljesen a keresőmezőt/export
  // gombot/alapértelmezett "+ Új" gombot — egy közös sorban jelennek meg
  // egymás mellett, hogy egy `searchable` bekapcsolása egy egyedi
  // `headerAction`-t használó oldalon (pl. CardTableForFajlok.js) se
  // váljon némán eltűnővé.
  const resolvedHeaderAction =
    headerAction || onAdd || exportButton || searchInput ? (
      <div className="flex flex-wrap items-center gap-2">
        {searchInput}
        {exportButton}
        {headerAction ??
          (onAdd && (
            <button
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-all duration-300 ease-fluid hover:bg-brand-700 active:scale-95"
              type="button"
              onClick={onAdd}
            >
              <PiPlusLight className="h-4 w-4" /> {addLabel}
            </button>
          ))}
      </div>
    ) : null;

  // Lapozó sáv — csak akkor jelenik meg, ha van `pageSize` és legalább
  // egy sor a (kereséssel szűrt) listában; mind a mobil kártyalista, mind
  // az asztali táblázat ugyanazt a `pagedRows` szeletet kapja, a sáv a
  // kártya alján, közösen jelenik meg mindkét nézethez. Szerver oldali
  // módban a lapozás gombjai `onPageChange`-t hívnak (a `rows` már csak
  // az aktuális oldal), nem a helyi `page`-state-et módosítják.
  // A jobb oldali extra `pr` (80px) mobilon szándékos: a Sidebar.js két
  // lebegő gombja (értesítés/keresés FAB, `fixed bottom-20/bottom-36
  // right-4 md:hidden`) pont a jobb szélen, a lapozó gombok helyén lóg —
  // enélkül az Előző/Következő gombok mobilon eltakart, érinthetetlen
  // terültre esnének. `md:pr-6`-nál a FAB-ok már nem jelennek meg
  // (`md:hidden`), ott visszaáll a normál térköz.
  const paginationBar = pageSize && effectiveTotal > 0 && (
    <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-ink-100 py-2.5 pl-4 pr-20 text-xs text-ink-500 sm:pl-6 md:pr-6">
      <span className="tabular-nums">
        {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, effectiveTotal)} / {effectiveTotal}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => goToPage(safePage - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Előző oldal"
        >
          <PiCaretLeftLight className="h-3.5 w-3.5" />
        </button>
        <span className="w-14 text-center tabular-nums">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => goToPage(safePage + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Következő oldal"
        >
          <PiCaretRightLight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

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
      ) : effectiveTotal === 0 && emptyState ? (
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
            {pagedRows.length > 0 ? (
              <div className="space-y-3 p-3">
                {pagedRows.map((row, index) => (
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
                {pagedRows.length > 0 ? (
                  pagedRows.map((row, index) => (
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

          {paginationBar}
        </>
      )}
    </div>
  );
}
