# Use Node.js 22 with Alpine (smaller image)
FROM node:22-alpine AS base

# Install system dependencies for Chromium and fonts
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ttf-liberation \
    noto-fonts \
    noto-fonts-cjk \
    noto-fonts-emoji \
    fontconfig \
    # Additional dependencies for headless Chrome
    udev \
    tzdata \
    # Required libraries for Chromium
    libstdc++ \
    # Development headers for native modules
    python3 \
    make \
    g++ \
    # SQLite dependencies
    sqlite \
    && fc-cache -f

# Configure environment variables
ENV CHROME_BIN=/usr/bin/chromium-browser \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    # Needed for headless Chrome in container
    CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --single-process --disable-gpu --disable-software-rasterizer --disable-features=ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter --enable-features=NetworkServiceInProcess"

# Create a non-root user and required directories
RUN mkdir -p /home/node/app \
    && chown -R node:node /home/node \
    && mkdir -p /sqlite \
    && chown node:node /sqlite

# Switch to non-root user
USER node
WORKDIR /home/node/app

# Copy package files first for better layer caching
FROM base AS deps
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

# Build stage
FROM base AS build
COPY --chown=node:node . .
COPY --from=deps --chown=node:node /home/node/app/node_modules ./node_modules
RUN node ace build

# Production image
FROM base
COPY --chown=node:node --from=build /home/node/app/build ./build
COPY --chown=node:node --from=deps /home/node/app/node_modules ./node_modules

# Ensure SQLite directory exists
RUN mkdir -p /sqlite && chown node:node /sqlite

# Expose port and start
EXPOSE 8080
CMD ["node", "./build/bin/server.js"]
