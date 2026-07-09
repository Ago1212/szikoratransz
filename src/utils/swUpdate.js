// Egyszerű, komponensfüggetlen pub-sub — jelzi, ha a service worker talált
// egy új, telepítésre kész verziót (`registration.waiting`). A
// `serviceWorkerRegistration.register({ onUpdate })` hívja meg innen
// (lásd src/index.js), az <UpdateBanner /> pedig feliratkozik rá.
const listeners = new Set();
let pendingRegistration = null;

export function subscribeSwUpdate(fn) {
  listeners.add(fn);
  if (pendingRegistration) fn(pendingRegistration);
  return () => listeners.delete(fn);
}

export function notifySwUpdate(registration) {
  pendingRegistration = registration;
  listeners.forEach((fn) => fn(registration));
}
