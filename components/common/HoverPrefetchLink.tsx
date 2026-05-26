"use client";
import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

type AnchorProps = Omit<ComponentPropsWithoutRef<"a">, keyof LinkProps>;

interface HoverPrefetchLinkProps extends Omit<LinkProps, "prefetch">, AnchorProps {
  /**
   * Optional intent-debounce. ``delay=0`` (default) fires the prefetch
   * immediately on hover — use for **sparse intent links** (sidebar,
   * breadcrumbs, single CTAs) where the user rarely passes over by accident.
   * Set ``delay={150}`` for **dense lists** (row actions on table/grid
   * pages) so mouse transit across many rows doesn't trigger 5-10 prefetches
   * in a single pan.
   */
  delay?: number;
  children?: ReactNode;
}

/**
 * Drop-in replacement for ``<Link>`` that prefetches the destination only
 * when the user signals intent (hover or keyboard focus), not on viewport
 * entry. Canonical primitive for all internal navigation Links in this app.
 *
 * Behaviour:
 *   - Renders ``<Link prefetch={false}>`` underneath (no viewport prefetch)
 *   - ``onPointerEnter`` / ``onFocus`` fire ``router.prefetch(href)``
 *   - ``onPointerLeave`` / ``onBlur`` cancel any pending delayed prefetch
 *   - Mobile (no pointer events) degrades gracefully — click pays honest TTFB
 *   - Keyboard nav fires immediately regardless of ``delay``
 *
 * Background: viewport-prefetch (Next.js App Router default for ``<Link>``)
 * fires for every visible link on every page load. Measured in prod May
 * 2026 as a 12-call ``/<artifact>/context`` storm saturating the API. This
 * component is the standard replacement — bounded by actual user intent.
 *
 * Compose with ``<Button asChild>`` for styled clickable anchors:
 *   <Button asChild>
 *     <HoverPrefetchLink href={...} delay={150}>...</HoverPrefetchLink>
 *   </Button>
 */
export const HoverPrefetchLink = forwardRef<HTMLAnchorElement, HoverPrefetchLinkProps>(
  function HoverPrefetchLink(
    { href, delay = 0, onPointerEnter, onPointerLeave, onFocus, onBlur, children, ...rest },
    ref,
  ) {
    const router = useRouter();
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hrefString = typeof href === "string" ? href : href.pathname ?? "";

    const cancel = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };

    return (
      <Link
        ref={ref}
        href={href}
        prefetch={false}
        onPointerEnter={(e) => {
          if (delay === 0) {
            router.prefetch(hrefString);
          } else {
            cancel();
            timer.current = setTimeout(() => router.prefetch(hrefString), delay);
          }
          onPointerEnter?.(e);
        }}
        onPointerLeave={(e) => {
          cancel();
          onPointerLeave?.(e);
        }}
        onFocus={(e) => {
          router.prefetch(hrefString);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          cancel();
          onBlur?.(e);
        }}
        {...rest}
      >
        {children}
      </Link>
    );
  },
);
