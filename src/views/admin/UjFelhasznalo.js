import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  PiArrowLeftLight,
  PiUserGearLight,
  PiIdentificationBadgeLight,
  PiSteeringWheelLight,
  PiCheckCircleFill,
} from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import PageHeader from "components/UI/PageHeader.js";
import PageCard from "components/UI/PageCard.js";
import FormField, { FormSection } from "components/UI/FormField.js";
import SaveButton from "components/UI/SaveButton.js";
import Spinner from "components/UI/Spinner.js";

// Egyetlen belépési pont minden új embernek — korábban a Csapat és a
// Sofőrök menüpont két külön, egymástól független formot mutatott.
// Itt a szerepkör-választás történik ELSŐKÉNT, ez dönti el, hogy a
// meglévő csapattag- vagy sofőr-létrehozó folyamat veszi-e át (ld. a
// felhasználókezelés-elemzés 08. pontját).
//
// A szerepkörök listája mostantól cégenként egyénileg bővíthető (ld.
// Jogosultsagok.js) — az 'admin' szerepkör mindig fix ikont kap, minden
// egyéb (egyénileg létrehozott) szerepkör ugyanazt az általános ikont
// használja, mivel a rendszer nem tud előre kitalálni hozzá egyedit.
const emptyForm = { name: "", email: "", phone: "", password: "" };

export default function UjFelhasznalo() {
  const history = useHistory();
  const user = JSON.parse(localStorage.getItem("user"));
  const [szerepkorok, setSzerepkorok] = useState([]);
  const [loadingSzerepkorok, setLoadingSzerepkorok] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAction("getSzerepkorok", { id: user.ceg_id }).then((result) => {
      if (result?.success) setSzerepkorok(result.szerepkorok || []);
      setLoadingSzerepkorok(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        kerelmezo_id: user.id,
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

  const roleInfo = szerepkorok.find((r) => r.kulcs === selectedRole);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <button
        type="button"
        onClick={() => (selectedRole ? setSelectedRole(null) : history.push("/admin/felhasznalok"))}
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors duration-200 ease-fluid hover:text-brand-700 dark:text-ink-400 dark:hover:text-brand-300"
      >
        <PiArrowLeftLight className="h-4 w-4" />
        {selectedRole ? "Vissza a szerepkör-választáshoz" : "Vissza a felhasználókhoz"}
      </button>

      {!selectedRole ? (
        <>
          <PageHeader eyebrow="Új felhasználó" title="Milyen szerepkörben dolgozik?" className="mb-6" />
          {loadingSzerepkorok ? (
            <Spinner wrapperClassName="flex justify-center py-16" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {szerepkorok.map((role) => {
                const Icon = role.kulcs === "admin" ? PiUserGearLight : PiIdentificationBadgeLight;
                return (
                  <button
                    key={role.kulcs}
                    type="button"
                    onClick={() => setSelectedRole(role.kulcs)}
                    className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-soft transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/40 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-ink-900 dark:text-ink-50">{role.nev}</span>
                      <span className="block text-xs text-ink-500 dark:text-ink-400">
                        {role.kulcs === "admin"
                          ? "Teljes hozzáférés minden menüponthoz."
                          : "A pontos hozzáférése a Jogosultságok oldalon állítható be."}
                      </span>
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={handleSelectSofor}
                className="flex items-start gap-3 rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-soft transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/40 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/30 sm:col-span-2"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <PiSteeringWheelLight className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-900 dark:text-ink-50">Sofőr</span>
                  <span className="block text-xs text-ink-500 dark:text-ink-400">
                    Saját mobil felület — jármű-hozzárendelés, bejelentések, dokumentum-lejáratok. A
                    meglévő sofőr-felvevő űrlapra visz tovább.
                  </span>
                </span>
              </button>
            </div>
          )}
        </>
      ) : (
        <PageCard icon={roleInfo?.kulcs === "admin" ? PiUserGearLight : PiIdentificationBadgeLight} title={`Új csapattag — ${roleInfo?.nev || selectedRole}`}>
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
              <p className="flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                <PiCheckCircleFill className="h-4 w-4 text-emerald-500" />
                A szerepkör bármikor módosítható a Felhasználók listáján.
              </p>
              <div className="flex justify-end border-t border-ink-100 pt-4 dark:border-ink-800">
                <SaveButton onClick={handleSave} isSaving={isSaving} label="Meghívás" />
              </div>
            </form>
          </div>
        </PageCard>
      )}
    </div>
  );
}
