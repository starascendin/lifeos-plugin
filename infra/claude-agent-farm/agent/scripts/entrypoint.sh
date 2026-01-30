#!/bin/bash
set -euo pipefail

echo "=== Claude Agent Starting ==="
echo "Task: ${TASK_PROMPT:-'No task specified'}"
echo "Repos: ${REPOS:-'None'}"
echo "Max Turns: ${MAX_TURNS:-50}"
echo "==="

# Link shared Claude credentials if available
if [ -d "/credentials/.claude" ]; then
    echo "Linking shared Claude credentials..."
    rm -rf ~/.claude
    ln -sf /credentials/.claude ~/.claude
fi

# Link shared OpenCode credentials if available
if [ -d "/credentials/.local/share/opencode" ]; then
    echo "Linking shared OpenCode credentials..."
    rm -rf ~/.local/share/opencode
    mkdir -p ~/.local/share
    ln -sf /credentials/.local/share/opencode ~/.local/share/opencode
fi

# Link shared OpenCode config if available
if [ -d "/credentials/.config/opencode" ]; then
    echo "Linking shared OpenCode config..."
    rm -rf ~/.config/opencode
    mkdir -p ~/.config
    ln -sf /credentials/.config/opencode ~/.config/opencode
fi

# Install LifeOS CLI if CONVEX_URL is set (needed for lifeos skills)
if [ -n "${CONVEX_URL:-}" ]; then
    echo "Installing LifeOS CLI..."
    npm install -g @starascendin/lifeos-cli || echo "Warning: LifeOS CLI install failed"
fi

# Clone repositories if specified
if [ -n "${REPOS:-}" ]; then
    echo "Cloning repositories..."
    /home/node/clone-repos.sh
fi

# Install skills if specified
if [ -n "${SKILL_INSTALL_COMMANDS:-}" ]; then
    echo "Installing Claude skills..."
    # Each command is on a separate line
    while IFS= read -r cmd; do
        if [ -n "$cmd" ]; then
            echo "Running: $cmd"
            eval "$cmd" || echo "Warning: skill installation failed: $cmd"
        fi
    done <<< "$SKILL_INSTALL_COMMANDS"
    echo "Skills installation complete."
fi

# Build claude command
CLAUDE_CMD="claude"

# Add system prompt if provided
if [ -n "${SYSTEM_PROMPT:-}" ]; then
    CLAUDE_CMD="$CLAUDE_CMD --system-prompt \"$SYSTEM_PROMPT\""
fi

# Add max turns
if [ -n "${MAX_TURNS:-}" ]; then
    CLAUDE_CMD="$CLAUDE_CMD --max-turns $MAX_TURNS"
fi

# Add dangerously skip permissions for autonomous operation
CLAUDE_CMD="$CLAUDE_CMD --dangerously-skip-permissions"

# Add allowed tools if specified
if [ -n "${ALLOWED_TOOLS:-}" ]; then
    # Convert comma-separated to repeated --allowedTools flags
    IFS=',' read -ra TOOLS <<< "$ALLOWED_TOOLS"
    for tool in "${TOOLS[@]}"; do
        CLAUDE_CMD="$CLAUDE_CMD --allowedTools $tool"
    done
fi

# Add the task prompt if provided
if [ -n "${TASK_PROMPT:-}" ] && [ "${TASK_PROMPT}" != "null" ]; then
    CLAUDE_CMD="$CLAUDE_CMD --print \"$TASK_PROMPT\""
    echo "Executing: $CLAUDE_CMD"
    echo "==="
    # Execute Claude with task
    eval $CLAUDE_CMD
    echo "=== Claude Agent Completed ==="
else
    echo "No task specified - running in chat mode (sleep infinity)"
    echo "Use kubectl exec or Chat tab to interact with this agent"
    echo "==="
    # Keep pod alive for interactive chat via kubectl exec
    exec sleep infinity
fi
