#!/usr/bin/env bash
set -e

# Resolve repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo " Starting Soft Update (Rebuild with cache)"
echo "========================================="

echo "[1/3] Pulling latest changes from Git..."
git pull

echo "[2/3] Building (cached) and starting containers..."
docker compose up -d --build

echo "[3/3] Cleaning up dangling Docker images..."
docker image prune -f

echo "========================================="
echo " Soft update complete! Status:"
echo "========================================="
docker compose ps
