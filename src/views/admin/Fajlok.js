import React, { useCallback, useEffect, useState } from "react";
import {
  PiGridFourLight,
  PiListLight,
  PiMagnifyingGlassLight,
  PiTagLight,
  PiDownloadSimpleLight,
  PiTrashLight,
  PiFileLight,
  PiUploadSimpleLight,
  PiCaretLeftLight,
  PiCaretRightLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import FajlDashboardStats from "components/Fajlok/FajlDashboardStats.js";
import FajlFilterChips from "components/Fajlok/FajlFilterChips.js";
import FajlGrid from "components/Fajlok/FajlGrid.js";
import FajlUploadZone from "components/Fajlok/FajlUploadZone.js";
import FajlPreviewPanel from "components/Fajlok/FajlPreviewPanel.js";
import { kategoriaInfo, MODUL_LABEL, formatFileSize, formatDate } from "components/Fajlok/fajlKategoriaInfo.js";
import { downloadZipAction } from "utils/downloadZipAction.js";
import { confirmDialog } from "utils/confirm.js";

const PAGE_SIZE = 20;
const NEZET_KULCS = "fajlok-nezet-mod";
const UJ_SZURO = { modul: "", feltoltoId: "", datumTol: "", datumIg: "" };

const hetElott = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
};

export default function Fajlok() {
  const user = JSON.parse(localStorage.getItem("user"));
  const admin = user.ceg_id;

  const [viewMode, setViewMode] = useState(() => localStorage.getItem(NEZET_KULCS) || "grid");
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statisztika, setStatisztika] = useState(null);
  const [search, setSearch] = useState("");
  const [kategoria, setKategoria] = useState("");
  const [ezAHet, setEzAHet] = useState(false);
  const [szuro, setSzuro] = useState(UJ_SZURO);
  const [sortKey, setSortKey] = useState("feltoltve");
  const [sortDir, setSortDir] = useState("desc");
  const [feltoltok, setFeltoltok] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [previewFile, setPreviewFile] = useState(null);

  const valtVezet = (mod) => {
    setViewMode(mod);
    localStorage.setItem(NEZET_KULCS, mod);
    setSelectedIds(new Set());
  };

  const betoltesStatisztika = useCallback(() => {
    fetchAction("getFajlStatisztika", {}).then((result) => {
      if (result?.success) setStatisztika(result);
    });
  }, []);

  const betoltesFajlok = useCallback(() => {
    setLoading(true);
    fetchAction("getFiles", {
      id: admin,
      tabla: "admin",
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
      kategoria: kategoria || undefined,
      modul: szuro.modul || undefined,
      feltoltoId: szuro.feltoltoId || undefined,
      datumTol: ezAHet ? hetElott() : szuro.datumTol || undefined,
      datumIg: szuro.datumIg || undefined,
      sortKey,
      sortDir,
    })
      .then((result) => {
        if (result?.success) {
          setFiles(result.files || []);
          setTotal(result.total ?? (result.files || []).length);
        } else {
          toast.error(result?.message || "Fájlok betöltése sikertelen.");
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, search, page, kategoria, szuro, ezAHet, sortKey, sortDir]);

  useEffect(() => {
    betoltesFajlok();
  }, [betoltesFajlok]);

  useEffect(() => {
    betoltesStatisztika();
    Promise.all([
      fetchAction("getCsapattagok", { id: admin }),
      fetchAction("getSoforok", { id: admin, kerelmezo_id: user.id }),
    ]).then(([csapatResult, soforResult]) => {
      const csapat = (csapatResult?.success ? csapatResult.csapattagok : []) || [];
      const soforok = (soforResult?.success ? soforResult.soforok : []) || [];
      setFeltoltok([
        ...csapat.map((c) => ({ value: `admin:${c.id}`, label: c.name })),
        ...soforok.map((s) => ({ value: `sofor:${s.id}`, label: s.name })),
      ]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const frissitesUtan = () => {
    betoltesFajlok();
    betoltesStatisztika();
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog("Biztosan törölni szeretné ezt a fájlt?"))) return;
    const result = await fetchAction("deleteFile", { id });
    if (result?.success) {
      frissitesUtan();
    } else {
      toast.error(result?.message || "Hiba történt a törlés során.");
    }
  };

  const handleRename = async (id, newName) => {
    const result = await fetchAction("renameFile", { id, name: newName });
    if (result?.success) {
      frissitesUtan();
    } else {
      toast.error(result?.message || "Az átnevezés sikertelen.");
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkTorles = async () => {
    if (selectedIds.size === 0) return;
    if (!(await confirmDialog(`Biztosan törli a kijelölt ${selectedIds.size} fájlt?`))) return;
    const results = await Promise.all([...selectedIds].map((id) => fetchAction("deleteFile", { id })));
    if (!results.every((r) => r?.success)) toast.error("Néhány fájl törlése sikertelen volt.");
    setSelectedIds(new Set());
    frissitesUtan();
  };

  const bulkCimkezes = async () => {
    if (selectedIds.size === 0) return;
    const cimkek = window.prompt(`Címkék a kijelölt ${selectedIds.size} fájlra (vesszővel elválasztva) — felülírja a korábbi címkéket:`, "");
    if (cimkek === null) return;
    const results = await Promise.all([...selectedIds].map((id) => fetchAction("updateFajlCimkek", { id, cimkek })));
    if (!results.every((r) => r?.success)) toast.error("Néhány fájl címkézése sikertelen volt.");
    frissitesUtan();
  };

  const bulkLetoltes = async () => {
    if (selectedIds.size === 0) return;
    try {
      await downloadZipAction([...selectedIds]);
    } catch (error) {
      toast.error(error.message || "A tömeges letöltés sikertelen.");
    }
  };

  const columns = [
    {
      key: "filename",
      label: "Fájlnév",
      sortable: true,
      render: (row) => {
        const info = kategoriaInfo(row.fajl_kategoria);
        const Icon = info.icon;
        return (
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${info.bg}`}>
              <Icon className={`h-5 w-5 ${info.szin}`} />
            </div>
            <div className="max-w-xs truncate text-sm font-medium text-brand-900 dark:text-ink-50">{row.filename}</div>
          </div>
        );
      },
    },
    {
      key: "fajl_kategoria",
      label: "Típus",
      sortable: true,
      className: "text-ink-500 dark:text-ink-400",
      render: (row) => kategoriaInfo(row.fajl_kategoria).label,
    },
    {
      key: "filesize",
      label: "Méret",
      sortable: true,
      className: "text-ink-500 dark:text-ink-400",
      render: (row) => formatFileSize(row.filesize),
    },
    {
      key: "feltoltve",
      label: "Feltöltve",
      sortable: true,
      className: "text-ink-500 dark:text-ink-400",
      render: (row) => formatDate(row.feltoltve),
    },
    {
      key: "feltolto_nev",
      label: "Feltöltő",
      className: "text-ink-500 dark:text-ink-400",
      render: (row) => row.feltolto_nev || (row.tabla?.endsWith("_import") ? "Rendszer" : "Ismeretlen"),
      mobileHidden: true,
    },
    {
      key: "tabla",
      label: "Modul",
      className: "text-ink-500 dark:text-ink-400",
      render: (row) => MODUL_LABEL[row.tabla] || row.tabla,
      mobileHidden: true,
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon icon={<PiFileLight />} onClick={() => setPreviewFile(row)} title="Előnézet" />
          <ActionIcon
            icon={<PiDownloadSimpleLight />}
            onClick={() => downloadZipAction([row.sorszam]).catch((e) => toast.error(e.message))}
            title="Letöltés"
          />
          <ActionIcon danger icon={<PiTrashLight />} onClick={() => handleDelete(row.sorszam)} title="Törlés" />
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full w-full flex-col gap-5 px-0 md:px-4">
      <div className="flex-shrink-0">
        <PageHeader
          eyebrow="Rendszer"
          title="Fájlok"
          action={
            <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1 dark:border-ink-700 dark:bg-ink-900">
              <button
                type="button"
                onClick={() => valtVezet("grid")}
                title="Rács nézet"
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 ${
                  viewMode === "grid" ? "bg-brand-600 text-white" : "text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800"
                }`}
              >
                <PiGridFourLight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => valtVezet("table")}
                title="Táblázat nézet"
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 ${
                  viewMode === "table" ? "bg-brand-600 text-white" : "text-ink-500 hover:bg-slate-100 dark:text-ink-400 dark:hover:bg-ink-800"
                }`}
              >
                <PiListLight className="h-4 w-4" />
              </button>
            </div>
          }
        />
      </div>

      <div className="flex-shrink-0">
        <FajlDashboardStats statisztika={statisztika} />
      </div>

      {total > 0 && (
        <div className="flex-shrink-0">
          <FajlUploadZone admin={admin} id={admin} tabla="admin" onUploadSuccess={frissitesUtan} compact />
        </div>
      )}

      <div className="flex-shrink-0 space-y-4">
        <div className="relative">
          <PiMagnifyingGlassLight className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300 dark:text-ink-600" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Keresés fájlnév, címke, feltöltő szerint..."
            className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-10 pr-4 text-sm text-brand-900 placeholder-ink-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
          />
        </div>

        <FajlFilterChips
          kategoriaSzerint={statisztika?.kategoriaSzerint || []}
          aktivKategoria={kategoria}
          onKategoriaChange={(k) => {
            setKategoria(k);
            setPage(1);
          }}
          ezAHetAktiv={ezAHet}
          onEzAHetToggle={(v) => {
            setEzAHet(v);
            setPage(1);
          }}
          szuro={szuro}
          onSzuroChange={(s) => {
            setSzuro(s);
            setPage(1);
          }}
          feltoltok={feltoltok}
        />
      </div>

      {selectedIds.size > 0 && viewMode === "grid" && (
        <div className="flex flex-shrink-0 items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 dark:border-brand-800 dark:bg-brand-950/40">
          <span className="text-sm font-medium text-brand-800 dark:text-brand-200">{selectedIds.size} kijelölve</span>
          <button type="button" onClick={bulkCimkezes} className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            <PiTagLight className="h-4 w-4" /> Címkézés
          </button>
          <button type="button" onClick={bulkLetoltes} className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            <PiDownloadSimpleLight className="h-4 w-4" /> Letöltés (ZIP)
          </button>
          <button type="button" onClick={bulkTorles} className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline dark:text-red-400">
            <PiTrashLight className="h-4 w-4" /> Törlés
          </button>
          <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-ink-400 hover:underline dark:text-ink-500">
            Kijelölés megszüntetése
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {viewMode === "grid" ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FajlGrid
                files={files}
                loading={loading}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onOpenPreview={setPreviewFile}
                onDelete={handleDelete}
                onRename={handleRename}
                emptyState={
                  <div className="rounded-2xl border border-ink-100 bg-white p-10 dark:border-ink-800 dark:bg-ink-900">
                    <div className="mx-auto max-w-md text-center">
                      <PiUploadSimpleLight className="mx-auto mb-3 h-10 w-10 text-ink-300 dark:text-ink-700" />
                      <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
                        {search || kategoria || ezAHet ? "Nincs a szűrésnek megfelelő fájl." : "Még nincs feltöltött fájl."}
                      </p>
                    </div>
                    {!search && !kategoria && !ezAHet && (
                      <div className="mx-auto mt-4 max-w-md">
                        <FajlUploadZone admin={admin} id={admin} tabla="admin" onUploadSuccess={frissitesUtan} />
                      </div>
                    )}
                  </div>
                }
              />
            </div>
            {/* UX-hiba: a grid-nézet korábban egyáltalán nem kapott lapozó
                sávot (a DataTable-alapú táblázat-nézet igen) — a `page`
                state létezett, csak semmi nem tudta módosítani grid módban,
                így 20 fájl felett a többi elérhetetlen maradt. Ugyanaz a
                sáv-elrendezés/stílus, mint a DataTable.js belső lapozójáé. */}
            {!loading && total > 0 && (
              <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-ink-100 py-2.5 pl-4 pr-20 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400 sm:pl-6 md:pr-6">
                <span className="tabular-nums">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800"
                    aria-label="Előző oldal"
                  >
                    <PiCaretLeftLight className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-14 text-center tabular-nums">
                    {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                  </span>
                  <button
                    type="button"
                    disabled={page >= Math.max(1, Math.ceil(total / PAGE_SIZE))}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-ink-200 text-ink-500 transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800"
                    aria-label="Következő oldal"
                  >
                    <PiCaretRightLight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <DataTable
            icon={PiFileLight}
            title="Fájlok kezelése"
            columns={columns}
            rows={files}
            rowKey={(row, index) => row.sorszam ?? index}
            loading={loading}
            fill
            serverSide
            totalRows={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={(key, dir) => {
              setSortKey(key);
              setSortDir(dir);
            }}
            selectable
            bulkActions={[
              {
                label: "Címkézés",
                icon: <PiTagLight className="h-3.5 w-3.5" />,
                onClick: async (rows) => {
                  const cimkek = window.prompt(`Címkék a kijelölt ${rows.length} fájlra (vesszővel elválasztva) — felülírja a korábbi címkéket:`, "");
                  if (cimkek === null) return;
                  const results = await Promise.all(rows.map((r) => fetchAction("updateFajlCimkek", { id: r.sorszam, cimkek })));
                  if (!results.every((r) => r?.success)) toast.error("Néhány fájl címkézése sikertelen volt.");
                  frissitesUtan();
                },
              },
              {
                label: "Letöltés (ZIP)",
                icon: <PiDownloadSimpleLight className="h-3.5 w-3.5" />,
                onClick: (rows) => downloadZipAction(rows.map((r) => r.sorszam)).catch((e) => toast.error(e.message)),
              },
              {
                label: "Törlés",
                tone: "danger",
                icon: <PiTrashLight className="h-3.5 w-3.5" />,
                onClick: async (rows) => {
                  if (!(await confirmDialog(`Biztosan törli a kijelölt ${rows.length} fájlt?`))) return;
                  const results = await Promise.all(rows.map((r) => fetchAction("deleteFile", { id: r.sorszam })));
                  if (!results.every((r) => r?.success)) toast.error("Néhány fájl törlése sikertelen volt.");
                  frissitesUtan();
                },
              },
            ]}
            emptyState={
              <div className="p-10 text-center text-ink-400 dark:text-ink-500">
                <PiFileLight className="mx-auto h-10 w-10 text-ink-300 dark:text-ink-700" />
                <p className="mt-2 text-sm">Nincsenek feltöltött fájlok</p>
              </div>
            }
          />
        )}
      </div>

      <FajlPreviewPanel file={previewFile} onClose={() => setPreviewFile(null)} onValasztFajlt={setPreviewFile} />
    </div>
  );
}
