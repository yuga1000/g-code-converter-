FROM node:18-slim

WORKDIR /app

# Install git and clean up
RUN apt-get update && \
    apt-get install -y git && \
    rm -rf /var/lib/apt/lists/*

# Copy all files at once to avoid context issues
COPY . .

# Install dependencies
RUN npm install --production

# Set environment
ENV NODE_ENV=production

# Start the engineer
CMD ["npm", "run", "pipeline"]
