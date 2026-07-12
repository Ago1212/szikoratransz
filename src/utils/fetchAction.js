// A backend most már valódi, adatbázisban tárolt munkamenet-tokent kér
// (ld. ApiHandler::requireValidSession) minden akcióhoz a bejelentkezés/
// jelszó-visszaállítás kivételével — korábban a kliens bármilyen
// `kerelmezo_id`-t küldhetett, amit a szerver feltétel nélkül elhitt.
// Ha a szerver "lejárt munkamenet" hibát ad vissza, itt töröljük a helyi
// állapotot és kényszerítünk egy új bejelentkezést — enélkül a felület
// egy érvénytelen tokennel végtelenül "Sikertelen" hibákat mutatna anélkül,
// hogy a felhasználó tudná, mit kell tennie.
const SESSION_EXPIRED_MESSAGE = "A munkamenet lejárt, jelentkezz be újra.";

function handleExpiredSession() {
  sessionStorage.removeItem("user");
  sessionStorage.removeItem("sessionToken");
  if (!window.location.pathname.startsWith("/auth")) {
    window.location.assign("/auth/login");
  }
}

export const fetchAction = async (action, payload) => {
  const authHash = "nIrINP&o!PU|+pM*Q8'j1R07U57W,qD";
  //const modulename = "https://szikora-transz.hu/backend/api.php"; //http://localhost:8000/api.php
  const modulename =
    process.env.NODE_ENV === "development"
      ? "http://localhost:8001/api.php"
      : "https://szikora-transz.hu/backend/api.php";

  try {
    const response = await fetch(modulename, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authHash}`,
      },
      body: JSON.stringify({
        authHash: authHash,
        sessionToken: sessionStorage.getItem("sessionToken") || "",
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
    if (result?.message === SESSION_EXPIRED_MESSAGE && (result?.error === true || result?.success === false)) {
      handleExpiredSession();
    }
    return result;
  } catch (error) {
    console.error("Error fetching data:", error);
    return { success: false, message: error.message };
  }
};
