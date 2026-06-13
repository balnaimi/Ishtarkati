import { useEffect } from "react";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function isModKey(e: KeyboardEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

export function useGlobalShortcuts(opts: {
  onPalette: () => void;
  onNew: () => void;
  onHelp: () => void;
  paletteOpen: boolean;
  helpOpen: boolean;
  onCloseOverlay: () => void;
}): void {
  const { onPalette, onNew, onHelp, paletteOpen, helpOpen, onCloseOverlay } = opts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (paletteOpen || helpOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          onCloseOverlay();
        }
        return;
      }

      if (isModKey(e) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onPalette();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (e.key === "?") {
        e.preventDefault();
        onHelp();
        return;
      }

      if (e.key === "n" && !e.altKey && !isModKey(e)) {
        e.preventDefault();
        onNew();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPalette, onNew, onHelp, paletteOpen, helpOpen, onCloseOverlay]);
}
