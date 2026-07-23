<?php

require_once __DIR__ . '/../DddParser.php';

// Tachográf sofőrkártya-letöltés (.ddd) import — ugyanaz a "digest, admin
// dönt" kétlépéses minta, mint a NAV/Bank/MOL importoknál:
// `elemezDdd()` semmit nem ír az adatbázisba, csak dekódolja a fájlt és
// javaslatot ad; a tényleges INSERT csak `alkalmazImport()`-on, admin
// jóváhagyása után történik.
class TachografInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // `$fajlnev`/`$feltolto*` — a nyers .ddd fájl a "Fájlok" központi
    // fájlkezelőbe is bekerül (ld. FilesInterface::fileUpload(),
    // `tabla='tachograf_import'`), FÜGGETLENÜL attól, hogy az admin később
    // ténylegesen alkalmazza-e az importot.
    public function elemezDdd($base64, $ceg_id, $fajlnev = null, $feltoltoTipus = null, $feltoltoId = null, $feltoltoNev = null) {
        try {
            $binary = base64_decode($base64, true);
            if ($binary === false || strlen($binary) < 100) {
                return ['success' => false, 'message' => 'A fájl nem olvasható be érvényes .ddd fájlként.'];
            }

            $parser = new DddParser($binary);
            $eredmeny = $parser->parse();

            if (!$eredmeny['identification']) {
                return ['success' => false, 'message' => 'A fájlból nem sikerült kiolvasni a kártyabirtokos-azonosítást — ellenőrizd, hogy valódi sofőrkártya-letöltés (.ddd) fájlt töltöttél-e fel.'];
            }

            $kartyaszam = $eredmeny['identification']['cardNumber'];
            // `javaslatForras` — a UX-újratervezés (2026-07-24) bizalmi-jelzés
            // igényére: a frontend a kártyaszám-alapú egyezést biztosnak, a
            // név-alapút bizonytalannak jelzi, nem ugyanúgy néznek ki.
            $javasoltSoforId = $this->keresSoforKartyaAlapjan($ceg_id, $kartyaszam);
            $javaslatForras = $javasoltSoforId ? 'kartyaszam' : null;
            if (!$javasoltSoforId) {
                $javasoltSoforId = $this->keresSoforNevAlapjan(
                    $ceg_id,
                    $eredmeny['identification']['holderSurname'],
                    $eredmeny['identification']['holderFirstNames']
                );
                $javaslatForras = $javasoltSoforId ? 'nev' : null;
            }

            $rendszamok = array_merge(
                $this->getRendszamok('kamion', $ceg_id),
                $this->getRendszamok('furgon', $ceg_id)
            );

            $mar_importalt_datumok = $this->marImportaltDatumok($ceg_id, $kartyaszam);

            $napok = [];
            foreach ($eredmeny['napiAktivitas'] as $nap) {
                $jarmuvek = $this->parositJarmuvekNapra($nap['datum'], $eredmeny['jarmuvek'], $rendszamok);
                $napok[] = [
                    'datum' => $nap['datum'],
                    'tavolsagKm' => $nap['tavolsagKm'],
                    'vezetesPerc' => $nap['vezetesPerc'],
                    'munkaPerc' => $nap['munkaPerc'],
                    'rendelkezesreAllasPerc' => $nap['rendelkezesreAllasPerc'],
                    'pihenoPerc' => $nap['pihenoPerc'],
                    'aktivitasValtasok' => $nap['aktivitasValtasok'],
                    'jarmuvek' => $jarmuvek,
                    'marImportalva' => in_array($nap['datum'], $mar_importalt_datumok, true),
                ];
            }

            $this->mentsNyersFajlt($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev);

            return [
                'success' => true,
                'kartyabirtokos' => $eredmeny['identification'],
                'javasoltSoforId' => $javasoltSoforId,
                'javaslatForras' => $javaslatForras,
                'napok' => $napok,
                'esemenyek' => $eredmeny['esemenyek'],
                'hibak' => $eredmeny['hibak'],
                'figyelmeztetesek' => $eredmeny['warnings'],
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Csendben elnyeli a hibát — egy fájl-mentési gond sosem akaszthatja
    // meg a már sikeresen lefutott .ddd-elemzést.
    private function mentsNyersFajlt($ceg_id, $base64, $fajlnev, $feltoltoTipus, $feltoltoId, $feltoltoNev) {
        global $filesInterface;
        $nev = $fajlnev ?: 'tachograf_import.ddd';
        $raw = base64_decode((string) $base64, true);
        $filesInterface->fileUpload($ceg_id, 'tachograf_import', $ceg_id, $base64, $nev, strlen((string) $raw), null, $feltoltoTipus, $feltoltoId, $feltoltoNev);
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

    // Ugyanaz az alfanumerikus normalizálás, mint a MOL-import rendszám-
    // egyeztetésnél (ld. molTankolasInterface.php) — a kötőjel/szóköz
    // írásmódja a tachográf-adat és a flotta saját rendszám-mezője közt
    // gyakran eltér.
    private function normalizalRendszam($rendszam) {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $rendszam));
    }

    private function parositJarmuvekNapra($datum, $jarmuvek, $rendszamok) {
        $talalt = [];
        $latott = [];
        foreach ($jarmuvek as $j) {
            if ($j['firstUse'] === null) continue;
            if (substr($j['firstUse'], 0, 10) !== $datum && substr((string) $j['lastUse'], 0, 10) !== $datum) {
                continue;
            }
            $norm = $this->normalizalRendszam($j['rendszam']);
            if (isset($latott[$norm])) continue;
            $latott[$norm] = true;

            $egyezes = null;
            foreach ($rendszamok as $r) {
                if ($this->normalizalRendszam($r['rendszam']) === $norm) {
                    $egyezes = $r;
                    break;
                }
            }
            $talalt[] = [
                'rendszam' => $j['rendszam'],
                'odometerBegin' => $j['odometerBegin'],
                'odometerEnd' => $j['odometerEnd'],
                'jarmu_tipus' => $egyezes['jarmu_tipus'] ?? null,
                'jarmu_id' => $egyezes['jarmu_id'] ?? null,
            ];
        }
        return $talalt;
    }

    private function keresSoforKartyaAlapjan($ceg_id, $kartyaszam) {
        $stmt = $this->db->prepare("SELECT id FROM user WHERE admin = :ceg_id AND tachograf_kartyaszam = :kartyaszam AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->bindValue(':kartyaszam', $kartyaszam);
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? (int) $row['id'] : null;
    }

    // Csak javaslat — a dekódolt vezetéknév/keresztnév és a `user.name` közti
    // laza (nagybetűs, ékezet-érzéketlen tartalmazás) egyezés alapján; az
    // admin a digest review-n bármikor felülbírálhatja egy select-ben.
    private function keresSoforNevAlapjan($ceg_id, $vezeteknev, $keresztnev) {
        $stmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :ceg_id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $keresett = $this->normalizalNev($vezeteknev . ' ' . $keresztnev);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $jelolt = $this->normalizalNev($row['name']);
            if ($jelolt !== '' && (strpos($keresett, $jelolt) !== false || strpos($jelolt, $keresett) !== false)) {
                return (int) $row['id'];
            }
        }
        return null;
    }

    private function normalizalNev($nev) {
        $nev = mb_strtoupper(trim((string) $nev));
        $atirasok = ['Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ö'=>'O','Ő'=>'O','Ú'=>'U','Ü'=>'U','Ű'=>'U'];
        return strtr($nev, $atirasok);
    }

    private function marImportaltDatumok($ceg_id, $kartyaszam) {
        $stmt = $this->db->prepare("SELECT datum FROM tachograf_napi_aktivitas WHERE admin = :ceg_id AND kartyaszam = :kartyaszam");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->bindValue(':kartyaszam', $kartyaszam);
        $stmt->execute();
        return array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'datum');
    }

    // `$napok` — a frontend digest review-n admin által kiválasztott
    // (checkbox bejelölt, még nem importált) napok, a `elemezDdd()` válaszával
    // megegyező alakban. `$sofor_id`/`$kartyaszam` a review-n választott
    // (vagy javasolt) sofőr, ill. a fájlból dekódolt kártyaszám. `$esemenyek`
    // — a `elemezDdd()` `esemenyek`+`hibak` tömbjeinek összefésült listája
    // (típus-címkével megkülönböztetve), `INSERT IGNORE`-jellegű védekező
    // beszúrással (a UNIQUE KEY ütközést elnyelve) — ennél a mintafájlnál
    // mindig üres, de a struktúra kész egy jövőbeli, tényleges eseményt
    // tartalmazó kártyához.
    public function alkalmazImport($napok, $sofor_id, $kartyaszam, $forrasFajlnev, $ceg_id, $esemenyek = [], $feltoltoTipus = null, $feltoltoId = null, $feltoltoNev = null) {
        try {
            if (empty($sofor_id)) {
                return ['success' => false, 'message' => 'Nincs kiválasztva sofőr.'];
            }
            $soforStmt = $this->db->prepare("SELECT id FROM user WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $soforStmt->bindValue(':id', $sofor_id);
            $soforStmt->bindValue(':ceg_id', $ceg_id);
            $soforStmt->execute();
            if (!$soforStmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A kiválasztott sofőr nem található.'];
            }

            $importalt = 0;
            $kihagyva = 0;
            foreach ($napok as $nap) {
                try {
                    $ins = $this->db->prepare(
                        "INSERT INTO tachograf_napi_aktivitas
                            (admin, sofor_id, kartyaszam, datum, tavolsag_km, vezetes_perc, munka_perc, rendelkezesre_allas_perc, piheno_perc, aktivitas_json, jarmuvek_json, forras_fajlnev)
                         VALUES (:admin, :sofor_id, :kartyaszam, :datum, :tavolsag_km, :vezetes_perc, :munka_perc, :rendelkezesre_allas_perc, :piheno_perc, :aktivitas_json, :jarmuvek_json, :forras_fajlnev)"
                    );
                    $ins->bindValue(':admin', $ceg_id);
                    $ins->bindValue(':sofor_id', $sofor_id);
                    $ins->bindValue(':kartyaszam', $kartyaszam);
                    $ins->bindValue(':datum', $nap['datum']);
                    $ins->bindValue(':tavolsag_km', $nap['tavolsagKm']);
                    $ins->bindValue(':vezetes_perc', $nap['vezetesPerc']);
                    $ins->bindValue(':munka_perc', $nap['munkaPerc']);
                    $ins->bindValue(':rendelkezesre_allas_perc', $nap['rendelkezesreAllasPerc']);
                    $ins->bindValue(':piheno_perc', $nap['pihenoPerc']);
                    $ins->bindValue(':aktivitas_json', json_encode($nap['aktivitasValtasok']));
                    $ins->bindValue(':jarmuvek_json', json_encode($nap['jarmuvek']));
                    $ins->bindValue(':forras_fajlnev', $forrasFajlnev);
                    $ins->execute();
                    $importalt++;
                } catch (Exception $e) {
                    // UNIQUE KEY (admin, kartyaszam, datum) ütközés — a nap már
                    // korábban importálva lett, ugyanaz a de-dup elv, mint a
                    // Bank/MOL importnál.
                    $kihagyva++;
                }
            }

            $upd = $this->db->prepare("UPDATE user SET tachograf_kartyaszam = :kartyaszam WHERE id = :id AND admin = :ceg_id AND tachograf_kartyaszam IS NULL");
            $upd->bindValue(':kartyaszam', $kartyaszam);
            $upd->bindValue(':id', $sofor_id);
            $upd->bindValue(':ceg_id', $ceg_id);
            $upd->execute();

            $esemenyImportalt = 0;
            foreach ($esemenyek as $esemeny) {
                try {
                    $eIns = $this->db->prepare(
                        "INSERT IGNORE INTO tachograf_esemenyek (admin, sofor_id, kartyaszam, tipus, kezdet, veg, rendszam)
                         VALUES (:admin, :sofor_id, :kartyaszam, :tipus, :kezdet, :veg, :rendszam)"
                    );
                    $eIns->bindValue(':admin', $ceg_id);
                    $eIns->bindValue(':sofor_id', $sofor_id);
                    $eIns->bindValue(':kartyaszam', $kartyaszam);
                    $eIns->bindValue(':tipus', $esemeny['tipus']);
                    $eIns->bindValue(':kezdet', $esemeny['kezdet']);
                    $eIns->bindValue(':veg', $esemeny['veg'] ?? null);
                    $eIns->bindValue(':rendszam', empty($esemeny['rendszam']) ? null : $esemeny['rendszam']);
                    $eIns->execute();
                    if ($eIns->rowCount() > 0) $esemenyImportalt++;
                } catch (Exception $e) {
                    // védekező — egy egyedi esemény-sor hibája ne buktassa el a teljes importot
                }
            }

            // Import-audit napló — csendben elnyeljük a hibát, ugyanaz az elv,
            // mint `mentsNyersFajlt()`-nél: egy naplózási gond sosem buktathatja
            // el a már ténylegesen lefutott importot.
            try {
                $naploIns = $this->db->prepare(
                    "INSERT INTO tachograf_import_naplo
                        (admin, sofor_id, kartyaszam, fajlnev, feltolto_tipus, feltolto_id, feltolto_nev, uj_nap, kihagyott_nap, esemeny_szam)
                     VALUES (:admin, :sofor_id, :kartyaszam, :fajlnev, :feltolto_tipus, :feltolto_id, :feltolto_nev, :uj_nap, :kihagyott_nap, :esemeny_szam)"
                );
                $naploIns->bindValue(':admin', $ceg_id);
                $naploIns->bindValue(':sofor_id', $sofor_id);
                $naploIns->bindValue(':kartyaszam', $kartyaszam);
                $naploIns->bindValue(':fajlnev', $forrasFajlnev);
                $naploIns->bindValue(':feltolto_tipus', $feltoltoTipus);
                $naploIns->bindValue(':feltolto_id', $feltoltoId);
                $naploIns->bindValue(':feltolto_nev', $feltoltoNev);
                $naploIns->bindValue(':uj_nap', $importalt);
                $naploIns->bindValue(':kihagyott_nap', $kihagyva);
                $naploIns->bindValue(':esemeny_szam', $esemenyImportalt);
                $naploIns->execute();
            } catch (Exception $e) {
                error_log('Tachográf import-napló mentése sikertelen: ' . $e->getMessage());
            }

            return ['success' => true, 'importalt' => $importalt, 'kihagyva' => $kihagyva, 'esemenyImportalt' => $esemenyImportalt];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // UX-újratervezés (2026-07-24) — sofőrönkénti tachográf-összesítő, kiemelve
    // az ApiHandler::getSoforScorecard()-ből, hogy a Tachográf modul "Sofőrök"
    // füle és a Sofőr-riport ugyanazt a lekérdezést használja egyszer, nem
    // kétszer duplikálva ugyanazt az SQL-t.
    public function getSoforOsszesito($ceg_id) {
        $tachoStmt = $this->db->prepare(
            "SELECT sofor_id,
                    MAX(datum) utolso_datum,
                    SUM(CASE WHEN datum >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN vezetes_perc ELSE 0 END) vezetes_perc_7nap,
                    SUM(CASE WHEN datum >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN tavolsag_km ELSE 0 END) km_30nap,
                    SUM(CASE WHEN vezetes_perc > 540 THEN 1 ELSE 0 END) tul_ora_napok
             FROM tachograf_napi_aktivitas WHERE admin = :admin GROUP BY sofor_id"
        );
        $tachoStmt->bindValue(':admin', $ceg_id);
        $tachoStmt->execute();
        $eredmeny = [];
        foreach ($tachoStmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
            $eredmeny[$sor['sofor_id']] = [
                'utolsoDatum' => $sor['utolso_datum'],
                'vezetesPerc7Nap' => (int) $sor['vezetes_perc_7nap'],
                'km30Nap' => (int) $sor['km_30nap'],
                'tulOraNapok' => (int) $sor['tul_ora_napok'],
            ];
        }
        return $eredmeny;
    }

    // "Sofőrök" fül listája — minden aktív sofőr, a fenti összesítővel
    // kiegészítve; `vanAdat` különbözteti meg "sosem töltött fel kártyát"-ot
    // "0 km-t vezetett az elmúlt 30 napban"-tól.
    public function getSoforAttekintes($ceg_id) {
        try {
            $soforStmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :admin AND torolt <> 'I' ORDER BY name ASC");
            $soforStmt->bindValue(':admin', $ceg_id);
            $soforStmt->execute();
            $soforok = $soforStmt->fetchAll(PDO::FETCH_ASSOC);
            $osszesito = $this->getSoforOsszesito($ceg_id);

            $sorok = [];
            foreach ($soforok as $sofor) {
                $adat = $osszesito[$sofor['id']] ?? null;
                $sorok[] = [
                    'sofor_id' => (int) $sofor['id'],
                    'nev' => $sofor['name'],
                    'utolsoDatum' => $adat['utolsoDatum'] ?? null,
                    'vezetesPerc7Nap' => $adat['vezetesPerc7Nap'] ?? 0,
                    'km30Nap' => $adat['km30Nap'] ?? 0,
                    'tulOraNapok' => $adat['tulOraNapok'] ?? 0,
                    'vanAdat' => $adat !== null,
                ];
            }
            return ['success' => true, 'sorok' => $sorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Kártya-letöltés megfelelőségi állapot — EU 561/2006: a sofőrkártyát
    // rendszeresen le kell tölteni, mert a kártya körkörös tárolója felülírja
    // a régi adatot. A napok-száma delta SQL-ben számolt (DATEDIFF), nem PHP
    // strtotime()-mal. Küszöbök: <=21 nap rendben, 22-28 nap esedékes, 28 nap
    // felett lejárt; ha a sofőrnek sosem volt még importált napja, "nincs_adat"
    // (nem automatikusan "lejárt" — nem tudjuk, hogy ez valódi elmaradás-e).
    public function getMegfelelosegiLista($ceg_id) {
        try {
            $soforStmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :admin AND torolt <> 'I' ORDER BY name ASC");
            $soforStmt->bindValue(':admin', $ceg_id);
            $soforStmt->execute();
            $soforok = $soforStmt->fetchAll(PDO::FETCH_ASSOC);

            $utolsoStmt = $this->db->prepare(
                "SELECT sofor_id, MAX(datum) utolso_datum, DATEDIFF(CURDATE(), MAX(datum)) napok_ota
                 FROM tachograf_napi_aktivitas WHERE admin = :admin GROUP BY sofor_id"
            );
            $utolsoStmt->bindValue(':admin', $ceg_id);
            $utolsoStmt->execute();
            $utolsoSoforSzerint = [];
            foreach ($utolsoStmt->fetchAll(PDO::FETCH_ASSOC) as $sor) {
                $utolsoSoforSzerint[$sor['sofor_id']] = ['utolsoDatum' => $sor['utolso_datum'], 'napokOta' => (int) $sor['napok_ota']];
            }

            $sorok = [];
            foreach ($soforok as $sofor) {
                $adat = $utolsoSoforSzerint[$sofor['id']] ?? null;
                if ($adat === null) {
                    $statusz = 'nincs_adat';
                    $napokOta = null;
                } elseif ($adat['napokOta'] <= 21) {
                    $statusz = 'rendben';
                    $napokOta = $adat['napokOta'];
                } elseif ($adat['napokOta'] <= 28) {
                    $statusz = 'esedekes';
                    $napokOta = $adat['napokOta'];
                } else {
                    $statusz = 'lejart';
                    $napokOta = $adat['napokOta'];
                }
                $sorok[] = [
                    'sofor_id' => (int) $sofor['id'],
                    'nev' => $sofor['name'],
                    'utolsoDatum' => $adat['utolsoDatum'] ?? null,
                    'napokOta' => $napokOta,
                    'statusz' => $statusz,
                ];
            }

            return ['success' => true, 'sorok' => $sorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // "Import előzmények" fül — minden korábbi alkalmazTachografImport()
    // hívás (ld. a fenti napló-insert), legfrissebb elöl.
    public function getImportNaplo($ceg_id) {
        try {
            $stmt = $this->db->prepare("SELECT * FROM tachograf_import_naplo WHERE admin = :admin ORDER BY letrehozva DESC");
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->execute();
            $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $nevek = $this->soforNevekTomb($ceg_id);
            foreach ($sorok as &$sor) {
                $sor['sofor_nev'] = $nevek[$sor['sofor_id']] ?? null;
            }
            return ['success' => true, 'sorok' => $sorok];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Egy már importált napi rekord sofőr-átpárosítása (adminisztrátor
    // hibajavítás) — mindkét oldalt (a rekordot ÉS az új sofőrt is) a hívó
    // ceg_id-jéhez ellenőrzi, nem bízik a kliens-oldali szűrésben.
    public function atparositNap($id, $ujSoforId, $ceg_id) {
        try {
            $sorStmt = $this->db->prepare("SELECT id FROM tachograf_napi_aktivitas WHERE id = :id AND admin = :ceg_id");
            $sorStmt->bindValue(':id', $id);
            $sorStmt->bindValue(':ceg_id', $ceg_id);
            $sorStmt->execute();
            if (!$sorStmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A napló-bejegyzés nem található.'];
            }
            $soforStmt = $this->db->prepare("SELECT id FROM user WHERE id = :id AND admin = :ceg_id AND torolt <> 'I'");
            $soforStmt->bindValue(':id', $ujSoforId);
            $soforStmt->bindValue(':ceg_id', $ceg_id);
            $soforStmt->execute();
            if (!$soforStmt->fetch(PDO::FETCH_ASSOC)) {
                return ['success' => false, 'message' => 'A kiválasztott sofőr nem található.'];
            }
            $upd = $this->db->prepare("UPDATE tachograf_napi_aktivitas SET sofor_id = :sofor_id WHERE id = :id AND admin = :ceg_id");
            $upd->bindValue(':sofor_id', $ujSoforId);
            $upd->bindValue(':id', $id);
            $upd->bindValue(':ceg_id', $ceg_id);
            $upd->execute();
            return ['success' => true];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A projekt egyedi SQL lintere nem engedélyezi a táblák SQL-szintű
    // összekapcsolását (ld. koltsegInterface hasonló komment) — a sofőr-nevet
    // ezért két külön lekérdezéssel, PHP-ban fésüljük hozzá a
    // tachográf-sorokhoz.
    private function soforNevekTomb($ceg_id) {
        $stmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :ceg_id");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['name'];
        }
        return $map;
    }

    public function getNapiAktivitas($sofor_id, $datumTol, $datumIg, $ceg_id) {
        $where = ["admin = :ceg_id"];
        $params = [':ceg_id' => $ceg_id];
        if (!empty($sofor_id)) {
            $where[] = "sofor_id = :sofor_id";
            $params[':sofor_id'] = $sofor_id;
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
            "SELECT * FROM tachograf_napi_aktivitas WHERE " . implode(' AND ', $where) . " ORDER BY datum DESC"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $nevek = $this->soforNevekTomb($ceg_id);
        foreach ($sorok as &$sor) {
            $sor['aktivitas_json'] = json_decode($sor['aktivitas_json'], true);
            $sor['jarmuvek_json'] = json_decode($sor['jarmuvek_json'], true);
            $sor['sofor_nev'] = $nevek[$sor['sofor_id']] ?? null;
        }
        return ['success' => true, 'sorok' => $sorok];
    }

    public function getEsemenyek($sofor_id, $ceg_id) {
        $where = ["admin = :ceg_id"];
        $params = [':ceg_id' => $ceg_id];
        if (!empty($sofor_id)) {
            $where[] = "sofor_id = :sofor_id";
            $params[':sofor_id'] = $sofor_id;
        }
        $stmt = $this->db->prepare(
            "SELECT * FROM tachograf_esemenyek WHERE " . implode(' AND ', $where) . " ORDER BY kezdet DESC"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();
        $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $nevek = $this->soforNevekTomb($ceg_id);
        foreach ($sorok as &$sor) {
            $sor['sofor_nev'] = $nevek[$sor['sofor_id']] ?? null;
        }
        return ['success' => true, 'sorok' => $sorok];
    }
}

$tachografInterface = new TachografInterface();
