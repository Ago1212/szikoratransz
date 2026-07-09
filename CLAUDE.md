# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Szikora Transz flottakezelő (fleet management) system: a React admin/driver UI on top of a plain PHP (no framework) REST-ish API, backed by MySQL/MariaDB via PDO. Built on the Notus React (Creative Tim) Tailwind admin template — most of `src/components`, `src/assets`, `src/layouts` are template scaffolding, not app-specific code.

Domain modules (mirrored across frontend views, backend interfaces, and API actions): kamion (trucks), potkocsi (trailers), soforok (drivers), karbantartasok (maintenance records), bejelentesek (incident reports — **backend is stub/fake data only, see "Database schema" below**), files, email, esemenyek/egyediHataridok (calendar events / custom deadlines — computed on the fly, no dedicated table).

## Commands

Frontend (run from repo root):
- `npm start` — CRA dev server (localhost:3000)
- `npm run build` — production build into `build/` (also strips template license comments via `gulp licenses`)
- `npm test` — CRA/Jest test runner (no test files currently exist in the repo)
- `npm run build:tailwind` (or `npx tailwindcss -i ./src/assets/styles/index.css -o ./src/assets/styles/tailwind.css`) — rebuild `src/assets/styles/tailwind.css` from `src/assets/styles/index.css`. **This is NOT automatic.** `src/index.js` imports the pre-built `tailwind.css` directly (not `index.css`), so CRA does not recompile Tailwind on the fly. Any new utility class used in JSX must be followed by this rebuild, or it silently won't exist in the stylesheet (e.g. an element with `hidden md:flex` can end up permanently hidden if `.md\:flex` was never compiled in).

Backend (PHP, no build step, no composer dependencies):
- `cd backend && php8.2 -S localhost:8000` — run the API locally (see discrepancy note below)

There is no linter config beyond CRA's default `eslintConfig: { "extends": "react-app" }`, and no PHP test suite.

## Architecture

### Frontend routing
`src/index.js` mounts three independent layouts under `react-router-dom` v5: `layouts/Admin.js`, `layouts/User.js`, `layouts/Auth.js`, plus standalone `views/Landing.js` and `views/Profile.js`. Each layout owns its own `<Switch>` of pages from `src/views/{admin,user,auth}/`. There's no route guard component — auth/role gating happens ad hoc inside pages (check `localStorage`/props usage in view files, not a shared context).

**The real login URL is `/auth/login`** (rendered by `layouts/Auth.js`, which redirects bare `/auth` to it). `layouts/Admin.js` also declares a `<Route path="/login" exact component={LoginPage} />` inside its own `<Switch>`, but that's dead code — `Admin` only ever mounts for paths starting with `/admin` (see the top-level `<Route path="/admin" component={Admin} />` in `src/index.js`), so a bare `/login` URL never reaches it and instead falls through to the catch-all `<Redirect from="*" to="/" />` (Landing page). Don't be misled by it when tracing the login flow, and don't "fix" it into a real redirect without checking whether that's actually wanted — it's unreachable, not broken.

`views/auth/Login.js` branches its entire render on `useMediaQuery({ maxWidth: 1023 })` (the same cutoff as the original design's `lg:` branding-column breakpoint): under 1024px it's a full-bleed dark single-card view; at `lg`+ it's the original two-column light layout with the branding copy. These are two genuinely different JSX trees (not one tree reshaped by Tailwind breakpoints) because the page background color, card background/blur, and whether the branding column exists at all all differ structurally, not just by size — don't try to collapse them back into a shared responsive tree.

**Stacking-context gotcha in `layouts/Auth.js`**: `AuthNavbar` (the floating "Főoldal" pill top-left) is `position: absolute; z-index: 50`, a sibling of the routed `<Switch>` content. That `<Switch>` used to be wrapped in `<div className="relative z-10">` — the `z-10` on that wrapper (not `relative` alone — `relative` without an explicit `z-index` doesn't do this) creates its own stacking context, which means everything inside it, including `Login.js`'s own `fixed inset-0 z-[9999]` full-screen overlay, gets flattened to a single z-10 layer from the *outside* stacking context's point of view. Since 10 < 50, `AuthNavbar` always painted on top of Login's supposedly-opaque overlay, no matter how high Login's own z-index was set — a real bug that predates this session's changes but only became visible once Login became a true full-bleed overlay. Fixed by dropping the `z-10` (kept `relative`, which is still needed to stack this div above the section's own absolutely-positioned background/grain-overlay divs via plain DOM order — no `z-index` required for that). If a future full-screen overlay component (another modal-like page, a lightbox, etc.) seems to render *behind* something with a much lower z-index, check every ancestor for an unnecessary `z-*` class creating an intermediate stacking context — the fix is almost always to remove that ancestor's z-index, not to raise the overlay's.

### API communication
All API calls funnel through two helpers in `src/utils/`:
- `fetchAction(action, payload)` — POSTs `{ authHash, action, ...payload }` as JSON to `api.php` and returns the parsed JSON response `{ success, ... }`.
- `downloadFileAction(id, filename)` — same pattern, but decodes a base64 file from the response and triggers a browser download.

The API base URL and `authHash` are hardcoded client-side constants in each of these files (dev: `http://localhost:8001/api.php`, prod: `https://szikora-transz.hu/backend/api.php`). **Note the dev port mismatch**: `todo.txt` documents running the PHP server on port 8000, but the frontend code points at port 8001 — start PHP accordingly (`php8.2 -S localhost:8001`) or update both `src/utils/*.js` files if changing this.

### Backend API dispatch
Single entrypoint `backend/api.php` decodes the JSON POST body and delegates everything to `ApiHandler` (`backend/ApiHandler.php`). `ApiHandler`:
- Declares every valid action + its required parameters in `getActions()` (a flat action-name → required-fields map).
- `validation()` checks the shared `authHash` (from `backend/config.php`), that the action exists, that required params are present, and does ad hoc email validations.
- `process()` is a large `switch` over `$action` that dispatches to methods on `ApiHandler` itself or to the per-domain interface classes required at the top of the file (`backend/interface/*Interface.php` — one per domain module listed above).

To add a new API action: add it to `getActions()` with its required params, add a `case` in `process()`, and implement the logic either inline in `ApiHandler` or in the relevant `interface/*Interface.php` file.

`backend/db.php` defines `Database::connect()` (PDO/MySQL, DB name `kamion`) with credentials hardcoded in the class — same pattern in `backend/config.php` for the shared `authHash`. There is no `.env`/secrets layer; secrets live directly in these two PHP files.

### Deployment
`genezio.yaml` configures frontend-only deployment (builds via `npm install && npm run build`, publishes `build/`). The PHP backend is deployed separately (see `build/api_proxy.php` and prod URL `https://szikora-transz.hu/backend/api.php`) and isn't managed by the genezio config.

### Database schema (`kamion` MySQL/MariaDB DB)
Inspected directly via `information_schema` (local DB, see "Local dev environment" below). Key facts not obvious from the PHP code alone:

- **Every table uses the `MyISAM` engine, not InnoDB** — so there are **no real foreign-key constraints** anywhere in the schema, even though several index names look like they should be one (`CarNaplo_carId_fkey` on `kamion_karbantartars.kamion_id`, `Car_rendszam_key` on `kamion.rendszam`, `User_email_key` on `user.email`). Referential integrity (`kamion.admin` → `admin.id`, `kamion_karbantartars.kamion_id` → `kamion.id`, `user.kamion` → `kamion.id`, etc.) is convention-only, enforced by application code, never by the DB. Don't assume a delete/update will cascade or get rejected — it won't, either way.
- Those Prisma-style constraint names (PascalCase model names like `Car`, `CarNaplo`, `User` baked into index names that live on snake_case Hungarian tables like `kamion`, `kamion_karbantartars`) are a strong signal this schema was originally scaffolded via Prisma with English model names, then the actual table names were changed to Hungarian later — the old constraint names never got renamed.
- **Soft delete everywhere**: every table has `torolt ENUM('I','N') NOT NULL DEFAULT 'N'` (`I` = igen/deleted, `N` = nem/not deleted). There's no view or trigger hiding deleted rows — every hand-written query must include `WHERE torolt <> 'I'` (or `= 'N'`) itself, or it'll silently include soft-deleted rows.
- **Per-admin ownership**: `kamion`, `potkocsi`, `kamion_karbantartars`, `potkocsi_karbantartars`, `fajlok`, `egyedi_hataridok` all carry an `admin` column pointing at `admin.id` — each admin account owns its own slice of fleet data; nearly every list/get query in `ApiHandler`/interfaces scopes by `WHERE admin = :id`.
- Table purposes, beyond what's in "Domain modules" above:
  - `admin` — the admin/company-user accounts (not "administrator" in a generic sense — this is *the* login table for admin-role users, parallel to `user`).
  - `user` — actually **sofőrök (drivers)**, despite the generic name; `user.admin` → owning admin, `user.kamion` → their currently assigned `kamion.id`.
  - `kamion.potkocsi` is `NOT NULL` — the schema assumes every truck row references exactly one trailer row at all times (no "no trailer attached" state representable without pointing at some `potkocsi` row).
  - `fajlok` — generic polymorphic attachments table: `tabla` enum (`kamion`/`potkocsi`/`sofor`/`egyeb`/`admin`/`karbantartasok`) + `rowid` (indexed) says which row in which domain table the file belongs to. This is what `getFiles`/`fileUpload`/`deleteFile` actually use.
  - `kamion_fajlok` / `potkocsi_fajlok` — an older, differently-shaped per-domain file table (`session_id`/`client_id`/`fh` columns), currently **0 rows in both** — looks superseded by the generic `fajlok` table above; don't build new file-upload features against these.
  - `egyedi_hataridok` — custom one-off deadlines (`admin`, `leiras`, `datum`).
  - **There is no `bejelentesek` (incident reports) table at all.** `backend/interface/bejelentesekInterface.php` returns hardcoded fake PHP-array data regardless of input, and the `getMessages`/`sendMessage` actions the frontend chat UI (`CardBejelentesek.js`) calls **don't exist anywhere in `ApiHandler::getActions()`/`process()`**. The whole Bejelentések feature — list and the message thread inside it — is frontend-only scaffolding with no backing data; any UI work there is necessarily cosmetic until real backend/DB support is built.
- **The event calendar has no dedicated table.** `ApiHandler::getEsemenyek()` computes the feed on every request by scanning expiry-date columns across `user` (jogsi/szemelyi/gki/adr lejárat), `kamion`/`potkocsi` (műszaki/poroltó/adr/tachográf/emelőhátfal/kötélzet/kaszkó lejárat, plus insurance payment schedules run through `calculateNextPaymentDate()`), then appending `egyedi_hataridok` rows and `kamion_karbantartars`/`potkocsi_karbantartars` maintenance dates — all merged into one flat array. There's nothing to migrate/query directly for "events"; to add a new event source, add another block to `getEsemenyek()`.

### Shared table/list component
Every list page (Kamionok, Potkocsi, Soforok, Fajlok, Esemenyek, Bejelentesek, Karbantartasok) renders through one shared component: `src/components/UI/DataTable.js`. The per-domain `src/components/Table/CardTableFor*.js` files are thin wrappers that just supply `columns`/`rows` — they don't own any layout/styling. `DataTable.js` renders two variants: a card list on mobile (`md:hidden`) and a real `<table>` on desktop (`hidden md:block`). Fix width/spacing/behavior once in `DataTable.js` and it propagates to every list page at once.

### Mobile navigation
`components/Sidebar/Sidebar.js` renders two independent navs, not one that toggles: a desktop-only sidebar (`hidden md:flex`, always expanded, no off-canvas/drawer behavior anymore) and a separate always-visible bottom bar for mobile (`md:hidden`, fixed to the viewport bottom). The bar mixes two kinds of tabs: direct links (`mobileDirectLinks` — Főmenü, Saját adatok: always one tap away, no nesting) and group tabs (`mobileGroups` — Járművek, Alkalmazottak, Egyéb, mirroring the sidebar's section headers) plus a small icon-only logout button. Tapping a group tab expands a short picker list upward, directly above the bar (via `max-h-0` → `max-h-64` transition, not mount/unmount) rather than opening a full-screen menu. `layouts/Admin.js`'s content wrapper reserves bottom padding (`pb-16`) so this bar never covers page content.

### Mobile calendar (Dashboard)
`components/Cards/CardCalender.js` branches its entire render on `isMobile` (via `react-responsive`), not just CSS: on mobile it shows a month-grid-only `react-big-calendar` (`views={["month"]}`, no other views, so the view-switch buttons don't even render) with `selectable="ignoreEvents"` + `onSelectSlot`/`onDrillDown` both wired to a single `setSelectedDate` — this is deliberate, since providing `onDrillDown` fully replaces RBC's default "navigate to Day view" behavior, keeping the calendar pinned to month view forever. The selected day's events render in a plain list right below the calendar (`dayPropGetter` adds a `rbc-day-selected` class for the highlight). Desktop keeps the original always-was full view-switching calendar untouched in the same file's second return branch.

### Mobile forms (no popup)
`components/UI/Modal.js` branches on `isMobile` too: desktop keeps the classic fixed-overlay dialog; mobile renders the same content as a **plain in-flow card** (no backdrop, no `fixed`) at whatever point in the JSX tree the call site puts `<Modal>` (all 4 current call sites — Karbantartasok, CardTableForEsemenyek, CardTableForTervezettKarbantartasok, CardTableForPotkocsiTervezettKarbantartasok — put it after their table/list, so opening it means scrolling down; a `scrollIntoView` on open compensates for that).

**Non-obvious browser gotcha hit while building this, and how the final fix is actually structured** — worth reading before touching mobile bottom-clearance again:
- A trailing `margin-bottom` on the last in-flow child of a scrolling container is *not* counted in that container's `scrollHeight` (browsers exclude margins from the scrolling-area box calculation). `mb-6`, `mb-24`, even `mb-96` on a trailing element all produce the *exact same* `scrollHeight` — margin never fixes this, no matter how big.
- A **real sibling block with an explicit height** (e.g. `<div className="h-20" />`, not padding/margin) placed directly after the content that might overflow is what actually reserves usable scroll space — but *only* if it's added **inside the same box whose content might overflow**.
- That "inside" qualifier matters because of a second, separate quirk: page roots built with `h-full` + `flex-col` (used deliberately on Dashboard.js and Karbantartasok.js so DataTable/CardCalender can fill remaining vertical space when content is short) **cap their own rendered height** at the parent's height when `overflow` is left at the default `visible` — so a sibling spacer placed *outside* that box (e.g. a global one in `layouts/Admin.js`, after `<Switch>`) never gets pushed down by that box's own overflow and does nothing for it.
- Net result — **two separate fixes, both still in place, each covering a different page shape**:
  1. `layouts/Admin.js` has a real spacer block (`h-20`, `md:hidden`) right after `<Switch>` — covers "natural flow" pages with no `h-full` root (KamionForm, PotkocsiForm, SoforForm, BejelentesekForm, Settings, and any list page whose `DataTable` isn't in `fill` mode).
  2. Pages whose own root is `h-full flex-col` (Dashboard.js, Karbantartasok.js) additionally carry their **own** trailing spacer *inside* that root — Karbantartasok.js gets one for free from `Modal.js`'s mobile branch (it renders as a `<>`-wrapped sibling next to the card, so it lands inside Karbantartasok's own root), Dashboard.js has an explicit one of its own after the calendar card.
  - If a new `h-full`-rooted mobile page ever has its bottom content clipped by the nav bar again, the Admin.js-level spacer will *not* fix it — add a same-pattern spacer inside that page's own root instead.

### PWA (installable app)
Full PWA support was added: `public/manifest.json` (proper `icon-192.png`/`icon-512.png`/`icon-maskable-512.png`, all generated locally with ImageMagick — a solid-brand-blue square with an "ST" monogram, since no square app-icon asset existed in the repo, only the wide wordmark `logo.png`/`logo.svg`), `public/apple-touch-icon.png`, iOS-specific meta tags in `public/index.html`, and `src/components/PWA/InstallPrompt.js` (mounted globally in `src/index.js`, outside the router `<Switch>` so it shows on every route) which handles the Chrome/Android `beforeinstallprompt` flow and shows a manual "Add to Home Screen" hint on iOS Safari (which never fires that event).

The actual offline/precache behavior comes from `src/service-worker.js` — **this file's mere existence is what matters**: `react-scripts`' webpack config conditionally adds `WorkboxWebpackPlugin.InjectManifest` only `isEnvProduction && fs.existsSync(swSrc)` (`swSrc` = `src/service-worker.js`). All the `workbox-*` packages it imports (`workbox-core`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `workbox-expiration`) are already transitive dependencies of `react-scripts` — nothing extra was installed. `src/serviceWorkerRegistration.js` (pre-existing CRA scaffolding) was already wired up correctly in `src/index.js` (`serviceWorkerRegistration.register()`) but had nothing to register before this, since no `service-worker.js` existed — the registration silently 404'd in every prior production build.

The service worker only activates in production builds served over `https`/`localhost` (`process.env.NODE_ENV === "production"` gate inside `serviceWorkerRegistration.js`) — it will never register under `npm start`. To verify PWA behavior locally: `npm run build`, then serve `build/` statically (e.g. `npx serve -s build -l 4173`) and check `navigator.serviceWorker.getRegistrations()` / DevTools Application tab from there, not from the dev server.

### Responsive JS logic
`react-responsive` (`useMediaQuery`) is a dependency and is used in both `CardCalender.js` and `Modal.js` (see above) to switch behavior — not just styling — between mobile and desktop. Prefer it over ad hoc `window.innerWidth` listeners for any future JS-level (not just CSS-breakpoint) responsive behavior.

### Design tokens: page background
The main scrollable app background (`layouts/Admin.js`'s "Háttér" layer) is `bg-slate-50` (Tailwind's default cool light gray, available for free since `tailwind.config.js` spreads the full default palette alongside the brand aliases) — it used to be `bg-sand-50` (a warm beige, `#faf8f4`, defined in the `sand` scale). `sand-*` is still used deliberately elsewhere (form field backgrounds, sunken-surface panels like the calendar day-list rows) and wasn't touched — only the page-level background changed, to a more neutral/professional tone. If asked to further reskin the app background, change this one spot in `Admin.js` (and mirror it in `DataTable.js`'s mobile card-list track background, which intentionally matches it) rather than touching `sand-*` itself.

### Karbantartasok mobile filter pattern
`views/admin/Karbantartasok.js` is the reference implementation for "collapsed-by-default filter panel on mobile, unchanged on desktop": `useMediaQuery({ maxWidth: 767 })` sets the initial `filtersOpen` state (`false` on mobile, `true` on desktop, matching pre-existing desktop behavior), a small icon-only button in `PageHeader`'s `action` slot (`md:hidden`) toggles it with an active-filter-count badge, and the original in-card "Szűrők" toggle bar is kept but hidden on mobile (`hidden md:flex`) so desktop is byte-for-byte unchanged. The filter card itself is conditionally `hidden md:block` so mobile doesn't render an empty padded box when collapsed. Reuse this exact pattern (media query for the initial state + `md:hidden`/`hidden md:flex` pair, not two different components) if another list page needs the same "compact on mobile, untouched on desktop" filter treatment.

### Local dev environment (this machine)
A local MariaDB/MySQL instance is already installed and running with a `kamion` database matching the hardcoded credentials in `backend/db.php` (host `localhost`) — the backend works end-to-end locally without extra setup, no need to mock it. A CRA dev server on port 3000 is also frequently already running in this environment from a previous session; `npm start` will just print "Something is already running on port 3000" in that case — reuse the existing one (it picks up file edits via Fast Refresh) instead of trying to free the port.

For headless browser verification (Playwright/`chromium-cli`) of `/admin/*` pages, the app requires a `user` key in `sessionStorage` (checked by the ad hoc `PrivateRoute` in `layouts/Admin.js`) — `context.addInitScript()` to set `sessionStorage.setItem('user', JSON.stringify({ id, name, admin: true }))` before navigating is enough to bypass the login screen for local-only verification; there's no dedicated test account/seed data documented beyond whatever rows already exist in the local `admin` table.

## Workflow notes for Claude Code

- For any UI/frontend change, verify it by actually running it (`npm start` and/or `php8.2 -S localhost:8001` as needed, opening it in a browser, screenshotting/clicking through the changed flow) before reporting the task done — don't rely on code review or lint alone.
- Do this without asking for permission first. Starting a local dev server / PHP built-in server on this machine is low-risk and reversible — just start it and verify.
- After changing any Tailwind class usage, rebuild `tailwind.css` (see the `build:tailwind` note above) before verifying in the browser, otherwise new classes won't be present yet.
