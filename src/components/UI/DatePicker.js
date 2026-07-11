import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import { hu } from "date-fns/locale";
import {
  PiCalendarBlankLight,
  PiCaretLeftLight,
  PiCaretRightLight,
} from "react-icons/pi";

const WEEKDAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
// 352px — akkora, hogy a 7 napcella (44×44px minimum érintési méret) kényelmesen
// elférjen p-3 belső paddinggel és gap-1 réssel (352-24-24=304px / 7 ≈ 43,4px/cella).
const PANEL_WIDTH = 352;
// A naptár-panel becsült magassága (fejléc + 6 heti sor + lábléc) — ennyi
// hely kell fölötte/alatta, különben a másik irányba nyílik inkább. A 44px-es
// napcellák miatt magasabb, mint a korábbi (32px-es cellás) verzió volt.
const ESTIMATED_PANEL_HEIGHT = 440;
const VIEWPORT_MARGIN = 16;

function parseValue(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Egyedi, márka-stílusú naptár-legördülő — a natív <input type="date">
// leeső naptárát a böngésző/OS rajzolja, azt nem lehet stílushoz igazítani.
export default function DatePicker({
  value,
  onChange,
  name,
  id,
  required,
  disabled,
  placeholder = "Válasszon dátumot",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const selected = parseValue(value);
  const [viewMonth, setViewMonth] = useState(selected || new Date());
  const wrapperRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (selected) setViewMonth(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // A panel egy portálon keresztül a body aljára kerül, `position: fixed`-del —
  // így sosem vágja le egy görgethető (overflow-y-auto) vagy kerekített sarkú
  // szülő (Modal, form-kártya), és mindig a legfelső rétegben úszik, nem a
  // form/gombok fölött/alatt "belógva" takarja el őket.
  const updatePosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward =
      spaceBelow < ESTIMATED_PANEL_HEIGHT && spaceAbove > spaceBelow;

    // Keskeny (pl. 320px-es) mobil nézetben a fix PANEL_WIDTH (352px, a 44px-es
    // napcellák miatt) szélesebb lehet magánál a viewportnál — enélkül a panel
    // bal széle a képernyőn kívülre csúszna. A ténylegesen használt szélesség
    // ilyenkor a viewportra zsugorodik (a napcellák `w-full`-lal maguktól
    // követik ezt, csak keskenyebbek lesznek, a 44px-es magasságuk megmarad).
    const panelWidth = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);

    const left = Math.min(
      Math.max(rect.left, VIEWPORT_MARGIN),
      window.innerWidth - panelWidth - VIEWPORT_MARGIN
    );

    setCoords({
      left,
      width: panelWidth,
      top: openUpward ? undefined : rect.bottom + 8,
      bottom: openUpward ? window.innerHeight - rect.top + 8 : undefined,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target) &&
        panelRef.current &&
        !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const emitChange = (date) => {
    onChange?.({ target: { name, id, value: date ? format(date, "yyyy-MM-dd") : "" } });
  };

  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg border border-ink-100 bg-slate-50 px-3 py-2 text-left text-sm text-brand-900 transition-colors duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <PiCalendarBlankLight className="h-3.5 w-3.5 flex-shrink-0 text-ink-400" />
        <span className={`truncate ${selected ? "" : "text-ink-300"}`}>
          {selected ? format(selected, "yyyy. MM. dd.") : placeholder}
        </span>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[9999] rounded-2xl border border-ink-100 bg-white p-3 shadow-soft-xl"
            style={{ left: coords.left, width: coords.width, top: coords.top, bottom: coords.bottom }}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-400 transition-colors duration-150 hover:bg-slate-100 hover:text-ink-700"
              >
                <PiCaretLeftLight className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold capitalize text-brand-900">
                {format(viewMonth, "yyyy. MMMM", { locale: hu })}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-400 transition-colors duration-150 hover:bg-slate-100 hover:text-ink-700"
              >
                <PiCaretRightLight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-ink-400">
              {WEEKDAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {days.map((day) => {
                const inMonth = isSameMonth(day, viewMonth);
                const isSelected = selected && isSameDay(day, selected);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      emitChange(day);
                      setOpen(false);
                    }}
                    className={`flex h-11 w-full items-center justify-center rounded-lg text-sm transition-colors duration-150 ${
                      isSelected
                        ? "bg-brand-600 font-semibold text-white"
                        : isToday(day)
                          ? "bg-brand-50 font-semibold text-brand-700"
                          : inMonth
                            ? "text-ink-700 hover:bg-slate-100"
                            : "text-ink-300 hover:bg-slate-50"
                    }`}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  emitChange(new Date());
                  setOpen(false);
                }}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                Ma
              </button>
              {!required && (
                <button
                  type="button"
                  onClick={() => {
                    emitChange(null);
                    setOpen(false);
                  }}
                  className="text-xs font-medium text-ink-400 hover:text-ink-700"
                >
                  Törlés
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
