#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path configurations
const SCHEMA_PATH = path.join(__dirname, "../drizzle/schema.ts");
const CLIENT_MOCKS_DIR = path.join(__dirname, "../../client/mocks");
const CLIENT_QUERIES_DIR = path.join(__dirname, "../../client/utils/queries");
const CLIENT_MUTATIONS_DIR = path.join(
  __dirname,
  "../../client/utils/mutations"
);

/**
 * Extract table and enum information from schema file
 */
function extractSchemaInfo() {
  const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf8");

  // Extract enums
  const enumRegex = /export const (\w+) = pgEnum\("([^"]+)", \[([^\]]+)\]/g;
  const enums = {};
  let enumMatch;

  while ((enumMatch = enumRegex.exec(schemaContent)) !== null) {
    const [, enumName, dbName, valuesStr] = enumMatch;
    const values = valuesStr
      .split(",")
      .map((v) => v.trim().replace(/['"]/g, ""));
    enums[enumName] = { dbName, values };
  }

  // Extract table information by parsing the schema more carefully
  const tables = {};

  // Use a more robust approach - split by table definitions
  const lines = schemaContent.split("\n");
  let currentTable = null;
  let currentFields = {};
  let inTableDef = false;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Start of table definition
    const tableMatch = line.match(
      /export const (\w+) = pgTable\("([^"]+)", \{/
    );
    if (tableMatch) {
      const [, exportName, tableName] = tableMatch;
      currentTable = { exportName, tableName };
      currentFields = {};
      inTableDef = true;
      braceCount = 1;
      continue;
    }

    if (inTableDef) {
      // Count braces to know when we're done with the table
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      // If we're still in the table definition, parse fields
      if (braceCount > 0) {
        const fieldMatch = line.match(/(\w+):\s*(.+?)(?:,\s*$|$)/);
        if (fieldMatch) {
          const [, fieldName, fieldDef] = fieldMatch;

          // Determine field type and properties
          let type = "string";
          let isRequired = fieldDef.includes(".notNull()");
          let isArray = fieldDef.includes(".array()");
          let enumType = null;
          let hasDefault =
            fieldDef.includes(".default") ||
            fieldDef.includes(".defaultRandom()") ||
            fieldDef.includes(".defaultNow()");
          let isPrimaryKey = fieldDef.includes(".primaryKey()");

          // Determine type based on field definition
          if (fieldDef.includes("uuid()")) {
            type = "uuid";
          } else if (
            fieldDef.includes("serial()") ||
            fieldDef.includes("integer()") ||
            fieldDef.includes("bigint(")
          ) {
            type = "number";
          } else if (fieldDef.includes("boolean()")) {
            type = "boolean";
          } else if (fieldDef.includes("timestamp(")) {
            type = "timestamp";
          } else if (
            fieldDef.includes("jsonb()") ||
            fieldDef.includes("json()")
          ) {
            type = "json";
          } else if (
            fieldDef.includes("text()") ||
            fieldDef.includes("varchar(")
          ) {
            type = "string";
          }

          // Check for enum types
          Object.keys(enums).forEach((enumName) => {
            if (fieldDef.includes(`${enumName}()`)) {
              type = "enum";
              enumType = enumName;
            }
          });

          currentFields[fieldName] = {
            type,
            isRequired,
            isArray,
            enumType,
            hasDefault,
            isPrimaryKey,
          };
        }
      }

      // End of table definition
      if (braceCount === 0) {
        tables[currentTable.exportName] = {
          tableName: currentTable.tableName,
          exportName: currentTable.exportName,
          fields: currentFields,
        };
        inTableDef = false;
        currentTable = null;
        currentFields = {};
      }
    }
  }

  return { tables, enums };
}

/**
 * Generate meaningful mock data based on table name and field context
 */
function generateMockData(tables, enums) {
  const mockData = {};
  const currentTime = new Date().toISOString();

  // Helper function to generate UUIDs for consistency
  const generateUUID = (prefix = "") =>
    `${prefix}${Math.random().toString(36).substr(2, 8)}-${Math.random()
      .toString(36)
      .substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random()
      .toString(36)
      .substr(2, 4)}-${Math.random().toString(36).substr(2, 12)}`;

  // Generate base mock data for each table
  Object.entries(tables).forEach(([exportName, tableInfo]) => {
    const { tableName, fields } = tableInfo;

    // Determine how many records to create based on context
    let recordCount = 1;
    if (
      [
        "scenarios",
        "agents",
        "rubrics",
        "classes",
        "cohorts",
        "simulations",
      ].includes(exportName)
    ) {
      recordCount = 2; // More for key entities that have relationships
    }

    // Create 4 users and 4 profiles for testing different roles
    if (exportName === "users") {
      recordCount = 4;
    }
    if (exportName === "profiles") {
      recordCount = 4;
    }

    const records = [];

    for (let i = 0; i < recordCount; i++) {
      const record = {};

      Object.entries(fields).forEach(([fieldName, fieldInfo]) => {
        const {
          type,
          isRequired,
          isArray,
          enumType,
          hasDefault,
          isPrimaryKey,
        } = fieldInfo;

        // Skip non-required fields sometimes for variety
        if (!isRequired && !hasDefault && Math.random() > 0.7) {
          return;
        }

        let value;

        switch (type) {
          case "uuid":
            if (fieldName === "id" || isPrimaryKey) {
              value = generateUUID();
            } else {
              // This is likely a foreign key - we'll handle these in a second pass
              value = null;
            }
            break;

          case "number":
            if (fieldName.includes("id") && !isPrimaryKey) {
              value = i + 1; // Simple incremental for foreign keys
            } else if (
              fieldName.includes("point") ||
              fieldName.includes("score")
            ) {
              value = Math.floor(Math.random() * 100) + 1;
            } else if (
              fieldName.includes("turn") ||
              fieldName.includes("limit")
            ) {
              value = Math.floor(Math.random() * 10) + 1;
            } else if (fieldName.includes("temperature")) {
              value = Math.floor(Math.random() * 100) / 100; // 0.0 to 1.0
            } else if (fieldName.includes("year")) {
              value = 2024;
            } else {
              value = Math.floor(Math.random() * 100) + 1;
            }
            break;

          case "boolean":
            if (fieldName.includes("default") || fieldName.includes("active")) {
              value = i === 0; // First record is default/active
            } else {
              value = Math.random() > 0.5;
            }
            break;

          case "timestamp":
            value = currentTime;
            break;

          case "json":
            value = {};
            break;

          case "enum":
            if (enumType && enums[enumType]) {
              const enumValues = enums[enumType].values;
              // Special handling for profile roles to ensure we get all 4 types
              if (exportName === "profiles" && enumType === "profileRole") {
                const roles = ["admin", "instructional", "instructor", "ta"];
                value = roles[i % roles.length];
              } else {
                value = enumValues[i % enumValues.length];
              }
            }
            break;

          default: // string/text
            value = generateMeaningfulText(tableName, fieldName, i);
            break;
        }

        if (isArray && value !== null) {
          value = [value];
        }

        if (value !== null) {
          record[fieldName] = value;
        }
      });

      records.push(record);
    }

    mockData[exportName] = records;
  });

  // Second pass: Set up foreign key relationships
  setupForeignKeyRelationships(mockData, tables);

  return mockData;
}

/**
 * Generate meaningful text based on context
 */
function generateMeaningfulText(tableName, fieldName, index) {
  const contexts = {
    agents: {
      name:
        ["Math Tutor Agent", "Science Helper Bot", "Writing Assistant"][
          index
        ] || `Agent ${index + 1}`,
      description:
        [
          "Helps students with mathematical concepts and problem-solving",
          "Assists with scientific inquiries and experiments",
          "Provides writing feedback and grammar assistance",
        ][index] || `Description for agent ${index + 1}`,
      systemPrompt:
        [
          "You are a helpful math tutor. Guide students through problems step by step.",
          "You are a science assistant. Help students understand scientific concepts.",
          "You are a writing coach. Help students improve their writing skills.",
        ][index] || `System prompt for agent ${index + 1}`,
    },
    scenarios: {
      name:
        [
          "Algebra Problem Solving",
          "Chemistry Lab Safety",
          "Essay Writing Workshop",
        ][index] || `Scenario ${index + 1}`,
      description:
        [
          "Students work through complex algebra problems with AI assistance",
          "Students learn lab safety protocols through interactive scenarios",
          "Students practice essay writing with real-time feedback",
        ][index] || `Description for scenario ${index + 1}`,
    },
    rubrics: {
      name:
        [
          "Math Problem Solving Rubric",
          "Science Lab Rubric",
          "Writing Assessment Rubric",
        ][index] || `Rubric ${index + 1}`,
      description:
        [
          "Evaluates mathematical reasoning and problem-solving skills",
          "Assesses lab technique and safety knowledge",
          "Measures writing quality and organization",
        ][index] || `Description for rubric ${index + 1}`,
    },
    classes: {
      name:
        ["Algebra I", "General Chemistry", "English Composition"][index] ||
        `Class ${index + 1}`,
      classCode: ["MATH101", "CHEM101", "ENG101"][index] || `CLASS${index + 1}`,
      description:
        [
          "Introduction to algebraic concepts and problem solving",
          "Basic principles of chemistry and lab techniques",
          "Fundamentals of academic writing and composition",
        ][index] || `Description for class ${index + 1}`,
    },
    cohorts: {
      title:
        ["Fall 2024 Cohort", "Spring 2024 Advanced", "Summer Intensive"][
          index
        ] || `Cohort ${index + 1}`,
      description:
        [
          "Students enrolled in fall semester courses",
          "Advanced students in spring programs",
          "Intensive summer learning cohort",
        ][index] || `Description for cohort ${index + 1}`,
    },
    simulations: {
      title:
        [
          "Math Practice Simulation",
          "Lab Safety Training",
          "Writing Workshop Sim",
        ][index] || `Simulation ${index + 1}`,
    },
    evals: {
      name:
        [
          "Math Skills Evaluation",
          "Science Knowledge Test",
          "Writing Assessment",
        ][index] || `Evaluation ${index + 1}`,
      description:
        [
          "Comprehensive evaluation of mathematical problem-solving abilities",
          "Assessment of scientific understanding and application",
          "Evaluation of writing skills and techniques",
        ][index] || `Description for evaluation ${index + 1}`,
    },
    users: {
      name:
        ["Admin User", "Instructional User", "Instructor User", "TA User"][
          index
        ] || `User ${index + 1}`,
      email:
        [
          "admin@example.com",
          "instructional@example.com",
          "instructor@example.com",
          "ta@example.com",
        ][index] || `user${index + 1}@example.com`,
    },
    profiles: {
      firstName:
        ["Admin", "Instructional", "Instructor", "TA"][index] ||
        `User${index + 1}`,
      lastName: ["User", "User", "User", "User"][index] || `Last${index + 1}`,
      alias:
        ["admin-user", "instructional-user", "instructor-user", "ta-user"][
          index
        ] || `user${index + 1}`,
    },
  };

  const tableContext = contexts[tableName];
  if (tableContext && tableContext[fieldName]) {
    return tableContext[fieldName];
  }

  // Generic fallbacks
  if (fieldName.includes("name") || fieldName.includes("title")) {
    return `${tableName.charAt(0).toUpperCase() + tableName.slice(1)} ${
      index + 1
    }`;
  }
  if (fieldName.includes("description")) {
    return `Description for ${tableName} ${index + 1}`;
  }
  if (fieldName.includes("email")) {
    return `user${index + 1}@example.com`;
  }
  if (fieldName.includes("firstName")) {
    return ["John", "Jane", "Alex"][index] || `User${index + 1}`;
  }
  if (fieldName.includes("lastName")) {
    return ["Doe", "Smith", "Johnson"][index] || `Last${index + 1}`;
  }
  if (fieldName.includes("alias")) {
    return `user${index + 1}`;
  }

  return `${fieldName}_${index + 1}`;
}

/**
 * Set up foreign key relationships between mock data
 */
function setupForeignKeyRelationships(mockData, tables) {
  // Special handling for user-profile relationships (1:1 mapping)
  if (mockData.users && mockData.profiles) {
    mockData.profiles.forEach((profile, index) => {
      if (mockData.users[index]) {
        profile.userId = mockData.users[index].id;
      }
    });
  }

  // Common foreign key mappings
  const foreignKeyMappings = {
    agentId: "agents",
    baseAgentId: "agents",
    scenarioId: "scenarios",
    rubricId: "rubrics",
    classId: "classes",
    cohortId: "cohorts",
    simulationId: "simulations",
    evalId: "evals",
    profileId: "profiles",
    userId: "users",
    providerId: "providers",
    modelId: "models",
    scheduleId: "schedules",
    standardGroupId: "standardGroups",
    standardId: "standards",
  };

  Object.entries(mockData).forEach(([tableName, records]) => {
    records.forEach((record) => {
      Object.keys(record).forEach((fieldName) => {
        if (record[fieldName] === null && fieldName.endsWith("Id")) {
          const referencedTable = foreignKeyMappings[fieldName];
          if (
            referencedTable &&
            mockData[referencedTable] &&
            mockData[referencedTable].length > 0
          ) {
            // Use the first record's ID from the referenced table
            record[fieldName] = mockData[referencedTable][0].id;
          }
        }

        // Handle array fields that contain IDs
        if (Array.isArray(record[fieldName]) && fieldName.endsWith("Ids")) {
          const singularField = fieldName.slice(0, -1); // Remove 's' from 'Ids'
          const referencedTable = foreignKeyMappings[singularField];
          if (referencedTable && mockData[referencedTable]) {
            record[fieldName] = mockData[referencedTable].map(
              (item) => item.id
            );
          }
        }
      });
    });
  });
}

/**
 * Generate the schema.ts mock file
 */
function generateSchemaMockFile(mockData) {
  let content = `// Mock schema for the database, so we have mock data to work with
// Generated automatically by generate-mocks.js

`;

  Object.entries(mockData).forEach(([tableName, records]) => {
    content += `// ${tableName.toUpperCase()} MOCK DATA\n`;
    content += `export const ${tableName} = ${JSON.stringify(
      records,
      null,
      2
    )};\n\n`;
  });

  return content;
}

/**
 * Generate the queries.ts mock file
 */
function generateQueriesMockFile() {
  let content = `import { vi } from 'vitest';
import * as mockSchema from '@/mocks/schema';

// Generated automatically by generate-mocks.js

`;

  // Get all query directories
  const queryDirs = fs
    .readdirSync(CLIENT_QUERIES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  queryDirs.forEach((tableName) => {
    const tableDir = path.join(CLIENT_QUERIES_DIR, tableName);
    const queryFiles = fs
      .readdirSync(tableDir)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => file.replace(".ts", ""));

    content += `// ${tableName.toUpperCase()} QUERIES\n`;

    queryFiles.forEach((fileName) => {
      const functionName = fileName
        .split("-")
        .map((word, index) =>
          index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join("");

      // Generate appropriate mock return based on function name
      let mockReturn;
      // Convert table name to camelCase for schema key
      const schemaKey = tableName
        .replace(/_/g, "-")
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

      if (functionName.startsWith("getAll")) {
        mockReturn = `mockSchema.${schemaKey} || []`;
      } else if (
        functionName.startsWith("get") &&
        !functionName.includes("By")
      ) {
        mockReturn = `mockSchema.${schemaKey}?.[0] || null`;
      } else {
        mockReturn = `mockSchema.${schemaKey} || []`;
      }

      content += `vi.mock('@/utils/queries/${tableName}/${fileName}', () => ({\n`;
      content += `  ${functionName}: vi.fn(() => ${mockReturn}),\n`;
      content += `}));\n`;
    });

    content += "\n";
  });

  return content;
}

/**
 * Generate the mutations.ts mock file
 */
function generateMutationsMockFile() {
  let content = `import { vi } from 'vitest';
import * as mockSchema from '@/mocks/schema';

// Generated automatically by generate-mocks.js

`;

  // Get all mutation directories
  const mutationDirs = fs
    .readdirSync(CLIENT_MUTATIONS_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  mutationDirs.forEach((tableName) => {
    const tableDir = path.join(CLIENT_MUTATIONS_DIR, tableName);
    const mutationFiles = fs
      .readdirSync(tableDir)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => file.replace(".ts", ""));

    content += `// ${tableName.toUpperCase()} MUTATIONS\n`;

    mutationFiles.forEach((fileName) => {
      const functionName = fileName
        .split("-")
        .map((word, index) =>
          index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join("");

      // Generate appropriate mock return based on function name
      let mockReturn;
      const schemaKey = tableName
        .replace(/_/g, "-")
        .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

      if (functionName.startsWith("create") && !functionName.endsWith("s")) {
        mockReturn = `mockSchema.${schemaKey}?.[0] || {}`;
      } else if (functionName.startsWith("create")) {
        mockReturn = `mockSchema.${schemaKey} || []`;
      } else if (
        functionName.startsWith("update") &&
        !functionName.endsWith("s")
      ) {
        mockReturn = `mockSchema.${schemaKey}?.[0] || {}`;
      } else if (functionName.startsWith("update")) {
        mockReturn = `mockSchema.${schemaKey} || []`;
      } else if (
        functionName.startsWith("delete") &&
        !functionName.endsWith("s")
      ) {
        mockReturn = `mockSchema.${schemaKey}?.[0] || {}`;
      } else if (functionName.startsWith("delete")) {
        mockReturn = `mockSchema.${schemaKey} || []`;
      } else {
        mockReturn = `mockSchema.${schemaKey}?.[0] || {}`;
      }

      content += `export const ${functionName}Mock = vi.fn(() => ${mockReturn});\n`;
    });

    content += "\n";

    // Add vi.mock statements for each mutation
    mutationFiles.forEach((fileName) => {
      const functionName = fileName
        .split("-")
        .map((word, index) =>
          index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join("");

      content += `vi.mock('@/utils/mutations/${tableName}/${fileName}', () => ({ ${functionName}: ${functionName}Mock }));\n`;
    });

    content += "\n";
  });

  return content;
}

/**
 * Write mock files
 */
function writeMockFiles(mockData) {
  // Ensure mocks directory exists
  if (!fs.existsSync(CLIENT_MOCKS_DIR)) {
    fs.mkdirSync(CLIENT_MOCKS_DIR, { recursive: true });
  }

  // Generate and write schema.ts
  const schemaContent = generateSchemaMockFile(mockData);
  fs.writeFileSync(path.join(CLIENT_MOCKS_DIR, "schema.ts"), schemaContent);
  console.log("📝 Generated client/mocks/schema.ts");

  // Generate and write queries.ts
  const queriesContent = generateQueriesMockFile();
  fs.writeFileSync(path.join(CLIENT_MOCKS_DIR, "queries.ts"), queriesContent);
  console.log("📝 Generated client/mocks/queries.ts");

  // Generate and write mutations.ts
  const mutationsContent = generateMutationsMockFile();
  fs.writeFileSync(
    path.join(CLIENT_MOCKS_DIR, "mutations.ts"),
    mutationsContent
  );
  console.log("📝 Generated client/mocks/mutations.ts");
}

/**
 * Main function to generate mocks
 */
function generateMocks() {
  console.log("🎭 Generating comprehensive mock data for client...\n");

  try {
    // Extract schema information
    console.log("📖 Reading database schema...");
    const { tables, enums } = extractSchemaInfo();
    console.log(
      `📊 Found ${Object.keys(tables).length} tables and ${
        Object.keys(enums).length
      } enums\n`
    );

    // Generate mock data
    console.log("🎲 Generating mock data with relationships...");
    const mockData = generateMockData(tables, enums);

    // Write mock files
    console.log("📝 Writing mock files...");
    writeMockFiles(mockData);

    console.log("\n✅ Mock generation complete!");
    console.log("📁 Check client/mocks/ directory for generated files");
    console.log(
      "🧪 Mock data includes proper relationships and meaningful content"
    );
  } catch (error) {
    console.error("❌ Error generating mocks:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateMocks();
}

export { generateMocks };
