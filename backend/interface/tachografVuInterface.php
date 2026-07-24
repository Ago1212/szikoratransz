<?php

// Jármű-egység (VU) letöltés — jármű-központú párja a tachografInterface.php
// sofőrkártya-alapú "digest, admin dönt" mintájának. A tényleges bináris
// dekódolást NEM PHP végzi, hanem a Go `traconiq/tachoparser` nyílt
// forráskódú, statikusan linkelt binárisa (backend/bin/dddparser,
// exec()-kel meghívva) — ugyanaz az elv, mint a MOL PDF-importnál a
// rendszer-szintű `pdftotext`-nél: egy már megoldott, bonyolult bináris
// formátum (EU tachográf VU Gen1/Gen2/Gen2v2, tanúsítvány-láncokkal,
// TREP-blokkokkal) újraimplementálása feleslegesen nagy kockázat lett volna
// egy létező, működő, referencia-eszközhöz képest. A bináris statikusan
// linkelt (nincs Go/megosztott lib függősége futásidőben), de ÉLES
// DEPLOY-KOCKÁZAT: az architektúrának (linux/amd64) egyeznie kell a
// production szerverrel — ha nem, a binárist újra kell fordítani ott.
class TachografVuInterface {
    protected $db;
    const DDDPARSER_BIN = __DIR__ . '/../bin/dddparser';
    // EU 165/2014 — a jármű-egység memóriája kb. 90 napig tárol adatot
    // (szemben a sofőrkártya kb. 28 napos ciklusával), ez a "megfelelőségi"
    // küszöb ehhez a forráshoz.
    const MEGFELELOSEG_RENDBEN_NAP = 75;
    const MEGFELELOSEG_ESEDEKES_NAP = 90;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // ActivityChangeInfo tevékenység-kódok — ugyanaz a leképezés, mint a
    // sofőrkártya-oldalon (DddParser.php::decodeActivityChange()), hogy a
    // két forrás színkódja/címkéi a felületen konzisztensek maradjanak.
    private function activityMap() {
        return [0 => 'piheno', 1 => 'rendelkezesre_allas', 2 => 'munka', 3 => 'vezetes'];
    }

    // Ugyanaz az összesítő algoritmus, mint DddParser::parseDailyActivity()-
    // ban: egymást követő állapotváltások közti percek különbsége adja az
    // adott tevékenységre eső időt; az utolsó változástól éjfélig tartó
    // szakaszt nem számoljuk.
    private function percekSzamitasa($valtozasok) {
        $percek = ['vezetes' => 0, 'munka' => 0, 'rendelkezesre_allas' => 0, 'piheno' => 0];
        for ($i = 0; $i < count($valtozasok) - 1; $i++) {
            $delta = $valtozasok[$i + 1]['perc'] - $valtozasok[$i]['perc'];
            if ($delta < 0) continue;
            $percek[$valtozasok[$i]['tevekenyseg']] += $delta;
        }
        return $percek;
    }

    // A dddparser binárist egy ideiglenes fájlra írt bájttartalommal hívja
    // meg, a JSON kimenetet egy másik ideiglenes fájlba írja, majd beolvassa
    // és törli mindkét ideiglenes fájlt. `null`-t ad vissza, ha a bináris
    // nem futott le sikeresen vagy nem írt érvényes JSON-t.
    private function futtatDddparser($binaryTartalom) {
        if (!is_file(self::DDDPARSER_BIN) || !is_executable(self::DDDPARSER_BIN)) {
            error_log('TachografVuInterface: a dddparser bináris hiányzik vagy nem futtatható: ' . self::DDDPARSER_BIN);
            return null;
        }
        $bemenetiFajl = tempnam(sys_get_temp_dir(), 'vuin_') . '.ddd';
        $kimenetiFajl = tempnam(sys_get_temp_dir(), 'vuout_') . '.json';
        file_put_contents($bemenetiFajl, $binaryTartalom);

        $parancs = escapeshellarg(self::DDDPARSER_BIN)
            . ' --vu --input ' . escapeshellarg($bemenetiFajl)
            . ' --output ' . escapeshellarg($kimenetiFajl)
            . ' --format 2>&1';
        exec($parancs, $kimenetSorai, $returnCode);

        $eredmeny = null;
        if (file_exists($kimenetiFajl)) {
            $nyers = file_get_contents($kimenetiFajl);
            $eredmeny = json_decode($nyers, true);
        }
        @unlink($bemenetiFajl);
        @unlink($kimenetiFajl);
        return $eredmeny;
    }

    private function normalizalRendszam($rendszam) {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $rendszam));
    }

    private function getRendszamok($tabla, $ceg_id) {
        $stmt = $this->db->prepare("SELECT id, rendszam FROM `$tabla` WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[] = ['jarmu_tipus' => $tabla, 'jarmu_id' => $row['id'], 'rendszam' => $row['rendszam']];
        }
        return $map;
    }

    private function keresJarmuRendszamAlapjan($rendszamok, $keresettRendszam) {
        $norm = $this->normalizalRendszam($keresettRendszam);
        foreach ($rendszamok as $r) {
            if ($this->normalizalRendszam($r['rendszam']) === $norm) {
                return ['jarmu_tipus' => $r['jarmu_tipus'], 'jarmu_id' => $r['jarmu_id']];
            }
        }
        return null;
    }

    private function marImportaltDatumok($ceg_id, $vin) {
        $stmt = $this->db->prepare("SELECT datum FROM tachograf_vu_napi_aktivitas WHERE admin = :ceg_id AND vin = :vin");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->bindValue(':vin', $vin);
        $stmt->execute();
        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'datum');
    }

    // Egy nap nyers adatait (Gen2v2 VAGY Gen1 alakról) egységes belső
    // formára hozza — a flottában vegyesen lehetnek régebbi (Gen1) és
    // újabb (Gen2v2) tachográf-egységek, mindkettőt kezelni kell.
    private function napAdatKinyerese($napAdat, $gen, $marImportaltDatumok) {
        if ($gen === 2) {
            $datum = $napAdat['date_of_day_downloaded_record_array']['records'][0] ?? null;
            $kmZaro = $napAdat['odometer_value_midnight_record_array']['records'][0] ?? null;
            $nyersValtozasok = $napAdat['vu_activity_daily_record_array']['records'] ?? [];
            $cardIwRecords = $napAdat['vu_card_iw_record_array']['records'] ?? [];
        } else {
            $datum = $napAdat['time_real'] ?? null;
            $kmZaro = $napAdat['odometer_value_midnight'] ?? null;
            $nyersValtozasok = $napAdat['vu_activity_daily_data']['activity_change_info'] ?? [];
            $cardIwRecords = $napAdat['vu_card_iw_data']['vu_card_iw_records'] ?? [];
        }
        if (!$datum) {
            return null;
        }
        $datumNap = substr($datum, 0, 10);

        $activityMap = $this->activityMap();
        $valtozasok = [];
        foreach (($nyersValtozasok ?: []) as $v) {
            $valtozasok[] = [
                'perc' => $v['minutes'],
                'tevekenyseg' => $activityMap[$v['work_type']] ?? 'piheno',
                'kartya_kivetel' => !($v['card_present'] ?? true),
            ];
        }
        $percek = $this->percekSzamitasa($valtozasok);

        $kartyaReferenciak = [];
        foreach (($cardIwRecords ?: []) as $c) {
            $kartyaReferenciak[] = [
                'nev' => trim(($c['card_holder_name']['holder_surname'] ?? '') . ' ' . ($c['card_holder_name']['holder_first_names'] ?? '')),
                'kartyaszam' => $c['full_card_number_and_generation']['full_card_number']['card_number']
                    ?? $c['full_card_number']['card_number'] ?? null,
                'behelyezve' => $c['card_insertion_time'] ?? null,
                'kivetel' => $c['card_withdrawal_time'] ?? null,
                'kmBehelyezeskor' => $c['vehicle_odometer_value_at_insertion'] ?? null,
                'kmKivetelkor' => $c['vehicle_odometer_value_at_withdrawal'] ?? null,
            ];
        }

        return [
            'datum' => $datumNap,
            'kmZaro' => $kmZaro,
            'vezetesPerc' => $percek['vezetes'],
            'aktivitasValtasok' => $valtozasok,
            'kartyaReferenciak' => $kartyaReferenciak,
            'marImportalva' => in_array($datumNap, $marImportaltDatumok, true),
        ];
    }

    // `$fajlnev`/`$feltolto*` — a nyers .ddd fájl a "Fájlok" központi
    // fájlkezelőbe is bekerül, ugyanúgy mint a sofőrkártya-oldalon.
    public function elemezVuDdd($base64, $ceg_id, $fajlnev = null, $feltoltoTipus = null, $feltoltoId = null, $feltoltoNev = null) {
        try {
            $binary = base64_decode($base64, true);
            if ($binary === false || strlen($binary) < 100) {
                return ['success' => false, 'message' => 'A fájl nem olvasható be érvényes .ddd fájlként.'];
            }

            $json = $this->futtatDddparser($binary);
            if ($json === null) {
                return ['success' => false, 'message' => 'A jármű-egység fájl elemzése sikertelen (a dekóder nem adott érvényes választ).'];
            }

            // Gen2v2 előnyben, ha van érdemi tartalma, különben Gen1-re esünk
            // vissza — vegyes flotta (régebbi/újabb tachográf-egység) is
            // előfordulhat, élő mintafájlokon mindkettő ténylegesen látott.
            $gen = 2;
            $ov = $json['vu_overview_2_v2'] ?? null;
            $act = $json['vu_activities_2_v2'] ?? null;
            if (!$ov || empty($ov['vehicle_identification_number_record_array']['records'])) {
                $gen = 1;
                $ov = $json['vu_overview_1'] ?? null;
                $act = $json['vu_activities_1'] ?? null;
            }
            if (!$ov) {
                return ['success' => false, 'message' => 'Nem sikerült jármű-azonosítást találni a fájlban — ellenőrizd, hogy valódi jármű-egység (.ddd) letöltést töltöttél-e fel, ne sofőrkártyáét.'];
            }

            if ($gen === 2) {
                $vin = $ov['vehicle_identification_number_record_array']['records'][0] ?? null;
                $regRec = $ov['vehicle_registration_identification_record_array']['records'][0] ?? null;
            } else {
                $vin = $ov['vehicle_identification_number'] ?? null;
                $regRec = $ov['vehicle_registration_identification'] ?? null;
            }
            $rendszam = $regRec['vehicle_registration_number'] ?? null;
            if (!$vin || !$rendszam) {
                return ['success' => false, 'message' => 'A fájlból nem sikerült kiolvasni a jármű VIN-jét vagy rendszámát.'];
            }

            $rendszamok = array_merge($this->getRendszamok('kamion', $ceg_id), $this->getRendszamok('furgon', $ceg_id));
            $javasoltJarmu = $this->keresJarmuRendszamAlapjan($rendszamok, $rendszam);
            $marImportaltDatumok = $this->marImportaltDatumok($ceg_id, $vin);

            $napok = [];
            foreach (($act ?: []) as $napAdat) {
                $nap = $this->napAdatKinyerese($napAdat, $gen, $marImportaltDatumok);
                if ($nap !== null) {
                    $napok[] = $nap;
                }
            }

            $this->mentsNyersFajlt($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev);

            return [
                'success' => true,
                'jarmuAzonosito' => ['vin' => $vin, 'rendszam' => $rendszam],
                'javasoltJarmu' => $javasoltJarmu,
                'javaslatForras' => $javasoltJarmu ? 'rendszam' : null,
                'napok' => $napok,
                'generacio' => $gen,
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Csendben elnyeli a hibát — ugyanaz az elv, mint a sofőrkártya-oldali
    // mentsNyersFajlt()-nél.
    private function mentsNyersFajlt($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev) {
        global $filesInterface;
        $nev = $fajlnev ?: 'jarmu_egyseg_import.ddd';
        $raw = base64_decode((string) $base64, true);
        $filesInterface->fileUpload($ceg_id, 'tachograf_import', $ceg_id, $base64, $nev, strlen((string) $raw), null, $feltoltoTipus, $feltoltoId, $feltoltoNev);
    }

    public function alkalmazVuImport($napok, $jarmuTipus, $jarmuId, $vin, $rendszam, $forrasFajlnev, $ceg_id, $generacio = 2, $feltoltoTipus = null, $feltoltoId = null, $feltoltoNev = null) {
        try {
            if (empty($jarmuTipus) || empty($jarmuId)) {
                return ['success' => false, 'message' => 'Nincs kiválasztva jármű.'];
            }
            // `$jarmuTipus` a kliens kérésből jön és tábla-névként épül be az
            // alábbi SQL-be — PDO ezt nem tudja paraméterként kötni (csak
            // értékeket, nem tábla-/mezőneveket), ezért explicit whitelistre
            // van szükség, mielőtt bármi interpolálódna (biztonsági review
            // találat, 2026-07-24, ugyanaz a hibaosztály, amit egy korábbi
            // biztonsági audit is talált máshol a projektben).
            if (!in_array($jarmuTipus, ['kamion', 'furgon'], true)) {
                return ['success' => false, 'message' => 'Érvénytelen jármű típus.'];
            }
            $jarmuStmt = $this->db->prepare("SELECT id FROM `$jarmuTipus` WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $jarmuStmt->bindValue(':id', $jarmuId);
            $jarmuStmt->bindValue(':ceg_id', $ceg_id);
            $jarmuStmt->execute();
            if (!$jarmuStmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A kiválasztott jármű nem található.'];
            }

            $importalt = 0;
            $kihagyva = 0;
            foreach ($napok as $nap) {
                try {
                    $ins = $this->db->prepare(
                        "INSERT INTO tachograf_vu_napi_aktivitas
                            (admin, jarmu_tipus, jarmu_id, vin, rendszam, datum, km_zaro, vezetes_perc, aktivitas_json, kartya_referenciak_json, generacio, forras_fajlnev)
                         VALUES (:admin, :jarmu_tipus, :jarmu_id, :vin, :rendszam, :datum, :km_zaro, :vezetes_perc, :aktivitas_json, :kartya_referenciak_json, :generacio, :forras_fajlnev)"
                    );
                    $ins->bindValue(':admin', $ceg_id);
                    $ins->bindValue(':jarmu_tipus', $jarmuTipus);
                    $ins->bindValue(':jarmu_id', $jarmuId);
                    $ins->bindValue(':vin', $vin);
                    $ins->bindValue(':rendszam', $rendszam);
                    $ins->bindValue(':datum', $nap['datum']);
                    $ins->bindValue(':km_zaro', $nap['kmZaro']);
                    $ins->bindValue(':vezetes_perc', $nap['vezetesPerc']);
                    $ins->bindValue(':aktivitas_json', json_encode($nap['aktivitasValtasok']));
                    $ins->bindValue(':kartya_referenciak_json', json_encode($nap['kartyaReferenciak']));
                    $ins->bindValue(':generacio', $generacio);
                    $ins->bindValue(':forras_fajlnev', $forrasFajlnev);
                    $ins->execute();
                    $importalt++;
                } catch (Exception $e) {
                    // UNIQUE KEY (admin, jarmu_tipus, jarmu_id, datum) ütközés
                    // — a nap már korábban importálva lett.
                    $kihagyva++;
                }
            }

            try {
                $naploIns = $this->db->prepare(
                    "INSERT INTO tachograf_vu_import_naplo
                        (admin, jarmu_tipus, jarmu_id, vin, rendszam, fajlnev, feltolto_tipus, feltolto_id, feltolto_nev, uj_nap, kihagyott_nap)
                     VALUES (:admin, :jarmu_tipus, :jarmu_id, :vin, :rendszam, :fajlnev, :feltolto_tipus, :feltolto_id, :feltolto_nev, :uj_nap, :kihagyott_nap)"
                );
                $naploIns->bindValue(':admin', $ceg_id);
                $naploIns->bindValue(':jarmu_tipus', $jarmuTipus);
                $naploIns->bindValue(':jarmu_id', $jarmuId);
                $naploIns->bindValue(':vin', $vin);
                $naploIns->bindValue(':rendszam', $rendszam);
                $naploIns->bindValue(':fajlnev', $forrasFajlnev);
                $naploIns->bindValue(':feltolto_tipus', $feltoltoTipus);
                $naploIns->bindValue(':feltolto_id', $feltoltoId);
                $naploIns->bindValue(':feltolto_nev', $feltoltoNev);
                $naploIns->bindValue(':uj_nap', $importalt);
                $naploIns->bindValue(':kihagyott_nap', $kihagyva);
                $naploIns->execute();
            } catch (Exception $e) {
                error_log('Jármű-egység import-napló mentése sikertelen: ' . $e->getMessage());
            }

            return ['success' => true, 'importalt' => $importalt, 'kihagyva' => $kihagyva];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function jarmuNevekTomb($ceg_id) {
        $map = [];
        foreach (['kamion', 'furgon'] as $tabla) {
            $stmt = $this->db->prepare("SELECT id, rendszam FROM `$tabla` WHERE admin = :ceg_id");
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $map[$tabla . ':' . $row['id']] = $row['rendszam'];
            }
        }
        return $map;
    }

    public function getJarmuAttekintes($ceg_id) {
        try {
            $sorok = [];
            foreach (['kamion', 'furgon'] as $tabla) {
                $stmt = $this->db->prepare("SELECT id, rendszam FROM `$tabla` WHERE admin = :ceg_id AND torolt <> 'I' ORDER BY rendszam ASC");
                $stmt->bindValue(':ceg_id', $ceg_id);
                $stmt->execute();
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $jarmu) {
                    $osszStmt = $this->db->prepare(
                        "SELECT MAX(datum) utolso_datum,
                                SUM(CASE WHEN datum >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN vezetes_perc ELSE 0 END) vezetes_perc_7nap,
                                SUM(CASE WHEN datum >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) napok_30nap
                         FROM tachograf_vu_napi_aktivitas WHERE admin = :ceg_id AND jarmu_tipus = :tabla AND jarmu_id = :jarmu_id"
                    );
                    $osszStmt->bindValue(':ceg_id', $ceg_id);
                    $osszStmt->bindValue(':tabla', $tabla);
                    $osszStmt->bindValue(':jarmu_id', $jarmu['id']);
                    $osszStmt->execute();
                    $osszesito = $osszStmt->fetch(PDO::FETCH_ASSOC);
                    $sorok[] = [
                        'jarmu_tipus' => $tabla,
                        'jarmu_id' => (int) $jarmu['id'],
                        'rendszam' => $jarmu['rendszam'],
                        'utolsoDatum' => $osszesito['utolso_datum'] ?? null,
                        'vezetesPerc7Nap' => (int) ($osszesito['vezetes_perc_7nap'] ?? 0),
                        'vanAdat' => $osszesito['utolso_datum'] !== null,
                    ];
                }
            }
            return ['success' => true, 'sorok' => $sorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Jármű-egység letöltés megfelelőségi állapota — EU 165/2014 kb. 90 napos
    // ökölszabálya alapján (nem 28, mint a sofőrkártyánál), ld. a modul
    // publikált UX-koncepciójának mellékletét.
    public function getVuMegfelelosegiLista($ceg_id) {
        try {
            $sorok = [];
            foreach (['kamion', 'furgon'] as $tabla) {
                $stmt = $this->db->prepare("SELECT id, rendszam FROM `$tabla` WHERE admin = :ceg_id AND torolt <> 'I' ORDER BY rendszam ASC");
                $stmt->bindValue(':ceg_id', $ceg_id);
                $stmt->execute();
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $jarmu) {
                    $uStmt = $this->db->prepare(
                        "SELECT MAX(datum) utolso_datum, DATEDIFF(CURDATE(), MAX(datum)) napok_ota
                         FROM tachograf_vu_napi_aktivitas WHERE admin = :ceg_id AND jarmu_tipus = :tabla AND jarmu_id = :jarmu_id"
                    );
                    $uStmt->bindValue(':ceg_id', $ceg_id);
                    $uStmt->bindValue(':tabla', $tabla);
                    $uStmt->bindValue(':jarmu_id', $jarmu['id']);
                    $uStmt->execute();
                    $adat = $uStmt->fetch(PDO::FETCH_ASSOC);
                    if ($adat['utolso_datum'] === null) {
                        $statusz = 'nincs_adat';
                        $napokOta = null;
                    } elseif ($adat['napok_ota'] <= self::MEGFELELOSEG_RENDBEN_NAP) {
                        $statusz = 'rendben';
                        $napokOta = (int) $adat['napok_ota'];
                    } elseif ($adat['napok_ota'] <= self::MEGFELELOSEG_ESEDEKES_NAP) {
                        $statusz = 'esedekes';
                        $napokOta = (int) $adat['napok_ota'];
                    } else {
                        $statusz = 'lejart';
                        $napokOta = (int) $adat['napok_ota'];
                    }
                    $sorok[] = [
                        'jarmu_tipus' => $tabla,
                        'jarmu_id' => (int) $jarmu['id'],
                        'rendszam' => $jarmu['rendszam'],
                        'utolsoDatum' => $adat['utolso_datum'],
                        'napokOta' => $napokOta,
                        'statusz' => $statusz,
                    ];
                }
            }
            return ['success' => true, 'sorok' => $sorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getVuImportNaplo($ceg_id) {
        try {
            $stmt = $this->db->prepare("SELECT * FROM tachograf_vu_import_naplo WHERE admin = :ceg_id ORDER BY letrehozva DESC");
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();
            return ['success' => true, 'sorok' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getVuNapiAktivitas($jarmuTipus, $jarmuId, $datumTol, $datumIg, $ceg_id) {
        try {
            $where = ["admin = :ceg_id"];
            $params = [':ceg_id' => $ceg_id];
            if (!empty($jarmuTipus) && !empty($jarmuId)) {
                $where[] = "jarmu_tipus = :jarmu_tipus AND jarmu_id = :jarmu_id";
                $params[':jarmu_tipus'] = $jarmuTipus;
                $params[':jarmu_id'] = $jarmuId;
            }
            if (!empty($datumTol)) {
                $where[] = "datum >= :datumTol";
                $params[':datumTol'] = $datumTol;
            }
            if (!empty($datumIg)) {
                $where[] = "datum <= :datumIg";
                $params[':datumIg'] = $datumIg;
            }
            $stmt = $this->db->prepare(
                "SELECT * FROM tachograf_vu_napi_aktivitas WHERE " . implode(' AND ', $where) . " ORDER BY datum DESC"
            );
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();
            $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($sorok as &$sor) {
                $sor['aktivitas_json'] = json_decode($sor['aktivitas_json'], true);
                $sor['kartya_referenciak_json'] = json_decode($sor['kartya_referenciak_json'], true);
            }
            return ['success' => true, 'sorok' => $sorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$tachografVuInterface = new TachografVuInterface();
