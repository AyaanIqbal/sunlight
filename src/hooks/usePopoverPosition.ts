import { useLayoutEffect, useState, type RefObject } from "react";

const VIEWPORT_PADDING = 8;
const GAP = 8;
const CARET_SIZE = 8;

export type PopoverPlacement = "above" | "below";

export interface PopoverPosition {
  top: number;
  left: number;
  placement: PopoverPlacement;
  caretLeft: number;
}

export function usePopoverPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>
): PopoverPosition | null {
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;

      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const popoverWidth = popoverRect.width || 280;
      const popoverHeight = popoverRect.height || 360;

      const spaceBelow = window.innerHeight - anchorRect.bottom - VIEWPORT_PADDING;
      const spaceAbove = anchorRect.top - VIEWPORT_PADDING;

      let placement: PopoverPlacement = "below";
      if (spaceBelow >= popoverHeight + GAP + CARET_SIZE) {
        placement = "below";
      } else if (spaceAbove >= popoverHeight + GAP + CARET_SIZE) {
        placement = "above";
      } else {
        placement = spaceBelow >= spaceAbove ? "below" : "above";
      }

      const anchorCenterX = anchorRect.left + anchorRect.width / 2;
      let left = anchorCenterX - popoverWidth / 2;
      left = Math.max(
        VIEWPORT_PADDING,
        Math.min(left, window.innerWidth - popoverWidth - VIEWPORT_PADDING)
      );

      let top =
        placement === "below"
          ? anchorRect.bottom + GAP + CARET_SIZE
          : anchorRect.top - popoverHeight - GAP - CARET_SIZE;

      top = Math.max(
        VIEWPORT_PADDING,
        Math.min(top, window.innerHeight - popoverHeight - VIEWPORT_PADDING)
      );

      const caretLeft = Math.max(
        12,
        Math.min(anchorCenterX - left, popoverWidth - 12)
      );

      setPosition({ top, left, placement, caretLeft });
    };

    update();

    const ro = new ResizeObserver(update);
    if (popoverRef.current) ro.observe(popoverRef.current);
    if (anchorRef.current) ro.observe(anchorRef.current);

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, popoverRef]);

  return position;
}

export { CARET_SIZE, GAP };
