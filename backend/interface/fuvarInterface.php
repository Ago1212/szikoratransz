<?php

// Fuvar modul — a korábban tudatosan kivezetett `fuvarok` tábla
// újraépítése (ld. docs/superpowers/specs/2026-07-25-fuvar-dokumentum-
// ocr-design.md), most OCR-alapú dokumentum-beérkeztetésre építve, nem
// szóbeli/kézi bejegyzésre. "Összesen" nincs tárolva — mindig
// `fuvardij + egyeb_koltseg` a lekérdezésben.
class FuvarInterface {
    protected $db;

    // FONTOS: a getFuvarok() lekérdezés `FROM fuvarok`-ból megy, nincs `f`
    // alias (ld. a JOIN-mentes átírás fenti megjegyzése) — az itt szereplő
    // oszlopneveknek EMIATT alias-prefix nélkülinek kell lenniük, különben
    // minden explicit sortKey egy "Column not found" SQL-hibával elszáll.
    const RENDEZHETO_OSZLOPOK = [
        'teljesites_datuma' => 'teljesites_datuma',
        'felrako' => 'felrako',
        'lerako' => 'lerako',
        'fuvardij' => 'fuvardij',
        'allapot' => 'allapot',
    ];

    // Kliens által megadott idegen kulcs (sofor_id/kamion_id/furgon_id/
    // potkocsi_id/megbizo_id) tényleg a hívó cégéhez tartozik-e — ugyanaz
    // a minta, mint `jarmuValtasInterface::requestJarmuValtas()`-ban. Enélkül
    // egy másik cég id-jét beírva a fuvar egy idegen sofőrre/járműre/
    // megbízóra mutatna, és a dúsító lekérdezések (ld. lentebb) vissza is
    // adnák annak a cégnek a nevét/rendszámát — ez volt a Task 7 review
    // által talált cross-tenant IDOR.
    private function ervenyesEntitasE($tabla, $id, $ceg_id) {
        $stmt = $this->db->prepare("SELECT id FROM `$tabla` WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return (bool) $stmt->fetch();
    }

    // A newFuvar()/updateFuvar() elején hívva: minden nem üres FK-mezőt
    // leellenőriz, mielőtt bármi is íródna. Visszaad egy hibaüzenetet, ha
    // bármelyik id nem a hívó cégéhez tartozik, egyébként null-t.
    private function idegenKulcsokErvenyesitese($data, $ceg_id) {
        $ellenorzendo = [
            'sofor_id' => ['user', 'sofőr'],
            'kamion_id' => ['kamion', 'kamion'],
            'furgon_id' => ['furgon', 'furgon'],
            'potkocsi_id' => ['potkocsi', 'pótkocsi'],
            'megbizo_id' => ['ugyfelek', 'megbízó'],
        ];
        foreach ($ellenorzendo as $mezo => [$tabla, $label]) {
            if (!empty($data[$mezo]) && !$this->ervenyesEntitasE($tabla, $data[$mezo], $ceg_id)) {
                return "Érvénytelen $label azonosító.";
            }
        }
        return null;
    }

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function newFuvar($data, $ceg_id) {
        $hiba = $this->idegenKulcsokErvenyesitese($data, $ceg_id);
        if ($hiba !== null) {
            return ['success' => false, 'message' => $hiba];
        }
        try {
            $query = "INSERT INTO fuvarok (admin, sofor_id, kamion_id, furgon_id, potkocsi_id, teljesites_datuma, felrako, lerako, tavolsag_km, megbizo_id, aru_megnevezese, megjegyzes, fuvardij, egyeb_koltseg, fuvarlevel_szam, beerkezett_dokumentum_id, allapot)
                      VALUES (:admin, :sofor_id, :kamion_id, :furgon_id, :potkocsi_id, :teljesites_datuma, :felrako, :lerako, :tavolsag_km, :megbizo_id, :aru_megnevezese, :megjegyzes, :fuvardij, :egyeb_koltseg, :fuvarlevel_szam, :beerkezett_dokumentum_id, :allapot)";
            $stmt = $this->db->prepare($query);
            $this->bindFuvarMezok($stmt, $data, $ceg_id);
            $stmt->execute();

            $ujId = $this->db->lastInsertId();
            return ['success' => true, 'message' => 'Fuvar rögzítve.', 'fuvar' => $this->getFuvar($ujId, $ceg_id)['fuvar']];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function updateFuvar($data, $ceg_id) {
        $hiba = $this->idegenKulcsokErvenyesitese($data, $ceg_id);
        if ($hiba !== null) {
            return ['success' => false, 'message' => $hiba];
        }
        try {
            $query = "UPDATE fuvarok SET
                        sofor_id = :sofor_id, kamion_id = :kamion_id, furgon_id = :furgon_id, potkocsi_id = :potkocsi_id,
                        teljesites_datuma = :teljesites_datuma, felrako = :felrako, lerako = :lerako, tavolsag_km = :tavolsag_km,
                        megbizo_id = :megbizo_id, aru_megnevezese = :aru_megnevezese, megjegyzes = :megjegyzes,
                        fuvardij = :fuvardij, egyeb_koltseg = :egyeb_koltseg, fuvarlevel_szam = :fuvarlevel_szam,
                        beerkezett_dokumentum_id = :beerkezett_dokumentum_id, allapot = :allapot
                      WHERE id = :id AND admin = :admin";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);
            $this->bindFuvarMezok($stmt, $data, $ceg_id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Fuvar frissítve.', 'fuvar' => $this->getFuvar($data['id'], $ceg_id)['fuvar']];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function bindFuvarMezok($stmt, $data, $ceg_id) {
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $data['sofor_id'] ?? null);
        $stmt->bindValue(':kamion_id', $data['kamion_id'] ?? null);
        $stmt->bindValue(':furgon_id', $data['furgon_id'] ?? null);
        $stmt->bindValue(':potkocsi_id', $data['potkocsi_id'] ?? null);
        $stmt->bindValue(':teljesites_datuma', $data['teljesites_datuma'] ?? null);
        $stmt->bindValue(':felrako', $data['felrako'] ?? null);
        $stmt->bindValue(':lerako', $data['lerako'] ?? null);
        $stmt->bindValue(':tavolsag_km', empty($data['tavolsag_km']) ? null : (int) $data['tavolsag_km'], empty($data['tavolsag_km']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':megbizo_id', $data['megbizo_id'] ?? null);
        $stmt->bindValue(':aru_megnevezese', $data['aru_megnevezese'] ?? null);
        $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
        $stmt->bindValue(':fuvardij', $data['fuvardij'] === '' || $data['fuvardij'] === null ? null : (float) $data['fuvardij']);
        $stmt->bindValue(':egyeb_koltseg', $data['egyeb_koltseg'] === '' || $data['egyeb_koltseg'] === null ? null : (float) $data['egyeb_koltseg']);
        $stmt->bindValue(':fuvarlevel_szam', $data['fuvarlevel_szam'] ?? null);
        $stmt->bindValue(':beerkezett_dokumentum_id', empty($data['beerkezett_dokumentum_id']) ? null : (int) $data['beerkezett_dokumentum_id'], empty($data['beerkezett_dokumentum_id']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':allapot', $data['allapot'] ?? 'rogzitett');
    }

    public function deleteFuvar($id, $ceg_id) {
        $this->visszaallitForrasDokumentumot($id, $ceg_id);

        $stmt = $this->db->prepare("UPDATE fuvarok SET torolt = 'I' WHERE id = :id AND admin = :admin");
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'message' => 'Fuvar törölve.'];
    }

    // Whole-branch review finding (nem látta egyik egyedi task-review sem,
    // mert `letrehozDokumentumbol()` és `deleteFuvar()` két külön Task-hoz
    // tartozott): ha ezt a fuvart `letrehozDokumentumbol()` hozta létre egy
    // beérkezett dokumentumból, a törlés a forrás-dokumentumot eddig
    // véglegesen "elárvult" állapotban hagyta — a `beerkezett_dokumentumok`
    // sor `fuvar_id`-je egy (mostantól soft-deletelt) fuvarra mutatott
    // tovább, ezért sosem jelent meg újra a feldolgozatlan-inboxban
    // (`getDokumentumok()` alapból `fuvar_id IS NULL`-ra szűr), a `fajlok`
    // sor pedig `tabla='fuvar', rowid=<törölt fuvar id>`-n ragadt, ahonnan
    // semmilyen élő felület nem éri el. Ez a metódus pontosan a
    // `letrehozDokumentumbol()` reparentálásának a fordítottját végzi el:
    // visszaállítja `fuvar_id = NULL`-ra (a dokumentum újra felhasználható
    // egy friss fuvar létrehozásához) és a `fajlok` sort visszaparentálja
    // `tabla='beerkezett_dokumentum', rowid=<ceg_id>`-ra. Manuálisan (nem
    // dokumentumból) létrehozott fuvarnál a SELECT egyszerűen nem talál
    // sort, a metódus csendben visszatér — nincs extra hatás.
    private function visszaallitForrasDokumentumot($fuvarId, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id, fajl_id FROM beerkezett_dokumentumok
             WHERE fuvar_id = :fuvar_id AND admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':fuvar_id', $fuvarId, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $dokumentum = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($dokumentum === false) {
            return;
        }

        $update = $this->db->prepare(
            "UPDATE beerkezett_dokumentumok SET fuvar_id = NULL WHERE id = :id AND admin = :admin"
        );
        $update->bindValue(':id', $dokumentum['id'], PDO::PARAM_INT);
        $update->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $update->execute();

        $reparent = $this->db->prepare(
            "UPDATE fajlok SET tabla = 'beerkezett_dokumentum', rowid = :ceg_id WHERE sorszam = :fajl_id"
        );
        $reparent->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $reparent->bindValue(':fajl_id', $dokumentum['fajl_id'], PDO::PARAM_INT);
        $reparent->execute();
    }

    // FONTOS: ez a projekt saját SQL-lintere tiltja a JOIN-t és a UNION-t
    // (ld. `koltsegInterface.php`-ban a flotta-átlag-karbantartási-költség
    // hasonló megjegyzését) — a sofőr/kamion/furgon/pótkocsi/megbízó
    // megjelenítendő nevét/rendszámát ezért KÜLÖN lekérdezésekkel, PHP-
    // oldali összefésüléssel csatoljuk a fuvar-sorokhoz, nem JOIN-nal.
    // Ugyanaz a minta, mint `BeerkezettDokumentumInterface::
    // fajlnevekFeloldasa()`-nál (Task 6) vagy `helyszinInterface::
    // hozzafuzMegjegyzesekSzama()`-nál.
    public function getFuvar($id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT *, (fuvardij + IFNULL(egyeb_koltseg, 0)) AS osszesen
             FROM fuvarok
             WHERE id = :id AND admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvar = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($fuvar === false) {
            return ['success' => false, 'fuvar' => null];
        }
        return ['success' => true, 'fuvar' => $this->dusitEgySort($fuvar, $ceg_id)];
    }

    public function getFuvarok($ceg_id, $search = null, $page = null, $pageSize = null, $sortKey = null, $sortDir = 'asc', $allapot = null) {
        $params = [':admin' => $ceg_id];
        $query = "SELECT *, (fuvardij + IFNULL(egyeb_koltseg, 0)) AS osszesen
                  FROM fuvarok
                  WHERE admin = :admin AND torolt <> 'I'";

        if (!empty($allapot)) {
            $query .= " AND allapot = :allapot";
            $params[':allapot'] = $allapot;
        }
        if (!empty($search)) {
            // A saját mezők (felrakó/lerakó/áru/fuvarlevél szám) LIKE-
            // egyezése mellett a kapcsolódó entitások (sofőr/kamion/
            // furgon/megbízó) nevét/rendszámát KÜLÖN lekérdezéssel
            // egyeztetjük a keresőszóval, és a talált id-ket egy IN(...)
            // feltételként fűzzük a fuvarok WHERE-jéhez — így nem kell
            // JOIN a keresés kiterjesztéséhez sem.
            $entitasFeltetelek = [];
            foreach ([
                ['sofor_id', 'user', 'name'],
                ['kamion_id', 'kamion', 'rendszam'],
                ['furgon_id', 'furgon', 'rendszam'],
                ['megbizo_id', 'ugyfelek', 'nev'],
            ] as [$oszlop, $tabla, $mezo]) {
                $talalt = $this->keresIdkNevAlapjan($tabla, $mezo, $ceg_id, $search);
                if (!empty($talalt)) {
                    $entitasFeltetelek[] = "$oszlop IN (" . implode(',', $talalt) . ')';
                }
            }

            $sajatMezoFeltetel = "(felrako LIKE :search OR lerako LIKE :search OR aru_megnevezese LIKE :search OR fuvarlevel_szam LIKE :search)";
            $params[':search'] = '%' . $search . '%';

            $query .= " AND (" . implode(' OR ', array_merge([$sajatMezoFeltetel], $entitasFeltetelek)) . ")";
        }

        $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$sortKey] ?? 'teljesites_datuma';
        $irany = strtolower((string) $sortDir) === 'desc' ? 'DESC' : 'ASC';
        $query .= " ORDER BY $rendezoOszlop $irany";

        if ($page !== null) {
            [$fuvarok, $total, $page, $pageSize] = PaginationHelper::fetchPage($this->db, $query, $params, $page, $pageSize);
            return ['success' => true, 'fuvarok' => $this->dusitSorokat($fuvarok, $ceg_id), 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
        }

        $stmt = $this->db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $this->dusitSorokat($stmt->fetchAll(PDO::FETCH_ASSOC), $ceg_id)];
    }

    // Kulcsszó szerint megegyező id-k egy adott táblából/mezőből, az adott
    // céghez szűkítve — a keresés kiterjesztéséhez (ld. getFuvarok()).
    private function keresIdkNevAlapjan($tabla, $mezo, $ceg_id, $search) {
        $stmt = $this->db->prepare("SELECT id FROM `$tabla` WHERE admin = :ceg_id AND `$mezo` LIKE :search AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->bindValue(':search', '%' . $search . '%');
        $stmt->execute();
        return array_map('intval', array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'id'));
    }

    // Egyetlen fuvar-sorhoz fűzi hozzá a megjelenítendő neveket/
    // rendszámokat (getFuvar()-hoz, egy sor esetén nem kell batch-elt IN
    // lekérdezés). A $ceg_id-t is átadjuk az egyMezoLekerdezese()-nek,
    // hogy egy (elméletileg soha nem kellene, hogy előforduljon, de a
    // védekező-programozás elve szerint mégis leellenőrzött) idegen cégre
    // mutató id sose adja vissza egy másik cég entitásának a nevét.
    private function dusitEgySort($fuvar, $ceg_id) {
        $fuvar['sofor_nev'] = $this->egyMezoLekerdezese('user', 'name', $fuvar['sofor_id'], $ceg_id);
        $fuvar['kamion_rendszam'] = $this->egyMezoLekerdezese('kamion', 'rendszam', $fuvar['kamion_id'], $ceg_id);
        $fuvar['furgon_rendszam'] = $this->egyMezoLekerdezese('furgon', 'rendszam', $fuvar['furgon_id'], $ceg_id);
        $fuvar['potkocsi_rendszam'] = $this->egyMezoLekerdezese('potkocsi', 'rendszam', $fuvar['potkocsi_id'], $ceg_id);
        $fuvar['megbizo_nev'] = $this->egyMezoLekerdezese('ugyfelek', 'nev', $fuvar['megbizo_id'], $ceg_id);
        return $fuvar;
    }

    private function egyMezoLekerdezese($tabla, $mezo, $id, $ceg_id) {
        if (empty($id)) {
            return null;
        }
        $stmt = $this->db->prepare("SELECT `$mezo` FROM `$tabla` WHERE id = :id AND admin = :ceg_id");
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        return $sor[$mezo] ?? null;
    }

    // Lista-lekérdezésekhez: táblánként EGY batch-elt IN(...) lekérdezés
    // (nem N+1), majd PHP-oldali összefésülés a sorokhoz. A $ceg_id a
    // batch-lekérdezéseket is a hívó cégére szűkíti (ld. egyMezoLekerdezese()
    // megjegyzését).
    private function dusitSorokat($fuvarok, $ceg_id) {
        if (empty($fuvarok)) {
            return $fuvarok;
        }
        $soforNevek = $this->batchLekerdezes('user', 'name', array_column($fuvarok, 'sofor_id'), $ceg_id);
        $kamionRendszamok = $this->batchLekerdezes('kamion', 'rendszam', array_column($fuvarok, 'kamion_id'), $ceg_id);
        $furgonRendszamok = $this->batchLekerdezes('furgon', 'rendszam', array_column($fuvarok, 'furgon_id'), $ceg_id);
        $potkocsiRendszamok = $this->batchLekerdezes('potkocsi', 'rendszam', array_column($fuvarok, 'potkocsi_id'), $ceg_id);
        $megbizoNevek = $this->batchLekerdezes('ugyfelek', 'nev', array_column($fuvarok, 'megbizo_id'), $ceg_id);

        foreach ($fuvarok as &$fuvar) {
            $fuvar['sofor_nev'] = $soforNevek[$fuvar['sofor_id']] ?? null;
            $fuvar['kamion_rendszam'] = $kamionRendszamok[$fuvar['kamion_id']] ?? null;
            $fuvar['furgon_rendszam'] = $furgonRendszamok[$fuvar['furgon_id']] ?? null;
            $fuvar['potkocsi_rendszam'] = $potkocsiRendszamok[$fuvar['potkocsi_id']] ?? null;
            $fuvar['megbizo_nev'] = $megbizoNevek[$fuvar['megbizo_id']] ?? null;
        }
        unset($fuvar);
        return $fuvarok;
    }

    private function batchLekerdezes($tabla, $mezo, $idk, $ceg_id) {
        $idk = array_values(array_unique(array_filter(array_map('intval', $idk))));
        if (empty($idk)) {
            return [];
        }
        $helyorzok = implode(',', array_fill(0, count($idk), '?'));
        $stmt = $this->db->prepare("SELECT id, `$mezo` FROM `$tabla` WHERE id IN ($helyorzok) AND admin = ?");
        $stmt->execute(array_merge($idk, [$ceg_id]));
        $terkep = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
            $terkep[$sor['id']] = $sor[$mezo];
        }
        return $terkep;
    }

    // A `$felulirasok` a review-formon az admin által esetlegesen módosított
    // mezőket tartalmazza (ugyanolyan alakban, mint `newFuvar()` `$data`
    // paramétere) — ahol egy kulcs szerepel benne, az felülírja az OCR-ből
    // származó javaslatot; ahol nem, az OCR/egyeztetés eredménye érvényes.
    public function letrehozDokumentumbol($dokumentumId, $ceg_id, $felulirasok = []) {
        $stmt = $this->db->prepare("SELECT * FROM beerkezett_dokumentumok WHERE id = :id AND admin = :admin AND torolt <> 'I'");
        $stmt->bindValue(':id', $dokumentumId, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $dokumentum = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($dokumentum === false) {
            return ['success' => false, 'message' => 'A dokumentum nem található.'];
        }
        if (!empty($dokumentum['fuvar_id'])) {
            return ['success' => false, 'message' => 'Ehhez a dokumentumhoz már tartozik fuvar.'];
        }

        $ocrAdatok = $dokumentum['ocr_adatok'] !== null ? json_decode($dokumentum['ocr_adatok'], true) : [];
        $ocrAdatok = is_array($ocrAdatok) ? $ocrAdatok : [];

        $rendszamTalalat = $this->keresRendszamAlapjan($ceg_id, $ocrAdatok['rendszam'] ?? null);
        $soforId = $this->keresSoforNevAlapjan($ceg_id, $ocrAdatok['sofor_neve'] ?? null);
        $megbizoId = $this->keresMegbizoNevAlapjan($ceg_id, $ocrAdatok['megbizo'] ?? null);

        $adatok = array_merge([
            'sofor_id' => $soforId,
            'kamion_id' => $rendszamTalalat['tipus'] === 'kamion' ? $rendszamTalalat['id'] : null,
            'furgon_id' => $rendszamTalalat['tipus'] === 'furgon' ? $rendszamTalalat['id'] : null,
            'teljesites_datuma' => $ocrAdatok['datum'] ?? null,
            'felrako' => $ocrAdatok['felrako'] ?? null,
            'lerako' => $ocrAdatok['lerako'] ?? null,
            'megbizo_id' => $megbizoId,
            'aru_megnevezese' => $ocrAdatok['aru_megnevezese'] ?? null,
            'megjegyzes' => $ocrAdatok['egyeb_megjegyzes'] ?? null,
            'fuvarlevel_szam' => $ocrAdatok['fuvarlevel_szam'] ?? null,
        ], $felulirasok);

        // A forrás-dokumentum id-je SOSEM felülírható a $felulirasok által —
        // ez szerver-oldali tény (melyik dokumentumból hívtuk ezt a
        // metódust), nem admin-szerkeszthető mező.
        $adatok['beerkezett_dokumentum_id'] = $dokumentumId;

        $letrehozas = $this->newFuvar($adatok, $ceg_id);
        if (!$letrehozas['success']) {
            return $letrehozas;
        }
        $ujFuvarId = $letrehozas['fuvar']['id'];

        $update = $this->db->prepare("UPDATE beerkezett_dokumentumok SET fuvar_id = :fuvar_id WHERE id = :id");
        $update->bindValue(':fuvar_id', $ujFuvarId, PDO::PARAM_INT);
        $update->bindValue(':id', $dokumentumId, PDO::PARAM_INT);
        $update->execute();

        $reparent = $this->db->prepare("UPDATE fajlok SET tabla = 'fuvar', rowid = :fuvar_id WHERE sorszam = :fajl_id");
        $reparent->bindValue(':fuvar_id', $ujFuvarId, PDO::PARAM_INT);
        $reparent->bindValue(':fajl_id', $dokumentum['fajl_id'], PDO::PARAM_INT);
        $reparent->execute();

        return $letrehozas;
    }

    private function normalizaltRendszam($rendszam) {
        if ($rendszam === null || trim((string) $rendszam) === '') {
            return null;
        }
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $rendszam));
    }

    private function keresRendszamAlapjan($ceg_id, $rendszamNyers) {
        $kulcs = $this->normalizaltRendszam($rendszamNyers);
        if ($kulcs === null) {
            return ['tipus' => null, 'id' => null];
        }

        $stmt = $this->db->prepare("SELECT id, rendszam FROM kamion WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($this->normalizaltRendszam($row['rendszam']) === $kulcs) {
                return ['tipus' => 'kamion', 'id' => (int) $row['id']];
            }
        }

        $stmt = $this->db->prepare("SELECT id, rendszam FROM furgon WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if ($this->normalizaltRendszam($row['rendszam']) === $kulcs) {
                return ['tipus' => 'furgon', 'id' => (int) $row['id']];
            }
        }

        return ['tipus' => null, 'id' => null];
    }

    private function normalizalNev($nev) {
        $nev = mb_strtoupper(trim((string) $nev));
        $atirasok = ['Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ö' => 'O', 'Ő' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ű' => 'U'];
        return strtr($nev, $atirasok);
    }

    private function keresSoforNevAlapjan($ceg_id, $nev) {
        if ($nev === null || trim($nev) === '') {
            return null;
        }
        $stmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $keresett = $this->normalizalNev($nev);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $jelolt = $this->normalizalNev($row['name']);
            if ($jelolt !== '' && (strpos($keresett, $jelolt) !== false || strpos($jelolt, $keresett) !== false)) {
                return (int) $row['id'];
            }
        }
        return null;
    }

    // Referencia, NEM autofill — a megbízó "szokásos fuvardíjai" mezőnek,
    // ld. design spec 6.2. Útvonalanként erősen eltérhet a díj, ezért a
    // frontend csak megjeleníti, nem tölti be automatikusan a fuvardij
    // mezőbe.
    public function getUgyfelElozmeny($ugyfelId, $ceg_id, $limit = 5) {
        $stmt = $this->db->prepare(
            "SELECT teljesites_datuma, felrako, lerako, fuvardij
             FROM fuvarok
             WHERE megbizo_id = :megbizo_id AND admin = :admin AND torolt <> 'I'
             ORDER BY teljesites_datuma DESC
             LIMIT " . (int) $limit
        );
        $stmt->bindValue(':megbizo_id', $ugyfelId, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    private function keresMegbizoNevAlapjan($ceg_id, $nev) {
        if ($nev === null || trim($nev) === '') {
            return null;
        }
        $stmt = $this->db->prepare("SELECT id, nev FROM ugyfelek WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $keresett = $this->normalizalNev($nev);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $jelolt = $this->normalizalNev($row['nev']);
            if ($jelolt !== '' && (strpos($keresett, $jelolt) !== false || strpos($jelolt, $keresett) !== false)) {
                return (int) $row['id'];
            }
        }
        return null;
    }
}

$fuvarInterface = new FuvarInterface();
