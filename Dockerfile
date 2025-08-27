FROM node:18-alpine AS build-stage

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build
RUN cp -r src/assets dist/

FROM node:18-alpine AS production

WORKDIR /app

COPY --from=build-stage /app/dist ./dist

RUN npm install -g serve

EXPOSE 8080

CMD ["serve", "-s", "dist", "-l", "8080"]
