# Sidebar "napi zóna" testreszabása Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop sidebar's always-visible "napi zóna" (currently 6 hardcoded nav items) user-configurable — pin/unpin any nav item, reorder with up/down buttons, persisted per-user in `localStorage`.

**Architecture:** A module-level `PIN_REGISTRY` (derived from the existing `mobileGroups` data) catalogs every pinnable item. `Sidebar.js` holds `pinnedPaths` (ordered array of route strings) in state, seeded from `localStorage` (falling back to the current 6-item default) and persisted on every change. A new `NapiZonaEditorModal.js` component, opened from a pencil icon in the napi zóna header, lets the user check/uncheck and reorder items against this registry.

**Tech Stack:** React 17 (CRA), react-router-dom v5, Tailwind (pre-built `tailwind.css`, no new classes used here — all styling below reuses classes already compiled), `react-icons/pi`, existing `Modal.js`/`confirmDialog()` utilities.

**Spec:** `docs/superpowers/specs/2026-07-26-sidebar-napi-zona-testreszabas-design.md`

## Global Constraints

- Per-user (not company-wide) customization, persisted in `localStorage` under `sidebar-pins-${user.id}` — same pattern as the existing `sidebar-groups-${user.id}` key.
- Desktop sidebar only — the mobile bottom nav (`mobileDirectLinks`/`mobileGroups`) is untouched.
- Maximum 8 pinned items.
- Default pins for a first-time/never-customized user: `/admin/dashboard`, `/admin/karbantartasok`, `/admin/bejelentesek`, `/admin/koltsegek`, `/admin/flottakovetes`, `/admin/tachograf` (exact current order) — existing users must see zero visual change until they open the editor.
- **No jest/testing-library infrastructure exists in this repo** (confirmed: no `.test.js` files, `npm test` scaffolding is unused). Per this repo's own established convention (see `CLAUDE.md` "Workflow notes for Claude Code" and the many documented live-Playwright verification passes), verification in this plan is: (a) `npx eslint <file>` after each code change as a fast syntax/hook-deps check, and (b) one comprehensive live Playwright pass at the end of the feature (Task 4), against the already-running local dev server and local MySQL DB — not fabricated unit tests.
- Admin-only items (Devizák, Jogosultságok, Listák, Ajánlatkérések) must only be selectable/visible to admin users in the editor, and must be filtered out of rendering even if present in a stale/foreign `pinnedPaths` array for a non-admin.

---

### Task 1: Pin registry + default pins data layer in `Sidebar.js`

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js` (insert new module-level constants between the existing `mobileGroups` array and `TIPUS_LABEL`)

**Interfaces:**
- Consumes: the existing `mobileGroups` array (already defined in this file, each group is `{key, label, icon, items: [{to, icon, text, adminOnly?} | {type:"divider", label} | {type:"action", action, icon, text}]}`).
- Produces (for Tasks 2 and 3): `PIN_REGISTRY` — a flat array of `{to, icon, text, group, adminOnly?}` objects, one per pinnable nav item. `DEFAULT_PIN_PATHS` — an ordered array of 6 route strings.

- [ ] **Step 1: Insert the registry-building code**

Open `src/components/Sidebar/Sidebar.js`. Find this exact block (the end of the `mobileGroups` array, immediately followed by `TIPUS_LABEL`):

```js
];

const TIPUS_LABEL = {
```

Replace it with:

```js
];

// A desktop sidebar "napi zóna" (a görgethető nav-lista fölötti, mindig
// látható gyorselérési sáv) testreszabható: a felhasználó eldöntheti, mely
// menüpontok kerüljenek bele és milyen sorrendben (ld. docs/superpowers/specs/
// 2026-07-26-sidebar-napi-zona-testreszabas-design.md). A `PIN_REGISTRY` a
// meglévő `mobileGroups`-ból származik (minden valódi link-elemét átveszi,
// dividerek/action-ök nélkül), plusz 2, jelenleg csak desktopon élő elem
// (Főmenü, Devizák) kézzel hozzáfűzve — tudatosan egy harmadik, kézzel
// karbantartott nav-forrás, ugyanaz az elfogadott drift-kockázat, mint a
// mobil/desktop nav-taxonómia meglévő kettőssége (ld. a fájl korábbi
// megjegyzéseit).
const EXTRA_PINNABLE_ITEMS = [
  {
    to: "/admin/dashboard",
    icon: PiSquaresFourLight,
    text: "Főmenü",
    group: "Áttekintés",
  },
  {
    to: "/admin/devizak",
    icon: PiCoinsLight,
    text: "Devizák",
    group: "Pénzügyek",
    adminOnly: true,
  },
];

// A mobil "Csapat" fül a Partnereket (Ügyfelek/Helyszínek) egy divider mögé
// rejti a saját fülébe, és a Pénzforgalom a mobil "Flotta" fülben él — a
// desktop taxonómia viszont ezeket külön ("Partnerek", "Pénzügyek")
// csoportba sorolja. Ez a két felülírás igazítja a napi zóna szerkesztő
// kategória-címkéit a desktop hierarchiához, hogy ne egy mobil-only
// csoportosítás látszódjon a picker-ben.
const GROUP_LABEL_OVERRIDES = {
  "/admin/koltsegek": "Pénzügyek",
};

function buildPinRegistry() {
  const fromGroups = mobileGroups.flatMap((group) => {
    let currentLabel = group.label;
    return group.items
      .map((item) => {
        if (item.type === "divider") {
          currentLabel = item.label;
          return null;
        }
        if (!item.to) return null;
        return {
          ...item,
          group: GROUP_LABEL_OVERRIDES[item.to] || currentLabel,
        };
      })
      .filter(Boolean);
  });
  return [...EXTRA_PINNABLE_ITEMS, ...fromGroups];
}
const PIN_REGISTRY = buildPinRegistry();

// Alapértelmezett napi zóna — a jelenlegi, korábban kódban rögzített 6 elem,
// jelenlegi sorrendben. Ez biztosítja, hogy a testreszabás bevezetése
// meglévő felhasználóknak ne változtasson semmit, amíg meg nem nyitják a
// szerkesztőt.
const DEFAULT_PIN_PATHS = [
  "/admin/dashboard",
  "/admin/karbantartasok",
  "/admin/bejelentesek",
  "/admin/koltsegek",
  "/admin/flottakovetes",
  "/admin/tachograf",
];

const TIPUS_LABEL = {
```

- [ ] **Step 2: Verify with eslint**

Run: `npx eslint src/components/Sidebar/Sidebar.js`
Expected: no errors (warnings about unrelated browserslist/babel packages in stderr are pre-existing and fine; there must be no `error` entries and no new warnings pointing at lines you just added).

- [ ] **Step 3: Sanity-check the registry shape by counting real link entries**

The full registry can't be evaluated standalone (the file is a JSX React component, not a requireable plain module), but the input it's built from can be counted directly. Run:

```bash
grep -oE '\{ to: "/admin/[a-zA-Z-]+"' src/components/Sidebar/Sidebar.js | sort -u | wc -l
```

Expected: at least 20 (every distinct `{ to: "/admin/..." }`-shaped literal across `mobileGroups` and the newly-added `EXTRA_PINNABLE_ITEMS` — this is a loose lower-bound sanity check, not an exact count, since some items use multi-line object literals this single-line pattern won't match; its purpose is just to confirm the new block didn't accidentally get inserted somewhere that breaks the surrounding array/object syntax, which `npx eslint` in Step 2 already confirmed more rigorously). If the count is 0 or the command errors, re-check that Step 1's edit was applied correctly (the file should still parse as valid JS, which Step 2 already verifies).

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar/Sidebar.js
git commit -m "feat(sidebar): add pin registry and default pins data layer"
```

---

### Task 2: `NapiZonaEditorModal` component

**Files:**
- Create: `src/components/Sidebar/NapiZonaEditorModal.js`

**Interfaces:**
- Consumes: `components/UI/Modal.js` (props: `open`, `onClose`, `title`, `children`, `maxWidth`), `utils/confirm.js`'s `confirmDialog(message, {title, danger, confirmLabel})` (returns `Promise<boolean>`).
- Produces (for Task 3): default export `NapiZonaEditorModal` with props:
  - `open: boolean`
  - `onClose: () => void`
  - `registry: Array<{to, icon, text, group, adminOnly?}>` (i.e. `PIN_REGISTRY` from Task 1)
  - `pinnedPaths: string[]` (ordered `to` values)
  - `onChange: (nextPinnedPaths: string[]) => void`
  - `maxItems: number`
  - `isAdmin: boolean`
  - `defaultPaths: string[]` (i.e. `DEFAULT_PIN_PATHS` from Task 1)

- [ ] **Step 1: Create the component file**

Create `src/components/Sidebar/NapiZonaEditorModal.js`:

```jsx
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
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-ink-500 dark:hover:bg-ink-800"
                  >
                    <PiArrowUpLight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === pinnedItems.length - 1}
                    aria-label={`${item.text} lejjebb`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent dark:text-ink-500 dark:hover:bg-ink-800"
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
                      className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-ink-800/60"
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
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-brand-600 hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent dark:text-brand-300 dark:hover:bg-brand-950/40"
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
```

- [ ] **Step 2: Verify with eslint**

Run: `npx eslint src/components/Sidebar/NapiZonaEditorModal.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar/NapiZonaEditorModal.js
git commit -m "feat(sidebar): add napi zóna editor modal component"
```

---

### Task 3: Wire pinning state + editor into `Sidebar.js`

**Files:**
- Modify: `src/components/Sidebar/Sidebar.js`

**Interfaces:**
- Consumes: `PIN_REGISTRY`, `DEFAULT_PIN_PATHS` (Task 1), `NapiZonaEditorModal` (Task 2).
- Produces: the napi zóna box now renders `pinnedPaths` dynamically instead of 6 hardcoded `<NavItem>`s; a pencil button opens `NapiZonaEditorModal`.

- [ ] **Step 1: Add the `PiPencilSimpleLight` icon import**

Find:

```js
  PiIdentificationCardLight,
  PiFileTextLight,
  PiClipboardTextLight,
} from "react-icons/pi";
```

Replace with:

```js
  PiIdentificationCardLight,
  PiFileTextLight,
  PiClipboardTextLight,
  PiPencilSimpleLight,
} from "react-icons/pi";
```

- [ ] **Step 2: Import the new modal component**

Find:

```js
import PiaciArakPanel from "components/Sidebar/PiaciArakPanel.js";
import { fetchAction } from "utils/fetchAction";
```

Replace with:

```js
import PiaciArakPanel from "components/Sidebar/PiaciArakPanel.js";
import NapiZonaEditorModal from "components/Sidebar/NapiZonaEditorModal.js";
import { fetchAction } from "utils/fetchAction";
```

- [ ] **Step 3: Add `pinEditorOpen` state**

Find:

```js
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
```

Replace with:

```js
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [pinEditorOpen, setPinEditorOpen] = React.useState(false);
```

- [ ] **Step 4: Add `pinnedPaths` state + localStorage persistence**

Find:

```js
  const toggleGroup = (key) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
```

Replace with:

```js
  const toggleGroup = (key) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  // A napi zóna kitűzött elemeinek sorrendje, ugyanazzal a felhasználónkénti
  // localStorage-perzisztenciával, mint az `openGroups` fentebb. Nincs
  // mentett érték esetén (új fiók, vagy még nem nyitotta meg a szerkesztőt)
  // a `DEFAULT_PIN_PATHS` a visszaesés — ld. a fájl tetején lévő komment.
  const [pinnedPaths, setPinnedPaths] = React.useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(`sidebar-pins-${user?.id}`) || "null",
      );
      if (Array.isArray(stored) && stored.length > 0) return stored;
    } catch (e) {
      // ignore corrupt/legacy localStorage érték
    }
    return DEFAULT_PIN_PATHS;
  });
  React.useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(
      `sidebar-pins-${user.id}`,
      JSON.stringify(pinnedPaths),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedPaths]);
```

- [ ] **Step 5: Compute `badgeByPath` and `pinnedItems` before the render helpers**

Find:

```js
  const NavItem = ({ to, icon: Icon, text, subPath, badge }) => {
```

Insert immediately before it:

```js
  // Jelvény-számok a kitűzött elemekhez — csak a két, ma is jelvényezett
  // menüponthoz (Bejelentések, Beérkezett dokumentumok) van értelmes érték,
  // minden más kitűzött elemnél `undefined` marad (a `NavItem` `badge > 0`
  // ellenőrzése ezt már ma is csendben kezeli).
  const badgeByPath = {
    "/admin/bejelentesek": nyitottBejelentesek.length,
    "/admin/beerkezettDokumentumok": beerkezettDokSzam,
  };

  // A napi zóna ténylegesen renderelt elemei — a `pinnedPaths` sorrendjében,
  // a `PIN_REGISTRY`-ből feloldva. Védekező szűrés: ha egy mentett `to` már
  // nem szerepel a registryben (pl. jövőbeli route-törlés), vagy admin-only
  // elemre mutat egy időközben lefokozott felhasználónál, az adott bejegyzés
  // csendben kimarad.
  const pinnedItems = pinnedPaths
    .map((to) => PIN_REGISTRY.find((item) => item.to === to))
    .filter((item) => item && (!item.adminOnly || isAdmin));

  const NavItem = ({ to, icon: Icon, text, subPath, badge }) => {
```

- [ ] **Step 6: Replace the hardcoded napi zóna JSX with the dynamic render**

Find this exact block:

```jsx
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="sticky top-0 z-10 mb-1 rounded-2xl bg-brand-50/70 p-2 backdrop-blur-sm dark:bg-brand-950/40">
            <ul className="space-y-0.5">
              <NavItem
                to="/admin/dashboard"
                icon={PiSquaresFourLight}
                text="Főmenü"
              />
              <NavItem
                to="/admin/karbantartasok"
                icon={PiWrenchLight}
                text="Karbantartások"
              />
              <NavItem
                to="/admin/bejelentesek"
                icon={PiChatCircleTextLight}
                text="Bejelentések"
                badge={nyitottBejelentesek.length}
              />
              <NavItem
                to="/admin/koltsegek"
                icon={PiCoinsLight}
                text="Pénzforgalom"
              />
              <NavItem
                to="/admin/flottakovetes"
                icon={PiMapTrifoldLight}
                text="Flottakövetés"
              />
              <NavItem
                to="/admin/tachograf"
                icon={PiIdentificationCardLight}
                text="Tachográf"
              />
            </ul>
          </div>
```

Replace with:

```jsx
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="sticky top-0 z-10 mb-1 rounded-2xl bg-brand-50/70 p-2 backdrop-blur-sm dark:bg-brand-950/40">
            <div className="mb-1 flex items-center justify-between px-1.5 pb-1 pt-0.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-700/70 dark:text-brand-300/70">
                Napi zóna
              </span>
              <button
                type="button"
                onClick={() => setPinEditorOpen(true)}
                title="Napi zóna testreszabása"
                aria-label="Napi zóna testreszabása"
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-brand-700/60 transition-colors duration-200 hover:bg-white/60 hover:text-brand-700 dark:text-brand-300/60 dark:hover:bg-ink-800/60 dark:hover:text-brand-300"
              >
                <PiPencilSimpleLight className="h-3.5 w-3.5" />
              </button>
            </div>
            <ul className="space-y-0.5">
              {pinnedItems.map((item) => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  text={item.text}
                  badge={badgeByPath[item.to]}
                />
              ))}
            </ul>
          </div>
```

- [ ] **Step 7: Render the editor modal**

Find:

```jsx
      <NotificationDropdown
        notifications={allNotifications}
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onDismiss={handleDismiss}
        onDismissAll={handleDismiss}
      />
    </>
  );
}
```

Replace with:

```jsx
      <NotificationDropdown
        notifications={allNotifications}
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onDismiss={handleDismiss}
        onDismissAll={handleDismiss}
      />
      <NapiZonaEditorModal
        open={pinEditorOpen}
        onClose={() => setPinEditorOpen(false)}
        registry={PIN_REGISTRY}
        pinnedPaths={pinnedPaths}
        onChange={setPinnedPaths}
        maxItems={8}
        isAdmin={isAdmin}
        defaultPaths={DEFAULT_PIN_PATHS}
      />
    </>
  );
}
```

- [ ] **Step 8: Verify with eslint**

Run: `npx eslint src/components/Sidebar/Sidebar.js`
Expected: no errors. In particular, double-check there are no "used before defined" or `react-hooks/exhaustive-deps` errors (there should only be the pre-existing, already-suppressed ones via the existing `eslint-disable-next-line` comments this file already uses in several places).

- [ ] **Step 9: Commit**

```bash
git add src/components/Sidebar/Sidebar.js
git commit -m "feat(sidebar): wire customizable napi zóna pins into Sidebar"
```

---

### Task 4: Live verification (Playwright, local dev server + local DB)

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Confirm the CRA dev server is running**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000`
Expected: `200`. If not `200`, start it: `npm start` (from repo root) and wait for it to report compiled successfully before continuing.

- [ ] **Step 2: Create a real local admin session row**

This app resolves identity server-side from the `sessions` table (see `CLAUDE.md` "Session & permission model") — Sidebar.js's own data fetches (`getFuggoJarmuValtasok`, `getNyitottBejelentesek`, etc.) need a valid session to return real data, even though the pin feature itself is `localStorage`-only.

Run:

```bash
mysql -uroot kamion -e "DELETE FROM sessions WHERE token = 'napi-zona-plan-test-token';"
mysql -uroot kamion -e "INSERT INTO sessions (token, felhasznalo_tipus, felhasznalo_id, lejarat) VALUES ('napi-zona-plan-test-token', 'admin', 1, DATE_ADD(NOW(), INTERVAL 30 DAY));"
```

- [ ] **Step 3: Open the app with Playwright, authenticated as admin id 1**

Use the Playwright MCP tools (`browser_navigate`, `browser_evaluate`, etc.):

1. Navigate to `http://127.0.0.1:3000/admin/dashboard` (use `127.0.0.1`, not `localhost` — this machine runs an unrelated app on `[::1]:3000`, per `CLAUDE.md`).
2. Before/immediately after the first navigation, run this in the page via `browser_evaluate`:

```js
localStorage.setItem("sessionToken", "napi-zona-plan-test-token");
localStorage.setItem(
  "user",
  JSON.stringify({
    id: 1,
    ceg_id: 1,
    is_admin: true,
    admin: true,
    szerepkor: "admin",
    name: "Szikora Ágoston",
    email: "sziago12@gmail.com",
  }),
);
```

3. Navigate again (or reload) to `http://127.0.0.1:3000/admin/dashboard` so the app picks up the stored session.
4. Take a snapshot/screenshot. Expected: the sidebar's napi zóna box shows a small "Napi zóna" label plus a pencil icon, and the same 6 default items as before (Főmenü, Karbantartások, Bejelentések, Pénzforgalom, Flottakövetés, Tachográf), in that order — this confirms Task 1-3 didn't change default behavior.

- [ ] **Step 4: Open the editor and verify contents**

1. Click the pencil icon in the napi zóna box.
2. Expected: a modal titled "Napi zóna testreszabása" opens, showing "Kitűzve (6/8)" with the 6 default items (each with ↑/↓/✕ buttons, the first item's ↑ disabled, the last item's ↓ disabled), and "Hozzáadható menüpontok" below with category sub-headers (Áttekintés should be empty since Főmenü is already pinned; Flotta/Fuvarok/Csapat/Partnerek/Pénzügyek/Rendszer should list their remaining items). Confirm "Devizák" appears under "Pénzügyek" (admin session, so it should be visible) and "Jogosultságok"/"Listák"/"Ajánlatkérések" appear under "Rendszer".

- [ ] **Step 5: Remove an item and add a different one**

1. Click the ✕ button on "Tachográf" in the "Kitűzve" list.
2. Expected: it disappears from "Kitűzve" (now 5/8) and reappears under "Csapat" in "Hozzáadható menüpontok".
3. Click the "+" button next to "Kamionok" (under "Flotta" in "Hozzáadható menüpontok").
4. Expected: "Kamionok" moves to the bottom of the "Kitűzve" list (now 6/8), disappears from "Hozzáadható menüpontok".

- [ ] **Step 6: Reorder with up/down buttons**

1. Click the ↑ button next to the newly-added "Kamionok" row (currently last) twice.
2. Expected: "Kamionok" moves up two positions in the "Kitűzve" list, confirmed via snapshot showing the new order.

- [ ] **Step 7: Close the modal and confirm the napi zóna box reflects the change**

1. Click "Kész".
2. Expected: the napi zóna box in the sidebar (behind the now-closed modal) shows 6 items, no longer including "Tachográf", now including "Kamionok" at its new position — matching exactly what Step 6 showed inside the modal.

- [ ] **Step 8: Confirm persistence across reload**

1. Reload the page (`http://127.0.0.1:3000/admin/dashboard`).
2. Expected: the napi zóna box still shows the customized 6 items in the same order as Step 7 (not reset to the original 6 defaults) — confirms `localStorage` persistence works.

- [ ] **Step 9: Verify the 8-item limit**

1. Open the editor again. Add items from "Hozzáadható menüpontok" one at a time until "Kitűzve" reaches 8/8.
2. Expected: once at 8/8, every remaining "+" button in "Hozzáadható menüpontok" becomes disabled, and the amber warning text "Elérted a napi zóna 8 elemes limitjét — távolíts el egyet az új kitűzéséhez." appears above that section.

- [ ] **Step 10: Verify "Alapértelmezett visszaállítása"**

1. Click "Alapértelmezett visszaállítása".
2. Expected: a confirmation dialog appears (title "Alapértelmezett visszaállítása", a blue non-destructive "Visszaállítás" button per `danger: false`).
3. Confirm it.
4. Expected: "Kitűzve" resets to exactly the original 6 default items in the original order (Főmenü, Karbantartások, Bejelentések, Pénzforgalom, Flottakövetés, Tachográf).

- [ ] **Step 11: Verify badges still work on a pinned item**

1. Close the editor. Confirm via a direct database check whether there are any open bejelentés rows for `ceg_id=1`: `mysql -uroot kamion -e "SELECT COUNT(*) FROM bejelentesek WHERE admin=1 AND allapot NOT IN ('lezart') AND torolt <> 'I';"` (adjust the exact open-status condition to whatever `getNyitottBejelentesek` in `backend/interface/bejelentesekInterface.php` actually uses — read that method first to match its condition exactly).
2. If the count is 0, temporarily insert one open bejelentés row for a real sofőr under admin 1 (or reuse an existing one if present), reload the dashboard, and confirm the red badge number next to "Bejelentések" in the napi zóna matches. Clean up any row you inserted afterward.

- [ ] **Step 12: Verify dark mode**

1. Toggle dark mode (moon/sun icon in the sidebar header, or the mobile action item — either works since the toggle is a single shared `isDark` prop).
2. Re-open the napi zóna editor modal.
3. Take a screenshot. Expected: modal background, text, borders, and button colors all render in dark-mode-appropriate colors (no white/unstyled flashes) — this is a visual check, compare against another existing modal (e.g. open any other admin CRUD "+ Új" modal) for the same dark-mode look and feel.

- [ ] **Step 13: Clean up test session**

```bash
mysql -uroot kamion -e "DELETE FROM sessions WHERE token = 'napi-zona-plan-test-token';"
```

Also, in the browser, clear the test `localStorage` pin key if you don't want the real account's pin customization from this test run to persist:

```js
localStorage.removeItem("sidebar-pins-1");
```

(Only do this if you don't want to keep the customized state from testing — the real user's account is `admin.id=1`.)

- [ ] **Step 14: No commit for this task** (verification only, no file changes)

---

### Task 5: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (repo root)

**Interfaces:** none (documentation only)

- [ ] **Step 1: Add a new documented section**

Find the `## Workflow notes for Claude Code` heading near the end of `CLAUDE.md`. Insert a new `###`-level section immediately **before** it (i.e. after whatever section currently precedes "Workflow notes"), with this content:

```markdown
### Sidebar "napi zóna" testreszabás (2026-07-26)

A desktop sidebar (`src/components/Sidebar/Sidebar.js`) tetején élő, mindig
látható "napi zóna" mostantól felhasználónként testreszabható — korábban 6,
kódban rögzített menüpontot mutatott. `PIN_REGISTRY` (a fájl teteje, a
meglévő `mobileGroups`-ból származtatva, plusz 2 kézzel hozzáfűzött elem —
Főmenü, Devizák) katalogizálja az összes kitűzhető menüpontot; a kitűzött
elemek sorrendje `localStorage`-ban, `sidebar-pins-${user.id}` kulcs alatt
perzisztál, ugyanúgy mint a meglévő `openGroups` csoport-nyitottság. Max 8
elem tűzhető ki. Az `src/components/Sidebar/NapiZonaEditorModal.js` adja a
pip/nyíl-alapú szerkesztő felületet (`Modal.js`-re épülve), a napi zóna doboz
jobb felső sarkában lévő ceruza-ikonról nyitva. Kitűzés nem távolítja el az
elemet az eredeti csoportjából — másodpéldány, nem áthelyezés, ugyanaz az elv,
mint a Pénzforgalom napi zóna + Pénzügyek csoport kettősségénél. Csak a
desktop sidebart érinti, a mobil alsó navigáció változatlan.

**Tudatosan elfogadott drift-kockázat**: a `PIN_REGISTRY` egy harmadik,
kézzel karbantartott nav-forrás a mobil `mobileGroups` és a hardcoded
desktop csoport-JSX mellett — ha egy jövőbeli route átnevezésre/törlésre
kerül, mindhárom helyet frissíteni kell.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document customizable sidebar napi zóna pins"
```
