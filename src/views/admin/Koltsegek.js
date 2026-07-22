import React, { useEffect, useRef, useState, useCallback } from "react";
import Chart from "chart.js";
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
  PiVanLight,
  PiCaretLeftLight,
  PiCaretRightLight,
  PiCloudArrowDownLight,
  PiPlusLight,
  PiChartBarLight,
  PiWalletLight,
  PiWarningCircleLight,
  PiBankLight,
  PiFileArrowUpLight,
  PiLinkSimpleLight,
  PiCheckCircleLight,
  PiCaretDownLight,
  PiCaretUpFill,
  PiCaretDownFill,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import DataTable, { ActionIcon } from "components/UI/DataTable.js";
import Modal from "components/UI/Modal.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import Spinner from "components/UI/Spinner.js";
import CardStats from "components/Cards/CardStats.js";
// A CardUzemanyagElemzes (üzemanyag-fogyasztás anomália-elemzés) import és
// megjelenítés egyenlőre szándékosan ki van véve (felhasználói kérésre) — a
// komponens fájlja változatlan, később egy `import` + JSX-sor
// visszaállításával egyszerűen újra bekapcsolható.

const formatHuf = (value) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(value || 0);

// Devizás tétel eredeti (nem HUF) összegének megjelenítése — csak
// tájékoztató jellegű, a riportok mindig a fagyasztott `osszeg` (HUF)
// mezőt használják, ld. koltsegInterface.php resolveDevizaOsszeg komment.
const formatDeviza = (value, deviza) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(value || 0) + " " + deviza;

const formatSzazalek = (ertek) =>
  new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(Math.abs(ertek));

// UX-audit (2026-07-20) — KPI %-delta a KPI-csempéken: a `PiaciArakPanel`
// %-deltájával megegyező vizuális nyelv (irány-nyíl + szín), csak itt a
// csempe `statCaption` slot-jában, láthatóan, nem csak egy title-tooltipben
// (a Pénzforgalom KPI-sora ennél fontosabb ahhoz, hogy a trend csak
// tooltipre kattintva/hover-re derüljön ki). `higherIsBetter` dönti el, hogy
// a növekedés jó (Bevétel/Nettó, zöld) vagy rossz (Kiadás, piros) jelet
// kapjon-e — ugyanaz a szám más előjelű üzenetet hordoz a két esetben.
function KpiDelta({ current, previous, higherIsBetter = true }) {
  if (previous === null || previous === undefined || previous === 0) return null;
  const valtozas = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(valtozas) < 0.5) {
    return <span className="text-ink-400 dark:text-ink-500">Nincs érdemi változás</span>;
  }
  const nott = valtozas > 0;
  const jo = nott === higherIsBetter;
  const Icon = nott ? PiCaretUpFill : PiCaretDownFill;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${jo ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
      <Icon className="h-3 w-3 flex-shrink-0" />
      {formatSzazalek(valtozas)}% előző időszakhoz képest
    </span>
  );
}

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

// Kézzel felvett/módosított tétel kategória-jelvénye a tétel-listában — csak
// a ténylegesen tárolt `kategoria` oszlop-értékekhez van jelvény ('egyeb'/null
// esetén nincs, hiszen az a lista alapértelmezett, jelvény nélküli állapota).
const KATEGORIA_BADGE = {
  uzemanyag: { label: "Üzemanyag", className: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  karbantartas: { label: "Karbantartás", className: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  biztositas: { label: "Biztosítás", className: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" },
  ber: { label: "Fizetés", className: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300" },
};

const emptyEgyebTetel = (irany = "kiado") => ({
  irany,
  kategoria: "",
  datum: new Date().toISOString().slice(0, 10),
  megnevezes: "",
  szamlaszam: "",
  osszeg: "",
  deviza: "HUF",
  eredeti_osszeg: "",
  kamion_id: "",
  potkocsi_id: "",
  furgon_id: "",
  megjegyzes: "",
});

// UX-audit (2026-07-20) — a NAV/Bank/MOL 3 import-gomb korábban egyenrangú
// súlyú, egymás melletti gombként ült a szűrősorban, a tényleges szűrőkkel
// (irány, kategória) keveredve — 6 interaktív elem versengett a figyelemért,
// mielőtt egyetlen tétel is látszott volna, mobilon pedig ez a sor 4-5 sorra
// tördelődött. Egyetlen "Import ▾" gomb mögé összevonva a szűrők és az
// import-akciók vizuálisan is szétválnak — a piros jelvény (a NAV-import
// korábbi gombjáról átvéve) a gyűjtőgombon is látszik, hogy a NAV-tétel ne
// vesszen el a menü mögött.
function ImportMenu({ navUjSzam, onNav, navTitle, onBank, onMol }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const items = [
    { key: "nav", label: "NAV számlák", icon: PiCloudArrowDownLight, onClick: onNav, title: navTitle, badge: navUjSzam },
    { key: "bank", label: "Bank import", icon: PiBankLight, onClick: onBank },
    { key: "mol", label: "MOL tankolás import", icon: PiGasPumpLight, onClick: onMol },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-ink-600 shadow-soft transition-all duration-300 ease-fluid hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 active:scale-95 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300"
      >
        Import
        {navUjSzam > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {navUjSzam}
          </span>
        )}
        <PiCaretDownLight className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-ink-100 bg-white py-1 shadow-soft-lg dark:border-ink-800 dark:bg-ink-900">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              title={item.title}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-ink-600 hover:bg-slate-50 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <item.icon className="h-4 w-4 flex-shrink-0 text-ink-400 dark:text-ink-500" />
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 && (
                <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Kiadás-összetétel — a korábbi (2026-07-18 előtti) chip-rács kártya-
// nézetét hozza vissza (felhasználói visszajelzés alapján: a stacked-bar
// nézetnél jobban áttekinthető), DE tudatosan NEM kattintható, mint annak
// idején. A kattintható változat pontosan azért lett eltávolítva, mert a
// Karbantartás/Biztosítás/Fizetés kategóriák értéke jórészt MÁS táblákból
// (karbantartási rekordok, jármű biztosítási mezői, sofőr-bérek) származik,
// nem az `egyeb_koltsegek` listából — egy chipre kattintva a ténylegesen
// szűrhető lista sosem egyezett vissza a chipen mutatott összeggel. A
// valódi, teljes egészében listaszűrhető kategóriák (Üzemanyag, Egyéb
// kiadás) továbbra is a Tételek fül saját "Kategória" legördülőjében
// szűrhetők — a funkció nem veszett el, csak nem erről a rácsról indul.
function CategoryChip({ icon: Icon, label, value, dotClass }) {
  return (
    <div className="flex w-full flex-col gap-1 rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-left shadow-soft dark:border-ink-800 dark:bg-ink-900">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 dark:text-ink-400">
        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
        {Icon && <Icon className="h-3.5 w-3.5 flex-shrink-0 text-ink-400 dark:text-ink-500" />}
        <span className="truncate">{label}</span>
      </span>
      <span className="text-sm font-bold tabular-nums text-brand-900 dark:text-ink-50">{formatHuf(value)}</span>
    </div>
  );
}

// Havi bontású cashflow-diagram — natívan chart.js-szel (2.9.4, a `stack`
// dataset-kulcs 2.7-től támogatott). A bevétel saját ("bevetel")
// oszlopcsoportba kerül, a kiadás-kategóriák közös ("kiado") stack-be — így
// egy hónapon belül két, egymás melletti oszlop látszik. UX-redesign
// (2026-07-18): a diagram most a saját, teljes szélességű "Havi alakulás"
// fülén él (nem egy 300px-es sticky oldalsávban) — ezért mindig a teljes,
// 6 datasetes kategória-bontást mutatja, nincs többé külön "egyszerűsített
// kabin-változat" + "teljes modál-változat" duplikáció.
function CashflowChart({ havi, isAdmin }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    const datasets = [
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
      // A "Fizetés" (bérek) dataset csak adminnak jelenik meg — a backend
      // (koltsegInterface.php getKoltsegOsszesito) nem-admin hívónak amúgy is
      // nullázza a `ber` mezőt havi bontásban, de itt is elhagyjuk a
      // jelmagyarázatból, nem csak nulla oszlopot mutatunk.
      ...(isAdmin
        ? [
            {
              label: "Fizetés",
              backgroundColor: "#F97316",
              data: havi.map((h) => h.ber),
              stack: "kiado",
            },
          ]
        : []),
      {
        label: "Kiadás",
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
                callback: (value) => new Intl.NumberFormat("hu-HU").format(value),
              },
            },
          ],
        },
      },
    });
    return () => chartRef.current?.destroy();
  }, [havi, isAdmin]);

  return (
    <div className="h-72 md:h-96">
      <canvas ref={canvasRef} />
    </div>
  );
}

// Ft/km fajlagos mutató cellája (Jármű szerinti bontás). `ertek === null`
// azt jelenti, hogy vagy pótkocsi-sor (nincs saját GPS), vagy nincs
// gyorsítótárazott km-adat erre az időszakra (ld. koltsegInterface.php
// kmOsszesito() — a cache-t a gpsmart_km_cache_frissites.php cron tölti
// fel a háttérben). Ha VAN érték, de a `lefedettseg` 100% alatti, ~ jellel
// és tooltippel jelezzük, hogy a mutató a hiányos km-adat miatt csak
// becslés — sosem mutatunk hamis pontosságot hiányos adatból számolva.
function PerKmErtek({ ertek, lefedettseg }) {
  if (ertek === null || ertek === undefined) {
    return <span className="text-ink-400 dark:text-ink-500">—</span>;
  }
  const hianyos = lefedettseg !== null && lefedettseg !== undefined && lefedettseg < 100;
  return (
    <span
      className={hianyos ? "text-ink-500 dark:text-ink-400" : undefined}
      title={
        hianyos
          ? `A km-adat csak ${lefedettseg}%-ban áll rendelkezésre ebben az időszakban — a mutató becslés.`
          : undefined
      }
    >
      {hianyos && "~"}
      {formatHuf(ertek)}
    </span>
  );
}

// Fejléc-szintű időszak-vezérlés — UX-redesign (2026-07-18): korábban a
// Dátumtól/Dátumig mező a fejlécben élt, az év-léptető (◄/►) pedig egy külön,
// a "Havi alakulás" kabin-kártya fejlécébe rejtett gombpárként — két,
// egymástól térben elszakított módja volt ugyanannak (az időszak
// beállításának). Most egy helyen: gyors preset gombok a leggyakoribb
// esetekre, a pontos dátummezők mindig látszanak a finomhangoláshoz, az
// év-léptető pedig ugyanide, a dátummezők mellé költözött.
function PeriodControl({ filter, onPreset, onFieldChange, displayedYear, onChangeYear }) {
  const today = new Date().toISOString().slice(0, 10);
  const honapEleje = `${today.slice(0, 7)}-01`;
  const napja30Elott = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const evEleje = `${new Date().getFullYear()}-01-01`;
  const evVege = `${new Date().getFullYear()}-12-31`;

  const presets = [
    { key: "honap", label: "Ez a hónap", tol: honapEleje, ig: today },
    { key: "30nap", label: "Elmúlt 30 nap", tol: napja30Elott, ig: today },
    { key: "ev", label: "Ez az év", tol: evEleje, ig: evVege },
  ];
  const activePreset = presets.find(
    (p) => p.tol === filter.datumTol && p.ig === filter.datumIg,
  )?.key;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPreset(p.tol, p.ig)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              activePreset === p.key
                ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
            }`}
          >
            {p.label}
          </button>
        ))}
        <span
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            !activePreset ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300" : "text-ink-400 dark:text-ink-500"
          }`}
        >
          Egyedi
        </span>
      </div>
      <FormField
        type="date"
        label="Dátumtól"
        name="datumTol"
        value={filter.datumTol}
        onChange={onFieldChange}
        className="w-36"
      />
      <FormField
        type="date"
        label="Dátumig"
        name="datumIg"
        value={filter.datumIg}
        onChange={onFieldChange}
        className="w-36"
      />
      <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-ink-800">
        <button
          type="button"
          onClick={() => onChangeYear(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition-colors duration-150 hover:bg-white hover:text-brand-600 dark:text-ink-400 dark:hover:bg-ink-700 dark:hover:text-brand-300"
          aria-label="Előző év (teljes évre ugrás)"
          title="Előző teljes évre ugrás"
        >
          <PiCaretLeftLight className="h-3.5 w-3.5" />
        </button>
        <span className="w-11 text-center text-xs font-bold tabular-nums text-ink-700 dark:text-ink-200">
          {displayedYear}
        </span>
        <button
          type="button"
          onClick={() => onChangeYear(1)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-500 transition-colors duration-150 hover:bg-white hover:text-brand-600 dark:text-ink-400 dark:hover:bg-ink-700 dark:hover:text-brand-300"
          aria-label="Következő év (teljes évre ugrás)"
          title="Következő teljes évre ugrás"
        >
          <PiCaretRightLight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

const TABS = [
  { key: "tetelek", label: "Tételek", icon: PiReceiptLight },
  { key: "jarmuvenkent", label: "Jármű szerinti bontás", icon: PiTruckLight },
  { key: "chart", label: "Havi alakulás", icon: PiChartBarLight },
];

export default function Koltsegek() {
  const user = JSON.parse(localStorage.getItem("user"));
  // A "Fizetés" (bérek) kategória — sor, chip, diagram-oszlop, dropdown-
  // opció — kizárólag admin szerepkörnek jelenik meg (ld. koltsegInterface.php
  // getKoltsegOsszesito/getEgyebKoltsegek `$isAdmin` kapuzása). A frontend
  // itt csak elrejti, a valódi védelmi vonal a backend.
  const isOwnerAdmin = user.szerepkor === "admin";
  const [activeTab, setActiveTab] = useState("tetelek");
  const [loading, setLoading] = useState(true);
  // UX-audit (2026-07-20) — alapból a FOLYÓ HÓNAP (nem a teljes év), hogy
  // egyezzen a Dashboard "Nettó eredmény (e havi)" kártyájának időszakával,
  // ahonnan a "Pénzforgalom →" link ide vezet. Korábban ez az oldal a teljes
  // folyó évre nyílt meg — egy havi számról ide kattintva a felhasználó egy
  // teljesen más (éves) Bevétel/Kiadás/Nettó számsort látott, ami zavaró,
  // bizalomromboló belépési élmény volt egy pénzügyi modulnál. A fejléc
  // év-léptetője (◄ / ►) és a "Ez az év" preset továbbra is bármikor teljes
  // évre vált — a Dátumtól/Dátumig mezők pedig ettől függetlenül bármikor
  // felülírhatók egy pontos, egyedi időszakra is.
  const [filter, setFilter] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    const honapEleje = `${today.slice(0, 7)}-01`;
    return { datumTol: honapEleje, datumIg: today };
  });
  const displayedYear = filter.datumTol
    ? new Date(filter.datumTol).getFullYear()
    : new Date().getFullYear();
  const changeYear = (delta) => {
    const ev = displayedYear + delta;
    setFilter({ datumTol: `${ev}-01-01`, datumIg: `${ev}-12-31` });
    setTetelekPage(1);
  };
  const setPreset = (tol, ig) => {
    setFilter({ datumTol: tol, datumIg: ig });
    setTetelekPage(1);
  };
  const [adat, setAdat] = useState({
    havi: [],
    jarmuvenkent: [],
    egyebNemKotott: { bevetel: 0, kiado: 0 },
    osszesen: {
      bevetel: 0,
      karbantartas: 0,
      uzemanyag: 0,
      biztositas: 0,
      egyeb: 0,
      ber: 0,
      kiadas: 0,
      netto: 0,
    },
  });

  // UX-audit (2026-07-20) — KPI %-delta: az előző, azonos hosszúságú
  // időszak összesítője (ld. koltsegInterface.php::getOsszesenGyors), hogy a
  // KPI-csempéken feltűnjön az irány/mérték, ne csak a nyers szám —
  // ugyanaz az elv, mint a Sidebar `PiaciArakPanel`-jének %-deltája.
  const [elozoOsszesen, setElozoOsszesen] = useState(null);

  const [kamionok, setKamionok] = useState([]);
  const [potkocsik, setPotkocsik] = useState([]);
  const [furgonok, setFurgonok] = useState([]);
  const [devizak, setDevizak] = useState([]);

  // Várható eredmény (Item 3) — ld. koltsegInterface.php getVarhatoEredmeny.
  // Független a fenti `filter` dátumtartománytól (mindig a "jövő hónapra"
  // vonatkozó, fix logikájú becslés), ezért csak egyszer töltjük be.
  const [varhato, setVarhato] = useState(null);
  useEffect(() => {
    fetchAction("getVarhatoEredmeny", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
    }).then((result) => {
      if (result?.success) setVarhato(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A Bevételek és Kiadások — korábban két külön táblázat — egy egységes
  // tétel-listát alkotnak, "Irány" jelvényoszloppal és a Mind/Bevétel/Kiadás
  // szegmens-kapcsolóval. A `kategoriaSzuro` UX-redesign (2026-07-18) óta
  // csak azokat az értékeket veheti fel, amik ténylegesen teljes egészében
  // az `egyeb_koltsegek` listából szűrhetők (ld. CategoryChip komment fent) —
  // "" (mind), "uzemanyag", "egyeb".
  const [tetelek, setTetelek] = useState([]);
  const [tetelekTotal, setTetelekTotal] = useState(0);
  const [tetelekPage, setTetelekPage] = useState(1);
  const [tetelekSearch, setTetelekSearch] = useState("");
  const [iranySzuro, setIranySzuro] = useState("mind"); // "mind" | "bevetel" | "kiado"
  const [kategoriaSzuro, setKategoriaSzuro] = useState(""); // "" | "uzemanyag" | "egyeb"
  // UX-audit (2026-07-20) — opt-in oszloprendezés a Tételek listához
  // (szerver oldali, ld. koltsegInterface.php::getEgyebKoltsegek `$sortKey`).
  const [tetelSortKey, setTetelSortKey] = useState(null);
  const [tetelSortDir, setTetelSortDir] = useState("desc");
  // Tétel↔Jármű kereszthivatkozás — egy Tétel sor rendszámára kattintva ez
  // az érték töltődik fel, a Jármű bontás DataTable `key`-eként is szolgál,
  // hogy a keresőmező mezeje ténylegesen újra-inicializálódjon minden egyes
  // kattintásnál (akkor is, ha ugyanarra a rendszámra kattintanak kétszer).
  const [jarmuKeresesPreset, setJarmuKeresesPreset] = useState("");
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
  // Jelvény a "NAV számlák" gombon — kizárólag a felhasználó UTOLSÓ manuális
  // lekérdezésének eredményét tükrözi (hány importálható tétel maradt), NEM
  // egy automatikus háttér-lekérdezésből jön. A NAV Online Számla integráció
  // szándékosan kézi jóváhagyós (ld. a modal fenti kommentje) — egy proaktív,
  // oldalbetöltéskori NAV-hívás ezt az elvet sértené, ezért amíg a
  // felhasználó nem kérdez le legalább egyszer ebben a munkamenetben, nincs
  // jelvény.
  const [navUjSzam, setNavUjSzam] = useState(0);

  // Bankszámla-kivonat import (fejlesztési javaslat, 2026-07-20) — ugyanaz a
  // "digest, admin dönt" minta, mint a NAV import fent: a CSV-elemzés
  // (`elemezBankImportCsv`) semmit nem ír az adatbázisba, csak javaslatot ad
  // soronként (összepárosítás egy meglévő tétellel / új tétel / kihagyás),
  // a tényleges alkalmazás (`alkalmazBankImport`) csak admin jóváhagyása
  // után fut. Nincs egyetlen "a" magyar banki CSV-formátum, ezért az
  // oszlop-hozzárendelést (melyik oszlop a dátum/összeg/közlemény) a
  // felhasználó a fejléc előnézete alapján, kézzel adja meg.
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankCsvSzoveg, setBankCsvSzoveg] = useState("");
  const [bankFejlec, setBankFejlec] = useState([]);
  const [bankOszlopok, setBankOszlopok] = useState({ datum: "", osszeg: "", kozlemeny: "" });
  const [bankElemzesLoading, setBankElemzesLoading] = useState(false);
  const [bankElemezve, setBankElemezve] = useState(false);
  const [bankSorok, setBankSorok] = useState([]);
  const [bankKihagyottSorSzam, setBankKihagyottSorSzam] = useState(0);
  const [bankMarFeldolgozottSorSzam, setBankMarFeldolgozottSorSzam] = useState(0);
  const [bankAlkalmazasLoading, setBankAlkalmazasLoading] = useState(false);

  // MOL üzemanyagkártya-tranzakció PDF import — a "Számla melléklet" nevű
  // MOL-dokumentumot dolgozza fel (nem magát a számlát). Ugyanaz a
  // "digest, admin dönt" minta, mint a Bank/NAV import fent, de a
  // MolTankolasInterface::elemezPdf()/alkalmaz() a `tankolasok` táblába ír,
  // NEM a Pénzforgalom `egyeb_koltsegek`-jébe — ld. az interface fájl fejléc-
  // kommentje a duplikáció elkerüléséről (a Pénzforgalom Üzemanyag-
  // összesítője a kettőt amúgy is összeadná).
  const [molModalOpen, setMolModalOpen] = useState(false);
  const [molElemzesLoading, setMolElemzesLoading] = useState(false);
  const [molElemezve, setMolElemezve] = useState(false);
  const [molSorok, setMolSorok] = useState([]);
  const [molKihagyottSorSzam, setMolKihagyottSorSzam] = useState(0);
  const [molAlkalmazasLoading, setMolAlkalmazasLoading] = useState(false);

  // A két ref sorszámozza a saját loaderük hívásait — a beérkező válasz
  // csak akkor alkalmazódik, ha még mindig ő a LEGUTÓBB elindított hívás.
  // Enélkül egy korábbi, lassabb hívás válasza felülírhatta egy később
  // elindított, gyorsabb hívás eredményét (pl. gyors gépelés a Tételek
  // keresőmezőbe, aminek NINCS debounce-a) — race condition, ld.
  // biztonsági/megbízhatósági audit. Ugyanez a mechanizmus a mentés utáni
  // direkt `loadOsszesito()`/`loadTetelek()` hívásokat is helyesen kezeli:
  // egy új hívás mindig felülírja/érvényteleníti az előzőt.
  const osszesitoReqId = useRef(0);
  const tetelekReqId = useRef(0);

  const loadOsszesito = () => {
    const reqId = ++osszesitoReqId.current;
    setLoading(true);
    fetchAction("getKoltsegOsszesito", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      ...filter,
    }).then((result) => {
      if (reqId !== osszesitoReqId.current) return;
      if (result?.success) {
        setAdat({
          havi: result.havi || [],
          jarmuvenkent: result.jarmuvenkent || [],
          egyebNemKotott: result.egyebNemKotott || { bevetel: 0, kiado: 0 },
          osszesen: result.osszesen,
        });
        setElozoOsszesen(result.elozoOsszesen || null);
      } else {
        toast.error(result?.message || "A pénzforgalmi összesítő betöltése sikertelen.");
      }
      setLoading(false);
    });
  };

  const loadTetelek = () => {
    const reqId = ++tetelekReqId.current;
    fetchAction("getEgyebKoltsegek", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
      ...filter,
      irany: iranySzuro === "mind" ? undefined : iranySzuro,
      kategoria: kategoriaSzuro || undefined,
      search: tetelekSearch || undefined,
      page: tetelekPage,
      pageSize: TETEL_PAGE_SIZE,
      sortKey: tetelSortKey || undefined,
      sortDir: tetelSortDir,
    }).then((result) => {
      if (reqId !== tetelekReqId.current) return;
      if (result?.success) {
        setTetelek(result.tetelek || []);
        setTetelekTotal(result.total ?? (result.tetelek || []).length);
      } else {
        setTetelekTotal(0);
        toast.error(result?.message || "A tételek betöltése sikertelen.");
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
  }, [filter, tetelekPage, tetelekSearch, iranySzuro, kategoriaSzuro, tetelSortKey, tetelSortDir]);

  const handleTetelSortChange = (key, dir) => {
    setTetelSortKey(key);
    setTetelSortDir(dir);
    setTetelekPage(1);
  };

  useEffect(() => {
    fetchAction("getKamionRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setKamionok(result.kamionok || []);
    });
    fetchAction("getPotkocsiRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setPotkocsik(result.potkocsik || []);
    });
    fetchAction("getFurgonRendszamok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setFurgonok(result.furgonok || []);
    });
    fetchAction("getNavSzamlaBeallitasokStatusz", {
      ceg_id: user.ceg_id,
      kerelmezo_id: user.id,
    }).then((result) => {
      if (result?.success) setNavVanBeallitva(!!result.van_beallitva);
    });
    fetchAction("getListaElemek", { id: user.ceg_id, tipus: "deviza" }).then((result) => {
      if (result?.success) setDevizak(result.elemek || []);
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
        // soronként felülbírálhatja a review-listában. Dátum szerint
        // csökkenő sorrend — a legutóbbi számla legyen legfelül, ne a
        // NAV válaszának saját (nem garantáltan rendezett) sorrendje.
        const tetelek = (result.tetelek || [])
          .map((t) => ({ ...t, kategoria: t.kategoria_javaslat || "" }))
          .sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
        setNavTetelek(tetelek);
        // Alapból minden ÚJ (még nem importált, forint-összeggel rendelkező)
        // tétel ki van pipálva — a felhasználó itt egyesével lemondhatja
        // azokat, amiket mégsem szeretne felvenni, jóváhagyás előtt.
        setNavKivalasztott(
          new Set(tetelek.filter((t) => t.importalhato).map((t) => t.szamlaszam)),
        );
        setNavLekerdezve(true);
        setNavUjSzam(tetelek.filter((t) => t.importalhato).length);
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
    const kivalasztottTetelek = navTetelek.filter((t) => navKivalasztott.has(t.szamlaszam));
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
        setNavUjSzam((prev) => Math.max(0, prev - kivalasztottTetelek.length));
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

  const openBankModal = () => {
    setBankModalOpen(true);
    setBankCsvSzoveg("");
    setBankFejlec([]);
    setBankOszlopok({ datum: "", osszeg: "", kozlemeny: "" });
    setBankElemezve(false);
    setBankSorok([]);
  };

  // Ugyanaz a `;`/`,` elválasztó-heurisztika, mint a backend
  // `BankImportInterface::parseCsv()`-jében — csak a fejléc előnézetéhez,
  // a tényleges soronkénti feldolgozás mindig a szerveren történik.
  const bankSorElvalasztva = (sor) => {
    const elvalaszto = (sor.match(/;/g) || []).length > (sor.match(/,/g) || []).length ? ";" : ",";
    return sor.split(elvalaszto).map((cella) => cella.trim().replace(/^"|"$/g, ""));
  };

  // UX-audit (2026-07-20) — a bank oszlop-hozzárendelés korábban minden
  // feltöltésnél nulláról indult, pedig egy admin havonta jellemzően
  // UGYANATTÓL a banktól tölt fel CSV-t, ugyanazokkal a fejléc-szövegekkel
  // (pl. "Dátum"/"Összeg"/"Közlemény") — ez Nielsen #6 (felismerés, ne
  // felidézés) direkt sértése volt. Az oszlop-INDEXEK nem stabilak
  // hónapról hónapra (egy bank export oszlopsorrendje változhat), a fejléc-
  // SZÖVEGEK viszont jellemzően igen — ezért nem az indexet, hanem a
  // kiválasztott oszlop fejléc-szövegét jegyezzük meg, cégenként
  // (`localStorage`), és egy új feltöltésnél a pontosan egyező fejléc-
  // szöveg alapján automatikusan újra kiválasztjuk az indexet.
  const bankOszlopMemoriaKulcs = `bankImportOszlopok_${user.ceg_id}`;

  const handleBankFajlValasztas = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const szoveg = String(reader.result || "");
      setBankCsvSzoveg(szoveg);
      const elsoSor = szoveg.split(/\r\n|\r|\n/)[0] || "";
      const fejlec = bankSorElvalasztva(elsoSor);
      setBankFejlec(fejlec);
      setBankElemezve(false);
      setBankSorok([]);

      try {
        const emlekezett = JSON.parse(localStorage.getItem(bankOszlopMemoriaKulcs) || "null");
        if (emlekezett) {
          const talalIndex = (label) => {
            const idx = fejlec.findIndex((cim) => cim === label);
            return idx >= 0 ? String(idx) : "";
          };
          setBankOszlopok({
            datum: talalIndex(emlekezett.datum),
            osszeg: talalIndex(emlekezett.osszeg),
            kozlemeny: emlekezett.kozlemeny ? talalIndex(emlekezett.kozlemeny) : "",
          });
        }
      } catch (err) {
        // ignore — sérült/hiányzó localStorage-bejegyzés esetén marad az üres, kézi kiválasztás
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleBankElemzes = async () => {
    if (bankOszlopok.datum === "" || bankOszlopok.osszeg === "") {
      toast.error("Válaszd ki legalább a dátum és az összeg oszlopát.");
      return;
    }
    setBankElemzesLoading(true);
    try {
      const result = await fetchAction("elemezBankImportCsv", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        csv: bankCsvSzoveg,
        oszlopok: {
          datum: Number(bankOszlopok.datum),
          osszeg: Number(bankOszlopok.osszeg),
          ...(bankOszlopok.kozlemeny !== "" ? { kozlemeny: Number(bankOszlopok.kozlemeny) } : {}),
        },
      });
      if (result?.success) {
        // Sikeres elemzés — a kiválasztott oszlopok fejléc-szövegét
        // megjegyezzük a következő feltöltéshez (ld. fenti komment).
        try {
          localStorage.setItem(
            bankOszlopMemoriaKulcs,
            JSON.stringify({
              datum: bankFejlec[Number(bankOszlopok.datum)] ?? "",
              osszeg: bankFejlec[Number(bankOszlopok.osszeg)] ?? "",
              kozlemeny: bankOszlopok.kozlemeny !== "" ? bankFejlec[Number(bankOszlopok.kozlemeny)] ?? "" : "",
            }),
          );
        } catch (err) {
          // ignore — a memória csak kényelmi funkció, hibája nem szabad megakassza az importot
        }
        // Alapból a javasolt párosítást fogadjuk el soronként, ha van — a
        // felhasználó ezt a review-listán bármikor "Új tétel"-re vagy
        // "Kihagyás"-ra válthatja, mielőtt alkalmazná.
        setBankSorok(
          (result.sorok || []).map((s) => ({ ...s, akcio: s.javasoltTetel ? "parosit" : "uj" })),
        );
        setBankKihagyottSorSzam(result.kihagyottSorSzam || 0);
        setBankMarFeldolgozottSorSzam(result.marFeldolgozottSorSzam || 0);
        setBankElemezve(true);
      } else {
        toast.error(result?.message || "A CSV elemzése sikertelen.");
      }
    } finally {
      setBankElemzesLoading(false);
    }
  };

  const changeBankSorAkcio = (hash, akcio) => {
    setBankSorok((prev) => prev.map((s) => (s.hash === hash ? { ...s, akcio } : s)));
  };

  const handleBankAlkalmazas = async () => {
    setBankAlkalmazasLoading(true);
    try {
      const result = await fetchAction("alkalmazBankImport", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        sorok: bankSorok,
      });
      if (result?.success) {
        const e = result.eredmeny;
        toast.success(
          `Kész: ${e.parositva} párosítva, ${e.ujTetel} új tétel, ${e.kihagyva} kihagyva${e.hiba ? `, ${e.hiba} hiba` : ""}.`,
        );
        setBankModalOpen(false);
        loadOsszesito();
        loadTetelek();
      } else {
        toast.error(result?.message || "Az alkalmazás sikertelen.");
      }
    } finally {
      setBankAlkalmazasLoading(false);
    }
  };

  const openMolModal = () => {
    setMolModalOpen(true);
    setMolElemezve(false);
    setMolSorok([]);
    setMolKihagyottSorSzam(0);
  };

  const handleMolFajlValasztas = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMolElemzesLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      // "data:application/pdf;base64,XXXX" — a szerver csak a nyers
      // base64-tartalmat várja, a data-URL fejlécet levágjuk.
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1] || "";
      try {
        const result = await fetchAction("elemezMolTankolasPdf", {
          ceg_id: user.ceg_id,
          kerelmezo_id: user.id,
          pdf: base64,
        });
        if (result?.success) {
          // Alapból csak a felismert rendszámú (jármühöz köthető) és még
          // nem importált sorok vannak bepipálva — a fel nem ismert
          // rendszámúakat az admin a jármű kézi kiválasztása UTÁN maga
          // pipálja be, hogy véletlenül ne kerüljön be jármű nélküli sor.
          setMolSorok(
            (result.sorok || []).map((s) => ({
              ...s,
              betoltendo: !s.marImportalva && !!s.jarmuId,
            })),
          );
          setMolKihagyottSorSzam(result.kihagyottSorSzam || 0);
          setMolElemezve(true);
        } else {
          toast.error(result?.message || "A PDF elemzése sikertelen.");
        }
      } finally {
        setMolElemzesLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const changeMolSorBetoltendo = (molSlipId, betoltendo) => {
    setMolSorok((prev) => prev.map((s) => (s.molSlipId === molSlipId ? { ...s, betoltendo } : s)));
  };

  const changeMolSorJarmu = (molSlipId, ertek) => {
    const [jarmuTipus, jarmuId] = ertek ? ertek.split(":") : [null, null];
    setMolSorok((prev) =>
      prev.map((s) =>
        s.molSlipId === molSlipId
          ? { ...s, jarmuTipus: jarmuTipus || null, jarmuId: jarmuId || null, betoltendo: !!jarmuId }
          : s,
      ),
    );
  };

  const handleMolAlkalmazas = async () => {
    setMolAlkalmazasLoading(true);
    try {
      const result = await fetchAction("alkalmazMolTankolas", {
        ceg_id: user.ceg_id,
        kerelmezo_id: user.id,
        sorok: molSorok,
      });
      if (result?.success) {
        const e = result.eredmeny;
        toast.success(
          `Kész: ${e.sikeres} tankolás rögzítve${e.marVolt ? `, ${e.marVolt} már korábban importálva volt` : ""}${
            e.hiba ? `, ${e.hiba} hiba` : ""
          }.`,
        );
        setMolModalOpen(false);
      } else {
        toast.error(result?.message || "Az alkalmazás sikertelen.");
      }
    } finally {
      setMolAlkalmazasLoading(false);
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
      ...(name === "kamion_id" && value ? { potkocsi_id: "", furgon_id: "" } : {}),
      ...(name === "potkocsi_id" && value ? { kamion_id: "", furgon_id: "" } : {}),
      ...(name === "furgon_id" && value ? { kamion_id: "", potkocsi_id: "" } : {}),
    }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const devizas = ujTetel.deviza && ujTetel.deviza !== "HUF";
    if (!ujTetel.datum || !ujTetel.megnevezes.trim()) {
      toast.error("Add meg a dátumot és a megnevezést!");
      return;
    }
    if (devizas ? !ujTetel.eredeti_osszeg : !ujTetel.osszeg) {
      toast.error(devizas ? "Add meg az eredeti (deviza) összeget!" : "Add meg az összeget!");
      return;
    }
    setIsSaving(true);
    try {
      // Szerkesztéskor (`editingTetelId`) ugyanez a form egy meglévő tételt
      // frissít, nem újat hoz létre — elsősorban azért kellett, hogy egy NAV
      // Online Számlából importált tételhez (aminek importáláskor nincs
      // kamion_id/potkocsi_id-je) utólag hozzá lehessen rendelni egy
      // járművet, de bármelyik mezője szerkeszthető vele.
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
        // Devizás tételnél az `osszeg`-et a backend maga számítja ki
        // (resolveDevizaOsszeg, aznapi MNB-árfolyamon) — a `0` itt csak a
        // kötelező paraméter kitöltése, ténylegesen figyelmen kívül marad.
        osszeg: devizas ? 0 : ujTetel.osszeg,
        deviza: ujTetel.deviza || "HUF",
        eredeti_osszeg: devizas ? ujTetel.eredeti_osszeg : null,
        kamion_id: ujTetel.kamion_id || null,
        potkocsi_id: ujTetel.potkocsi_id || null,
        furgon_id: ujTetel.furgon_id || null,
        megjegyzes: ujTetel.megjegyzes.trim() || null,
      });
      if (result?.success) {
        toast.success(result.message || (editingTetelId ? "Tétel frissítve." : "Tétel rögzítve."));
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

  // UX-redesign (2026-07-18): egyetlen elsődleges "+ Új tétel" gomb (a
  // korábbi, egyenrangú súlyú "Bevétel"/"Kiadás" gombpár helyett) — az
  // irányt a modálon belüli kapcsoló dönti el, alapból "Kiadás" (ez a
  // gyakoribb eset).
  const openAdding = () => {
    setEditingTetelId(null);
    setUjTetel(emptyEgyebTetel("kiado"));
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
      deviza: row.deviza || "HUF",
      eredeti_osszeg: row.eredeti_osszeg || "",
      kamion_id: row.kamion_id || "",
      potkocsi_id: row.potkocsi_id || "",
      furgon_id: row.furgon_id || "",
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

  const changeIranySzuro = (kulcs) => {
    setIranySzuro(kulcs);
    setTetelekPage(1);
  };

  const changeKategoriaSzuro = (kulcs) => {
    setKategoriaSzuro(kulcs);
    setTetelekPage(1);
  };

  // Jármű szerinti bontás — a képernyőn csak a döntésre releváns 4 oszlop
  // (Rendszám, Bevétel, Kiadás összesen, Nettó); a 4 kiadás-alkategória
  // (Karbantartás/Üzemanyag/Biztosítás/Egyéb) már megvan a fenti kategória-
  // összegzőn — a teljes bontás Excel-exportban marad meg (`exportColumns`,
  // változatlanul). A "Típus" oszlop helyett egy ikon jelzi kamion/pótkocsi
  // mivoltát a rendszám mellett, külön oszlop nélkül.
  const columns = [
    {
      key: "rendszam",
      label: "Rendszám",
      className: "font-semibold text-brand-900 dark:text-ink-50",
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-2">
          {row.tipus === "kamion" ? (
            <PiTruckLight className="h-4 w-4 flex-shrink-0 text-ink-400 dark:text-ink-500" />
          ) : row.tipus === "furgon" ? (
            <PiVanLight className="h-4 w-4 flex-shrink-0 text-ink-400 dark:text-ink-500" />
          ) : (
            <PiTruckTrailerLight className="h-4 w-4 flex-shrink-0 text-ink-400 dark:text-ink-500" />
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
      sortable: true,
      render: (row) => formatHuf(row.bevetel),
    },
    {
      key: "kiadasOsszesen",
      label: "Kiadás összesen",
      align: "right",
      className: "tabular-nums",
      sortable: true,
      render: (row) => formatHuf(row.kiadasOsszesen),
    },
    {
      key: "netto",
      label: "Nettó",
      align: "right",
      className: "font-semibold tabular-nums",
      sortable: true,
      render: (row) => (
        <span className={row.netto >= 0 ? "text-emerald-600" : "text-red-600"}>
          {formatHuf(row.netto)}
        </span>
      ),
    },
    {
      key: "bevetelPerKm",
      label: "Bevétel/km",
      align: "right",
      className: "tabular-nums",
      mobileHidden: true,
      sortable: true,
      sortValue: (row) => row.bevetelPerKm,
      render: (row) => <PerKmErtek ertek={row.bevetelPerKm} lefedettseg={row.kmLefedettseg} />,
    },
    {
      key: "kiadasPerKm",
      label: "Kiadás/km",
      align: "right",
      className: "tabular-nums",
      // UX-audit (2026-07-20): korábban mobilon is rejtett volt — ez a
      // legjobb flotta-összehasonlító mutató (egy nagy kamion és egy kis
      // furgon nyers kiadása nem összevethető, a Ft/km igen), ezért mostantól
      // a mobil kártyanézetben is megjelenik; a Bevétel/km marad csak
      // asztali/export-nézetben, hogy a kártya ne zsúfolódjon túl.
      sortable: true,
      sortValue: (row) => row.kiadasPerKm,
      render: (row) => <PerKmErtek ertek={row.kiadasPerKm} lefedettseg={row.kmLefedettseg} />,
    },
  ];

  const exportColumns = [
    { key: "rendszam", label: "Rendszám" },
    {
      key: "tipus",
      label: "Típus",
      exportValue: (row) =>
        row.tipus === "kamion" ? "Kamion" : row.tipus === "furgon" ? "Furgon" : "Pótkocsi",
    },
    { key: "bevetel", label: "Bevétel (Ft)" },
    { key: "karbantartas", label: "Karbantartás (Ft)" },
    { key: "uzemanyag", label: "Üzemanyag (Ft)" },
    { key: "biztositas", label: "Biztosítás (Ft)" },
    { key: "egyeb", label: "Egyéb (Ft)" },
    { key: "kiadasOsszesen", label: "Kiadás összesen (Ft)" },
    { key: "netto", label: "Nettó (Ft)" },
    { key: "bevetelPerKm", label: "Bevétel/km (Ft)", exportValue: (row) => row.bevetelPerKm ?? "" },
    { key: "kiadasPerKm", label: "Kiadás/km (Ft)", exportValue: (row) => row.kiadasPerKm ?? "" },
    {
      key: "kmLefedettseg",
      label: "Km-adat lefedettsége (%)",
      exportValue: (row) => row.kmLefedettseg ?? "",
    },
  ];

  // Az egykor külön Bevételek/Kiadások táblázat mostantól egy közös lista —
  // az "Irány" oszlop jelzi, melyik sor melyik irányba tartozik.
  const egyebTetelColumns = [
    { key: "datum", label: "Dátum", sortable: true },
    {
      key: "irany",
      label: "Irány",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            row.irany === "bevetel" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
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
      className: "font-semibold text-brand-900 dark:text-ink-50",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span>{row.megnevezes}</span>
          {row.kategoria && KATEGORIA_BADGE[row.kategoria] && (
            <span
              className={`inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${KATEGORIA_BADGE[row.kategoria].className}`}
              title={`${KATEGORIA_BADGE[row.kategoria].label} kategóriába sorolva`}
            >
              {KATEGORIA_BADGE[row.kategoria].label}
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
      sortable: true,
      render: (row) => (
        <span className={row.irany === "bevetel" ? "text-emerald-600" : "text-red-600"}>
          <span className="inline-flex items-center gap-1">
            {formatHuf(row.osszeg)}
            {row.bank_parositva === "I" && (
              <PiCheckCircleLight
                className="h-3.5 w-3.5 flex-shrink-0 text-ink-400 dark:text-ink-500"
                title="Bank-igazolva — valós banki tranzakcióval párosítva"
              />
            )}
          </span>
          {row.deviza && row.deviza !== "HUF" && row.eredeti_osszeg && (
            <span className="block text-xs font-normal text-ink-400 dark:text-ink-500">
              {formatDeviza(row.eredeti_osszeg, row.deviza)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "rendszam",
      label: "Jármű",
      // UX-audit (2026-07-20): korábban nem volt kereszthivatkozás a Tétel
      // sor és a "Jármű szerinti bontás" fül azonos rendszáma közt — egy
      // furcsán magas összegű tételnél a felhasználónak kézzel kellett
      // átváltania fülre és megkeresnie ugyanazt a rendszámot. Kattintásra a
      // Jármű bontás fül nyílik meg, a keresőmezője előre kitöltve a
      // rendszámmal (ld. `jarmuKeresesPreset` + a Jármű bontás DataTable
      // `key`-e, ami a preset változásakor újra-mountolja a mezőt).
      render: (row) =>
        row.rendszam ? (
          <button
            type="button"
            onClick={() => {
              setJarmuKeresesPreset(row.rendszam);
              setActiveTab("jarmuvenkent");
            }}
            className="text-brand-600 hover:underline dark:text-brand-400"
          >
            {row.rendszam}
          </button>
        ) : (
          "—"
        ),
    },
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
      // A MOL tankolás-importból származó sorok (ld. `forras: "tankolas"`,
      // koltsegInterface.php::getMolTankolasTetelek) NEM szerkeszthetők/
      // törölhetők ezzel a form-mal — más táblából (`tankolasok`) jönnek,
      // más elsődleges kulcs-térrel, az `updateEgyebKoltseg`/
      // `deleteEgyebKoltseg` akció rájuk hívva vagy hibázna, vagy (rosszabb
      // esetben) egy véletlenül egyező id-jű, teljesen más `egyeb_koltsegek`
      // sort módosítana. Helyettük egy tájékoztató jelvény jelzi az eredetet.
      render: (row) =>
        row.forras === "tankolas" ? (
          <span
            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-400 dark:bg-ink-800 dark:text-ink-500"
            title="Ez a sor a MOL tankolás-importból származik — a Tankolás modulban szerkeszthető, itt nem"
          >
            Tankolás
          </span>
        ) : (
          <div className="flex justify-end gap-1">
            <ActionIcon icon={<PiPencilSimpleLight />} onClick={() => openEditing(row)} title="Szerkesztés" />
            <ActionIcon icon={<PiTrashLight />} danger onClick={() => handleDeleteTetel(row.id)} title="Törlés" />
          </div>
        ),
    },
  ];
  const egyebTetelExportColumns = [
    { key: "datum", label: "Dátum" },
    { key: "irany", label: "Irány", exportValue: (row) => (row.irany === "bevetel" ? "Bevétel" : "Kiadás") },
    { key: "megnevezes", label: "Megnevezés" },
    { key: "osszeg", label: "Összeg (Ft)" },
    { key: "deviza", label: "Deviza" },
    { key: "eredeti_osszeg", label: "Eredeti összeg" },
    { key: "rendszam", label: "Jármű" },
    { key: "szamlaszam", label: "Számlaszám" },
    { key: "megjegyzes", label: "Megjegyzés" },
  ];

  const kategoriaChipek = [
    {
      key: "karbantartas",
      label: "Karbantartás",
      icon: PiWrenchLight,
      dotClass: "bg-brand-500",
      barClass: "bg-brand-500",
      value: adat.osszesen.karbantartas,
    },
    {
      key: "uzemanyag",
      label: "Üzemanyag",
      icon: PiGasPumpLight,
      dotClass: "bg-amber-500",
      barClass: "bg-amber-500",
      value: adat.osszesen.uzemanyag,
    },
    {
      key: "biztositas",
      label: "Biztosítás",
      icon: PiShieldCheckLight,
      dotClass: "bg-purple-500",
      barClass: "bg-purple-500",
      value: adat.osszesen.biztositas,
    },
    {
      key: "egyeb",
      label: "Egyéb kiadás",
      icon: PiReceiptLight,
      dotClass: "bg-yellow-500",
      barClass: "bg-yellow-500",
      value: adat.osszesen.egyeb,
    },
    // A bérezés (Item 2: havi bérezés → Pénzforgalom kiadás) csak adminnak
    // látszik — ld. koltsegInterface.php getKoltsegOsszesito `$isAdmin`
    // kapuzása, ami nem-admin hívónak eleve 0-t ad vissza `osszesen.ber`-re.
    ...(isOwnerAdmin
      ? [
          {
            key: "ber",
            label: "Fizetés",
            icon: PiWalletLight,
            dotClass: "bg-orange-500",
            barClass: "bg-orange-500",
            value: adat.osszesen.ber,
          },
        ]
      : []),
  ];

  // Figyelem-sáv — kizárólag a már betöltött `varhato` becslésből (nincs
  // hozzá új backend-hívás). Szándékosan NEM tartalmaz kintlévőség-/
  // fizetési-határidő-alapú jelzést — ehhez nincs megbízható adatforrás
  // (ld. CLAUDE.md "Removed: Fuvarok / Fuvartervező modulok").
  const figyelmeztetesek = [];
  if (varhato && varhato.varhatoEredmeny < 0) {
    figyelmeztetesek.push({
      key: "negativ-varhato",
      text: (
        <>
          Következő hónapra <b>negatív várható eredmény</b> becsült ({formatHuf(varhato.varhatoEredmeny)}).
        </>
      ),
    });
  }
  if (varhato && varhato.tervezettKarbantartasTetelSzam > 0) {
    figyelmeztetesek.push({
      key: "tervezett-karbantartas",
      text: (
        <>
          <b>{varhato.tervezettKarbantartasTetelSzam} tervezett karbantartás</b> várható, becsült
          összesen {formatHuf(varhato.tervezettKarbantartas)}.
        </>
      ),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        eyebrow="Pénzügyek"
        title="Pénzforgalom"
        className="mb-0"
        action={
          <PeriodControl
            filter={filter}
            onPreset={setPreset}
            onFieldChange={handleFilterChange}
            displayedYear={displayedYear}
            onChangeYear={changeYear}
          />
        }
      />

      {loading ? (
        <Spinner wrapperClassName="flex justify-center py-16" />
      ) : (
        <>
          {/* KPI-sor — EGYETLEN hiteles hely a Bevétel/Kiadás/Nettó/Várható
              eredmény számokra. A "Várható eredmény" korábban egy külön,
              teljes szélességű sávban élt a KPI-sor alatt — felhasználói
              kérésre most a sorba került, negyedik csempeként, hogy a 4
              legfontosabb szám egy pillantásra, egymás mellett látszódjon.
              A csempe caption-je a korábbi sáv "N havi átlag" részletét
              tartja meg tömören (a "Fix költségek"/"tervezett karbantartás"
              részlet a lenti Figyelem-sávban jelenik meg, ha releváns).
              `layout="row"` — ugyanaz a KPI-csempe minta, amit a
              Dashboard/Flottakövetés is használ. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CardStats
              statSubtitle="Bevétel"
              statTitle={formatHuf(adat.osszesen.bevetel)}
              statCaption={
                elozoOsszesen ? (
                  <KpiDelta current={adat.osszesen.bevetel} previous={elozoOsszesen.bevetel} higherIsBetter />
                ) : undefined
              }
              statIcon={PiTrendUpLight}
              tone="positive"
              layout="row"
            />
            <CardStats
              statSubtitle="Kiadás"
              statTitle={formatHuf(adat.osszesen.kiadas)}
              statCaption={
                elozoOsszesen ? (
                  <KpiDelta current={adat.osszesen.kiadas} previous={elozoOsszesen.kiadas} higherIsBetter={false} />
                ) : undefined
              }
              statIcon={PiCoinsLight}
              tone="neutral"
              layout="row"
            />
            <CardStats
              statSubtitle="Nettó"
              statTitle={formatHuf(adat.osszesen.netto)}
              statCaption={
                elozoOsszesen ? (
                  <KpiDelta current={adat.osszesen.netto} previous={elozoOsszesen.netto} higherIsBetter />
                ) : undefined
              }
              statIcon={PiWalletLight}
              tone={adat.osszesen.netto >= 0 ? "positive" : "danger"}
              layout="row"
            />
            <CardStats
              statSubtitle="Várható eredmény (jövő hónap)"
              statTitle={varhato ? formatHuf(varhato.varhatoEredmeny) : "—"}
              statCaption={varhato ? `${varhato.honapokSzama} havi átlag alapján` : undefined}
              statIcon={PiTrendUpLight}
              tone={varhato && varhato.varhatoEredmeny < 0 ? "danger" : "neutral"}
              layout="row"
            />
          </div>

          {/* Figyelem-sáv — csak akkor jelenik meg, ha van mit mondania. */}
          {figyelmeztetesek.length > 0 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-soft dark:border-amber-900 dark:bg-amber-950/40 sm:p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                <PiWarningCircleLight className="h-4 w-4" />
                Figyelem
              </p>
              <ul className="mt-2 space-y-1.5">
                {figyelmeztetesek.map((f) => (
                  <li key={f.key} className="text-sm text-amber-900 dark:text-amber-200">
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Fülek — UX-redesign (2026-07-18): a korábbi, egymás alá görgetett
              Tételek / grafikon / Jármű szerinti bontás hármas most fülre
              kattintva váltakozik, teljes szélességben (nem egy 300px-es
              kabinba préselve) — az adat mindhárom fülhöz már betöltve van
              (`adat`/`tetelek`), a váltás nem indít új kérést.
              UX-audit (2026-07-20): mobilon `sticky` — hosszú Tételek lista
              görgetésekor korábban a fülváltó eltűnt a képernyő tetejéről,
              vissza kellett görgetni egy fülváltáshoz. Asztalon (`md:`)
              változatlanul statikus marad, ott ez sosem volt probléma. */}
          <div className="sticky top-0 z-10 -mx-4 bg-slate-50 px-4 pb-2 pt-1 dark:bg-ink-950 md:static md:z-auto md:mx-0 md:bg-transparent md:px-0 md:py-0">
            <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors duration-150 ${
                    activeTab === t.key
                      ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                      : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "tetelek" && (
            <>
              {/* Kiadás-összetétel — UX-audit (2026-07-20): korábban minden
                  fülön megjelent (a fülváltó ALATT, a fül-tartalom feltételén
                  KÍVÜL renderelve), a "Havi alakulás" fülön tiszta duplikáció
                  volt az alatta lévő stacked bar grafikonnal (ugyanaz az 5
                  kategória, csak időben nem bontva). Most kizárólag a Tételek
                  fülön jelenik meg, ahol tényleges kontextust ad az alatta
                  lévő listához. */}
              <div
                className={`grid grid-cols-2 gap-2 rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800 ${
                  isOwnerAdmin ? "sm:grid-cols-5" : "sm:grid-cols-4"
                }`}
              >
                {kategoriaChipek.map((chip) => (
                  <CategoryChip
                    key={chip.key}
                    icon={chip.icon}
                    label={chip.label}
                    value={chip.value}
                    dotClass={chip.dotClass}
                  />
                ))}
              </div>

              {/* Szűrősor — az egyetlen elsődleges akció ("+ Új tétel") és a
                  valódi (teljes egészében listaszűrhető) kategória-szűrő itt,
                  közvetlenül a táblázat felett. A "NAV számlák" másodlagos
                  (körvonalas) stílusú, nem versenyez az elsődleges gombbal. */}
              <div className="flex flex-wrap items-center gap-2 pr-16 md:pr-0">
                <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1 dark:bg-ink-800">
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
                          ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                          : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <select
                  value={kategoriaSzuro}
                  onChange={(e) => changeKategoriaSzuro(e.target.value)}
                  className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-600 shadow-soft focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
                  title="Kategória szerinti szűrés — csak a listában ténylegesen jelölt tételekre"
                >
                  <option value="">Minden kategória</option>
                  <option value="uzemanyag">Üzemanyag</option>
                  <option value="egyeb">Egyéb kiadás</option>
                  {/* UX-audit (2026-07-20): a fenti kategória-összetétel rács
                      Karbantartás/Biztosítás/Fizetés kategóriát is mutat, de
                      azok értéke MÁS táblákból (karbantartási rekordok, jármű
                      biztosítási mezői, sofőr-bérek) számítódik, nem erről a
                      listáról szűrhető vissza — enélkül a felhasználó
                      megpróbálná kiválasztani, nem találná, és hibának hinné.
                      Letiltott opcióként mutatjuk, magyarázó title-lel, hogy a
                      hiány indoklása a felfedezés pillanatában érkezzen. */}
                  <option value="karbantartas" disabled title="A Karbantartások oldalon szűrhető, nem itt">
                    Karbantartás (a Karbantartások oldalon szűrhető)
                  </option>
                  <option value="biztositas" disabled title="A jármű adatlapján szűrhető, nem itt">
                    Biztosítás (a jármű adatlapján szűrhető)
                  </option>
                  {isOwnerAdmin && (
                    <option value="ber" disabled title="A Sofőrök oldalon szűrhető, nem itt">
                      Fizetés (a Sofőrök oldalon szűrhető)
                    </option>
                  )}
                </select>
                <ImportMenu
                  navUjSzam={navUjSzam}
                  onNav={openNavModal}
                  navTitle={navVanBeallitva ? undefined : "A NAV-kapcsolat még nincs beállítva — lásd Beállítások"}
                  onBank={openBankModal}
                  onMol={openMolModal}
                />
                <button
                  type="button"
                  onClick={openAdding}
                  className="ml-auto flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-soft transition-all duration-300 ease-fluid hover:bg-brand-700 active:scale-95"
                >
                  <PiPlusLight className="h-4 w-4" /> Új tétel
                </button>
              </div>

              <DataTable
                icon={PiReceiptLight}
                title="Tételek"
                exportFilename="penzforgalom_tetelek"
                exportColumns={egyebTetelExportColumns}
                columns={egyebTetelColumns}
                rows={tetelek}
                mobileTitleKey="megnevezes"
                emptyLabel="Nincs a szűrésnek megfelelő tétel"
                searchable
                searchPlaceholder="Keresés a tételek közt..."
                serverSide
                totalRows={tetelekTotal}
                page={tetelekPage}
                pageSize={TETEL_PAGE_SIZE}
                onPageChange={setTetelekPage}
                onSearchChange={setTetelekSearch}
                onExportAll={handleTetelekExportAll}
                sortKey={tetelSortKey}
                sortDir={tetelSortDir}
                onSortChange={handleTetelSortChange}
              />
            </>
          )}

          {activeTab === "jarmuvenkent" && (
            <DataTable
              key={jarmuKeresesPreset}
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
              initialSearch={jarmuKeresesPreset}
              pageSize={8}
            />
          )}

          {activeTab === "chart" && (
            <div className="rounded-3xl bg-white p-4 shadow-soft ring-1 ring-ink-100 dark:bg-ink-900 dark:ring-ink-800 sm:p-6">
              {adat.havi.length === 0 ? (
                <p className="py-16 text-center text-sm text-ink-400 dark:text-ink-500">
                  Nincs megjeleníthető adat ebben az időszakban.
                </p>
              ) : (
                <CashflowChart havi={adat.havi} isAdmin={isOwnerAdmin} />
              )}
            </div>
          )}
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
            : "Új tétel"
        }
      >
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {/* Irány-kapcsoló a modálon belül — a korábbi, a fejlécben élő
              külön "Bevétel"/"Kiadás" gombpár helyett egyetlen belépési
              pont ("+ Új tétel"), a döntés itt történik. */}
          <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1 dark:bg-ink-800 w-fit">
            {[
              { key: "kiado", label: "Kiadás" },
              { key: "bevetel", label: "Bevétel" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setUjTetel((prev) => ({ ...prev, irany: opt.key }))}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                  ujTetel.irany === opt.key
                    ? "bg-white text-brand-700 shadow-soft dark:bg-ink-700 dark:text-brand-300"
                    : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <FormSection columns={3}>
            <FormField
              type="date"
              label="Dátum"
              name="datum"
              value={ujTetel.datum}
              onChange={handleUjTetelChange}
              required
            />
            <FormField as="select" label="Deviza" name="deviza" value={ujTetel.deviza} onChange={handleUjTetelChange}>
              {devizak.map((d) => (
                <option key={d.kulcs} value={d.kulcs}>
                  {d.kulcs}
                </option>
              ))}
            </FormField>
            {ujTetel.deviza && ujTetel.deviza !== "HUF" ? (
              <FormField
                type="number"
                label={`Eredeti összeg (${ujTetel.deviza})`}
                name="eredeti_osszeg"
                value={ujTetel.eredeti_osszeg}
                onChange={handleUjTetelChange}
                required
              />
            ) : (
              <FormField
                type="number"
                label="Összeg (Ft)"
                name="osszeg"
                value={ujTetel.osszeg}
                onChange={handleUjTetelChange}
                required
              />
            )}
          </FormSection>
          {ujTetel.deviza && ujTetel.deviza !== "HUF" && (
            <p className="-mt-2 text-xs text-ink-400 dark:text-ink-500">
              A forint-egyenérték a rögzítés pillanatában érvényes MNB-árfolyamon, automatikusan
              számítódik.
            </p>
          )}
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
              <option value="">Kiadás</option>
              <option value="uzemanyag">Üzemanyag</option>
              <option value="karbantartas">Karbantartás</option>
              <option value="biztositas">Biztosítás</option>
              {isOwnerAdmin && <option value="ber">Fizetés</option>}
            </FormField>
          )}
          <FormField
            label="Számlaszám (opcionális)"
            name="szamlaszam"
            value={ujTetel.szamlaszam}
            onChange={handleUjTetelChange}
            placeholder="pl. a NAV Online Számla azonosítója"
          />
          <FormSection columns={3}>
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
            <FormField
              as="select"
              label="Furgon (opcionális)"
              name="furgon_id"
              value={ujTetel.furgon_id}
              onChange={handleUjTetelChange}
            >
              <option value="">Nincs hozzárendelve</option>
              {furgonok.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.rendszam}
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
              className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
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
          <p className="text-sm text-ink-500 dark:text-ink-400">
            A NAV Online Számla kapcsolat még nincs beállítva ehhez a céghez. Állítsd be a{" "}
            <span className="font-semibold text-ink-700 dark:text-ink-200">Beállítások</span> oldalon (technikai
            felhasználó adatai), utána itt lekérdezhetők a számlák.
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
                  <p className="py-6 text-center text-sm text-ink-400 dark:text-ink-500">
                    Nincs számla a NAV-nál ebben az időszakban.
                  </p>
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-xl border border-ink-100 dark:border-ink-800">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-ink-400 dark:bg-ink-800 dark:text-ink-500">
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
                          <tr key={t.szamlaszam} className="border-t border-ink-100 dark:border-ink-800">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={navKivalasztott.has(t.szamlaszam)}
                                disabled={!t.importalhato}
                                onChange={() => toggleNavTetel(t.szamlaszam)}
                                className="h-4 w-4 rounded border-ink-300 accent-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-600"
                              />
                            </td>
                            <td className="px-3 py-2 font-medium text-ink-700 dark:text-ink-200">{t.szamlaszam}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  t.irany === "bevetel"
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                                }`}
                              >
                                {t.irany === "bevetel" ? "Bevétel" : "Kiadás"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-ink-500 dark:text-ink-400">{t.datum}</td>
                            <td className="px-3 py-2 text-ink-500 dark:text-ink-400">{t.partner_nev || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ink-700 dark:text-ink-200">
                              {t.osszeg_huf !== null ? formatHuf(t.osszeg_huf) : "—"}
                              {t.penznem && t.penznem !== "HUF" && (
                                <span className="ml-1 text-xs text-ink-400 dark:text-ink-500">({t.penznem})</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {t.irany === "kiado" ? (
                                <select
                                  value={t.kategoria || ""}
                                  onChange={(e) => changeNavKategoria(t.szamlaszam, e.target.value)}
                                  disabled={t.mar_importalva || t.mol_tankolasbol_fedve}
                                  className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
                                >
                                  <option value="">Kiadás</option>
                                  <option value="uzemanyag">Üzemanyag</option>
                                  <option value="karbantartas">Karbantartás</option>
                                  <option value="biztositas">Biztosítás</option>
                                </select>
                              ) : (
                                <span className="text-ink-400 dark:text-ink-500">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-ink-400 dark:text-ink-500">
                              {t.mar_importalva
                                ? "Már importálva"
                                : t.mol_tankolasbol_fedve
                                  ? "Már fedve (MOL tankolás import)"
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
                    className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
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

      <Modal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        title="Bankszámla-kivonat import"
        maxWidth="max-w-5xl"
      >
        <div className="space-y-4">
          {!bankElemezve && (
            <>
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Töltsd fel a bankod CSV-exportját — a rendszer megjelöli a hozzá kiválasztott
                oszlopok alapján a már rögzített tételekkel valószínűleg egyező sorokat, a többit
                pedig új tételként ajánlja fel. Semmi nem kerül be a Pénzforgalomba, amíg a
                következő lépésben jóvá nem hagyod.
              </p>
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-ink-600 shadow-soft ring-1 ring-ink-200 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300">
                  <PiFileArrowUpLight className="h-4 w-4" />
                  CSV fájl kiválasztása
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleBankFajlValasztas} />
                </label>
              </div>

              {bankFejlec.length > 0 && (
                <>
                  <FormSection columns={3}>
                    <FormField
                      as="select"
                      label="Dátum oszlopa"
                      value={bankOszlopok.datum}
                      onChange={(e) => setBankOszlopok((prev) => ({ ...prev, datum: e.target.value }))}
                    >
                      <option value="">Válassz oszlopot</option>
                      {bankFejlec.map((cim, idx) => (
                        <option key={idx} value={idx}>
                          {cim || `${idx + 1}. oszlop`}
                        </option>
                      ))}
                    </FormField>
                    <FormField
                      as="select"
                      label="Összeg oszlopa"
                      value={bankOszlopok.osszeg}
                      onChange={(e) => setBankOszlopok((prev) => ({ ...prev, osszeg: e.target.value }))}
                    >
                      <option value="">Válassz oszlopot</option>
                      {bankFejlec.map((cim, idx) => (
                        <option key={idx} value={idx}>
                          {cim || `${idx + 1}. oszlop`}
                        </option>
                      ))}
                    </FormField>
                    <FormField
                      as="select"
                      label="Közlemény oszlopa (opcionális)"
                      value={bankOszlopok.kozlemeny}
                      onChange={(e) => setBankOszlopok((prev) => ({ ...prev, kozlemeny: e.target.value }))}
                    >
                      <option value="">Nincs</option>
                      {bankFejlec.map((cim, idx) => (
                        <option key={idx} value={idx}>
                          {cim || `${idx + 1}. oszlop`}
                        </option>
                      ))}
                    </FormField>
                  </FormSection>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleBankElemzes}
                      disabled={bankElemzesLoading}
                      className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {bankElemzesLoading ? "Elemzés..." : "Elemzés"}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {bankElemezve && (
            <>
              {(bankMarFeldolgozottSorSzam > 0 || bankKihagyottSorSzam > 0) && (
                <p className="text-xs text-ink-400 dark:text-ink-500">
                  {bankMarFeldolgozottSorSzam > 0 &&
                    `${bankMarFeldolgozottSorSzam} sor egy korábbi importból már fel van dolgozva, ezért nem jelenik meg újra. `}
                  {bankKihagyottSorSzam > 0 && `${bankKihagyottSorSzam} sort nem sikerült értelmezni (hiányos dátum/összeg).`}
                </p>
              )}

              {bankSorok.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400 dark:text-ink-500">
                  Nincs feldolgozható, még ismeretlen sor ebben a fájlban.
                </p>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-xl border border-ink-100 dark:border-ink-800">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-ink-400 dark:bg-ink-800 dark:text-ink-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Dátum</th>
                        <th className="px-3 py-2 text-right">Összeg</th>
                        <th className="px-3 py-2 text-left">Közlemény</th>
                        <th className="px-3 py-2 text-left">Döntés</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankSorok.map((s) => (
                        <tr key={s.hash} className="border-t border-ink-100 align-top dark:border-ink-800">
                          <td className="px-3 py-2 text-ink-500 dark:text-ink-400">{s.datum}</td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums font-medium ${
                              s.osszeg >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                            }`}
                          >
                            {formatHuf(s.osszeg)}
                          </td>
                          <td className="max-w-xs truncate px-3 py-2 text-ink-500 dark:text-ink-400" title={s.kozlemeny}>
                            {s.kozlemeny || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-1">
                              {s.javasoltTetel && (
                                <label className="flex items-center gap-1.5 text-xs">
                                  <input
                                    type="radio"
                                    name={`bank-akcio-${s.hash}`}
                                    checked={s.akcio === "parosit"}
                                    onChange={() => changeBankSorAkcio(s.hash, "parosit")}
                                    className="accent-brand-600"
                                  />
                                  <PiLinkSimpleLight className="h-3.5 w-3.5 flex-shrink-0 text-brand-500" />
                                  Párosítás: {s.javasoltTetel.megnevezes} ({formatHuf(s.javasoltTetel.osszeg)},{" "}
                                  {s.javasoltTetel.datum})
                                </label>
                              )}
                              <label className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="radio"
                                  name={`bank-akcio-${s.hash}`}
                                  checked={s.akcio === "uj"}
                                  onChange={() => changeBankSorAkcio(s.hash, "uj")}
                                  className="accent-brand-600"
                                />
                                Új tétel létrehozása
                              </label>
                              <label className="flex items-center gap-1.5 text-xs">
                                <input
                                  type="radio"
                                  name={`bank-akcio-${s.hash}`}
                                  checked={s.akcio === "skip"}
                                  onChange={() => changeBankSorAkcio(s.hash, "skip")}
                                  className="accent-brand-600"
                                />
                                Kihagyás
                              </label>
                            </div>
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
                  onClick={() => setBankModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                >
                  Mégse
                </button>
                {bankSorok.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBankAlkalmazas}
                    disabled={bankAlkalmazasLoading}
                    className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bankAlkalmazasLoading ? "Alkalmazás..." : `Alkalmazás (${bankSorok.length})`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={molModalOpen}
        onClose={() => setMolModalOpen(false)}
        title="MOL tankolás import"
        maxWidth="max-w-6xl"
      >
        <div className="space-y-4">
          {!molElemezve && (
            <>
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Töltsd fel a MOL "Számla melléklet" PDF-jét (a tranzakció-szintű részletezőt, nem
                magát a számlát) — a rendszer kártyaszám/rendszám szerint bontja tankolásokra, és a
                rendszám alapján megpróbálja beazonosítani a jármüvet. Semmi nem kerül be a
                Tankolások közé, amíg a következő lépésben jóvá nem hagyod.
              </p>
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-xs font-semibold text-ink-600 shadow-soft ring-1 ring-ink-200 transition-colors duration-200 hover:bg-brand-50 hover:text-brand-700 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300">
                  <PiFileArrowUpLight className="h-4 w-4" />
                  {molElemzesLoading ? "Feldolgozás..." : "PDF fájl kiválasztása"}
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    disabled={molElemzesLoading}
                    onChange={handleMolFajlValasztas}
                  />
                </label>
              </div>
            </>
          )}

          {molElemezve && (
            <>
              {molKihagyottSorSzam > 0 && (
                <p className="text-xs text-ink-400 dark:text-ink-500">
                  {molKihagyottSorSzam} sort nem sikerült értelmezni vagy nem üzemanyag-tétel volt
                  (pl. éves kártyadíj).
                </p>
              )}

              {molSorok.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400 dark:text-ink-500">
                  Nincs feldolgozható tankolási tétel ebben a fájlban.
                </p>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-xl border border-ink-100 dark:border-ink-800">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-ink-400 dark:bg-ink-800 dark:text-ink-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Dátum</th>
                        <th className="px-3 py-2 text-left">Rendszám</th>
                        <th className="px-3 py-2 text-left">Jármű</th>
                        <th className="px-3 py-2 text-right">Liter</th>
                        <th className="px-3 py-2 text-right">Összeg</th>
                        <th className="px-3 py-2 text-center">Import</th>
                      </tr>
                    </thead>
                    <tbody>
                      {molSorok.map((s) => (
                        <tr key={s.molSlipId} className="border-t border-ink-100 align-top dark:border-ink-800">
                          <td className="whitespace-nowrap px-3 py-2 text-ink-500 dark:text-ink-400">{s.datum}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-ink-700 dark:text-ink-200">
                            {s.rendszamNyers || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {s.marImportalva ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                                <PiCheckCircleLight className="h-4 w-4" /> Már importálva
                              </span>
                            ) : s.jarmuId ? (
                              <span className="text-xs text-ink-500 dark:text-ink-400">
                                {s.jarmuTipus === "kamion"
                                  ? kamionok.find((k) => String(k.id) === String(s.jarmuId))?.rendszam
                                  : furgonok.find((f) => String(f.id) === String(s.jarmuId))?.rendszam}{" "}
                                ({s.jarmuTipus})
                              </span>
                            ) : (
                              <select
                                value=""
                                onChange={(e) => changeMolSorJarmu(s.molSlipId, e.target.value)}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              >
                                <option value="">Nem azonosítható rendszám — válassz jármüvet</option>
                                {kamionok.map((k) => (
                                  <option key={`kamion:${k.id}`} value={`kamion:${k.id}`}>
                                    {k.rendszam} (kamion)
                                  </option>
                                ))}
                                {furgonok.map((f) => (
                                  <option key={`furgon:${f.id}`} value={`furgon:${f.id}`}>
                                    {f.rendszam} (furgon)
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-ink-500 dark:text-ink-400">
                            {s.liter?.toLocaleString("hu-HU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-ink-700 dark:text-ink-200">
                            {formatHuf(s.osszeg)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!s.betoltendo}
                              disabled={s.marImportalva || !s.jarmuId}
                              onChange={(e) => changeMolSorBetoltendo(s.molSlipId, e.target.checked)}
                              className="accent-brand-600"
                            />
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
                  onClick={() => setMolModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-ink-500 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                >
                  Mégse
                </button>
                {molSorok.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMolAlkalmazas}
                    disabled={molAlkalmazasLoading || molSorok.filter((s) => s.betoltendo).length === 0}
                    className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-soft transition-colors duration-200 hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {molAlkalmazasLoading
                      ? "Alkalmazás..."
                      : `Alkalmazás (${molSorok.filter((s) => s.betoltendo).length})`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
