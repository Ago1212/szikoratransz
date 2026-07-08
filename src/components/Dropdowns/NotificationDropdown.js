import React from "react";
import { createPopper } from "@popperjs/core";
import { PiBellLight, PiCheckCircleLight } from "react-icons/pi";

const NotificationDropdown = ({ notifications = [] }) => {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef(null);
  const popoverRef = React.useRef(null);

  const openPopover = () => {
    createPopper(btnRef.current, popoverRef.current, {
      placement: "bottom-end",
      modifiers: [{ name: "offset", options: { offset: [0, 8] } }],
    });
    setOpen(true);
  };
  const closePopover = () => setOpen(false);

  React.useEffect(() => {
    const onClick = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        !btnRef.current.contains(e.target)
      ) {
        closePopover();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => (open ? closePopover() : openPopover())}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition-colors duration-300 ease-fluid hover:bg-brand-50 hover:text-brand-700"
        aria-label="Értesítések"
      >
        <PiBellLight className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ember-500 ring-2 ring-white" />
        )}
      </button>

      <div
        ref={popoverRef}
        className={`${
          open ? "animate-scale-in" : "hidden"
        } z-50 w-72 rounded-2xl border border-ink-100 bg-white p-1.5 shadow-soft-lg`}
      >
        <div className="px-3 py-2.5 text-sm font-semibold text-brand-900">
          Értesítések
        </div>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <PiCheckCircleLight className="h-7 w-7 text-ink-300" />
            <p className="text-sm text-ink-400">
              Nincs új értesítésed. Minden naprakész.
            </p>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto py-1">
            {notifications.map((n, i) => (
              <div
                key={i}
                className="rounded-xl px-3 py-2 text-sm text-ink-700 hover:bg-brand-50"
              >
                {n.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationDropdown;
