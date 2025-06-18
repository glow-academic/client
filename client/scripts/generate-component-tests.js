#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path configurations
const COMPONENTS_DIR = path.join(__dirname, "../components");
const TESTS_DIR = path.join(__dirname, "../__tests__");
const EXCLUDED_DIRS = ["ui"]; // External UI components to skip

/**
 * Recursively scan directory for .tsx files
 */
function scanComponentFiles(dir, relativePath = "") {
  const components = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const itemRelativePath = path.join(relativePath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip excluded directories
        if (EXCLUDED_DIRS.includes(item)) {
          console.log(`⏭️  Skipping excluded directory: ${itemRelativePath}`);
          continue;
        }

        // Recursively scan subdirectories
        const subComponents = scanComponentFiles(fullPath, itemRelativePath);
        components.push(...subComponents);
      } else if (stat.isFile() && item.endsWith(".tsx")) {
        const componentName = item.replace(".tsx", "");
        const testFileName = `${componentName}.test.tsx`;
        const testDir = path.join(TESTS_DIR, relativePath);
        const testFilePath = path.join(testDir, testFileName);
        const componentPath = path.join(relativePath, item);

        components.push({
          componentName,
          componentPath,
          componentFullPath: fullPath,
          testFileName,
          testDir,
          testFilePath,
          relativePath,
        });
      }
    }
  } catch (error) {
    console.error(`❌ Error scanning directory ${dir}:`, error.message);
  }

  return components;
}

/**
 * Analyze component file to extract props, exports, and hooks
 */
function analyzeComponent(componentPath) {
  try {
    const content = fs.readFileSync(componentPath, "utf8");

    const analysis = {
      hasDefaultExport: /export default/.test(content),
      namedExports: [],
      hasProps: false,
      propsInterface: null,
      usesHooks: [],
      imports: [],
      isClientComponent:
        content.includes("'use client'") || content.includes('"use client"'),
      hasAsyncComponents: /async\s+function|async\s+\w+\s*=/.test(content),
      usesRouter: /useRouter|usePathname|useSearchParams/.test(content),
      usesState: /useState/.test(content),
      usesEffect: /useEffect/.test(content),
      usesContext: /useContext/.test(content),
      hasApiCalls: /fetch\(|axios\.|useSWR|useQuery/.test(content),
      hasFormHandling: /onSubmit|useForm|formData/.test(content),
    };

    // Extract named exports
    const namedExportMatches = content.matchAll(
      /export\s+(?:const|function|class)\s+(\w+)/g
    );
    for (const match of namedExportMatches) {
      analysis.namedExports.push(match[1]);
    }

    // Extract props interface
    const propsInterfaceMatch = content.match(
      /interface\s+(\w*Props)\s*\{([^}]+)\}/
    );
    if (propsInterfaceMatch) {
      analysis.hasProps = true;
      analysis.propsInterface = propsInterfaceMatch[1];
    }

    // Extract hooks usage
    const hookMatches = content.matchAll(/use(\w+)/g);
    for (const match of hookMatches) {
      if (!analysis.usesHooks.includes(match[0])) {
        analysis.usesHooks.push(match[0]);
      }
    }

    // Extract imports
    const importMatches = content.matchAll(
      /import\s+.*?from\s+['"]([^'"]+)['"]/g
    );
    for (const match of importMatches) {
      analysis.imports.push(match[1]);
    }

    return analysis;
  } catch (error) {
    console.error(
      `❌ Error analyzing component ${componentPath}:`,
      error.message
    );
    return {
      hasDefaultExport: true,
      namedExports: [],
      hasProps: false,
      propsInterface: null,
      usesHooks: [],
      imports: [],
      isClientComponent: false,
      hasAsyncComponents: false,
      usesRouter: false,
      usesState: false,
      usesEffect: false,
      usesContext: false,
      hasApiCalls: false,
      hasFormHandling: false,
    };
  }
}

/**
 * Generate test template based on component analysis
 */
function generateTestTemplate(component, analysis) {
  const { componentName, componentPath } = component;
  const importPath =
    `@/components/${componentPath.replace(/\\/g, "/")}`.replace(".tsx", "");

  let template = `import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';`;

  // Add conditional imports based on component analysis
  const needsUserEvent =
    analysis.usesState || analysis.hasFormHandling || analysis.usesRouter;
  if (needsUserEvent) {
    template += `
import userEvent from '@testing-library/user-event';`;
  }
  // Note: We don't import useRouter here since we're mocking it, not using it directly

  if (analysis.hasApiCalls) {
    template += `
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';`;
  }

  if (analysis.usesContext) {
    template += `
import { ReactNode } from 'react';`;
  }

  template += `
import ${analysis.hasDefaultExport ? componentName : `{ ${analysis.namedExports.join(", ")} }`} from '${importPath}';

// Mock external dependencies
${
  analysis.usesRouter
    ? `vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));`
    : ""
}

${
  analysis.hasApiCalls
    ? `// Mock API calls
global.fetch = vi.fn();`
    : ""
}

describe('${componentName}', () => {
  ${
    analysis.hasApiCalls
      ? `let queryClient: QueryClient;
  
  `
      : ""
  }beforeEach(() => {
    vi.clearAllMocks();
    ${
      analysis.hasApiCalls
        ? `queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });`
        : ""
    }
  });

  ${
    analysis.hasApiCalls
      ? `const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };
  `
      : ""
  }

  describe('Rendering', () => {
    it('should render without crashing', () => {
      // TODO: Implement basic rendering test for ${componentName}
      ${analysis.hasApiCalls ? `renderWithProviders(<${componentName} />);` : `render(<${componentName} />);`}
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Basic rendering test for ${componentName}
    });

    ${
      analysis.hasProps
        ? `it('should render with props', () => {
      // TODO: Test component with various props
      // Props interface: ${analysis.propsInterface || "Unknown"}
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Props testing for ${componentName}
    });`
        : ""
    }

    it('should have correct accessibility attributes', () => {
      // TODO: Test accessibility features
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Accessibility testing for ${componentName}
    });
  });

  ${
    needsUserEvent
      ? `describe('User Interactions', () => {
    ${
      analysis.hasFormHandling
        ? `it('should handle form submissions', async () => {
      // TODO: Test form handling
      const _user = userEvent.setup();
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Form handling test for ${componentName}
    });`
        : ""
    }

    ${
      analysis.usesState
        ? `it('should handle state changes', async () => {
      // TODO: Test state management
      const _user = userEvent.setup();
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: State management test for ${componentName}
    });`
        : ""
    }

    it('should handle user events', async () => {
      // TODO: Test click, hover, focus events
      const _user = userEvent.setup();
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: User events test for ${componentName}
    });
  });`
      : ""
  }

  ${
    analysis.hasApiCalls
      ? `describe('API Integration', () => {
    it('should handle API calls', async () => {
      // TODO: Test API integration
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: API integration test for ${componentName}
    });

    it('should handle loading states', () => {
      // TODO: Test loading states
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Loading states test for ${componentName}
    });

    it('should handle error states', () => {
      // TODO: Test error handling
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Error handling test for ${componentName}
    });
  });`
      : ""
  }

  ${
    analysis.usesRouter
      ? `describe('Navigation', () => {
    it('should handle navigation', () => {
      // TODO: Test navigation behavior
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Navigation test for ${componentName}
    });
  });`
      : ""
  }

  describe('Edge Cases', () => {
    it('should handle edge cases gracefully', () => {
      // TODO: Test edge cases and error scenarios
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Edge cases test for ${componentName}
    });

    ${
      analysis.hasProps
        ? `it('should handle missing or invalid props', () => {
      // TODO: Test with missing/invalid props
      
      // This test should fail until implemented
      expect(true).toBe(false); // IMPLEMENT: Invalid props test for ${componentName}
    });`
        : ""
    }
  });
});

/*
 * Component Analysis for ${componentName}:
 * Path: ${componentPath}
 * 
 * Features detected:
 * - Default export: ${analysis.hasDefaultExport}
 * - Named exports: ${analysis.namedExports.join(", ") || "None"}
 * - Has props: ${analysis.hasProps}
 * - Props interface: ${analysis.propsInterface || "None detected"}
 * - Client component: ${analysis.isClientComponent}
 * - Uses hooks: ${analysis.usesHooks.join(", ") || "None"}
 * - Uses router: ${analysis.usesRouter}
 * - Has API calls: ${analysis.hasApiCalls}
 * - Has form handling: ${analysis.hasFormHandling}
 * - Uses state: ${analysis.usesState}
 * - Uses effects: ${analysis.usesEffect}
 * - Uses context: ${analysis.usesContext}
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(${generateRenderExample(component, analysis)});
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<${componentName} {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
`;

  return template;
}

/**
 * Generate render example for comments
 */
function generateRenderExample(component, analysis) {
  const { componentName } = component;

  if (analysis.hasProps) {
    return `<${componentName} {...mockProps} />`;
  } else {
    return `<${componentName} />`;
  }
}

/**
 * Check if test file exists and has content
 */
function isTestImplemented(testFilePath) {
  if (!fs.existsSync(testFilePath)) {
    return false;
  }

  const content = fs.readFileSync(testFilePath, "utf8").trim();
  // Consider implemented if it has content and doesn't contain our failing assertion
  return content.length > 0 && !content.includes("expect(true).toBe(false)");
}

/**
 * Generate test files for components
 */
function generateTestFiles(components) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  components.forEach((component) => {
    const { testDir, testFilePath, componentFullPath } = component;

    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    if (isTestImplemented(testFilePath)) {
      console.log(
        `⏭️  Skipping ${component.testFileName} (already implemented)`
      );
      skipped++;
    } else {
      // Analyze component
      const analysis = analyzeComponent(componentFullPath);

      // Generate test content
      const testContent = generateTestTemplate(component, analysis);

      const existed = fs.existsSync(testFilePath);
      fs.writeFileSync(testFilePath, testContent);

      if (existed) {
        console.log(
          `✨ Updated ${component.testFileName} (was empty/incomplete)`
        );
        updated++;
      } else {
        console.log(`📝 Created ${component.testFileName}`);
        created++;
      }
    }
  });

  return { created, updated, skipped };
}

/**
 * Generate coverage report
 */
function generateCoverageReport(components, stats) {
  const reportPath = path.join(TESTS_DIR, "component-test-coverage.md");

  let report = `# Component Test Coverage Report

Generated on: ${new Date().toISOString()}

## Summary
- **Total Components**: ${components.length}
- **Tests Created**: ${stats.created}
- **Tests Updated**: ${stats.updated}
- **Tests Skipped** (already implemented): ${stats.skipped}

## Component Coverage

| Component | Path | Test File | Status |
|-----------|------|-----------|--------|
`;

  components.forEach((component) => {
    const status = isTestImplemented(component.testFilePath)
      ? "✅ Implemented"
      : "❌ Needs Implementation";
    report += `| ${component.componentName} | ${component.componentPath} | ${component.testFileName} | ${status} |\n`;
  });

  report += `
## Directory Structure

\`\`\`
__tests__/
${generateDirectoryTree(components)}
\`\`\`

## Next Steps

1. **Review failing tests**: All generated tests include failing assertions to ensure they're implemented
2. **Implement component tests**: Replace failing assertions with actual test logic
3. **Test user interactions**: Add tests for clicks, form submissions, state changes
4. **Test API integration**: Mock and test API calls and data fetching
5. **Test accessibility**: Ensure components are accessible
6. **Test edge cases**: Handle error states, missing props, etc.

## Running Tests

\`\`\`bash
# Run all component tests
npm run test:components

# Run specific component test
npm run test -- Analytics.test.tsx

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
\`\`\`

## Testing Guidelines

### Basic Component Test
\`\`\`typescript
it('should render without crashing', () => {
  render(<ComponentName />);
  expect(screen.getByRole('...')).toBeInTheDocument();
});
\`\`\`

### Props Testing
\`\`\`typescript
it('should render with props', () => {
  const props = { title: 'Test Title' };
  render(<ComponentName {...props} />);
  expect(screen.getByText('Test Title')).toBeInTheDocument();
});
\`\`\`

### User Interaction Testing
\`\`\`typescript
it('should handle user interactions', async () => {
  const user = userEvent.setup();
  const mockFn = vi.fn();
  render(<ComponentName onClick={mockFn} />);
  
  await user.click(screen.getByRole('button'));
  expect(mockFn).toHaveBeenCalled();
});
\`\`\`

### API Testing
\`\`\`typescript
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
});
\`\`\`
`;

  fs.writeFileSync(reportPath, report);
  console.log(`📋 Generated coverage report: ${reportPath}`);
}

/**
 * Generate directory tree for report
 */
function generateDirectoryTree(components) {
  const tree = {};

  components.forEach((component) => {
    const parts = component.relativePath.split(path.sep).filter((p) => p);
    let current = tree;

    parts.forEach((part) => {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    });

    current[component.testFileName] = null;
  });

  function printTree(obj, indent = "") {
    let result = "";
    Object.keys(obj).forEach((key) => {
      if (obj[key] === null) {
        result += `${indent}├── ${key}\n`;
      } else {
        result += `${indent}├── ${key}/\n`;
        result += printTree(obj[key], indent + "│   ");
      }
    });
    return result;
  }

  return printTree(tree);
}

/**
 * Main execution function
 */
function main() {
  console.log("🚀 Generating Jest/Vitest tests for React components...\n");

  const components = scanComponentFiles(COMPONENTS_DIR);

  if (components.length === 0) {
    console.log("⚠️  No .tsx components found");
    return;
  }

  console.log(`📊 Found ${components.length} components:`);
  components.forEach((comp) => {
    console.log(`  - ${comp.componentPath}`);
  });

  console.log("\n📁 Generating test files...");
  const stats = generateTestFiles(components);

  console.log("\n📊 Summary:");
  console.log(`  ✨ Created: ${stats.created} files`);
  console.log(`  🔄 Updated: ${stats.updated} files`);
  console.log(`  ⏭️  Skipped: ${stats.skipped} files`);

  generateCoverageReport(components, stats);

  console.log("\n✅ Component test generation complete!");
  console.log(
    '💡 Run "npm run test:components" to execute all component tests'
  );
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateCoverageReport, generateTestFiles, scanComponentFiles };
