-- Kategória-jelölés az egyéb tételekhez (bevétel/kiadás) — jelenleg csak
-- az 'uzemanyag' értéket használjuk: egy NAV-ból importált (vagy kézzel
-- felvett) kiadás-tétel ezzel jelölhető meg úgy, hogy a Pénzforgalom
-- "Üzemanyag" összesítőjébe kerüljön (a tankolasok.osszeg mellé), ne az
-- "Egyéb" kategóriába. Szándékosan VARCHAR, nem ENUM — így egy jövőbeli
-- további kategória bevezetése nem igényel újabb ALTER TABLE-t.
ALTER TABLE `egyeb_koltsegek`
  ADD COLUMN `kategoria` VARCHAR(20) NULL AFTER `irany`;

-- Előkészítés egy jövőbeli MOL (üzemanyagkártya) tranzakció-importhoz: a
-- `szamlaszam` lesz majd a párosítási kulcs a MOL-tól importált tételes
-- tankolási tranzakciók és a NAV-tól (vagy kézzel) rögzített, ugyanahhoz a
-- számlához tartozó `egyeb_koltsegek` sor között — enélkül egy jövőbeli
-- fázisban ugyanez a mező pótlólag, komplikáltabban kerülne be. Ma még
-- semmi nem tölti ki, kézi tankolás-rögzítésnél is NULL marad.
ALTER TABLE `tankolasok`
  ADD COLUMN `szamlaszam` VARCHAR(60) NULL AFTER `helyszin`;
