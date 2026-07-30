import React from "react";

// Mobil UX audit (2026-07-30): hiányzó mezőérték kártyanézetben ("Nincs")
// korábban ugyanolyan betűstílusban jelent meg, mint a valódi adat —
// első pillantásra hiányos/hibás rekordnak tűnt, nem szándékosan üresnek.
// Dőlt, halványabb stílus egyértelműsíti, hogy ez egy tudatos üres állapot.
export default function EmptyValue({ children = "Nincs megadva" }) {
  return <span className="italic text-ink-400 dark:text-ink-500">{children}</span>;
}
