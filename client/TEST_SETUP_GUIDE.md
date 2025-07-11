# Test Setup Guide

## Overview

This project now uses a centralized mock system for Vitest tests that automatically handles all imports. The system follows the specification provided, ensuring clean and maintainable test files.

## Architecture

### 1. Centralized Mock Modules

All mocks are organized into centralized modules in the `mocks/` directory:

- **`mocks/queries.ts`** - All query function mocks (`@/utils/queries/*`)
- **`mocks/mutations.ts`** - All mutation function mocks (`@/utils/mutations/*`)
- **`mocks/navigation.ts`** - Next.js navigation mocks (`next/navigation`, `next/link`)
- **`mocks/auth.ts`** - Authentication, contexts, and auth helper mocks

### 2. Global Test Setup

The `test/setup.ts` file imports all centralized mocks once per test session:

```typescript
// Global test setup - run once per test session
import "@testing-library/jest-dom";

// Import all centralized mock modules
import "@/mocks/queries";      // All query function mocks
import "@/mocks/mutations";    // All mutation function mocks  
import "@/mocks/navigation";   // Next.js navigation mocks
import "@/mocks/auth";         // Next-auth and auth helper mocks
```

### 3. Automatic Mock Detection

The test generation script automatically detects imports in components and adds the appropriate mock imports:

```typescript
// --- auto-generated mocks --------------------------------------------
import '@/mocks/navigation';
import '@/mocks/queries';
import '@/mocks/auth';
// ---------------------------------------------------------------------
```

## Mock Mapping Rules

The `mapImportToMock()` function maps imports to mock modules:

1. **Queries**: `@/utils/queries/*` → `@/mocks/queries`
2. **Mutations**: `@/utils/mutations/*` → `@/mocks/mutations`
3. **Navigation**: `next/navigation`, `next/link` → `@/mocks/navigation`
4. **Auth**: `next-auth/react` → `@/mocks/auth`
5. **Auth Helpers**: `@/utils/auth/*` → `@/mocks/auth`
6. **Contexts**: `@/contexts/*` → `@/mocks/auth`
7. **Everything else**: Left as real imports

## Available Scripts

```bash
# Generate test files for all components
npm run generate-tests

# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only component tests
npm run test:components
```

## Test Generation Features

### Automatic Mock Detection
- Scans component imports
- Maps imports to appropriate mock modules
- Fails fast if unknown imports are found
- Deduplicates mock imports

### Orphaned Test Cleanup
- Removes test files for components that no longer exist
- Keeps test directory clean
- Reports cleanup actions

### Smart Analysis
- Detects component features (props, hooks, API calls, etc.)
- Generates appropriate test structure
- Includes helpful comments and examples

## Test File Structure

Generated test files follow this structure:

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- auto-generated mocks --------------------------------------------
import '@/mocks/navigation';
import '@/mocks/queries';
import '@/mocks/auth';
// ---------------------------------------------------------------------

import ComponentName from '@/components/path/ComponentName';

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<ComponentName />);
      expect(true).toBe(false); // IMPLEMENT: Basic rendering test
    });
  });

  // Additional test suites based on component features...
});
```

## Implementation Guidelines

### 1. Test Implementation
All generated tests include deliberate failing assertions (`expect(true).toBe(false)`) to ensure they're implemented:

```typescript
// Replace this:
expect(true).toBe(false); // IMPLEMENT: Basic rendering test

// With actual test logic:
render(<ComponentName />);
expect(screen.getByRole('button')).toBeInTheDocument();
```

### 2. Mock Usage
Tests can use mocked functions directly:

```typescript
import { getUsers } from '@/utils/queries/users/get-users';
import { vi } from 'vitest';

// In test:
vi.mocked(getUsers).mockResolvedValue([{ id: 1, name: 'Test User' }]);
```

### 3. Provider Setup
For components requiring providers:

```typescript
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};
```

## Extending the System

### Adding New Mock Categories

1. **Create new mock file** in `mocks/` directory
2. **Add import** to `test/setup.ts`
3. **Update mapping** in `mapImportToMock()` function
4. **Regenerate tests** with `npm run generate-tests`

### Example: Adding API mocks

```typescript
// mocks/api.ts
import { vi } from 'vitest';

vi.mock('@/utils/api/fetch-data', () => ({
  fetchData: vi.fn(),
}));

// In mapImportToMock():
if (specifier.match(/^@\/utils\/api\/(.+)$/)) return '@/mocks/api';
```

## Troubleshooting

### Unknown Import Error
If you see: `🚨 Unmapped import(s) in components/Foo.tsx: some-import`

1. Add mapping rule to `mapImportToMock()`
2. Create appropriate mock file
3. Regenerate tests

### Mock Not Working
1. Ensure mock is imported in `test/setup.ts`
2. Check `vi.mock()` call syntax
3. Verify import path matches exactly

### Test Failures
1. Check if component needs additional providers
2. Verify mock return values match expected types
3. Add missing context mocks if needed

## Benefits

- **Zero boilerplate** - No manual mock setup in test files
- **Automatic detection** - Imports are automatically mapped to mocks
- **Centralized maintenance** - All mocks in one place
- **Fast startup** - Mocks are loaded once per test session
- **Fail-fast** - Unknown imports cause immediate errors
- **Clean tests** - No vi.mock() calls cluttering test files

## Migration from Old Setup

1. **Remove old setup** - Delete `vitest.setup.ts`
2. **Update config** - Point to `test/setup.ts`
3. **Regenerate tests** - Run `npm run generate-tests`
4. **Implement tests** - Replace failing assertions with real tests

The system is now ready for use! All imports are automatically mocked, and you can focus on writing actual test logic instead of managing mock setup. 