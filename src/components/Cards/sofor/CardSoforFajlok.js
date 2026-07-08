import React from "react";
import CardTableForFajlok from "../../Table/CardTableForFajlok";

export default function CardSoforFajlok({ sofor_id }) {
  return <CardTableForFajlok id={sofor_id} tabla={"sofor"} />;
}
