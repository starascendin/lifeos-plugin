#!/bin/bash
# Install NFS provisioner via Helm
set -euo pipefail

echo "=== Installing NFS Subdir External Provisioner ==="

# Add Helm repo
helm repo add nfs-subdir-external-provisioner https://kubernetes-sigs.github.io/nfs-subdir-external-provisioner/
helm repo update

# Install provisioner
helm install nfs-provisioner nfs-subdir-external-provisioner/nfs-subdir-external-provisioner \
    --namespace storage \
    --create-namespace \
    --set nfs.server=10.43.100.100 \
    --set nfs.path=/exports \
    --set storageClass.name=nfs \
    --set storageClass.defaultClass=false \
    --set storageClass.reclaimPolicy=Retain

echo "=== NFS Provisioner installed ==="
kubectl get pods -n storage
