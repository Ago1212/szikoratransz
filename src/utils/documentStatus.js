// Lejárati dátumok egységes kiértékelése — a sofőr Kezdőlap, Profil és
// Értesítések oldala mindhárom ugyanazt a "lejárt / hamarosan lejár /
// érvényes" logikát használja a személyi/jogsi/GKI/ADR mezőkre.
export function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString);
  target.setHours(0, 0, 0, 0);
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
