import CardTableForFajlok from "components/Table/CardTableForFajlok";
import React from "react";

// components

export default function Fajlok() {
  const storedUserData = localStorage.getItem("user");
  const initialUserData = storedUserData ? JSON.parse(storedUserData) : {};
  return (
    <>
      <div className="flex flex-wrap mt-0">
        <div className="w-full mb-12 px-0 md:px-4">
          <CardTableForFajlok id={initialUserData.ceg_id} tabla={"admin"} />
        </div>
      </div>
    </>
  );
}
