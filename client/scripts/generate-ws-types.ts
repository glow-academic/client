/**
 * Generate ws-types.ts from ws.json
 * This script reads the WebSocket contract JSON and generates explicit TypeScript types
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WsContract {
  clientToServer: Record<
    string,
    { payload: Record<string, string>; return?: Record<string, string> }
  >;
  serverToClient: Record<string, { payload: Record<string, string> }>;
}

// Map JSON type strings to TypeScript types
// Optional types are prefixed with '?' (e.g., "?string" means optional string)
function jsonTypeToTsType(jsonType: string): {
  type: string;
  isOptional: boolean;
} {
  let isOptional = false;
  let typeStr = jsonType;

  // Check if type is optional (prefixed with '?')
  if (typeStr.startsWith("?")) {
    isOptional = true;
    typeStr = typeStr.slice(1); // Remove '?' prefix
  }

  // Handle array types like "string[]", "number[]", "object{...}[]", etc.
  if (typeStr.endsWith("[]")) {
    const elementType = typeStr.slice(0, -2);
    const elementResult = jsonTypeToTsType(elementType);
    return {
      type: `${elementResult.type}[]`,
      isOptional,
    };
  }

  // Handle inline object types like "object{idx:number,hint:string}"
  // Also handles nested objects like "object{string:string|null}" for Record types
  if (typeStr.startsWith("object{") && typeStr.endsWith("}")) {
    const fieldsStr = typeStr.slice(7, -1); // Extract content between "object{" and "}"

    // Check if this is a Record type pattern: "object{string:T}" or "object{string:T|null}"
    // This represents dict[str, T] or dict[str, T | None]
    const recordMatch = fieldsStr.match(/^string:(.+)$/);
    if (recordMatch && recordMatch[1]) {
      const valueType = recordMatch[1].trim();
      const valueResult = jsonTypeToTsType(valueType);
      return {
        type: `Record<string, ${valueResult.type}>`,
        isOptional,
      };
    }

    // Regular object type with multiple fields
    const fields = fieldsStr.split(",");
    const tsFields = fields.map((field) => {
      const colonIndex = field.indexOf(":");
      if (colonIndex === -1) {
        // No colon found, treat as field name only
        return field.trim();
      }
      const name = field.slice(0, colonIndex).trim();
      const type = field.slice(colonIndex + 1).trim();
      const fieldResult = jsonTypeToTsType(type);
      return `${name}: ${fieldResult.type}`;
    });
    return {
      type: `{ ${tsFields.join("; ")} }`,
      isOptional,
    };
  }

  // Handle union types like "string|null", "number|string", etc.
  if (typeStr.includes("|")) {
    const unionTypes = typeStr.split("|").map((t) => t.trim());
    const tsUnionTypes = unionTypes.map((unionType) => {
      // Handle "null" as a literal type
      if (unionType === "null") {
        return "null";
      }
      const unionResult = jsonTypeToTsType(unionType);
      return unionResult.type;
    });
    return {
      type: tsUnionTypes.join(" | "),
      isOptional,
    };
  }

  let baseType: string;
  switch (typeStr) {
    case "string":
      baseType = "string";
      break;
    case "number":
      baseType = "number";
      break;
    case "boolean":
      baseType = "boolean";
      break;
    case "object":
      baseType = "Record<string, unknown>";
      break;
    case "array":
      baseType = "unknown[]";
      break;
    default:
      baseType = "unknown";
  }

  return { type: baseType, isOptional };
}

// Generate TypeScript type definition for a payload
function generatePayloadType(
  payload: Record<string, string>,
  indent: string = "    ",
): string {
  if (Object.keys(payload).length === 0) {
    return "Record<string, never>";
  }

  const lines: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    const { type, isOptional } = jsonTypeToTsType(value);
    const optionalMarker = isOptional ? "?" : "";
    lines.push(`${indent}${key}${optionalMarker}: ${type};`);
  }
  return `{\n${lines.join("\n")}\n  }`;
}

// Generate TypeScript type definition for a return type
function generateReturnType(
  returnSchema: Record<string, string> | undefined,
): string {
  if (!returnSchema || Object.keys(returnSchema).length === 0) {
    return "void";
  }

  // If it's a simple primitive (single "value" field), return the type directly
  if (Object.keys(returnSchema).length === 1 && returnSchema["value"]) {
    return jsonTypeToTsType(returnSchema["value"]).type;
  }

  // Otherwise, generate an object type
  return generatePayloadType(returnSchema, "    ");
}

// Generate ServerToClientEvents type
function generateServerToClientEvents(contract: WsContract): string {
  const events: string[] = [];
  for (const [eventName, eventDef] of Object.entries(contract.serverToClient)) {
    const payloadType = generatePayloadType(eventDef.payload);
    // ServerToClientEvents are emits (listeners), always return void
    events.push(`  ${eventName}: (payload: ${payloadType}) => void;`);
  }
  return `export type ServerToClientEvents = {\n${events.join("\n")}\n};`;
}

// Generate ClientToServerEvents type
function generateClientToServerEvents(contract: WsContract): string {
  const events: string[] = [];
  for (const [eventName, eventDef] of Object.entries(contract.clientToServer)) {
    const payloadType = generatePayloadType(eventDef.payload);
    const returnType = generateReturnType(eventDef.return);

    // If there's a return type, make it Promise<ReturnType>, otherwise void
    const functionReturnType =
      returnType === "void" ? "void" : `Promise<${returnType}>`;

    events.push(
      `  ${eventName}: (payload: ${payloadType}) => ${functionReturnType};`,
    );
  }
  // If no events, return empty object type
  if (events.length === 0) {
    return `export type ClientToServerEvents = {\n\n};`;
  }
  return `export type ClientToServerEvents = {\n${events.join("\n")}\n};`;
}

function main() {
  const wsJsonPath = path.join(__dirname, "../../server/ws.json");
  const outputDir = path.join(__dirname, "../lib/ws");
  const outputPath = path.join(outputDir, "types.ts");

  // Ensure the ws directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Read ws.json
  if (!fs.existsSync(wsJsonPath)) {
    console.error(`❌ ws.json not found at ${wsJsonPath}`);
    console.error("   Make sure the server has generated ws.json first");
    process.exit(1);
  }

  const wsJsonContent = fs.readFileSync(wsJsonPath, "utf-8");
  const contract: WsContract = JSON.parse(wsJsonContent);

  // Generate TypeScript types
  const serverToClientTypes = generateServerToClientEvents(contract);
  const clientToServerTypes = generateClientToServerEvents(contract);

  // Generate the complete file
  const fileContent = `/**
 * This file was auto-generated from ws.json.
 * Do not make direct changes to this file.
 */

${serverToClientTypes}

${clientToServerTypes}
`;

  // Write output file
  fs.writeFileSync(outputPath, fileContent, "utf-8");
  console.log(`✅ Generated types.ts at ${outputPath}`);
}

main();
