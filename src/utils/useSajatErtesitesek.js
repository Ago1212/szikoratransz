import { useEffect, useState } from "react";
import { fetchAction } from "utils/fetchAction";
import { DOCUMENT_FIELDS, getDocumentStatus, daysUntil } from "utils/documentStatus.js";

// Egy helyen számolja ki a sofőr-oldali "van-e valami, amire figyelnem
// kell" állapotot — ugyanezt korábban 3 külön helyen (Dashboard.js,
// Ertesitesek.js, és a DesktopNav haranG-ja) kellett volna külön-külön
// lekérdezni/szűrni. Három forrásból áll össze:
//  - lejáró/lejárt dokumentumok (a localStorage user objektumból, nincs
//    hozzá külön API-hívás — ld. utils/documentStatus.js, ugyanaz a logika,
//    amit eddig is használt a Dashboard/Ertesitesek);
//  - megválaszolt/lezárt bejelentések (getBejelentesekSofor);
//  - nemrég elbírált (jóváhagyott/elutasított) jármű-váltási kérelmek
//    (getElbiraltJarmuValtasok — ÚJ akció, nem tévesztendő össze a
//    getSajatJarmuValtasKerelmek-kel, ami csak a még FÜGGŐBEN lévőket adja).
export function useSajatErtesitesek() {
  const [lejaratok, setLejaratok] = useState([]);
  const [bejelentesValaszok, setBejelentesValaszok] = useState([]);
  const [jarmuValtasok, setJarmuValtasok] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem("user"));
    } catch (e) {
      user = null;
    }
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const lejarok = DOCUMENT_FIELDS.map((field) => ({
      ...field,
      status: getDocumentStatus(user[field.key]),
      days: daysUntil(user[field.key]),
    })).filter((d) => d.status === "expired" || d.status === "warning");
    setLejaratok(lejarok);

    Promise.all([
      fetchAction("getBejelentesekSofor", { sofor_id: user.id }),
      fetchAction("getElbiraltJarmuValtasok", { sofor_id: user.id }),
    ]).then(([bejelentesResult, jarmuValtasResult]) => {
      if (bejelentesResult?.success) {
        const valaszolt = (bejelentesResult.bejelentesek || []).filter(
          (b) => b.statusz !== "uj" || b.admin_valasz,
        );
        setBejelentesValaszok(valaszolt.slice(0, 5));
      }
      if (jarmuValtasResult?.success) {
        setJarmuValtasok(jarmuValtasResult.kerelmek || []);
      }
      setLoading(false);
    });
  }, []);

  const osszesSzam = lejaratok.length + bejelentesValaszok.length + jarmuValtasok.length;

  return { lejaratok, bejelentesValaszok, jarmuValtasok, osszesSzam, loading };
}
