// Lejárati dátumok egységes kiértékelése — a sofőr Kezdőlap, Profil és
// Értesítések oldala mindhárom ugyanazt a "lejárt / hamarosan lejár /
// érvényes" logikát használja a személyi/jogsi/GKI/ADR mezőkre.
//
// A dátum-részeket KÉZZEL szedjük szét (nem `new Date(dateString)`-re
// bízzuk) — egy sima "ÉÉÉÉ-HH-NN" stringet a `Date` konstruktor UTC
// éjfélként értelmezne, amit utána a `setHours(0,0,0,0)` már HELYI időben
// kerekítene vissza — UTC-től "mögötte" lévő időzónában (a magyar UTC+1/+2
// esetén nem, de máshol igen) ez egy nappal eltolhatná a "hány nap múlva
// jár le" számítást. Ugyanaz a minta, mint a `gpsmartHelpers.js`
// `idopontParse()`-ja.
export function daysUntil(dateString) {
  if (!dateString) return null;
  const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, ev, ho, nap] = match;
  const target = new Date(Number(ev), Number(ho) - 1, Number(nap));
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function getDocumentStatus(dateString) {
  const days = daysUntil(dateString);
  if (days === null) return "unknown";
  if (days < 0) return "expired";
  if (days <= 30) return "warning";
  return "valid";
}

export function getDocumentTone(status) {
  switch (status) {
    case "expired":
      return "danger";
    case "warning":
      return "warning";
    case "valid":
      return "success";
    default:
      return "neutral";
  }
}

export const DOCUMENT_FIELDS = [
  { key: "szemelyi_lejarat", label: "Személyi igazolvány" },
  { key: "jogsi_lejarat", label: "Jogosítvány" },
  { key: "gki_lejarat", label: "GKI" },
  { key: "adr_lejarat", label: "ADR" },
];
