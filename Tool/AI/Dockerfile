# Production Dockerfile for AI API Validation Tool
FROM node:20-alpine

WORKDIR /app

# Copy only package.json first for better caching
COPY package.json ./

# Copy application files
COPY public/ ./public/
COPY src/ ./src/
COPY sample-data/ ./sample-data/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nextjs -s /bin/sh && \
    mkdir -p /app/data && \
    chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 4173
ENV NODE_ENV=production
ENV PORT=4173

CMD ["node", "src/server.js"]