FROM node:18-alpine

WORKDIR /app

# System deps for FFmpeg + Prisma native deps
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

COPY package*.json ./
RUN npm ci

COPY . .

# Frontend will be built separately and copied if needed

# Set production env explicitly for better error handling
ENV NODE_ENV=production

# Optional: enable verbose logging for debugging build issues
ENV NPM_CONFIG_LOGLEVEL=verbose

# Ensure clean builds with explicit steps
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


CMD ["./start.sh"]
