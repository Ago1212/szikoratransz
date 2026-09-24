import React from "react";
import { PiWarningCircleLight, PiArrowClockwiseLight } from "react-icons/pi";

export default class HibaHatar extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hiba: null };
  }

  static getDerivedStateFromError(hiba) {
    return { hiba };
  }

  componentDidCatch(hiba) {
    console.error("Megjelenítési hiba:", hiba);
  }

  render() {
    if (!this.state.hiba) return this.props.children;
    const betoltesiHiba = /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(
      String(this.state.hiba?.message || this.state.hiba),
    );
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-16 text-center">
        <PiWarningCircleLight className="h-10 w-10 text-amber-500" />
        <p className="text-base font-semibold text-ink-900">
          {betoltesiHiba ? "Nem sikerült betölteni az oldalt" : "Váratlan hiba történt"}
        </p>
        <p className="text-sm text-ink-500">
          {betoltesiHiba
            ? "Valószínűleg nincs térerő, vagy frissült az alkalmazás. Próbáld újra, amint van kapcsolat."
            : "Töltsd újra az oldalt. Ha a hiba ismétlődik, szólj a diszpécsernek."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white active:bg-brand-700"
        >
          <PiArrowClockwiseLight className="h-5 w-5" />
          Újratöltés
        </button>
      </div>
    );
  }
}
