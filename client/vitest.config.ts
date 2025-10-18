import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globals: true,
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "test/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/*.setup.*",
        "coverage/",
        "dist/",
        ".next/",
        "**/__tests__/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/mocks/**",
        "**/types/**",
        "**/scripts/**",
        "**/styles/**",

        // Auto-generated sections (excluded from test generation)
        "**/utils/queries/**",
        "**/utils/mutations/**",
        "**/utils/drizzle/**",
        "**/utils/api/**",
        "**/utils/auth/**",
        "**/utils/model/**",
        "**/utils/logs/**",
        "**/utils/analytics/**",
        "**/utils/react-query/**",

        // Individual utility files (excluded from test generation)
        "**/utils/breadcrumb-utils.ts",
        "**/utils/logger.ts",
        "**/utils/navigation-utils.ts",
        "**/utils/date-utils.ts",
        "**/utils/string-utils.ts",
        "**/utils/validation-utils.ts",
        "**/utils/format-utils.ts",
        "**/utils/storage-utils.ts",
        "**/utils/constants.ts",
        "**/utils/types.ts",
        "**/utils/scenario.ts",
        "**/utils/time.ts",

        // Library files (excluded from test generation)
        "**/lib/**",

        // UI components (excluded from test generation)
        "**/components/ui/**",

        // Next.js app pages (excluded from test generation)
        "**/app/**/*.tsx",
        "**/app/**/*.ts",

        // Hooks (excluded from test generation)
        "**/hooks/**",

        // Contexts (excluded from test generation)
        "**/contexts/**",
      ],
      include: [
        // Focus on main business logic components and utilities
        "components/**/*.{ts,tsx}",
        "utils/**/*.{ts,tsx}",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
