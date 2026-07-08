import React from "react";
import { PiXLight } from "react-icons/pi";

export default function Modal({ open, onClose, title, children, maxWidth = "max-w-md" }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm">
      {/* min-h-full (nem h-full) + a görgetés a külső rétegen történik, hogy a
          modal sose vágódjon le felül/alul, ha magasabb a tartalma a képernyőnél. */}
      <div className="flex min-h-full items-center justify-center py-8">
        <div
          className={`flex max-h-[85vh] w-full ${maxWidth} flex-col overflow-hidden rounded-3xl bg-white shadow-soft-xl`}
        >
          <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-100 px-6 py-4">
            <h3 className="font-display text-lg font-semibold text-brand-900">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors duration-200 hover:bg-sand-100 hover:text-ink-700"
            >
              <PiXLight className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
