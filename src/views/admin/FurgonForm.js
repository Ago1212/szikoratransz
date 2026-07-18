import React from "react";
import { useLocation } from "react-router-dom";

// components

import CardFurgon from "components/Cards/CardFurgon";

export default function FurgonForm() {
  const location = useLocation();
  const data = location.state?.data;

  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <CardFurgon initialFurgon={data} />
        </div>
      </div>
    </>
  );
}
