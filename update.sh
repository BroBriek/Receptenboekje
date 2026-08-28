#!/usr/bin/env bash
set -e

# Resolve repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo " Starting Full Update (Rebuild with --no-cache)"
echo "========================================="

echo "[1/4] Pulling latest changes from Git..."
git pull

echo "[2/4] Building Docker container without cache..."
docker compose build --no-cache

echo "[3/4] Recreating and starting containers..."
docker compose up -d --force-recreate

echo "[4/4] Cleaning up dangling Docker images..."
docker image prune -f

echo "========================================="
echo " Full update complete! Status:"
echo "========================================="
docker compose ps
