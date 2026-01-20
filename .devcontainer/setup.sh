#!/bin/bash
set -euo pipefail

echo "=== Setting up devcontainer ==="

# Ensure directories exist with correct ownership
mkdir -p "$HOME/.claude"
mkdir -p "$HOME/.claude-shared/auth"
mkdir -p "$HOME/.local/bin"

# Fix ownership of shared volume (in case it was created by root)
sudo chown -R vscode:vscode /home/vscode/.claude-shared 2>/dev/null || true

# Install Claude Code CLI
echo "Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code

# Get the actual claude binary path
CLAUDE_BIN=$(which claude)
echo "Claude CLI installed at: $CLAUDE_BIN"

# Create a wrapper script to handle empty env vars
cat > "$HOME/.local/bin/claude-wrapper" << 'WRAPPER_EOF'
#!/bin/bash
set -euo pipefail

# Fix HOME if unset
if [ -z "${HOME:-}" ] || [ ! -d "${HOME:-}" ]; then
  export HOME="/home/vscode"
fi

# Unset empty tokens so file-based auth takes precedence
if [[ -v CLAUDE_CODE_OAUTH_TOKEN && -z "${CLAUDE_CODE_OAUTH_TOKEN}" ]]; then
  unset CLAUDE_CODE_OAUTH_TOKEN
fi
if [[ -v CLAUDE_API_KEY && -z "${CLAUDE_API_KEY}" ]]; then
  unset CLAUDE_API_KEY
fi

exec claude-real "$@"
WRAPPER_EOF

chmod +x "$HOME/.local/bin/claude-wrapper"

# Rename the actual claude and symlink wrapper (only if not already done)
if [ ! -f "$HOME/.local/bin/claude-real" ]; then
  # Create a symlink to the real claude
  ln -sf "$CLAUDE_BIN" "$HOME/.local/bin/claude-real"
fi

# Create save-claude-auth script
cat > "$HOME/save-claude-auth.sh" << 'SAVE_EOF'
#!/bin/bash
set -euo pipefail

echo "Saving Claude credentials to shared volume..."

sudo chown -R vscode:vscode /home/vscode/.claude-shared 2>/dev/null || true
mkdir -p /home/vscode/.claude-shared/auth

# Save OAuth credentials
if [ -f "$HOME/.claude/.credentials.json" ]; then
  cp -p "$HOME/.claude/.credentials.json" /home/vscode/.claude-shared/auth/credentials.json
  echo "✓ Saved: ~/.claude/.credentials.json"
else
  echo "✗ Missing: ~/.claude/.credentials.json (run 'claude login' first)"
fi

# Save user config (MCP servers, settings)
if [ -f "$HOME/.claude.json" ]; then
  cp -p "$HOME/.claude.json" /home/vscode/.claude-shared/auth/claude.json
  echo "✓ Saved: ~/.claude.json"
else
  echo "- Skipped: ~/.claude.json (not found, ok if you only use OAuth)"
fi

# Save settings.json if it exists
if [ -f "$HOME/.claude/settings.json" ]; then
  cp -p "$HOME/.claude/settings.json" /home/vscode/.claude-shared/auth/settings.json
  echo "✓ Saved: ~/.claude/settings.json"
fi

echo ""
echo "Claude auth saved to: /home/vscode/.claude-shared/auth/"
ls -la /home/vscode/.claude-shared/auth/
SAVE_EOF

chmod +x "$HOME/save-claude-auth.sh"

# Restore any existing credentials
bash /workspace/.devcontainer/restore-claude-auth.sh

# Install project dependencies
echo "Installing project dependencies..."
cd /workspace
pnpm install || echo "pnpm install skipped (may need env setup)"

echo ""
echo "=== Setup complete ==="
echo ""
echo "First-time setup:"
echo "  1. Run: claude login"
echo "  2. Complete OAuth in browser"
echo "  3. Run: ~/save-claude-auth.sh"
echo ""
echo "Credentials will persist across container rebuilds."
echo ""
