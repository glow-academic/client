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
function jsonTypeToTsType(jsonType: string): string {
  // Handle array types like "string[]", "number[]", etc.
  if (jsonType.endsWith("[]")) {
    const elementType = jsonType.slice(0, -2);
    const tsElementType = jsonTypeToTsType(elementType);
    return `${tsElementType}[]`;
  }

  switch (jsonType) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "Record<string, unknown>";
    case "array":
      return "unknown[]";
    default:
      return "unknown";
  }
}

// Generate TypeScript type definition for a payload
function generatePayloadType(
  payload: Record<string, string>,
  indent: string = "    "
): string {
  if (Object.keys(payload).length === 0) {
    return "Record<string, never>";
  }

  const lines: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    const tsType = jsonTypeToTsType(value);
    lines.push(`${indent}${key}: ${tsType};`);
  }
  return `{\n${lines.join("\n")}\n  }`;
}

// Generate TypeScript type definition for a return type
function generateReturnType(
  returnSchema: Record<string, string> | undefined
): string {
  if (!returnSchema || Object.keys(returnSchema).length === 0) {
    return "void";
  }

  // If it's a simple primitive (single "value" field), return the type directly
  if (Object.keys(returnSchema).length === 1 && returnSchema["value"]) {
    return jsonTypeToTsType(returnSchema["value"]);
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
      `  ${eventName}: (payload: ${payloadType}) => ${functionReturnType};`
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
