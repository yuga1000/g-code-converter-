# Используем полноценный Node.js (не Alpine — в нём часто npm отваливается)
FROM node:18

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и lock-файл
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем весь код
COPY . .

# Устанавливаем переменные окружения
ENV NODE_ENV=production
ENV GHOSTLINE_MODE=pipeline

# Открываем порт (если нужен)
EXPOSE 3000

# Команда запуска
CMD ["node", "engineer.js", "--pipeline"]
