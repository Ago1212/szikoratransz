import React from "react";

// components

import CardTable from "components/Cards/CardTableForKamionok.js";

export default function Kamionok() {
  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-4">
          <CardTable />
        </div>
      </div>
    </>
  );
}
