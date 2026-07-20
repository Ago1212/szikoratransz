<?php

// R52 (fejlesztési audit, 2026-07-19): minimál CBOR (RFC 8949) dekóder —
// kizárólag a WebAuthn attesztációs objektum (`attestationObject`) és a
// benne lévő COSE nyilvános kulcs dekódolásához szükséges alkészlet
// (unsigned/negative int, byte string, text string, array, map). Nincs
// hozzá composer-függőség; a projekt teljes CBOR-specifikációt nem
// igénylő, szűk esetkörére korlátozva egyszerűbb egy saját, pár tucat
// soros dekódert írni, mint egy általános célú könyvtárat behúzni.
class CborDecoder {
    private $data;
    private $offset = 0;

    public function __construct($binaryData) {
        $this->data = $binaryData;
    }

    public static function decode($binaryData) {
        $decoder = new self($binaryData);
        return $decoder->decodeValue();
    }

    public function getOffset() {
        return $this->offset;
    }

    private function readByte() {
        $byte = ord($this->data[$this->offset]);
        $this->offset++;
        return $byte;
    }

    private function readBytes($len) {
        $bytes = substr($this->data, $this->offset, $len);
        $this->offset += $len;
        return $bytes;
    }

    // A kezdő bájt alsó 5 bitje vagy közvetlenül az érték (0-23), vagy azt
    // jelzi, hány következő bájton van kódolva a tényleges hosszúság/érték.
    private function readLength($additionalInfo) {
        if ($additionalInfo < 24) {
            return $additionalInfo;
        }
        if ($additionalInfo === 24) {
            return $this->readByte();
        }
        if ($additionalInfo === 25) {
            $bytes = $this->readBytes(2);
            return unpack('n', $bytes)[1];
        }
        if ($additionalInfo === 26) {
            $bytes = $this->readBytes(4);
            return unpack('N', $bytes)[1];
        }
        if ($additionalInfo === 27) {
            $bytes = $this->readBytes(8);
            // 64 bites unsigned — ehhez a méret-mezőhöz a WebAuthn-kontextusban
            // sosem lesz ekkora érték a gyakorlatban, de a teljesség kedvéért:
            $high = unpack('N', substr($bytes, 0, 4))[1];
            $low = unpack('N', substr($bytes, 4, 4))[1];
            return ($high << 32) | $low;
        }
        throw new Exception('Nem támogatott CBOR hossz-kódolás.');
    }

    private function decodeValue() {
        $initialByte = $this->readByte();
        $majorType = $initialByte >> 5;
        $additionalInfo = $initialByte & 0x1F;

        switch ($majorType) {
            case 0: // unsigned integer
                return $this->readLength($additionalInfo);
            case 1: // negative integer
                return -1 - $this->readLength($additionalInfo);
            case 2: // byte string
                $len = $this->readLength($additionalInfo);
                return $this->readBytes($len);
            case 3: // text string
                $len = $this->readLength($additionalInfo);
                return $this->readBytes($len);
            case 4: // array
                $len = $this->readLength($additionalInfo);
                $result = [];
                for ($i = 0; $i < $len; $i++) {
                    $result[] = $this->decodeValue();
                }
                return $result;
            case 5: // map
                $len = $this->readLength($additionalInfo);
                $result = [];
                for ($i = 0; $i < $len; $i++) {
                    $key = $this->decodeValue();
                    $value = $this->decodeValue();
                    $result[$key] = $value;
                }
                return $result;
            case 6: // tag — a tartalmát adjuk vissza, a tag-et magát eldobjuk
                $this->readLength($additionalInfo);
                return $this->decodeValue();
            case 7: // simple/float
                if ($additionalInfo === 20) return false;
                if ($additionalInfo === 21) return true;
                if ($additionalInfo === 22) return null;
                throw new Exception('Nem támogatott CBOR simple/float érték.');
            default:
                throw new Exception('Ismeretlen CBOR major type.');
        }
    }
}
