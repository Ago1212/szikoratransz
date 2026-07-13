import React, { useState, useEffect, useCallback } from "react";
import { useMediaQuery } from "react-responsive";
import {
  PiFunnelLight,
  PiFunnelFill,
  PiPencilSimpleLight,
  PiTrashLight,
  PiXLight,
  PiCaretUpLight,
  PiCaretDownLight,
  PiUploadSimpleLight,
  PiFileLight,
  PiWrenchLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { downloadFileAction } from "utils/downloadFileAction";
import { toast } from "utils/toast";

import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Modal from "components/UI/Modal.js";
import FormField, { FormSection } from "components/UI/FormField.js";

const emptyKarbantartas = (adminId) => ({
  admin: adminId,
  kamion_id: "",
  potkocsi_id: "",
  datum: "",
  log: "",
  km_oraallas: "",
  elvegezte: "",
  kovetkezo_karbantartas: "",
  koltseg: "",
});

const formatHuf = (value) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(value || 0);

const PAGE_SIZE = 15;

const Karbantartasok = () => {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  // Mobilon alapból zárva (helyet spórolunk), asztali nézeten viszont
  // változatlanul mindig nyitva indul, ahogy eddig is.
  const [filtersOpen, setFiltersOpen] = useState(!isMobile);
  const [karbantartasok, setKarbantartasok] = useState([]);
  const [kamionok, setKamionok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [filter, setFilter] = useState({
    kamion_id: "",
    potkocsi_id: "",
    datumTol: "",
    datumIg: "",
    elvegezte: "",
  });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [osszesKoltseg, setOsszesKoltseg] = useState(0);
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newKarbantartas, setNewKarbantartas] = useState(emptyKarbantartas(user.ceg_id));
  const [jarmuTipus, setJarmuTipus] = useState("kamion");
  const [files, setFiles] = useState({});
  const [isFileUploading, setIsFileUploading] = useState(false);

  const fetchFilesForKarbantartas = async (karbantartasId) => {
    try {
      const result = await fetchAction("getFiles", {
        id: karbantartasId,
        tabla: "karbantartasok",
      });
      if (result?.success) {
        setFiles((prev) => ({ ...prev, [karbantartasId]: result.files || [] }));
      }
    } catch (error) {
      console.error("Hiba történt a fájlok betöltésekor:", error);
    }
  };

  const handleFileUpload = async (event, karbantartasId) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length === 0) return;

    const oversizedFiles = selectedFiles.filter((file) => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error("Néhány fájl mérete túl nagy! Maximális megengedett méret: 10MB");
      return;
    }

    setIsFileUploading(true);

    try {
      const uploadPromises = selectedFiles.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64File = reader.result.split(",")[1];
              const result = await fetchAction("fileUpload", {
                admin: user.ceg_id,
                id: karbantartasId,
                tabla: "karbantartasok",
                file: base64File,
                name: file.name,
                size: file.size,
              });
              resolve(result?.success);
            };
            reader.readAsDataURL(file);
          })
      );

      const results = await Promise.all(uploadPromises);
      if (results.every(Boolean)) {
        await fetchFilesForKarbantartas(karbantartasId);
      } else {
        toast.error("Néhány fájl feltöltése sikertelen volt.");
      }
    } catch (error) {
      console.error("Fájl feltöltési hiba:", error);
      toast.error("Hiba történt a fájlok feltöltése során.");
    } finally {
      setIsFileUploading(false);
    }
  };

  const handleFileDelete = async (fileId, karbantartasId) => {
    if (!window.confirm("Biztosan törölni szeretné ezt a fájlt?")) return;

    try {
      const result = await fetchAction("deleteFile", { id: fileId });
      if (result?.success) {
        await fetchFilesForKarbantartas(karbantartasId);
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      toast.error("Hiba történt a törlés során.");
    }
  };

  useEffect(() => {
    const fetchJarmuvek = async () => {
      const kamionResult = await fetchAction("getKamionRendszamok", { id: user.ceg_id });
      if (kamionResult?.success) {
        setKamionok(kamionResult.kamionok);
      }

      const potkocsiResult = await fetchAction("getPotkocsiRendszamok", { id: user.ceg_id });
      if (potkocsiResult?.success) {
        setPotkocsik(potkocsiResult.potkocsik);
      }
    };

    fetchJarmuvek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.ceg_id]);

  useEffect(() => {
    const fetchKarbantartasok = async () => {
      const result = await fetchAction("getKarbantartasok", {
        id: user.ceg_id,
        ...filter,
        kerelmezo_id: user.id,
        search: search || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (result?.success) {
        setKarbantartasok(result.karbantartasok);
        setTotal(result.total ?? result.karbantartasok.length);
        setOsszesKoltseg(result.osszesKoltseg ?? 0);
        result.karbantartasok.forEach((karb) => {
          fetchFilesForKarbantartas(karb.id);
        });
      } else {
        setTotal(0);
        setOsszesKoltseg(0);
      }
    };
    fetchKarbantartasok();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user.ceg_id, page, search]);

  const handleExportAll = useCallback(async () => {
    const result = await fetchAction("getKarbantartasok", {
      id: user.ceg_id,
      ...filter,
      kerelmezo_id: user.id,
      search: search || undefined,
    });
    return result?.success ? result.karbantartasok || [] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user.ceg_id, search]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleNewKarbantartasChange = (e) => {
    const { name, value } = e.target;
    setNewKarbantartas((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setNewKarbantartas(emptyKarbantartas(user.ceg_id));
    setEditingId(null);
    setJarmuTipus("kamion");
  };

  const closeDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  const handleEditKarbantartas = (karb) => {
    setEditingId(karb.id);
    setJarmuTipus(karb.potkocsi_id ? "potkocsi" : "kamion");
    setNewKarbantartas({
      admin: user.ceg_id,
      kamion_id: karb.kamion_id || "",
      potkocsi_id: karb.potkocsi_id || "",
      datum: karb.datum,
      log: karb.log,
      km_oraallas: karb.km_oraallas || "",
      elvegezte: karb.elvegezte || "",
      kovetkezo_karbantartas: karb.kovetkezo_karbantartas || "",
      koltseg: karb.koltseg || "",
    });
    setOpenDialog(true);
  };

  const refreshList = async () => {
    const updatedResult = await fetchAction("getKarbantartasok", {
      id: user.ceg_id,
      ...filter,
      kerelmezo_id: user.id,
      search: search || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
    if (updatedResult?.success) {
      setKarbantartasok(updatedResult.karbantartasok);
      setTotal(updatedResult.total ?? updatedResult.karbantartasok.length);
      setOsszesKoltseg(updatedResult.osszesKoltseg ?? 0);
    }
  };

  const handleAddKarbantartas = async (e) => {
    e.preventDefault();
    const action =
      jarmuTipus === "kamion" ? "updateKarbantartas" : "updatePotkocsiKarbantartas";

    const result = await fetchAction(action, {
      ...newKarbantartas,
      id: editingId || undefined,
      kerelmezo_id: user.id,
    });

    if (result?.success) {
      closeDialog();
      await refreshList();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Biztosan törölni szeretnéd a karbantartást?")) return;

    const result = await fetchAction("deleteKarbantartas", { id, kerelmezo_id: user.id });
    if (result?.success) {
      await refreshList();
    }
  };

  const getJarmuRendszam = (id, isPotkocsi = false) => {
    const jarmuLista = isPotkocsi ? potkocsik : kamionok;
    const jarmu = jarmuLista.find((j) => j.id === id);
    if (!jarmu) return "Ismeretlen";
    return jarmu.tipus ? `${jarmu.rendszam} (${jarmu.tipus})` : jarmu.rendszam;
  };

  const getStatus = (karb) => {
    const today = new Date().toISOString().split("T")[0];
    if (karb.datum < today)
      return { text: "Kész", className: "bg-emerald-50 text-emerald-700" };
    return { text: "Tervezett", className: "bg-amber-50 text-amber-700" };
  };

  const renderFileUpload = (karbantartasId) => (
    <div className="rounded-xl border border-ink-100 bg-slate-50 p-3">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 shadow-soft transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700">
        <PiUploadSimpleLight className="h-4 w-4" />
        Fájlok feltöltése
        <input
          type="file"
          className="hidden"
          onChange={(e) => handleFileUpload(e, karbantartasId)}
          disabled={isFileUploading}
          multiple
        />
      </label>
      <div className="mt-2 space-y-1.5">
        {files[karbantartasId]?.map((file) => (
          <div
            key={file.sorszam}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
          >
            <button
              type="button"
              onClick={() => downloadFileAction(file.sorszam, file.filename)}
              className="flex items-center gap-2 text-sm text-brand-700 hover:underline"
            >
              <PiFileLight className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{file.filename}</span>
            </button>
            <button
              type="button"
              onClick={() => handleFileDelete(file.sorszam, karbantartasId)}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors duration-200 hover:bg-red-50 hover:text-red-600"
            >
              <PiTrashLight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const columns = [
    {
      key: "tipus",
      label: "Jármű típusa",
      render: (row) => (row.potkocsi_id ? "Pótkocsi" : "Kamion"),
    },
    {
      key: "rendszam",
      label: "Rendszám",
      className: "font-semibold text-brand-900",
      render: (row) =>
        row.potkocsi_id
          ? getJarmuRendszam(row.potkocsi_id, true)
          : getJarmuRendszam(row.kamion_id),
    },
    { key: "datum", label: "Dátum" },
    { key: "log", label: "Leírás", className: "whitespace-normal break-words max-w-xs" },
    { key: "km_oraallas", label: "Km óraállás" },
    { key: "elvegezte", label: "Elvégezte" },
    {
      key: "koltseg",
      label: "Költség",
      render: (row) => (row.koltseg ? formatHuf(row.koltseg) : "—"),
    },
    {
      key: "status",
      label: "Státusz",
      render: (row) => {
        const status = getStatus(row);
        return (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
          >
            {status.text}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <ActionIcon
            icon={<PiPencilSimpleLight />}
            onClick={() => handleEditKarbantartas(row)}
            title="Szerkesztés"
          />
          <ActionIcon
            icon={<PiTrashLight />}
            danger
            onClick={() => handleDelete(row.id)}
            title="Törlés"
          />
        </div>
      ),
    },
  ];

  // Az exportot külön kell megadni, mert a fenti `columns` több oszlopa
  // (tipus/rendszam/status) számított érték, aminek nincs egyező nevű
  // nyers mezője a soron — a régi export logika (`row[col.key]`) ezeket
  // némán ÜRESEN exportálta. Az `exportValue` ugyanazt a szöveget adja
  // vissza, amit a táblázat is mutat; emellett bekerül a "Következő
  // karbantartás" dátuma is, ami a kompakt nézetben nem látszik.
  const exportColumns = [
    {
      key: "tipus",
      label: "Jármű típusa",
      exportValue: (row) => (row.potkocsi_id ? "Pótkocsi" : "Kamion"),
    },
    {
      key: "rendszam",
      label: "Rendszám",
      exportValue: (row) =>
        row.potkocsi_id
          ? getJarmuRendszam(row.potkocsi_id, true)
          : getJarmuRendszam(row.kamion_id),
    },
    { key: "datum", label: "Dátum" },
    { key: "log", label: "Leírás" },
    { key: "km_oraallas", label: "Km óraállás" },
    { key: "elvegezte", label: "Elvégezte" },
    {
      key: "koltseg",
      label: "Költség",
      exportValue: (row) => (row.koltseg ? formatHuf(row.koltseg) : ""),
    },
    { key: "kovetkezo_karbantartas", label: "Következő karbantartás dátuma" },
    {
      key: "status",
      label: "Státusz",
      exportValue: (row) => getStatus(row).text,
    },
  ];

  const activeFilterCount = Object.values(filter).filter(Boolean).length;

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col">
      <div className="flex-shrink-0">
        <PageHeader
          title="Karbantartások kezelése"
          action={
            <button
              type="button"
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-colors duration-200 md:hidden ${
                filtersOpen
                  ? "border-brand-200 bg-brand-50 text-brand-600"
                  : "border-ink-200 bg-white text-ink-500"
              }`}
              title="Szűrők"
            >
              {filtersOpen ? (
                <PiFunnelFill className="h-4 w-4" />
              ) : (
                <PiFunnelLight className="h-4 w-4" />
              )}
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          }
        />
      </div>

      {osszesKoltseg > 0 && (
        <div className="mb-4 flex flex-shrink-0 items-center gap-2 rounded-2xl border border-ink-100 bg-white px-4 py-3 text-sm">
          <span className="font-semibold uppercase tracking-wide text-ink-400">
            Szűrt összes költség
          </span>
          <span className="font-display text-base font-bold text-brand-900">
            {formatHuf(osszesKoltseg)}
          </span>
        </div>
      )}

      <div
        className={`mb-6 flex-shrink-0 rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink-100 ${
          filtersOpen ? "" : "hidden md:block"
        }`}
      >
        <button
          type="button"
          className="hidden w-full items-center gap-2 text-ink-600 md:flex"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <PiFunnelLight className="h-4 w-4 text-brand-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Szűrők</h2>
          <span className="ml-auto text-ink-400">
            {filtersOpen ? <PiCaretUpLight /> : <PiCaretDownLight />}
          </span>
        </button>

        {filtersOpen && (
          <div className="mt-5">
            <FormSection columns={5}>
              <FormField
                as="select"
                label="Kamion"
                name="kamion_id"
                value={filter.kamion_id}
                onChange={handleFilterChange}
              >
                <option value="">Összes kamion</option>
                {kamionok.map((kamion) => (
                  <option key={kamion.id} value={kamion.id}>
                    {kamion.tipus ? `${kamion.rendszam} (${kamion.tipus})` : kamion.rendszam}
                  </option>
                ))}
              </FormField>
              <FormField
                as="select"
                label="Pótkocsi"
                name="potkocsi_id"
                value={filter.potkocsi_id}
                onChange={handleFilterChange}
              >
                <option value="">Összes pótkocsi</option>
                {potkocsik.map((potkocsi) => (
                  <option key={potkocsi.id} value={potkocsi.id}>
                    {potkocsi.tipus ? `${potkocsi.rendszam} (${potkocsi.tipus})` : potkocsi.rendszam}
                  </option>
                ))}
              </FormField>
              <FormField
                label="Elvégezte"
                name="elvegezte"
                value={filter.elvegezte}
                onChange={handleFilterChange}
                placeholder="Keresés elvégzőre"
              />
              <FormField
                type="date"
                label="Dátumtól"
                name="datumTol"
                value={filter.datumTol}
                onChange={handleFilterChange}
              />
              <FormField
                type="date"
                label="Dátumig"
                name="datumIg"
                value={filter.datumIg}
                onChange={handleFilterChange}
              />
            </FormSection>
            <button
              type="button"
              onClick={() => {
                setFilter({
                  kamion_id: "",
                  potkocsi_id: "",
                  datumTol: "",
                  datumIg: "",
                  elvegezte: "",
                });
                setPage(1);
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-800"
            >
              <PiXLight className="h-4 w-4" /> Összes szűrő törlése
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <DataTable
          icon={PiWrenchLight}
          title="Karbantartások"
          onAdd={() => {
            resetForm();
            setOpenDialog(true);
          }}
          addLabel="Új karbantartás"
          exportFilename="karbantartasok"
          exportColumns={exportColumns}
          columns={columns}
          rows={karbantartasok}
          mobileTitleKey="rendszam"
          onRowDoubleClick={handleEditKarbantartas}
          emptyLabel="Nincsenek megjeleníthető karbantartások"
          fill
          searchable
          searchPlaceholder="Keresés leírás, elvégezte, rendszám szerint..."
          serverSide
          totalRows={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          onSearchChange={setSearch}
          onExportAll={handleExportAll}
        />
      </div>

      <Modal
        open={openDialog}
        onClose={closeDialog}
        title={editingId ? "Karbantartás szerkesztése" : "Új karbantartás"}
      >
        <form onSubmit={handleAddKarbantartas} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-600">
              Jármű típusa
            </label>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-ink-600">
                <input
                  type="radio"
                  name="jarmu_tipus"
                  value="kamion"
                  checked={jarmuTipus === "kamion"}
                  onChange={() => {
                    setJarmuTipus("kamion");
                    setNewKarbantartas((prev) => ({
                      ...prev,
                      kamion_id: "",
                      potkocsi_id: null,
                    }));
                  }}
                  className="h-4 w-4 text-brand-600"
                />
                Kamion
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-ink-600">
                <input
                  type="radio"
                  name="jarmu_tipus"
                  value="potkocsi"
                  checked={jarmuTipus === "potkocsi"}
                  onChange={() => {
                    setJarmuTipus("potkocsi");
                    setNewKarbantartas((prev) => ({
                      ...prev,
                      kamion_id: null,
                      potkocsi_id: "",
                    }));
                  }}
                  className="h-4 w-4 text-brand-600"
                />
                Pótkocsi
              </label>
            </div>
          </div>

          {jarmuTipus === "kamion" ? (
            <FormField
              as="select"
              label="Kamion"
              name="kamion_id"
              value={newKarbantartas.kamion_id || ""}
              onChange={handleNewKarbantartasChange}
              required
            >
              <option value="">Válassz kamiont</option>
              {kamionok.map((kamion) => (
                <option key={kamion.id} value={kamion.id}>
                  {kamion.tipus ? `${kamion.rendszam} (${kamion.tipus})` : kamion.rendszam}
                </option>
              ))}
            </FormField>
          ) : (
            <FormField
              as="select"
              label="Pótkocsi"
              name="potkocsi_id"
              value={newKarbantartas.potkocsi_id || ""}
              onChange={handleNewKarbantartasChange}
              required
            >
              <option value="">Válassz pótkocsit</option>
              {potkocsik.map((potkocsi) => (
                <option key={potkocsi.id} value={potkocsi.id}>
                  {potkocsi.tipus ? `${potkocsi.rendszam} (${potkocsi.tipus})` : potkocsi.rendszam}
                </option>
              ))}
            </FormField>
          )}

          <FormField
            type="date"
            label="Dátum"
            name="datum"
            value={newKarbantartas.datum}
            onChange={handleNewKarbantartasChange}
            required
          />
          <FormField
            type="number"
            label="Km óraállás"
            name="km_oraallas"
            value={newKarbantartas.km_oraallas}
            onChange={handleNewKarbantartasChange}
          />
          <FormField
            as="textarea"
            label="Leírás"
            name="log"
            value={newKarbantartas.log}
            onChange={handleNewKarbantartasChange}
            rows="4"
            required
          />
          <FormField
            label="Elvégezte"
            name="elvegezte"
            value={newKarbantartas.elvegezte}
            onChange={handleNewKarbantartasChange}
          />
          <FormField
            type="number"
            label="Költség (Ft)"
            name="koltseg"
            value={newKarbantartas.koltseg}
            onChange={handleNewKarbantartasChange}
            placeholder="pl. 45000"
          />
          <FormField
            type="date"
            label="Következő karbantartás dátuma"
            name="kovetkezo_karbantartas"
            value={newKarbantartas.kovetkezo_karbantartas}
            onChange={handleNewKarbantartasChange}
          />

          {editingId && renderFileUpload(editingId)}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeDialog}
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800"
            >
              Mégse
            </button>
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700"
            >
              {editingId ? "Mentés" : "Hozzáadás"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Karbantartasok;
