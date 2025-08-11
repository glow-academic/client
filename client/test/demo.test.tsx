// Demo test showing the new unified test harness in action
import { render, screen, waitFor } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// Simple component that would use server actions
const DemoComponent = () => {
  return (
    <div>
      <h1>Demo Component</h1>
      <p>This component demonstrates the new test harness</p>
      <ul>
        <li>✅ All context providers included automatically</li>
        <li>✅ Server actions automatically mocked</li>
        <li>✅ No need for renderWithMocks</li>
        <li>✅ Global mocks configured</li>
      </ul>
    </div>
  );
};

describe("Unified Test Harness Demo", () => {
  it("should render with all providers and mocks", async () => {
    // Simply use the custom render - everything is set up automatically!
    render(<DemoComponent />);

    await waitFor(() => {
      expect(screen.getByText("Demo Component")).toBeInTheDocument();
      expect(
        screen.getByText("All context providers included automatically")
      ).toBeInTheDocument();
    });
  });

  it("should have working global mocks", () => {
    // Test that global mocks are working
    render(<DemoComponent />);

    // These would normally cause issues without mocks
    expect(window.matchMedia).toBeDefined();
    expect(global.ResizeObserver).toBeDefined();
    expect(global.IntersectionObserver).toBeDefined();
  });
});

/*
This test demonstrates the key benefits of the unified test harness:

1. **Simplified Testing**: Just import from '@/test/custom-render' and use render()
2. **Automatic Provider Setup**: All context providers are included automatically
3. **Server Action Mocking**: Any server actions used by components are automatically mocked
4. **Global Mocks**: Common browser APIs and Next.js components are mocked
5. **Consistent Environment**: Same setup works across all tests

To use this in your own tests:

1. Replace imports:
   - OLD: import { render } from '@/test/custom-render'
   - NEW: import { render } from '@/test/custom-render'

2. Replace render calls:
   - OLD: render(<Component />)
   - NEW: render(<Component />)

3. Write tests normally - everything else is handled automatically!
*/
