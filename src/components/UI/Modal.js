import React from "react";
import { PiXLight } from "react-icons/pi";
import { useMediaQuery } from "react-responsive";

export default function Modal({ open, onClose, title, children, maxWidth = "max-w-md" }) {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const inlineRef = React.useRef(null);

  React.useEffect(() => {
    if (open && isMobile && inlineRef.current) {
      inlineRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [open, isMobile]);

  if (!open) return null;

  // Mobilon nincs felugró/overlay dialógus — a form a lap normál
  // görgetési folyamába illeszkedik be, hogy sose vágja le semmi a
  // mentés gombot (ami a fix magasságú, saját görgetésű popupnál
  // előfordult a mobil böngészők ingadozó 100vh-ja miatt).
  if (isMobile) {
    return (
      <>
        <div
          ref={inlineRef}
          className="mb-6 w-full flex-shrink-0 rounded-2xl border border-ink-100 bg-white shadow-soft"
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <h3 className="font-display text-base font-semibold text-brand-900">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-700"
            >
              <PiXLight className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 py-4">{children}</div>
        </div>
        {/* Valódi (nem margin) térköz a lap alján — a szülő oldalak (pl.
            Karbantartasok.js) `h-full flex-col` gyökere miatt egy ezen a
            div-en KÍVÜLI testvérelem (pl. Admin.js layout-szintű spacere)
            nem tolódik el ennek a boxnak a túlcsordulásától — csak egy,
            ETTŐL A DOBOZTÓL BELÜL lévő valódi blokk-magasság garantálja,
            hogy a görgethető terület tényleg a mentés gomb alá érjen. */}
        <div className="h-20 w-full flex-shrink-0" aria-hidden="true" />
      </>
    );
  }

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
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-700"
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
