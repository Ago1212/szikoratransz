import React from "react";
import { PiTruckLight } from "react-icons/pi";

// Közös "útvonal" motívum-elválasztó — szaggatott vonal + kamion-ikonos
// medál a közepén, ugyanaz a vizuális nyelv, mint a Landing.js hero/services
// szekciói között. Korábban csak a Landing.js-ben létezett (modul-szintű,
// nem exportált függvényként) — a long-tail szolgáltatás-oldalak
// (ServicePage.js) redesignja innentől ugyanezt használja, hogy azok az
// oldalak is a főoldaléval egyező, felismerhető céges motívumot kapjanak.
export default function RouteDivider({ dark = false }) {
  return (
    <div className="relative max-w-5xl mx-auto px-4 py-2">
      <div
        className={`absolute left-4 right-4 top-1/2 border-t-2 border-dashed ${
          dark ? "border-white/10" : "border-[#23262B]/10"
        }`}
      ></div>
      <div className="relative flex justify-center">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center border ${
            dark
              ? "bg-[#23262B] border-white/10"
              : "bg-[#F2F3F5] border-[#23262B]/10"
          }`}
        >
          <PiTruckLight className="text-xs text-[#1E3AA8]" />
        </div>
      </div>
    </div>
  );
}
