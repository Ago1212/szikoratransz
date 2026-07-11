import React from "react";

export default function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-lg px-1 py-2.5 text-sm font-semibold transition-colors duration-200 ease-fluid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
        active ? "text-brand-700" : "text-ink-400 hover:text-ink-700"
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
      <span
        className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-colors duration-200 ease-fluid ${
          active ? "bg-brand-600" : "bg-transparent"
        }`}
      />
    </button>
  );
}
