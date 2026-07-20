import React, { useState } from "react";
import { fetchAction } from "utils/fetchAction";
import { b64urlToBuf, bufToB64url, getWebauthnEmail, clearWebauthnEmail, webauthnTamogatott } from "utils/webauthn.js";

// R52 (fejlesztési audit, 2026-07-19): csak akkor jelenik meg, ha ezen a
// konkrét eszközön korábban már regisztráltak WebAuthn-hitelesítőt (ld.
// WebAuthnRegisztracio.js a Profil oldalon) — más eszközön/böngészőben ez
// a gomb nem látszik, ott a sofőr a megszokott jelszavas űrlapot használja.
export default function WebAuthnQuickLogin({ onSuccess, onError }) {
  const [busy, setBusy] = useState(false);
  const email = getWebauthnEmail();

  if (!email || !webauthnTamogatott()) return null;

  const handleClick = async () => {
    setBusy(true);
    try {
      const kihivas = await fetchAction("getWebauthnBejelentkezesKihivas", {
        email,
        origin: window.location.origin,
      });
      if (!kihivas?.success) {
        clearWebauthnEmail();
        onError(kihivas?.message || "A gyors-bejelentkezés nem elérhető ezen az eszközön — jelentkezz be jelszóval.");
        return;
      }

      const opts = kihivas.options;
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: b64urlToBuf(opts.challenge),
          rpId: opts.rpId,
          allowCredentials: opts.allowCredentials.map((c) => ({ id: b64urlToBuf(c.id), type: c.type })),
          timeout: opts.timeout,
          userVerification: opts.userVerification,
        },
      });

      const eredmeny = await fetchAction("verifyWebauthnBejelentkezes", {
        token: kihivas.token,
        clientDataJSON: bufToB64url(credential.response.clientDataJSON),
        authenticatorData: bufToB64url(credential.response.authenticatorData),
        signature: bufToB64url(credential.response.signature),
      });

      if (eredmeny?.success) {
        onSuccess(eredmeny);
      } else {
        onError(eredmeny?.message || "A gyors-bejelentkezés sikertelen.");
      }
    } catch (error) {
      // Idesorolható a felhasználó által megszakított (Escape/Mégse) kérés
      // is — ez nem hiba, csak nem folytatta, ezért itt nem írunk ki piros
      // hibaüzenetet, csak csendben visszaengedjük a jelszavas űrlapra.
      console.warn("WebAuthn gyors-bejelentkezés megszakítva/sikertelen:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-[Overpass] text-sm font-semibold text-white transition-all duration-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 11c0-3.87 3.13-7 7-7s7 3.13 7 7M4 15v-4c0-4.42 3.58-8 8-8s8 3.58 8 8v4M9 21c-1.1-1.4-1.5-3-1.5-6M15 21c1.1-1.4 1.5-3 1.5-6M12 9v6M12 17.5c-2.5 0-3.5-1.5-3.5-4.5"
          transform="scale(0.6) translate(8,4)"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3a4 4 0 0 0-4 4v1m8 0V7a4 4 0 0 0-4-4m-6 8c0 4.5 1 8 3 10m9-10c0 4.5-1 8-3 10M9 11v2c0 2 .5 3.5 1.5 5M14.5 11v2c0 2-.5 3.5-1.5 5"
        />
      </svg>
      {busy ? "Ellenőrzés..." : "Bejelentkezés ujjlenyomattal / arcfelismeréssel"}
    </button>
  );
}
