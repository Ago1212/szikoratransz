/**
 * Statikus előrenderelés a `build/` mappában — automatikusan lefut minden
 * `npm run build` UTÁN, `postbuild` npm hookként (ld. package.json). Mivel a
 * `genezio.yaml` deploy-szkriptje is `npm run build`-et hív, ez a lépés az
 * éles deploy során is automatikusan lefut, nem csak lokálisan.
 *
 * MIÉRT KELL EZ: az app 100%-ban kliensoldalon (React) renderelődik, ezért
 * a `build/index.html` nyers tartalma szó szerint üres (`<div id="root">`).
 * A legtöbb AI-crawler (GPTBot, ClaudeBot, PerplexityBot) NEM futtat
 * JavaScriptet, ezért ezek a rendszerek jelenleg csak a <title>-t és a meta
 * description-t látják az oldalból — a teljes tartalom (H1, szolgáltatások,
 * GYIK, ajánlások) számukra nem létezik. Ez a script lefuttatja a
 * `build/`-ből kiszolgált oldalakat egy valós böngészőben, majd a TELJESEN
 * renderelt DOM-ot visszaírja a megfelelő `build/**.html` fájlba — a
 * <script> tagek (és így a kliensoldali interaktivitás) megmaradnak, csak a
 * kezdeti, crawler által is látható tartalom bővül ki.
 *
 * FONTOS — LAPOS FÁJLNÉV, NEM ALKÖNYVTÁR (élőben kiderült, 2026-07-17):
 * a nem-gyökér route-ok kimenete `build/<route>.html` (pl.
 * `build/belfoldi-fuvarozas-arajanlat.html`), NEM `build/<route>/index.html`.
 * Korábban alkönyvtárba írt a script — ez élesben azt eredményezte, hogy
 * Apache mod_dir-je minden ilyen URL-t 301-gyel átirányított a per-jeles
 * verzióra (mert a route valódi könyvtárrá vált a lemezen), mert a hoszt
 * `AllowOverride`-ja nem engedte felülírni sem a `DirectorySlash Off`-fal,
 * sem egy `.htaccess`-beli `RewriteRule`-lal (a `.htaccess`-szintű
 * RewriteRule ebben a konfigurációban később fut le, mint mod_dir saját
 * átirányítás-logikája — élő Apache-példányon leellenőrizve, nem csak
 * feltételezve). Lapos `.html` fájllal a route sosem lesz valódi könyvtár,
 * így mod_dir-nek nincs mit átirányítania — ez a `.htaccess` megfelelő
 * `RewriteRule`-jával együtt működik, ld. ott.
 *
 * FAIL-SAFE TERVEZÉS — EZ SZÁNDÉKOS: mivel ez postbuild hookként fut, egy
 * ismeretlen build-környezetben (pl. a genezio szerverén) elképzelhető, hogy
 * a headless Chromiumnak nincs meg minden rendszerkönyvtára. Ezért ez a
 * script SOHA nem lép ki nem-nulla kóddal — minden hibaesetben (hiányzó
 * csomag, böngésző-indítási hiba, renderelési hiba egy adott route-on)
 * figyelmeztetést ír ki és 0-val lép ki, hogy az `npm run build` (és vele
 * együtt a teljes deploy) sose bukjon el emiatt. A legrosszabb eset ilyenkor
 * az, hogy a build a szokásos, előrenderelés NÉLKÜLI (üres `<div id="root">`)
 * állapotban marad — ami pontosan az az állapot, amiben a script bevezetése
 * előtt mindig is volt, tehát nem regresszió, csak elmaradt javítás.
 *
 * KÉZI FUTTATÁS (pl. helyi ellenőrzéshez): `npm run prerender` a `build/`
 * mappa elkészülte után. Ellenőrzés: `grep -o "Szállítás, amire" build/index.html`.
 */

const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");

const BUILD_DIR = path.join(__dirname, "..", "build");
const PORT = 47821;
const SITE_URL = "https://szikora-transz.hu";
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

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp",
  ".woff2": "font/woff2",
};

// Minimális statikus fájlszerver — nincs hozzá külön csomag, csak a
// beépített `http`/`fs` modulok. Feloldási sorrend ugyanaz, mint a
// .htaccess-ben: pontos fájl → "<útvonal>.html" → SPA-alap index.html.
function createStaticServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let filePath = path.join(BUILD_DIR, urlPath);
    if (!filePath.startsWith(BUILD_DIR)) filePath = BUILD_DIR;

    const isUsableFile = (p) => fs.existsSync(p) && !fs.statSync(p).isDirectory();
    if (!isUsableFile(filePath)) {
      if (isUsableFile(`${filePath}.html`)) {
        filePath = `${filePath}.html`;
      } else {
        filePath = path.join(BUILD_DIR, "index.html");
      }
    }
    const ext = path.extname(filePath);
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
}

// Sose dobjon — minden hívási hely ezen át jelez hibát, hogy a script
// garantáltan 0-val lépjen ki minden ágon (ld. fail-safe megjegyzés fent).
function warnAndExit(message) {
  console.warn(`[prerender] ${message} — az előrenderelés kimarad ennél a buildnél, a build/ a szokásos (nem előrenderelt) állapotban marad.`);
  process.exit(0);
}

async function main() {
  if (!fs.existsSync(BUILD_DIR)) {
    return warnAndExit("Nincs build/ mappa (előbb fusson az `npm run build`)");
  }

  let chromium;
  try {
    ({ chromium } = require("playwright-chromium"));
  } catch (e) {
    try {
      ({ chromium } = require("playwright"));
    } catch (e2) {
      return warnAndExit("Nincs telepítve a playwright-chromium (vagy playwright) csomag");
    }
  }

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Statikus szerver fut: http://localhost:${PORT}`);

  let browser;
  try {
    browser = await chromium.launch();
  } catch (launchErr) {
    server.close();
    return warnAndExit(`Nem sikerült elindítani a headless Chromiumot (${launchErr.message})`);
  }

  let renderedCount = 0;
  try {
    for (const route of ROUTES_TO_PRERENDER) {
      try {
        const page = await browser.newPage();
        const url = `http://localhost:${PORT}${route}`;
        console.log(`Renderelés: ${url}`);
        // "networkidle", NEM "load" — 2026-08-17 óta a Cloudflare Turnstile
        // widget (ld. src/components/UI/Turnstile.js, a Kapcsolat-szekciós
        // formokon) folyamatos háttér-hálózati aktivitást végez, ami miatt a
        // "networkidle" állapot SOSEM állt be — minden Turnstile-t tartalmazó
        // route (gyakorlatilag mind, az /adatvedelem kivételével) garantáltan
        // a teljes 30s timeoutot elfogyasztotta, ellehetetlenítve a teljes
        // előrenderelést. A React app tartalma (cím, szolgáltatások, GYIK,
        // referenciák) statikus adatból szinkron renderelődik, nem függ
        // semmilyen aszinkron fetch lezárulásától, ezért a "load" esemény
        // (a fő JS bundle lefutása után tüzel, ld. CRA `defer` scriptje)
        // elég a teljes tartalom megjelenéséhez.
        await page.goto(url, { waitUntil: "load" });
        // A React app-nak idő kell, amíg a Reveal-animációk elindulnak és a
        // DOM végleges állapotba kerül.
        await page.waitForTimeout(1000);

        const html = await page.content();
        const outFile = routeToOutputFile(route);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, "<!doctype html>" + html);
        console.log(`Kiírva: ${path.relative(BUILD_DIR, outFile)} (${html.length} byte)`);
        renderedCount++;
        await page.close();
      } catch (routeErr) {
        // Egy route hibája ne akassza meg a többit — az adott route egyszerűen
        // a build (nem előrenderelt) alap-index.html-jét szolgálja ki tovább.
        console.warn(`[prerender] "${route}" renderelése sikertelen (${routeErr.message}), kihagyva.`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (renderedCount === 0) {
    return warnAndExit("Egyetlen route előrenderelése sem sikerült");
  }

  console.log(`\nKész. ${renderedCount}/${ROUTES_TO_PRERENDER.length} route mostantól a teljes renderelt tartalmat tartalmazza.`);

  await submitToIndexNow();
}

// IndexNow — értesíti a Bing/Yandex-t (és a protokollt támogató egyéb
// keresőket), hogy ezek az URL-ek frissültek, gyorsabb újra-crawlolást
// kérve, mint a passzív sitemap-alapú felfedezés. Ugyanaz a fail-safe elv,
// mint a script többi részén: egy hálózati hiba/időtúllépés itt SOSEM
// buktathatja el a buildet, csak figyelmeztetést ír ki. Minden `npm run
// build` (helyi teszt vagy éles deploy) lefuttatja ezt — az IndexNow
// protokoll idempotens, egy ismételt bejelentés a már ismert URL-ekről nem
// árt, csak feleslegesen redundáns helyi tesztelésnél.
function submitToIndexNow() {
  return new Promise((resolve) => {
    const urlList = ROUTES_TO_PRERENDER.map((route) => `${SITE_URL}${route}`);
    const payload = JSON.stringify({
      host: "szikora-transz.hu",
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList,
    });

    const req = https.request(
      "https://api.indexnow.org/indexnow",
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) },
        timeout: 8000,
      },
      (res) => {
        console.log(`[prerender] IndexNow bejelentés elküldve, válasz: HTTP ${res.statusCode}`);
        res.resume();
        resolve();
      },
    );
    req.on("timeout", () => {
      console.warn("[prerender] IndexNow bejelentés időtúllépés — kihagyva, a build ettől nem bukik el.");
      req.destroy();
      resolve();
    });
    req.on("error", (err) => {
      console.warn(`[prerender] IndexNow bejelentés sikertelen (${err.message}) — kihagyva, a build ettől nem bukik el.`);
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

main().catch((err) => {
  warnAndExit(`Váratlan hiba: ${err.message}`);
});
