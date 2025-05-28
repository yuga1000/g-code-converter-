# Используем стабильный образ Node
FROM node:18

WORKDIR /app

COPY package*.json ./

# Устанавливаем зависимости (без очистки кэша!)
RUN npm install --production

COPY . .

ENV NODE_ENV=production
ENV GHOSTLINE_MODE=pipeline

EXPOSE 3000

CMD ["node", "engineer.js", "--pipeline"]
