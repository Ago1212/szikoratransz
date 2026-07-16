import CardTableForEsemenyek from "components/Table/CardTableForEsemenyek";
import PageHeader from "components/UI/PageHeader.js";
import React from "react";

// components

export default function Esemenyek() {
  const storedUserData = sessionStorage.getItem("user");
  const initialUserData = storedUserData ? JSON.parse(storedUserData) : {};
  return (
    <>
      <PageHeader eyebrow="Rendszer" title="Események" />
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTableForEsemenyek id={initialUserData.ceg_id} />
        </div>
      </div>
    </>
  );
}
