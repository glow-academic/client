// app/providers.tsx
"use client";

import { RoleProvider } from "@/contexts/role-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { createQueryClient } from "@/utils/react-query/queryClient";
import {
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { useState } from "react";
import { Toaster } from "sonner";

// Wrapper component to provide role context with user data and WebSocket connection
const RoleAndWebSocketProviderWrapper = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const userId = useSession().data?.user?.id;
  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  return (
    <RoleProvider ProfileRole={profile?.role}>
      <WebSocketProvider profileId={profile?.id}>{children}</WebSocketProvider>
    </RoleProvider>
  );
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
          <RoleAndWebSocketProviderWrapper>
            {children}
            <Toaster />
          </RoleAndWebSocketProviderWrapper>
      </QueryClientProvider>
    </SessionProvider>
  );
}
