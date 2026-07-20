import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiTruckLight,
  PiTruckTrailerLight,
  PiSignOutLight,
  PiIdentificationCardLight,
  PiHouseLineLight,
  PiCakeLight,
  PiPhoneLight,
  PiEnvelopeLight,
  PiMapPinLight,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import MobileHeader from "components/UI/MobileHeader.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import StatusBadge from "components/UI/StatusBadge.js";
import SaveButton from "components/UI/SaveButton.js";
import Spinner from "components/UI/Spinner.js";
import WebAuthnRegisztracio from "components/UI/WebAuthnRegisztracio.js";
import {
  DOCUMENT_FIELDS,
  getDocumentStatus,
  getDocumentTone,
  daysUntil,
} from "utils/documentStatus.js";

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "S";

export default function Profil() {
  const history = useHistory();
  const [form, setForm] = useState(null);
  const [kamion, setKamion] = useState(null);
  const [potkocsi, setPotkocsi] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
      history.push("/auth/login");
      return;
    }
    setForm(user);

    if (user.kamion) {
      fetchAction("getKamionok", { id: user.admin }).then((result) => {
        if (result?.success) {
          setKamion(
            (result.kamionok || []).find(
              (k) => String(k.id) === String(user.kamion),
            ) || null,
          );
        }
      });
    }
    if (user.aktiv_potkocsi) {
      fetchAction("getPotkocsik", { id: user.admin }).then((result) => {
        if (result?.success) {
          setPotkocsi(
            (result.potkocsik || []).find(
              (p) => String(p.id) === String(user.aktiv_potkocsi),
            ) || null,
          );
        }
      });
    }
  }, [history]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Gyors, kliens oldali visszajelzés — a mentés gomb `type="button"` (ld.
  // SaveButton.js), az űrlap `onSubmit`-ja pedig le van tiltva, tehát az
  // `<input type="email">` böngésző-natív formátum-ellenőrzése SOHA nem
  // fut le magától; enélkül a felhasználó csak egy szerver-kör után
  // (a backend `validation()`-je) tudta meg, hogy hibás a cím. Ugyanaz a
  // szabály, mint szerver oldalon: csak akkor vizsgáljuk, ha van megadott
  // érték — az üres email cím megengedett.
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSave = async () => {
    if (form.email && !isValidEmail(form.email)) {
      toast.error("Érvénytelen email cím formátum.");
      return;
    }
    setSaving(true);
    try {
      const result = await fetchAction("saveSoforData", {
        ...form,
        id: form.id,
      });
      if (result?.success) {
        localStorage.setItem("user", JSON.stringify(form));
        toast.success("Adatok mentve!");
      } else {
        throw new Error(result?.message || "Mentés sikertelen.");
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const user = JSON.parse(localStorage.getItem("user"));
    await fetchAction("logoutUser", { id: user?.id });
    localStorage.removeItem("user");
    history.push("/auth/login");
  };

  if (!form) {
    return <Spinner wrapperClassName="flex justify-center py-24" />;
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      <MobileHeader title="Profil" back={false} />

      <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-lg font-bold text-white">
          {initials(form.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-base font-bold text-brand-900">
            {form.name}
          </p>
          <p className="truncate text-xs text-ink-500">{form.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <PiTruckLight className="h-4 w-4" /> Kamion
          </div>
          <p className="mt-1 font-mono text-sm font-bold text-ink-900">
            {kamion?.rendszam || "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-3.5 shadow-soft">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            <PiTruckTrailerLight className="h-4 w-4" /> Pótkocsi
          </div>
          <p className="mt-1 font-mono text-sm font-bold text-ink-900">
            {potkocsi?.rendszam || "—"}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          Dokumentumok lejárata
        </h2>
        <div className="flex flex-col gap-2">
          {DOCUMENT_FIELDS.map((field) => {
            const status = getDocumentStatus(form[field.key]);
            const days = daysUntil(form[field.key]);
            return (
              <div
                key={field.key}
                className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-3.5 py-2.5"
              >
                <span className="text-sm font-medium text-ink-700">
                  {field.label}
                </span>
                <StatusBadge tone={getDocumentTone(status)}>
                  {status === "unknown"
                    ? "Nincs megadva"
                    : status === "expired"
                      ? "Lejárt"
                      : status === "warning"
                        ? `${days} nap múlva lejár`
                        : "Érvényes"}
                </StatusBadge>
              </div>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-5"
      >
        <FormSection
          title="Felhasználó adatok"
          icon={PiIdentificationCardLight}
          columns={2}
          mobileColumns={2}
        >
          <FormField
            label="Név"
            name="name"
            value={form.name || ""}
            onChange={handleChange}
          />
          <FormField
            icon={PiEnvelopeLight}
            type="email"
            label="Email cím"
            name="email"
            value={form.email || ""}
            onChange={handleChange}
          />
          <FormField
            icon={PiPhoneLight}
            type="tel"
            label="Telefonszám"
            name="phone"
            value={form.phone || ""}
            onChange={handleChange}
          />
          <FormField
            icon={PiCakeLight}
            type="date"
            label="Születési dátum"
            name="szul_datum"
            value={form.szul_datum || ""}
            onChange={handleChange}
          />
        </FormSection>

        <FormSection title="Kapcsolat" icon={PiHouseLineLight} columns={2}>
          <FormField
            icon={PiMapPinLight}
            label="Város"
            name="varos"
            value={form.varos || ""}
            onChange={handleChange}
          />
          <FormField
            label="Irányítószám"
            inputMode="numeric"
            name="irsz"
            value={form.irsz || ""}
            onChange={handleChange}
          />
          <FormField
            label="Levelezési cím"
            name="cim"
            value={form.cim || ""}
            onChange={handleChange}
            className="md:col-span-2"
          />
          <FormField
            label="Állandó lakcím"
            name="lakcim"
            value={form.lakcim || ""}
            onChange={handleChange}
            className="md:col-span-2"
          />
        </FormSection>

        <FormSection
          title="Iratok"
          icon={PiIdentificationCardLight}
          columns={2}
          mobileColumns={2}
        >
          <FormField
            label="Személyi igazolvány szám"
            name="szemelyi"
            value={form.szemelyi || ""}
            onChange={handleChange}
          />
          <FormField
            type="date"
            label="Személyi lejárat"
            name="szemelyi_lejarat"
            value={form.szemelyi_lejarat || ""}
            onChange={handleChange}
          />
          <FormField
            type="date"
            label="Jogosítvány lejárat"
            name="jogsi_lejarat"
            value={form.jogsi_lejarat || ""}
            onChange={handleChange}
          />
          <FormField
            type="date"
            label="GKI lejárat"
            name="gki_lejarat"
            value={form.gki_lejarat || ""}
            onChange={handleChange}
          />
          <FormField
            type="date"
            label="ADR lejárat"
            name="adr_lejarat"
            value={form.adr_lejarat || ""}
            onChange={handleChange}
          />
        </FormSection>

        <SaveButton
          onClick={handleSave}
          isSaving={saving}
          className="w-full justify-center py-3.5"
        />
      </form>

      <WebAuthnRegisztracio />

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center justify-center gap-2 rounded-xl border border-red-100 py-3 text-sm font-semibold text-red-600"
      >
        <PiSignOutLight className="h-4 w-4" />
        Kijelentkezés
      </button>
    </div>
  );
}
