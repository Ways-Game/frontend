FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Копируем только необходимые файлы
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./

# Устанавливаем только production-зависимости
RUN npm install --only=production --legacy-peer-deps

# Устанавливаем serve для статического хостинга
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000", "--no-clipboard"]