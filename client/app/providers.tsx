// app/providers.tsx
"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
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
    <NuqsAdapter>
      <SessionProvider
        session={session ?? null}
        basePath={`${appPrefix}/api/auth`}
        refetchInterval={0}
        refetchOnWindowFocus={false}
        refetchWhenOffline={false}
      >
        <TooltipProvider delayDuration={0}>
          {children}
        </TooltipProvider>
        <Toaster />
      </SessionProvider>
    </NuqsAdapter>
  );
}
