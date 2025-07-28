// Centralized mock module for next-auth and authentication
// This file is imported once in test setup and contains all vi.mock() calls for auth

import React from "react";
import { vi } from "vitest";

// Create shared mock functions to avoid duplication
const useSession = vi.fn(() => ({
  data: null,
  status: "loading",
  update: vi.fn(),
}));
const signIn = vi.fn();
const signOut = vi.fn();
const getSession = vi.fn();
const getCsrfToken = vi.fn();
const getProviders = vi.fn();

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession,
  signIn,
  signOut,
  getSession,
  getCsrfToken,
  getProviders,
}));

// Mock next-auth to prevent module resolution issues
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: vi.fn(),
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
  getServerSession: vi.fn(),
  getToken: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock auth helpers
vi.mock("@/utils/auth/get-profile-by-alias", () => ({
  getProfileByAlias: vi.fn(),
}));

// Mock WebSocket context
vi.mock("@/contexts/websocket-context", () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: false,
    sendMessage: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  })),
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock role context
vi.mock("@/contexts/role-context", () => ({
  useRole: vi.fn(() => ({
    effectiveRole: "admin",
    userRole: "admin",
    isAdmin: true,
    isInstructional: false,
    isInstructor: false,
    isTA: false,
    isGuest: false,
    canAccessAnalytics: true,
    canAccessManagement: true,
    canAccessSimulations: true,
    canAccessScenarios: true,
    canAccessClasses: true,
    canAccessCohorts: true,
  })),
  RoleProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Profile context
vi.mock("@/contexts/profile-context", () => ({
  useProfile: vi.fn(() => ({
    activeProfile: {
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
    },
    profiles: [],
    loading: false,
    error: null,
  })),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Analytics context
vi.mock("@/contexts/analytics-context", () => ({
  useAnalytics: vi.fn(() => ({
    startDate: new Date(),
    endDate: new Date(),
    setDateRange: vi.fn(),
    selectedCohortIds: [],
    setSelectedCohortIds: vi.fn(),
    cohorts: [
      {
        id: "cohort-1",
        title: "Test Cohort 1",
        description: "Test cohort description",
        active: true,
        profileIds: ["profile-1", "profile-2"],
      },
      {
        id: "cohort-2",
        title: "Test Cohort 2",
        description: "Another test cohort",
        active: false,
        profileIds: ["profile-3"],
      },
    ],
  })),
  AnalyticsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Assistant context
vi.mock("@/contexts/assistant-context", () => ({
  useAssistant: vi.fn(() => ({
    messages: [],
    isLoading: false,
    sendMessage: vi.fn(),
    clearMessages: vi.fn(),
  })),
  AssistantProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Tour context
vi.mock("@/contexts/tour-context", () => ({
  useTour: vi.fn(() => ({
    isOpen: false,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
  })),
  TourProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock React Query
vi.mock("@tanstack/react-query", () => ({
  QueryClient: class MockQueryClient {
    constructor() {
      return {
        getQueryData: vi.fn(),
        setQueryData: vi.fn(),
        invalidateQueries: vi.fn(),
        removeQueries: vi.fn(),
        cancelQueries: vi.fn(),
        resetQueries: vi.fn(),
        refetchQueries: vi.fn(),
      };
    }
  },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "query-provider" }, children),
  useQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
  useQueryClient: vi.fn(() => ({
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
    cancelQueries: vi.fn(),
    resetQueries: vi.fn(),
    refetchQueries: vi.fn(),
  })),
}));

// Mock Sidebar context
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => children,
  Sidebar: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "sidebar" }, children),
  SidebarContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "sidebar-content" }, children),
  SidebarHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "sidebar-header" }, children),
  SidebarTrigger: () =>
    React.createElement(
      "button",
      { "data-testid": "sidebar-trigger" },
      "Toggle Sidebar"
    ),
  SidebarInset: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "sidebar-inset" }, children),
}));

// Export auth mocks for direct access in tests
export const authMocks = {
  useSession,
  signIn,
  signOut,
  getSession,
  getCsrfToken,
  getProviders,
  getProfileByAlias: vi.fn(),
};
