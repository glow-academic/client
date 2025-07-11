/**
 * helpers/testing/renderWithMocks.tsx
 *
 * One helper import → 100 % of mocks in place, zero boiler-plate
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryProxy } from "@/mocks/queries";
import { mutationProxy } from "@/mocks/mutations";
import "@/mocks/auth";
import "@/mocks/navigation";
import { render } from "@testing-library/react";

export type MockOverrides = {
  queries?: Record<string, unknown>;
  mutations?: Record<string, unknown>;
};

/**
 * Usage:
 *   renderWithMocks(<Home />, {
 *     queries: {
 *       getAllSimulations : [],
 *       getAllCohorts     : [],
 *     },
 *   })
 */
export function renderWithMocks(
  ui: React.ReactElement,
  { queries = {}, mutations = {} }: MockOverrides = {}
) {
  // apply overrides ---------------------------------------------------
  Object.entries(queries).forEach(([fnName, value]) => {
    // ensure the stub exists, then override
    queryProxy[fnName]?.mockResolvedValue(value);
  });

  Object.entries(mutations).forEach(([fnName, value]) => {
    mutationProxy[fnName]?.mockResolvedValue(value);
  });

  // fresh React-Query client each time --------------------------------
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
