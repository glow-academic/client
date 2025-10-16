// app/providers.tsx
"use client";

import { ProfileProvider, useProfile } from "@/contexts/profile-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { getQueryClient } from "@/utils/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { Toaster } from "sonner";

const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

// Wrapper component for WebSocket that gets profileId from ProfileContext
const WebSocketProviderWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { effectiveProfile, isLoading } = useProfile();

  // For guest mode (no session), profileId should be null, not undefined
  const profileId = isLoading ? undefined : effectiveProfile?.id || null;

  return (
    <WebSocketProvider profileId={profileId}>{children}</WebSocketProvider>
  );
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <SessionProvider basePath={`${appPrefix}/api/auth`}>
      <QueryClientProvider client={queryClient}>
        <ProfileProvider>
          <WebSocketProviderWrapper>
            {children}
            <Toaster />
          </WebSocketProviderWrapper>
        </ProfileProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
