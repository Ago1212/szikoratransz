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
      className="group cursor-pointer rounded-2xl bg-white/60 p-1 shadow-soft ring-1 ring-ink-100 transition-all duration-300 ease-fluid hover:-translate-y-0.5 hover:shadow-soft-lg sm:rounded-3xl sm:p-1.5"
    >
      <div className="rounded-[calc(1rem-0.25rem)] bg-white p-3 sm:rounded-[calc(1.5rem-0.375rem)] sm:p-4">
        <div className="flex items-center justify-between gap-2 sm:items-start sm:gap-3">
          <div className="min-w-0">
            <h5 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-400 sm:text-[11px] sm:tracking-[0.12em]">
              {statSubtitle}
            </h5>
            <span className="mt-0.5 block font-display text-lg font-bold tabular-nums text-brand-900 sm:mt-1 sm:text-2xl">
              {statTitle}
            </span>
          </div>
          {Icon && (
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-300 ease-fluid group-hover:scale-105 sm:h-9 sm:w-9 sm:rounded-2xl">
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
  statIcon: PropTypes.elementType,
  onClick: PropTypes.func,
};
