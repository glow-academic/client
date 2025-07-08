#!/usr/bin/env node

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ANALYTICS_DIR = path.join(
  __dirname,
  "../../../client/components/common/analytics"
);
const REGISTRY_PATH = path.join(ANALYTICS_DIR, "Registry.tsx");
const OUTPUT_SQL = path.join(__dirname, "init.sql");

// Utility functions
function generateDeterministicUUID(filename) {
  const hash = crypto
    .createHash("md5")
    .update(filename.toLowerCase())
    .digest("hex");
  // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join("-");
}

function toTitleCase(str) {
  return str
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function toCamelCase(str) {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));
}

// Parse TypeScript file to extract props interface
function parseComponentProps(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");

    // Look for interface definitions that end with "Props"
    const interfaceRegex = /interface\s+(\w*Props)\s*{([^}]*)}/g;
    const props = {};

    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const interfaceBody = match[2];

      // Parse individual properties
      const propLines = interfaceBody
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      for (const line of propLines) {
        // Skip comments and empty lines
        if (
          line.startsWith("//") ||
          line.startsWith("*") ||
          !line.includes(":")
        )
          continue;

        // Parse property: name: type; or name?: type;
        const propMatch = line.match(/(\w+)(\?)?:\s*([^;]+)/);
        if (propMatch) {
          const [, propName, optional, propType] = propMatch;

          // Determine default value based on type
          let defaultValue = null;

          // Handle function types
          if (
            propType.includes("=>") ||
            propType.includes("function") ||
            propType.includes("Function")
          ) {
            // Skip function props - they should be handled dynamically
            continue;
          } else if (propType.includes('"') && propType.includes("|")) {
            // Union of string literals, pick the first one
            const firstOption = propType.match(/"([^"]+)"/);
            defaultValue = firstOption ? firstOption[1] : null;
          } else if (propType.includes("boolean")) {
            defaultValue = false;
          } else if (propType.includes("number")) {
            defaultValue = 0;
          } else if (propType.includes("string")) {
            defaultValue = "";
          } else if (propType.includes("className")) {
            // Special case for className
            defaultValue = "";
          }

          if (defaultValue !== null) {
            props[propName] = defaultValue;
          }
        }
      }
    }

    return Object.keys(props).length > 0 ? props : null;
  } catch (error) {
    console.warn(
      `Warning: Could not parse props from ${filePath}:`,
      error.message
    );
    return null;
  }
}

// Scan directory recursively for TypeScript components
function scanComponents(dir, basePath = "") {
  const components = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && item !== "node_modules") {
      // Recursively scan subdirectories
      components.push(...scanComponents(fullPath, path.join(basePath, item)));
    } else if (item.endsWith(".tsx") && item !== "Registry.tsx") {
      const relativePath = path.join(basePath, item);
      const componentName = path.basename(item, ".tsx");
      const folderName = path.basename(basePath) || "root";

      // Parse props from the file
      const props = parseComponentProps(fullPath);

      components.push({
        name: componentName,
        fileName: item,
        relativePath: relativePath,
        folderName: folderName,
        fullPath: fullPath,
        props: props,
        uuid: generateDeterministicUUID(relativePath),
        titleCase: toTitleCase(componentName),
        camelCase: toCamelCase(componentName),
        importPath: `./${relativePath.replace(/\\/g, "/").replace(".tsx", "")}`,
      });
    }
  }

  return components;
}

// Generate Registry.tsx content
function generateRegistry(components) {
  const imports = components
    .map((comp) => `import ${comp.name} from "${comp.importPath}";`)
    .sort()
    .join("\n");

  const registryEntries = components
    .map((comp) => {
      const propsConfig = comp.props
        ? `, props: ${JSON.stringify(comp.props, null, 2).replace(
            /\n/g,
            "\n    "
          )}`
        : "";
      return `  "${comp.uuid}": { component: ${comp.name}${propsConfig} }`;
    })
    .join(",\n");

  return `// Auto-generated Registry.tsx
// This file is automatically generated by generate-components.js
// Do not edit manually - changes will be overwritten

import React from "react";

${imports}

export interface ComponentConfig {
  component: React.ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
}

export const registry: Record<string, ComponentConfig> = {
${registryEntries}
};

export default registry;
`;
}

// Generate SQL content
function generateSQL(components) {
  const componentInserts = components
    .map((comp) => {
      const layout = comp.props
        ? JSON.stringify(comp.props).replace(/'/g, "''")
        : "{}";
      // Set stat to true for header components
      const isStatComponent = comp.folderName === "header";
      return `  ('${comp.uuid}', '${
        comp.titleCase
      }', 'Analytics component for ${comp.titleCase.toLowerCase()}', '${
        comp.fileName
      }', '${layout}', ${isStatComponent}, false)`;
    })
    .join(",\n");

  // Group components by folder for dashboard layout
  const folderGroups = {
    header: components
      .filter((c) => c.folderName === "header")
      .map((c) => c.uuid),
    primary: components
      .filter((c) => c.folderName === "primary")
      .map((c) => c.uuid),
    secondary: components
      .filter((c) => c.folderName === "secondary")
      .map((c) => c.uuid),
    footer: components
      .filter((c) => c.folderName === "footer")
      .map((c) => c.uuid),
  };

  const dashboardUUID = generateDeterministicUUID("sample-analytics-dashboard");

  return `CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

CREATE TABLE components (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
  name       TEXT        NOT NULL,
  description TEXT        NOT NULL,
  file_name   TEXT        NOT NULL,
  layout JSONB       NOT NULL DEFAULT '{}', -- extra props for the component
  stat BOOLEAN NOT NULL DEFAULT FALSE, -- if this is a statistic
  default_component      BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE dashboards (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL           DEFAULT NOW(),
    profile_id   UUID        NULL REFERENCES profiles(id) ON DELETE CASCADE, -- NULL for global dashboards
    header_component_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- order matters
    primary_component_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- order matters
    secondary_component_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- order matters
    footer_component_ids UUID[]       NOT NULL DEFAULT ARRAY[]::UUID[], -- order matters
    auto_scroll BOOLEAN NOT NULL DEFAULT FALSE,
    show_indicators BOOLEAN NOT NULL DEFAULT TRUE,
    header_components INTEGER NOT NULL DEFAULT 3, -- number of components in the header
    main_split FLOAT NOT NULL DEFAULT 0.65, -- number 0-1 for split between primary and secondary
    footer_split FLOAT NOT NULL DEFAULT 0.5 -- number 0-1 for split between footer section
);

-- ============================================================================
-- INSERT COMPONENTS
-- ============================================================================

INSERT INTO components (id, name, description, file_name, layout, stat, default_component) VALUES
${componentInserts};

-- ============================================================================
-- INSERT SAMPLE DASHBOARD
-- ============================================================================

INSERT INTO dashboards (
  id, 
  profile_id, 
  header_component_ids, 
  primary_component_ids, 
  secondary_component_ids, 
  footer_component_ids,
  auto_scroll,
  show_indicators,
  header_components,
  main_split,
  footer_split
) VALUES (
  '${dashboardUUID}',
  NULL, -- Global dashboard
  ARRAY[${folderGroups.header.map((id) => `'${id}'`).join(", ")}]::UUID[],
  ARRAY[${folderGroups.primary.map((id) => `'${id}'`).join(", ")}]::UUID[],
  ARRAY[${folderGroups.secondary.map((id) => `'${id}'`).join(", ")}]::UUID[],
  ARRAY[${folderGroups.footer.map((id) => `'${id}'`).join(", ")}]::UUID[],
  true,
  true,
  4,
  0.65, 
  0.5
);
`;
}

// Main execution
function main() {
  console.log("🔧 Generating analytics components...");

  // Scan for components
  const components = scanComponents(ANALYTICS_DIR);
  console.log(`Found ${components.length} components:`);

  components.forEach((comp) => {
    console.log(
      `  - ${comp.name} (${comp.folderName}) [${comp.uuid}]${
        comp.props ? " with props" : ""
      }`
    );
  });

  // Generate Registry.tsx
  const registryContent = generateRegistry(components);
  fs.writeFileSync(REGISTRY_PATH, registryContent);
  console.log(`✅ Registry.tsx updated with ${components.length} components`);

  // Generate SQL
  const sqlContent = generateSQL(components);
  fs.writeFileSync(OUTPUT_SQL, sqlContent);
  console.log(
    `✅ SQL generated with ${components.length} components and 1 sample dashboard`
  );

  console.log("🎉 Analytics components generation completed!");
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateDeterministicUUID, main, parseComponentProps, scanComponents };
