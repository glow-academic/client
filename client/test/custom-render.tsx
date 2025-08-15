import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SidebarProvider } from "@/components/ui/sidebar";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import { AssistantProvider } from "@/contexts/assistant-context";
import { ProfileProvider } from "@/contexts/profile-context";
import { TourProvider } from "@/contexts/tour-context";
import { WebSocketProvider } from "@/contexts/websocket-context";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const mockProfile = {
  id: "test-profile-id", 
  userId: 1, 
  firstName: "Test", 
  lastName: "User", 
  alias: "testuser",
  role: "admin" as const, 
  active: true, 
  viewedIntro: true, 
  viewedChat: true,
  createdAt: new Date().toISOString(), 
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(), 
  lastActive: new Date().toISOString(), 
  defaultProfile: false,
  reqPerDay: 100,
};

const AllTheProviders = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <ProfileProvider activeProfile={mockProfile}>
      <AnalyticsProvider>
        <AssistantProvider>
          <WebSocketProvider profileId={mockProfile.id}>
            <TourProvider>
              <SidebarProvider>{children}</SidebarProvider>
            </TourProvider>
          </WebSocketProvider>
        </AssistantProvider>
      </AnalyticsProvider>
    </ProfileProvider>
  </QueryClientProvider>
);

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => 
  render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
