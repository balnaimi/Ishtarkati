import { useEffect, useState } from "react";

export function useCloseChoiceListener() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return window.ishtarkati.onCloseRequested(() => setOpen(true));
  }, []);

  return { open, setOpen };
}
