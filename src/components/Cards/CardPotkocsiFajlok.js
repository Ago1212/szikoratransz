import React from "react";
import CardTableForFajlok from "../Table/CardTableForFajlok";

export default function CardPotkocsiFajlok({ potkocsi_id }) {
  return <CardTableForFajlok id={potkocsi_id} tabla={"potkocsi"} />;
}
