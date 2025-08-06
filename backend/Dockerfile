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
RUN npm ci --only=production

COPY . .

RUN npx prisma generate
RUN npx prisma migrate deploy
RUN npm run build

# Optional: temp folders only if needed
RUN mkdir -p uploads processed temp

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:8000/api/health || exit 1

CMD ["node", "dist/server.js"]
