import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiArrowLeftLight,
  PiUserGearLight,
  PiMapTrifoldLight,
  PiSteeringWheelLight,
  PiCheckCircleFill,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import PageCard from "components/UI/PageCard.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";

// Egyetlen belépési pont minden új embernek — korábban a Csapat és a
// Sofőrök menüpont két külön, egymástól független formot mutatott.
// Itt a szerepkör-választás történik ELSŐKÉNT, ez dönti el, hogy a
// meglévő csapattag- vagy sofőr-létrehozó folyamat veszi-e át (ld. a
// felhasználókezelés-elemzés 08. pontját).
const ROLES = [
  { key: "admin", label: "Adminisztrátor", desc: "Teljes hozzáférés minden menüponthoz.", icon: PiUserGearLight },
  { key: "fuvarszervezo", label: "Fuvarszervező", desc: "Csapattag — ma ugyanaz a hozzáférése, mint az adminnak.", icon: PiMapTrifoldLight },
];

const emptyForm = { name: "", email: "", phone: "", password: "" };

export default function UjFelhasznalo() {
  const history = useHistory();
  const user = JSON.parse(sessionStorage.getItem("user"));
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelectSofor = () => {
    history.push("/admin/soforForm", { data: {} });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const result = await fetchAction("newCsapattag", {
        ceg_id: user.ceg_id,
        szerepkor: selectedRole,
        ...form,
      });
      if (result?.success) {
        toast.success("Csapattag meghívva.");
        history.push("/admin/felhasznalok");
      } else {
        toast.error(result?.message || "Meghívás sikertelen.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const roleInfo = ROLES.find((r) => r.key === selectedRole);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <button
        type="button"
        onClick={() => (selectedRole ? setSelectedRole(null) : history.push("/admin/felhasznalok"))}
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors duration-200 ease-fluid hover:text-brand-700"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        {selectedRole ? "Vissza a szerepkör-választáshoz" : "Vissza a felhasználókhoz"}
      </button>

      {!selectedRole ? (
        <>
          <PageHeader eyebrow="Új felhasználó" title="Milyen szerepkörben dolgozik?" className="mb-6" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ROLES.map((role) => (
              <button
                key={role.key}
                type="button"
                onClick={() => setSelectedRole(role.key)}
                className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-soft transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <role.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900">{role.label}</span>
                  <span className="block text-xs text-ink-500">{role.desc}</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleSelectSofor}
              className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-soft transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/40 sm:col-span-2"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <PiSteeringWheelLight className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink-900">Sofőr</span>
                <span className="block text-xs text-ink-500">
                  Saját mobil felület — jármű-hozzárendelés, bejelentések, dokumentum-lejáratok. A
                  meglévő sofőr-felvevő űrlapra visz tovább.
                </span>
              </span>
            </button>
          </div>
        </>
      ) : (
        <PageCard icon={roleInfo.icon} title={`Új csapattag — ${roleInfo.label}`}>
          <div className="px-4 py-4 lg:px-6">
            <form onSubmit={handleSave} className="space-y-5">
              <FormSection columns={2}>
                <FormField
                  label="Név"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="md:col-span-2"
                />
                <FormField
                  type="email"
                  label="Email cím"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
                <FormField type="tel" label="Telefonszám" name="phone" value={form.phone} onChange={handleChange} />
                <FormField
                  type="password"
                  label="Jelszó"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className="md:col-span-2"
                />
              </FormSection>
              <p className="flex items-center gap-1.5 text-xs text-ink-500">
                <PiCheckCircleFill className="h-4 w-4 text-emerald-500" />
                A szerepkör bármikor módosítható a Felhasználók listáján.
              </p>
              <div className="flex justify-end border-t border-ink-100 pt-4">
                <SaveButton onClick={handleSave} isSaving={isSaving} label="Meghívás" />
              </div>
            </form>
          </div>
        </PageCard>
      )}
    </div>
  );
}
