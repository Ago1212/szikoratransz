import React from "react";
import { createPortal } from "react-dom";
import { PiXLight } from "react-icons/pi";
import { useMediaQuery } from "react-responsive";
import { useDarkMode } from "utils/useDarkMode.js";

export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-md",
}) {
  const isMobile = useMediaQuery({ maxWidth: 767 });
  // A `dark` osztály a layouts/Admin.js saját gyökér wrapperén ül — mivel a
  // desktop ág mostantól `document.body`-ra van portolva (ld. lentebb), már
  // nem DOM-őse neki, tehát nem örökölné. Ugyanaz a minta, mint
  // ToastContainer.js-nél: saját maga olvassa ki a preferenciát. A
  // route-alapú szűkítést (ld. ott) itt nem kell megismételni — a Modal
  // minden hívási helye kizárólag admin-nézet (Koltsegek.js, Szabadsagok.js,
  // Karbantartasok.js, Flottakovetes.js stb.), sofőr/nyilvános oldal sosem
  // rendereli.
  const [isDark] = useDarkMode();
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
          className="mb-6 w-full flex-shrink-0 rounded-2xl border border-ink-100 bg-white shadow-soft dark:border-ink-800 dark:bg-ink-900"
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3 dark:border-ink-800">
            <h3 className="font-display text-base font-semibold text-brand-900 dark:text-ink-50">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Bezárás"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-400 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-50"
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

  // Portolva `document.body`-ra — a hívók (pl. Koltsegek.js) a saját
  // komponensfájukban rendereli be a Modal-t, ami az Admin.js layout
  // `fixed inset-y-0 ... md:left-64` "Tartalom" wrapperén BELÜL van. Az a
  // wrapper maga is `position: fixed`, ami saját verem-kontextust hoz létre
  // — emiatt ennek a Modal-nak a `z-50`-e csak AZON A WRAPPEREN BELÜL
  // számít, nem a teljes oldalon: a Sidebar `<nav>`-ja (explicit `z-30` a
  // wrapperrel AZONOS, külső verem-kontextusban) élőben, `elementFromPoint`-
  // tal ellenőrizve ténylegesen a modal fölé festődött egy széles
  // (`max-w-5xl`+) modalnál a bal ~130px sávban — nem csak vizuális
  // rendereési furcsaság, a kattintás is a Sidebar-t találta el ott.
  // Portolással a modal a `<body>` közvetlen gyereke lesz, kikerülve a
  // Tartalom-wrapper verem-kontextusát — pontosan ugyanaz a minta, mint a
  // DatePicker.js popover-jénél egy hasonló, ős-overflow okozta clip ellen.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm ${isDark ? "dark" : ""}`}
      style={{ colorScheme: isDark ? "dark" : "light" }}
    >
      {/* min-h-full (nem h-full) + a görgetés a külső rétegen történik, hogy a
          modal sose vágódjon le felül/alul, ha magasabb a tartalma a képernyőnél. */}
      <div className="flex min-h-full items-center justify-center py-8">
        <div
          className={`flex max-h-[85vh] w-full ${maxWidth} flex-col overflow-hidden rounded-3xl bg-white shadow-soft-xl dark:bg-ink-900`}
        >
          <div className="flex flex-shrink-0 items-center justify-between border-b border-ink-100 px-6 py-4 dark:border-ink-800">
            <h3 className="font-display text-lg font-semibold text-brand-900 dark:text-ink-50">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Bezárás"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-400 transition-colors duration-200 hover:bg-slate-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-50 md:h-8 md:w-8"
            >
              <PiXLight className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5 dark:text-ink-100">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  );
}
