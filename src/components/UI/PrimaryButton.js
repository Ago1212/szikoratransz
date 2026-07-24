import React from "react";

// UX-audit — a kódbázisban két versengő "elsődleges gomb" konvenció élt
// egymás mellett: egy `text-sm font-medium` súlyú (néhány modal-belső
// gombnál) és egy `text-xs font-bold uppercase tracking-wide` súlyú (a
// `DataTable`-ben az "+ Új" gomb, `SaveButton.js`, és a legtöbb admin
// oldal saját "+ Új X" gombja). Utóbbi a szélesebben elterjedt minta —
// ez a komponens azt kodifikálja egyetlen helyen, hogy az outlier
// (`text-sm font-medium`) hívóhelyek erre álljanak át, ahelyett hogy
// mindegyik saját maga másolná a class-stringet.
export default function PrimaryButton({
  onClick,
  type = "button",
  icon: Icon,
  children,
  disabled = false,
  variant = "solid",
  className = "",
}) {
  const variantClass =
    variant === "ghost"
      ? "text-ink-500 hover:bg-slate-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
      : "bg-brand-600 text-white shadow-soft hover:bg-brand-700";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all duration-300 ease-fluid active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
