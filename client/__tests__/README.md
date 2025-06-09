# Component Testing System

This directory contains an automated testing system for React components that mirrors your `components/` folder structure. The system automatically generates test files for every `.tsx` component and includes failing tests to ensure implementation.

## 🚀 Features

- **Automatic Test Generation**: Scans `components/` directory and creates corresponding test files
- **Component Analysis**: Analyzes components to detect hooks, props, API calls, routing, and more
- **Smart Test Templates**: Generates appropriate test templates based on component features
- **Failing Tests by Design**: All generated tests include failing assertions to ensure implementation
- **Watch Mode**: Automatically regenerates tests when components change
- **Coverage Reporting**: Tracks which components have implemented tests
- **Vitest Integration**: Uses Vitest for fast, modern testing with TypeScript support

## 📁 Directory Structure

```
__tests__/
├── README.md                           # This documentation
├── component-test-coverage.md          # Auto-generated coverage report
├── vitest.setup.ts                     # Test setup and global mocks
├── Analytics.test.tsx                  # Component tests (auto-generated)
├── ChatInterface.test.tsx
├── ClassForm.test.tsx
├── analytics/                          # Mirrors components/analytics/
│   ├── Logs.test.tsx
│   ├── Overview.test.tsx
│   ├── Performance.test.tsx
│   └── Reports.test.tsx
├── classes/                            # Mirrors components/classes/
│   ├── ClassDetails.test.tsx
│   ├── ClassEdit.test.tsx
│   ├── ClassStatus.test.tsx
│   └── NewClass.test.tsx
└── ...                                 # Mirrors entire components/ structure
```

## 🛠️ Available Commands

### Basic Testing Commands
```bash
# Run all component tests
npm run test:components

# Run tests with interactive UI
npm run test:components:ui

# Run tests with coverage report
npm run test:components:coverage

# Run all tests (alias for test:components)
npm run test

# Run tests in watch mode
npm run test:watch
```

### Test Generation Commands
```bash
# Generate test files for all components
npm run test:components:generate

# Check for component changes (exit code 1 if changes found)
npm run test:components:check

# Watch for component changes and auto-regenerate tests
npm run test:components:watch

# Force regenerate all component tests
npm run test:components:force
```

## 🔄 Automatic Integration

The component test generator runs automatically when you start the development server:

```bash
npm run dev
# This runs: drizzle-kit pull && generate-table-tests.js && generate-component-tests.js && next dev
```

## 📝 Test Template Structure

Each generated test file includes:

### 1. **Rendering Tests**
- Basic component rendering
- Props testing (if props interface detected)
- Accessibility attributes

### 2. **User Interaction Tests** (if applicable)
- Form submissions (if form handling detected)
- State changes (if useState detected)
- User events (clicks, hover, focus)

### 3. **API Integration Tests** (if applicable)
- API calls and data fetching
- Loading states
- Error handling

### 4. **Navigation Tests** (if applicable)
- Router interactions (if Next.js router detected)

### 5. **Edge Cases**
- Error scenarios
- Invalid props handling

### 6. **Component Analysis Comments**
Detailed analysis of detected features:
- Export types (default/named)
- Props interfaces
- Hook usage
- Client/server component type
- API integration
- Form handling

## 🧪 Example Test File

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import Analytics from '@/components/Analytics';

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      // TODO: Implement basic rendering test for Analytics
      render(<Analytics />);
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Basic rendering test for Analytics
    });

    it('should have correct accessibility attributes', () => {
      // TODO: Test accessibility features
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Accessibility testing for Analytics
    });
  });

  describe('User Interactions', () => {
    it('should handle user events', async () => {
      // TODO: Test click, hover, focus events
      const user = userEvent.setup();
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: User events test for Analytics
    });
  });
});
```

## 🎯 Implementation Guide

### Step 1: Review Generated Tests
1. Check `component-test-coverage.md` for overview
2. Review failing tests in generated files
3. Identify components that need testing

### Step 2: Implement Basic Tests
Replace failing assertions with actual test logic:

```typescript
// Before (generated)
it('should render without crashing', () => {
  render(<ComponentName />);
  expect(true).toBe(false); // IMPLEMENT: Basic rendering test
});

// After (implemented)
it('should render without crashing', () => {
  render(<ComponentName />);
  expect(screen.getByRole('main')).toBeInTheDocument();
});
```

### Step 3: Add Props Testing
```typescript
it('should render with props', () => {
  const props = { title: 'Test Title', count: 5 };
  render(<ComponentName {...props} />);
  expect(screen.getByText('Test Title')).toBeInTheDocument();
  expect(screen.getByText('5')).toBeInTheDocument();
});
```

### Step 4: Test User Interactions
```typescript
it('should handle button clicks', async () => {
  const user = userEvent.setup();
  const mockFn = vi.fn();
  render(<ComponentName onClick={mockFn} />);
  
  await user.click(screen.getByRole('button'));
  expect(mockFn).toHaveBeenCalledTimes(1);
});
```

### Step 5: Mock API Calls
```typescript
it('should handle API calls', async () => {
  const mockData = { id: 1, name: 'Test' };
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockData),
  });
  
  render(<ComponentName />);
  await waitFor(() => {
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
  
  expect(fetch).toHaveBeenCalledWith('/api/endpoint');
});
```

## 🔧 Configuration

### Vitest Configuration (`vitest.config.ts`)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

### Global Setup (`vitest.setup.ts`)
- Imports `@testing-library/jest-dom` for additional matchers
- Mocks Next.js router and image components
- Sets up global mocks for ResizeObserver, IntersectionObserver, etc.

## 🚫 Excluded Directories

The following directories are automatically excluded from test generation:
- `components/ui/` - External UI library components

To exclude additional directories, modify the `EXCLUDED_DIRS` array in `scripts/generate-component-tests.js`.

## 📊 Coverage Tracking

The system automatically generates a coverage report at `__tests__/component-test-coverage.md` showing:
- Total components found
- Tests created/updated/skipped
- Implementation status for each component
- Directory structure overview

## 🔍 Component Analysis

The generator analyzes each component file to detect:

- **Export Types**: Default exports, named exports
- **Props**: Interface definitions, prop types
- **Hooks**: useState, useEffect, useContext, custom hooks
- **Router Usage**: Next.js navigation hooks
- **API Integration**: fetch calls, query libraries
- **Form Handling**: onSubmit, form libraries
- **Client Components**: 'use client' directive

This analysis drives the test template generation to include relevant test categories.

## 🛡️ Best Practices

### 1. **Test Implementation Priority**
1. Basic rendering tests
2. Props and accessibility
3. User interactions
4. API integration
5. Edge cases and error handling

### 2. **Mocking Strategy**
- Mock external dependencies (APIs, routers)
- Use `vi.fn()` for function mocks
- Mock heavy components that aren't under test

### 3. **Test Organization**
- Group related tests in `describe` blocks
- Use descriptive test names
- Test one behavior per test case

### 4. **Accessibility Testing**
- Use semantic queries (`getByRole`, `getByLabelText`)
- Test keyboard navigation
- Verify ARIA attributes

### 5. **Async Testing**
- Use `waitFor` for async operations
- Test loading and error states
- Mock API responses appropriately

## 🚨 Troubleshooting

### Common Issues

1. **Import Errors**
   - Ensure path aliases are configured correctly
   - Check that components export correctly

2. **Mock Issues**
   - Verify mocks are set up in `vitest.setup.ts`
   - Clear mocks between tests with `vi.clearAllMocks()`

3. **Async Test Failures**
   - Use `waitFor` for async operations
   - Ensure proper cleanup in `beforeEach`/`afterEach`

4. **Component Not Found**
   - Check component file naming (must end in `.tsx`)
   - Verify component is not in excluded directories

### Debug Commands
```bash
# Check what components are detected
node scripts/generate-component-tests.js

# Force regenerate all tests
npm run test:components:force

# Check for component changes
npm run test:components:check
```

## 🔄 Continuous Integration

The system integrates with your development workflow:

1. **Development**: Tests auto-generate when you run `npm run dev`
2. **Watch Mode**: Use `npm run test:components:watch` for continuous testing
3. **CI/CD**: Run `npm run test:components` in your CI pipeline
4. **Coverage**: Use `npm run test:components:coverage` for coverage reports

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library User Events](https://testing-library.com/docs/user-event/intro/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)

## 🤝 Contributing

When adding new components:
1. Create your component in the appropriate `components/` subdirectory
2. Run `npm run test:components:generate` or wait for auto-generation
3. Implement the failing tests in the generated test file
4. Ensure all tests pass before committing

The system will automatically detect new components and generate test templates, ensuring comprehensive test coverage across your entire component library. 