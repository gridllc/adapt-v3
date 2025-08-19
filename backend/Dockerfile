FROM node:18-alpine

WORKDIR /app

# System deps for FFmpeg + Prisma native deps
RUN apk add --no-cache \
    ffmpeg \
    ffmpeg-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# CRITICAL: Verify FFmpeg installation and show version
RUN ffmpeg -version || (echo "❌ FFmpeg installation failed" && exit 1)
RUN ffprobe -version || (echo "❌ FFprobe installation failed" && exit 1)
RUN echo "✅ FFmpeg tools verified successfully"

# 1) Copy package files + prisma early (before npm ci)
COPY package*.json ./
COPY prisma ./prisma

# 2) Install deps (postinstall can safely run prisma generate now)
RUN npm ci

# 3) Now copy the rest of the source
COPY . .

# Frontend will be built separately and copied if needed

# Set production environment
ENV NODE_ENV=production

# Build TypeScript application
RUN npx prisma generate
RUN npm run build

# Create necessary directories for video processing
RUN mkdir -p uploads processed temp \
    && chmod 755 temp \
    && ls -la temp

# Create startup script that handles migrations at runtime
COPY start.sh ./
RUN chmod +x start.sh

# Expose Render-required port (app uses process.env.PORT automatically)
EXPOSE 10000

# Health check on the port that Render expects
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:10000/health || exit 1

# Start app (Render sets PORT=10000, app binds automatically)
CMD ["npm", "run", "render:start"]
