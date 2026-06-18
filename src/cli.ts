#!/usr/bin/env node

import { VERSION, BUILD_TIME } from "./build-info.js";

const CONVEX_URL = process.env.CONVEX_URL || process.env.LIFEOS_CONVEX_URL;
const USER_ID = process.env.LIFEOS_USER_ID;
const API_KEY = process.env.LIFEOS_API_KEY;
const SURREAL_ENDPOINT = process.env.SURREAL_ENDPOINT;
const SURREAL_USER = process.env.SURREAL_USER;
const SURREAL_PASS = process.env.SURREAL_PASS;
const SURREAL_NS = process.env.SURREAL_NS || "lifeos";
const SURREAL_DB = process.env.SURREAL_DB || "graph";
const PPV_ACTION_TO_TOOL: Record<string, string> = {
  workspace: "get_ppv_workspace",
  graph: "get_active_vision_graph",
  "vision-graph": "get_active_vision_graph",
  frictions: "get_belief_reframes",
  "list-frictions": "get_belief_reframes",
  "create-friction": "create_belief_reframe",
  "update-friction": "update_belief_reframe",
  "resolve-friction": "update_belief_reframe",
  "activate-vision": "set_active_ppv_vision",
  "set-active-vision": "set_active_ppv_vision",
  "archive-vision": "archive_ppv_vision",
  "delete-vision": "delete_ppv_vision",
};
const GRAPH_ACTION_TO_TOOL: Record<string, string> = {
  vision: "get_active_vision_graph",
  "active-vision": "get_active_vision_graph",
  life: "get_unified_life_graph",
  unified: "get_unified_life_graph",
  full: "get_unified_life_graph",
  project: "get_project_graph",
  initiative: "get_initiative_graph",
  person: "get_person_graph",
  memo: "get_voice_memo_graph",
  "voice-memo": "get_voice_memo_graph",
  cache: "get_cached_unified_graph",
  "refresh-cache": "refresh_unified_graph_cache",
  link: "upsert_unified_graph_link",
  "delete-link": "delete_unified_graph_link",
};
const SURREAL_AGENT_LINK_TABLE = "lifeos_agent_links";
const SURREAL_TABLE_PREFIXES = ["lifeos_", "life_", "ppv1_"];
const SURREAL_RELATION_TABLES = [
  "ppv_has_identity",
  "ppv_has_pillar",
  "ppv_has_action",
  "ppv_has_reflection",
  "ppv_has_adjustment",
  "ppv_pillar_drives_action",
  "ppv_pillar_supports_project",
  "ppv_project_executes_action",
  "ppv_reflection_inspires_adjustment",
  SURREAL_AGENT_LINK_TABLE,
];
const SURREAL_MUTATING_KEYWORDS = [
  "ALTER",
  "CREATE",
  "DEFINE",
  "DELETE",
  "INSERT",
  "KILL",
  "LIVE",
  "REBUILD",
  "RELATE",
  "REMOVE",
  "SLEEP",
  "THROW",
  "UPDATE",
  "UPSERT",
];

type SurrealSqlResult = {
  status?: string;
  time?: string;
  result?: unknown;
  detail?: string;
};

type SurrealConfig = {
  endpoint: string;
  user: string;
  pass: string;
  ns: string;
  db: string;
};

type JsonObject = Record<string, unknown>;
function usage(): never {
  console.error(`lifeos v${VERSION} (built ${BUILD_TIME})`);
  console.error("");
  console.error("Usage: lifeos <tool_name> [key=value ...]");
  console.error("       lifeos ppv <action> [key=value ...]");
  console.error("       lifeos graph <action> [key=value ...]");
  console.error(
    "       lifeos surreal <schema|query|link|unlink> [key=value ...]",
  );
  console.error("");
  console.error("Examples:");
  console.error("  lifeos get_clients");
  console.error("  lifeos get_client clientId=abc123");
  console.error("  lifeos get_tasks status=todo limit=10");
  console.error('  lifeos get_contact_dossier nameQuery="mindworks"');
  console.error("  lifeos get_ppv_workspace");
  console.error("  lifeos get_active_vision_graph");
  console.error("  lifeos ppv workspace");
  console.error(
    "  lifeos ppv graph recentVoiceLimit=8 recentVoiceLookbackDays=21",
  );
  console.error(
    "  lifeos ppv frictions visionIds=" + "'" + '["ppv1_visions:abc123"]' + "'",
  );
  console.error(
    '  lifeos ppv create-friction type=fear title="Launch fear" belief="I might miss the moment" reframe="Ship a small field note this week" visionIds=' +
      "'" +
      '["ppv1_visions:abc123"]' +
      "'",
  );
  console.error(
    "  lifeos ppv update-friction beliefId=life_beliefReframes:abc123 status=resolved isResolved=true",
  );
  console.error(
    "  lifeos graph vision recentVoiceLimit=8 recentVoiceLookbackDays=21",
  );
  console.error("  lifeos graph project projectIdOrKey=ACME maxHops=2");
  console.error(
    "  lifeos graph initiative initiativeId=lifeos_initiatives:abc123",
  );
  console.error("  lifeos graph cache");
  console.error("  lifeos graph refresh-cache");
  console.error(
    '  lifeos graph link fromNodeId=ppv1_visions:abc toNodeId=lifeos_pmProjects:def kind=supports evidence="Vision supports this project"',
  );
  console.error("  lifeos surreal schema");
  console.error(
    '  lifeos surreal query query="SELECT id, title FROM ppv1_visions LIMIT 5;"',
  );
  console.error(
    '  lifeos surreal link fromTable=ppv1_pillars fromId=abc toTable=lifeos_pmProjects toId=def kind=supports reason="Pillar supports project" confidence=0.8',
  );
  console.error("  lifeos ppv activate-vision visionId=ppv1_visions:abc123");
  console.error("  lifeos ppv archive-vision visionId=ppv1_visions:abc123");
  console.error("  lifeos ppv delete-vision visionId=ppv1_visions:abc123");
  console.error("  lifeos set_active_ppv_vision visionId=ppv1_visions:abc123");
  console.error(
    "  lifeos get_voice_memos_by_labels labels=" +
      "'" +
      '["focus","idea"]' +
      "'",
  );
  console.error(
    "  lifeos get_voice_memos_by_labels tags=" +
      "'" +
      '["journal"]' +
      "' isSummarized=false",
  );
  console.error(
    '  lifeos create_ai_convo_summary title="Weekly reflection" tags=' +
      "'" +
      '["reflection","weekly"]' +
      "'",
  );
  console.error("");
  console.error("Environment variables:");
  console.error("  CONVEX_URL        Convex deployment URL (required)");
  console.error("  LIFEOS_CONVEX_URL Convex deployment URL alias");
  console.error("  LIFEOS_USER_ID    Default user ID (required)");
  console.error("  LIFEOS_API_KEY    API key for authentication (optional)");
  console.error(
    "  SURREAL_ENDPOINT  SurrealDB endpoint for lifeos surreal commands",
  );
  console.error("  SURREAL_USER      SurrealDB username");
  console.error("  SURREAL_PASS      SurrealDB password");
  console.error("  SURREAL_NS        SurrealDB namespace (default: lifeos)");
  console.error("  SURREAL_DB        SurrealDB database (default: graph)");
  process.exit(1);
}

function coerce(value: string): unknown {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?(?:\d+\.\d+|\d+\.\d*|\.\d+)$/.test(trimmed))
    return parseFloat(trimmed);

  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fall through to raw string when the value only looks like JSON.
    }
  }

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    params[key] = coerce(value);
  }
  return params;
}

function requireSurrealConfig(): SurrealConfig {
  const missing: string[] = [];
  if (!SURREAL_ENDPOINT) missing.push("SURREAL_ENDPOINT");
  if (!SURREAL_USER) missing.push("SURREAL_USER");
  if (!SURREAL_PASS) missing.push("SURREAL_PASS");

  if (missing.length > 0) {
    throw new Error(`Missing SurrealDB configuration: ${missing.join(", ")}`);
  }

  return {
    endpoint: SURREAL_ENDPOINT!,
    user: SURREAL_USER!,
    pass: SURREAL_PASS!,
    ns: SURREAL_NS,
    db: SURREAL_DB,
  };
}

function stripSqlCommentsAndStrings(sql: string): string {
  let output = "";
  let index = 0;
  let quote: "'" | '"' | "`" | null = null;

  while (index < sql.length) {
    const current = sql[index]!;
    const next = sql[index + 1];

    if (quote) {
      if (current === "\\" && next !== undefined) {
        output += "  ";
        index += 2;
        continue;
      }
      if (current === quote) quote = null;
      output += " ";
      index += 1;
      continue;
    }

    if (current === "-" && next === "-") {
      while (index < sql.length && sql[index] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      output += "  ";
      index += 2;
      while (
        index < sql.length &&
        !(sql[index] === "*" && sql[index + 1] === "/")
      ) {
        output += " ";
        index += 1;
      }
      if (index < sql.length) {
        output += "  ";
        index += 2;
      }
      continue;
    }

    if (current === "'" || current === '"' || current === "`") {
      quote = current;
      output += " ";
      index += 1;
      continue;
    }

    output += current;
    index += 1;
  }

  return output;
}

function splitSqlStatements(sql: string): string[] {
  return stripSqlCommentsAndStrings(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function assertReadOnlySurrealSql(sql: string): void {
  const statements = splitSqlStatements(sql);
  if (statements.length === 0) throw new Error("SurrealQL query is empty.");
  if (statements.length > 5) {
    throw new Error("SurrealQL query is too broad. Use 5 statements or fewer.");
  }

  for (const statement of statements) {
    const upper = statement.toUpperCase();
    if (
      !upper.startsWith("SELECT ") &&
      !upper.startsWith("INFO ") &&
      !upper.startsWith("EXPLAIN ")
    ) {
      throw new Error(
        "lifeos surreal query only allows SELECT, INFO, and EXPLAIN statements. Use lifeos surreal link for controlled relationship writes.",
      );
    }

    for (const keyword of SURREAL_MUTATING_KEYWORDS) {
      if (new RegExp(`\\b${keyword}\\b`, "i").test(statement)) {
        throw new Error(`Blocked mutating SurrealQL keyword: ${keyword}`);
      }
    }

    const isAggregateCount = /\bCOUNT\s*\(/i.test(statement);
    if (
      upper.startsWith("SELECT ") &&
      !/\bLIMIT\b/i.test(statement) &&
      !isAggregateCount
    ) {
      throw new Error(
        "SELECT queries must include LIMIT unless they are aggregate count queries.",
      );
    }
  }
}

function clampMaxRows(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(200, Math.floor(value)));
}

function capSurrealResults(
  results: SurrealSqlResult[],
  maxRows: number,
): SurrealSqlResult[] {
  return results.map((entry) => {
    if (!Array.isArray(entry.result) || entry.result.length <= maxRows) {
      return entry;
    }
    return {
      ...entry,
      result: entry.result.slice(0, maxRows),
      detail: `${entry.result.length - maxRows} additional rows omitted by maxRows=${maxRows}`,
    };
  });
}

function assertSurrealIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`${label} must be a simple Surreal identifier.`);
  }
  return value;
}

function assertLifeOsNodeTable(value: unknown, label: string): string {
  const table = assertSurrealIdentifier(value, label);
  if (!SURREAL_TABLE_PREFIXES.some((prefix) => table.startsWith(prefix))) {
    throw new Error(
      `${label} must start with one of: ${SURREAL_TABLE_PREFIXES.join(", ")}`,
    );
  }
  if (SURREAL_RELATION_TABLES.includes(table)) {
    throw new Error(`${label} must be an entity table, not a relation table.`);
  }
  return table;
}

function assertRecordId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  if (value.length > 256) throw new Error(`${label} is too long.`);
  return value;
}

function assertRelationKind(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{1,63}$/.test(value)) {
    throw new Error(
      "kind must be lower snake-case, e.g. related_to or discussed_in.",
    );
  }
  return value;
}

function escapeSurrealRecordId(id: string): string {
  return id.replace(/`/g, "\\`");
}

function surrealThing(table: string, id: string): string {
  return `${table}:\`${escapeSurrealRecordId(id)}\``;
}

function agentLinkId(parts: {
  fromTable: string;
  fromId: string;
  toTable: string;
  toId: string;
  kind: string;
}): string {
  return [parts.kind, parts.fromTable, parts.fromId, parts.toTable, parts.toId]
    .join("__")
    .replace(/[^A-Za-z0-9_:-]/g, "_")
    .slice(0, 512);
}

async function runSurrealSql(sql: string): Promise<SurrealSqlResult[]> {
  const cfg = requireSurrealConfig();
  const credentials = Buffer.from(`${cfg.user}:${cfg.pass}`).toString("base64");
  const response = await fetch(`${cfg.endpoint.replace(/\/$/, "")}/sql`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "text/plain",
      Accept: "application/json",
      "Surreal-NS": cfg.ns,
      "Surreal-DB": cfg.db,
    },
    body: sql,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`SurrealDB SQL failed (${response.status}): ${text}`);
  }

  const parsed = JSON.parse(text) as SurrealSqlResult[];
  const failed = parsed.find((entry) => entry.status !== "OK");
  if (failed) {
    throw new Error(`SurrealDB SQL failed: ${JSON.stringify(failed, null, 2)}`);
  }

  return parsed;
}

function surrealGraphSchema() {
  return {
    configured: Boolean(SURREAL_ENDPOINT && SURREAL_USER && SURREAL_PASS),
    endpointConfigured: Boolean(SURREAL_ENDPOINT),
    namespace: SURREAL_NS,
    database: SURREAL_DB,
    nodeTablePrefixes: SURREAL_TABLE_PREFIXES,
    relationTables: SURREAL_RELATION_TABLES,
    agentWritableRelationTable: SURREAL_AGENT_LINK_TABLE,
    rules: [
      "Use lifeos surreal query for read-only SELECT, INFO, and EXPLAIN statements.",
      "SELECT queries must include LIMIT unless they are aggregate count queries.",
      "Use lifeos surreal link for agent-created relationships; it writes only to lifeos_agent_links.",
      "Do not mutate Convex-synced entity tables from SurrealDB. Convex remains canonical.",
    ],
  };
}

async function runSurrealCommand(
  action: string | undefined,
  params: Record<string, unknown>,
): Promise<unknown> {
  if (action === "schema") {
    return surrealGraphSchema();
  }

  if (action === "query") {
    const query = params.query;
    if (typeof query !== "string") throw new Error("query is required.");
    assertReadOnlySurrealSql(query);
    return capSurrealResults(
      await runSurrealSql(query),
      clampMaxRows(params.maxRows),
    );
  }

  if (action === "link") {
    const fromTable = assertLifeOsNodeTable(params.fromTable, "fromTable");
    const fromId = assertRecordId(params.fromId, "fromId");
    const toTable = assertLifeOsNodeTable(params.toTable, "toTable");
    const toId = assertRecordId(params.toId, "toId");
    const kind = assertRelationKind(params.kind);
    const reason = assertRecordId(params.reason, "reason");
    const confidence =
      typeof params.confidence === "number" &&
      Number.isFinite(params.confidence)
        ? Math.max(0, Math.min(1, params.confidence))
        : 0.7;
    const createdBy =
      typeof params.createdBy === "string" && params.createdBy.trim()
        ? params.createdBy.trim()
        : "hermes";
    const metadata =
      params.metadata &&
      typeof params.metadata === "object" &&
      !Array.isArray(params.metadata)
        ? (params.metadata as JsonObject)
        : {};
    const linkId = agentLinkId({ fromTable, fromId, toTable, toId, kind });
    const now = new Date().toISOString();
    const content = {
      kind,
      reason,
      confidence,
      createdBy,
      sourceSystem: "agent",
      sourceUserId: USER_ID,
      userId: USER_ID,
      sourceTable: fromTable,
      targetTable: toTable,
      metadata,
      createdAt: now,
      updatedAt: now,
    };
    const sql = [
      `DEFINE TABLE IF NOT EXISTS ${SURREAL_AGENT_LINK_TABLE} TYPE RELATION SCHEMALESS;`,
      `DEFINE INDEX IF NOT EXISTS ${SURREAL_AGENT_LINK_TABLE}_kind ON TABLE ${SURREAL_AGENT_LINK_TABLE} COLUMNS kind;`,
      `DEFINE INDEX IF NOT EXISTS ${SURREAL_AGENT_LINK_TABLE}_createdBy ON TABLE ${SURREAL_AGENT_LINK_TABLE} COLUMNS createdBy;`,
      `DELETE ${SURREAL_AGENT_LINK_TABLE}:\`${escapeSurrealRecordId(linkId)}\`;`,
      `RELATE ${surrealThing(fromTable, fromId)}->${SURREAL_AGENT_LINK_TABLE}:\`${escapeSurrealRecordId(linkId)}\`->${surrealThing(toTable, toId)} CONTENT ${JSON.stringify(content)};`,
    ].join("\n");
    const results = await runSurrealSql(sql);
    return {
      linked: true,
      relationId: `${SURREAL_AGENT_LINK_TABLE}:${linkId}`,
      from: `${fromTable}:${fromId}`,
      to: `${toTable}:${toId}`,
      kind,
      results,
    };
  }

  if (action === "unlink") {
    const fromTable = assertLifeOsNodeTable(params.fromTable, "fromTable");
    const fromId = assertRecordId(params.fromId, "fromId");
    const toTable = assertLifeOsNodeTable(params.toTable, "toTable");
    const toId = assertRecordId(params.toId, "toId");
    const kind = assertRelationKind(params.kind);
    const linkId = agentLinkId({ fromTable, fromId, toTable, toId, kind });
    const results = await runSurrealSql(
      `DELETE ${SURREAL_AGENT_LINK_TABLE}:\`${escapeSurrealRecordId(linkId)}\`;`,
    );
    return {
      unlinked: true,
      relationId: `${SURREAL_AGENT_LINK_TABLE}:${linkId}`,
      results,
    };
  }

  throw new Error(
    'Unknown surreal action. Use "schema", "query", "link", or "unlink".',
  );
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
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

  const isPpvShortcut = args[0] === "ppv";
  const isGraphShortcut = args[0] === "graph";
  const isSurrealShortcut = args[0] === "surreal";
  const tool = isPpvShortcut
    ? PPV_ACTION_TO_TOOL[args[1] ?? ""]
    : isGraphShortcut
      ? GRAPH_ACTION_TO_TOOL[args[1] ?? ""]
      : args[0];
  const params = parseArgs(
    args.slice(isPpvShortcut || isGraphShortcut || isSurrealShortcut ? 2 : 1),
  );

  if (isPpvShortcut && args[1] === "resolve-friction") {
    params.status ??= "resolved";
    params.isResolved ??= true;
  }

  if (isPpvShortcut && !tool) {
    console.error(
      `Error: unknown PPV action "${args[1] ?? ""}". Use one of: ${Object.keys(PPV_ACTION_TO_TOOL).join(", ")}`,
    );
    process.exit(1);
  }

  if (isGraphShortcut && !tool) {
    console.error(
      `Error: unknown graph action "${args[1] ?? ""}". Use one of: ${Object.keys(GRAPH_ACTION_TO_TOOL).join(", ")}`,
    );
    process.exit(1);
  }

  try {
    const result = isSurrealShortcut
      ? await runSurrealCommand(args[1], params)
      : await callConvexTool(tool, params);
    console.log(JSON.stringify(result, null, 2));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
