#!/bin/bash
# Setup devmapper for Firecracker snapshotter
# Run this script on each worker node via SSH

set -euo pipefail

echo "=== Setting up devmapper for Firecracker ==="

# Create a thin pool for devmapper
LOOP_DEVICE="/dev/loop10"
POOL_NAME="containerd-pool"
DATA_FILE="/var/lib/containerd/devmapper/data"
META_FILE="/var/lib/containerd/devmapper/metadata"

# Create directories
mkdir -p /var/lib/containerd/devmapper

# Create sparse files for thin pool (10GB data, 256MB metadata)
if [ ! -f "$DATA_FILE" ]; then
    truncate -s 10G "$DATA_FILE"
    echo "Created data file: $DATA_FILE"
fi

if [ ! -f "$META_FILE" ]; then
    truncate -s 256M "$META_FILE"
    echo "Created metadata file: $META_FILE"
fi

# Setup loop devices
DATA_LOOP=$(losetup -f --show "$DATA_FILE")
META_LOOP=$(losetup -f --show "$META_FILE")

echo "Data loop: $DATA_LOOP"
echo "Meta loop: $META_LOOP"

# Create thin pool
DATA_SIZE=$(blockdev --getsize64 "$DATA_LOOP")
DATA_SECTORS=$((DATA_SIZE / 512))
META_SIZE=$(blockdev --getsize64 "$META_LOOP")
META_SECTORS=$((META_SIZE / 512))

# Create the thin-pool device
dmsetup create "${POOL_NAME}" --table "0 $DATA_SECTORS thin-pool $META_LOOP $DATA_LOOP 128 32768 1 skip_block_zeroing"

echo "Created thin pool: /dev/mapper/${POOL_NAME}"

# Create systemd service to recreate on boot
cat > /etc/systemd/system/containerd-devmapper.service << 'EOF'
[Unit]
Description=Setup devmapper for containerd
Before=k3s-agent.service
After=local-fs.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/setup-devmapper-boot.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

# Create boot script
cat > /usr/local/bin/setup-devmapper-boot.sh << 'BOOTSCRIPT'
#!/bin/bash
set -e
DATA_FILE="/var/lib/containerd/devmapper/data"
META_FILE="/var/lib/containerd/devmapper/metadata"
POOL_NAME="containerd-pool"

if dmsetup info "${POOL_NAME}" &>/dev/null; then
    echo "Pool already exists"
    exit 0
fi

DATA_LOOP=$(losetup -f --show "$DATA_FILE")
META_LOOP=$(losetup -f --show "$META_FILE")

DATA_SIZE=$(blockdev --getsize64 "$DATA_LOOP")
DATA_SECTORS=$((DATA_SIZE / 512))

dmsetup create "${POOL_NAME}" --table "0 $DATA_SECTORS thin-pool $META_LOOP $DATA_LOOP 128 32768 1 skip_block_zeroing"
BOOTSCRIPT

chmod +x /usr/local/bin/setup-devmapper-boot.sh

systemctl daemon-reload
systemctl enable containerd-devmapper.service

echo "=== Devmapper setup complete ==="
