import React from "react";

// Egységes státusz-jelvény — korábban a Bejelentések, Napló és
// jármű-állapot táblázatai mindegyike saját, kézzel írt szín-térképet
// (STATUSZ_STYLE / PRIORITAS_STYLE / MUVELET_STYLE) definiált ugyanarra
// a fogalomra ("mi számít sikernek/figyelmeztetésnek/hibának"), enyhén
// eltérő árnyalatokkal egymástól. Ez az egyetlen hely, ahol az öt
// szemantikai tónus (`success`/`warning`/`danger`/`info`/`neutral`)
// tényleges Tailwind-osztályokká alakul — a hívó oldal csak azt dönti
// el, melyik tónus tartozik melyik állapothoz, a megjelenítést nem.
const TONE_CLASSES = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-600",
  info: "bg-brand-50 text-brand-700",
  neutral: "bg-ink-100 text-ink-500",
};

export default function StatusBadge({ tone = "neutral", children }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        TONE_CLASSES[tone] || TONE_CLASSES.neutral
      }`}
    >
      {children}
    </span>
  );
}
