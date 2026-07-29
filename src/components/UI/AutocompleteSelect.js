import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { PiCaretDownLight, PiXLight } from "react-icons/pi";

export default function AutocompleteSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value)) || null;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered =
    query.trim() === ""
      ? options
      : options.filter((o) =>
          (o.searchText || o.label).toLowerCase().includes(query.trim().toLowerCase()),
        );

  const handleSelect = (option) => {
    onChange(option.value, option);
    setQuery("");
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("", null);
    setQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-ink-600 dark:text-ink-300">
          {label}
        </label>
      )}
      <div
        onClick={() => !disabled && inputRef.current?.focus()}
        className="flex cursor-text items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
      >
        <input
          ref={inputRef}
          type="text"
          // A böngésző natív input-alapstílusa (border+padding) enélkül
          // MÉG EGYSZER hozzáadódik a fenti sor saját px-3/py-2/border
          // keretéhez — emiatt ez a mező eddig ~56px magas volt, míg a
          // FormField-alapú mezők (Felrakó, Fuvardíj stb.) ~38px, azonos
          // form-on belül két különböző mezőmagasságot eredményezve.
          className="w-full border-0 bg-transparent p-0 text-sm outline-none disabled:cursor-not-allowed"
          placeholder={selected ? selected.label : placeholder || "Keresés..."}
          value={open ? query : ""}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          required={required && !selected}
        />
        {selected && !open && (
          <button
            type="button"
            onClick={handleClear}
            className="text-ink-300 hover:text-ink-500"
            aria-label="Kiválasztás törlése"
          >
            <PiXLight className="h-4 w-4" />
          </button>
        )}
        <PiCaretDownLight className="h-4 w-4 flex-shrink-0 text-ink-300" />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-200 bg-white py-1 text-sm shadow-soft dark:border-ink-700 dark:bg-ink-900">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-ink-400">Nincs találat</li>
          ) : (
            filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => handleSelect(option)}
                  className="block w-full px-3 py-2 text-left hover:bg-brand-50 dark:hover:bg-brand-950/40"
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

AutocompleteSelect.propTypes = {
  label: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      searchText: PropTypes.string,
    }),
  ).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

AutocompleteSelect.defaultProps = {
  required: false,
  disabled: false,
};
