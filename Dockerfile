FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for tsx runtime)
RUN npm ci

# Copy source code
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED 1

# Expose port
EXPOSE 8080

# Use entrypoint to handle credentials, then start server
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "--import", "tsx", "server.ts"]
