.PHONY: build push deploy deploy-dry-run logs shell clean

IMAGE_REPO ?= ghcr.io/starascendin/moltbot
IMAGE_TAG ?= latest

# Build the moltbot container image
build:
	docker build -t $(IMAGE_REPO):$(IMAGE_TAG) .

# Push to container registry
push:
	docker push $(IMAGE_REPO):$(IMAGE_TAG)

# Build and push
build-push: build push

# Deploy to k8s using kustomize
deploy:
	kubectl apply -k k8s/

# Dry run deployment
deploy-dry-run:
	kubectl apply -k k8s/ --dry-run=client

# View deployment status
status:
	kubectl -n moltbot get pods,deployments

# Follow logs
logs:
	kubectl -n moltbot logs -f deployment/moltbot

# Get shell into the pod (for debugging)
shell:
	kubectl -n moltbot exec -it deployment/moltbot -- /bin/sh

# Delete all moltbot resources
clean:
	kubectl delete -k k8s/

# Restart the deployment
restart:
	kubectl -n moltbot rollout restart deployment/moltbot
