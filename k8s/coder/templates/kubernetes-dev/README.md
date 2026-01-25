# Kubernetes Dev Workspace Template

This template creates a development workspace pod in your Kubernetes cluster.

## Features

- Ubuntu-based development environment
- VS Code (code-server) in browser
- Persistent home directory
- Configurable CPU, memory, and disk size

## Usage

1. Push this template to Coder:
   ```bash
   coder templates push kubernetes-dev --directory .
   ```

2. Create a workspace:
   ```bash
   coder create my-workspace --template kubernetes-dev
   ```

## Configuration

| Parameter | Options | Default |
|-----------|---------|---------|
| cpu | 0.5, 1, 2, 4 | 1 |
| memory | 1, 2, 4, 8 (GB) | 2 |
| disk_size | 10, 20, 50 (GB) | 10 |
