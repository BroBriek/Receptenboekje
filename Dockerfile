# ── Stage 1: dependencies ──────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files and install production dependencies only.
# better-sqlite3 requires a native build step, so we need build tools.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install su-exec to securely step down from root after volume permissions are initialized
RUN apk add --no-cache su-exec

# Copy built node_modules from deps stage
COPY --from=deps --chown=node:node /app/node_modules ./node_modules

# Copy application source
COPY --chown=node:node src/ ./src/
COPY --chown=node:node package.json ./

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose the default application port (override via PORT env var)
EXPOSE 3001

ENV NODE_ENV=production \
    DB_PATH=/app/data/receptenboekje.db \
    UPLOADS_PATH=/app/uploads \
    PORT=3001

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
