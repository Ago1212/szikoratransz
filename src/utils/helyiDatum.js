export function helyiDatum(d = new Date()) {
  const ev = d.getFullYear();
  const ho = String(d.getMonth() + 1).padStart(2, "0");
  const nap = String(d.getDate()).padStart(2, "0");
  return `${ev}-${ho}-${nap}`;
}
