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
