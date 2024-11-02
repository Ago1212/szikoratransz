import CardPotkocsi from "components/Cards/CardPotkocsi";
import React from "react";

// components


export default function PotkocsiForm() {
  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-12/12 px-4">
          <CardPotkocsi />
        </div>
      </div>
    </>
  );
}
