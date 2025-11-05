// app/providers.tsx
"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider
      session={session ?? null}
      basePath={`${appPrefix}/api/auth`}
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      {children}
      <Toaster />
    </SessionProvider>
  );
}
