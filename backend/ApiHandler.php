<?php
require 'db.php';
require 'PaginationHelper.php';
require 'interface/kamionInterface.php';
require 'interface/potkocsiInterface.php';
require 'interface/furgonInterface.php';
require 'interface/soforokInterface.php';
require 'interface/filesInterface.php';
require 'interface/emailInterface.php';
require 'interface/bejelentesekInterface.php';
require 'interface/karbantartasokInterface.php';
require 'interface/szabadsagInterface.php';
require 'interface/tankolasInterface.php';
require 'interface/jarmuValtasInterface.php';
require 'interface/ugyfelInterface.php';
require 'interface/csapatInterface.php';
require 'interface/helyszinInterface.php';
require 'interface/jogosultsagInterface.php';
require 'interface/szerepkorInterface.php';
require 'interface/listaInterface.php';
require 'interface/keresesInterface.php';
require 'interface/koltsegInterface.php';
require 'interface/ertesitesInterface.php';
require 'interface/navSzamlaInterface.php';
require 'interface/gpsmartInterface.php';
require 'interface/piaciArakInterface.php';
require 'interface/pushInterface.php';
require 'interface/bankImportInterface.php';
require 'interface/molTankolasInterface.php';
require 'interface/tachografInterface.php';
require 'interface/tachografVuInterface.php';
require 'interface/fuvarInterface.php';
require_once 'WebAuthnHelper.php';
class ApiHandler {
    protected string $auth_hash;
    protected array $actions = [];
    protected $db;

    // A resolveKerelmezo()/requireValidSession() által feloldott, aktuális
    // munkamenet gyorsítótárazva — egy kérésen belül legfeljebb egyszer
    // kérdezzük le a `sessions` táblát, még ha több ellenőrzés is lefut
    // (validation() + resolveKerelmezo()).
    private ?array $session = null;

    // A ténylegesen belépett admin-táblás felhasználó id-je (`kerelmezo_id`)
    // — `process()` elején egyszer eltéve, hogy a `logAudit()`-nak ne
    // kelljen minden (~35) hívási helyen külön átadni. A meglévő
    // `admin`/`ceg_id` paraméter, amit a hívások eddig is átadtak, a CÉGET
    // azonosítja (több csapattag is ugyanazt kapja) — ez itt viszont a
    // konkrét személyt.
    private $aktivKerelmezoId = null;

    // A fenti `aktivKerelmezoId` csak admin-táblás bejelentkezésnél ad
    // vissza névre fordítható azonosítót (ld. `modositokNeveiCeghez()`) —
    // sofőr-munkamenetből naplózott műveletnél (jelenleg: `newBejelentes`
    // sofőr-ága) a `user.id` névre fordítása külön admin-tábla-lookuppal
    // sosem sikerülne, ráadásul a két tábla auto-increment id-jai
    // ütközhetnek is. Ezért a nevet (nem az id-t) snapshot-oljuk ide,
    // `process()` elején, session-ből feloldva — ugyanaz a minta, mint a
    // `fajlok.feltolto_nev`-nél (ld. `resolveFeltolto()`).
    private $aktivKerelmezoNev = null;

    // Ezek az akciók bejelentkezés (érvényes sessionToken) nélkül is
    // meghívhatók — a bejelentkezés maga, a jelszó-visszaállítás folyamata
    // (a felhasználó pont azért van itt, mert nincs érvényes munkamenete),
    // a nyilvános ajánlatkérő/jelentkező űrlapok, és a kijelentkezés (ami
    // egy már lejárt/érvénytelen tokennel is sikeresnek kell tűnjön a
    // kliens felől, ld. logoutUser() komment).
    // `getWebauthnBejelentkezesKihivas`/`verifyWebauthnBejelentkezes` a
    // sofőr WebAuthn gyors-bejelentkezésének a jelszavas `loginUser`-rel
    // egyenértékű, EGYETLEN belépési útja — ezeknél a sofőr definíció
    // szerint még nincs bejelentkezve, tehát nem várható tőle érvényes
    // session-token (ld. R52 komment lentebb).
    const PUBLIC_ACTIONS = ['loginUser', 'logoutUser', 'requestPasswordReset', 'resetPassword', 'sendAjanlatkeres', 'sendJelentkezes', 'getWebauthnBejelentkezesKihivas', 'verifyWebauthnBejelentkezes'];

    // Azok az akciók, amik csapattagok jogosultságát/tagságát módosítják —
    // a legvilágosabb privilégium-eszkalációs kockázat, ha bárki (nem csak
    // adminisztrátor szerepkörű csapattag) meghívhatná őket. Korábban a
    // `szerepkor` mező szándékosan tisztán tájékoztató jellegű volt (ld.
    // CsapatInterface komment) — ez a lista + a validation()-ban lévő
    // ellenőrzés az első lépés afelé, hogy tényleg kényszerítve legyen.
    // A jogosultsag-mátrix megtekintése/mentése is ide tartozik: ezt is
    // csak adminisztrátor szerepkörű csapattag konfigurálhatja.
    // `getSzerepkorok` szándékosan NINCS itt — a szerepkörök neveinek
    // listázása bárkinek szükséges lehet (pl. a Felhasznalok.js lista minden
    // sornál megjeleníti a szerepkör-címkét), ez önmagában nem érzékeny
    // művelet. A tényleges létrehozás/törlés viszont admin-only.
    // `getListaElemek` szándékosan NINCS itt — a sofőr (user tábla) is
    // lekéri (pl. bejelentés típusának legördülőjéhez), csak a szerkesztés/
    // létrehozás/törlés admin-only.
    // `getAjanlatkeresek`/`updateAjanlatkeresStatusz` a biztonsági audit során
    // került ide: az `ajanlatkeresek` tábla a SAJÁT (üzemeltetői) marketing-
    // leadeket tartalmazza (a nyilvános Landing oldal ajánlatkérő/jelentkező
    // űrlapjaiból), nem egy adott bérlő-cég adata — korábban semmilyen
    // jogosultsági kapu nem volt rajta, tehát BÁRMELY cég BÁRMELY (akár
    // sofőr-) munkamenete elérhette/módosíthatta volna más cégek helyett
    // ezt az üzemeltetői adatot.
    const ADMIN_ONLY_ACTIONS = ['newCsapattag', 'updateCsapattagSzerepkor', 'updateCsapattagBer', 'deleteCsapattag', 'getJogosultsagok', 'saveJogosultsagok', 'newSzerepkor', 'deleteSzerepkor', 'newListaElem', 'updateListaElemNev', 'getListaElemHasznalat', 'deleteListaElem', 'getAjanlatkeresek', 'updateAjanlatkeresStatusz'];

    // Akció → [modul, jogtípus] térkép a konfigurálható modul-jogosultságokhoz
    // (ld. JogosultsagInterface::MODULOK). Csak a moduloknak megfelelő
    // "önálló lista/CRUD" akciók szerepelnek itt — a kereszt-moduluk közötti
    // lookup/választó akciók (pl. getKamionRendszamok, amit a Bejelentés
    // form kamion-legördülője is használ) szándékosan NINCSENEK gate-elve,
    // mert azok más modulok saját funkciójának részei, nem a "Kamionok"
    // oldal megtekintése. Hasonlóan az Események modul sincs itt: a
    // getEsemenyek ugyanaz az akció, amit a Dashboard mindenki számára
    // elérhető naptár-widgetje is használ, ezt gate-elni a Dashboardot
    // törné el egy korlátozott fuvarszervezőnek.
    // FONTOS: `getKamionok`/`getPotkocsik` (a sofőr is lekéri jármű-váltáshoz
    // és a Dashboardhoz), `newBejelentes` (a sofőr saját maga is küld
    // bejelentést) és `saveSoforData` (a sofőr a saját "Profil" oldalán
    // ugyanezt az akciót hívja) SZÁNDÉKOSAN NINCSENEK ebben a térképben —
    // ezek az akciók a sofőr (user tábla, nem admin tábla) oldaláról is
    // hívódnak, egy `kerelmezo_id`-t megkövetelő admin-szerepkör-ellenőrzés
    // itt eltörné a sofőr-alkalmazást. A Helyszínek és a generikus Fájlok
    // modul (fajlok tábla, `getFiles`/`fileUpload`/`deleteFile`) ugyanezért
    // egyáltalán nem szerepel itt — mindkettő a sofőr oldalról is aktívan
    // használt/szerkeszthető, a jelenlegi, csak admin-táblás szerepkör-
    // ellenőrzés nélkülük biztonságosan nem vezethető be. A Jogosultsagok
    // felületen ennek ellenére megjelennek (admin számára látható/
    // beállítható a jövőbeli bővítéshez), de a szerver ma nem kényszeríti ki
    // őket — ld. a felhasználónak adott végső összefoglalót.
    const MODULE_PERMISSION_MAP = [
        'newKamion' => ['kamionok', 'szerkesztes'],
        'saveKamionData' => ['kamionok', 'szerkesztes'],
        'deleteKamion' => ['kamionok', 'torles'],

        'newPotkocsi' => ['potkocsik', 'szerkesztes'],
        'savePotkocsiData' => ['potkocsik', 'szerkesztes'],
        'deletePotkocsi' => ['potkocsik', 'torles'],

        'newFurgon' => ['furgonok', 'szerkesztes'],
        'saveFurgonData' => ['furgonok', 'szerkesztes'],
        'deleteFurgon' => ['furgonok', 'torles'],

        'newFuvar' => ['fuvarok', 'szerkesztes'],
        'updateFuvar' => ['fuvarok', 'szerkesztes'],
        'deleteFuvar' => ['fuvarok', 'torles'],
        'getFuvarok' => ['fuvarok', 'hozzaferes'],
        'getFuvar' => ['fuvarok', 'hozzaferes'],
        'getUgyfelFuvarElozmeny' => ['fuvarok', 'hozzaferes'],
        'getFuvarUtvonalElozmenyek' => ['fuvarok', 'hozzaferes'],
        'getFuvarStatisztikak' => ['fuvarok', 'hozzaferes'],
        'getFuvarFigyelmeztetesek' => ['fuvarok', 'hozzaferes'],
        'updateFuvarAllapot' => ['fuvarok', 'szerkesztes'],
        'hozzarendelFuvarSzamlaszamot' => ['fuvarok', 'szerkesztes'],
        'getFuvarAllapotOsszesito' => ['fuvarok', 'hozzaferes'],
        'getSoforDashboard' => ['fuvarok', 'hozzaferes'],

        'getKarbantartasok' => ['karbantartasok', 'hozzaferes'],
        'updateKarbantartas' => ['karbantartasok', 'szerkesztes'],
        'deleteKarbantartas' => ['karbantartasok', 'torles'],
        'updatePotkocsiKarbantartas' => ['karbantartasok', 'szerkesztes'],
        'deletePotkocsiKarbantartas' => ['karbantartasok', 'torles'],
        // R06 (fejlesztési audit, 2026-07-19): km-alapú esedékesség — ugyanaz
        // az olvasási jog fedi, mint a Karbantartások lista megtekintését.
        'getKmAlapuKarbantartasEsedekesseg' => ['karbantartasok', 'hozzaferes'],

        'getSoforok' => ['soforok', 'hozzaferes'],
        'getSofor' => ['soforok', 'hozzaferes'],
        'newSofor' => ['soforok', 'szerkesztes'],
        'deleteSofor' => ['soforok', 'torles'],
        // R08 (fejlesztési audit, 2026-07-19): sofőrönkénti összesítő riport —
        // ugyanaz az olvasási jog fedi, mint a sofőr-lista megtekintését,
        // nincs saját, önálló jogosultsági tétele.
        'getSoforScorecard' => ['soforok', 'hozzaferes'],

        'getBejelentesek' => ['bejelentesek', 'hozzaferes'],
        'saveBejelentesData' => ['bejelentesek', 'szerkesztes'],
        'deleteBejelentes' => ['bejelentesek', 'torles'],
        'generateKarbantartasFromBejelentes' => ['bejelentesek', 'szerkesztes'],

        'getSzabadsagok' => ['szabadsagok', 'hozzaferes'],
        'newSzabadsag' => ['szabadsagok', 'szerkesztes'],
        'updateSzabadsag' => ['szabadsagok', 'szerkesztes'],
        'deleteSzabadsag' => ['szabadsagok', 'torles'],

        'getUgyfelek' => ['ugyfelek', 'hozzaferes'],
        'getUgyfel' => ['ugyfelek', 'hozzaferes'],
        'newUgyfel' => ['ugyfelek', 'szerkesztes'],
        'saveUgyfelData' => ['ugyfelek', 'szerkesztes'],
        'deleteUgyfel' => ['ugyfelek', 'torles'],

        'getAuditLog' => ['naplo', 'hozzaferes'],

        'getKoltsegOsszesito' => ['koltsegek', 'hozzaferes'],
        'getFogyasztasElemzes' => ['koltsegek', 'hozzaferes'],
        'getVarhatoEredmeny' => ['koltsegek', 'hozzaferes'],
        'getEgyebKoltsegek' => ['koltsegek', 'hozzaferes'],
        'newEgyebKoltseg' => ['koltsegek', 'szerkesztes'],
        'updateEgyebKoltseg' => ['koltsegek', 'szerkesztes'],
        'deleteEgyebKoltseg' => ['koltsegek', 'torles'],

        'getNavSzamlaBeallitasokStatusz' => ['koltsegek', 'hozzaferes'],
        'navSzamlaLekerdezes' => ['koltsegek', 'hozzaferes'],
        'saveNavSzamlaBeallitasok' => ['koltsegek', 'szerkesztes'],
        'elemezBankImportCsv' => ['koltsegek', 'hozzaferes'],
        'alkalmazBankImport' => ['koltsegek', 'szerkesztes'],
        'elemezMolTankolasPdf' => ['koltsegek', 'hozzaferes'],
        'alkalmazMolTankolas' => ['koltsegek', 'szerkesztes'],
        'elemezTachografDdd' => ['tachograf', 'hozzaferes'],
        'alkalmazTachografImport' => ['tachograf', 'szerkesztes'],
        'getTachografNapiAktivitas' => ['tachograf', 'hozzaferes'],
        'getTachografEsemenyek' => ['tachograf', 'hozzaferes'],
        'getTachografMegfeleloseg' => ['tachograf', 'hozzaferes'],
        'getTachografSoforOsszesito' => ['tachograf', 'hozzaferes'],
        'getTachografImportNaplo' => ['tachograf', 'hozzaferes'],
        'atparositTachografNap' => ['tachograf', 'szerkesztes'],
        'elemezTachografVuDdd' => ['tachograf', 'hozzaferes'],
        'alkalmazTachografVuImport' => ['tachograf', 'szerkesztes'],
        'getTachografVuNapiAktivitas' => ['tachograf', 'hozzaferes'],
        'getTachografVuMegfeleloseg' => ['tachograf', 'hozzaferes'],
        'getTachografVuJarmuOsszesito' => ['tachograf', 'hozzaferes'],
        'getTachografVuImportNaplo' => ['tachograf', 'hozzaferes'],
        'getGpsmartBeallitasokStatusz' => ['kamionok', 'hozzaferes'],
        'gpsmartPoziciok' => ['kamionok', 'hozzaferes'],
        'gpsmartMegtettUtMa' => ['kamionok', 'hozzaferes'],
        'gpsmartUtvonal' => ['kamionok', 'hozzaferes'],
        'getKihasznaltsagiRiport' => ['kamionok', 'hozzaferes'],
        'saveGpsmartBeallitasok' => ['kamionok', 'szerkesztes'],
        'importNavSzamlak' => ['koltsegek', 'szerkesztes'],
    ];

    public function __construct(string $auth_hash) {
        $this->auth_hash = $auth_hash;
        $this->actions = $this->getActions();
        $database = new Database();
        $this->db = $database->connect();
    }

    private function getActions(): array {
        return [
            'loginUser' => ['email', 'password'],
            'logoutUser' => [],

            // R52 (fejlesztési audit, 2026-07-19): WebAuthn gyors-bejelentkezés
            'getWebauthnStatusz' => ['kerelmezo_id'],
            'getWebauthnRegisztracioKihivas' => ['kerelmezo_id', 'origin'],
            'verifyWebauthnRegisztracio' => ['kerelmezo_id', 'token', 'clientDataJSON', 'attestationObject'],
            'deleteWebauthnHitelesito' => ['kerelmezo_id'],
            'getWebauthnBejelentkezesKihivas' => ['email', 'origin'],
            'verifyWebauthnBejelentkezes' => ['token', 'clientDataJSON', 'authenticatorData', 'signature'],
            'getSum' => ['id'],
            'getPiaciArak' => [],
            'getEsemenyek' => ['id'],
            'saveAdminData' => ['id'],

            'newKamion' => ['rendszam', 'kerelmezo_id'],
            'saveKamionData' => ['id', 'kerelmezo_id'],
            'getKamionok' => ['id'],
            'getKamionValaszto' => ['ceg_id'],
            'deleteKamion' => ['id', 'kerelmezo_id'],
            'getKamionRendszamok' => ['id'],
            'getKamion' => ['id'],

            'newPotkocsi' => ['rendszam', 'kerelmezo_id'],
            'savePotkocsiData' => ['id', 'kerelmezo_id'],
            'getPotkocsik' => ['id'],
            'deletePotkocsi' => ['id', 'kerelmezo_id'],
            'getPotkocsiRendszamok' => ['id'],
            'getPotkocsi' => ['id'],

            'newFurgon' => ['rendszam', 'kerelmezo_id'],
            'saveFurgonData' => ['id', 'kerelmezo_id'],
            'getFurgonok' => ['id'],
            'getFurgonValaszto' => ['ceg_id'],
            'deleteFurgon' => ['id', 'kerelmezo_id'],
            'getFurgonRendszamok' => ['id'],
            'getFurgon' => ['id'],

            'deleteKarbantartas' => ['id', 'kerelmezo_id'],
            'updateKarbantartas' => ['admin', 'log', 'kamion_id', 'datum', 'km_oraallas', 'elvegezte', 'kerelmezo_id'],
            'getKarbantartas' => ['kamion_id'],
            'deletePotkocsiKarbantartas' => ['id', 'kerelmezo_id'],
            'updatePotkocsiKarbantartas' => ['admin', 'log', 'potkocsi_id', 'datum', 'km_oraallas', 'elvegezte', 'kerelmezo_id'],
            'getPotkocsiKarbantartas' => ['potkocsi_id'],
            'deleteFurgonKarbantartas' => ['id', 'kerelmezo_id'],
            'updateFurgonKarbantartas' => ['admin', 'log', 'furgon_id', 'datum', 'km_oraallas', 'elvegezte', 'kerelmezo_id'],
            'getFurgonKarbantartas' => ['furgon_id'],
            'getKarbantartasok' => ['id', 'kamion_id', 'potkocsi_id', 'furgon_id', 'datumTol', 'datumIg', 'elvegezte', 'kerelmezo_id'],
            'getKmAlapuKarbantartasEsedekesseg' => ['id', 'kerelmezo_id'],

            'getSoforok' => ['id', 'kerelmezo_id'],
            'getSoforScorecard' => ['id', 'kerelmezo_id'],
            'getSajatSofor' => ['id'],
            'getSofor' => ['id'],
            'newSofor' => ['name', 'email', 'kerelmezo_id'],
            'saveSoforData' => ['id'],
            'deleteSofor' => ['id', 'kerelmezo_id'],

            'getBejelentesek' => ['ceg_id', 'kerelmezo_id'],
            'getBejelentesekSofor' => ['sofor_id'],
            'newBejelentes' => ['cim', 'leiras'],
            'saveBejelentesData' => ['id', 'kerelmezo_id'],
            'deleteBejelentes' => ['id', 'kerelmezo_id'],
            'getNyitottBejelentesek' => ['id'],

            'requestJarmuValtas' => ['admin', 'sofor_id', 'tipus', 'jarmu_id'],
            'visszavonJarmuValtas' => ['id'],
            'getSajatJarmuValtasKerelmek' => ['sofor_id'],
            'getElbiraltJarmuValtasok' => ['sofor_id'],
            'getFuggoJarmuValtasok' => ['id'],
            'elbiralJarmuValtas' => ['id', 'allapot'],

            'newTankolas' => ['admin', 'sofor_id', 'liter'],
            'getTankolasok' => ['sofor_id'],
            'getFogyasztasElemzes' => ['ceg_id', 'kerelmezo_id'],

            'getAdminElerhetoseg' => ['id'],

            'getUgyfelek' => ['id', 'kerelmezo_id'],
            'getUgyfel' => ['id'],
            'newUgyfel' => ['admin', 'nev', 'kerelmezo_id'],
            'saveUgyfelData' => ['id', 'ceg_id', 'kerelmezo_id'],
            'deleteUgyfel' => ['id', 'ceg_id', 'kerelmezo_id'],
            'getUgyfelFuvarElozmeny' => ['ugyfelId', 'ceg_id'],
            'getFuvarStatisztikak' => ['ceg_id'],
            'getFuvarFigyelmeztetesek' => ['ceg_id'],

            'getCsapattagok' => ['id'],
            'newCsapattag' => ['ceg_id', 'name', 'email', 'password', 'kerelmezo_id'],
            'updateCsapattagSzerepkor' => ['id', 'ceg_id', 'szerepkor', 'kerelmezo_id'],
            'updateCsapattagBer' => ['id', 'ceg_id', 'kerelmezo_id'],
            'deleteCsapattag' => ['id', 'ceg_id', 'kerelmezo_id'],

            'getHelyszinek' => ['id'],
            'getHelyszin' => ['id'],
            'newHelyszin' => ['admin', 'nev'],
            'saveHelyszinData' => ['id', 'nev'],
            'deleteHelyszin' => ['id'],
            'getHelyszinMegjegyzesek' => ['helyszin_id'],
            'newHelyszinMegjegyzes' => ['helyszin_id', 'szerzo_tipus', 'szerzo_id', 'szerzo_nev', 'szoveg'],
            'deleteHelyszinMegjegyzes' => ['id'],

            'getAjanlatkeresek' => [],
            'updateAjanlatkeresStatusz' => ['id', 'statusz'],

            'getTeendok' => ['id', 'kerelmezo_id'],

            'getMessages' => ['bejelentes_id'],
            'sendMessage' => ['bejelentes_id', 'szoveg'],

            'elemezBankImportCsv' => ['csv', 'oszlopok', 'ceg_id', 'kerelmezo_id'],
            'alkalmazBankImport' => ['sorok', 'ceg_id', 'kerelmezo_id'],

            'elemezMolTankolasPdf' => ['pdf', 'ceg_id', 'kerelmezo_id'],
            'alkalmazMolTankolas' => ['sorok', 'ceg_id', 'kerelmezo_id'],

            'elemezTachografDdd' => ['ddd', 'ceg_id', 'kerelmezo_id'],
            'alkalmazTachografImport' => ['napok', 'sofor_id', 'kartyaszam', 'ceg_id', 'kerelmezo_id'],
            'getTachografNapiAktivitas' => ['ceg_id', 'kerelmezo_id'],
            'getTachografEsemenyek' => ['ceg_id', 'kerelmezo_id'],
            'getTachografMegfeleloseg' => ['ceg_id', 'kerelmezo_id'],
            'getTachografSoforOsszesito' => ['ceg_id', 'kerelmezo_id'],
            'getTachografImportNaplo' => ['ceg_id', 'kerelmezo_id'],
            'atparositTachografNap' => ['id', 'ujSoforId', 'ceg_id', 'kerelmezo_id'],
            'elemezTachografVuDdd' => ['ddd', 'ceg_id', 'kerelmezo_id'],
            'alkalmazTachografVuImport' => ['napok', 'jarmuTipus', 'jarmuId', 'vin', 'rendszam', 'ceg_id', 'kerelmezo_id'],
            'getTachografVuNapiAktivitas' => ['ceg_id', 'kerelmezo_id'],
            'getTachografVuMegfeleloseg' => ['ceg_id', 'kerelmezo_id'],
            'getTachografVuJarmuOsszesito' => ['ceg_id', 'kerelmezo_id'],
            'getTachografVuImportNaplo' => ['ceg_id', 'kerelmezo_id'],

            'newFuvar' => ['ceg_id', 'kerelmezo_id'],
            'updateFuvar' => ['id', 'ceg_id', 'kerelmezo_id'],
            'deleteFuvar' => ['id', 'ceg_id', 'kerelmezo_id'],
            'getFuvar' => ['id'],
            'getFuvarok' => ['ceg_id'],
            'getFuvarUtvonalElozmenyek' => ['ceg_id', 'megbizoId'],
            'getSajatFuvarok' => ['sofor_id'],
            'getSajatFuvar' => ['id', 'sofor_id'],
            'feltoltFuvarDokumentumot' => ['fuvarId', 'tipus', 'file', 'name', 'size'],
            'torolSajatFuvarDokumentumot' => ['fajlId'],
            'getSajatFuvarDokumentumai' => ['fuvarId'],
            'updateFuvarAllapot' => ['id', 'ceg_id', 'kerelmezo_id', 'allapot'],
            'getSoforDashboard' => ['ceg_id'],
            'hozzarendelFuvarSzamlaszamot' => ['idk', 'ceg_id', 'kerelmezo_id', 'szamlaszam'],
            'getFuvarAllapotOsszesito' => ['ceg_id'],

            'getSzabadsagok' => ['id', 'kerelmezo_id'],
            'newSzabadsag' => ['admin', 'sofor_id', 'datum_tol', 'datum_ig', 'kerelmezo_id'],
            'updateSzabadsag' => ['id', 'sofor_id', 'datum_tol', 'datum_ig', 'kerelmezo_id'],
            'deleteSzabadsag' => ['id', 'kerelmezo_id'],

            'getAuditLog' => ['id', 'kerelmezo_id'],

            'getKoltsegOsszesito' => ['ceg_id', 'kerelmezo_id'],
            'getVarhatoEredmeny' => ['ceg_id', 'kerelmezo_id'],
            'getEgyebKoltsegek' => ['ceg_id', 'kerelmezo_id'],
            'newEgyebKoltseg' => ['ceg_id', 'datum', 'megnevezes', 'osszeg', 'kerelmezo_id'],
            'updateEgyebKoltseg' => ['id', 'ceg_id', 'datum', 'megnevezes', 'osszeg', 'kerelmezo_id'],
            'deleteEgyebKoltseg' => ['id', 'ceg_id', 'kerelmezo_id'],

            'getNavSzamlaBeallitasokStatusz' => ['ceg_id', 'kerelmezo_id'],
            'saveNavSzamlaBeallitasok' => ['ceg_id', 'kerelmezo_id', 'adoszam', 'login', 'jelszo', 'alairoKulcs', 'csereKulcs', 'kornyezet'],
            'navSzamlaLekerdezes' => ['ceg_id', 'kerelmezo_id', 'datumTol', 'datumIg'],
            'getGpsmartBeallitasokStatusz' => ['ceg_id', 'kerelmezo_id'],
            'saveGpsmartBeallitasok' => ['ceg_id', 'kerelmezo_id', 'felhasznalonev', 'jelszo', 'userid'],
            'gpsmartPoziciok' => ['ceg_id', 'kerelmezo_id'],
            'gpsmartMegtettUtMa' => ['ceg_id', 'kerelmezo_id'],
            'gpsmartUtvonal' => ['ceg_id', 'kerelmezo_id', 'carId', 'datumTol', 'datumIg'],
            'getKihasznaltsagiRiport' => ['ceg_id', 'kerelmezo_id', 'datumTol', 'datumIg'],
            'importNavSzamlak' => ['ceg_id', 'kerelmezo_id', 'tetelek'],

            'torolErtesites' => ['kulcsok', 'kerelmezo_id'],
            'getToroltErtesitesek' => ['kerelmezo_id'],
            'logErtesitesek' => ['tetelek', 'kerelmezo_id'],
            'getErtesitesNaplo' => ['kerelmezo_id'],

            'savePushFeliratkozas' => ['endpoint', 'p256dh', 'auth'],
            'deletePushFeliratkozas' => ['endpoint'],
            'getPushStatusz' => [],

            'generateKarbantartasFromBejelentes' => ['id', 'kerelmezo_id'],

            'getJogosultsagok' => ['ceg_id', 'szerepkor', 'kerelmezo_id'],
            'saveJogosultsagok' => ['ceg_id', 'szerepkor', 'jogosultsagok', 'kerelmezo_id'],
            'getSajatJogosultsagok' => ['kerelmezo_id'],

            'getSzerepkorok' => ['id'],
            'newSzerepkor' => ['ceg_id', 'kulcs', 'nev', 'kerelmezo_id'],
            'deleteSzerepkor' => ['id', 'ceg_id', 'kerelmezo_id'],

            'getListaElemek' => ['id', 'tipus'],
            'newListaElem' => ['ceg_id', 'tipus', 'kulcs', 'nev', 'kerelmezo_id'],
            'updateListaElemNev' => ['id', 'ceg_id', 'nev', 'kerelmezo_id'],
            'getListaElemHasznalat' => ['id', 'ceg_id', 'kerelmezo_id'],
            'deleteListaElem' => ['id', 'ceg_id', 'kerelmezo_id'],

            'globalSearch' => ['ceg_id', 'q'],

            'requestPasswordReset' => ['email'],
            'resetPassword' => ['token', 'password'],

            'getFiles' => ['id', 'tabla'],
            'fileUpload' => ['admin', 'id', 'tabla', 'file', 'name', 'size'],
            'deleteFile' => ['id'],
            'downloadFile' => ['id'],
            'updateFajlCimkek' => ['id', 'cimkek'],
            'renameFile' => ['id', 'name'],
            'downloadFilesZip' => ['ids'],
            'getFajlStatisztika' => [],
            'getHasonloFajlok' => ['id'],

            'getEgyediHataridok' => ['id'],
            'updateEgyediHatarido' => ['id', 'datum', 'leiras', 'ceg_id'],
            'deleteEgyediHatarido' => ['id', 'ceg_id'],
            'createEgyediHatarido' => ['id', 'datum', 'leiras'],

            'sendAjanlatkeres' => ['name', 'email', 'phone', 'message'],
            'sendJelentkezes' => ['name', 'email', 'phone', 'message'],
        ];
    }

    private function validation(?array $request) {
        if (empty($request)) {
            throw new Exception('A kérés törzse üres.');
        }

        $authHash = $request['authHash'] ?? null;
        if (!is_string($authHash) || $this->auth_hash !== $authHash) {
            throw new Exception('Sikertelen hitelesítés.');
        }

        // `is_string()` ellenőrzés az `array_key_exists()` hívás ELŐTT: ha az
        // `action` mező a JSON body-ban tömb/objektum (pl. `"action": {}}`),
        // az `array_key_exists($request['action'], ...)` egy PHP `TypeError`-t
        // ("Illegal offset type") dobott volna — ez `Error`, nem `Exception`
        // hierarchia, tehát a `catch (Exception $e)` nem fogta el, és
        // kezeletlen fatal errorként törte meg a JSON-választ, MÉG a session-
        // ellenőrzés (tehát bármilyen hitelesítés) előtt (ld. biztonsági
        // audit). A `process()` catch-ága időközben `\Throwable`-re bővült
        // (második védelmi vonal), de itt, a forrásnál is explicit
        // validáljuk, hogy a hibaüzenet is a szokásos, informatív
        // "Érvénytelen művelet" legyen, ne egy nyers TypeError-szöveg.
        if (!isset($request['action']) || !is_string($request['action']) || !array_key_exists($request['action'], $this->actions)) {
            $action = is_string($request['action'] ?? null) ? $request['action'] : '';
            throw new Exception("Érvénytelen művelet: $action.");
        }

        foreach ($this->actions[$request['action']] as $key) {
            if (!array_key_exists($key, $request)) {
                throw new Exception("Hiányzó paraméter: $key.");
            }
        }
        // `!empty()`, NEM `isset()` — egy sofőrnek/adminnak nem kötelező
        // email cím a rendszerben (ld. Profil.js form.email || ""), egy
        // ÜRES email string is `isset` lenne, és a `filter_var("", ...)`
        // is `false`-t ad rá, ami korábban azt jelentette, hogy egy email
        // nélküli fiók SOHA nem tudta elmenteni a saját adatait (bármelyik
        // mezőt módosítva is elakadt "Érvénytelen email cím formátum"
        // hibán) — csak akkor validáljunk formátumot, ha ténylegesen van
        // megadott érték.
        if (!empty($request['email']) && !filter_var($request['email'], FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Érvénytelen email cím formátum.');
        }
        if (!empty($request['email']) && isset($request['id'])) {
            $this->validateUniqueEmail($request['email'], $request['id']);
        }

        if (!in_array($request['action'], self::PUBLIC_ACTIONS, true)) {
            $this->requireValidSession($request);
        }

        if (in_array($request['action'], self::ADMIN_ONLY_ACTIONS, true)) {
            $this->requireAdminRole($request);
        } elseif (array_key_exists($request['action'], self::MODULE_PERMISSION_MAP)) {
            [$modul, $tipus] = self::MODULE_PERMISSION_MAP[$request['action']];
            $this->requirePermission($request, $modul, $tipus);
        }
    }

    // Feloldja + gyorsítótárazza az aktuális kérés munkamenetét a
    // `sessionToken` alapján — ez a VALÓDI bizalmi horgony, nem a kliens
    // által küldött `kerelmezo_id`/`id` mezők (ld. resolveKerelmezo() lenti
    // komment). Lejárt/hiányzó/ismeretlen token esetén a kliensnek újra be
    // kell jelentkeznie.
    private function requireValidSession(array $request): array {
        if ($this->session !== null) {
            return $this->session;
        }

        $token = $request['sessionToken'] ?? '';
        if ($token === '') {
            throw new Exception('A munkamenet lejárt, jelentkezz be újra.');
        }

        // A lejárat-döntést SQL-ben (MySQL saját `NOW()`-ja) hozzuk meg, NEM
        // a naiv `lejarat` string PHP `strtotime()`-mal való összevetésével —
        // ez utóbbi a szerver PHP/MySQL időzóna-eltérése miatt (ld. CLAUDE.md
        // "PHP/MySQL timezone mismatch" gotcha, és a biztonsági audit ugyanezt
        // itt is megtalálta) pontatlan session-lejáratot eredményezett.
        $stmt = $this->db->prepare("SELECT felhasznalo_tipus, felhasznalo_id, (lejarat < NOW()) AS lejart FROM sessions WHERE token = :token");
        $stmt->bindValue(':token', $token);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || (int) $row['lejart'] === 1) {
            throw new Exception('A munkamenet lejárt, jelentkezz be újra.');
        }

        $this->session = [
            'felhasznalo_tipus' => $row['felhasznalo_tipus'],
            'felhasznalo_id' => (int) $row['felhasznalo_id'],
        ];
        return $this->session;
    }

    // Feloldja, hogy ki a kérelmező, és visszaadja a tényleges, adatbázisban
    // tárolt szerepkörét + a saját cégét (ceg_id) — `requireAdminRole()` és
    // `requirePermission()` is ezt használja, hogy a lekérdezés/ellenőrzés
    // logikája egy helyen éljen.
    //
    // A kérelmező azonosítója a validáláskor már feloldott, szerver-oldali
    // `sessions` tábla-bejegyzésből jön (ld. requireValidSession()), NEM a
    // kliens által küldött `kerelmezo_id` mezőből — ez utóbbi, ha jelen van,
    // csak konzisztencia-ellenőrzésre szolgál (a meglévő akció-paraméterezés
    // változatlanul hagyása érdekében), nem bizalmi forrásként.
    private function resolveKerelmezo(array $request): array {
        $session = $this->requireValidSession($request);
        if ($session['felhasznalo_tipus'] !== 'admin') {
            throw new Exception('Ehhez a művelethez admin-oldali bejelentkezés szükséges.');
        }
        $kerelmezoId = $session['felhasznalo_id'];

        if (isset($request['kerelmezo_id']) && (string) $request['kerelmezo_id'] !== (string) $kerelmezoId) {
            throw new Exception('A kérelmező azonosító nem egyezik a bejelentkezett felhasználóval.');
        }

        $stmt = $this->db->prepare("SELECT id, szerepkor, tulajdonos_admin_id FROM admin WHERE id = :id AND torolt <> 'I'");
        $stmt->bindValue(':id', $kerelmezoId);
        $stmt->execute();
        $kerelmezo = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$kerelmezo) {
            throw new Exception('A kérelmező fiók nem található.');
        }

        $kerelmezo['is_root'] = empty($kerelmezo['tulajdonos_admin_id']);
        $kerelmezo['ceg_id'] = $kerelmezo['is_root'] ? $kerelmezo['id'] : $kerelmezo['tulajdonos_admin_id'];

        // Emellett azt is ellenőrizzük, hogy a kérelmező tényleg ahhoz a
        // céghez tartozik-e, amelyikre a kérés vonatkozik (`ceg_id`) —
        // enélkül egy másik cég csapattagja is beküldhetne egy tetszőleges
        // `ceg_id`-t.
        if (isset($request['ceg_id']) && (string) $kerelmezo['ceg_id'] !== (string) $request['ceg_id']) {
            throw new Exception('A kérelmező nem ehhez a céghez tartozik.');
        }

        return $kerelmezo;
    }

    // A resolveKerelmezo() admin-típusú munkamenetet vár — a sofőr saját
    // (nem admin-oldali) önkiszolgáló akcióihoz (pl. jármű-váltási kérés
    // beküldése/visszavonása) ez a pár a megfelelője: a sofőr saját,
    // szerver-oldalon feloldott azonosítóját adja vissza, NEM a kliens
    // által küldött `sofor_id` mezőt — enélkül egy sofőr más sofőr
    // nevében is tudna kérést beküldeni/visszavonni/megtekinteni.
    private function resolveSajatSoforId(array $request): int {
        $session = $this->requireValidSession($request);
        if ($session['felhasznalo_tipus'] !== 'sofor') {
            throw new Exception('Ehhez a művelethez sofőr-oldali bejelentkezés szükséges.');
        }
        return (int) $session['felhasznalo_id'];
    }

    // Sok akciót (fájlfeltöltés, saját jármű-váltási kérés stb.) mind
    // admin-, mind sofőr-típusú munkamenet elérhet — ehhez kell egy olyan
    // "saját ceg_id" feloldás, ami MINDKÉT munkamenet-típusnál a valódi,
    // szerver-oldali hovatartozást adja vissza, sosem a kliens által
    // küldött `admin`/`ceg_id` mezőt.
    private function resolveSajatCegId(array $request): int {
        $session = $this->requireValidSession($request);
        if ($session['felhasznalo_tipus'] === 'admin') {
            $stmt = $this->db->prepare("SELECT id, tulajdonos_admin_id FROM admin WHERE id = :id AND torolt <> 'I'");
            $stmt->bindValue(':id', $session['felhasznalo_id']);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new Exception('A kérelmező fiók nem található.');
            }
            return (int) (empty($row['tulajdonos_admin_id']) ? $row['id'] : $row['tulajdonos_admin_id']);
        }
        if ($session['felhasznalo_tipus'] === 'sofor') {
            $stmt = $this->db->prepare("SELECT admin FROM user WHERE id = :id AND torolt <> 'I'");
            $stmt->bindValue(':id', $session['felhasznalo_id']);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new Exception('A sofőr fiók nem található.');
            }
            return (int) $row['admin'];
        }
        throw new Exception('Ismeretlen munkamenet-típus.');
    }

    // Fájlfeltöltő (admin vagy sofőr) azonosítása — a `filesInterface.php`
    // `fajlok.feltolto_*` mezőihez, ugyanazzal az elvvel, mint
    // `resolveSajatCegId()`: sosem a kliens által küldött mezőből, mindig a
    // munkamenetből szerver-oldalon feloldva. A nevet denormalizáltan (a
    // táblák SQL-szintű összekapcsolása nélkül, ld. a projekt egyedi SQL
    // lintere) tároljuk el a fájl-sorban, ugyanaz a minta, mint
    // `bejelentes_uzenetek.szerzo_nev`.
    private function resolveFeltolto(array $request): array {
        $session = $this->requireValidSession($request);
        $tabla = $session['felhasznalo_tipus'] === 'sofor' ? 'user' : 'admin';
        $stmt = $this->db->prepare("SELECT name FROM `$tabla` WHERE id = :id");
        $stmt->bindValue(':id', $session['felhasznalo_id']);
        $stmt->execute();
        $nev = $stmt->fetch(PDO::FETCH_ASSOC)['name'] ?? null;
        return [$session['felhasznalo_tipus'], $session['felhasznalo_id'], $nev];
    }

    private function requireAdminRole(array $request) {
        $kerelmezo = $this->resolveKerelmezo($request);
        if (!$kerelmezo['is_root'] && $kerelmezo['szerepkor'] !== 'admin') {
            throw new Exception('Ehhez a művelethez adminisztrátori jogosultság szükséges.');
        }
    }

    // Nem dobó változat a `requireAdminRole()`-hoz — olyan akcióknál kell,
    // amik NEM admin-only akciók (pl. egy sofőr adatlapjának megtekintése
    // fuvarszervező szerepkörrel is engedélyezett), de van bennük egy
    // rész-adat (bér), amit csak admin szerepkör láthat/szerkeszthet — ott
    // nem a teljes műveletet kell letiltani, csak azt az egy mezőt kell
    // szűrni/figyelmen kívül hagyni a válaszban/mentésben.
    //
    // FONTOS, amit a régi `kerelmezoAdmin` név nem tett egyértelművé (ld.
    // biztonsági audit): ez a metódus KIZÁRÓLAG azt mondja meg, hogy a HÍVÓ
    // saját szerepköre admin-e a SAJÁT cégében — NEM végez cél-sor
    // tulajdonos-ellenőrzést, és a `catch` minden kivételt elnyel (nem csak
    // a "nem admin-session" esetet). Ne használd hozzáférés-döntésre —
    // csak mező-szintű megjelenítés/szerkeszthetőség eldöntésére, egy már
    // amúgy is jogosultság-ellenőrzött (MODULE_PERMISSION_MAP/ADMIN_ONLY_
    // ACTIONS által védett) akción belül.
    private function hivoSajatSzerepkoreAdmin(array $request): bool {
        try {
            $kerelmezo = $this->resolveKerelmezo($request);
            return $kerelmezo['is_root'] || $kerelmezo['szerepkor'] === 'admin';
        } catch (Exception $e) {
            return false;
        }
    }

    // Konfigurálható modul-jogosultság ellenőrzése (Jogosultsagok oldal) —
    // admin/gyökér mindig mindent tud, más szerepkörnél az adatbázisban
    // tárolt beállítást nézzük; hiányzó sor = alapértelmezett teljes
    // hozzáférés (ld. JogosultsagInterface::getJogosultsagok komment).
    private function requirePermission(array $request, string $modul, string $tipus) {
        $kerelmezo = $this->resolveKerelmezo($request);
        if ($kerelmezo['is_root'] || $kerelmezo['szerepkor'] === 'admin') {
            return;
        }

        if (!in_array($tipus, ['hozzaferes', 'szerkesztes', 'torles'], true)) {
            throw new Exception('Ismeretlen jogosultság-típus.');
        }

        $stmt = $this->db->prepare("SELECT $tipus AS ertek FROM jogosultsagok WHERE admin = :ceg_id AND szerepkor = :szerepkor AND modul = :modul");
        $stmt->bindValue(':ceg_id', $kerelmezo['ceg_id']);
        $stmt->bindValue(':szerepkor', $kerelmezo['szerepkor']);
        $stmt->bindValue(':modul', $modul);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        $ertek = $sor['ertek'] ?? 'I';

        if ($ertek !== 'I') {
            throw new Exception('Nincs jogosultságod ehhez a művelethez.');
        }
    }

    public function process(?array $request) {
        global $kamionInterface, $potkocsiInterface, $furgonInterface, $soforokInterface, $filesInterface, $emailInterface, $bejelentesekInterface, $karbantartasInterface, $szabadsagInterface, $tankolasInterface, $jarmuValtasInterface, $ugyfelInterface, $csapatInterface, $helyszinInterface, $jogosultsagInterface, $szerepkorInterface, $listaInterface, $keresesInterface, $koltsegInterface, $ertesitesInterface, $navSzamlaInterface, $gpsmartInterface, $piaciArakInterface, $pushInterface, $bankImportInterface, $molTankolasInterface, $tachografInterface, $tachografVuInterface, $fuvarInterface;
        try {
            $this->validation($request);
            $action = $request['action'];
            // A `logAudit()` ebből olvassa ki, KI (melyik admin-táblás
            // bejelentkezés) végezte a műveletet — a hívási helyeken eddig
            // átadott `admin`/`ceg_id` a CÉGET azonosítja, nem a tényleges
            // aktort, ezért ezt külön, egyszer itt tesszük el, ahelyett
            // hogy a naplózó hívás ~35 helyét kellene egyenként bővíteni.
            $this->aktivKerelmezoId = $request['kerelmezo_id'] ?? null;
            // Best-effort — sok akciónak (login, publikus ajánlatkérés stb.)
            // nincs érvényes munkamenete, ott a `resolveFeltolto()` dob, és a
            // naplósor `kerelmezo_nev` nélkül (a régi, csak-id viselkedéssel)
            // készül.
            try {
                [, , $this->aktivKerelmezoNev] = $this->resolveFeltolto($request);
            } catch (Exception $e) {
                $this->aktivKerelmezoNev = null;
            }

            switch ($action) {
                case 'loginUser':
                    echo json_encode($this->loginUser($request['email'], $request['password']));
                    return;
                case 'getSum':
                    echo json_encode($this->getSum($this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'getPiaciArak':
                    echo json_encode($piaciArakInterface->getPiaciArak());
                    return;
                case 'logoutUser':
                    echo json_encode($this->logoutUser($request['sessionToken'] ?? ''));
                    return;

                case 'getWebauthnStatusz':
                    $sajatSoforId = $this->resolveSajatSoforId($request);
                    echo json_encode(['success' => true, 'van' => (new WebAuthnHelper($this->db))->vanRegisztralvaSoforhoz($sajatSoforId)]);
                    return;

                case 'getWebauthnRegisztracioKihivas': {
                    $sajatSoforId = $this->resolveSajatSoforId($request);
                    $sofor = $this->getSajatSoforAdatok($sajatSoforId);
                    $rpId = WebAuthnHelper::rendszerRpId($request['origin']);
                    echo json_encode((new WebAuthnHelper($this->db))->generateRegistrationOptions($sajatSoforId, $sofor['email'], $sofor['name'], $rpId));
                    return;
                }

                case 'verifyWebauthnRegisztracio':
                    $this->resolveSajatSoforId($request);
                    echo json_encode((new WebAuthnHelper($this->db))->verifyRegistration(
                        $request['token'],
                        $request['clientDataJSON'],
                        $request['attestationObject'],
                        self::WEBAUTHN_ALLOWED_ORIGINS
                    ));
                    return;

                case 'deleteWebauthnHitelesito':
                    $sajatSoforId = $this->resolveSajatSoforId($request);
                    (new WebAuthnHelper($this->db))->torolHitelesito($sajatSoforId);
                    echo json_encode(['success' => true]);
                    return;

                case 'getWebauthnBejelentkezesKihivas': {
                    $webauthn = new WebAuthnHelper($this->db);
                    $sofor = $this->getSoforByEmailWebauthnhoz($request['email']);
                    if (!$sofor) {
                        echo json_encode(['success' => false, 'message' => 'Nincs regisztrált hitelesítő ehhez a fiókhoz.']);
                        return;
                    }
                    $hitelesito = $webauthn->getHitelesito($sofor['id']);
                    if (!$hitelesito) {
                        echo json_encode(['success' => false, 'message' => 'Nincs regisztrált hitelesítő ehhez a fiókhoz.']);
                        return;
                    }
                    $rpId = WebAuthnHelper::rendszerRpId($request['origin']);
                    echo json_encode($webauthn->generateAuthenticationOptions($sofor['id'], $hitelesito['credential_id'], $rpId));
                    return;
                }

                case 'verifyWebauthnBejelentkezes':
                    $eredmeny = (new WebAuthnHelper($this->db))->verifyAuthentication(
                        $request['token'],
                        $request['clientDataJSON'],
                        $request['authenticatorData'],
                        $request['signature'],
                        self::WEBAUTHN_ALLOWED_ORIGINS
                    );
                    if (!$eredmeny['success']) {
                        echo json_encode($eredmeny);
                        return;
                    }
                    echo json_encode($this->keszitsSessiontSofornek($eredmeny['sofor_id']));
                    return;

                case 'saveKamionData':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $kamionInterface->saveKamionData($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'kamion', $request['id'], 'modositas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'newKamion':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $kamionInterface->newKamion($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'kamion', $result['kamion']['id'] ?? null, 'letrehozas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'getKamionok':
                    // `resolveSajatCegId()` (nem `resolveKerelmezo()`) — ez az
                    // action admin- ÉS sofőr-oldalról is hívott (a sofőr saját
                    // Dashboard/JarmuValaszto oldala is ezt hívja a hozzárendelt
                    // kamion adatainak/listájának betöltéséhez); `resolveKerelmezo()`
                    // admin-only session-t követelt volna, ami sofőr-munkamenetből
                    // mindig "Ehhez a művelethez admin-oldali bejelentkezés
                    // szükséges." hibával elszállt — élesen jelentett hiba
                    // ("nem tölt be a kamion, nem lehet váltani").
                    echo json_encode($kamionInterface->getKamionok($this->resolveSajatCegId($request), $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $request['sortKey'] ?? null, $request['sortDir'] ?? 'asc'));
                    return;
                case 'getKamionValaszto':
                    echo json_encode($kamionInterface->getKamionValaszto($this->resolveSajatCegId($request)));
                    return;
                case 'getKamionRendszamok':
                    echo json_encode($kamionInterface->getKamionRendszamok($this->resolveSajatCegId($request)));
                    return;
                case 'getKamion':
                    $kamion = $kamionInterface->getKamion($request['id'], $this->resolveSajatCegId($request));
                    echo json_encode($kamion ? ['success' => true, 'kamion' => $kamion] : ['success' => false, 'message' => 'A kamion nem található.']);
                    return;
                case 'deleteKamion':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $kamionInterface->deleteKamion($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'kamion', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getKarbantartas':
                    echo json_encode($karbantartasInterface->getKamionKarbantartas($request['kamion_id'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'updateKarbantartas':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($karbantartasInterface->updateKamionKarbantartas(isset($request['id']) ? $request['id'] : 0, $kerelmezo['ceg_id'], $request['kamion_id'], $request['datum'], $request['log'], empty($request['km_oraallas']) ? null : $request['km_oraallas'], $request['elvegezte'], $request['kovetkezo_karbantartas'], $request['koltseg'] ?? null));
                    return;
                case 'deleteKarbantartas':
                    echo json_encode($karbantartasInterface->deleteKamionKarbantartas($request['id'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'saveFurgonData':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $furgonInterface->saveFurgonData($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'furgon', $request['id'], 'modositas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'newFurgon':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $furgonInterface->newFurgon($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'furgon', $result['furgon']['id'] ?? null, 'letrehozas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'getFurgonok':
                    // `resolveSajatCegId()` — ugyanaz az indok, mint `getKamionok`-nál.
                    echo json_encode($furgonInterface->getFurgonok($this->resolveSajatCegId($request), $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $request['sortKey'] ?? null, $request['sortDir'] ?? 'asc'));
                    return;
                case 'getFurgonValaszto':
                    echo json_encode($furgonInterface->getFurgonValaszto($this->resolveSajatCegId($request)));
                    return;
                case 'getFurgonRendszamok':
                    echo json_encode($furgonInterface->getFurgonRendszamok($this->resolveSajatCegId($request)));
                    return;
                case 'getFurgon':
                    $furgon = $furgonInterface->getFurgon($request['id'], $this->resolveSajatCegId($request));
                    echo json_encode($furgon ? ['success' => true, 'furgon' => $furgon] : ['success' => false, 'message' => 'A furgon nem található.']);
                    return;
                case 'deleteFurgon':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $furgonInterface->deleteFurgon($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'furgon', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getFurgonKarbantartas':
                    echo json_encode($karbantartasInterface->getFurgonKarbantartas($request['furgon_id'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'updateFurgonKarbantartas':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($karbantartasInterface->updateFurgonKarbantartas(isset($request['id']) ? $request['id'] : 0, $kerelmezo['ceg_id'], $request['furgon_id'], $request['datum'], $request['log'], empty($request['km_oraallas']) ? null : $request['km_oraallas'], $request['elvegezte'], $request['kovetkezo_karbantartas'], $request['koltseg'] ?? null));
                    return;
                case 'deleteFurgonKarbantartas':
                    echo json_encode($karbantartasInterface->deleteFurgonKarbantartas($request['id'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'savePotkocsiData':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $potkocsiInterface->savePotkocsiData($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'potkocsi', $request['id'], 'modositas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'newPotkocsi':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $potkocsiInterface->newPotkocsi($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'potkocsi', $result['potkocsi']['id'] ?? null, 'letrehozas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deletePotkocsi':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $potkocsiInterface->deletePotkocsi($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'potkocsi', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getPotkocsik':
                    // `resolveSajatCegId()` — ugyanaz az indok, mint `getKamionok`-nál.
                    echo json_encode($potkocsiInterface->getPotkocsik($this->resolveSajatCegId($request), $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $request['sortKey'] ?? null, $request['sortDir'] ?? 'asc'));
                    return;
                case 'getPotkocsiRendszamok':
                    echo json_encode($potkocsiInterface->getPotkocsiRendszamok($this->resolveSajatCegId($request)));
                    return;
                case 'getPotkocsi':
                    $potkocsi = $potkocsiInterface->getPotkocsi($request['id'], $this->resolveSajatCegId($request));
                    echo json_encode($potkocsi ? ['success' => true, 'potkocsi' => $potkocsi] : ['success' => false, 'message' => 'A pótkocsi nem található.']);
                    return;
                case 'getPotkocsiKarbantartas':
                    echo json_encode($karbantartasInterface->getPotkocsiKarbantartas($request['potkocsi_id'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'updatePotkocsiKarbantartas':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($karbantartasInterface->updatePotkocsiKarbantartas(isset($request['id']) ? $request['id'] : 0, $kerelmezo['ceg_id'], $request['potkocsi_id'], $request['datum'], $request['log'], empty($request['km_oraallas']) ? null : $request['km_oraallas'], $request['elvegezte'], $request['kovetkezo_karbantartas'], $request['koltseg'] ?? null));
                    return;
                case 'deletePotkocsiKarbantartas':
                    echo json_encode($karbantartasInterface->deletePotkocsiKarbantartas($request['id'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'getKarbantartasok':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($karbantartasInterface->getKarbantartasok($kerelmezo['ceg_id'], $request['kamion_id'], $request['potkocsi_id'], $request['datumTol'], $request['datumIg'], $request['elvegezte'], $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $request['furgon_id']));
                    return;
                case 'getKmAlapuKarbantartasEsedekesseg':
                    echo json_encode($karbantartasInterface->getKmAlapuEsedekesseg($this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'getSoforok':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($soforokInterface->getSoforok($kerelmezo['ceg_id'], $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $kerelmezo['is_root'] || $kerelmezo['szerepkor'] === 'admin', $request['sortKey'] ?? null, $request['sortDir'] ?? 'asc'));
                    return;
                case 'getSoforScorecard':
                    echo json_encode($this->getSoforScorecard($this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'getSajatSofor':
                    $sajatSoforId = $this->resolveSajatSoforId($request);
                    echo json_encode($soforokInterface->getSajatSofor($sajatSoforId, $this->resolveSajatCegId($request)));
                    return;
                case 'getSofor':
                    $sofor = $soforokInterface->getSofor($request['id'], $this->resolveKerelmezo($request)['ceg_id']);
                    if ($sofor) {
                        unset($sofor['password']);
                    }
                    echo json_encode($sofor ? ['success' => true, 'sofor' => $sofor] : ['success' => false, 'message' => 'A sofőr nem található.']);
                    return;
                case 'newSofor':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $soforokInterface->newSofor($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'user', $result['sofor']['id'] ?? null, 'letrehozas', $request['name'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'saveSoforData':
                    // Két, teljesen külön jogosultsági ág: admin-oldalról a
                    // saját cég bármely sofőrje szerkeszthető (jármű-mezőkkel
                    // együtt, jóváhagyás nélkül — ld. komment lentebb),
                    // sofőr-oldalról (a saját "Profil" oldal is ezt hívja)
                    // KIZÁRÓLAG a saját sora, jármű-mezők és `ber` nélkül —
                    // enélkül bármely sofőr bármely másik sofőr (akár másik
                    // cég!) adatait felülírhatta, és jóváhagyás nélkül
                    // tetszőleges járművet rendelhetett magához (ld.
                    // biztonsági audit).
                    $session = $this->requireValidSession($request);
                    if ($session['felhasznalo_tipus'] === 'sofor') {
                        $sajatSoforId = $this->resolveSajatSoforId($request);
                        if ((int) ($request['id'] ?? 0) !== $sajatSoforId) {
                            throw new Exception('Csak a saját adataidat módosíthatod.');
                        }
                        $cegId = $this->resolveSajatCegId($request);
                        $result = $soforokInterface->saveSoforData($request, $cegId, false, false);
                    } else {
                        $kerelmezo = $this->resolveKerelmezo($request);
                        $cegId = $kerelmezo['ceg_id'];
                        $result = $soforokInterface->saveSoforData($request, $cegId, $kerelmezo['is_root'] || $kerelmezo['szerepkor'] === 'admin', true);
                    }
                    if ($result['success']) {
                        $this->logAudit($cegId, 'user', $request['id'], 'modositas', $request['name'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deleteSofor':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $soforokInterface->deleteSofor($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'user', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getBejelentesek':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($bejelentesekInterface->getBejelentesek($kerelmezo['ceg_id'], $request['kamion'] ?? null, $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null));
                    return;
                case 'getNyitottBejelentesek':
                    echo json_encode($bejelentesekInterface->getNyitottBejelentesek($this->resolveSajatCegId($request)));
                    return;
                case 'getBejelentesekSofor':
                    echo json_encode($bejelentesekInterface->getBejelentesekSofor($this->resolveSajatSoforId($request), $this->resolveSajatCegId($request)));
                    return;
                case 'newBejelentes':
                    // Admin- és sofőr-munkamenetből egyaránt elérhető — a
                    // tulajdonos ceg_id-t mindkét esetben szerver-oldalon
                    // oldjuk fel, sosem a kliens `admin` mezőjéből (ld.
                    // bejelentesekInterface::newBejelentes komment).
                    $session = $this->requireValidSession($request);
                    if ($session['felhasznalo_tipus'] === 'sofor') {
                        $request['sofor_id'] = $this->resolveSajatSoforId($request);
                        $cegId = $this->resolveSajatCegId($request);
                    } else {
                        $cegId = $this->resolveKerelmezo($request)['ceg_id'];
                    }
                    $result = $bejelentesekInterface->newBejelentes($request, $cegId);
                    if ($result['success']) {
                        $this->logAudit($cegId, 'bejelentesek', $result['id'], 'letrehozas', $request['cim'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'saveBejelentesData':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $bejelentesekInterface->saveBejelentesData($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'bejelentesek', $request['id'], 'modositas', $request['cim'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deleteBejelentes':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $bejelentesekInterface->deleteBejelentes($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'bejelentesek', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'requestJarmuValtas':
                    $sajatSoforId = $this->resolveSajatSoforId($request);
                    echo json_encode($jarmuValtasInterface->requestJarmuValtas($sajatSoforId, $request['tipus'], $request['jarmu_id'], $request['indoklas'] ?? null));
                    return;
                case 'visszavonJarmuValtas':
                    $sajatSoforId = $this->resolveSajatSoforId($request);
                    echo json_encode($jarmuValtasInterface->visszavonJarmuValtas($request['id'], $sajatSoforId));
                    return;
                case 'getSajatJarmuValtasKerelmek':
                    $sajatSoforId = $this->resolveSajatSoforId($request);
                    echo json_encode($jarmuValtasInterface->getSajatJarmuValtasKerelmek($sajatSoforId, $this->resolveSajatCegId($request)));
                    return;
                case 'getElbiraltJarmuValtasok':
                    $sajatSoforId = $this->resolveSajatSoforId($request);
                    echo json_encode($jarmuValtasInterface->getElbiraltJarmuValtasok($sajatSoforId, $this->resolveSajatCegId($request)));
                    return;
                case 'getFuggoJarmuValtasok':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($jarmuValtasInterface->getFuggoJarmuValtasok($kerelmezo['ceg_id']));
                    return;
                case 'elbiralJarmuValtas':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    if (!$kerelmezo['is_root'] && $kerelmezo['szerepkor'] !== 'admin') {
                        echo json_encode(['success' => false, 'message' => 'Ehhez a művelethez adminisztrátori jogosultság szükséges.']);
                        return;
                    }
                    $result = $jarmuValtasInterface->elbiralJarmuValtas($request['id'], $request['allapot'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'jarmu_valtas_kerelmek', $request['id'], 'modositas', $request['allapot']);
                    }
                    echo json_encode($result);
                    return;

                case 'newTankolas':
                    $sajatSoforId = $this->resolveSajatSoforId($request);
                    echo json_encode($tankolasInterface->newTankolas($request, $this->resolveSajatCegId($request), $sajatSoforId));
                    return;
                case 'getTankolasok':
                    echo json_encode($tankolasInterface->getTankolasok($this->resolveSajatSoforId($request)));
                    return;

                case 'getFogyasztasElemzes':
                    echo json_encode($tankolasInterface->getFogyasztasElemzes($request['ceg_id'], $request['kamion_id'] ?? null, $request['furgon_id'] ?? null));
                    return;

                case 'getAdminElerhetoseg':
                    echo json_encode($this->getAdminElerhetoseg($this->resolveSajatCegId($request)));
                    return;

                case 'getUgyfelek':
                    // `getActions()`-ben ehhez az akcióhoz nincs `ceg_id`
                    // kötelező paraméter, ezért a `resolveKerelmezo()` ceg_id-
                    // egyeztetése sosem futott le rá — a kliens `id` mezőjét
                    // kellett eddig, tetszőleges cégre állítva, elfogadni
                    // (IDOR, ld. biztonsági audit). Most a szerver-oldalon
                    // feloldott ceg_id-t adjuk át, sosem a kliensét.
                    echo json_encode($ugyfelInterface->getUgyfelek($this->resolveKerelmezo($request)['ceg_id'], $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $request['sortKey'] ?? null, $request['sortDir'] ?? 'asc'));
                    return;
                case 'getUgyfel':
                    $ugyfel = $ugyfelInterface->getUgyfel($request['id'], $this->resolveKerelmezo($request)['ceg_id']);
                    echo json_encode($ugyfel ? ['success' => true, 'ugyfel' => $ugyfel] : ['success' => false, 'message' => 'Az ügyfél nem található.']);
                    return;
                case 'newUgyfel':
                    // Ugyanez a hiba: `$request['admin']`-t közvetlenül az
                    // INSERT-be engedte a korábbi kód, `resolveKerelmezo()`
                    // pedig csak a `ceg_id` mezőt egyezteti, az `admin`-t nem
                    // — bármely admin tetszőleges MÁSIK cég `admin` id-je alá
                    // csempészhetett hamis ügyfél-rekordot (ld. biztonsági
                    // audit). Az `admin` mezőt itt felülírjuk a szerver-
                    // oldalon feloldott ceg_id-vel.
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $request['admin'] = $kerelmezo['ceg_id'];
                    $result = $ugyfelInterface->newUgyfel($request);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'ugyfelek', $result['ugyfel']['id'] ?? null, 'letrehozas', $request['nev'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'saveUgyfelData':
                    $result = $ugyfelInterface->saveUgyfelData($request);
                    if ($result['success']) {
                        $ownerAdmin = $this->resolveOwnerAdmin('ugyfelek', $request['id']);
                        $this->logAudit($ownerAdmin, 'ugyfelek', $request['id'], 'modositas', $request['nev'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deleteUgyfel':
                    $ownerAdmin = $this->resolveOwnerAdmin('ugyfelek', $request['id']);
                    $result = $ugyfelInterface->deleteUgyfel($request['id'], $request['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($ownerAdmin, 'ugyfelek', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'getCsapattagok':
                    // `getActions()`-ben nincs kötelező `ceg_id`, és ez az
                    // akció nincs a `MODULE_PERMISSION_MAP`-ban sem — a
                    // kliens `id` mezőjét eddig ellenőrzés nélkül fogadta el
                    // (bármely sofőr-munkamenet is elérte), tetszőleges cég
                    // csapattag-listáját (név, email) kiadva (ld. biztonsági
                    // audit). `resolveKerelmezo()` egyszerre kényszeríti ki az
                    // admin-típusú munkamenetet és a szerver-oldali ceg_id-t.
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($csapatInterface->getCsapattagok($kerelmezo['ceg_id'], $kerelmezo['is_root'] || $kerelmezo['szerepkor'] === 'admin'));
                    return;
                case 'newCsapattag':
                    $result = $csapatInterface->newCsapattag($request);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'admin', $result['id'] ?? null, 'letrehozas', $request['email'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'updateCsapattagSzerepkor':
                    $result = $csapatInterface->updateCsapattagSzerepkor($request['id'], $request['ceg_id'], $request['szerepkor']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'admin', $request['id'], 'modositas', 'szerepkör: ' . $request['szerepkor']);
                    }
                    echo json_encode($result);
                    return;
                case 'updateCsapattagBer':
                    $result = $csapatInterface->updateCsapattagBer($request['id'], $request['ceg_id'], $request['ber'] ?? null);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'admin', $request['id'], 'modositas', 'bérezés frissítve');
                    }
                    echo json_encode($result);
                    return;
                case 'deleteCsapattag':
                    $result = $csapatInterface->deleteCsapattag($request['id'], $request['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'admin', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'getJogosultsagok':
                    echo json_encode($jogosultsagInterface->getJogosultsagok($request['ceg_id'], $request['szerepkor']));
                    return;
                case 'saveJogosultsagok':
                    $result = $jogosultsagInterface->saveJogosultsagok($request['ceg_id'], $request['szerepkor'], $request['jogosultsagok']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'jogosultsagok', $request['ceg_id'], 'modositas', 'szerepkör: ' . $request['szerepkor']);
                    }
                    echo json_encode($result);
                    return;

                // Önkiszolgáló lekérdezés — bárki (nem csak admin) lekérheti a
                // SAJÁT szerepköréhez tartozó jogosultságokat (a Sidebar ez
                // alapján rejti el a hozzá nem férhető menüpontokat). Admin/
                // gyökér hívónál ez mindig teljes hozzáférést ad vissza, mivel
                // a `jogosultsagok` táblában sosem szerepel 'admin' szerepkörű
                // sor — a hiányzó sor pedig alapértelmezetten teljes hozzáférés.
                case 'getSajatJogosultsagok':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($jogosultsagInterface->getJogosultsagok($kerelmezo['ceg_id'], $kerelmezo['szerepkor']));
                    return;

                case 'getSzerepkorok':
                    echo json_encode($szerepkorInterface->getSzerepkorok($request['id']));
                    return;
                case 'newSzerepkor':
                    $result = $szerepkorInterface->newSzerepkor($request['ceg_id'], $request['kulcs'], $request['nev']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'szerepkorok', $result['szerepkor']['id'] ?? null, 'letrehozas', $request['nev'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deleteSzerepkor':
                    $result = $szerepkorInterface->deleteSzerepkor($request['id'], $request['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'szerepkorok', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'getListaElemek':
                    echo json_encode($listaInterface->getListaElemek($request['id'], $request['tipus']));
                    return;
                case 'newListaElem':
                    $result = $listaInterface->newListaElem($request['ceg_id'], $request['tipus'], $request['kulcs'], $request['nev']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'listaelemek', $result['elem']['id'] ?? null, 'letrehozas', $request['tipus'] . ': ' . $request['nev']);
                    }
                    echo json_encode($result);
                    return;
                case 'updateListaElemNev':
                    $result = $listaInterface->updateListaElemNev($request['id'], $request['ceg_id'], $request['nev']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'listaelemek', $request['id'], 'modositas', $request['nev']);
                    }
                    echo json_encode($result);
                    return;
                case 'getListaElemHasznalat':
                    echo json_encode($listaInterface->getListaElemHasznalat($request['id'], $request['ceg_id']));
                    return;
                case 'deleteListaElem':
                    $result = $listaInterface->deleteListaElem($request['id'], $request['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'listaelemek', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'globalSearch':
                    // Nincs sem `MODULE_PERMISSION_MAP`, sem `ADMIN_ONLY_ACTIONS`
                    // bejegyzése — a `resolveKerelmezo()` ceg_id-egyeztetése
                    // emiatt SOSEM futott le rá, a kliens `ceg_id` mezőjét
                    // ellenőrzés nélkül fogadta el (bármely munkamenettel
                    // tetszőleges cég adatai közt lehetett keresni, ld.
                    // biztonsági audit).
                    echo json_encode($keresesInterface->globalSearch($this->resolveSajatCegId($request), $request['q']));
                    return;

                case 'getHelyszinek':
                    echo json_encode($helyszinInterface->getHelyszinek($this->resolveSajatCegId($request), $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $request['sortKey'] ?? null, $request['sortDir'] ?? 'asc'));
                    return;
                case 'getHelyszin':
                    echo json_encode($helyszinInterface->getHelyszin($request['id'], $this->resolveSajatCegId($request)));
                    return;
                case 'newHelyszin':
                    $cegId = $this->resolveSajatCegId($request);
                    $result = $helyszinInterface->newHelyszin($request, $cegId);
                    if ($result['success']) {
                        $this->logAudit($cegId, 'helyszinek', $result['helyszin']['id'] ?? null, 'letrehozas', $request['nev'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'saveHelyszinData':
                    $cegId = $this->resolveSajatCegId($request);
                    $result = $helyszinInterface->saveHelyszinData($request, $cegId);
                    if ($result['success']) {
                        $this->logAudit($cegId, 'helyszinek', $request['id'], 'modositas', $request['nev'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deleteHelyszin':
                    $cegId = $this->resolveSajatCegId($request);
                    $result = $helyszinInterface->deleteHelyszin($request['id'], $cegId);
                    if ($result['success']) {
                        $this->logAudit($cegId, 'helyszinek', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getHelyszinMegjegyzesek':
                    echo json_encode($helyszinInterface->getHelyszinMegjegyzesek($request['helyszin_id'], $this->resolveSajatCegId($request)));
                    return;
                case 'newHelyszinMegjegyzes':
                    // A jegyzet szerzőjét (típus/id/név) mindig a hívó
                    // munkamenetéből oldjuk fel, sosem a kliens `$request`
                    // mezőiből — enélkül bárki tetszőleges nevet/id-t
                    // hamisíthatott szerzőként (ld. biztonsági audit).
                    $session = $this->requireValidSession($request);
                    $cegId = $this->resolveSajatCegId($request);
                    if ($session['felhasznalo_tipus'] === 'sofor') {
                        $szerzoId = $session['felhasznalo_id'];
                        $nevStmt = $this->db->prepare("SELECT name FROM user WHERE id = :id");
                        $nevStmt->bindValue(':id', $szerzoId);
                        $nevStmt->execute();
                        $szerzoNev = $nevStmt->fetch(PDO::FETCH_ASSOC)['name'] ?? '';
                    } else {
                        $szerzoId = $session['felhasznalo_id'];
                        $nevStmt = $this->db->prepare("SELECT name FROM admin WHERE id = :id");
                        $nevStmt->bindValue(':id', $szerzoId);
                        $nevStmt->execute();
                        $szerzoNev = $nevStmt->fetch(PDO::FETCH_ASSOC)['name'] ?? '';
                    }
                    echo json_encode($helyszinInterface->newHelyszinMegjegyzes($request, $cegId, $session['felhasznalo_tipus'], $szerzoId, $szerzoNev));
                    return;
                case 'deleteHelyszinMegjegyzes':
                    echo json_encode($helyszinInterface->deleteHelyszinMegjegyzes($request['id'], $this->resolveSajatCegId($request)));
                    return;

                case 'getSzabadsagok':
                    echo json_encode($szabadsagInterface->getSzabadsagok($this->resolveKerelmezo($request)['ceg_id'], $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null));
                    return;
                case 'newSzabadsag':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $szabadsagInterface->newSzabadsag($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'sofor_szabadsag', $result['id'] ?? null, 'letrehozas');
                    }
                    echo json_encode($result);
                    return;
                case 'updateSzabadsag':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $szabadsagInterface->updateSzabadsag($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'sofor_szabadsag', $request['id'], 'modositas');
                    }
                    echo json_encode($result);
                    return;
                case 'deleteSzabadsag':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $szabadsagInterface->deleteSzabadsag($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'sofor_szabadsag', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'getAuditLog':
                    // A `requirePermission()` (MODULE_PERMISSION_MAP: 'naplo')
                    // ide is lefut, DE a `resolveKerelmezo()` csak a `ceg_id`
                    // NEVŰ mezőt egyezteti — ennek az akciónak a kötelező
                    // paramétere `id`, tehát a ceg_id-egyeztetés sosem
                    // aktiválódott, és a kliens `id` mezőjét ellenőrzés
                    // nélkül fogadta el (bármely cég admin-ja olvashatta egy
                    // másik cég teljes audit-naplóját, ld. biztonsági audit).
                    echo json_encode($this->getAuditLog($this->resolveKerelmezo($request)['ceg_id'], $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null));
                    return;

                case 'getKoltsegOsszesito':
                    echo json_encode($koltsegInterface->getKoltsegOsszesito(
                        $request['ceg_id'],
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null,
                        $this->hivoSajatSzerepkoreAdmin($request),
                        $request['datumMezo'] ?? 'datum'
                    ));
                    return;

                case 'getVarhatoEredmeny':
                    echo json_encode($koltsegInterface->getVarhatoEredmeny(
                        $request['ceg_id'],
                        $this->hivoSajatSzerepkoreAdmin($request)
                    ));
                    return;

                case 'getEgyebKoltsegek':
                    echo json_encode($koltsegInterface->getEgyebKoltsegek(
                        $request['ceg_id'],
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null,
                        $request['irany'] ?? null,
                        $request['search'] ?? null,
                        $request['page'] ?? null,
                        $request['pageSize'] ?? null,
                        $request['kategoria'] ?? null,
                        $this->hivoSajatSzerepkoreAdmin($request),
                        $request['sortKey'] ?? null,
                        $request['sortDir'] ?? 'desc',
                        $request['datumMezo'] ?? 'datum'
                    ));
                    return;

                case 'newEgyebKoltseg':
                    $result = $koltsegInterface->newEgyebKoltseg($request, $this->hivoSajatSzerepkoreAdmin($request));
                    if ($result['success']) {
                        $iranyLabel = $result['irany'] === 'bevetel' ? 'bevétel' : 'kiadás';
                        $this->logAudit($request['ceg_id'], 'egyeb_koltsegek', $result['id'], 'letrehozas', "($iranyLabel) " . ($request['megnevezes'] ?? ''));
                    }
                    echo json_encode($result);
                    return;

                case 'updateEgyebKoltseg':
                    $result = $koltsegInterface->updateEgyebKoltseg($request, $this->hivoSajatSzerepkoreAdmin($request));
                    if ($result['success']) {
                        $iranyLabel = $result['irany'] === 'bevetel' ? 'bevétel' : 'kiadás';
                        $this->logAudit($request['ceg_id'], 'egyeb_koltsegek', $request['id'], 'modositas', "($iranyLabel) " . ($request['megnevezes'] ?? ''));
                    }
                    echo json_encode($result);
                    return;

                case 'deleteEgyebKoltseg':
                    $result = $koltsegInterface->deleteEgyebKoltseg($request['id'], $request['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'egyeb_koltsegek', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'getNavSzamlaBeallitasokStatusz':
                    echo json_encode($navSzamlaInterface->getBeallitasokStatusz($request['ceg_id']));
                    return;

                case 'saveNavSzamlaBeallitasok':
                    $result = $navSzamlaInterface->saveBeallitasok(
                        $request['ceg_id'],
                        $request['adoszam'],
                        $request['login'],
                        $request['jelszo'],
                        $request['alairoKulcs'],
                        $request['csereKulcs'],
                        $request['kornyezet']
                    );
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'nav_szamla_beallitasok', $request['ceg_id'], 'modositas', 'NAV Online Számla kapcsolat beállítva/frissítve');
                    }
                    echo json_encode($result);
                    return;

                case 'navSzamlaLekerdezes':
                    echo json_encode($navSzamlaInterface->lekerdezSzamlak($request['ceg_id'], $request['datumTol'], $request['datumIg']));
                    return;

                case 'importNavSzamlak':
                    $result = $navSzamlaInterface->importalSzamlak($request['ceg_id'], $request['tetelek']);
                    if ($result['success'] && $result['importalva'] > 0) {
                        // `rowid`-ként a ceg_id-t naplózzuk (nem egy konkrét
                        // egyeb_koltsegek sort) — ez egy köteges import, nem
                        // egyetlen rekordhoz köthető esemény, ugyanaz a minta,
                        // mint a NAV-beállítások mentésének naplózásánál.
                        $this->logAudit($request['ceg_id'], 'egyeb_koltsegek', $request['ceg_id'], 'letrehozas', "NAV import: {$result['importalva']} tétel");
                    }
                    echo json_encode($result);
                    return;

                case 'getGpsmartBeallitasokStatusz':
                    echo json_encode($gpsmartInterface->getBeallitasokStatusz($request['ceg_id']));
                    return;

                case 'saveGpsmartBeallitasok':
                    $result = $gpsmartInterface->saveBeallitasok(
                        $request['ceg_id'],
                        $request['felhasznalonev'],
                        $request['jelszo'],
                        $request['userid']
                    );
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'gpsmart_beallitasok', $request['ceg_id'], 'modositas', 'GPSmart flottakövetés kapcsolat beállítva/frissítve');
                    }
                    echo json_encode($result);
                    return;

                case 'gpsmartPoziciok':
                    echo json_encode($gpsmartInterface->lekerdezPoziciok($request['ceg_id']));
                    return;

                case 'gpsmartMegtettUtMa':
                    echo json_encode($gpsmartInterface->lekerdezMegtettUtMa($request['ceg_id']));
                    return;

                case 'gpsmartUtvonal':
                    echo json_encode($gpsmartInterface->lekerdezUtvonal(
                        $request['ceg_id'],
                        $request['carId'],
                        $request['datumTol'],
                        $request['datumIg']
                    ));
                    return;

                case 'getKihasznaltsagiRiport':
                    echo json_encode($gpsmartInterface->getKihasznaltsagiRiport(
                        $request['ceg_id'],
                        $request['datumTol'],
                        $request['datumIg']
                    ));
                    return;

                case 'torolErtesites':
                    // A `kerelmezo_id`-t NEM közvetlenül a kliens kérésből
                    // vesszük — resolveKerelmezo() a valódi munkamenethez
                    // kötött admin-id-t adja vissza, így senki nem tud más
                    // fiók helyett törlési bejegyzést létrehozni.
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($ertesitesInterface->torolErtesites($kerelmezo['id'], $request['kulcsok']));
                    return;

                case 'getToroltErtesitesek':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($ertesitesInterface->getToroltErtesitesek($kerelmezo['id']));
                    return;

                case 'logErtesitesek':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($ertesitesInterface->logErtesitesek($kerelmezo['id'], $request['tetelek']));
                    return;

                case 'getErtesitesNaplo':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($ertesitesInterface->getErtesitesNaplo($kerelmezo['id']));
                    return;

                case 'savePushFeliratkozas':
                    // Mind admin, mind sofőr munkamenetből hívható (ld. a
                    // spec 5.5 pontja) — ezért NEM resolveKerelmezo()
                    // (admin-only), hanem a nyers session, ugyanaz a
                    // tanulság, mint az elemezBeerkezettDokumentum-nál:
                    // egy dual-role actionnek nincs MODULE_PERMISSION_MAP
                    // bejegyzése sem (ld. getActions() alatti komment).
                    $session = $this->requireValidSession($request);
                    echo json_encode($pushInterface->saveFeliratkozas($session['felhasznalo_tipus'], $session['felhasznalo_id'], $request['endpoint'], $request['p256dh'], $request['auth']));
                    return;

                case 'deletePushFeliratkozas':
                    $session = $this->requireValidSession($request);
                    echo json_encode($pushInterface->deleteFeliratkozas($session['felhasznalo_tipus'], $session['felhasznalo_id'], $request['endpoint']));
                    return;

                case 'getPushStatusz':
                    global $apiConfig;
                    $session = $this->requireValidSession($request);
                    $statusz = $pushInterface->vanFeliratkozva($session['felhasznalo_tipus'], $session['felhasznalo_id']);
                    $statusz['vapidPublicKey'] = $apiConfig['vapidPublicKey'];
                    echo json_encode($statusz);
                    return;

                case 'generateKarbantartasFromBejelentes':
                    echo json_encode($bejelentesekInterface->generateKarbantartasFromBejelentes($request['id'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;

                case 'getAjanlatkeresek':
                    echo json_encode($this->getAjanlatkeresek());
                    return;
                case 'updateAjanlatkeresStatusz':
                    echo json_encode($this->updateAjanlatkeresStatusz($request['id'], $request['statusz']));
                    return;

                case 'getTeendok':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($this->getTeendok($kerelmezo['ceg_id'], $kerelmezo['is_root'] || $kerelmezo['szerepkor'] === 'admin'));
                    return;

                case 'getMessages':
                    $session = $this->requireValidSession($request);
                    $cegId = $this->resolveSajatCegId($request);
                    $soforId = $session['felhasznalo_tipus'] === 'sofor' ? $this->resolveSajatSoforId($request) : null;
                    echo json_encode($bejelentesekInterface->getMessages($request['bejelentes_id'], $cegId, $soforId));
                    return;
                case 'sendMessage':
                    // A szerző típusát/id-ját/nevét mindig a hívó munkamenetéből
                    // oldjuk fel, sosem a kliens `$request` mezőiből — ugyanaz a
                    // minta, mint `newHelyszinMegjegyzes`-nél.
                    $session = $this->requireValidSession($request);
                    $cegId = $this->resolveSajatCegId($request);
                    if ($session['felhasznalo_tipus'] === 'sofor') {
                        $szerzoId = $this->resolveSajatSoforId($request);
                        $nevStmt = $this->db->prepare("SELECT name FROM user WHERE id = :id");
                        $nevStmt->bindValue(':id', $szerzoId);
                        $nevStmt->execute();
                        $szerzoNev = $nevStmt->fetch(PDO::FETCH_ASSOC)['name'] ?? 'Sofőr';
                        $result = $bejelentesekInterface->sendMessage($request['bejelentes_id'], $request['szoveg'], $cegId, 'sofor', $szerzoId, $szerzoNev, $szerzoId);
                        if ($result['success']) {
                            $this->ertesitBejelentesUjUzenetrol($cegId, $request['bejelentes_id'], $szerzoNev);
                        }
                    } else {
                        $szerzoId = $session['felhasznalo_id'];
                        $nevStmt = $this->db->prepare("SELECT name FROM admin WHERE id = :id");
                        $nevStmt->bindValue(':id', $szerzoId);
                        $nevStmt->execute();
                        $szerzoNev = $nevStmt->fetch(PDO::FETCH_ASSOC)['name'] ?? 'Admin';
                        $result = $bejelentesekInterface->sendMessage($request['bejelentes_id'], $request['szoveg'], $cegId, 'admin', $szerzoId, $szerzoNev);
                    }
                    echo json_encode($result);
                    return;

                case 'elemezBankImportCsv':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    echo json_encode($bankImportInterface->elemezCsv($request['csv'], $request['oszlopok'], $kerelmezo['ceg_id'], $request['fajlnev'] ?? null, $feltoltoTipus, $feltoltoId, $feltoltoNev));
                    return;
                case 'alkalmazBankImport':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($bankImportInterface->alkalmaz($request['sorok'], $kerelmezo['ceg_id']));
                    return;

                case 'elemezMolTankolasPdf':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    echo json_encode($molTankolasInterface->elemezPdf($request['pdf'], $kerelmezo['ceg_id'], $request['fajlnev'] ?? null, $feltoltoTipus, $feltoltoId, $feltoltoNev));
                    return;
                case 'alkalmazMolTankolas':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($molTankolasInterface->alkalmaz($request['sorok'], $kerelmezo['ceg_id']));
                    return;

                case 'elemezTachografDdd':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    echo json_encode($tachografInterface->elemezDdd($request['ddd'], $kerelmezo['ceg_id'], $request['fajlnev'] ?? null, $feltoltoTipus, $feltoltoId, $feltoltoNev));
                    return;
                case 'alkalmazTachografImport':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    echo json_encode($tachografInterface->alkalmazImport(
                        $request['napok'],
                        $request['sofor_id'],
                        $request['kartyaszam'],
                        $request['forrasFajlnev'] ?? null,
                        $kerelmezo['ceg_id'],
                        $request['esemenyek'] ?? [],
                        $feltoltoTipus,
                        $feltoltoId,
                        $feltoltoNev
                    ));
                    return;
                case 'getTachografMegfeleloseg':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->getMegfelelosegiLista($kerelmezo['ceg_id']));
                    return;
                case 'getTachografSoforOsszesito':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->getSoforAttekintes($kerelmezo['ceg_id']));
                    return;
                case 'getTachografImportNaplo':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->getImportNaplo($kerelmezo['ceg_id']));
                    return;
                case 'atparositTachografNap':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->atparositNap($request['id'], $request['ujSoforId'], $kerelmezo['ceg_id']));
                    return;
                case 'elemezTachografVuDdd':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    echo json_encode($tachografVuInterface->elemezVuDdd($request['ddd'], $kerelmezo['ceg_id'], $request['fajlnev'] ?? null, $feltoltoTipus, $feltoltoId, $feltoltoNev));
                    return;
                case 'alkalmazTachografVuImport':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    echo json_encode($tachografVuInterface->alkalmazVuImport(
                        $request['napok'],
                        $request['jarmuTipus'],
                        $request['jarmuId'],
                        $request['vin'],
                        $request['rendszam'],
                        $request['forrasFajlnev'] ?? null,
                        $kerelmezo['ceg_id'],
                        $request['generacio'] ?? 2,
                        $feltoltoTipus,
                        $feltoltoId,
                        $feltoltoNev
                    ));
                    return;
                case 'getTachografVuNapiAktivitas':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografVuInterface->getVuNapiAktivitas(
                        $request['jarmuTipus'] ?? null,
                        $request['jarmuId'] ?? null,
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null,
                        $kerelmezo['ceg_id']
                    ));
                    return;
                case 'getTachografVuMegfeleloseg':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografVuInterface->getVuMegfelelosegiLista($kerelmezo['ceg_id']));
                    return;
                case 'getTachografVuJarmuOsszesito':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografVuInterface->getJarmuAttekintes($kerelmezo['ceg_id']));
                    return;
                case 'getTachografVuImportNaplo':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografVuInterface->getVuImportNaplo($kerelmezo['ceg_id']));
                    return;
                case 'newFuvar':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->newFuvar($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $result['fuvar']['id'] ?? null, 'letrehozas', $request['felrako_ceg'] ?? null);
                        if (!empty($result['fuvar']['sofor_id'])) {
                            $pushInterface->sendPushSofornak(
                                $result['fuvar']['sofor_id'],
                                'Új fuvar érkezett',
                                trim(($result['fuvar']['felrako_ceg'] ?? '') . ' → ' . ($result['fuvar']['lerako_ceg'] ?? '')) . ($result['fuvar']['lerakas_datuma'] ? ' · ' . date('Y.m.d.', strtotime($result['fuvar']['lerakas_datuma'])) : ''),
                                '/user/fuvarReszletek?id=' . $result['fuvar']['id'],
                                'fuvar-' . $result['fuvar']['id']
                            );
                        }
                    }
                    echo json_encode($result);
                    return;
                case 'updateFuvar':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    // A push-küldés eldöntéséhez a RÉGI sofor_id-t az UPDATE
                    // előtt kell megnézni — csak akkor küldünk, ha ténylegesen
                    // ÚJ (nem üres) sofőrre került a fuvar, a leváltott sofőr
                    // nem kap semmit (ld. design spec 5.4, jóváhagyott döntés).
                    $regiSoforId = $this->db->prepare("SELECT sofor_id FROM fuvarok WHERE id = :id AND admin = :ceg_id");
                    $regiSoforId->bindValue(':id', $request['id'], PDO::PARAM_INT);
                    $regiSoforId->bindValue(':ceg_id', $kerelmezo['ceg_id'], PDO::PARAM_INT);
                    $regiSoforId->execute();
                    $regiSoforIdErtek = $regiSoforId->fetchColumn();

                    $result = $fuvarInterface->updateFuvar($request, $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['id'], 'modositas', $request['felrako_ceg'] ?? null);
                        $ujSoforId = $result['fuvar']['sofor_id'] ?? null;
                        if (!empty($ujSoforId) && (string) $ujSoforId !== (string) $regiSoforIdErtek) {
                            $pushInterface->sendPushSofornak(
                                $ujSoforId,
                                'Új fuvar érkezett',
                                trim(($result['fuvar']['felrako_ceg'] ?? '') . ' → ' . ($result['fuvar']['lerako_ceg'] ?? '')) . ($result['fuvar']['lerakas_datuma'] ? ' · ' . date('Y.m.d.', strtotime($result['fuvar']['lerakas_datuma'])) : ''),
                                '/user/fuvarReszletek?id=' . $result['fuvar']['id'],
                                'fuvar-' . $result['fuvar']['id']
                            );
                        }
                    }
                    echo json_encode($result);
                    return;
                case 'deleteFuvar':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->deleteFuvar($request['id'], $kerelmezo['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getFuvar':
                    echo json_encode($fuvarInterface->getFuvar($request['id'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'getFuvarok':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($fuvarInterface->getFuvarok($kerelmezo['ceg_id'], $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $request['sortKey'] ?? null, $request['sortDir'] ?? 'asc', $request['allapot'] ?? null, $request['datumTol'] ?? null, $request['datumIg'] ?? null));
                    return;
                case 'getFuvarUtvonalElozmenyek':
                    echo json_encode($fuvarInterface->getUtvonalElozmenyek($this->resolveKerelmezo($request)['ceg_id'], $request['megbizoId']));
                    return;
                case 'getSajatFuvarok':
                    // Sofőr-önkiszolgáló akció, nincs MODULE_PERMISSION_MAP
                    // bejegyzése — a sofőr mindig látja a SAJÁT fuvarjait,
                    // ugyanaz a minta, mint getSajatBeerkezettDokumentumok-nál.
                    echo json_encode($fuvarInterface->getSajatFuvarok(
                        $this->resolveSajatSoforId($request),
                        $this->resolveSajatCegId($request),
                        !isset($request['aktivOnly']) || $request['aktivOnly']
                    ));
                    return;
                case 'getSajatFuvar':
                    echo json_encode($fuvarInterface->getSajatFuvar(
                        $request['id'],
                        $this->resolveSajatSoforId($request),
                        $this->resolveSajatCegId($request)
                    ));
                    return;
                case 'feltoltFuvarDokumentumot':
                    // Sofőr-only, ownership-ellenőrzött feltöltés — ld.
                    // design spec 5.2. Nincs MODULE_PERMISSION_MAP-bejegyzés
                    // (ugyanaz az ok, mint a getSajatFuvar*-nál).
                    $tipus = $request['tipus'] ?? '';
                    if (!in_array($tipus, ['menetlevel', 'szallitolevel'], true)) {
                        echo json_encode(['success' => false, 'message' => 'Érvénytelen dokumentumtípus.']);
                        return;
                    }
                    $soforId = $this->resolveSajatSoforId($request);
                    $cegId = $this->resolveSajatCegId($request);
                    $fuvarJavaslat = $fuvarInterface->getSajatFuvar($request['fuvarId'], $soforId, $cegId);
                    if (!$fuvarJavaslat['success']) {
                        echo json_encode(['success' => false, 'message' => 'A fuvar nem található.']);
                        return;
                    }
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    $result = $filesInterface->fileUpload(
                        $cegId,
                        'fuvar',
                        $request['fuvarId'],
                        $request['file'],
                        $request['name'],
                        $request['size'],
                        null,
                        $feltoltoTipus,
                        $feltoltoId,
                        $feltoltoNev,
                        $tipus
                    );
                    if ($result['success'] && $tipus === 'menetlevel') {
                        $fuvarInterface->allitDokumentumFeltoltve($request['fuvarId'], $cegId);
                    }
                    echo json_encode($result);
                    return;
                case 'torolSajatFuvarDokumentumot':
                    $soforId = $this->resolveSajatSoforId($request);
                    $cegId = $this->resolveSajatCegId($request);
                    $fajlSor = $this->db->prepare("SELECT rowid FROM fajlok WHERE sorszam = :id AND tabla = 'fuvar' AND admin = :ceg_id");
                    $fajlSor->bindValue(':id', $request['fajlId'], PDO::PARAM_INT);
                    $fajlSor->bindValue(':ceg_id', $cegId, PDO::PARAM_INT);
                    $fajlSor->execute();
                    $fuvarId = $fajlSor->fetchColumn();
                    if ($fuvarId === false || !$fuvarInterface->getSajatFuvar($fuvarId, $soforId, $cegId)['success']) {
                        echo json_encode(['success' => false, 'message' => 'A dokumentum nem található.']);
                        return;
                    }
                    echo json_encode($filesInterface->deleteFile($request['fajlId'], $cegId));
                    return;
                case 'getSajatFuvarDokumentumai':
                    $soforId = $this->resolveSajatSoforId($request);
                    $cegId = $this->resolveSajatCegId($request);
                    if (!$fuvarInterface->getSajatFuvar($request['fuvarId'], $soforId, $cegId)['success']) {
                        echo json_encode(['success' => false, 'message' => 'A fuvar nem található.']);
                        return;
                    }
                    echo json_encode($filesInterface->getFiles('fuvar', $request['fuvarId'], null, null, null, $cegId));
                    return;
                case 'getFuvarAllapotOsszesito':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($fuvarInterface->getAllapotOsszesito($kerelmezo['ceg_id']));
                    return;
                case 'getSoforDashboard':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($fuvarInterface->getSoforDashboard(
                        $kerelmezo['ceg_id'],
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null,
                        $request['soforId'] ?? null,
                        $request['fuvarAllapot'] ?? null,
                        $request['dokumentumSzuro'] ?? null,
                        $request['granularitas'] ?? null
                    ));
                    return;
                case 'getUgyfelFuvarElozmeny':
                    echo json_encode($fuvarInterface->getUgyfelElozmeny($request['ugyfelId'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'getFuvarStatisztikak':
                    echo json_encode($fuvarInterface->getStatisztikak($this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'getFuvarFigyelmeztetesek':
                    echo json_encode($fuvarInterface->getFigyelmeztetesek($this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'updateFuvarAllapot':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->updateAllapot($request['id'], $kerelmezo['ceg_id'], $request['allapot']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', $request['id'], 'allapotvaltas', $request['allapot']);
                    }
                    echo json_encode($result);
                    return;
                case 'hozzarendelFuvarSzamlaszamot':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    $result = $fuvarInterface->hozzarendelSzamlaszamot($request['idk'], $kerelmezo['ceg_id'], $request['szamlaszam']);
                    if ($result['success']) {
                        $this->logAudit($kerelmezo['ceg_id'], 'fuvarok', null, 'szamlaszam_hozzarendeles', $request['szamlaszam']);
                    }
                    echo json_encode($result);
                    return;
                case 'getTachografNapiAktivitas':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->getNapiAktivitas(
                        $request['sofor_id'] ?? null,
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null,
                        $kerelmezo['ceg_id']
                    ));
                    return;
                case 'getTachografEsemenyek':
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($tachografInterface->getEsemenyek($request['sofor_id'] ?? null, $kerelmezo['ceg_id']));
                    return;

                case 'requestPasswordReset':
                    echo json_encode($this->requestPasswordReset($request['email']));
                    return;
                case 'resetPassword':
                    echo json_encode($this->resetPassword($request['token'], $request['password']));
                    return;

                case 'getFiles':
                    $szurok = [
                        'kategoria' => $request['kategoria'] ?? null,
                        'modul' => $request['modul'] ?? null,
                        'feltoltoId' => $request['feltoltoId'] ?? null,
                        'datumTol' => $request['datumTol'] ?? null,
                        'datumIg' => $request['datumIg'] ?? null,
                        'sortKey' => $request['sortKey'] ?? null,
                        'sortDir' => $request['sortDir'] ?? null,
                    ];
                    echo json_encode($filesInterface->getFiles($request['tabla'], $request['id'], $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null, $this->resolveSajatCegId($request), $szurok));
                    return;
                case 'fileUpload':
                    // A fájlt a SAJÁT (szerver-oldalon feloldott) ceg_id-vel
                    // taggeljük, nem a kliens által küldött `admin` mezővel —
                    // különben valaki más cég `admin` id-jét beküldve egy
                    // idegen cég fájllistájába "csempészhetne" fel tartalmat.
                    // A feltöltő azonosítója/neve ugyanígy kizárólag a
                    // munkamenetből (ld. resolveFeltolto()), sosem kliens-mezőből.
                    [$feltoltoTipus, $feltoltoId, $feltoltoNev] = $this->resolveFeltolto($request);
                    echo json_encode($filesInterface->fileUpload(
                        $this->resolveSajatCegId($request),
                        $request['tabla'],
                        $request['id'],
                        $request['file'],
                        $request['name'],
                        $request['size'],
                        $request['kategoria'] ?? null,
                        $feltoltoTipus,
                        $feltoltoId,
                        $feltoltoNev,
                        $request['cimkek'] ?? null
                    ));
                    return;
                case 'downloadFile':
                    echo json_encode($filesInterface->downloadFile($request['id'], $this->resolveSajatCegId($request)));
                    return;
                case 'deleteFile':
                    echo json_encode($filesInterface->deleteFile($request['id'], $this->resolveSajatCegId($request)));
                    return;
                case 'updateFajlCimkek':
                    echo json_encode($filesInterface->updateFajlCimkek($request['id'], $this->resolveSajatCegId($request), $request['cimkek']));
                    return;
                case 'renameFile':
                    echo json_encode($filesInterface->renameFile($request['id'], $this->resolveSajatCegId($request), $request['name']));
                    return;
                case 'downloadFilesZip':
                    echo json_encode($filesInterface->downloadFilesZip($request['ids'], $this->resolveSajatCegId($request)));
                    return;
                case 'getFajlStatisztika':
                    echo json_encode($filesInterface->getStatisztika($this->resolveSajatCegId($request)));
                    return;
                case 'getHasonloFajlok':
                    echo json_encode($filesInterface->getHasonloFajlok($request['id'], $this->resolveSajatCegId($request)));
                    return;
                case 'getEgyediHataridok':
                    echo json_encode($this->getEgyediHataridok($this->resolveKerelmezo($request)['ceg_id'], $request['search'] ?? null, $request['page'] ?? null, $request['pageSize'] ?? null));
                    return;
                case 'updateEgyediHatarido':
                    echo json_encode($this->updateEgyediHatarido($request['id'], $request['datum'], $request['leiras'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'deleteEgyediHatarido':
                    echo json_encode($this->deleteEgyediHatarido($request['id'], $this->resolveKerelmezo($request)['ceg_id']));
                    return;
                case 'createEgyediHatarido':
                    echo json_encode($this->createEgyediHatarido($this->resolveKerelmezo($request)['ceg_id'], $request['datum'], $request['leiras']));
                    return;
                case 'getEsemenyek':
                    echo json_encode($this->getEsemenyek($this->resolveSajatCegId($request)));
                    return;
                case 'sendAjanlatkeres':
                    $this->saveAjanlatkeres('ajanlatkeres', $request['name'], $request['email'], $request['phone'], $request['message']);
                    echo json_encode($emailInterface->sendAjanlatkeres($request['name'], $request['email'], $request['phone'], $request['message']));
                    return;
                case 'sendJelentkezes':
                    $this->saveAjanlatkeres('jelentkezes', $request['name'], $request['email'], $request['phone'], $request['message']);
                    echo json_encode($emailInterface->sendJelentkezes($request['name'], $request['email'], $request['phone'], $request['message']));
                    return;
                case 'saveAdminData':
                    // Csak a SAJÁT profil szerkeszthető ("Saját adatok"
                    // oldal) — az `id`-t és a `szerepkor`-t szándékosan a
                    // szerver-oldalon feloldott munkamenetből vesszük, nem a
                    // kliens kéréséből, különben bármely bejelentkezett
                    // csapattag módosíthatná más (akár másik cégbeli) admin
                    // fiók adatait és szerepkörét is. Más csapattag
                    // szerepkörének módosítására a külön, admin-only
                    // `updateCsapattagSzerepkor` akció való.
                    $kerelmezo = $this->resolveKerelmezo($request);
                    echo json_encode($this->saveAdminData(
                        $kerelmezo['id'],
                        $request['name'],
                        $request['email'],
                        $request['phone'],
                        $request['szul_datum'],
                        $request['szemelyi'],
                        $request['varos'],
                        $request['irsz'],
                        $request['cim'],
                        $request['szemelyi_lejarat'],
                        $request['jogsi_lejarat'],
                        $request['gki_lejarat'],
                        $request['adr_lejarat'],
                        $kerelmezo['szerepkor'],
                        $request['cegnev'] ?? null,
                        $kerelmezo['is_root']
                    ));

                    return;
            }
        } catch (\Throwable $e) {
            // `\Throwable`, NEM csak `Exception` — egy váratlan PHP `Error`/
            // `TypeError` (pl. ha egy mező, aminek scalarnak kellene lennie,
            // tömbként/objektumként érkezik a JSON body-ban, és ezt egy
            // `array_key_exists()`/hasonló hívás Errorral utasítja el) enélkül
            // kezeletlen fatal errorként törte meg a JSON-választ — akár
            // hitelesítés (bejelentkezés) nélkül is kiváltható volt, mivel a
            // `validation()` legelején, a session-ellenőrzés előtt
            // következett be (ld. biztonsági audit).
            $message = ["error" => true, "message" => $e->getMessage()];
            echo json_encode($message);
        }
    }
    private function getEgyediHataridok($id, $search = null, $page = null, $pageSize = null) {
        try {
            $params = [':id' => $id];
            $query = "SELECT * FROM egyedi_hataridok WHERE admin = :id AND torolt <> 'I'";
            if (!empty($search)) {
                $query .= " AND " . PaginationHelper::likeClause(['leiras'], 'search');
                $params[':search'] = '%' . $search . '%';
            }
            $query .= " ORDER BY datum ASC";

            if ($page !== null) {
                [$hataridok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
                return ['success' => true, 'esemenyek' => $hataridok, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
            }

            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $hataridok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'esemenyek' => $hataridok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    // `$ceg_id` nélkül bármely bejelentkezett felhasználó módosíthatna
    // egy másik cég naptár-bejegyzését a `sorszam` eltalálásával/
    // végigpróbálásával — ezért a WHERE feltételbe is bekerül, és a
    // `rowCount()`-ot is ellenőrizzük, hogy a hívó tényleg értesüljön,
    // ha a bejegyzés nem a sajátja (vagy nem is létezik).
    private function updateEgyediHatarido($id, $datum, $leiras, $ceg_id) {
        try {
            $query = "UPDATE egyedi_hataridok SET datum = :datum, leiras = :leiras WHERE sorszam = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->bindParam(':datum', $datum);
            $stmt->bindParam(':leiras', $leiras);
            $stmt->bindParam(':ceg_id', $ceg_id);
            $stmt->execute();
            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A bejegyzés nem található, vagy nem a te céged bejegyzése.'];
            }

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    private function createEgyediHatarido($id, $datum, $leiras) {
        try {
            $query = "INSERT INTO egyedi_hataridok (admin, datum, leiras) VALUES (:admin, :datum, :leiras)";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':admin', $id);
            $stmt->bindParam(':datum', $datum);
            $stmt->bindParam(':leiras', $leiras);
            $stmt->execute();

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    private function deleteEgyediHatarido($id, $ceg_id) {
        try {
            $query = "UPDATE egyedi_hataridok SET torolt = 'I' WHERE sorszam = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->bindParam(':ceg_id', $ceg_id);
            $stmt->execute();
            if ($stmt->rowCount() === 0) {
                return ['success' => false, 'message' => 'A bejegyzés nem található, vagy nem a te céged bejegyzése.'];
            }

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    private function getEsemenyek($id) {
        try {
            $data = [];

            // Sofőr események
            $query = "SELECT name as leiras,szemelyi_lejarat, jogsi_lejarat, gki_lejarat, adr_lejarat FROM user WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $sofor_esemenyek = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($sofor_esemenyek) {
                $data = array_merge($data, $this->formatEvents($sofor_esemenyek, [
                    'szemelyi_lejarat' => 'Személyi igazolvány lejárat',
                    'jogsi_lejarat' => 'Jogosítvány lejárat',
                    'gki_lejarat' => 'Gépjármű-kötelező biztosítás lejárat',
                    'adr_lejarat' => 'ADR igazolvány lejárat'
                ]));
            }

            // Kamion események
            $query = "SELECT rendszam as leiras,muszaki_lejarat, porolto_lejarat, porolto_lejarat_2, adr_lejarat, taograf_illesztes, emelohatfal_vizsga, kot_biztositas, kot_biz_utem, kaszko_biztositas, kaszko_fizetesi_utem FROM kamion WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $kamion_esemenyek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if ($kamion_esemenyek) {
                foreach ($kamion_esemenyek as $kamion) {
                    $formattedEvents = $this->formatEvents($kamion, [
                        'muszaki_lejarat' => 'Műszaki vizsga lejárat',
                        'porolto_lejarat' => 'Poroltó lejárat (1)',
                        'porolto_lejarat_2' => 'Poroltó lejárat (2)',
                        'adr_lejarat' => 'ADR igazolvány lejárat',
                        'taograf_illesztes' => 'Tachográf illesztés',
                        'emelohatfal_vizsga' => 'Emelőhátsófal vizsga',
                        'kot_biztositas' => 'Kötélzet biztosítás lejárat'
                    ]);

                    // Kötélzet biztosítás fizetési ütemek hozzáadása
                    if ($kamion['kot_biztositas'] && $kamion['kot_biz_utem'] && $kamion['kot_biz_utem'] !== 'Nincs') {
                        $nextPaymentDate = $this->calculateNextPaymentDate($kamion['kot_biztositas'], $kamion['kot_biz_utem']);
                        if ($nextPaymentDate) {
                            $formattedEvents[] = [
                                'start' => $nextPaymentDate,
                                'end' => $nextPaymentDate,
                                'title' => 'Kötélzet biztosítás fizetési ütem (' . $kamion['kot_biz_utem'] . ')'
                            ];
                        }
                    }

                    // Kaszkó biztosítás hozzáadása
                    if ($kamion['kaszko_biztositas']) {
                        $formattedEvents[] = [
                            'start' => $kamion['kaszko_biztositas'],
                            'end' => $kamion['kaszko_biztositas'],
                            'title' => 'Kaszkozó biztosítás lejárat'
                        ];
                    }

                    // Kaszkó fizetési ütemek hozzáadása
                    if ($kamion['kaszko_biztositas'] && $kamion['kaszko_fizetesi_utem'] && $kamion['kaszko_fizetesi_utem'] !== 'Nincs') {
                        $nextPaymentDate = $this->calculateNextPaymentDate($kamion['kaszko_biztositas'], $kamion['kaszko_fizetesi_utem']);
                        if ($nextPaymentDate) {
                            $formattedEvents[] = [
                                'start' => $nextPaymentDate,
                                'end' => $nextPaymentDate,
                                'title' => 'Kaszkozó biztosítás fizetési ütem (' . $kamion['kaszko_fizetesi_utem'] . ')'
                            ];
                        }
                    }

                    $data = array_merge($data, $formattedEvents);
                }
            }

            // Pótkocsi események
            $query = "SELECT rendszam as leiras,muszaki_lejarat, porolto_lejarat, porolto_lejarat_2, adr_lejarat, taograf_illesztes, emelohatfal_vizsga, kot_biztositas, kot_biz_utem, kaszko_biztositas, kaszko_fizetesi_utem FROM potkocsi WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $potkocsi_esemenyek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if ($potkocsi_esemenyek) {
                foreach ($potkocsi_esemenyek as $potkocsi) {
                    $formattedEvents = $this->formatEvents($potkocsi, [
                        'muszaki_lejarat' => 'Műszaki vizsga lejárat',
                        'porolto_lejarat' => 'Poroltó lejárat (1)',
                        'porolto_lejarat_2' => 'Poroltó lejárat (2)',
                        'adr_lejarat' => 'ADR igazolvány lejárat',
                        'taograf_illesztes' => 'Tachográf illesztés',
                        'emelohatfal_vizsga' => 'Emelőhátsófal vizsga',
                        'kot_biztositas' => 'Kötélzet biztosítás lejárat'
                    ]);

                    // Kötélzet biztosítás fizetési ütemek hozzáadása
                    if ($potkocsi['kot_biztositas'] && $potkocsi['kot_biz_utem'] && $potkocsi['kot_biz_utem'] !== 'Nincs') {
                        $nextPaymentDate = $this->calculateNextPaymentDate($potkocsi['kot_biztositas'], $potkocsi['kot_biz_utem']);
                        if ($nextPaymentDate) {
                            $formattedEvents[] = [
                                'start' => $nextPaymentDate,
                                'end' => $nextPaymentDate,
                                'title' => 'Kötélzet biztosítás fizetési ütem (' . $potkocsi['kot_biz_utem'] . ')'
                            ];
                        }
                    }

                    // Kaszkó biztosítás hozzáadása
                    if ($potkocsi['kaszko_biztositas']) {
                        $formattedEvents[] = [
                            'start' => $potkocsi['kaszko_biztositas'],
                            'end' => $potkocsi['kaszko_biztositas'],
                            'title' => 'Kaszkozó biztosítás lejárat'
                        ];
                    }

                    // Kaszkó fizetési ütemek hozzáadása
                    if ($potkocsi['kaszko_biztositas'] && $potkocsi['kaszko_fizetesi_utem'] && $potkocsi['kaszko_fizetesi_utem'] !== 'Nincs') {
                        $nextPaymentDate = $this->calculateNextPaymentDate($potkocsi['kaszko_biztositas'], $potkocsi['kaszko_fizetesi_utem']);
                        if ($nextPaymentDate) {
                            $formattedEvents[] = [
                                'start' => $nextPaymentDate,
                                'end' => $nextPaymentDate,
                                'title' => 'Kaszkozó biztosítás fizetési ütem (' . $potkocsi['kaszko_fizetesi_utem'] . ')'
                            ];
                        }
                    }

                    $data = array_merge($data, $formattedEvents);
                }
            }

            // Furgon események — a furgon önhajtó jármű, mint a kamion,
            // ugyanazokkal a lejárati oszlopokkal, de korábban teljesen
            // hiányzott ebből a feedből (ld. biztonsági/logikai audit:
            // egy furgon lejáró műszakija/ADR-je/biztosítása csendben,
            // hibaüzenet nélkül láthatatlan maradt).
            $query = "SELECT rendszam as leiras,muszaki_lejarat, porolto_lejarat, porolto_lejarat_2, adr_lejarat, taograf_illesztes, emelohatfal_vizsga, kot_biztositas, kot_biz_utem, kaszko_biztositas, kaszko_fizetesi_utem FROM furgon WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $furgon_esemenyek = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if ($furgon_esemenyek) {
                foreach ($furgon_esemenyek as $furgon) {
                    $formattedEvents = $this->formatEvents($furgon, [
                        'muszaki_lejarat' => 'Műszaki vizsga lejárat',
                        'porolto_lejarat' => 'Poroltó lejárat (1)',
                        'porolto_lejarat_2' => 'Poroltó lejárat (2)',
                        'adr_lejarat' => 'ADR igazolvány lejárat',
                        'taograf_illesztes' => 'Tachográf illesztés',
                        'emelohatfal_vizsga' => 'Emelőhátsófal vizsga',
                        'kot_biztositas' => 'Kötélzet biztosítás lejárat'
                    ]);

                    if ($furgon['kot_biztositas'] && $furgon['kot_biz_utem'] && $furgon['kot_biz_utem'] !== 'Nincs') {
                        $nextPaymentDate = $this->calculateNextPaymentDate($furgon['kot_biztositas'], $furgon['kot_biz_utem']);
                        if ($nextPaymentDate) {
                            $formattedEvents[] = [
                                'start' => $nextPaymentDate,
                                'end' => $nextPaymentDate,
                                'title' => 'Kötélzet biztosítás fizetési ütem (' . $furgon['kot_biz_utem'] . ')'
                            ];
                        }
                    }

                    if ($furgon['kaszko_biztositas']) {
                        $formattedEvents[] = [
                            'start' => $furgon['kaszko_biztositas'],
                            'end' => $furgon['kaszko_biztositas'],
                            'title' => 'Kaszkozó biztosítás lejárat'
                        ];
                    }

                    if ($furgon['kaszko_biztositas'] && $furgon['kaszko_fizetesi_utem'] && $furgon['kaszko_fizetesi_utem'] !== 'Nincs') {
                        $nextPaymentDate = $this->calculateNextPaymentDate($furgon['kaszko_biztositas'], $furgon['kaszko_fizetesi_utem']);
                        if ($nextPaymentDate) {
                            $formattedEvents[] = [
                                'start' => $nextPaymentDate,
                                'end' => $nextPaymentDate,
                                'title' => 'Kaszkozó biztosítás fizetési ütem (' . $furgon['kaszko_fizetesi_utem'] . ')'
                            ];
                        }
                    }

                    $data = array_merge($data, $formattedEvents);
                }
            }

            // Egyedi határidők
            $query = "SELECT leiras, datum FROM egyedi_hataridok WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $egyedi_hataridok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if ($egyedi_hataridok) {
                foreach ($egyedi_hataridok as $hatarido) {
                    if ($hatarido['datum']) {
                        $data[] = [
                            'start' => $hatarido['datum'],
                            'end' => $hatarido['datum'],
                            'title' => $hatarido['leiras']
                        ];
                    }
                }
            }

            // Kamion karbantartás események
            $query = "
                    SELECT 
                        k.rendszam AS leiras_prefix,
                        kk.log,
                        kk.datum
                    FROM kamion_karbantartars kk
                    INNER JOIN kamion k ON k.id = kk.kamion_id
                    WHERE k.admin = :id
                    AND kk.torolt <> 'I'
                    AND k.torolt <> 'I'
                ";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $kamion_karbantartasok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if ($kamion_karbantartasok) {
                foreach ($kamion_karbantartasok as $item) {
                    if ($item['datum']) {
                        $data[] = [
                            'start' => $item['datum'],
                            'end'   => $item['datum'],
                            'title' => $item['leiras_prefix'] . ' – ' . $item['log']
                        ];
                    }
                }
            }

            // Pótkocsi karbantartás események
            $query = "
                    SELECT 
                        p.rendszam AS leiras_prefix,
                        pk.log,
                        pk.datum
                    FROM potkocsi_karbantartars pk
                    INNER JOIN potkocsi p ON p.id = pk.potkocsi_id
                    WHERE p.admin = :id
                    AND pk.torolt <> 'I'
                    AND p.torolt <> 'I'
                ";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $potkocsi_karbantartasok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if ($potkocsi_karbantartasok) {
                foreach ($potkocsi_karbantartasok as $item) {
                    if ($item['datum']) {
                        $data[] = [
                            'start' => $item['datum'],
                            'end'   => $item['datum'],
                            'title' => $item['leiras_prefix'] . ' – ' . $item['log']
                        ];
                    }
                }
            }

            // Furgon karbantartás események
            $query = "
                    SELECT
                        f.rendszam AS leiras_prefix,
                        fk.log,
                        fk.datum
                    FROM furgon_karbantartars fk
                    INNER JOIN furgon f ON f.id = fk.furgon_id
                    WHERE f.admin = :id
                    AND fk.torolt <> 'I'
                    AND f.torolt <> 'I'
                ";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $furgon_karbantartasok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if ($furgon_karbantartasok) {
                foreach ($furgon_karbantartasok as $item) {
                    if ($item['datum']) {
                        $data[] = [
                            'start' => $item['datum'],
                            'end'   => $item['datum'],
                            'title' => $item['leiras_prefix'] . ' – ' . $item['log']
                        ];
                    }
                }
            }

            return ['success' => true, 'data' => $data];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    private function calculateNextPaymentDate($startDate, $frequency) {
        if (!$startDate || !$frequency || $frequency === 'Nincs') {
            return null;
        }

        $start = new DateTime($startDate);
        $now = new DateTime();

        // Ha a kezdő dátum a jövőben van, akkor azt adjuk vissza
        if ($start > $now) {
            return $this->getPeriodEndDate($start, $frequency);
        }

        $interval = null;
        switch ($frequency) {
            case 'Negyed év':
                $interval = new DateInterval('P3M');
                break;
            case 'Fél év':
                $interval = new DateInterval('P6M');
                break;
            case 'Éves':
                $interval = new DateInterval('P1Y');
                break;
            default:
                return null;
        }

        // Kiszámoljuk a következő esedékes időszak végét
        $periodStart = clone $start;
        $periodEnd = $this->getPeriodEndDate($periodStart, $frequency);

        while (new DateTime($periodEnd) <= $now) {
            $periodStart->add($interval);
            $periodEnd = $this->getPeriodEndDate($periodStart, $frequency);
        }

        return $periodEnd;
    }

    private function getPeriodEndDate(DateTime $startDate, $frequency) {
        $endDate = clone $startDate;

        switch ($frequency) {
            case 'Negyed év':
                $endDate->add(new DateInterval('P3M'));
                $endDate->sub(new DateInterval('P1D')); // 3 hónap múlva -1 nap
                break;
            case 'Fél év':
                $endDate->add(new DateInterval('P6M'));
                $endDate->sub(new DateInterval('P1D')); // 6 hónap múlva -1 nap
                break;
            case 'Éves':
                $endDate->add(new DateInterval('P1Y'));
                $endDate->sub(new DateInterval('P1D')); // 1 év múlva -1 nap
                break;
            default:
                return null;
        }

        return $endDate->format('Y-m-d');
    }

    /**
     * Segédfüggvény az események formázásához.
     *
     * @param array $events Az események tömbje.
     * @param array $labels Az eseményekhez tartozó feliratok.
     * @return array Formázott események tömbje.
     */
    private function formatEvents($events, $labels) {
        $formattedEvents = [];
        foreach ($events as $key => $value) {
            $leiras = $events['leiras'];
            if ($key != "leiras" && $value && isset($labels[$key])) {
                $formattedEvents[] = [
                    'start' => $value,
                    'end' => $value,
                    'title' => $leiras . " " . $labels[$key]
                ];
            }
        }
        return $formattedEvents;
    }
    // Diszpécser gyorshívó gombhoz — csak a név+telefon, semmi más
    // admin-adat nem kell a sofőr oldalára.
    private function getAdminElerhetoseg($id) {
        try {
            $query = "SELECT name, phone FROM admin WHERE id = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $admin = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$admin) {
                return ['success' => false, 'message' => 'Nem található admin.'];
            }
            return ['success' => true, 'name' => $admin['name'], 'phone' => $admin['phone']];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function getSum($id) {
        try {
            $query = "SELECT IFNULL(COUNT(id),0) as id FROM user WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $sum_soforok = $stmt->fetch(PDO::FETCH_ASSOC)['id'];

            $query = "SELECT IFNULL(COUNT(id),0) as id FROM kamion WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $sum_kamion = $stmt->fetch(PDO::FETCH_ASSOC)['id'];

            $query = "SELECT IFNULL(COUNT(id),0) as id FROM potkocsi WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $sum_potkocsi = $stmt->fetch(PDO::FETCH_ASSOC)['id'];

            $query = "SELECT IFNULL(COUNT(id),0) as id FROM furgon WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $sum_furgon = $stmt->fetch(PDO::FETCH_ASSOC)['id'];


            $currentMonthStart = new DateTime('first day of this month'); // Az aktuális hónap első napja
            $currentMonthEnd = new DateTime('last day of this month');   // Az aktuális hónap utolsó napja

            // Lekérjük az összes eseményt
            $esemenyek = $this->getEsemenyek($id);
            if (!$esemenyek['success']) {
                $sum_hatarido = 0;
            } else {
                /*$osszes_datum = $esemenyek['data'];

                  // Szűrjük ki azokat a dátumokat, amelyek az aktuális hónapban vannak
                $szurt_datumok = array_filter($osszes_datum, function($datum) use ($currentMonthStart, $currentMonthEnd) {
                    $date = new DateTime($datum['start']); // Feltételezzük, hogy a 'start' tartalmazza a dátumot
                    return ($date >= $currentMonthStart && $date <= $currentMonthEnd);
                });*/
                $osszes_datum = $esemenyek['data'];

                // Szűrjük ki azokat a dátumokat, amelyek az aktuális hónapban vannak
                $szurt_datumok = [];
                foreach ($osszes_datum as $datum) {
                    try {
                        // Ellenőrizzük, hogy a dátum érvényes-e
                        $date = new DateTime($datum['start']); // Feltételezzük, hogy a 'start' tartalmazza a dátumot
                        if ($date >= $currentMonthStart && $date <= $currentMonthEnd) {
                            $szurt_datumok[] = $datum;
                        }
                    } catch (Exception $e) {
                        continue;
                    }
                }


                // Az adott hónapban lejáró határidők száma
                $sum_hatarido = count($szurt_datumok);
            }

            return ['success' => true, 'sofor' => $sum_soforok, 'kamion' => $sum_kamion, 'potkocsi' => $sum_potkocsi, 'furgon' => $sum_furgon, 'hatarido' => $sum_hatarido];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    function getHataridok($id) {
        return "0";
    }

    // Brute-force elleni védelem (ld. backend/sql/26.sql): a jelszó
    // ellenőrzése előtt megnézzük, nincs-e a fiók ideiglenesen zárolva;
    // sikeres bejelentkezéskor a számláló nullázódik, sikertelennél nő, és
    // `MAX_LOGIN_PROBALKOZAS` elérésekor a fiók `ZAROLAS_PERC` percre
    // zárolódik. Szándékosan a fiókhoz (nem IP-hez) kötött — egyszerűbb,
    // és nem igényel külön IP-nyilvántartó táblát.
    const MAX_LOGIN_PROBALKOZAS = 5;
    const ZAROLAS_PERC = 15;

    private function loginUser($email, $password) {
        $user = $this->getUser($email);
        $tabla = (!empty($user) && $user['is_admin']) ? 'admin' : 'user';

        if (!empty($user) && !empty($user['zarolva_eddig']) && strtotime($user['zarolva_eddig']) > time()) {
            return ['success' => false, 'message' => 'Túl sok sikertelen bejelentkezési kísérlet történt — próbáld újra ' . self::ZAROLAS_PERC . ' perc múlva.'];
        }

        if (!empty($user) && password_verify($password, $user['password'])) {
            $stmt = $this->db->prepare("UPDATE `$tabla` SET sikertelen_probalkozasok = 0, zarolva_eddig = NULL WHERE id = :id");
            $stmt->bindValue(':id', $user['id']);
            $stmt->execute();

            $token = bin2hex(random_bytes(32));
            $stmt = $this->db->prepare("INSERT INTO sessions (token, felhasznalo_tipus, felhasznalo_id, lejarat) VALUES (:token, :tipus, :id, DATE_ADD(NOW(), INTERVAL 30 DAY))");
            $stmt->bindValue(':token', $token);
            $stmt->bindValue(':tipus', $user['is_admin'] ? 'admin' : 'sofor');
            $stmt->bindValue(':id', $user['id']);
            $stmt->execute();

            // A `getUser()` szándékosan `SELECT *`-ot használ (ld. ott a
            // komment egy korábbi, ehhez kapcsolódó hibáról) — a jelszó-
            // hash-re csak a fenti `password_verify()`-hoz volt szükség,
            // a kliensnek soha nem kellene visszakapnia, ezért itt, a
            // válasz összeállítása előtt töröljük.
            unset($user['password']);
            return ['success' => true, 'user' => $user, 'token' => $token];
        }

        if (!empty($user)) {
            $ujSzam = (int) $user['sikertelen_probalkozasok'] + 1;
            if ($ujSzam >= self::MAX_LOGIN_PROBALKOZAS) {
                $stmt = $this->db->prepare("UPDATE `$tabla` SET sikertelen_probalkozasok = 0, zarolva_eddig = DATE_ADD(NOW(), INTERVAL " . self::ZAROLAS_PERC . " MINUTE) WHERE id = :id");
                $stmt->bindValue(':id', $user['id']);
            } else {
                $stmt = $this->db->prepare("UPDATE `$tabla` SET sikertelen_probalkozasok = :szam WHERE id = :id");
                $stmt->bindValue(':szam', $ujSzam);
                $stmt->bindValue(':id', $user['id']);
            }
            $stmt->execute();
        }

        return ['success' => false, 'message' => 'Login failed. Incorrect email or password.'];
    }

    // A korábbi session_start()/session_unset() vestigiális volt — sehol
    // máshol a kódbázisban nem indult PHP natív session, tehát ez a hívás
    // ténylegesen semmit nem törölt. Mostantól a valódi, adatbázisban
    // tárolt `sessions` sort töröljük a kapott tokenhez. Szándékosan NEM
    // hívunk requireValidSession()-t itt (a logoutUser a PUBLIC_ACTIONS
    // része) — egy már lejárt/érvénytelen tokennel is sikeresnek kell
    // tűnjön a kijelentkezés a kliens felől, hogy a helyi állapot mindig
    // tisztán törölhető legyen.
    private function logoutUser($sessionToken) {
        if (!empty($sessionToken)) {
            $stmt = $this->db->prepare("DELETE FROM sessions WHERE token = :token");
            $stmt->bindValue(':token', $sessionToken);
            $stmt->execute();
        }
        return ['success' => true, 'message' => 'Successfully logged out.'];
    }

    // R52 (fejlesztési audit, 2026-07-19): a WebAuthn-folyamat két, `loginUser()`-
    // hez hasonló, de attól elkülönített segédmetódusa. A dev (localhost:3000)
    // és éles (szikora-transz.hu) frontend külön origin, ezért a hitelesítő
    // regisztrációja/érvényessége is deployment-specifikus — ez az allowlist
    // engedi mindkettőt anélkül, hogy a rp.id-t kézzel kelljen konfigurálni.
    const WEBAUTHN_ALLOWED_ORIGINS = ['http://localhost:3000', 'https://szikora-transz.hu'];

    private function getSajatSoforAdatok($soforId) {
        $stmt = $this->db->prepare("SELECT id, name, email FROM user WHERE id = :id AND torolt <> 'I'");
        $stmt->bindValue(':id', $soforId, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function getSoforByEmailWebauthnhoz($email) {
        $stmt = $this->db->prepare("SELECT id FROM user WHERE email = :email AND torolt <> 'I'");
        $stmt->bindValue(':email', $email);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Ugyanaz a session-létrehozási minta, mint `loginUser()`-ben — a
    // WebAuthn-ellenőrzés már megtörtént a hívó oldalon (verifyAuthentication),
    // ez csak a sikeres eredményt fordítja le a frontend által elvárt,
    // `loginUser()`-rel azonos válasz-alakra ({success, user, token}).
    private function keszitsSessiontSofornek($soforId) {
        $stmt = $this->db->prepare("SELECT * FROM user WHERE id = :id AND torolt <> 'I'");
        $stmt->bindValue(':id', $soforId, PDO::PARAM_INT);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) {
            return ['success' => false, 'message' => 'A sofőr fiók nem található.'];
        }
        $user['is_admin'] = false;
        unset($user['password']);

        $token = bin2hex(random_bytes(32));
        $stmt = $this->db->prepare("INSERT INTO sessions (token, felhasznalo_tipus, felhasznalo_id, lejarat) VALUES (:token, 'sofor', :id, DATE_ADD(NOW(), INTERVAL 30 DAY))");
        $stmt->bindValue(':token', $token);
        $stmt->bindValue(':id', $soforId, PDO::PARAM_INT);
        $stmt->execute();

        return ['success' => true, 'user' => $user, 'token' => $token];
    }

    // A `szerepkor` mező szándékosan tisztán tájékoztató jellegű — nem
    // korlátoz semmilyen menüpontot vagy műveletet. Egy céghez több
    // admin-fiók is tartozhat (ld. backend/sql/6.sql, CsapatInterface),
    // de közöttük nincs jogosultsági különbségtétel: mindenki, aki egy
    // céghez tartozik, ugyanazt látja/szerkeszti.
    // `$isRoot` — whole-branch-review Minor finding: a `cegnev` mező a UI-n
    // (`CardSettings.js`) csak root/tulajdonos adminnak látszik, de a
    // backend eddig bármelyik csapattag munkamenetéből érkező
    // `saveAdminData` híváson feltétel nélkül felülírta — egy nem-root
    // csapattag kérése emiatt csendben átírhatta a cég nevét mindenki
    // számára. A `cegnev = CASE WHEN :is_root THEN :cegnev ELSE cegnev END`
    // ág nem-root hívónál változatlanul hagyja a meglévő DB-értéket
    // (nincs hozzá extra SELECT sem szükséges), root hívónál változatlanul
    // felülírja — ugyanaz a "resolve server-side, never trust client" elv,
    // mint a `ceg_id`/`kerelmezo_id`-nél, `$isRoot` is a szerver-oldalon
    // feloldott `resolveKerelmezo()['is_root']`-ból jön, sosem a kliens
    // kérésből.
    private function saveAdminData($id, $name, $email, $phone, $szul_datum, $szemelyi, $varos, $irsz, $cim, $szemelyi_lejarat, $jogsi_lejarat, $gki_lejarat, $adr_lejarat, $szerepkor = 'admin', $cegnev = null, $isRoot = false) {
        try {
            $query = "UPDATE admin
                      SET name = :name,
                          cegnev = CASE WHEN :is_root THEN :cegnev ELSE cegnev END,
                          email = :email,
                          phone = :phone,
                          szul_datum = :szul_datum,
                          szemelyi = :szemelyi,
                          varos = :varos,
                          irsz = :irsz,
                          cim = :cim,
                          szemelyi_lejarat = :szemelyi_lejarat,
                          jogsi_lejarat = :jogsi_lejarat,
                          gki_lejarat = :gki_lejarat,
                          adr_lejarat = :adr_lejarat,
                          szerepkor = :szerepkor
                      WHERE id = :id";

            $stmt = $this->db->prepare($query);

            // Paraméterek kötése
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':name', $name, PDO::PARAM_STR);
            $stmt->bindValue(':is_root', $isRoot ? 1 : 0, PDO::PARAM_INT);
            $stmt->bindParam(':cegnev', $cegnev, PDO::PARAM_STR);
            $stmt->bindParam(':email', $email, PDO::PARAM_STR);
            $stmt->bindParam(':phone', $phone, PDO::PARAM_STR);
            $stmt->bindParam(':szul_datum', $szul_datum, PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi', $szemelyi, PDO::PARAM_STR);
            $stmt->bindParam(':varos', $varos, PDO::PARAM_STR);
            $stmt->bindParam(':irsz', $irsz, PDO::PARAM_STR);
            $stmt->bindParam(':cim', $cim, PDO::PARAM_STR);
            $stmt->bindParam(':szemelyi_lejarat', $szemelyi_lejarat, PDO::PARAM_STR);
            $stmt->bindParam(':jogsi_lejarat', $jogsi_lejarat, PDO::PARAM_STR);
            $stmt->bindParam(':gki_lejarat', $gki_lejarat, PDO::PARAM_STR);
            $stmt->bindParam(':adr_lejarat', $adr_lejarat, PDO::PARAM_STR);
            $stmt->bindParam(':szerepkor', $szerepkor, PDO::PARAM_STR);

            // Lekérdezés végrehajtása
            $stmt->execute();
            $user = $this->getUser($email);
            unset($user['password']); // ld. loginUser() azonos komment
            return ['success' => true, 'user' => $user];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    private function getUser($email) {
        $query = "SELECT *,true as admin FROM admin WHERE email = :email AND torolt <> 'I'";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (empty($user)) {
            // FONTOS: itt SZÁNDÉKOSAN nincs `,false as admin` a SELECT-ben
            // (ahogy korábban volt). A `user` tábla saját `admin` oszlopa
            // MÁR a valós tulajdonos-cég FK-ja (amit a driver-oldali kód
            // szinte mindenhol — Dashboard.js, JarmuValaszto.js, Tankolas.js
            // stb. — céges azonosítóként használ). Egy `,false as admin`
            // névütközést okozott volna: PDO a duplikált oszlopnévnél az
            // UTOLSÓT tartja meg, tehát a valós FK-t egy szó szerinti
            // `false`-ra írta volna felül. Ez okozta azt a hibát, hogy
            // bejelentkezés UTÁN azonnal minden `getKamionok`/`getPotkocsik`
            // hívás (amik `user.admin`-t küldik cég-azonosítóként) üres/
            // rossz flottát kapott vissza — egészen addig, amíg egy
            // `getSajatSofor` hívás (tiszta `SELECT *`, ütközés nélkül)
            // felül nem írta a sessionStorage-ban tárolt `user`-t a helyes
            // értékkel (pl. a Jármű-választó megnyitásakor).
            $query = "SELECT * FROM user WHERE email = :email AND torolt <>'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':email', $email);
            $stmt->execute();
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($user) {
                // Külön, ütközésmentes mező jelzi, hogy ez sofőr-fiók — a
                // korábbi `admin` mező erre a célra már foglalt (ld. fent).
                $user['is_admin'] = false;
            }
            return $user;
        }

        $user['is_admin'] = true;

        // Több admin-fiók tartozhat egy céghez (ld. backend/sql/6.sql) —
        // a flotta-adatok mindig a cég "gyökér" admin id-ja (ceg_id) alá
        // vannak elmentve, ezt kell a frontendnek használnia `id` helyett
        // minden lekérdezésnél/létrehozásnál.
        $user['ceg_id'] = !empty($user['tulajdonos_admin_id']) ? $user['tulajdonos_admin_id'] : $user['id'];

        return $user;
    }

    // Módosítási előzmény / audit log — a séma többi táblájának nincs
    // semmilyen történeti nyoma (MyISAM, nincs trigger), ez az első
    // lépés efelé. Csendben elnyeli a hibát, hogy egy naplózási gond
    // sose akassza meg a tényleges műveletet.
    private function logAudit($adminId, $tabla, $rowId, $muvelet, $leiras = null) {
        if (empty($adminId) || empty($rowId)) {
            return;
        }
        try {
            $query = "INSERT INTO audit_log (admin_id, kerelmezo_id, kerelmezo_nev, tabla, rowid, muvelet, leiras) VALUES (:admin_id, :kerelmezo_id, :kerelmezo_nev, :tabla, :rowid, :muvelet, :leiras)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin_id', $adminId);
            $stmt->bindValue(':kerelmezo_id', $this->aktivKerelmezoId);
            $stmt->bindValue(':kerelmezo_nev', $this->aktivKerelmezoNev);
            $stmt->bindValue(':tabla', $tabla);
            $stmt->bindValue(':rowid', $rowId);
            $stmt->bindValue(':muvelet', $muvelet);
            $stmt->bindValue(':leiras', $leiras);
            $stmt->execute();
        } catch (Exception $e) {
            error_log('Audit log mentése sikertelen: ' . $e->getMessage());
        }
    }

    // Törlés előtt lekérdezi, melyik admin (tulajdonos cég) sorához
    // tartozott a rekord — a törlő kérés (`{ id }`) önmagában nem
    // tartalmazza ezt. `$tabla` mindig a saját `process()` switch-emben
    // meghatározott, fix string, sosem a kliens kérés tartalma, ezért a
    // közvetlen behelyettesítés itt biztonságos.
    private function resolveOwnerAdmin($tabla, $rowId) {
        try {
            $stmt = $this->db->prepare("SELECT admin FROM `$tabla` WHERE id = :id");
            $stmt->bindValue(':id', $rowId);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row ? $row['admin'] : null;
        } catch (Exception $e) {
            return null;
        }
    }

    // A korábbi kőbe vésett `LIMIT 200` most csak akkor marad meg (a régi,
    // nem lapozott hívók felé változatlan viselkedést nyújtva), ha a hívó
    // nem küld `page`-et — a lapozott ág nem korlátozza mesterségesen a
    // teljes találati halmazt, a `page`/`pageSize` szabja meg, mennyi jön át.
    // A `kerelmezo_id` (ld. `aktivKerelmezoId`/`logAudit()` komment) csak a
    // konkrét admin-táblás bejelentkezés id-je — ezt PHP oldalon (a projekt
    // JOIN-mentes konvenciója szerint) fordítjuk névre, nem SQL JOIN-nal.
    // A régebbi (a mostani oszlop hozzáadása előtti) naplósoroknál ez NULL,
    // ott a frontend "—"-t mutat, nem hibázik.
    private function modositokNeveiCeghez($ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id, name FROM admin WHERE (id = :id OR tulajdonos_admin_id = :id2) AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $ceg_id);
        $stmt->bindValue(':id2', $ceg_id);
        $stmt->execute();
        $nevek = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $nevek[$row['id']] = $row['name'];
        }
        return $nevek;
    }

    private function getAuditLog($id, $search = null, $page = null, $pageSize = null) {
        try {
            $params = [':id' => $id];
            $query = "SELECT * FROM audit_log WHERE admin_id = :id";
            if (!empty($search)) {
                $query .= " AND " . PaginationHelper::likeClause(['tabla', 'leiras'], 'search');
                $params[':search'] = '%' . $search . '%';
            }
            $query .= " ORDER BY datum DESC";

            // `kerelmezo_nev` (a bevezetése óta minden sorra kitöltött
            // snapshot, sofőr-akciónál is — ld. `aktivKerelmezoNev` fenti
            // komment) az elsődleges forrás; a `nevek`-es admin-tábla-lookup
            // csak a bevezetés ELŐTTI, `kerelmezo_nev IS NULL` sorok
            // visszamenőleges kitöltésére marad meg.
            $nevek = $this->modositokNeveiCeghez($id);
            $dusit = function ($sorok) use ($nevek) {
                foreach ($sorok as &$sor) {
                    $sor['modosito_nev'] = $sor['kerelmezo_nev'] ?? ($nevek[$sor['kerelmezo_id']] ?? null);
                }
                return $sorok;
            };

            if ($page !== null) {
                [$naplo, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
                return ['success' => true, 'naplo' => $dusit($naplo), 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
            }

            $query .= " LIMIT 200";
            $stmt = $this->db->prepare($query);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();

            return ['success' => true, 'naplo' => $dusit($stmt->fetchAll(PDO::FETCH_ASSOC))];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function validateUniqueEmail($email, $id) {
        $query = "SELECT COUNT(*) FROM admin WHERE email = :email AND id != :id";
        $stmt = $this->db->prepare($query);
        $stmt->bindParam(':email', $email, PDO::PARAM_STR);
        $stmt->bindParam(':id', $id, PDO::PARAM_INT);
        $stmt->execute();
        $count = $stmt->fetchColumn();

        if ($count > 0) {
            throw new Exception('Ez az email cím már használatban van.');
        }
    }

    // A weboldali ajánlatkérés/jelentkezés űrlap eddig csak egy e-mailt
    // küldött és utána nyomtalanul eltűnt — mostantól perzisztálva is van,
    // hogy legyen egy követhető lead-lista. Szándékosan nem dobunk kivételt
    // hibánál: az e-mail küldés (a form eredeti, elsődleges funkciója) akkor
    // is menjen tovább, ha a mentés valamiért nem sikerülne.
    private function saveAjanlatkeres($tipus, $nev, $email, $telefon, $uzenet) {
        try {
            $query = "INSERT INTO ajanlatkeresek (tipus, nev, email, telefon, uzenet) VALUES (:tipus, :nev, :email, :telefon, :uzenet)";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':tipus', $tipus);
            $stmt->bindParam(':nev', $nev);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':telefon', $telefon);
            $stmt->bindParam(':uzenet', $uzenet);
            $stmt->execute();
        } catch (Exception $e) {
            error_log('Ajánlatkérés mentése sikertelen: ' . $e->getMessage());
        }
    }

    private function getAjanlatkeresek() {
        try {
            $query = "SELECT * FROM ajanlatkeresek WHERE torolt <> 'I' ORDER BY beerkezett DESC";
            $stmt = $this->db->prepare($query);
            $stmt->execute();

            return ['success' => true, 'ajanlatkeresek' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function updateAjanlatkeresStatusz($id, $statusz) {
        try {
            $query = "UPDATE ajanlatkeresek SET statusz = :statusz WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':statusz', $statusz);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // "Teendők" akció-központ (fejlesztési javaslat, 2026-07-20) — a
    // jóváhagyásra váró jármű-váltási kérelem, az új bejelentés és a friss
    // ajánlatkérés eddig 3 különböző helyen élt (haranG-értesítés, Bejelentések
    // lista, Ajánlatkérések oldal). Ez a metódus NEM gyűjt új adatot, csak a
    // meglévő 3 forrást fésüli össze egy Dashboard-kártyához, ugyanazokkal a
    // metódusokkal, amiket a haranG-értesítés is használ (getFuggoJarmuValtasok/
    // getNyitottBejelentesek) — a jóváhagyás/elutasítás a kártyáról így
    // pontosan ugyanazt az `elbiralJarmuValtas` akciót hívja, amit a Sidebar is.
    // Az ajánlatkérések (globális, nem ceg_id-s adat, ld. ADMIN_ONLY_ACTIONS
    // komment) szándékosan csak akkor kerülnek bele, ha a hívó valódi
    // admin/gyökér szerepkörű — egy korlátozott (pl. fuvarszervező) csapattag
    // ne lásson üzemeltetői marketing-leadeket a saját Dashboardján.
    private function getTeendok($ceg_id, $isAdmin) {
        global $jarmuValtasInterface, $bejelentesekInterface, $tachografInterface;
        try {
            $jarmuValtas = $jarmuValtasInterface->getFuggoJarmuValtasok($ceg_id);
            $bejelentesek = $bejelentesekInterface->getNyitottBejelentesek($ceg_id);

            $ajanlatkeresek = [];
            if ($isAdmin) {
                $osszesAjanlatkeres = $this->getAjanlatkeresek();
                if ($osszesAjanlatkeres['success']) {
                    $ajanlatkeresek = array_values(array_filter(
                        $osszesAjanlatkeres['ajanlatkeresek'],
                        fn($a) => $a['statusz'] === 'uj'
                    ));
                }
            }

            // Tachográf modul UX-újratervezés (2026-07-24) — esedékes/lejárt
            // kártya-letöltés a Teendők közé, ugyanaz az összefésülő minta,
            // mint a másik 3 forrásnál.
            $tachografLetoltesek = [];
            $megfeleloseg = $tachografInterface->getMegfelelosegiLista($ceg_id);
            if ($megfeleloseg['success']) {
                $tachografLetoltesek = array_values(array_filter(
                    $megfeleloseg['sorok'],
                    fn($s) => in_array($s['statusz'], ['esedekes', 'lejart'], true)
                ));
            }

            return [
                'success' => true,
                'jarmuValtas' => $jarmuValtas['success'] ? $jarmuValtas['kerelmek'] : [],
                'bejelentesek' => $bejelentesek['success'] ? $bejelentesek['bejelentesek'] : [],
                'ajanlatkeresek' => $ajanlatkeresek,
                'tachografLetoltesek' => $tachografLetoltesek,
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Új bejelentés-üzenetről a cég MINDEN admin-fiókját (gyökér + minden
    // csapattag) értesíti, akinek van aktív Web Push feliratkozása — a
    // driver-oldali push-infrastruktúra még nem létezik (ld. CLAUDE.md), ezért
    // ez csak a sofőr -> admin irányt fedi le. `sendPushAdminnak()` némán nem
    // csinál semmit egy nem-feliratkozott admin-nál, tehát biztonságos minden
    // csapattagra meghívni szűrés nélkül.
    private function ertesitBejelentesUjUzenetrol($ceg_id, $bejelentes_id, $szerzoNev) {
        global $pushInterface;
        try {
            $cimStmt = $this->db->prepare("SELECT cim FROM bejelentesek WHERE id = :id");
            $cimStmt->bindValue(':id', $bejelentes_id);
            $cimStmt->execute();
            $cim = $cimStmt->fetch(PDO::FETCH_ASSOC)['cim'] ?? 'Bejelentés';

            $adminStmt = $this->db->prepare(
                "SELECT id FROM admin WHERE (id = :ceg_id OR tulajdonos_admin_id = :ceg_id2) AND torolt <> 'I'"
            );
            $adminStmt->bindValue(':ceg_id', $ceg_id);
            $adminStmt->bindValue(':ceg_id2', $ceg_id);
            $adminStmt->execute();
            foreach ($adminStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $pushInterface->sendPushAdminnak($row['id'], 'Új üzenet — ' . $cim, $szerzoNev . ' írt a bejelentéshez.', '/admin/bejelentesek');
            }
        } catch (Exception $e) {
            error_log('Bejelentés-üzenet push értesítés sikertelen: ' . $e->getMessage());
        }
    }

    // R08 (fejlesztési audit, 2026-07-19): sofőrönkénti összesítő riport —
    // a fogyasztás-anomália (tankolasInterface::getFogyasztasElemzes(),
    // médián-alapú), az elmúlt 30 nap km-je (gpsmart_napi_km cache, ugyanaz
    // a forrás, mint a Pénzforgalom Ft/km oszlopáé) és a bejelentés-számok
    // (bejelentesek.sofor_id) ma három külön oldalon élnek — ez a metódus
    // NEM gyűjt új adatot, csak a meglévő három forrást fésüli össze
    // sofőrönként egy nézetbe. A km/fogyasztás mindig a sofőr JELENLEG
    // hozzárendelt járművéhez tartozik (ugyanaz a korlát, mint
    // GpsmartInterface::lekerdezPoziciok()-nál: nincs napi bontásban vezetve,
    // ki melyik járművel ment melyik napon).
    private function getSoforScorecard($ceg_id) {
        try {
            $soforStmt = $this->db->prepare("SELECT id, name, kamion, furgon FROM user WHERE admin = :admin AND torolt <> 'I' ORDER BY name ASC");
            $soforStmt->bindValue(':admin', $ceg_id);
            $soforStmt->execute();
            $soforok = $soforStmt->fetchAll(PDO::FETCH_ASSOC);

            $bejStmt = $this->db->prepare(
                "SELECT sofor_id, COUNT(*) osszes, SUM(statusz <> 'lezart') nyitott
                 FROM bejelentesek WHERE admin = :admin AND torolt <> 'I' AND sofor_id IS NOT NULL
                 GROUP BY sofor_id"
            );
            $bejStmt->bindValue(':admin', $ceg_id);
            $bejStmt->execute();
            $bejelentesSoforSzerint = [];
            foreach ($bejStmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
                $bejelentesSoforSzerint[$sor['sofor_id']] = ['osszes' => (int) $sor['osszes'], 'nyitott' => (int) $sor['nyitott']];
            }

            // Tachográf kártya-import (ld. tachografInterface.php) — sofőrönkénti
            // összesítő. A korábbi "Km (elmúlt 30 nap)" a sofőr JELENLEGI
            // jármű-hozzárendelésén át, GPSmart-adatból jött (`gpsmart_napi_km`)
            // — ez, és a korábbi, kizárólag jármű-szintű (`tankolasInterface::
            // getFogyasztasElemzes()`, a jármű TELJES tankolás-történetéből
            // számolt) átlagfogyasztás is megszűnt: mindkettőt a tachográf
            // kártya közvetlen, sofőrhöz kötött adatára cseréltük (ld. lentebb)
            // — sofőr-váltás esetén ez pontosabb, mert nem keveri bele egy
            // másik sofőr km-jét/fogyasztását.
            // UX-újratervezés (2026-07-24): mostantól TachografInterface::
            // getSoforOsszesito()-ból — ugyanaz a lekérdezés adja a Tachográf
            // modul "Sofőrök" fülét is, nem duplikáljuk kétszer ugyanazt az SQL-t.
            global $tachografInterface;
            $tachoSoforSzerint = $tachografInterface->getSoforOsszesito($ceg_id);

            // A 30 napos ablakban ténylegesen használt jármű(vek) sofőrönként
            // (a napi `jarmuvek_json`-ból, ld. TachografInterface::
            // parositJarmuvekNapra()) — enélkül nem tudnánk, melyik jármű
            // tankolásait kell ehhez a sofőrhöz számolni.
            $tachoNapokStmt = $this->db->prepare(
                "SELECT sofor_id, jarmuvek_json FROM tachograf_napi_aktivitas
                 WHERE admin = :admin AND datum >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)"
            );
            $tachoNapokStmt->bindValue(':admin', $ceg_id);
            $tachoNapokStmt->execute();
            $tachoJarmuvekSoforSzerint = [];
            foreach ($tachoNapokStmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
                $jarmuvek = json_decode($sor['jarmuvek_json'] ?? '[]', true) ?: [];
                foreach ($jarmuvek as $j) {
                    if (!empty($j['jarmu_tipus']) && !empty($j['jarmu_id'])) {
                        $tachoJarmuvekSoforSzerint[$sor['sofor_id']][$j['jarmu_tipus'] . ':' . $j['jarmu_id']] = true;
                    }
                }
            }

            // Ugyanebben a 30 napos ablakban vásárolt üzemanyag, jármű szerint.
            $tankolasStmt = $this->db->prepare(
                "SELECT kamion_id, furgon_id, SUM(liter) liter
                 FROM tankolasok
                 WHERE admin = :admin AND torolt <> 'I' AND datum >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                 GROUP BY kamion_id, furgon_id"
            );
            $tankolasStmt->bindValue(':admin', $ceg_id);
            $tankolasStmt->execute();
            $literJarmuSzerint = [];
            foreach ($tankolasStmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
                if (!empty($sor['kamion_id'])) {
                    $literJarmuSzerint['kamion:' . $sor['kamion_id']] = (float) $sor['liter'];
                } elseif (!empty($sor['furgon_id'])) {
                    $literJarmuSzerint['furgon:' . $sor['furgon_id']] = (float) $sor['liter'];
                }
            }

            // Sofőrönként: a nála (a 30 napos ablakban) használt jármű(vek)re
            // vásárolt liter / az általa (ugyanabban az ablakban, tachográf
            // szerint) vezetett km * 100 — ha egy jármű megosztott több sofőr
            // közt, ez a másik sofőr fogyasztását is beleszámítja abba a
            // járműbe; ez egy tudatos, dokumentált egyszerűsítés, nem hiba.
            $tachoFogyasztasSoforSzerint = [];
            foreach ($tachoSoforSzerint as $sid => $adat) {
                if ($adat['km30Nap'] <= 0) {
                    continue;
                }
                $liter = 0.0;
                foreach (array_keys($tachoJarmuvekSoforSzerint[$sid] ?? []) as $kulcs) {
                    $liter += $literJarmuSzerint[$kulcs] ?? 0.0;
                }
                if ($liter > 0) {
                    $tachoFogyasztasSoforSzerint[$sid] = round(($liter / $adat['km30Nap']) * 100, 2);
                }
            }

            $eredmeny = [];
            foreach ($soforok as $sofor) {
                $jarmuTipus = $sofor['kamion'] ? 'kamion' : ($sofor['furgon'] ? 'furgon' : null);
                $bej = $bejelentesSoforSzerint[$sofor['id']] ?? ['osszes' => 0, 'nyitott' => 0];
                $tacho = $tachoSoforSzerint[$sofor['id']] ?? null;

                $eredmeny[] = [
                    'sofor_id' => (int) $sofor['id'],
                    'nev' => $sofor['name'],
                    'jarmu_tipus' => $jarmuTipus,
                    'fogyasztas_atlag' => $tachoFogyasztasSoforSzerint[$sofor['id']] ?? null,
                    'bejelentes_osszes' => $bej['osszes'],
                    'bejelentes_nyitott' => $bej['nyitott'],
                    'tachograf_utolso_datum' => $tacho['utolsoDatum'] ?? null,
                    'tachograf_vezetes_perc_7nap' => $tacho['vezetesPerc7Nap'] ?? null,
                    'tachograf_km_30nap' => $tacho['km30Nap'] ?? null,
                    'tachograf_tul_ora_napok' => $tacho['tulOraNapok'] ?? null,
                ];
            }

            return ['success' => true, 'soforok' => $eredmeny];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Jelszó-visszaállítás — ma ez az egyetlen módja annak, hogy egy
    // admin/sofőr saját maga cserélje a jelszavát; korábban erre
    // egyáltalán nem volt lehetőség, csak a kódba írt megosztott
    // authHash védte az API-t.
    private function requestPasswordReset($email) {
        global $emailInterface;
        try {
            $user = $this->getUser($email);
            // Szándékosan mindig sikeres választ adunk vissza attól
            // függetlenül, hogy létezik-e ilyen e-mail cím — így a
            // felület nem árulja el, mely e-mail címek regisztráltak.
            if (empty($user)) {
                return ['success' => true];
            }

            // Rate limit — enélkül tetszőleges (akár nem is regisztrált,
            // mert az `empty($user)` ág fölött ez sosem futott le) email-
            // címre korlátlanul sokszor lehetett reset-emailt kiváltani (ld.
            // biztonsági audit). A válasz szándékosan MOST IS `success:true`
            // marad (ld. fenti komment az enumeráció elleni védelemről) —
            // a hívó nem tudja megkülönböztetni "elküldve" és "túl sok
            // kérés volt, kihagyva" között.
            $rateStmt = $this->db->prepare(
                "SELECT COUNT(*) AS db FROM jelszo_visszaallitas WHERE email = :email AND letrehozva >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)"
            );
            $rateStmt->bindValue(':email', $email);
            $rateStmt->execute();
            if ((int) $rateStmt->fetch(PDO::FETCH_ASSOC)['db'] >= 3) {
                return ['success' => true];
            }

            $token = bin2hex(random_bytes(32));

            // A lejáratot szándékosan a MySQL saját órájával (NOW()) számoljuk
            // PHP-oldali DateTime helyett — a resetPassword() is a MySQL NOW()-hoz
            // hasonlítja a lejáratot, és a két folyamat (PHP-CLI/webszerver vs.
            // DB szerver) órája/időzónája eltérhet, ami PHP-oldali számítással
            // azonnal "lejárt" tokent eredményezett volna.
            $query = "INSERT INTO jelszo_visszaallitas (email, token, lejarat) VALUES (:email, :token, DATE_ADD(NOW(), INTERVAL 1 HOUR))";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':email', $email);
            $stmt->bindParam(':token', $token);
            $stmt->execute();

            $resetUrl = "https://szikora-transz.hu/auth/jelszo-visszaallitas?token=" . $token;
            $emailInterface->sendJelszoVisszaallitas($email, $resetUrl);

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function resetPassword($token, $password) {
        try {
            $query = "SELECT * FROM jelszo_visszaallitas WHERE token = :token AND felhasznalva = 'N' AND lejarat >= NOW()";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':token', $token);
            $stmt->execute();
            $reset = $stmt->fetch(PDO::FETCH_ASSOC);

            if (empty($reset)) {
                return ['success' => false, 'message' => 'A hivatkozás érvénytelen vagy lejárt.'];
            }

            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

            $adminStmt = $this->db->prepare("UPDATE admin SET password = :password WHERE email = :email");
            $adminStmt->bindParam(':password', $hashedPassword);
            $adminStmt->bindParam(':email', $reset['email']);
            $adminStmt->execute();

            if ($adminStmt->rowCount() === 0) {
                $userStmt = $this->db->prepare("UPDATE user SET password = :password WHERE email = :email");
                $userStmt->bindParam(':password', $hashedPassword);
                $userStmt->bindParam(':email', $reset['email']);
                $userStmt->execute();
            }

            $usedStmt = $this->db->prepare("UPDATE jelszo_visszaallitas SET felhasznalva = 'I' WHERE id = :id");
            $usedStmt->bindParam(':id', $reset['id'], PDO::PARAM_INT);
            $usedStmt->execute();

            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
