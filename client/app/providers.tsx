// app/providers.tsx
"use client";

import { createQueryClient } from "@/utils/react-query/queryClient";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { RoleProvider } from "@/contexts/role-context";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "@/utils/queries/users/get-user";

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
  const { userId } = useAuth();

  // Fetch user data for role context
  const { data: user } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUser(userId!),
    enabled: !!userId,
  });

  return <RoleProvider userRole={user?.role}>{children}</RoleProvider>;
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryClientProvider>
        <RoleProviderWrapper>
          {children}
          <Toaster />
        </RoleProviderWrapper>
      </ReactQueryClientProvider>
    </QueryClientProvider>
  );
}
