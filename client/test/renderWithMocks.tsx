// helpers/testing/renderWithMocks.tsx
import { render } from "@testing-library/react";

// This helper provides a simple wrapper that relies on global mocks
// All providers are mocked globally in mocks/auth.ts
export function renderWithMocks(ui: React.ReactElement) {
  return render(ui);
}
