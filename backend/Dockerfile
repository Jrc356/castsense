# ─────────────────────────────────────────────────────────────────────────────
# CastSense Backend Dockerfile
# Multi-stage build for optimal image size
# ─────────────────────────────────────────────────────────────────────────────

# Base stage with Node.js and FFmpeg
FROM node:20-alpine AS base
RUN apk add --no-cache ffmpeg

# ─────────────────────────────────────────────────────────────────────────────
# Build stage - compile TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Production stage - minimal runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM base AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled application
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose default port
EXPOSE 3000

# Health check against /v1/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/v1/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
