import React from "react";

export default function PageHeader({ eyebrow, title, action, className = "mb-8" }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-500 dark:text-brand-400">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-2xl font-bold text-brand-900 dark:text-ink-50">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}
