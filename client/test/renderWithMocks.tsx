// helpers/testing/renderWithMocks.tsx
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export type MockOverrides = {
  // This type definition is now more for documentation,
  // as we'll handle overrides directly in the test.
  queries?: Record<string, unknown>;
  mutations?: Record<string, unknown>;
};

// The only job of this function is to provide the QueryClient.
export function renderWithMocks(ui: React.ReactElement, overrides: MockOverrides = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  // Apply overrides to the queryClient
  if (overrides.queries) {
    queryClient.setQueryData(Object.keys(overrides.queries), overrides.queries);
  }

  if (overrides.mutations) {
    queryClient.setMutationDefaults(Object.keys(overrides.mutations), overrides.mutations);
  }

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}