// A `fuvarok` tábla néhány régi, migráció előtti sora MySQL "zero date"
// (`0000-00-00`) értéket tartalmaz `lerakas_datuma`/`felrakas_datuma`
// mezőn — ez nem valódi dátum, csak egy hiányzó érték csendes DB-szintű
// jelzése (nem-strict MySQL mód öröksége). Nyersen kiírva megtévesztő;
// ez a helper "—"-re cseréli, ugyanúgy, mint a valódi hiányzó (null) érték.
export function formatFuvarDatum(datum) {
  if (!datum || datum.startsWith("0000")) {
    return null;
  }
  return datum;
}

function datumReszek(ertek) {
  if (!ertek || String(ertek).startsWith("0000")) return null;
  const m = String(ertek).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, ev, ho, nap, ora, perc] = m;
  return { datum: new Date(Number(ev), Number(ho) - 1, Number(nap)), ev: Number(ev), ho: Number(ho), nap: Number(nap), ido: ora ? `${ora}:${perc}` : null };
}

function napEltolas(datum) {
  const ma = new Date();
  ma.setHours(0, 0, 0, 0);
  return Math.round((datum - ma) / 86400000);
}

const HONAPOK = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];
const NAPOK = ["vas.", "hétf.", "kedd", "szer.", "csüt.", "pént.", "szomb."];

export function formatDatumRovid(ertek) {
  const r = datumReszek(ertek);
  if (!r) return null;
  const eltolas = napEltolas(r.datum);
  if (eltolas === 0) return "ma";
  if (eltolas === 1) return "holnap";
  if (eltolas === -1) return "tegnap";
  const evResz = r.ev !== new Date().getFullYear() ? `${r.ev}. ` : "";
  return `${evResz}${HONAPOK[r.ho - 1]} ${r.nap}., ${NAPOK[r.datum.getDay()]}`;
}

export function formatDatumIdo(ertek) {
  const r = datumReszek(ertek);
  if (!r) return null;
  const nap = formatDatumRovid(ertek);
  return r.ido ? `${nap} ${r.ido}` : nap;
}

export function napokMaihoz(ertek) {
  const r = datumReszek(ertek);
  return r ? napEltolas(r.datum) : null;
}
