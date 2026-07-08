import React from "react";
import PropTypes from "prop-types";

export default function CardStats({
  statSubtitle,
  statTitle,
  statDescripiron,
  statIcon: Icon,
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-3xl bg-white/60 p-1.5 shadow-soft ring-1 ring-ink-100 transition-all duration-300 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg"
    >
      <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h5 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              {statSubtitle}
            </h5>
            <span className="mt-1.5 block font-display text-3xl font-bold tabular-nums text-brand-900">
              {statTitle}
            </span>
          </div>
          {Icon && (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-transform duration-300 ease-fluid group-hover:scale-105">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
        {statDescripiron && (
          <p className="mt-4 text-xs text-ink-400">{statDescripiron}</p>
        )}
      </div>
    </div>
  );
}

CardStats.propTypes = {
  statSubtitle: PropTypes.string,
  statTitle: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  statDescripiron: PropTypes.string,
  statIcon: PropTypes.elementType,
  onClick: PropTypes.func,
};
