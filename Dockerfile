FROM node:18-slim

WORKDIR /app

# Install git
RUN apt-get update && apt-get install -y git && apt-get clean

# Copy package.json first
COPY package.json .

# Install dependencies
RUN npm install

# Copy remaining files
COPY engineer.js .

# Set environment
ENV NODE_ENV=production

# Start command
CMD ["node", "engineer.js", "--pipeline"]
