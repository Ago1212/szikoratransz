import React from "react";
import CardTableForFajlok from "../Table/CardTableForFajlok";

export default function CardPotkocsiFajlok({ potkocsi_id }) {
  return (
    <form>
      <div className="flex space-x-6 pt-6">
        {" "}
        {/* Extra padding-top és nagyobb térköz */}
        <CardTableForFajlok id={potkocsi_id} tabla={"potkocsi"} />
      </div>
    </form>
  );
}
