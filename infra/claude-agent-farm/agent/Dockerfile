# Claude Code Agent Container - Slim version
# Uses node:slim for smaller image size

FROM node:20-slim

LABEL org.opencontainers.image.source="https://github.com/starascendin/claude-agent-farm"
LABEL org.opencontainers.image.description="Claude Code CLI Agent for autonomous coding tasks"

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install minimal dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    ca-certificates \
    jq \
    openssh-client \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Use existing node user (UID 1000) which is already non-root
USER node
WORKDIR /home/node

# Install Claude CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add Claude to PATH
ENV PATH="/home/node/.local/bin:${PATH}"

# Install OpenCode CLI
RUN curl -fsSL https://opencode.ai/install | bash

# Add OpenCode to PATH
ENV PATH="/home/node/.opencode/bin:${PATH}"

# Create workspace and config directories
RUN mkdir -p /home/node/workspace /home/node/.claude \
    /home/node/.local/share/opencode \
    /home/node/.config/opencode

# Copy scripts
COPY --chown=node:node scripts/entrypoint.sh /home/node/entrypoint.sh
COPY --chown=node:node scripts/clone-repos.sh /home/node/clone-repos.sh

RUN chmod +x /home/node/entrypoint.sh /home/node/clone-repos.sh

# Bundle LifeOS skills (Claude Code slash commands)
COPY --chown=node:node skills/ /opt/lifeos-skills/

# Environment variables (overridden at runtime)
ENV TASK_PROMPT=""
ENV SYSTEM_PROMPT=""
ENV REPOS=""
ENV MAX_TURNS="50"
ENV MAX_BUDGET_USD="10"
ENV ALLOWED_TOOLS="Read,Write,Edit,Bash,Glob,Grep"

WORKDIR /home/node/workspace

ENTRYPOINT ["/home/node/entrypoint.sh"]
