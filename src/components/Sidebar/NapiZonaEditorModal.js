import React from "react";
import {
  PiArrowUpLight,
  PiArrowDownLight,
  PiXLight,
  PiPlusLight,
} from "react-icons/pi";
import Modal from "components/UI/Modal.js";
import { confirmDialog } from "utils/confirm.js";

// A desktop sidebar napi zónájának szerkesztője — pip/nyíl-alapú
// kitűzés+sorrend UI, ugyanazzal a `Modal.js`-re épülő, portolt/dark-mode-os/
// dialógus-szemantikás alappal, mint minden más admin-nézeti modal ebben a
// kódbázisban (ld. docs/superpowers/specs/2026-07-26-sidebar-napi-zona-
// testreszabas-design.md).
export default function NapiZonaEditorModal({
  open,
  onClose,
  registry,
  pinnedPaths,
  onChange,
  maxItems,
  isAdmin,
  defaultPaths,
}) {
  const visibleRegistry = registry.filter((item) => !item.adminOnly || isAdmin);

  const pinnedItems = pinnedPaths
    .map((to) => visibleRegistry.find((item) => item.to === to))
    .filter(Boolean);

  const availableItems = visibleRegistry.filter(
    (item) => !pinnedPaths.includes(item.to),
  );

  const groupedAvailable = [];
  const groupIndex = new Map();
  availableItems.forEach((item) => {
    if (!groupIndex.has(item.group)) {
      groupIndex.set(item.group, groupedAvailable.length);
      groupedAvailable.push({ label: item.group, items: [] });
    }
    groupedAvailable[groupIndex.get(item.group)].items.push(item);
  });

  const atLimit = pinnedItems.length >= maxItems;

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= pinnedPaths.length) return;
    const next = [...pinnedPaths];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (to) => onChange(pinnedPaths.filter((p) => p !== to));

  const add = (to) => {
    if (atLimit) return;
    onChange([...pinnedPaths, to]);
  };

  const handleReset = async () => {
    const ok = await confirmDialog(
      "Ez visszaállítja a napi zónát az alapértelmezett menüpontokra és sorrendre. A jelenlegi testreszabás elvész.",
      {
        danger: false,
        confirmLabel: "Visszaállítás",
        title: "Alapértelmezett visszaállítása",
      },
    );
    if (ok) onChange(defaultPaths);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Napi zóna testreszabása"
      maxWidth="max-w-lg"
    >
      <div className="space-y-5">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            Kitűzve ({pinnedItems.length}/{maxItems})
          </h4>
          {pinnedItems.length === 0 ? (
            <p className="text-sm text-ink-400 dark:text-ink-500">
              Nincs kitűzött menüpont — adj hozzá az alábbi listából.
            </p>
          ) : (
            <ul className="space-y-1">
              {pinnedItems.map((item, index) => (
                <li
                  key={item.to}
                  className="flex items-center gap-2 rounded-xl border border-ink-100 px-3 py-2 dark:border-ink-800"
                >
                  <item.icon className="h-4 w-4 flex-shrink-0 text-ink-400 dark:text-ink-500" />
                  <span className="flex-1 truncate text-sm text-ink-700 dark:text-ink-100">
                    {item.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`${item.text} feljebb`}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 dark:text-ink-500 ${
                      index === 0
                        ? "opacity-40"
                        : "hover:bg-slate-100 dark:hover:bg-ink-800"
                    }`}
                  >
                    <PiArrowUpLight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === pinnedItems.length - 1}
                    aria-label={`${item.text} lejjebb`}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 dark:text-ink-500 ${
                      index === pinnedItems.length - 1
                        ? "opacity-40"
                        : "hover:bg-slate-100 dark:hover:bg-ink-800"
                    }`}
                  >
                    <PiArrowDownLight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.to)}
                    aria-label={`${item.text} eltávolítása`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <PiXLight className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            Hozzáadható menüpontok
          </h4>
          {atLimit && (
            <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
              Elérted a napi zóna {maxItems} elemes limitjét — távolíts el
              egyet az új kitűzéséhez.
            </p>
          )}
          <div className="space-y-3">
            {groupedAvailable.map((group) => (
              <div key={group.label}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  {group.label}
                </p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li
                      key={item.to}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-ink-800"
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0 text-ink-400 dark:text-ink-500" />
                      <span className="flex-1 truncate text-sm text-ink-700 dark:text-ink-100">
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => add(item.to)}
                        disabled={atLimit}
                        title={
                          atLimit
                            ? `Elérted a ${maxItems} elemes limitet`
                            : undefined
                        }
                        aria-label={`${item.text} kitűzése`}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-brand-600 dark:text-brand-300 ${
                          atLimit
                            ? "opacity-40"
                            : "hover:bg-brand-50 dark:hover:bg-brand-950/40"
                        }`}
                      >
                        <PiPlusLight className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {groupedAvailable.length === 0 && (
              <p className="text-sm text-ink-400 dark:text-ink-500">
                Minden elérhető menüpont ki van tűzve.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 pt-4 dark:border-ink-800">
          <button
            type="button"
            onClick={handleReset}
            className="text-sm font-medium text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-100"
          >
            Alapértelmezett visszaállítása
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Kész
          </button>
        </div>
      </div>
    </Modal>
  );
}
