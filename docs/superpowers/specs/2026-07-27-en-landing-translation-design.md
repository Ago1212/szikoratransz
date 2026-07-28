# Bemutató oldalak angol fordítása — design

Dátum: 2026-07-27

## Cél és kör

A publikus bemutató (marketing) oldalak angol nyelvű verziót kapnak: a főoldal
(`src/views/Landing.js`), a 6 long-tail SEO szolgáltatás-oldal
(`src/views/landing/*.js`), és az `Adatvedelem.js` (GDPR-tájékoztató). Az
admin/sofőr app (bejelentkezés utáni felület) **nem** kap fordítást, marad
kizárólag magyar.

## Nem cél

- Admin/sofőr app fordítása.
- Külön angol kulcsszó-kutatás/slug (a magyar slugok maradnak `/en/` alatt is).
- Automatikus böngésző-nyelv-detektálás vagy redirect — minden látogató
  alapértelmezetten a magyar oldalra érkezik, angolra a nyelvváltóval vált át.
- A `TESTIMONIALS` valós ügyfelekre cserélése — csak a meglévő (fiktív, minta-
  szövegként már jelölt) 6 referencia kap angol quote/role/company szöveget.

## 1. Architektúra: központi i18n szótár + URL-alapú nyelv-felismerés

Új `src/i18n/` mappa:
- `hu.js` / `en.js` — azonos, beágyazott kulcs-struktúrájú sima JS objektumok
  (nem JSON — tömböket/objektumokat is kell tárolniuk, pl. bullet-listák,
  FAQ-elemek).
- `index.js` — exportál egy `useTranslation()` hookot:
  - a nyelvet kizárólag az URL-ből dönti el: `useLocation().pathname === "/en" || pathname.startsWith("/en/")` → `"en"`, egyébként `"hu"`. **Nincs Context/Provider** — ez illeszkedik ahhoz, ahogy a kódbázis már máshol (`ScrollToTop.js`, `Modal.js`, `CardCalender.js`) `useLocation`/`useMediaQuery`-vel dönt el nézet-ágakat, nem globális state-tárolással.
  - `t(path)` — dot-path lookup (pl. `t("landing.hero.title")`) az aktuális nyelvi objektumba; hiányzó EN kulcsnál dev-módban (`process.env.NODE_ENV !== "production"`) console.warn + visszaesés a HU értékre — sosem jelenik meg nyers kulcsnév a felületen.
  - visszaadja magát a `locale` értéket is, a hívó oldalaknak/komponenseknek szükségük van rá (pl. TESTIMONIALS/FAQ lookup, `localizePath`).
  - exportál egy `localizePath(path, locale)` függvényt: `locale === "en" ? "/en" + path : path` (a `path` mindig a kanonikus, `/`-lel kezdődő magyar útvonal). Ugyanez fordítva (EN → HU) a nyelvváltóhoz: `path.replace(/^\/en/, "") || "/"`.

## 2. Tartalom-adatmodell (`src/data/landingContent.js`)

`FEATURES`/`PROCESS_STEPS`/`TESTIMONIALS`/`FAQ_ITEMS` **egyetlen tömb marad**
(nincs hu/en tömb-duplikáció — az két külön tömböt kellene szinkronban tartani
sorrend/index szerint, ami könnyen csendben szétcsúszna). Csak a fordítandó
szöveg-mezők kerülnek ki a központi i18n szótárba, egy stabil azonosító
alapján:

- `FEATURES`: `{ id: "domestic", icon: PiTruckLight, href: "/belfoldi-fuvarozas-arajanlat" }` — a `title`/`desc` a szótárban: `landing.features.domestic.title` / `.desc`.
- `PROCESS_STEPS`: `{ id: "order", n: "01" }` — `title`/`desc` a szótárban: `landing.process.order.title`/`.desc`.
- `TESTIMONIALS`: `{ id: "nagy_peter", name: "Nagy Péter" }` (a név marad, tulajdonnév, nem fordítjuk) — `quote`/`role`/`company` a szótárban: `landing.testimonials.nagy_peter.{quote,role,company}`.
- `FAQ_ITEMS`: **stabil kulcs, nem szó szerinti kérdésszöveg** — `{ id: "response_time" }`, a `q`/`a` a szótárban: `landing.faq.response_time.{q,a}`. Ez javítja a jelenlegi `pickFaq()` egyik rejtett törékenységét is: ma szó szerinti magyar kérdésszöveg-egyezés alapján válogat egy oldalhoz tartozó részhalmazt, egy jövőbeli HU-copy-módosítás emiatt csendben elronthatná egy oldal FAQ-válogatását; kulcs alapján ez a kockázat megszűnik.
  - `pickFaq(locale, ...selectors)` új szignatúrája: minden `selector` vagy egy `id` string (alap kérdés/válasz a szótárból), vagy `{ id, aKey }` alakú override, ahol `aKey` egy másik szótár-útvonalra mutat egy oldal-specifikus válaszhoz (pl. `landing.faq.overrides.expressz_response_time.a`) — ugyanaz a "más oldalon más választ ad ugyanarra a kérdésre" mechanizmus, mint ma, csak kulcs-alapú override-dal a literál szöveg-override helyett.
- `SERVICE_PAGES`: `{ id, path }` marad (kanonikus, magyar útvonal) — a `label` a szótárból jön (`landing.servicePages.<id>`), a tényleges href minden hívási helyen `localizePath(path, locale)`-on megy át.

## 3. Routing (`src/index.js`)

Minden meglévő marketing route mellé egy `/en/...` tükör-route kerül,
**ugyanazokkal a komponensekkel** (a nyelvet rendereléskor az URL dönti el,
nem külön komponens-pár):

```
<Route path="/en" exact component={Landing} />
<Route path="/en/belfoldi-fuvarozas-arajanlat" exact component={BelfoldiFuvarozas} />
<Route path="/en/nemzetkozi-fuvarozas-vamugyintezessel" exact component={NemzetkoziFuvarozas} />
<Route path="/en/biztositott-szallitas" exact component={BiztositottSzallitas} />
<Route path="/en/expressz-fuvarozas" exact component={ExpresszFuvarozas} />
<Route path="/en/rendezveny-szallitas" exact component={RendezvenySzallitas} />
<Route path="/en/egyedi-arajanlat-fuvarozas" exact component={EgyediArajanlat} />
<Route path="/en/adatvedelem" exact component={Adatvedelem} />
```

## 4. SEO (`src/utils/useSeo.js`)

- Új opcionális `lang` paraméter (alapérték `"hu"`) — mountkor beállítja
  `document.documentElement.lang`-ot, unmountkor visszaállítja az előzőt
  (ugyanaz a minta, mint a title/description/canonical restore).
- Új opcionális `alternates: { hu: "/path", en: "/en/path" }` paraméter —
  beszúr `<link rel="alternate" hreflang="hu" href="...">`,
  `hreflang="en"` és `hreflang="x-default"` (utóbbi a HU URL-re mutat, mivel a
  HU a fő piac/alapértelmezett) tageket, unmountkor eltávolítja őket, ugyanúgy,
  mint a meglévő FAQPage/BreadcrumbList/Service script-injektálás.
- A FAQPage/BreadcrumbList/Service JSON-LD-k `inLanguage` mezője a hardcoded
  `"hu"` helyett a tényleges `lang` paramétert tükrözi.
- `useSeo` belső Breadcrumb-építése ("Főoldal" gyökér-elem) is lokalizált
  legyen (`lang === "en" ? "Home" : "Főoldal"`).
- Minden hívó (`Landing.js`, `ServicePage.js`) mindkét saját URL-jét ismeri
  (kanonikus HU path + `/en` + ugyanaz a path), ebből építi az `alternates`-t.

## 5. Statikus kiszolgálás / prerender / `.htaccess`

**Kritikus gotcha, amit el kell kerülni**: ha a `/en/<slug>` prerender-kimenet
szó szerint `build/en/<slug>.html` lenne, az egy valódi `en/` könyvtárat hozna
létre a build gyökerében. Ez pontosan az a mod_dir 301/403-as hibaosztály,
amit a projekt korábban élesben elszenvedett és lapos fájlokkal javított (ld.
`CLAUDE.md` "Long-tail SEO" gotcha-blokkja) — egy valódi `/en` könyvtár mellett
a bare `/en` kérés ugyanabba a csapdába futna bele újra.

Megoldás — lapos, kötőjeles fájlnevek, sosem alkönyvtár:
- `scripts/prerender.js` `ROUTES_TO_PRERENDER` tömbje +7 új route-ot kap
  (`/en`, `/en/belfoldi-fuvarozas-arajanlat`, ... mind a 6, `/en/adatvedelem`).
- A kimeneti fájlnév-számítás speciális esetet kap: `/en` → `build/en.html`
  (ugyanaz a minta, mint ma a `/`-re), `/en/<slug>` → `build/en-<slug>.html`
  (lapos, kötőjeles — **nem** `build/en/<slug>.html`).
- `public/.htaccess` új szabálya (a meglévő, `[^/]+`-ra szűkített minta melle):
  ```
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteRule ^en/([^/]+)$ en-$1.html [L]
  ```
  A bare `/en`-t a már meglévő, egy-szegmensre szűkített generikus szabály
  (`^([^/]+)$ → $1.html`) minden módosítás nélkül lekezeli.
- A 62. sorbeli SPA-shell fallback route-prefix listája kiegészül
  `en(/.*)?`-vel, hogy egy sikertelen/hiányzó prerender esetén is a valódi
  SPA-shell szolgálja ki (200, nem nyers 404) az `/en/*` útvonalakat.
- **Ezt csak egy helyi, a hoszt `AllowOverride`-jával megegyező Apache-
  példányon lehet ténylegesen leellenőrizni** (a CRA dev szerver és a `serve`
  is figyelmen kívül hagyja a `.htaccess`-t) — ugyanúgy, ahogy az eredeti fix
  is így lett igazolva anno.

## 6. `sitemap.xml`

+7 új `<url>` bejegyzés az `/en/...` variánsokhoz, ugyanazzal a
`changefreq`/`priority` értékkel, mint a HU megfelelőjüké.

## 7. Nyelvváltó

Kicsi "HU | EN" kapcsoló csak a felső navigációban:
- `Landing.js` nav sávjában (desktop `navItems` sor + mobil menü).
- `ServicePage.js` minimál navjában (a "← Vissza a főoldalra" sáv mellett).

A kapcsoló a `localizePath`/inverze segítségével az **aktuális oldal másik
nyelvű változatára** navigál, nem a főoldalra dobja vissza a látogatót.

## 8. Komponensenkénti hatókör

- **Új**: `src/i18n/hu.js`, `src/i18n/en.js`, `src/i18n/index.js`.
- **`src/data/landingContent.js`**: a 2. pont szerinti átalakítás.
- **`src/utils/useSeo.js`**: a 4. pont szerinti bővítés.
- **`src/views/Landing.js`**: minden literál szöveg `t()`-re cserélve (nav,
  hero, folyamat, szolgáltatások grid + "miért minket" bullet-ek, rólunk+
  statisztikák, referenciák, GYIK, kapcsolat szekció); a nyelvváltó
  hozzáadása; a hash-horgony linkek (`#about` stb.) `localizePath()`-on
  keresztül; **a Kapcsolat szekcióban lévő, `QuoteForm`-tól különálló
  sofőr-jelentkezési form is** (saját mezők/validáció/üzenetek) fordítást
  kap.
- **`src/components/Landing/ServicePage.js`**: chrome-szövegek (`t()`), a
  `SERVICE_PAGES`/testimonial lookup-ok lokalizáltak, nav-nyelvváltó,
  breadcrumb + `useSeo` hívás átadja a `lang`/`alternates` paramétereket.
- **A 6 `src/views/landing/*.js` fájl**: `metaTitle`/`metaDescription`/
  `eyebrow`/`h1`/`intro`/`bullets`/`faqItems`/`testimonialNames` mind
  `t()`-ből/az átalakított adatmodellből jön; minden fájl saját, egyedi
  "extra tartalom" JSX blokkja (pl. `BelfoldiFuvarozas.js` "Hogyan alakul ki
  a belföldi fuvar ára?" szekciója, ami egy inline `<Link>`-et is tartalmaz)
  egy locale-ág alapján rendereli a két (HU/EN) JSX blokkot ugyanabban a
  fájlban — nem próbáljuk a gazdag/linkelt szöveget a sima string-szótáron
  átpréselni.
- **`src/components/Landing/QuoteForm.js`**: minden label/placeholder/
  validációs üzenet/állapot-üzenet `t()`-ből. **Explicit döntés**: a
  `composeMessage()` által épített, admin felé menő szabad szöveg-blokk
  (fuvar iránya/honnan/hová/időzítés) **mindig magyarul** megy ki,
  függetlenül attól, hogy a látogató melyik nyelven töltötte ki az űrlapot —
  az admin/sales csapat magyarul dolgozik, egy angol nyelvű belső e-mail csak
  zavarná őket, nem a látogatót szolgálja.
- **`src/components/Footers/Footer.js`**: oszlopcímek/linkszövegek `t()`-ből,
  a `SERVICE_PAGES` linkek és a `/#about`/`/#gyik`/`/#contact` hash-linkek
  `localizePath()`-on keresztül. A `/auth/login` link változatlan marad (az
  app maga nem tartozik ehhez a fordításhoz).
- **`src/views/Adatvedelem.js`**: teljes fordítás, ugyanazzal a "nem jogi
  felülvizsgálat alatt álló sablon" figyelmeztetéssel az angol verzión is.

## Tesztelés

Mivel ez tisztán frontend + statikus-hosting (`.htaccess`/prerender) változás,
nincs szerver-oldali (PHP/DB) kódút érintve — a CLAUDE.md szerinti kritikus
backend-tesztelési szabály itt nem alkalmazandó, de a UI-verifikációs szabály
igen: minden route-ot (HU+EN, mind a 7 oldalpár) böngészőben (`npm start`)
ellenőrizni kell, a `.htaccess`-változásokat pedig egy helyi Apache-
példányon, nem csak kód-olvasással.
