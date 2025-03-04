import React, { useState } from "react";
import CardTableForPotkocsiElvegzettKarbantartas from "components/Table/potkocsi/CardTableForPotkocsiElvegzettKarbantartas";
import CardTableForPotkocsiTervezettKarbantartasok from "components/Table/potkocsi/CardTableForPotkocsiTervezettKarbantartasok";
export default function CardPotkocsiEsemenyekForm({ potkocsi_id }) {
  const [refresh, setRefresh] = useState(false);
  const [refresh2, setRefresh2] = useState(false);

  const triggerRefresh = () => setRefresh((prev) => !prev);
  const triggerRefresh2 = () => setRefresh2((prev) => !prev);
  return (
    <form>
      <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6 pt-6">
        <div className="w-full md:w-1/2">
          <CardTableForPotkocsiTervezettKarbantartasok
            potkocsi_id={potkocsi_id}
            onRefresh={triggerRefresh}
            refresh={refresh2}
          />
        </div>
        <div className="w-full md:w-1/2">
          <CardTableForPotkocsiElvegzettKarbantartas
            potkocsi_id={potkocsi_id}
            onRefresh={triggerRefresh2}
            refresh={refresh}
          />
        </div>
      </div>
    </form>
  );
}
