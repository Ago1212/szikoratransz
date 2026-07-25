import React, { useEffect, useState } from "react";
import { PiFileTextLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

// Csak akkor renderel bármit, ha a fuvarnak van forrás-dokumentuma
// (beerkezett_dokumentum_id, ld. Task 2) — a legtöbb fuvar kézzel rögzített,
// azoknál ez a komponens null-t ad vissza.
export default function FuvarDokumentumLink({ beerkezettDokumentumId }) {
  const [dokumentum, setDokumentum] = useState(null);

  useEffect(() => {
    if (!beerkezettDokumentumId) {
      setDokumentum(null);
      return;
    }
    const user = JSON.parse(localStorage.getItem("user"));
    fetchAction("getBeerkezettDokumentumok", { ceg_id: user.ceg_id, csakFeldolgozatlan: false }).then(
      (result) => {
        if (!result?.success) return;
        const talalt = (result.dokumentumok || []).find((d) => d.id === beerkezettDokumentumId);
        setDokumentum(talalt || null);
      },
    );
  }, [beerkezettDokumentumId]);

  if (!dokumentum) return null;

  return (
    <a
      href="/admin/beerkezettDokumentumok"
      className="mb-4 flex items-center gap-2 rounded-xl border border-ink-100 bg-sand-50 px-3 py-2 text-xs text-ink-600 hover:bg-sand-100 dark:border-ink-800 dark:bg-ink-800 dark:text-ink-300"
    >
      <PiFileTextLight className="h-4 w-4 flex-shrink-0 text-ink-400" />
      Ez a fuvar a(z) <span className="font-semibold">{dokumentum.filename}</span> dokumentumból készült.
    </a>
  );
}
