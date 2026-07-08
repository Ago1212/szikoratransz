# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Szikora Transz flottakezelő (fleet management) system: a React admin/driver UI on top of a plain PHP (no framework) REST-ish API, backed by MySQL/MariaDB via PDO. Built on the Notus React (Creative Tim) Tailwind admin template — most of `src/components`, `src/assets`, `src/layouts` are template scaffolding, not app-specific code.

Domain modules (mirrored across frontend views, backend interfaces, and API actions): kamion (trucks), potkocsi (trailers), soforok (drivers), karbantartasok (maintenance records), bejelentesek (incident reports), files, email, esemenyek/egyediHataridok (calendar events / custom deadlines).

## Commands

Frontend (run from repo root):
- `npm start` — CRA dev server (localhost:3000)
- `npm run build` — production build into `build/` (also strips template license comments via `gulp licenses`)
- `npm test` — CRA/Jest test runner (no test files currently exist in the repo)
- `npm run build:tailwind` — rebuild `src/assets/styles/tailwind.css` from `src/assets/styles/index.css` (normally handled automatically by CRA/PostCSS; only needed for `install:clean`)

Backend (PHP, no build step, no composer dependencies):
- `cd backend && php8.2 -S localhost:8000` — run the API locally (see discrepancy note below)

There is no linter config beyond CRA's default `eslintConfig: { "extends": "react-app" }`, and no PHP test suite.

## Architecture

### Frontend routing
`src/index.js` mounts three independent layouts under `react-router-dom` v5: `layouts/Admin.js`, `layouts/User.js`, `layouts/Auth.js`, plus standalone `views/Landing.js` and `views/Profile.js`. Each layout owns its own `<Switch>` of pages from `src/views/{admin,user,auth}/`. There's no route guard component — auth/role gating happens ad hoc inside pages (check `localStorage`/props usage in view files, not a shared context).

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
