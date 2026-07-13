import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js";
import { useMediaQuery } from "react-responsive";
import {
  PiCoinsLight,
  PiWrenchLight,
  PiGasPumpLight,
  PiTrashLight,
  PiReceiptLight,
  PiShieldCheckLight,
  PiTrendUpLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiCaretLeftLight,
  PiCaretRightLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Modal from "components/UI/Modal.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import Spinner from "components/UI/Spinner.js";

const formatHuf = (value) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatHonap = (honap) => {
  const [ev, ho] = (honap || "").split("-");
  const HONAP_ROVID = [
    "jan",
    "febr",
    "márc",
    "ápr",
    "máj",
    "jún",
    "júl",
    "aug",
    "szept",
    "okt",
    "nov",
    "dec",
  ];
  const idx = parseInt(ho, 10) - 1;
  return ev && HONAP_ROVID[idx] ? `${HONAP_ROVID[idx]} '${ev.slice(2)}` : honap;
};

const emptyEgyebTetel = (irany = "kiado") => ({
  irany,
  datum: new Date().toISOString().slice(0, 10),
  megnevezes: "",
  szamlaszam: "",
  osszeg: "",
  kamion_id: "",
  potkocsi_id: "",
  megjegyzes: "",
});

// Kompakt kategória-chip — a korábbi, nagy stat-kártyás Karbantartás/
// Üzemanyag/Biztosítás/Egyéb helyett: ezek a grafikon jelmagyarázatának
// kiterjesztései, nem önálló KPI-k, ezért kisebb, egy sorba rendezhető
// jelvényként jelennek meg, nem a Bevétel/Kiadás/Nettó hármassal azonos
// súlyú kártyaként (ld. UX-audit "vizuális prioritások" pontja).
function CategoryChip({ icon: Icon, label, value, dotClass }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-ink-100 bg-white px-3.5 py-2.5 shadow-soft">
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
      <Icon className="h-4 w-4 flex-shrink-0 text-ink-400" />
      <span className="text-xs font-semibold text-ink-500">{label}</span>
      <span className="ml-auto whitespace-nowrap text-sm font-bold tabular-nums text-brand-900">
        {formatHuf(value)}
      </span>
    </div>
  );
}

// Havi bontású cashflow-diagram — natívan chart.js-szel (2.9.4, a
// `stack` dataset-kulcs 2.7-től támogatott). A bevétel saját ("bevetel")
// oszlopcsoportba kerül, a kiadás-kategóriák közös ("kiado") stack-be —
// így egy hónapon belül két, egymás melletti oszlop látszik. Mobilon
// (`simplified`) csak a két összesítő oszlop (Bevétel/Kiadás összesen)
// jelenik meg, a 4 kiadás-alkategória bontása nélkül — egy kis mobil
// képernyőn az 5 datasetes jelmagyarázat inkább zajt, mint áttekinthető
// információt adna.
function CashflowChart({ havi, simplified }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    const datasets = simplified
      ? [
          {
            label: "Bevétel",
            backgroundColor: "#10B981",
            data: havi.map((h) => h.bevetel),
            stack: "bevetel",
          },
          {
            label: "Kiadás",
            backgroundColor: "#dc2626",
            data: havi.map((h) => h.kiadasOsszesen),
            stack: "kiado",
          },
        ]
      : [
          {
            label: "Bevétel",
            backgroundColor: "#10B981",
            data: havi.map((h) => h.bevetel),
            stack: "bevetel",
          },
          {
            label: "Karbantartás",
            backgroundColor: "#2451B5",
            data: havi.map((h) => h.karbantartas),
            stack: "kiado",
          },
          {
            label: "Üzemanyag",
            backgroundColor: "#8FA8E0",
            data: havi.map((h) => h.uzemanyag),
            stack: "kiado",
          },
          {
            label: "Biztosítás",
            backgroundColor: "#B57EDC",
            data: havi.map((h) => h.biztositas),
            stack: "kiado",
          },
          {
            label: "Egyéb",
            backgroundColor: "#D9A441",
            data: havi.map((h) => h.egyeb),
            stack: "kiado",
          },
        ];
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: { labels: havi.map((h) => formatHonap(h.honap)), datasets },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        legend: { position: "bottom", labels: { fontColor: "#68708a" } },
        tooltips: {
          callbacks: {
            label: (item, data) =>
              `${data.datasets[item.datasetIndex].label}: ${formatHuf(item.yLabel)}`,
          },
        },
        scales: {
          xAxes: [
            {
              stacked: true,
              gridLines: { display: false },
              ticks: { fontColor: "#68708a" },
            },
          ],
          yAxes: [
            {
              stacked: true,
              ticks: {
                fontColor: "#68708a",
                callback: (value) =>
                  new Intl.NumberFormat("hu-HU").format(value),
              },
            },
          ],
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [havi, simplified]);

  return (
    <div className="h-64 md:h-72">
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function Koltsegek() {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const [loading, setLoading] = useState(true);
  // Alapból a folyó év (Jan 1 – Dec 31) — enélkül a lekérdezés "mindenkori"
  // lenne, ami egy régebb óta futó cégnél sok hónapos grafikont/sok sort
  // eredményezne az első pillantásra. A "Havi alakulás" fejlécében lévő
  // év-váltó (◄ / ►) pontosan ezt a két mezőt írja át egy másik év teljes
  // tartományára — a Dátumtól/Dátumig mezők ettől függetlenül bármikor
  // felülírhatók egy pontos, nem egész évre szóló szűréshez is.
  const [filter, setFilter] = useState(() => {
    const ev = new Date().getFullYear();
    return { datumTol: `${ev}-01-01`, datumIg: `${ev}-12-31` };
  });
  const displayedYear = filter.datumTol
    ? new Date(filter.datumTol).getFullYear()
    : new Date().getFullYear();
  const changeYear = (delta) => {
    const ev = displayedYear + delta;
    setFilter({ datumTol: `${ev}-01-01`, datumIg: `${ev}-12-31` });
  };
  const [adat, setAdat] = useState({
    havi: [],
    jarmuvenkent: [],
    egyebNemKotott: { bevetel: 0, kiado: 0 },
    vanDevizasFuvar: false,
    osszesen: {
      bevetel: 0,
      karbantartas: 0,
      uzemanyag: 0,
      biztositas: 0,
      egyeb: 0,
      kiadas: 0,
      netto: 0,
    },
  });

  const [kamionok, setKamionok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [egyebTetelek, setEgyebTetelek] = useState([]);
  const [adding, setAdding] = useState(false);
  const [ujTetel, setUjTetel] = useState(emptyEgyebTetel());
  const [isSaving, setIsSaving] = useState(false);

  const loadOsszesito = () => {
    setLoading(true);
    fetchAction("getKoltsegOsszesito", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      ...filter,
    }).then((result) => {
      if (result?.success) {
        setAdat({
          havi: result.havi || [],
          jarmuvenkent: result.jarmuvenkent || [],
          egyebNemKotott: result.egyebNemKotott || { bevetel: 0, kiado: 0 },
          vanDevizasFuvar: !!result.vanDevizasFuvar,
          osszesen: result.osszesen,
        });
      }
      setLoading(false);
    });
  };

  const loadEgyebTetelek = () => {
    fetchAction("getEgyebKoltsegek", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      ...filter,
    }).then((result) => {
      if (result?.success) setEgyebTetelek(result.tetelek || []);
    });
  };

  useEffect(() => {
    loadOsszesito();
    loadEgyebTetelek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    fetchAction("getKamionRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setKamionok(result.kamionok || []);
    });
    fetchAction("getPotkocsiRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setPotkocsik(result.potkocsik || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };

  const handleUjTetelChange = (e) => {
    const { name, value } = e.target;
    setUjTetel((prev) => ({
      ...prev,
      [name]: value,
      // A jármű-választó egyszerre csak egy típusra vonatkozhat.
      ...(name === "kamion_id" && value ? { potkocsi_id: "" } : {}),
      ...(name === "potkocsi_id" && value ? { kamion_id: "" } : {}),
    }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!ujTetel.datum || !ujTetel.megnevezes.trim() || !ujTetel.osszeg) {
      toast.error("Add meg a dátumot, a megnevezést és az összeget!");
      return;
    }
    setIsSaving(true);
    try {
      const result = await fetchAction("newEgyebKoltseg", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        irany: ujTetel.irany,
        datum: ujTetel.datum,
        megnevezes: ujTetel.megnevezes.trim(),
        szamlaszam: ujTetel.szamlaszam.trim() || null,
        osszeg: ujTetel.osszeg,
        kamion_id: ujTetel.kamion_id || null,
        potkocsi_id: ujTetel.potkocsi_id || null,
        megjegyzes: ujTetel.megjegyzes.trim() || null,
      });
      if (result?.success) {
        toast.success(result.message || "Tétel rögzítve.");
        setUjTetel(emptyEgyebTetel());
        setAdding(false);
        loadOsszesito();
        loadEgyebTetelek();
      } else {
        toast.error(result?.message || "Mentés sikertelen.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openAdding = (irany) => {
    setUjTetel(emptyEgyebTetel(irany));
    setAdding(true);
  };

  const handleDeleteTetel = async (id) => {
    if (!window.confirm("Biztosan törlöd ezt a tételt?")) return;
    const result = await fetchAction("deleteEgyebKoltseg", {
      id,
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
    });
    if (result?.success) {
      toast.success("Törölve.");
      loadOsszesito();
      loadEgyebTetelek();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  // Jármű szerinti bontás — a képernyőn csak a döntésre releváns 4 oszlop
  // (Rendszám, Bevétel, Kiadás összesen, Nettó); a 4 kiadás-alkategória
  // (Karbantartás/Üzemanyag/Biztosítás/Egyéb) már megvan a fenti kategória-
  // chipeken és a grafikonon — a teljes bontás Excel-exportban marad meg
  // (`exportColumns`, változatlanul). A "Típus" oszlop helyett egy ikon
  // jelzi kamion/pótkocsi mivoltát a rendszám mellett, külön oszlop nélkül.
  const columns = [
    {
      key: "rendszam",
      label: "Rendszám",
      className: "font-semibold text-brand-900",
      render: (row) => (
        <span className="flex items-center gap-2">
          {row.tipus === "kamion" ? (
            <PiTruckLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          ) : (
            <PiTruckTrailerLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
          )}
          {row.rendszam}
        </span>
      ),
    },
    {
      key: "bevetel",
      label: "Bevétel",
      align: "right",
      className: "tabular-nums",
      render: (row) => formatHuf(row.bevetel),
    },
    {
      key: "kiadasOsszesen",
      label: "Kiadás összesen",
      align: "right",
      className: "tabular-nums",
      render: (row) => formatHuf(row.kiadasOsszesen),
    },
    {
      key: "netto",
      label: "Nettó",
      align: "right",
      className: "font-semibold tabular-nums",
      render: (row) => (
        <span className={row.netto >= 0 ? "text-emerald-600" : "text-red-600"}>
          {formatHuf(row.netto)}
        </span>
      ),
    },
  ];

  const exportColumns = [
    { key: "rendszam", label: "Rendszám" },
    {
      key: "tipus",
      label: "Típus",
      exportValue: (row) => (row.tipus === "kamion" ? "Kamion" : "Pótkocsi"),
    },
    { key: "bevetel", label: "Bevétel (Ft)" },
    { key: "karbantartas", label: "Karbantartás (Ft)" },
    { key: "uzemanyag", label: "Üzemanyag (Ft)" },
    { key: "biztositas", label: "Biztosítás (Ft)" },
    { key: "egyeb", label: "Egyéb (Ft)" },
    { key: "kiadasOsszesen", label: "Kiadás összesen (Ft)" },
    { key: "netto", label: "Nettó (Ft)" },
  ];

  // A bevétel- és kiadás-táblázat ugyanazt a mezőkészletet mutatja, csak
  // a felhasználó felé nincs "Irány" oszlop — az már abból látszik,
  // melyik táblázatban van a sor. Az Összeg feljebb került (3. oszlop),
  // mert ez a leggyakrabban keresett érték — a Számlaszám/Megjegyzés
  // (gyakran üres, másodlagos mező) mobilon rejtve marad.
  const egyebTetelColumns = [
    { key: "datum", label: "Dátum" },
    {
      key: "megnevezes",
      label: "Megnevezés",
      className: "font-semibold text-brand-900",
    },
    {
      key: "osszeg",
      label: "Összeg",
      align: "right",
      className: "tabular-nums font-semibold",
      render: (row) => formatHuf(row.osszeg),
    },
    { key: "rendszam", label: "Jármű", render: (row) => row.rendszam || "—" },
    {
      key: "szamlaszam",
      label: "Számlaszám",
      mobileHidden: true,
      render: (row) => row.szamlaszam || "—",
    },
    {
      key: "megjegyzes",
      label: "Megjegyzés",
      mobileHidden: true,
      render: (row) => row.megjegyzes || "—",
    },
    {
      key: "actions",
      label: "Műveletek",
      align: "right",
      render: (row) => (
        <div className="flex justify-end">
          <ActionIcon
            icon={<PiTrashLight />}
            danger
            onClick={() => handleDeleteTetel(row.id)}
            title="Törlés"
          />
        </div>
      ),
    },
  ];
  const egyebTetelExportColumns = [
    { key: "datum", label: "Dátum" },
    { key: "megnevezes", label: "Megnevezés" },
    { key: "osszeg", label: "Összeg (Ft)" },
    { key: "rendszam", label: "Jármű" },
    { key: "szamlaszam", label: "Számlaszám" },
    { key: "megjegyzes", label: "Megjegyzés" },
  ];

  const bevetelTetelek = egyebTetelek.filter((t) => t.irany === "bevetel");
  const kiadasTetelek = egyebTetelek.filter((t) => t.irany !== "bevetel");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        eyebrow="Járművek"
        title="Pénzforgalom"
        className="mb-0"
        action={
          <div className="flex flex-wrap items-end gap-3">
            <FormField
              type="date"
              label="Dátumtól"
              name="datumTol"
              value={filter.datumTol}
              onChange={handleFilterChange}
              className="w-40"
            />
            <FormField
              type="date"
              label="Dátumig"
              name="datumIg"
              value={filter.datumIg}
              onChange={handleFilterChange}
              className="w-40"
            />
          </div>
        }
      />

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : (
        <>
          {/* A globális "hogy állunk" nettó-hero átkerült a Főoldalra
              (e havi, fix időszak) — itt, a tetszőleges időszakra
              szűrhető Pénzforgalom oldalon a Bevétel/Kiadás/Nettó a
              grafikon kártya fejlécébe olvad, a KIVÁLASZTOTT (szűrt)
              időszakra vonatkozóan, nem külön hero-kártyaként. */}
          <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-ink-100">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold text-brand-900">Havi alakulás</h3>
                <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => changeYear(-1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-ink-500 transition-colors duration-150 hover:bg-white hover:text-brand-600"
                    aria-label="Előző év"
                    title="Előző év"
                  >
                    <PiCaretLeftLight className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-11 text-center text-xs font-bold tabular-nums text-ink-700">
                    {displayedYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeYear(1)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-ink-500 transition-colors duration-150 hover:bg-white hover:text-brand-600"
                    aria-label="Következő év"
                    title="Következő év"
                  >
                    <PiCaretRightLight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5 text-ink-500">
                  <PiTrendUpLight className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold tabular-nums text-ink-800">{formatHuf(adat.osszesen.bevetel)}</span>
                </span>
                <span className="flex items-center gap-1.5 text-ink-500">
                  <PiCoinsLight className="h-4 w-4 text-red-600" />
                  <span className="font-semibold tabular-nums text-ink-800">{formatHuf(adat.osszesen.kiadas)}</span>
                </span>
                <span className="flex items-center gap-1.5 border-l border-ink-100 pl-4 text-ink-500">
                  Nettó
                  <span
                    className={`font-semibold tabular-nums ${
                      adat.osszesen.netto >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {formatHuf(adat.osszesen.netto)}
                  </span>
                </span>
              </div>
            </div>
            {adat.havi.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-400">
                Nincs megjeleníthető adat ebben az időszakban.
              </p>
            ) : (
              <CashflowChart havi={adat.havi} simplified={isMobile} />
            )}
            {adat.vanDevizasFuvar && (
              <p className="mt-3 text-xs text-ink-400">
                Devizás (nem HUF) fuvarok díja nem szerepel az összesítésben —
                nincs árfolyam-forrás az appban.
              </p>
            )}

            {/* Kategória-chipek — a kiadás négy alkategóriája, kompakt
                sorban, a grafikon jelmagyarázatának kiterjesztéseként. */}
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <CategoryChip
                icon={PiWrenchLight}
                label="Karbantartás"
                value={adat.osszesen.karbantartas}
                dotClass="bg-brand-500"
              />
              <CategoryChip
                icon={PiGasPumpLight}
                label="Üzemanyag"
                value={adat.osszesen.uzemanyag}
                dotClass="bg-amber-500"
              />
              <CategoryChip
                icon={PiShieldCheckLight}
                label="Biztosítás"
                value={adat.osszesen.biztositas}
                dotClass="bg-purple-500"
              />
              <CategoryChip
                icon={PiReceiptLight}
                label="Egyéb"
                value={adat.osszesen.egyeb}
                dotClass="bg-yellow-500"
              />
            </div>
          </div>

          {/* Bevételek és Kiadások — asztalon (lg+) egymás mellett, két
              oszlopban, mert azonos szerkezetűek és ez a tényleges napi
              munkaterület (tétel-rögzítés); mobilon/tabletnél egymás
              alatt, mint eddig. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              {adat.egyebNemKotott.bevetel > 0 && (
                <p className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-ink-500">
                  Ebből járműhöz nem köthető:{" "}
                  {formatHuf(adat.egyebNemKotott.bevetel)}
                </p>
              )}
              <DataTable
                icon={PiTrendUpLight}
                title="Bevételek"
                onAdd={() => openAdding("bevetel")}
                addLabel="Új bevétel"
                exportFilename="bevetelek"
                exportColumns={egyebTetelExportColumns}
                columns={egyebTetelColumns}
                rows={bevetelTetelek}
                mobileTitleKey="megnevezes"
                emptyLabel="Nincs bevétel-tétel rögzítve"
                maxBodyHeight="260px"
              />
            </div>

            <div>
              {adat.egyebNemKotott.kiado > 0 && (
                <p className="mb-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-ink-500">
                  Ebből járműhöz nem köthető:{" "}
                  {formatHuf(adat.egyebNemKotott.kiado)}
                </p>
              )}
              <DataTable
                icon={PiReceiptLight}
                title="Kiadások"
                onAdd={() => openAdding("kiado")}
                addLabel="Új kiadás"
                exportFilename="kiadasok"
                exportColumns={egyebTetelExportColumns}
                columns={egyebTetelColumns}
                rows={kiadasTetelek}
                mobileTitleKey="megnevezes"
                emptyLabel="Nincs kiadás-tétel rögzítve"
                maxBodyHeight="260px"
              />
            </div>
          </div>

          <DataTable
            icon={PiCoinsLight}
            title="Jármű szerinti bontás"
            exportFilename="penzforgalom"
            exportColumns={exportColumns}
            columns={columns}
            rows={adat.jarmuvenkent}
            mobileTitleKey="rendszam"
            emptyLabel="Nincs megjeleníthető adat"
          />
        </>
      )}

      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          setUjTetel(emptyEgyebTetel());
        }}
        title={ujTetel.irany === "bevetel" ? "Új bevétel" : "Új kiadás"}
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <FormSection columns={2}>
            <FormField
              type="date"
              label="Dátum"
              name="datum"
              value={ujTetel.datum}
              onChange={handleUjTetelChange}
              required
            />
            <FormField
              type="number"
              label="Összeg (Ft)"
              name="osszeg"
              value={ujTetel.osszeg}
              onChange={handleUjTetelChange}
              required
            />
          </FormSection>
          <FormField
            label="Megnevezés"
            name="megnevezes"
            value={ujTetel.megnevezes}
            onChange={handleUjTetelChange}
            placeholder={
              ujTetel.irany === "bevetel"
                ? "pl. Kártérítés, egyéb bevétel"
                : "pl. Parkolás, bírság, matrica, biztosítás"
            }
            required
          />
          <FormField
            label="Számlaszám (opcionális)"
            name="szamlaszam"
            value={ujTetel.szamlaszam}
            onChange={handleUjTetelChange}
            placeholder="pl. a NAV Online Számla azonosítója"
          />
          <FormSection columns={2}>
            <FormField
              as="select"
              label="Kamion (opcionális)"
              name="kamion_id"
              value={ujTetel.kamion_id}
              onChange={handleUjTetelChange}
            >
              <option value="">Nincs hozzárendelve</option>
              {kamionok.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.rendszam}
                </option>
              ))}
            </FormField>
            <FormField
              as="select"
              label="Pótkocsi (opcionális)"
              name="potkocsi_id"
              value={ujTetel.potkocsi_id}
              onChange={handleUjTetelChange}
            >
              <option value="">Nincs hozzárendelve</option>
              {potkocsik.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.rendszam}
                </option>
              ))}
            </FormField>
          </FormSection>
          <FormField
            as="textarea"
            label="Megjegyzés"
            name="megjegyzes"
            value={ujTetel.megjegyzes}
            onChange={handleUjTetelChange}
            rows="2"
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setUjTetel(emptyEgyebTetel());
              }}
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Mentés..." : "Hozzáadás"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
