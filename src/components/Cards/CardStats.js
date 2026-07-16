import React from "react";
import PropTypes from "prop-types";

// Egységes KPI-kártya tokenkészlet — korábban a Dashboard (`CardStats`) és a
// Flottakövetés (saját, külön `KpiKartya`) két, vizuálisan hasonló, de
// külön karbantartott stat-kártyát használt (UX-audit: "KPI cards differ
// across Dashboard/Flottakövetés/Pénzforgalom"). Ez a komponens most mindkét
// elrendezést kiszolgálja (`layout="stacked"` a Dashboardnak, `layout="row"`
// a Flottakövetésnek — a tartalmuk valóban eltérő igényű: a Flottakövetés
// 6 kártyája sűrűbb, ikon+érték egy sorban, másodlagos felirattal), de a
// szín-/árnyék-/sugár-/tipográfia-tokenek egy helyről jönnek. A Pénzforgalom
// "kabin" kártyái (Várható eredmény, Kiválasztott időszak stb.) szándékosan
// NEM ezt használják — azok több soros, bontott összegző panelek, nem
// egyetlen-szám KPI-csempék, más tartalmi műfaj.
const TONE = {
  brand: { icon: "bg-brand-50 text-brand-600", ring: "ring-ink-100", value: "text-brand-900" },
  positive: {
    icon: "bg-emerald-50 text-emerald-600",
    ring: "ring-ink-100",
    value: "text-brand-900",
  },
  neutral: { icon: "bg-ink-100 text-ink-600", ring: "ring-ink-100", value: "text-brand-900" },
  warning: { icon: "bg-amber-50 text-amber-700", ring: "ring-amber-200", value: "text-amber-700" },
  danger: { icon: "bg-red-50 text-red-700", ring: "ring-red-200", value: "text-red-700" },
};

export default function CardStats({
  statSubtitle,
  statTitle,
  statDescripiron,
  statCaption,
  statIcon: Icon,
  onClick,
  tone = "brand",
  layout = "stacked",
}) {
  const t = TONE[tone] || TONE.brand;
  const clickable = Boolean(onClick);

  if (layout === "row") {
    return (
      <div
        onClick={onClick}
        className={`group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 transition-all duration-300 ease-fluid hover:shadow-soft-lg ${t.ring} ${
          clickable ? "cursor-pointer hover:-translate-y-0.5" : ""
        }`}
      >
        {Icon && (
          <span
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-300 ease-fluid group-hover:scale-105 ${t.icon}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <p
            className={`font-display text-xl font-bold leading-tight tabular-nums ${t.value}`}
          >
            {statTitle}
          </p>
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            {statSubtitle}
          </p>
          {statCaption && <p className="truncate text-xs text-ink-500">{statCaption}</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`group rounded-2xl bg-white/60 p-1 shadow-soft ring-1 transition-all duration-300 ease-fluid hover:shadow-soft-lg sm:rounded-3xl sm:p-1.5 ${t.ring} ${
        clickable ? "cursor-pointer hover:-translate-y-0.5" : ""
      }`}
    >
      <div className="rounded-[calc(1rem-0.25rem)] bg-white p-3 sm:rounded-[calc(1.5rem-0.375rem)] sm:p-4">
        <div className="flex items-center justify-between gap-2 sm:items-start sm:gap-3">
          <div className="min-w-0">
            <h5 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-400 sm:text-[11px] sm:tracking-[0.12em]">
              {statSubtitle}
            </h5>
            <span
              className={`mt-0.5 block font-display text-lg font-bold tabular-nums sm:mt-1 sm:text-2xl ${t.value}`}
            >
              {statTitle}
            </span>
          </div>
          {Icon && (
            <div
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-300 ease-fluid group-hover:scale-105 sm:h-9 sm:w-9 sm:rounded-2xl ${t.icon}`}
            >
              <Icon className="h-4 w-4 sm:h-4 sm:w-4" />
            </div>
          )}
        </div>
        {statDescripiron && (
          <p className="mt-2 text-xs text-ink-400 sm:mt-4">{statDescripiron}</p>
        )}
      </div>
    </div>
  );
}

CardStats.propTypes = {
  statSubtitle: PropTypes.string,
  statTitle: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  statDescripiron: PropTypes.string,
  statCaption: PropTypes.string,
  statIcon: PropTypes.elementType,
  onClick: PropTypes.func,
  tone: PropTypes.oneOf(["brand", "positive", "neutral", "warning", "danger"]),
  layout: PropTypes.oneOf(["stacked", "row"]),
};
