
<?php

$apiConfig = [
    "authHash"=> "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD",
    // A NAV Online Számla technikai felhasználó jelszavát/kulcsait ez
    // titkosítja (openssl_encrypt, AES-256-CBC) a `nav_szamla_beallitasok`
    // táblában — ezek valódi NAV-portál hozzáférést adnak, ezért nem
    // nyílt szövegként tároljuk, mint az `authHash`-t.
    "navEncryptionKey" => "1d940146999f49d45a27f547a3ef0c00cb620d8e618a3838870434ef6602a9f7"
];