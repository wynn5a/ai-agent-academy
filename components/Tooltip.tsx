"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: Side;
  /** ms to wait before showing, so brief mouse-overs don't flash a tooltip */
  delay?: number;
  /** classes applied to the trigger wrapper span, e.g. for layout/truncation */
  wrapperClassName?: string;
  /** only show once the trigger's text is actually clipped (e.g. `truncate`) */
  onlyIfTruncated?: boolean;
  className?: string;
}

const GAP = 8;

const OFFSET: Record<Side, { x?: number; y?: number }> = {
  top: { y: 4 },
  bottom: { y: -4 },
  left: { x: 4 },
  right: { x: -4 },
};

const ORIGIN: Record<Side, string> = {
  top: "-translate-x-1/2 -translate-y-full",
  bottom: "-translate-x-1/2",
  left: "-translate-x-full -translate-y-1/2",
  right: "-translate-y-1/2",
};

const ARROW: Record<Side, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-[color:var(--color-card)]",
  bottom:
    "bottom-full left-1/2 -translate-x-1/2 border-b-[color:var(--color-card)]",
  left: "left-full top-1/2 -translate-y-1/2 border-l-[color:var(--color-card)]",
  right:
    "right-full top-1/2 -translate-y-1/2 border-r-[color:var(--color-card)]",
};

export default function Tooltip({
  content,
  children,
  side = "top",
  delay = 150,
  wrapperClassName,
  onlyIfTruncated = false,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    showTimer.current = setTimeout(() => {
      const el = triggerRef.current;
      if (!el) return;
      if (onlyIfTruncated && el.scrollWidth <= el.clientWidth) return;
      const rect = el.getBoundingClientRect();
      const positions: Record<Side, { top: number; left: number }> = {
        top: { top: rect.top - GAP, left: rect.left + rect.width / 2 },
        bottom: { top: rect.bottom + GAP, left: rect.left + rect.width / 2 },
        left: { top: rect.top + rect.height / 2, left: rect.left - GAP },
        right: { top: rect.top + rect.height / 2, left: rect.right + GAP },
      };
      setCoords(positions[side]);
      setOpen(true);
    }, delay);
  };

  const hide = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    setOpen(false);
  };

  useEffect(
    () => () => {
      if (showTimer.current) clearTimeout(showTimer.current);
    },
    [],
  );

  return (
    <>
      <span
        ref={triggerRef}
        className={wrapperClassName}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="tooltip"
                initial={{ opacity: 0, scale: 0.95, ...OFFSET[side] }}
                animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, ...OFFSET[side] }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  left: coords.left,
                }}
                className={clsx(
                  "border-border bg-card pointer-events-none z-100 rounded-md border px-2.5 py-1.5 text-xs font-medium text-nowrap text-slate-200 shadow-lg shadow-black/40",
                  ORIGIN[side],
                  className,
                )}
              >
                {content}
                <span
                  className={clsx(
                    "absolute h-0 w-0 border-[5px] border-transparent",
                    ARROW[side],
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
