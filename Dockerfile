FROM node:18-slim

WORKDIR /app

# Install git
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package.json ./

# Install dependencies
RUN npm install --only=production

# Copy source code
COPY engineer.js ./

# Set environment
ENV NODE_ENV=production

# Run the engineer in pipeline mode
CMD ["node", "engineer.js", "--pipeline"]
