FROM node:20-alpine
RUN apk add --no-cache iputils
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 5050
CMD ["node", "src/index.js"]
