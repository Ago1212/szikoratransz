<?php

require_once __DIR__ . '/env.php';

// R45 (fejlesztési audit, 2026-07-19): env-változóból (API_AUTH_HASH /
// NAV_ENCRYPTION_KEY), ha van `.env`/szerver-env, egyébként a korábbi,
// ismert értékre esik vissza — ld. env.php fejléc-komment, ez nem rotálja
// a régi, git-historyban élő titkokat, csak a jövőbeli felülírást teszi
// lehetővé.
$apiConfig = [
    "authHash"=> envOrDefault('API_AUTH_HASH', "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD"),
    "geminiApiKey" => envOrDefault('GEMINI_API_KEY', null),
    // Több, KÜLÖN Google Cloud projektben generált kulcs vesszővel
    // elválasztva (`GEMINI_API_KEYS`) — a Gemini ingyenes napi kvótája
    // projektenkénti, nem kulcsonkénti, ezért csak külön projektben
    // generált kulcsok adnak ténylegesen független kvótát (ld.
    // GeminiOcrClient.php fejléc-komment). Ha `GEMINI_API_KEYS` nincs
    // beállítva, visszaesik az egyetlen `GEMINI_API_KEY`-re.
    "geminiApiKeys" => array_values(array_filter(array_map('trim', explode(
        ',',
        envOrDefault('GEMINI_API_KEYS', envOrDefault('GEMINI_API_KEY', ''))
    )))),
    // Külső rendszerek (NAV Online Számla, GPSmart flottakövetés) valódi
    // jelszavát/kulcsait ez titkosítja (openssl_encrypt, AES-256-CBC) —
    // ezek valódi külső fiókokhoz adnak hozzáférést, ezért nem nyílt
    // szövegként tároljuk, mint az `authHash`-t. A név `navEncryptionKey`
    // maradt (elsőként a NAV-integrációhoz készült), de általános,
    // bármelyik ilyen jellegű titok titkosításához újrahasználható kulcs.
    "navEncryptionKey" => envOrDefault('NAV_ENCRYPTION_KEY', "1d940146999f49d45a27f547a3ef0c00cb620d8e618a3838870434ef6602a9f7"),
    // R11 (fejlesztési audit, 2026-07-19): Web Push (VAPID) kulcspár — a
    // publikus kulcs a frontend `applicationServerKey`-jeként megy ki
    // (nem titok, bármely feliratkozó böngésző megkapja), a privát kulcs
    // viszont a szerveren marad, ezzel írja alá a WebPushSender minden
    // egyes push-küldést. `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY_PEM`
    // env-változóval felülírható (ld. env.php), a `\n` az env-értékben
    // szó szerinti escape-ként érkezik, ezért visszaalakítjuk valódi
    // sortörésre.
    "vapidPublicKey" => envOrDefault('VAPID_PUBLIC_KEY', 'BLxK4NgcXrsGf-fQ8oTFpHwky02KfZNu7wULx4VYeqwwkzdhu1pD8bxYyP7OFIXg9KdMIqlhULutonS1V2qUgs4'),
    "vapidPrivateKeyPem" => str_replace('\n', "\n", envOrDefault('VAPID_PRIVATE_KEY_PEM', "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgDjyKDGHpQmF42BYi\nnRzd51XKDnjX+/JbPl8beSWiVdWhRANCAAS8SuDYHF67Bn/n0PKExaR8JMtNin2T\nbu8FC8eFWHqsMJM3YbtaQ/G8WMj+zhSF4PSnTCKpYVC7raJ0tVdqlILO\n-----END PRIVATE KEY-----\n")),
    "vapidSubject" => envOrDefault('VAPID_SUBJECT', 'mailto:sziago12@gmail.com'),
];