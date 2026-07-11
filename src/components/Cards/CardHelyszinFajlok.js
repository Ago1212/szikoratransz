import React from "react";
import CardTableForFajlok from "../Table/CardTableForFajlok";

export default function CardHelyszinFajlok({ helyszin_id }) {
  return <CardTableForFajlok id={helyszin_id} tabla={"helyszin"} />;
}
