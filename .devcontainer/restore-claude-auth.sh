#!/bin/bash
set -euo pipefail

echo "Restoring credentials from shared volume..."

# Fix ownership of shared volume
sudo chown -R vscode:vscode /home/vscode/.claude-shared 2>/dev/null || true

# Create directories
mkdir -p "$HOME/.claude"
mkdir -p "$HOME/.ssh"
mkdir -p "$HOME/.config/gh"

# === Claude credentials ===
echo ""
echo "=== Claude ==="
CLAUDE_RESTORED=0

if [ -f /home/vscode/.claude-shared/auth/credentials.json ]; then
  cp -p /home/vscode/.claude-shared/auth/credentials.json "$HOME/.claude/.credentials.json"
  echo "✓ Restored: ~/.claude/.credentials.json"
  CLAUDE_RESTORED=1
elif [ -f /home/vscode/.claude-shared/.claude/.credentials.json ]; then
  cp -p /home/vscode/.claude-shared/.claude/.credentials.json "$HOME/.claude/.credentials.json"
  echo "✓ Restored (legacy): ~/.claude/.credentials.json"
  CLAUDE_RESTORED=1
fi

if [ -f /home/vscode/.claude-shared/auth/claude.json ]; then
  cp -p /home/vscode/.claude-shared/auth/claude.json "$HOME/.claude.json"
  echo "✓ Restored: ~/.claude.json"
  CLAUDE_RESTORED=1
fi

if [ -f /home/vscode/.claude-shared/auth/settings.json ]; then
  cp -p /home/vscode/.claude-shared/auth/settings.json "$HOME/.claude/settings.json"
  echo "✓ Restored: ~/.claude/settings.json"
  CLAUDE_RESTORED=1
fi

if [ $CLAUDE_RESTORED -eq 0 ]; then
  echo "✗ No Claude credentials found. Run 'claude login' then '~/save-auth.sh'"
fi

# === SSH keys ===
echo ""
echo "=== SSH ==="
SSH_RESTORED=0

if [ -d /home/vscode/.claude-shared/ssh ] && [ "$(ls -A /home/vscode/.claude-shared/ssh 2>/dev/null)" ]; then
  cp -rp /home/vscode/.claude-shared/ssh/* "$HOME/.ssh/" 2>/dev/null || true
  # Fix SSH key permissions (required for SSH to work)
  chmod 700 "$HOME/.ssh"
  chmod 600 "$HOME/.ssh/"* 2>/dev/null || true
  chmod 644 "$HOME/.ssh/"*.pub 2>/dev/null || true
  chmod 644 "$HOME/.ssh/known_hosts" 2>/dev/null || true
  chmod 644 "$HOME/.ssh/config" 2>/dev/null || true
  echo "✓ Restored: ~/.ssh/* (keys and config)"
  SSH_RESTORED=1
fi

if [ $SSH_RESTORED -eq 0 ]; then
  echo "✗ No SSH keys found. Set up SSH then run '~/save-auth.sh'"
fi

# === GitHub CLI auth ===
echo ""
echo "=== GitHub CLI ==="
GH_RESTORED=0

if [ -d /home/vscode/.claude-shared/gh ] && [ "$(ls -A /home/vscode/.claude-shared/gh 2>/dev/null)" ]; then
  cp -rp /home/vscode/.claude-shared/gh/* "$HOME/.config/gh/" 2>/dev/null || true
  echo "✓ Restored: ~/.config/gh/* (gh auth)"
  GH_RESTORED=1
fi

if [ $GH_RESTORED -eq 0 ]; then
  echo "✗ No gh auth found. Run 'gh auth login' then '~/save-auth.sh'"
fi

# === Git config ===
echo ""
echo "=== Git config ==="
if [ -f /home/vscode/.claude-shared/auth/gitconfig ]; then
  cp -p /home/vscode/.claude-shared/auth/gitconfig "$HOME/.gitconfig"
  echo "✓ Restored: ~/.gitconfig"
else
  echo "- No git config saved (will use defaults)"
fi

echo ""
echo "Restore complete. Run '~/save-auth.sh' after setting up new credentials."
