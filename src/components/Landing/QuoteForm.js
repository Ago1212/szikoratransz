import React, { useState } from "react";
import { Link } from "react-router-dom";
import { PiEnvelopeLight, PiClockLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { useTranslation, localizePath } from "i18n/index.js";

// A `composeMessage()` admin felé menő szabad szöveg-blokkja MINDIG magyarul
// megy ki, függetlenül a látogató által választott UI-nyelvtől (ld. a design
// dokumentum "Explicit döntés" pontja) — ezért ez a két map külön, nem
// fordított marad, elkülönítve a lenti, UI-nak szánt `iranyOptions`/
// `idozitesOptions`-tól (amik a komponensben, `t()`-vel épülnek fel).
const IRANY_LABELS_HU = {
  belfoldi: "Belföldi",
  nemzetkozi: "Nemzetközi",
  nemtudom: "Még nem tudom",
};

const IDOZITES_LABELS_HU = {
  surgos: "Sürgős (napokon belül)",
  nehany_het: "Pár héten belül",
  tervezem: "Még csak tervezem",
};

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
export default function QuoteForm({ title, subtitle }) {
  const { t, locale } = useTranslation();
  const resolvedTitle = title || t("quoteForm.defaultTitle");
  const resolvedSubtitle = subtitle || t("quoteForm.defaultSubtitle");

  const invalidMessages = {
    name: t("quoteForm.invalid.name"),
    phone: t("quoteForm.invalid.phone"),
    email: t("quoteForm.invalid.email"),
    leiras: t("quoteForm.invalid.description"),
    hozzajarulas: t("quoteForm.invalid.consent"),
  };
  const handleInvalid = (e) => {
    e.target.setCustomValidity(invalidMessages[e.target.name] || "");
  };
  const clearInvalid = (e) => {
    e.target.setCustomValidity("");
  };

  const iranyOptions = [
    { value: "belfoldi", label: t("quoteForm.directionOptions.domestic") },
    { value: "nemzetkozi", label: t("quoteForm.directionOptions.international") },
    { value: "nemtudom", label: t("quoteForm.directionOptions.unsure") },
  ];
  const idozitesOptions = [
    { value: "surgos", label: t("quoteForm.timingOptions.urgent") },
    { value: "nehany_het", label: t("quoteForm.timingOptions.fewWeeks") },
    { value: "tervezem", label: t("quoteForm.timingOptions.justPlanning") },
  ];

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

  // Mindig magyarul megy ki, függetlenül a UI nyelvétől — ld. a fájl
  // tetején lévő megjegyzést.
  const composeMessage = () => {
    const irany = IRANY_LABELS_HU[form.irany];
    const idozites = IDOZITES_LABELS_HU[form.idozites];
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
        message: t("quoteForm.successMessage").replace("{name}", submittedName),
      });
      setForm(EMPTY_FORM);
    } else {
      setSubmitStatus({
        success: false,
        message: result.message || t("quoteForm.errorFallback"),
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
          <h3 className="font-[Overpass] font-bold text-2xl text-white">{resolvedTitle}</h3>
        </div>
        <p className="text-white/50 mb-3">{resolvedSubtitle}</p>
        <div className="inline-flex items-center gap-1.5 text-xs font-[Overpass_Mono] uppercase tracking-wide text-[#7C93FF] bg-[#2F4DE0]/15 px-3 py-1 rounded-full mb-8">
          <PiClockLight />
          {t("quoteForm.responseBadge")}
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
                {t("quoteForm.labels.name")}
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                onInvalid={handleInvalid}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                placeholder={t("quoteForm.placeholders.name")}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                  {t("quoteForm.labels.phone")}
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  onInvalid={handleInvalid}
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  placeholder={t("quoteForm.placeholders.phone")}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                  {t("quoteForm.labels.email")}
                </label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  onInvalid={handleInvalid}
                  className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                  placeholder={t("quoteForm.placeholders.email")}
                  required
                />
              </div>
            </div>

            {/* Fuvar részletei — opcionális, alacsony-effort mezők: nem
                blokkolják a küldést, de pontosabb ajánlatot tesznek
                lehetővé. Ld. a form-koncepció 2.3-as pontját. */}
            <div className="pt-1 border-t border-white/10">
              <p className="text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/40 mt-5 mb-3">
                {t("quoteForm.labels.shipmentDetailsHeading")}{" "}
                <span className="normal-case text-white/30">{t("quoteForm.labels.shipmentDetailsHint")}</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                    {t("quoteForm.labels.direction")}
                  </label>
                  <PillGroup
                    options={iranyOptions}
                    value={form.irany}
                    onChange={(v) => setForm((prev) => ({ ...prev, irany: v }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                      {t("quoteForm.labels.from")}
                    </label>
                    <input
                      type="text"
                      name="honnan"
                      value={form.honnan}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                      placeholder={t("quoteForm.placeholders.from")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                      {t("quoteForm.labels.to")}
                    </label>
                    <input
                      type="text"
                      name="hova"
                      value={form.hova}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                      placeholder={t("quoteForm.placeholders.to")}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2">
                    {t("quoteForm.labels.timing")}
                  </label>
                  <PillGroup
                    options={idozitesOptions}
                    value={form.idozites}
                    onChange={(v) => setForm((prev) => ({ ...prev, idozites: v }))}
                  />
                </div>
              </div>
            </div>

            <div className="pt-1 border-t border-white/10">
              <label className="block text-xs font-[Overpass_Mono] uppercase tracking-wide text-white/55 mb-2 mt-5">
                {t("quoteForm.labels.description")}
              </label>
              <textarea
                rows="4"
                name="leiras"
                value={form.leiras}
                onChange={handleChange}
                onInvalid={handleInvalid}
                className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#2F4DE0] focus:border-[#2F4DE0] transition duration-300"
                placeholder={t("quoteForm.placeholders.description")}
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
              {t("quoteForm.labels.consentPrefix")}{" "}
              <Link
                to={localizePath("/adatvedelem", locale)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-white/75 hover:text-white"
              >
                {t("quoteForm.labels.consentLinkText")}
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
                {t("quoteForm.labels.submitLoading")}
              </span>
            ) : (
              t("quoteForm.labels.submit")
            )}
          </button>
          <p className="text-center text-xs text-white/40 mt-3">{t("quoteForm.labels.footnote")}</p>
        </form>
      </div>
    </div>
  );
}
