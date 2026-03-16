import type { VisibilityState } from "@tanstack/react-table";
import { cookies } from "next/headers";

const COOKIE_PREFIX = "glow_view_";

/**
 * Read a column-visibility cookie server-side.
 * Returns `{}` (all visible) when the cookie is absent or malformed.
 *
 * Usage in a page RSC:
 *   const initialColumnVisibility = await readViewCookie("personas");
 */
export async function readViewCookie(key: string): Promise<VisibilityState> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(`${COOKIE_PREFIX}${key}`);
  if (!raw?.value) return {};
  try {
    return JSON.parse(decodeURIComponent(raw.value));
  } catch {
    return {};
  }
}
