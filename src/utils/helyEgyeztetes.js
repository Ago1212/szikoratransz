export function normalizaltNev(szoveg) {
  return String(szoveg || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function helyKeresese(helyszinek, cegNev) {
  const cel = normalizaltNev(cegNev);
  if (cel.length < 3) return null;
  const pontos = helyszinek.find((h) => normalizaltNev(h.nev) === cel);
  if (pontos) return pontos;
  return (
    helyszinek.find((h) => {
      const nev = normalizaltNev(h.nev);
      return nev.length >= 4 && (cel.includes(nev) || nev.includes(cel));
    }) || null
  );
}

export function navigacioUrl(hely) {
  if (hely?.lat != null && hely?.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${hely.lat},${hely.lng}`;
  }
  const cel = [hely?.nev, hely?.cim].filter(Boolean).join(", ");
  return cel ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cel)}` : null;
}
