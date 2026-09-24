export const MAX_FELTOLTES_BAJT = 10 * 1024 * 1024;

const MAX_KEP_OLDAL = 1800;
const TOMORITES_KUSZOB_BAJT = 600 * 1024;

export function meretSzoveg(bajt) {
  if (bajt >= 1024 * 1024) return `${(bajt / (1024 * 1024)).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bajt / 1024))} KB`;
}

function kepBetoltese(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function kepTomoritese(file) {
  if (!file?.type?.startsWith("image/") || file.type === "image/gif" || file.size <= TOMORITES_KUSZOB_BAJT) {
    return file;
  }
  try {
    const kep = await kepBetoltese(file);
    const arany = Math.min(1, MAX_KEP_OLDAL / Math.max(kep.width, kep.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(kep.width * arany);
    canvas.height = Math.round(kep.height * arany);
    canvas.getContext("2d").drawImage(kep, 0, 0, canvas.width, canvas.height);
    if (typeof kep.close === "function") kep.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.75));
    if (!blob || blob.size >= file.size) return file;
    const nev = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nev, { type: "image/jpeg", lastModified: Date.now() });
  } catch (e) {
    return file;
  }
}

export async function elokeszitFeltoltesre(file) {
  const kesz = await kepTomoritese(file);
  if (kesz.size > MAX_FELTOLTES_BAJT) {
    return {
      file: kesz,
      hiba: `${file.name || "A fájl"} túl nagy (${meretSzoveg(kesz.size)}). Legfeljebb ${meretSzoveg(MAX_FELTOLTES_BAJT)} tölthető fel.`,
    };
  }
  return { file: kesz, hiba: null };
}
