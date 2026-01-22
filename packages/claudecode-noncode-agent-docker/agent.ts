#!/usr/bin/env bun

import { $ } from "bun";

const args = process.argv.slice(2);
const command = args[0];

function usage() {
  console.log(`
Usage:
  bun agent.ts run <name> <prompt> [--mcp <path>]    Run prompt in new/existing container
  bun agent.ts start <name> [--mcp <path>]          Start a container
  bun agent.ts stop <name>                          Stop a container
  bun agent.ts rm <name>                            Remove a container
  bun agent.ts list                                 List all claude-agent containers
  bun agent.ts login <name>                         Login to Claude in container
  bun agent.ts sessions <name>                      List sessions in a container

Examples:
  bun agent.ts run prod "List my projects" --mcp ./configs/prod.mcp.json
  bun agent.ts run staging "Get my tasks" --mcp ./configs/staging.mcp.json
  bun agent.ts start dev --mcp ./.mcp.json
  bun agent.ts list
  bun agent.ts sessions dev

Session persistence:
  Sessions are stored in Docker volumes (claude-sessions-{name}) and persist across
  container restarts. Use --resume <session-id> to continue a previous conversation.
`);
  process.exit(1);
}

function getMcpPath(args: string[]): string {
  const mcpIndex = args.indexOf("--mcp");
  if (mcpIndex !== -1 && args[mcpIndex + 1]) {
    return args[mcpIndex + 1];
  }
  return "./.mcp.json";
}

async function containerExists(name: string): Promise<boolean> {
  const result = await $`docker ps -a --format "{{.Names}}"`.quiet().nothrow();
  const containers = result.stdout.toString().trim().split("\n");
  return containers.includes(name);
}

async function containerRunning(name: string): Promise<boolean> {
  const result = await $`docker ps --format "{{.Names}}"`.quiet().nothrow();
  const containers = result.stdout.toString().trim().split("\n");
  return containers.includes(name);
}

async function startContainer(name: string, mcpPath: string) {
  const containerName = `claude-agent-${name}`;
  const absoluteMcpPath = Bun.resolveSync(mcpPath, process.cwd());
  // Per-environment session volume for conversation persistence
  const sessionsVolume = `claude-sessions-${name}`;

  if (await containerRunning(containerName)) {
    console.log(`Container ${containerName} already running`);
    return;
  }

  if (await containerExists(containerName)) {
    console.log(`Starting existing container ${containerName}...`);
    await $`docker start ${containerName}`;
    return;
  }

  console.log(`Creating container ${containerName} with MCP: ${mcpPath}`);
  console.log(`Session volume: ${sessionsVolume} (for conversation persistence)`);

  // Create container with:
  // - claude-credentials: shared Claude authentication
  // - claude-config: shared Claude config
  // - claude-sessions-{name}: per-environment session storage for conversation threads
  // - MCP config file
  await $`docker run -d --name ${containerName} -v claude-credentials:/home/node/.claude -v claude-config:/home/node/.config -v ${sessionsVolume}:/home/node/.claude/projects -v ${absoluteMcpPath}:/home/node/.mcp.json:ro claude-agent`;
}

async function runPrompt(name: string, prompt: string, mcpPath: string) {
  const containerName = `claude-agent-${name}`;

  await startContainer(name, mcpPath);

  // Small delay to ensure container is ready
  await Bun.sleep(500);

  const result = await $`docker exec ${containerName} claude --dangerously-skip-permissions --print -p ${prompt}`.quiet();
  console.log(result.stdout.toString());
}

async function main() {
  if (!command) usage();

  switch (command) {
    case "run": {
      const name = args[1];
      const prompt = args[2];
      if (!name || !prompt) usage();
      const mcpPath = getMcpPath(args);
      await runPrompt(name, prompt, mcpPath);
      break;
    }

    case "start": {
      const name = args[1];
      if (!name) usage();
      const mcpPath = getMcpPath(args);
      await startContainer(name, mcpPath);
      break;
    }

    case "stop": {
      const name = args[1];
      if (!name) usage();
      await $`docker stop claude-agent-${name}`;
      break;
    }

    case "rm": {
      const name = args[1];
      if (!name) usage();
      await $`docker rm -f claude-agent-${name}`;
      break;
    }

    case "list": {
      await $`docker ps -a --filter "name=claude-agent" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"`;
      break;
    }

    case "login": {
      const name = args[1];
      if (!name) usage();
      await $`docker exec -it claude-agent-${name} claude login`;
      break;
    }

    case "sessions": {
      const name = args[1];
      if (!name) usage();
      const containerName = `claude-agent-${name}`;
      console.log(`Sessions in ${containerName}:`);
      await $`docker exec ${containerName} sh -c "find /home/node/.claude/projects -name '*.jsonl' -type f 2>/dev/null | while read f; do echo \"$(basename $f .jsonl) - $(stat -c '%Y' $f | xargs -I {} date -d @{} '+%Y-%m-%d %H:%M:%S' 2>/dev/null || stat -f '%Sm' -t '%Y-%m-%d %H:%M:%S' $f 2>/dev/null)\"; done"`;
      break;
    }

    default:
      usage();
  }
}

main().catch(console.error);
