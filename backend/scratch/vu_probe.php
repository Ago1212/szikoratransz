<?php
// Ideiglenes vizsgáló szkript — NEM kerül be a végleges kódba (ld. Task 1
// utolsó lépése). Egy adott VU-mintafájlon dumpolja a rendszám-mező körüli
// kontextust minden előfordulásnál, hogy a napi rekord pontos hossza és
// mezőszerkezete megállapítható legyen.
$fajl = $argv[1] ?? die("usage: php vu_probe.php <fajl.ddd>\n");
$bin = file_get_contents($fajl);
$len = strlen($bin);

// A rendszámot a fájlnévből vesszük (a "HU_XXX YYY______..." minta alapján),
// hogy ne kelljen kézzel átírni fájlonként.
preg_match('/^HU_(.+?)_+\d{12}\.DDD$/i', basename($fajl), $m);
$rendszamNyers = trim(str_replace('_', ' ', $m[1] ?? ''));
echo "Keresett rendszám-töredék: '$rendszamNyers'\n";

$offsets = [];
$off = 0;
while (($pos = strpos($bin, substr($rendszamNyers, 0, 3), $off)) !== false) {
    $offsets[] = $pos;
    $off = $pos + 1;
}
echo "Előfordulások száma: " . count($offsets) . "\n";
$stridek = [];
for ($i = 1; $i < count($offsets); $i++) {
    $stridek[] = $offsets[$i] - $offsets[$i-1];
}
echo "Stride-ok (gyakoriság szerint): \n";
$gyak = array_count_values($stridek);
arsort($gyak);
foreach (array_slice($gyak, 0, 10, true) as $s => $db) {
    echo "  stride=$s  előfordulás=$db\n";
}

// Az első "tiszta" (leggyakoribb stride-nak megfelelő) rekord-pár közötti
// teljes bájttartományt kiírjuk hex+ASCII-ban, hogy a mezőket be lehessen
// azonosítani.
$fostride = array_key_first($gyak);
$elso = $offsets[0];
$masodik = null;
foreach ($offsets as $o) {
    if ($o - $elso == $fostride) { $masodik = $o; break; }
}
if ($masodik) {
    $blokk = substr($bin, $elso - 20, ($masodik - $elso) + 20);
    echo "\nEgy teljes napi-rekord-hossznyi blokk ($fostride bájt + kontextus), hex:\n";
    echo chunk_split(bin2hex($blokk), 2, " ") . "\n";
    echo "\nUgyanez ASCII-ban (. = nem nyomtatható):\n";
    echo preg_replace('/[^\x20-\x7E]/', '.', $blokk) . "\n";
}
