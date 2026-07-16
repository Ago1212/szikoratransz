/**
 * Statikus előrenderelés a `build/` mappában — CSAK KÉZI, OPT-IN LÉPÉS.
 *
 * MIÉRT KELL EZ: az app 100%-ban kliensoldalon (React) renderelődik, ezért
 * a `build/index.html` nyers tartalma szó szerint üres (`<div id="root">`).
 * A legtöbb AI-crawler (GPTBot, ClaudeBot, PerplexityBot) NEM futtat
 * JavaScriptet, ezért ezek a rendszerek jelenleg csak a <title>-t és a meta
 * description-t látják az oldalból — a teljes tartalom (H1, szolgáltatások,
 * GYIK, ajánlások) számukra nem létezik. Ez a script lefuttatja a
 * `build/`-ből kiszolgált főoldalt egy valós böngészőben, majd a TELJESEN
 * renderelt DOM-ot visszaírja a `build/index.html`-be — a <script> tagek
 * (és így a kliensoldali interaktivitás) megmaradnak, csak a kezdeti,
 * crawler által is látható tartalom bővül ki.
 *
 * SZÁNDÉKOSAN NINCS bekötve a `npm run build`-be (nincs "postbuild" hook)
 * és a Playwright NINCS hozzáadva a package.json devDependencies-hez —
 * ezért egy sima `npm install` (amit a genezio.yaml a deploy során lefuttat)
 * ezt a lépést sose próbálja meg automatikusan végrehajtani. Egy fejlécnélküli
 * böngésző indítása build-time-ban kockázatos lépés egy ismeretlen
 * build-környezetben (hiányzó rendszerkönyvtárak esetén elbukhat, és akkor
 * az EGÉSZ deploy meghiúsulna) — ezért ez tudatosan egy külön, kézzel
 * futtatható lépés maradt, amíg ki nem derül, hogy a tényleges
 * build-szerveren megbízhatóan lefut.
 *
 * HASZNÁLAT:
 *   1) npm run build
 *   2) npm install --no-save playwright-chromium   (csak egyszer, helyben)
 *   3) node scripts/prerender.js
 *   4) Ellenőrizd: build/index.html már tartalmazza a tényleges szöveget
 *      (pl. grep -o "Szállítás, amire" build/index.html)
 *   5) Deployold a build/ mappát a szokásos módon.
 */

const path = require("path");
const fs = require("fs");
const http = require("http");

const BUILD_DIR = path.join(__dirname, "..", "build");
const PORT = 47821;
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

const MIME = {
  ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp",
  ".woff2": "font/woff2",
};

// Minimális statikus fájlszerver — nincs hozzá külön csomag, csak a
// beépített `http`/`fs` modulok. Ismeretlen útvonalra az index.html-t adja
// vissza (ugyanaz a viselkedés, mint a .htaccess catch-all rewrite-ja).
function createStaticServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    let filePath = path.join(BUILD_DIR, urlPath);
    if (!filePath.startsWith(BUILD_DIR)) filePath = BUILD_DIR;
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(BUILD_DIR, "index.html");
    }
    const ext = path.extname(filePath);
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  });
}

async function main() {
  if (!fs.existsSync(BUILD_DIR)) {
    console.error("Nincs build/ mappa — előbb futtasd: npm run build");
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = require("playwright-chromium"));
  } catch (e) {
    try {
      ({ chromium } = require("playwright"));
    } catch (e2) {
      console.error(
        "Nincs telepítve a playwright-chromium (vagy playwright) csomag.\n" +
          "Futtasd egyszer, helyben: npm install --no-save playwright-chromium",
      );
      process.exit(1);
    }
  }

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Statikus szerver fut: http://localhost:${PORT}`);

  const browser = await chromium.launch();
  try {
    for (const route of ROUTES_TO_PRERENDER) {
      const page = await browser.newPage();
      const url = `http://localhost:${PORT}${route}`;
      console.log(`Renderelés: ${url}`);
      await page.goto(url, { waitUntil: "networkidle" });
      // A React app-nak idő kell, amíg a Reveal-animációk elindulnak és a
      // DOM végleges állapotba kerül.
      await page.waitForTimeout(1000);

      const html = await page.content();
      const outFile =
        route === "/"
          ? path.join(BUILD_DIR, "index.html")
          : path.join(BUILD_DIR, route.replace(/^\//, ""), "index.html");
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, "<!doctype html>" + html);
      console.log(`Kiírva: ${path.relative(BUILD_DIR, outFile)} (${html.length} byte)`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log("\nKész. A build/index.html mostantól a teljes renderelt tartalmat tartalmazza.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
