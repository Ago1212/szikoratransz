import React from "react";
import CardTableForFajlok from "../Table/CardTableForFajlok";

export default function CardJarmuFajlok({ kamion_id }) {
  return <CardTableForFajlok id={kamion_id} tabla={"kamion"} />;
}
