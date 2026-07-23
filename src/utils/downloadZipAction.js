import { fetchAction } from "utils/fetchAction";

// Tömeges letöltés — a korábbi, fájlonként ismételt `downloadFileAction`
// hívás helyett (amit böngészők 2-3 fájl után csendben letiltottak) egy
// szerver-oldalon összecsomagolt ZIP-et kér le és indít egyetlen
// letöltésként.
export const downloadZipAction = async (ids) => {
  const result = await fetchAction("downloadFilesZip", { ids });
  if (!result?.success) {
    throw new Error(result?.message || "A tömeges letöltés sikertelen.");
  }
  const link = document.createElement("a");
  link.href = `data:${result.mime};base64,${result.file}`;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
