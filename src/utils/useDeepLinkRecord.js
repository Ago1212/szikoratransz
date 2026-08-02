import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchAction } from "utils/fetchAction";

// A globális keresésből (GlobalSearch.js) érkező navigáció csak egy `id`
// query paramétert ad át (`?id=123`), nem a teljes rekordot `location.state`-
// ben, mint a lista-oldalak "Szerkesztés" gombja — enélkül a szerkesztő
// Card-komponensek `initial*` propja üresen (új rekord módban) nyílna meg.
// Ha `location.state.data` jelen van, azt használjuk közvetlenül (nincs
// extra hálózati kör); egyébként `?id=`-ből lekérjük a teljes rekordot.
export default function useDeepLinkRecord(action, responseKey) {
  const location = useLocation();
  const stateData = location.state?.data;
  const idFromQuery = new URLSearchParams(location.search).get("id");

  const [data, setData] = useState(stateData);
  const [loading, setLoading] = useState(!stateData && !!idFromQuery);

  useEffect(() => {
    if (stateData || !idFromQuery) return;
    let cancelled = false;
    setLoading(true);
    fetchAction(action, { id: idFromQuery }).then((result) => {
      if (cancelled) return;
      if (result?.success && result[responseKey]) {
        setData(result[responseKey]);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromQuery]);

  return { data, loading };
}
