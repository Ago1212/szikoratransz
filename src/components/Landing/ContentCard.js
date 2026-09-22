import React from "react";
import { PiQuotesLight } from "react-icons/pi";

// Közös "elmélyülő" tartalom-kártya a szolgáltatás-oldalak (ServicePage.js)
// oldalspecifikus, hosszabb magyarázó szövegéhez (pl. "Hogyan alakul ki a
// belföldi fuvar ára?", "Hogyan zajlik a kárrendezés lépésről lépésre?").
// Visszajelzés (2026-09-21): ez a rész korábban egy sima <h2> + plain
// bekezdések volt, minden kártya-szerű keret nélkül — "nagyon nyers"-nek
// hatott a lap többi, kártyás/ikonos szekciójához képest. Ez a komponens
// ugyanazt a fehér kártya + halvány sarok-ikon motívumot adja, mint amit a
// hero jelvény-kártyája is használ, csak `accent`-tel oldalanként
// megkülönböztetve. A tényleges tartalmat (bekezdések, számozott lista stb.)
// a hívó adja `children`-ként — ez a komponens csak a keretet/fejlécet adja,
// nem ír elő fix struktúrát, mert az oldalak közt eltér (van, ahol számozott
// lista is van a bekezdések előtt, ld. BiztositottSzallitas.js).
export default function ContentCard({ heading, accent = "#1E3AA8", icon: Icon, children }) {
  const WatermarkIcon = Icon || PiQuotesLight;
  return (
    <section className="py-14 border-t border-[#23262B]/10">
      <div className="relative bg-white rounded-2xl border border-[#23262B]/10 shadow-sm overflow-hidden p-8 md:p-10">
        <WatermarkIcon
          aria-hidden="true"
          className="pointer-events-none select-none absolute -top-6 -right-6 text-[140px]"
          style={{ color: accent, opacity: 0.06 }}
        />
        <div
          className="absolute top-0 left-0 bottom-0 w-1"
          style={{ background: `linear-gradient(180deg, ${accent}, ${accent}00)` }}
        ></div>
        <h2 className="relative font-[Overpass] font-extrabold text-2xl text-[#23262B] mb-6">{heading}</h2>
        <div className="relative">{children}</div>
      </div>
    </section>
  );
}
