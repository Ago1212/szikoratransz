import CardBejelentesek from "components/Cards/bejelentesek/CardBejelentesek";
import React from "react";
import { useLocation } from "react-router-dom";

// components

export default function BejelentesekForm() {
  const location = useLocation();
  const data = location.state?.data;
  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <CardBejelentesek initBejelentesek={data} />
        </div>
      </div>
    </>
  );
}
