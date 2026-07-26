import React from "react";
import CardTableForFajlok from "../Table/CardTableForFajlok";

// A generikus fájlkezelőt mutatja `tabla="fuvar"` alatt — ide kerül mind a
// fuvart LÉTREHOZÓ forrás-dokumentum, mind bármely utólag CSATOLT dokumentum
// (ld. FuvarInterface::csatolDokumentumot() — gyakori, hogy egy fuvarhoz
// fuvarlevél ÉS szállítólevél is tartozik, külön feltöltve).
export default function CardFuvarFajlok({ fuvar_id }) {
  return <CardTableForFajlok id={fuvar_id} tabla={"fuvar"} />;
}
