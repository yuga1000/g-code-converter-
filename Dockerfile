FROM node:18
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY . .
ENV NODE_ENV=production
ENV GHOSTLINE_MODE=pipeline
EXPOSE 3000
CMD ["node", "engineer.js", "--pipeline"]
