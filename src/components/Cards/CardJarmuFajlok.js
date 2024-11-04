import React from "react";
import CardTableForFajlok from "../Table/CardTableForFajlok";

export default function CardJarmuFajlok() {

  return (
    <form>
      <div className="flex space-x-6 pt-6"> {/* Extra padding-top és nagyobb térköz */}
            <CardTableForFajlok/>
      </div>
    </form>
  );
}
