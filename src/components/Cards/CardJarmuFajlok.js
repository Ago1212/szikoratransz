import React from "react";
import CardTableForFajlok from "../Table/CardTableForFajlok";

export default function CardJarmuFajlok({ kamion_id }) {
  return (
    <form>
      <div className="flex space-x-6 pt-6">
        {" "}
        {/* Extra padding-top és nagyobb térköz */}
        <CardTableForFajlok id={kamion_id} tabla={"kamion"} />
      </div>
    </form>
  );
}
