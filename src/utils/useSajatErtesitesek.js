import { useCallback, useEffect, useState } from "react";
import { fetchAction } from "utils/fetchAction";
import { gyorsitotarazottLekeres } from "utils/soforCache";
import { DOCUMENT_FIELDS, getDocumentStatus, daysUntil } from "utils/documentStatus.js";

export const latottKulcs = (userId) => `sofor_ertesitesek_latott_${userId}`;

export function latottErtesitesek(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(latottKulcs(userId)) || "[]"));
  } catch (e) {
    return new Set();
  }
}

export function ertesitesAzonositok({ lejaratok, fuvarok, bejelentesValaszok, jarmuValtasok }) {
  return [
    ...fuvarok.map((f) => `fuv-${f.id}`),
    ...lejaratok.map((d) => `doc-${d.key}-${d.status}`),
    ...bejelentesValaszok.map((b) => `bej-${b.id}-${b.statusz}-${b.admin_valasz ? 1 : 0}`),
    ...jarmuValtasok.map((k) => `jv-${k.id}`),
  ];
}

function lejaratokUserbol(user) {
  return DOCUMENT_FIELDS.map((field) => ({
    ...field,
    status: getDocumentStatus(user[field.key]),
    days: daysUntil(user[field.key]),
  })).filter((d) => d.status === "expired" || d.status === "warning");
}

export function useSajatErtesitesek() {
  const [lejaratok, setLejaratok] = useState([]);
  const [fuvarok, setFuvarok] = useState([]);
  const [bejelentesValaszok, setBejelentesValaszok] = useState([]);
  const [jarmuValtasok, setJarmuValtasok] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hiba, setHiba] = useState(null);
  const [offlineIdo, setOfflineIdo] = useState(null);
  const [frissitesSzamlalo, setFrissitesSzamlalo] = useState(0);
  const frissit = useCallback(() => setFrissitesSzamlalo((n) => n + 1), []);

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

    setLejaratok(lejaratokUserbol(user));

    Promise.all([
      fetchAction("getBejelentesekSofor", { sofor_id: user.id }),
      fetchAction("getElbiraltJarmuValtasok", { sofor_id: user.id }),
      gyorsitotarazottLekeres("aktiv_fuvarok", "getSajatFuvarok", { sofor_id: user.id, aktivOnly: true }),
      fetchAction("getSajatSofor", { id: user.id }),
    ]).then(([bejelentesResult, jarmuValtasResult, fuvarCache, soforResult]) => {
      const fuvarResult = fuvarCache.result;
      setOfflineIdo(fuvarCache.offlineIdo);
      if (bejelentesResult?.success) {
        const valaszolt = (bejelentesResult.bejelentesek || []).filter(
          (b) => b.statusz !== "uj" || b.admin_valasz,
        );
        setBejelentesValaszok(valaszolt.slice(0, 5));
      }
      if (jarmuValtasResult?.success) setJarmuValtasok(jarmuValtasResult.kerelmek || []);
      if (fuvarResult?.success) setFuvarok(fuvarResult.fuvarok || []);
      if (soforResult?.success && soforResult.user) setLejaratok(lejaratokUserbol({ ...user, ...soforResult.user }));
      if (![bejelentesResult, jarmuValtasResult, fuvarResult].some((r) => r?.success)) {
        setHiba(bejelentesResult?.message || "Nem sikerült betölteni az értesítéseket.");
      }
      setLoading(false);
    });
  }, [frissitesSzamlalo]);

  const osszesSzam = lejaratok.length + bejelentesValaszok.length + jarmuValtasok.length + fuvarok.length;

  let ujSzam = 0;
  if (!loading) {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem("user"));
    } catch (e) {
      user = null;
    }
    const latott = latottErtesitesek(user?.id);
    ujSzam = ertesitesAzonositok({ lejaratok, fuvarok, bejelentesValaszok, jarmuValtasok }).filter((id) => !latott.has(id)).length;
  }

  return { lejaratok, fuvarok, bejelentesValaszok, jarmuValtasok, osszesSzam, ujSzam, loading, hiba, offlineIdo, frissit };
}
