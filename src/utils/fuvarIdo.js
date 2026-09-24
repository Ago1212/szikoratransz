import { napokMaihoz } from "utils/formatDatum";

export function fuvarKezdoDatum(f) {
  const felrakas = napokMaihoz(f.felrakas_datuma);
  return felrakas !== null ? f.felrakas_datuma : napokMaihoz(f.lerakas_datuma) !== null ? f.lerakas_datuma : null;
}

function rendezoKulcs(f) {
  const d = fuvarKezdoDatum(f);
  return d ? String(d) : "9999-99-99";
}

export function rendezettAktivFuvarok(fuvarok) {
  return [...fuvarok].sort((a, b) => rendezoKulcs(a).localeCompare(rendezoKulcs(b)));
}

export function kovetkezoFuvar(fuvarok) {
  const rendezett = rendezettAktivFuvarok(fuvarok);
  const jovobeli = rendezett.find((f) => {
    const n = napokMaihoz(fuvarKezdoDatum(f));
    return n !== null && n >= 0;
  });
  return jovobeli || rendezett.filter((f) => fuvarKezdoDatum(f)).pop() || rendezett[0] || null;
}

const CSOPORTOK = [
  { kulcs: "lejart", cim: "Korábbi, még nyitott" },
  { kulcs: "ma", cim: "Ma" },
  { kulcs: "holnap", cim: "Holnap" },
  { kulcs: "het", cim: "A következő napokban" },
  { kulcs: "kesobb", cim: "Később" },
  { kulcs: "nincs", cim: "Dátum nélkül" },
];

function csoportKulcs(f) {
  const n = napokMaihoz(fuvarKezdoDatum(f));
  if (n === null) return "nincs";
  if (n < 0) return "lejart";
  if (n === 0) return "ma";
  if (n === 1) return "holnap";
  if (n <= 7) return "het";
  return "kesobb";
}

export function csoportositottFuvarok(fuvarok) {
  const rendezett = rendezettAktivFuvarok(fuvarok);
  return CSOPORTOK.map((cs) => ({ ...cs, fuvarok: rendezett.filter((f) => csoportKulcs(f) === cs.kulcs) })).filter(
    (cs) => cs.fuvarok.length > 0,
  );
}

export function utvonalUrl(f) {
  const honnan = [f.felrako_ceg, f.felrako_cim].filter(Boolean).join(", ");
  const hova = [f.lerako_ceg, f.lerako_cim].filter(Boolean).join(", ");
  if (!honnan || !hova) return null;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(honnan)}&destination=${encodeURIComponent(hova)}`;
}
