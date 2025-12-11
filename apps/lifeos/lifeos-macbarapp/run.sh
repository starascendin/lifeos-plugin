#!/bin/bash
# TubeVault Runner Script for Platypus
# This script is the entry point for the Platypus app

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the project directory
cd "$SCRIPT_DIR"

# Run the main module using the virtual environment
exec "$SCRIPT_DIR/.venv/bin/python" -m tubevault.main "$@"
