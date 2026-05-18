/**
 * LoginReturnButton — "Log In" CTA on the access-denied screen.
 *
 * Lives as a client component so it can read the LIVE browser URL
 * (path + query) via ``usePathname`` + ``useSearchParams`` and encode
 * the full thing into ``?return_to=...``. The surrounding
 * ``UnifiedAccessDenied`` is a server component and only knows the
 * path part of where the user was — which strips selection ids,
 * groupId, filters, etc. Hooking the read here keeps the fix scoped
 * to the one button that needs it; no middleware, layout, or prop-
 * plumbing changes elsewhere.
 *
 * Consumed by ``app/page.tsx`` which forwards ``return_to`` into
 * NextAuth's ``signIn({ callbackUrl })``. After re-auth the user
 * lands back on the URL they had before the session expired —
 * including their in-flight URL state.
 */
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

export function LoginReturnButton() {
  const pathname = usePathname();
  const params = useSearchParams().toString();
  const returnTo = params ? `${pathname}?${params}` : pathname;
  return (
    <Button asChild className="w-full">
      <Link href={`/?return_to=${encodeURIComponent(returnTo)}`}>Log In</Link>
    </Button>
  );
}
