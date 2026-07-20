const plugin = require("tailwindcss/plugin");
const colors = require("tailwindcss/colors");

module.exports = {
  // R16 (fejlesztési audit, 2026-07-19): 'class' stratégia — a felhasználó
  // saját kapcsolójától függ (localStorage-ban perzisztálva, ld.
  // utils/useDarkMode.js), nem csak az OS/böngésző `prefers-color-scheme`-
  // jétől (ami a 'media' stratégia lenne).
  darkMode: "class",
  purge: {
    enabled: true,
    content: [
      "./public/**/*.html",
      "./public/*.html",
      "./src/**/*.js",
      "./src/*.js",
      "./src/**/*.html",
      "./src/*.html",
      "./public/**/*.js",
      "./public/*.js",
    ],
    options: {
      safelist: [],
    },
  },
  theme: {
    colors: {
      ...colors,
      // Rebrand pass: the original Notus template's blueGray/lightBlue tokens are used
      // throughout the untouched CRUD screens (Tables, Cards, Profile...). Rather than
      // rewrite class names file-by-file, alias them to the new brand palette here so
      // every remaining screen inherits the same identity automatically.
      blueGray: {
        50: "#f4f4f5",
        100: "#e5e5e7",
        200: "#c7c8cb",
        300: "#9a9ca1",
        400: "#6b6d73",
        500: "#4a4c52",
        600: "#35373c",
        700: "#292b30",
        800: "#23262b",
        900: "#1a1c1f",
      },
      lightBlue: {
        50: "#eef1fd",
        100: "#dde3fb",
        200: "#b8c3f5",
        300: "#8fa0ee",
        400: "#5f76e6",
        500: "#2F4DE0",
        600: "#253fc0",
        700: "#1E3AA8",
        800: "#182c80",
        900: "#131f5c",
      },
      // Many untouched screens also reach for plain Tailwind `blue-*` as their
      // "primary" color (buttons, active tabs, focus rings). Alias it too so
      // they inherit the brand accent instead of generic Tailwind blue.
      blue: {
        50: "#eef1fd",
        100: "#dde3fb",
        200: "#b8c3f5",
        300: "#8fa0ee",
        400: "#5f76e6",
        500: "#2F4DE0",
        600: "#253fc0",
        700: "#1E3AA8",
        800: "#182c80",
        900: "#131f5c",
      },
      // Brand accent — matches the existing Landing page identity (#2F4DE0 / hover #1E3AA8)
      brand: {
        50: "#eef1fd",
        100: "#dde3fb",
        200: "#b8c3f5",
        300: "#8fa0ee",
        400: "#5f76e6",
        500: "#2F4DE0",
        600: "#253fc0",
        700: "#1E3AA8",
        800: "#182c80",
        900: "#131f5c",
        950: "#0d1640",
      },
      // Charcoal dark surfaces — matches the Landing footer/about sections (#23262B)
      ink: {
        50: "#f4f4f5",
        100: "#e5e5e7",
        200: "#c7c8cb",
        300: "#9a9ca1",
        400: "#6b6d73",
        500: "#4a4c52",
        600: "#35373c",
        700: "#292b30",
        800: "#23262b",
        900: "#1a1c1f",
        950: "#101113",
      },
      // Status accent for warnings/attention (overdue maintenance, alerts) — kept separate from the brand accent
      ember: {
        50: "#fdf6ec",
        100: "#f9e8cc",
        200: "#f2cd8f",
        300: "#e9b05c",
        400: "#dd9636",
        500: "#c67f29",
        600: "#a3661f",
        700: "#7f4f19",
        800: "#5c3a14",
        900: "#3d270e",
      },
      sand: {
        25: "#fdfcfa",
        50: "#faf8f4",
        100: "#f4f0e8",
        200: "#e7e0d2",
        300: "#d3c7b2",
        400: "#b3a487",
        500: "#8f8168",
        600: "#6f6350",
        700: "#544a3c",
        800: "#3a332a",
        900: "#221d18",
      },
    },
    fontFamily: {
      sans: ["Overpass", "system-ui", "sans-serif"],
      display: ["Overpass", "system-ui", "sans-serif"],
      mono: ["'Overpass Mono'", "ui-monospace", "monospace"],
    },
    extend: {
      minHeight: {
        "screen-75": "75vh",
      },
      fontSize: {
        55: "55rem",
      },
      opacity: {
        80: ".8",
      },
      zIndex: {
        2: 2,
        3: 3,
      },
      borderRadius: {
        "2.5xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 2px 10px -2px rgba(15, 22, 56, 0.06), 0 1px 2px -1px rgba(15, 22, 56, 0.04)",
        "soft-lg": "0 20px 60px -15px rgba(15, 22, 56, 0.18), 0 8px 20px -8px rgba(15, 22, 56, 0.08)",
        "soft-xl": "0 30px 90px -20px rgba(15, 22, 56, 0.28)",
        "inner-hairline": "inset 0 1px 1px rgba(255, 255, 255, 0.4)",
        "inner-hairline-dark": "inset 0 1px 1px rgba(255, 255, 255, 0.08)",
        ember: "0 12px 30px -10px rgba(198, 127, 41, 0.35)",
      },
      transitionTimingFunction: {
        fluid: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(2.5rem)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.8s cubic-bezier(0.32, 0.72, 0, 1) both",
        "fade-in": "fade-in 0.6s ease-out both",
        "scale-in": "scale-in 0.4s cubic-bezier(0.32, 0.72, 0, 1) both",
      },
      backgroundImage: {
        grain:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      inset: {
        "-100": "-100%",
        "-225-px": "-225px",
        "-160-px": "-160px",
        "-150-px": "-150px",
        "-94-px": "-94px",
        "-50-px": "-50px",
        "-29-px": "-29px",
        "-20-px": "-20px",
        "25-px": "25px",
        "40-px": "40px",
        "95-px": "95px",
        "145-px": "145px",
        "195-px": "195px",
        "210-px": "210px",
        "260-px": "260px",
      },
      height: {
        "95-px": "95px",
        "70-px": "70px",
        "350-px": "350px",
        "500-px": "500px",
        "600-px": "600px",
      },
      maxHeight: {
        "860-px": "860px",
      },
      maxWidth: {
        "100-px": "100px",
        "120-px": "120px",
        "150-px": "150px",
        "180-px": "180px",
        "200-px": "200px",
        "210-px": "210px",
        "580-px": "580px",
      },
      minWidth: {
        "140-px": "140px",
        48: "12rem",
      },
      backgroundSize: {
        full: "100%",
      },
    },
  },
  variants: [
    "responsive",
    "group-hover",
    "focus-within",
    "first",
    "last",
    "odd",
    "even",
    "hover",
    "focus",
    "active",
    "visited",
    "disabled",
  ],
  plugins: [
    require("@tailwindcss/forms"),
    plugin(function ({ addComponents, theme }) {
      const screens = theme("screens", {});
      addComponents([
        {
          ".container": { width: "100%" },
        },
        {
          [`@media (min-width: ${screens.sm})`]: {
            ".container": {
              "max-width": "640px",
            },
          },
        },
        {
          [`@media (min-width: ${screens.md})`]: {
            ".container": {
              "max-width": "768px",
            },
          },
        },
        {
          [`@media (min-width: ${screens.lg})`]: {
            ".container": {
              "max-width": "1024px",
            },
          },
        },
        {
          [`@media (min-width: ${screens.xl})`]: {
            ".container": {
              "max-width": "1280px",
            },
          },
        },
        {
          [`@media (min-width: ${screens["2xl"]})`]: {
            ".container": {
              "max-width": "1280px",
            },
          },
        },
      ]);
    }),
  ],
};
