import { fetchAction } from "utils/fetchAction";

function kulcs(nev) {
  let userId = "x";
  try {
    userId = JSON.parse(localStorage.getItem("user") || "null")?.id ?? "x";
  } catch (e) {
    userId = "x";
  }
  return `sofor_cache_${userId}_${nev}`;
}

export function cacheOlvasas(nev) {
  try {
    return JSON.parse(localStorage.getItem(kulcs(nev)) || "null");
  } catch (e) {
    return null;
  }
}

export async function gyorsitotarazottLekeres(nev, action, payload) {
  const result = await fetchAction(action, payload);
  if (result?.success) {
    try {
      localStorage.setItem(kulcs(nev), JSON.stringify({ ido: Date.now(), result }));
    } catch (e) {
      // localStorage megtelt vagy nem elérhető
    }
    return { result, offlineIdo: null };
  }
  if (result?.halozatiHiba) {
    const mentett = cacheOlvasas(nev);
    if (mentett?.result) return { result: mentett.result, offlineIdo: mentett.ido };
  }
  return { result, offlineIdo: null };
}

export function offlineCimke(ido) {
  if (!ido) return null;
  const d = new Date(ido);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ma = new Date().toDateString() === d.toDateString();
  return `Nincs kapcsolat — utoljára frissítve ${ma ? "ma" : d.toLocaleDateString("hu-HU")} ${hh}:${mm}`;
}
