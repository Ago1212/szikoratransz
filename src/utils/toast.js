// Egyszerű, komponensfüggetlen toast-értesítő rendszer — a fetchAction
// hívásokat kezelő komponensek (form mentés, törlés, feltöltés stb.) eddig
// böngésző-natív `alert()`-tel jelezték a sikert/hibát; ehelyett ez a
// modul importálható bárhonnan (`import { toast } from "utils/toast"`),
// egyetlen közös <ToastContainer /> pedig a lap gyökerén (src/index.js)
// rajzolja ki a bejövő üzeneteket.
let idCounter = 0;
const listeners = new Set();

export function subscribeToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(type, message) {
  if (!message) return;
  listeners.forEach((fn) => fn({ id: ++idCounter, type, message }));
}

export const toast = {
  success: (message) => emit("success", message),
  error: (message) => emit("error", message),
};
