import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiMagnifyingGlassLight,
  PiXLight,
  PiTruckLight,
  PiTruckTrailerLight,
  PiVanLight,
  PiUsersLight,
  PiBuildingsLight,
  PiMapPinLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

const TIPUS_ICON = {
  kamion: PiTruckLight,
  potkocsi: PiTruckTrailerLight,
  furgon: PiVanLight,
  sofor: PiUsersLight,
  ugyfel: PiBuildingsLight,
  helyszin: PiMapPinLight,
};

// Egyetlen keresőmezőből minden fő modulban keres (ld. backend
// keresesInterface.php). A találatok a lista-oldalra navigálnak (nem
// közvetlenül a szerkesztő formra) — a szerkesztő oldalak kizárólag a
// route-state-ből töltődnek, a keresés viszont csak részleges mezőket ad
// vissza, ld. keresesInterface.php komment.
export default function GlobalSearch({ open, onClose }) {
  const [q, setQ] = useState("");
  const [talalatok, setTalalatok] = useState([]);
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setTalalatok([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setTalalatok([]);
      return;
    }
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem("user"));
    } catch (e) {
      user = null;
    }
    const cegId = user?.ceg_id || user?.admin;
    if (!cegId) return;

    setLoading(true);
    const timeout = setTimeout(() => {
      fetchAction("globalSearch", { ceg_id: cegId, q: q.trim() }).then((result) => {
        setTalalatok(result?.success ? result.talalatok || [] : []);
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [q, open]);

  const handleSelect = (item) => {
    onClose();
    history.push(item.url);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/50 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-soft-lg ring-1 ring-ink-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-4 py-3.5">
          <PiMagnifyingGlassLight className="h-5 w-5 flex-shrink-0 text-ink-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Keresés rendszámra, névre, ügyfélre…"
            className="min-w-0 flex-1 border-none bg-transparent text-sm text-ink-900 placeholder-ink-300 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-slate-100 hover:text-ink-700"
            aria-label="Bezárás"
          >
            <PiXLight className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {q.trim().length >= 2 && !loading && talalatok.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-400">Nincs találat.</p>
          )}
          {talalatok.map((item) => {
            const Icon = TIPUS_ICON[item.tipus] || PiMagnifyingGlassLight;
            return (
              <button
                key={`${item.tipus}-${item.id}`}
                type="button"
                onClick={() => handleSelect(item)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900">{item.cim}</span>
                  <span className="block truncate text-xs text-ink-400">{item.alcim}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
