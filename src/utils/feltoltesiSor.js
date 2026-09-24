import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";

const DB_NEV = "szikora-sofor";
const TAR = "feltoltesi-sor";
const VALTOZAS_ESEMENY = "feltoltesi-sor-valtozott";

let folyamatbanFlush = null;

function dbMegnyitasa() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB nem érhető el"));
      return;
    }
    const req = indexedDB.open(DB_NEV, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(TAR, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tranzakcio(mod, muvelet) {
  const db = await dbMegnyitasa();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TAR, mod);
    const req = muvelet(tx.objectStore(TAR));
    tx.oncomplete = () => {
      db.close();
      resolve(req?.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function jelezValtozast() {
  window.dispatchEvent(new Event(VALTOZAS_ESEMENY));
}

export async function sorbaAllit({ fuvarId, tipus, file }) {
  await tranzakcio("readwrite", (store) =>
    store.add({ fuvarId: Number(fuvarId), tipus, nev: file.name, blob: file, letrehozva: Date.now() }),
  );
  jelezValtozast();
}

export async function sorElemei(fuvarId) {
  try {
    const mind = (await tranzakcio("readonly", (store) => store.getAll())) || [];
    return fuvarId == null ? mind : mind.filter((e) => e.fuvarId === Number(fuvarId));
  } catch (e) {
    return [];
  }
}

export async function sorElemTorlese(id) {
  await tranzakcio("readwrite", (store) => store.delete(id));
  jelezValtozast();
}

export function feliratkozasSorValtozasra(fn) {
  window.addEventListener(VALTOZAS_ESEMENY, fn);
  return () => window.removeEventListener(VALTOZAS_ESEMENY, fn);
}

async function flushVegrehajtasa() {
  const elemek = await sorElemei();
  let feltoltve = 0;
  const hibak = [];
  for (const elem of elemek) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) break;
    // eslint-disable-next-line no-await-in-loop
    const base64 = await fileToBase64(elem.blob);
    // eslint-disable-next-line no-await-in-loop
    const result = await fetchAction(
      "feltoltFuvarDokumentumot",
      { fuvarId: elem.fuvarId, tipus: elem.tipus, file: base64, name: elem.nev, size: elem.blob.size },
      { timeoutMs: 120000 },
    );
    if (result?.success) {
      // eslint-disable-next-line no-await-in-loop
      await sorElemTorlese(elem.id);
      feltoltve += 1;
    } else if (result?.halozatiHiba || result?.error) {
      break;
    } else {
      hibak.push(`${elem.nev}: ${result?.message || "a feltöltés sikertelen"}`);
      // eslint-disable-next-line no-await-in-loop
      await sorElemTorlese(elem.id);
    }
  }
  return { feltoltve, hibak };
}

export function sorUritese() {
  if (!folyamatbanFlush) {
    folyamatbanFlush = flushVegrehajtasa().finally(() => {
      folyamatbanFlush = null;
    });
  }
  return folyamatbanFlush;
}
