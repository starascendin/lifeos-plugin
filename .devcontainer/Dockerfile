FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    jq \
    ripgrep \
    fzf \
    && rm -rf /var/lib/apt/lists/*

# Create the claude-shared directory with correct ownership
RUN mkdir -p /home/vscode/.claude-shared/auth \
    && chown -R vscode:vscode /home/vscode/.claude-shared

# Create .claude directory
RUN mkdir -p /home/vscode/.claude \
    && chown -R vscode:vscode /home/vscode/.claude

# Set up PATH for user-installed binaries
ENV PATH="/home/vscode/.local/bin:$PATH"

USER vscode
WORKDIR /workspace
