import React from "react";
import StatusBadge from "components/UI/StatusBadge.js";
import { useListaElemek } from "utils/useListaElemek.js";

// Jármű állapot-jelző — közös komponens a Kamionok és Pótkocsik
// listákhoz/formokhoz, hogy egy pillantással látszódjon, mi osztható ki
// most (lásd a P1 audit-tétel: "Jármű állapot/elérhetőség jelző").
// A tényleges szín-megjelenítést a közös StatusBadge adja — ez a fájl
// csak a jármű-állapot → szemantikai tónus leképezést tartalmazza.
//
// Az állapotok listája mostantól cégenként egyénileg bővíthető (ld.
// views/admin/Listak.js) — a névet ezért mindig a `listaelemek` táblából
// kérjük le (useListaElemek), az itt felsorolt 3 eredeti érték csak a
// tónushoz (szín) tartozik, egy egyéni állapot "info" tónust kap.
const ALLAPOT_TONE = {
  szabad: "success",
  uton: "info",
  szervizben: "warning",
};

export default function AllapotBadge({ allapot }) {
  const value = allapot || "szabad";
  const { elemek } = useListaElemek("jarmu_allapot");
  const nev = elemek.find((e) => e.kulcs === value)?.nev || value;
  return <StatusBadge tone={ALLAPOT_TONE[value] || "info"}>{nev}</StatusBadge>;
}
