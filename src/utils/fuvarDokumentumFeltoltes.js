import { fetchAction } from "utils/fetchAction";
import { fileToBase64 } from "utils/fileToBase64.js";
import { toast } from "utils/toast";
import { elokeszitFeltoltesre } from "utils/feltoltesElokeszites.js";
import { sorbaAllit } from "utils/feltoltesiSor.js";

export async function fuvarDokumentumokFeltoltese(fuvarId, tipus, fajlok) {
  let sikeres = 0;
  let sorba = 0;
  for (const eredeti of fajlok) {
    // eslint-disable-next-line no-await-in-loop
    const { file, hiba } = await elokeszitFeltoltesre(eredeti);
    if (hiba) {
      toast.error(hiba);
      continue;
    }
    if (navigator.onLine === false) {
      // eslint-disable-next-line no-await-in-loop
      await sorbaAllit({ fuvarId, tipus, file });
      sorba += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const base64 = await fileToBase64(file);
    // eslint-disable-next-line no-await-in-loop
    const result = await fetchAction(
      "feltoltFuvarDokumentumot",
      { fuvarId, tipus, file: base64, name: file.name, size: file.size },
      { timeoutMs: 120000 },
    );
    if (result?.success) {
      sikeres += 1;
    } else if (result?.halozatiHiba) {
      // eslint-disable-next-line no-await-in-loop
      await sorbaAllit({ fuvarId, tipus, file });
      sorba += 1;
    } else {
      toast.error(`${eredeti.name}: ${result?.message || "a feltöltés sikertelen."}`);
    }
  }
  if (sorba > 0) {
    toast.clear();
    toast.success(`Nincs térerő — ${sorba} fotó elmentve a telefonon, feltöltjük, amint lesz kapcsolat.`);
  } else if (sikeres > 0) {
    toast.success(sikeres === fajlok.length ? "Feltöltve." : `${sikeres}/${fajlok.length} fájl feltöltve.`);
  }
  return { sikeres, sorba };
}
