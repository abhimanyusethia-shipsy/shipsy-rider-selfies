# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Native build deps required by better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Native build deps needed at runtime for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install production deps only (includes better-sqlite3, rebuilt for this env)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built Next.js output
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./

# Data directory will be mounted as a persistent volume at /app/data
# (SQLite DB + uploaded images live here)
RUN mkdir -p /app/data/uploads/selfies /app/data/uploads/profiles

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
