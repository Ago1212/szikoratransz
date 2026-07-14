
<?php

$apiConfig = [
    "authHash"=> "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD",
    // Külső rendszerek (NAV Online Számla, GPSmart flottakövetés) valódi
    // jelszavát/kulcsait ez titkosítja (openssl_encrypt, AES-256-CBC) —
    // ezek valódi külső fiókokhoz adnak hozzáférést, ezért nem nyílt
    // szövegként tároljuk, mint az `authHash`-t. A név `navEncryptionKey`
    // maradt (elsőként a NAV-integrációhoz készült), de általános,
    // bármelyik ilyen jellegű titok titkosításához újrahasználható kulcs.
    "navEncryptionKey" => "1d940146999f49d45a27f547a3ef0c00cb620d8e618a3838870434ef6602a9f7"
];