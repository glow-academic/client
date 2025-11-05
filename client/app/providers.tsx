// app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath={`${appPrefix}/api/auth`}>
      {children}
      <Toaster />
    </SessionProvider>
  );
}
