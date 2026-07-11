import React from "react";
import StatusBadge from "components/UI/StatusBadge.js";

// Jármű állapot-jelző — közös komponens a Kamionok és Pótkocsik
// listákhoz/formokhoz, hogy egy pillantással látszódjon, mi osztható ki
// most (lásd a P1 audit-tétel: "Jármű állapot/elérhetőség jelző").
// A tényleges szín-megjelenítést a közös StatusBadge adja — ez a fájl
// csak a jármű-állapot → szemantikai tónus leképezést tartalmazza.
export const ALLAPOT_OPTIONS = [
  { value: "szabad", label: "Szabad" },
  { value: "uton", label: "Úton" },
  { value: "szervizben", label: "Szervizben" },
];

const ALLAPOT_TONE = {
  szabad: "success",
  uton: "info",
  szervizben: "warning",
};

const ALLAPOT_LABEL = {
  szabad: "Szabad",
  uton: "Úton",
  szervizben: "Szervizben",
};

export default function AllapotBadge({ allapot }) {
  const value = allapot || "szabad";
  return (
    <StatusBadge tone={ALLAPOT_TONE[value] || "success"}>
      {ALLAPOT_LABEL[value] || "Szabad"}
    </StatusBadge>
  );
}
