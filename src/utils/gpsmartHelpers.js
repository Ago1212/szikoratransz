// Segédfüggvények a GPSmart pozíció-adatok kliens oldali feldolgozásához —
// ezek KIZÁRÓLAG megjelenítési célú levezetések a backend által már
// visszaadott mezőkből (sebesseg szöveg, idopont), NEM új üzleti logika és
// nem backend-módosítás: a GPSmart maga nem ad vissza explicit
// "online / mozgásban / áll" állapotot, sem riasztást, sofőr-nevet,
// akkumulátor- vagy GPS-pontosság-adatot — ezekből csak azt lehet a
// felületen levezetni, ami a ténylegesen visszakapott sebesség/időbélyeg-
// adatból számítható.

const OFFLINE_KUSZOB_PERC = 30; // ennyi percnél régebbi jelzés számít "offline"-nak
const MOZGAS_KUSZOB_KMH = 3; // GPS-zajszűrés — ez alatt "álló"-nak számít, nem "mozgásban"-nak

export function sebessegSzam(sebessegSzoveg) {
  const szam = parseFloat(String(sebessegSzoveg || "").replace(",", "."));
  return Number.isFinite(szam) ? szam : null;
}

// A GPSmart "2026.07.14 19:04:58" formátumú, pontokkal tagolt dátumot ad
// vissza — a natív `new Date(...)` ezt böngészőnként eltérően (vagy
// egyáltalán nem) ismeri fel, ezért kézzel szedjük szét számjegyekre.
export function idopontParse(idopontSzoveg) {
  const match = String(idopontSzoveg || "").match(
    /(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
  );
  if (!match) return null;
  const [, ev, ho, nap, ora, perc, mp] = match;
  return new Date(
    Number(ev),
    Number(ho) - 1,
    Number(nap),
    Number(ora),
    Number(perc),
    Number(mp),
  );
}

export function percEltelt(datum, most) {
  if (!datum) return null;
  return (most.getTime() - datum.getTime()) / 60000;
}

// Állapot levezetése — ez a fájl egyetlen érdemi "döntése": sebesség +
// a jelzés életkora alapján 3 kategóriába sorol. Ha a GPSmart valaha
// explicit gyújtás-/online mezőt adna vissza a backend felől, ez a
// függvény cserélendő le arra a pontosabb forrásra.
export function jarmuAllapot(pozicio, most) {
  const datum = idopontParse(pozicio.idopont);
  const percek = percEltelt(datum, most);
  if (percek === null || percek > OFFLINE_KUSZOB_PERC) {
    return { kulcs: "offline", label: "Offline", tone: "danger" };
  }
  const sebesseg = sebessegSzam(pozicio.sebesseg);
  if (sebesseg !== null && sebesseg > MOZGAS_KUSZOB_KMH) {
    return { kulcs: "mozgasban", label: "Mozgásban", tone: "success" };
  }
  return { kulcs: "all", label: "Áll", tone: "warning" };
}

export function relativIdo(datum, most) {
  const percek = percEltelt(datum, most);
  if (percek === null) return "ismeretlen";
  if (percek < 1) return "most";
  if (percek < 60) return `${Math.round(percek)} perce`;
  const orak = percek / 60;
  if (orak < 24) return `${Math.round(orak)} órája`;
  return `${Math.round(orak / 24)} napja`;
}

// A jármű-lista alapértelmezett rendezéséhez (JarmuLista.js): Mozgásban
// elöl, utána Áll, utána Offline — nem ábécésorrendben ("Áll" < "Mozgásban"
// < "Offline" magyar lokál szerint is épp rossz sorrendet adna), ezért egy
// explicit numerikus prioritás kell, nem a `_allapot.label` szöveges
// összehasonlítása.
const STATUSZ_PRIORITAS = { mozgasban: 0, all: 1, offline: 2 };

export function statuszPrioritas(allapotKulcs) {
  return STATUSZ_PRIORITAS[allapotKulcs] ?? 99;
}

// "184320" -> "184 320" — ugyanaz a szóköz-ezres tagolás, mint a
// `formatHuf`/`formatSzam` mintázatok máshol az alkalmazásban, csak
// pénznem/mértékegység-jelölés nélkül (azt a hívó teszi hozzá: "... km").
export function formatKm(ertek) {
  if (ertek === null || ertek === undefined) return null;
  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 }).format(ertek);
}

// Egyetlen helyen számolja ki minden, a felületen többször felhasznált
// levezetett mezőt (állapot, számmá alakított sebesség, relatív idő) — a
// KPI-kártyák, a lista, a térkép és a részletek panel mind ugyanazt a
// "dúsított" tömböt kapja, nem számolják újra egymástól függetlenül
// ugyanazt. Az üzemanyag-szint szándékosan nincs itt (felhasználói
// kérésre eltávolítva a Flottakövetés egészéről).
export function dusitottPoziciok(poziciok, most) {
  return poziciok.map((p) => {
    const datum = idopontParse(p.idopont);
    const allapot = jarmuAllapot(p, most);
    return {
      ...p,
      _datum: datum,
      _allapot: allapot,
      _statuszPrioritas: statuszPrioritas(allapot.kulcs),
      _sebessegSzam: sebessegSzam(p.sebesseg),
      _relativIdo: relativIdo(datum, most),
    };
  });
}
