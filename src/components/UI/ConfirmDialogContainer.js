import React, { useEffect, useState } from "react";
import { subscribeConfirm } from "utils/confirm.js";
import Modal from "components/UI/Modal.js";

// UX-audit — egyetlen, a Router gyökerén (ld. src/index.js) mountolt
// komponens, ami a `utils/confirm.js` pub/sub csatornáján érkező
// megerősítés-kéréseket egy márkázott, `Modal`-alapú dialógusként rajzolja
// ki, a natív `window.confirm()` helyett mindenhol. Ugyanaz az architekturális
// minta, mint a `ToastContainer.js`-é.
export default function ConfirmDialogContainer() {
  const [request, setRequest] = useState(null);

  useEffect(() => subscribeConfirm(setRequest), []);

  const close = (result) => {
    request?.resolve(result);
    setRequest(null);
  };

  return (
    <Modal open={!!request} onClose={() => close(false)} title={request?.title || "Megerősítés"} maxWidth="max-w-sm">
      {request && (
        <div className="space-y-5">
          <p className="whitespace-pre-line text-sm text-ink-700 dark:text-ink-200">{request.message}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => close(false)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-500 transition-colors duration-150 hover:bg-slate-100 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              Mégse
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 ${
                request.danger === false ? "bg-brand-600 hover:bg-brand-700" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {request.confirmLabel || "Törlés"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
