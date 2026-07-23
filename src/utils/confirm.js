// UX-audit — a törlés-megerősítés eddig mindenhol a böngésző natív
// `window.confirm()`-jét használta: stílozhatatlan, sötét módban a
// rendszer-témától függ, nem az appétól, és csak generikus szöveget bír
// megjeleníteni. Ugyanaz a pub/sub minta, mint a `utils/toast.js`-ben — egy
// egyetlen, a Router gyökerén mountolt <ConfirmDialogContainer /> (ld.
// src/index.js) rajzolja ki a tényleges, márkázott (Modal-alapú) dialógust.
let listener = null;

export function subscribeConfirm(fn) {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

// `confirm(message, options)` — Promise<boolean>, ugyanúgy hívható, mint a
// natív `window.confirm()`, csak awaitolható. `options.title`,
// `options.confirmLabel`, `options.danger` (alapból true — a leggyakoribb
// hívás törlés-megerősítés).
export function confirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    if (!listener) {
      // Védekező visszaesés, ha valamiért nincs mountolva a container
      // (pl. egy jövőbeli, a Routertől független belépési pont) — inkább a
      // natív dialógus, mint hogy a törlés-folyamat némán ne csináljon semmit.
      resolve(window.confirm(message));
      return;
    }
    listener({ message, danger: true, ...options, resolve });
  });
}
