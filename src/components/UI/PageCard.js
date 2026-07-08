import React from "react";

export function GradientCardHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <h3 className="font-display text-base font-semibold text-brand-900">{title}</h3>
      </div>
      {action}
    </div>
  );
}

export default function PageCard({ icon, title, action, children, className = "" }) {
  return (
    <div
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-soft ring-1 ring-ink-100 ${className}`}
    >
      {title && <GradientCardHeader icon={icon} title={title} action={action} />}
      {children}
    </div>
  );
}
