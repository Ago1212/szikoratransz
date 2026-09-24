import { useEffect, useState } from "react";

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  useEffect(() => {
    const be = () => setOnline(true);
    const ki = () => setOnline(false);
    window.addEventListener("online", be);
    window.addEventListener("offline", ki);
    return () => {
      window.removeEventListener("online", be);
      window.removeEventListener("offline", ki);
    };
  }, []);
  return online;
}
