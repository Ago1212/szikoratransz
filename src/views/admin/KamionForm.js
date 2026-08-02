import React from "react";

// components

import CardKamion from "components/Cards/CardKamion";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";
import Spinner from "components/UI/Spinner.js";
import useDeepLinkRecord from "utils/useDeepLinkRecord.js";

export default function KamionForm() {
  const { data, loading } = useDeepLinkRecord("getKamion", "kamion");

  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <AdminBreadcrumb
            group="Flotta"
            listLabel="Kamionok"
            listPath="/admin/kamionok"
            current={data?.rendszam || "Új kamion"}
          />
          {loading ? <Spinner /> : <CardKamion initialKamion={data} />}
        </div>
      </div>
    </>
  );
}
