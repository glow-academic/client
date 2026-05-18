// app/providers.tsx
"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider, useTheme } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useEffect } from "react";
import { Toaster } from "sonner";

const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

/**
 * Mirror the active theme into a `glow_theme` cookie so the Keycloak
 * login page can read it and apply the same `dark` / `light` class
 * before paint.
 *
 * Cookie scoping:
 *   - LEAVE ``NEXT_PUBLIC_COOKIE_DOMAIN`` UNSET for the current deploy
 *     topology. Both Next.js and Keycloak share a single origin in
 *     prod (nginx path-routes ``/`` → app and ``/auth/`` → keycloak),
 *     so a host-only cookie is automatically readable from both. In
 *     dev, ``localhost:3000`` and ``localhost:8080`` share cookies
 *     because RFC 6265 doesn't scope cookies by port.
 *   - Only set ``NEXT_PUBLIC_COOKIE_DOMAIN=.example.com`` if the
 *     architecture ever shifts to subdomain split (e.g.
 *     ``app.example.com`` + ``auth.example.com``). Until then,
 *     adding a Domain attribute would unnecessarily broaden cookie
 *     scope to sibling domains.
 */
function ThemeCookieSync() {
  const { theme } = useTheme();
  useEffect(() => {
    if (!theme) return;
    const domain = process.env["NEXT_PUBLIC_COOKIE_DOMAIN"];
    const parts = [
      `glow_theme=${encodeURIComponent(theme)}`,
      "path=/",
      "max-age=31536000", // 1 year
      "SameSite=Lax",
    ];
    if (domain) parts.push(`Domain=${domain}`);
    if (location.protocol === "https:") parts.push("Secure");
    document.cookie = parts.join("; ");
  }, [theme]);
  return null;
}

export function Providers({
  children,
  session,
  theme,
}: {
  children: React.ReactNode;
  session?: Session | null;
  theme?: string;
}) {
  return (
    <NuqsAdapter>
      <SessionProvider
        session={session ?? null}
        basePath={`${appPrefix}/api/auth`}
        refetchInterval={0}
        refetchOnWindowFocus={false}
        refetchWhenOffline={false}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme={theme || "system"}
          enableSystem
          disableTransitionOnChange
        >
          <ThemeCookieSync />
          {children}
          <Toaster />
        </ThemeProvider>
      </SessionProvider>
    </NuqsAdapter>
  );
}
