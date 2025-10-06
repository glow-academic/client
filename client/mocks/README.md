# Test Mocks Documentation

This directory contains modular mock files that are imported by the test setup to provide comprehensive mocking for the application. The mocks are organized into 4 main categories for better maintainability and organization.

## File Structure

```
client/mocks/
├── api.ts          # API endpoint mocks and response patterns
├── auth.ts         # Authentication, sessions, and profile mocks
├── navigation.ts   # Routing and navigation mocks
├── extra.ts        # Global mocks, browser APIs, third-party libraries
├── factories.ts    # Auto-generated mock factories (do not edit manually)
├── mock-db.ts      # Auto-generated mock database (do not edit manually)
└── schema.ts       # Hand-curated test data (edit as needed)
```

## Mock Files Overview

### 📡 `api.ts` - API Endpoint Mocks

**Purpose**: Mock API calls made with fetch to your Next.js Route Handlers and external APIs.

**Key Responsibilities**:

- Mock individual API client functions
- Provide reusable response patterns (`mockSuccessResponse`, `mockErrorResponse`)
- Export helper functions for easy test setup
- Mock global `fetch` API

**What to add here**:

- New API endpoint mocks as you add them to your application
- Custom response patterns for specific API scenarios
- Mock implementations for external API integrations
- Error handling patterns

**Example additions**:

```typescript
// Add new API mocks
export const uploadFileMock = vi
  .fn()
  .mockResolvedValue(mockSuccessResponse({ fileId: "file-123" }));

// Add to vi.mock calls
vi.mock("@/utils/api/files", () => ({
  uploadFile: uploadFileMock,
}));

// Add to apiMocks export
export const apiMocks = {
  // ... existing mocks
  uploadFile: uploadFileMock,
};
```

### 🔐 `auth.ts` - Authentication & Profile Mocks

**Purpose**: Handle everything related to user identity, sessions, and permissions.

**Key Responsibilities**:

- Mock NextAuth session data and hooks
- Mock profile context and related utilities
- Provide helper functions to change user state for different tests
- Mock authentication-related API calls

**What to add here**:

- New authentication providers or methods
- Additional profile properties or context features
- Role-based access control mocks
- Session management utilities

**Example additions**:

```typescript
// Add new profile properties
export const mockProfile = {
  // ... existing properties
  preferences: {
    theme: "dark",
    notifications: true,
  },
  permissions: ["read", "write", "admin"],
};

// Add new auth utilities
export const setupAdminUser = () => {
  setupProfile({ role: "admin", permissions: ["admin"] });
};
```

### 🧭 `navigation.ts` - Routing & Navigation Mocks

**Purpose**: Give complete control over application routing behavior during tests.

**Key Responsibilities**:

- Mock Next.js navigation hooks (`useRouter`, `usePathname`, `useSearchParams`)
- Export mocked router functions for assertions
- Mock navigation utilities and breadcrumbs
- Provide navigation state management

**What to add here**:

- New navigation hooks or utilities
- Custom routing logic mocks
- Breadcrumb generation mocks
- Route protection mocks

**Example additions**:

```typescript
// Add new navigation hooks
vi.mock("next/navigation", () => ({
  // ... existing mocks
  useParams: () => ({ id: "test-id" }),
  useSelectedLayoutSegment: () => "dashboard",
}));

// Add navigation utilities
export const setupProtectedRoute = (requiresAuth = true) => {
  if (requiresAuth) {
    setupAuthenticatedUser();
  } else {
    setupUnauthenticatedUser();
  }
};
```

### ✨ `extra.ts` - Global & Third-Party Mocks

**Purpose**: Catch-all for global mocks that don't fit into other categories.

**Key Responsibilities**:

- Mock browser APIs (ResizeObserver, IntersectionObserver, matchMedia)
- Mock third-party UI libraries (charts, notifications, uploads)
- Mock utility modules (logger, database connections)
- Set up environment variables for testing

**What to add here**:

- New third-party library integrations
- Additional browser API mocks
- Component library mocks
- Global utility mocks

**Example additions**:

```typescript
// Add new third-party library
vi.mock("date-fns", () => ({
  format: vi.fn((date) => "2024-01-01"),
  parseISO: vi.fn((date) => new Date(date)),
  addDays: vi.fn(
    (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000),
  ),
}));

// Add new browser API
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});
```

## Best Practices

### 1. **Keep Mocks Focused**

Each mock file should have a clear, single responsibility. Don't mix concerns between files.

### 2. **Export Test Utilities**

Provide helper functions that make it easy to set up specific test scenarios:

```typescript
// Good: Easy to use in tests
export const setupAuthenticatedUser = (userData = {}) => {
  authMocks.useSession.mockReturnValue({
    ...mockSessionData,
    data: {
      ...mockSessionData.data,
      user: { ...mockSessionData.data.user, ...userData },
    },
  });
};

// Usage in test:
setupAuthenticatedUser({ role: "admin" });
```

### 3. **Use Consistent Patterns**

Follow the established patterns in each file for consistency:

- Export mock objects for easy access
- Provide reset functions for cleanup
- Use descriptive function names
- Include TypeScript types

### 4. **Document Complex Mocks**

Add comments for complex mock implementations or when mocking behavior differs from real behavior.

### 5. **Test Your Mocks**

Consider writing tests for complex mock utilities to ensure they work as expected.

## Integration with Test Setup

The mock files are automatically imported by `client/test/setup.ts`:

```typescript
// Import all mock modules to execute their vi.mock() calls globally
import "@/mocks/api";
import "@/mocks/auth";
import "@/mocks/navigation";
import "@/mocks/extra";
```

This ensures that all mocks are available globally for all tests without needing to import them individually.

## Maintenance

### When to Update Mocks

1. **Adding new features**: Add corresponding mocks for new API endpoints, components, or utilities
2. **Updating dependencies**: Update mocks when upgrading third-party libraries
3. **Changing authentication**: Update auth mocks when modifying authentication flow
4. **Adding new routes**: Update navigation mocks for new routing patterns

### Testing Mock Changes

After updating mocks, run your test suite to ensure:

- No existing tests break
- New functionality is properly mocked
- Mock behavior matches expected behavior

### Regenerating Auto-Generated Files

The following files are auto-generated and should not be edited manually:

- `factories.ts` - Generated by test harness script
- `mock-db.ts` - Generated by test harness script

To regenerate these files, run:

```bash
cd database && node scripts/generate-test-harness.js
```

## Troubleshooting

### Common Issues

1. **Mocks not working**: Ensure the mock file is properly imported in `setup.ts`
2. **Type errors**: Check that mock functions have proper TypeScript types
3. **Inconsistent behavior**: Use reset functions in `beforeEach` or `afterEach` hooks
4. **Missing mocks**: Add new mocks to the appropriate file and export them

### Debugging Tips

1. **Check mock calls**: Use `vi.mocked(functionName).mock.calls` to see how mocks were called
2. **Verify imports**: Ensure mock files are imported in the correct order
3. **Test isolation**: Use `vi.clearAllMocks()` in `afterEach` to ensure test isolation
4. **Console logging**: Add temporary `console.log` statements to debug mock behavior

## Examples

### Testing with Mocks

```typescript
import { render, screen } from '@/test/custom-render';
import { setupAuthenticatedUser, setupProfile } from '@/mocks/auth';
import { mockApiSuccess } from '@/mocks/api';
import { apiMocks } from '@/mocks/api';

describe('User Dashboard', () => {
  beforeEach(() => {
    setupAuthenticatedUser({ role: 'admin' });
    setupProfile({ firstName: 'John', lastName: 'Doe' });
    mockApiSuccess(apiMocks.getAnalytics, { totalUsers: 150 });
  });

  it('displays user information', () => {
    render(<UserDashboard />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
```

This modular approach makes your test mocks more maintainable, organized, and easier to extend as your application grows.
