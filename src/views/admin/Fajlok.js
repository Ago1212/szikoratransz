import CardTableForFajlok from "components/Table/CardTableForFajlok";
import React from "react";

// components


export default function Fajlok() {
  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-4">
          <CardTableForFajlok />
        </div>
      </div>
    </>
  );
}
