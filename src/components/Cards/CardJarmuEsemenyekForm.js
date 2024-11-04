import React from "react";
import CardTableForTervezettKarbantartasok from "../Table/CardTableForTervezettKarbantartasok";
import CardTableForElvegzettKarbantartas from "../Table/CardTableForElvegzettKarbantartas";

export default function CardJarmuEsemenyekForm() {
  return (
    <form>
      <div className="flex space-x-6 pt-6"> {/* Extra padding-top és nagyobb térköz */}
        <div className="w-1/2"> {/* Fél szélességű beállítás */}
          <CardTableForTervezettKarbantartasok />
        </div>
        <div className="w-1/2">
          <CardTableForElvegzettKarbantartas />
        </div>
      </div>
    </form>
  );
}
