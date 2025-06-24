# Mock Testing Setup

This directory contains comprehensive mock data and utilities for testing the application with different user roles and authentication states.

## Overview

The mock setup provides:
- **4 User Types**: Admin, Instructional, Instructor, TA (each with corresponding profiles)
- **Guest Mode**: Unauthenticated state support
- **Session Management**: Easy switching between user roles in tests
- **Role Context Integration**: Works with the `RoleProvider` for effective role simulation

## Generated Files

### `schema.ts`
Contains mock data for all database entities with meaningful relationships:
- **4 Users**: Each with unique IDs, names, and emails
- **4 Profiles**: One-to-one mapping with users, each having different roles
- **Related Entities**: Classes, scenarios, agents, rubrics, etc. with proper foreign key relationships

### `queries.ts` & `mutations.ts`
Auto-generated mocks for all database query and mutation functions.

### `api.ts`
Auto-generated mocks for all API functions in `utils/api` with proper response types and utility functions.

### `utils.tsx`
Testing utilities and providers for easy role-based testing.

## Usage Examples

### Basic Setup

```tsx
import { renderWithProviders, getSessionForRole } from '@/mocks/utils';
import { useSession } from 'next-auth/react';
import { vi } from 'vitest';

const MyComponent = () => {
  const { data: session } = useSession();
  const { effectiveRole } = useRole();
  
  return (
    <div>
      <div data-testid="user-name">{session?.user?.name}</div>
      <div data-testid="role">{effectiveRole}</div>
    </div>
  );
};
```

### Testing with Default Admin Role

```tsx
it('should render with admin by default', () => {
  renderWithProviders(<MyComponent />);
  
  expect(screen.getByTestId('user-name')).toHaveTextContent('Admin User');
  expect(screen.getByTestId('role')).toHaveTextContent('admin');
});
```

### Testing with Specific Roles

```tsx
it('should work with instructor role', () => {
  // Get the instructor session data
  const instructorSession = getSessionForRole('instructor');
  
  // Mock useSession to return instructor data
  vi.mocked(useSession).mockReturnValue({
    data: instructorSession,
    status: 'authenticated',
    update: vi.fn(),
  });

  renderWithProviders(<MyComponent />, 'instructor', {
    session: instructorSession,
  });
  
  expect(screen.getByTestId('user-name')).toHaveTextContent('Instructor User');
  expect(screen.getByTestId('role')).toHaveTextContent('instructor');
});
```

### Testing Guest Mode

```tsx
it('should handle unauthenticated users', () => {
  // Mock useSession to return no session
  vi.mocked(useSession).mockReturnValue({
    data: null,
    status: 'unauthenticated',
    update: vi.fn(),
  });

  renderWithProviders(<MyComponent />, 'guest', {
    session: null,
  });
  
  expect(screen.getByTestId('role')).toHaveTextContent('guest');
});
```

### Testing All Role Types

```tsx
it('should work with all roles', () => {
  const roles = ['admin', 'instructional', 'instructor', 'ta'] as const;
  
  roles.forEach(role => {
    const session = getSessionForRole(role);
    
    vi.mocked(useSession).mockReturnValue({
      data: session,
      status: 'authenticated',
      update: vi.fn(),
    });

    const { unmount } = renderWithProviders(<MyComponent />, role, {
      session,
    });
    
    expect(screen.getByTestId('role')).toHaveTextContent(role);
    
    unmount();
  });
});
```

### Testing API Functions

```tsx
import { 
  startEvalMock, 
  getEvalRunStatusMock, 
  apiMocks,
  setApiMockResponse,
  setApiMockError,
  resetAllApiMocks 
} from '@/mocks/api';
import { startEval } from '@/utils/api/evals/start-eval';

it('should handle successful eval start', async () => {
  // The mock is automatically applied, just call the function
  const result = await startEval({ eval_id: 'test-eval' });
  
  expect(result.success).toBe(true);
  expect(result.eval_run_ids).toEqual(['eval-run-1', 'eval-run-2']);
  expect(startEvalMock).toHaveBeenCalledWith({ eval_id: 'test-eval' });
});

it('should handle API errors', async () => {
  // Override the mock to return an error
  setApiMockError(startEvalMock, new Error('API Error'));
  
  await expect(startEval({ eval_id: 'test-eval' })).rejects.toThrow('API Error');
});

it('should handle custom responses', async () => {
  // Override the mock with custom response
  setApiMockResponse(startEvalMock, {
    success: false,
    message: 'Custom error message',
    status: 'error'
  });
  
  const result = await startEval({ eval_id: 'test-eval' });
  expect(result.success).toBe(false);
  expect(result.message).toBe('Custom error message');
});

// Clean up mocks between tests
afterEach(() => {
  resetAllApiMocks();
});
```

### Available API Mock Categories

- **Assistants**: `messageAssistant`, `startAssistant`, `stopAssistant`
- **Documents**: `deleteDocument`, `downloadDocument`, `finalizeDocumentUpload`, `processCourse`
- **Evaluations**: `getEvalRunStatus`, `runEval`, `startEval`, `stopAllEvalRuns`
- **Profiles**: `downloadReport`, `downloadReportLegacy`
- **Scenarios**: `newScenario`, `testScenario`
- **Simulations**: `continueSimulation`, `createSimulationMessage`, `startSimulation`, `stopSimulation`

## Available Utilities

### `renderWithProviders(ui, role?, options?)`
Renders components with all necessary providers:
- `SessionProvider` (next-auth)
- `QueryClientProvider` (react-query)
- `RoleProvider` (role context)

**Parameters:**
- `ui`: React element to render
- `role`: ProfileRole ('admin' | 'instructional' | 'instructor' | 'ta' | 'guest')
- `options.session`: Override session data
- `options.queryClient`: Custom QueryClient instance
- `options.skipRoleProvider`: Skip RoleProvider wrapper

### `getSessionForRole(role)`
Returns session data for a specific role.

### `getProfileForRole(role)`
Returns profile data for a specific role.

### `mockSessionForRole(role)`
Returns properly formatted mock session object for manual mocking.

### Constants
- `TEST_ROLES`: Array of all available roles
- `TEST_USERS`: Object with session data for each role

### API Mock Utilities
- `apiMocks`: Object containing all API mock functions
- `resetAllApiMocks()`: Clears all API mock call history
- `setApiMockResponse(mockFn, response)`: Override mock to return specific response
- `setApiMockError(mockFn, error)`: Override mock to throw specific error

## Mock Data Structure

### Users
```typescript
{
  id: number,
  name: string,
  email: string,
  emailVerified: string,
  image: string
}
```

### Profiles
```typescript
{
  id: string,
  userId: number,
  firstName: string,
  lastName: string,
  alias: string,
  role: 'admin' | 'instructional' | 'instructor' | 'ta',
  classIds: string[],
  // ... other fields
}
```

### Session Data
```typescript
{
  user: {
    id: string,
    name: string,
    email: string,
    image: string | null
  },
  profile: ProfileData,
  expires: string
}
```

## Role Mapping

| Role | User Index | Profile Role | Description |
|------|------------|--------------|-------------|
| admin | 0 | admin | Full system access |
| instructional | 1 | instructional | Instructional design access |
| instructor | 2 | instructor | Teaching access |
| ta | 3 | ta | Teaching assistant access |
| guest | - | - | Unauthenticated user |

## Best Practices

1. **Clean Up Between Tests**: Reset mocks in `afterEach` hooks
2. **Use Specific Roles**: Test role-specific functionality with appropriate roles
3. **Test Guest Mode**: Always test unauthenticated states
4. **Verify Relationships**: Check user-profile relationships in tests
5. **Mock Consistently**: Use the provided utilities for consistent mocking

## Regenerating Mocks

To regenerate mock data with updated schema:

```bash
cd database && node scripts/generate-mocks.js
```

This will:
- Read the latest database schema
- Scan all API functions in `utils/api`
- Generate 4 users and 4 profiles with proper relationships
- Update all query, mutation, and API mocks
- Maintain meaningful test data with proper response types

## Integration with Role Context

The mock setup integrates seamlessly with the `RoleProvider`:
- `effectiveRole` reflects the simulated role
- Role switching works in tests
- Guest mode is properly handled
- Navigation permissions are respected

This setup makes it easy to test role-based functionality and ensures your components work correctly for all user types. 