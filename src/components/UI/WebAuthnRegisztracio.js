import React, { useEffect, useState } from "react";
import { PiFingerprintLight } from "react-icons/pi";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";
import {
  b64urlToBuf,
  bufToB64url,
  setWebauthnEmail,
  clearWebauthnEmail,
  webauthnTamogatott,
} from "utils/webauthn.js";

// R52 (fejlesztési audit, 2026-07-19): a sofőr Profil oldalán él — csak
// EZEN az eszközön regisztrál egy platform-hitelesítőt (ujjlenyomat/
// arcfelismerés/PIN), a jelszavas belépés soha nem szűnik meg, ez csak egy
// gyorsabb, opcionális második út ugyanahhoz a fiókhoz.
export default function WebAuthnRegisztracio() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [regisztralva, setRegisztralva] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => {
    if (!webauthnTamogatott()) {
      setLoading(false);
      return;
    }
    fetchAction("getWebauthnStatusz", { kerelmezo_id: user?.id })
      .then((result) => setRegisztralva(!!result?.van))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRegisztracio = async () => {
    setBusy(true);
    try {
      const kihivas = await fetchAction("getWebauthnRegisztracioKihivas", {
        kerelmezo_id: user?.id,
        origin: window.location.origin,
      });
      if (!kihivas?.success) {
        toast.error(kihivas?.message || "A regisztráció előkészítése sikertelen.");
        return;
      }

      const opts = kihivas.options;
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: b64urlToBuf(opts.challenge),
          rp: opts.rp,
          user: {
            id: b64urlToBuf(opts.user.id),
            name: opts.user.name,
            displayName: opts.user.displayName,
          },
          pubKeyCredParams: opts.pubKeyCredParams,
          timeout: opts.timeout,
          attestation: opts.attestation,
          authenticatorSelection: opts.authenticatorSelection,
        },
      });

      const eredmeny = await fetchAction("verifyWebauthnRegisztracio", {
        kerelmezo_id: user?.id,
        token: kihivas.token,
        clientDataJSON: bufToB64url(credential.response.clientDataJSON),
        attestationObject: bufToB64url(credential.response.attestationObject),
      });

      if (eredmeny?.success) {
        setWebauthnEmail(user?.email);
        setRegisztralva(true);
        toast.success("Gyors-bejelentkezés bekapcsolva ezen az eszközön.");
      } else {
        toast.error(eredmeny?.message || "A regisztráció sikertelen.");
      }
    } catch (error) {
      console.error("WebAuthn regisztráció sikertelen:", error);
      toast.error("A regisztráció megszakadt vagy sikertelen volt.");
    } finally {
      setBusy(false);
    }
  };

  const handleLetiltas = async () => {
    setBusy(true);
    try {
      const eredmeny = await fetchAction("deleteWebauthnHitelesito", { kerelmezo_id: user?.id });
      if (eredmeny?.success) {
        clearWebauthnEmail();
        setRegisztralva(false);
        toast.success("Gyors-bejelentkezés kikapcsolva.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || !webauthnTamogatott()) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ink-100 bg-slate-50 p-4 dark:border-ink-800 dark:bg-ink-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <PiFingerprintLight className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-600" />
        <div>
          <p className="text-sm font-semibold text-ink-800 dark:text-ink-50">Gyors-bejelentkezés</p>
          <p className="text-xs text-ink-400">
            {regisztralva
              ? "Ezen az eszközön bekapcsolva — legközelebb ujjlenyomattal/arcfelismeréssel is beléphetsz, jelszó nélkül."
              : "Kapcsold be, hogy legközelebb ujjlenyomattal/arcfelismeréssel is be tudj lépni ezen az eszközön, jelszó beírása nélkül."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={regisztralva ? handleLetiltas : handleRegisztracio}
        disabled={busy}
        className={`flex flex-shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide shadow-soft transition-colors duration-200 disabled:cursor-wait disabled:opacity-60 ${
          regisztralva
            ? "border border-ink-200 bg-white text-ink-500 hover:bg-red-50 hover:text-red-600 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300"
            : "bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        {busy ? "Feldolgozás..." : regisztralva ? "Kikapcsolás" : "Bekapcsolás"}
      </button>
    </div>
  );
}
