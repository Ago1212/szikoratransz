import { useHistory } from "react-router-dom";
import { fetchAction } from "utils/fetchAction";
import { toast } from "utils/toast";

// A törlés-megerősítés + fetchAction + hibakezelés + (opcionális) lista-
// frissítés mintát korábban minden entitás-táblázat (kamion, sofőr,
// pótkocsi, bejelentés, karbantartás) egymástól függetlenül másolta.
// A szöveget (megerősítő kérdés, siker-üzenet) a hívó adja át, mert a
// magyar tárgyeset ("a kamiont", "a sofőrt", "a pótkocsit", ...)
// szavanként eltér, azt nem lehet automatikusan generálni.
export function useConfirmDelete({ action, confirmMessage, successMessage, listPath, onSuccess }) {
  const history = useHistory();

  return async (id) => {
    if (!window.confirm(confirmMessage)) return;

    try {
      const result = await fetchAction(action, { id });

      if (result?.success) {
        if (onSuccess) {
          await onSuccess();
        } else if (listPath) {
          history.push("/admin");
          setTimeout(() => history.replace(listPath), 0);
        }
        if (successMessage) toast.success(successMessage);
      } else {
        toast.error(result?.message || "Hiba történt a törlés során.");
      }
    } catch (error) {
      console.error("Hiba történt a törlés során:", error);
      toast.error("Hiba történt a törlés során.");
    }
  };
}
