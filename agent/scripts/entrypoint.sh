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

# Clone repositories if specified
if [ -n "${REPOS:-}" ]; then
    echo "Cloning repositories..."
    /home/node/clone-repos.sh
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

# Add the task prompt
if [ -n "${TASK_PROMPT:-}" ]; then
    CLAUDE_CMD="$CLAUDE_CMD --print \"$TASK_PROMPT\""
else
    echo "ERROR: TASK_PROMPT is required"
    exit 1
fi

echo "Executing: $CLAUDE_CMD"
echo "==="

# Execute Claude
eval $CLAUDE_CMD

echo "=== Claude Agent Completed ==="
