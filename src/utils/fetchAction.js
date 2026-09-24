import { toast } from "utils/toast";

// A backend most már valódi, adatbázisban tárolt munkamenet-tokent kér
// (ld. ApiHandler::requireValidSession) minden akcióhoz a bejelentkezés/
// jelszó-visszaállítás kivételével — korábban a kliens bármilyen
// `kerelmezo_id`-t küldhetett, amit a szerver feltétel nélkül elhitt.
// Ha a szerver "lejárt munkamenet" hibát ad vissza, itt töröljük a helyi
// állapotot és kényszerítünk egy új bejelentkezést — enélkül a felület
// egy érvénytelen tokennel végtelenül "Sikertelen" hibákat mutatna anélkül,
// hogy a felhasználó tudná, mit kell tennie.
const SESSION_EXPIRED_MESSAGE = "A munkamenet lejárt, jelentkezz be újra.";
let utolsoKapcsolatiHiba = 0;

const KAPCSOLATI_HIBA_UZENET = "Nem sikerült kapcsolódni a szerverhez. Ellenőrizd az internetkapcsolatot, és próbáld újra.";
const IDOTULLEPES_UZENET = "A szerver nem válaszolt időben. Gyenge a térerő? Próbáld újra.";

function jelezKapcsolatiHibat(uzenet) {
  const most = Date.now();
  if (most - utolsoKapcsolatiHiba < 5000) return;
  utolsoKapcsolatiHiba = most;
  toast.error(uzenet);
}

function handleExpiredSession() {
  localStorage.removeItem("user");
  localStorage.removeItem("sessionToken");
  if (!window.location.pathname.startsWith("/auth")) {
    const vissza = window.location.pathname + window.location.search;
    window.location.assign(`/auth/login?lejart=1&vissza=${encodeURIComponent(vissza)}`);
  }
}

export const fetchAction = async (action, payload, { timeoutMs = 60000 } = {}) => {
  const authHash = "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD";
  //const modulename = "https://szikora-transz.hu/backend/api.php"; //http://localhost:8000/api.php
  const modulename =
    process.env.NODE_ENV === "development"
      ? "http://localhost:8000/api.php"
      : "https://szikora-transz.hu/backend/api.php";

  const controller = new AbortController();
  const idozito = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(modulename, {
      signal: controller.signal,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authHash}`,
      },
      body: JSON.stringify({
        authHash: authHash,
        sessionToken: localStorage.getItem("sessionToken") || "",
        action,
        ...payload,
      }),
    });

    const result = await response.json();
    // A validation()-ban dobott kivételek (ApiHandler.php process() külső
    // catch-ága) `{error: true, message: ...}` alakban jönnek vissza, NEM
    // `{success: false, ...}`-ként (az utóbbi minta csak az egyes akciók
    // saját, belső try/catch-eiből származik) — mindkét alakot figyelnünk
    // kell, különben a lejárt-munkamenet felismerés némán sosem sülne el.
    if (
      result?.message === SESSION_EXPIRED_MESSAGE &&
      (result?.error === true || result?.success === false)
    ) {
      handleExpiredSession();
    }
    return result;
  } catch (error) {
    console.error("Error fetching data:", error);
    const uzenet = error.name === "AbortError" ? IDOTULLEPES_UZENET : KAPCSOLATI_HIBA_UZENET;
    jelezKapcsolatiHibat(uzenet);
    return { success: false, message: uzenet, halozatiHiba: true };
  } finally {
    clearTimeout(idozito);
  }
};
