import { useEffect, useRef } from 'react';

/**
 * Closes an open popover on Escape or on a pointer press outside it, and
 * returns the ref to put on the popover's container.
 *
 * Uses `pointerdown` rather than `click` so a press that starts outside closes
 * immediately, and listens in the capture phase so a press on a control that
 * stops propagation still dismisses.
 */
export function useDismissable<T extends HTMLElement>(open: boolean, onDismiss: () => void) {
  const ref = useRef<T>(null);
  // Kept in a ref so a caller passing an inline arrow doesn't re-subscribe on
  // every render.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const node = ref.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        dismiss.current();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss.current();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return ref;
}
