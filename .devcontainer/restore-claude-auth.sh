#!/bin/bash
set -euo pipefail

echo "Restoring Claude credentials from shared volume..."

# Fix ownership of shared volume
sudo chown -R vscode:vscode /home/vscode/.claude-shared 2>/dev/null || true

# Create directories
mkdir -p "$HOME/.claude"

RESTORED=0

# Restore OAuth credentials
if [ -f /home/vscode/.claude-shared/auth/credentials.json ]; then
  cp -p /home/vscode/.claude-shared/auth/credentials.json "$HOME/.claude/.credentials.json"
  echo "✓ Restored: ~/.claude/.credentials.json"
  RESTORED=1
elif [ -f /home/vscode/.claude-shared/.claude/.credentials.json ]; then
  # Backward compatible with old format
  cp -p /home/vscode/.claude-shared/.claude/.credentials.json "$HOME/.claude/.credentials.json"
  echo "✓ Restored (legacy): ~/.claude/.credentials.json"
  RESTORED=1
fi

# Restore user config
if [ -f /home/vscode/.claude-shared/auth/claude.json ]; then
  cp -p /home/vscode/.claude-shared/auth/claude.json "$HOME/.claude.json"
  echo "✓ Restored: ~/.claude.json"
  RESTORED=1
elif [ -f /home/vscode/.claude-shared/.claude.json ]; then
  # Backward compatible
  cp -p /home/vscode/.claude-shared/.claude.json "$HOME/.claude.json"
  echo "✓ Restored (legacy): ~/.claude.json"
  RESTORED=1
fi

# Restore settings.json
if [ -f /home/vscode/.claude-shared/auth/settings.json ]; then
  cp -p /home/vscode/.claude-shared/auth/settings.json "$HOME/.claude/settings.json"
  echo "✓ Restored: ~/.claude/settings.json"
  RESTORED=1
fi

if [ $RESTORED -eq 0 ]; then
  echo ""
  echo "No saved Claude credentials found."
  echo "Run 'claude login' then '~/save-claude-auth.sh' to persist."
else
  echo ""
  echo "Claude credentials restored. Ready to use 'claude' command."
fi
