import React, { useEffect, useState } from "react";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import {
  PiUserLight,
  PiEnvelopeSimpleLight,
  PiPhoneLight,
  PiCakeLight,
  PiIdentificationCardLight,
  PiBuildingsLight,
  PiMailboxLight,
  PiHouseLineLight,
  PiCarLight,
  PiShieldCheckLight,
  PiTruckLight,
  PiIdentificationBadgeLight,
} from "react-icons/pi";
import PageCard from "components/UI/PageCard.js";
import SaveButton from "components/UI/SaveButton.js";
import FormField, { FormSection } from "components/UI/FormField.js";

export default function CardSettings() {
  const storedUserData = sessionStorage.getItem("user");
  const initialUserData = storedUserData ? JSON.parse(storedUserData) : {};
  const [userData, setUserData] = useState(initialUserData);
  const [isSaving, setIsSaving] = useState(false);
  // A szerepkörök cégenként egyénileg bővíthetők (ld. Jogosultsagok.js) —
  // a megjelenítendő nevet ezért a cég szerepkör-listájából kell kikeresni,
  // nem egy fix, kódba égetett címke-térképből.
  const [szerepkorNev, setSzerepkorNev] = useState(
    initialUserData.szerepkor === "admin" ? "Adminisztrátor" : initialUserData.szerepkor || ""
  );

  useEffect(() => {
    if (!initialUserData.ceg_id) return;
    fetchAction("getSzerepkorok", { id: initialUserData.ceg_id }).then((result) => {
      if (result?.success) {
        const talalt = (result.szerepkorok || []).find((r) => r.kulcs === initialUserData.szerepkor);
        if (talalt) setSzerepkorNev(talalt.nev);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await fetchAction("saveAdminData", {
        id: userData.id,
        ...userData,
      });

      if (result?.success) {
        sessionStorage.setItem("user", JSON.stringify(result.user));
        toast.success("Adatok sikeresen mentve!");
      } else {
        throw new Error(result?.message || "Mentés sikertelen");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageCard icon={PiUserLight} title="Saját adatok">
      <div className="px-4 py-6 lg:px-10 lg:py-10">
        <div className="space-y-5">
          <FormSection id="felhasznalo-adatok" title="Felhasználó adatok" columns={4}>
            <FormField
              icon={PiUserLight}
              label="Név"
              name="name"
              value={userData.name || ""}
              onChange={handleInputChange}
              className="md:col-span-2"
            />
            <FormField
              icon={PiEnvelopeSimpleLight}
              label="Email cím"
              type="email"
              name="email"
              value={userData.email || ""}
              onChange={handleInputChange}
              className="md:col-span-2"
            />
            <FormField
              icon={PiPhoneLight}
              label="Telefonszám"
              type="tel"
              name="phone"
              value={userData.phone || ""}
              onChange={handleInputChange}
            />
            <FormField
              as="info"
              icon={PiIdentificationBadgeLight}
              label="Szerepkör"
              value={szerepkorNev}
            />
            <FormField
              icon={PiCakeLight}
              label="Születési dátum"
              type="date"
              name="szul_datum"
              value={userData.szul_datum || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiIdentificationCardLight}
              label="Személyigazolvány szám"
              name="szemelyi"
              value={userData.szemelyi || ""}
              onChange={handleInputChange}
            />
          </FormSection>
          <p className="-mt-2 text-xs text-ink-400">
            A szerepkör itt csak megtekinthető — módosítani a Felhasználók listáján lehet.
          </p>

          <FormSection id="kapcsolat" title="Kapcsolat" columns={3}>
            <FormField
              icon={PiBuildingsLight}
              label="Város"
              name="varos"
              value={userData.varos || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiMailboxLight}
              label="IRSZ"
              inputMode="numeric"
              name="irsz"
              value={userData.irsz || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiHouseLineLight}
              label="Cím"
              name="cim"
              value={userData.cim || ""}
              onChange={handleInputChange}
            />
          </FormSection>

          <FormSection id="iratok" title="Iratok" columns={4}>
            <FormField
              icon={PiIdentificationCardLight}
              label="Személyigazolvány lejárat"
              type="date"
              name="szemelyi_lejarat"
              value={userData.szemelyi_lejarat || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiCarLight}
              label="Jogosítvány lejárat"
              type="date"
              name="jogsi_lejarat"
              value={userData.jogsi_lejarat || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiShieldCheckLight}
              label="GKI lejárat"
              type="date"
              name="gki_lejarat"
              value={userData.gki_lejarat || ""}
              onChange={handleInputChange}
            />
            <FormField
              icon={PiTruckLight}
              label="ADR lejárat"
              type="date"
              name="adr_lejarat"
              value={userData.adr_lejarat || ""}
              onChange={handleInputChange}
            />
          </FormSection>

          <div className="flex justify-end border-t border-ink-100 pt-4">
            <SaveButton onClick={handleSave} isSaving={isSaving} />
          </div>
        </div>
      </div>
    </PageCard>
  );
}
