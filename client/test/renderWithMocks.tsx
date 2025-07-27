// helpers/testing/renderWithMocks.tsx
import { SidebarProvider } from "@/components/ui/sidebar";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import { AssistantProvider } from "@/contexts/assistant-context";
import { ProfileProvider } from "@/contexts/profile-context";
import { TourProvider } from "@/contexts/tour-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";

// Mock profile for testing
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
};

// This helper's only job is to provide the QueryClient.
// Mocking is handled in the test files via Vitest.
export function renderWithMocks(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileProvider activeProfile={mockProfile}>
        <AnalyticsProvider>
          <AssistantProvider>
            <WebSocketProvider profileId={mockProfile.id}>
              <TourProvider>
                <SidebarProvider>{ui}</SidebarProvider>
              </TourProvider>
            </WebSocketProvider>
          </AssistantProvider>
        </AnalyticsProvider>
      </ProfileProvider>
    </QueryClientProvider>,
  );
}
