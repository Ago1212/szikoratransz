import {
  PiFileLight,
  PiFilePdfLight,
  PiFileXlsLight,
  PiFileImageLight,
  PiFilmSlateLight,
  PiSpeakerHighLight,
  PiArchiveLight,
  PiPresentationChartLight,
} from "react-icons/pi";

// A 9 kért kategória — kulcs = `fajl_kategoria` (ld. filesInterface.php
// KATEGORIA_TERKEP), ikon+magyar címke+szín egyetlen helyen, hogy a
// dashboard/szűrő-chipek/kártya-rács ne tartson 3 külön másolatot.
export const KATEGORIA_INFO = {
  kep: { label: "Kép", icon: PiFileImageLight, szin: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40", badgeBg: "bg-violet-500" },
  dokumentum: { label: "Dokumentum", icon: PiFileLight, szin: "text-brand-600 dark:text-brand-400", bg: "bg-brand-50 dark:bg-brand-950/40", badgeBg: "bg-brand-500" },
  pdf: { label: "PDF", icon: PiFilePdfLight, szin: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40", badgeBg: "bg-red-500" },
  tablazat: { label: "Táblázat", icon: PiFileXlsLight, szin: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", badgeBg: "bg-emerald-500" },
  prezentacio: { label: "Prezentáció", icon: PiPresentationChartLight, szin: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", badgeBg: "bg-amber-500" },
  video: { label: "Videó", icon: PiFilmSlateLight, szin: "text-pink-600 dark:text-pink-400", bg: "bg-pink-50 dark:bg-pink-950/40", badgeBg: "bg-pink-500" },
  hang: { label: "Hangfájl", icon: PiSpeakerHighLight, szin: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-950/40", badgeBg: "bg-sky-500" },
  tomoritett: { label: "Tömörített", icon: PiArchiveLight, szin: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40", badgeBg: "bg-orange-500" },
  egyeb: { label: "Egyéb", icon: PiFileLight, szin: "text-ink-500 dark:text-ink-400", bg: "bg-ink-100 dark:bg-ink-800", badgeBg: "bg-ink-400 dark:bg-ink-600" },
};

export const kategoriaInfo = (kulcs) => KATEGORIA_INFO[kulcs] || KATEGORIA_INFO.egyeb;

// A kategória (fajl_kategoria) csak 9 tág csoport (pl. "dokumentum" fedi a
// doc/docx/txt/odt-t is) — a kártyán a tényleges kiterjesztést mutatjuk meg
// (max 4 karakter, hogy a szép logó-jelvényen ne törjön sorba), nem a
// kategória-címkét.
export const fajlKiterjesztes = (filename) => {
  const resz = (filename || "").split(".");
  if (resz.length < 2) return "";
  return resz.pop().toUpperCase().slice(0, 4);
};

// A `tabla` oszlop lehetséges értékei — a domain-modulok mellett a 3, csak
// memóriában dekódolt majd eldobott import-fajta is (ld. CLAUDE.md), amik
// mostantól a nyers fájljukat is elmentik ide.
export const MODUL_LABEL = {
  kamion: "Kamion",
  potkocsi: "Pótkocsi",
  furgon: "Furgon",
  sofor: "Sofőr",
  karbantartasok: "Karbantartás",
  bejelentesek: "Bejelentés",
  helyszin: "Helyszín",
  tankolas: "Tankolás",
  dokumentum: "Dokumentum",
  admin: "Fájlok (közvetlen feltöltés)",
  egyeb: "Egyéb",
  bank_import: "Bank import",
  mol_import: "MOL import",
  tachograf_import: "Tachográf import",
};

export const formatFileSize = (bytes) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat(bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
};

export const formatDate = (dateString) => {
  const options = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  return new Date(dateString).toLocaleDateString("hu-HU", options);
};
