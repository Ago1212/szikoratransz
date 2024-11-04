import React from "react";

// components

import CardTable from "components/Table/CardTableForPotkocsi";

export default function Potkocsi() {
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
