FROM node:18-alpine

WORKDIR /app

# System deps for FFmpeg + Prisma native deps
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# 1) Copy package files + prisma early (before npm ci)
COPY package*.json ./
COPY prisma ./prisma

# 2) Install deps (postinstall can safely run prisma generate now)
RUN npm ci

# 3) Now copy the rest of the source
COPY . .

# Frontend will be built separately and copied if needed

# Set production env explicitly for better error handling
ENV NODE_ENV=production

# Optional: enable verbose logging for debugging build issues
ENV NPM_CONFIG_LOGLEVEL=verbose

# Ensure clean builds with explicit steps
# Note: prisma generate already ran during npm ci (postinstall), but running again ensures consistency
RUN npx prisma generate
RUN npm run build

# Optional: temp folders only if needed
RUN mkdir -p uploads processed temp

# Create startup script that handles migrations at runtime
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8000/health || exit 1


# Use render:start for automatic migrations on boot
CMD ["npm", "run", "render:start"]
