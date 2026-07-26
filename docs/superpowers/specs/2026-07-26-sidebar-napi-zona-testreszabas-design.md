# Sidebar "napi zóna" testreszabása — design

## Cél

A desktop sidebar (`src/components/Sidebar/Sidebar.js`) tetején, a görgethető nav-lista fölött élő, mindig látható "napi zóna" jelenleg 6, kódban hardcoded menüpontot mutat (Főmenü, Karbantartások, Bejelentések, Pénzforgalom, Flottakövetés, Tachográf). A felhasználó szeretné saját maga eldönteni, mely menüpontok jelenjenek meg itt és milyen sorrendben.

## Hatókör

- **Felhasználónkénti, nem cég-szintű** testreszabás — mindenki a saját napi zónáját állítja be, ugyanaz a minta, mint a meglévő, `localStorage`-ban fiókonként mentett csoport-nyitottság (`openGroups`).
- **Csak a desktop sidebar napi zónája** — a mobil alsó navigációs sáv (`mobileDirectLinks`/`mobileGroups`) változatlan marad.
- **Bármely navigációs menüpont kitűzhető**, nem csak a jelenlegi 6 — beleértve az összecsukható csoportokban (Flotta/Fuvarok/Csapat/Partnerek/Pénzügyek/Rendszer) élő elemeket is. Admin-only elemek (Devizák, Jogosultságok, Listák, Ajánlatkérések) csak admin/root felhasználónak választhatók.
- **Felső korlát: 8 kitűzött elem.**
- Kitűzés **nem távolítja el** az elemet az eredeti csoportjából — a napi zóna egy gyorselérési másodpéldány, nem egy "áthelyezés" (ugyanaz az elv, mint a Pénzforgalom jelenlegi, szándékos napi zóna + Pénzügyek csoport kettőssége).

## Adatmodell

### `PIN_REGISTRY` — az összes kitűzhető elem katalógusa

Modul-szintű, származtatott konstans, a meglévő `mobileGroups`-ból építve (annak minden valódi link-elemét veszi át, dividerek/action-ök nélkül, a szülő csoport `label`-jével felcímkézve), plusz két, jelenleg csak desktopon élő elem kézzel hozzáfűzve:

```js
const EXTRA_PINNABLE_ITEMS = [
  { to: "/admin/dashboard", icon: PiSquaresFourLight, text: "Főmenü", group: "Áttekintés" },
  { to: "/admin/devizak", icon: PiCoinsLight, text: "Devizák", group: "Pénzügyek", adminOnly: true },
];

function buildPinRegistry() {
  const fromGroups = mobileGroups.flatMap((group) =>
    group.items
      .filter((item) => item.to)
      .map((item) => ({ ...item, group: group.label })),
  );
  return [...EXTRA_PINNABLE_ITEMS, ...fromGroups];
}
const PIN_REGISTRY = buildPinRegistry();
```

Ez tudatosan egy **harmadik, kézzel karbantartott nav-forrás** (a mobil `mobileGroups` és a hardcoded desktop csoport-JSX mellett) — ugyanaz az elfogadott drift-kockázat, amit a CLAUDE.md már dokumentál a mobil/desktop nav-taxonómia kettősségénél. A `mobileGroups`-ból való származtatás minimalizálja ezt (a legtöbb elem egyetlen helyről jön), csak 2 elemet kell kézzel szinkronban tartani, ha a jövőben változik a nav.

### Kitűzött elemek tárolása

`localStorage` kulcs: `sidebar-pins-${user.id}`, érték: `to`-útvonalak tömbje, a kívánt sorrendben. Nincs mentett érték esetén (új felhasználó, vagy még nem nyitotta meg a szerkesztőt) az alapértelmezés a **jelenlegi 6 hardcoded elem, jelenlegi sorrendben**:

```js
const DEFAULT_PIN_PATHS = [
  "/admin/dashboard",
  "/admin/karbantartasok",
  "/admin/bejelentesek",
  "/admin/koltsegek",
  "/admin/flottakovetes",
  "/admin/tachograf",
];
```

Ez biztosítja, hogy meglévő felhasználóknak semmi ne változzon, amíg meg nem nyitják a szerkesztőt.

## Szerkesztő UI

A napi zóna doboz jobb felső sarkában egy kis ceruza-ikon gomb (`title="Napi zóna testreszabása"`, `aria-label` ugyanaz) nyit egy `Modal.js`-re épülő panelt — ez már ad portált renderelést a `Admin.js` layout `fixed`-wrapperén kívülre, dark mode kezelést és `role="dialog"`/`aria-modal` szemantikát, nincs hozzá extra munka.

Modal tartalma (cím: "Napi zóna testreszabása"):

1. **"Kitűzve (n/8)"** — a jelenlegi `pinnedPaths` sorrendjében, minden sor: ikon + felirat + ↑ gomb (első elemnél letiltva) + ↓ gomb (utolsónál letiltva) + ✕ eltávolítás gomb.
2. **"Hozzáadható menüpontok"** — a `PIN_REGISTRY` még nem kitűzött elemei, `group` szerint alcímekre bontva (Áttekintés/Flotta/Fuvarok/Csapat/Partnerek/Pénzügyek/Rendszer), soronként ikon + felirat + "+" gomb. A "+" gomb letiltva (tooltippel: "Elérted a napi zóna 8 elemes limitjét") ha a kitűzött lista már 8 elemű. Admin-only elemek csak `isAdmin`-nak jelennek meg ebben a listában.
3. Lábléc: "Alapértelmezett visszaállítása" (a projekt meglévő `confirmDialog()` segédjével megerősítve — felülírja a jelenlegi testreszabást) + "Kész" gomb (csak bezárja a modalt, nincs külön mentés/mégse-fogalom).

Minden interakció (pipálás/nyilazás/eltávolítás/alapértelmezett-visszaállítás) azonnal frissíti a React state-et és a `localStorage`-t egy `useEffect`-tel — ugyanaz az "azonnal perzisztál" minta, mint a meglévő `openGroups`-nál. Nincs külön "Mentés" gomb.

Az implementáció egy külön fájlba kerül (`src/components/Sidebar/NapiZonaEditorModal.js`), nem a már ~1160 soros `Sidebar.js`-be — a `PIN_REGISTRY`/`DEFAULT_PIN_PATHS` viszont a `Sidebar.js`-ben marad (ott van rájuk szükség a napi zóna rendereléséhez is), és propként adódik át a modal-komponensnek.

## Renderelés és szélsőesetek

A napi zóna doboz jelenlegi 6 hardcoded `<NavItem>` JSX-e egy `.map()`-re cserélődik a `pinnedPaths` állapoton: minden `to`-hoz a `PIN_REGISTRY`-ből keresi ki az ikont/feliratot. Badge-számok (jelenleg csak "Bejelentések" és "Beérkezett dokumentumok" kap jelvényt) egy kis, komponensen belüli `badgeByPath` map alapján rendelődnek hozzá:

```js
const badgeByPath = {
  "/admin/bejelentesek": nyitottBejelentesek.length,
  "/admin/beerkezettDokumentumok": beerkezettDokSzam,
};
```

— ugyanazt a két, már létező state-forrást használva, amit a komponens most is számol.

Védekező szűrés render közben:
- Ha egy mentett `to` már nem szerepel a `PIN_REGISTRY`-ben (pl. jövőbeli route-törlés), az adott bejegyzés csendben kimarad a listából (nem dob hibát, nem jelenít meg "törött" elemet).
- Ha egy `adminOnly` elem szerepel egy nem-admin felhasználó mentett kitűzései között (pl. egy korábban admin szerepkör lefokozása után), szintén kimarad renderkor — ugyanaz a védelem, mint amit a `hasAccess()` már ma is biztosít a csoportokban lévő elemekre.
- A napi zóna doboz jelenleg cím nélküli — kap egy apró "Napi zóna" feliratot a bal oldalán (hogy legyen kontextus a szerkesztő-ikonhoz), ez az egyetlen vizuális változás a meglévő elrendezésben a ceruza-ikonon kívül.

## Tesztelés

Élőben, Playwright-tal, egy helyi `sessions`-be beszúrt admin-munkamenettel:
1. Alapértelmezett napi zóna ellenőrzése új/eddig nem testreszabott fióknál — megegyezik a jelenlegi 6 elemmel, jelenlegi sorrendben.
2. Szerkesztő modal megnyitása, egy elem eltávolítása, egy másik hozzáadása (pl. egy Csapat-csoportbeli elem), majd átrendezés ↑/↓ gombokkal.
3. Oldal-újratöltés után a testreszabott napi zóna megmarad (localStorage-perzisztencia).
4. 8-as limit elérésekor a "Hozzáadható menüpontok" "+" gombjai letiltódnak, tooltippel.
5. "Alapértelmezett visszaállítása" — megerősítő dialógus után visszaáll a `DEFAULT_PIN_PATHS`-ra.
6. Badge-számok (Bejelentések/Beérkezett dokumentumok) helyesen jelennek meg, ha ezek az elemek kitűzöttek.
7. Mindez sötét módban is ellenőrizve (modal, badge-ek, ikonok).
