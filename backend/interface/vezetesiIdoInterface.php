<?php

// Vezetési idő/pihenőidő nyilvántartás — a sofőr NAPI ÖSSZESÍTŐT rögzít
// (ma hány órát vezetett / pihent, nem pontos időszakokat) — szándékosan
// egyszerű, gyors rögzítés, nem pontos időszak-nyilvántartás. Emiatt a
// heti pihenő-ellenőrzés egy TUDATOS KÖZELÍTÉS: mivel
// nincs pontos időszak-adat, egy héten belüli "van-e nap, ahol a pihenés
// eléri a 24/45 órát" kérdésre egyszerűsödik a valódi, folyamatos
// pihenő-időszak ellenőrzése helyett. Ez az interfész EU 561/2006
// TÁJÉKOZTATÓ jellegű becslést ad, nem hivatalos tachográf-nyilvántartás
// pótlása — ezt a frontend is jelzi a felhasználónak.
class VezetesiIdoInterface {
    protected $db;

    const NAPI_VEZETES_MAX = 10;      // ritkított (hosszabbított) napi limit
    const NAPI_VEZETES_NORMAL = 9;    // normál napi limit, felette "hosszabbított nap"
    const NAPI_PIHENO_MIN = 9;        // ritkított napi pihenő minimum
    const NAPI_PIHENO_NORMAL = 11;    // normál napi pihenő, alatta "ritkított pihenő"
    const HETI_VEZETES_MAX = 56;
    const KETHETI_VEZETES_MAX = 90;
    const HETI_PIHENO_NORMAL = 45;
    const HETI_PIHENO_RITKITOTT = 24;
    const MAX_HOSSZABBITOTT_NAP_HETENTE = 2;
    const MAX_RITKITOTT_PIHENO_HETENTE = 3;
    const POTPIHENO_HATARIDO_HET = 3;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    public function newVezetesiNaplo($data) {
        try {
            if (!is_numeric($data['vezetes_ora']) || !is_numeric($data['pihenes_ora'])) {
                return ['success' => false, 'message' => 'A vezetési és pihenő órák megadása kötelező, számként.'];
            }
            // `id = LAST_INSERT_ID(id)` a DUPLICATE KEY ágon is: enélkül
            // `lastInsertId()` felülírás (nem friss beszúrás) esetén 0-t
            // adna vissza, és az auditnaplózás (ami a rowid-t igényli)
            // némán kimaradna.
            $query = "INSERT INTO vezetesi_naplo (admin, sofor_id, datum, vezetes_ora, pihenes_ora, megjegyzes)
                      VALUES (:admin, :sofor_id, :datum, :vezetes_ora, :pihenes_ora, :megjegyzes)
                      ON DUPLICATE KEY UPDATE vezetes_ora = VALUES(vezetes_ora), pihenes_ora = VALUES(pihenes_ora),
                      megjegyzes = VALUES(megjegyzes), torolt = 'N', id = LAST_INSERT_ID(id)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $data['ceg_id']);
            $stmt->bindValue(':sofor_id', $data['sofor_id'], PDO::PARAM_INT);
            $stmt->bindValue(':datum', $data['datum']);
            $stmt->bindValue(':vezetes_ora', $data['vezetes_ora']);
            $stmt->bindValue(':pihenes_ora', $data['pihenes_ora']);
            $stmt->bindValue(':megjegyzes', $data['megjegyzes'] ?: null);
            $stmt->execute();

            return ['success' => true, 'message' => 'Napi bejegyzés rögzítve.', 'id' => $this->db->lastInsertId()];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteVezetesiNaplo($id, $ceg_id) {
        try {
            $query = "UPDATE vezetesi_naplo SET torolt = 'I' WHERE id = :id AND admin = :ceg_id";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->bindValue(':ceg_id', $ceg_id);
            $stmt->execute();

            return ['success' => true, 'message' => 'Bejegyzés törölve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getSajatVezetesiNaplo($sofor_id, $naptol = null, $nameddig = null) {
        try {
            $query = "SELECT * FROM vezetesi_naplo WHERE sofor_id = :sofor_id AND torolt <> 'I'";
            $params = [':sofor_id' => $sofor_id];
            if (!empty($naptol)) {
                $query .= " AND datum >= :naptol";
                $params[':naptol'] = $naptol;
            }
            if (!empty($nameddig)) {
                $query .= " AND datum <= :nameddig";
                $params[':nameddig'] = $nameddig;
            }
            $query .= " ORDER BY datum DESC";
            $stmt = $this->db->prepare($query);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->execute();

            return ['success' => true, 'naplo' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Sofőr-oldali önkiszolgáló lekérdezés — SZÁNDÉKOSAN nincs
    // MODULE_PERMISSION_MAP-ban/resolveKerelmezo()-val védve (az admin-only
    // ellenőrzést dobna sofőr-munkamenetre is), csak a saját sofor_id
    // alapján szűr, ugyanúgy, mint getSajatVezetesiNaplo() — a sofőr csak a
    // SAJÁT heti állapotát kérdezheti le ezzel, nem a cég többi sofőrjét.
    public function getSajatVezetesiAllapot($sofor_id, $hetek = 1) {
        try {
            $kezdet = date('Y-m-d', strtotime('-' . ($hetek * 7 + 7) . ' days'));
            $stmt = $this->db->prepare("SELECT * FROM vezetesi_naplo WHERE sofor_id = :sofor_id AND torolt <> 'I' AND datum >= :kezdet ORDER BY datum ASC");
            $stmt->bindValue(':sofor_id', $sofor_id, PDO::PARAM_INT);
            $stmt->bindValue(':kezdet', $kezdet);
            $stmt->execute();
            $napok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ['success' => true, 'hetek' => $this->hetiBontas($napok)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A megfelelőségi motor — sofőrönként heti bontásban számol, PHP
    // oldalon (JOIN-mentes konvenció), a nyers napi sorokból.
    // A `soforok` tömb sofőrönként EGY aggregált sort tartalmaz (nem a nyers
    // napi naplósorokat) — ezért a keresés/lapozás itt PHP oldalon, az
    // aggregálás UTÁN történik (`array_filter`/`array_slice`), nem SQL
    // LIMIT/OFFSET-tel. `$search`/`$page`/`$pageSize` nélkül hívva (a régi
    // viselkedés) a teljes, lapozatlan lista jön vissza.
    public function getVezetesiOsszesito($ceg_id, $sofor_id = null, $hetek = 8, $search = null, $page = null, $pageSize = null) {
        try {
            $kezdet = date('Y-m-d', strtotime('-' . ($hetek * 7 + 7) . ' days'));
            $query = "SELECT * FROM vezetesi_naplo WHERE admin = :ceg_id AND torolt <> 'I' AND datum >= :kezdet";
            $params = [':ceg_id' => $ceg_id, ':kezdet' => $kezdet];
            if (!empty($sofor_id)) {
                $query .= " AND sofor_id = :sofor_id";
                $params[':sofor_id'] = $sofor_id;
            }
            $query .= " ORDER BY sofor_id, datum ASC";
            $stmt = $this->db->prepare($query);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->execute();
            $sorok = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $soforNevek = $this->getSoforNevek($ceg_id);

            $soforonkent = [];
            foreach ($sorok as $sor) {
                $soforonkent[$sor['sofor_id']][] = $sor;
            }

            $eredmeny = [];
            foreach ($soforonkent as $sid => $napok) {
                $eredmeny[] = [
                    'sofor_id' => (int) $sid,
                    'sofor_nev' => $soforNevek[$sid] ?? null,
                    'hetek' => $this->hetiBontas($napok),
                ];
            }

            if (!empty($search)) {
                $searchLower = mb_strtolower($search);
                $eredmeny = array_values(array_filter($eredmeny, function ($sofor) use ($searchLower) {
                    return mb_strpos(mb_strtolower($sofor['sofor_nev'] ?? ''), $searchLower) !== false;
                }));
            }

            $result = ['success' => true, 'soforok' => $eredmeny];
            if ($page !== null) {
                [$normPage, $normPageSize] = PaginationHelper::normalize($page, $pageSize);
                $total = count($eredmeny);

                // A "Túllépés"/"Figyelmeztetés" stat-kártyák a TELJES (kereséssel
                // szűrt, de lapozás előtti) halmazra vonatkoznak — enélkül
                // lapozáskor csak az épp látott oldal sofőrjeit számolnák.
                $sertesSzam = 0;
                $figyelmeztetesSzam = 0;
                foreach ($eredmeny as $sofor) {
                    $statusz = $sofor['hetek'][0]['statusz'] ?? 'rendben';
                    if ($statusz === 'sertes') $sertesSzam++;
                    elseif ($statusz === 'figyelmeztetes') $figyelmeztetesSzam++;
                }

                $result['soforok'] = array_slice($eredmeny, ($normPage - 1) * $normPageSize, $normPageSize);
                $result['total'] = $total;
                $result['page'] = $normPage;
                $result['pageSize'] = $normPageSize;
                $result['sertesSzam'] = $sertesSzam;
                $result['figyelmeztetesSzam'] = $figyelmeztetesSzam;
            }
            return $result;
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function hetMonday($datum) {
        $ts = strtotime($datum);
        $dow = (int) date('N', $ts); // 1=hétfő .. 7=vasárnap
        return date('Y-m-d', $ts - (($dow - 1) * 86400));
    }

    private function hetiBontas($napok) {
        // Napok hét szerinti csoportosítása (hétfő-kezdetű ISO hét).
        $hetenkent = [];
        foreach ($napok as $nap) {
            $het_kezdete = $this->hetMonday($nap['datum']);
            $hetenkent[$het_kezdete][] = $nap;
        }
        ksort($hetenkent);

        $hetek = [];
        $adossag = 0;
        $adossag_het_indexe = null;
        $het_index = 0;

        foreach ($hetenkent as $het_kezdete => $het_napjai) {
            $tullepesek = [];
            $vezetes_ossz = 0;
            $hosszabbitott_napok = 0;
            $ritkitott_pihenok = 0;
            $legjobb_piheno = 0;

            foreach ($het_napjai as $nap) {
                $vezetes = (float) $nap['vezetes_ora'];
                $piheno = (float) $nap['pihenes_ora'];
                $vezetes_ossz += $vezetes;
                $legjobb_piheno = max($legjobb_piheno, $piheno);

                if ($vezetes > self::NAPI_VEZETES_MAX) {
                    $tullepesek[] = 'napi_vezetes_tullepve';
                } elseif ($vezetes > self::NAPI_VEZETES_NORMAL) {
                    $hosszabbitott_napok++;
                }

                if ($piheno < self::NAPI_PIHENO_MIN) {
                    $tullepesek[] = 'napi_piheno_tullepve';
                } elseif ($piheno < self::NAPI_PIHENO_NORMAL) {
                    $ritkitott_pihenok++;
                }
            }

            if ($hosszabbitott_napok > self::MAX_HOSSZABBITOTT_NAP_HETENTE) {
                $tullepesek[] = 'sok_hosszabbitott_nap';
            }
            if ($ritkitott_pihenok > self::MAX_RITKITOTT_PIHENO_HETENTE) {
                $tullepesek[] = 'sok_ritkitott_piheno';
            }
            if ($vezetes_ossz > self::HETI_VEZETES_MAX) {
                $tullepesek[] = 'heti_vezetes_tullepve';
            }

            // Heti pihenő + pótpihenő-adósság — közelítő számítás (ld. fájl
            // tetején lévő komment): napi összesítőkből, nem folyamatos
            // időszakból.
            if ($legjobb_piheno >= self::HETI_PIHENO_NORMAL) {
                $adossag = 0;
                $adossag_het_indexe = null;
            } elseif ($legjobb_piheno >= self::HETI_PIHENO_RITKITOTT) {
                $adossag += self::HETI_PIHENO_NORMAL - $legjobb_piheno;
                if ($adossag_het_indexe === null) {
                    $adossag_het_indexe = $het_index;
                }
            } else {
                $tullepesek[] = 'heti_piheno_hianyzik';
            }

            if ($adossag > 0 && $adossag_het_indexe !== null && ($het_index - $adossag_het_indexe) > self::POTPIHENO_HATARIDO_HET) {
                $tullepesek[] = 'potpiheno_lejart';
            }

            $kemeny = array_intersect($tullepesek, [
                'napi_vezetes_tullepve', 'napi_piheno_tullepve', 'heti_vezetes_tullepve', 'heti_piheno_hianyzik',
            ]);
            $statusz = !empty($kemeny) ? 'sertes' : (!empty($tullepesek) ? 'figyelmeztetes' : 'rendben');

            $hetek[] = [
                'het_kezdete' => $het_kezdete,
                'vezetes_ossz' => round($vezetes_ossz, 2),
                'napok' => $het_napjai,
                'tullepesek' => array_values($tullepesek),
                'statusz' => $statusz,
            ];
            $het_index++;
        }

        // Kétheti (egymást követő 2 naptári hét) vezetési limit — utólag,
        // mert két szomszédos hét összegét igényli.
        for ($i = 1; $i < count($hetek); $i++) {
            $ketheti_ossz = $hetek[$i]['vezetes_ossz'] + $hetek[$i - 1]['vezetes_ossz'];
            if ($ketheti_ossz > self::KETHETI_VEZETES_MAX) {
                $hetek[$i]['tullepesek'][] = 'ketheti_vezetes_tullepve';
                if ($hetek[$i]['statusz'] !== 'sertes') {
                    $hetek[$i]['statusz'] = 'sertes';
                }
            }
        }

        return array_reverse($hetek); // legutóbbi hét legyen elöl
    }

    private function getSoforNevek($ceg_id) {
        $stmt = $this->db->prepare("SELECT id, name FROM user WHERE admin = :ceg_id AND admin <> id AND torolt <> 'I'");
        $stmt->bindValue(':ceg_id', $ceg_id);
        $stmt->execute();
        $map = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $map[$row['id']] = $row['name'];
        }
        return $map;
    }
}

$vezetesiIdoInterface = new VezetesiIdoInterface();
