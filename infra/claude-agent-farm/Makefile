.PHONY: help cluster destroy agent-build agent-push controlplane-build controlplane-push deploy logs

GHCR_REPO ?= ghcr.io/starascendin

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Cluster management
cluster: ## Create K3s cluster on Hetzner
	hetzner-k3s create --config cluster.yaml

destroy: ## Destroy the cluster
	hetzner-k3s delete --config cluster.yaml

# Agent container
agent-build: ## Build agent Docker image
	docker build --platform linux/amd64 -t $(GHCR_REPO)/claude-agent-farm-agent:latest ./agent

agent-push: agent-build ## Push agent image to GHCR
	docker push $(GHCR_REPO)/claude-agent-farm-agent:latest

# Control plane
controlplane-build: ## Build control plane Docker image
	docker build -t $(GHCR_REPO)/claude-controlplane:latest ./controlplane

controlplane-push: controlplane-build ## Push control plane image to GHCR
	docker push $(GHCR_REPO)/claude-controlplane:latest

# Combined builds
build-all: agent-build controlplane-build ## Build all Docker images

push-all: agent-push controlplane-push ## Push all images to GHCR

# Kubernetes deployment
deploy-base: ## Deploy base resources
	kubectl apply -f k8s/base/namespace.yaml

deploy-storage: ## Deploy storage (NFS server)
	kubectl apply -f k8s/storage/nfs-server.yaml
	kubectl wait --for=condition=ready pod -l app=nfs-server -n storage --timeout=120s
	kubectl apply -f k8s/storage/claude-credentials-pvc.yaml

deploy-kata: ## Deploy Kata containers runtime
	kubectl apply -f k8s/base/kata-deploy.yaml

deploy-controlplane: ## Deploy control plane
	kubectl apply -f k8s/controlplane/rbac.yaml
	kubectl apply -f k8s/controlplane/deployment.yaml

deploy-all: deploy-base deploy-storage deploy-kata deploy-controlplane ## Deploy everything

# Secrets
create-secrets: ## Create Kubernetes secrets from .env
	@source secrets/.env && \
	kubectl create secret generic github-credentials --from-literal=GITHUB_PAT=$$GITHUB_PAT --dry-run=client -o yaml | kubectl apply -f - && \
	kubectl create secret docker-registry ghcr-credentials \
		--docker-server=ghcr.io \
		--docker-username=$$GHCR_USERNAME \
		--docker-password=$$GITHUB_PAT \
		--dry-run=client -o yaml | kubectl apply -f -

# Utilities
login: ## Start Claude login pod
	kubectl apply -f k8s/utils/login-pod.yaml
	@echo "Run: kubectl exec -it claude-login -- bash"
	@echo "Then: claude /login"

test-kata: ## Test Kata runtime
	kubectl apply -f k8s/utils/kata-test-pod.yaml
	kubectl wait --for=condition=ready pod/kata-test --timeout=60s
	kubectl logs kata-test

test-nfs: ## Test NFS storage
	kubectl apply -f k8s/utils/nfs-test-pod.yaml

logs: ## Show control plane logs
	kubectl logs -f deployment/controlplane -n controlplane

status: ## Show cluster status
	@echo "=== Nodes ==="
	kubectl get nodes
	@echo "\n=== Pods ==="
	kubectl get pods -A
	@echo "\n=== RuntimeClasses ==="
	kubectl get runtimeclasses

# Local development
dev: ## Run control plane locally
	cd controlplane && go run ./cmd/controlplane
