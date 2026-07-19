<?php

// R11 (fejlesztési audit, 2026-07-19): Web Push (RFC 8030/8291/8292)
// küldő, kizárólag PHP core `openssl`/`hash_hkdf()` függvényekkel — nincs
// hozzá composer-függőség (a projektnek nincs composer.json-ja), az
// aláírás (VAPID, ES256 JWT) és a titkosítás (aes128gcm) is natívan
// elérhető primitívekből épül fel.
//
// Nem egy általános célú, minden RFC-szélsőértéket lefedő könyvtár —
// pontosan azt a szűk esetkört fedi, amit ez a projekt ténylegesen használ
// (egy rövid JSON payload push-értesítésekhez, a böngészők aktuális
// aes128gcm content-encoding elvárása szerint).
class WebPushSender {
    private $vapidPrivatePem;
    private $vapidPublicB64;
    private $subject;

    public function __construct($vapidPrivatePem, $vapidPublicB64, $subject) {
        $this->vapidPrivatePem = $vapidPrivatePem;
        $this->vapidPublicB64 = $vapidPublicB64;
        $this->subject = $subject;
    }

    private static function b64urlEncode($bin) {
        return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    }

    private static function b64urlDecode($str) {
        $pad = strlen($str) % 4;
        if ($pad > 0) {
            $str .= str_repeat('=', 4 - $pad);
        }
        return base64_decode(strtr($str, '-_', '+/'));
    }

    // Az openssl_sign ES256-nál DER-kódolt (r,s) aláírást ad vissza — a JOSE/
    // JWT viszont a nyers, fix hosszú (32+32 bájt) r||s formátumot várja.
    // Ez a függvény ezt a DER→JOSE átalakítást végzi, kézzel bontva az
    // ASN.1 SEQUENCE(INTEGER r, INTEGER s) szerkezetet.
    private static function derSignatureToJose($der) {
        $offset = 2; // SEQUENCE tag + hossz bájt (rövid formában, ami P-256-nál mindig igaz)
        $readInt = function ($der, &$offset) {
            if (ord($der[$offset]) !== 0x02) {
                throw new Exception('Váratlan ASN.1 tag az aláírásban.');
            }
            $offset++;
            $len = ord($der[$offset]);
            $offset++;
            $bin = substr($der, $offset, $len);
            $offset += $len;
            // Az ASN.1 INTEGER előjel-bájtot tehet elé (0x00), ha a legfelső
            // bit egyébként negatívnak tűnne — ezt a JOSE fix-hosszú
            // formátumhoz el kell hagyni, majd 32 bájtra kell paddelni.
            $bin = ltrim($bin, "\x00");
            return str_pad($bin, 32, "\x00", STR_PAD_LEFT);
        };
        $r = $readInt($der, $offset);
        $s = $readInt($der, $offset);
        return $r . $s;
    }

    private function vapidJwt($endpoint) {
        $parsed = parse_url($endpoint);
        $aud = $parsed['scheme'] . '://' . $parsed['host'] . (isset($parsed['port']) ? ':' . $parsed['port'] : '');

        $header = ['typ' => 'JWT', 'alg' => 'ES256'];
        $claims = [
            'aud' => $aud,
            'exp' => time() + 12 * 3600,
            'sub' => $this->subject,
        ];
        $signingInput = self::b64urlEncode(json_encode($header)) . '.' . self::b64urlEncode(json_encode($claims));

        $privKey = openssl_pkey_get_private($this->vapidPrivatePem);
        if (!$privKey) {
            throw new Exception('Érvénytelen VAPID privát kulcs.');
        }
        $derSignature = '';
        openssl_sign($signingInput, $derSignature, $privKey, OPENSSL_ALGO_SHA256);
        $joseSignature = self::derSignatureToJose($derSignature);

        return $signingInput . '.' . self::b64urlEncode($joseSignature);
    }

    // RFC 8291 aes128gcm titkosítás — egyetlen rekordos payload (a push
    // üzenetek mérete ehhez a projekthez mindig kicsi, egy rövid JSON), így
    // a rekord-darabolási logikát (több rekordos payload) szándékosan nem
    // implementáljuk, csak az egyrekordos esetet.
    private function encryptPayload($plaintext, $p256dhB64, $authB64) {
        $userPublicKeyBin = self::b64urlDecode($p256dhB64);
        $authSecret = self::b64urlDecode($authB64);

        // Efemer (egyszer használatos) EC-kulcspár ehhez az egy üzenethez —
        // ez adja a Diffie-Hellman megosztott titok "mi" felét.
        $ephemeral = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        $ephemeralDetails = openssl_pkey_get_details($ephemeral);
        $ephemeralPublicBin = "\x04" . $ephemeralDetails['ec']['x'] . $ephemeralDetails['ec']['y'];

        $sharedSecret = openssl_pkey_derive($this->buildPublicKeyResource($userPublicKeyBin), $ephemeral, 32);
        if ($sharedSecret === false) {
            throw new Exception('ECDH kulcs-származtatás sikertelen.');
        }

        $salt = random_bytes(16);

        // RFC 8291 3. fejezet — a PRK-hoz és az utána következő kulcs-
        // levezetésekhez a "WebPush: info" mezőnek tartalmaznia kell mindkét
        // fél nyilvános kulcsát is, nem csak az auth-secretet.
        $keyInfo = "WebPush: info\x00" . $userPublicKeyBin . $ephemeralPublicBin;
        $prk = hash_hkdf('sha256', $sharedSecret, 32, $keyInfo, $authSecret);

        $cek = hash_hkdf('sha256', $prk, 16, "Content-Encoding: aes128gcm\x00", $salt);
        $nonce = hash_hkdf('sha256', $prk, 12, "Content-Encoding: nonce\x00", $salt);

        // Egyrekordos aes128gcm padding: egyetlen 0x02 elválasztó-bájt a
        // tényleges adat után (nincs több rekord, ezért nincs 0x01-es
        // folytatás-jelző, ld. RFC 8188 2. fejezet).
        $paddedPlaintext = $plaintext . "\x02";

        $ciphertext = openssl_encrypt(
            $paddedPlaintext,
            'aes-128-gcm',
            $cek,
            OPENSSL_RAW_DATA,
            $nonce,
            $tag
        );
        if ($ciphertext === false) {
            throw new Exception('Payload titkosítása sikertelen.');
        }

        // RFC 8188 fejléc: salt(16) + record size(4, big-endian) + kulcs-id
        // hossza(1) + kulcs-id (itt: az efemer nyilvános kulcsunk).
        $recordSize = pack('N', 4096);
        $keyIdLen = chr(strlen($ephemeralPublicBin));
        $aes128gcmHeader = $salt . $recordSize . $keyIdLen . $ephemeralPublicBin;

        return $aes128gcmHeader . $ciphertext . $tag;
    }

    private function buildPublicKeyResource($uncompressedPointBin) {
        $len = strlen($uncompressedPointBin);
        $x = substr($uncompressedPointBin, 1, ($len - 1) / 2);
        $y = substr($uncompressedPointBin, 1 + ($len - 1) / 2);

        // Az openssl_pkey_derive()-hoz egy valódi PHP EC "public key"
        // erőforrás kell — ezt a legegyszerűbben egy ideiglenes, csak a
        // publikus komponenseket tartalmazó PEM importálásával érjük el
        // (nincs hozzá privát kulcsunk, és nem is kell).
        $der = $this->buildEcPublicKeyDer($x, $y);
        $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64) . "-----END PUBLIC KEY-----\n";
        $res = openssl_pkey_get_public($pem);
        if (!$res) {
            throw new Exception('Érvénytelen böngésző-oldali publikus kulcs (p256dh).');
        }
        return $res;
    }

    // SubjectPublicKeyInfo DER a prime256v1 OID-dal — ez a kézzel épített
    // rész, mert PHP-nak nincs beépített "nyers EC-pont → PEM" segédje.
    private function buildEcPublicKeyDer($x, $y) {
        $point = "\x04" . $x . $y;
        // SEQUENCE { SEQUENCE { OID id-ecPublicKey, OID prime256v1 }, BIT STRING point }
        $algId = hex2bin('301306072a8648ce3d020106082a8648ce3d030107');
        $bitString = "\x03" . chr(strlen($point) + 1) . "\x00" . $point;
        $inner = $algId . $bitString;
        return "\x30" . self::derLength(strlen($inner)) . $inner;
    }

    private static function derLength($len) {
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

    // `$subscription`: ['endpoint' => ..., 'p256dh' => ..., 'auth' => ...]
    // (pontosan a böngésző `PushSubscription.toJSON()` alakja). Visszaadja
    // a HTTP válaszkódot — a hívó felelős a 404/410 (a feliratkozás már
    // érvénytelen, törlendő a DB-ből) kezeléséért.
    public function send($subscription, $payloadArray) {
        $payload = json_encode($payloadArray);
        $body = $this->encryptPayload($payload, $subscription['p256dh'], $subscription['auth']);
        $jwt = $this->vapidJwt($subscription['endpoint']);

        $headers = [
            'Authorization: vapid t=' . $jwt . ', k=' . $this->vapidPublicB64,
            'Content-Encoding: aes128gcm',
            'Content-Type: application/octet-stream',
            'Content-Length: ' . strlen($body),
            'TTL: 2419200',
        ];

        $ch = curl_init($subscription['endpoint']);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $status;
    }
}
