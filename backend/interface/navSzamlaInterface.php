<?php

require_once __DIR__ . '/../NavSzamlaClient.php';

// A NAV Online Számla technikai felhasználó beállítása (cégenként egy sor,
// `admin` = ceg_id, ld. backend/sql/20.sql komment) + a Pénzforgalom
// bevétel/kiadás importjához szükséges lekérdezés/import logika.
class NavSzamlaInterface {
    protected $db;

    public function __construct() {
        $database = new Database();
        $this->db = $database->connect();
    }

    // A titkos mezők (jelszó, aláíró kulcs, cserekulcs) titkosítva kerülnek
    // az adatbázisba (openssl_encrypt, AES-256-CBC) — ezek valódi NAV-portál
    // hozzáférést adnak, nem az app saját, belső titkai (ld. config.php
    // komment a navEncryptionKey mellett).
    private function titkosit($sima) {
        global $apiConfig;
        $kulcs = hash('sha256', $apiConfig['navEncryptionKey'], true);
        $iv = random_bytes(16);
        $titkositott = openssl_encrypt($sima, 'AES-256-CBC', $kulcs, OPENSSL_RAW_DATA, $iv);
        return base64_encode($iv . $titkositott);
    }

    private function visszafejt($titkositott) {
        global $apiConfig;
        $kulcs = hash('sha256', $apiConfig['navEncryptionKey'], true);
        $nyers = base64_decode($titkositott);
        $iv = substr($nyers, 0, 16);
        $adat = substr($nyers, 16);
        return openssl_decrypt($adat, 'AES-256-CBC', $kulcs, OPENSSL_RAW_DATA, $iv);
    }

    public function saveBeallitasok($ceg_id, $adoszam, $login, $jelszo, $alairoKulcs, $csereKulcs, $kornyezet) {
        try {
            $kornyezet = in_array($kornyezet, ['eles', 'teszt'], true) ? $kornyezet : 'eles';

            // A NAV API `taxNumber` mezője a séma szerint a törzsszám 8
            // számjegyét várja, a szokásos "12345678-2-42" formátum (ÁFA-kód
            // és megyekód nélkül) — ha a felhasználó a teljes, kötőjeles
            // adószámot másolja be, ez levágja a felesleges részt, hogy a
            // NAV ne utasítsa el sematikus INVALID_REQUEST hibával.
            $adoszam = substr(preg_replace('/\D/', '', $adoszam), 0, 8);

            // Az üresen hagyott titkos mezők a MEGLÉVŐ (adatbázisban tárolt)
            // értéket tartják meg — ez teszi lehetővé, hogy a felület csak
            // egy "beállítva" placeholdert mutasson, ne a valós titkot, és a
            // felhasználó csak akkor írja felül, ha ténylegesen új értéket ad meg.
            $meglevo = $this->getBeallitasokNyers($ceg_id);

            $jelszoTitkositva = $jelszo !== '' ? $this->titkosit($jelszo) : ($meglevo['jelszo_titkositva'] ?? null);
            $alairoTitkositva = $alairoKulcs !== '' ? $this->titkosit($alairoKulcs) : ($meglevo['alairo_kulcs_titkositva'] ?? null);
            $csereTitkositva = $csereKulcs !== '' ? $this->titkosit($csereKulcs) : ($meglevo['csere_kulcs_titkositva'] ?? null);

            if (!$jelszoTitkositva || !$alairoTitkositva || !$csereTitkositva) {
                return ['success' => false, 'message' => 'Első alkalommal a jelszó, az aláíró kulcs és a cserekulcs megadása is kötelező.'];
            }

            $query = "INSERT INTO nav_szamla_beallitasok (admin, adoszam, login, jelszo_titkositva, alairo_kulcs_titkositva, csere_kulcs_titkositva, kornyezet)
                      VALUES (:admin, :adoszam, :login, :jelszo, :alairo, :csere, :kornyezet)
                      ON DUPLICATE KEY UPDATE adoszam = VALUES(adoszam), login = VALUES(login),
                        jelszo_titkositva = VALUES(jelszo_titkositva), alairo_kulcs_titkositva = VALUES(alairo_kulcs_titkositva),
                        csere_kulcs_titkositva = VALUES(csere_kulcs_titkositva), kornyezet = VALUES(kornyezet)";
            $stmt = $this->db->prepare($query);
            $stmt->bindValue(':admin', $ceg_id);
            $stmt->bindValue(':adoszam', $adoszam);
            $stmt->bindValue(':login', $login);
            $stmt->bindValue(':jelszo', $jelszoTitkositva);
            $stmt->bindValue(':alairo', $alairoTitkositva);
            $stmt->bindValue(':csere', $csereTitkositva);
            $stmt->bindValue(':kornyezet', $kornyezet);
            $stmt->execute();

            return ['success' => true, 'message' => 'NAV Online Számla beállítások mentve.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function getBeallitasokNyers($ceg_id) {
        $stmt = $this->db->prepare("SELECT * FROM nav_szamla_beallitasok WHERE admin = :admin");
        $stmt->bindValue(':admin', $ceg_id);
        $stmt->execute();
        $sor = $stmt->fetch(PDO::FETCH_ASSOC);
        return $sor ?: null;
    }

    // Sosem ad vissza visszafejtett titkot a frontend felé — csak azt
    // jelzi, van-e már beállítva kapcsolat, és a nem-titkos mezőket.
    public function getBeallitasokStatusz($ceg_id) {
        try {
            $sor = $this->getBeallitasokNyers($ceg_id);
            if (!$sor) {
                return ['success' => true, 'van_beallitva' => false];
            }
            return [
                'success' => true,
                'van_beallitva' => true,
                'adoszam' => $sor['adoszam'],
                'login' => $sor['login'],
                'kornyezet' => $sor['kornyezet'],
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function kliensLetrehozas($ceg_id) {
        $sor = $this->getBeallitasokNyers($ceg_id);
        if (!$sor) {
            throw new Exception('Nincs beállítva NAV Online Számla kapcsolat ehhez a céghez — állítsd be a Beállítások oldalon.');
        }
        return new NavSzamlaClient(
            $sor['adoszam'],
            $sor['login'],
            $this->visszafejt($sor['jelszo_titkositva']),
            $this->visszafejt($sor['alairo_kulcs_titkositva']),
            $sor['kornyezet']
        );
    }

    // Ismert üzemanyag-szolgáltatók neve (a NAV digest `partner_nev`
    // mezőjében szereplő céggel részleges, kis/nagybetűtől független
    // egyezés) — csak JAVASLATOT ad a felületen, amit az importálás előtt
    // a felhasználó felülbírálhat, nem kényszerít semmit. Bővíthető, ha
    // más szolgáltatótól is érkezik számla.
    const ISMERT_UZEMANYAG_SZOLGALTATOK = ['MOL', 'SHELL', 'OMV', 'AVIA', 'AVANTI', 'ORLEN', 'EUROWAG', 'UTA', 'DKV'];

    // Szóhatár-illesztés (nem sima substring) — enélkül pl. egy "Molnár
    // Kft." nevű, üzemanyaghoz semmi köze nem lévő partner is "MOL"-nak
    // tűnne (mert a "MOL" karakterlánc benne van a "MOLNÁR" szóban).
    // Élő teszttel (php -r + reflection) találtam meg ezt a hamis
    // pozitívot, mielőtt bekerülhetett volna.
    private function uzemanyagJavaslat($partnerNev) {
        if (!$partnerNev) {
            return false;
        }
        $nev = mb_strtoupper($partnerNev);
        foreach (self::ISMERT_UZEMANYAG_SZOLGALTATOK as $szolgaltato) {
            if (preg_match('/(?<![A-ZÁÉÍÓÖŐÚÜŰ])' . preg_quote($szolgaltato, '/') . '(?![A-ZÁÉÍÓÖŐÚÜŰ])/u', $nev)) {
                return true;
            }
        }
        return false;
    }

    // A meglévő `egyeb_koltsegek.szamlaszam` alapján megjelöli, mely
    // lekérdezett NAV-tételek vannak már importálva — ezek a felületen
    // eleve kipipálatlanok/letiltottak lesznek, hogy ne kerülhessenek be
    // duplán.
    private function marImportaltSzamlaszamok($ceg_id) {
        $stmt = $this->db->prepare("SELECT szamlaszam FROM egyeb_koltsegek WHERE admin = :admin AND torolt <> 'I' AND szamlaszam IS NOT NULL");
        $stmt->bindValue(':admin', $ceg_id);
        $stmt->execute();
        return array_flip(array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'szamlaszam'));
    }

    public function lekerdezSzamlak($ceg_id, $datumTol, $datumIg) {
        try {
            $kliens = $this->kliensLetrehozas($ceg_id);
            $mar_importalt = $this->marImportaltSzamlaszamok($ceg_id);

            $kimeno = $kliens->queryInvoiceDigest($datumTol, $datumIg, 'OUTBOUND');
            $bejovo = $kliens->queryInvoiceDigest($datumTol, $datumIg, 'INBOUND');

            $tetelek = [];
            foreach (array_merge($kimeno, $bejovo) as $t) {
                $t['mar_importalva'] = isset($mar_importalt[$t['szamlaszam']]);
                // A digest mindig ad forint-egyenértéket (ÁFA tv. szerint
                // kötelező adat), devizánként is — ha ez valamiért mégis
                // hiányzik egy sornál, azt a sort nem tudjuk megbízhatóan
                // összegszerűen importálni.
                $t['importalhato'] = !$t['mar_importalva'] && $t['osszeg_huf'] !== null;
                // Csak javaslat — a felhasználó importálás előtt bármikor
                // felülbírálhatja a felületen (ld. Koltsegek.js NAV modal).
                $t['kategoria_javaslat'] = $this->uzemanyagJavaslat($t['partner_nev'] ?? null) ? 'uzemanyag' : null;
                $tetelek[] = $t;
            }

            return ['success' => true, 'tetelek' => $tetelek];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // A kiválasztott tételekhez ugyanazt a beszúrási logikát futtatja,
    // mint a meglévő KoltsegInterface::newEgyebKoltseg() (ugyanaz a
    // mezőleképezés) — duplikátum (már meglévő szamlaszam) és hiányzó
    // forint-összegű tételeket kihagyva.
    public function importalSzamlak($ceg_id, $tetelek) {
        try {
            $mar_importalt = $this->marImportaltSzamlaszamok($ceg_id);
            $query = "INSERT INTO egyeb_koltsegek (admin, irany, kategoria, kamion_id, potkocsi_id, datum, megnevezes, szamlaszam, osszeg, deviza, eredeti_osszeg, arfolyam, megjegyzes)
                      VALUES (:admin, :irany, :kategoria, NULL, NULL, :datum, :megnevezes, :szamlaszam, :osszeg, :deviza, :eredeti_osszeg, :arfolyam, :megjegyzes)";
            $stmt = $this->db->prepare($query);

            $importalva = 0;
            $kihagyva = 0;
            foreach ($tetelek as $t) {
                $szamlaszam = $t['szamlaszam'] ?? null;
                $osszeg = $t['osszeg_huf'] ?? null;
                if (!$szamlaszam || $osszeg === null || isset($mar_importalt[$szamlaszam])) {
                    $kihagyva++;
                    continue;
                }
                $irany = ($t['irany'] ?? null) === 'bevetel' ? 'bevetel' : 'kiado';
                // A felhasználó a lekérdezés-eredménylistában felülbírálhatja
                // az automatikus javaslatot — amit ténylegesen küld
                // (`kategoria`), az számít, nem az eredeti javaslat.
                $kategoria = ($t['kategoria'] ?? null) === 'uzemanyag' ? 'uzemanyag' : null;

                // Deviza-mezők: a NAV digest saját EREDETI (nem HUF-ra váltott)
                // összegét (`osszeg_eredeti`, ld. NavSzamlaClient::digestSorFeldolgozas)
                // és a NAV-tól kapott HUF-egyenértékből visszaszámolt tényleges
                // árfolyamot mentjük — NEM egy friss MNB-lekérdezést, mert a
                // számla kiállítási dátumára érvényes, NAV-hivatalos árfolyam
                // pontosabb/hitelesebb, mint egy mai napi MNB-érték egy régebbi
                // számlához.
                $penznem = strtoupper($t['penznem'] ?? 'HUF');
                $osszegEredeti = $penznem !== 'HUF' ? ($t['osszeg_eredeti'] ?? null) : null;
                $arfolyam = ($osszegEredeti !== null && $osszegEredeti > 0) ? round($osszeg / $osszegEredeti, 4) : null;

                $stmt->bindValue(':admin', $ceg_id);
                $stmt->bindValue(':irany', $irany);
                $stmt->bindValue(':kategoria', $kategoria);
                $stmt->bindValue(':datum', $t['datum'] ?? date('Y-m-d'));
                $stmt->bindValue(':megnevezes', $t['partner_nev'] ?: 'NAV számla');
                $stmt->bindValue(':szamlaszam', $szamlaszam);
                $stmt->bindValue(':osszeg', $osszeg);
                $stmt->bindValue(':deviza', $penznem !== 'HUF' && $osszegEredeti !== null ? $penznem : 'HUF');
                $stmt->bindValue(':eredeti_osszeg', $osszegEredeti);
                $stmt->bindValue(':arfolyam', $arfolyam);
                $stmt->bindValue(':megjegyzes', 'NAV Online Számlából importálva');
                $stmt->execute();

                $mar_importalt[$szamlaszam] = true;
                $importalva++;
            }

            return ['success' => true, 'message' => "$importalva tétel importálva" . ($kihagyva > 0 ? ", $kihagyva kihagyva (már importált vagy hiányos)." : "."), 'importalva' => $importalva, 'kihagyva' => $kihagyva];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}

$navSzamlaInterface = new NavSzamlaInterface();
