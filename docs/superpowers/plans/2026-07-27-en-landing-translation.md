# Bemutató oldalak angol fordítása — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full English version of the marketing site (homepage + 6 long-tail service pages + privacy policy) under `/en/...` routes, sharing components with the Hungarian originals via a central i18n dictionary.

**Architecture:** A locale-agnostic `useTranslation()` hook derives `hu`/`en` purely from the URL (`/en...` prefix) via `useLocation()` — no Context/Provider. Two central dictionary files (`src/i18n/hu.js`, `src/i18n/en.js`) hold all translatable strings as named per-namespace exports (`landing`, `servicePage`, `quoteForm`, `footer`, `adatvedelem`, `pagesBelfoldi`, `pagesNemzetkozi`, ... one per service page) so each task can safely add/replace its own export without editing content another task owns. Shared content arrays in `data/landingContent.js` (FEATURES/PROCESS_STEPS/TESTIMONIALS/FAQ_ITEMS/SERVICE_PAGES) become id-only; their text lives in the dictionaries. `/en/*` routes reuse the exact same React components as their HU counterparts.

**Tech Stack:** React 17 (CRA), `react-router-dom` v5, Tailwind (pre-built `tailwind.css`, no new classes needed for this feature), no test runner in the repo.

## Global Constraints

- This repo has **no test framework** (`npm test` has no test files, no PHP test suite) — every task's "verify" step is **manual browser verification** (`npm start`, navigate, read the rendered text / devtools), per this project's own CLAUDE.md convention ("verify by actually running it... before reporting done"), not automated tests. Do this for real in each task, don't skip it.
- No new npm dependency is needed anywhere in this plan — do not add `react-i18next` or similar.
- Every internal `<Link>`/`href` that must vary by locale goes through `localizePath(path, locale)` from `src/i18n/index.js` (Task 1) — never hand-build an `/en...` string inline.
- `landingContent.js`'s shared arrays (FEATURES/PROCESS_STEPS/TESTIMONIALS/FAQ_ITEMS) hold **only ids/icons/hrefs**, never literal text, after Task 2. `SERVICE_PAGES` keeps its literal `label` field until Task 12 removes it (last consumer).
- The admin/driver app (anything under `/admin`, `/user`, `/auth`) is **out of scope** — never touched by any task in this plan.
- `QuoteForm.js`'s `composeMessage()` output (the free-text block sent to the admin inbox) stays **Hungarian always**, regardless of UI locale — see Task 4.
- Company identifiers (address, tax id, phone, email, domain) are **never translated** — copied verbatim into English content.

---

## Task 1: i18n infrastructure + routing + `useSeo` hreflang support

**Files:**
- Create: `src/i18n/hu.js`
- Create: `src/i18n/en.js`
- Create: `src/i18n/index.js`
- Modify: `src/index.js` (add `/en/*` mirror routes)
- Modify: `src/utils/useSeo.js` (add `lang`/`alternates` params, guard `title`, dynamic `inLanguage`)

**Interfaces:**
- Produces: `useTranslation()` → `{ t(path: string): any, locale: "hu" | "en" }`. `t()` does a dot-path lookup (e.g. `t("landing.hero.eyebrow")`) into the active dictionary, warns (dev only) and falls back to `hu` on a missing `en` key, returns the raw path string as a last-resort fallback if even `hu` is missing.
- Produces: `localizePath(path: string, locale: "hu"|"en"): string` — `path` is always the canonical HU path (e.g. `"/"`, `"/belfoldi-fuvarozas-arajanlat"`); returns unchanged for `hu`, prefixes with `/en` for `en` (`"/"` → `"/en"`).
- Produces: `delocalizePath(pathname: string): string` — inverse of the above, given the current `location.pathname`.
- Produces (from `hu.js`/`en.js`): named exports `landing`, `servicePage`, `quoteForm`, `footer`, `adatvedelem`, `pagesBelfoldi`, `pagesNemzetkozi`, `pagesBiztositott`, `pagesExpressz`, `pagesRendezveny`, `pagesEgyedi` — all `{}` in this task, populated by later tasks.
- Produces (from `useSeo.js`): `useSeo({ title, description, path, faqItems, breadcrumb, service, lang, alternates })` — `lang` (default `"hu"`) sets/restores `document.documentElement.lang`; `alternates: { hu, en }` (both canonical, `/`-rooted paths) injects/removes 3 `<link rel="alternate">` tags (`hreflang="hu"`, `"en"`, `"x-default"` → the `hu` URL); `title`/`description`/`canonical` mutation is now guarded (`if (title) { ... }` etc.) so a caller can omit them and rely on the static `public/index.html` tags, same as `Landing.js` does today for the HU homepage.

- [ ] **Step 1: Create `src/i18n/hu.js` and `src/i18n/en.js` skeletons**

Both files get **identical** skeleton content (only the export values differ later, per-language):

```js
// src/i18n/hu.js
export const landing = {};
export const servicePage = {};
export const quoteForm = {};
export const footer = {};
export const adatvedelem = {};
export const pagesBelfoldi = {};
export const pagesNemzetkozi = {};
export const pagesBiztositott = {};
export const pagesExpressz = {};
export const pagesRendezveny = {};
export const pagesEgyedi = {};
```

```js
// src/i18n/en.js
export const landing = {};
export const servicePage = {};
export const quoteForm = {};
export const footer = {};
export const adatvedelem = {};
export const pagesBelfoldi = {};
export const pagesNemzetkozi = {};
export const pagesBiztositott = {};
export const pagesExpressz = {};
export const pagesRendezveny = {};
export const pagesEgyedi = {};
```

- [ ] **Step 2: Create `src/i18n/index.js`**

```js
import { useLocation } from "react-router-dom";
import * as huModule from "./hu.js";
import * as enModule from "./en.js";

function buildDictionary(mod) {
  return {
    landing: mod.landing,
    servicePage: mod.servicePage,
    quoteForm: mod.quoteForm,
    footer: mod.footer,
    adatvedelem: mod.adatvedelem,
    pages: {
      belfoldi: mod.pagesBelfoldi,
      nemzetkozi: mod.pagesNemzetkozi,
      biztositott: mod.pagesBiztositott,
      expressz: mod.pagesExpressz,
      rendezveny: mod.pagesRendezveny,
      egyedi: mod.pagesEgyedi,
    },
  };
}

const DICTIONARIES = {
  hu: buildDictionary(huModule),
  en: buildDictionary(enModule),
};

function resolvePath(dict, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), dict);
}

export function localeFromPathname(pathname) {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "hu";
}

export function useTranslation() {
  const location = useLocation();
  const locale = localeFromPathname(location.pathname);

  const t = (path) => {
    const value = resolvePath(DICTIONARIES[locale], path);
    if (value === undefined) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing "${locale}" translation for "${path}", falling back to hu.`);
      }
      const fallback = resolvePath(DICTIONARIES.hu, path);
      return fallback !== undefined ? fallback : path;
    }
    return value;
  };

  return { t, locale };
}

// `path` is always the canonical HU path ("/", "/belfoldi-fuvarozas-arajanlat", ...).
export function localizePath(path, locale) {
  if (locale !== "en") return path;
  return path === "/" ? "/en" : `/en${path}`;
}

export function delocalizePath(pathname) {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return pathname;
}
```

- [ ] **Step 3: Add `/en/*` mirror routes to `src/index.js`**

Find this block:

```js
        <Route path="/adatvedelem" exact component={Adatvedelem} />
        <Route path="/" exact component={Landing} />
```

Replace with:

```js
        <Route path="/adatvedelem" exact component={Adatvedelem} />
        {/* Angol tükör-route-ok — ugyanazok a komponensek, a nyelvet
            rendereléskor `useTranslation()` dönti el az URL-ből (ld.
            src/i18n/index.js). Ld. docs/superpowers/specs/2026-07-27-en-
            landing-translation-design.md a lapos-fájlos prerender/.htaccess
            gotcha miatt, amiért ezek NEM egy `en/` alkönyvtárként
            prerenderelődnek. */}
        <Route
          path="/en/belfoldi-fuvarozas-arajanlat"
          exact
          component={BelfoldiFuvarozas}
        />
        <Route
          path="/en/nemzetkozi-fuvarozas-vamugyintezessel"
          exact
          component={NemzetkoziFuvarozas}
        />
        <Route path="/en/biztositott-szallitas" exact component={BiztositottSzallitas} />
        <Route path="/en/expressz-fuvarozas" exact component={ExpresszFuvarozas} />
        <Route path="/en/rendezveny-szallitas" exact component={RendezvenySzallitas} />
        <Route
          path="/en/egyedi-arajanlat-fuvarozas"
          exact
          component={EgyediArajanlat}
        />
        <Route path="/en/adatvedelem" exact component={Adatvedelem} />
        <Route path="/en" exact component={Landing} />
        <Route path="/" exact component={Landing} />
```

- [ ] **Step 4: Update `src/utils/useSeo.js`**

Replace the function signature and title-handling (top of `useSeo`):

```js
export function useSeo({ title, description, path, faqItems, breadcrumb, service, lang, alternates }) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) {
      document.title = title;
    }
```

Add, right after the existing canonical-tag block (after the `if (canonicalTag && path) { ... }` block, before the `metaSyncs` block), the `lang` + `alternates` handling:

```js
    const prevLang = document.documentElement.lang;
    if (lang) {
      document.documentElement.lang = lang;
    }

    const hreflangTags = [];
    if (alternates && alternates.hu && alternates.en) {
      [
        { hreflang: "hu", href: alternates.hu },
        { hreflang: "en", href: alternates.en },
        { hreflang: "x-default", href: alternates.hu },
      ].forEach(({ hreflang, href }) => {
        const tag = document.createElement("link");
        tag.setAttribute("rel", "alternate");
        tag.setAttribute("hreflang", hreflang);
        tag.setAttribute("href", `${SITE_URL}${href}`);
        document.head.appendChild(tag);
        hreflangTags.push(tag);
      });
    }
```

Update the FAQPage/BreadcrumbList/Service `inLanguage` fields (3 occurrences of `inLanguage: "hu",`) to:

```js
        inLanguage: lang || "hu",
```

Update the Breadcrumb root item (inside the `BreadcrumbList` builder):

```js
          { "@type": "ListItem", position: 1, name: "Főoldal", item: `${SITE_URL}/` },
```

→

```js
          {
            "@type": "ListItem",
            position: 1,
            name: lang === "en" ? "Home" : "Főoldal",
            item: `${SITE_URL}${lang === "en" ? "/en" : "/"}`,
          },
```

Update the cleanup function:

```js
    return () => {
      if (title) {
        document.title = prevTitle;
      }
```
(replacing the unconditional `document.title = prevTitle;` line)

and add, alongside the existing `metaSyncs.forEach(...)` cleanup line:

```js
      document.documentElement.lang = prevLang;
      hreflangTags.forEach((tag) => document.head.removeChild(tag));
```

Update the `useEffect` dependency array to include the two new params:

```js
  }, [title, description, path, faqItems, breadcrumb, service, lang, alternates]);
```

- [ ] **Step 5: Verify**

Run `npm start` (or confirm the existing dev server on :3000 is up). In a browser:
1. Visit `http://localhost:3000/en` — the Landing page renders (still all-Hungarian text at this point, expected — no content migrated yet), no console errors.
2. Visit `http://localhost:3000/en/belfoldi-fuvarozas-arajanlat` and `http://localhost:3000/en/adatvedelem` similarly — both render their existing HU content with no errors.
3. Visit `http://localhost:3000/` — unchanged, still renders correctly (regression check on the routing change).
4. Open devtools console on any of the above — confirm no `[i18n]` warnings are printed (nothing calls `t()` yet).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/hu.js src/i18n/en.js src/i18n/index.js src/index.js src/utils/useSeo.js
git commit -m "feat: add i18n infrastructure, /en routes, and hreflang support"
```

---

## Task 2: Shared content-array data model migration (`landingContent.js`) + full `Landing.js` translation

**Files:**
- Modify: `src/data/landingContent.js` (full rewrite of the 5 exported arrays + `pickFaq`)
- Modify: `src/views/Landing.js` (full translation)
- Modify: `src/views/landing/BelfoldiFuvarozas.js`, `NemzetkoziFuvarozas.js`, `BiztositottSzallitas.js`, `ExpresszFuvarozas.js`, `RendezvenySzallitas.js`, `EgyediArajanlat.js` (only their `pickFaq(...)` call — new `t` argument + id-based selectors, nothing else touched yet)
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `landing` export)

**Interfaces:**
- Consumes: `useTranslation()`, `localizePath()` from Task 1.
- Produces: `pickFaq(t, ...selectors)` new signature — `selectors` are either a plain id string (`"response_time"`) or an override object `{ id: "insurance", aKey: "pages.nemzetkozi.faqOverrides.insurance.a" }`. Returns `[{q, a}, ...]`. Later tasks (6-11) rely on this exact signature.
- Produces: `landing.testimonialItems.<id>.{quote,role,company}` and `landing.servicePages.<id>` dictionary keys — Task 3 (`ServicePage.js`) and Task 12 (`Footer.js`) consume these.

### Step 1: Rewrite `src/data/landingContent.js`

Replace the entire file content with:

```js
import {
  PiTruckLight,
  PiGlobeLight,
  PiShieldCheckLight,
  PiLightningLight,
  PiFileTextLight,
  PiConfettiLight,
} from "react-icons/pi";

// Megosztott tartalom a Landing.js főoldal és a szolgáltatás-specifikus
// long-tail SEO oldalak (src/views/landing/*.js) között. A tényleges
// szövegek (title/desc/quote/role/company/q/a) a src/i18n/{hu,en}.js
// szótárakban élnek, id alapján kulcsolva — ez a fájl csak a nyelv-független
// szerkezetet (id, ikon, href) tárolja. Ld.
// docs/superpowers/specs/2026-07-27-en-landing-translation-design.md.
export const FEATURES = [
  { id: "domestic", icon: PiTruckLight, href: "/belfoldi-fuvarozas-arajanlat" },
  {
    id: "international",
    icon: PiGlobeLight,
    href: "/nemzetkozi-fuvarozas-vamugyintezessel",
  },
  { id: "insured", icon: PiShieldCheckLight, href: "/biztositott-szallitas" },
  { id: "express", icon: PiLightningLight, href: "/expressz-fuvarozas" },
  { id: "event", icon: PiConfettiLight, href: "/rendezveny-szallitas" },
  { id: "custom", icon: PiFileTextLight, href: "/egyedi-arajanlat-fuvarozas" },
];

export const PROCESS_STEPS = [
  { id: "order", n: "01" },
  { id: "planning", n: "02" },
  { id: "shipping", n: "03" },
  { id: "delivery", n: "04" },
];

export const TESTIMONIALS = [
  { id: "nagy_peter", name: "Nagy Péter" },
  { id: "toth_andrea", name: "Tóth Andrea" },
  { id: "kovacs_gabor", name: "Kovács Gábor" },
  { id: "szabo_katalin", name: "Szabó Katalin" },
  { id: "farkas_zoltan", name: "Farkas Zoltán" },
  { id: "molnar_eszter", name: "Molnár Eszter" },
];

export const FAQ_ITEMS = [
  { id: "response_time" },
  { id: "pricing_factors" },
  { id: "vehicles" },
  { id: "insurance" },
  { id: "damage" },
  { id: "international" },
  { id: "custom_quote" },
  { id: "payment_terms" },
  { id: "driver_application" },
];

// `t` az aktuális nyelv `t()` függvénye (useTranslation()-ből). `selectors`
// elemei vagy egy sima FAQ id string (alap kérdés/válasz a szótárból), vagy
// egy `{ id, aKey }` alakú override, ahol `aKey` egy másik szótár-útvonalra
// mutat egy oldal-specifikus válaszhoz (pl.
// "pages.nemzetkozi.faqOverrides.insurance.a").
export function pickFaq(t, ...selectors) {
  return selectors
    .map((sel) => {
      const isOverride = typeof sel === "object" && sel !== null;
      const id = isOverride ? sel.id : sel;
      const base = FAQ_ITEMS.find((item) => item.id === id);
      if (!base) return null;
      return {
        q: t(`landing.faqItems.${id}.q`),
        a: isOverride && sel.aKey ? t(sel.aKey) : t(`landing.faqItems.${id}.a`),
      };
    })
    .filter(Boolean);
}

// `label` egyelőre marad (Hungarian, literal) — ServicePage.js (Task 3) és
// Footer.js (Task 12) fokozatosan állnak át a `t("landing.servicePages.<id>")`
// lookupra; Task 12 távolítja el ezt a mezőt végleg, mint utolsó fogyasztó.
export const SERVICE_PAGES = [
  { id: "domestic", path: "/belfoldi-fuvarozas-arajanlat", label: "Belföldi fuvarozás" },
  {
    id: "international",
    path: "/nemzetkozi-fuvarozas-vamugyintezessel",
    label: "Nemzetközi fuvarozás",
  },
  { id: "insured", path: "/biztositott-szallitas", label: "Biztosított szállítás" },
  { id: "express", path: "/expressz-fuvarozas", label: "Expressz fuvarozás" },
  { id: "event", path: "/rendezveny-szallitas", label: "Rendezvényszállítás" },
  { id: "custom", path: "/egyedi-arajanlat-fuvarozas", label: "Egyedi árajánlat" },
];
```

### Step 2: Replace the `landing` export in `src/i18n/hu.js`

Replace `export const landing = {};` with:

```js
export const landing = {
  nav: {
    home: "Kezdőlap",
    services: "Szolgáltatások",
    about: "Rólunk",
    contact: "Kapcsolat",
    login: "Bejelentkezés",
    menuToggleSr: "Menü megnyitása",
  },
  hero: {
    eyebrow: "Belföldi és nemzetközi fuvarozás",
    headline: { line1: "Szállítás, amire", line2: "percre pontosan", line3: "számíthat." },
    subheading:
      "Szikora Transz Kft — profi áruszállítás és logisztika 2010 óta: belföldi és nemzetközi fuvarozás, modern flotta, teljes körű biztosítás.",
    servicesLink: "Szolgáltatásaink megismerése",
    quoteCard: {
      eyebrow: "Ingyenes árajánlat",
      title: "Kérjen árajánlatot még ma",
      subtitle:
        "Töltse ki pár adatát, és 24 órán belül egyedi árajánlattal válaszolunk — kötöttség nélkül.",
      bullets: [
        "Teljesen ingyenes, nem kötelez semmire",
        "Válasz 24 órán belül",
        "Egyedi árazás minden fuvarra",
      ],
      ctaButton: "Ingyenes ajánlatot kérek",
      callPrefix: "vagy hívjon közvetlenül:",
      phone: "+36 30 811 5776",
    },
  },
  homeMeta: {
    title: "Szikora Transz Kft. | Belföldi és nemzetközi fuvarozás",
    description:
      "Szikora Transz Kft — profi áruszállítás és logisztika 2010 óta: belföldi és nemzetközi fuvarozás, modern flotta, teljes körű biztosítás. Kérjen ingyenes árajánlatot.",
  },
  process: {
    eyebrow: "A folyamat",
    title: "Így jut el az árujuk A-ból B-be",
    intro: "Négy lépés, amely minden fuvarra érvényes — a megrendeléstől a visszaigazolt kézbesítésig.",
  },
  services: {
    eyebrow: "Szolgáltatások",
    title: "Szolgáltatásaink",
    intro:
      "Teljes körű fuvarozási megoldások, amelyek kielégítik ügyfeleink egyedi igényeit — belföldön és külföldön egyaránt.",
    detailsLink: "Részletek",
    whyUs: {
      eyebrow: "Miért mi",
      title: "Miért válasszon minket?",
      intro:
        "10+ éves tapasztalattal rendelkezünk a fuvarozási iparágban. Flottánk állandóan karban van tartva, sofőreink képzettek és megbízhatóak.",
      bullets: [
        { title: "Kiváló minőség", desc: "Minden szállítási folyamat precíz tervezéssel és végrehajtással." },
        { title: "Rugalmasság", desc: "Személyre szabott megoldások minden egyedi igényre." },
        {
          title: "Megbízhatóság",
          desc: "Hosszú távú partnerségek, pontos határidőkkel és átlátható kommunikációval.",
        },
        {
          title: "Családias hozzáállás",
          desc: "Családi vállalkozásként indultunk, és így is kezelünk minden ügyfelet és sofőrt: emberközpontúan, tisztelettel.",
        },
      ],
      imageAlt: "Szikora Transz Kft. modern kamionflottája fuvarozás közben",
      imageCaption: {
        title: "Modern flotta",
        desc: "Több modern, karbantartott kamionból álló flottánk és tapasztalt sofőreink garantálják a megbízható szállítást.",
      },
    },
  },
  about: {
    imageAlt: "Szikora Transz kamion borult égbolt alatt",
    eyebrow: "Rólunk",
    title: "Cégtörténetünk",
    paragraph1:
      "Szikora Transz Kft 2010-ben alakult kis családi vállalkozásként. Azóta folyamatosan bővült flottánk és szolgáltatási körünk, de megtartottuk személyes hangvételünket és ügyfélközpontú hozzáállásunkat.",
    paragraph2:
      "Mára belföldi és nemzetközi fuvarokat egyaránt vállalunk, a rövid távú, sürgős megbízásoktól a rendszeres, hosszú távú partnerségekig. Minden ügyfelünket úgy szolgáljuk ki, mintha a saját árujuk lenne — legyen szó egyszeri fuvarról vagy folyamatos együttműködésről.",
    tiles: [
      { title: "Karbantartott flotta", desc: "Több modern kamionból álló, állandóan karbantartott flotta." },
      { title: "Tapasztalt sofőrök", desc: "Több tapasztalt, hosszú távú sofőr alkotja csapatunkat." },
    ],
  },
  testimonials: {
    eyebrow: "Ügyfélvisszajelzések",
    title: "Amit partnereink mondanak rólunk",
    disclaimer:
      "* A fenti referenciák minta-szövegek — érdemes őket valós ügyfelek visszajelzéseire cserélni a publikálás előtt.",
  },
  faq: {
    eyebrow: "Gyakran ismételt kérdések",
    title: "Kérdése van? Válaszolunk.",
  },
  breadcrumbHome: "Főoldal",
  contact: {
    eyebrow: "Kapcsolat",
    title: "Kapcsolatfelvétel",
    intro: "Kérjük töltse ki az alábbi űrlapot — gyors, ingyenes és semmilyen kötöttséggel nem jár.",
    driverForm: {
      eyebrow: "Sofőröket keresünk",
      title: "Csatlakozzon a csapatunkhoz",
      benefits: [
        "Családias légkör — sok sofőrünk évek óta velünk dolgozik",
        "Modern, karbantartott flotta és rendezett munkakörülmények",
        "Versenyképes, rendszeres bérezés",
      ],
      requirementPrefix: "Amit kérünk:",
      requirementText: "érvényes C+E kategóriás jogosítvány és GKI kártya.",
      intro: "Nem kérünk azonnal önéletrajzot — írjon pár sort, és hamarosan felvesszük Önnel a kapcsolatot.",
      nameLabel: "Teljes név",
      namePlaceholder: "Teljes név",
      phoneLabel: "Telefonszám",
      phonePlaceholder: "Telefonszám",
      emailLabel: "Email cím",
      emailPlaceholder: "Email cím",
      messageLabel: "Pár sor Önről",
      messagePlaceholder: "Pl. hány éve vezet kamiont, milyen jogosítványa/kártyája van...",
      submitLoading: "Küldés...",
      submitDefault: "Jelentkezem sofőrnek",
      successMessage: "Jelentkezés sikeresen elküldve! Hamarosan felvesszük Önnel a kapcsolatot.",
      errorMessageDefault: "Hiba történt a jelentkezés küldése közben.",
    },
  },
  features: {
    domestic: {
      title: "Belföldi fuvarozás",
      desc:
        "Gyors és megbízható áruszállítás Magyarország egész területén, rugalmas árazással és pontos határidőkkel. Egyaránt vállalunk egyszeri megbízásokat és rendszeres, ismétlődő fuvarokat.",
    },
    international: {
      title: "Nemzetközi szállítás",
      desc:
        "Határon átnyúló fuvarozási szolgáltatás Európa-szerte, teljes körű vámügyintézéssel és okmányolással. Az útvonalat és a határidőt minden esetben az adott fuvarhoz igazítjuk.",
    },
    insured: {
      title: "Biztosított szállítás",
      desc:
        "Minden fuvarunk teljes biztosítási fedezettel történik — az árukészlete nálunk biztos kezekben van. Esetleges kár esetén csapatunk intézi a biztosítóval a kárrendezést.",
    },
    express: {
      title: "Expressz szállítás",
      desc:
        "Sürgős fuvarok soron kívüli kezelése, garantált kiszállítási idővel, ha az idő a legfontosabb tényező. Vegye fel velünk a kapcsolatot, és soron kívül egyeztetjük a részleteket.",
    },
    event: {
      title: "Rendezvényszállítás",
      desc:
        "Standok, berendezések, dekoráció és egyéb rendezvényanyagok szállítása a helyszínre és vissza, a rendezvény ütemezéséhez igazítva.",
    },
    custom: {
      title: "Egyedi árajánlat",
      desc:
        "Minden megrendelést egyedileg árazunk az útvonal, az áru jellege és a határidő alapján — gyors, személyre szabott ajánlattal. Nincs rejtett költség, az ajánlatban minden tétel átlátható.",
    },
  },
  processSteps: {
    order: {
      title: "Megrendelés",
      desc: "Küldje el ajánlatkérését az űrlapon, és 24 órán belül részletes választ kap tőlünk.",
    },
    planning: {
      title: "Tervezés",
      desc: "Optimalizáljuk az útvonalat, és kiválasztjuk az áru jellegéhez illő járművet és sofőrt.",
    },
    shipping: {
      title: "Szállítás",
      desc: "Szakképzett sofőreink pontosan az ütemterv szerint szállítják az árut, az ország határain belül és kívül.",
    },
    delivery: {
      title: "Kézbesítés",
      desc: "Pontos, biztosított kiszállítás, írásos visszaigazolással a fuvar lezárásáról.",
    },
  },
  testimonialItems: {
    nagy_peter: {
      quote:
        "A Szikora Transz csapatára mindig számíthatunk, akár sürgős, akár előre tervezett szállításról van szó. A kommunikáció gyors és pontos.",
      role: "beszerzési vezető",
      company: "Pannon Élelmiszer Zrt.",
    },
    toth_andrea: {
      quote:
        "Nemzetközi fuvarjaink mindig időben és hiánytalanul érkeznek meg. A vámügyintézést is teljes egészében átvállalják tőlünk.",
      role: "logisztikai menedzser",
      company: "ÉszakBau Kft.",
    },
    kovacs_gabor: {
      quote:
        "Minden fuvarra gyorsan, az igényeinkre szabott árajánlatot kapunk, és bármikor el tudjuk érni a csapatot, ha kérdésünk van.",
      role: "ügyvezető",
      company: "Dunapack Csomagolástechnika Kft.",
    },
    szabo_katalin: {
      quote:
        "Egy károsodott szállítmány esetén a csapat azonnal intézte a biztosítóval a kárrendezést — nekünk semmilyen plusz utánajárással nem járt.",
      role: "pénzügyi vezető",
      company: "Kelet-Bútor Kft.",
    },
    farkas_zoltan: {
      quote:
        "Egy váratlanul sürgőssé vált szállítást is pár órán belül megoldottak, amikor a gyártásunk emiatt állt volna le.",
      role: "üzemvezető",
      company: "GyorsGyár Kft.",
    },
    molnar_eszter: {
      quote:
        "A standunk ki- és beszállítását is pontosan a kiállítás ütemezéséhez igazítva végezték, egyeztetve a helyszíni be- és kirakodási időablakokkal.",
      role: "rendezvényszervező",
      company: "EventLine Kft.",
    },
  },
  faqItems: {
    response_time: {
      q: "Mennyi idő alatt kapok ajánlatot?",
      a: "Általában 24 órán belül felvesszük Önnel a kapcsolatot egy részletes, az útvonalra és az áru jellegére szabott árajánlattal.",
    },
    pricing_factors: {
      q: "Mitől függ egy fuvar ára?",
      a: "Elsősorban a távolság, a szállítandó áru mérete, súlya és jellege, valamint a vállalt határidő határozza meg az árat. Nincs egységes, fix díjszabásunk — minden ajánlatkérést egyedileg, tételesen árazunk, hogy a végösszeg pontosan tükrözze az adott fuvar valós igényeit.",
    },
    vehicles: {
      q: "Milyen járművekkel dolgoznak?",
      a: "Modern, rendszeresen karbantartott kamionflottánkat a szállítandó áru jellegéhez igazítjuk. A fuvarhoz legmegfelelőbb jármű kiválasztása az ajánlatkérés során, az Ön igényei alapján történik.",
    },
    insurance: {
      q: "Biztosított a szállított áru?",
      a: "Igen, minden fuvarunk teljes körű biztosítási fedezettel történik, a felvételtől a kiszállításig.",
    },
    damage: {
      q: "Mi történik, ha kár keletkezik szállítás közben?",
      a: "Ilyen esetben haladéktalanul jelezze felénk telefonon vagy e-mailben. Mivel minden fuvar biztosítási fedezet mellett zajlik, csapatunk a biztosítóval egyeztetve intézi a kárrendezés ügyintézését.",
    },
    international: {
      q: "Vállalnak nemzetközi szállítást?",
      a: "Igen, Európa-szerte végzünk nemzetközi fuvarozást, a szükséges vámügyintézés és okmányolás teljes körű intézésével. A pontos útvonalat és határidőt minden esetben egyeztetjük az ajánlatkérés során.",
    },
    custom_quote: {
      q: "Kérhetek egyedi árajánlatot speciális igényekhez?",
      a: "Igen, minden megrendelést egyedileg árazunk az útvonal, az áru jellege és a határidő alapján. Vegye fel velünk a kapcsolatot a részletekkel, és személyre szabott ajánlatot küldünk.",
    },
    payment_terms: {
      q: "Milyen fizetési feltételeket fogadnak el?",
      a: "Átutalást és számlás fizetést is biztosítunk, a fizetési határidőt az egyedi megrendelés alapján egyeztetjük.",
    },
    driver_application: {
      q: "Hogyan jelentkezhetek sofőrként?",
      a: "Töltse ki az alábbi jelentkezési űrlapot a végzettségével és tapasztalatával. Amennyiben rendelkezik a szükséges jogosítvány-kategóriával, csapatunk hamarosan felveszi Önnel a kapcsolatot, és a pontos feltételekről személyesen egyeztetünk.",
    },
  },
  servicePages: {
    domestic: "Belföldi fuvarozás",
    international: "Nemzetközi fuvarozás",
    insured: "Biztosított szállítás",
    express: "Expressz fuvarozás",
    event: "Rendezvényszállítás",
    custom: "Egyedi árajánlat",
  },
};
```

### Step 3: Replace the `landing` export in `src/i18n/en.js`

Replace `export const landing = {};` with:

```js
export const landing = {
  nav: {
    home: "Home",
    services: "Services",
    about: "About Us",
    contact: "Contact",
    login: "Log In",
    menuToggleSr: "Open menu",
  },
  hero: {
    eyebrow: "Domestic and international freight transport",
    headline: { line1: "Delivery you can", line2: "count on, right", line3: "down to the minute." },
    subheading:
      "Szikora Transz Kft — professional freight transport and logistics since 2010: domestic and international shipping, a modern fleet, and full insurance coverage.",
    servicesLink: "Explore our services",
    quoteCard: {
      eyebrow: "Free quote",
      title: "Request a quote today",
      subtitle:
        "Fill in a few details and we'll get back to you with a custom quote within 24 hours — no obligation.",
      bullets: [
        "Completely free, no obligation",
        "Response within 24 hours",
        "Custom pricing for every shipment",
      ],
      ctaButton: "Request a free quote",
      callPrefix: "or call us directly:",
      phone: "+36 30 811 5776",
    },
  },
  homeMeta: {
    title: "Szikora Transz Kft. | Domestic and International Freight Transport",
    description:
      "Szikora Transz Kft — professional freight transport and logistics since 2010: domestic and international shipping, a modern fleet, full insurance coverage. Request a free quote.",
  },
  process: {
    eyebrow: "The process",
    title: "How your cargo gets from A to B",
    intro: "Four steps that apply to every shipment — from order to confirmed delivery.",
  },
  services: {
    eyebrow: "Services",
    title: "Our Services",
    intro:
      "Comprehensive freight solutions tailored to our clients' individual needs — both domestically and abroad.",
    detailsLink: "Details",
    whyUs: {
      eyebrow: "Why us",
      title: "Why choose us?",
      intro:
        "We have 10+ years of experience in the freight transport industry. Our fleet is continuously maintained, and our drivers are skilled and reliable.",
      bullets: [
        { title: "Outstanding quality", desc: "Every shipment is precisely planned and executed." },
        { title: "Flexibility", desc: "Tailored solutions for every individual need." },
        {
          title: "Reliability",
          desc: "Long-term partnerships, built on punctual deadlines and transparent communication.",
        },
        {
          title: "A family-business approach",
          desc: "We started as a family business, and we still treat every client and driver that way: with a human touch and respect.",
        },
      ],
      imageAlt: "Szikora Transz Kft.'s modern truck fleet in transit",
      imageCaption: {
        title: "Modern fleet",
        desc: "Our fleet of modern, well-maintained trucks and our experienced drivers guarantee reliable delivery.",
      },
    },
  },
  about: {
    imageAlt: "A Szikora Transz truck under an overcast sky",
    eyebrow: "About Us",
    title: "Our Company History",
    paragraph1:
      "Szikora Transz Kft was founded in 2010 as a small family business. Since then, our fleet and range of services have grown steadily, but we've kept our personal tone and customer-focused approach.",
    paragraph2:
      "Today we handle both domestic and international shipments, from short-notice urgent jobs to regular, long-term partnerships. We treat every client's cargo as if it were our own — whether it's a one-off shipment or an ongoing collaboration.",
    tiles: [
      { title: "Well-maintained fleet", desc: "A fleet of modern trucks, continuously maintained." },
      { title: "Experienced drivers", desc: "Our team is made up of several experienced, long-tenured drivers." },
    ],
  },
  testimonials: {
    eyebrow: "Client Feedback",
    title: "What our partners say about us",
    disclaimer:
      "* The testimonials above are placeholder text — they should be replaced with real client feedback before publishing.",
  },
  faq: {
    eyebrow: "Frequently Asked Questions",
    title: "Have a question? We have answers.",
  },
  breadcrumbHome: "Home",
  contact: {
    eyebrow: "Contact",
    title: "Get in Touch",
    intro: "Please fill out the form below — it's quick, free, and comes with no obligation.",
    driverForm: {
      eyebrow: "We're Hiring Drivers",
      title: "Join Our Team",
      benefits: [
        "A close-knit team — many of our drivers have been with us for years",
        "A modern, well-maintained fleet and orderly working conditions",
        "Competitive, regular pay",
      ],
      requirementPrefix: "What we require:",
      requirementText: "a valid category C+E driving licence and a GKI (professional driver qualification) card.",
      intro: "No need to send a résumé right away — just write a few lines, and we'll be in touch with you soon.",
      nameLabel: "Full Name",
      namePlaceholder: "Full name",
      phoneLabel: "Phone Number",
      phonePlaceholder: "Phone number",
      emailLabel: "Email Address",
      emailPlaceholder: "Email address",
      messageLabel: "A Few Words About You",
      messagePlaceholder: "E.g. how many years you've been driving, what licence/cards you hold...",
      submitLoading: "Sending...",
      submitDefault: "Apply as a Driver",
      successMessage: "Your application was submitted successfully! We'll be in touch with you soon.",
      errorMessageDefault: "Something went wrong while sending your application.",
    },
  },
  features: {
    domestic: {
      title: "Domestic Freight Transport",
      desc:
        "Fast, reliable freight transport across the whole of Hungary, with flexible pricing and precise deadlines. We handle both one-off jobs and regular, recurring routes.",
    },
    international: {
      title: "International Shipping",
      desc:
        "Cross-border freight transport across Europe, with full customs clearance and documentation included. We tailor the route and the deadline to each individual shipment.",
    },
    insured: {
      title: "Insured Shipping",
      desc:
        "Every shipment we handle is fully insured — your goods are in safe hands with us. If damage does occur, our team handles the claims process with the insurer.",
    },
    express: {
      title: "Express Shipping",
      desc:
        "Priority handling for urgent jobs, with a guaranteed delivery time, when time is the most important factor. Get in touch and we'll sort out the details right away.",
    },
    event: {
      title: "Event Logistics",
      desc:
        "Transport of booth structures, equipment, decor, and other event materials to and from the venue, timed to the event's schedule.",
    },
    custom: {
      title: "Custom Quote",
      desc:
        "We price every order individually, based on the route, the type of cargo, and the deadline — with a fast, personalized quote. No hidden costs — every line item in the quote is transparent.",
    },
  },
  processSteps: {
    order: {
      title: "Order",
      desc: "Send your quote request through the form, and you'll get a detailed response from us within 24 hours.",
    },
    planning: {
      title: "Planning",
      desc: "We optimize the route and select the vehicle and driver best suited to your cargo.",
    },
    shipping: {
      title: "Shipping",
      desc: "Our skilled drivers transport the goods precisely on schedule, both within Hungary and across borders.",
    },
    delivery: {
      title: "Delivery",
      desc: "Precise, insured delivery, with written confirmation once the job is closed out.",
    },
  },
  testimonialItems: {
    nagy_peter: {
      quote:
        "We can always count on the Szikora Transz team, whether it's an urgent job or one planned well in advance. Communication is fast and precise.",
      role: "Procurement Manager",
      company: "Pannon Élelmiszer Zrt.",
    },
    toth_andrea: {
      quote:
        "Our international shipments always arrive on time and intact. They also take care of the entire customs process for us.",
      role: "Logistics Manager",
      company: "ÉszakBau Kft.",
    },
    kovacs_gabor: {
      quote: "We get a fast, tailored quote for every job, and we can reach the team anytime we have a question.",
      role: "Managing Director",
      company: "Dunapack Csomagolástechnika Kft.",
    },
    szabo_katalin: {
      quote:
        "When a shipment was damaged, the team dealt with the insurance claim immediately — it took no extra effort on our part at all.",
      role: "Finance Manager",
      company: "Kelet-Bútor Kft.",
    },
    farkas_zoltan: {
      quote:
        "They resolved a shipment that suddenly became urgent within just a few hours, right when our production was about to stop because of it.",
      role: "Plant Manager",
      company: "GyorsGyár Kft.",
    },
    molnar_eszter: {
      quote:
        "They delivered and picked up our booth exactly on the exhibition's schedule, coordinating with the venue's loading and unloading windows.",
      role: "Event Organizer",
      company: "EventLine Kft.",
    },
  },
  faqItems: {
    response_time: {
      q: "How quickly will I get a quote?",
      a: "We typically get in touch within 24 hours with a detailed quote tailored to your route and the type of cargo.",
    },
    pricing_factors: {
      q: "What determines the price of a shipment?",
      a: "The price is mainly determined by the distance, the size, weight, and nature of the cargo, and the agreed deadline. We don't have a single fixed price list — we price every quote request individually, item by item, so the final amount accurately reflects that specific job's real requirements.",
    },
    vehicles: {
      q: "What vehicles do you work with?",
      a: "We match our modern, regularly maintained truck fleet to the nature of the cargo being transported. The most suitable vehicle for the job is selected during the quote process, based on your needs.",
    },
    insurance: {
      q: "Is the cargo insured?",
      a: "Yes, every shipment we handle is fully insured, from pickup to delivery.",
    },
    damage: {
      q: "What happens if damage occurs during transport?",
      a: "In that case, let us know immediately by phone or email. Since every shipment is covered by insurance, our team handles the claims process by liaising directly with the insurer.",
    },
    international: {
      q: "Do you handle international shipping?",
      a: "Yes, we handle international freight transport across Europe, taking full care of the necessary customs clearance and documentation. We always agree on the exact route and deadline during the quote process.",
    },
    custom_quote: {
      q: "Can I request a custom quote for special requirements?",
      a: "Yes, we price every order individually based on the route, the type of cargo, and the deadline. Get in touch with the details, and we'll send you a personalized quote.",
    },
    payment_terms: {
      q: "What payment terms do you accept?",
      a: "We accept both bank transfer and invoiced payment — the payment deadline is agreed based on the specific order.",
    },
    driver_application: {
      q: "How can I apply as a driver?",
      a: "Fill out the application form below with your qualifications and experience. If you hold the required licence category, our team will get in touch with you soon, and we'll discuss the exact terms personally.",
    },
  },
  servicePages: {
    domestic: "Domestic Freight",
    international: "International Freight",
    insured: "Insured Shipping",
    express: "Express Freight",
    event: "Event Logistics",
    custom: "Custom Quote",
  },
};
```

### Step 4: Migrate `src/views/Landing.js`

All edits below are exact `old_string` → `new_string` replacements against the file as read in full during planning (1093 lines).

**4a. Imports** — add `useTranslation`/`localizePath`:

Old:
```js
import Footer from "components/Footers/Footer.js";
import { fetchAction } from "utils/fetchAction";
import HungaryMapBackground from "components/UI/HungaryMapBackground.js";
import QuoteForm from "components/Landing/QuoteForm.js";
import {
  FEATURES,
  PROCESS_STEPS,
  TESTIMONIALS,
  FAQ_ITEMS,
} from "data/landingContent.js";
```
New:
```js
import Footer from "components/Footers/Footer.js";
import { fetchAction } from "utils/fetchAction";
import HungaryMapBackground from "components/UI/HungaryMapBackground.js";
import QuoteForm from "components/Landing/QuoteForm.js";
import {
  FEATURES,
  PROCESS_STEPS,
  TESTIMONIALS,
  FAQ_ITEMS,
  pickFaq,
} from "data/landingContent.js";
import { useTranslation, localizePath } from "i18n/index.js";
import { useSeo } from "utils/useSeo.js";
```
(Note: `pickFaq` isn't actually used by `Landing.js` — remove that import; `Landing.js` builds its FAQPage JSON-LD directly from `FAQ_ITEMS` + `t()`, not via `pickFaq`. Only add `pickFaq` to the import list if a later re-read shows otherwise; the intent here is just `useTranslation`, `localizePath`, `useSeo`.) Use this corrected version:
```js
import {
  FEATURES,
  PROCESS_STEPS,
  TESTIMONIALS,
  FAQ_ITEMS,
} from "data/landingContent.js";
import { useTranslation, localizePath } from "i18n/index.js";
import { useSeo } from "utils/useSeo.js";
```

**4b. Hook setup** — right after `export default function Landing() {`, add:

Old:
```js
export default function Landing() {
  const [activeSection, setActiveSection] = useState("home");
```
New:
```js
export default function Landing() {
  const { t, locale } = useTranslation();
  useSeo({
    title: locale === "en" ? t("landing.homeMeta.title") : undefined,
    description: locale === "en" ? t("landing.homeMeta.description") : undefined,
    path: locale === "en" ? "/en" : "/",
    lang: locale,
    alternates: { hu: "/", en: "/en" },
  });
  const [activeSection, setActiveSection] = useState("home");
```

**4c. Driver-application submit messages:**

Old:
```js
    if (result && result.success) {
      setSubmitStatus({
        success: true,
        message:
          "Jelentkezés sikeresen elküldve! Hamarosan felvesszük Önnel a kapcsolatot.",
      });
      setApplicationForm({ name: "", phone: "", email: "", message: "" });
    } else {
      setSubmitStatus({
        success: false,
        message: result.message || "Hiba történt a jelentkezés küldése közben.",
      });
    }
```
New:
```js
    if (result && result.success) {
      setSubmitStatus({
        success: true,
        message: t("landing.contact.driverForm.successMessage"),
      });
      setApplicationForm({ name: "", phone: "", email: "", message: "" });
    } else {
      setSubmitStatus({
        success: false,
        message: result.message || t("landing.contact.driverForm.errorMessageDefault"),
      });
    }
```

**4d. Nav items:**

Old:
```js
  const navItems = [
    { id: "home", label: "Kezdőlap" },
    { id: "services", label: "Szolgáltatások" },
    { id: "about", label: "Rólunk" },
    { id: "contact", label: "Kapcsolat" },
  ];
```
New:
```js
  const navItems = [
    { id: "home", label: t("landing.nav.home") },
    { id: "services", label: t("landing.nav.services") },
    { id: "about", label: t("landing.nav.about") },
    { id: "contact", label: t("landing.nav.contact") },
  ];
```

**4e. Desktop nav "Bejelentkezés" link + mobile menu toggle sr-text + mobile nav "Bejelentkezés"** (3 occurrences — desktop at ~line 292, sr-only at ~line 305, mobile at ~line 371):

Old (desktop, appears once):
```js
                <Link
                  to="/auth/login"
                  className="bg-[#1E3AA8] hover:bg-[#172E86] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors duration-300"
                >
                  Bejelentkezés
                </Link>
```
New:
```js
                <Link
                  to="/auth/login"
                  className="bg-[#1E3AA8] hover:bg-[#172E86] text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors duration-300"
                >
                  {t("landing.nav.login")}
                </Link>
                <span className="inline-flex items-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide ml-4">
                  <Link
                    to="/"
                    className={locale === "hu" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50 hover:text-[#23262B]"}
                  >
                    HU
                  </Link>
                  <span className="text-[#23262B]/30">|</span>
                  <Link
                    to="/en"
                    className={locale === "en" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50 hover:text-[#23262B]"}
                  >
                    EN
                  </Link>
                </span>
```

Old (sr-only mobile toggle text):
```js
                <span className="sr-only">Menü megnyitása</span>
```
New:
```js
                <span className="sr-only">{t("landing.nav.menuToggleSr")}</span>
```

Old (mobile menu login link):
```js
            <Link
              to="/auth/login"
              className="block w-full px-3 py-2 rounded-xl text-base font-semibold text-white bg-[#1E3AA8] hover:bg-[#172E86] text-center mt-2"
            >
              Bejelentkezés
            </Link>
```
New:
```js
            <Link
              to="/auth/login"
              className="block w-full px-3 py-2 rounded-xl text-base font-semibold text-white bg-[#1E3AA8] hover:bg-[#172E86] text-center mt-2"
            >
              {t("landing.nav.login")}
            </Link>
            <div className="flex items-center justify-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide pt-2">
              <Link to="/" className={locale === "hu" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50"}>
                HU
              </Link>
              <span className="text-[#23262B]/30">|</span>
              <Link to="/en" className={locale === "en" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50"}>
                EN
              </Link>
            </div>
```

**4f. Hero section** — eyebrow, 3-segment headline, subheading, "Szolgáltatásaink megismerése" link, quote-card (eyebrow/title/subtitle/3 bullets/CTA/call-prefix):

Old:
```js
                    Belföldi és nemzetközi fuvarozás
```
New:
```js
                    {t("landing.hero.eyebrow")}
```

Old:
```js
                  <span
                    className="hero-line-inner"
                    style={{ animationDelay: "120ms" }}
                  >
                    Szállítás, amire
                  </span>
                </span>{" "}
                <span className="hero-line-mask">
                  <span
                    className="hero-line-inner text-[#1E3AA8]"
                    style={{ animationDelay: "260ms" }}
                  >
                    percre pontosan
                  </span>
                </span>{" "}
                <span className="hero-line-mask">
                  <span
                    className="hero-line-inner"
                    style={{ animationDelay: "400ms" }}
                  >
                    számíthat.
                  </span>
                </span>
```
New:
```js
                  <span
                    className="hero-line-inner"
                    style={{ animationDelay: "120ms" }}
                  >
                    {t("landing.hero.headline.line1")}
                  </span>
                </span>{" "}
                <span className="hero-line-mask">
                  <span
                    className="hero-line-inner text-[#1E3AA8]"
                    style={{ animationDelay: "260ms" }}
                  >
                    {t("landing.hero.headline.line2")}
                  </span>
                </span>{" "}
                <span className="hero-line-mask">
                  <span
                    className="hero-line-inner"
                    style={{ animationDelay: "400ms" }}
                  >
                    {t("landing.hero.headline.line3")}
                  </span>
                </span>
```

Old:
```js
                <Reveal delay={520}>
                  <p className="text-lg text-[#23262B]/70 max-w-xl text-balance">
                    Szikora Transz Kft — profi áruszállítás és logisztika 2010
                    óta: belföldi és nemzetközi fuvarozás, modern flotta,
                    teljes körű biztosítás.
                  </p>
                </Reveal>

                <Reveal delay={780}>
                  <a
                    href="#services"
                    onClick={(e) => {
                      e.preventDefault();
                      smoothScroll("services");
                    }}
                    className="mt-6 inline-flex items-center gap-2 text-[#23262B]/70 hover:text-[#23262B] text-sm font-[Overpass] font-semibold transition-colors duration-300"
                  >
                    Szolgáltatásaink megismerése
                    <PiArrowRightLight className="text-xs" />
                  </a>
                </Reveal>
```
New:
```js
                <Reveal delay={520}>
                  <p className="text-lg text-[#23262B]/70 max-w-xl text-balance">
                    {t("landing.hero.subheading")}
                  </p>
                </Reveal>

                <Reveal delay={780}>
                  <a
                    href="#services"
                    onClick={(e) => {
                      e.preventDefault();
                      smoothScroll("services");
                    }}
                    className="mt-6 inline-flex items-center gap-2 text-[#23262B]/70 hover:text-[#23262B] text-sm font-[Overpass] font-semibold transition-colors duration-300"
                  >
                    {t("landing.hero.servicesLink")}
                    <PiArrowRightLight className="text-xs" />
                  </a>
                </Reveal>
```

Old:
```js
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-white">
                  Ingyenes árajánlat
                </span>
                <h2 className="font-[Overpass] font-extrabold text-2xl md:text-3xl text-white mt-3 mb-3">
                  Kérjen árajánlatot még ma
                </h2>
                <p className="text-white/60 mb-4 md:mb-6">
                  Töltse ki pár adatát, és 24 órán belül egyedi árajánlattal
                  válaszolunk — kötöttség nélkül.
                </p>

                <div className="space-y-2 mb-5 md:space-y-3 md:mb-8">
                  {[
                    "Teljesen ingyenes, nem kötelez semmire",
                    "Válasz 24 órán belül",
                    "Egyedi árazás minden fuvarra",
                  ].map((item) => (
```
New:
```js
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-white">
                  {t("landing.hero.quoteCard.eyebrow")}
                </span>
                <h2 className="font-[Overpass] font-extrabold text-2xl md:text-3xl text-white mt-3 mb-3">
                  {t("landing.hero.quoteCard.title")}
                </h2>
                <p className="text-white/60 mb-4 md:mb-6">{t("landing.hero.quoteCard.subtitle")}</p>

                <div className="space-y-2 mb-5 md:space-y-3 md:mb-8">
                  {t("landing.hero.quoteCard.bullets").map((item) => (
```

Old:
```js
                <button
                  onClick={() => smoothScroll("contact")}
                  className="w-full px-8 py-4 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl"
                >
                  Ingyenes ajánlatot kérek
                </button>

                <p className="text-center text-xs text-white/55 mt-5">
                  vagy hívjon közvetlenül:{" "}
```
New:
```js
                <button
                  onClick={() => smoothScroll("contact")}
                  className="w-full px-8 py-4 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl"
                >
                  {t("landing.hero.quoteCard.ctaButton")}
                </button>

                <p className="text-center text-xs text-white/55 mt-5">
                  {t("landing.hero.quoteCard.callPrefix")}{" "}
```

(the phone number link+text right after stays unchanged — it's the same literal number in both locales.)

**4g. Folyamat section:**

Old:
```js
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                A folyamat
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Így jut el az árujuk A-ból B-be
              </h2>
              <p className="text-[#23262B]/70 mt-4 text-lg">
                Négy lépés, amely minden fuvarra érvényes — a megrendeléstől a
                visszaigazolt kézbesítésig.
              </p>
```
New:
```js
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.process.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.process.title")}
              </h2>
              <p className="text-[#23262B]/70 mt-4 text-lg">{t("landing.process.intro")}</p>
```

Old:
```js
              {PROCESS_STEPS.map((step, index) => (
                <Reveal key={step.n} delay={index * 100} className="relative">
                  <div className="relative z-10 w-14 h-14 rounded-full bg-[#1E3AA8] text-white flex items-center justify-center font-[Overpass_Mono] font-bold border-4 border-[#F2F3F5] mb-5">
                    {step.n}
                  </div>
                  <p className="font-[Overpass] font-bold text-lg text-[#23262B] mb-2">
                    {step.title}
                  </p>
                  <p className="text-[#23262B]/70 text-sm leading-relaxed">
                    {step.desc}
                  </p>
                </Reveal>
              ))}
```
New:
```js
              {PROCESS_STEPS.map((step, index) => (
                <Reveal key={step.id} delay={index * 100} className="relative">
                  <div className="relative z-10 w-14 h-14 rounded-full bg-[#1E3AA8] text-white flex items-center justify-center font-[Overpass_Mono] font-bold border-4 border-[#F2F3F5] mb-5">
                    {step.n}
                  </div>
                  <p className="font-[Overpass] font-bold text-lg text-[#23262B] mb-2">
                    {t(`landing.processSteps.${step.id}.title`)}
                  </p>
                  <p className="text-[#23262B]/70 text-sm leading-relaxed">
                    {t(`landing.processSteps.${step.id}.desc`)}
                  </p>
                </Reveal>
              ))}
```

**4h. Szolgáltatások section (FEATURES grid + "Miért válasszon minket"):**

Old:
```js
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                Szolgáltatások
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Szolgáltatásaink
              </h2>
              <p className="text-[#23262B]/70 mt-4 text-lg">
                Teljes körű fuvarozási megoldások, amelyek kielégítik ügyfeleink
                egyedi igényeit — belföldön és külföldön egyaránt.
              </p>
```
New:
```js
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.services.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.services.title")}
              </h2>
              <p className="text-[#23262B]/70 mt-4 text-lg">{t("landing.services.intro")}</p>
```

Old:
```js
              {FEATURES.map((feature, index) => {
                return (
                  <Reveal key={feature.title} delay={index * 80}>
```
New:
```js
              {FEATURES.map((feature, index) => {
                return (
                  <Reveal key={feature.id} delay={index * 80}>
```

Old:
```js
                      <h3 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
                        {feature.href ? (
                          <Link to={feature.href} className="after:content-[''] after:absolute after:inset-0">
                            {feature.title}
                          </Link>
                        ) : (
                          feature.title
                        )}
                      </h3>
                      <p className="text-[#23262B]/70 leading-relaxed">
                        {feature.desc}
                      </p>
                      {feature.href && (
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-[Overpass] font-semibold text-[#1E3AA8] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          Részletek
                          <PiArrowRightLight className="text-xs" />
                        </span>
                      )}
```
New:
```js
                      <h3 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
                        {feature.href ? (
                          <Link
                            to={localizePath(feature.href, locale)}
                            className="after:content-[''] after:absolute after:inset-0"
                          >
                            {t(`landing.features.${feature.id}.title`)}
                          </Link>
                        ) : (
                          t(`landing.features.${feature.id}.title`)
                        )}
                      </h3>
                      <p className="text-[#23262B]/70 leading-relaxed">
                        {t(`landing.features.${feature.id}.desc`)}
                      </p>
                      {feature.href && (
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-[Overpass] font-semibold text-[#1E3AA8] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          {t("landing.services.detailsLink")}
                          <PiArrowRightLight className="text-xs" />
                        </span>
                      )}
```

Old:
```js
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                  Miért mi
                </span>
                <h3 className="font-[Overpass] font-extrabold text-3xl text-[#23262B] mt-3 mb-6">
                  Miért válasszon minket?
                </h3>
                <p className="text-lg text-[#23262B]/70 mb-8">
                  10+ éves tapasztalattal rendelkezünk a fuvarozási iparágban.
                  Flottánk állandóan karban van tartva, sofőreink képzettek és
                  megbízhatóak.
                </p>
                <div className="space-y-4">
                  {[
                    {
                      title: "Kiváló minőség",
                      desc: "Minden szállítási folyamat precíz tervezéssel és végrehajtással.",
                    },
                    {
                      title: "Rugalmasság",
                      desc: "Személyre szabott megoldások minden egyedi igényre.",
                    },
                    {
                      title: "Megbízhatóság",
                      desc: "Hosszú távú partnerségek, pontos határidőkkel és átlátható kommunikációval.",
                    },
                    {
                      title: "Családias hozzáállás",
                      desc: "Családi vállalkozásként indultunk, és így is kezelünk minden ügyfelet és sofőrt: emberközpontúan, tisztelettel.",
                    },
                  ].map((item, index) => (
```
New:
```js
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                  {t("landing.services.whyUs.eyebrow")}
                </span>
                <h3 className="font-[Overpass] font-extrabold text-3xl text-[#23262B] mt-3 mb-6">
                  {t("landing.services.whyUs.title")}
                </h3>
                <p className="text-lg text-[#23262B]/70 mb-8">{t("landing.services.whyUs.intro")}</p>
                <div className="space-y-4">
                  {t("landing.services.whyUs.bullets").map((item, index) => (
```

Old:
```js
                <picture>
                  <source srcSet="/kamionflotta-szikora-transz.webp" type="image/webp" />
                  <img
                    src="/kamionflotta-szikora-transz.jpg"
                    alt="Szikora Transz Kft. modern kamionflottája fuvarozás közben"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-[#23262B] via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6">
                  <p className="font-[Overpass] font-bold text-xl text-white mb-1">
                    Modern flotta
                  </p>
                  <p className="text-white/70 text-sm">
                    Több modern, karbantartott kamionból álló flottánk és
                    tapasztalt sofőreink garantálják a megbízható szállítást.
                  </p>
                </div>
```
New:
```js
                <picture>
                  <source srcSet="/kamionflotta-szikora-transz.webp" type="image/webp" />
                  <img
                    src="/kamionflotta-szikora-transz.jpg"
                    alt={t("landing.services.whyUs.imageAlt")}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-[#23262B] via-transparent to-transparent"></div>
                <div className="absolute bottom-0 left-0 p-6">
                  <p className="font-[Overpass] font-bold text-xl text-white mb-1">
                    {t("landing.services.whyUs.imageCaption.title")}
                  </p>
                  <p className="text-white/70 text-sm">{t("landing.services.whyUs.imageCaption.desc")}</p>
                </div>
```

**4i. Rólunk section:**

Old:
```js
                  <img
                    src="/kamion-orszagut-szikora-transz.jpg"
                    alt="Szikora Transz kamion borult égbolt alatt"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </picture>
                <div className="absolute inset-0 bg-[#23262B]/20"></div>
              </div>
              <div className="order-1 lg:order-2">
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                  Rólunk
                </span>
                <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3 mb-6">
                  Cégtörténetünk
                </h2>
                <p className="text-lg text-[#23262B]/70 mb-4">
                  Szikora Transz Kft 2010-ben alakult kis családi
                  vállalkozásként. Azóta folyamatosan bővült flottánk és
                  szolgáltatási körünk, de megtartottuk személyes hangvételünket
                  és ügyfélközpontú hozzáállásunkat.
                </p>
                <p className="text-lg text-[#23262B]/70 mb-8">
                  Mára belföldi és nemzetközi fuvarokat egyaránt vállalunk, a
                  rövid távú, sürgős megbízásoktól a rendszeres, hosszú távú
                  partnerségekig. Minden ügyfelünket úgy szolgáljuk ki, mintha a
                  saját árujuk lenne — legyen szó egyszeri fuvarról vagy
                  folyamatos együttműködésről.
                </p>
```
New:
```js
                  <img
                    src="/kamion-orszagut-szikora-transz.jpg"
                    alt={t("landing.about.imageAlt")}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </picture>
                <div className="absolute inset-0 bg-[#23262B]/20"></div>
              </div>
              <div className="order-1 lg:order-2">
                <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                  {t("landing.about.eyebrow")}
                </span>
                <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3 mb-6">
                  {t("landing.about.title")}
                </h2>
                <p className="text-lg text-[#23262B]/70 mb-4">{t("landing.about.paragraph1")}</p>
                <p className="text-lg text-[#23262B]/70 mb-8">{t("landing.about.paragraph2")}</p>
```

Old:
```js
                    <div>
                      <h3 className="font-[Overpass] font-semibold text-[#23262B]">
                        Karbantartott flotta
                      </h3>
                      <p className="text-[#23262B]/70 text-sm">
                        Több modern kamionból álló, állandóan karbantartott
                        flotta.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 border border-[#23262B]/10 rounded-xl p-4">
                    <div className="w-11 h-11 rounded-xl bg-[#1E3AA8]/10 text-[#1E3AA8] flex items-center justify-center flex-shrink-0">
                      <PiUserCircleLight />
                    </div>
                    <div>
                      <h3 className="font-[Overpass] font-semibold text-[#23262B]">
                        Tapasztalt sofőrök
                      </h3>
                      <p className="text-[#23262B]/70 text-sm">
                        Több tapasztalt, hosszú távú sofőr alkotja csapatunkat.
                      </p>
                    </div>
```
New:
```js
                    <div>
                      <h3 className="font-[Overpass] font-semibold text-[#23262B]">
                        {t("landing.about.tiles")[0].title}
                      </h3>
                      <p className="text-[#23262B]/70 text-sm">{t("landing.about.tiles")[0].desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 border border-[#23262B]/10 rounded-xl p-4">
                    <div className="w-11 h-11 rounded-xl bg-[#1E3AA8]/10 text-[#1E3AA8] flex items-center justify-center flex-shrink-0">
                      <PiUserCircleLight />
                    </div>
                    <div>
                      <h3 className="font-[Overpass] font-semibold text-[#23262B]">
                        {t("landing.about.tiles")[1].title}
                      </h3>
                      <p className="text-[#23262B]/70 text-sm">{t("landing.about.tiles")[1].desc}</p>
                    </div>
```

**4j. Referenciák section** (note the `t` loop-variable rename to `testimonial` to avoid shadowing the translation function):

Old:
```js
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                Ügyfélvisszajelzések
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Amit partnereink mondanak rólunk
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((t, index) => (
                <Reveal key={t.name} delay={index * 100}>
                  <div className="bg-white border border-[#23262B]/10 rounded-xl p-8 flex flex-col h-full">
                    <PiQuotesLight className="text-[#1E3AA8]/30 text-2xl mb-4" />
                    <p className="text-[#23262B]/75 leading-relaxed mb-6 flex-grow">
                      {t.quote}
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-[#23262B]/10">
                      <div className="w-11 h-11 rounded-full bg-[#23262B] text-white flex items-center justify-center font-[Overpass_Mono] font-bold text-sm flex-shrink-0">
                        {t.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="font-[Overpass] font-semibold text-[#23262B] text-sm">
                          {t.name}
                        </div>
                        <div className="text-[#23262B]/50 text-xs">
                          {t.role}, {t.company}
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="text-xs text-[#23262B]/35 mt-8 max-w-2xl">
              * A fenti referenciák minta-szövegek — érdemes őket valós ügyfelek
              visszajelzéseire cserélni a publikálás előtt.
            </p>
```
New:
```js
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.testimonials.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.testimonials.title")}
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((testimonial, index) => (
                <Reveal key={testimonial.id} delay={index * 100}>
                  <div className="bg-white border border-[#23262B]/10 rounded-xl p-8 flex flex-col h-full">
                    <PiQuotesLight className="text-[#1E3AA8]/30 text-2xl mb-4" />
                    <p className="text-[#23262B]/75 leading-relaxed mb-6 flex-grow">
                      {t(`landing.testimonialItems.${testimonial.id}.quote`)}
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-[#23262B]/10">
                      <div className="w-11 h-11 rounded-full bg-[#23262B] text-white flex items-center justify-center font-[Overpass_Mono] font-bold text-sm flex-shrink-0">
                        {testimonial.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")}
                      </div>
                      <div>
                        <div className="font-[Overpass] font-semibold text-[#23262B] text-sm">
                          {testimonial.name}
                        </div>
                        <div className="text-[#23262B]/50 text-xs">
                          {t(`landing.testimonialItems.${testimonial.id}.role`)},{" "}
                          {t(`landing.testimonialItems.${testimonial.id}.company`)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="text-xs text-[#23262B]/35 mt-8 max-w-2xl">{t("landing.testimonials.disclaimer")}</p>
```

**4k. GYIK section (FAQPage JSON-LD + accordion):**

Old:
```js
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            inLanguage: "hu",
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.a,
              },
            })),
          })}
        </script>
        <section id="gyik" className="py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                Gyakran ismételt kérdések
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Kérdése van? Válaszolunk.
              </h2>
            </div>

            <div className="divide-y divide-[#23262B]/10 border-t border-b border-[#23262B]/10">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={item.q}>
                    <h3>
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 py-6 text-left font-[Overpass] font-semibold text-[#23262B] text-lg"
                      >
                        {item.q}
                        <PiCaretDownLight
                          className={`text-[#1E3AA8] text-sm flex-shrink-0 transition-transform duration-300 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </h3>
                    {isOpen && (
                      <p className="text-[#23262B]/70 leading-relaxed pb-6 pr-8">
                        {item.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
```
New:
```js
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            inLanguage: locale,
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: t(`landing.faqItems.${item.id}.q`),
              acceptedAnswer: {
                "@type": "Answer",
                text: t(`landing.faqItems.${item.id}.a`),
              },
            })),
          })}
        </script>
        <section id="gyik" className="py-24 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12">
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.faq.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.faq.title")}
              </h2>
            </div>

            <div className="divide-y divide-[#23262B]/10 border-t border-b border-[#23262B]/10">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div key={item.id}>
                    <h3>
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 py-6 text-left font-[Overpass] font-semibold text-[#23262B] text-lg"
                      >
                        {t(`landing.faqItems.${item.id}.q`)}
                        <PiCaretDownLight
                          className={`text-[#1E3AA8] text-sm flex-shrink-0 transition-transform duration-300 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </h3>
                    {isOpen && (
                      <p className="text-[#23262B]/70 leading-relaxed pb-6 pr-8">
                        {t(`landing.faqItems.${item.id}.a`)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
```

**4l. Kapcsolat section (chrome + driver-application form):**

Old:
```js
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                Kapcsolat
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                Kapcsolatfelvétel
              </h2>
              <p className="text-[#23262B]/70 mt-4 text-lg">
                Kérjük töltse ki az alábbi űrlapot — gyors, ingyenes és
                semmilyen kötöttséggel nem jár.
              </p>
```
New:
```js
              <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8]">
                {t("landing.contact.eyebrow")}
              </span>
              <h2 className="font-[Overpass] font-extrabold text-3xl md:text-4xl text-[#23262B] mt-3">
                {t("landing.contact.title")}
              </h2>
              <p className="text-[#23262B]/70 mt-4 text-lg">{t("landing.contact.intro")}</p>
```

Old:
```js
                  <span className="inline-flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-emerald-700 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Sofőröket keresünk
                  </span>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <PiTruckLight className="text-lg" />
                    </div>
                    <h3 className="font-[Overpass] font-bold text-xl text-[#23262B]">
                      Csatlakozzon a csapatunkhoz
                    </h3>
                  </div>

                  <div className="space-y-2.5 mb-5">
                    {SOFOR_ELONYOK.map((elony) => (
                      <div key={elony} className="flex items-start gap-2.5 text-sm text-[#23262B]/70">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <PiCheckLight className="text-[11px]" />
                        </span>
                        {elony}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2.5 bg-white/70 border border-emerald-200/70 rounded-lg px-3.5 py-2.5 mb-6">
                    <PiIdentificationCardLight className="text-emerald-700 text-base flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#23262B]/60">
                      <span className="font-semibold text-[#23262B]/80">Amit kérünk: </span>
                      érvényes C+E kategóriás jogosítvány és GKI kártya.
                    </p>
                  </div>

                  <p className="text-[#23262B]/50 mb-6 text-sm">
                    Nem kérünk azonnal önéletrajzat — írjon pár sort, és
                    hamarosan felvesszük Önnel a kapcsolatot.
                  </p>
```
New:
```js
                  <span className="inline-flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-emerald-700 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    {t("landing.contact.driverForm.eyebrow")}
                  </span>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <PiTruckLight className="text-lg" />
                    </div>
                    <h3 className="font-[Overpass] font-bold text-xl text-[#23262B]">
                      {t("landing.contact.driverForm.title")}
                    </h3>
                  </div>

                  <div className="space-y-2.5 mb-5">
                    {t("landing.contact.driverForm.benefits").map((elony) => (
                      <div key={elony} className="flex items-start gap-2.5 text-sm text-[#23262B]/70">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <PiCheckLight className="text-[11px]" />
                        </span>
                        {elony}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2.5 bg-white/70 border border-emerald-200/70 rounded-lg px-3.5 py-2.5 mb-6">
                    <PiIdentificationCardLight className="text-emerald-700 text-base flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#23262B]/60">
                      <span className="font-semibold text-[#23262B]/80">
                        {t("landing.contact.driverForm.requirementPrefix")}{" "}
                      </span>
                      {t("landing.contact.driverForm.requirementText")}
                    </p>
                  </div>

                  <p className="text-[#23262B]/50 mb-6 text-sm">{t("landing.contact.driverForm.intro")}</p>
```

Old:
```js
                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          Teljes név
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={applicationForm.name}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder="Teljes név"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          Telefonszám
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={applicationForm.phone}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder="Telefonszám"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          Email cím
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={applicationForm.email}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder="Email cím"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          Pár sor Önről
                        </label>
                        <textarea
                          rows="3"
                          name="message"
                          value={applicationForm.message}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder="Pl. hány éve vezet kamiont, milyen jogosítványa/kártyája van..."
                          required
                        ></textarea>
                      </div>
```
New:
```js
                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          {t("landing.contact.driverForm.nameLabel")}
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={applicationForm.name}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder={t("landing.contact.driverForm.namePlaceholder")}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          {t("landing.contact.driverForm.phoneLabel")}
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={applicationForm.phone}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder={t("landing.contact.driverForm.phonePlaceholder")}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          {t("landing.contact.driverForm.emailLabel")}
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={applicationForm.email}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder={t("landing.contact.driverForm.emailPlaceholder")}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#23262B]/40 mb-2">
                          {t("landing.contact.driverForm.messageLabel")}
                        </label>
                        <textarea
                          rows="3"
                          name="message"
                          value={applicationForm.message}
                          onChange={handleApplicationChange}
                          className="w-full px-4 py-3 border border-emerald-200 bg-white rounded-xl text-[#23262B] focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 transition duration-300"
                          placeholder={t("landing.contact.driverForm.messagePlaceholder")}
                          required
                        ></textarea>
                      </div>
```

Old:
```js
                          Küldés...
                        </span>
                      ) : (
                        "Jelentkezem sofőrnek"
                      )}
```
New:
```js
                          {t("landing.contact.driverForm.submitLoading")}
                        </span>
                      ) : (
                        t("landing.contact.driverForm.submitDefault")
                      )}
```

### Step 5: Update the 6 view files' `pickFaq(...)` calls

`pickFaq`'s new signature is `pickFaq(t, ...selectors)`. Each of the 6 files needs `useTranslation` imported and its `pickFaq(...)` call updated with the `t` argument first, and every literal Hungarian question string replaced by its stable id (mapping below). None of these files' other props (`h1`/`intro`/`bullets`/etc.) are touched in this task — that's Tasks 6-11.

**`BelfoldiFuvarozas.js`** — old:
```js
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";

export default function BelfoldiFuvarozas() {
  return (
```
new:
```js
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function BelfoldiFuvarozas() {
  const { t } = useTranslation();
  return (
```
and old:
```js
      faqItems={pickFaq(
        "Mennyi idő alatt kapok ajánlatot?",
        "Mitől függ egy fuvar ára?",
        "Milyen járművekkel dolgoznak?",
        "Milyen fizetési feltételeket fogadnak el?",
      )}
```
new:
```js
      faqItems={pickFaq(t, "response_time", "pricing_factors", "vehicles", "payment_terms")}
```

**`NemzetkoziFuvarozas.js`** — apply the same import+hook addition pattern (add `useTranslation` import, add `const { t } = useTranslation();` as the first line of the component body), then replace its `pickFaq(...)` call (currently `"Vállalnak nemzetközi szállítást?"` plus 3 `{q, a}` overrides) with:
```js
      faqItems={pickFaq(
        t,
        "international",
        { id: "insurance", aKey: "pages.nemzetkozi.faqOverrides.insurance.a" },
        { id: "damage", aKey: "pages.nemzetkozi.faqOverrides.damage.a" },
        { id: "payment_terms", aKey: "pages.nemzetkozi.faqOverrides.payment_terms.a" },
      )}
```

**`BiztositottSzallitas.js`** — same import+hook pattern, then replace its `pickFaq(...)` call (currently 2 plain strings + 1 override) with:
```js
      faqItems={pickFaq(
        t,
        "insurance",
        "damage",
        { id: "response_time", aKey: "pages.biztositott.faqOverrides.response_time.a" },
      )}
```

**`ExpresszFuvarozas.js`** — same import+hook pattern, then replace its `pickFaq(...)` call (currently 3 overrides, no plain strings) with:
```js
      faqItems={pickFaq(
        t,
        { id: "response_time", aKey: "pages.expressz.faqOverrides.response_time.a" },
        { id: "pricing_factors", aKey: "pages.expressz.faqOverrides.pricing_factors.a" },
        { id: "custom_quote", aKey: "pages.expressz.faqOverrides.custom_quote.a" },
      )}
```

**`RendezvenySzallitas.js`** — same import+hook pattern, then replace its `pickFaq(...)` call (currently 3 overrides) with:
```js
      faqItems={pickFaq(
        t,
        { id: "response_time", aKey: "pages.rendezveny.faqOverrides.response_time.a" },
        { id: "custom_quote", aKey: "pages.rendezveny.faqOverrides.custom_quote.a" },
        { id: "vehicles", aKey: "pages.rendezveny.faqOverrides.vehicles.a" },
      )}
```

**`EgyediArajanlat.js`** — same import+hook pattern, then replace its `pickFaq(...)` call (currently 1 override + 1 plain + 1 override) with:
```js
      faqItems={pickFaq(
        t,
        { id: "pricing_factors", aKey: "pages.egyedi.faqOverrides.pricing_factors.a" },
        "custom_quote",
        { id: "payment_terms", aKey: "pages.egyedi.faqOverrides.payment_terms.a" },
      )}
```

(The `pages.<page>.faqOverrides.<id>.a` keys referenced above are added by Tasks 6-11, each in its own page's task — until then, `t()`'s missing-key fallback prints a dev-only console warning and falls back to the `hu` dictionary, which is also still missing that key at this point in the sequence, ultimately falling back to returning the raw path string. This is expected and harmless in HU rendering terms since these are override *answers* only — the base FAQ question/answer already renders correctly via the id; **verify this specific harmless-fallback behavior in Step 6 below, and expect it to fully resolve once Tasks 6-11 land.**)

### Step 6: Verify

1. `npm start`, visit `/` — confirm the ENTIRE homepage (nav, hero, folyamat, szolgáltatások, miért mi, rólunk, referenciák, GYIK, kapcsolat + sofőr form) still renders in Hungarian, pixel-identical to before. Submit the driver-application form with test data (or at least confirm it's still wired — check the Network tab shows a `sendJelentkezes` POST on submit).
2. Visit `/en` — confirm the SAME sections all render in English, the HU/EN switcher in the nav is present and highlights "EN", clicking "HU" navigates to `/`.
3. Visit each of the 6 HU service pages (`/belfoldi-fuvarozas-arajanlat`, etc.) — confirm their FAQ questions/answers and testimonial quotes still render correctly in Hungarian (this exercises the `pickFaq(t, ...)`/`TESTIMONIALS` migration from this task, even though those pages' OWN chrome isn't translated until later tasks).
4. Open devtools console on one HU service page (e.g. `NemzetkoziFuvarozas.js`) — you should see `[i18n] Missing "hu" translation for "pages.nemzetkozi.faqOverrides...` warnings (expected, harmless, dev-only — resolved by Task 7).
5. View source / devtools on `/en` — confirm `<html lang="en">` and 3 `<link rel="alternate" hreflang="...">` tags are present in `<head>`; same check on `/` for `hreflang="hu"`/`x-default`.

### Step 7: Commit

```bash
git add src/data/landingContent.js src/views/Landing.js src/i18n/hu.js src/i18n/en.js \
  src/views/landing/BelfoldiFuvarozas.js src/views/landing/NemzetkoziFuvarozas.js \
  src/views/landing/BiztositottSzallitas.js src/views/landing/ExpresszFuvarozas.js \
  src/views/landing/RendezvenySzallitas.js src/views/landing/EgyediArajanlat.js
git commit -m "feat: migrate shared content-array data model to i18n ids, translate Landing.js"
```

---

## Task 3: `ServicePage.js` + `Breadcrumb.js` translation

**Files:**
- Modify: `src/components/Landing/ServicePage.js`
- Modify: `src/components/Landing/Breadcrumb.js`
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `servicePage` export)

**Interfaces:**
- Consumes: `useTranslation()`, `localizePath()` (Task 1); `landing.servicePages.<id>`, `landing.testimonialItems.<id>.*`, `landing.breadcrumbHome` (Task 2).
- Produces: `Breadcrumb({ items, homeLabel = "Főoldal", homePath = "/" })` — new optional props, backward compatible (any other caller keeps working unchanged; there is no other caller today).

### Step 1: Replace the `servicePage` export in `src/i18n/hu.js`

Old: `export const servicePage = {};`
New:
```js
export const servicePage = {
  backLink: "← Vissza a főoldalra",
  ctaButton: "Ingyenes ajánlatot kérek",
  testimonialsTitle: "Amit partnereink mondanak rólunk",
  testimonialsDisclaimer:
    "* A fenti referenciák minta-szövegek — érdemes őket valós ügyfelek visszajelzéseire cserélni a publikálás előtt.",
  faqTitle: "Gyakran ismételt kérdések",
  otherServicesTitle: "Egyéb szolgáltatásaink",
};
```

### Step 2: Replace the `servicePage` export in `src/i18n/en.js`

Old: `export const servicePage = {};`
New:
```js
export const servicePage = {
  backLink: "← Back to homepage",
  ctaButton: "Request a Free Quote",
  testimonialsTitle: "What our partners say about us",
  testimonialsDisclaimer:
    "* The testimonials above are placeholder text — they should be replaced with real client feedback before publishing.",
  faqTitle: "Frequently Asked Questions",
  otherServicesTitle: "Other Services",
};
```

### Step 3: Migrate `src/components/Landing/ServicePage.js`

**3a. Imports:**

Old:
```js
import { TESTIMONIALS, SERVICE_PAGES } from "data/landingContent.js";
import { useSeo } from "utils/useSeo.js";
```
New:
```js
import { TESTIMONIALS, SERVICE_PAGES } from "data/landingContent.js";
import { useSeo } from "utils/useSeo.js";
import { useTranslation, localizePath } from "i18n/index.js";
```

**3b. Function body setup — locale, breadcrumb, useSeo:**

Old:
```js
  const currentService = SERVICE_PAGES.find((s) => s.path === path);
  const breadcrumbItems = currentService
    ? [{ name: currentService.label, path: currentService.path }]
    : [];
  useSeo({
    title: metaTitle,
    description: metaDescription,
    path,
    faqItems,
    breadcrumb: breadcrumbItems.length > 0 ? breadcrumbItems : undefined,
    service: currentService
      ? { name: currentService.label, description: metaDescription, areaServed }
      : undefined,
  });

  const otherServices = SERVICE_PAGES.filter((s) => s.path !== path);
```
New:
```js
  const { t, locale } = useTranslation();
  const currentService = SERVICE_PAGES.find((s) => s.path === path);
  const currentServiceLabel = currentService ? t(`landing.servicePages.${currentService.id}`) : null;
  const localizedPath = localizePath(path, locale);
  const breadcrumbItems = currentService
    ? [{ name: currentServiceLabel, path: localizedPath }]
    : [];
  useSeo({
    title: metaTitle,
    description: metaDescription,
    path: localizedPath,
    lang: locale,
    alternates: { hu: path, en: `/en${path}` },
    faqItems,
    breadcrumb: breadcrumbItems.length > 0 ? breadcrumbItems : undefined,
    service: currentService
      ? { name: currentServiceLabel, description: metaDescription, areaServed }
      : undefined,
  });

  const otherServices = SERVICE_PAGES.filter((s) => s.path !== path);
```

**3c. Testimonial resolution** (this component's `.map((t) => ...)` loop variable is renamed to `item` here since `t` now means the translation function):

Old:
```js
  const shownTestimonials =
    testimonialNames && testimonialNames.length > 0
      ? testimonialNames.map((n) => TESTIMONIALS.find((t) => t.name === n)).filter(Boolean)
      : TESTIMONIALS.slice(0, 3);
```
New:
```js
  const shownTestimonials = (
    testimonialNames && testimonialNames.length > 0
      ? testimonialNames.map((n) => TESTIMONIALS.find((item) => item.name === n)).filter(Boolean)
      : TESTIMONIALS.slice(0, 3)
  ).map((item) => ({
    name: item.name,
    quote: t(`landing.testimonialItems.${item.id}.quote`),
    role: t(`landing.testimonialItems.${item.id}.role`),
    company: t(`landing.testimonialItems.${item.id}.company`),
  }));
```

**3d. Nav — back link + language switcher:**

Old:
```js
      <nav className="border-b border-[#23262B]/8 bg-[#F2F3F5]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/">
            <img
              src="/logo2.svg"
              alt="Szikora Transz Kft"
              width="1600"
              height="578"
              className="h-9 w-auto"
              fetchpriority="high"
            />
          </Link>
          <Link
            to="/"
            className="text-sm font-[Overpass] font-semibold text-[#23262B]/70 hover:text-[#1E3AA8] transition-colors duration-300"
          >
            ← Vissza a főoldalra
          </Link>
        </div>
      </nav>
```
New:
```js
      <nav className="border-b border-[#23262B]/8 bg-[#F2F3F5]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to={localizePath("/", locale)}>
            <img
              src="/logo2.svg"
              alt="Szikora Transz Kft"
              width="1600"
              height="578"
              className="h-9 w-auto"
              fetchpriority="high"
            />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to={localizePath("/", locale)}
              className="text-sm font-[Overpass] font-semibold text-[#23262B]/70 hover:text-[#1E3AA8] transition-colors duration-300"
            >
              {t("servicePage.backLink")}
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide">
              <Link
                to={path}
                className={locale === "hu" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50 hover:text-[#23262B]"}
              >
                HU
              </Link>
              <span className="text-[#23262B]/30">|</span>
              <Link
                to={`/en${path}`}
                className={locale === "en" ? "text-[#1E3AA8] font-bold" : "text-[#23262B]/50 hover:text-[#23262B]"}
              >
                EN
              </Link>
            </span>
          </div>
        </div>
      </nav>
```

**3e. Breadcrumb usage:**

Old:
```js
        {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}
```
New:
```js
        {breadcrumbItems.length > 0 && (
          <Breadcrumb
            items={breadcrumbItems}
            homeLabel={t("landing.breadcrumbHome")}
            homePath={localizePath("/", locale)}
          />
        )}
```

**3f. Hero CTA button:**

Old:
```js
          <a
            href="#ajanlatkeres"
            className="relative mt-7 inline-flex items-center gap-2 px-6 py-3 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-colors duration-300"
          >
            Ingyenes ajánlatot kérek
            <PiArrowRightLight />
          </a>
```
New:
```js
          <a
            href="#ajanlatkeres"
            className="relative mt-7 inline-flex items-center gap-2 px-6 py-3 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold rounded-xl transition-colors duration-300"
          >
            {t("servicePage.ctaButton")}
            <PiArrowRightLight />
          </a>
```

**3g. Testimonials section:**

Old:
```js
        <section className="py-10 border-t border-[#23262B]/10">
          <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
            Amit partnereink mondanak rólunk
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {shownTestimonials.map((t) => (
              <div key={t.name} className="bg-white border border-[#23262B]/10 rounded-xl p-6 flex flex-col h-full">
                <PiQuotesLight className="text-[#1E3AA8]/30 text-2xl mb-3" />
                <p className="text-[#23262B]/75 text-sm leading-relaxed mb-5 flex-grow">{t.quote}</p>
                <div className="text-sm pt-3 border-t border-[#23262B]/10">
                  <div className="font-[Overpass] font-semibold text-[#23262B]">{t.name}</div>
                  <div className="text-[#23262B]/50 text-xs">
                    {t.role}, {t.company}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#23262B]/35 mt-6 max-w-2xl">
            * A fenti referenciák minta-szövegek — érdemes őket valós ügyfelek
            visszajelzéseire cserélni a publikálás előtt.
          </p>
        </section>
```
New:
```js
        <section className="py-10 border-t border-[#23262B]/10">
          <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
            {t("servicePage.testimonialsTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {shownTestimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="bg-white border border-[#23262B]/10 rounded-xl p-6 flex flex-col h-full"
              >
                <PiQuotesLight className="text-[#1E3AA8]/30 text-2xl mb-3" />
                <p className="text-[#23262B]/75 text-sm leading-relaxed mb-5 flex-grow">{testimonial.quote}</p>
                <div className="text-sm pt-3 border-t border-[#23262B]/10">
                  <div className="font-[Overpass] font-semibold text-[#23262B]">{testimonial.name}</div>
                  <div className="text-[#23262B]/50 text-xs">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#23262B]/35 mt-6 max-w-2xl">{t("servicePage.testimonialsDisclaimer")}</p>
        </section>
```

**3h. FAQ heading:**

Old:
```js
            <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
              Gyakran ismételt kérdések
            </h2>
```
New:
```js
            <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
              {t("servicePage.faqTitle")}
            </h2>
```

**3i. "Egyéb szolgáltatásaink" section:**

Old:
```js
        <section className="py-10 border-t border-[#23262B]/10">
          <h2 className="font-[Overpass_Mono] text-xs uppercase tracking-[0.2em] text-[#23262B]/50 mb-4">
            Egyéb szolgáltatásaink
          </h2>
          <div className="flex flex-wrap gap-3">
            {otherServices.map((s) => (
              <Link
                key={s.path}
                to={s.path}
                className="px-4 py-2 rounded-full border border-[#23262B]/15 text-sm font-[Overpass] font-medium text-[#23262B]/70 hover:border-[#1E3AA8]/50 hover:text-[#1E3AA8] transition-colors duration-300"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </section>
```
New:
```js
        <section className="py-10 border-t border-[#23262B]/10">
          <h2 className="font-[Overpass_Mono] text-xs uppercase tracking-[0.2em] text-[#23262B]/50 mb-4">
            {t("servicePage.otherServicesTitle")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {otherServices.map((s) => (
              <Link
                key={s.path}
                to={localizePath(s.path, locale)}
                className="px-4 py-2 rounded-full border border-[#23262B]/15 text-sm font-[Overpass] font-medium text-[#23262B]/70 hover:border-[#1E3AA8]/50 hover:text-[#1E3AA8] transition-colors duration-300"
              >
                {t(`landing.servicePages.${s.id}`)}
              </Link>
            ))}
          </div>
        </section>
```

### Step 4: Migrate `src/components/Landing/Breadcrumb.js`

Old:
```js
// Vizuális megfelelője a `useSeo.js` `breadcrumb` propjának — ugyanazt a
// `[{name, path}, ...]` listát várja, és a Főoldalt ugyanúgy automatikusan
// elé fűzi. A két helyen (JSON-LD + látható DOM) megjelenő tartalomnak
// egyeznie kell — a Google strukturáltadat-irányelvei ezt várják el egy
// BreadcrumbList sémától.
export default function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Morzsamenü" className="text-xs font-[Overpass_Mono] text-[#23262B]/50 mb-4">
      <ol className="flex items-center flex-wrap gap-x-2 gap-y-1">
        <li>
          <Link to="/" className="hover:text-[#1E3AA8] transition-colors duration-300">
            Főoldal
          </Link>
        </li>
```
New:
```js
// Vizuális megfelelője a `useSeo.js` `breadcrumb` propjának — ugyanazt a
// `[{name, path}, ...]` listát várja, és a Főoldalt ugyanúgy automatikusan
// elé fűzi. A két helyen (JSON-LD + látható DOM) megjelenő tartalomnak
// egyeznie kell — a Google strukturáltadat-irányelvei ezt várják el egy
// BreadcrumbList sémától. `homeLabel`/`homePath` lokalizálva jön a hívótól
// (ServicePage.js), hogy ez a komponens maga ne függjön az i18n-rétegtől.
export default function Breadcrumb({ items = [], homeLabel = "Főoldal", homePath = "/" }) {
  return (
    <nav aria-label="Morzsamenü" className="text-xs font-[Overpass_Mono] text-[#23262B]/50 mb-4">
      <ol className="flex items-center flex-wrap gap-x-2 gap-y-1">
        <li>
          <Link to={homePath} className="hover:text-[#1E3AA8] transition-colors duration-300">
            {homeLabel}
          </Link>
        </li>
```

### Step 5: Verify

1. Visit `/belfoldi-fuvarozas-arajanlat` (HU) — nav back-link, breadcrumb, hero CTA, testimonials heading/disclaimer, FAQ heading, "Egyéb szolgáltatásaink" links all still render correctly in Hungarian; "Egyéb szolgáltatásaink" links still point at the 5 other HU service pages.
2. Visit `/en/belfoldi-fuvarozas-arajanlat` — same chrome now in English; "Egyéb szolgáltatásaink"(now "Other Services") links point at `/en/nemzetkozi-fuvarozas-vamugyintezessel` etc. (still `/en`-prefixed); breadcrumb shows "Home / Domestic Freight"; testimonials show English quote/role/company text.
3. Click the HU/EN switcher on this page both directions — confirm it lands on the *same* service page in the other language, not the homepage.
4. View source on `/en/belfoldi-fuvarozas-arajanlat` — confirm the `Service` and `BreadcrumbList` JSON-LD blocks show `"inLanguage":"en"` and English names.

### Step 6: Commit

```bash
git add src/components/Landing/ServicePage.js src/components/Landing/Breadcrumb.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate ServicePage.js chrome and Breadcrumb.js"
```

---

## Task 4: `QuoteForm.js` translation

**Files:**
- Modify: `src/components/Landing/QuoteForm.js`
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `quoteForm` export)

**Interfaces:**
- Consumes: `useTranslation()`, `localizePath()` (Task 1).
- Produces: `<QuoteForm title?, subtitle? />` — same optional-override props as before, now resolved against locale-aware defaults instead of hardcoded Hungarian defaults, so existing callers (`Landing.js`, `ServicePage.js`, both call it with zero props) keep working unchanged.
- **Explicit constraint**: `composeMessage()`'s output stays Hungarian regardless of `locale` — it uses its own `IRANY_LABELS_HU`/`IDOZITES_LABELS_HU` maps, never the translated `iranyOptions`/`idozitesOptions` used for the on-screen pills.

### Step 1: Replace the `quoteForm` export in `src/i18n/hu.js`

Old: `export const quoteForm = {};`
New:
```js
export const quoteForm = {
  directionOptions: { domestic: "Belföldi", international: "Nemzetközi", unsure: "Még nem tudom" },
  timingOptions: {
    urgent: "Sürgős (napokon belül)",
    fewWeeks: "Pár héten belül",
    justPlanning: "Még csak tervezem",
  },
  invalid: {
    name: "Adja meg a teljes nevét.",
    phone: "Adjon meg egy érvényes telefonszámot.",
    email: "Adjon meg egy érvényes email címet.",
    description: "Írja le röviden, mit szállítanánk.",
    consent: "Az adatkezelési hozzájárulás elfogadása szükséges a küldéshez.",
  },
  defaultTitle: "Kérje egyedi árajánlatát",
  defaultSubtitle:
    "Töltse ki az alábbi űrlapot — 24 órán belül személyre szabott árajánlattal válaszolunk, kötelezettség nélkül.",
  responseBadge: "Válasz 24 órán belül",
  successMessage:
    "Köszönjük, {name}! Ajánlatkérését megkaptuk — 24 órán belül felvesszük Önnel a kapcsolatot telefonon vagy e-mailben.",
  errorFallback: "Hiba történt a küldés közben. Kérjük, próbálja meg újra, vagy hívjon minket közvetlenül:",
  labels: {
    name: "Teljes név",
    phone: "Telefonszám",
    email: "Email cím",
    shipmentDetailsHeading: "Fuvar részletei",
    shipmentDetailsHint: "— opcionális, segít pontosabb ajánlatot adni",
    direction: "Belföldi vagy nemzetközi fuvar?",
    from: "Honnan?",
    to: "Hová?",
    timing: "Mikorra lenne szükség rá?",
    description: "Mit és mennyit szállítanánk?",
    consentPrefix: "Elfogadom, hogy adataimat az ajánlatadás céljából kezeljék.",
    consentLinkText: "Adatvédelmi tájékoztató",
    submit: "Árajánlatot kérek",
    submitLoading: "Küldés...",
    footnote: "Nem jár kötelezettséggel · Válasz 24 órán belül",
  },
  placeholders: {
    name: "Teljes név",
    phone: "Telefonszám",
    email: "Email cím",
    from: "pl. Budapest",
    to: "pl. München",
    description: "pl. 2 raklap gépalkatrész, kb. 800 kg",
  },
};
```

### Step 2: Replace the `quoteForm` export in `src/i18n/en.js`

Old: `export const quoteForm = {};`
New:
```js
export const quoteForm = {
  directionOptions: { domestic: "Domestic", international: "International", unsure: "Not sure yet" },
  timingOptions: {
    urgent: "Urgent (within days)",
    fewWeeks: "Within a few weeks",
    justPlanning: "Just planning ahead",
  },
  invalid: {
    name: "Please enter your full name.",
    phone: "Please enter a valid phone number.",
    email: "Please enter a valid email address.",
    description: "Please briefly describe what you'd like to ship.",
    consent: "You must accept the data processing consent to submit the form.",
  },
  defaultTitle: "Request Your Custom Quote",
  defaultSubtitle:
    "Fill out the form below — we'll respond within 24 hours with a personalized quote, no obligation.",
  responseBadge: "Response within 24 hours",
  successMessage:
    "Thank you, {name}! We've received your quote request — we'll be in touch by phone or email within 24 hours.",
  errorFallback: "Something went wrong while sending your request. Please try again, or call us directly:",
  labels: {
    name: "Full Name",
    phone: "Phone Number",
    email: "Email Address",
    shipmentDetailsHeading: "Shipment Details",
    shipmentDetailsHint: "— optional, helps us give you a more accurate quote",
    direction: "Domestic or international shipment?",
    from: "From?",
    to: "To?",
    timing: "When do you need it?",
    description: "What and how much would you like to ship?",
    consentPrefix: "I agree that my data may be processed for the purpose of providing a quote.",
    consentLinkText: "Privacy Policy",
    submit: "Request a Quote",
    submitLoading: "Sending...",
    footnote: "No obligation · Response within 24 hours",
  },
  placeholders: {
    name: "Full name",
    phone: "Phone number",
    email: "Email address",
    from: "e.g. Budapest",
    to: "e.g. Munich",
    description: "e.g. 2 pallets of machine parts, approx. 800 kg",
  },
};
```

### Step 3: Migrate `src/components/Landing/QuoteForm.js`

**3a. Imports + module-level constants** (`IRANY_OPTIONS`/`IDOZITES_OPTIONS` are removed — they're replaced by a locale-invariant HU-only pair used exclusively by `composeMessage()`, plus locale-aware equivalents built inside the component for the on-screen pills):

Old:
```js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PiEnvelopeLight, PiClockLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

const IRANY_OPTIONS = [
  { value: "belfoldi", label: "Belföldi" },
  { value: "nemzetkozi", label: "Nemzetközi" },
  { value: "nemtudom", label: "Még nem tudom" },
];

const IDOZITES_OPTIONS = [
  { value: "surgos", label: "Sürgős (napokon belül)" },
  { value: "nehany_het", label: "Pár héten belül" },
  { value: "tervezem", label: "Még csak tervezem" },
];
```
New:
```js
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PiEnvelopeLight, PiClockLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { useTranslation, localizePath } from "i18n/index.js";

// A `composeMessage()` admin felé menő szabad szöveg-blokkja MINDIG magyarul
// megy ki, függetlenül a látogató által választott UI-nyelvtől (ld. a design
// dokumentum "Explicit döntés" pontja) — ezért ez a két map külön, nem
// fordított marad, elkülönítve a lenti, UI-nak szánt `iranyOptions`/
// `idozitesOptions`-tól (amik a komponensben, `t()`-vel épülnek fel).
const IRANY_LABELS_HU = {
  belfoldi: "Belföldi",
  nemzetkozi: "Nemzetközi",
  nemtudom: "Még nem tudom",
};

const IDOZITES_LABELS_HU = {
  surgos: "Sürgős (napokon belül)",
  nehany_het: "Pár héten belül",
  tervezem: "Még csak tervezem",
};
```

**3b. Remove module-level `INVALID_MESSAGES`/`handleInvalid`/`clearInvalid`** (moved inside the component, since they now need `t()`):

Old:
```js
const INVALID_MESSAGES = {
  name: "Adja meg a teljes nevét.",
  phone: "Adjon meg egy érvényes telefonszámot.",
  email: "Adjon meg egy érvényes email címet.",
  leiras: "Írja le röviden, mit szállítanánk.",
  hozzajarulas: "Az adatkezelési hozzájárulás elfogadása szükséges a küldéshez.",
};

function handleInvalid(e) {
  e.target.setCustomValidity(INVALID_MESSAGES[e.target.name] || "");
}
function clearInvalid(e) {
  e.target.setCustomValidity("");
}

const EMPTY_FORM = {
```
New:
```js
const EMPTY_FORM = {
```

**3c. Component setup — `useTranslation()`, resolved title/subtitle, moved-in invalid handlers, locale-aware pill options, HU-only `composeMessage()`:**

Old:
```js
export default function QuoteForm({
  title = "Kérje egyedi árajánlatát",
  subtitle = "Töltse ki az alábbi űrlapot — 24 órán belül személyre szabott árajánlattal válaszolunk, kötelezettség nélkül.",
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ success: null, message: "" });

  const handleChange = (e) => {
    clearInvalid(e);
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleConsentChange = (e) => {
    clearInvalid(e);
    setForm((prev) => ({ ...prev, hozzajarulas: e.target.checked }));
  };

  const composeMessage = () => {
    const irany = IRANY_OPTIONS.find((o) => o.value === form.irany)?.label;
    const idozites = IDOZITES_OPTIONS.find((o) => o.value === form.idozites)?.label;
    const details = [];
    if (irany) details.push(`Fuvar iránya: ${irany}`);
    if (form.honnan) details.push(`Honnan: ${form.honnan}`);
    if (form.hova) details.push(`Hová: ${form.hova}`);
    if (idozites) details.push(`Időzítés: ${idozites}`);
    return [details.join(" · "), form.leiras].filter(Boolean).join("\n\n");
  };
```
New:
```js
export default function QuoteForm({ title, subtitle }) {
  const { t, locale } = useTranslation();
  const resolvedTitle = title || t("quoteForm.defaultTitle");
  const resolvedSubtitle = subtitle || t("quoteForm.defaultSubtitle");

  const invalidMessages = {
    name: t("quoteForm.invalid.name"),
    phone: t("quoteForm.invalid.phone"),
    email: t("quoteForm.invalid.email"),
    leiras: t("quoteForm.invalid.description"),
    hozzajarulas: t("quoteForm.invalid.consent"),
  };
  const handleInvalid = (e) => {
    e.target.setCustomValidity(invalidMessages[e.target.name] || "");
  };
  const clearInvalid = (e) => {
    e.target.setCustomValidity("");
  };

  const iranyOptions = [
    { value: "belfoldi", label: t("quoteForm.directionOptions.domestic") },
    { value: "nemzetkozi", label: t("quoteForm.directionOptions.international") },
    { value: "nemtudom", label: t("quoteForm.directionOptions.unsure") },
  ];
  const idozitesOptions = [
    { value: "surgos", label: t("quoteForm.timingOptions.urgent") },
    { value: "nehany_het", label: t("quoteForm.timingOptions.fewWeeks") },
    { value: "tervezem", label: t("quoteForm.timingOptions.justPlanning") },
  ];

  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ success: null, message: "" });

  const handleChange = (e) => {
    clearInvalid(e);
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleConsentChange = (e) => {
    clearInvalid(e);
    setForm((prev) => ({ ...prev, hozzajarulas: e.target.checked }));
  };

  // Mindig magyarul megy ki, függetlenül a UI nyelvétől — ld. a fájl
  // tetején lévő megjegyzést.
  const composeMessage = () => {
    const irany = IRANY_LABELS_HU[form.irany];
    const idozites = IDOZITES_LABELS_HU[form.idozites];
    const details = [];
    if (irany) details.push(`Fuvar iránya: ${irany}`);
    if (form.honnan) details.push(`Honnan: ${form.honnan}`);
    if (form.hova) details.push(`Hová: ${form.hova}`);
    if (idozites) details.push(`Időzítés: ${idozites}`);
    return [details.join(" · "), form.leiras].filter(Boolean).join("\n\n");
  };
```

**3d. Submit success/error messages:**

Old:
```js
    if (result && result.success) {
      setSubmitStatus({
        success: true,
        message: `Köszönjük, ${submittedName}! Ajánlatkérését megkaptuk — 24 órán belül felvesszük Önnel a kapcsolatot telefonon vagy e-mailben.`,
      });
      setForm(EMPTY_FORM);
    } else {
      setSubmitStatus({
        success: false,
        message:
          result.message ||
          "Hiba történt a küldés közben. Kérjük, próbálja meg újra, vagy hívjon minket közvetlenül:",
      });
    }
```
New:
```js
    if (result && result.success) {
      setSubmitStatus({
        success: true,
        message: t("quoteForm.successMessage").replace("{name}", submittedName),
      });
      setForm(EMPTY_FORM);
    } else {
      setSubmitStatus({
        success: false,
        message: result.message || t("quoteForm.errorFallback"),
      });
    }
```

**3e. Title/subtitle/badge in the render:**

Old:
```js
          <h3 className="font-[Overpass] font-bold text-2xl text-white">{title}</h3>
        </div>
        <p className="text-white/50 mb-3">{subtitle}</p>
        <div className="inline-flex items-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#7C93FF] bg-[#2F4DE0]/15 px-3 py-1 rounded-full mb-8">
          <PiClockLight />
          Válasz 24 órán belül
        </div>
```
New:
```js
          <h3 className="font-[Overpass] font-bold text-2xl text-white">{resolvedTitle}</h3>
        </div>
        <p className="text-white/50 mb-3">{resolvedSubtitle}</p>
        <div className="inline-flex items-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#7C93FF] bg-[#2F4DE0]/15 px-3 py-1 rounded-full mb-8">
          <PiClockLight />
          {t("quoteForm.responseBadge")}
        </div>
```

**3f. Name/phone/email fields:**

Old:
```js
            <div>
              <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                Teljes név
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                onInvalid={handleInvalid}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                placeholder="Teljes név"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                  Telefonszám
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  onInvalid={handleInvalid}
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  placeholder="Telefonszám"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                  Email cím
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  onInvalid={handleInvalid}
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  placeholder="Email cím"
                  required
                />
              </div>
            </div>
```
New:
```js
            <div>
              <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                {t("quoteForm.labels.name")}
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                onInvalid={handleInvalid}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                placeholder={t("quoteForm.placeholders.name")}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                  {t("quoteForm.labels.phone")}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  onInvalid={handleInvalid}
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  placeholder={t("quoteForm.placeholders.phone")}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                  {t("quoteForm.labels.email")}
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  onInvalid={handleInvalid}
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  placeholder={t("quoteForm.placeholders.email")}
                  required
                />
              </div>
            </div>
```

**3g. Shipment-details section (heading/hint, direction pills, from/to, timing pills, description textarea):**

Old:
```js
            <div className="pt-1 border-t border-white/10">
              <p className="text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mt-5 mb-3">
                Fuvar részletei <span className="normal-case text-white/30">— opcionális, segít pontosabb ajánlatot adni</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                    Belföldi vagy nemzetközi fuvar?
                  </label>
                  <PillGroup
                    options={IRANY_OPTIONS}
                    value={form.irany}
                    onChange={(v) => setForm((prev) => ({ ...prev, irany: v }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                      Honnan?
                    </label>
                    <input
                      type="text"
                      name="honnan"
                      value={form.honnan}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                      placeholder="pl. Budapest"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                      Hová?
                    </label>
                    <input
                      type="text"
                      name="hova"
                      value={form.hova}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                      placeholder="pl. München"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                    Mikorra lenne szükség rá?
                  </label>
                  <PillGroup
                    options={IDOZITES_OPTIONS}
                    value={form.idozites}
                    onChange={(v) => setForm((prev) => ({ ...prev, idozites: v }))}
                  />
                </div>
              </div>
            </div>

            <div className="pt-1 border-t border-white/10">
              <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2 mt-5">
                Mit és mennyit szállítanánk?
              </label>
              <textarea
                rows="4"
                name="leiras"
                value={form.leiras}
                onChange={handleChange}
                onInvalid={handleInvalid}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                placeholder="pl. 2 raklap gépalkatrész, kb. 800 kg"
                required
              ></textarea>
            </div>
          </div>
```
New:
```js
            <div className="pt-1 border-t border-white/10">
              <p className="text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mt-5 mb-3">
                {t("quoteForm.labels.shipmentDetailsHeading")}{" "}
                <span className="normal-case text-white/30">{t("quoteForm.labels.shipmentDetailsHint")}</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                    {t("quoteForm.labels.direction")}
                  </label>
                  <PillGroup
                    options={iranyOptions}
                    value={form.irany}
                    onChange={(v) => setForm((prev) => ({ ...prev, irany: v }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                      {t("quoteForm.labels.from")}
                    </label>
                    <input
                      type="text"
                      name="honnan"
                      value={form.honnan}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                      placeholder={t("quoteForm.placeholders.from")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                      {t("quoteForm.labels.to")}
                    </label>
                    <input
                      type="text"
                      name="hova"
                      value={form.hova}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                      placeholder={t("quoteForm.placeholders.to")}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                    {t("quoteForm.labels.timing")}
                  </label>
                  <PillGroup
                    options={idozitesOptions}
                    value={form.idozites}
                    onChange={(v) => setForm((prev) => ({ ...prev, idozites: v }))}
                  />
                </div>
              </div>
            </div>

            <div className="pt-1 border-t border-white/10">
              <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2 mt-5">
                {t("quoteForm.labels.description")}
              </label>
              <textarea
                rows="4"
                name="leiras"
                value={form.leiras}
                onChange={handleChange}
                onInvalid={handleInvalid}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                placeholder={t("quoteForm.placeholders.description")}
                required
              ></textarea>
            </div>
          </div>
```

**3h. Consent checkbox, submit button, footnote:**

Old:
```js
            <span className="text-sm text-white/55">
              Elfogadom, hogy adataimat az ajánlatadás céljából kezeljék.{" "}
              <Link
                to="/adatvedelem"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-white/75 hover:text-white"
              >
                Adatvédelmi tájékoztató
              </Link>
            </span>
          </label>
```
New:
```js
            <span className="text-sm text-white/55">
              {t("quoteForm.labels.consentPrefix")}{" "}
              <Link
                to={localizePath("/adatvedelem", locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-white/75 hover:text-white"
              >
                {t("quoteForm.labels.consentLinkText")}
              </Link>
            </span>
          </label>
```

Old:
```js
                Küldés...
              </span>
            ) : (
              "Árajánlatot kérek"
            )}
          </button>
          <p className="text-center text-xs text-white/40 mt-3">
            Nem jár kötelezettséggel · Válasz 24 órán belül
          </p>
```
New:
```js
                {t("quoteForm.labels.submitLoading")}
              </span>
            ) : (
              t("quoteForm.labels.submit")
            )}
          </button>
          <p className="text-center text-xs text-white/40 mt-3">{t("quoteForm.labels.footnote")}</p>
```

### Step 4: Verify

1. Visit `/` (HU) — the QuoteForm inside "Kapcsolat" renders identically to before (all labels/placeholders Hungarian). Fill it out (direction=Nemzetközi, honnan=Budapest, hova=Bécs, időzítés=Sürgős, leírás="teszt"), open devtools Network tab, submit, and inspect the `sendAjanlatkeres` POST body's `message` field — confirm it reads `Fuvar iránya: Nemzetközi · Honnan: Budapest · Hová: Bécs · Időzítés: Sürgős (napokon belül)\n\nteszt` (Hungarian).
2. Visit `/en` — the same form now shows English labels/placeholders/badge/button/footnote/consent text (linking to `/en/adatvedelem`). Submit the same test data with the SAME field choices (International/Budapest/Vienna/Urgent) and confirm the Network tab's `message` payload is **still the Hungarian text** from step 1's format (`Fuvar iránya: Nemzetközi · ...`) — this is the explicit "admin always reads Hungarian" behavior; it must NOT say "Direction: International" or similar.
3. Trigger a validation error (leave "Full Name" empty and submit) on `/en` — confirm the browser's native validation bubble shows the English message (`Please enter your full name.`).
4. Visit `/en/belfoldi-fuvarozas-arajanlat` — confirm the embedded QuoteForm (via `ServicePage.js`, no title/subtitle props passed) shows the same English default title/subtitle.

### Step 5: Commit

```bash
git add src/components/Landing/QuoteForm.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate QuoteForm.js, keep admin-facing message body Hungarian-only"
```

---

## Task 5: `BelfoldiFuvarozas.js` translation

**Files:**
- Modify (full rewrite): `src/views/landing/BelfoldiFuvarozas.js`
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `pagesBelfoldi` export)

**Interfaces:**
- Consumes: `useTranslation()`, `localizePath()` (Task 1); `pickFaq(t, ...)` (Task 2); `ServicePage` props contract (unchanged, Task 3).

### Step 1: Replace the `pagesBelfoldi` export in `src/i18n/hu.js`

Old: `export const pagesBelfoldi = {};`
New:
```js
export const pagesBelfoldi = {
  metaTitle: "Belföldi fuvarozás árajánlat | Szikora Transz Kft.",
  metaDescription:
    "Kérjen ingyenes árajánlatot belföldi fuvarozásra Magyarország egész területén — modern flotta, biztosított szállítás, válasz 24 órán belül.",
  eyebrow: "Belföldi fuvarozás",
  h1: "Belföldi fuvarozás árajánlat — 24 órán belül",
  intro:
    "Gyors és megbízható áruszállítás Magyarország egész területén, rugalmas árazással és pontos határidőkkel. Egyaránt vállalunk egyszeri megbízásokat és rendszeres, ismétlődő fuvarokat — az áru jellegétől függetlenül.",
  bullets: [
    {
      title: "Rugalmas, egyedi árazás",
      desc: "Nincs egységes díjszabás — minden fuvart a távolság, az áru jellege és a határidő alapján, tételesen árazunk.",
    },
    {
      title: "Modern, karbantartott flotta",
      desc: "A szállítandó áru jellegéhez igazított jármű kiválasztása az ajánlatkérés során történik.",
    },
    {
      title: "Egyszeri és rendszeres fuvarok",
      desc: "Ugyanúgy vállalunk alkalmi megbízást, mint hosszú távú, ismétlődő partnerséget.",
    },
    {
      title: "Teljes körű biztosítás",
      desc: "Minden belföldi fuvarunk a felvételtől a kiszállításig biztosítási fedezet mellett zajlik.",
    },
  ],
  section: { heading: "Hogyan alakul ki a belföldi fuvar ára?" },
};
```

### Step 2: Replace the `pagesBelfoldi` export in `src/i18n/en.js`

Old: `export const pagesBelfoldi = {};`
New:
```js
export const pagesBelfoldi = {
  metaTitle: "Domestic Freight Transport Quote | Szikora Transz Kft.",
  metaDescription:
    "Request a free quote for domestic freight transport anywhere in Hungary — modern fleet, insured shipping, response within 24 hours.",
  eyebrow: "Domestic Freight Transport",
  h1: "Domestic Freight Transport Quote — Within 24 Hours",
  intro:
    "Fast, reliable freight transport across the whole of Hungary, with flexible pricing and precise deadlines. We handle both one-off jobs and regular, recurring routes — regardless of the type of cargo.",
  bullets: [
    {
      title: "Flexible, custom pricing",
      desc: "There's no flat rate — every job is priced individually based on distance, cargo type, and deadline.",
    },
    {
      title: "Modern, well-maintained fleet",
      desc: "We match the vehicle to your cargo when we put together your quote.",
    },
    {
      title: "One-off and recurring jobs",
      desc: "We take on occasional assignments just as readily as long-term, recurring partnerships.",
    },
    {
      title: "Full insurance coverage",
      desc: "Every domestic shipment we handle is covered by insurance from pickup to delivery.",
    },
  ],
  section: { heading: "How is the price of a domestic shipment calculated?" },
};
```

### Step 3: Rewrite `src/views/landing/BelfoldiFuvarozas.js` (full file content)

```js
import React from "react";
import { Link } from "react-router-dom";
import { PiTruckLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation, localizePath } from "i18n/index.js";

export default function BelfoldiFuvarozas() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiTruckLight}
      accent="#1E3AA8"
      path="/belfoldi-fuvarozas-arajanlat"
      metaTitle={t("pages.belfoldi.metaTitle")}
      metaDescription={t("pages.belfoldi.metaDescription")}
      eyebrow={t("pages.belfoldi.eyebrow")}
      h1={t("pages.belfoldi.h1")}
      intro={t("pages.belfoldi.intro")}
      bullets={t("pages.belfoldi.bullets")}
      faqItems={pickFaq(t, "response_time", "pricing_factors", "vehicles", "payment_terms")}
      testimonialNames={["Nagy Péter", "Szabó Katalin", "Farkas Zoltán"]}
      areaServed={["HU"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.belfoldi.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                Two things help us give you the fastest, most accurate quote: the exact pickup and delivery
                addresses (is loading equipment available on site, or does it need to be done by hand), and
                whether it's a partial load or a full truckload — the latter directly determines the size and
                type of vehicle we assign to the job.
              </p>
              <p>
                Vehicle selection follows the same logic: smaller, faster jobs get a lighter truck, heavier
                loads get a bigger one. If it's a regular, recurring route (e.g. the same destination several
                times a week), let us know when requesting your quote — for our regular partners, we agree on
                scheduling and pricing over the longer term, rather than renegotiating for every single job.
              </p>
              <p>
                Once you accept a quote, most domestic jobs are scheduled for the very next business day. Need
                something even more urgent — same-day, or within just a few hours? Check the terms of our{" "}
                <Link
                  to={localizePath("/expressz-fuvarozas", locale)}
                  className="text-[#1E3AA8] underline hover:text-[#172E86] transition-colors duration-300"
                >
                  express freight transport
                </Link>{" "}
                — that's where we give short-notice jobs priority handling.
              </p>
            </>
          ) : (
            <>
              <p>
                Az ajánlatkérésnél két dolog segít a leggyorsabb, legpontosabb
                árazásban: a pontos fel- és lerakodási cím (van-e rakodógép a
                helyszínen, vagy kézi erővel kell megoldani), és hogy
                részrakományról vagy teljes kamionrakományról van-e szó — ez
                utóbbi közvetlenül meghatározza, milyen méretű és típusú
                járművet rendelünk a fuvarhoz.
              </p>
              <p>
                A jármű kiválasztása is ehhez igazodik: kisebb, gyors fuvaroknál
                könnyebb, nagyobb terhelésnél nehezebb kamiont állítunk munkába.
                Ha rendszeres, ismétlődő útvonalról van szó (pl. heti több
                alkalommal ugyanarra a célállomásra), ezt jelezze az
                ajánlatkérésnél — állandó partnereinknél az ütemezést és az
                árazást is hosszabb távra egyeztetjük, nem fuvaronként
                újratárgyalva.
              </p>
              <p>
                Miután elfogadta az árajánlatot, a legtöbb belföldi fuvart már a
                következő munkanapon ütemezzük. Ennél sürgősebb, akár aznapi
                vagy pár órás határidőre van szüksége? Nézze meg az{" "}
                <Link
                  to={localizePath("/expressz-fuvarozas", locale)}
                  className="text-[#1E3AA8] underline hover:text-[#172E86] transition-colors duration-300"
                >
                  expressz fuvarozás
                </Link>{" "}
                feltételeit — ott soron kívül kezeljük a rövid határidejű
                megbízásokat.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
```

(Note: the `<Link to="/expressz-fuvarozas">` target changed from a hardcoded string to `localizePath("/expressz-fuvarozas", locale)` — a small, deliberate fix beyond pure translation, since on `/en/belfoldi-fuvarozas-arajanlat` the in-copy cross-link must point at `/en/expressz-fuvarozas`, not the HU page.)

### Step 4: Verify

1. Visit `/belfoldi-fuvarozas-arajanlat` — unchanged Hungarian content, the "expressz fuvarozás" inline link still goes to `/expressz-fuvarozas`.
2. Visit `/en/belfoldi-fuvarozas-arajanlat` — full English content (hero/bullets/FAQ/custom section), the "express freight transport" inline link goes to `/en/expressz-fuvarozas` (not yet translated — that's Task 8 — but the route itself should load).
3. Devtools console — no `[i18n]` warnings for any `pages.belfoldi.*` key on either locale.

### Step 5: Commit

```bash
git add src/views/landing/BelfoldiFuvarozas.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate BelfoldiFuvarozas.js service page"
```

---

## Task 6: `NemzetkoziFuvarozas.js` translation

**Files:**
- Modify (full rewrite): `src/views/landing/NemzetkoziFuvarozas.js`
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `pagesNemzetkozi` export)

**Interfaces:** Consumes `useTranslation()` (Task 1), `pickFaq(t, ...)` (Task 2). No internal cross-links on this page (only an external `nav.gov.hu` link, URL unchanged across locales).

### Step 1: Replace `pagesNemzetkozi` in `src/i18n/hu.js`

Old: `export const pagesNemzetkozi = {};`
New:
```js
export const pagesNemzetkozi = {
  metaTitle: "Nemzetközi fuvarozás vámügyintézéssel | Szikora Transz Kft.",
  metaDescription:
    "Nemzetközi fuvarozás Európa-szerte, teljes körű vámügyintézéssel és okmányolással. Kérjen egyedi árajánlatot még ma — válasz 24 órán belül.",
  eyebrow: "Nemzetközi szállítás",
  h1: "Nemzetközi fuvarozás, teljes körű vámügyintézéssel",
  intro:
    "Határon átnyúló fuvarozási szolgáltatás Európa-szerte, teljes körű vámügyintézéssel és okmányolással. Az útvonalat és a határidőt minden esetben az adott fuvarhoz igazítjuk — Önnek nem kell a vámügyintézéssel foglalkoznia.",
  bullets: [
    {
      title: "Teljes körű vámügyintézés",
      desc: "A szükséges vámügyintézést és okmányolást teljes egészében átvállaljuk Öntől.",
    },
    {
      title: "Európa-szerte",
      desc: "Nemzetközi fuvarozást vállalunk az egész kontinensen, egyedi útvonal-tervezéssel.",
    },
    {
      title: "Biztosított szállítás",
      desc: "Minden nemzetközi fuvarunk teljes biztosítási fedezettel zajlik, kár esetén a biztosítóval mi egyeztetünk.",
    },
    {
      title: "Egyedi árajánlat",
      desc: "Az útvonal, az áru jellege és a határidő alapján minden nemzetközi megbízást egyedileg árazunk.",
    },
  ],
  section: { heading: "Amit érdemes tudni a nemzetközi fuvarok vámkezeléséről" },
  faqOverrides: {
    insurance: {
      a: "Igen, nemzetközi fuvarjaink is teljes körű biztosítási fedezettel zajlanak a felvételtől a célországbeli kiszállításig — a határátlépés nem jelent kiesést a fedezetben.",
    },
    damage: {
      a: "Nemzetközi fuvarnál is haladéktalanul jelezze felénk telefonon vagy e-mailben — csapatunk a biztosítóval egyeztetve intézi a kárrendezést, függetlenül attól, hogy a kár melyik országban érte az árut.",
    },
    payment_terms: {
      a: "Nemzetközi partnereinknél a fizetési határidőt és — igény esetén — a pénznemet (forint vagy euró) is az adott megrendelés alapján egyeztetjük.",
    },
  },
};
```

### Step 2: Replace `pagesNemzetkozi` in `src/i18n/en.js`

Old: `export const pagesNemzetkozi = {};`
New:
```js
export const pagesNemzetkozi = {
  metaTitle: "International Freight Transport with Customs Clearance | Szikora Transz Kft.",
  metaDescription:
    "International freight transport across Europe, with full customs clearance and documentation handled for you. Request a custom quote today — response within 24 hours.",
  eyebrow: "International Shipping",
  h1: "International Freight Transport, with Full Customs Clearance",
  intro:
    "Cross-border freight transport across Europe, with full customs clearance and documentation included. We tailor the route and the deadline to each individual shipment — you don't have to deal with customs at all.",
  bullets: [
    {
      title: "Full customs clearance",
      desc: "We take full responsibility for the necessary customs clearance and documentation — you don't have to.",
    },
    {
      title: "Europe-wide coverage",
      desc: "We handle international freight transport across the whole continent, with custom route planning for every job.",
    },
    {
      title: "Insured shipping",
      desc: "Every international shipment we handle is fully insured — if damage occurs, we're the ones who deal with the insurer.",
    },
    {
      title: "Custom quote",
      desc: "We price every international job individually, based on the route, the type of cargo, and the deadline.",
    },
  ],
  section: { heading: "What you should know about customs clearance for international shipments" },
  faqOverrides: {
    insurance: {
      a: "Yes — our international shipments are also fully insured from pickup all the way to delivery in the destination country. Crossing a border doesn't create any gap in coverage.",
    },
    damage: {
      a: "For international shipments too, let us know immediately by phone or email. Our team handles the claims process with the insurer, no matter which country the damage occurred in.",
    },
    payment_terms: {
      a: "For our international partners, we agree on payment terms — and, if needed, the currency (forint or euro) — on a per-order basis.",
    },
  },
};
```

### Step 3: Rewrite `src/views/landing/NemzetkoziFuvarozas.js` (full file content)

```js
import React from "react";
import { PiGlobeLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function NemzetkoziFuvarozas() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiGlobeLight}
      accent="#0F766E"
      path="/nemzetkozi-fuvarozas-vamugyintezessel"
      metaTitle={t("pages.nemzetkozi.metaTitle")}
      metaDescription={t("pages.nemzetkozi.metaDescription")}
      eyebrow={t("pages.nemzetkozi.eyebrow")}
      h1={t("pages.nemzetkozi.h1")}
      intro={t("pages.nemzetkozi.intro")}
      bullets={t("pages.nemzetkozi.bullets")}
      faqItems={pickFaq(
        t,
        "international",
        { id: "insurance", aKey: "pages.nemzetkozi.faqOverrides.insurance.a" },
        { id: "damage", aKey: "pages.nemzetkozi.faqOverrides.damage.a" },
        { id: "payment_terms", aKey: "pages.nemzetkozi.faqOverrides.payment_terms.a" },
      )}
      testimonialNames={["Tóth Andrea", "Nagy Péter", "Molnár Eszter"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.nemzetkozi.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                Road freight transport within the EU, as well as to and from non-EU countries, is governed by
                international agreements and documentation. The most important of these is the{" "}
                <strong className="text-[#23262B]">CMR consignment note</strong> — the mandatory shipping
                document required under the CMR Convention (the international road freight contract), which
                records the details of the shipper, the carrier, and the consignee, the nature and quantity of
                the goods, and the extent of liability during transport.
              </p>
              <p>
                For destinations outside the EU, a <strong className="text-[#23262B]">commercial invoice</strong>{" "}
                and a <strong className="text-[#23262B]">packing list</strong> are also typically required for
                customs clearance — the exact requirements vary by country and cargo type, so we always clarify
                the documentation needed for your specific shipment individually, when you request a quote.
              </p>
              <p>
                We prepare the CMR consignment note and any other accompanying documentation your shipment
                needs — all you have to provide when requesting a quote is the exact details of the cargo and
                the destination.
              </p>
              <p className="text-sm text-[#23262B]/60">
                You can find more information on the official rules and procedures for customs clearance on the
                website of the{" "}
                <a
                  href="https://nav.gov.hu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0F766E] underline hover:text-[#0B5B52] transition-colors duration-300"
                >
                  National Tax and Customs Administration of Hungary (NAV)
                </a>{" "}
                — for your international shipments, we handle the actual paperwork on your behalf.
              </p>
            </>
          ) : (
            <>
              <p>
                Az EU-n belüli, illetve EU-n kívüli országokat érintő közúti
                árufuvarozást nemzetközi egyezmények és okmányok szabályozzák.
                A legfontosabb ezek közül a{" "}
                <strong className="text-[#23262B]">CMR-fuvarlevél</strong> — a
                nemzetközi közúti árufuvarozási szerződés (CMR-egyezmény) által
                előírt, kötelező szállítási okmány, amely rögzíti a felrakó, a
                fuvarozó és a címzett adatait, az áru jellegét és mennyiségét,
                valamint a felelősség terjedelmét szállítás közben.
              </p>
              <p>
                EU-n kívüli célországok esetén ehhez jellemzően{" "}
                <strong className="text-[#23262B]">kereskedelmi számla</strong> és{" "}
                <strong className="text-[#23262B]">csomagolási jegyzék</strong>{" "}
                is szükséges a vámkezeléshez — ezek pontos köre országonként és
                árutípusonként eltérhet, ezért az adott fuvarhoz tartozó
                dokumentációs igényt mindig az ajánlatkérés során, egyedileg
                tisztázzuk Önnel.
              </p>
              <p>
                A CMR-fuvarlevelet és a szükséges kísérő dokumentációt
                fuvarjainknál mi állítjuk össze — Önnek csak az áru pontos
                adatait és a rendeltetési helyet kell megadnia az
                ajánlatkérésnél.
              </p>
              <p className="text-sm text-[#23262B]/60">
                A vámügyintézés hivatalos szabályairól és eljárásrendjéről a{" "}
                <a
                  href="https://nav.gov.hu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0F766E] underline hover:text-[#0B5B52] transition-colors duration-300"
                >
                  Nemzeti Adó- és Vámhivatal (NAV)
                </a>{" "}
                hivatalos oldalán tájékozódhat bővebben — a konkrét ügyintézést
                nemzetközi fuvarjainknál mi végezzük Ön helyett.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
```

### Step 4: Verify

Visit `/nemzetkozi-fuvarozas-vamugyintezessel` (unchanged HU) and `/en/nemzetkozi-fuvarozas-vamugyintezessel` (full English, including the `<strong>` emphasis and the NAV external link with translated visible text but unchanged `href`). Check devtools console for `[i18n]` warnings — should be none for `pages.nemzetkozi.*`.

### Step 5: Commit

```bash
git add src/views/landing/NemzetkoziFuvarozas.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate NemzetkoziFuvarozas.js service page"
```

---

## Task 7: `BiztositottSzallitas.js` translation

**Files:**
- Modify (full rewrite): `src/views/landing/BiztositottSzallitas.js`
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `pagesBiztositott` export)

**Interfaces:** Consumes `useTranslation()` (Task 1), `pickFaq(t, ...)` (Task 2). This page's custom section has a numbered claims-process list — moved into the dictionary as `section.steps` (array of `{step, desc}`), a shape unique to this page.

### Step 1: Replace `pagesBiztositott` in `src/i18n/hu.js`

Old: `export const pagesBiztositott = {};`
New:
```js
export const pagesBiztositott = {
  metaTitle: "Biztosított szállítás | Szikora Transz Kft.",
  metaDescription:
    "Minden fuvarunk teljes biztosítási fedezettel történik — az áru felvételtől a kiszállításig biztos kezekben van. Kérjen árajánlatot.",
  eyebrow: "Biztosított szállítás",
  h1: "Biztosított szállítás — az árukészlete biztos kezekben van",
  intro:
    "Minden fuvarunkat teljes körű biztosítási fedezet mellett végezzük, a felvételtől a kiszállításig. Esetleges kár esetén csapatunk intézi a biztosítóval a kárrendezés teljes ügymenetét, Önnek nem kell utánajárnia.",
  bullets: [
    {
      title: "Teljes körű fedezet minden fuvarra",
      desc: "Külön kérés nélkül, alapból biztosítási fedezet mellett szállítunk — nincs rejtett kikötés vagy felár.",
    },
    {
      title: "Kárrendezés helyett Ön a dolgára figyelhet",
      desc: "Kár esetén a biztosítóval való egyeztetést és a kárrendezés ügyintézését csapatunk vállalja át Öntől.",
    },
    {
      title: "Gondos kezelés, a fedezettől függetlenül",
      desc: "A biztosítás mellett a rakodás és a szállítás során is körültekintően, sérülésmentesen kezeljük az árut.",
    },
    {
      title: "Bármilyen áruféleséghez igazítva",
      desc: "Az áru jellege és értéke alapján a legmegfelelőbb járművet és fedezetet választjuk a fuvarhoz.",
    },
  ],
  section: {
    heading: "Hogyan zajlik a kárrendezés lépésről lépésre?",
    steps: [
      {
        step: "Kárbejelentés",
        desc: "Jelezze felénk telefonon vagy e-mailben, lehetőleg fotókkal dokumentálva az észlelt sérülést vagy hiányt.",
      },
      {
        step: "Kapcsolatfelvétel a biztosítóval",
        desc: "Csapatunk felveszi a kapcsolatot a biztosítóval, és összeállítja a szükséges dokumentációt — a fuvarlevelet, valamint a fel- és lerakodáskori állapotot rögzítő adatokat.",
      },
      {
        step: "Ügyintézés",
        desc: "A biztosítóval való egyeztetést és a kárrendezés teljes ügymenetét csapatunk viszi — Önnek nem kell közvetlenül kapcsolatba lépnie velük.",
      },
      { step: "Visszajelzés", desc: "Ön a folyamat végén kap tájékoztatást az eredményről." },
    ],
  },
  faqOverrides: {
    response_time: {
      a: "Általában 24 órán belül felvesszük Önnel a kapcsolatot egy részletes árajánlattal, amiben a biztosítási fedezet részletei is szerepelnek.",
    },
  },
};
```

### Step 2: Replace `pagesBiztositott` in `src/i18n/en.js`

Old: `export const pagesBiztositott = {};`
New:
```js
export const pagesBiztositott = {
  metaTitle: "Insured Shipping | Szikora Transz Kft.",
  metaDescription:
    "Every shipment we handle is fully insured — your goods are in safe hands from pickup to delivery. Request a quote.",
  eyebrow: "Insured Shipping",
  h1: "Insured Shipping — Your Goods Are in Safe Hands",
  intro:
    "Every job we handle is carried out under full insurance coverage, from pickup to delivery. If damage does occur, our team manages the entire claims process with the insurer, so you don't have to chase it up yourself.",
  bullets: [
    {
      title: "Full coverage on every job",
      desc: "We ship under insurance coverage by default, no special request needed — no hidden clauses, no surcharges.",
    },
    {
      title: "We handle the claims, so you don't have to",
      desc: "If damage occurs, our team takes over liaising with the insurer and managing the entire claims process for you.",
    },
    {
      title: "Careful handling, regardless of coverage",
      desc: "Beyond the insurance itself, we handle loading and transport carefully to avoid damage in the first place.",
    },
    {
      title: "Tailored to any type of cargo",
      desc: "We choose the most suitable vehicle and coverage for the job based on the nature and value of the goods.",
    },
  ],
  section: {
    heading: "How does the claims process work, step by step?",
    steps: [
      {
        step: "Report the damage",
        desc: "Let us know by phone or email, ideally with photos documenting the damage or shortage you've noticed.",
      },
      {
        step: "Contacting the insurer",
        desc: "Our team contacts the insurer and puts together the necessary documentation — the consignment note, plus records of the goods' condition at pickup and delivery.",
      },
      {
        step: "Handling it for you",
        desc: "Our team manages the entire process of liaising with the insurer and settling the claim — you won't need to deal with them directly.",
      },
      { step: "Follow-up", desc: "You'll be informed of the outcome once the process is complete." },
    ],
  },
  faqOverrides: {
    response_time: {
      a: "We typically get back to you within 24 hours with a detailed quote that also spells out the specifics of the insurance coverage.",
    },
  },
};
```

### Step 3: Rewrite `src/views/landing/BiztositottSzallitas.js` (full file content)

```js
import React from "react";
import { PiShieldCheckLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function BiztositottSzallitas() {
  const { t, locale } = useTranslation();
  const steps = t("pages.biztositott.section.steps");
  return (
    <ServicePage
      icon={PiShieldCheckLight}
      accent="#6D28D9"
      path="/biztositott-szallitas"
      metaTitle={t("pages.biztositott.metaTitle")}
      metaDescription={t("pages.biztositott.metaDescription")}
      eyebrow={t("pages.biztositott.eyebrow")}
      h1={t("pages.biztositott.h1")}
      intro={t("pages.biztositott.intro")}
      bullets={t("pages.biztositott.bullets")}
      faqItems={pickFaq(
        t,
        "insurance",
        "damage",
        { id: "response_time", aKey: "pages.biztositott.faqOverrides.response_time.a" },
      )}
      testimonialNames={["Szabó Katalin", "Tóth Andrea", "Molnár Eszter"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.biztositott.section.heading")}
        </h2>
        <ol className="space-y-4 mb-5">
          {steps.map((item, i) => (
            <li key={item.step} className="flex items-start gap-4">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-[Overpass_Mono] font-bold"
                style={{ backgroundColor: "#6D28D91A", color: "#6D28D9" }}
              >
                {i + 1}
              </span>
              <div>
                <p className="font-[Overpass] font-semibold text-[#23262B]">{item.step}</p>
                <p className="text-[#23262B]/70 text-sm mt-1">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                This coverage automatically applies to every job we handle, at no extra request or cost,
                regardless of whether it's a domestic or international shipment.
              </p>
              <p className="text-sm text-[#23262B]/60">
                You can find more information on carrier liability insurance and the general claims process on
                the website of the{" "}
                <a
                  href="https://mabisz.hu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6D28D9] underline hover:text-[#5B21B6] transition-colors duration-300"
                >
                  Association of Hungarian Insurance Companies (MABISZ)
                </a>{" "}
                — for your shipments, we handle the actual claims process on your behalf.
              </p>
            </>
          ) : (
            <>
              <p>
                Ez a fedezet minden fuvarunkra automatikusan érvényes, külön
                kérés vagy felár nélkül, függetlenül attól, hogy belföldi vagy
                nemzetközi szállításról van szó.
              </p>
              <p className="text-sm text-[#23262B]/60">
                A fuvarozói felelősségbiztosításról és a kárrendezés általános
                menetéről a{" "}
                <a
                  href="https://mabisz.hu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6D28D9] underline hover:text-[#5B21B6] transition-colors duration-300"
                >
                  Magyar Biztosítók Szövetsége (MABISZ)
                </a>{" "}
                oldalán tájékozódhat bővebben — a konkrét kárügyintézést
                fuvarjainknál mi végezzük Ön helyett.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
```

### Step 4: Verify

Visit `/biztositott-szallitas` (unchanged HU, numbered claims-process list intact) and `/en/biztositott-szallitas` (English throughout, including the numbered list and the MABISZ external link).

### Step 5: Commit

```bash
git add src/views/landing/BiztositottSzallitas.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate BiztositottSzallitas.js service page"
```

---

## Task 8: `ExpresszFuvarozas.js` translation

**Files:**
- Modify (full rewrite): `src/views/landing/ExpresszFuvarozas.js`
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `pagesExpressz` export)

**Interfaces:** Consumes `useTranslation()` (Task 1), `pickFaq(t, ...)` (Task 2). All 3 FAQ selectors on this page are overrides (no plain ids) — matches Task 2 Step 5's call-site spec.

### Step 1: Replace `pagesExpressz` in `src/i18n/hu.js`

Old: `export const pagesExpressz = {};`
New:
```js
export const pagesExpressz = {
  metaTitle: "Expressz fuvarozás — sürgős szállítás | Szikora Transz Kft.",
  metaDescription:
    "Sürgős fuvar? Expressz szállítás garantált kiszállítási idővel, soron kívüli kezeléssel. Kérjen ajánlatot most — válasz 24 órán belül.",
  eyebrow: "Expressz szállítás",
  h1: "Expressz fuvarozás, ha az idő a legfontosabb",
  intro:
    "Sürgős fuvarok soron kívüli kezelése, garantált kiszállítási idővel — akkor is, ha a szállítást csak órákkal előre tudja bejelenteni. Vegye fel velünk a kapcsolatot, és soron kívül egyeztetjük a részleteket.",
  bullets: [
    { title: "Soron kívüli kezelés", desc: "Sürgős megbízásokat kiemelten, a normál ütemezésen kívül kezelünk." },
    {
      title: "Garantált kiszállítási idő",
      desc: "Az ajánlatkérés során egyeztetett határidőt vállaljuk — pontosan, percre.",
    },
    {
      title: "Gyors kapcsolatfelvétel",
      desc: "Sürgős esetben hívjon közvetlenül telefonon a gyorsabb egyeztetésért.",
    },
    {
      title: "Ugyanaz a biztonság, sürgősen is",
      desc: "Az expressz fuvarok is teljes biztosítási fedezettel zajlanak.",
    },
  ],
  section: { heading: "Mit jelent pontosan a garantált kiszállítási idő?" },
  faqOverrides: {
    response_time: {
      a: "Expressz megbízásoknál ennél is gyorsabban, jellemzően néhány órán belül visszajelzünk — sürgős esetben hívjon minket közvetlenül telefonon a leggyorsabb egyeztetésért.",
    },
    pricing_factors: {
      a: "Sürgős fuvaroknál a szokásos tényezők (távolság, az áru mérete és jellege) mellett a rendelkezésre álló időablak is számít — minél rövidebb a bejelentési idő, annál inkább az adott pillanatban szabad kapacitásunkhoz igazodik az ajánlat. Egyedi, tételes árazás itt is érvényes, nincs automatikus sürgősségi felár.",
    },
    custom_quote: {
      a: "Igen — sürgős, szokatlan méretű vagy speciális kezelést igénylő rakományra is adunk egyedi árajánlatot, akár rövid határidővel is. Hívjon minket közvetlenül, ha a helyzet gyors egyeztetést igényel.",
    },
  },
};
```

### Step 2: Replace `pagesExpressz` in `src/i18n/en.js`

Old: `export const pagesExpressz = {};`
New:
```js
export const pagesExpressz = {
  metaTitle: "Express Freight Transport — Urgent Shipping | Szikora Transz Kft.",
  metaDescription:
    "Urgent shipment? Express transport with a guaranteed delivery time and priority handling. Request a quote now — response within 24 hours.",
  eyebrow: "Express Shipping",
  h1: "Express Freight Transport, When Time Matters Most",
  intro:
    "Priority handling for urgent jobs, with a guaranteed delivery time — even if you can only give us a few hours' notice. Get in touch and we'll sort out the details right away.",
  bullets: [
    { title: "Priority handling", desc: "We handle urgent jobs as a priority, outside our normal scheduling." },
    {
      title: "Guaranteed delivery time",
      desc: "We commit to the deadline agreed on when you request your quote — down to the minute.",
    },
    { title: "Fast response", desc: "If it's urgent, call us directly for the fastest response." },
    {
      title: "The same reliability, even under time pressure",
      desc: "Express shipments are also carried out under full insurance coverage.",
    },
  ],
  section: { heading: "What exactly does 'guaranteed delivery time' mean?" },
  faqOverrides: {
    response_time: {
      a: "For express jobs, we respond even faster — typically within a few hours. If it's urgent, call us directly for the quickest possible turnaround.",
    },
    pricing_factors: {
      a: "For urgent shipments, alongside the usual factors (distance, cargo size and type), the available time window also matters — the shorter the notice, the more the quote depends on our capacity at that exact moment. We still price every job individually here too — there's no automatic rush surcharge.",
    },
    custom_quote: {
      a: "Yes — we also provide custom quotes for urgent, oversized, or specially handled cargo, even on short notice. Call us directly if your situation calls for a fast turnaround.",
    },
  },
};
```

### Step 3: Rewrite `src/views/landing/ExpresszFuvarozas.js` (full file content)

```js
import React from "react";
import { PiLightningLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function ExpresszFuvarozas() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiLightningLight}
      accent="#D97706"
      path="/expressz-fuvarozas"
      metaTitle={t("pages.expressz.metaTitle")}
      metaDescription={t("pages.expressz.metaDescription")}
      eyebrow={t("pages.expressz.eyebrow")}
      h1={t("pages.expressz.h1")}
      intro={t("pages.expressz.intro")}
      bullets={t("pages.expressz.bullets")}
      faqItems={pickFaq(
        t,
        { id: "response_time", aKey: "pages.expressz.faqOverrides.response_time.a" },
        { id: "pricing_factors", aKey: "pages.expressz.faqOverrides.pricing_factors.a" },
        { id: "custom_quote", aKey: "pages.expressz.faqOverrides.custom_quote.a" },
      )}
      testimonialNames={["Farkas Zoltán", "Kovács Gábor", "Nagy Péter"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.expressz.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                "Guaranteed delivery time" means we commit to a specific time or time window agreed together
                when you request your quote — not a rough estimate. Before we confirm an urgent job, we always
                double-check that the requested deadline is actually achievable on that route and with our
                current capacity — so we never promise something we can't deliver on.
              </p>
              <p>
                If anything unexpected comes up during transport (e.g. traffic delays), we proactively let you
                know — you won't have to chase us for updates. For urgent cases, it's best to call us directly
                for the fastest possible coordination, rather than just filling out the form.
              </p>
              <p>
                We confirm the agreed time in writing (by email) as well, so the arrangement is clear to both
                sides — this holds even under time pressure, not just for more relaxed scheduling.
              </p>
            </>
          ) : (
            <>
              <p>
                A "garantált kiszállítási idő" azt jelenti, hogy az ajánlatkérés
                során közösen egyeztetett, konkrét időpontot vagy időablakot
                vállaljuk — nem egy hozzávetőleges becslést. Mielőtt
                visszaigazolnánk egy sürgős megbízást, mindig leellenőrizzük,
                hogy a kért határidő ténylegesen tartható-e az adott útvonalon
                és a pillanatnyi kapacitásunk mellett — így nem ígérünk olyat,
                amit utólag nem tudunk tartani.
              </p>
              <p>
                Szállítás közben, ha bármi váratlan közbejön (pl. forgalmi
                torlódás), proaktívan jelzünk, nem Önnek kell utánaérdeklődnie.
                Sürgős esetben a leggyorsabb egyeztetés érdekében érdemes
                közvetlenül telefonon hívni minket, nem csak az űrlapot
                kitölteni.
              </p>
              <p>
                A vállalt időpontot írásban (e-mailben) is visszaigazoljuk, hogy
                mindkét fél számára egyértelmű legyen a megállapodás — ez sürgős
                helyzetben is megmarad, nem csak a nyugodtabb ütemezésű
                fuvaroknál.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
```

### Step 4: Verify

Visit `/expressz-fuvarozas` (unchanged HU) and `/en/expressz-fuvarozas` (English, all 3 FAQ overrides resolved with no `[i18n]` console warnings).

### Step 5: Commit

```bash
git add src/views/landing/ExpresszFuvarozas.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate ExpresszFuvarozas.js service page"
```

---

## Task 9: `RendezvenySzallitas.js` translation

**Files:**
- Modify (full rewrite): `src/views/landing/RendezvenySzallitas.js`
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `pagesRendezveny` export)

**Interfaces:** Consumes `useTranslation()` (Task 1), `pickFaq(t, ...)` (Task 2). All 3 FAQ selectors are overrides, matching Task 2 Step 5.

### Step 1: Replace `pagesRendezveny` in `src/i18n/hu.js`

Old: `export const pagesRendezveny = {};`
New:
```js
export const pagesRendezveny = {
  metaTitle: "Rendezvényszállítás | Szikora Transz Kft.",
  metaDescription:
    "Rendezvényekhez kapcsolódó szállítás — standok, berendezések, dekoráció pontos, egyeztetett időpontra történő kiszállítása. Kérjen árajánlatot.",
  eyebrow: "Rendezvényszállítás",
  h1: "Rendezvényszállítás — pontosan, az Ön ütemezése szerint",
  intro:
    "Rendezvényekhez kapcsolódó szállítást is vállalunk — standok, berendezések, dekoráció és egyéb rendezvényanyagok szállítását a helyszínre és vissza, a rendezvény pontos időbeosztásához igazítva.",
  bullets: [
    {
      title: "Az esemény ütemezéséhez igazodva",
      desc: "A kiszállítás és az elszállítás időpontját a rendezvény programjához egyeztetjük, nem fordítva.",
    },
    {
      title: "Gondos, óvatos kezelés",
      desc: "Berendezéseket, dekorációt és egyéb rendezvényanyagot is körültekintően, sérülésmentesen szállítunk.",
    },
    {
      title: "Rugalmas, akár rövid határidővel",
      desc: "Egyeztetés után soron kívüli, sürgős rendezvényszállítást is vállalunk.",
    },
    {
      title: "Egyedi árajánlat minden eseményre",
      desc: "A szállítandó anyag mennyisége, a helyszín és az időzítés alapján adunk pontos árajánlatot.",
    },
  ],
  section: { heading: "Mire figyelünk rendezvényszállításnál?" },
  faqOverrides: {
    response_time: {
      a: "Rendezvényszállításnál is jellemzően 24 órán belül jelentkezünk egy, az esemény időpontjához és a helyszín sajátosságaihoz igazított árajánlattal — ha az esemény időpontja már közel van, jelezze ezt is, és soron kívül foglalkozunk vele.",
    },
    custom_quote: {
      a: "Igen — rendezvényenként egyedi árajánlatot adunk a szállítandó anyag mennyisége, a helyszín sajátosságai (pl. be- és kirakodási időablak) és az esemény pontos ütemezése alapján.",
    },
    vehicles: {
      a: "A rendezvényanyagok (standelemek, berendezések, dekoráció) jellege és mérete alapján választjuk ki a megfelelő járművet — modern, karbantartott flottánkból mindig azt, amelyik a legbiztonságosabban és leghatékonyabban szállítja az adott anyagot a helyszínre.",
    },
  },
};
```

### Step 2: Replace `pagesRendezveny` in `src/i18n/en.js`

Old: `export const pagesRendezveny = {};`
New:
```js
export const pagesRendezveny = {
  metaTitle: "Event Logistics | Szikora Transz Kft.",
  metaDescription:
    "Transport for events — booth structures, equipment, and decor delivered precisely at the agreed time. Request a quote.",
  eyebrow: "Event Logistics",
  h1: "Event Logistics — Precisely on Your Schedule",
  intro:
    "We also handle transport for events — moving booth structures, equipment, decor, and other event materials to and from the venue, timed precisely to the event's schedule.",
  bullets: [
    {
      title: "Built around the event's schedule",
      desc: "We coordinate delivery and pickup times around the event's program, not the other way around.",
    },
    {
      title: "Careful, attentive handling",
      desc: "We transport equipment, decor, and other event materials carefully, to avoid damage.",
    },
    {
      title: "Flexible, even on short notice",
      desc: "By arrangement, we also take on urgent, priority event transport jobs.",
    },
    {
      title: "A custom quote for every event",
      desc: "We give you a precise quote based on the volume of material, the venue, and the timing.",
    },
  ],
  section: { heading: "What do we pay attention to with event logistics?" },
  faqOverrides: {
    response_time: {
      a: "For event logistics too, we typically get back to you within 24 hours with a quote tailored to your event's date and the venue's specifics — if the event is coming up soon, let us know and we'll treat it as a priority.",
    },
    custom_quote: {
      a: "Yes — we give a custom quote for every event, based on the volume of material to be transported, the venue's specifics (e.g. the loading/unloading time window), and the event's exact schedule.",
    },
    vehicles: {
      a: "We select the right vehicle based on the nature and size of the event materials (booth elements, equipment, decor) — always choosing, from our modern, well-maintained fleet, whichever vehicle gets that particular material to the venue most safely and efficiently.",
    },
  },
};
```

### Step 3: Rewrite `src/views/landing/RendezvenySzallitas.js` (full file content)

```js
import React from "react";
import { PiConfettiLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function RendezvenySzallitas() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiConfettiLight}
      accent="#BE185D"
      path="/rendezveny-szallitas"
      metaTitle={t("pages.rendezveny.metaTitle")}
      metaDescription={t("pages.rendezveny.metaDescription")}
      eyebrow={t("pages.rendezveny.eyebrow")}
      h1={t("pages.rendezveny.h1")}
      intro={t("pages.rendezveny.intro")}
      bullets={t("pages.rendezveny.bullets")}
      faqItems={pickFaq(
        t,
        { id: "response_time", aKey: "pages.rendezveny.faqOverrides.response_time.a" },
        { id: "custom_quote", aKey: "pages.rendezveny.faqOverrides.custom_quote.a" },
        { id: "vehicles", aKey: "pages.rendezveny.faqOverrides.vehicles.a" },
      )}
      testimonialNames={["Molnár Eszter", "Farkas Zoltán", "Tóth Andrea"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.rendezveny.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                Event logistics differs from a typical job in that there are almost always two sharply distinct
                deadlines to hit precisely: delivery (before setup) and pickup (after teardown). We coordinate
                both around the event's — or venue's — own schedule, such as a designated loading/unloading
                window, rather than the other way around.
              </p>
              <p>
                We handle booth elements, exhibition materials, technical equipment, and decor carefully,
                securing each item according to how fragile it is. If the venue has specific access or loading
                rules (e.g. a restricted access window, or a requirement for lift-gate loading), it's worth
                flagging this when you request your quote, so we can plan for it in advance.
              </p>
              <p>
                If needed, we'll also coordinate directly with the venue's contact person or the event
                organizer, to make sure delivery and pickup times reliably line up with the venue's own
                schedule.
              </p>
            </>
          ) : (
            <>
              <p>
                A rendezvényszállítás abban különbözik egy szokásos fuvartól,
                hogy szinte mindig két, egymástól élesen elváló időpontra kell
                pontosan érkezni: a kiszállításra (a felállítás/berendezés
                előtt) és az elszállításra (a bontás után). Mindkettőt a
                rendezvény, illetve a helyszín saját ütemezéséhez — pl. a be- és
                kirakodásra kijelölt időablakhoz — igazítjuk, nem fordítva.
              </p>
              <p>
                Standelemeket, kiállítási anyagokat, technikai berendezéseket és
                dekorációt egyaránt körültekintően, az adott anyag
                sérülékenységéhez igazított rögzítéssel szállítunk. Ha a
                helyszínnek egyedi behajtási vagy rakodási szabályai vannak (pl.
                korlátozott behajtási időszak, emelős rakodás szükségessége),
                ezt már az ajánlatkérésnél érdemes jeleznie, hogy előre tudjunk
                vele kalkulálni.
              </p>
              <p>
                Igény esetén közvetlenül egyeztetünk a helyszín
                kapcsolattartójával vagy a rendezvényszervezővel is, hogy a be-
                és kiszállítás időpontja garantáltan illeszkedjen a helyszín
                saját ütemezéséhez.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
```

### Step 4: Verify

Visit `/rendezveny-szallitas` (unchanged HU) and `/en/rendezveny-szallitas` (English, all 3 FAQ overrides resolved).

### Step 5: Commit

```bash
git add src/views/landing/RendezvenySzallitas.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate RendezvenySzallitas.js service page"
```

---

## Task 10: `EgyediArajanlat.js` translation

**Files:**
- Modify (full rewrite): `src/views/landing/EgyediArajanlat.js`
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `pagesEgyedi` export)

**Interfaces:** Consumes `useTranslation()` (Task 1), `pickFaq(t, ...)` (Task 2). This is the last of the 6 view files to migrate — after this task, no `pages.*.faqOverrides` keys should be missing from either dictionary anymore.

### Step 1: Replace `pagesEgyedi` in `src/i18n/hu.js`

Old: `export const pagesEgyedi = {};`
New:
```js
export const pagesEgyedi = {
  metaTitle: "Egyedi árajánlat fuvarozásra | Szikora Transz Kft.",
  metaDescription:
    "Nincs két egyforma fuvar — minden szállítást egyedileg árazunk az útvonal, az áru jellege és a határidő alapján. Kérjen ingyenes árajánlatot még ma.",
  eyebrow: "Egyedi árajánlat",
  h1: "Egyedi árajánlat — bármilyen árut szállítunk",
  intro:
    "Nem szakosodtunk egyetlen iparágra sem: bármilyen árut szállítunk, az Ön igényei szerint. Mivel nincs két egyforma fuvar, nincs fix díjszabásunk sem — minden megrendelést egyedileg, tételesen árazunk.",
  bullets: [
    {
      title: "Bármilyen áru, bármilyen igény",
      desc: "Nem korlátozzuk magunkat egy-egy iparágra vagy árutípusra — mondja el, mit kell szállítani, mi megoldjuk.",
    },
    {
      title: "Átlátható, tételes árazás",
      desc: "A távolság, az áru mérete/súlya/jellege és a határidő alapján adunk pontos, nem sablonos árajánlatot.",
    },
    { title: "Nincs rejtett költség", desc: "Az ajánlatban minden tétel átlátható — amit ajánlunk, azt számlázzuk." },
    {
      title: "Kötöttség nélküli ajánlatkérés",
      desc: "Az árajánlat ingyenes és nem kötelezi Önt a megrendelésre.",
    },
  ],
  section: { heading: "Milyen szállítmányokat vállalunk egyedi árajánlattal?" },
  faqOverrides: {
    pricing_factors: {
      a: "Mivel nincs két egyforma megrendelésünk, nincs egységes díjtáblázatunk sem — minden ajánlatot a konkrét útvonal, az áru mérete, súlya és jellege, valamint a vállalt határidő alapján, egyedileg számolunk ki. Mondja el a részleteket, és pontos, tételes árajánlatot küldünk.",
    },
    payment_terms: {
      a: "Mivel minden megrendelést egyedileg árazunk, a fizetési határidőt és módot (átutalás vagy számlás fizetés) is a konkrét fuvarhoz igazítva állapítjuk meg.",
    },
  },
};
```

### Step 2: Replace `pagesEgyedi` in `src/i18n/en.js`

Old: `export const pagesEgyedi = {};`
New:
```js
export const pagesEgyedi = {
  metaTitle: "Custom Freight Quote | Szikora Transz Kft.",
  metaDescription:
    "No two jobs are the same — every shipment is priced individually based on route, cargo type, and deadline. Request a free quote today.",
  eyebrow: "Custom Quote",
  h1: "Custom Quote — We Transport Any Type of Cargo",
  intro:
    "We're not limited to a single industry: we transport any type of cargo, tailored to your needs. Since no two jobs are alike, we don't have a fixed price list either — every order is priced individually, item by item.",
  bullets: [
    {
      title: "Any cargo, any requirement",
      desc: "We don't limit ourselves to any one industry or cargo type — tell us what needs transporting, and we'll make it happen.",
    },
    {
      title: "Transparent, itemized pricing",
      desc: "We give you a precise, non-generic quote based on distance, the cargo's size/weight/nature, and the deadline.",
    },
    {
      title: "No hidden costs",
      desc: "Every line item in the quote is transparent — what we quote is what we invoice.",
    },
    {
      title: "No-obligation quote requests",
      desc: "Getting a quote is free and doesn't commit you to placing an order.",
    },
  ],
  section: { heading: "What kinds of shipments do we handle with a custom quote?" },
  faqOverrides: {
    pricing_factors: {
      a: "Since no two orders are alike, we don't have a fixed price table either — every quote is calculated individually, based on the specific route, the cargo's size, weight and nature, and the agreed deadline. Tell us the details, and we'll send you a precise, itemized quote.",
    },
    payment_terms: {
      a: "Since every order is priced individually, we also set the payment deadline and method (bank transfer or invoiced payment) to match the specific job.",
    },
  },
};
```

### Step 3: Rewrite `src/views/landing/EgyediArajanlat.js` (full file content)

```js
import React from "react";
import { PiFileTextLight } from "react-icons/pi";
import ServicePage from "components/Landing/ServicePage.js";
import { pickFaq } from "data/landingContent.js";
import { useTranslation } from "i18n/index.js";

export default function EgyediArajanlat() {
  const { t, locale } = useTranslation();
  return (
    <ServicePage
      icon={PiFileTextLight}
      accent="#059669"
      path="/egyedi-arajanlat-fuvarozas"
      metaTitle={t("pages.egyedi.metaTitle")}
      metaDescription={t("pages.egyedi.metaDescription")}
      eyebrow={t("pages.egyedi.eyebrow")}
      h1={t("pages.egyedi.h1")}
      intro={t("pages.egyedi.intro")}
      bullets={t("pages.egyedi.bullets")}
      faqItems={pickFaq(
        t,
        { id: "pricing_factors", aKey: "pages.egyedi.faqOverrides.pricing_factors.a" },
        "custom_quote",
        { id: "payment_terms", aKey: "pages.egyedi.faqOverrides.payment_terms.a" },
      )}
      testimonialNames={["Kovács Gábor", "Molnár Eszter", "Szabó Katalin"]}
    >
      <section className="py-10 border-t border-[#23262B]/10">
        <h2 className="font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">
          {t("pages.egyedi.section.heading")}
        </h2>
        <div className="space-y-4 text-[#23262B]/70 leading-relaxed max-w-2xl">
          {locale === "en" ? (
            <>
              <p>
                In practice, this most often means oversized or overweight cargo, machinery or equipment that
                must be transported upright, large volumes of goods requiring multiple runs, and cargo needing
                special attention during loading (fragile, non-palletized, or requiring custom securing). If any
                of this sounds like your shipment, you're in the right place.
              </p>
              <p>
                If you're not sure whether a particular shipment fits within our usual services, a few questions
                can help you decide: does it fit on a standard flatbed, or does it need a specialized body; does
                pickup/delivery require a lift gate or crane loading; and are there any route restrictions (e.g.
                a weight-limited bridge, a narrow entrance) we need to plan for in advance. The quote we put
                together for you is based on the answers to exactly these questions.
              </p>
            </>
          ) : (
            <>
              <p>
                A gyakorlatban ez leggyakrabban azt jelenti, hogy vállalunk
                túlméretes vagy túlsúlyos rakományt, állóhelyzetben szállítandó
                gépet vagy berendezést, több fordulóban szállítandó, nagy
                mennyiségű tételt, valamint olyan árut, ami rakodás közben
                különleges figyelmet igényel (törékeny, nem raklapozható, vagy
                egyedi rögzítést igénylő). Ha bármelyik ismerősen hangzik az Ön
                szállítmányára, jó helyen jár.
              </p>
              <p>
                Ha bizonytalan, hogy egy adott rakomány beleillik-e a szokásos
                szolgáltatásainkba, néhány kérdés segít eldönteni: elfér-e egy
                szabványos kamionplatón vagy speciális felépítmény kell hozzá,
                igényel-e emelőhátfalat vagy darus rakodást a fel-/lerakodáshoz,
                és van-e olyan útvonal-korlátozás (pl. súlykorlátozott híd,
                keskeny bejárat), amit előre figyelembe kell vennünk. Ezekre a
                válaszokra épül az ajánlatkérésnél összeállított pontos árajánlat.
              </p>
            </>
          )}
        </div>
      </section>
    </ServicePage>
  );
}
```

### Step 4: Verify

1. Visit `/egyedi-arajanlat-fuvarozas` (unchanged HU) and `/en/egyedi-arajanlat-fuvarozas` (English).
2. With all 6 service pages now migrated, do a final sweep: open devtools console and click through all 6 `/en/...` pages plus `/en` — confirm **zero** `[i18n]` warnings anywhere (this is the first point in the plan where that's fully true for the `pages.*` namespace).

### Step 5: Commit

```bash
git add src/views/landing/EgyediArajanlat.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate EgyediArajanlat.js service page"
```

---

## Task 11: `Footer.js` translation (+ remove dead `SERVICE_PAGES.label`)

**Files:**
- Modify: `src/components/Footers/Footer.js`
- Modify: `src/data/landingContent.js` (remove the now-unused `label` field from `SERVICE_PAGES` — `ServicePage.js` (Task 3) and this task are its only two consumers, and both now read the label via `t("landing.servicePages.<id>")` instead)
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `footer` export)

**Interfaces:** Consumes `useTranslation()`, `localizePath()` (Task 1); `landing.servicePages.<id>` (Task 2).

### Step 1: Replace the `footer` export in `src/i18n/hu.js`

Old: `export const footer = {};`
New:
```js
export const footer = {
  description:
    "Szikora Transz Kft. — belföldi és nemzetközi fuvarozás 2010 óta, modern flottával és teljes körű biztosítással.",
  bullets: ["10+ év tapasztalat", "Teljes körű biztosítás", "Válasz 24 órán belül"],
  servicesHeading: "Szolgáltatásaink",
  companyHeading: "Cég",
  companyLinks: {
    home: "Kezdőlap",
    about: "Rólunk",
    faq: "GYIK",
    driverApplication: "Sofőr jelentkezés",
    login: "Bejelentkezés",
    privacy: "Adatvédelmi tájékoztató",
  },
  contactHeading: "Kapcsolat",
  taxIdLabel: "Adószám:",
  privacyLink: "Adatvédelem",
  allRightsReserved: "Minden jog fenntartva.",
};
```

### Step 2: Replace the `footer` export in `src/i18n/en.js`

Old: `export const footer = {};`
New:
```js
export const footer = {
  description:
    "Szikora Transz Kft. — domestic and international freight transport since 2010, with a modern fleet and full insurance coverage.",
  bullets: ["10+ years of experience", "Full insurance coverage", "Response within 24 hours"],
  servicesHeading: "Our Services",
  companyHeading: "Company",
  companyLinks: {
    home: "Home",
    about: "About Us",
    faq: "FAQ",
    driverApplication: "Driver Application",
    login: "Log In",
    privacy: "Privacy Policy",
  },
  contactHeading: "Contact",
  taxIdLabel: "Tax ID:",
  privacyLink: "Privacy Policy",
  allRightsReserved: "All rights reserved.",
};
```

### Step 3: Remove the dead `label` field from `SERVICE_PAGES` in `src/data/landingContent.js`

Old:
```js
export const SERVICE_PAGES = [
  { id: "domestic", path: "/belfoldi-fuvarozas-arajanlat", label: "Belföldi fuvarozás" },
  {
    id: "international",
    path: "/nemzetkozi-fuvarozas-vamugyintezessel",
    label: "Nemzetközi fuvarozás",
  },
  { id: "insured", path: "/biztositott-szallitas", label: "Biztosított szállítás" },
  { id: "express", path: "/expressz-fuvarozas", label: "Expressz fuvarozás" },
  { id: "event", path: "/rendezveny-szallitas", label: "Rendezvényszállítás" },
  { id: "custom", path: "/egyedi-arajanlat-fuvarozas", label: "Egyedi árajánlat" },
];
```
New:
```js
export const SERVICE_PAGES = [
  { id: "domestic", path: "/belfoldi-fuvarozas-arajanlat" },
  { id: "international", path: "/nemzetkozi-fuvarozas-vamugyintezessel" },
  { id: "insured", path: "/biztositott-szallitas" },
  { id: "express", path: "/expressz-fuvarozas" },
  { id: "event", path: "/rendezveny-szallitas" },
  { id: "custom", path: "/egyedi-arajanlat-fuvarozas" },
];
```

### Step 4: Migrate `src/components/Footers/Footer.js`

**4a. Imports:**

Old:
```js
import React from "react";
import { Link } from "react-router-dom";
import {
  PiEnvelopeLight,
  PiPhoneLight,
  PiMapPinLight,
  PiIdentificationCardLight,
} from "react-icons/pi";
import { SERVICE_PAGES } from "data/landingContent.js";
```
New:
```js
import React from "react";
import { Link } from "react-router-dom";
import {
  PiEnvelopeLight,
  PiPhoneLight,
  PiMapPinLight,
  PiIdentificationCardLight,
} from "react-icons/pi";
import { SERVICE_PAGES } from "data/landingContent.js";
import { useTranslation, localizePath } from "i18n/index.js";
```

**4b. Component start:**

Old:
```js
export default function Footer() {
  return (
    <footer className="bg-[#2E3239] text-white pt-4">
```
New:
```js
export default function Footer() {
  const { t, locale } = useTranslation();
  return (
    <footer className="bg-[#2E3239] text-white pt-4">
```

**4c. "Bemutatkozás" column:**

Old:
```js
            <p className="text-sm text-white/60 leading-relaxed mb-5">
              Szikora Transz Kft. — belföldi és nemzetközi fuvarozás 2010 óta,
              modern flottával és teljes körű biztosítással.
            </p>
            <ul className="space-y-2 text-xs text-white/50 font-[Overpass_Mono] uppercase tracking-wide">
              <li>10+ év tapasztalat</li>
              <li>Teljes körű biztosítás</li>
              <li>Válasz 24 órán belül</li>
            </ul>
```
New:
```js
            <p className="text-sm text-white/60 leading-relaxed mb-5">{t("footer.description")}</p>
            <ul className="space-y-2 text-xs text-white/50 font-[Overpass_Mono] uppercase tracking-wide">
              {t("footer.bullets").map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
```

**4d. "Szolgáltatásaink" column:**

Old:
```js
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              Szolgáltatásaink
            </span>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              {SERVICE_PAGES.map((s) => (
                <li key={s.path}>
                  <Link
                    to={s.path}
                    className="hover:text-white transition-colors duration-300"
                  >
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
```
New:
```js
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              {t("footer.servicesHeading")}
            </span>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              {SERVICE_PAGES.map((s) => (
                <li key={s.path}>
                  <Link
                    to={localizePath(s.path, locale)}
                    className="hover:text-white transition-colors duration-300"
                  >
                    {t(`landing.servicePages.${s.id}`)}
                  </Link>
                </li>
              ))}
            </ul>
```

**4e. "Cég" column:**

Old:
```js
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              Cég
            </span>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li>
                <Link
                  to="/"
                  className="hover:text-white transition-colors duration-300"
                >
                  Kezdőlap
                </Link>
              </li>
              <li>
                <a
                  href="/#about"
                  className="hover:text-white transition-colors duration-300"
                >
                  Rólunk
                </a>
              </li>
              <li>
                <a
                  href="/#gyik"
                  className="hover:text-white transition-colors duration-300"
                >
                  GYIK
                </a>
              </li>
              <li>
                <a
                  href="/#contact"
                  className="hover:text-white transition-colors duration-300"
                >
                  Sofőr jelentkezés
                </a>
              </li>
              <li>
                <Link
                  to="/auth/login"
                  className="hover:text-white transition-colors duration-300"
                >
                  Bejelentkezés
                </Link>
              </li>
              <li>
                <Link
                  to="/adatvedelem"
                  className="hover:text-white transition-colors duration-300"
                >
                  Adatvédelmi tájékoztató
                </Link>
              </li>
            </ul>
```
New:
```js
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              {t("footer.companyHeading")}
            </span>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li>
                <Link
                  to={localizePath("/", locale)}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.home")}
                </Link>
              </li>
              <li>
                <a
                  href={`${localizePath("/", locale)}#about`}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.about")}
                </a>
              </li>
              <li>
                <a
                  href={`${localizePath("/", locale)}#gyik`}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.faq")}
                </a>
              </li>
              <li>
                <a
                  href={`${localizePath("/", locale)}#contact`}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.driverApplication")}
                </a>
              </li>
              <li>
                <Link
                  to="/auth/login"
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.login")}
                </Link>
              </li>
              <li>
                <Link
                  to={localizePath("/adatvedelem", locale)}
                  className="hover:text-white transition-colors duration-300"
                >
                  {t("footer.companyLinks.privacy")}
                </Link>
              </li>
            </ul>
```

(`/auth/login` deliberately stays a plain, non-localized path — the app behind login is out of scope for this feature.)

**4f. "Kapcsolat" column heading + tax-id line:**

Old:
```js
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              Kapcsolat
            </span>
```
New:
```js
            <span className="text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#2F4DE0]">
              {t("footer.contactHeading")}
            </span>
```

Old:
```js
              <li className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <PiIdentificationCardLight className="text-white/60" />
                </span>
                <span>Adószám: 26381626-2-11</span>
              </li>
```
New:
```js
              <li className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  <PiIdentificationCardLight className="text-white/60" />
                </span>
                <span>{t("footer.taxIdLabel")} 26381626-2-11</span>
              </li>
```

(The email/phone/address lines just above are untouched — they're literal contact identifiers, not translatable prose.)

**4g. Bottom bar:**

Old:
```js
        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/30 font-[Overpass_Mono] uppercase tracking-wide">
          <span>
            © {new Date().getFullYear()} Szikora Transz Kft. · Adószám:
            26381626-2-11
          </span>
          <span className="flex items-center gap-4">
            <Link
              to="/adatvedelem"
              className="hover:text-white/60 transition-colors duration-300"
            >
              Adatvédelem
            </Link>
            <span>Minden jog fenntartva.</span>
          </span>
        </div>
```
New:
```js
        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/30 font-[Overpass_Mono] uppercase tracking-wide">
          <span>
            © {new Date().getFullYear()} Szikora Transz Kft. · {t("footer.taxIdLabel")} 26381626-2-11
          </span>
          <span className="flex items-center gap-4">
            <Link
              to={localizePath("/adatvedelem", locale)}
              className="hover:text-white/60 transition-colors duration-300"
            >
              {t("footer.privacyLink")}
            </Link>
            <span>{t("footer.allRightsReserved")}</span>
          </span>
        </div>
```

### Step 5: Verify

1. Visit `/` (HU) — footer unchanged, all 4 columns/links/bottom bar Hungarian, "Szolgáltatásaink" links point at the 6 HU service pages, "Rólunk"/"GYIK"/"Sofőr jelentkezés" hash-links (`/#about` etc.) still scroll the homepage correctly.
2. Visit `/en` — footer fully English, "Our Services" links point at `/en/belfoldi-fuvarozas-arajanlat` etc., "About Us"/"FAQ"/"Driver Application" hash-links point at `/en#about`/`/en#gyik`/`/en#contact` and correctly scroll the English homepage to those sections.
3. Visit `/en/belfoldi-fuvarozas-arajanlat` — its footer also renders in English (Footer is shared, rendered from every page via `ServicePage.js`/`Landing.js`).
4. Devtools console — no `[i18n]` warnings.

### Step 6: Commit

```bash
git add src/components/Footers/Footer.js src/data/landingContent.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate Footer.js, drop dead SERVICE_PAGES.label field"
```

---

## Task 12: `Adatvedelem.js` translation

**Files:**
- Modify (full rewrite): `src/views/Adatvedelem.js`
- Modify: `src/i18n/hu.js`, `src/i18n/en.js` (replace the `adatvedelem` export)

**Interfaces:** Consumes `useTranslation()`, `localizePath()` (Task 1); `Breadcrumb({items, homeLabel, homePath})` (Task 3); `useSeo({..., lang, alternates})` (Task 1). The two paragraphs containing an inline `mailto:` link (§1 and the end of §6) are rendered as locale-branched JSX directly in the component — same pattern as the service pages' custom sections — everything else comes from the dictionary.

### Step 1: Replace the `adatvedelem` export in `src/i18n/hu.js`

Old: `export const adatvedelem = {};`
New:
```js
export const adatvedelem = {
  metaTitle: "Adatvédelmi tájékoztató | Szikora Transz Kft.",
  metaDescription:
    "Tájékoztató, milyen személyes adatokat kezel a Szikora Transz Kft. az ajánlatkérő és jelentkezési űrlapok kitöltésekor, milyen jogok illetik meg Önt.",
  eyebrow: "Jogi tájékoztató",
  h1: "Adatvédelmi tájékoztató",
  breadcrumbLabel: "Adatvédelmi tájékoztató",
  backLink: "← Vissza a főoldalra",
  section1: { heading: "1. Az adatkezelő" },
  section2: {
    heading: "2. Milyen adatokat kezelünk",
    intro: "Az űrlapok kitöltésekor az alábbi adatokat adja meg:",
    items: [
      "teljes név",
      "telefonszám",
      "email cím",
      "a fuvarral/jelentkezéssel kapcsolatos, Ön által megadott további adatok (pl. a fuvar iránya, honnan/hová szállítanánk, kívánt időzítés, a szállítandó áru leírása, illetve sofőr-jelentkezés esetén a végzettségre/tapasztalatra vonatkozó információk)",
    ],
  },
  section3: {
    heading: "3. Az adatkezelés célja és jogalapja",
    body: "Az adatkezelés célja az Ön ajánlatkérésének vagy sofőr-jelentkezésének megválaszolása, és a kapcsolatfelvétel az Ön által megadott elérhetőségeken. Az adatkezelés jogalapja az Ön önkéntes hozzájárulása, amelyet az űrlap elküldésével ad meg.",
  },
  section4: {
    heading: "4. Az adatkezelés időtartama",
    body: "Az űrlapon megadott adatokat a megkeresés megválaszolásához, és — amennyiben ebből üzleti kapcsolat jön létre — az együttműködés időtartama alatt kezeljük. Amennyiben a megkeresésből nem lesz üzleti kapcsolat, az adatokat legkésőbb a megkeresés lezárását követő ésszerű időn belül töröljük.",
  },
  section5: {
    heading: "5. Ki fér hozzá az adatokhoz",
    body: "A megadott adatokhoz a Szikora Transz Kft. az ajánlatadásért/toborzásért felelős munkatársai férnek hozzá. Adatait harmadik félnek nem adjuk át, kivéve, ha ezt jogszabály írja elő.",
  },
  section6: {
    heading: "6. Az Ön jogai",
    intro: "Adatai vonatkozásában Önt megilleti:",
    items: [
      "a hozzáférés joga (tájékoztatást kérhet arról, milyen adatait kezeljük),",
      "a helyesbítés joga,",
      "a törlés joga,",
      "az adatkezelés korlátozásának joga,",
      "a hozzájárulás bármikori visszavonásának joga,",
      "és a felügyeleti hatósághoz (NAIH) fordulás joga.",
    ],
  },
  section7: {
    heading: "7. Jogorvoslat",
    body: "Amennyiben úgy ítéli meg, hogy adatai kezelése nem felel meg a jogszabályi előírásoknak, panasszal fordulhat a Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH), vagy bírósághoz fordulhat.",
  },
  footerDisclaimer:
    "* Ez a tájékoztató a weboldalon jelenleg ténylegesen működő űrlapok (ajánlatkérés, sofőr-jelentkezés) adatkezelését mutatja be. Érdemes jogi szakértővel felülvizsgáltatni, mielőtt teljes körűen, minden jövőbeli adatkezelésre nézve is véglegesnek tekintenék.",
};
```

### Step 2: Replace the `adatvedelem` export in `src/i18n/en.js`

Old: `export const adatvedelem = {};`
New:
```js
export const adatvedelem = {
  metaTitle: "Privacy Policy | Szikora Transz Kft.",
  metaDescription:
    "Information on what personal data Szikora Transz Kft. processes when you fill out the quote-request and driver-application forms, and what rights you have.",
  eyebrow: "Legal Notice",
  h1: "Privacy Policy",
  breadcrumbLabel: "Privacy Policy",
  backLink: "← Back to homepage",
  section1: { heading: "1. Data Controller" },
  section2: {
    heading: "2. What Data We Process",
    intro: "When you fill out our forms, you provide the following data:",
    items: [
      "full name",
      "phone number",
      "email address",
      "additional information you provide related to the freight job/application (e.g. the direction of the shipment, the pickup/delivery locations, the desired timing, a description of the goods to be transported, or, in the case of a driver application, information about your qualifications/experience)",
    ],
  },
  section3: {
    heading: "3. Purpose and Legal Basis of Data Processing",
    body: "The purpose of the data processing is to respond to your quote request or driver application, and to contact you at the details you have provided. The legal basis for the data processing is your voluntary consent, given by submitting the form.",
  },
  section4: {
    heading: "4. Duration of Data Processing",
    body: "We process the data provided in the form for as long as needed to respond to your inquiry, and — if a business relationship results from it — for the duration of that cooperation. If the inquiry does not result in a business relationship, we delete the data within a reasonable time after the inquiry is closed, at the latest.",
  },
  section5: {
    heading: "5. Who Has Access to the Data",
    body: "The data you provide is accessible to Szikora Transz Kft.'s staff responsible for quoting/recruitment. We do not share your data with third parties, except where required by law.",
  },
  section6: {
    heading: "6. Your Rights",
    intro: "With respect to your data, you are entitled to:",
    items: [
      "the right of access (you may request information about what data of yours we process),",
      "the right to rectification,",
      "the right to erasure,",
      "the right to restriction of processing,",
      "the right to withdraw your consent at any time,",
      "and the right to lodge a complaint with the supervisory authority (NAIH).",
    ],
  },
  section7: {
    heading: "7. Legal Remedy",
    body: "If you believe that the processing of your data does not comply with legal requirements, you may file a complaint with the National Authority for Data Protection and Freedom of Information (NAIH), or you may turn to the courts.",
  },
  footerDisclaimer:
    "* This notice describes the data processing of the forms currently actually in operation on the website (quote request, driver application). It is advisable to have this reviewed by a legal expert before considering it fully final for any and all future data processing.",
};
```

### Step 3: Rewrite `src/views/Adatvedelem.js` (full file content)

```js
import React from "react";
import { Link } from "react-router-dom";
import Footer from "components/Footers/Footer.js";
import Breadcrumb from "components/Landing/Breadcrumb.js";
import { useSeo } from "utils/useSeo.js";
import { useTranslation, localizePath } from "i18n/index.js";

// Adatvédelmi tájékoztató — elsősorban az ajánlatkérő/sofőr-jelentkezési
// formok GDPR-hozzájárulási jelölőnégyzete hivatkozik erre az oldalra
// (ld. components/Landing/QuoteForm.js). A szöveg a jelenleg ténylegesen
// kezelt adatkörre épül (name/email/phone/message a sendAjanlatkeres és
// sendJelentkezes backend actionökből, ld. backend/ApiHandler.php
// saveAjanlatkeres() és backend/interface/emailInterface.php) — nem
// tartalmaz olyan adatkezelést, ami a kódban ne létezne. Az angol verzió
// (ld. src/i18n/en.js `adatvedelem`) ugyanezt a tartalmat fordítja, ugyanazzal
// a "nem jogi felülvizsgálat alatt álló sablon" figyelmeztetéssel.
export default function Adatvedelem() {
  const { t, locale } = useTranslation();
  const breadcrumbItems = [
    { name: t("adatvedelem.breadcrumbLabel"), path: localizePath("/adatvedelem", locale) },
  ];
  useSeo({
    title: t("adatvedelem.metaTitle"),
    description: t("adatvedelem.metaDescription"),
    path: localizePath("/adatvedelem", locale),
    lang: locale,
    alternates: { hu: "/adatvedelem", en: "/en/adatvedelem" },
    breadcrumb: breadcrumbItems,
  });

  return (
    <div className="font-sans min-h-screen bg-[#F2F3F5]">
      <nav className="border-b border-[#23262B]/8 bg-[#F2F3F5]/90 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to={localizePath("/", locale)}>
            <img src="/logo2.svg" alt="Szikora Transz Kft" width="1600" height="578" className="h-9 w-auto" />
          </Link>
          <Link
            to={localizePath("/", locale)}
            className="text-sm font-[Overpass] font-semibold text-[#23262B]/70 hover:text-[#1E3AA8] transition-colors duration-300"
          >
            {t("adatvedelem.backLink")}
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <Breadcrumb
          items={breadcrumbItems}
          homeLabel={t("landing.breadcrumbHome")}
          homePath={localizePath("/", locale)}
        />
        <span className="inline-flex items-center gap-2 text-xs font-[Overpass_Mono] uppercase tracking-[0.2em] text-[#1E3AA8] mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1E3AA8]"></span>
          {t("adatvedelem.eyebrow")}
        </span>
        <h1 className="font-[Overpass] font-extrabold text-4xl text-[#23262B] tracking-tight mb-6">
          {t("adatvedelem.h1")}
        </h1>

        <div className="prose prose-p:text-[#23262B]/75 prose-headings:text-[#23262B] max-w-none space-y-8 text-[#23262B]/75 leading-relaxed">
          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section1.heading")}
            </h2>
            {locale === "en" ? (
              <p>
                Szikora Transz Kft. (2518 Leányvár, Bécsi út 86, Hungary; tax number: 26381626-2-11, e-mail:{" "}
                <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                  szikoratransz@gmail.com
                </a>
                ) processes the personal data provided when filling out the quote-request and
                driver-application forms on its website (szikora-transz.hu) as described below.
              </p>
            ) : (
              <p>
                Szikora Transz Kft. (2518 Leányvár, Bécsi út 86, adószám:
                26381626-2-11, e-mail:{" "}
                <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                  szikoratransz@gmail.com
                </a>
                ) az alábbiak szerint kezeli a weboldalon (szikora-transz.hu)
                található ajánlatkérő és sofőr-jelentkezési űrlapok
                kitöltésekor megadott személyes adatokat.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section2.heading")}
            </h2>
            <p>{t("adatvedelem.section2.intro")}</p>
            <ul className="list-disc pl-6 space-y-1">
              {t("adatvedelem.section2.items").map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section3.heading")}
            </h2>
            <p>{t("adatvedelem.section3.body")}</p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section4.heading")}
            </h2>
            <p>{t("adatvedelem.section4.body")}</p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section5.heading")}
            </h2>
            <p>{t("adatvedelem.section5.body")}</p>
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section6.heading")}
            </h2>
            <p>{t("adatvedelem.section6.intro")}</p>
            <ul className="list-disc pl-6 space-y-1">
              {t("adatvedelem.section6.items").map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {locale === "en" ? (
              <p>
                For matters related to these rights, please contact us at{" "}
                <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                  szikoratransz@gmail.com
                </a>
                .
              </p>
            ) : (
              <p>
                Ezen jogaival kapcsolatban forduljon hozzánk a{" "}
                <a href="mailto:szikoratransz@gmail.com" className="text-[#1E3AA8] underline">
                  szikoratransz@gmail.com
                </a>{" "}
                címen.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-[Overpass] font-bold text-xl text-[#23262B] mb-2">
              {t("adatvedelem.section7.heading")}
            </h2>
            <p>{t("adatvedelem.section7.body")}</p>
          </section>

          <p className="text-xs text-[#23262B]/40 pt-6 border-t border-[#23262B]/10">
            {t("adatvedelem.footerDisclaimer")}
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
```

### Step 4: Verify

1. Visit `/adatvedelem` — unchanged Hungarian content, both mailto links work.
2. Visit `/en/adatvedelem` — full English content, all 7 numbered sections, both mailto links (§1 intro, §6 closing) present and correctly styled, footer disclaimer present.
3. From `/en`, click the GDPR consent checkbox's "Privacy Policy" link in the QuoteForm (Task 4) — confirm it opens `/en/adatvedelem` in a new tab, not `/adatvedelem`.
4. Devtools — `<html lang="en">` and hreflang tags present on `/en/adatvedelem`; no `[i18n]` warnings.

### Step 5: Commit

```bash
git add src/views/Adatvedelem.js src/i18n/hu.js src/i18n/en.js
git commit -m "feat: translate Adatvedelem.js privacy policy page"
```

---

## Task 13: `sitemap.xml` — add English URLs

**Files:**
- Modify: `public/sitemap.xml`

**Interfaces:** None (static XML, no code dependency).

### Step 1: Add 7 new `<url>` entries

Old (the file's closing `<url>` block + closing tag):
```xml
  <url>
    <loc>https://szikora-transz.hu/adatvedelem</loc>
    <lastmod>2026-07-20</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
```
New (same block, plus the 7 English URLs — priorities set slightly below their HU counterparts, since HU is the primary market and `x-default` points at the HU URL; `lastmod` uses today's date since these are newly published pages):
```xml
  <url>
    <loc>https://szikora-transz.hu/adatvedelem</loc>
    <lastmod>2026-07-20</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://szikora-transz.hu/en</loc>
    <lastmod>2026-07-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://szikora-transz.hu/en/belfoldi-fuvarozas-arajanlat</loc>
    <lastmod>2026-07-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://szikora-transz.hu/en/nemzetkozi-fuvarozas-vamugyintezessel</loc>
    <lastmod>2026-07-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://szikora-transz.hu/en/biztositott-szallitas</loc>
    <lastmod>2026-07-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://szikora-transz.hu/en/expressz-fuvarozas</loc>
    <lastmod>2026-07-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://szikora-transz.hu/en/rendezveny-szallitas</loc>
    <lastmod>2026-07-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://szikora-transz.hu/en/egyedi-arajanlat-fuvarozas</loc>
    <lastmod>2026-07-27</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://szikora-transz.hu/en/adatvedelem</loc>
    <lastmod>2026-07-27</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>
```

### Step 2: Verify

`cat public/sitemap.xml` and confirm well-formed XML (15 `<url>` entries total: the original 8 + the 7 new ones) — e.g. `xmllint --noout public/sitemap.xml` if `xmllint` is available, or just visually confirm every `<url>` opens and closes correctly.

### Step 3: Commit

```bash
git add public/sitemap.xml
git commit -m "feat: add English URLs to sitemap.xml"
```

---

## Task 14: `prerender.js` + `.htaccess` — flat-file handling for `/en/*` routes

**Files:**
- Modify: `scripts/prerender.js`
- Modify: `public/.htaccess`

**Interfaces:** Produces `routeToOutputFile(route): string` (internal helper, only used within `prerender.js`'s own render loop).

**Critical constraint (repeated from the design spec)**: `/en/<slug>` must **never** prerender into `build/en/<slug>.html` (a real `en/` subdirectory) — that would reproduce the exact mod_dir 301/403 bug class this project already hit once with directory-shaped routes (see `CLAUDE.md`'s "Long-tail SEO" gotcha). It must prerender into a flat, hyphenated `build/en-<slug>.html` file instead, with `.htaccess` mapping the pretty URL to that flat filename.

### Step 1: Add the 7 English routes and the flat-file-naming helper to `scripts/prerender.js`

Old:
```js
const ROUTES_TO_PRERENDER = [
  "/",
  "/belfoldi-fuvarozas-arajanlat",
  "/nemzetkozi-fuvarozas-vamugyintezessel",
  "/biztositott-szallitas",
  "/expressz-fuvarozas",
  "/rendezveny-szallitas",
  "/egyedi-arajanlat-fuvarozas",
  "/adatvedelem",
];
// A kulcsfájl neve = a kulcs maga (public/<kulcs>.txt, a fájl tartalma is
// csak a kulcs) — ezt a IndexNow protokoll írja elő a tulajdonosi
// ellenőrzéshez. A generálás egyszeri, kézi lépés volt (`secrets.token_hex`),
// nem a build része.
const INDEXNOW_KEY = "256e3aaf0d0ab4f976916e23143e54ba";
```
New:
```js
const ROUTES_TO_PRERENDER = [
  "/",
  "/belfoldi-fuvarozas-arajanlat",
  "/nemzetkozi-fuvarozas-vamugyintezessel",
  "/biztositott-szallitas",
  "/expressz-fuvarozas",
  "/rendezveny-szallitas",
  "/egyedi-arajanlat-fuvarozas",
  "/adatvedelem",
  "/en",
  "/en/belfoldi-fuvarozas-arajanlat",
  "/en/nemzetkozi-fuvarozas-vamugyintezessel",
  "/en/biztositott-szallitas",
  "/en/expressz-fuvarozas",
  "/en/rendezveny-szallitas",
  "/en/egyedi-arajanlat-fuvarozas",
  "/en/adatvedelem",
];

// `/en/<slug>` NEM `build/en/<slug>.html`-be prerenderelődik (ami egy valódi
// `en/` alkönyvtárat hozna létre a lemezen), hanem lapos, kötőjeles
// `build/en-<slug>.html` fájlba — ugyanaz a "sose legyen valódi könyvtár egy
// route névből" elv, ami a többi route-ot is lapos fájllá tette (ld. a fenti
// megjegyzést a korábbi alkönyvtár-alapú 301/403-as hibáról). A nézet URL-je
// (`/en/<slug>`) emiatt nem egyezik meg a mögötte álló fájlnévvel —
// public/.htaccess végzi a leképezést.
function routeToOutputFile(route) {
  if (route === "/") return path.join(BUILD_DIR, "index.html");
  if (route === "/en") return path.join(BUILD_DIR, "en.html");
  if (route.startsWith("/en/")) {
    return path.join(BUILD_DIR, `en-${route.slice(4)}.html`);
  }
  return path.join(BUILD_DIR, `${route.replace(/^\//, "")}.html`);
}

// A kulcsfájl neve = a kulcs maga (public/<kulcs>.txt, a fájl tartalma is
// csak a kulcs) — ezt a IndexNow protokoll írja elő a tulajdonosi
// ellenőrzéshez. A generálás egyszeri, kézi lépés volt (`secrets.token_hex`),
// nem a build része.
const INDEXNOW_KEY = "256e3aaf0d0ab4f976916e23143e54ba";
```

### Step 2: Use the new helper in the render loop

Old:
```js
        const html = await page.content();
        const outFile =
          route === "/"
            ? path.join(BUILD_DIR, "index.html")
            : path.join(BUILD_DIR, `${route.replace(/^\//, "")}.html`);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
```
New:
```js
        const html = await page.content();
        const outFile = routeToOutputFile(route);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
```

### Step 3: Add the `.htaccess` rewrite rule for `/en/<slug>` → `en-<slug>.html`

Old:
```
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME}.html -f
  RewriteRule ^([^/]+)$ $1.html [L]

  RewriteRule ^index\.html$ - [L]
```
New:
```
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME}.html -f
  RewriteRule ^([^/]+)$ $1.html [L]

  # Az angol (`/en/...`) szolgáltatás-oldalak lapos, kötőjeles fájlként
  # prerenderelődnek (ld. scripts/prerender.js `routeToOutputFile()`), NEM
  # egy valódi `en/` alkönyvtárként — ugyanazon okból, amiért a fenti szabály
  # is lapos fájlokra épül (ld. a fájl elején lévő hosszú megjegyzést a
  # korábbi alkönyvtár-alapú 301/403-as hibáról). Ez a szabály képezi le a
  # látható, kétszegmenses `/en/<slug>` URL-t a mögötte álló, lapos
  # `en-<slug>.html` fájlra. A bare `/en`-t (nincs benne `/`) a fenti,
  # egy-szegmensre szűkített generikus szabály már önmagában lekezeli.
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{DOCUMENT_ROOT}/en-$1.html -f
  RewriteRule ^en/([^/]+)$ en-$1.html [L]

  RewriteRule ^index\.html$ - [L]
```

### Step 4: Extend the SPA-shell fallback rule for `/en/*`

Old:
```
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(belfoldi-fuvarozas-arajanlat|nemzetkozi-fuvarozas-vamugyintezessel|biztositott-szallitas|expressz-fuvarozas|rendezveny-szallitas|egyedi-arajanlat-fuvarozas|adatvedelem)/?$ /index.html [L]
```
New:
```
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(belfoldi-fuvarozas-arajanlat|nemzetkozi-fuvarozas-vamugyintezessel|biztositott-szallitas|expressz-fuvarozas|rendezveny-szallitas|egyedi-arajanlat-fuvarozas|adatvedelem)/?$ /index.html [L]

  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^en/?$ /index.html [L]

  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^en/(belfoldi-fuvarozas-arajanlat|nemzetkozi-fuvarozas-vamugyintezessel|biztositott-szallitas|expressz-fuvarozas|rendezveny-szallitas|egyedi-arajanlat-fuvarozas|adatvedelem)/?$ /index.html [L]
```

### Step 5: Verify (local build)

1. `npm run build` (this runs `postbuild` → `node scripts/prerender.js` automatically per `package.json`) — confirm the console output reports rendering all 16 routes (the original 8 + the 7 new `/en/...` + the count message), and that it still exits 0 even if you can't fully verify Chromium behavior (per the script's existing fail-safe design).
2. Inspect `build/` — confirm `build/en.html` and `build/en-belfoldi-fuvarozas-arajanlat.html` (and the other 5 `en-<slug>.html` files) exist as **flat files directly in `build/`**, and that **no `build/en/` directory was created**.
3. `grep -o '<title>[^<]*</title>' build/en.html` and `build/en-belfoldi-fuvarozas-arajanlat.html` — confirm each shows the correct English `<title>`, not the Hungarian one.
4. **Apache verification (do not skip — this is exactly the class of bug that was missed before without it)**: start a local Apache instance matching the host's `AllowOverride` (mirroring however the original `.htaccess` fixes in this project's history were verified — e.g. `apache2 -f <a minimal config with DocumentRoot pointed at build/, AllowOverride All, on a free port> -k start`), then:
   - `curl -sI http://localhost:<port>/en` → expect `200`, serving `en.html`'s content (check with `curl -s` and grep for the English `<title>`).
   - `curl -sI http://localhost:<port>/en/belfoldi-fuvarozas-arajanlat` → expect `200`, serving `en-belfoldi-fuvarozas-arajanlat.html`'s content.
   - `curl -sI http://localhost:<port>/en/nonexistent-slug` → expect the SPA-shell fallback rule to serve `index.html` with `200` (not a loop, not a 500) — this specifically exercises the `RewriteRule ^en/(...)/?$ /index.html` fallback added in Step 4.
   - `curl -sI http://localhost:<port>/en/belfoldi-fuvarozas-arajanlat/nested/bad/path` → expect a plain Apache 404 (no infinite-redirect loop, no 500) — this is the exact failure mode the `[^/]+` restriction (already in place, unmodified by this task) exists to prevent; confirm it still holds for the new `en/([^/]+)` rule too (it can't loop, since `en-<slug>.html` never itself matches `^en/([^/]+)$` again).
   - Stop the test Apache instance when done.
5. Update `docs/superpowers/plans/2026-07-27-en-landing-translation.md` is not required, but DO update the project's `CLAUDE.md` per this repo's own convention ("CLAUDE.md karbantartása minden nagyobb módosítás után") — add a short note under a new "English (`/en`) translation of marketing pages" section summarizing: the i18n dictionary architecture (`src/i18n/hu.js`/`en.js`, `useTranslation()`, `localizePath()`), the flat-file `/en/<slug>` → `en-<slug>.html` prerender convention and why, and the "3 places to register a new marketing route" pattern now being 4 (route in `src/index.js` HU **and** EN, `ROUTES_TO_PRERENDER`, `sitemap.xml` HU **and** EN) for any future 7th service page.

### Step 6: Commit

```bash
git add scripts/prerender.js public/.htaccess
git commit -m "feat: prerender /en routes as flat hyphenated files, extend .htaccess rewrite rules"
```

Then, separately (per Step 5's note), update `CLAUDE.md` and commit that on its own:

```bash
git add CLAUDE.md
git commit -m "docs: document the /en translation architecture in CLAUDE.md"
```

---

## Plan self-review

**Spec coverage** — every section of `docs/superpowers/specs/2026-07-27-en-landing-translation-design.md` maps to a task:
1. i18n architecture / URL-based locale detection → Task 1.
2. Content data model (FEATURES/PROCESS_STEPS/TESTIMONIALS/FAQ_ITEMS/SERVICE_PAGES → ids) → Task 2 (SERVICE_PAGES fully finished in Task 11).
3. Routing (`/en/*` mirror routes) → Task 1.
4. SEO (`useSeo` `lang`/`alternates`) → Task 1, consumed in Tasks 2/3/12.
5. Prerender/`.htaccess` flat-file handling → Task 14.
6. `sitemap.xml` → Task 13.
7. Language switcher → Task 2 (`Landing.js`) and Task 3 (`ServicePage.js`).
8. Component-by-component scope (`Landing.js`, `ServicePage.js`, 6 view files, `QuoteForm.js`, `Footer.js`, `Adatvedelem.js`) → Tasks 2-12, one task per file/file-group as scoped in the design.
9. Non-goals (no admin/driver translation, no English slugs, no auto-detect redirect) — respected throughout; no task introduces any of these.

**Placeholder scan** — no "TBD"/"TODO" strings; every code block is complete, real content (all Hungarian/English copy is the actual researched/translated text, not lorem ipsum or a description of what to write).

**Type/name consistency** — verified across tasks: `useTranslation()` always returns `{ t, locale }` (never renamed); `localizePath(path, locale)` signature is identical everywhere it's called (Tasks 1-12); `pickFaq(t, ...selectors)` signature (established in Task 2) is used identically in Tasks 5-10; the stable id sets (`domestic/international/insured/express/event/custom` for FEATURES/SERVICE_PAGES, `order/planning/shipping/delivery` for PROCESS_STEPS, the 6 testimonial ids, the 9 FAQ ids) are used consistently in every task that references them; the loop-variable rename from `t` to `testimonial`/`item` (to avoid shadowing the translation function) is applied consistently in both `Landing.js` (Task 2) and `ServicePage.js` (Task 3).

**Scope check** — this is a single, appropriately-large feature (translate one existing site into a second language) — not multiple independent subsystems, so no further decomposition into separate plans is needed.

