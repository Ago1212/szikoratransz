import React from "react";
import CardTableForFajlok from "../Table/CardTableForFajlok";

export default function CardFurgonFajlok({ furgon_id }) {
  return <CardTableForFajlok id={furgon_id} tabla={"furgon"} />;
}
