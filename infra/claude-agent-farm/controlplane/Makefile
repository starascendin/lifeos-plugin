.PHONY: all build dev frontend backend docker clean

# Build everything
all: frontend backend

# Build frontend
frontend:
	cd frontend && npm ci && npm run build
	rm -rf cmd/controlplane/dist
	cp -r frontend/dist cmd/controlplane/dist

# Build backend (requires frontend to be built first)
backend:
	CGO_ENABLED=1 go build -o bin/controlplane ./cmd/controlplane

# Build for production
build: frontend backend

# Development mode - run frontend and backend separately
dev-frontend:
	cd frontend && npm run dev

dev-backend:
	DB_PATH=./dev.db go run ./cmd/controlplane

# Run both in development (requires tmux or two terminals)
dev:
	@echo "Run these in separate terminals:"
	@echo "  make dev-frontend  (serves at http://localhost:5173)"
	@echo "  make dev-backend   (API at http://localhost:8080)"
	@echo ""
	@echo "Frontend proxies /api to backend automatically"

# Build Docker image
docker:
	docker build -t controlplane:latest .

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf frontend/dist
	rm -rf cmd/controlplane/dist
	mkdir -p cmd/controlplane/dist
	touch cmd/controlplane/dist/.gitkeep

# Install frontend dependencies
install:
	cd frontend && npm ci
