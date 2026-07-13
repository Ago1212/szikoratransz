<?php
require 'db.php';
require 'interface/kamionInterface.php';
require 'interface/potkocsiInterface.php';
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
require 'interface/fuvarInterface.php';
require 'interface/ertesitesInterface.php';
require 'interface/vezetesiIdoInterface.php';
class ApiHandler {
    protected string $auth_hash;
    protected array $actions = [];
    protected $db;

    // A resolveKerelmezo()/requireValidSession() által feloldott, aktuális
    // munkamenet gyorsítótárazva — egy kérésen belül legfeljebb egyszer
    // kérdezzük le a `sessions` táblát, még ha több ellenőrzés is lefut
    // (validation() + resolveKerelmezo()).
    private ?array $session = null;

    // Ezek az akciók bejelentkezés (érvényes sessionToken) nélkül is
    // meghívhatók — a bejelentkezés maga, a jelszó-visszaállítás folyamata
    // (a felhasználó pont azért van itt, mert nincs érvényes munkamenete),
    // a nyilvános ajánlatkérő/jelentkező űrlapok, és a kijelentkezés (ami
    // egy már lejárt/érvénytelen tokennel is sikeresnek kell tűnjön a
    // kliens felől, ld. logoutUser() komment).
    const PUBLIC_ACTIONS = ['loginUser', 'logoutUser', 'requestPasswordReset', 'resetPassword', 'sendAjanlatkeres', 'sendJelentkezes'];

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
    const ADMIN_ONLY_ACTIONS = ['newCsapattag', 'updateCsapattagSzerepkor', 'deleteCsapattag', 'getJogosultsagok', 'saveJogosultsagok', 'newSzerepkor', 'deleteSzerepkor', 'newListaElem', 'updateListaElemNev', 'deleteListaElem'];

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

        'getKarbantartasok' => ['karbantartasok', 'hozzaferes'],
        'updateKarbantartas' => ['karbantartasok', 'szerkesztes'],
        'deleteKarbantartas' => ['karbantartasok', 'torles'],
        'updatePotkocsiKarbantartas' => ['karbantartasok', 'szerkesztes'],
        'deletePotkocsiKarbantartas' => ['karbantartasok', 'torles'],

        'getSoforok' => ['soforok', 'hozzaferes'],
        'newSofor' => ['soforok', 'szerkesztes'],
        'deleteSofor' => ['soforok', 'torles'],

        'getBejelentesek' => ['bejelentesek', 'hozzaferes'],
        'saveBejelentesData' => ['bejelentesek', 'szerkesztes'],
        'deleteBejelentes' => ['bejelentesek', 'torles'],
        'generateKarbantartasFromBejelentes' => ['bejelentesek', 'szerkesztes'],

        'getSzabadsagok' => ['szabadsagok', 'hozzaferes'],
        'newSzabadsag' => ['szabadsagok', 'szerkesztes'],
        'deleteSzabadsag' => ['szabadsagok', 'torles'],

        'getUgyfelek' => ['ugyfelek', 'hozzaferes'],
        'newUgyfel' => ['ugyfelek', 'szerkesztes'],
        'saveUgyfelData' => ['ugyfelek', 'szerkesztes'],
        'deleteUgyfel' => ['ugyfelek', 'torles'],

        'getAuditLog' => ['naplo', 'hozzaferes'],

        'getKoltsegOsszesito' => ['koltsegek', 'hozzaferes'],
        'getEgyebKoltsegek' => ['koltsegek', 'hozzaferes'],
        'newEgyebKoltseg' => ['koltsegek', 'szerkesztes'],
        'deleteEgyebKoltseg' => ['koltsegek', 'torles'],

        'getFuvarok' => ['fuvarok', 'hozzaferes'],
        'newFuvar' => ['fuvarok', 'szerkesztes'],
        'saveFuvarData' => ['fuvarok', 'szerkesztes'],
        'updateFuvarStatusz' => ['fuvarok', 'szerkesztes'],
        'deleteFuvar' => ['fuvarok', 'torles'],
        'updateFuvarBeosztas' => ['fuvarok', 'szerkesztes'],

        'getVezetesiOsszesito' => ['vezetesi_ido', 'hozzaferes'],
        'deleteVezetesiNaplo' => ['vezetesi_ido', 'torles'],
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
            'getSum' => ['id'],
            'getEsemenyek' => ['id'],
            'saveAdminData' => ['id'],

            'newKamion' => ['rendszam', 'kerelmezo_id'],
            'saveKamionData' => ['id', 'kerelmezo_id'],
            'getKamionok' => ['id'],
            'getKamionValaszto' => ['ceg_id'],
            'deleteKamion' => ['id', 'kerelmezo_id'],
            'getKamionRendszamok' => ['id'],

            'newPotkocsi' => ['rendszam', 'kerelmezo_id'],
            'savePotkocsiData' => ['id', 'kerelmezo_id'],
            'getPotkocsik' => ['id'],
            'deletePotkocsi' => ['id', 'kerelmezo_id'],
            'getPotkocsiRendszamok' => ['id'],

            'deleteKarbantartas' => ['id', 'kerelmezo_id'],
            'updateKarbantartas' => ['admin', 'log', 'kamion_id', 'datum', 'km_oraallas', 'elvegezte', 'kerelmezo_id'],
            'getKarbantartas' => ['kamion_id'],
            'deletePotkocsiKarbantartas' => ['id', 'kerelmezo_id'],
            'updatePotkocsiKarbantartas' => ['admin', 'log', 'potkocsi_id', 'datum', 'km_oraallas', 'elvegezte', 'kerelmezo_id'],
            'getPotkocsiKarbantartas' => ['potkocsi_id'],
            'getKarbantartasok' => ['id', 'kamion_id', 'potkocsi_id',  'datumTol', 'datumIg', 'elvegezte', 'kerelmezo_id'],

            'getSoforok' => ['id', 'kerelmezo_id'],
            'getSajatSofor' => ['id'],
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

            'getAdminElerhetoseg' => ['id'],

            'getUgyfelek' => ['id', 'kerelmezo_id'],
            'getUgyfelValaszto' => ['id'],
            'newUgyfel' => ['admin', 'nev', 'kerelmezo_id'],
            'saveUgyfelData' => ['id', 'kerelmezo_id'],
            'deleteUgyfel' => ['id', 'kerelmezo_id'],

            'getCsapattagok' => ['id'],
            'newCsapattag' => ['ceg_id', 'name', 'email', 'password', 'kerelmezo_id'],
            'updateCsapattagSzerepkor' => ['id', 'ceg_id', 'szerepkor', 'kerelmezo_id'],
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

            'getSzabadsagok' => ['id', 'kerelmezo_id'],
            'newSzabadsag' => ['admin', 'sofor_id', 'datum_tol', 'datum_ig', 'kerelmezo_id'],
            'deleteSzabadsag' => ['id', 'kerelmezo_id'],

            'getAuditLog' => ['id', 'kerelmezo_id'],

            'getKoltsegOsszesito' => ['ceg_id', 'kerelmezo_id'],
            'getEgyebKoltsegek' => ['ceg_id', 'kerelmezo_id'],
            'newEgyebKoltseg' => ['ceg_id', 'datum', 'megnevezes', 'osszeg', 'kerelmezo_id'],
            'deleteEgyebKoltseg' => ['id', 'ceg_id', 'kerelmezo_id'],

            'getFuvarok' => ['ceg_id', 'kerelmezo_id'],
            'newFuvar' => ['ceg_id', 'felrakas_cim', 'lerakas_cim', 'kerelmezo_id'],
            'saveFuvarData' => ['id', 'ceg_id', 'felrakas_cim', 'lerakas_cim', 'kerelmezo_id'],
            'updateFuvarStatusz' => ['id', 'ceg_id', 'statusz', 'kerelmezo_id'],
            'deleteFuvar' => ['id', 'ceg_id', 'kerelmezo_id'],
            'updateFuvarBeosztas' => ['id', 'ceg_id', 'kamion_id', 'felrakas_datum', 'lerakas_datum', 'kerelmezo_id'],

            'newVezetesiNaplo' => ['ceg_id', 'sofor_id', 'datum', 'vezetes_ora', 'pihenes_ora'],
            'deleteVezetesiNaplo' => ['id', 'ceg_id', 'kerelmezo_id'],
            'getSajatVezetesiNaplo' => ['sofor_id'],
            'getSajatVezetesiAllapot' => ['sofor_id'],
            'getVezetesiOsszesito' => ['ceg_id', 'kerelmezo_id'],

            'torolErtesites' => ['kulcsok', 'kerelmezo_id'],
            'getToroltErtesitesek' => ['kerelmezo_id'],

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
            'deleteListaElem' => ['id', 'ceg_id', 'kerelmezo_id'],

            'globalSearch' => ['ceg_id', 'q'],

            'requestPasswordReset' => ['email'],
            'resetPassword' => ['token', 'password'],

            'getFiles' => ['id', 'tabla'],
            'fileUpload' => ['admin', 'id', 'tabla', 'file', 'name', 'size'],
            'deleteFile' => ['id'],
            'downloadFile' => ['id'],

            'getEgyediHataridok' => ['id'],
            'updateEgyediHatarido' => ['id', 'datum', 'leiras'],
            'deleteEgyediHatarido' => ['id'],
            'createEgyediHatarido' => ['id', 'datum', 'leiras'],

            'sendAjanlatkeres' => ['name', 'email', 'phone', 'message'],
            'sendJelentkezes' => ['name', 'email', 'phone', 'message'],
        ];
    }

    private function validation(?array $request) {
        if (empty($request)) {
            throw new Exception('Request body is empty.');
        }

        $authHash = $request['authHash'];
        if ($this->auth_hash !== $authHash) {
            throw new Exception('Authorization failed.');
        }

        if (!isset($request['action']) || !array_key_exists($request['action'], $this->actions)) {
            $action = $request['action'] ?? "";
            throw new Exception("Invalid action: $action.");
        }

        foreach ($this->actions[$request['action']] as $key) {
            if (!array_key_exists($key, $request)) {
                throw new Exception("Missing parameter: $key.");
            }
        }
        if (isset($request['email']) && !filter_var($request['email'], FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Invalid email format.');
        }
        if (isset($request['email']) && isset($request['id'])) {
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

        $stmt = $this->db->prepare("SELECT felhasznalo_tipus, felhasznalo_id, lejarat FROM sessions WHERE token = :token");
        $stmt->bindValue(':token', $token);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || strtotime($row['lejarat']) < time()) {
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

    private function requireAdminRole(array $request) {
        $kerelmezo = $this->resolveKerelmezo($request);
        if (!$kerelmezo['is_root'] && $kerelmezo['szerepkor'] !== 'admin') {
            throw new Exception('Ehhez a művelethez adminisztrátori jogosultság szükséges.');
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
        global $kamionInterface, $potkocsiInterface, $soforokInterface, $filesInterface, $emailInterface, $bejelentesekInterface, $karbantartasInterface, $szabadsagInterface, $tankolasInterface, $jarmuValtasInterface, $ugyfelInterface, $csapatInterface, $helyszinInterface, $jogosultsagInterface, $szerepkorInterface, $listaInterface, $keresesInterface, $koltsegInterface, $fuvarInterface, $ertesitesInterface, $vezetesiIdoInterface;
        try {
            $this->validation($request);
            $action = $request['action'];

            switch ($action) {
                case 'loginUser':
                    echo json_encode($this->loginUser($request['email'], $request['password']));
                    return;
                case 'getSum':
                    echo json_encode($this->getSum($request['id']));
                    return;
                case 'updateUser':
                    echo json_encode($this->updateUser($request['id'], $request['nickname'], $request['birthdate'], $request['password']));
                    return;
                case 'logoutUser':
                    echo json_encode($this->logoutUser($request['sessionToken'] ?? ''));
                    return;
                case 'saveKamionData':
                    $result = $kamionInterface->saveKamionData($request);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'kamion', $request['id'], 'modositas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'newKamion':
                    $result = $kamionInterface->newKamion($request);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'kamion', $result['kamion']['id'] ?? null, 'letrehozas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'getKamionok':
                    echo json_encode($kamionInterface->getKamionok($request['id']));
                    return;
                case 'getKamionValaszto':
                    echo json_encode($kamionInterface->getKamionValaszto($request['ceg_id']));
                    return;
                case 'getKamionRendszamok':
                    echo json_encode($kamionInterface->getKamionRendszamok($request['id']));
                    return;
                case 'deleteKamion':
                    $ownerAdmin = $this->resolveOwnerAdmin('kamion', $request['id']);
                    $result = $kamionInterface->deleteKamion($request['id']);
                    if ($result['success']) {
                        $this->logAudit($ownerAdmin, 'kamion', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getKarbantartas':
                    echo json_encode($karbantartasInterface->getKamionKarbantartas($request['kamion_id']));
                    return;
                case 'updateKarbantartas':
                    echo json_encode($karbantartasInterface->updateKamionKarbantartas(isset($request['id']) ? $request['id'] : 0, $request['admin'], $request['kamion_id'], $request['datum'], $request['log'], empty($request['km_oraallas']) ? null : $request['km_oraallas'], $request['elvegezte'], $request['kovetkezo_karbantartas'], $request['koltseg'] ?? null));
                    return;
                case 'deleteKarbantartas':
                    echo json_encode($karbantartasInterface->deleteKamionKarbantartas($request['id']));
                    return;
                case 'savePotkocsiData':
                    $result = $potkocsiInterface->savePotkocsiData($request);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'potkocsi', $request['id'], 'modositas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'newPotkocsi':
                    $result = $potkocsiInterface->newPotkocsi($request);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'potkocsi', $result['potkocsi']['id'] ?? null, 'letrehozas', $request['rendszam'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deletePotkocsi':
                    $ownerAdmin = $this->resolveOwnerAdmin('potkocsi', $request['id']);
                    $result = $potkocsiInterface->deletePotkocsi($request['id']);
                    if ($result['success']) {
                        $this->logAudit($ownerAdmin, 'potkocsi', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getPotkocsik':
                    echo json_encode($potkocsiInterface->getPotkocsik($request['id']));
                    return;
                case 'getPotkocsiRendszamok':
                    echo json_encode($potkocsiInterface->getPotkocsiRendszamok($request['id']));
                    return;
                case 'getPotkocsiKarbantartas':
                    echo json_encode($karbantartasInterface->getPotkocsiKarbantartas($request['potkocsi_id']));
                    return;
                case 'updatePotkocsiKarbantartas':
                    echo json_encode($karbantartasInterface->updatePotkocsiKarbantartas(isset($request['id']) ? $request['id'] : 0, $request['admin'], $request['potkocsi_id'], $request['datum'], $request['log'], empty($request['km_oraallas']) ? null : $request['km_oraallas'], $request['elvegezte'], $request['kovetkezo_karbantartas'], $request['koltseg'] ?? null));
                    return;
                case 'deletePotkocsiKarbantartas':
                    echo json_encode($karbantartasInterface->deletePotkocsiKarbantartas($request['id']));
                    return;
                case 'getKarbantartasok':
                    echo json_encode($karbantartasInterface->getKarbantartasok($request['id'], $request['kamion_id'], $request['potkocsi_id'], $request['datumTol'], $request['datumIg'], $request['elvegezte']));
                    return;
                case 'getSoforok':
                    echo json_encode($soforokInterface->getSoforok($request['id']));
                    return;
                case 'getSajatSofor':
                    echo json_encode($soforokInterface->getSajatSofor($request['id']));
                    return;
                case 'newSofor':
                    $result = $soforokInterface->newSofor($request);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'user', $result['sofor']['id'] ?? null, 'letrehozas', $request['name'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'saveSoforData':
                    $result = $soforokInterface->saveSoforData($request);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'user', $request['id'], 'modositas', $request['name'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deleteSofor':
                    $ownerAdmin = $this->resolveOwnerAdmin('user', $request['id']);
                    $result = $soforokInterface->deleteSofor($request['id']);
                    if ($result['success']) {
                        $this->logAudit($ownerAdmin, 'user', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getBejelentesek':
                    echo json_encode($bejelentesekInterface->getBejelentesek($request['ceg_id'], $request['kamion'] ?? null));
                    return;
                case 'getNyitottBejelentesek':
                    echo json_encode($bejelentesekInterface->getNyitottBejelentesek($request['id']));
                    return;
                case 'getBejelentesekSofor':
                    echo json_encode($bejelentesekInterface->getBejelentesekSofor($request['sofor_id']));
                    return;
                case 'newBejelentes':
                    $result = $bejelentesekInterface->newBejelentes($request);
                    if ($result['success']) {
                        $ownerAdmin = $this->resolveOwnerAdmin('bejelentesek', $result['id']);
                        $this->logAudit($ownerAdmin, 'bejelentesek', $result['id'], 'letrehozas', $request['cim'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'saveBejelentesData':
                    $ownerAdmin = $this->resolveOwnerAdmin('bejelentesek', $request['id']);
                    $result = $bejelentesekInterface->saveBejelentesData($request);
                    if ($result['success']) {
                        $this->logAudit($ownerAdmin, 'bejelentesek', $request['id'], 'modositas', $request['cim'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deleteBejelentes':
                    $ownerAdmin = $this->resolveOwnerAdmin('bejelentesek', $request['id']);
                    $result = $bejelentesekInterface->deleteBejelentes($request['id']);
                    if ($result['success']) {
                        $this->logAudit($ownerAdmin, 'bejelentesek', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'requestJarmuValtas':
                    echo json_encode($jarmuValtasInterface->requestJarmuValtas($request));
                    return;
                case 'visszavonJarmuValtas':
                    echo json_encode($jarmuValtasInterface->visszavonJarmuValtas($request['id']));
                    return;
                case 'getSajatJarmuValtasKerelmek':
                    echo json_encode($jarmuValtasInterface->getSajatJarmuValtasKerelmek($request['sofor_id']));
                    return;
                case 'getElbiraltJarmuValtasok':
                    echo json_encode($jarmuValtasInterface->getElbiraltJarmuValtasok($request['sofor_id']));
                    return;
                case 'getFuggoJarmuValtasok':
                    echo json_encode($jarmuValtasInterface->getFuggoJarmuValtasok($request['id']));
                    return;
                case 'elbiralJarmuValtas':
                    $result = $jarmuValtasInterface->elbiralJarmuValtas($request['id'], $request['allapot']);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'jarmu_valtas_kerelmek', $request['id'], 'modositas', $request['allapot']);
                    }
                    echo json_encode($result);
                    return;

                case 'newTankolas':
                    echo json_encode($tankolasInterface->newTankolas($request));
                    return;
                case 'getTankolasok':
                    echo json_encode($tankolasInterface->getTankolasok($request['sofor_id']));
                    return;

                case 'getAdminElerhetoseg':
                    echo json_encode($this->getAdminElerhetoseg($request['id']));
                    return;

                case 'getUgyfelek':
                    echo json_encode($ugyfelInterface->getUgyfelek($request['id']));
                    return;
                case 'getUgyfelValaszto':
                    echo json_encode($ugyfelInterface->getUgyfelValaszto($request['id']));
                    return;
                case 'newUgyfel':
                    $result = $ugyfelInterface->newUgyfel($request);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'ugyfelek', $result['ugyfel']['id'] ?? null, 'letrehozas', $request['nev'] ?? null);
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
                    $result = $ugyfelInterface->deleteUgyfel($request['id']);
                    if ($result['success']) {
                        $this->logAudit($ownerAdmin, 'ugyfelek', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'getCsapattagok':
                    echo json_encode($csapatInterface->getCsapattagok($request['id']));
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
                case 'deleteListaElem':
                    $result = $listaInterface->deleteListaElem($request['id'], $request['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'listaelemek', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'globalSearch':
                    echo json_encode($keresesInterface->globalSearch($request['ceg_id'], $request['q']));
                    return;

                case 'getHelyszinek':
                    echo json_encode($helyszinInterface->getHelyszinek($request['id']));
                    return;
                case 'getHelyszin':
                    echo json_encode($helyszinInterface->getHelyszin($request['id']));
                    return;
                case 'newHelyszin':
                    $result = $helyszinInterface->newHelyszin($request);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'helyszinek', $result['helyszin']['id'] ?? null, 'letrehozas', $request['nev'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'saveHelyszinData':
                    $result = $helyszinInterface->saveHelyszinData($request);
                    if ($result['success']) {
                        $ownerAdmin = $this->resolveOwnerAdmin('helyszinek', $request['id']);
                        $this->logAudit($ownerAdmin, 'helyszinek', $request['id'], 'modositas', $request['nev'] ?? null);
                    }
                    echo json_encode($result);
                    return;
                case 'deleteHelyszin':
                    $ownerAdmin = $this->resolveOwnerAdmin('helyszinek', $request['id']);
                    $result = $helyszinInterface->deleteHelyszin($request['id']);
                    if ($result['success']) {
                        $this->logAudit($ownerAdmin, 'helyszinek', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;
                case 'getHelyszinMegjegyzesek':
                    echo json_encode($helyszinInterface->getHelyszinMegjegyzesek($request['helyszin_id']));
                    return;
                case 'newHelyszinMegjegyzes':
                    echo json_encode($helyszinInterface->newHelyszinMegjegyzes($request));
                    return;
                case 'deleteHelyszinMegjegyzes':
                    echo json_encode($helyszinInterface->deleteHelyszinMegjegyzes($request['id']));
                    return;

                case 'getSzabadsagok':
                    echo json_encode($szabadsagInterface->getSzabadsagok($request['id']));
                    return;
                case 'newSzabadsag':
                    $result = $szabadsagInterface->newSzabadsag($request);
                    if ($result['success']) {
                        $this->logAudit($request['admin'] ?? null, 'sofor_szabadsag', $result['id'] ?? null, 'letrehozas');
                    }
                    echo json_encode($result);
                    return;
                case 'deleteSzabadsag':
                    $ownerAdmin = $this->resolveOwnerAdmin('sofor_szabadsag', $request['id']);
                    $result = $szabadsagInterface->deleteSzabadsag($request['id']);
                    if ($result['success']) {
                        $this->logAudit($ownerAdmin, 'sofor_szabadsag', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'getAuditLog':
                    echo json_encode($this->getAuditLog($request['id']));
                    return;

                case 'getKoltsegOsszesito':
                    echo json_encode($koltsegInterface->getKoltsegOsszesito(
                        $request['ceg_id'],
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null
                    ));
                    return;

                case 'getEgyebKoltsegek':
                    echo json_encode($koltsegInterface->getEgyebKoltsegek(
                        $request['ceg_id'],
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null
                    ));
                    return;

                case 'newEgyebKoltseg':
                    $result = $koltsegInterface->newEgyebKoltseg($request);
                    if ($result['success']) {
                        $iranyLabel = $result['irany'] === 'bevetel' ? 'bevétel' : 'kiadás';
                        $this->logAudit($request['ceg_id'], 'egyeb_koltsegek', $result['id'], 'letrehozas', "($iranyLabel) " . ($request['megnevezes'] ?? ''));
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

                case 'getFuvarok':
                    echo json_encode($fuvarInterface->getFuvarok(
                        $request['ceg_id'],
                        $request['statusz'] ?? null,
                        $request['datumTol'] ?? null,
                        $request['datumIg'] ?? null
                    ));
                    return;

                case 'newFuvar':
                    $result = $fuvarInterface->newFuvar($request);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'fuvarok', $result['id'], 'letrehozas', $request['felrakas_cim'] . ' → ' . $request['lerakas_cim']);
                    }
                    echo json_encode($result);
                    return;

                case 'saveFuvarData':
                    $result = $fuvarInterface->saveFuvarData($request);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'fuvarok', $request['id'], 'modositas');
                    }
                    echo json_encode($result);
                    return;

                case 'updateFuvarStatusz':
                    $result = $fuvarInterface->updateFuvarStatusz($request['id'], $request['ceg_id'], $request['statusz']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'fuvarok', $request['id'], 'modositas', 'státusz: ' . $request['statusz']);
                    }
                    echo json_encode($result);
                    return;

                case 'deleteFuvar':
                    $result = $fuvarInterface->deleteFuvar($request['id'], $request['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'fuvarok', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'updateFuvarBeosztas':
                    $result = $fuvarInterface->updateFuvarBeosztas(
                        $request['id'],
                        $request['ceg_id'],
                        $request['kamion_id'],
                        $request['felrakas_datum'],
                        $request['lerakas_datum']
                    );
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'fuvarok', $request['id'], 'modositas', 'ütemezés módosítva');
                    }
                    echo json_encode($result);
                    return;

                case 'newVezetesiNaplo':
                    $result = $vezetesiIdoInterface->newVezetesiNaplo($request);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'vezetesi_naplo', $result['id'], 'letrehozas', $request['datum'] . ': ' . $request['vezetes_ora'] . 'ó vezetés / ' . $request['pihenes_ora'] . 'ó pihenő');
                    }
                    echo json_encode($result);
                    return;

                case 'deleteVezetesiNaplo':
                    $result = $vezetesiIdoInterface->deleteVezetesiNaplo($request['id'], $request['ceg_id']);
                    if ($result['success']) {
                        $this->logAudit($request['ceg_id'], 'vezetesi_naplo', $request['id'], 'torles');
                    }
                    echo json_encode($result);
                    return;

                case 'getSajatVezetesiNaplo':
                    echo json_encode($vezetesiIdoInterface->getSajatVezetesiNaplo(
                        $request['sofor_id'],
                        $request['naptol'] ?? null,
                        $request['nameddig'] ?? null
                    ));
                    return;

                case 'getSajatVezetesiAllapot':
                    echo json_encode($vezetesiIdoInterface->getSajatVezetesiAllapot($request['sofor_id'], $request['hetek'] ?? 1));
                    return;

                case 'getVezetesiOsszesito':
                    echo json_encode($vezetesiIdoInterface->getVezetesiOsszesito(
                        $request['ceg_id'],
                        $request['sofor_id'] ?? null,
                        $request['hetek'] ?? 8
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

                case 'generateKarbantartasFromBejelentes':
                    echo json_encode($bejelentesekInterface->generateKarbantartasFromBejelentes($request['id']));
                    return;

                case 'getAjanlatkeresek':
                    echo json_encode($this->getAjanlatkeresek());
                    return;
                case 'updateAjanlatkeresStatusz':
                    echo json_encode($this->updateAjanlatkeresStatusz($request['id'], $request['statusz']));
                    return;

                case 'requestPasswordReset':
                    echo json_encode($this->requestPasswordReset($request['email']));
                    return;
                case 'resetPassword':
                    echo json_encode($this->resetPassword($request['token'], $request['password']));
                    return;

                case 'getFiles':
                    echo json_encode($filesInterface->getFiles($request['tabla'], $request['id']));
                    return;
                case 'fileUpload':
                    echo json_encode($filesInterface->fileUpload($request['admin'], $request['tabla'], $request['id'], $request['file'], $request['name'], $request['size'], $request['kategoria'] ?? null));
                    return;
                case 'downloadFile':
                    echo json_encode($filesInterface->downloadFile($request['id']));
                    return;
                case 'deleteFile':
                    echo json_encode($filesInterface->deleteFile($request['id']));
                    return;
                case 'getEgyediHataridok':
                    echo json_encode($this->getEgyediHataridok($request['id']));
                    return;
                case 'updateEgyediHatarido':
                    echo json_encode($this->updateEgyediHatarido($request['id'], $request['datum'], $request['leiras']));
                    return;
                case 'deleteEgyediHatarido':
                    echo json_encode($this->deleteEgyediHatarido($request['id']));
                    return;
                case 'createEgyediHatarido':
                    echo json_encode($this->createEgyediHatarido($request['id'], $request['datum'], $request['leiras']));
                    return;
                case 'getEsemenyek':
                    echo json_encode($this->getEsemenyek($request['id']));
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
                    echo json_encode($this->saveAdminData(
                        $request['id'],
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
                        $request['szerepkor'] ?? 'admin'
                    ));

                    return;
            }
        } catch (Exception $e) {
            $message = ["error" => true, "message" => $e->getMessage()];
            echo json_encode($message);
        }
    }
    private function getEgyediHataridok($id) {
        try {
            $query = "SELECT * FROM egyedi_hataridok WHERE admin = :id AND torolt <> 'I'";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();
            $hataridok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'esemenyek' => $hataridok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    private function updateEgyediHatarido($id, $datum, $leiras) {
        try {
            $query = "UPDATE egyedi_hataridok SET datum = :datum, leiras = :leiras WHERE sorszam = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->bindParam(':datum', $datum);
            $stmt->bindParam(':leiras', $leiras);
            $stmt->execute();

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
    private function deleteEgyediHatarido($id) {
        try {
            $query = "UPDATE egyedi_hataridok SET torolt = 'I' WHERE sorszam = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();

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

            // Fuvarok — csak a még nem lezárt/lemondott (tervezett/
            // folyamatban) fuvarok, olcsó előnézetként a Fuvartervező
            // naptár (jövőbeli, önálló fejlesztés) előtt is. A
            // FuvarInterface::getAktivFuvarok() csak a fel-/lerakási
            // dátummal rendelkező fuvarokat adja vissza.
            global $fuvarInterface;
            foreach ($fuvarInterface->getAktivFuvarok($id) as $fuvar) {
                $veg = $fuvar['lerakas_datum'] ?: $fuvar['felrakas_datum'];
                $data[] = [
                    'start' => $fuvar['felrakas_datum'],
                    'end' => $veg,
                    'title' => 'Fuvar: ' . $fuvar['felrakas_cim'] . ' → ' . $fuvar['lerakas_cim']
                        . ($fuvar['kamion_rendszam'] ? ' (' . $fuvar['kamion_rendszam'] . ')' : ''),
                ];
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

            return ['success' => true, 'sofor' => $sum_soforok, 'kamion' => $sum_kamion, 'potkocsi' => $sum_potkocsi, 'hatarido' => $sum_hatarido];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    function getHataridok($id) {
        return "0";
    }

    private function loginUser($email, $password) {
        $user = $this->getUser($email);
        if (!empty($user) && password_verify($password, $user['password'])) {
            $token = bin2hex(random_bytes(32));
            $stmt = $this->db->prepare("INSERT INTO sessions (token, felhasznalo_tipus, felhasznalo_id, lejarat) VALUES (:token, :tipus, :id, DATE_ADD(NOW(), INTERVAL 30 DAY))");
            $stmt->bindValue(':token', $token);
            $stmt->bindValue(':tipus', $user['is_admin'] ? 'admin' : 'sofor');
            $stmt->bindValue(':id', $user['id']);
            $stmt->execute();

            return ['success' => true, 'user' => $user, 'token' => $token];
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

    // A `szerepkor` mező szándékosan tisztán tájékoztató jellegű — nem
    // korlátoz semmilyen menüpontot vagy műveletet. Egy céghez több
    // admin-fiók is tartozhat (ld. backend/sql/6.sql, CsapatInterface),
    // de közöttük nincs jogosultsági különbségtétel: mindenki, aki egy
    // céghez tartozik, ugyanazt látja/szerkeszti.
    private function saveAdminData($id, $name, $email, $phone, $szul_datum, $szemelyi, $varos, $irsz, $cim, $szemelyi_lejarat, $jogsi_lejarat, $gki_lejarat, $adr_lejarat, $szerepkor = 'admin') {
        try {
            $query = "UPDATE admin
                      SET name = :name,
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
            return ['success' => true, 'user' => $user];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
    private function updateUser($id, $nickname, $birthdate, $password = null) {
        try {
            $query = "UPDATE user SET nickname = :nickname, birthdate = :birthdate";
            $hashedPassword = null;
            if ($password) {
                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
                $query .= ", password = :password";
            }
            $query .= " WHERE id = :id";

            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->bindParam(':nickname', $nickname);
            $stmt->bindParam(':birthdate', $birthdate);
            if ($password) {
                $stmt->bindParam(':password', $hashedPassword);
            }
            $stmt->execute();

            return ['success' => true];
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
            $query = "INSERT INTO audit_log (admin_id, tabla, rowid, muvelet, leiras) VALUES (:admin_id, :tabla, :rowid, :muvelet, :leiras)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin_id', $adminId);
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

    private function getAuditLog($id) {
        try {
            $query = "SELECT * FROM audit_log WHERE admin_id = :id ORDER BY datum DESC LIMIT 200";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id);
            $stmt->execute();

            return ['success' => true, 'naplo' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
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
            throw new Exception('The email address is already in use.');
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
            $body = '<div style="font-family:sans-serif;"><p>Jelszó-visszaállítást kért a Szikora Transz flottakezelő rendszerben.</p>'
                . '<p><a href="' . htmlspecialchars($resetUrl) . '">Kattintson ide az új jelszó beállításához</a></p>'
                . '<p>A hivatkozás 1 óráig érvényes. Ha nem Ön kérte, hagyja figyelmen kívül ezt az e-mailt.</p></div>';
            $emailInterface->sendNotification($email, 'Jelszó-visszaállítás — Szikora Transz', $body);

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
