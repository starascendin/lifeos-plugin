#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const DEFAULT_CONVEX_URL = process.env.LIFEOS_CONVEX_URL || process.env.CONVEX_URL;
const DEFAULT_API_KEY = process.env.LIFEOS_API_KEY;
const DEFAULT_USER_ID = process.env.LIFEOS_USER_ID;

function parseArgs(argv) {
  const args = {
    tier: "normal",
    dryRun: false,
    save: true,
    dir: process.cwd(),
    provider: "vercel",
    members: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--prompt") args.prompt = argv[++i];
    else if (arg === "--prompt-file") args.promptFile = argv[++i];
    else if (arg === "--title") args.title = argv[++i];
    else if (arg === "--tier") args.tier = argv[++i];
    else if (arg === "--config") args.config = argv[++i];
    else if (arg === "--provider") args.provider = argv[++i];
    else if (arg === "--member" || arg === "--model") args.members.push(argv[++i]);
    else if (arg === "--models") {
      args.members.push(...argv[++i].split(",").map((value) => value.trim()).filter(Boolean));
    }
    else if (arg === "--council-size") args.councilSize = Number(argv[++i]);
    else if (arg === "--chairman") args.chairman = argv[++i];
    else if (arg === "--convex-url") args.convexUrl = argv[++i];
    else if (arg === "--api-key") args.apiKey = argv[++i];
    else if (arg === "--user-id") args.userId = argv[++i];
    else if (arg === "--dir") args.dir = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--no-save") args.save = false;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`Run a generic local OpenCode LLM council and save stage artifacts to LifeOS.

Usage:
  node packages/lifeos-plugin/scripts/run-llm-council.mjs --prompt "question"
  node packages/lifeos-plugin/scripts/run-llm-council.mjs --prompt-file ./prompt.md --title "Decision"

Options:
  --tier normal|pro          Council tier. Only normal is configured by default.
  --config <path>            Override model config JSON.
  --provider <name>          Default provider prefix for shorthand members. Defaults to vercel.
  --member <spec>            Add a council member. Repeatable. Format: modelId[|displayName][|provider][|variant].
  --model <spec>             Alias for --member.
  --models <csv>             Comma-separated member specs.
  --council-size <n>         Use only the first n configured members.
  --chairman <spec>          Override chairman. Format: modelId[|displayName][|provider][|variant].
  --dir <path>               Working directory for opencode run. Defaults to cwd.
  --dry-run                  Print run plan without calling OpenCode or Convex.
  --no-save                  Run council locally without saving to Convex.
  --convex-url <url>         Overrides LIFEOS_CONVEX_URL or CONVEX_URL.
  --api-key <key>            Overrides LIFEOS_API_KEY.
  --user-id <id>             Overrides LIFEOS_USER_ID.
`);
}

async function loadPrompt(args) {
  if (args.prompt) return args.prompt.trim();
  if (args.promptFile) return (await readFile(resolve(args.promptFile), "utf8")).trim();
  throw new Error("Missing --prompt or --prompt-file");
}

async function loadConfig(args) {
  const configPath =
    args.config ?? resolve(PLUGIN_ROOT, "config", `llm-council.${args.tier}.json`);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const configWithSource = { ...config, sourceConfigPath: configPath };
  return normalizeConfig(configWithSource, args);
}

function titleCaseModelName(modelId) {
  const leaf = modelId.split("/").pop() || modelId;
  return leaf
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bGpt\b/g, "GPT")
    .replace(/\bQwen\b/g, "Qwen")
    .replace(/\bKimi\b/g, "Kimi");
}

function normalizeMemberSpec(spec, defaultProvider) {
  const [rawModelId, rawName, rawProvider, rawVariant] = spec
    .split("|")
    .map((part) => part.trim());
  if (!rawModelId) {
    throw new Error(`Invalid empty council member spec: ${spec}`);
  }

  const provider = rawProvider || defaultProvider;
  const modelId = rawModelId.startsWith(`${provider}/`) ? rawModelId : `${provider}/${rawModelId}`;

  return {
    id: modelId,
    name: rawName || titleCaseModelName(modelId),
    provider,
    variant: rawVariant || undefined,
  };
}

function normalizeConfig(config, args) {
  const participants =
    args.members.length > 0
      ? args.members.map((member) => normalizeMemberSpec(member, args.provider))
      : config.participants;

  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error("No council participants configured.");
  }

  if (
    args.councilSize !== undefined &&
    (!Number.isInteger(args.councilSize) || args.councilSize < 1)
  ) {
    throw new Error("--council-size must be a positive integer.");
  }

  const selectedParticipants = participants.slice(0, args.councilSize ?? participants.length);
  const chairman = args.chairman
    ? normalizeMemberSpec(args.chairman, args.provider)
    : config.chairman ?? selectedParticipants[0];

  return {
    ...config,
    tier: config.tier ?? args.tier,
    provider: args.provider,
    participants: selectedParticipants,
    chairman,
    requestedCouncilSize: args.councilSize ?? selectedParticipants.length,
    configuredMemberCount: participants.length,
    memberSource: args.members.length > 0 ? "cli" : "config",
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const latencyMs = Date.now() - startedAt;
      if (code === 0) {
        resolvePromise({ stdout: stdout.trim(), stderr: stderr.trim(), latencyMs });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with exit ${code}${stderr ? `\n${stderr}` : ""}`,
        ),
      );
    });
  });
}

async function getOpencodeVersion() {
  try {
    const result = await runCommand("opencode", ["--version"]);
    return result.stdout || undefined;
  } catch {
    return undefined;
  }
}

async function callConvexArtifacts(args, action, payload) {
  const convexUrl = args.convexUrl || DEFAULT_CONVEX_URL;
  const apiKey = args.apiKey || DEFAULT_API_KEY;
  const userId = args.userId || DEFAULT_USER_ID;

  if (!convexUrl || !apiKey || !userId) {
    throw new Error(
      "Saving requires LIFEOS_CONVEX_URL or CONVEX_URL, LIFEOS_API_KEY, and LIFEOS_USER_ID.",
    );
  }

  const response = await fetch(`${convexUrl}/llmcouncil/artifacts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      action,
      userId,
      ...payload,
    }),
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Convex returned non-JSON response (${response.status}): ${text}`);
  }
  if (!response.ok || json.error) {
    throw new Error(`Convex artifact API error (${response.status}): ${json.error || text}`);
  }
  return json;
}

function opencodeArgsFor(model, prompt, dir) {
  const args = ["run", "--model", model.id, "--dir", dir];
  if (model.variant) args.push("--variant", model.variant);
  args.push(prompt);
  return args;
}

async function askModel(model, prompt, dir) {
  const result = await runCommand("opencode", opencodeArgsFor(model, prompt, dir), { cwd: dir });
  return {
    content: result.stdout,
    latencyMs: result.latencyMs,
    rawJson: result.stderr ? { stderr: result.stderr } : undefined,
  };
}

function stage1Prompt(question, modelName) {
  return `You are one member of an LLM council answering a generic question.

Original question:
${question}

Answer independently as ${modelName}. Do not inspect or modify local files. Do not run tools. Focus on truth, nuance, useful tradeoffs, and concrete reasoning.`;
}

function responseLabels(responses) {
  return responses.map((response, index) => ({
    label: String.fromCharCode(65 + index),
    response,
  }));
}

function stage2Prompt(question, labeledResponses) {
  const renderedResponses = labeledResponses
    .map(({ label, response }) => `Response ${label}:\n${response.content}`)
    .join("\n\n---\n\n");

  return `You are reviewing anonymous LLM council answers to a generic question.

Original question:
${question}

${renderedResponses}

Evaluate the answers for correctness, nuance, usefulness, and blind spots.
Start with a single line in exactly this format:
RANKING: A > B > C

Then explain the strongest answer, the key disagreements, and what each response missed.`;
}

function parseRanking(content, labeledResponses) {
  const match = content.match(/RANKING:\s*([A-Z](?:\s*>\s*[A-Z])*)/i);
  if (!match) return undefined;
  const labelToModel = new Map(
    labeledResponses.map(({ label, response }) => [label.toUpperCase(), response.model.id]),
  );
  return match[1]
    .split(">")
    .map((value) => value.trim().toUpperCase())
    .map((label) => labelToModel.get(label))
    .filter(Boolean);
}

function stage3Prompt(question, stage1Responses, stage2Reviews) {
  const answers = stage1Responses
    .map((response) => `## ${response.model.name}\n${response.content}`)
    .join("\n\n---\n\n");
  const reviews = stage2Reviews
    .map((review) => `## ${review.model.name}\n${review.content}`)
    .join("\n\n---\n\n");

  return `You are the chairman of a generic LLM council.

Original question:
${question}

Stage 1 independent answers:
${answers}

Stage 2 peer reviews:
${reviews}

Synthesize the best final answer. Preserve useful disagreement. Call out uncertainty where the council did not converge.`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const prompt = await loadPrompt(args);
  const config = await loadConfig(args);
  const opencodeVersion = await getOpencodeVersion();
  const modelRoster = config.participants.map((model) => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    role: "participant",
  }));
  const chairman = config.chairman ?? config.participants[0];
  const chairmanModel = {
    id: chairman.id,
    name: chairman.name,
    provider: chairman.provider,
    role: "chairman",
  };

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          prompt,
          tier: config.tier ?? args.tier,
          modelRoster,
          chairmanModel,
          requestedCouncilSize: config.requestedCouncilSize,
          configuredMemberCount: config.configuredMemberCount,
          memberSource: config.memberSource,
          defaultProvider: config.provider,
          opencodeVersion,
          save: args.save,
        },
        null,
        2,
      ),
    );
    return;
  }

  let runId;
  if (args.save) {
    const created = await callConvexArtifacts(args, "createRun", {
      title: args.title,
      prompt,
      tier: config.tier ?? args.tier,
      source: "lifeos-plugin-opencode",
      skillVersion: "0.1.0",
      opencodeVersion,
      modelRoster,
      chairmanModel,
      metadata: {
        protocol: "karpathy-llm-council-inspired",
        generic: true,
        requestedCouncilSize: config.requestedCouncilSize,
        configuredMemberCount: config.configuredMemberCount,
        memberSource: config.memberSource,
        defaultProvider: config.provider,
        sourceConfigPath: config.sourceConfigPath,
      },
    });
    runId = created.runId;

    await callConvexArtifacts(args, "appendArtifact", {
      runId,
      stage: "input",
      role: "system",
      content: prompt,
      rawJson: { config },
    });
  }

  try {
    const stage1Responses = await Promise.all(
      config.participants.map(async (model) => {
        try {
          const result = await askModel(model, stage1Prompt(prompt, model.name), args.dir);
          const response = { model, ...result };
          if (runId) {
            const saved = await callConvexArtifacts(args, "appendArtifact", {
              runId,
              stage: "stage1_response",
              modelId: model.id,
              modelName: model.name,
              provider: model.provider,
              role: "participant",
              content: response.content,
              latencyMs: response.latencyMs,
              rawJson: response.rawJson,
            });
            response.artifactId = saved.artifactId;
          }
          return response;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (runId) {
            await callConvexArtifacts(args, "appendArtifact", {
              runId,
              stage: "error",
              modelId: model.id,
              modelName: model.name,
              provider: model.provider,
              role: "participant",
              content: message,
              error: message,
            });
          }
          return { model, content: "", error: message };
        }
      }),
    );

    const usableStage1 = stage1Responses.filter((response) => response.content);
    if (usableStage1.length === 0) {
      throw new Error("All stage 1 council members failed.");
    }

    const labeledResponses = responseLabels(usableStage1);
    const stage2Reviews = await Promise.all(
      config.participants.map(async (model) => {
        try {
          const result = await askModel(model, stage2Prompt(prompt, labeledResponses), args.dir);
          const ranking = parseRanking(result.content, labeledResponses);
          const review = { model, ranking, ...result };
          if (runId) {
            const saved = await callConvexArtifacts(args, "appendArtifact", {
              runId,
              stage: "stage2_review",
              modelId: model.id,
              modelName: model.name,
              provider: model.provider,
              role: "reviewer",
              content: review.content,
              ranking,
              latencyMs: review.latencyMs,
              rawJson: review.rawJson,
            });
            review.artifactId = saved.artifactId;
          }
          return review;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (runId) {
            await callConvexArtifacts(args, "appendArtifact", {
              runId,
              stage: "error",
              modelId: model.id,
              modelName: model.name,
              provider: model.provider,
              role: "reviewer",
              content: message,
              error: message,
            });
          }
          return { model, content: "", error: message };
        }
      }),
    );

    const usableStage2 = stage2Reviews.filter((review) => review.content);
    const synthesis = await askModel(
      chairman,
      stage3Prompt(prompt, usableStage1, usableStage2),
      args.dir,
    );

    if (runId) {
      await callConvexArtifacts(args, "appendArtifact", {
        runId,
        stage: "stage3_synthesis",
        modelId: chairman.id,
        modelName: chairman.name,
        provider: chairman.provider,
        role: "chairman",
        content: synthesis.content,
        latencyMs: synthesis.latencyMs,
        rawJson: synthesis.rawJson,
      });
      await callConvexArtifacts(args, "completeRun", { runId, status: "completed" });
    }

    console.log(
      JSON.stringify(
        {
          success: true,
          runId,
          tier: config.tier ?? args.tier,
          answer: synthesis.content,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) {
      await callConvexArtifacts(args, "completeRun", {
        runId,
        status: "failed",
        error: message,
      });
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
