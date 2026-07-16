import { useEffect } from "react";

const SITE_URL = "https://szikora-transz.hu";

// A `public/index.html`-ben statikusan beégetett <title>/meta description/
// canonical a főoldalra ("/") van szabva. Ezt a hookot a szolgáltatás-
// specifikus long-tail oldalak (src/views/landing/*.js) használják, hogy
// mount-kor felülírják ezeket a saját, a route-ra jellemző értékeikkel, majd
// unmountkor visszaállítsák az eredetit — így az SPA-n belüli navigáció sosem
// hagy egy másik oldalról "ragadt" title/meta-t. A `scripts/prerender.js`
// egy valódi böngészőben futtatja le az oldalt, tehát ezek a DOM-mutációk a
// crawlerek felé kiszolgált statikus HTML-ben is megjelennek.
//
// `faqItems` (opcionális): [{q, a}, ...] — ha meg van adva, egy FAQPage
// JSON-LD <script> tag is bekerül a <head>-be, ugyanabban a formátumban,
// mint amit a Landing.js főoldal már használ a GYIK szekciójához.
export function useSeo({ title, description, path, faqItems }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const descTag = document.querySelector('meta[name="description"]');
    const prevDescription = descTag ? descTag.getAttribute("content") : null;
    if (descTag && description) {
      descTag.setAttribute("content", description);
    }

    const canonicalTag = document.querySelector('link[rel="canonical"]');
    const prevCanonical = canonicalTag ? canonicalTag.getAttribute("href") : null;
    if (canonicalTag && path) {
      canonicalTag.setAttribute("href", `${SITE_URL}${path}`);
    }

    let faqScript = null;
    if (faqItems && faqItems.length > 0) {
      faqScript = document.createElement("script");
      faqScript.type = "application/ld+json";
      faqScript.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      });
      document.head.appendChild(faqScript);
    }

    return () => {
      document.title = prevTitle;
      if (descTag && prevDescription !== null) {
        descTag.setAttribute("content", prevDescription);
      }
      if (canonicalTag && prevCanonical !== null) {
        canonicalTag.setAttribute("href", prevCanonical);
      }
      if (faqScript) {
        document.head.removeChild(faqScript);
      }
    };
  }, [title, description, path, faqItems]);
}
