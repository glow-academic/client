#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { Project, SyntaxKind, TypeFormatFlags } from "ts-morph";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path configurations
const COMPONENTS_DIR = path.join(__dirname, "../components");
const TESTS_DIR = path.join(__dirname, "../__tests__");
const EXCLUDED_DIRS = ["ui"]; // External UI components to skip

// Initialize TypeScript project for AST parsing
const project = new Project({
  tsConfigFilePath: path.resolve(__dirname, "../tsconfig.json"),
  skipAddingFilesFromTsConfig: true,
});

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
  const { componentName, componentPath } = component;
  const importPath =
    `@/components/${componentPath.replace(/\\/g, "/")}`.replace(".tsx", "");

  /* ──────────────────────────────────────────────────────────
   * 1.  Gather every query / mutation fn name we can detect
   *     so that we pre-fill the overrides object for devs.
   * ────────────────────────────────────────────────────────── */
  const queryNames = [];
  const mutationNames = [];

  analysis.imports.forEach((imp) => {
    if (imp.startsWith("@/utils/queries/")) {
      // heuristically use the *named import* token(s) if present
      const m = analysis.content?.match(
        new RegExp(
          `import\\s+\\{([^}]+)\\}\\s+from\\s+['"]${imp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`
        )
      );
      if (m) {
        m[1]
          .split(",")
          .map((s) => s.trim())
          .forEach((n) => queryNames.push(n));
      }
    }

    if (imp.startsWith("@/utils/mutations/")) {
      const m = analysis.content?.match(
        new RegExp(
          `import\\s+\\{([^}]+)\\}\\s+from\\s+['"]${imp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`
        )
      );
      if (m) {
        m[1]
          .split(",")
          .map((s) => s.trim())
          .forEach((n) => mutationNames.push(n));
      }
    }
  });

  /* ──────────────────────────────────────────────────────────
   * 2.  Build the test file
   * ────────────────────────────────────────────────────────── */
  const needsUserEvent =
    analysis.usesState || analysis.hasFormHandling || analysis.usesRouter;

  const mockPropLines = analysis.hasProps
    ? buildMockProps(analysis.content, analysis.propsInterface)
    : [];

  const needsVi =
    analysis.hasDirectFetch || // we stub fetch
    (analysis.hasProps && mockPropLines.some((l) => l.includes("vi.fn"))); // props

  let template = `import { screen } from '@testing-library/react';
import { describe, it, expect${needsVi ? ", vi" : ""} } from 'vitest';
import { renderWithMocks } from '@/test/renderWithMocks';`;

  if (needsUserEvent) {
    template += `
import userEvent from '@testing-library/user-event';`;
  }

  /* helper to silence "declared but never read" while the test is .skip() */
  const touch = (v) => (needsUserEvent ? `void ${v};` : "");

  template += `

// ——————————————————————————————————————————
import ${
    analysis.hasDefaultExport
      ? componentName
      : `{ ${analysis.namedExports.join(", ")} }`
  } from '${importPath}';

${analysis.hasDirectFetch ? "global.fetch = vi.fn();" : ""}

/* ------------------------------------------------------------------ *
 * Auto-detected data fns used by this component
 * (feel free to delete ones you don't need in a specific test) */
const DEFAULT_OVERRIDES = {
  queries: {
${
  queryNames.map((q) => `    ${q}: /* TODO */ [],`).join("\n") ||
  "    // " /* keep object non-empty for prettier */
}
  },
  mutations: {
${mutationNames.map((m) => `    ${m}: /* TODO */ {},`).join("\n") || "    //"}
  },
};
/* ------------------------------------------------------------------ */

${
  analysis.hasProps
    ? `
// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
import type { ${analysis.propsInterface} } from '${importPath}';
const mockProps: ${analysis.propsInterface} = {
${mockPropLines.join("\n")}
};
// ------------------------------------------------------------------
`
    : ""
}

describe('${componentName}', () => {

  describe('basic render smoke-test', () => {
    it.skip('renders without crashing (replace skip when implemented)', async () => {
      renderWithMocks(
        <${componentName} ${analysis.hasProps ? "{...mockProps}" : ""} />,
        DEFAULT_OVERRIDES
      );
      /* TODO: add reasonable assertion */
      expect(
        await screen.findByRole('document', {}, { timeout: 2000 })
      ).toBeTruthy();
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
    });`
        : ""
    }

    ${
      analysis.usesState
        ? `it.skip('should handle state changes', async () => {
      const user = userEvent.setup();
      ${touch("user")}
      // TODO: state management assertions
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
    it.skip('should handle API calls', async () => {
      // TODO: Test API integration
      
      // TODO: API integration assertions
    });

    it.skip('should handle loading states', () => {
      // TODO: Test loading states
      
      // TODO: loading states assertions
    });

    it.skip('should handle error states', () => {
      // TODO: Test error handling
      
      // TODO: error handling assertions
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
 * Clean up test files for components that no longer exist
 */
function cleanupOrphanedTests(components) {
  const existingComponentPaths = new Set(
    components.map((c) => c.componentPath.replace(/\\/g, "/"))
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

      // Get the type text with proper formatting
      const typeText = sym
        .getTypeAtLocation(iface)
        .getText(undefined, TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);

      const line = (value) =>
        isOptional
          ? `  // ${name}: ${value}, /* optional */`
          : `  ${name}: ${value},`;

      // Handle different types based on the resolved type text
      // Check for arrays first (more specific)
      if (typeText.includes("[]") || typeText.includes("Array<")) {
        return line("[]");
      }

      // Check for functions (more specific)
      if (typeText.includes("=>") || typeText.includes("Function")) {
        return line("vi.fn()");
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

      // Handle Table types
      if (typeText.includes("Table<")) {
        return line("{} as unknown as Table<any>");
      }

      // Handle Date
      if (typeText.includes("Date")) {
        return line("new Date()");
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

    return mockProps;
  } catch (error) {
    console.error(
      `❌ Error building mock props for ${ifaceName}:`,
      error.message
    );
    return [];
  }
}

export { generateCoverageReport, generateTestFiles, scanComponentFiles };
