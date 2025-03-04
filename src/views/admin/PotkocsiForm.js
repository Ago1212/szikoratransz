import CardPotkocsi from "components/Cards/CardPotkocsi";
import React from "react";
import { useLocation } from "react-router-dom";

// components

export default function PotkocsiForm() {
  const location = useLocation();
  const data = location.state?.data;
  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full lg:w-12/12 px-4">
          <CardPotkocsi initialPotkocsi={data} />
        </div>
      </div>
    </>
  );
}
