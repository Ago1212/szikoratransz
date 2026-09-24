const { spawn, spawnSync } = require("child_process");
const net = require("net");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8000);

function phpBinaris() {
  const jeloltek = [process.env.PHP_BIN, "php8.2", "php"].filter(Boolean);
  return jeloltek.find((bin) => spawnSync(bin, ["-v"], { stdio: "ignore" }).status === 0);
}

function portSzabad(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => tester.close(() => resolve(true)))
      .listen(port, "localhost");
  });
}

function elotaggal(stream, elotag) {
  let maradek = "";
  stream.on("data", (chunk) => {
    const sorok = (maradek + chunk.toString()).split("\n");
    maradek = sorok.pop();
    sorok.filter(Boolean).forEach((sor) => process.stdout.write(`${elotag} ${sor}\n`));
  });
}

const gyerekek = [];

function mindentLeallit(kod = 0) {
  gyerekek.forEach((g) => {
    if (g.exitCode === null) g.kill("SIGTERM");
  });
  process.exit(kod);
}

process.on("SIGINT", () => mindentLeallit(0));
process.on("SIGTERM", () => mindentLeallit(0));
process.on("SIGHUP", () => mindentLeallit(0));

(async () => {
  const php = phpBinaris();
  if (!php) {
    console.warn("[backend] Nem található PHP (php8.2/php, vagy PHP_BIN) — csak a frontend indul.");
  } else if (!(await portSzabad(BACKEND_PORT))) {
    console.warn(`[backend] A ${BACKEND_PORT}-es port foglalt — feltehetően már fut egy backend, nem indítok újat.`);
  } else {
    const backend = spawn(php, ["-S", `localhost:${BACKEND_PORT}`], { cwd: path.join(ROOT, "backend") });
    elotaggal(backend.stdout, "[backend]");
    elotaggal(backend.stderr, "[backend]");
    backend.on("exit", (kod) => {
      if (kod !== null && kod !== 0) console.warn(`[backend] A PHP szerver leállt (kód: ${kod}).`);
    });
    gyerekek.push(backend);
    console.log(`[backend] PHP szerver: http://localhost:${BACKEND_PORT} (${php})`);
  }

  const frontend = spawn(process.execPath, [require.resolve("react-scripts/scripts/start.js")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  gyerekek.push(frontend);
  frontend.on("exit", (kod) => mindentLeallit(kod ?? 0));
})();
