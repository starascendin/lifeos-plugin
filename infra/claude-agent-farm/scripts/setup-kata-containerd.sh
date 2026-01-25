#!/bin/bash
# Configure containerd to use Kata with Firecracker
# Run this on each worker node after setup-devmapper.sh

set -euo pipefail

echo "=== Configuring containerd for Kata + Firecracker ==="

# Backup original config
cp /var/lib/rancher/k3s/agent/etc/containerd/config.toml \
   /var/lib/rancher/k3s/agent/etc/containerd/config.toml.backup

# Create containerd config template directory
mkdir -p /var/lib/rancher/k3s/agent/etc/containerd/

# Add Kata runtime configuration
cat >> /var/lib/rancher/k3s/agent/etc/containerd/config.toml.tmpl << 'EOF'

# Kata Containers with Firecracker runtime
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.kata-fc]
  runtime_type = "io.containerd.kata-fc.v2"
  privileged_without_host_devices = true
  pod_annotations = ["io.katacontainers.*"]
  [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.kata-fc.options]
    ConfigPath = "/opt/kata/share/defaults/kata-containers/configuration-fc.toml"

# Kata Containers with QEMU runtime (fallback)
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.kata-qemu]
  runtime_type = "io.containerd.kata-qemu.v2"
  privileged_without_host_devices = true
  pod_annotations = ["io.katacontainers.*"]
  [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.kata-qemu.options]
    ConfigPath = "/opt/kata/share/defaults/kata-containers/configuration-qemu.toml"

# Devmapper snapshotter for Firecracker
[plugins."io.containerd.snapshotter.v1.devmapper"]
  pool_name = "containerd-pool"
  root_path = "/var/lib/containerd/devmapper"
  base_image_size = "4096MB"
  discard_blocks = true
EOF

echo "Restarting k3s-agent..."
systemctl restart k3s-agent

echo "=== Containerd configuration complete ==="
