FROM node:20-alpine

# Create non-root user for security
RUN adduser -D -u 1000 moltbot

# Install moltbot globally
RUN npm install -g moltbot@latest

# Create workspace directory
RUN mkdir -p /workspace && chown moltbot:moltbot /workspace

USER moltbot
WORKDIR /workspace

# Default command - can be overridden
CMD ["moltbot"]
