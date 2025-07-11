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
const REGISTRY_DIR = path.join(__dirname, "../../../client/lib");
const REGISTRY_PATH = path.join(REGISTRY_DIR, "registry.tsx");
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

    // First, try to extract default values from function parameters
    const functionDefaults = {};

    // Look for function definition with destructured parameters
    const functionRegex =
      /export\s+default\s+function\s+\w+\s*\(\s*\{([^}]+)\}\s*:\s*\w*Props\s*\)/s;
    const functionMatch = content.match(functionRegex);

    if (functionMatch) {
      const paramString = functionMatch[1];

      // Parse individual parameters with defaults
      const paramLines = paramString
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("//"));

      for (const line of paramLines) {
        // Match patterns like: propName = defaultValue,
        const paramMatch = line.match(/(\w+)(?:\s*:\s*[^=]+)?\s*=\s*([^,]+)/);
        if (paramMatch) {
          const [, propName, defaultValue] = paramMatch;
          let parsedDefault = defaultValue.trim();

          // Remove trailing comma if present
          if (parsedDefault.endsWith(",")) {
            parsedDefault = parsedDefault.slice(0, -1);
          }

          // Parse the default value based on its type
          if (parsedDefault === "true" || parsedDefault === "false") {
            functionDefaults[propName] = parsedDefault === "true";
          } else if (
            parsedDefault.startsWith('"') &&
            parsedDefault.endsWith('"')
          ) {
            functionDefaults[propName] = parsedDefault.slice(1, -1);
          } else if (
            parsedDefault.startsWith("'") &&
            parsedDefault.endsWith("'")
          ) {
            functionDefaults[propName] = parsedDefault.slice(1, -1);
          } else if (!isNaN(Number(parsedDefault))) {
            functionDefaults[propName] = Number(parsedDefault);
          } else {
            // For string literals without quotes, keep as string
            functionDefaults[propName] = parsedDefault.replace(/['"]/g, "");
          }
        }
      }
    }

    // Extract type definitions and interfaces to get dropdown options
    const typeDefinitions = {};
    const interfaceDefinitions = {};

    // Extract type definitions like: type ColorTheme = "blue" | "green" | "purple";
    const typeRegex = /type\s+(\w+)\s*=\s*([^;]+);/g;
    let typeMatch;
    while ((typeMatch = typeRegex.exec(content)) !== null) {
      const [, typeName, typeDefinition] = typeMatch;

      // Extract union type options
      const unionOptions = typeDefinition
        .split("|")
        .map((option) => option.trim())
        .filter((option) => option.startsWith('"') && option.endsWith('"'))
        .map((option) => option.slice(1, -1)); // Remove quotes

      if (unionOptions.length > 0) {
        typeDefinitions[typeName] = unionOptions;
      }
    }

    // Parse interface to get prop types and link them to type definitions
    const interfaceRegex = /interface\s+(\w*Props)\s*{([^}]*)}/g;
    const props = {};
    const propMetadata = {};

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
          const cleanPropType = propType.trim();

          // Check if this prop type matches a type definition
          const matchedTypeDef = Object.keys(typeDefinitions).find((typeName) =>
            cleanPropType.includes(typeName)
          );

          // Determine default value based on type
          let defaultValue = null;
          let metadata = {};

          // Handle function types
          if (
            cleanPropType.includes("=>") ||
            cleanPropType.includes("function") ||
            cleanPropType.includes("Function")
          ) {
            // Skip function props - they should be handled dynamically
            continue;
          } else if (matchedTypeDef && typeDefinitions[matchedTypeDef]) {
            // This is a union type with predefined options
            const options = typeDefinitions[matchedTypeDef];
            defaultValue = options[0]; // Use first option as default
            metadata = {
              type: "select",
              options: options,
              multiple: false,
            };
          } else if (
            cleanPropType.includes('"') &&
            cleanPropType.includes("|")
          ) {
            // Inline union of string literals
            const options = cleanPropType
              .split("|")
              .map((option) => option.trim())
              .filter(
                (option) => option.startsWith('"') && option.endsWith('"')
              )
              .map((option) => option.slice(1, -1));

            if (options.length > 0) {
              defaultValue = options[0];
              metadata = {
                type: "select",
                options: options,
                multiple: false,
              };
            }
          } else if (cleanPropType.includes("boolean")) {
            defaultValue = false;
            metadata = { type: "boolean" };
          } else if (cleanPropType.includes("number")) {
            defaultValue = 0;
            metadata = { type: "number" };
          } else if (cleanPropType.includes("string")) {
            defaultValue = "";
            metadata = { type: "string" };
          } else if (cleanPropType.includes("className")) {
            // Special case for className
            defaultValue = "";
            metadata = { type: "string" };
          }

          if (defaultValue !== null) {
            props[propName] = defaultValue;
            if (Object.keys(metadata).length > 0) {
              propMetadata[propName] = metadata;
            }
          }
        }
      }
    }

    // If we found function defaults, merge them with interface-derived props
    if (Object.keys(functionDefaults).length > 0) {
      // Use function defaults as the primary source, but keep metadata from interface parsing
      const mergedProps = { ...props, ...functionDefaults };
      return Object.keys(mergedProps).length > 0
        ? { props: mergedProps, metadata: propMetadata }
        : null;
    }

    return Object.keys(props).length > 0
      ? { props, metadata: propMetadata }
      : null;
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
      const propsResult = parseComponentProps(fullPath);
      const props = propsResult?.props || null;
      const metadata = propsResult?.metadata || {};

      components.push({
        name: componentName,
        fileName: item,
        relativePath: relativePath,
        folderName: folderName,
        fullPath: fullPath,
        props: props,
        metadata: metadata,
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

      const metadataConfig =
        comp.metadata && Object.keys(comp.metadata).length > 0
          ? `, metadata: ${JSON.stringify(comp.metadata, null, 2).replace(
              /\n/g,
              "\n    "
            )}`
          : "";

      return `  "${comp.uuid}": { component: ${comp.name}${propsConfig}${metadataConfig} }`;
    })
    .join(",\n");

  return `// Auto-generated Registry.tsx
// This file is automatically generated by generate-components.js
// Do not edit manually - changes will be overwritten

import React from "react";

${imports}

export interface PropMetadata {
  type: "string" | "number" | "boolean" | "select";
  options?: string[];
  multiple?: boolean;
}

export interface ComponentConfig {
  component: React.ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
  metadata?: Record<string, PropMetadata>;
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
      const layoutData = {
        props: comp.props || {},
        metadata: comp.metadata || {},
      };
      const layout = JSON.stringify(layoutData).replace(/'/g, "''");

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
  layout JSONB       NOT NULL DEFAULT '{}', -- extra props for the component and metadata
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
  false,
  true,
  3,
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
