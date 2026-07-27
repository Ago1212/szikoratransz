<?php

// Háttérben, a HTTP-kérés lezárása UTÁN, egy külön, `exec("nohup ... &")`-
// pal indított processzben fut — ld.
// docs/superpowers/specs/2026-07-27-fuvar-ocr-aszinkron-design.md.
// NEM `backend/cron/`-ba tartozik: nem crontabból, időszakosan hívott job,
// hanem eseményvezérelt — minden feltöltés/"Újrapróbálás" a saját, önálló
// futtatását indítja (ApiHandler::inditsBackgroundOcr()). Ugyanaz a
// `PHP_SAPI !== 'cli'` védelem vonatkozik rá, mint a cron/ scriptekre — a
// `backend/` a webroot alatt van, HTTP-n közvetlenül nem hívható.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Forbidden');
}

require __DIR__ . '/../db.php';
require __DIR__ . '/../config.php';
require __DIR__ . '/../interface/beerkezettDokumentumInterface.php';

$dokumentumId = (int) ($argv[1] ?? 0);
if ($dokumentumId <= 0) {
    fwrite(STDERR, "Hiányzó vagy érvénytelen dokumentum id.\n");
    exit(1);
}

$beerkezettDokumentumInterface->dolgozzFel($dokumentumId);
