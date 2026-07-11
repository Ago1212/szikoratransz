// Fájl/Blob -> base64 (data: előtag nélkül) — a bejelentés-fotó/videó/
// hang, a dokumentum- és a tankolás-blokk feltöltés mindegyike ugyanezt
// az egyetlen `fileUpload` API-akciót hívja, ugyanezzel a kódolással.
export function fileToBase64(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}
