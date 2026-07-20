<?php

// R45 (fejlesztési audit, 2026-07-19): a titkok (DB-jelszó, authHash,
// navEncryptionKey) korábban kizárólag hardcoded értékként éltek a
// `db.php`/`config.php` fájlokban, git-be commitolva. Ez a betöltő egy,
// a repóból kizárt (.gitignore-olt) `.env` fájlt olvas be, ha létezik, és
// a benne szereplő kulcsokat `putenv()`-vel elérhetővé teszi — nincs hozzá
// composer-függőség (vlucas/phpdotenv), mert a projektnek nincs
// composer.json-ja, és ez a formátum ehhez elég egyszerű.
//
// FONTOS: ez önmagában NEM rotálja a jelenleg élő, korábban commitolt
// titkokat (DB-jelszó, authHash, navEncryptionKey) — a `db.php`/`config.php`
// a hiányzó env-változóknál a régi, ismert értékre esik vissza, hogy a
// helyi fejlesztői környezet és az éles rendszer `.env` nélkül is tovább
// működjön. A tényleges biztonsági nyereség csak akkor jelentkezik, ha
// (1) éles környezetben létrejön egy valódi `.env` ÚJ, rotált értékekkel,
// és (2) a régi, git-historyban élő értékek valóban rotálva lettek — ez
// utóbbi szándékosan nem történt meg automatikusan ebben a változtatásban,
// mert egy éles DB-jelszó/authHash rotálása egyeztetést igényel (minden,
// ezt használó kliens/kapcsolat egyszerre kell frissüljön).
function loadEnvFile($path) {
    if (!is_readable($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (strlen($value) >= 2 && $value[0] === '"' && substr($value, -1) === '"') {
            $value = substr($value, 1, -1);
        }
        if ($key !== '' && getenv($key) === false) {
            putenv("$key=$value");
        }
    }
}

loadEnvFile(__DIR__ . '/.env');

// A `getenv()` csak akkor ad vissza értéket, ha az env-változó tényleg be
// van állítva (akár a `.env`-ből, akár a szerver saját környezetéből) —
// egyébként a hívó oldalon megadott `$fallback`-ra esik vissza.
function envOrDefault($key, $fallback) {
    $ertek = getenv($key);
    return $ertek === false ? $fallback : $ertek;
}
