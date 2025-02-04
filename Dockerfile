# Base image
FROM node:lts-alpine AS base

# Install system dependencies (including SQLite3)
RUN apk add --no-cache sqlite

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
CMD ["node", "./bin/server.js"]
