# Base image
FROM node:22-alpine AS base

# Install system dependencies (including SQLite and Puppeteer/Chromium dependencies)
RUN apk add --no-cache \
      sqlite \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Set environment variable for Chromium binary location
ENV CHROME_BIN=/usr/bin/chromium-browser

# All dependencies stage
FROM base AS deps
WORKDIR /app
ADD package.json package-lock.json ./
RUN npm ci

# Production dependencies stage
FROM base AS production-deps
WORKDIR /app
ADD package.json package-lock.json ./
RUN npm ci --omit=dev

# Build stage
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
ADD . .
RUN node ace build

# Production stage
FROM base
ENV NODE_ENV=production
WORKDIR /app

# Ensure the SQLite database path exists
RUN mkdir -p /sqlite && chown node:node /sqlite

# Copy production dependencies
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app

# Set user permissions
USER node

# Expose port
EXPOSE 8080

# Start server
CMD ["sh", "-c", "node ace migration:run --force && node ./bin/server.js"]
