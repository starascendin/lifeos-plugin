#!/usr/bin/env node

import { VERSION, BUILD_TIME } from "./build-info.js";

const CONVEX_URL = process.env.CONVEX_URL;
const USER_ID = process.env.LIFEOS_USER_ID;
const API_KEY = process.env.LIFEOS_API_KEY;

function usage(): never {
  console.error(`lifeos-cli v${VERSION} (built ${BUILD_TIME})`);
  console.error("");
  console.error("Usage: lifeos <tool_name> [key=value ...]");
  console.error("");
  console.error("Examples:");
  console.error("  lifeos get_clients");
  console.error('  lifeos get_client clientId=abc123');
  console.error('  lifeos get_tasks status=todo limit=10');
  console.error('  lifeos get_contact_dossier nameQuery="mindworks"');
  console.error("");
  console.error("Environment variables:");
  console.error("  CONVEX_URL        Convex deployment URL (required)");
  console.error("  LIFEOS_USER_ID    Default user ID (required)");
  console.error("  LIFEOS_API_KEY    API key for authentication (optional)");
  process.exit(1);
}

function coerce(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

function parseArgs(args: string[]): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const arg of args) {
    const eq = arg.indexOf("=");
    if (eq === -1) {
      console.error(`Invalid argument (expected key=value): ${arg}`);
      process.exit(1);
    }
    const key = arg.slice(0, eq);
    let value = arg.slice(eq + 1);
    // Strip surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    params[key] = coerce(value);
  }
  return params;
}

async function callConvexTool(
  tool: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  if (!CONVEX_URL) {
    console.error("Error: CONVEX_URL environment variable is not set");
    process.exit(1);
  }
  if (!USER_ID) {
    console.error("Error: LIFEOS_USER_ID environment variable is not set");
    process.exit(1);
  }

  const url = `${CONVEX_URL}/tool-call`;

  const { userId: overrideUserId, ...toolParams } = params;
  const effectiveUserId = (overrideUserId as string) || USER_ID;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      tool,
      userId: effectiveUserId,
      params: toolParams,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Convex API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  if (!result.success && result.error) {
    throw new Error(result.error);
  }

  return result.result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    usage();
  }

  if (args[0] === "--version" || args[0] === "-v") {
    console.log(`${VERSION}`);
    process.exit(0);
  }

  const tool = args[0];
  const params = parseArgs(args.slice(1));

  try {
    const result = await callConvexTool(tool, params);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
