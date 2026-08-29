#!/bin/sh
set -e

# Ensure data and uploads directories exist and are owned by node user
mkdir -p /app/data /app/uploads
chown -R node:node /app/data /app/uploads
chmod 775 /app/data /app/uploads

# Drop root privileges and execute CMD as node user
exec su-exec node "$@"

