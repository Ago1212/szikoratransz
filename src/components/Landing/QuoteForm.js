import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PiEnvelopeLight, PiClockLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";

const IRANY_OPTIONS = [
  { value: "belfoldi", label: "Belföldi" },
  { value: "nemzetkozi", label: "Nemzetközi" },
  { value: "nemtudom", label: "Még nem tudom" },
];

const IDOZITES_OPTIONS = [
  { value: "surgos", label: "Sürgős (napokon belül)" },
  { value: "nehany_het", label: "Pár héten belül" },
  { value: "tervezem", label: "Még csak tervezem" },
];

// A 2-4 opciós, egy-érintéses döntéseknél (irány, időzítés) szándékosan nem
// <select>: dropdown-nál a natív mobil-UI egy plusz megnyitó-kattintást
// igényelne, és nem látszik egyből az összes lehetőség — egy gombcsoport
// egy pillantásra és egy érintéssel kitölthető. Újra kattintva a már
// kiválasztott opcióra, az visszavonható (üres állapotba áll), mivel egyik
// mező sem kötelező.
function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? "" : opt.value)}
            className={`px-3.5 py-2 rounded-lg text-sm font-[Overpass] font-medium border transition-colors duration-200 ${
              selected
                ? "bg-[#1E3AA8] border-[#1E3AA8] text-white"
                : "bg-white/5 border-white/15 text-white/70 hover:border-white/30 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const INVALID_MESSAGES = {
  name: "Adja meg a teljes nevét.",
  phone: "Adjon meg egy érvényes telefonszámot.",
  email: "Adjon meg egy érvényes email címet.",
  leiras: "Írja le röviden, mit szállítanánk.",
  hozzajarulas: "Az adatkezelési hozzájárulás elfogadása szükséges a küldéshez.",
};

function handleInvalid(e) {
  e.target.setCustomValidity(INVALID_MESSAGES[e.target.name] || "");
}
function clearInvalid(e) {
  e.target.setCustomValidity("");
}

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  irany: "",
  honnan: "",
  hova: "",
  idozites: "",
  leiras: "",
  hozzajarulas: false,
};

// Az ajánlatkérő form kiemelve a Landing.js "Kapcsolat" szekciójából, hogy a
// szolgáltatás-specifikus long-tail oldalak (src/views/landing/*.js) is
// újrahasználhassák ugyanazt a komponenst és submit-logikát a főoldal
// mellett — egyetlen helyen tartva a `sendAjanlatkeres` hívást.
//
// A fuvar-részletek (irány/honnan/hová/időzítés) NEM külön backend-mezőként
// mennek el — a backend `sendAjanlatkeres` akciója (ld. backend/ApiHandler.php
// és backend/interface/emailInterface.php) csak name/email/phone/message
// paramétert ismer, és ezt egy már működő, élesben tesztelt e-mail-küldés és
// `ajanlatkeresek` DB-mentés használja. Új oszlopok/paraméterek helyett a
// kitöltött részletek egy tisztán formázott szöveg-blokká állnak össze, ami a
// szabad szöveges leírás elé kerül a `message` mezőben — így a sales csapat
// ugyanabban az e-mailben/admin-listában látja a strukturált adatot, a
// backend séma módosítása nélkül.
//
// A kártya háttere szándékosan `#2E3239` (nem a footer/globális `#23262B`
// ink) — ez ugyanaz az árnyalat, amit a Landing.js hero szekciójának
// "Kérjen árajánlatot még ma" kártyája használ, hogy a két signature
// ajánlatkérő-felület vizuálisan egységes, ugyanolyan "fekete" tónusú legyen.
export default function QuoteForm({
  title = "Kérje egyedi árajánlatát",
  subtitle = "Töltse ki az alábbi űrlapot — 24 órán belül személyre szabott árajánlattal válaszolunk, kötelezettség nélkül.",
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ success: null, message: "" });

  const handleChange = (e) => {
    clearInvalid(e);
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleConsentChange = (e) => {
    clearInvalid(e);
    setForm((prev) => ({ ...prev, hozzajarulas: e.target.checked }));
  };

  const composeMessage = () => {
    const irany = IRANY_OPTIONS.find((o) => o.value === form.irany)?.label;
    const idozites = IDOZITES_OPTIONS.find((o) => o.value === form.idozites)?.label;
    const details = [];
    if (irany) details.push(`Fuvar iránya: ${irany}`);
    if (form.honnan) details.push(`Honnan: ${form.honnan}`);
    if (form.hova) details.push(`Hová: ${form.hova}`);
    if (idozites) details.push(`Időzítés: ${idozites}`);
    return [details.join(" · "), form.leiras].filter(Boolean).join("\n\n");
  };

  const submitQuoteRequest = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ success: null, message: "" });

    const submittedName = form.name;
    const result = await fetchAction("sendAjanlatkeres", {
      name: form.name,
      email: form.email,
      phone: form.phone,
      message: composeMessage(),
    });

    if (result && result.success) {
      setSubmitStatus({
        success: true,
        message: `Köszönjük, ${submittedName}! Ajánlatkérését megkaptuk — 24 órán belül felvesszük Önnel a kapcsolatot telefonon vagy e-mailben.`,
      });
      setForm(EMPTY_FORM);
    } else {
      setSubmitStatus({
        success: false,
        message:
          result.message ||
          "Hiba történt a küldés közben. Kérjük, próbálja meg újra, vagy hívjon minket közvetlenül:",
      });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="bg-[#2E3239] rounded-xl overflow-hidden">
      <div className="p-8 md:p-10">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-white/10 text-white rounded-xl flex items-center justify-center flex-shrink-0">
            <PiEnvelopeLight className="text-lg" />
          </div>
          <h3 className="font-[Overpass] font-bold text-2xl text-white">{title}</h3>
        </div>
        <p className="text-white/50 mb-3">{subtitle}</p>
        <div className="inline-flex items-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#7C93FF] bg-[#2F4DE0]/15 px-3 py-1 rounded-full mb-8">
          <PiClockLight />
          Válasz 24 órán belül
        </div>

        {submitStatus.message && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm font-medium ${
              submitStatus.success
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {submitStatus.message}
            {submitStatus.success === false && (
              <>
                {" "}
                <a href="tel:+36308115776" className="underline font-semibold">
                  +36 30 811 5776
                </a>
              </>
            )}
          </div>
        )}

        <form onSubmit={submitQuoteRequest} noValidate={false}>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                Teljes név
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                onInvalid={handleInvalid}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                placeholder="Teljes név"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                  Telefonszám
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  onInvalid={handleInvalid}
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  placeholder="Telefonszám"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                  Email cím
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  onInvalid={handleInvalid}
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  placeholder="Email cím"
                  required
                />
              </div>
            </div>

            {/* Fuvar részletei — opcionális, alacsony-effort mezők: nem
                blokkolják a küldést, de pontosabb ajánlatot tesznek
                lehetővé. Ld. a form-koncepció 2.3-as pontját. */}
            <div className="pt-1 border-t border-white/10">
              <p className="text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mt-5 mb-3">
                Fuvar részletei <span className="normal-case text-white/30">— opcionális, segít pontosabb ajánlatot adni</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                    Belföldi vagy nemzetközi fuvar?
                  </label>
                  <PillGroup
                    options={IRANY_OPTIONS}
                    value={form.irany}
                    onChange={(v) => setForm((prev) => ({ ...prev, irany: v }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                      Honnan?
                    </label>
                    <input
                      type="text"
                      name="honnan"
                      value={form.honnan}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                      placeholder="pl. Budapest"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                      Hová?
                    </label>
                    <input
                      type="text"
                      name="hova"
                      value={form.hova}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                      placeholder="pl. München"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                    Mikorra lenne szükség rá?
                  </label>
                  <PillGroup
                    options={IDOZITES_OPTIONS}
                    value={form.idozites}
                    onChange={(v) => setForm((prev) => ({ ...prev, idozites: v }))}
                  />
                </div>
              </div>
            </div>

            <div className="pt-1 border-t border-white/10">
              <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2 mt-5">
                Mit és mennyit szállítanánk?
              </label>
              <textarea
                rows="4"
                name="leiras"
                value={form.leiras}
                onChange={handleChange}
                onInvalid={handleInvalid}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                placeholder="pl. 2 raklap gépalkatrész, kb. 800 kg"
                required
              ></textarea>
            </div>
          </div>

          <label className="flex items-start gap-3 mt-6 cursor-pointer">
            <input
              type="checkbox"
              name="hozzajarulas"
              checked={form.hozzajarulas}
              onChange={handleConsentChange}
              onInvalid={handleInvalid}
              required
              className="mt-1 w-4 h-4 flex-shrink-0 rounded border-white/30 bg-white/5 text-[#1E3AA8] focus:ring-[#2F4DE0]"
            />
            <span className="text-sm text-white/55">
              Elfogadom, hogy adataimat az ajánlatadás céljából kezeljék.{" "}
              <Link
                to="/adatvedelem"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-white/75 hover:text-white"
              >
                Adatvédelmi tájékoztató
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 px-6 py-4 bg-[#1E3AA8] hover:bg-[#172E86] text-white font-[Overpass] font-bold uppercase tracking-wide text-sm rounded-xl transition duration-300 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Küldés...
              </span>
            ) : (
              "Árajánlatot kérek"
            )}
          </button>
          <p className="text-center text-xs text-white/40 mt-3">
            Nem jár kötelezettséggel · Válasz 24 órán belül
          </p>
        </form>
      </div>
    </div>
  );
}
