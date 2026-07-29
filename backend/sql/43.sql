-- A `audit_log.kerelmezo_id` névre fordítása eddig kizárólag az `admin`
-- táblát nézte (ld. ApiHandler::modositokNeveiCeghez()) — egy sofőr által
-- végzett, naplózott művelet (pl. `newBejelentes` sofőr-ágán) neve emiatt
-- sosem jelent meg a Naplo.js oldalon. A `kerelmezo_nev` egy denormalizált
-- snapshot (ugyanaz a minta, mint a `fajlok.feltolto_nev`), amit
-- `ApiHandler::logAudit()` mostantól a hívó tényleges munkamenetéből
-- (admin VAGY sofőr) tölt ki, ezért admin- és sofőr-akciónál is működik.
-- Régi (e migráció előtti) sorokon NULL marad — a backend ilyenkor a régi,
-- csak-admin-tábla lookup-ra esik vissza.
ALTER TABLE audit_log ADD COLUMN kerelmezo_nev VARCHAR(191) NULL AFTER kerelmezo_id;
