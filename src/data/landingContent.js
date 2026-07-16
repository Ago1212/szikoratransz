import {
  PiTruckLight,
  PiGlobeLight,
  PiShieldCheckLight,
  PiLightningLight,
  PiFileTextLight,
  PiConfettiLight,
} from "react-icons/pi";

// Megosztott tartalom a Landing.js főoldal és a szolgáltatás-specifikus
// long-tail SEO oldalak (src/views/landing/*.js) között — egy helyen tartva
// elkerüli, hogy 6+ fájlban kelljen szinkronban tartani ugyanazt a szöveget.
//
// A `href` mező (ahol jelen van) köti össze ezt a kártyát a hozzá tartozó
// dedikált long-tail oldallal — a Landing.js "Szolgáltatásaink" grid ez
// alapján dönti el, hogy egy kártya kattintható link legyen-e.
export const FEATURES = [
  {
    icon: PiTruckLight,
    title: "Belföldi fuvarozás",
    desc: "Gyors és megbízható áruszállítás Magyarország egész területén, rugalmas árazással és pontos határidőkkel. Egyaránt vállalunk egyszeri megbízásokat és rendszeres, ismétlődő fuvarokat.",
    href: "/belfoldi-fuvarozas-arajanlat",
  },
  {
    icon: PiGlobeLight,
    title: "Nemzetközi szállítás",
    desc: "Határon átnyúló fuvarozási szolgáltatás Európa-szerte, teljes körű vámügyintézéssel és okmányolással. Az útvonalat és a határidőt minden esetben az adott fuvarhoz igazítjuk.",
    href: "/nemzetkozi-fuvarozas-vamugyintezessel",
  },
  {
    icon: PiShieldCheckLight,
    title: "Biztosított szállítás",
    desc: "Minden fuvarunk teljes biztosítási fedezettel történik — az árukészlete nálunk biztos kezekben van. Esetleges kár esetén csapatunk intézi a biztosítóval a kárrendezést.",
    href: "/biztositott-szallitas",
  },
  {
    icon: PiLightningLight,
    title: "Expressz szállítás",
    desc: "Sürgős fuvarok soron kívüli kezelése, garantált kiszállítási idővel, ha az idő a legfontosabb tényező. Vegye fel velünk a kapcsolatot, és soron kívül egyeztetjük a részleteket.",
    href: "/expressz-fuvarozas",
  },
  {
    icon: PiConfettiLight,
    title: "Rendezvényszállítás",
    desc: "Standok, berendezések, dekoráció és egyéb rendezvényanyagok szállítása a helyszínre és vissza, a rendezvény ütemezéséhez igazítva.",
    href: "/rendezveny-szallitas",
  },
  {
    icon: PiFileTextLight,
    title: "Egyedi árajánlat",
    desc: "Minden megrendelést egyedileg árazunk az útvonal, az áru jellege és a határidő alapján — gyors, személyre szabott ajánlattal. Nincs rejtett költség, az ajánlatban minden tétel átlátható.",
    href: "/egyedi-arajanlat-fuvarozas",
  },
];

export const PROCESS_STEPS = [
  {
    n: "01",
    title: "Megrendelés",
    desc: "Küldje el ajánlatkérését az űrlapon, és 24 órán belül részletes választ kap tőlünk.",
  },
  {
    n: "02",
    title: "Tervezés",
    desc: "Optimalizáljuk az útvonalat, és kiválasztjuk az áru jellegéhez illő járművet és sofőrt.",
  },
  {
    n: "03",
    title: "Szállítás",
    desc: "Szakképzett sofőreink pontosan az ütemterv szerint szállítják az árut, az ország határain belül és kívül.",
  },
  {
    n: "04",
    title: "Kézbesítés",
    desc: "Pontos, biztosított kiszállítás, írásos visszaigazolással a fuvar lezárásáról.",
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "A Szikora Transz csapatára mindig számíthatunk, akár sürgős, akár előre tervezett szállításról van szó. A kommunikáció gyors és pontos.",
    name: "Nagy Péter",
    role: "beszerzési vezető",
    company: "Pannon Élelmiszer Zrt.",
  },
  {
    quote:
      "Nemzetközi fuvarjaink mindig időben és hiánytalanul érkeznek meg. A vámügyintézést is teljes egészében átvállalják tőlünk.",
    name: "Tóth Andrea",
    role: "logisztikai menedzser",
    company: "ÉszakBau Kft.",
  },
  {
    quote:
      "Minden fuvarra gyorsan, az igényeinkre szabott árajánlatot kapunk, és bármikor el tudjuk érni a csapatot, ha kérdésünk van.",
    name: "Kovács Gábor",
    role: "ügyvezető",
    company: "Dunapack Csomagolástechnika Kft.",
  },
];

export const FAQ_ITEMS = [
  {
    q: "Mennyi idő alatt kapok ajánlatot?",
    a: "Általában 24 órán belül felvesszük Önnel a kapcsolatot egy részletes, az útvonalra és az áru jellegére szabott árajánlattal.",
  },
  {
    q: "Mitől függ egy fuvar ára?",
    a: "Elsősorban a távolság, a szállítandó áru mérete, súlya és jellege, valamint a vállalt határidő határozza meg az árat. Nincs egységes, fix díjszabásunk — minden ajánlatkérést egyedileg, tételesen árazunk, hogy a végösszeg pontosan tükrözze az adott fuvar valós igényeit.",
  },
  {
    q: "Milyen járművekkel dolgoznak?",
    a: "Modern, rendszeresen karbantartott kamionflottánkat a szállítandó áru jellegéhez igazítjuk. A fuvarhoz legmegfelelőbb jármű kiválasztása az ajánlatkérés során, az Ön igényei alapján történik.",
  },
  {
    q: "Biztosított a szállított áru?",
    a: "Igen, minden fuvarunk teljes körű biztosítási fedezettel történik, a felvételtől a kiszállításig.",
  },
  {
    q: "Mi történik, ha kár keletkezik szállítás közben?",
    a: "Ilyen esetben haladéktalanul jelezze felénk telefonon vagy e-mailben. Mivel minden fuvar biztosítási fedezet mellett zajlik, csapatunk a biztosítóval egyeztetve intézi a kárrendezés ügyintézését.",
  },
  {
    q: "Vállalnak nemzetközi szállítást?",
    a: "Igen, Európa-szerte végzünk nemzetközi fuvarozást, a szükséges vámügyintézés és okmányolás teljes körű intézésével. A pontos útvonalat és határidőt minden esetben egyeztetjük az ajánlatkérés során.",
  },
  {
    q: "Kérhetek egyedi árajánlatot speciális igényekhez?",
    a: "Igen, minden megrendelést egyedileg árazunk az útvonal, az áru jellege és a határidő alapján. Vegye fel velünk a kapcsolatot a részletekkel, és személyre szabott ajánlatot küldünk.",
  },
  {
    q: "Milyen fizetési feltételeket fogadnak el?",
    a: "Átutalást és számlás fizetést is biztosítunk, a fizetési határidőt az egyedi megrendelés alapján egyeztetjük.",
  },
  {
    q: "Hogyan jelentkezhetek sofőrként?",
    a: "Töltse ki az alábbi jelentkezési űrlapot a végzettségével és tapasztalatával. Amennyiben rendelkezik a szükséges jogosítvány-kategóriával, csapatunk hamarosan felveszi Önnel a kapcsolatot, és a pontos feltételekről személyesen egyeztetünk.",
  },
];

// Segédfüggvény a long-tail oldalakhoz: a teljes FAQ_ITEMS-ből kérdés-szöveg
// alapján válogat ki egy releváns részhalmazt (ugyanaz az objektum-referencia,
// nem másolat — így a FAQPage JSON-LD és a látható szöveg sosem futhat szét).
export function pickFaq(...questions) {
  return questions.map((q) => FAQ_ITEMS.find((item) => item.q === q)).filter(Boolean);
}

// A szolgáltatás-specifikus long-tail SEO oldalak listája (ld.
// src/views/landing/*.js) — a ServicePage sablon ebből építi az "Egyéb
// szolgáltatásaink" belső linksort minden oldal alján, a jelenlegi oldal
// kivételével.
export const SERVICE_PAGES = [
  { path: "/belfoldi-fuvarozas-arajanlat", label: "Belföldi fuvarozás" },
  { path: "/nemzetkozi-fuvarozas-vamugyintezessel", label: "Nemzetközi fuvarozás" },
  { path: "/biztositott-szallitas", label: "Biztosított szállítás" },
  { path: "/expressz-fuvarozas", label: "Expressz fuvarozás" },
  { path: "/rendezveny-szallitas", label: "Rendezvényszállítás" },
  { path: "/egyedi-arajanlat-fuvarozas", label: "Egyedi árajánlat" },
];
