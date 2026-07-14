import L from "leaflet";

// Egyedi, irány szerint forgatott jelölő-ikon — a Leaflet alapértelmezett
// pin-képe helyett egy saját, SVG-alapú nyíl, ami a `irany` (fokban kapott
// haladási irány) szerint forog, és az állapot tónusa szerint színeződik.
// A kiválasztott jármű egy plusz, halvány gyűrűt kap, hogy a térképen és a
// listában ugyanaz a "kiválasztva" jelzés érvényesüljön.
const TONE_SZIN = {
  success: "#10b981", // emerald-500 — mozgásban
  warning: "#f59e0b", // amber-500 — áll
  danger: "#ef4444", // red-500 — offline
};

export function jarmuIkon({ irany, tone, kivalasztott }) {
  const szin = TONE_SZIN[tone] || "#68708a";
  const meret = kivalasztott ? 44 : 32;
  const forgatas = typeof irany === "number" ? irany : 0;
  const gyuru = kivalasztott
    ? `<circle cx="22" cy="22" r="19" fill="${szin}" opacity="0.18" />`
    : "";

  const svg = `
    <svg width="${meret}" height="${meret}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
      ${gyuru}
      <circle cx="22" cy="22" r="14" fill="${szin}" stroke="white" stroke-width="3" />
      <g transform="rotate(${forgatas} 22 22)">
        <path d="M22 13 L28 27 L22 23 L16 27 Z" fill="white" />
      </g>
    </svg>`;

  return L.divIcon({
    html: svg,
    className: "flotta-marker-ikon",
    iconSize: [meret, meret],
    iconAnchor: [meret / 2, meret / 2],
  });
}
