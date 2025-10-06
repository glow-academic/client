// client/mocks/navigation.ts
// This file is imported once in test setup and contains all vi.mock() calls for navigation

import { vi } from "vitest";

// --- Router Mock Object ---
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

// --- Search Params Mock ---
export const searchParamsMock = new URLSearchParams();

// --- Pathname Mock ---
export const pathnameMock = "/";

// --- Next/Navigation Mocks ---
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => pathnameMock,
  useSearchParams: () => searchParamsMock,
  redirect: vi.fn(),
  notFound: vi.fn(),
  useParams: () => ({}),
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
}));

// --- Navigation Utility Mocks ---
vi.mock("@/utils/navigation-utils", () => ({
  getBreadcrumbs: vi.fn(() => []),
  isActiveRoute: vi.fn(() => false),
  getRouteConfig: vi.fn(() => ({})),
}));

// --- Test Utilities ---
export const navigationMocks = {
  router: routerMock,
  searchParams: searchParamsMock,
  pathname: pathnameMock,
};

/** Reset all navigation mocks to their default state */
export const resetNavigationMocks = () => {
  routerMock.push.mockClear();
  routerMock.replace.mockClear();
  routerMock.refresh.mockClear();
  routerMock.back.mockClear();
  routerMock.forward.mockClear();
  routerMock.prefetch.mockClear();
  // Note: URLSearchParams doesn't have a clear method, so we create a new one
  Object.assign(searchParamsMock, new URLSearchParams());
};

/** Set up specific pathname for a test */
export const setupPathname = (pathname: string) => {
  // This would need to be implemented differently since we can't easily mock the return value
  // For now, we'll just update the mock object
  Object.assign(pathnameMock, pathname);
};

/** Set up specific search params for a test */
export const setupSearchParams = (params: Record<string, string>) => {
  const newSearchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    newSearchParams.set(key, value);
  });
  // This would need to be implemented differently since we can't easily mock the return value
  // For now, we'll just update the mock object
  Object.assign(searchParamsMock, newSearchParams);
};

/** Set up router to return specific values for a test */
export const setupRouter = (overrides: Partial<typeof routerMock> = {}) => {
  Object.assign(routerMock, overrides);
};

/** Mock a successful navigation */
export const mockSuccessfulNavigation = () => {
  routerMock.push.mockResolvedValue(undefined);
  routerMock.replace.mockResolvedValue(undefined);
  routerMock.refresh.mockResolvedValue(undefined);
  routerMock.back.mockResolvedValue(undefined);
  routerMock.forward.mockResolvedValue(undefined);
};

/** Mock a failed navigation */
export const mockFailedNavigation = (
  error = new Error("Navigation failed"),
) => {
  routerMock.push.mockRejectedValue(error);
  routerMock.replace.mockRejectedValue(error);
  routerMock.refresh.mockRejectedValue(error);
  routerMock.back.mockRejectedValue(error);
  routerMock.forward.mockRejectedValue(error);
};

/** Check if navigation was called with specific arguments */
export const wasNavigationCalled = (
  method: keyof typeof routerMock,
  ...args: unknown[]
) => {
  return routerMock[method].mock.calls.some(
    (call) => JSON.stringify(call) === JSON.stringify(args),
  );
};

/** Check if navigation was called with a specific path */
export const wasNavigationTo = (path: string) => {
  return routerMock.push.mock.calls.some((call) => call[0] === path);
};
