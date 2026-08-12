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

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY package.json ./

# ── Volume mount points ────────────────────────────────────────────────────────
# These directories are declared as mount points so Docker Compose (or a plain
# `docker run -v`) can bind-mount host directories here.  Data is therefore
# never stored inside the container layer and survives image rebuilds.

# /app/data     → SQLite database file
# /app/uploads  → User-uploaded recipe images

RUN mkdir -p /app/data /app/uploads \
    && chown -R appuser:appgroup /app/data /app/uploads

VOLUME ["/app/data", "/app/uploads"]

# Drop to non-root user
USER appuser

# Expose the default application port (override via PORT env var)
EXPOSE 3000

ENV NODE_ENV=production \
    DB_PATH=/app/data/receptenboekje.db \
    UPLOADS_PATH=/app/uploads \
    PORT=3000

# Run migrations then start the server
CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
