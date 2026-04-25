# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Build Next.js application
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT=8080

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/components.json ./
COPY --from=builder /app/postcss.config.mjs ./
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/entrypoint.sh ./
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/hooks ./hooks

# Copy production dependencies only
COPY --from=builder /app/node_modules ./node_modules

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Change to non-root user
USER nextjs

# Expose port
EXPOSE 8080

# Use entrypoint to handle credentials, then start server
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "--import", "tsx", "server.ts"]
