import CardSoforok from "components/Cards/sofor/CardSofor";
import React from "react";
import AdminBreadcrumb from "components/UI/AdminBreadcrumb.js";
import Spinner from "components/UI/Spinner.js";
import useDeepLinkRecord from "utils/useDeepLinkRecord.js";

// components

export default function SoforForm() {
  const { data, loading } = useDeepLinkRecord("getSofor", "sofor");
  return (
    <>
      <div className="flex flex-wrap">
        <div className="w-full px-0 lg:w-12/12 md:px-4">
          <AdminBreadcrumb
            group="Csapat"
            listLabel="Sofőrök"
            listPath="/admin/soforok"
            current={data?.name || "Új sofőr"}
          />
          {loading ? <Spinner /> : <CardSoforok initSofor={data} />}
        </div>
      </div>
    </>
  );
}
