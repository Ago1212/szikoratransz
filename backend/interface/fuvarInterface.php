<?php

// Fuvar modul — a korábban tudatosan kivezetett `fuvarok` tábla
// újraépítése (ld. docs/superpowers/specs/2026-07-25-fuvar-dokumentum-
// ocr-design.md), most OCR-alapú dokumentum-beérkeztetésre építve, nem
// szóbeli/kézi bejegyzésre. A `fuvardij`/`egyeb_koltseg` külön tárolt
// mező (visszaállítva a 45.sql-lel — a köztes, egyetlen `dij` oszlopos
// verzió felhasználói visszajelzés alapján megszűnt), az "Összesen"
// SOSEM tárolt, mindig SQL-szinten számolt `AS dij` alias
// (`fuvardij + IFNULL(egyeb_koltseg, 0)`), hogy a rá épülő frontend-kód
// (Táblázat/Kanban/Sofőr-lista/statisztikák) változtatás nélkül,
// `row.dij`-t olvasva működjön tovább.
class FuvarInterface {
    protected $db;

    // FONTOS: a getFuvarok() lekérdezés `FROM fuvarok`-ból megy, nincs `f`
    // alias (ld. a JOIN-mentes átírás fenti megjegyzése) — az itt szereplő
    // oszlopneveknek EMIATT alias-prefix nélkülinek kell lenniük, különben
    // minden explicit sortKey egy "Column not found" SQL-hibával elszáll.
    const RENDEZHETO_OSZLOPOK = [
        'lerakas_datuma' => 'lerakas_datuma',
        'felrakas_datuma' => 'felrakas_datuma',
        'felrako' => 'felrako_ceg',
        'lerako' => 'lerako_ceg',
        'dij' => 'dij',
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
            $query = "INSERT INTO fuvarok (admin, sofor_id, kamion_id, furgon_id, potkocsi_id, felrakas_datuma, lerakas_datuma, felrako_ceg, felrako_cim, lerako_ceg, lerako_cim, tavolsag_km, tomeg_tonna, megbizo_id, aru_megnevezese, megjegyzes, fuvardij, egyeb_koltseg, raklapszam, beerkezett_dokumentum_id, allapot)
                      VALUES (:admin, :sofor_id, :kamion_id, :furgon_id, :potkocsi_id, :felrakas_datuma, :lerakas_datuma, :felrako_ceg, :felrako_cim, :lerako_ceg, :lerako_cim, :tavolsag_km, :tomeg_tonna, :megbizo_id, :aru_megnevezese, :megjegyzes, :fuvardij, :egyeb_koltseg, :raklapszam, :beerkezett_dokumentum_id, :allapot)";
            $stmt = $this->db->prepare($query);
            $this->bindFuvarMezok($stmt, $data, $ceg_id);
            $stmt->execute();

            $ujId = $this->db->lastInsertId();
            if (!empty($data['megbizo_id'])) {
                $this->frissitsMegbizoFelrakoLerako($data['megbizo_id'], $data, $ceg_id);
            }
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
                        felrakas_datuma = :felrakas_datuma, lerakas_datuma = :lerakas_datuma,
                        felrako_ceg = :felrako_ceg, felrako_cim = :felrako_cim, lerako_ceg = :lerako_ceg, lerako_cim = :lerako_cim,
                        tavolsag_km = :tavolsag_km, tomeg_tonna = :tomeg_tonna,
                        megbizo_id = :megbizo_id, aru_megnevezese = :aru_megnevezese, megjegyzes = :megjegyzes,
                        fuvardij = :fuvardij, egyeb_koltseg = :egyeb_koltseg, raklapszam = :raklapszam,
                        beerkezett_dokumentum_id = :beerkezett_dokumentum_id, allapot = :allapot
                      WHERE id = :id AND admin = :admin";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $data['id'], PDO::PARAM_INT);
            $this->bindFuvarMezok($stmt, $data, $ceg_id);
            $stmt->execute();

            if (!empty($data['megbizo_id'])) {
                $this->frissitsMegbizoFelrakoLerako($data['megbizo_id'], $data, $ceg_id);
            }
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
        $stmt->bindValue(':felrakas_datuma', $data['felrakas_datuma'] ?? null);
        $stmt->bindValue(':lerakas_datuma', $data['lerakas_datuma'] ?? null);
        $stmt->bindValue(':felrako_ceg', $data['felrako_ceg'] ?? null);
        $stmt->bindValue(':felrako_cim', $data['felrako_cim'] ?? null);
        $stmt->bindValue(':lerako_ceg', $data['lerako_ceg'] ?? null);
        $stmt->bindValue(':lerako_cim', $data['lerako_cim'] ?? null);
        $stmt->bindValue(':tavolsag_km', empty($data['tavolsag_km']) ? null : (int) $data['tavolsag_km'], empty($data['tavolsag_km']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':tomeg_tonna', empty($data['tomeg_tonna']) ? null : (float) $data['tomeg_tonna']);
        $stmt->bindValue(':megbizo_id', $data['megbizo_id'] ?? null);
        $stmt->bindValue(':aru_megnevezese', $data['aru_megnevezese'] ?? null);
        $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?? null);
        $stmt->bindValue(':fuvardij', $data['fuvardij'] === '' || $data['fuvardij'] === null ? null : (float) $data['fuvardij']);
        $stmt->bindValue(':egyeb_koltseg', $data['egyeb_koltseg'] === '' || $data['egyeb_koltseg'] === null ? null : (float) $data['egyeb_koltseg']);
        $stmt->bindValue(':raklapszam', empty($data['raklapszam']) ? null : (int) $data['raklapszam'], empty($data['raklapszam']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':beerkezett_dokumentum_id', empty($data['beerkezett_dokumentum_id']) ? null : (int) $data['beerkezett_dokumentum_id'], empty($data['beerkezett_dokumentum_id']) ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':allapot', $data['allapot'] ?? 'rogzitett');
    }

    // Ha a fuvaron megadott felrakó/lerakó adat van, de a kiválasztott
    // megbízónál még NINCS elmentve (mezőnként külön nézve), automatikusan
    // visszaírjuk az ugyfelek táblába — csak akkor, ha ott jelenleg NULL/
    // üres. Sosem írja felül a megbízónál már meglévő értéket (ld. design
    // spec "Automatikus ajánlás + visszamentés"). newFuvar()/updateFuvar()
    // saját sikeres ágán hívva, csendben (nincs UI-visszajelzés hozzá).
    private function frissitsMegbizoFelrakoLerako($megbizoId, $data, $ceg_id) {
        $mezok = ['felrako_ceg', 'felrako_cim', 'lerako_ceg', 'lerako_cim'];
        $ujErtekek = [];
        foreach ($mezok as $mezo) {
            if (!empty($data[$mezo])) {
                $ujErtekek[$mezo] = $data[$mezo];
            }
        }
        if (empty($ujErtekek)) {
            return;
        }

        $stmt = $this->db->prepare(
            "SELECT felrako_ceg, felrako_cim, lerako_ceg, lerako_cim FROM ugyfelek WHERE id = :id AND admin = :ceg_id"
        );
        $stmt->bindValue(':id', $megbizoId, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $megbizo = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($megbizo === false) {
            return;
        }

        $frissitendo = [];
        foreach ($ujErtekek as $mezo => $ertek) {
            if (empty($megbizo[$mezo])) {
                $frissitendo[$mezo] = $ertek;
            }
        }
        if (empty($frissitendo)) {
            return;
        }

        $setResz = implode(', ', array_map(fn($mezo) => "$mezo = :$mezo", array_keys($frissitendo)));
        $update = $this->db->prepare("UPDATE ugyfelek SET $setResz WHERE id = :id AND admin = :ceg_id");
        foreach ($frissitendo as $mezo => $ertek) {
            $update->bindValue(":$mezo", $ertek);
        }
        $update->bindValue(':id', $megbizoId, PDO::PARAM_INT);
        $update->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $update->execute();
    }

    const ALLAPOT_ERTEKEK = ['rogzitett', 'szamlazasra_var', 'szamlazva', 'fizetesre_var', 'teljesitve'];

    // Dedikált, EGY oszlopot módosító UPDATE — szándékosan nem a teljes
    // updateFuvar()-t hívja: a Kanban drag&drop és a gyors állapotváltó
    // popover csak {id, allapot}-ot küld, egy teljes-payload update ezt
    // NULL-ra írná a többi mezőn (bindFuvarMezok minden mezőt `?? null`-lal
    // olvas).
    public function updateAllapot($id, $ceg_id, $allapot) {
        if (!in_array($allapot, self::ALLAPOT_ERTEKEK, true)) {
            return ['success' => false, 'message' => 'Érvénytelen állapot.'];
        }
        $stmt = $this->db->prepare("UPDATE fuvarok SET allapot = :allapot WHERE id = :id AND admin = :admin AND torolt <> 'I'");
        $stmt->bindValue(':allapot', $allapot);
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        if ($stmt->rowCount() === 0) {
            return ['success' => false, 'message' => 'A fuvar nem található.'];
        }
        return ['success' => true, 'message' => 'Állapot frissítve.', 'fuvar' => $this->getFuvar($id, $ceg_id)['fuvar']];
    }

    // Nincs Számlázz.hu API-integráció (ld. project memory) — az admin
    // saját maga állítja ki a számlát a Számlázz.hu felületén, ez a
    // metódus csak a szám UTÓLAGOS, kézi rögzítését végzi, egyszerre
    // több (tömegesen kijelölt), ugyanazon számlához tartozó fuvarra —
    // N:1 kapcsolat, ezért `$idk` egy id-lista, nem egyetlen id.
    public function hozzarendelSzamlaszamot($idk, $ceg_id, $szamlaszam) {
        $szamlaszam = trim((string) $szamlaszam);
        if ($szamlaszam === '') {
            return ['success' => false, 'message' => 'A számlaszám nem lehet üres.'];
        }
        $idk = array_values(array_unique(array_filter(array_map('intval', (array) $idk))));
        if (empty($idk)) {
            return ['success' => false, 'message' => 'Nincs kiválasztott fuvar.'];
        }
        $helyorzok = implode(',', array_fill(0, count($idk), '?'));
        $params = array_merge([$szamlaszam, $ceg_id], $idk);
        $stmt = $this->db->prepare(
            "UPDATE fuvarok SET szamlaszam = ?, allapot = 'szamlazva' WHERE admin = ? AND torolt <> 'I' AND id IN ($helyorzok)"
        );
        $stmt->execute($params);
        return ['success' => true, 'message' => 'Számlaszám hozzárendelve.', 'darab' => $stmt->rowCount()];
    }

    // Mindig a TELJES állomány állapotonkénti száma, függetlenül a lista
    // aktuális keresésétől/szűrőjétől — az összesítő-chipek "hol tartunk
    // összesen" áttekintést adnak, nem a szűrt eredményhalmaz számát.
    public function getAllapotOsszesito($ceg_id) {
        $stmt = $this->db->prepare("SELECT allapot, COUNT(*) AS db FROM fuvarok WHERE admin = :admin AND torolt <> 'I' GROUP BY allapot");
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();

        $osszesito = array_fill_keys(self::ALLAPOT_ERTEKEK, 0);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if (isset($osszesito[$row['allapot']])) {
                $osszesito[$row['allapot']] = (int) $row['db'];
            }
        }
        return ['success' => true, 'osszesito' => $osszesito];
    }

    public function deleteFuvar($id, $ceg_id) {
        $stmt = $this->db->prepare("UPDATE fuvarok SET torolt = 'I' WHERE id = :id AND admin = :admin");
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'message' => 'Fuvar törölve.'];
    }

    // FONTOS: ez a projekt saját SQL-lintere tiltja a JOIN-t és a UNION-t
    // (ld. `koltsegInterface.php`-ban a flotta-átlag-karbantartási-költség
    // hasonló megjegyzését) — a sofőr/kamion/furgon/pótkocsi/megbízó
    // megjelenítendő nevét/rendszámát ezért KÜLÖN lekérdezésekkel, PHP-
    // oldali összefésüléssel csatoljuk a fuvar-sorokhoz, nem JOIN-nal.
    // Ugyanaz a minta, mint `helyszinInterface::
    // hozzafuzMegjegyzesekSzama()`-nál.
    public function getFuvar($id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT *, (fuvardij + IFNULL(egyeb_koltseg, 0)) AS dij
             FROM fuvarok WHERE id = :id AND admin = :admin AND torolt <> 'I'"
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

    public function getFuvarok($ceg_id, $search = null, $page = null, $pageSize = null, $sortKey = null, $sortDir = 'asc', $allapot = null, $datumTol = null, $datumIg = null) {
        $params = [':admin' => $ceg_id];
        $query = "SELECT *, (fuvardij + IFNULL(egyeb_koltseg, 0)) AS dij FROM fuvarok WHERE admin = :admin AND torolt <> 'I'";

        if (!empty($allapot)) {
            $query .= " AND allapot = :allapot";
            $params[':allapot'] = $allapot;
        }
        // `$datumTol`/`$datumIg` — a Sofőr szerinti nézet heti navigációjához
        // (ld. Fuvarok.js/SoforCsoportositottLista.js): az a nézet a
        // lapozás megkerülésével (page=null) kéri le EGY adott hét összes
        // fuvarját, nem a táblázat-nézet oldalankénti szeletét. A lerakás
        // dátuma az elsődleges dátum (ld. design spec).
        if (!empty($datumTol)) {
            $query .= " AND lerakas_datuma >= :datumTol";
            $params[':datumTol'] = $datumTol;
        }
        if (!empty($datumIg)) {
            $query .= " AND lerakas_datuma <= :datumIg";
            $params[':datumIg'] = $datumIg;
        }
        if (!empty($search)) {
            // A saját mezők (felrakó/lerakó cég+cím/áru/raklapszám) LIKE-
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

            $sajatMezoFeltetel = "(felrako_ceg LIKE :search OR felrako_cim LIKE :search OR lerako_ceg LIKE :search OR lerako_cim LIKE :search OR aru_megnevezese LIKE :search OR raklapszam LIKE :search)";
            $params[':search'] = '%' . $search . '%';

            $query .= " AND (" . implode(' OR ', array_merge([$sajatMezoFeltetel], $entitasFeltetelek)) . ")";
        }

        $rendezoOszlop = self::RENDEZHETO_OSZLOPOK[$sortKey] ?? 'lerakas_datuma';
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
        $fuvar['megbizo_cim'] = $this->egyMezoLekerdezese('ugyfelek', 'cim', $fuvar['megbizo_id'], $ceg_id);
        $fuvar['megbizo_irsz'] = $this->egyMezoLekerdezese('ugyfelek', 'irsz', $fuvar['megbizo_id'], $ceg_id);
        $fuvar['megbizo_varos'] = $this->egyMezoLekerdezese('ugyfelek', 'varos', $fuvar['megbizo_id'], $ceg_id);
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
        $megbizoCimek = $this->batchLekerdezes('ugyfelek', 'cim', array_column($fuvarok, 'megbizo_id'), $ceg_id);
        $megbizoIrszek = $this->batchLekerdezes('ugyfelek', 'irsz', array_column($fuvarok, 'megbizo_id'), $ceg_id);
        $megbizoVarosok = $this->batchLekerdezes('ugyfelek', 'varos', array_column($fuvarok, 'megbizo_id'), $ceg_id);

        foreach ($fuvarok as &$fuvar) {
            $fuvar['sofor_nev'] = $soforNevek[$fuvar['sofor_id']] ?? null;
            $fuvar['kamion_rendszam'] = $kamionRendszamok[$fuvar['kamion_id']] ?? null;
            $fuvar['furgon_rendszam'] = $furgonRendszamok[$fuvar['furgon_id']] ?? null;
            $fuvar['potkocsi_rendszam'] = $potkocsiRendszamok[$fuvar['potkocsi_id']] ?? null;
            $fuvar['megbizo_nev'] = $megbizoNevek[$fuvar['megbizo_id']] ?? null;
            $fuvar['megbizo_cim'] = $megbizoCimek[$fuvar['megbizo_id']] ?? null;
            $fuvar['megbizo_irsz'] = $megbizoIrszek[$fuvar['megbizo_id']] ?? null;
            $fuvar['megbizo_varos'] = $megbizoVarosok[$fuvar['megbizo_id']] ?? null;
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

    // Egy adott naptári hónap munkanapjainak száma (hétvégék levonva,
    // ünnepnap-lista nélkül — ugyanaz az egyszerűsítés, mint a bér-
    // arányosítási döntésnél). Kizárólag az `atlagNapiProfit` osztójaként
    // használt — a kiadás-számítás maga nem prorat, ld. getStatisztikak()
    // komment.
    private function munkanapokHonapban($honapKulcs) {
        $napokSzama = (int) (new DateTime("$honapKulcs-01"))->format('t');
        $munkanapok = 0;
        for ($nap = 1; $nap <= $napokSzama; $nap++) {
            $datum = new DateTime($honapKulcs . '-' . str_pad($nap, 2, '0', STR_PAD_LEFT));
            if ((int) $datum->format('N') < 6) {
                $munkanapok++;
            }
        }
        return $munkanapok;
    }

    // Referencia, NEM autofill — a megbízó "szokásos fuvardíjai" mezőnek,
    // ld. design spec 6.2. Útvonalanként erősen eltérhet a díj, ezért a
    // frontend csak megjeleníti, nem tölti be automatikusan a dij
    // mezőbe.
    // Whole-branch review Minor finding: `ORDER BY lerakas_datuma DESC`
    // önmagában NULL `lerakas_datuma`-jú sorokat mindig a lista VÉGÉRE
    // sorolt (MySQL NULL-DESC szemantika) — egy ténylegesen friss, de még
    // dátum nélküli fuvar így kieshetett a `LIMIT`-ből egy régebbi, de
    // dátumozott sor mögött. A `letrehozva DESC` másodlagos rendezőkulcs
    // egyrészt a NULL-datumú sorokat is ésszerű (rögzítés-időrendi)
    // sorrendbe teszi egymás között, másrészt tiebreaker azonos
    // `lerakas_datuma` esetén is.
    public function getUgyfelElozmeny($ugyfelId, $ceg_id, $limit = 5) {
        $stmt = $this->db->prepare(
            "SELECT lerakas_datuma, felrako_ceg, lerako_ceg, (fuvardij + IFNULL(egyeb_koltseg, 0)) AS dij
             FROM fuvarok
             WHERE megbizo_id = :megbizo_id AND admin = :admin AND torolt <> 'I'
             ORDER BY lerakas_datuma DESC, letrehozva DESC
             LIMIT " . (int) $limit
        );
        $stmt->bindValue(':megbizo_id', $ugyfelId, PDO::PARAM_INT);
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    // A KIVÁLASZTOTT megbízóhoz korábban már rögzített útvonalak
    // (felrakó+lerakó PÁRBAN, ahogy ténylegesen együtt előfordultak),
    // legutóbb használt elöl — a FuvarForm.js "Korábbi útvonalak"
    // felugró választójához, ami a megbízó kiválasztása után jelenik
    // meg. Szándékosan CSAK az adott megbízóra szűkítve (nem
    // cégszinten) — egy másik ügyfél telephelye itt irreleváns/
    // félrevezető lenne. `$limit` közvetlenül a lekérdezésbe fűzve
    // (int-re kasztolva, nem bind-elhető LIMIT paraméterként) —
    // ugyanaz a minta, mint getUgyfelElozmeny()-nél.
    public function getUtvonalElozmenyek($ceg_id, $megbizoId, $limit = 8) {
        $limit = (int) $limit;
        $stmt = $this->db->prepare(
            "SELECT felrako_ceg, felrako_cim, lerako_ceg, lerako_cim, MAX(letrehozva) AS utolso
             FROM fuvarok
             WHERE admin = :admin AND megbizo_id = :megbizo_id AND torolt <> 'I'
               AND felrako_ceg IS NOT NULL AND felrako_ceg <> ''
               AND lerako_ceg IS NOT NULL AND lerako_ceg <> ''
             GROUP BY felrako_ceg, felrako_cim, lerako_ceg, lerako_cim
             ORDER BY utolso DESC
             LIMIT $limit"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->bindValue(':megbizo_id', $megbizoId, PDO::PARAM_INT);
        $stmt->execute();

        return ['success' => true, 'utvonalak' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    // Sofőr-oldali "saját fuvarjaim" lekérdezés — csak operatív mezőket ad
    // vissza (útvonal/dátum/jármű/megbízó), SOHA fuvardíj/egyéb költség/
    // számlaszámot (ezek admin-oldali pénzügyi mezők, ld. design spec 5.1).
    // `$aktivOnly=true`: a sofőr még nem zárta le (nincs menetlevél-fotó) ÉS
    // az admin sem zárta le (`allapot<>'teljesitve'`) — a kettő bármelyike
    // független módon lezárhatja a fuvart a sofőr szemszögéből (ld. spec 4.1).
    public function getSajatFuvarok($sofor_id, $ceg_id, $aktivOnly = true) {
        $lezarasFeltetel = $aktivOnly
            ? "AND dokumentum_feltoltve IS NULL AND allapot <> 'teljesitve'"
            : "AND (dokumentum_feltoltve IS NOT NULL OR allapot = 'teljesitve')";
        $stmt = $this->db->prepare(
            "SELECT id, kamion_id, furgon_id, potkocsi_id, felrakas_datuma, lerakas_datuma,
                    felrako_ceg, felrako_cim, lerako_ceg, lerako_cim,
                    tavolsag_km, tomeg_tonna, raklapszam, megbizo_id, aru_megnevezese, megjegyzes, allapot,
                    dokumentum_feltoltve
             FROM fuvarok
             WHERE sofor_id = :sofor_id AND admin = :ceg_id AND torolt <> 'I' $lezarasFeltetel
             ORDER BY lerakas_datuma DESC, letrehozva DESC"
        );
        $stmt->bindValue(':sofor_id', $sofor_id, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true, 'fuvarok' => $this->dusitSorokat($stmt->fetchAll(PDO::FETCH_ASSOC), $ceg_id)];
    }

    // Egyetlen fuvar, `sofor_id` egyezés-ellenőrzéssel — ha a fuvar nem
    // létezik VAGY nem a hívó sofőré, `success:false` (ugyanaz az IDOR-
    // védelmi minta, mint a `torolSajatFuvarDokumentumot`/
    // `feltoltFuvarDokumentumot` action-öknél).
    public function getSajatFuvar($id, $sofor_id, $ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id, kamion_id, furgon_id, potkocsi_id, felrakas_datuma, lerakas_datuma,
                    felrako_ceg, felrako_cim, lerako_ceg, lerako_cim,
                    tavolsag_km, tomeg_tonna, raklapszam, megbizo_id, aru_megnevezese, megjegyzes, allapot,
                    dokumentum_feltoltve
             FROM fuvarok
             WHERE id = :id AND sofor_id = :sofor_id AND admin = :ceg_id AND torolt <> 'I'"
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->bindValue(':sofor_id', $sofor_id, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvar = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($fuvar === false) {
            return ['success' => false, 'message' => 'A fuvar nem található.'];
        }
        return ['success' => true, 'fuvar' => $this->dusitEgySort($fuvar, $ceg_id)];
    }

    // Csak az ELSŐ menetlevél-feltöltéskor ír ténylegesen (idempotens) —
    // ld. design spec 5.1. Sosem hívjuk közvetlenül kliensből; a
    // feltoltFuvarDokumentumot action (Task 5) hívja belülről sikeres
    // 'menetlevel'-tagelt feltöltés után.
    public function allitDokumentumFeltoltve($fuvarId, $ceg_id) {
        $stmt = $this->db->prepare(
            "UPDATE fuvarok SET dokumentum_feltoltve = NOW()
             WHERE id = :id AND admin = :ceg_id AND dokumentum_feltoltve IS NULL"
        );
        $stmt->bindValue(':id', $fuvarId, PDO::PARAM_INT);
        $stmt->bindValue(':ceg_id', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        return ['success' => true];
    }

    // Statisztikai dashboardok (2026-07-26): sofőr/jármű/megbízó/havi bontás
    // + pénzügyi összesítő, MIND egyetlen lekérdezésből, PHP-oldali
    // csoportosítással (nincs GROUP BY-onkénti külön SELECT, nincs JOIN).
    // "Lejárt számla" / "kintlévőség" NEM NAV-adatból, hanem helyben
    // számolt határidőből jön: teljesítés dátuma + ugyfelek.fizetesi_hatarido_nap
    // — tudatos döntés, a NAV Online Számla-integráció explicit kihagyása
    // miatt (nincs itt hitelesítő adat, és a NAV amúgy sem ad megbízható
    // "kifizetve" jelzést, csak a számlán deklarált határidőt, amit mi is
    // ugyanígy ki tudunk számolni a már meglévő adatokból).
    public function getStatisztikak($ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id, sofor_id, kamion_id, furgon_id, lerakas_datuma, tavolsag_km,
                    megbizo_id, (fuvardij + IFNULL(egyeb_koltseg, 0)) AS dij, allapot
             FROM fuvarok WHERE admin = :admin AND torolt <> 'I'"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvarok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($fuvarok as &$f) {
            $f['osszesen'] = (float) ($f['dij'] ?? 0);
        }
        unset($f);

        $soforNevek = $this->batchLekerdezes('user', 'name', array_column($fuvarok, 'sofor_id'), $ceg_id);
        $kamionRendszamok = $this->batchLekerdezes('kamion', 'rendszam', array_column($fuvarok, 'kamion_id'), $ceg_id);
        $furgonRendszamok = $this->batchLekerdezes('furgon', 'rendszam', array_column($fuvarok, 'furgon_id'), $ceg_id);
        $megbizoNevek = $this->batchLekerdezes('ugyfelek', 'nev', array_column($fuvarok, 'megbizo_id'), $ceg_id);
        $megbizoHataridok = $this->batchLekerdezes('ugyfelek', 'fizetesi_hatarido_nap', array_column($fuvarok, 'megbizo_id'), $ceg_id);

        $ma = date('Y-m-d');
        $lejartE = function ($f) use ($megbizoHataridok, $ma) {
            if (empty($f['lerakas_datuma']) || empty($f['megbizo_id'])) {
                return false;
            }
            $napok = $megbizoHataridok[$f['megbizo_id']] ?? null;
            if ($napok === null || $napok === '') {
                return false;
            }
            $hatarido = date('Y-m-d', strtotime($f['lerakas_datuma'] . " +{$napok} days"));
            return $hatarido < $ma;
        };

        // 1. Sofőr statisztika
        $soforStat = [];
        foreach ($fuvarok as $f) {
            if (empty($f['sofor_id'])) {
                continue;
            }
            $sid = $f['sofor_id'];
            if (!isset($soforStat[$sid])) {
                $soforStat[$sid] = ['sofor_id' => (int) $sid, 'nev' => $soforNevek[$sid] ?? 'Ismeretlen', 'fuvarokSzama' => 0, 'kmOsszesen' => 0, 'bevetelOsszesen' => 0.0];
            }
            $soforStat[$sid]['fuvarokSzama']++;
            $soforStat[$sid]['kmOsszesen'] += (int) ($f['tavolsag_km'] ?? 0);
            $soforStat[$sid]['bevetelOsszesen'] += $f['osszesen'];
        }
        foreach ($soforStat as &$s) {
            $s['atlagFuvardij'] = $s['fuvarokSzama'] > 0 ? round($s['bevetelOsszesen'] / $s['fuvarokSzama'], 2) : 0;
            $s['bevetelOsszesen'] = round($s['bevetelOsszesen'], 2);
        }
        unset($s);
        $soforStat = array_values($soforStat);
        usort($soforStat, fn($a, $b) => $b['bevetelOsszesen'] <=> $a['bevetelOsszesen']);

        // 2. Jármű (kamion+furgon) statisztika
        $jarmuStat = [];
        foreach ($fuvarok as $f) {
            $tipus = null;
            $jid = null;
            $rendszam = null;
            if (!empty($f['kamion_id'])) {
                $tipus = 'kamion';
                $jid = $f['kamion_id'];
                $rendszam = $kamionRendszamok[$jid] ?? 'Ismeretlen';
            } elseif (!empty($f['furgon_id'])) {
                $tipus = 'furgon';
                $jid = $f['furgon_id'];
                $rendszam = $furgonRendszamok[$jid] ?? 'Ismeretlen';
            }
            if ($tipus === null) {
                continue;
            }
            $kulcs = "$tipus:$jid";
            if (!isset($jarmuStat[$kulcs])) {
                $jarmuStat[$kulcs] = ['tipus' => $tipus, 'jarmu_id' => (int) $jid, 'rendszam' => $rendszam, 'fuvarokSzama' => 0, 'kmOsszesen' => 0, 'bevetelOsszesen' => 0.0];
            }
            $jarmuStat[$kulcs]['fuvarokSzama']++;
            $jarmuStat[$kulcs]['kmOsszesen'] += (int) ($f['tavolsag_km'] ?? 0);
            $jarmuStat[$kulcs]['bevetelOsszesen'] += $f['osszesen'];
        }
        foreach ($jarmuStat as &$j) {
            $j['bevetelPerKm'] = $j['kmOsszesen'] > 0 ? round($j['bevetelOsszesen'] / $j['kmOsszesen'], 2) : null;
            $j['bevetelOsszesen'] = round($j['bevetelOsszesen'], 2);
        }
        unset($j);
        $jarmuStat = array_values($jarmuStat);
        usort($jarmuStat, fn($a, $b) => $b['bevetelOsszesen'] <=> $a['bevetelOsszesen']);

        // 3. Megbízó statisztika
        $megbizoStat = [];
        foreach ($fuvarok as $f) {
            if (empty($f['megbizo_id'])) {
                continue;
            }
            $mid = $f['megbizo_id'];
            if (!isset($megbizoStat[$mid])) {
                $megbizoStat[$mid] = ['megbizo_id' => (int) $mid, 'nev' => $megbizoNevek[$mid] ?? 'Ismeretlen', 'fuvarokSzama' => 0, 'arbevetel' => 0.0, 'lejartSzamlakSzama' => 0];
            }
            $megbizoStat[$mid]['fuvarokSzama']++;
            $megbizoStat[$mid]['arbevetel'] += $f['osszesen'];
            if (in_array($f['allapot'], ['szamlazva', 'fizetesre_var'], true) && $lejartE($f)) {
                $megbizoStat[$mid]['lejartSzamlakSzama']++;
            }
        }
        foreach ($megbizoStat as &$m) {
            $m['arbevetel'] = round($m['arbevetel'], 2);
        }
        unset($m);
        $megbizoStat = array_values($megbizoStat);
        usort($megbizoStat, fn($a, $b) => $b['arbevetel'] <=> $a['arbevetel']);

        // 4. Havi statisztika (utolsó 12, lerakás dátuma szerinti hónap)
        $havi = [];
        foreach ($fuvarok as $f) {
            if (empty($f['lerakas_datuma'])) {
                continue;
            }
            $ho = substr($f['lerakas_datuma'], 0, 7);
            if (!isset($havi[$ho])) {
                $havi[$ho] = ['honap' => $ho, 'fuvarokSzama' => 0, 'bevetelOsszesen' => 0.0, 'kmOsszesen' => 0];
            }
            $havi[$ho]['fuvarokSzama']++;
            $havi[$ho]['bevetelOsszesen'] += $f['osszesen'];
            $havi[$ho]['kmOsszesen'] += (int) ($f['tavolsag_km'] ?? 0);
        }
        foreach ($havi as &$h) {
            $h['atlagFuvardij'] = $h['fuvarokSzama'] > 0 ? round($h['bevetelOsszesen'] / $h['fuvarokSzama'], 2) : 0;
            $h['atlagKmPerFuvar'] = $h['fuvarokSzama'] > 0 ? round($h['kmOsszesen'] / $h['fuvarokSzama'], 1) : 0;
            $h['bevetelOsszesen'] = round($h['bevetelOsszesen'], 2);
        }
        unset($h);
        ksort($havi);
        $havi = array_values(array_slice($havi, -12, 12, true));

        // Fuvarozási profit — a Fuvarok saját bevétele (dij) mínusz a
        // flotta-szintű üzemanyag+útdíj+bér kiadás,
        // havi bontásban. Ez EGY ÖNÁLLÓ, csak-a-fuvarozásból nézet — a
        // Fuvar-bevétel sosem folyik be a Pénzforgalom fő `egyeb_koltsegek`
        // bevétel-táblájába, tehát ez a szám NEM egyezik a Pénzforgalom
        // fő "Nettó eredmény"-ével (ld. design spec "Nem célok").
        global $koltsegInterface;
        $elsoHonap = $havi[0]['honap'] ?? null;
        $utolsoHonapKulcs = $havi[count($havi) - 1]['honap'] ?? null;
        if ($elsoHonap && $utolsoHonapKulcs) {
            $koltsegDatumTol = $elsoHonap . '-01';
            $koltsegDatumIg = date('Y-m-t', strtotime($utolsoHonapKulcs . '-01'));
            $uzemanyagKiadasHavonta = $koltsegInterface->getUzemanyagKiadasHavonta($ceg_id, $koltsegDatumTol, $koltsegDatumIg);
            $utdijKiadasHavonta = $koltsegInterface->getUtdijKiadasHavonta($ceg_id, $koltsegDatumTol, $koltsegDatumIg);
            $berKiadasHavonta = $koltsegInterface->getBerKiadasHavonta($ceg_id, $koltsegDatumTol, $koltsegDatumIg);
        } else {
            $uzemanyagKiadasHavonta = [];
            $utdijKiadasHavonta = [];
            $berKiadasHavonta = [];
        }
        foreach ($havi as &$h) {
            $uzemanyagKiadas = $uzemanyagKiadasHavonta[$h['honap']] ?? 0;
            $utdijKiadas = $utdijKiadasHavonta[$h['honap']] ?? 0;
            $berKiadas = $berKiadasHavonta[$h['honap']] ?? 0;
            $h['kiadasOsszesen'] = round($uzemanyagKiadas + $utdijKiadas + $berKiadas, 2);
            $h['profit'] = round($h['bevetelOsszesen'] - $h['kiadasOsszesen'], 2);
            $munkanapok = $this->munkanapokHonapban($h['honap']);
            $h['atlagNapiProfit'] = $munkanapok > 0 ? round($h['profit'] / $munkanapok, 2) : 0;
        }
        unset($h);

        $utolsoHonapSor = end($havi);
        reset($havi);
        $fuvarozasiProfit = [
            'honap' => $utolsoHonapSor['honap'] ?? null,
            'bevetel' => $utolsoHonapSor['bevetelOsszesen'] ?? 0,
            'kiadas' => $utolsoHonapSor['kiadasOsszesen'] ?? 0,
            'profit' => $utolsoHonapSor['profit'] ?? 0,
        ];

        // 5. Pénzügyi dashboard
        $kintlevoseg = 0.0;
        $lejartSzamlak = 0;
        $fizetesreVarokSzama = 0;
        $varhatoBevetel = 0.0;
        foreach ($fuvarok as $f) {
            if (in_array($f['allapot'], ['szamlazva', 'fizetesre_var'], true)) {
                $kintlevoseg += $f['osszesen'];
                $fizetesreVarokSzama++;
                if ($lejartE($f)) {
                    $lejartSzamlak++;
                }
            }
            if (in_array($f['allapot'], ['rogzitett', 'szamlazasra_var', 'szamlazva', 'fizetesre_var'], true)) {
                $varhatoBevetel += $f['osszesen'];
            }
        }

        return [
            'success' => true,
            'soforStatisztika' => $soforStat,
            'jarmuStatisztika' => $jarmuStat,
            'megbizoStatisztika' => $megbizoStat,
            'haviStatisztika' => $havi,
            'penzugyiDashboard' => [
                'kintlevoseg' => round($kintlevoseg, 2),
                'lejartSzamlakSzama' => $lejartSzamlak,
                'fizetesreVarokSzama' => $fizetesreVarokSzama,
                'varhatoBevetel' => round($varhatoBevetel, 2),
            ],
            'fuvarozasiProfit' => $fuvarozasiProfit,
        ];
    }

    // Státusz-workflow — NEM automatizál allapot-váltást (felhasználói döntés:
    // csak jelezzünk, ne írjunk automatikusan az adatba), csak összegyűjti,
    // mire érdemes az adminnak ránéznie. Két, egymástól független, minden
    // előfeltevés nélküli jelzés: (1) már számlázott, de a megbízó fizetési
    // határideje lejárt (ugyanaz a számítás, mint a getStatisztikak()-ban,
    // itt egyedi rekord-szinten); (2) a teljesítés dátuma már elmúlt, de a
    // fuvar még mindig a kezdeti 'rogzitett' állapotban van — nincs
    // "hány nap késés számít soknak" jellegű, meg nem erősített küszöb,
    // pusztán a tény, hogy a leszállítás megtörtént, de semmi nincs számlázva.
    public function getFigyelmeztetesek($ceg_id) {
        $stmt = $this->db->prepare(
            "SELECT id, felrako_ceg, lerako_ceg, lerakas_datuma, megbizo_id, (fuvardij + IFNULL(egyeb_koltseg, 0)) AS dij, allapot, szamlaszam
             FROM fuvarok
             WHERE admin = :admin AND torolt <> 'I' AND allapot IN ('rogzitett', 'szamlazva', 'fizetesre_var')"
        );
        $stmt->bindValue(':admin', $ceg_id, PDO::PARAM_INT);
        $stmt->execute();
        $fuvarok = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $megbizoNevek = $this->batchLekerdezes('ugyfelek', 'nev', array_column($fuvarok, 'megbizo_id'), $ceg_id);
        $megbizoHataridok = $this->batchLekerdezes('ugyfelek', 'fizetesi_hatarido_nap', array_column($fuvarok, 'megbizo_id'), $ceg_id);

        $ma = date('Y-m-d');
        $lejartFizetes = [];
        $szamlazasraVar = [];
        foreach ($fuvarok as $f) {
            $osszesen = round((float) ($f['dij'] ?? 0), 2);
            $utvonal = trim(($f['felrako_ceg'] ?: '') . ($f['felrako_ceg'] && $f['lerako_ceg'] ? ' → ' : '') . ($f['lerako_ceg'] ?: ''));
            $utvonal = $utvonal !== '' ? $utvonal : 'Fuvar';
            $megbizoNev = !empty($f['megbizo_id']) ? ($megbizoNevek[$f['megbizo_id']] ?? 'Ismeretlen') : null;

            if (in_array($f['allapot'], ['szamlazva', 'fizetesre_var'], true) && !empty($f['lerakas_datuma']) && !empty($f['megbizo_id'])) {
                $napok = $megbizoHataridok[$f['megbizo_id']] ?? null;
                if ($napok !== null && $napok !== '') {
                    $hatarido = date('Y-m-d', strtotime($f['lerakas_datuma'] . " +{$napok} days"));
                    if ($hatarido < $ma) {
                        $lejartFizetes[] = [
                            'id' => (int) $f['id'],
                            'utvonal' => $utvonal,
                            'felrako' => $f['felrako_ceg'],
                            'megbizoNev' => $megbizoNev,
                            'osszesen' => $osszesen,
                            'hatarido' => $hatarido,
                            'szamlaszam' => $f['szamlaszam'],
                        ];
                    }
                }
            }

            if ($f['allapot'] === 'rogzitett' && !empty($f['lerakas_datuma']) && $f['lerakas_datuma'] < $ma) {
                $szamlazasraVar[] = [
                    'id' => (int) $f['id'],
                    'utvonal' => $utvonal,
                    'felrako' => $f['felrako_ceg'],
                    'megbizoNev' => $megbizoNev,
                    'osszesen' => $osszesen,
                    'teljesitesDatuma' => $f['lerakas_datuma'],
                ];
            }
        }
        usort($lejartFizetes, fn($a, $b) => $a['hatarido'] <=> $b['hatarido']);
        usort($szamlazasraVar, fn($a, $b) => $a['teljesitesDatuma'] <=> $b['teljesitesDatuma']);

        return [
            'success' => true,
            'lejartFizetes' => $lejartFizetes,
            'szamlazasraVar' => $szamlazasraVar,
        ];
    }

    const TREND_GRANULARITAS = ['nap', 'het', 'honap'];

    // Sofőrönkénti fuvar/dokumentum-linkeltség + trend, egyetlen szűrt
    // SELECT-ből, PHP-oldali aggregációval (ld. getStatisztikak() ugyanezen
    // mintája) — a "dokumentált"/"hiányzó" a fuvarok.beerkezett_dokumentum_id
    // oszlopra épül (a Fuvarok/Beérkezett dokumentumok UX-redesign vezette
    // be), NEM a beerkezett_dokumentumok.feltolto_id-ra (ami a feltöltőt,
    // nem a fuvart végző sofőrt jelentené — ld. a design spec 2. pontja).
    public function getSoforDashboard(
        $ceg_id,
        $datumTol = null,
        $datumIg = null,
        $soforId = null,
        $fuvarAllapot = null,
        $dokumentumSzuro = null,
        $granularitas = null
    ) {
        $params = [':admin' => $ceg_id];
        $query = "SELECT id, sofor_id, lerakas_datuma, allapot, beerkezett_dokumentum_id,
                         (fuvardij + IFNULL(egyeb_koltseg, 0)) AS dij
                  FROM fuvarok WHERE admin = :admin AND torolt <> 'I'";

        if (!empty($datumTol)) {
            $query .= " AND lerakas_datuma >= :datum_tol";
            $params[':datum_tol'] = $datumTol;
        }
        if (!empty($datumIg)) {
            $query .= " AND lerakas_datuma <= :datum_ig";
            $params[':datum_ig'] = $datumIg;
        }
        if (!empty($soforId)) {
            $query .= " AND sofor_id = :sofor_id";
            $params[':sofor_id'] = $soforId;
        }
        if (!empty($fuvarAllapot)) {
            $query .= " AND allapot = :allapot";
            $params[':allapot'] = $fuvarAllapot;
        }
        if ($dokumentumSzuro === 'van') {
            $query .= " AND beerkezett_dokumentum_id IS NOT NULL";
        } elseif ($dokumentumSzuro === 'nincs') {
            $query .= " AND beerkezett_dokumentum_id IS NULL";
        }

        $stmt = $this->db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $fuvarok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($fuvarok as &$f) {
            $f['osszesen'] = (float) ($f['dij'] ?? 0);
        }
        unset($f);

        $soforNevek = $this->batchLekerdezes('user', 'name', array_column($fuvarok, 'sofor_id'), $ceg_id);

        // 1. Sofőrönkénti bontás
        $soforStat = [];
        $nemHozzarendeltSzama = 0;
        foreach ($fuvarok as $f) {
            if (empty($f['sofor_id'])) {
                $nemHozzarendeltSzama++;
                continue;
            }
            $sid = $f['sofor_id'];
            if (!isset($soforStat[$sid])) {
                $soforStat[$sid] = [
                    'sofor_id' => (int) $sid,
                    'nev' => $soforNevek[$sid] ?? 'Ismeretlen',
                    'fuvarokSzama' => 0,
                    'dokumentaltSzama' => 0,
                    'bevetelOsszesen' => 0.0,
                    'utolsoFuvarDatuma' => null,
                ];
            }
            $soforStat[$sid]['fuvarokSzama']++;
            if (!empty($f['beerkezett_dokumentum_id'])) {
                $soforStat[$sid]['dokumentaltSzama']++;
            }
            $soforStat[$sid]['bevetelOsszesen'] += $f['osszesen'];
            if (
                !empty($f['lerakas_datuma'])
                && ($soforStat[$sid]['utolsoFuvarDatuma'] === null || $f['lerakas_datuma'] > $soforStat[$sid]['utolsoFuvarDatuma'])
            ) {
                $soforStat[$sid]['utolsoFuvarDatuma'] = $f['lerakas_datuma'];
            }
        }
        foreach ($soforStat as &$s) {
            $s['hianyzoSzama'] = $s['fuvarokSzama'] - $s['dokumentaltSzama'];
            $s['bevetelOsszesen'] = round($s['bevetelOsszesen'], 2);
        }
        unset($s);
        $soforStat = array_values($soforStat);
        usort($soforStat, fn($a, $b) => $b['fuvarokSzama'] <=> $a['fuvarokSzama']);

        // 2. Összesítő
        $aktivSoforokSzama = count($soforStat);
        $hozzarendeltFuvarSzama = count($fuvarok) - $nemHozzarendeltSzama;
        $hianyzoDokumentumSzama = 0;
        foreach ($fuvarok as $f) {
            if (empty($f['beerkezett_dokumentum_id'])) {
                $hianyzoDokumentumSzama++;
            }
        }
        $osszesito = [
            'osszesFuvar' => count($fuvarok),
            'aktivSoforokSzama' => $aktivSoforokSzama,
            'hianyzoDokumentumSzama' => $hianyzoDokumentumSzama,
            'atlagFuvarSoforonkent' => $aktivSoforokSzama > 0 ? round($hozzarendeltFuvarSzama / $aktivSoforokSzama, 1) : 0,
            'nemHozzarendeltFuvarSzama' => $nemHozzarendeltSzama,
        ];

        // 3. Állapot-megoszlás
        $allapotMegoszlas = ['rogzitett' => 0, 'szamlazasra_var' => 0, 'szamlazva' => 0, 'fizetesre_var' => 0, 'teljesitve' => 0];
        foreach ($fuvarok as $f) {
            if (isset($allapotMegoszlas[$f['allapot']])) {
                $allapotMegoszlas[$f['allapot']]++;
            }
        }

        // 4. Trend — granularitás: explicit paraméter, vagy a dátumtartomány
        // hossza alapján automatikus választás (≤31 nap: nap, ≤180 nap: hét,
        // egyébként hónap) — ugyanazt a küszöböt a frontend is használja az
        // alapértelmezett gomb-kiválasztáshoz.
        if (!in_array($granularitas, self::TREND_GRANULARITAS, true)) {
            $napokSzama = (!empty($datumTol) && !empty($datumIg))
                ? (strtotime($datumIg) - strtotime($datumTol)) / 86400
                : 9999;
            $granularitas = $napokSzama <= 31 ? 'nap' : ($napokSzama <= 180 ? 'het' : 'honap');
        }
        $trendBucket = [];
        foreach ($fuvarok as $f) {
            if (empty($f['lerakas_datuma'])) {
                continue;
            }
            if ($granularitas === 'nap') {
                $kulcs = $f['lerakas_datuma'];
            } elseif ($granularitas === 'het') {
                $kulcs = date('o-\WW', strtotime($f['lerakas_datuma']));
            } else {
                $kulcs = substr($f['lerakas_datuma'], 0, 7);
            }
            $trendBucket[$kulcs] = ($trendBucket[$kulcs] ?? 0) + 1;
        }
        ksort($trendBucket);
        $trend = [];
        foreach ($trendBucket as $periodus => $szam) {
            $trend[] = ['periodus' => $periodus, 'fuvarokSzama' => $szam];
        }

        return [
            'success' => true,
            'osszesito' => $osszesito,
            'soforonkent' => $soforStat,
            'allapotMegoszlas' => $allapotMegoszlas,
            'trend' => $trend,
            'granularitas' => $granularitas,
        ];
    }
}

$fuvarInterface = new FuvarInterface();
