import React from "react";

// components

import CardFurgon from "components/Cards/CardFurgon";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";
import Spinner from "components/UI/Spinner.js";
import useDeepLinkRecord from "utils/useDeepLinkRecord.js";

export default function FurgonForm() {
  const { data, loading } = useDeepLinkRecord("getFurgon", "furgon");

  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <AdminBreadcrumb
            group="Flotta"
            listLabel="Furgonok"
            listPath="/admin/furgonok"
            current={data?.rendszam || "Új furgon"}
          />
          {loading ? <Spinner /> : <CardFurgon initialFurgon={data} />}
        </div>
      </div>
    </>
  );
}
