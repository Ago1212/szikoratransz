import React, { useEffect, useRef, useState, useCallback } from "react";
import Chart from "chart.js";
import { useMediaQuery } from "react-responsive";
import { useHistory } from "react-router-dom";
import {
  PiCoinsLight,
  PiWrenchLight,
  PiGasPumpLight,
  PiTrashLight,
  PiPencilSimpleLight,
  PiReceiptLight,
  PiShieldCheckLight,
  PiTrendUpLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiCaretLeftLight,
  PiCaretRightLight,
  PiCaretDownLight,
  PiCaretUpLight,
  PiCloudArrowDownLight,
  PiPlusLight,
  PiChartBarLight,
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

const TETEL_PAGE_SIZE = 8;

const emptyEgyebTetel = (irany = "kiado") => ({
  irany,
  kategoria: "",
  datum: new Date().toISOString().slice(0, 10),
  megnevezes: "",
  szamlaszam: "",
  osszeg: "",
  kamion_id: "",
  potkocsi_id: "",
  megjegyzes: "",
});

// A kategória-chip valódi SZŰRŐGOMB (ld. UX-audit "egységes pénzforgalmi
// szemlélet" pontja) — korábban ugyanez a doboz csak egy statikus összeget
// mutatott, kattintásra semmi nem történt. A Karbantartás/Biztosítás chip
// is kattintható, de azokhoz nincs `egyeb_koltsegek` sor (külön táblákból,
// on-the-fly számolt adat) — a lista ilyenkor szándékosan üresen fut, egy
// eligazító üzenettel (ld. `ledgerEmptyLabel` lejjebb), nem hibaként.
//
// A Bevétel/Kiadás/Nettó összesítő ugyanezt a komponenst használja, csak
// `onClick` NÉLKÜL (ilyenkor `<div>`-ként renderel, kattintás/hover nélkül)
// — így mind a 7 doboz (3 összesítő + 4 kategória) egyetlen egységes
// rácsban, egyforma méretben fér el (ld. lent), nem egy külön, hosszú,
// egysoros csíkban, ami keskeny (mobil) képernyőn feleslegesen sok sort
// foglalt. A címke+érték két külön sorba kerül (nem egymás mellé), hogy a
// nagyobb forintösszegek (pl. "132 009 972 Ft") keskeny, 2 oszlopos mobil
// nézetben se törjenek/lógjanak ki.
function CategoryChip({ icon: Icon, label, value, valueClass, dotClass, active, onClick }) {
  const interactive = typeof onClick === "function";
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left shadow-soft transition-all duration-200 ease-fluid ${
        active
          ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200"
          : `border-ink-100 bg-white ${interactive ? "hover:border-brand-200" : ""}`
      }`}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
        {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 text-ink-400" />}
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`text-sm font-bold tabular-nums ${valueClass || "text-brand-900"}`}
      >
        {formatHuf(value)}
      </span>
    </Tag>
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
    <div className="h-56 md:h-64">
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function Koltsegek() {
  const user = JSON.parse(sessionStorage.getItem("user"));
  const history = useHistory();
  const isMobile = useMediaQuery({ maxWidth: 767 });
  // A grafikon összecsukható — asztalon alapból nyitva (rögtön látszik a
  // havi trend), mobilon alapból csukva (ott a tétel-lista férjen el
  // görgetés nélkül elsőként) — a `useMediaQuery`-s kezdőállapot minta már
  // bevált a Karbantartasok.js mobil szűrőpaneljénél is.
  const [chartOpen, setChartOpen] = useState(!isMobile);
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
    setTetelekPage(1);
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

  // A Bevételek és Kiadások — korábban két külön táblázat — mostantól egy
  // egységes tétel-listát alkotnak, "Irány" jelvényoszloppal és a Mind/
  // Bevétel/Kiadás szegmens-kapcsolóval (ld. UX-audit 1-2. pontja). A
  // `getEgyebKoltsegek` backend-hívás `irany` paramétere már korábban is
  // opcionális volt (üresen mindkét irány visszajön) — csak a kategória-
  // szűrő (`kategoria`) volt új, azt kellett hozzáadni a backendhez.
  const [tetelek, setTetelek] = useState([]);
  const [tetelekTotal, setTetelekTotal] = useState(0);
  const [tetelekPage, setTetelekPage] = useState(1);
  const [tetelekSearch, setTetelekSearch] = useState("");
  const [iranySzuro, setIranySzuro] = useState("mind"); // "mind" | "bevetel" | "kiado"
  const [kategoriaSzuro, setKategoriaSzuro] = useState(""); // "" | "uzemanyag" | "egyeb" | "karbantartas" | "biztositas"
  const [adding, setAdding] = useState(false);
  const [ujTetel, setUjTetel] = useState(emptyEgyebTetel());
  const [editingTetelId, setEditingTetelId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // NAV Online Számla import — a Beállítások oldalon konfigurált cégenkénti
  // technikai felhasználóval lekérdezett számlákból a felhasználó választja
  // ki, melyeket vegye fel bevétel/kiadás tételként (ld. terv: kézi
  // lekérdezés + jóváhagyás, nincs automatikus/felügyelet nélküli import).
  const [navVanBeallitva, setNavVanBeallitva] = useState(false);
  const [navModalOpen, setNavModalOpen] = useState(false);
  const [navDatumTol, setNavDatumTol] = useState(filter.datumTol);
  const [navDatumIg, setNavDatumIg] = useState(filter.datumIg);
  const [navLekerdezve, setNavLekerdezve] = useState(false);
  const [navLekerdezesLoading, setNavLekerdezesLoading] = useState(false);
  const [navTetelek, setNavTetelek] = useState([]);
  const [navKivalasztott, setNavKivalasztott] = useState(() => new Set());
  const [navImportLoading, setNavImportLoading] = useState(false);

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

  const loadTetelek = () => {
    fetchAction("getEgyebKoltsegek", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      ...filter,
      irany: iranySzuro === "mind" ? undefined : iranySzuro,
      kategoria: kategoriaSzuro || undefined,
      search: tetelekSearch || undefined,
      page: tetelekPage,
      pageSize: TETEL_PAGE_SIZE,
    }).then((result) => {
      if (result?.success) {
        setTetelek(result.tetelek || []);
        setTetelekTotal(result.total ?? (result.tetelek || []).length);
      } else {
        setTetelekTotal(0);
      }
    });
  };

  const handleTetelekExportAll = useCallback(async () => {
    const result = await fetchAction("getEgyebKoltsegek", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      ...filter,
      irany: iranySzuro === "mind" ? undefined : iranySzuro,
      kategoria: kategoriaSzuro || undefined,
      search: tetelekSearch || undefined,
    });
    return result?.success ? result.tetelek || [] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, iranySzuro, kategoriaSzuro, tetelekSearch]);

  useEffect(() => {
    loadOsszesito();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    loadTetelek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, tetelekPage, tetelekSearch, iranySzuro, kategoriaSzuro]);

  useEffect(() => {
    fetchAction("getKamionRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setKamionok(result.kamionok || []);
    });
    fetchAction("getPotkocsiRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setPotkocsik(result.potkocsik || []);
    });
    fetchAction("getNavSzamlaBeallitasokStatusz", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
    }).then((result) => {
      if (result?.success) setNavVanBeallitva(!!result.van_beallitva);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNavModal = () => {
    setNavDatumTol(filter.datumTol);
    setNavDatumIg(filter.datumIg);
    setNavLekerdezve(false);
    setNavTetelek([]);
    setNavKivalasztott(new Set());
    setNavModalOpen(true);
  };

  const handleNavLekerdezes = async () => {
    setNavLekerdezesLoading(true);
    try {
      const result = await fetchAction("navSzamlaLekerdezes", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        datumTol: navDatumTol,
        datumIg: navDatumIg,
      });
      if (result?.success) {
        // A `kategoria_javaslat` (partnernév-egyezés alapján, pl. "MOL") csak
        // egy előre kitöltött javaslat — a felhasználó importálás előtt
        // soronként felülbírálhatja a review-listában.
        const tetelek = (result.tetelek || []).map((t) => ({
          ...t,
          kategoria: t.kategoria_javaslat || "",
        }));
        setNavTetelek(tetelek);
        // Alapból minden ÚJ (még nem importált, forint-összeggel rendelkező)
        // tétel ki van pipálva — a felhasználó itt egyesével lemondhatja
        // azokat, amiket mégsem szeretne felvenni, jóváhagyás előtt.
        setNavKivalasztott(
          new Set(
            tetelek.filter((t) => t.importalhato).map((t) => t.szamlaszam),
          ),
        );
        setNavLekerdezve(true);
      } else {
        toast.error(result?.message || "Lekérdezés sikertelen.");
      }
    } finally {
      setNavLekerdezesLoading(false);
    }
  };

  const toggleNavTetel = (szamlaszam) => {
    setNavKivalasztott((prev) => {
      const uj = new Set(prev);
      if (uj.has(szamlaszam)) {
        uj.delete(szamlaszam);
      } else {
        uj.add(szamlaszam);
      }
      return uj;
    });
  };

  const changeNavKategoria = (szamlaszam, kategoria) => {
    setNavTetelek((prev) =>
      prev.map((t) => (t.szamlaszam === szamlaszam ? { ...t, kategoria } : t)),
    );
  };

  const handleNavImport = async () => {
    const kivalasztottTetelek = navTetelek.filter((t) =>
      navKivalasztott.has(t.szamlaszam),
    );
    if (kivalasztottTetelek.length === 0) {
      toast.error("Nincs kiválasztva egyetlen tétel sem.");
      return;
    }
    setNavImportLoading(true);
    try {
      const result = await fetchAction("importNavSzamlak", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        tetelek: kivalasztottTetelek,
      });
      if (result?.success) {
        toast.success(result.message || "Import sikeres.");
        setNavModalOpen(false);
        loadOsszesito();
        loadTetelek();
      } else {
        toast.error(result?.message || "Import sikertelen.");
      }
    } finally {
      setNavImportLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
    setTetelekPage(1);
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
      // Szerkesztéskor (`editingTetelId`) ugyanez a form egy meglévő tételt
      // frissít, nem újat hoz létre — elsősorban azért kellett, hogy egy
      // NAV Online Számlából importált tételhez (aminek importáláskor
      // nincs kamion_id/potkocsi_id-je) utólag hozzá lehessen rendelni
      // egy járművet, de bármelyik mezője szerkeszthető vele.
      const action = editingTetelId ? "updateEgyebKoltseg" : "newEgyebKoltseg";
      const result = await fetchAction(action, {
        id: editingTetelId || undefined,
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        irany: ujTetel.irany,
        kategoria: ujTetel.kategoria || null,
        datum: ujTetel.datum,
        megnevezes: ujTetel.megnevezes.trim(),
        szamlaszam: ujTetel.szamlaszam.trim() || null,
        osszeg: ujTetel.osszeg,
        kamion_id: ujTetel.kamion_id || null,
        potkocsi_id: ujTetel.potkocsi_id || null,
        megjegyzes: ujTetel.megjegyzes.trim() || null,
      });
      if (result?.success) {
        toast.success(
          result.message ||
            (editingTetelId ? "Tétel frissítve." : "Tétel rögzítve."),
        );
        setUjTetel(emptyEgyebTetel());
        setEditingTetelId(null);
        setAdding(false);
        loadOsszesito();
        loadTetelek();
      } else {
        toast.error(result?.message || "Mentés sikertelen.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const openAdding = (irany) => {
    setEditingTetelId(null);
    setUjTetel(emptyEgyebTetel(irany));
    setAdding(true);
  };

  const openEditing = (row) => {
    setEditingTetelId(row.id);
    setUjTetel({
      irany: row.irany,
      kategoria: row.kategoria || "",
      datum: row.datum,
      megnevezes: row.megnevezes,
      szamlaszam: row.szamlaszam || "",
      osszeg: row.osszeg,
      kamion_id: row.kamion_id || "",
      potkocsi_id: row.potkocsi_id || "",
      megjegyzes: row.megjegyzes || "",
    });
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
      loadTetelek();
    } else {
      toast.error(result?.message || "Törlés sikertelen.");
    }
  };

  const toggleKategoriaSzuro = (kulcs) => {
    setKategoriaSzuro((prev) => (prev === kulcs ? "" : kulcs));
    setTetelekPage(1);
  };

  const changeIranySzuro = (kulcs) => {
    setIranySzuro(kulcs);
    setTetelekPage(1);
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

  // Az egykor külön Bevételek/Kiadások táblázat mostantól egy közös lista —
  // az "Irány" oszlop jelzi, melyik sor melyik irányba tartozik (ld.
  // UX-audit 1-2. pontja: egy szélesebb, sűrűbb lista kevesebb görgetéssel,
  // mint két keskeny, fejenként duplázott fejléccel/lapozóval).
  const egyebTetelColumns = [
    { key: "datum", label: "Dátum" },
    {
      key: "irany",
      label: "Irány",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            row.irany === "bevetel"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {row.irany === "bevetel" ? "Bevétel" : "Kiadás"}
        </span>
      ),
      exportValue: (row) => (row.irany === "bevetel" ? "Bevétel" : "Kiadás"),
    },
    {
      key: "megnevezes",
      label: "Megnevezés",
      className: "font-semibold text-brand-900",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span>{row.megnevezes}</span>
          {row.kategoria === "uzemanyag" && (
            <span
              className="inline-flex flex-shrink-0 items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700"
              title="Üzemanyag kategóriába sorolva"
            >
              Üzemanyag
            </span>
          )}
        </div>
      ),
      exportValue: (row) => row.megnevezes,
    },
    {
      key: "osszeg",
      label: "Összeg",
      align: "right",
      className: "tabular-nums font-semibold",
      render: (row) => (
        <span
          className={
            row.irany === "bevetel" ? "text-emerald-600" : "text-red-600"
          }
        >
          {formatHuf(row.osszeg)}
        </span>
      ),
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
        <div className="flex justify-end gap-1">
          <ActionIcon
            icon={<PiPencilSimpleLight />}
            onClick={() => openEditing(row)}
            title="Szerkesztés"
          />
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
    {
      key: "irany",
      label: "Irány",
      exportValue: (row) => (row.irany === "bevetel" ? "Bevétel" : "Kiadás"),
    },
    { key: "megnevezes", label: "Megnevezés" },
    { key: "osszeg", label: "Összeg (Ft)" },
    { key: "rendszam", label: "Jármű" },
    { key: "szamlaszam", label: "Számlaszám" },
    { key: "megjegyzes", label: "Megjegyzés" },
  ];

  const tetelekHeaderAction = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => openAdding("bevetel")}
        className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-emerald-700 shadow-soft transition-all duration-300 ease-fluid hover:bg-emerald-100 active:scale-95"
      >
        <PiPlusLight className="h-4 w-4" /> Bevétel
      </button>
      <button
        type="button"
        onClick={() => openAdding("kiado")}
        className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-all duration-300 ease-fluid hover:bg-brand-700 active:scale-95"
      >
        <PiPlusLight className="h-4 w-4" /> Kiadás
      </button>
    </div>
  );

  // A Karbantartás/Biztosítás chipre nincs `egyeb_koltsegek` sor (külön
  // táblákból, on-the-fly számolt adat, ld. koltsegInterface.php komment) —
  // ha a felhasználó ezekre szűr, a lista szándékosan üres, de egy
  // eligazító üzenettel (nem hibaként) a tényleges adat helyére mutat.
  const ledgerEmptyLabel =
    kategoriaSzuro === "karbantartas" ? (
      <>
        Nincs ilyen jelölésű tétel — a karbantartási költségek a{" "}
        <button
          type="button"
          onClick={() => history.push("/admin/karbantartasok")}
          className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
        >
          Karbantartások
        </button>{" "}
        oldalon részletesek.
      </>
    ) : kategoriaSzuro === "biztositas" ? (
      <>
        Nincs ilyen jelölésű tétel — a biztosítási díjak a jármű saját
        adatlapján (
        <button
          type="button"
          onClick={() => history.push("/admin/kamionok")}
          className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
        >
          Kamionok
        </button>
        /
        <button
          type="button"
          onClick={() => history.push("/admin/potkocsi")}
          className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
        >
          Pótkocsik
        </button>
        ) részletesek.
      </>
    ) : (
      "Nincs megjeleníthető tétel"
    );

  const kategoriaChipek = [
    {
      key: "karbantartas",
      label: "Karbantartás",
      icon: PiWrenchLight,
      dotClass: "bg-brand-500",
      value: adat.osszesen.karbantartas,
    },
    {
      key: "uzemanyag",
      label: "Üzemanyag",
      icon: PiGasPumpLight,
      dotClass: "bg-amber-500",
      value: adat.osszesen.uzemanyag,
    },
    {
      key: "biztositas",
      label: "Biztosítás",
      icon: PiShieldCheckLight,
      dotClass: "bg-purple-500",
      value: adat.osszesen.biztositas,
    },
    {
      key: "egyeb",
      label: "Egyéb",
      icon: PiReceiptLight,
      dotClass: "bg-yellow-500",
      value: adat.osszesen.egyeb,
    },
  ];

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
            <button
              type="button"
              onClick={openNavModal}
              title={
                navVanBeallitva
                  ? undefined
                  : "A NAV-kapcsolat még nincs beállítva — lásd Beállítások"
              }
              className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-ink-600 shadow-soft transition-all duration-300 ease-fluid hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-95"
            >
              <PiCloudArrowDownLight className="h-4 w-4" />
              NAV számlák lekérdezése
            </button>
          </div>
        }
      />

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : (
        <>
          {/* Havi alakulás — összecsukható diagram-kártya, ismét felül,
              alapból nyitva asztalon (rögtön látszik a havi trend), alapból
              csukva mobilon (ott a tétel-lista férjen el felül, görgetés
              nélkül). A fejléc (cím/nyitó-csukó nyíl + Bevétel/Kiadás/Nettó
              + év-váltó) mindig látszik, összecsukott állapotban is — így a
              legfontosabb 3 szám akkor is egy pillantásra elérhető, ha
              maga a grafikon épp be van csukva. */}
          <div className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-ink-100">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setChartOpen((o) => !o)}
                className="flex flex-shrink-0 items-center gap-2 text-left"
              >
                <PiChartBarLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
                <h3 className="font-display text-base font-semibold text-brand-900">
                  Havi alakulás
                </h3>
                {chartOpen ? (
                  <PiCaretUpLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
                ) : (
                  <PiCaretDownLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
                )}
              </button>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5 text-ink-500">
                  <PiTrendUpLight className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold tabular-nums text-ink-800">
                    {formatHuf(adat.osszesen.bevetel)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-ink-500">
                  <PiCoinsLight className="h-4 w-4 text-red-600" />
                  <span className="font-semibold tabular-nums text-ink-800">
                    {formatHuf(adat.osszesen.kiadas)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-ink-500">
                  Nettó
                  <span
                    className={`font-semibold tabular-nums ${
                      adat.osszesen.netto >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatHuf(adat.osszesen.netto)}
                  </span>
                </span>
              </div>
              {chartOpen && (
                <div className="ml-auto flex flex-shrink-0 items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
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
              )}
            </div>
            {chartOpen && (
              <div className="mt-4">
                {adat.havi.length === 0 ? (
                  <p className="py-10 text-center text-sm text-ink-400">
                    Nincs megjeleníthető adat ebben az időszakban.
                  </p>
                ) : (
                  <CashflowChart havi={adat.havi} simplified={isMobile} />
                )}
                {adat.vanDevizasFuvar && (
                  <p className="mt-3 text-xs text-ink-400">
                    Devizás (nem HUF) fuvarok díja nem szerepel az
                    összesítésben — nincs árfolyam-forrás az appban.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Kategória-chip rács — Bevétel/Kiadás/Nettó a fenti grafikon-
              fejlécbe került, itt a 4 kiadás-kategória tölti ki a teljes
              rendelkezésre álló szélességet (2 oszlop mobilon, 4 oszlop
              sm+ felett). */}
          <div className="grid grid-cols-2 gap-2 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink-100 sm:grid-cols-4">
            {kategoriaChipek.map((chip) => (
              <CategoryChip
                key={chip.key}
                icon={chip.icon}
                label={chip.label}
                value={chip.value}
                dotClass={chip.dotClass}
                active={kategoriaSzuro === chip.key}
                onClick={() => toggleKategoriaSzuro(chip.key)}
              />
            ))}
          </div>

          {/* Mind/Bevétel/Kiadás szegmens */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1">
              {[
                { key: "mind", label: "Mind" },
                { key: "bevetel", label: "Bevétel" },
                { key: "kiado", label: "Kiadás" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => changeIranySzuro(opt.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                    iranySzuro === opt.key
                      ? "bg-white text-brand-700 shadow-soft"
                      : "text-ink-500 hover:text-ink-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(adat.egyebNemKotott.bevetel > 0 || adat.egyebNemKotott.kiado > 0) && (
            <div className="flex flex-wrap gap-2">
              {adat.egyebNemKotott.bevetel > 0 && (
                <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-ink-500">
                  Ebből járműhöz nem köthető bevétel:{" "}
                  {formatHuf(adat.egyebNemKotott.bevetel)}
                </p>
              )}
              {adat.egyebNemKotott.kiado > 0 && (
                <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-ink-500">
                  Ebből járműhöz nem köthető kiadás:{" "}
                  {formatHuf(adat.egyebNemKotott.kiado)}
                </p>
              )}
            </div>
          )}

          <DataTable
            icon={PiReceiptLight}
            title="Tételek"
            headerAction={tetelekHeaderAction}
            exportFilename="penzforgalom_tetelek"
            exportColumns={egyebTetelExportColumns}
            columns={egyebTetelColumns}
            rows={tetelek}
            mobileTitleKey="megnevezes"
            emptyLabel={ledgerEmptyLabel}
            searchable
            searchPlaceholder="Keresés a tételek közt..."
            serverSide
            totalRows={tetelekTotal}
            page={tetelekPage}
            pageSize={TETEL_PAGE_SIZE}
            onPageChange={setTetelekPage}
            onSearchChange={setTetelekSearch}
            onExportAll={handleTetelekExportAll}
          />

          {/* Jármű szerinti bontás — elemző jellegű, ezért a napi
              munkafelület (tétel-lista) alatt, a lap alján kap helyet. */}
          <DataTable
            icon={PiCoinsLight}
            title="Jármű szerinti bontás"
            exportFilename="penzforgalom"
            exportColumns={exportColumns}
            columns={columns}
            rows={adat.jarmuvenkent}
            mobileTitleKey="rendszam"
            emptyLabel="Nincs megjeleníthető adat"
            searchable
            searchPlaceholder="Keresés rendszám vagy típus szerint..."
            pageSize={8}
          />
        </>
      )}

      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          setEditingTetelId(null);
          setUjTetel(emptyEgyebTetel());
        }}
        title={
          editingTetelId
            ? ujTetel.irany === "bevetel"
              ? "Bevétel szerkesztése"
              : "Kiadás szerkesztése"
            : ujTetel.irany === "bevetel"
              ? "Új bevétel"
              : "Új kiadás"
        }
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
          {ujTetel.irany === "kiado" && (
            <FormField
              as="select"
              label="Kategória"
              name="kategoria"
              value={ujTetel.kategoria}
              onChange={handleUjTetelChange}
            >
              <option value="">Egyéb</option>
              <option value="uzemanyag">Üzemanyag</option>
            </FormField>
          )}
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
                setEditingTetelId(null);
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
              {isSaving ? "Mentés..." : editingTetelId ? "Mentés" : "Hozzáadás"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={navModalOpen}
        onClose={() => setNavModalOpen(false)}
        title="NAV Online Számla — számlák lekérdezése"
        maxWidth="max-w-5xl"
      >
        {!navVanBeallitva ? (
          <p className="text-sm text-ink-500">
            A NAV Online Számla kapcsolat még nincs beállítva ehhez a céghez.
            Állítsd be a{" "}
            <span className="font-semibold text-ink-700">Beállítások</span>{" "}
            oldalon (technikai felhasználó adatai), utána itt lekérdezhetők a
            számlák.
          </p>
        ) : (
          <div className="space-y-4">
            <FormSection columns={3}>
              <FormField
                type="date"
                label="Dátumtól"
                value={navDatumTol}
                onChange={(e) => setNavDatumTol(e.target.value)}
              />
              <FormField
                type="date"
                label="Dátumig"
                value={navDatumIg}
                onChange={(e) => setNavDatumIg(e.target.value)}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleNavLekerdezes}
                  disabled={navLekerdezesLoading}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {navLekerdezesLoading ? "Lekérdezés..." : "Lekérdezés"}
                </button>
              </div>
            </FormSection>

            {navLekerdezve && (
              <>
                {navTetelek.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-400">
                    Nincs számla a NAV-nál ebben az időszakban.
                  </p>
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-xl border border-ink-100">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-ink-400">
                        <tr>
                          <th className="px-3 py-2 text-left"> </th>
                          <th className="px-3 py-2 text-left">Számlaszám</th>
                          <th className="px-3 py-2 text-left">Irány</th>
                          <th className="px-3 py-2 text-left">Dátum</th>
                          <th className="px-3 py-2 text-left">Partner</th>
                          <th className="px-3 py-2 text-right">Összeg</th>
                          <th className="px-3 py-2 text-left">Kategória</th>
                          <th className="px-3 py-2 text-left">Állapot</th>
                        </tr>
                      </thead>
                      <tbody>
                        {navTetelek.map((t) => (
                          <tr
                            key={t.szamlaszam}
                            className="border-t border-ink-100"
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={navKivalasztott.has(t.szamlaszam)}
                                disabled={!t.importalhato}
                                onChange={() => toggleNavTetel(t.szamlaszam)}
                                className="h-4 w-4 rounded border-ink-300 accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                              />
                            </td>
                            <td className="px-3 py-2 font-medium text-ink-700">
                              {t.szamlaszam}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  t.irany === "bevetel"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {t.irany === "bevetel" ? "Bevétel" : "Kiadás"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-ink-500">
                              {t.datum}
                            </td>
                            <td className="px-3 py-2 text-ink-500">
                              {t.partner_nev || "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                              {t.osszeg_huf !== null
                                ? formatHuf(t.osszeg_huf)
                                : "—"}
                              {t.penznem && t.penznem !== "HUF" && (
                                <span className="ml-1 text-xs text-ink-400">
                                  ({t.penznem})
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {t.irany === "kiado" ? (
                                <select
                                  value={t.kategoria || ""}
                                  onChange={(e) => changeNavKategoria(t.szamlaszam, e.target.value)}
                                  disabled={t.mar_importalva}
                                  className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <option value="">Egyéb</option>
                                  <option value="uzemanyag">Üzemanyag</option>
                                </select>
                              ) : (
                                <span className="text-ink-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-ink-400">
                              {t.mar_importalva
                                ? "Már importálva"
                                : t.osszeg_huf === null
                                  ? "Hiányos adat"
                                  : "Új"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setNavModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800"
                  >
                    Mégse
                  </button>
                  <button
                    type="button"
                    onClick={handleNavImport}
                    disabled={navImportLoading || navKivalasztott.size === 0}
                    className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {navImportLoading
                      ? "Importálás..."
                      : `Kiválasztottak importálása (${navKivalasztott.size})`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
