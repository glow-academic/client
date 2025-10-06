# Unified Test Harness

This directory contains the unified test harness that provides a streamlined testing experience for both Vitest and Cypress.

## Overview

The unified test harness automatically generates:

- Mockable server actions (queries and mutations)
- Mock data with proper relationships
- Comprehensive Vitest setup with centralized mocking
- Custom render function with all context providers
- Centralized mock factory for both Vitest and Cypress

## Generated Files

### Core Testing Infrastructure

- `setup.ts` - Comprehensive Vitest setup with global mocks and server action mocking
- `custom-render.tsx` - Custom render function with all context providers
- `example-usage.test.tsx` - Example showing how to use the new setup

### Mock Data

- `../mocks/schema.ts` - Mock data with proper relationships (generated)

### Mock Factory

- `../lib/testing/create-mockable-action.ts` - Centralized mock factory (generated)

### Server Actions

- `../utils/queries/*` - Mockable query functions (generated)
- `../utils/mutations/*` - Mockable mutation functions (generated)

## Usage

### Running the Generator

```bash
# Generate from latest database state (recommended)
node database/scripts/generate-test-harness.js --pull

# Generate from existing snapshot (faster)
node database/scripts/generate-test-harness.js --skip-snapshot

# Generate from schema file
node database/scripts/generate-test-harness.js --from-schema
```

### Writing Tests

1. **Import the custom render function:**

   ```typescript
   import { render, screen, waitFor } from "@/test/custom-render";
   ```

2. **Write your tests normally:**

   ```typescript
   describe("My Component", () => {
     it("should render correctly", async () => {
       render(<MyComponent />);

       await waitFor(() => {
         expect(screen.getByText("Expected Text")).toBeInTheDocument();
       });
     });
   });
   ```

3. **Server actions are automatically mocked:**
   - `getAllAgents()` returns mock data from `mocks/schema.ts`
   - `createAgent(data)` returns mock data with your input merged
   - `updateAgent(id, data)` returns mock data with your updates
   - `deleteAgent(id)` returns the deleted mock record

### What's Included Automatically

#### Context Providers

- `ProfileProvider` with mock profile
- `QueryClient` with retry disabled
- `AnalyticsProvider`
- `AssistantProvider`
- `WebSocketProvider`
- `TourProvider`
- `SidebarProvider`

#### Global Mocks

- Next.js navigation (`useRouter`, `usePathname`)
- Next.js image component
- Markdown component
- DOM APIs (`ResizeObserver`, `IntersectionObserver`, etc.)
- Environment variables
- Next-Auth session

#### Server Action Mocks

All server actions are automatically mocked to return appropriate data from `mocks/schema.ts`:

- Query functions (get all, get by ID, get by foreign key)
- Mutation functions (create, update, delete - both single and multiple)

## Migration from Old Setup

### Before (Old Way)

```typescript
import { renderWithMocks } from '@/test/renderWithMocks';

describe("My Component", () => {
  it("should work", () => {
    renderWithMocks(<MyComponent />);
    // Manual mocking required for server actions
  });
});
```

### After (New Way)

```typescript
import { render } from '@/test/custom-render';

describe("My Component", () => {
  it("should work", () => {
    render(<MyComponent />);
    // Server actions automatically mocked!
  });
});
```

## Benefits

1. **Simplified Testing**: No need for `renderWithMocks` or manual provider setup
2. **Automatic Mocking**: All server actions are mocked automatically
3. **Consistent Data**: Mock data with proper relationships
4. **Comprehensive Setup**: All common mocks included out of the box
5. **Dual Environment Support**: Works with both Vitest and Cypress
6. **Type Safety**: Full TypeScript support with proper types

## Configuration

### Vitest Configuration

Ensure your `vitest.config.ts` includes:

```typescript
export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    // ... other config
  },
});
```

### Cypress Integration

The mock factory automatically detects Cypress environment and uses Cypress tasks for mocking when available.

## Troubleshooting

### Server Actions Not Mocked

- Ensure you're importing from `@/test/custom-render`
- Check that the generator has been run recently
- Verify that `test/setup.ts` is being loaded by Vitest

### Missing Providers

- The custom render includes all common providers
- If you need additional providers, modify `custom-render.tsx`

### Mock Data Issues

- Regenerate mock data with `--pull` to match current database
- Check `mocks/schema.ts` for the generated mock data structure
