# Élesítési teendők – 2026-09-24-i javítások

Ág: `claude-egyedi-fejlesztései`, a `2871ebb` utáni 8 commit.

## 0. Előtte

- [ ] Készíts kézi adatbázis-mentést az éles DB-ről, mielőtt bármit futtatsz:
      `mysqldump --single-transaction --no-tablespaces kamion | gzip > kamion_elesites_elott.sql.gz`

## 1. SQL – root MySQL-felhasználóval, a backend feltöltése ELŐTT

- [ ] `backend/sql/46.sql` futtatása: `mysql -u root kamion < 46.sql`
  - új tábla: `sofor_lejarat_ertesites_log` (a sofőr lejárat-pushok kétszeri küldésének kizárására)
  - új oszlop: `fajlok.karbantartas_jarmu_tipus`, és a meglévő karbantartás-mellékletek besorolása
  - **Miért kell előbb:** az új `filesInterface.php` minden fájlfeltöltésnél ebbe az oszlopba ír. Ha a kód előbb kerül fel, minden fájlfeltöltés hibára fut.
- [ ] Ellenőrzés: `SHOW COLUMNS FROM fajlok LIKE 'karbantartas_jarmu_tipus';` és `SHOW TABLES LIKE 'sofor_lejarat_ertesites_log';`

## 2. Backend fájlok felmásolása (`backend/` alá, azonos útvonalra)

- [ ] `backend/ApiHandler.php`
- [ ] `backend/db.php`
- [ ] `backend/interface/bejelentesekInterface.php`
- [ ] `backend/interface/filesInterface.php`
- [ ] `backend/interface/fuvarInterface.php`
- [ ] `backend/interface/karbantartasokInterface.php`
- [ ] `backend/interface/koltsegInterface.php`
- [ ] `backend/cron/lejarat_emlekezteto.php`
- [ ] `backend/cron/db_mentes.php` (új fájl)

A `backend/sql/46.sql`-t nem kell a szerverre másolni, csak lefuttatni (1. pont).

## 3. Frontend

- [ ] `npm run build` (a prerender is lefut vele)
- [ ] A `build/` tartalmának feltöltése a szokásos módon

## 4. Beállítások – `backend/.env` a szerveren

- [ ] `DB_BACKUP_DIR=/valami/webrooton/kivuli/konyvtar`
  - **Kötelező**, és NEM lehet a webroot/projekt alatt, különben a script megtagadja a futást.
  - A könyvtár létrejön, ha nincs, de a PHP-t futtató felhasználónak írási joga kell legyen a szülőkönyvtárra.
- [ ] (opcionális) `DB_BACKUP_KEEP_DAYS=14`: hány napig maradjanak meg a mentések

## 5. Crontab – az útvonalakat és a PHP-binárist igazítsd a szerverhez

- [ ] Napi DB-mentés (új):
      `30 2 * * *  /usr/bin/php8.2 /UTVONAL/backend/cron/db_mentes.php >> /UTVONAL_WEBROOTON_KIVUL/db_mentes.log 2>&1`
- [ ] Lejárat-emlékeztető. Ha már bent van, nincs vele teendő; ha nincs, vedd fel:
      `0 7 * * *  /usr/bin/php8.2 /UTVONAL/backend/cron/lejarat_emlekezteto.php >> /UTVONAL/backend/cron/lejarat_emlekezteto.log 2>&1`
  - Mostantól az admin e-mail mellé push-értesítés is megy, és a sofőrök is kapnak push-értesítést a saját okmányaikról 30, 7 és 1 nappal a lejárat előtt, valamint a lejárat napján.
- [ ] Egyszer futtasd le kézzel a mentést, és nézd meg, létrejött-e a `.sql.gz` fájl:
      `php8.2 /UTVONAL/backend/cron/db_mentes.php`

## 6. Élesítés utáni gyors ellenőrzés

- [ ] Admin: Fájlok oldal betölt, fájl letöltés/feltöltés működik
- [ ] Karbantartások: a fájlszám-jelvény látszik, a szerkesztő ablakban megjelennek a mellékletek, a feltöltés működik
- [ ] Sofőr: a Helyszín-fotók és a saját fuvar fotói letölthetők/feltölthetők; a bejelentés fotó-feltöltése működik
- [ ] Dashboard: a „Nettó eredmény (e havi)” egyezik a Pénzforgalom „Ez a hónap” nettójával
- [ ] Naptárban minden sofőr okmány-lejárata megjelenik
- [ ] Push: egy teszt-sofőrnek válaszolj egy bejelentésére, és nézd meg, megérkezik-e az értesítés
- [ ] Dark mode: néhány oldalon nézd végig az olvashatóságot

## Később

- [ ] Üzemanyag-anomália elemzés visszakapcsolása: most kimarad, akkor térünk vissza rá, ha minden más kész
