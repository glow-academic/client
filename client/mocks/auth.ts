// client/mocks/auth.ts

import { vi } from "vitest";

// --- Core Session Data ---
export const mockSessionData = {
  data: {
    user: {
      id: "test-user-id-123",
      name: "Test User",
      email: "test@example.com",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  status: "authenticated" as const,
};

export const mockUnauthenticatedSession = {
  data: null,
  status: "unauthenticated" as const,
};

// --- Profile Context Mocks ---
export const mockProfile = {
  id: "test-profile-id-abc",
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

// --- NextAuth Mocks ---
vi.mock("next-auth/react", () => ({
  useSession: vi.fn().mockReturnValue(mockSessionData),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn().mockResolvedValue(mockSessionData),
  getProviders: vi.fn().mockResolvedValue({}),
}));

// --- Profile Context Mocks ---
vi.mock("@/contexts/profile-context", () => ({
  useProfile: vi.fn(() => ({
    activeProfile: mockProfile,
    profiles: [mockProfile],
    isLoading: false,
    error: null,
    switchProfile: vi.fn(),
    updateProfile: vi.fn(),
    createProfile: vi.fn(),
    deleteProfile: vi.fn(),
  })),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// --- Authentication Utility Mocks ---
vi.mock("@/utils/auth/get-profile-by-alias", () => ({
  getProfileByAlias: vi.fn().mockResolvedValue(mockProfile),
}));

vi.mock("@/utils/auth/get-simulatable-profiles", () => ({
  getSimulatableProfiles: vi.fn().mockResolvedValue([mockProfile]),
}));

// --- Test Utilities ---
// Note: These mocks are set up above with vi.mock(), so we can access them directly
export const authMocks = {
  useSession: vi.fn().mockReturnValue(mockSessionData),
  signIn: vi.fn(),
  signOut: vi.fn(),
  useProfile: vi.fn(() => ({
    activeProfile: mockProfile,
    profiles: [mockProfile],
    isLoading: false,
    error: null,
    switchProfile: vi.fn(),
    updateProfile: vi.fn(),
    createProfile: vi.fn(),
    deleteProfile: vi.fn(),
  })),
};

/** Reset all auth mocks to their default state */
export const resetAuthMocks = () => {
  authMocks.useSession.mockReturnValue(mockSessionData);
  authMocks.signIn.mockResolvedValue(undefined);
  authMocks.signOut.mockResolvedValue(undefined);
  authMocks.useProfile.mockReturnValue({
    activeProfile: mockProfile,
    profiles: [mockProfile],
    isLoading: false,
    error: null,
    switchProfile: vi.fn(),
    updateProfile: vi.fn(),
    createProfile: vi.fn(),
    deleteProfile: vi.fn(),
  });
};

/** Set up authenticated user for a test */
export const setupAuthenticatedUser = (userData = {}) => {
  authMocks.useSession.mockReturnValue({
    ...mockSessionData,
    data: {
      ...mockSessionData.data,
      user: { ...mockSessionData.data.user, ...userData },
    },
  });
};

/** Set up unauthenticated user for a test */
export const setupUnauthenticatedUser = () => {
  authMocks.useSession.mockReturnValue(mockUnauthenticatedSession);
};

/** Set up specific profile for a test */
export const setupProfile = (profileData = {}) => {
  authMocks.useProfile.mockReturnValue({
    activeProfile: { ...mockProfile, ...profileData },
    profiles: [{ ...mockProfile, ...profileData }],
    isLoading: false,
    error: null,
    switchProfile: vi.fn(),
    updateProfile: vi.fn(),
    createProfile: vi.fn(),
    deleteProfile: vi.fn(),
  });
};
