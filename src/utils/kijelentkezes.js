import { fetchAction } from "utils/fetchAction";

async function pushLeiratkozas() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
  ]);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await fetchAction("deletePushFeliratkozas", { endpoint: subscription.endpoint }, { timeoutMs: 8000 });
  await subscription.unsubscribe();
}

export async function kijelentkezes() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  try {
    await pushLeiratkozas();
  } catch (e) {
    console.warn("Push-leiratkozás kijelentkezéskor sikertelen:", e);
  }
  await fetchAction("logoutUser", { id: user?.id }, { timeoutMs: 8000 });
  localStorage.removeItem("user");
  localStorage.removeItem("sessionToken");
}
