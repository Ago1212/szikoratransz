import React, { useEffect, useRef, useState } from "react";

// Egyszerű, függőségmentes "felbukkanó" animáció — akkor jelenik meg egy elem,
// amikor görgetés közben a képernyőre kerül. A `prefers-reduced-motion`
// beállítást tiszteletben tartja. Korábban csak a Landing.js-ben létezett
// (modul-szintű, nem exportált komponensként) — a long-tail szolgáltatás-
// oldalak (ServicePage.js) is ezt használják, hogy a főoldaléval egyező
// belépő-mozgást kapjanak, ne egy attól eltérő, statikusabb megjelenést.
export function Reveal({ children, delay = 0, className = "", variant = "fade" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // "pop" variant hozzáad egy finom scale + blur átmenetet is — erősebb
  // belépő hatást ad, mint az egyszerű fade+translate.
  const hidden =
    variant === "pop"
      ? "opacity-0 translate-y-6 scale-[0.96] blur-sm"
      : "opacity-0 translate-y-6";
  const shown =
    variant === "pop"
      ? "opacity-100 translate-y-0 scale-100 blur-0"
      : "opacity-100 translate-y-0";

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible ? shown : hidden
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default Reveal;
