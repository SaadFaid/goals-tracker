import { useRef } from "react";

/**
 * Dismiss-on-backdrop, safely.
 *
 * On a phone the keyboard opening moves the sheet under the finger: the press
 * lands on the panel, the release (and the click the browser synthesizes at
 * the same point) lands on the backdrop. Closing on either event alone would
 * throw away the dialog the user is typing in, so both the press and the
 * release have to happen on the backdrop.
 */
export default function useBackdropClose(onClose) {
  const down = useRef(false);
  return {
    onPointerDown: (e) => {
      down.current = e.target === e.currentTarget;
    },
    onClick: (e) => {
      const fromBackdrop = down.current && e.target === e.currentTarget;
      down.current = false;
      if (fromBackdrop) onClose?.();
    },
  };
}
