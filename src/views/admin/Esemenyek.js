import CardTableForEsemenyek from "components/Table/CardTableForEsemenyek";
import React from "react";

// components

export default function Esemenyek() {
  const storedUserData = sessionStorage.getItem("user");
  const initialUserData = storedUserData ? JSON.parse(storedUserData) : {};
  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-4">
          <CardTableForEsemenyek id={initialUserData.id} />
        </div>
      </div>
    </>
  );
}
