import React from "react";
import CardTableForFajlok from "../../Table/CardTableForFajlok";

export default function CardSoforFajlok({ sofor_id }) {
  return (
    <form>
      <div className="flex space-x-6 pt-6">
        <CardTableForFajlok id={sofor_id} tabla={"sofor"} />
      </div>
    </form>
  );
}
