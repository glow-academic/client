// Centralized mock module for next-auth and authentication
// This file is imported once in test setup and contains all vi.mock() calls for auth

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
