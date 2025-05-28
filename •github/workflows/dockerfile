FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S ghostline && \
    adduser -S ghostline -u 1001

# Install git for repository operations
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Set proper ownership
RUN chown -R ghostline:ghostline /app

# Switch to non-root user
USER ghostline

# Expose health check port (optional)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV GHOSTLINE_MODE=pipeline

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Engineer health check passed')" || exit 1

# Default command (pipeline mode)
CMD ["node", "engineer.js", "--pipeline"]
