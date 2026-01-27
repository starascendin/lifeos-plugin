FROM node:24-alpine AS builder

# Install pnpm and build dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache git python3 make g++ bash

WORKDIR /build

# Clone the repo
RUN git clone --depth 1 https://github.com/clawdbot/clawdbot.git .

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Runtime stage - use same base to avoid native module issues
FROM node:24-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user directories (node user is UID 1000)
RUN mkdir -p /home/node/.clawdbot /home/node/clawd \
    && chown -R node:node /home/node

WORKDIR /app

# Copy the entire built project (including node_modules for native deps)
COPY --from=builder /build /app

# Create symlink for the binary
RUN ln -s /app/dist/entry.js /usr/local/bin/moltbot \
    && chmod +x /app/dist/entry.js

USER node
WORKDIR /home/node

# Default command - gateway mode for persistent deployment
CMD ["moltbot", "gateway", "--port", "18789", "--verbose"]
