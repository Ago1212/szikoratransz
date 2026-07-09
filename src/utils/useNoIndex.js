import { useEffect } from "react";

// A bejelentkezés mögötti alkalmazás-felületek (admin/user/profil) korábban
// szabadon indexelhetők voltak — nincs tartalmuk hitelesítés nélkül, így
// csak crawl-büdzsét pazaroltak és vékony/duplikált tartalomként jelentek
// meg minden route-on ugyanazzal az üres app-vázzal. Ez a hook minden ilyen
// layout gyökerén meghívva `noindex` meta taget szúr be.
export default function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);
}
