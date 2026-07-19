<?php

require_once __DIR__ . '/CborDecoder.php';

// R52 (fejlesztési audit, 2026-07-19): WebAuthn (FIDO2) regisztráció és
// bejelentkezés-ellenőrzés a sofőr PWA gyors, jelszó nélküli
// újra-belépéséhez. Kizárólag ES256 (ECDSA P-256) hitelesítőt támogat —
// ez minden mai platform-hitelesítő (Touch ID, Windows Hello, Android
// biometrikus, kulcs-kombinált Chrome-profil) alapértelmezett algoritmusa
// — és "none"/tetszőleges attesztációs formátumot elfogad anélkül, hogy a
// gyártói attesztációs láncot ellenőrizné (ez egy alacsonyabb biztonsági
// követelményű "gyors re-auth" funkcióhoz, nem egy vállalati flotta-
// hitelesítő rendszerhez készült — a jelszavas bejelentkezés marad az
// elsődleges, teljes értékű hitelesítési út).
class WebAuthnHelper {
    protected $db;

    const KIHIVAS_ERVENYESSEG_PERC = 5;

    public function __construct($db) {
        $this->db = $db;
    }

    private static function b64url($bin) {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }

    private static function b64urlDecode($str) {
        $pad = strlen($str) % 4;
        if ($pad > 0) {
            $str .= str_repeat('=', 4 - $pad);
        }
        return base64_decode(strtr($str, '-_', '+/'));
    }

    // A kérés `Origin` fejlécéből vett hosztnév (port nélkül) — ez teszi
    // lehetővé, hogy ugyanez a backend a fejlesztői (localhost:3000) ÉS az
    // éles (szikora-transz.hu) frontendhez is helyes `rp.id`-t adjon,
    // deploy-onkénti kézi konfiguráció nélkül.
    public static function rendszerRpId($origin) {
        $host = parse_url($origin, PHP_URL_HOST);
        return $host ?: 'localhost';
    }

    private function ujKihivas($soforId, $tipus) {
        $challenge = random_bytes(32);
        $token = bin2hex(random_bytes(32));
        $stmt = $this->db->prepare(
            'INSERT INTO webauthn_kihivasok (token, sofor_id, tipus, challenge) VALUES (:token, :sofor_id, :tipus, :challenge)'
        );
        $stmt->bindValue(':token', $token);
        $stmt->bindValue(':sofor_id', $soforId);
        $stmt->bindValue(':tipus', $tipus);
        $stmt->bindValue(':challenge', self::b64url($challenge));
        $stmt->execute();
        return [$token, self::b64url($challenge)];
    }

    private function kihivasFeloldasa($token, $tipus) {
        $stmt = $this->db->prepare(
            "SELECT sofor_id, challenge FROM webauthn_kihivasok
             WHERE token = :token AND tipus = :tipus AND letrehozva > DATE_SUB(NOW(), INTERVAL " . self::KIHIVAS_ERVENYESSEG_PERC . " MINUTE)"
        );
        $stmt->bindValue(':token', $token);
        $stmt->bindValue(':tipus', $tipus);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function torolKihivas($token) {
        $stmt = $this->db->prepare('DELETE FROM webauthn_kihivasok WHERE token = :token');
        $stmt->bindValue(':token', $token);
        $stmt->execute();
    }

    private function ellenorizKliensAdat($clientDataJSON, $expectedType, $expectedChallenge, array $allowedOrigins) {
        $clientData = json_decode($clientDataJSON, true);
        if (!$clientData || ($clientData['type'] ?? null) !== $expectedType) {
            return 'Érvénytelen kliens-adat (típus).';
        }
        if (($clientData['challenge'] ?? null) !== $expectedChallenge) {
            return 'A kihívás nem egyezik — próbáld újra.';
        }
        if (!in_array($clientData['origin'] ?? null, $allowedOrigins, true)) {
            return 'Ismeretlen eredet (origin).';
        }
        return null;
    }

    public function vanRegisztralvaSoforhoz($soforId) {
        $stmt = $this->db->prepare('SELECT 1 FROM webauthn_hitelesitok WHERE sofor_id = :sofor_id');
        $stmt->bindValue(':sofor_id', $soforId);
        $stmt->execute();
        return (bool) $stmt->fetchColumn();
    }

    public function torolHitelesito($soforId) {
        $stmt = $this->db->prepare('DELETE FROM webauthn_hitelesitok WHERE sofor_id = :sofor_id');
        $stmt->bindValue(':sofor_id', $soforId);
        $stmt->execute();
    }

    public function generateRegistrationOptions($soforId, $email, $nev, $rpId) {
        [$token, $challengeB64] = $this->ujKihivas($soforId, 'regisztracio');
        return [
            'success' => true,
            'token' => $token,
            'options' => [
                'challenge' => $challengeB64,
                'rp' => ['id' => $rpId, 'name' => 'Szikora Transz'],
                'user' => [
                    'id' => self::b64url((string) $soforId),
                    'name' => $email,
                    'displayName' => $nev,
                ],
                'pubKeyCredParams' => [['type' => 'public-key', 'alg' => -7]],
                'timeout' => 60000,
                'attestation' => 'none',
                'authenticatorSelection' => ['userVerification' => 'preferred', 'residentKey' => 'discouraged'],
            ],
        ];
    }

    // A COSE (CBOR Object Signing and Encryption) EC2-kulcs mezőnevei
    // negatív egész kulcsok (RFC 9053) — 1=kty, 3=alg, -1=crv, -2=x, -3=y.
    private function coseEc2ToPem($coseKey) {
        if (($coseKey[1] ?? null) !== 2 || ($coseKey[3] ?? null) !== -7) {
            throw new Exception('Csak ES256 (EC2/P-256) hitelesítő-kulcs támogatott.');
        }
        $x = $coseKey[-2];
        $y = $coseKey[-3];
        return $this->ecPointToPem($x, $y);
    }

    private function ecPointToPem($x, $y) {
        $point = "\x04" . $x . $y;
        $algId = hex2bin('301306072a8648ce3d020106082a8648ce3d030107');
        $bitString = "\x03" . chr(strlen($point) + 1) . "\x00" . $point;
        $inner = $algId . $bitString;
        $der = "\x30" . $this->derLength(strlen($inner)) . $inner;
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64) . "-----END PUBLIC KEY-----\n";
    }

    private function derLength($len) {
        if ($len < 128) {
            return chr($len);
        }
        $bytes = '';
        while ($len > 0) {
            $bytes = chr($len & 0xFF) . $bytes;
            $len >>= 8;
        }
        return chr(0x80 | strlen($bytes)) . $bytes;
    }

    public function verifyRegistration($token, $clientDataJSONB64, $attestationObjectB64, array $allowedOrigins) {
        $kihivas = $this->kihivasFeloldasa($token, 'regisztracio');
        if (!$kihivas) {
            return ['success' => false, 'message' => 'A regisztrációs kihívás lejárt vagy érvénytelen — próbáld újra.'];
        }

        $clientDataJSON = self::b64urlDecode($clientDataJSONB64);
        $hiba = $this->ellenorizKliensAdat($clientDataJSON, 'webauthn.create', $kihivas['challenge'], $allowedOrigins);
        if ($hiba) {
            return ['success' => false, 'message' => $hiba];
        }

        try {
            $authData = CborDecoder::decode(self::b64urlDecode($attestationObjectB64))['authData'];
            $flags = ord($authData[32]);
            if (!($flags & 0x40)) {
                return ['success' => false, 'message' => 'A hitelesítő nem küldött vissza hitelesítő-adatot.'];
            }
            $offset = 37 + 16; // rpIdHash(32) + flags(1) + signCount(4) + aaguid(16)
            $credIdLen = unpack('n', substr($authData, $offset, 2))[1];
            $offset += 2;
            $credentialId = substr($authData, $offset, $credIdLen);
            $offset += $credIdLen;
            $coseKey = CborDecoder::decode(substr($authData, $offset));
            $publicKeyPem = $this->coseEc2ToPem($coseKey);
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'A hitelesítő válaszának feldolgozása sikertelen: ' . $e->getMessage()];
        }

        $stmt = $this->db->prepare(
            'INSERT INTO webauthn_hitelesitok (sofor_id, credential_id, public_key_pem, sign_count)
             VALUES (:sofor_id, :credential_id, :public_key_pem, 0)
             ON DUPLICATE KEY UPDATE credential_id = :credential_id2, public_key_pem = :public_key_pem2, sign_count = 0'
        );
        $stmt->bindValue(':sofor_id', $kihivas['sofor_id']);
        $stmt->bindValue(':credential_id', self::b64url($credentialId));
        $stmt->bindValue(':public_key_pem', $publicKeyPem);
        $stmt->bindValue(':credential_id2', self::b64url($credentialId));
        $stmt->bindValue(':public_key_pem2', $publicKeyPem);
        $stmt->execute();

        $this->torolKihivas($token);
        return ['success' => true];
    }

    // Az e-mail alapján ELŐBB fel kell oldani, van-e regisztrált hitelesítő
    // — ha nincs, a hívó a jelszavas bejelentkezésre irányítja a felhasználót,
    // ahelyett hogy egy sose-teljesíthető kihívást generálna.
    public function getHitelesito($soforId) {
        $stmt = $this->db->prepare('SELECT credential_id, public_key_pem, sign_count FROM webauthn_hitelesitok WHERE sofor_id = :sofor_id');
        $stmt->bindValue(':sofor_id', $soforId);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function generateAuthenticationOptions($soforId, $credentialIdB64, $rpId) {
        [$token, $challengeB64] = $this->ujKihivas($soforId, 'bejelentkezes');
        return [
            'success' => true,
            'token' => $token,
            'options' => [
                'challenge' => $challengeB64,
                'rpId' => $rpId,
                'allowCredentials' => [['id' => $credentialIdB64, 'type' => 'public-key']],
                'timeout' => 60000,
                'userVerification' => 'preferred',
            ],
        ];
    }

    public function verifyAuthentication($token, $clientDataJSONB64, $authenticatorDataB64, $signatureB64, array $allowedOrigins) {
        $kihivas = $this->kihivasFeloldasa($token, 'bejelentkezes');
        if (!$kihivas) {
            return ['success' => false, 'message' => 'A bejelentkezési kihívás lejárt vagy érvénytelen — próbáld újra.'];
        }

        $clientDataJSON = self::b64urlDecode($clientDataJSONB64);
        $hiba = $this->ellenorizKliensAdat($clientDataJSON, 'webauthn.get', $kihivas['challenge'], $allowedOrigins);
        if ($hiba) {
            return ['success' => false, 'message' => $hiba];
        }

        $hitelesito = $this->getHitelesito($kihivas['sofor_id']);
        if (!$hitelesito) {
            return ['success' => false, 'message' => 'Nincs regisztrált hitelesítő ehhez a fiókhoz.'];
        }

        $authenticatorData = self::b64urlDecode($authenticatorDataB64);
        $signature = self::b64urlDecode($signatureB64);
        $signedData = $authenticatorData . hash('sha256', $clientDataJSON, true);

        $verify = openssl_verify($signedData, $signature, $hitelesito['public_key_pem'], OPENSSL_ALGO_SHA256);
        if ($verify !== 1) {
            return ['success' => false, 'message' => 'Az aláírás ellenőrzése sikertelen.'];
        }

        // A signCount klónozott/másolt hitelesítő elleni védelem — ha egy
        // authenticator sosem növeli (pl. néhány platform-hitelesítő
        // mindig 0-t küld), ezt nem tekintjük hibának, csak nem tudunk
        // belőle klónozás-jelet meríteni. Ha viszont VOLT már nem-nulla
        // számláló, és az új érték nem nagyobb, az gyanús (visszajátszás/
        // klónozott hitelesítő), elutasítjuk.
        $ujSzamlalo = unpack('N', substr($authenticatorData, 33, 4))[1];
        $regiSzamlalo = (int) $hitelesito['sign_count'];
        if ($regiSzamlalo > 0 && $ujSzamlalo > 0 && $ujSzamlalo <= $regiSzamlalo) {
            return ['success' => false, 'message' => 'A hitelesítő állapota gyanús (lehetséges klónozás) — jelentkezz be jelszóval.'];
        }

        $stmt = $this->db->prepare('UPDATE webauthn_hitelesitok SET sign_count = :sign_count WHERE sofor_id = :sofor_id');
        $stmt->bindValue(':sign_count', $ujSzamlalo);
        $stmt->bindValue(':sofor_id', $kihivas['sofor_id']);
        $stmt->execute();

        $this->torolKihivas($token);
        return ['success' => true, 'sofor_id' => $kihivas['sofor_id']];
    }
}
