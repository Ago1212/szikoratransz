import React from "react";
import { Link } from "react-router-dom";

// Vizuális megfelelője a `useSeo.js` `breadcrumb` propjának — ugyanazt a
// `[{name, path}, ...]` listát várja, és a Főoldalt ugyanúgy automatikusan
// elé fűzi. A két helyen (JSON-LD + látható DOM) megjelenő tartalomnak
// egyeznie kell — a Google strukturáltadat-irányelvei ezt várják el egy
// BreadcrumbList sémától. `homeLabel`/`homePath` lokalizálva jön a hívótól
// (ServicePage.js), hogy ez a komponens maga ne függjön az i18n-rétegtől.
export default function Breadcrumb({ items = [], homeLabel = "Főoldal", homePath = "/" }) {
  return (
    <nav aria-label="Morzsamenü" className="text-xs font-[Overpass_Mono] text-[#23262B]/50 mb-4">
      <ol className="flex items-center flex-wrap gap-x-2 gap-y-1">
        <li>
          <Link to={homePath} className="hover:text-[#1E3AA8] transition-colors duration-300">
            {homeLabel}
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-2">
              <span aria-hidden="true">/</span>
              {isLast ? (
                <span className="text-[#23262B]/70" aria-current="page">
                  {item.name}
                </span>
              ) : (
                <Link to={item.path} className="hover:text-[#1E3AA8] transition-colors duration-300">
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
