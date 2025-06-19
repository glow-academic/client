// mocks/utils.tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import React from 'react';
import { vi } from 'vitest';
import { ProfileRole } from '@/types';

/* ------------------------------------------------------------------ */
/* 1️⃣  React-Query test helper                                        */
/* ------------------------------------------------------------------ */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

const defaultSession = {
  user: { id: 'test-user', name: 'Test User', email: 'test@example.com' },
  expires: '2099-01-01T00:00:00.000Z',
};

/**
 * Renders UI wrapped in:
 *   • SessionProvider  (next-auth)
 *   • QueryClientProvider (react-query)
 *
 * You can override `session` or provide your own `queryClient` if you
 * need to pre-seed the cache for a specific test.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  testUserRole: ProfileRole,
  options?: {
    session?: typeof defaultSession | null;
    queryClient?: QueryClient;
  },
) {
  const qc = options?.queryClient ?? createQueryClient();
  const session = options?.session ?? defaultSession;

  return render(
    <SessionProvider session={session}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </SessionProvider>,
  );
}

/* ------------------------------------------------------------------ */
/* 2️⃣  global mocks (applied once for the whole test run)             */
/* ------------------------------------------------------------------ */

/* -- useRouter ------------------------------------------------------ */
export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};
vi.mock('next/navigation', () => ({
  // anything else from next/navigation that your code imports
  useRouter: () => routerMock,
}));

/* -- useSession ----------------------------------------------------- */
vi.mock('next-auth/react', async () => {
  // import the real module first so we don't break SessionProvider, signIn, etc
  const actual = await vi.importActual<typeof import('next-auth/react')>(
    'next-auth/react',
  );

  return {
    ...actual,
    /**
     * By default every test gets an "authenticated" user.
     * Override per-test with:
     *   vi.mocked(useSession).mockReturnValue({ data: null, status: 'unauthenticated' })
     */
    useSession: () => ({
      data: defaultSession,
      status: 'authenticated',
    }),
  };
});
