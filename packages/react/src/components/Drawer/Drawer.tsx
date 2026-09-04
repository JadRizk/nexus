import { useId, version as reactVersion } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Panel } from "../Panel/index.js";
import { HazardRule } from "../HazardRule/index.js";
import { useFocusTrap } from "../../hooks/index.js";
import { resolveColour } from "../../colour.js";
import type { ToneProps } from "../../colour.js";
import { inertAttr } from "./inert.js";

// Resolved once: React cannot change major mid-session. See ./inert.ts for
// why the two supported majors need different spellings.
const INERT_VALUE = inertAttr(reactVersion);

// The loose record type is deliberately local. Declaring `inert` into React's
// global HTMLAttributes would have merged into the types of every app that
// imports this package — including React 19 apps, where `inert` is already
// typed as boolean and widening it to string is simply wrong for their whole
// codebase.
const inertWhenClosed = (open: boolean): Record<string, boolean | string> =>
  (open ? {} : { inert: INERT_VALUE });

/* ============================================================================
   @nexus-cyberdeck/react — overlays
   Drawer and CommandPalette are where design systems fail accessibility
   audits, so they share one focus-trap implementation and carry full ARIA.
   ========================================================================== */

/* ----------------------------------------------------------------- Drawer */
export interface DrawerProps extends ToneProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  footer?: ReactNode;
  width?: number;
  children?: ReactNode;
}

/**
 * Right-hand detail panel. It slides rather than mounting and unmounting, so
 * the motion reads as one object moving instead of two objects swapping.
 *
 * Focus is trapped while open and restored to whatever opened it on close.
 * When closed the subtree is `aria-hidden` and inert, so a screen reader never
 * wanders into offscreen content.
 */
export function Drawer({
  open, onClose, title, subtitle, tone, colour,
  icon, footer, width = 296, children,
}: DrawerProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open, onClose);
  const titleId = useId();
  const accent = resolveColour({ tone, colour }, "var(--nx-fg-info)");

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-hidden={open ? undefined : true}
      {...inertWhenClosed(open)}
      tabIndex={-1}
      className="nx-drawer"
      data-open={open ? "1" : "0"}
      // Width is per-instance, and the closed transform is derived from it —
      // the panel has to travel its own width plus the gutter to clear the
      // edge, which the stylesheet cannot know.
      style={{ "--nx-drawer-width": `${width}px` } as CSSProperties}
    >
      <Panel padded={false} raised className="nx-drawer__panel">
        <header className="nx-drawer__header">
          <div className="nx-drawer__head">
            {icon && <div className="nx-drawer__icon">{icon}</div>}
            <div className="nx-drawer__titles">
              <h2
                id={titleId}
                className="nx-drawer__title"
                style={{ "--nx-drawer-accent": accent } as CSSProperties}
              >
                {title}
              </h2>
              {subtitle != null && <div className="nx-drawer__subtitle">{subtitle}</div>}
            </div>
            <button
              type="button"
              className="nx-btn nx-drawer__close"
              onClick={onClose}
              aria-label="Close details"
            >
              ✕
            </button>
          </div>
        </header>

        <HazardRule className="nx-drawer__rule" />

        <div className="nx-drawer__body">{children}</div>

        {footer && <div className="nx-drawer__footer">{footer}</div>}
      </Panel>
    </div>
  );
}
