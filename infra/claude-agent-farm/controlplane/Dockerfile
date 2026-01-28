# Frontend build stage
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 1. Copy package files
COPY frontend/package.json frontend/package-lock.json* ./

# 2. Install deps - cached unless package files change
RUN npm ci --no-audit --no-fund

# 3. Copy config files that change less often
COPY frontend/svelte.config.js frontend/vite.config.ts frontend/tsconfig.json ./
COPY frontend/postcss.config.js frontend/tailwind.config.js frontend/components.json ./

# 4. Copy source last - changes most often
COPY frontend/src ./src
COPY frontend/static ./static

RUN npm run build

# Go build stage
FROM golang:1.22-alpine AS builder

# Build args for version injection
ARG VERSION=dev
ARG BUILD_TIME=unknown

WORKDIR /app

# 1. Copy go mod files - changes rarely
COPY go.mod go.sum* ./

# 2. Download deps - cached unless go.mod changes
RUN go mod download

# 3. Copy Go source only (not frontend, not everything)
COPY cmd/ ./cmd/
COPY internal/ ./internal/

# 4. Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/build ./cmd/controlplane/dist

# Build the binary with version info
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags "-s -w -X github.com/starascendin/claude-agent-farm/controlplane/internal/version.Version=${VERSION} -X github.com/starascendin/claude-agent-farm/controlplane/internal/version.BuildTime=${BUILD_TIME}" \
    -o controlplane ./cmd/controlplane

# Runtime stage
FROM alpine:3.19

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN adduser -D -u 1000 appuser

# Copy binary from builder
COPY --from=builder /app/controlplane /app/controlplane

# Create data directory
RUN mkdir -p /data && chown appuser:appuser /data

USER appuser

EXPOSE 8080

ENV PORT=8080
ENV DB_PATH=/data/controlplane.db

CMD ["/app/controlplane"]
