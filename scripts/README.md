# Setup Scripts

## Worker Node Setup (SSH into each worker)

Run these scripts in order on each worker node:

```bash
# 1. Setup devmapper for Firecracker
sudo bash setup-devmapper.sh

# 2. Configure containerd for Kata
sudo bash setup-kata-containerd.sh
```

## From Control Machine

After worker setup, apply Kata deployment:

```bash
# Label worker nodes
kubectl label nodes <worker1> kata-fc=true kata-qemu=true
kubectl label nodes <worker2> kata-fc=true kata-qemu=true

# Deploy Kata
kubectl apply -f ../k8s/base/kata-deploy.yaml

# Verify RuntimeClasses
kubectl get runtimeclasses

# Test with a pod
kubectl apply -f ../k8s/utils/kata-test-pod.yaml
kubectl logs kata-test
```
