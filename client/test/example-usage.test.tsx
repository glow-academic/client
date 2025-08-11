// Example test demonstrating the new unified test harness
// This file shows how to use the custom render function and automatic mocking

import { render, screen, waitFor } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// Example component that uses server actions
const ExampleComponent = () => {
  // This component would use server actions like getAllAgents, createAgent, etc.
  // The server actions are automatically mocked by the test setup
  return (
    <div>
      <h1>Example Component</h1>
      <p>This component uses server actions that are automatically mocked</p>
    </div>
  );
};

describe("Example Usage", () => {
  it("should render without errors using custom render", async () => {
    // No need for renderWithMocks anymore! Just use the custom render
    render(<ExampleComponent />);

    // The component is automatically wrapped with all providers
    // Server actions are automatically mocked
    await waitFor(() => {
      expect(screen.getByText("Example Component")).toBeInTheDocument();
    });
  });

  it("demonstrates automatic server action mocking", async () => {
    // When your component calls server actions like:
    // - getAllAgents()
    // - createAgent(data)
    // - updateAgent(id, data)
    // - deleteAgent(id)
    //
    // They are automatically mocked to return data from mocks/schema.ts
    // No manual mocking required!

    render(<ExampleComponent />);

    // Your component can use any server action and it will work automatically
    // The mocks are set up in test/setup.ts and use data from mocks/schema.ts
  });
});

/*
How to use this new setup:

1. Import from the custom render instead of testing-library:
   import { render, screen, waitFor } from '@/test/custom-render';

2. Write your tests normally - no need for renderWithMocks:
   render(<YourComponent />);

3. Server actions are automatically mocked:
   - getAllAgents() returns mock data from mocks/schema.ts
   - createAgent(data) returns mock data with your input merged
   - updateAgent(id, data) returns mock data with your updates
   - deleteAgent(id) returns the deleted mock record

4. All context providers are automatically included:
   - ProfileProvider with mock profile
   - QueryClient with retry disabled
   - All other providers (Analytics, Assistant, WebSocket, etc.)

5. Global mocks are automatically set up:
   - Next.js navigation
   - Next.js image component
   - Markdown component
   - DOM APIs (ResizeObserver, IntersectionObserver, etc.)

This makes testing much simpler and more consistent!
*/
