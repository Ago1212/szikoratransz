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
//
// `breadcrumb` (opcionális): [{name, path}, ...] — a Főoldal automatikusan az
// első elem, ezt nem kell megadni. Egy BreadcrumbList JSON-LD-t épít, ami a
// jelenlegi (JS-futtatás utáni) állapotban segíti a keresőmotorokat az oldal
// hierarchiájának megértésében.
//
// `service` (opcionális): { name, description } — ha meg van adva, egy Service
// JSON-LD-t injektál, ami a `provider`-t a `public/index.html`-ben beégetett
// LocalBusiness entitáshoz köti (`@id` hivatkozással). Ez explicitebb
// szolgáltatás↔cég kapcsolatot ad a kereséseknek/AI-motoroknak, mint az önmagában
// álló LocalBusiness séma.
export function useSeo({ title, description, path, faqItems, breadcrumb, service, lang, alternates }) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) {
      document.title = title;
    }

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

    const prevLang = document.documentElement.lang;
    if (lang) {
      document.documentElement.lang = lang;
    }

    const hreflangTags = [];
    if (alternates && alternates.hu && alternates.en) {
      [
        { hreflang: "hu", href: alternates.hu },
        { hreflang: "en", href: alternates.en },
        { hreflang: "x-default", href: alternates.hu },
      ].forEach(({ hreflang, href }) => {
        const tag = document.createElement("link");
        tag.setAttribute("rel", "alternate");
        tag.setAttribute("hreflang", hreflang);
        tag.setAttribute("href", `${SITE_URL}${href}`);
        document.head.appendChild(tag);
        hreflangTags.push(tag);
      });
    }

    // Az og:*/twitter:* tagek (kép kivételével — arra nincs oldalanként
    // egyedi kép) a `public/index.html`-ben ugyanúgy csak a főoldalra vannak
    // beégetve, mint a title/description/canonical fent — enélkül egy
    // szolgáltatás-oldal linkjének közösségimédia-megosztása mindig a
    // főoldal címét/leírását mutatta, sose a ténylegesen megosztott oldalét.
    const metaSyncs = [
      ['meta[property="og:title"]', "content", title],
      ['meta[property="og:description"]', "content", description],
      ['meta[property="og:url"]', "content", path ? `${SITE_URL}${path}` : null],
      ['meta[name="twitter:title"]', "content", title],
      ['meta[name="twitter:description"]', "content", description],
    ]
      .filter(([, , value]) => value)
      .map(([selector, attr, value]) => {
        const tag = document.querySelector(selector);
        const prevValue = tag ? tag.getAttribute(attr) : null;
        if (tag) tag.setAttribute(attr, value);
        return { tag, attr, prevValue };
      });

    let faqScript = null;
    if (faqItems && faqItems.length > 0) {
      faqScript = document.createElement("script");
      faqScript.type = "application/ld+json";
      faqScript.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        inLanguage: lang || "hu",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      });
      document.head.appendChild(faqScript);
    }

    let breadcrumbScript = null;
    if (breadcrumb && breadcrumb.length > 0) {
      breadcrumbScript = document.createElement("script");
      breadcrumbScript.type = "application/ld+json";
      breadcrumbScript.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        inLanguage: lang || "hu",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: lang === "en" ? "Home" : "Főoldal",
            item: `${SITE_URL}${lang === "en" ? "/en" : "/"}`,
          },
          ...breadcrumb.map((item, index) => ({
            "@type": "ListItem",
            position: index + 2,
            name: item.name,
            item: `${SITE_URL}${item.path}`,
          })),
        ],
      });
      document.head.appendChild(breadcrumbScript);
    }

    // A `public/index.html`-be beégetett LocalBusiness JSON-LD-nek nincs saját
    // `@id`-je scriptenkénti hivatkozáshoz, ezért a `provider` mezőt magával az
    // entitás nevével + URL-jével azonosítjuk — ez a legegyszerűbb forma, amit
    // a legtöbb konszumer (Google, AI-crawlerek) fel tud oldani anélkül, hogy a
    // statikus index.html-t is módosítani kellene egy `@id` felvételéhez.
    let serviceScript = null;
    if (service && service.name) {
      serviceScript = document.createElement("script");
      serviceScript.type = "application/ld+json";
      serviceScript.text = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Service",
        inLanguage: lang || "hu",
        name: service.name,
        // Schema.org ajánlása szerint a `serviceType` egy rövid, önálló
        // kategória-címke, elkülönítve a `name`-től — jelen esetben a
        // `service.name` már pont ilyen rövid, kategória-jellegű szöveg
        // (pl. "Belföldi fuvarozás"), ezért nincs szükség külön mezőre a
        // hívási helyeken, ugyanaz az érték mindkét property-re jó.
        serviceType: service.name,
        description: service.description || description,
        // Korábban minden szolgáltatás-oldal feltétel nélkül ["HU","EU"]-t
        // örökölt, függetlenül attól, hogy az adott szolgáltatás valóban
        // nemzetközi-e — a belföldi oldal saját látható szövege
        // ("Magyarország egész területén") ellentmondott a séma "EU"
        // állításának (SEO-audit talált rá, séma/tartalom-eltérésként). A
        // hívó oldal most explicit megadhatja a saját, valós hatókörét;
        // ha nem adja meg, a korábbi, nemzetközi hatókört feltételező
        // alapérték marad (ez a helyes alapértelmezés, mert a legtöbb
        // oldal ténylegesen nem korlátozza magát csak belföldre).
        areaServed: service.areaServed || ["HU", "EU"],
        // Ugyanarra az entitásra hivatkozik, mint amit a `public/index.html`-be
        // beégetett LocalBusiness JSON-LD `@id`-je definiál — nem másolja újra
        // a nevet/URL-t, hanem a séma-szabvány szerinti helyes módon
        // ugyanahhoz az entitáshoz köti a szolgáltatást.
        provider: { "@id": `${SITE_URL}/#organization` },
        url: path ? `${SITE_URL}${path}` : SITE_URL,
      });
      document.head.appendChild(serviceScript);
    }

    return () => {
      if (title) {
        document.title = prevTitle;
      }
      if (descTag && prevDescription !== null) {
        descTag.setAttribute("content", prevDescription);
      }
      if (canonicalTag && prevCanonical !== null) {
        canonicalTag.setAttribute("href", prevCanonical);
      }
      if (faqScript) {
        document.head.removeChild(faqScript);
      }
      if (breadcrumbScript) {
        document.head.removeChild(breadcrumbScript);
      }
      if (serviceScript) {
        document.head.removeChild(serviceScript);
      }
      document.documentElement.lang = prevLang;
      hreflangTags.forEach((tag) => document.head.removeChild(tag));
      metaSyncs.forEach(({ tag, attr, prevValue }) => {
        if (tag && prevValue !== null) {
          tag.setAttribute(attr, prevValue);
        }
      });
    };
  }, [title, description, path, faqItems, breadcrumb, service, lang, alternates]);
}

// Néhány oldal (pl. bejelentkezés) funkcionálisan szükséges, de nincs
// SEO-értéke — ezek indexelése csak feleslegesen fogyasztja a crawl-budgetet,
// és zavaró SERP-találatként jelenhet meg. `noindex,follow`-t használunk (nem
// `Disallow`-t a robots.txt-ben), mert egy robots.txt-tiltás megakadályozná,
// hogy a Google egyáltalán lássa ezt a noindex-jelzést — a kettő együtt
// önellentmondó lenne.
export function useNoindex() {
  useEffect(() => {
    // A `public/index.html`-ben statikusan jelen lévő `index,follow` tagre
    // épít (nem hoz létre egy másodikat mellette) — két egyidejű, ellentétes
    // `meta[name=robots]` tag ugyan a legszigorúbbat érvényesítené a Google
    // szerint, de felesleges, elkerülhető kétértelműség lenne.
    const tag = document.querySelector('meta[name="robots"]');
    const prevContent = tag ? tag.getAttribute("content") : null;
    if (tag) {
      tag.setAttribute("content", "noindex,follow");
    }
    return () => {
      if (tag && prevContent !== null) {
        tag.setAttribute("content", prevContent);
      }
    };
  }, []);
}
