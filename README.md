# Szikora Transz – Flottakezelő rendszer

Belső adminisztrációs és flottakezelő alkalmazás a Szikora Transz fuvarozó cég számára. A rendszer React alapú admin felületet biztosít kamionok, pótkocsik, sofőrök, karbantartások és bejelentések kezelésére, egy egyszerű PHP backend API-val és MySQL adatbázissal.

## Funkciók

- **Bejelentkezés / regisztráció** – admin és sofőr (user) szerepkörrel
- **Admin Dashboard** – áttekintő felület a flotta állapotáról
- **Kamionok** – kamionok listázása, felvétele, szerkesztése (`Kamionok.js`, `KamionForm.js`)
- **Pótkocsik** – pótkocsik listázása, felvétele, szerkesztése (`Potkocsi.js`, `PotkocsiForm.js`)
- **Sofőrök** – sofőrök kezelése (`Soforok.js`, `SoforForm.js`)
- **Karbantartások** – kamion és pótkocsi karbantartások nyilvántartása, szűrése dátum/jármű szerint
- **Bejelentések** – hibabejelentések rögzítése és listázása
- **Naptár / Események** – `react-big-calendar` alapú eseménynaptár (`Esemenyek.js`)
- **Fájlkezelés** – dokumentumok feltöltése/letöltése jármű vagy admin szinten (`Fajlok.js`)
- **E-mail küldés** – ajánlatkérés űrlap kiszolgálása a nyilvános oldalról
- **Sofőr (user) nézet** – korlátozott jogosultságú felület a sofőrök számára

## Technológiák

**Frontend**
- React 18 + React Router 5
- Tailwind CSS (Notus React admin sablon alapokon)
- Chart.js, react-big-calendar, moment / moment-timezone
- Font Awesome, React Icons

**Backend**
- PHP (natív, keretrendszer nélküli REST-szerű API – `backend/api.php`, `backend/ApiHandler.php`)
- MySQL adatbázis PDO-n keresztül (`backend/db.php`)
- Interfészek modulonként: `kamion`, `potkocsi`, `soforok`, `karbantartasok`, `bejelentesek`, `files`, `email` (`backend/interface/`)

## Projektstruktúra

```
szikoratransz/
├── backend/              # PHP API
│   ├── api.php
│   ├── ApiHandler.php
│   ├── config.php
│   ├── db.php
│   ├── interface/        # üzleti logika moduljai
│   ├── sql/               # adatbázis séma
│   └── files/             # feltöltött / minta fájlok
├── public/               # statikus assetek, index.html
├── src/
│   ├── assets/            # stílusok, képek
│   ├── components/        # újrafelhasználható komponensek (Cards, Navbars, Sidebar, ...)
│   ├── layouts/           # Admin / Auth / User layout
│   ├── utils/             # fetch / fájl letöltés segédfüggvények
│   └── views/              # oldalak (admin, auth, user, Landing, Profile)
├── genezio.yaml           # Genezio deploy konfiguráció
└── tailwind.config.js
```

## Fejlesztői környezet indítása

### Előfeltételek
- Node.js (LTS)
- PHP 8.2
- MySQL szerver

### Frontend

```bash
npm install
npm start
```

Ha új Tailwind osztályt adsz hozzá, amely még nincs a `src/assets/styles/tailwind.css`-ben, futtasd újra:

```bash
npx tailwindcss -i ./src/assets/styles/index.css -o ./src/assets/styles/tailwind.css --watch
```

### Backend

```bash
cd backend
php8.2 -S localhost:8000
```

### Adatbázis

A séma a `backend/sql/1.sql` fájlban található. Az adatbázis kapcsolat beállításai a `backend/db.php`-ban vannak – éles környezetben ezeket célszerű környezeti változókból olvasni, ne kerüljenek verziókezelőbe.

## Build és deploy

```bash
npm run build
```

A projekt Genezio-n keresztül is deployolható a `genezio.yaml` konfiguráció alapján (`npm install && npm run build`, a `build` mappa kerül publikálásra).

## Ismert hiányosságok / TODO

- Karbantartásokat nem hozza a naptár
- Mobil nézetben listák helyett kártyák (Card) megjelenítése szükséges

## Licenc

A projekt a [Notus React](https://www.creative-tim.com/product/notus-react) (Creative Tim, MIT licenc) admin sablon alapjaira épül, egyedi Szikora Transz üzleti logikával kiegészítve. Lásd: [LICENSE.md](LICENSE.md).
