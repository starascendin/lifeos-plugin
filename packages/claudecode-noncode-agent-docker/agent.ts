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

Examples:
  bun agent.ts run prod "List my projects" --mcp ./configs/prod.mcp.json
  bun agent.ts run staging "Get my tasks" --mcp ./configs/staging.mcp.json
  bun agent.ts start dev --mcp ./.mcp.json
  bun agent.ts list
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
  await $`docker run -d --name ${containerName} -v claude-credentials:/home/node/.claude -v claude-config:/home/node/.config -v ${absoluteMcpPath}:/home/node/.mcp.json:ro claude-agent`;
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

    default:
      usage();
  }
}

main().catch(console.error);
