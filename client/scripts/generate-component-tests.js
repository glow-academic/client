#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { Project, SyntaxKind, TypeFormatFlags } from "ts-morph";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path configurations - updated to include more directories
const ROOT_DIR = path.join(__dirname, "..");
const COMPONENTS_DIR = path.join(ROOT_DIR, "components");
const APP_DIR = path.join(ROOT_DIR, "app");
const UTILS_DIR = path.join(ROOT_DIR, "utils");
const HOOKS_DIR = path.join(ROOT_DIR, "hooks");
const LIB_DIR = path.join(ROOT_DIR, "lib");
const CONTEXTS_DIR = path.join(ROOT_DIR, "contexts");
const TESTS_DIR = path.join(ROOT_DIR, "__tests__");

// Directories to scan for .tsx files
const SCAN_DIRECTORIES = [
  { dir: COMPONENTS_DIR, name: "components" },
  { dir: APP_DIR, name: "app" },
  { dir: UTILS_DIR, name: "utils" },
  { dir: HOOKS_DIR, name: "hooks" },
  { dir: LIB_DIR, name: "lib" },
  { dir: CONTEXTS_DIR, name: "contexts" },
];

// Directories to exclude from scanning
const EXCLUDE_DIRECTORIES = [
  "queries",
  "mutations",
  "drizzle",
  "api",
  "auth",
  "breadcrumb-utils.ts",
  "logger.ts",
  "navigation-utils.ts",
  "date-utils.ts",
  "string-utils.ts",
  "validation-utils.ts",
  "format-utils.ts",
  "storage-utils.ts",
  "constants.ts",
  "types.ts",
];

// Initialize TypeScript project for AST parsing
const project = new Project({
  tsConfigFilePath: path.resolve(__dirname, "../tsconfig.json"),
  skipAddingFilesFromTsConfig: true,
});

/**
 * Check if a path should be excluded
 */
function shouldExcludePath(relativePath) {
  const pathParts = relativePath.split(path.sep);

  return EXCLUDE_DIRECTORIES.some((exclude) => {
    // Handle file exclusions (ends with .ts)
    if (exclude.endsWith(".ts")) {
      return pathParts.some((part) => part === exclude);
    }

    // Handle directory exclusions
    return pathParts.includes(exclude);
  });
}

/**
 * Recursively scan directory for .tsx files
 */
function scanComponentFiles(dir, relativePath = "", sourceName = "") {
  const components = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const itemRelativePath = path.join(relativePath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip excluded directories
        if (shouldExcludePath(itemRelativePath)) {
          console.log(`🚫 Excluding directory: ${itemRelativePath}`);
          continue;
        }

        const subComponents = scanComponentFiles(
          fullPath,
          itemRelativePath,
          sourceName
        );
        components.push(...subComponents);
      } else if (stat.isFile() && item.endsWith(".tsx")) {
        const componentName = item.replace(".tsx", "");
        const testFileName = `${componentName}.test.tsx`;

        // Create test directory structure that mirrors the source structure
        const testDir = path.join(TESTS_DIR, sourceName, relativePath);
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
          sourceName, // Track which source directory this came from
        });
      }
    }
  } catch (error) {
    console.error(`❌ Error scanning directory ${dir}:`, error.message);
  }

  return components;
}

/**
 * Scan all directories for components
 */
function scanAllComponentFiles() {
  const allComponents = [];

  for (const { dir, name } of SCAN_DIRECTORIES) {
    if (fs.existsSync(dir)) {
      console.log(`📁 Scanning ${name} directory...`);
      const components = scanComponentFiles(dir, "", name);
      allComponents.push(...components);
    } else {
      console.log(`⚠️  Directory ${name} not found: ${dir}`);
    }
  }

  return allComponents;
}
/**
 * Analyze component file using TypeScript AST to extract props, exports, and hooks
 */
function analyzeComponent(componentPath) {
  try {
    const content = fs.readFileSync(componentPath, "utf8");

    // Add or reuse cached source file
    const source =
      project.addSourceFileAtPathIfExists(componentPath) ??
      project.createSourceFile(componentPath, content, { overwrite: true });

    const exports = source.getExportedDeclarations();
    const hasDefaultExport = exports.has("default");

    // Find "SomethingProps" interface OR type alias
    const propsDecl =
      source.getInterfaces().find((i) => /Props$/.test(i.getName() ?? "")) ??
      source.getTypeAliases().find((a) => /Props$/.test(a.getName() ?? ""));

    const propsInterface = propsDecl?.getName() ?? null;

    // Extract imports
    const imports = source
      .getImportDeclarations()
      .map((i) => i.getModuleSpecifierValue());

    // ✨ NEW: Add logic to find API function names using TypeScript AST
    const queryNames = new Set();
    const mutationNames = new Set();

    source.getImportDeclarations().forEach((impDecl) => {
      const moduleSpecifier = impDecl.getModuleSpecifierValue();
      const namedImports = impDecl.getNamedImports();

      if (moduleSpecifier.startsWith("@/utils/queries")) {
        namedImports.forEach((ni) => queryNames.add(ni.getName()));
      } else if (moduleSpecifier.startsWith("@/utils/mutations")) {
        namedImports.forEach((ni) => mutationNames.add(ni.getName()));
      }
    });

    // Extract named exports (excluding default)
    const namedExports = Array.from(exports.keys()).filter(
      (n) => n !== "default"
    );

    // Check for various hooks and patterns using AST
    const identifiers = source.getDescendantsOfKind(SyntaxKind.Identifier);
    const identifierTexts = identifiers.map((id) => id.getText());

    const uses = {
      useRouter: identifierTexts.some((text) =>
        ["useRouter", "usePathname", "useSearchParams"].includes(text)
      ),
      useState: identifierTexts.includes("useState"),
      useEffect: identifierTexts.includes("useEffect"),
      useContext: identifierTexts.includes("useContext"),
      useQuery: identifierTexts.includes("useQuery"),
      useSWR: identifierTexts.includes("useSWR"),
      fetch: identifierTexts.includes("fetch"),
      axios: identifierTexts.includes("axios"),
      useForm: identifierTexts.includes("useForm"),
      onSubmit: identifierTexts.includes("onSubmit"),
      formData: identifierTexts.includes("formData"),
    };

    // Extract all hooks used
    const usesHooks = identifierTexts
      .filter((text) => text.startsWith("use") && text.length > 3)
      .filter((hook, index, arr) => arr.indexOf(hook) === index); // unique

    const analysis = {
      content, // Store content for backward compatibility
      hasDefaultExport,
      namedExports,
      hasProps: !!propsInterface,
      propsInterface,
      usesHooks,
      imports,
      queryNames: Array.from(queryNames), // Add this
      mutationNames: Array.from(mutationNames), // Add this
      isClientComponent:
        content.includes("'use client'") || content.includes('"use client"'),
      hasAsyncComponents: /async\s+function|async\s+\w+\s*=/.test(content),
      usesRouter: uses.useRouter,
      usesState: uses.useState,
      usesEffect: uses.useEffect,
      usesContext: uses.useContext,
      hasApiCalls: uses.useQuery || uses.useSWR || uses.fetch || uses.axios,
      hasDirectFetch: uses.fetch,
      hasFormHandling: uses.useForm || uses.onSubmit || uses.formData,
    };

    return analysis;
  } catch (error) {
    console.error(
      `❌ Error analyzing component ${componentPath}:`,
      error.message
    );
    return {
      content: "",
      hasDefaultExport: true,
      namedExports: [],
      hasProps: false,
      propsInterface: null,
      usesHooks: [],
      imports: [],
      queryNames: [],
      mutationNames: [],
      isClientComponent: false,
      hasAsyncComponents: false,
      usesRouter: false,
      usesState: false,
      usesEffect: false,
      usesContext: false,
      hasApiCalls: false,
      hasDirectFetch: false,
      hasFormHandling: false,
    };
  }
}

/**
 * Generate **ready-to-implement** Vitest spec
 * every spec imports the shared helper `@/tests/renderWithMocks`
 */
function generateTestTemplate(component, analysis) {
  const { componentName, componentPath, sourceName } = component;
  const { queryNames, mutationNames } = analysis; // Get the function names from analysis

  // Generate import path based on source directory
  let importPath;
  if (sourceName === "components") {
    importPath = `@/components/${componentPath.replace(/\\/g, "/")}`.replace(
      ".tsx",
      ""
    );
  } else {
    importPath = `@/${sourceName}/${componentPath.replace(/\\/g, "/")}`.replace(
      ".tsx",
      ""
    );
  }

  /* ──────────────────────────────────────────────────────────
   * 2.  Build the test file
   * ────────────────────────────────────────────────────────── */
  const needsUserEvent =
    analysis.usesState || analysis.hasFormHandling || analysis.usesRouter;

  const mockPropLines = analysis.hasProps
    ? buildMockProps(analysis.content, analysis.propsInterface)
    : [];

  // Detect if the props interface itself is generic
  const propsGenericInfo = analysis.hasProps
    ? getPropsGenericInfo(analysis.content, analysis.propsInterface)
    : { isGeneric: false, paramCount: 0 };

  const needsVi =
    analysis.hasDirectFetch || // we stub fetch
    (analysis.hasProps && mockPropLines.some((l) => l.includes("vi.fn"))); // props

  // Use more reliable detection for @tanstack/react-table imports
  const wantsTable = mockPropLines.some((l) => l.includes("Table<"));
  const wantsColumn = mockPropLines.some((l) => l.includes("Column<"));
  const needsTanstackTable =
    analysis.imports.includes("@tanstack/react-table") ||
    wantsTable ||
    wantsColumn;

  // Determine if we need vi for mocking
  const needsViForMocking =
    queryNames.length > 0 ||
    mutationNames.length > 0 ||
    analysis.hasDirectFetch ||
    needsVi;

  let template = `import { render, screen, waitFor } from '@/test/custom-render';
import { describe, it, expect${needsViForMocking ? ", vi, afterEach" : ""} } from 'vitest';`;

  if (needsUserEvent) {
    template += `
import userEvent from '@testing-library/user-event';`;
  }

  if (needsTanstackTable) {
    template += `\nimport type { ${[
      wantsTable && "Table",
      wantsColumn && "Column",
    ]
      .filter(Boolean)
      .join(", ")} } from '@tanstack/react-table';`;
  }

  const needsTAPerformanceData = mockPropLines.some((l) =>
    l.includes("TAPerformanceData")
  );
  if (needsTAPerformanceData) {
    template += `\nimport type { TAPerformanceData } from '@/hooks/use-report-columns';`;
  }

  /* helper to silence "declared but never read" while the test is .skip() */
  const touch = (v) => (needsUserEvent ? `void ${v};` : "");

  template += `

// ——————————————————————————————————————————
import ${
    analysis.hasDefaultExport
      ? `${componentName.includes("-") ? `{ default as ${componentName.replace(/-/g, "")} }` : componentName}${analysis.namedExports.length > 0 ? `, { ${analysis.namedExports.join(", ")} }` : ""}`
      : `{ ${analysis.namedExports.join(", ")} }`
  } from '${importPath}';

${analysis.hasDirectFetch ? "global.fetch = vi.fn();" : ""}`;

  // ✨ Import existing mock infrastructure instead of creating custom mocks
  const hasMocks = queryNames.length > 0 || mutationNames.length > 0;
  const needsAuthMocks =
    analysis.usesContext ||
    analysis.imports.some(
      (i) => i.includes("profile-context") || i.includes("next-auth")
    );
  const needsNavigationMocks = analysis.usesRouter;

  if (hasMocks || needsAuthMocks || needsNavigationMocks) {
    template += `

// ✨ Import testing mocks`;

    if (hasMocks) {
      template += `
import '@/mocks/api';`;
    }

    if (needsAuthMocks) {
      template += `
import '@/mocks/auth';`;
    }

    if (needsNavigationMocks) {
      template += `
import '@/mocks/navigation';`;
    }

    template += `
`;
  }

  // Add props section if needed
  if (analysis.hasProps) {
    template += `

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed`;

    if (
      analysis.propsInterface &&
      !analysis.namedExports.includes(analysis.propsInterface)
    ) {
      template += `
import type { ${analysis.propsInterface} } from '${importPath}';`;
    }

    template += `
const mockProps: ${analysis.propsInterface}${
      propsGenericInfo.isGeneric
        ? `<${"unknown, ".repeat(propsGenericInfo.paramCount).slice(0, -2)}>`
        : ""
    } = {
${mockPropLines.join("\n")}
};
// ------------------------------------------------------------------
`;
  }

  const showMockGuide = hasMocks || needsAuthMocks || needsNavigationMocks;

  template += `describe('${componentName}', () => {
  ${
    showMockGuide
      ? `
  /* ------------------------------------------------------------------ *
   * 💡 Mock Data Usage Guide:
   * 
   * All API functions are automatically mocked via imports above.
   * Use mockSchema.* for realistic test data:
   * 
   * Examples:
   * - mockSchema.users[0] - First user object
   * - mockSchema.classes - Array of class objects  
   * - mockSchema.profiles - Array of profile objects
   * 
   * To override specific mocks in individual tests:
   * - vi.mocked(queryFunction).mockResolvedValue(customData)
   * - vi.mocked(mutationFunction).mockResolvedValue(customResponse)
   * ------------------------------------------------------------------ */
  
  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });`
      : ""
  }

  describe('basic render smoke-test', () => {
    it('renders without crashing', async () => {
      ${hasMocks ? "// ✨ All mocks are automatically set up via imports above" : ""}
      render(<${componentName.includes("-") ? componentName.replace(/-/g, "") : componentName} ${analysis.hasProps ? "{...mockProps}" : ""} />);
      
      // TODO: Add meaningful assertions based on your component
      // Example: await waitFor(() => expect(screen.getByText('Expected Text')).toBeInTheDocument());
    });

    ${
      analysis.hasProps
        ? `it.skip('should render with props', () => {
      // TODO: Test component with various props
      // Props interface: ${analysis.propsInterface || "Unknown"}
      
      // TODO add props assertions
    });`
        : ""
    }

    it.skip('should have correct accessibility attributes', () => {
      // TODO: Test accessibility features
      
      // TODO add accessibility assertions

    });
  });

  ${
    needsUserEvent
      ? `describe('User Interactions', () => {
    ${
      analysis.hasFormHandling
        ? `it.skip('should handle form submissions', async () => {
      const user = userEvent.setup();
      ${touch("user")}
      // TODO: form handling assertions
      // Mock data is available from @/mocks/schema for realistic testing
    });`
        : ""
    }

    ${
      analysis.usesState
        ? `it.skip('should handle state changes', async () => {
      const user = userEvent.setup();
      ${touch("user")}
      // TODO: state management assertions
      // Mock data is available from @/mocks/schema for realistic testing
    });`
        : ""
    }

    it.skip('should handle user events', async () => {
      const user = userEvent.setup();
      ${touch("user")}
      // TODO: interaction assertions

    });
  });`
      : ""
  }

  ${
    analysis.hasApiCalls
      ? `describe('API Integration', () => {
    it.skip('should handle and display an API error state', async () => {
      // Arrange: Override the default success mock with an error for this test.${
        queryNames.length > 0
          ? `
      // Example: vi.mocked(${queryNames[0]}).mockRejectedValue(new Error('API Error'));`
          : ""
      }

      render(<${componentName.includes("-") ? componentName.replace(/-/g, "") : componentName} ${analysis.hasProps ? "{...mockProps}" : ""} />);
      
      // Assert: Check that your component shows an error message.
      // TODO: Add specific error state assertions
    });

    it.skip('should handle loading states', () => {
      // TODO: Test loading states
      // Mock data is automatically loaded from @/mocks/schema
      
      // TODO: loading states assertions
    });
  });`
      : ""
  }

  ${
    analysis.usesRouter
      ? `describe('Navigation', () => {
    it.skip('should handle navigation', () => {
      // TODO: Test navigation behavior
      
      // TODO: navigation assertions
    });
  });`
      : ""
  }

  describe('Edge Cases', () => {
    it.skip('should handle edge cases gracefully', () => {
      // TODO: Test edge cases and error scenarios
      
      // TODO: edge-case assertions

    });

    ${
      analysis.hasProps
        ? `it.skip('should handle missing or invalid props', () => {
      // TODO: Test with missing/invalid props
      
      // TODO: invalid props assertions
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
  const safeComponentName = componentName.includes("-")
    ? componentName.replace(/-/g, "")
    : componentName;

  if (analysis.hasProps) {
    return `<${safeComponentName} {...mockProps} />`;
  } else {
    return `<${safeComponentName} />`;
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
 * Clean up test files for components that no longer exist
 */
function cleanupOrphanedTests(components) {
  const existingComponentPaths = new Set(
    components.map((c) =>
      `${c.sourceName}/${c.componentPath}`.replace(/\\/g, "/")
    )
  );

  let cleanedUp = 0;

  function scanTestDirectory(dir, relativePath = "") {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scanTestDirectory(fullPath, path.join(relativePath, item));
      } else if (item.endsWith(".test.tsx")) {
        const componentName = item.replace(".test.tsx", "");
        const expectedComponentPath = path.join(
          relativePath,
          `${componentName}.tsx`
        );

        if (!existingComponentPaths.has(expectedComponentPath)) {
          console.log(
            `🗑️  Removing orphaned test: ${path.join(relativePath, item)}`
          );
          fs.unlinkSync(fullPath);
          cleanedUp++;
        }
      }
    }
  }

  scanTestDirectory(TESTS_DIR);
  return cleanedUp;
}

/**
 * Generate coverage report
 */
function generateCoverageReport(components, stats) {
  const reportPath = path.join(TESTS_DIR, "component-test-coverage.md");

  let report = `# Component Test Coverage Report

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
    report += `| ${component.componentName} | ${component.sourceName}/${component.componentPath} | ${component.testFileName} | ${status} |\n`;
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
    // Start with source directory
    if (!tree[component.sourceName]) {
      tree[component.sourceName] = {};
    }
    let current = tree[component.sourceName];

    // Add relative path parts
    const parts = component.relativePath.split(path.sep).filter((p) => p);
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

  const components = scanAllComponentFiles();

  if (components.length === 0) {
    console.log("⚠️  No .tsx components found");
    return;
  }

  console.log(`📊 Found ${components.length} components:`);
  components.forEach((comp) => {
    console.log(`  - ${comp.componentPath}`);
  });

  console.log("\n🗑️  Cleaning up orphaned tests...");
  const cleanedUp = cleanupOrphanedTests(components);

  console.log("\n📁 Generating test files...");
  const stats = generateTestFiles(components);

  console.log("\n📊 Summary:");
  console.log(`  ✨ Created: ${stats.created} files`);
  console.log(`  🔄 Updated: ${stats.updated} files`);
  console.log(`  ⏭️  Skipped: ${stats.skipped} files`);
  console.log(`  🗑️  Cleaned up: ${cleanedUp} orphaned tests`);

  generateCoverageReport(components, { ...stats, cleanedUp });

  console.log("\n✅ Component test generation complete!");
  console.log(
    '💡 Run "npm run test:components" to execute all component tests'
  );
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

/**
 * Get type reference information from AST instead of relying on formatted text
 */
function getTypeReferenceInfo(sym) {
  try {
    const decl = sym.getDeclarations()[0];
    const node = decl?.getTypeNode?.();
    if (!node || !node.isKind(SyntaxKind.TypeReference)) return null;

    const ref = node.asKindOrThrow(SyntaxKind.TypeReference);
    const name = ref.getTypeName().getText();
    const typeArgs = ref.getTypeArguments();
    return { name, argCount: typeArgs.length };
  } catch (error) {
    return null;
  }
}

/**
 * Detect if the props interface itself is generic
 */
function getPropsGenericInfo(sourceText, ifaceName) {
  if (!ifaceName) return { isGeneric: false, paramCount: 0 };

  try {
    const source = project.createSourceFile("temp-props.tsx", sourceText, {
      overwrite: true,
    });

    const iface =
      source.getInterface(ifaceName) ?? source.getTypeAlias(ifaceName);
    if (!iface) return { isGeneric: false, paramCount: 0 };

    const typeParams = iface.getTypeParameters();
    const paramCount = typeParams.length;

    source.delete();

    return {
      isGeneric: paramCount > 0,
      paramCount,
    };
  } catch (error) {
    console.error(
      `❌ Error detecting generics for ${ifaceName}:`,
      error.message
    );
    return { isGeneric: false, paramCount: 0 };
  }
}

/**
 * Generate mock props using TypeScript AST to get accurate type information
 * This replaces the regex-based approach with proper type resolution
 */
function buildMockProps(sourceText, ifaceName) {
  if (!ifaceName) return [];

  try {
    // Create a temporary source file for analysis
    const source = project.createSourceFile("temp.tsx", sourceText, {
      overwrite: true,
    });

    // Find the interface or type alias
    const iface =
      source.getInterface(ifaceName) ?? source.getTypeAlias(ifaceName);

    if (!iface) {
      console.warn(`⚠️  Could not find interface/type ${ifaceName}`);
      return [];
    }

    // Get the type and its properties
    const type = iface.getType();
    const props = type.getProperties();

    const mockProps = props.map((sym) => {
      const name = sym.getName();
      const isOptional = sym.isOptional();

      // Skip common React HTML attributes that are not component-specific
      const reactAttributes = [
        "className",
        "style",
        "id",
        "key",
        "ref",
        "children",
        "onClick",
        "onSubmit",
        "onChange",
        "onFocus",
        "onBlur",
        "onKeyDown",
        "onKeyUp",
        "onMouseDown",
        "onMouseUp",
        "onMouseEnter",
        "onMouseLeave",
        "tabIndex",
        "aria-",
        "data-",
        "role",
        "title",
        "lang",
        "dir",
        "hidden",
        "draggable",
        "contentEditable",
        "spellCheck",
        "autoFocus",
        "autoComplete",
        "autoCorrect",
        "autoCapitalize",
        "autoSave",
        "enterKeyHint",
        "inputMode",
        "nonce",
        "slot",
        "translate",
        "suppressContentEditableWarning",
        "suppressHydrationWarning",
        "defaultChecked",
        "defaultValue",
        "accessKey",
        "contextMenu",
        "radioGroup",
        "about",
        "content",
        "datatype",
        "inlist",
        "prefix",
        "property",
        "rel",
        "resource",
        "rev",
        "typeof",
        "vocab",
        "color",
        "itemProp",
        "itemScope",
        "itemType",
        "itemID",
        "itemRef",
        "results",
        "security",
        "unselectable",
        "popover",
        "popoverTargetAction",
        "popoverTarget",
        "inert",
        "is",
        "exportparts",
        "part",
        "dangerouslySetInnerHTML",
      ];

      // Skip if it's a common React attribute and optional
      if (
        isOptional &&
        reactAttributes.some(
          (attr) =>
            name.startsWith(attr) ||
            name.includes("aria-") ||
            name.includes("data-") ||
            (name.startsWith("on") &&
              name.length > 2 &&
              name[2] === name[2].toUpperCase())
        )
      ) {
        return null;
      }

      const line = (value) =>
        isOptional
          ? `  // ${name}: ${value}, /* optional */`
          : `  ${name}: ${value},`;

      // Get the type text with proper formatting for other types
      const typeText = sym
        .getTypeAtLocation(iface)
        .getText(undefined, TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);

      // Handle @tanstack/react-table types with proper generic arity
      const tableMatch = typeText.match(/^Table<(.*)>$/);
      if (tableMatch) {
        // Grab the inner part - it may be "TAPerformanceData"
        let inner = tableMatch[1] || "unknown";
        if (inner === "TData") {
          inner = "unknown";
        }
        return line(`{} as unknown as Table<${inner}>`);
      }

      const colMatch = typeText.match(/^Column<(.*)>$/);
      if (colMatch) {
        let inner = colMatch[1] || "unknown, unknown";
        if (inner === "TData, TValue") {
          inner = "unknown, unknown";
        }
        return line(`{} as unknown as Column<${inner}>`);
      }

      // Handle different types based on the resolved type text
      // Check for functions first (most specific) - check if it starts with a function pattern
      if (
        typeText.includes("=>") ||
        typeText.includes("Function") ||
        typeText.startsWith("(") ||
        /^\([^)]*\)\s*=>/.test(typeText) ||
        // Check for common function prop patterns
        ((name.includes("callback") ||
          name.includes("handler") ||
          name.includes("on") ||
          name.includes("update") ||
          name.includes("set")) &&
          typeText.includes("("))
      ) {
        return line("vi.fn()");
      }

      // Check for arrays (but not if it's part of a nested type)
      if (
        (typeText.includes("[]") || typeText.includes("Array<")) &&
        !typeText.includes("Partial<") &&
        !typeText.includes("Pick<")
      ) {
        return line("[]");
      }

      // Handle union types with string literals
      if (typeText.includes("|") && typeText.includes('"')) {
        const firstStringLiteral = typeText.match(/"([^"]+)"/);
        if (firstStringLiteral) {
          return line(`'${firstStringLiteral[1]}'`);
        }
      }

      // Handle ReactNode
      if (
        typeText.includes("React.ReactNode") ||
        typeText.includes("ReactNode")
      ) {
        return line(`<div>test-${name}</div>`);
      }

      // Handle Record and object types
      if (typeText.includes("Record<") || typeText.includes("{ [")) {
        return line("{}");
      }

      // Handle complex object types (like { id: number; name: string; tags: string[]; })
      if (typeText.startsWith("{") && typeText.endsWith("}")) {
        return line("{}");
      }

      // Handle Date
      if (typeText.includes("Date")) {
        return line("new Date()");
      }

      // Handle null/undefined unions (like "Partial<Dashboard> | null")
      if (typeText.includes("| null") || typeText.includes("| undefined")) {
        return line("null");
      }

      // Handle Partial types
      if (typeText.includes("Partial<")) {
        return line("{}");
      }

      // Handle Pick types
      if (typeText.includes("Pick<")) {
        return line("{}");
      }

      // Handle primitive types (check these last)
      if (typeText === "string" || typeText.startsWith("string")) {
        return line(`'test-${name}'`);
      }
      if (typeText === "number" || typeText.startsWith("number")) {
        return line("0");
      }
      if (typeText === "boolean" || typeText.startsWith("boolean")) {
        return line("false");
      }

      // Fallback for complex types
      return line(`/* TODO <${typeText}> */ undefined!`);
    });

    // Clean up the temporary file
    source.delete();

    return mockProps.filter(Boolean);
  } catch (error) {
    console.error(
      `❌ Error building mock props for ${ifaceName}:`,
      error.message
    );
    return [];
  }
}

export { generateCoverageReport, generateTestFiles, scanComponentFiles };
