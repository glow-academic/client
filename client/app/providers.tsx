// app/providers.tsx
"use client";

import { useAuth } from "@/hooks/use-auth";
import { RoleProvider } from "@/contexts/role-context";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { createQueryClient } from "@/utils/react-query/queryClient";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { Toaster } from "sonner";

const ReactQueryClientProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [queryClient] = useState(() => createQueryClient()); // Use a single instance
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Wrapper component to provide role context with user data
const RoleProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();
  const userId = auth.session.data?.user?.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  return <RoleProvider ProfileRole={profile?.role}>{children}</RoleProvider>;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ReactQueryClientProvider>
          <RoleProviderWrapper>
            {children}
            <Toaster />
          </RoleProviderWrapper>
        </ReactQueryClientProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
