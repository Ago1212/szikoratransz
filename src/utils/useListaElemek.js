import { useEffect, useState } from "react";
import { fetchAction } from "utils/fetchAction";

// Egyénileg (cégenként) bővíthető listaelemek — kamion méret, jármű
// állapota, biztosítás fizetési üteme, bejelentés/szabadság típusa (ld.
// views/admin/Listak.js) — lekérése. Minden ilyen legördülőt használó
// form/oldal (admin ÉS sofőr oldalon is) ugyanezt a hook-ot hívja, hogy az
// egyéni bővítés mindenhol egységesen működjön.
//
// A `user.ceg_id` (admin-oldali fiókoknál) és a `user.admin` (sofőr-oldali
// fiókoknál) ugyanazt a cég-azonosítót jelenti két különböző mezőnéven —
// ez a hook mindkettőt kezeli, hogy admin és sofőr felületről is hívható
// legyen ugyanaz a `getListaElemek` akció (ami szándékosan nem admin-only).
export function useListaElemek(tipus) {
  const [elemek, setElemek] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let user = null;
    try {
      user = JSON.parse(localStorage.getItem("user"));
    } catch (e) {
      user = null;
    }
    const cegId = user?.ceg_id || user?.admin;
    if (!cegId || !tipus) {
      setLoading(false);
      return;
    }
    fetchAction("getListaElemek", { id: cegId, tipus }).then((result) => {
      if (result?.success) setElemek(result.elemek || []);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipus]);

  return { elemek, loading };
}
